import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para obter o diretório atual usando ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo de configuração de negócios (config/business.json)
const businessConfigPath = path.resolve(__dirname, '../config/business.json');

/**
 * Carrega e valida os dados de configuração de negócios
 */
function loadBusinessConfig() {
  try {
    if (!fs.existsSync(businessConfigPath)) {
      throw new Error(`Arquivo de configuração não encontrado em: ${businessConfigPath}`);
    }

    const rawData = fs.readFileSync(businessConfigPath, 'utf8');
    const config = JSON.parse(rawData);
    
    return config;
  } catch (error) {
    console.error('Erro ao carregar a configuração de negócios:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('=== Inicializando Sistema Comercial Autônomo - Buscando Milhão ===\n');
  
  const config = loadBusinessConfig();
  
  console.log('Dados de Negócio Carregados com Sucesso:');
  console.log('----------------------------------------');
  console.log(`Empresa:      ${config.COMPANY_NAME}`);
  console.log(`Website:      ${config.COMPANY_WEBSITE}`);
  console.log(`Responsável:  ${config.OWNER_NAME} (${config.OWNER_ROLE})`);
  console.log(`Instagram:    ${config.INSTAGRAM_HANDLE}`);
  console.log(`WhatsApp:     ${config.WHATSAPP_LINK}`);
  console.log(`Slogan:       "${config.ONE_LINE_PITCH}"`);
  console.log(`Como funciona:\n  ${config.HOW_IT_WORKS}`);
  console.log('----------------------------------------');
  console.log('Estrutura base pronta para desenvolvimento.');
}

main();
