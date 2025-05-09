// Netlify 환경 설정
process.env.NETLIFY = 'true';

// Netlify URL 환경 변수 설정 (필요한 경우)
if (!process.env.NETLIFY_URL && process.env.URL) {
  process.env.NETLIFY_URL = process.env.URL;
}

// 메인 서버 앱 가져오기 (server.js에서 해당 환경 감지 후 적절한 설정 적용)
const app = require('../../server');

// 디버깅을 위한 로그
console.log('Netlify 함수 초기화됨. 경로:');
console.log('- /api/auth/google: Google 인증');
console.log('- /api/user: 사용자 정보');
console.log('- /api/videos/metadata: 비디오 메타데이터');
console.log('- /api/liked-videos: 좋아요한 비디오 목록');

// server.js에서 export된 handler를 사용
module.exports.handler = app.handler;