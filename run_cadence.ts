import 'dotenv/config';
import { db } from './src/db/index.ts';
import { leads, campaignSettings } from './src/db/schema.ts';
import { eq, or } from 'drizzle-orm';
import { processCadenceFlow } from './src/services/cadenceFlow.ts';
import { ensureTablesExist } from './src/db/ensureTables.ts';
import { sendPendingDirects } from './src/services/directSender.ts';
import { checkInboxResponses } from './src/services/inboxMonitor.ts';
import { scheduleFollowUps } from './src/services/followUpService.ts';

export async function run() {
  console.log('🚀 Iniciando fluxo de cadência autônomo...');
  try {
    await ensureTablesExist();

    // Buscar configurações da campanha para contexto da IA
    const settings = await db.select().from(campaignSettings).limit(1);
    const campaignContext = settings[0];

    // 🔥 BLINDAGEM: Trava a cadência se as configurações estiverem vazias
    if (!campaignContext || !campaignContext.aiMessage) {
      console.log('⚠️ [SISTEMA] Configurações incompletas! Clique na Engrenagem (⚙️) no Dashboard, preencha os dados e clique em Salvar antes de rodar.');
      return; 
    }

    // 0. Monitorar Inbox (Identifica quem já respondeu)
    await checkInboxResponses();

    // 1. Agendar Follow-ups (Para quem NÃO respondeu após 24h)
    await scheduleFollowUps();

    // 2. Buscar leads novos para qualificar (Captura 'new' e 'discovered')
    const leadsToQualify = await db
      .select({ username: leads.username })
      .from(leads)
      .where(
        or(
          eq(leads.pipelineState, 'new'),
          eq(leads.pipelineState, 'discovered')
        )
      );

    if (leadsToQualify.length > 0) {
      const handles = leadsToQualify.map(l => `@${l.username}`);
      console.log(`🔍 Encontrados ${handles.length} leads "Novos" para qualificar.`);
      await processCadenceFlow(handles, campaignContext);
    } else {
      console.log('ℹ️ Nenhum lead "Novo" aguardando qualificação pela IA.');
    }
    
    // 3. Enviar DMs pendentes
    console.log('📬 Buscando leads "Qualificados" para envio de DMs...');
    await sendPendingDirects();
    
    console.log('✅ Fluxo de cadência e envios finalizados com sucesso.');
  } catch (error) {
    console.error('❌ Erro durante a execução do fluxo de cadência:', error);
  }
}

// Execução direta e blindada para o Windows/Node
run();