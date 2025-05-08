#!/bin/bash

# 종속성 설치
npm install

# 데이터베이스 스키마 업데이트
node drizzle-push.js

# 정적 파일 복사 및 준비
mkdir -p public
cp -R index.html public/ 2>/dev/null || :
cp -R dashboard.html public/ 2>/dev/null || :
cp -R public/css public/
cp -R public/js public/
cp -R public/images public/ 2>/dev/null || :
cp -R public/favicon.ico public/ 2>/dev/null || :

# 서버리스 함수 디렉토리 확인
mkdir -p netlify/functions

# 개발 환경 설정
if [ "${NODE_ENV}" != "production" ]; then
  echo "개발 환경 설정 중..."
  cp .env.example .env 2>/dev/null || :
fi

echo "빌드 완료"