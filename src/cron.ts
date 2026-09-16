import cron from 'node-cron';
import { run } from '../run_cadence.ts';

console.log('🤖 Motor Autônomo inicializando...');

// Agendar para rodar a cada minuto: * * * * *
// O formato cron é: minuto hora diaDoMes mes diaDaSemana
cron.schedule('* * * * *', async () => {
  console.log('⏰ [CRON] Janela de execução disparada: iniciando cadência...');
  await run();
  console.log('💤 [CRON] Cadência finalizada. Motor em modo de vigília aguardando a próxima janela.');
});

console.log('✅ Motor Autônomo está em modo de vigília aguardando a próxima janela de execução (agendado a cada minuto).');
