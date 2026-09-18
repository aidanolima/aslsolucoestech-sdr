import { chromium } from 'playwright';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { leads, messages } from '../db/schema.ts';

/**
 * Envia mensagens diretas (DMs) pendentes no Instagram para leads qualificados.
 * Utiliza o Chrome real conectado via Chrome DevTools Protocol (CDP).
 */
export async function sendPendingDirects() {
  console.log('📬 [DIRECT SENDER] Buscando leads "Qualificados" com envio de direct pendente...');

  // 1. Buscar no banco SQLite os leads com channelState = 'browser_contact_pending' juntamente com seus icebreakers
  const pendingLeadsData = await db
    .select({
      lead: leads,
      message: messages,
    })
    .from(leads)
    .innerJoin(messages, eq(messages.leadId, leads.id))
    .where(
      and(
        eq(leads.channelState, 'browser_contact_pending'),
        eq(messages.direction, 'outbound'),
        // ✨ A GRANDE TRAVA DE SEGURANÇA: Só puxa se a IA disse expressamente que é QUALIFICADO
        eq(leads.pipelineState, 'qualified')
      )
    );

  if (pendingLeadsData.length === 0) {
    console.log('✅ [DIRECT SENDER] Nenhum lead QUALIFICADO pendente de envio no momento.');
    return;
  }

  // Agrupa os leads para garantir unicidade por lead.id (pega a mensagem de maior ID/mais recente)
  const leadMap = new Map<number, { lead: typeof leads.$inferSelect; messageContent: string; messageId: number }>();

  for (const row of pendingLeadsData) {
    if (!row.lead || !row.message) continue;

    const existing = leadMap.get(row.lead.id);
    if (!existing || row.message.id > existing.messageId) {
      leadMap.set(row.lead.id, {
        lead: row.lead,
        messageContent: row.message.content,
        messageId: row.message.id,
      });
    }
  }

  const uniquePendingLeads = Array.from(leadMap.values());
  console.log(`[DIRECT SENDER] Encontrado(s) ${uniquePendingLeads.length} lead(s) pendente(s) único(s) para contato.`);

  const cdpUrl = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
  let browser;

  try {
    // 2. Conectar ao Chrome via CDP (127.0.0.1:9222)
    console.log(`[DIRECT SENDER] Conectando ao Chrome via CDP em: ${cdpUrl}`);
    browser = await chromium.connectOverCDP(cdpUrl);
  } catch (error: any) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('WebSocket connection')) {
      console.warn('[⚠️ DIRECT SENDER] Chrome fechado. Pressione Forçar Execução com o navegador de debug aberto.');
      return;
    }
    throw error;
  }
  
  try {
    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();

    // Verificação de saúde da conexão
    if (!browser.isConnected()) {
      throw new Error('Conexão com Chrome via CDP perdida antes de processar leads.');
    }

    for (let i = 0; i < uniquePendingLeads.length; i++) {
      const { lead, messageContent } = uniquePendingLeads[i];
      const cleanUsername = lead.username.replace('@', '').trim();
      const profileUrl = `https://www.instagram.com/${cleanUsername}/`;

      console.log(`\n👉 [DIRECT SENDER] [${i + 1}/${uniquePendingLeads.length}] Iniciando envio para: @${cleanUsername}`);
      
      let page;
      try {
        // Cria nova aba no contexto existente (sem afetar as abas ativas do usuário)
        page = await context.newPage();

        // 3. Navegar até a URL do perfil
        console.log(`[DIRECT SENDER] Navegando para ${profileUrl}`);
        await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 35000 });

        // Pausa aleatória de 3 a 5 segundos após carregar
        const postLoadDelay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
        console.log(`[DIRECT SENDER] Aguardando pausa humana de pós-carregamento (${postLoadDelay / 1000}s)...`);
        await page.waitForTimeout(postLoadDelay);

        // Validação de página existente/pública
        const isNotFound = await page.$('text="Esta página não está disponível"') || 
                           await page.$('text="Page Not Found"');

        if (isNotFound) {
          console.warn(`⚠️ [DIRECT SENDER] Perfil não encontrado ou indisponível: @${cleanUsername}. Pulando.`);
          continue;
        }

        // Aguarda a presença do cabeçalho do perfil para garantir carregamento completo
        await page.waitForSelector('header', { timeout: 10000 });

        // 4. Localizar e clicar no botão 'Enviar mensagem' ou 'Message'
        console.log('[DIRECT SENDER] Procurando botão "Enviar mensagem" / "Message"...');
        const messageButtonSelectors = [
          'div[role="button"]:has-text("Enviar mensagem")',
          'div[role="button"]:has-text("Message")',
          'button:has-text("Enviar mensagem")',
          'button:has-text("Message")',
          'role=button[name=/Enviar mensagem|Message/i]'
        ];

        let clicked = false;
        for (const selector of messageButtonSelectors) {
          try {
            const btn = page.locator(selector).first();
            if (await btn.isVisible()) {
              await btn.click();
              clicked = true;
              console.log(`[DIRECT SENDER] Botão clicado via seletor: "${selector}"`);
              break;
            }
          } catch {
            // Ignorar erro do seletor específico e tentar o próximo
          }
        }

        // Fallback de varredura manual de elementos se seletores diretos falharem
        if (!clicked) {
          const allButtons = await page.$$('button, div[role="button"]');
          for (const btn of allButtons) {
            const text = await btn.textContent();
            if (text && (text.includes('Enviar mensagem') || text.includes('Message'))) {
              await btn.click();
              clicked = true;
              console.log('[DIRECT SENDER] Botão clicado via varredura manual de texto.');
              break;
            }
          }
        }

        if (!clicked) {
          console.error(`❌ [DIRECT SENDER] Não foi possível encontrar o botão "Enviar mensagem" para @${cleanUsername}`);
          continue;
        }

        // Aguarda a transição e renderização da tela de chat de direct do Instagram
        console.log('[DIRECT SENDER] Aguardando redirecionamento para o chat de direct...');
        await page.waitForTimeout(5000);

        // 5. Tratar eventuais pop-ups de notificação (ex: 'Agora não' / 'Not now')
        console.log('[DIRECT SENDER] Verificando se há pop-ups de notificação ou salvar informações...');
        const popupSelectors = [
          'button:has-text("Agora não")',
          'button:has-text("Not now")',
          'button:has-text("Save Info")',
          'button:has-text("Salvar informações")'
        ];

        for (const selector of popupSelectors) {
          try {
            const popupBtn = page.locator(selector).first();
            if (await popupBtn.isVisible()) {
              await popupBtn.click();
              console.log(`[DIRECT SENDER] Pop-up tratado com sucesso: "${selector}"`);
              await page.waitForTimeout(2000);
            }
          } catch {
            // Seguir em frente caso falhe
          }
        }

        // 6. Aguarde o campo de texto da DM carregar
        console.log('[DIRECT SENDER] Aguardando o campo de texto carregar...');
        let messageInput = null;

        try {
          const primarySelector = 'div[contenteditable="true"][role="textbox"]';
          await page.waitForSelector(primarySelector, { timeout: 15000, state: 'attached' });
          messageInput = page.locator(primarySelector).first();
          console.log(`[DIRECT SENDER] Campo de texto localizado via seletor principal.`);
        } catch (e) {
          console.log('[DIRECT SENDER] Seletor principal falhou. Tentando fallbacks...');
          const fallbackSelectors = [
            'div[contenteditable="true"]',
            'textarea[placeholder*="Message"]',
            'textarea[placeholder*="Mensagem"]'
          ];
          
          for (const selector of fallbackSelectors) {
            try {
              const input = page.locator(selector).first();
              if (await input.count() > 0) {
                messageInput = input;
                console.log(`[DIRECT SENDER] Campo de texto localizado via fallback: "${selector}"`);
                break;
              }
            } catch {}
          }
        }

        if (!messageInput) {
          console.error(`❌ [DIRECT SENDER] Não foi possível encontrar a caixa de texto da DM para @${cleanUsername}`);
          continue;
        }

        console.log('[DIRECT SENDER] Clicando na caixa de texto...');
        await messageInput.click({ force: true });
        await page.waitForTimeout(1000);

        // 7. Digite a mensagem de forma humanizada (delay aleatório por caractere)
        console.log(`[DIRECT SENDER] Digitando mensagem de forma humanizada...`);
        const charDelay = Math.floor(Math.random() * (120 - 50 + 1)) + 50;
        await messageInput.pressSequentially(messageContent, { delay: charDelay });
        
        const preSendDelay = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
        await page.waitForTimeout(preSendDelay);

        // 8. Pressione 'Enter' para enviar
        console.log('[DIRECT SENDER] Pressionando Enter para enviar direct...');
        await messageInput.press('Enter');

        await page.waitForTimeout(4000);
        console.log(`✨ [DIRECT SENDER] Mensagem enviada com sucesso para @${cleanUsername}!`);

        // 9. Atualizar o status do lead para 'contacted'
        console.log('[DIRECT SENDER] Atualizando o status do lead no SQLite...');
        await db.update(leads)
          .set({
            pipelineState: 'contacted',
            channelState: 'contacted',
            updatedAt: Date.now()
          })
          .where(eq(leads.id, lead.id));

        console.log(`💾 [DIRECT SENDER] Banco de dados atualizado: Lead ID ${lead.id} marcado como contacted.`);

        // 10. Adicionar intervalo aleatório de segurança (antiban) de 30 a 60 segundos
        if (i < uniquePendingLeads.length - 1) {
          const antibanDelay = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
          console.log(`🛡️ [ANTIBAN] Aguardando intervalo de segurança de ${antibanDelay / 1000}s antes de prospecção do próximo perfil...`);
          await page.waitForTimeout(antibanDelay);
        }

      } catch (leadError) {
        console.error(`❌ [DIRECT SENDER ERROR] Falha ao processar direct para o lead @${cleanUsername}:`, leadError);
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
      }
    }

  } catch (error) {
    console.error('❌ [DIRECT SENDER ERROR] Erro crítico no fluxo do Direct Sender:', error);
  } finally {
    console.log('[DIRECT SENDER] Processo de envio de directs finalizado.');
  }
}