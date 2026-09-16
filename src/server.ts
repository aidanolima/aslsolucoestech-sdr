import express from 'express';
import type { Request, Response } from 'express';
import { db } from './db/index.ts';
import { leads } from './db/schema.ts';
import { eq } from 'drizzle-orm';
import { run } from '../run_cadence.ts';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = 3000;

/**
 * Pipeline de higienização de usernames
 */
function sanitizeUsername(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  
  let cleaned = input.trim();
  
  // Extração de handle de URLs do Instagram
  if (cleaned.includes('instagram.com/')) {
    try {
      const urlString = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
      const url = new URL(urlString);
      const pathParts = url.pathname.split('/').filter(p => p);
      if (pathParts.length > 0) {
        cleaned = pathParts[0];
      }
    } catch (e) {
      // Fallback para extração via regex se URL falhar
      const match = cleaned.match(/instagram\.com\/([^/?#\s]+)/);
      if (match) cleaned = match[1];
    }
  }

  // Remove todos os símbolos @ do início
  cleaned = cleaned.replace(/^@+/, '');

  // Descarta se houver espaços internos ou se estiver vazio
  if (!cleaned || /\s/.test(cleaned)) {
    return null;
  }

  return cleaned.toLowerCase();
}

// POST /api/trigger - Disparar cadência
app.post('/api/trigger', async (req: Request, res: Response) => {
  // Executa de forma assíncrona sem esperar o término
  run().catch(err => console.error('Erro na execução forçada:', err));
  res.json({ success: true, message: 'Cadência iniciada' });
});

// POST /api/leads - Importar novos leads
app.post('/api/leads', async (req: Request, res: Response) => {
  const { handles, usernames } = req.body;
  const input = handles || usernames;

  if (!input || !Array.isArray(input)) {
    return res.status(400).json({ error: 'Formato inválido. Esperado { "handles": ["@user1"] } ou { "usernames": [...] }' });
  }

  let importedCount = 0;

  for (const rawHandle of input) {
    const cleanHandle = sanitizeUsername(rawHandle);
    
    if (!cleanHandle) continue;

    // Verificação de duplicidade antes do INSERT
    const existing = await db.select()
      .from(leads)
      .where(eq(leads.username, cleanHandle))
      .limit(1);
      
    if (existing.length > 0) continue;

    // Upsert básico (insere ou ignora se já existir para manter status)
    await db.insert(leads).values({
      instagramId: `ig_${cleanHandle}`,
      username: cleanHandle,
      pipelineState: 'discovered',
      channelState: 'browser_contact_pending',
    })
    .onConflictDoNothing({ target: leads.instagramId });
    
    importedCount++;
  }

  res.json({ success: true, imported: importedCount });
});

// GET /api/leads - Listar leads
app.get('/api/leads', async (req: Request, res: Response) => {
  const allLeads = await db.select().from(leads);
  res.json(allLeads);
});

app.listen(PORT, () => {
  console.log(`🚀 API de Ingestão de Leads ativa em http://localhost:${PORT}`);
});
