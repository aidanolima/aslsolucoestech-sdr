import { chromium } from 'playwright';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { leads } from '../db/schema.ts';

/**
 * Raspa seguidores de um perfil alvo e injeta na base de leads.
 * Utiliza o Chrome real conectado via Chrome DevTools Protocol (CDP).
 */
export async function scrapeFollowers(targetProfile: string, maxLeads: number = 30) {
  const cleanTarget = targetProfile.replace(/^@+/, '').trim();
  console.log(`🎯 [SCRAPER] Iniciando captação de seguidores do perfil: @${cleanTarget}`);

  const cdpUrl = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
  let browser;

  try {
    console.log(`[SCRAPER] Conectando ao Chrome via CDP...`);
    browser = await chromium.connectOverCDP(cdpUrl);
    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    const page = await context.newPage();

    console.log(`[SCRAPER] Navegando para o perfil @${cleanTarget}...`);
    await page.goto(`https://www.instagram.com/${cleanTarget}/`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Clica no link de seguidores para abrir o modal
    console.log(`[SCRAPER] Procurando o botão de seguidores...`);
    const followersSelectors = [
      `a[href="/${cleanTarget}/followers/"]`,
      `a[href*="/${cleanTarget}/followers"]`,
      `a[href*="/followers"]`,
      'a:has-text("seguidores")',
      'a:has-text("followers")'
    ];

    let clicked = false;
    for (const selector of followersSelectors) {
      try {
        const link = page.locator(selector).first();
        if (await link.isVisible({ timeout: 3000 })) {
          await link.click({ force: true });
          clicked = true;
          console.log(`[SCRAPER] Botão de seguidores clicado via seletor: "${selector}"`);
          break;
        }
      } catch (e) {}
    }

    if (!clicked) {
      throw new Error(`Não foi possível encontrar a lista de seguidores de @${cleanTarget}. O perfil é privado ou o Instagram mudou o layout.`);
    }

    console.log(`[SCRAPER] Aguardando o modal carregar...`);
    await page.waitForSelector('div[role="dialog"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // === NOVO: Trata o botão "Ver todos os seguidores" que o Instagram colocou ===
    try {
      const seeAllBtnSelectors = [
        'a:has-text("Ver todos os seguidores")',
        'a:has-text("See all followers")',
        'button:has-text("Ver todos")',
        'div[role="button"]:has-text("Ver todos")'
      ];
      
      for (const btnSel of seeAllBtnSelectors) {
        const seeAllBtn = page.locator(btnSel).first();
        if (await seeAllBtn.isVisible({ timeout: 2000 })) {
          console.log(`[SCRAPER] Botão 'Ver todos os seguidores' detectado. Clicando...`);
          await seeAllBtn.click({ force: true });
          await page.waitForTimeout(2500);
          break;
        }
      }
    } catch (e) {
      // Ignora, alguns perfis não têm esse botão
    }

    const collectedUsernames = new Set<string>();
    let previousCount = 0;
    let attempts = 0;

    console.log(`[SCRAPER] Iniciando extração (Meta: ${maxLeads} leads)...`);

    // Loop de rolagem dentro do modal
    while (collectedUsernames.size < maxLeads && attempts < 15) {
      // Busca todos os links e extrai o nome de usuário corretamente
      const links = await page.locator('div[role="dialog"] a[href^="/"]').evaluateAll((elements) => {
        return elements
          .map(el => {
            const href = el.getAttribute('href');
            if (!href) return null;
            // Pega apenas a primeira parte da URL (ex: de /neymarjr/followers tira só 'neymarjr')
            const parts = href.split('/').filter(p => p.length > 0);
            return parts.length > 0 ? parts[0] : null;
          })
          .filter(Boolean); // Remove nulos
      });

      links.forEach(username => {
        // Filtro blindado: Ignora palavras do sistema e o próprio alvo
        const invalidWords = ['explore', 'reels', 'p', 'stories', 'direct', cleanTarget];
        if (username && !invalidWords.includes(username.toLowerCase()) && collectedUsernames.size < maxLeads) {
          collectedUsernames.add(username as string);
        }
      });

      console.log(`[SCRAPER] Capturados: ${collectedUsernames.size}/${maxLeads}`);

      if (collectedUsernames.size >= maxLeads) break;

      if (collectedUsernames.size === previousCount) {
        attempts++;
      } else {
        attempts = 0;
      }
      previousCount = collectedUsernames.size;

      // === NOVO MOTOR DE ROLAGEM COM TECLADO HUMANO ===
      try {
        const elements = page.locator('div[role="dialog"] a[href^="/"]');
        const count = await elements.count();
        if (count > 0) {
          // Foca no último link visível e aperta "PageDown" (Técnica indetectável e infalível)
          await elements.nth(count - 1).focus();
          await page.keyboard.press('PageDown');
          await page.keyboard.press('PageDown');
        }
      } catch (e) {
        // Fallback
      }

      const scrollDelay = Math.floor(Math.random() * (1500 - 800 + 1)) + 800;
      await page.waitForTimeout(scrollDelay);
    }

    console.log(`✅ [SCRAPER] Extração concluída. Total único: ${collectedUsernames.size}`);
    await page.close();

    if (collectedUsernames.size > 0) {
      console.log(`💾 [SCRAPER] Salvando leads no banco de dados...`);
      let importedCount = 0;

      for (const username of collectedUsernames) {
        const existing = await db.select().from(leads).where(eq(leads.username, username)).limit(1);
        
        if (existing.length === 0) {
          await db.insert(leads).values({
            instagramId: `ig_${username}`,
            username: username,
            pipelineState: 'new',
          }).onConflictDoNothing();
          importedCount++;
        }
      }
      console.log(`🎉 [SCRAPER] Sucesso! ${importedCount} leads NOVOS adicionados à Mesa de CRM.`);
    }

  } catch (error) {
    console.error('❌ [SCRAPER] Erro ao extrair seguidores:', error);
  } finally {
    if (browser) {
      console.log('[SCRAPER] Desconectando CDP (mantendo navegador aberto).');
    }
  }
}