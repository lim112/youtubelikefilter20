#!/bin/bash

echo "빌드 시작..."

# 환경 변수 설정
export NETLIFY=true
export NODE_ENV=production

# 종속성 설치
echo "종속성 설치 중..."
npm install

# Netlify 함수 빌드
echo "Netlify 함수 빌드 중..."
npx netlify-lambda build netlify/functions

# 데이터베이스 스키마 준비 (Netlify 환경에서는 자동으로 실행)
if [ -z "$NETLIFY" ]; then
  echo "데이터베이스 스키마 업데이트 중..."
  node drizzle-push.js
fi

# 정적 파일 준비
echo "정적 파일 준비 중..."
mkdir -p public

# index.html이 루트에 있으면 public으로 복사
if [ -f "index.html" ]; then
  cp index.html public/
fi

# public 폴더 내 파일들 복사 (이중 복사 방지)
if [ -d "public/css" ]; then
  echo "CSS 파일 복사 중..."
  mkdir -p public/css
  cp -R public/css/* public/css/ 2>/dev/null || :
fi

if [ -d "public/js" ]; then
  echo "JS 파일 복사 중..."
  mkdir -p public/js
  cp -R public/js/* public/js/ 2>/dev/null || :
fi

if [ -d "public/images" ]; then
  echo "이미지 파일 복사 중..."
  mkdir -p public/images
  cp -R public/images/* public/images/ 2>/dev/null || :
fi

# favicon 복사
if [ -f "public/favicon.ico" ]; then
  cp public/favicon.ico public/ 2>/dev/null || :
fi

echo "redirect 규칙 생성 중..."
cat > public/_redirects << EOF
/api/*  /.netlify/functions/api/:splat  200
/*      /index.html                     200
EOF

echo "✓ 빌드 완료"
echo "Netlify 및 GitHub 배포 준비 완료"