// Netlify 환경 설정
process.env.NETLIFY = 'true';

// 메인 서버 앱 가져오기 (server.js에서 해당 환경 감지 후 적절한 설정 적용)
const app = require('../../server');

// server.js에서 export된 handler를 사용
module.exports.handler = app.handler;