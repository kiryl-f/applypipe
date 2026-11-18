import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port: number;
  dbPath: string;
  secretToken: string;
  openRouter: {
    apiKey: string;
    model: string;
    endpoint: string;
  };
}

export const config: Config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './jobs.db',
  secretToken: process.env.PI_SECRET_TOKEN || '',
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'baidu/ernie-5.5-flash-preview',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
};
