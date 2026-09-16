import { db } from '../db/index.ts';
import { leads, metrics } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { getBusinessConfig } from '../lib/businessConfig.ts';

const config = getBusinessConfig();

/**
 * Realiza o handoff do lead qualificado para o canal final (WhatsApp/Grupo).
 */
export async function performHandoff(leadId: number): Promise<string | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  
  if (!lead) return null;

  console.log(`🚀 [HANDOFF] Lead @${lead.username} atingiu o final do funil!`);
  
  // Atualiza o status do lead para 'converted'
  await db.update(leads)
    .set({
      pipelineState: 'converted',
      updatedAt: Date.now()
    })
    .where(eq(leads.id, leadId));

  // Define o link com base na pontuação (Score) da IA
  const targetLink = lead.score && lead.score > 80 ? config.WHATSAPP_LINK : config.AFFILIATE_GROUP_LINK;
  
  console.log(`✨ [HANDOFF] Link de destino para @${lead.username}: ${targetLink}`);
  
  // Bloco de proteção para as métricas (Log 100% Limpo)
  try {
    await db.insert(metrics).values({
      leadId: leadId,
      icebreaker: 'N/A',
      niche: lead.niche || 'Geral', // Fallback caso a IA não tenha definido o nicho
      converted: true
    });
    console.log(`📊 [MÉTRICAS] Conversão registrada no banco com sucesso!`);
  } catch (error) {
    // Se der erro no banco de métricas, ele avisa baixinho e não quebra o sistema
    console.log(`⚠️ [MÉTRICAS] Aviso: Não foi possível registrar a métrica extra, mas o Handoff principal está salvo.`);
  }

  // Devolve o link gerado para quem chamou a função (o Inbox Monitor)
  return targetLink;
}