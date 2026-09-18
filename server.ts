import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { db } from './src/db/index.ts';
import { leads, campaignSettings } from './src/db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import { scrapeFollowers } from './src/services/leadScraper.ts';

const app = express();
app.use(cors());
app.use(express.json());

// Rota para buscar configurações da campanha
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.select().from(campaignSettings).limit(1);
    if (settings.length === 0) {
      return res.json({ 
        success: true, 
        data: { 
          businessName: '', 
          productOffer: '', 
          targetAudience: '', 
          aiCriteria: '', 
          aiMessage: '' 
        } 
      });
    }
    res.json({ success: true, data: settings[0] });
  } catch (error) {
    console.error('❌ [SERVER] Erro ao buscar configurações:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar configurações' });
  }
});

// Rota para salvar/atualizar configurações
app.post('/api/settings', async (req, res) => {
  const { businessName, productOffer, targetAudience, aiCriteria, aiMessage } = req.body;
  try {
    await db.insert(campaignSettings)
      .values({
        id: 1,
        businessName,
        productOffer,
        targetAudience,
        aiCriteria,
        aiMessage
      })
      .onConflictDoUpdate({
        target: campaignSettings.id,
        set: {
          businessName,
          productOffer,
          targetAudience,
          aiCriteria,
          aiMessage
        }
      });
    res.json({ success: true, message: 'Configurações salvas com sucesso' });
  } catch (error) {
    console.error('❌ [SERVER] Erro ao salvar configurações:', error);
    res.status(500).json({ success: false, error: 'Erro ao salvar configurações' });
  }
});

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

// Rota de Streaming em Tempo Real (Server-Sent Events)
app.get('/api/run-cadence-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  console.log('🚀 [SERVER] Iniciando streaming da cadência autônoma...');

  // Executa o script em modo filho
  const child = spawn('npx', ['ts-node', '--esm', 'run_cadence.ts'], { shell: true });

  // Transmite stdout linha a linha para o frontend
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line: string) => {
      const trimmed = line.trim();
      if (trimmed) {
        res.write(`data: ${JSON.stringify(trimmed)}\n\n`);
      }
    });
  });

  // Transmite avisos/erros do stderr
  child.stderr.on('data', (data) => {
    const trimmed = data.toString().trim();
    if (trimmed && !trimmed.includes('DeprecationWarning')) {
      res.write(`data: ${JSON.stringify(`⚠️ [SYS] ${trimmed}`)}\n\n`);
    }
  });

  // Finaliza a conexão quando o robô encerra a execução
  child.on('close', (code) => {
    res.write(`data: ${JSON.stringify(`✅ [SISTEMA] Processo finalizado com código ${code}`)}\n\n`);
    res.end();
  });
});

// Rota para listar leads (Mesa de CRM)
app.get('/api/leads', async (req, res) => {
  try {
    const allLeads = await db.select().from(leads);
    res.json({ success: true, data: allLeads });
  } catch (error) {
    console.error('❌ [SERVER] Erro ao buscar leads:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao buscar leads' });
  }
});

// Rota para deletar todos os leads (Zerar base)
app.delete('/api/leads', async (req, res) => {
  try {
    await db.run(sql`PRAGMA foreign_keys = OFF;`);
    await db.delete(leads);
    await db.run(sql`PRAGMA foreign_keys = ON;`);
    res.json({ success: true, message: 'Base de leads limpa com sucesso' });
  } catch (error) {
    console.error('❌ [SERVER] Erro ao limpar leads:', error);
    res.status(500).json({ success: false, error: 'Erro ao limpar base de leads' });
  }
});

// Rota para inserir novos leads
app.post('/api/leads', async (req, res) => {
  const { usernames } = req.body;
  if (!usernames || !Array.isArray(usernames)) {
    return res.status(400).json({ success: false, error: 'Formato inválido' });
  }

  try {
    let importedCount = 0;
    for (const rawUsername of usernames) {
      const cleanUsername = sanitizeUsername(rawUsername);
      if (!cleanUsername) continue;
      
      const existing = await db.select()
        .from(leads)
        .where(eq(leads.username, cleanUsername))
        .limit(1);
        
      if (existing.length > 0) continue;

      await db.insert(leads).values({
        instagramId: `ig_${cleanUsername}`,
        username: cleanUsername,
        pipelineState: 'new',
      }).onConflictDoNothing({ target: leads.instagramId });
      
      importedCount++;
    }
    res.json({ success: true, imported: importedCount });
  } catch (error) {
    console.error('❌ [SERVER] Erro ao inserir leads:', error);
    res.status(500).json({ success: false, error: 'Erro ao inserir leads' });
  }
});

/// Rota de Streaming em Tempo Real para o Scraper de Seguidores
app.get('/api/scrape-stream', (req, res) => {
  const { targetProfile, maxLeads } = req.query;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!targetProfile) {
    res.write(`data: ${JSON.stringify('❌ Erro: Perfil alvo ausente.')}\n\n`);
    res.end();
    return;
  }

  console.log(`🚀 [SERVER] Iniciando streaming do scraper para @${targetProfile}...`);

  // Executa o scraper em modo filho
  const child = spawn('npx', ['ts-node', '--esm', 'run_scraper.ts', targetProfile as string, (maxLeads as string) || '30'], { shell: true });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line: string) => {
      const trimmed = line.trim();
      if (trimmed) {
        res.write(`data: ${JSON.stringify(trimmed)}\n\n`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const trimmed = data.toString().trim();
    if (trimmed && !trimmed.includes('DeprecationWarning')) {
      res.write(`data: ${JSON.stringify(`⚠️ [SYS] ${trimmed}`)}\n\n`);
    }
  });

  child.on('close', () => {
    res.end();
  });
});

const PORT = 3001;

// Força a criação das tabelas e colunas faltantes no banco de dados
try {
  // 1. Garante que a tabela base existe
  db.run(sql`CREATE TABLE IF NOT EXISTS campaign_settings (id INTEGER PRIMARY KEY);`);
  
  // 2. Injeta as colunas no padrão snake_case (que o Drizzle pede) - Ignora se já existirem
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN business_name TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN product_offer TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN target_audience TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN ai_criteria TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN ai_message TEXT;`); } catch(e){}

  // 3. Injeta as colunas no padrão camelCase por segurança
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN businessName TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN productOffer TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN targetAudience TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN aiCriteria TEXT;`); } catch(e){}
  try { db.run(sql`ALTER TABLE campaign_settings ADD COLUMN aiMessage TEXT;`); } catch(e){}

  console.log('✅ Tabelas e colunas de configuração blindadas no banco de dados!');
} catch (e) {
  console.error('⚠️ Aviso ao criar tabelas de configuração:', e);
}

app.listen(PORT, () => {
  console.log(`🌐 Servidor API rodando em http://localhost:${PORT}`);
});