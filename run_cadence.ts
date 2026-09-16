import 'dotenv/config';
import { db } from './src/db/index.ts';
import { leads } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { processCadenceFlow } from './src/services/cadenceFlow.ts';
import { ensureTablesExist } from './src/db/ensureTables.ts';
import { sendPendingDirects } from './src/services/directSender.ts';
import { checkInboxResponses } from './src/services/inboxMonitor.ts';
import { scheduleFollowUps } from './src/services/followUpService.ts';

export async function run() {
  console.log('🚀 Iniciando fluxo de cadência autônomo...');
  try {
    await ensureTablesExist();

    // 0. Monitorar Inbox (Identifica quem já respondeu)
    await checkInboxResponses();

    // 1. Agendar Follow-ups (Para quem NÃO respondeu após 24h)
    await scheduleFollowUps();

    // 2. Buscar leads novos para qualificar
    const leadsToQualify = await db
      .select({ username: leads.username })
      .from(leads)
      .where(eq(leads.pipelineState, 'discovered'));

    if (leadsToQualify.length > 0) {
      const handles = leadsToQualify.map(l => `@${l.username}`);
      console.log(`🔍 Encontrados ${handles.length} leads para qualificar.`);
      await processCadenceFlow(handles);
    } else {
      console.log('ℹ️ Nenhum lead novo para qualificar.');
    }
    
    // 2. Enviar DMs pendentes
    console.log('📬 Iniciando envio de DMs pendentes...');
    await sendPendingDirects();
    
    console.log('✅ Fluxo de cadência e envios finalizados com sucesso.');
  } catch (error) {
    console.error('❌ Erro durante a execução do fluxo de cadência:', error);
  }
}

// Verifica se este arquivo está sendo executado diretamente (como script principal)
if (import.meta.url === new URL(import.meta.url).href && process.argv[1].endsWith('run_cadence.ts')) {
  run();
}