import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

// Rota para acionar o robô via botão do Dashboard
app.post('/api/run-cadence', (req, res) => {
  console.log('🚀 [SERVER] Executando cadência autônoma via Dashboard...');
  
  exec('npx ts-node --esm run_cadence.ts', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Erro ao executar cadência: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
    console.log(stdout);
    return res.json({ success: true, output: stdout });
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🌐 Servidor API rodando em http://localhost:${PORT}`);
});