import { chromium } from 'playwright';

export interface ScrapedProfile {
  username: string;
  fullName: string | null;
  bio: string | null;
}

export async function scrapeInstagramProfile(handle: string): Promise<ScrapedProfile> {
  const cleanHandle = handle.replace('@', '').trim();
  const cdpUrl = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';

  let browser;
  let page;

  try {
    // Conecta ao Chrome existente via CDP
    browser = await chromium.connectOverCDP(cdpUrl);
  } catch (error: any) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('WebSocket connection')) {
      console.warn('[⚠️ SCRAPER] Chrome fechado. Pressione Forçar Execução com o navegador de debug aberto.');
      return { username: handle, fullName: null, bio: null };
    }
    throw error;
  }

  try {
    // Obtém o contexto ativo ou cria um fallback de segurança
    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    
    page = await context.newPage();

    const url = `https://www.instagram.com/${cleanHandle}/`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Aguarda a renderização dos componentes principais da SPA
    await page.waitForTimeout(4000);

    // Validação de perfil público e existência da página
    const isNotFound = await page.$('text="Esta página não está disponível"') || 
                       await page.$('text="Page Not Found"');

    if (isNotFound) {
      console.warn(`[SCRAPER] Perfil não encontrado: @${cleanHandle}`);
      return { username: handle, fullName: null, bio: null };
    }

    // Tenta aguardar a presença do cabeçalho do perfil
    try {
      await page.waitForSelector('header', { timeout: 8000 });
    } catch {
      console.warn(`[SCRAPER] Falha no carregamento do cabeçalho para: @${cleanHandle}`);
      return { username: handle, fullName: null, bio: null };
    }

    // Extração do Nome (Resiliente a variações de marcação)
    let fullName: string | null = null;
    const nameSelectors = [
      'header h1',
      'header section span',
      'header h2'
    ];

    for (const selector of nameSelectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 0) {
          fullName = text.trim();
          break;
        }
      }
    }

    // Extração da Bio (Múltiplos fallbacks para contornar alterações de layout da Meta)
    let bio: string | null = null;
    const bioSelectors = [
      'header section > div:last-child',
      'header section div._aa_c',
      'header div.-v2fl',
      'header section span._ap2a'
    ];

    for (const selector of bioSelectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 0 && text !== fullName) {
          bio = text.trim();
          break;
        }
      }
    }

    // Fallback via meta tag se a renderização DOM falhar
    if (!bio) {
      const metaDescription = await page.$eval(
        'meta[property="og:description"]',
        (el) => el.getAttribute('content')
      ).catch(() => null);

      if (metaDescription) {
        bio = metaDescription;
      }
    }

    return {
      username: handle,
      fullName: fullName || cleanHandle,
      bio: bio || null,
    };

  } catch (error) {
    console.error(`[SCRAPER ERROR] Erro ao raspar o perfil @${cleanHandle}:`, error);
    return { username: handle, fullName: null, bio: null };
  } finally {
    // Fecha estritamente a aba aberta, preservando o navegador do usuário
    if (page) {
      await page.close().catch(() => {});
    }
  }
}