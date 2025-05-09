# Netlify 간편 배포 가이드

## 1. GitHub 저장소 생성 및 소스 업로드

1. [GitHub](https://github.com)에서 새 저장소를 생성합니다.
2. 이 프로젝트를 GitHub에 업로드합니다.

```bash
# Git 초기화
git init

# 모든 파일 추가
git add .

# 커밋
git commit -m "Initial commit"

# GitHub 저장소에 연결
git remote add origin https://github.com/사용자명/youtubelikefilter.git

# GitHub에 푸시
git push -u origin main
```

## 2. Netlify 배포

1. [Netlify](https://app.netlify.com/)에 로그인합니다.
2. "New site from Git" 버튼을 클릭합니다.
3. GitHub을 선택하고 저장소를 연결합니다.
4. 배포 설정:
   - Build command: `bash build.sh`
   - Publish directory: `public`

## 3. 환경 변수 설정

Netlify 대시보드에서 "Site settings" → "Environment variables"로 이동하여 다음 환경 변수를 설정합니다:

- `DATABASE_URL`: PostgreSQL 데이터베이스 URL
- `CLIENT_ID`: Google OAuth 클라이언트 ID
- `CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `SESSION_SECRET`: 세션 암호화를 위한 비밀 키 (임의의 문자열)
- `URL`: Netlify 앱 URL (예: https://youtubelikefilter.netlify.app)

## 4. Google OAuth 설정 업데이트

[Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 OAuth 2.0 클라이언트 ID를 선택하고 리디렉션 URI에 다음 주소를 추가합니다:

```
https://youtubelikefilter.netlify.app/.netlify/functions/api/auth/google/callback
```

## 5. 배포 확인

배포가 완료되면 Netlify에서 제공하는 URL로 애플리케이션에 접속할 수 있습니다.