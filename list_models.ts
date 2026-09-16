import dotenv from 'dotenv';
dotenv.config();

async function listGeminiModels() {
  console.log("🔍 Consultando os servidores do Google...");
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log("❌ Nenhuma GEMINI_API_KEY encontrada no seu arquivo .env!");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models) {
      const geminiModels = data.models
        .map((m: any) => m.name.replace('models/', ''))
        .filter((n: string) => n.includes('gemini'));
        
      console.log("✅ Modelos liberados para a sua chave de API:");
      console.log(geminiModels);
    } else {
      console.log("⚠️ Resposta inesperada do Google:", data);
    }
  } catch (error) {
    console.error("❌ Erro ao consultar a API:", error);
  }
}

listGeminiModels();