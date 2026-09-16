import { db } from './src/db/index.ts';
import { leads } from './src/db/schema.ts';

async function insertTestLead() {
  console.log("💉 Injetando lead de teste no banco de dados...");
  
  try {
    await db.insert(leads).values({
      instagramId: '123456789', // ID fictício
      username: 'aidanolima', // O perfil que o bot vai achar
      fullName: 'Áidano Lima',
      niche: 'Tecnologia / Teste',
      score: 10,
      pipelineState: 'contacted', // Colocamos como 'contacted' para o bot atualizar para 'replied'
      channelState: 'open'
    });
    console.log("✅ Lead @aidanolima inserido com sucesso!");
  } catch (error) {
    console.log("⚠️ O lead já existe ou houve um erro:", error);
  }
  
  process.exit(0);
}

insertTestLead();