import { db } from '../db/index.ts';
  import { leads, messages } from '../db/schema.ts';
  import { eq, and, lt } from 'drizzle-orm';
  
  /**
   * Identifica leads que não responderam após 24h e agenda uma mensagem de follow-up.
   */
  export async function scheduleFollowUps() {
    console.log('⏰ [FOLLOW-UP] Verificando leads para follow-up...');
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Busca leads que foram contactados há mais de 24h e ainda não responderam
    const leadsNeedingFollowUp = await db.select()
      .from(leads)
      .where(
        and(
          eq(leads.pipelineState, 'contacted'),
          lt(leads.updatedAt, oneDayAgo),
          eq(leads.doNotContact, false)
        )
      );
  
    console.log(`[FOLLOW-UP] Encontrados ${leadsNeedingFollowUp.length} leads aguardando follow-up.`);
  
    for (const lead of leadsNeedingFollowUp) {
      // Atualiza o estado para evitar disparos duplicados
      await db.update(leads)
        .set({ 
          pipelineState: 'follow_up_pending',
          updatedAt: Date.now()
        })
        .where(eq(leads.id, lead.id));
  
      // Aqui poderíamos usar o Gemini para gerar um follow-up contextual, 
      // mas por simplicidade inicial vamos inserir uma mensagem padrão ou variante
      await db.insert(messages).values({
        leadId: lead.id,
        direction: 'outbound',
        content: 'Oi! Vi que você não conseguiu ver minha mensagem anterior. Só passando para garantir que não se perdeu no inbox. Abs!',
        variant: 'follow_up_1'
      });
  
      await db.update(leads)
        .set({ 
          channelState: 'browser_contact_pending', // Re-habilita para o directSender enviar
        })
        .where(eq(leads.id, lead.id));
        
      console.log(`[FOLLOW-UP] Lead @${lead.username} agendado para re-contato.`);
    }
  }
  