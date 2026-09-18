import 'dotenv/config';
import { scrapeFollowers } from './src/services/leadScraper.ts';

async function run() {
  const targetProfile = process.argv[2];
  const maxLeads = parseInt(process.argv[3] || '30', 10);

  if (!targetProfile) {
    console.error('❌ [SYS] Erro: Perfil alvo não fornecido.');
    process.exit(1);
  }

  try {
    await scrapeFollowers(targetProfile, maxLeads);
    console.log('✅ [SISTEMA] Processo finalizado com código 0');
  } catch (error) {
    console.error('❌ [SYS] Erro crítico no scraper:', error);
    process.exit(1);
  }
}

run();