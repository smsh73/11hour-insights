import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Azure 환경 변수 필수 - 기본값 제거
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

if (!dbHost || !dbPort || !dbName || !dbUser || !dbPassword) {
  throw new Error('Database configuration is missing. Please set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD environment variables.');
}

// Azure PostgreSQL은 항상 SSL 필요
const isAzureDb = dbHost.includes('azure') || dbHost.includes('postgres.database.azure.com');

export const pool = new Pool({
  host: dbHost,
  port: parseInt(dbPort),
  database: dbName,
  user: dbUser,
  password: dbPassword,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000, // Azure 연결 대기 시간
  ssl: isAzureDb ? {
    rejectUnauthorized: false,
  } as any : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

