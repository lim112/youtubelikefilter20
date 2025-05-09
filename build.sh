#!/bin/bash
set -e  # 오류 발생 시 스크립트 중지

echo "YouTube Filter 빌드 스크립트 시작"

# 종속성 설치
echo "종속성 설치 중..."
npm install

# 데이터베이스 스키마 업데이트
echo "데이터베이스 스키마 업데이트 중..."
node drizzle-push.js

# public 폴더 비우고 다시 생성
echo "public 폴더 준비 중..."
rm -rf public
mkdir -p public

# 홈페이지 복사
echo "홈페이지 복사 중..."
cp index.html public/

# 대시보드 페이지 생성
echo "대시보드 페이지 생성 중..."
cat > public/dashboard.html << EOL
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>YouTube 좋아요 필터 - 대시보드</title>
  <link rel="stylesheet" href="/css/dashboard.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body>
  <header>
    <div class="logo">YouTube 좋아요 필터</div>
    <div class="user-info">
      <span id="user-name">로그인 중...</span>
      <button id="logout-btn">로그아웃</button>
    </div>
  </header>
  
  <div class="container">
    <div class="sidebar">
      <div class="filter-section">
        <h3>채널 필터</h3>
        <div class="channel-search">
          <input type="text" id="channel-search" placeholder="채널 검색...">
        </div>
        <select id="channel-select" size="15" class="channel-list">
          <option value="">모든 채널</option>
        </select>
        <div class="channel-count">0개 채널</div>
      </div>
      
      <div class="filter-section">
        <h3>검색</h3>
        <input type="text" id="search-input" placeholder="제목 또는 설명 검색...">
      </div>
      
      <div class="filter-section">
        <h3>정렬</h3>
        <select id="sort-select">
          <option value="publishedAt">업로드일 (최신순)</option>
          <option value="publishedAt_asc">업로드일 (오래된순)</option>
          <option value="viewCount">조회수 (높은순)</option>
          <option value="viewCount_asc">조회수 (낮은순)</option>
          <option value="title">제목 (가나다순)</option>
          <option value="title_desc">제목 (가나다 역순)</option>
        </select>
      </div>
      
      <div class="filter-section">
        <h3>보기</h3>
        <div class="view-buttons">
          <button id="grid-view-btn" class="active"><i class="fas fa-th"></i> 그리드</button>
          <button id="list-view-btn"><i class="fas fa-list"></i> 리스트</button>
        </div>
      </div>
      
      <div class="filter-section">
        <button id="clear-filters-btn">필터 초기화</button>
        <button id="refresh-btn">새로고침</button>
      </div>
      
      <div class="export-section">
        <h3>내보내기</h3>
        <div class="export-buttons">
          <button id="export-csv-btn"><i class="fas fa-file-csv"></i> CSV</button>
          <button id="export-json-btn"><i class="fas fa-file-code"></i> JSON</button>
        </div>
      </div>
    </div>
    
    <div class="main-content">
      <div id="loading" class="loading-container">
        <div class="spinner"></div>
        <p>좋아요한 영상을 불러오는 중...</p>
      </div>
      
      <div id="error" class="error-container" style="display: none;">
        <i class="fas fa-exclamation-circle"></i>
        <p id="error-message">오류가 발생했습니다.</p>
        <button id="retry-btn">다시 시도</button>
      </div>
      
      <div id="empty-state" class="empty-state" style="display: none;">
        <i class="fas fa-heart-broken"></i>
        <p>좋아요한 영상이 없습니다.</p>
        <p>YouTube에서 영상에 좋아요를 누르면 이곳에 표시됩니다.</p>
      </div>
      
      <div id="videos-container" class="videos-grid"></div>
      
      <div id="pagination" class="pagination" style="display: none;">
        <button id="prev-page" disabled>&larr; 이전</button>
        <span id="page-info">페이지 1</span>
        <button id="next-page">다음 &rarr;</button>
      </div>
    </div>
  </div>

  <script src="/js/utils.js"></script>
  <script src="/js/dashboard.js"></script>
</body>
</html>
EOL

# CSS와 JS 디렉토리 생성
echo "CSS와 JS 디렉토리 생성 중..."
mkdir -p public/css
mkdir -p public/js

# 기본 CSS 파일 생성
echo "기본 CSS 파일 생성 중..."
cat > public/css/dashboard.css << EOL
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f9f9f9;
}

header {
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ff0000;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

#logout-btn {
  background-color: #f2f2f2;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.container {
  display: flex;
  padding: 20px;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.sidebar {
  flex: 0 0 250px;
  background-color: #fff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.main-content {
  flex: 1;
  position: relative;
}

.filter-section {
  margin-bottom: 20px;
}

.filter-section h3 {
  margin-bottom: 10px;
  font-size: 1rem;
  color: #555;
}

select, input, button {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 10px;
}

.channel-list {
  height: 200px;
  overflow-y: auto;
}

.view-buttons, .export-buttons {
  display: flex;
  gap: 10px;
}

.view-buttons button, .export-buttons button {
  flex: 1;
}

button {
  background-color: #f2f2f2;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #e6e6e6;
}

button.active {
  background-color: #4285f4;
  color: white;
}

.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.video-card {
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.video-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.thumbnail-container {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 Aspect Ratio */
}

.thumbnail {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.duration {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 3px 5px;
  border-radius: 3px;
  font-size: 0.8rem;
}

.video-info {
  padding: 12px;
}

.video-title {
  font-size: 1rem;
  margin-bottom: 8px;
  line-height: 1.4;
  font-weight: bold;
}

.video-channel {
  color: #606060;
  font-size: 0.9rem;
  margin-bottom: 5px;
  cursor: pointer;
}

.video-channel:hover {
  color: #4285f4;
}

.video-metadata {
  display: flex;
  justify-content: space-between;
  color: #606060;
  font-size: 0.8rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 30px;
  gap: 15px;
}

.pagination button {
  padding: 8px 15px;
  width: auto;
}

.pagination button:disabled {
  background-color: #f2f2f2;
  color: #ccc;
  cursor: not-allowed;
}

.loading-container, .error-container, .empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  text-align: center;
}

.spinner {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #4285f4;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-container i, .empty-state i {
  font-size: 48px;
  color: #d32f2f;
  margin-bottom: 20px;
}

.empty-state i {
  color: #9e9e9e;
}

#retry-btn {
  width: auto;
  margin-top: 15px;
  padding: 8px 20px;
}

.channel-search {
  margin-bottom: 10px;
}

.channel-count {
  font-size: 0.8rem;
  color: #606060;
  text-align: right;
  margin-top: 5px;
}

/* 리스트 뷰 스타일 */
.videos-list .video-card {
  display: flex;
  height: 120px;
}

.videos-list .thumbnail-container {
  flex: 0 0 200px;
  padding-top: 0;
  height: 100%;
}

.videos-list .video-info {
  flex: 1;
}

.matched-text {
  background-color: #ff9;
  font-weight: bold;
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
  
  .sidebar {
    flex: none;
    width: 100%;
  }
  
  .videos-list .video-card {
    flex-direction: column;
    height: auto;
  }
  
  .videos-list .thumbnail-container {
    flex: none;
    width: 100%;
    padding-top: 56.25%;
  }
}
EOL

# 기본 JS 파일들 생성
echo "기본 JS 파일 생성 중..."

# 유틸리티 함수
cat > public/js/utils.js << EOL
/**
 * 날짜 포맷 함수
 * @param {string} dateString - ISO 형식 날짜 문자열
 * @returns {string} 포맷된 날짜 (예: 2023년 5월 12일)
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 조회수 포맷 함수
 * @param {number|string} count - 포맷할 숫자
 * @returns {string} 포맷된 조회수 (예: 1.2천, 3.5만, 100만)
 */
function formatViewCount(count) {
  const num = parseInt(count, 10);
  
  if (isNaN(num)) return '0';
  
  if (num < 1000) return num.toString();
  if (num < 10000) return (num / 1000).toFixed(1) + '천';
  if (num < 100000) return (num / 10000).toFixed(1) + '만';
  if (num < 1000000) return Math.floor(num / 10000) + '만';
  return (num / 1000000).toFixed(1) + '백만';
}

/**
 * ISO 8601 기간 포맷 함수
 * @param {string} isoDuration - ISO 8601 기간 형식 (예: PT1H30M15S)
 * @returns {string} 포맷된 기간 (예: 1:30:15)
 */
function formatDuration(isoDuration) {
  if (!isoDuration) return '0:00';
  
  // PT1H30M15S 형식에서 시간, 분, 초 추출
  const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!matches) return '0:00';
  
  const hours = parseInt(matches[1] || 0);
  const minutes = parseInt(matches[2] || 0);
  const seconds = parseInt(matches[3] || 0);
  
  // 시간이 있는 경우: 1:30:15, 없는 경우: 5:20
  if (hours > 0) {
    return \`\${hours}:\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
  } else {
    return \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
  }
}

/**
 * 텍스트 길이 제한 함수
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 최대 길이
 * @returns {string} 제한된 텍스트 (최대 길이를 초과하면 '...' 추가)
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * HTML 이스케이프 함수
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHTML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 지연 시간 (밀리초)
 * @returns {Function} 디바운스된 함수
 */
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * 유튜브 URL에서 비디오 ID 추출
 * @param {string} url - 유튜브 URL
 * @returns {string|null} 비디오 ID 또는 null
 */
function extractVideoId(url) {
  if (!url) return null;
  
  // 다양한 YouTube URL 형식에서 비디오 ID 추출
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\\/ ]{11})/i;
  const match = url.match(regex);
  
  return match ? match[1] : null;
}

/**
 * 비디오 ID로 유튜브 URL 생성
 * @param {string} videoId - 유튜브 비디오 ID
 * @returns {string} 유튜브 비디오 URL
 */
function createYouTubeUrl(videoId) {
  if (!videoId) return '';
  return \`https://www.youtube.com/watch?v=\${videoId}\`;
}

/**
 * 채널 ID로 유튜브 채널 URL 생성
 * @param {string} channelId - 유튜브 채널 ID
 * @returns {string} 유튜브 채널 URL
 */
function createChannelUrl(channelId) {
  if (!channelId) return '';
  return \`https://www.youtube.com/channel/\${channelId}\`;
}
EOL

# 대시보드 JS
cat > public/js/dashboard.js << EOL
/**
 * 초기화 함수
 */
async function initialize() {
  try {
    // 사용자 정보 가져오기
    await getUserInfo();
    
    // 메타데이터 가져오기 (채널, 날짜, 길이 정보)
    await fetchMetadata();
    
    // 이벤트 리스너 설정
    document.getElementById('channel-search').addEventListener('input', debounce(filterChannelOptions, 300));
    document.getElementById('channel-select').addEventListener('change', applyFilters);
    document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('sort-select').addEventListener('change', applyFilters);
    document.getElementById('grid-view-btn').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('list-view-btn').addEventListener('click', () => setViewMode('list'));
    document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
    document.getElementById('refresh-btn').addEventListener('click', refreshVideos);
    document.getElementById('prev-page').addEventListener('click', () => changePage('prev'));
    document.getElementById('next-page').addEventListener('click', () => changePage('next'));
    document.getElementById('export-csv-btn').addEventListener('click', exportToCsv);
    document.getElementById('export-json-btn').addEventListener('click', exportToJson);
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // 첫 페이지 비디오 로드 (서버 캐시에서)
    await fetchLikedVideos('', false, true);
    
    // 다음 페이지 모든 영상 백그라운드 로드 (새로운 데이터로)
    setTimeout(() => {
      fetchLikedVideos('', true, false);
    }, 1000);
  } catch (error) {
    console.error('초기화 오류:', error);
    showError('데이터를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

/**
 * 메타데이터 가져오기 (채널, 게시일, 영상 길이 정보)
 */
async function fetchMetadata() {
  console.log('메타데이터 가져오는 중...');
  try {
    const response = await fetch('/api/videos/metadata');
    
    if (!response.ok) {
      throw new Error(\`서버 응답 오류: \${response.status}\`);
    }
    
    const data = await response.json();
    
    if (data.metadata && data.metadata.channels) {
      // 메타데이터 저장 (window 객체에)
      window.videoMetadata = data.metadata;
      
      // 채널 정보 업데이트
      updateChannelSelect(data.metadata.channels);
      
      console.log(\`메타데이터 로드 완료: \${Object.keys(data.metadata.channels).length}개 채널, 총 \${data.metadata.totalVideos || 0}개 비디오\`);
    } else {
      console.error('메타데이터 형식 오류:', data);
    }
  } catch (error) {
    console.error('메타데이터 가져오기 오류:', error);
    showError('메타데이터를 가져오는 중 오류가 발생했습니다.');
    throw error;
  }
}

/**
 * API 오류 확인 함수
 */
function checkApiError() {
  const urlParams = new URLSearchParams(window.location.search);
  const apiError = urlParams.get('api_error');
  
  if (apiError) {
    showError(decodeURIComponent(apiError));
  }
}

/**
 * 사용자 정보 가져오기
 */
async function getUserInfo() {
  try {
    const response = await fetch('/api/user');
    
    if (!response.ok) {
      throw new Error('사용자 정보를 가져올 수 없습니다.');
    }
    
    const data = await response.json();
    
    if (data.isLoggedIn) {
      // 사용자 정보 표시
      document.getElementById('user-name').textContent = data.user.displayName || '사용자';
    } else {
      // 로그인 페이지로 리디렉션
      window.location.href = '/';
    }
  } catch (error) {
    console.error('사용자 정보 가져오기 오류:', error);
    window.location.href = '/?error=auth';
  }
}

/**
 * 로그아웃 함수
 */
async function logout() {
  try {
    await fetch('/api/logout');
    window.location.href = '/';
  } catch (error) {
    console.error('로그아웃 오류:', error);
    alert('로그아웃 중 오류가 발생했습니다.');
  }
}

/**
 * 좋아요한 비디오 가져오기
 * @param {string} pageToken - 페이지 토큰
 * @param {boolean} refresh - API에서 새 데이터를 가져올지 여부
 * @param {boolean} loadThumbnails - 썸네일 이미지를 가져올지 여부 (기본: true)
 */
async function fetchLikedVideos(pageToken = '', refresh = false, loadThumbnails = true) {
  try {
    showLoading();
    hideError();
    
    // 필터링 파라미터 가져오기
    const channelId = document.getElementById('channel-select').value;
    const searchQuery = document.getElementById('search-input').value;
    const sortOption = document.getElementById('sort-select').value;
    
    // API URL 구성
    let url = \`/api/liked-videos?loadThumbnails=\${loadThumbnails}\`;
    
    if (pageToken) {
      url += \`&pageToken=\${pageToken}\`;
    }
    
    if (refresh) {
      url += '&refresh=true';
    }
    
    if (channelId) {
      url += \`&channel=\${channelId}\`;
    }
    
    if (searchQuery) {
      url += \`&search=\${encodeURIComponent(searchQuery)}\`;
    }
    
    if (sortOption) {
      url += \`&sort=\${sortOption}\`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(\`서버 응답 오류: \${response.status}\`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      showError(data.error);
      return;
    }
    
    // 값이 없으면 비어있는 상태 표시
    if (!data.items || data.items.length === 0) {
      showEmptyState();
      hidePagination();
      return;
    }
    
    // 데이터 저장 (window 객체에)
    window.currentResponse = data;
    
    // 비디오 표시
    displayVideos(data.items);
    
    // 페이지네이션 업데이트
    updatePagination();
    
    // 개발용 로그
    console.log(\`페이지 \${Math.floor(data.pageInfo.currentOffset / data.pageInfo.resultsPerPage) + 1}: \${data.items.length}개 항목 로드됨 (총 \${data.pageInfo.totalResults}개 중)\`);
    console.log(\`현재 오프셋: \${data.pageInfo.currentOffset}, 페이지당 항목 수: \${data.pageInfo.resultsPerPage}\`);
    console.log(\`현재 페이지 토큰:\`, pageToken);
    console.log(\`다음 페이지 토큰:\`, data.nextPageToken);
    console.log(\`이전 페이지 토큰:\`, data.prevPageToken);
    
    hideLoading();
  } catch (error) {
    console.error('좋아요한 영상 가져오기 오류:', error);
    showError('YouTube API에서 데이터를 가져오는 중 오류가 발생했습니다.');
    hideLoading();
  }
}

/**
 * 채널 선택 메뉴 업데이트
 * @param {Object} channels - 채널 데이터 객체
 */
function updateChannelSelect(channels) {
  const selectElement = document.getElementById('channel-select');
  
  // 첫 번째 옵션 유지
  const firstOption = selectElement.options[0];
  selectElement.innerHTML = '';
  selectElement.appendChild(firstOption);
  
  // 채널 배열 생성 및 이름 기준 내림차순 정렬
  const channelsArray = Object.entries(channels)
    .map(([id, data]) => ({ id, name: data.title, count: data.count }))
    .sort((a, b) => b.name.localeCompare(a.name));
  
  // 채널 옵션 추가
  channelsArray.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = \`\${channel.name} (\${channel.count})\`;
    option.dataset.channelName = channel.name; // 채널 이름을 데이터 속성으로 저장
    selectElement.appendChild(option);
  });
  
  // 채널 수 업데이트
  document.querySelector('.channel-count').textContent = \`\${channelsArray.length}개 채널\`;
}

/**
 * 채널 검색어에 따라 채널 옵션 필터링
 */
function filterChannelOptions() {
  const input = document.getElementById('channel-search');
  const filter = input.value.toLowerCase();
  const select = document.getElementById('channel-select');
  const options = select.options;
  
  let matchCount = 0;
  
  // 첫 번째 옵션("모든 채널")은 항상 표시
  options[0].style.display = '';
  
  // 나머지 옵션 필터링
  for (let i = 1; i < options.length; i++) {
    const channelName = options[i].dataset.channelName || options[i].text;
    const txtValue = channelName.toLowerCase();
    
    if (txtValue.indexOf(filter) > -1) {
      options[i].style.display = '';
      
      // 검색어 하이라이트 (텍스트 내용만)
      if (filter) {
        const regex = new RegExp(\`(\${filter})\`, 'gi');
        const displayText = options[i].dataset.channelName 
          ? \`\${channelName.replace(regex, '<span class="matched-text">$1</span>')} (\${options[i].value})\`
          : channelName.replace(regex, '<span class="matched-text">$1</span>');
        
        // 실제로는 표시되지 않지만 코드는 유지
        // (select 요소에는 innerHTML이 직접 적용되지 않음)
        options[i].innerHTML = displayText;
      }
      
      matchCount++;
    } else {
      options[i].style.display = 'none';
    }
  }
  
  document.querySelector('.channel-count').textContent = \`\${matchCount}개 채널 일치\`;
}

/**
 * 필터 적용
 */
function applyFilters() {
  // 현재 저장된 pageToken이 있으면 초기화
  fetchLikedVideos('');
}

/**
 * 필터 초기화
 */
function clearFilters() {
  document.getElementById('channel-select').value = '';
  document.getElementById('search-input').value = '';
  document.getElementById('sort-select').value = 'publishedAt';
  
  // 채널 검색어 초기화 및 모든 채널 표시
  document.getElementById('channel-search').value = '';
  filterChannelOptions();
  
  // 비디오 다시 로드
  fetchLikedVideos('');
}

/**
 * 비디오 새로고침
 */
async function refreshVideos() {
  await fetchLikedVideos('', true);
  await fetchMetadata();
}

/**
 * 페이지 변경
 * @param {string} direction - 'prev' 또는 'next'
 */
function changePage(direction) {
  const data = window.currentResponse;
  if (!data) return;
  
  let pageToken = null;
  
  if (direction === 'next' && data.nextPageToken) {
    pageToken = data.nextPageToken;
  } else if (direction === 'prev' && data.prevPageToken) {
    pageToken = data.prevPageToken;
  }
  
  if (pageToken !== null) {
    fetchLikedVideos(pageToken);
  }
}

/**
 * 페이지네이션 업데이트
 */
function updatePagination() {
  const data = window.currentResponse;
  if (!data) return;
  
  const pagination = document.getElementById('pagination');
  const prevButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');
  
  const currentPage = Math.floor(data.pageInfo.currentOffset / data.pageInfo.resultsPerPage) + 1;
  const totalPages = Math.ceil(data.pageInfo.totalResults / data.pageInfo.resultsPerPage);
  
  pageInfo.textContent = \`페이지 \${currentPage} / \${totalPages}\`;
  
  prevButton.disabled = !data.prevPageToken;
  nextButton.disabled = !data.nextPageToken;
  
  pagination.style.display = 'flex';
}

/**
 * CSV 형식으로 내보내기
 */
function exportToCsv() {
  showLoading();
  setTimeout(() => {
    try {
      // 모든 영상 가져오기
      const allVideos = window.allVideosCache || [];
      
      if (allVideos.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        hideLoading();
        return;
      }
      
      // CSV 헤더와 데이터 생성
      const headers = [
        '제목', '채널명', '채널 ID', '업로드 날짜', 
        '길이', '조회수', '좋아요 수', 'URL'
      ];
      
      const csvRows = [];
      csvRows.push(headers.join(','));
      
      allVideos.forEach(video => {
        const row = [
          \`"\${video.title.replace(/"/g, '""')}"\`,
          \`"\${video.channelTitle.replace(/"/g, '""')}"\`,
          video.channelId,
          new Date(video.publishedAt).toLocaleDateString(),
          formatDuration(video.duration),
          video.viewCount,
          video.likeCount,
          \`https://www.youtube.com/watch?v=\${video.videoId}\`
        ];
        csvRows.push(row.join(','));
      });
      
      // UTF-8 BOM 추가 (엑셀에서 한글이 깨지는 것 방지)
      const BOM = '\\uFEFF';
      const csvString = BOM + csvRows.join('\\n');
      
      // CSV 파일 생성 및 다운로드
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', \`youtube_liked_videos_\${new Date().toISOString().slice(0, 10)}.csv\`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      hideLoading();
    } catch (error) {
      console.error('CSV 내보내기 오류:', error);
      alert('데이터를 내보내는 중 오류가 발생했습니다.');
      hideLoading();
    }
  }, 100);
}

/**
 * JSON 형식으로 내보내기
 */
function exportToJson() {
  showLoading();
  setTimeout(() => {
    try {
      // 모든 영상 가져오기
      const allVideos = window.allVideosCache || [];
      
      if (allVideos.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        hideLoading();
        return;
      }
      
      // JSON 데이터 생성
      const jsonString = JSON.stringify(allVideos, null, 2);
      
      // JSON 파일 생성 및 다운로드
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', \`youtube_liked_videos_\${new Date().toISOString().slice(0, 10)}.json\`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      hideLoading();
    } catch (error) {
      console.error('JSON 내보내기 오류:', error);
      alert('데이터를 내보내는 중 오류가 발생했습니다.');
      hideLoading();
    }
  }, 100);
}

/**
 * 비디오 표시
 * @param {Array} videos - 표시할 비디오 배열
 */
function displayVideos(videos) {
  const container = document.getElementById('videos-container');
  container.innerHTML = '';
  
  if (!videos || videos.length === 0) {
    showEmptyState();
    return;
  }
  
  hideEmptyState();
  
  videos.forEach(video => {
    const videoElement = createVideoElement(video);
    container.appendChild(videoElement);
  });
  
  // 컨테이너 표시
  container.style.display = 'grid';
  
  // 페이지네이션 표시
  showPagination();
}

/**
 * 비디오 요소 생성
 * @param {Object} video - 비디오 데이터
 * @returns {HTMLElement} 비디오 카드 요소
 */
function createVideoElement(video) {
  const card = document.createElement('div');
  card.className = 'video-card';
  
  // 하이라이트 검색어 (있는 경우)
  const searchTerm = document.getElementById('search-input').value.trim();
  
  // 제목 하이라이트
  let title = escapeHTML(video.title);
  if (searchTerm && title.toLowerCase().includes(searchTerm.toLowerCase())) {
    const regex = new RegExp(\`(\${searchTerm.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\\\$&')})\`, 'gi');
    title = title.replace(regex, '<span class="matched-text">$1</span>');
  }
  
  card.innerHTML = \`
    <a href="https://www.youtube.com/watch?v=\${video.videoId}" target="_blank" rel="noopener">
      <div class="thumbnail-container">
        <img class="thumbnail" src="\${video.thumbnailUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiNlZWUiLz48dGV4dCB0ZXh0LWFuY2hvcj0ibWlkZGxlIiB4PSI2MCIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSI+No image</dGV4dD48L3N2Zz4='}" 
          alt="\${escapeHTML(video.title)}" 
          loading="lazy">
        <div class="duration">\${formatDuration(video.duration)}</div>
      </div>
    </a>
    <div class="video-info">
      <a href="https://www.youtube.com/watch?v=\${video.videoId}" target="_blank" rel="noopener">
        <div class="video-title">\${title}</div>
      </a>
      <div class="video-channel" data-channel-id="\${video.channelId}" onclick="document.getElementById('channel-select').value='\${video.channelId}';applyFilters();">
        \${escapeHTML(video.channelTitle)}
      </div>
      <div class="video-metadata">
        <div>\${formatDate(video.publishedAt)}</div>
        <div>조회수 \${formatViewCount(video.viewCount)}</div>
      </div>
    </div>
  \`;
  
  return card;
}

/**
 * 뷰 모드 설정
 * @param {string} mode - 'grid' 또는 'list'
 */
function setViewMode(mode) {
  const container = document.getElementById('videos-container');
  const gridBtn = document.getElementById('grid-view-btn');
  const listBtn = document.getElementById('list-view-btn');
  
  if (mode === 'grid') {
    container.className = 'videos-grid';
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
  } else {
    container.className = 'videos-list';
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
  }
  
  // 뷰 모드 변경 후 비디오 재표시
  if (window.currentResponse && window.currentResponse.items) {
    displayVideos(window.currentResponse.items);
  }
}

/**
 * 로딩 인디케이터 표시
 */
function showLoading() {
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('videos-container').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('error').style.display = 'none';
}

/**
 * 로딩 인디케이터 숨김
 */
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

/**
 * 빈 상태 표시
 */
function showEmptyState() {
  document.getElementById('empty-state').style.display = 'flex';
  document.getElementById('videos-container').style.display = 'none';
}

/**
 * 빈 상태 숨김
 */
function hideEmptyState() {
  document.getElementById('empty-state').style.display = 'none';
}

/**
 * 페이지네이션 표시
 */
function showPagination() {
  document.getElementById('pagination').style.display = 'flex';
}

/**
 * 페이지네이션 숨김
 */
function hidePagination() {
  document.getElementById('pagination').style.display = 'none';
}

/**
 * 오류 메시지 표시
 * @param {string} message - 오류 메시지
 */
function showError(message) {
  const errorElement = document.getElementById('error');
  const errorMessage = document.getElementById('error-message');
  
  errorMessage.textContent = message;
  errorElement.style.display = 'flex';
  
  hideLoading();
}

/**
 * 오류 메시지 숨김
 */
function hideError() {
  document.getElementById('error').style.display = 'none';
}

// API 오류 확인
checkApiError();

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', initialize);
EOL

echo "빌드 완료"