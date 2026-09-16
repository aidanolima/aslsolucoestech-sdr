import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🌐 Servidor API rodando em http://localhost:${PORT}`);
});