import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const CSV_FILE = path.join(process.cwd(), 'data', 'leads.csv');

async function importLeads() {
  const handles: string[] = [];

  console.log('--- Iniciando importação de leads ---');

  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (row) => {
      if (row.username) {
        let handle = row.username.trim();
        if (!handle.startsWith('@')) {
          handle = `@${handle}`;
        }
        handles.push(handle);
      }
    })
    .on('end', async () => {
      console.log(`\x1b[32mSucesso: ${handles.length} leads lidos do CSV.\x1b[0m`);

      try {
        const response = await fetch('http://localhost:3000/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ handles }),
        });

        if (response.ok) {
          console.log('\x1b[32mSucesso: Leads injetados na API com sucesso.\x1b[0m');
        } else {
          console.error(`\x1b[31mErro: Falha ao injetar leads. Status: ${response.status}\x1b[0m`);
        }
      } catch (error) {
        console.error('\x1b[31mErro: Não foi possível conectar à API.\x1b[0m', error);
      }
    });
}

importLeads();
