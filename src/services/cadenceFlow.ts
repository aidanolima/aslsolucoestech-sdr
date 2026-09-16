import { scrapeInstagramProfile } from '../integrations/browser/instagramScraper.ts';
import { analyzeProfile } from '../integrations/gemini/agent.ts';
import { db } from '../db/index.ts';
import { leads, messages } from '../db/schema.ts';

export async function processCadenceFlow(handles: string[]) {
  for (const handle of handles) {
    try {
      console.log(`Processing handle: ${handle}`);
      
      // 1. Scrape
      const profile = await scrapeInstagramProfile(handle);
      
      // 2. Analyze
      const analysis = await analyzeProfile({ 
        username: profile.username, 
        bio: profile.bio 
      });
      
      if (analysis.interested) {
        console.log(`Lead ${handle} qualified with score: ${analysis.score}`);
        
        // 3. Persist Lead (Upsert)
        const [newLead] = await db.insert(leads).values({
          instagramId: `ig_${handle}`, 
          username: profile.username,
          fullName: profile.fullName,
          score: analysis.score,
          pipelineState: 'qualified',
          channelState: 'browser_contact_pending',
        })
        .onConflictDoUpdate({
          target: leads.instagramId,
          set: { 
              score: analysis.score,
              updatedAt: Date.now()
          }
        })
        .returning();
        
        // 4. Persist Message (Icebreaker)
        await db.insert(messages).values({
          leadId: newLead.id,
          direction: 'outbound',
          content: analysis.icebreaker,
        });
        
        console.log(`Lead inserted: ${newLead.id}, Icebreaker: ${analysis.icebreaker}`);
      } else {
        console.log(`Lead ${handle} not qualified.`);
      }

      await new Promise(resolve => setTimeout(resolve, 6000));
    } catch (error: any) {
      if (error?.message?.includes('429')) {
        console.warn(`[⚠️ IA LIMIT] Cota gratuita do Gemini excedida ao qualificar ${handle}. O lead será processado na próxima janela.`);
      } else {
        console.error(`❌ Erro ao processar lead ${handle}: ${error.message}`);
      }
      continue; // Segue para o próximo lead
    }
  }
}
