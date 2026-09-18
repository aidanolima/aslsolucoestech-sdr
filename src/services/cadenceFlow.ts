import { scrapeInstagramProfile } from '../integrations/browser/instagramScraper.ts';
import { analyzeProfile } from '../integrations/gemini/agent.ts';
import { db } from '../db/index.ts';
import { leads, messages } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

// Definindo a "fôrma" completa do que esperamos receber da IA
interface AIAnalysis {
  score: number;
  interested: boolean;
  icebreaker: string;
  niche?: string;
  reason?: string;
}

export async function processCadenceFlow(handles: string[], campaignContext?: any) {
  for (const handle of handles) {
    try {
      const cleanHandle = handle.replace(/^@+/, '').trim();
      console.log(`\n🧠 [IA] Iniciando qualificação do perfil: @${cleanHandle}`);
      
      const profile = await scrapeInstagramProfile(cleanHandle);
      
      console.log(`[IA] Lendo a Bio e cruzando com as regras...`);
      
      // Forçamos o TypeScript a aceitar a nossa nova interface completa com "as AIAnalysis"
      const analysis = await analyzeProfile({ 
        username: profile.username, 
        bio: profile.bio 
      }, campaignContext) as AIAnalysis;
      
      const newState = analysis.interested ? 'qualified' : 'failed';
      
      console.log(`[IA] Veredito para @${cleanHandle}: Score ${analysis.score}/10 | Nicho: ${analysis.niche || 'N/A'}`);
      
      if (!analysis.interested) {
        console.log(`⚠️ [IA] Lead reprovado! Motivo da IA: ${analysis.reason || 'Não atingiu os critérios ideais do público-alvo.'}`);
      } else {
        console.log(`✅ [IA] Lead Qualificado! Motivo da IA: ${analysis.reason || 'Aprovado com sucesso.'}`);
      }

      // Atualiza o banco sempre, independente de ter sido aprovado ou reprovado
      const existingLead = await db.select().from(leads).where(eq(leads.username, cleanHandle)).limit(1);
      
      let leadId;

      if (existingLead.length > 0) {
        const [updatedLead] = await db.update(leads)
          .set({
            score: analysis.score,
            niche: analysis.niche || 'N/A',
            pipelineState: newState,
            fullName: profile.fullName || existingLead[0].fullName,
            updatedAt: Date.now()
          })
          .where(eq(leads.id, existingLead[0].id))
          .returning();
        leadId = updatedLead.id;
      } else {
        const [newLead] = await db.insert(leads).values({
          instagramId: `ig_${cleanHandle}`, 
          username: cleanHandle,
          fullName: profile.fullName,
          score: analysis.score,
          niche: analysis.niche || 'N/A',
          pipelineState: newState,
          channelState: analysis.interested ? 'browser_contact_pending' : 'ignored',
        }).returning();
        leadId = newLead.id;
      }
      
      // Só salva o Icebreaker se a IA marcou como "interested" (Qualificado)
      if (analysis.interested && analysis.icebreaker) {
        await db.insert(messages).values({
          leadId: leadId,
          direction: 'outbound',
          content: analysis.icebreaker,
        });
        console.log(`[SYS] 💾 Mensagem salva no banco e pronta para o disparo.`);
      }

      await new Promise(resolve => setTimeout(resolve, 6000));
    } catch (error: any) {
      if (error?.message?.includes('429')) {
        console.warn(`[⚠️ IA LIMIT] Cota gratuita da IA excedida ao qualificar ${handle}. O lead será processado na próxima janela.`);
      } else {
        console.error(`❌ Erro ao processar lead ${handle}: ${error.message}`);
      }
      continue;
    }
  }
}