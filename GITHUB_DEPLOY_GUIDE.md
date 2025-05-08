# GitHub 및 Netlify 배포 가이드

이 가이드는 YouTube Liked Videos Filter 애플리케이션을 GitHub에 업로드하고 Netlify에 배포하는 방법을 설명합니다.

## 1. Netlify 배포 오류 해결 방법

현재 Netlify 배포 중 `package.json` 파일에 빌드 스크립트가 없어서 오류가 발생하고 있습니다. 이 문제를 해결하려면 다음 단계를 따라주세요:

### 1.1 GitHub에 코드 업로드 전 준비

1. 로컬 환경에서 이 프로젝트를 클론하거나 다운로드합니다.
2. `netlify-github-package.json` 파일의 내용을 `package.json` 파일로 교체합니다:

```bash
# 기존 package.json 백업 (선택사항)
cp package.json package.json.backup

# netlify-github-package.json 파일의 내용을 package.json으로 복사
cp netlify-github-package.json package.json
```

### 1.2 GitHub에 코드 업로드

```bash
# Git 초기화
git init

# 모든 파일 추가
git add .

# 커밋
git commit -m "Initial commit with build script for Netlify"

# GitHub 저장소 생성 후 연결
git remote add origin https://github.com/username/youtubelikefilter.git
git push -u origin main
```

## 2. Netlify 배포 설정

### 2.1 Netlify 사이트 생성

1. [Netlify 대시보드](https://app.netlify.com/)에 로그인
2. "New site from Git" 클릭
3. GitHub를 선택하고 저장소 연결
4. 다음 배포 설정 구성:
   - Build command: `npm run build`
   - Publish directory: `public`
   - Advanced build settings에서 환경 변수 설정

### 2.2 환경 변수 설정

Netlify 대시보드의 "Site settings" → "Environment variables"에서 다음 환경 변수를 설정해야 합니다:

- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 문자열
- `CLIENT_ID`: Google OAuth 클라이언트 ID
- `CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `SESSION_SECRET`: 세션 암호화용 비밀 문자열 (임의의 문자열)
- `URL`: Netlify 앱 URL (예: https://youtubelikefilter.netlify.app)

### 2.3 Google OAuth 설정 업데이트

Google Cloud Console에서 OAuth 리디렉션 URI를 업데이트합니다:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)로 이동
2. OAuth 2.0 클라이언트 ID 선택
3. 리디렉션 URI에 `https://your-netlify-app.netlify.app/.netlify/functions/api/auth/google/callback` 추가

## 3. 배포 후 확인

1. Netlify 대시보드에서 배포 상태를 확인합니다.
2. 배포가 성공적으로 완료되면 제공된 URL로 사이트에 접속할 수 있습니다.
3. 인증 및 데이터 조회 기능이 정상적으로 작동하는지 확인합니다.

## 4. 문제 해결

### 4.1 배포 실패

Netlify 대시보드의 "Deploys" 섹션에서 로그를 확인하여 오류를 파악할 수 있습니다.

### 4.2 데이터베이스 연결 문제

1. 환경 변수 `DATABASE_URL`이 올바른지 확인
2. 데이터베이스 자격 증명이 유효한지 확인
3. 데이터베이스가 외부 연결을 허용하는지 확인

### 4.3 인증 문제

1. Google 클라이언트 ID와 시크릿이 올바른지 확인
2. 리디렉션 URI가 정확히 설정되었는지 확인
3. OAuth 동의 화면에서 필요한 권한이 모두 활성화되었는지 확인