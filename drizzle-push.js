const { pool } = require('./db');
const schema = require('./shared/schema');

// 데이터베이스 스키마 푸시 (개발 환경용)
async function pushSchema() {
  try {
    console.log('데이터베이스 스키마 푸시 시작...');
    
    // 스키마 직접 푸시 (마이그레이션 없이)
    // 이 방법은 개발 환경에서만 사용해야 합니다.
    const result = await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) NOT NULL UNIQUE,
        display_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        photo_url VARCHAR(512),
        access_token TEXT,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS liked_videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        video_id VARCHAR(255) NOT NULL,
        title VARCHAR(512) NOT NULL,
        description TEXT,
        channel_id VARCHAR(255) NOT NULL,
        channel_title VARCHAR(255) NOT NULL,
        published_at TIMESTAMP,
        thumbnail_url VARCHAR(512),
        duration VARCHAR(50),
        view_count VARCHAR(50),
        like_count VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS playlist_videos (
        id SERIAL PRIMARY KEY,
        playlist_id INTEGER REFERENCES playlists(id) NOT NULL,
        video_id INTEGER REFERENCES liked_videos(id) NOT NULL,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL UNIQUE,
        default_view VARCHAR(50) DEFAULT 'grid',
        videos_per_page INTEGER DEFAULT 50,
        theme VARCHAR(50) DEFAULT 'light',
        preferences JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('데이터베이스 스키마 푸시 완료!');
    process.exit(0);
  } catch (error) {
    console.error('스키마 푸시 오류:', error);
    process.exit(1);
  }
}

// 스키마 푸시 실행
pushSchema();