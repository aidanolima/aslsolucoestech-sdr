import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = (globalThis as {
  process?: { env?: { GEMINI_API_KEY?: string } };
}).process?.env?.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(geminiApiKey!);

// Função auxiliar de retry simples para lidar com erros 429 (Rate Limit) e 503 (Service Unavailable / Alta Demanda)
async function generateContentWithRetry(model: any, prompt: string, retries = 2, delayMs = 5000): Promise<any> {
  try {
    return await model.generateContent(prompt);
  } catch (error: any) {
    // Verifica se o erro é 429 (Rate Limit), RESOURCE_EXHAUSTED ou cota esgotada
    const isRateLimit =
      error?.status === 429 ||
      error?.statusCode === 429 ||
      (error?.message && (
        error.message.includes("429") ||
        error.message.includes("RESOURCE_EXHAUSTED") ||
        error.message.includes("quota")
      ));

    // Verifica se o erro é 503 (Service Unavailable), alta demanda ou sobrecarga temporária
    const isServiceUnavailable =
      error?.status === 503 ||
      error?.statusCode === 503 ||
      (error?.message && (
        error.message.includes("503") ||
        error.message.includes("high demand") ||
        error.message.includes("Service Unavailable")
      ));

    const shouldRetry = isRateLimit || isServiceUnavailable;

    if (shouldRetry && retries > 0) {
      console.warn(`[Gemini] Erro detectado (Rate Limit 429 ou Serviço Indisponível 503). Aguardando ${delayMs}ms antes de tentar novamente... (Tentativas restantes:${retries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return generateContentWithRetry(model, prompt, retries - 1, delayMs);
    }
    throw error;
  }
}

export async function analyzeProfile(
  profile: { username: string; bio: string | null },
  campaignContext?: {
    businessName?: string | null;
    productOffer?: string | null;
    targetAudience?: string | null;
    aiCriteria?: string | null;
    aiMessage?: string | null;
  }
): Promise<{ score: number; interested: boolean; icebreaker: string; niche: string; reason: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const businessName = campaignContext?.businessName || "Software House";
  const productOffer = campaignContext?.productOffer || "soluções tecnológicas sob medida, construção de SaaS de gestão e consultoria tecnológica estratégica";
  const targetAudience = campaignContext?.targetAudience || "Corretores de seguros, advogados (qualquer área), clínicas e donos de e-commerce";
  const aiCriteria = campaignContext?.aiCriteria || "Analise a bio do usuário. Se pertencer ao ICP, marque interested: true e atribua um score alto (8 a 10). Caso contrário, marque interested: false com score baixo (0 a 4).";
  const aiMessage = campaignContext?.aiMessage || "Crie uma primeira mensagem curta, humanizada e extremamente natural (sem parecer um robô). Use o nome ou nicho da pessoa se disponível. A mensagem deve terminar obrigatoriamente com UM destes três CTAs: Oferecer análise tecnológica, perguntar sobre captação/gestão, ou convite para papo de 10 min.";

  const prompt = `
    Você é um SDR de Elite de ${businessName}. Nós vendemos ${productOffer}.
    Seu objetivo é analisar perfis do Instagram e decidir se eles são leads qualificados.

    PÚBLICO-ALVO (ICP):
    - ${targetAudience}

    REGRAS DE QUALIFICAÇÃO:
    - ${aiCriteria}
    - O "score" DEVE ser obrigatoriamente um número inteiro de 0 a 10 avaliando o quão bom é este lead.
    - Defina o "niche" (nicho) do lead em 1 a 3 palavras, baseando-se na Bio (ex: 'Advogado', 'Loja de Roupas', 'Mãe/Pessoal').
    - Escreva a "reason" (motivo): uma frase direta de até 15 palavras explicando o porquê de você dar essa nota e por que aprovou ou reprovou o lead.

    CONSTRUÇÃO DO ICEBREAKER (Se interessado = true):
    - ${aiMessage}
    - Se "interested" for false, o "icebreaker" deve ser vazio ("").

    RESTRIÇÃO DE FAKE CLAIMS:
    - Nunca invente benefícios, lucros falsos ou cases irreais. Seja honesto e direto.

    PERFIL PARA ANÁLISE:
    Username: @${profile.username}
    Bio: ${profile.bio || 'Sem bio disponível'}

    Retorne EXCLUSIVAMENTE em formato JSON puro, sem marcações markdown (\`\`\`), apenas as chaves:
    { 
      "score": number, 
      "interested": boolean, 
      "niche": "string",
      "reason": "string",
      "icebreaker": "string" 
    }
  `;

  // Utiliza a função com retry para gerar o conteúdo
  const result = await generateContentWithRetry(model, prompt);
  const response = await result.response;
  const text = response.text();
  
  // Clean JSON response (garantindo que se vier markdown, a gente corta fora)
  const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

  return JSON.parse(jsonString);
}