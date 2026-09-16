import { db } from './src/db/index';
import { leads } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function setupFollowupTest() {
  const username = '@advogado_sumido';
  const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;

  console.log(`🚀 Iniciando setup de teste para followup...`);

  try {
    // Remove lead existente para garantir um estado limpo
    await db.delete(leads).where(eq(leads.username, username));

    // Insere o lead fake
    await db.insert(leads).values({
      instagramId: 'fake_sumido_123',
      username: username,
      fullName: 'Advogado Sumido (Teste)',
      pipelineState: 'contacted',
      updatedAt: twentyFiveHoursAgo,
      createdAt: twentyFiveHoursAgo, // Também antigo para consistência
    });

    console.log(`✅ Sucesso: Lead fake '${username}' inserido.`);
    console.log(`   - Pipeline State: contacted`);
    console.log(`   - UpdatedAt: ${new Date(twentyFiveHoursAgo).toISOString()} (há 25h)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao inserir lead fake:', error);
    process.exit(1);
  }
}

setupFollowupTest();
