import fs from 'fs';
import path from 'path';

export interface BusinessConfig {
  OWNER_NAME: string;
  OWNER_ROLE: string;
  COMPANY_NAME: string;
  COMPANY_WEBSITE: string;
  INSTAGRAM_HANDLE: string;
  WHATSAPP_LINK: string;
  AFFILIATE_GROUP_LINK: string;
  ONE_LINE_PITCH: string;
  HOW_IT_WORKS: string;
  REVENUE_MODEL: string;
  MARKET_JARGON: string;
  VERIFIED_CLAIMS: string;
  UNVERIFIED_CLAIMS: string;
  ICP_SEGMENTS: string;
  ICP_KEYWORDS: string;
  AFFILIATE_TOPICS: string;
  GEOGRAPHY: string;
}

// Aponta para o arquivo JSON na pasta raiz do projeto
const configPath = path.join(process.cwd(), 'config', 'business.json');

let cachedConfig: BusinessConfig | null = null;

export function getBusinessConfig(): BusinessConfig {
  if (!cachedConfig) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Business configuration file not found at: ${configPath}`);
    }
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(fileContent) as BusinessConfig;
  }
  return cachedConfig;
}