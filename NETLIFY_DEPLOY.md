# Netlify 배포 가이드

이 가이드는 YouTube Liked Videos Filter 애플리케이션을 Netlify에 배포하는 방법을 설명합니다.

## 사전 준비

1. [Netlify 계정](https://app.netlify.com/signup) 생성
2. [GitHub 계정](https://github.com/join) 생성 (코드 저장소용)
3. [PostgreSQL 데이터베이스](https://neon.tech 또는 https://supabase.com) 준비 (무료 티어 있음)

## 배포 단계

### 1. GitHub에 코드 업로드

먼저 이 프로젝트를 GitHub 저장소에 업로드합니다:

```bash
# Git 초기화
git init

# 모든 파일 추가
git add .

# 커밋
git commit -m "Initial commit"

# GitHub 저장소 생성 후 연결
git remote add origin https://github.com/username/youtubelikefilter.git
git push -u origin main
```

### 2. Netlify에서 사이트 생성

1. [Netlify 대시보드](https://app.netlify.com/)에 로그인
2. "New site from Git" 클릭
3. GitHub를 선택하고 저장소 연결
4. 다음 배포 설정 구성:
   - Build command: `npm run build`
   - Publish directory: `public`
   - Advanced build settings에서 환경 변수 설정

### 3. 환경 변수 설정

Netlify 대시보드의 "Site settings" → "Environment variables"에서 다음 환경 변수를 설정해야 합니다:

- `DATABASE_URL`: PostgreSQL 데이터베이스 연결 문자열
- `CLIENT_ID`: Google OAuth 클라이언트 ID
- `CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `SESSION_SECRET`: 세션 암호화용 비밀 문자열 (임의의 문자열)

### 4. Google OAuth 설정 업데이트

Google Cloud Console에서 OAuth 리디렉션 URI를 업데이트합니다:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)로 이동
2. OAuth 2.0 클라이언트 ID 선택
3. 리디렉션 URI에 `https://your-netlify-app.netlify.app/.netlify/functions/api/auth/google/callback` 추가

### 5. 데이터베이스 스키마 적용

첫 배포 후, 데이터베이스 스키마가 자동으로 적용됩니다. 스키마 변경 시:

1. 로컬에서 변경 사항 적용
2. GitHub에 변경 사항 푸시
3. Netlify가 자동으로 새 배포 시작

## 문제 해결

### 배포 실패

Netlify 대시보드의 "Deploys" 섹션에서 로그를 확인하여 오류를 파악할 수 있습니다.

### 데이터베이스 연결 문제

1. 환경 변수 `DATABASE_URL`이 올바른지 확인
2. 데이터베이스 자격 증명이 유효한지 확인
3. 데이터베이스가 외부 연결을 허용하는지 확인

### 인증 문제

1. Google 클라이언트 ID와 시크릿이 올바른지 확인
2. 리디렉션 URI가 정확히 설정되었는지 확인
3. OAuth 동의 화면에서 필요한 권한이 모두 활성화되었는지 확인

## 유용한 팁

- Functions 탭에서 서버리스 함수 로그를 확인할 수 있습니다.
- Identity 탭에서 사용자 인증 관련 로그를 확인할 수 있습니다.
- 커스텀 도메인을 연결하려면 "Domain settings"에서 구성할 수 있습니다.