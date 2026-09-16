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

// POST /api/trigger - Disparar cadência
app.post('/api/trigger', async (req: Request, res: Response) => {
  // Executa de forma assíncrona sem esperar o término
  run().catch(err => console.error('Erro na execução forçada:', err));
  res.json({ success: true, message: 'Cadência iniciada' });
});

// POST /api/leads - Importar novos leads
app.post('/api/leads', async (req: Request, res: Response) => {
  const { handles } = req.body;

  if (!handles || !Array.isArray(handles)) {
    return res.status(400).json({ error: 'Formato inválido. Esperado { "handles": ["@user1"] }' });
  }

  let importedCount = 0;

  for (const handle of handles) {
    const cleanHandle = handle.replace('@', '').trim();
    
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
