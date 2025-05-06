# YouTube 좋아요 영상 필터 - 웹 애플리케이션

유튜브에서 좋아요한 영상을 채널과 키워드로 필터링하여 쉽게 찾을 수 있는 웹 애플리케이션입니다.

## 주요 기능

- Google 계정으로 로그인하여 YouTube 좋아요 영상 목록 불러오기
- 채널명으로 필터링
- 제목이나 설명의 키워드로 검색
- 필터링된 결과를 페이지 단위로 보기
- 설정 페이지에서 다양한 옵션 조정
- 데이터 내보내기 기능

## 설치 및 배포 방법

### 로컬 개발 환경 설정

1. 이 리포지토리를 로컬 컴퓨터에 클론하거나 다운로드합니다.
2. `npm install`로 필요한 패키지를 설치합니다.
3. `.env` 파일을 생성하고 필요한 환경 변수를 설정합니다 (`.env.template` 참조).
4. [Google 개발자 콘솔](https://console.developers.google.com/)에서 프로젝트를 생성합니다.
5. YouTube Data API v3를 활성화합니다.
6. OAuth 동의 화면을 설정합니다. 개발 단계에서는 '내부' 또는 '테스트'로 설정하고 자신의 계정을 테스트 사용자로 추가합니다.
7. 사용자 인증 정보에서 OAuth 클라이언트 ID를 생성합니다 (유형: '웹 애플리케이션').
8. 승인된 리디렉션 URI에 `http://localhost:5000/auth/google/callback`를 추가합니다.
9. `npm start`로 로컬 서버를 실행합니다.

### Netlify 배포

1. [Netlify](https://www.netlify.com/)에 계정을 생성하고 로그인합니다.
2. GitHub 저장소와 연결하여 새 사이트를 생성합니다.
3. 환경 변수를 설정합니다 (`.env.template` 참조).
4. Google Cloud Console에서 OAuth 클라이언트 ID에 적절한 리디렉션 URI를 추가합니다:
   - `https://youtubelikefilter12.netlify.app/auth/google/callback`
5. 자동 배포를 설정하거나 수동으로 Netlify에 배포합니다.

## 사용 방법

1. 웹 사이트(https://youtubelikefilter12.netlify.app)에 접속합니다.
2. "Google로 로그인" 버튼을 클릭하여 계정에 로그인합니다.
3. 로그인 후 좋아요한 영상 목록이 자동으로 로드됩니다.
4. 키워드 검색이나 채널 선택을 통해 영상을 필터링합니다.
5. 영상을 클릭하면 해당 영상 페이지로 이동합니다.
6. 상단 메뉴에서 "설정"을 클릭하여 애플리케이션 설정을 변경할 수 있습니다.
7. "CSV 내보내기" 또는 "JSON 내보내기" 버튼을 사용하여 데이터를 내보낼 수 있습니다.

## 개발 정보

### 기술 스택

- HTML, CSS, JavaScript
- YouTube Data API v3
- Chrome Extension API
- OAuth 2.0 인증

### 파일 구조

- `manifest.json` - 확장 프로그램 설정
- `popup.html/js/css` - 메인 인터페이스
- `background.js` - 백그라운드 서비스
- `options.html/js/css` - 설정 페이지
- `content.js` - 콘텐츠 스크립트
- `utils.js` - 유틸리티 함수

### API 권한

이 확장 프로그램은 다음과 같은 API 권한을 사용합니다:

- `identity` - Google 계정 인증
- `storage` - 로컬 데이터 저장
- `https://www.googleapis.com/*` - YouTube API 접근

## 프라이버시

- 모든 데이터는 사용자의 브라우저 내에 저장됩니다.
- 인증 토큰은 Chrome의 안전한 저장소에 보관됩니다.
- 외부 서버로 개인 데이터를 전송하지 않습니다.
- 최소한의 필요한 권한만 요청합니다.

## 라이선스

MIT 라이선스

## 작성자

이 확장 프로그램은 사용자 요청에 따라 제작되었습니다.