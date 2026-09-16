import { db } from './src/db/index.ts';
import { leads } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function setupTestLeads() {
  console.log('🧪 Configurando leads de teste...');
  
  const testUsername = 'test_lead_followup';
  
  // Limpa lead de teste se existir
  await db.delete(leads).where(eq(leads.username, testUsername));

  // 1. Lead para testar Follow-up (Simulando contato feito há 25h)
  const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000);
  await db.insert(leads).values({
    instagramId: `ig_${testUsername}`,
    username: testUsername,
    pipelineState: 'contacted',
    channelState: 'contacted',
    updatedAt: twentyFiveHoursAgo
  });

  console.log('✅ Lead de teste de follow-up criado (25h atrás).');
  process.exit(0);
}

setupTestLeads();
