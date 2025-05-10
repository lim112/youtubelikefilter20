# YouTube 좋아요 영상 필터

유튜브에서 좋아요한 영상을 채널과 키워드로 필터링하여 쉽게 찾을 수 있는 웹 애플리케이션입니다. 원래 크롬 확장 프로그램으로 시작했으나 현재는 웹사이트 형태로 개발되었습니다.

## 주요 기능

- Google 계정으로 로그인하여 YouTube 좋아요 영상 목록 불러오기
- 채널명으로 필터링 (가나다 역순 정렬 및 채널명 검색 기능)
- 영상 제목으로 키워드 검색
- 영상 태그(키워드) 정보 표시
- 필터링된 결과를 페이지 단위로 보기 (최대 20,000개 영상 지원)
- 그리드 뷰 / 리스트 뷰 전환 기능
- CSV 또는 JSON 형식으로 데이터 내보내기
- 데이터베이스를 통한 대규모 데이터 관리

## 설치 및 배포 방법

### Replit에서 실행

1. 이 프로젝트를 Replit에서 복제합니다.
2. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 생성합니다.
3. YouTube Data API v3를 활성화합니다.
4. OAuth 동의 화면을 설정하고 Replit 도메인을 승인된 리디렉션 URI로 추가합니다.
5. OAuth 클라이언트 ID와 시크릿을 발급받습니다 (웹 애플리케이션 유형으로 생성).
6. Replit의 Secrets 탭에 `CLIENT_ID`와 `CLIENT_SECRET`을 추가합니다.
7. 'Run' 버튼을 클릭하여 애플리케이션을 시작합니다.

### GitHub과 Netlify로 배포

1. GitHub 저장소를 생성하고 이 프로젝트를 푸시합니다:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/youtubelikefilter.git
   git push -u origin main
   ```

2. [Netlify](https://app.netlify.com/)에 로그인하고 GitHub 저장소를 연결합니다.
3. 다음과 같이 배포 설정을 구성합니다:
   - 빌드 명령어: `bash ./build.sh`
   - 게시 디렉토리: `public`

4. Netlify 대시보드의 "Site settings" → "Environment variables"에서 다음 환경 변수를 설정합니다:
   - `CLIENT_ID`: Google OAuth 클라이언트 ID
   - `CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
   - `DATABASE_URL`: PostgreSQL 데이터베이스 연결 문자열
   - `SESSION_SECRET`: 임의의 문자열 (세션 암호화용)
   - `NETLIFY`: "true"
   - `NODE_ENV`: "production"

5. Google Cloud Console에서 OAuth 리디렉션 URI를 업데이트합니다:
   ```
   https://your-netlify-app.netlify.app/.netlify/functions/api/auth/google/callback
   ```

## 사용 방법

1. 웹사이트에 접속합니다.
2. "Google 계정으로 로그인" 버튼을 클릭하여 계정에 로그인합니다.
3. 로그인 후 좋아요한 영상 목록이 자동으로 로드됩니다.
4. 제목 검색이나 채널 필터를 통해 영상을 찾을 수 있습니다:
   - 검색창에 키워드를 입력하여 제목으로 검색
   - 채널 드롭다운에서 특정 채널 선택 (검색 가능)
   - 채널명은 가나다 역순(내림차순)으로 정렬됨
5. 영상을 클릭하면 해당 영상 페이지로 이동합니다.
6. 각 영상에는 태그(키워드) 정보가 표시됩니다.
7. 그리드 뷰/리스트 뷰 전환 버튼으로 보기 방식을 변경할 수 있습니다.
8. 내보내기 버튼을 통해 CSV 또는 JSON 형식으로 데이터를 내보낼 수 있습니다.

## 개발 정보

### 기술 스택

- 프론트엔드: HTML, CSS, JavaScript (순수 JS)
- 백엔드: Node.js, Express.js
- 데이터베이스: PostgreSQL
- ORM: Drizzle ORM
- API: YouTube Data API v3
- 인증: Google OAuth 2.0
- 배포: Replit, GitHub, Netlify

### 파일 구조

- `server.js` - Express 서버 및 API 엔드포인트
- `db.js` - 데이터베이스 연결 설정
- `storage.js` - 데이터 관리 및 쿼리 로직
- `public/` - 정적 파일 (HTML, CSS, JS)
  - `dashboard.html/js/css` - 메인 대시보드
  - `index.html` - 랜딩 페이지
- `netlify/functions/` - Netlify 서버리스 함수
- `shared/schema.js` - 데이터베이스 스키마 정의
- `.env` - 환경 변수 (개발용)
- `netlify.toml` - Netlify 배포 설정

### API 및 권한

이 애플리케이션은 다음과 같은 API와 권한을 사용합니다:

- YouTube Data API v3
  - `youtube.readonly` - 사용자의 YouTube 데이터 읽기 권한
- Google OAuth 2.0
  - `profile` - 사용자 프로필 정보
  - `email` - 이메일 주소

## 프라이버시

- 사용자 데이터는 보안 데이터베이스에 저장됩니다.
- 인증 토큰은 서버의 안전한 세션 저장소에 보관됩니다.
- 최소한의 필요한 권한만 요청합니다.
- 다른 외부 서비스와 개인 데이터를 공유하지 않습니다.

## 라이선스

MIT 라이선스

## 작성자

이 확장 프로그램은 사용자 요청에 따라 제작되었습니다.