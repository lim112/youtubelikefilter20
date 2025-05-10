// Netlify 배포 전 환경 확인 스크립트
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 필수 환경 변수 확인
const requiredEnvVars = [
  'DATABASE_URL',
  'CLIENT_ID',
  'CLIENT_SECRET',
];

// 환경 변수 확인
console.log('📋 환경 변수 확인 중...');
const missingVars = [];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
}

if (missingVars.length > 0) {
  console.error('❌ 다음 환경 변수가 설정되지 않았습니다:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.log('\n.env 파일을 확인하거나 Netlify 대시보드에서 환경 변수를 설정하세요.');
} else {
  console.log('✅ 모든 필수 환경 변수가 설정되었습니다.');
}

// 필요한 폴더 확인
console.log('\n📂 필수 폴더 구조 확인 중...');
const requiredDirs = [
  'netlify/functions',
  'public',
];

const missingDirs = [];
for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    missingDirs.push(dir);
  }
}

if (missingDirs.length > 0) {
  console.error('❌ 다음 폴더가 없습니다:');
  missingDirs.forEach(d => console.error(`   - ${d}`));
  console.log('\n필요한 폴더를 생성해주세요.');
} else {
  console.log('✅ 모든 필수 폴더가 존재합니다.');
}

// 필수 파일 확인
console.log('\n📄 필수 파일 확인 중...');
const requiredFiles = [
  'netlify.toml',
  'netlify/functions/api.js',
  'netlify/_redirects',
  'public/index.html'
];

const missingFiles = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error('❌ 다음 파일이 없습니다:');
  missingFiles.forEach(f => console.error(`   - ${f}`));
  console.log('\n필요한 파일을 생성해주세요.');
} else {
  console.log('✅ 모든 필수 파일이 존재합니다.');
}

// Netlify CLI 설치 확인
console.log('\n🔧 Netlify CLI 확인 중...');
try {
  execSync('npx netlify --version', { stdio: 'ignore' });
  console.log('✅ Netlify CLI가 설치되어 있습니다.');
} catch (error) {
  console.error('❌ Netlify CLI가 설치되어 있지 않거나 실행할 수 없습니다.');
  console.log('\nnpm install -g netlify-cli 명령으로 설치하거나 버전을 확인하세요.');
}

// 결과 요약
console.log('\n📊 배포 준비 상태:');
if (missingVars.length === 0 && missingDirs.length === 0 && missingFiles.length === 0) {
  console.log('✅ 모든 확인 통과! Netlify에 배포할 준비가 되었습니다.');
  console.log('\n배포 명령어:');
  console.log('  npx netlify deploy --prod');
} else {
  console.log('❌ 위에 표시된 문제를 해결한 후 다시 시도하세요.');
}

// 추가 정보
console.log('\n💡 도움말:');
console.log('  - Netlify 배포에 대한 자세한 정보는 NETLIFY_DEPLOY.md 파일을 참조하세요.');
console.log('  - 환경 변수는 Netlify 대시보드 또는 .env 파일에서 설정할 수 있습니다.');
console.log('  - 문제가 지속되면 로그를 확인하거나 Netlify 지원에 문의하세요.');