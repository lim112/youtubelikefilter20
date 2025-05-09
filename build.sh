#!/bin/bash

# 빌드 스크립트
echo "빌드 프로세스 시작..."

# 정적 파일 준비
echo "정적 파일 준비 중..."
mkdir -p public/css public/js public/images

# 필요한 파일들 복사
cp -r public/css/* public/css/ 2>/dev/null || :
cp -r public/js/* public/js/ 2>/dev/null || :
cp -r public/images/* public/images/ 2>/dev/null || :
cp index.html public/ 2>/dev/null || :

# Netlify 함수 준비
echo "Netlify 함수 준비 중..."
mkdir -p netlify/functions
# 이미 있는 함수 확인
if [ -d "netlify/functions" ]; then
  echo "Netlify 함수 폴더 확인됨"
fi

echo "빌드 프로세스 완료"
exit 0