import 'dotenv/config'; 
import { analyzeProfile } from './src/integrations/gemini/agent.ts';

async function runTest() {
  console.log("🤖 Iniciando Teste de Contexto da IA (SDR Elite - Software House)...");
  
  // Perfil REAL do seu ICP (Advogado)
  const handleICP = '@deboramonteiroadv'; 
  
  // Perfil famoso para forçar a IA a rejeitar
  const handleRuim = '@neymarjr'; 

  try {
    console.log(`\n👉 Analisando perfil ICP (Real): ${handleICP}`);
    const resultICP = await analyzeProfile({ username: handleICP, bio: null });
    console.log("✅ Resultado ICP:", resultICP);

    console.log(`\n👉 Analisando perfil Fora do Nicho: ${handleRuim}`);
    const resultRuim = await analyzeProfile({ username: handleRuim, bio: null });
    console.log("✅ Resultado Fora do Nicho:", resultRuim);
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

runTest();