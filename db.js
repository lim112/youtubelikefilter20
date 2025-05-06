const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require('ws');
const schema = require('./shared/schema');

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL 환경 변수가 설정되지 않았습니다. 데이터베이스를 생성했는지 확인하세요."
  );
}

// 데이터베이스 연결 풀 생성
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Drizzle ORM 인스턴스 생성
const db = drizzle(pool, { schema });

module.exports = {
  pool,
  db
};