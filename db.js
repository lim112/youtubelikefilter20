const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require('ws');
const schema = require('./shared/schema');

neonConfig.webSocketConstructor = ws;

// Supabase 연결 문자열을 직접 설정
const DATABASE_URL = "postgresql://postgres.hdcpbffbkfcbltenmynl:S!!sksgustn0853@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

// 데이터베이스 연결 풀 생성
const pool = new Pool({ connectionString: DATABASE_URL });

// Drizzle ORM 인스턴스 생성
const db = drizzle(pool, { schema });

module.exports = {
  pool,
  db
};