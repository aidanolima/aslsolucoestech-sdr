import { chromium } from 'playwright';
import { db } from '../db/index.ts'; 
import { leads } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { performHandoff } from './handoffService.ts';

export async function checkInboxResponses() {
  console.log("📬 [INBOX MONITOR] Iniciando varredura de inbox...");
  
  let browser;
  try {
    // Conecta ao Chrome já aberto na porta 9222
    console.log("🔌 Conectando ao Chrome via CDP...");
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();

    console.log("🧭 Navegando para o Instagram Inbox...");
    await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' });
    
    // Pausa humana
    const waitTime = Math.floor(Math.random() * 2000) + 3000;
    console.log(`⏱️ Aguardando pausa humana de ${waitTime}ms...`);
    await page.waitForTimeout(waitTime);

    // 1. TENTATIVA DE FECHAR POP-UPS
    try {
      await page.locator('button:has-text("Agora não"), button:has-text("Not Now")').first().click({ timeout: 3000 });
      console.log("🖱️ Pop-up de notificação fechado com sucesso.");
      await page.waitForTimeout(1000); 
    } catch (e) {
      // Segue fluxo normal se não tiver pop-up
    }

    console.log("🔍 Procurando por mensagens não lidas...");
    
    // 2. O SELETOR DEFINITIVO (Usando o Raio-X do Instagram)
    const unreadLocators = page.locator('div[role="button"]:has(div:text-is("Unread")), a[href*="/direct/t/"]:has(div:text-is("Unread"))');
    
    const unreadCount = await unreadLocators.count();

    if (unreadCount === 0) {
      console.log("⚠️ Nenhuma mensagem não lida encontrada.");
      console.log("✅ Varredura do inbox finalizada.");
      return;
    }

    console.log(`📊 Encontradas ${unreadCount} conversas não lidas. Processando...`);
    
    // 3. Clica na primeira mensagem não lida encontrada
    await unreadLocators.first().click();
    await page.waitForTimeout(2500); // Aguarda o chat abrir

    // 4. EXTRAÇÃO DO NOME DE USUÁRIO E HANDOFF (Modo Sniper)
    try {
      // Espera um segundinho a mais para garantir que o chat abriu e carregou a foto do lead
      await page.waitForTimeout(1500);

      // Pega TODOS os links da tela que parecem ser perfis
      const profileLinks = page.locator('a[href^="/"]:not([href="/"]):not([href*="/explore/"]):not([href*="/reels/"]):not([href*="/direct/"])');
      const count = await profileLinks.count();
      
      const uniqueUsernames = new Set<string>();
      
      for (let i = 0; i < count; i++) {
        const href = await profileLinks.nth(i).getAttribute('href');
        if (href) {
          const clean = href.replace(/\//g, '').trim();
          if (clean && clean.length > 1) { // Ignora links vazios ou com 1 letra
            uniqueUsernames.add(clean);
          }
        }
      }

      const usernamesArray = Array.from(uniqueUsernames);
      console.log("🔍 Perfis detectados na tela:", usernamesArray);

      // O primeiro (0) é sempre o seu próprio usuário logado no menu lateral.
      // O segundo (1) é o lead no cabeçalho do chat!
      let username = '';
      if (usernamesArray.length > 1) {
        username = usernamesArray[1]; // Pega o lead!
      } else if (usernamesArray.length === 1) {
        username = usernamesArray[0]; // Fallback de segurança
      }

      if (username) {
        console.log(`👤 Nova resposta recebida e validada: @${username}`);
        
        // Busca o lead no banco
        const leadRecords = await db.select().from(leads).where(eq(leads.username, username));
        
        if (leadRecords.length > 0) {
           const lead = leadRecords[0];
           // Atualiza o status
           await db.update(leads).set({ pipelineState: 'replied' }).where(eq(leads.id, lead.id));
           console.log(`💾 Banco atualizado: @${username} marcado como 'replied'.`);
           
           // Repassa para a etapa final
           //await performHandoff(lead.id);
           // Repassa para a etapa final e pega o link gerado
           const linkToSend = await performHandoff(lead.id);
           
           if (linkToSend) {
             console.log(`⌨️ [INBOX] Digitando o link de Handoff no chat...`);
             
             // Seleciona a caixa de texto do Instagram
             const chatBox = page.locator('div[role="textbox"][contenteditable="true"]').first();
             
             // Digita a mensagem com o link
             await chatBox.fill(`Que bom que respondeu! Aqui está o link que combinamos: ${linkToSend}`);
             await page.waitForTimeout(1000);
             
             // Aperta Enter para enviar
             await chatBox.press('Enter');
             console.log(`✅ [INBOX] Mensagem e link enviados com sucesso no direct!`);
             await page.waitForTimeout(2000); // Pausa para garantir o envio antes de fechar
           }
           /////// novo bloco encerra aqui
        } else {
           console.log(`⚠️ O perfil @${username} respondeu, mas não foi encontrado no banco de dados.`);
        }
      } else {
        console.log(`⚠️ Nenhum username válido encontrado na extração.`);
      }
    } catch (e) {
      console.log("❌ Erro ao extrair os links de perfil na tela.");
      await page.screenshot({ path: 'inbox_username_error.png' }).catch(() => {});
    }

    console.log("✅ Varredura do inbox finalizada com sucesso.");

  } catch (error) {
    console.error("❌ Erro durante a varredura do inbox:", error);
  } finally {
    // Desconecta do Chrome
    if (browser) await browser.close(); 
  }
}