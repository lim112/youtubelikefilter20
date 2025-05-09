#!/bin/bash

echo "YouTube Filter 빌드 스크립트 시작"

# 종속성 설치
echo "종속성 설치 중..."
npm install

# 데이터베이스 스키마 업데이트
echo "데이터베이스 스키마 업데이트 중..."
node drizzle-push.js

# 정적 파일 복사
echo "정적 파일 복사 중..."
mkdir -p public

# index.html 복사
if [ -f "index.html" ]; then
  cp index.html public/
  echo "index.html 복사 완료"
else
  echo "Error: index.html을 찾을 수 없습니다"
fi

# dashboard.html 처리
if [ -f "dashboard.html" ]; then
  cp dashboard.html public/
  echo "dashboard.html 복사 완료"
elif [ -f "public/dashboard.html" ]; then
  echo "dashboard.html이 이미 public 폴더에 있습니다"
else
  echo "dashboard.html을 찾을 수 없어 생성합니다"
  # 대시보드 페이지가 없으면 간단한 리디렉션 페이지 생성
  cat > public/dashboard.html << EOL
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>YouTube 좋아요 필터</title>
  <meta http-equiv="refresh" content="0;url=/">
</head>
<body>
  <p>로그인이 필요합니다. 메인 페이지로 이동 중...</p>
  <script>window.location.href = "/";</script>
</body>
</html>
EOL
fi

# public 폴더 내용 검사
echo "public 폴더 내용 검사 중..."
ls -la public || echo "public 폴더를 나열할 수 없습니다"

# JavaScript 폴더 복사
if [ -d "public/js" ]; then
  echo "public/js 폴더가 이미 존재합니다"
else
  mkdir -p public/js
  echo "public/js 폴더 생성됨"
fi

# CSS 폴더 복사
if [ -d "public/css" ]; then
  echo "public/css 폴더가 이미 존재합니다"
else
  mkdir -p public/css
  echo "public/css 폴더 생성됨"
fi

# 원본 public 폴더 복사 (단일 레벨로)
for file in $(find public -type f -maxdepth 1); do
  cp "$file" public/ 2>/dev/null || echo "$file 복사 실패, 이미 존재할 수 있음"
done

echo "빌드 완료"