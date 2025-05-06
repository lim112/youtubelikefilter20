const { db } = require('./db');
const { migrate } = require('drizzle-orm/neon-serverless/migrator');

// 데이터베이스 마이그레이션 실행
async function runMigration() {
  try {
    console.log('데이터베이스 마이그레이션 시작...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('데이터베이스 마이그레이션 완료!');
    process.exit(0);
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    process.exit(1);
  }
}

runMigration();