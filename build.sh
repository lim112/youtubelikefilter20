#!/bin/bash

# 종속성 설치
npm install

# 데이터베이스 스키마 업데이트
node drizzle-push.js

# 정적 파일 복사
mkdir -p public
cp -R index.html public/
cp -R dashboard.html public/ 2>/dev/null || :
cp -R public/css public/
cp -R public/js public/
cp -R public/images public/ 2>/dev/null || :
cp -R public/favicon.ico public/ 2>/dev/null || :

echo "빌드 완료"