// 대시보드 핵심 기능을 위한 스크립트

document.addEventListener('DOMContentLoaded', function() {
  // 요소 가져오기
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const channelSelect = document.getElementById('channel-select');
  const dateFilter = document.getElementById('date-filter');
  const durationFilter = document.getElementById('duration-filter');
  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const videosContainer = document.getElementById('videos-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const emptyState = document.getElementById('empty-state');
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');
  const viewBtns = document.querySelectorAll('.view-btn');
  
  // 상태 변수
  let currentUser = null;
  let allVideos = [];
  let filteredVideos = [];
  let currentPageToken = '';
  let nextPageToken = '';
  let prevPageToken = '';
  let currentPage = 1;
  let isLoading = false;
  let channels = new Map(); // 채널 ID를 키로, 채널 정보를 값으로 저장
  
  // 초기화
  initialize();
  
  // 이벤트 리스너 설정
  logoutBtn.addEventListener('click', logout);
  searchBtn.addEventListener('click', applyFilters);
  searchInput.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') applyFilters();
  });
  applyFiltersBtn.addEventListener('click', applyFilters);
  clearFiltersBtn.addEventListener('click', clearFilters);
  refreshBtn.addEventListener('click', refreshVideos);
  prevPageBtn.addEventListener('click', () => changePage('prev'));
  nextPageBtn.addEventListener('click', () => changePage('next'));
  exportCsvBtn.addEventListener('click', () => exportData('csv'));
  exportJsonBtn.addEventListener('click', () => exportData('json'));
  
  // 뷰 모드 변경 이벤트
  viewBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const viewMode = this.dataset.view;
      setViewMode(viewMode);
    });
  });
  
  /**
   * 초기화 함수
   */
  async function initialize() {
    showLoading();
    
    try {
      // 사용자 정보 가져오기
      await getUserInfo();
      
      // 좋아요한 비디오 가져오기
      await fetchLikedVideos();
      
      hideLoading();
    } catch (error) {
      console.error('초기화 오류:', error);
      showError('데이터를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.');
      hideLoading();
    }
  }
  
  /**
   * 사용자 정보 가져오기
   */
  async function getUserInfo() {
    const response = await fetch('/api/user');
    const data = await response.json();
    
    if (!data.isLoggedIn) {
      // 로그인되지 않은 경우 메인 페이지로 리디렉션
      window.location.href = '/';
      return;
    }
    
    currentUser = data.user;
    userAvatar.src = currentUser.photo;
    userName.textContent = currentUser.displayName;
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
      showError('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  }
  
  /**
   * 좋아요한 비디오 가져오기
   * @param {string} pageToken - 페이지 토큰
   */
  async function fetchLikedVideos(pageToken = '') {
    isLoading = true;
    showLoading();
    
    try {
      let url = '/api/liked-videos';
      if (pageToken) {
        url += `?pageToken=${pageToken}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 비디오 데이터 저장
      if (pageToken === '') {
        // 첫 페이지인 경우 모든 비디오 초기화
        allVideos = [...data.items];
        filteredVideos = [...data.items];
      } else {
        // 페이지 이동인 경우 비디오 추가
        allVideos = [...data.items];
        filteredVideos = [...data.items];
      }
      
      // 페이지 토큰 저장
      nextPageToken = data.nextPageToken || '';
      prevPageToken = data.prevPageToken || '';
      currentPageToken = pageToken;
      
      // 채널 정보 추출 및 정리
      extractChannels();
      
      // 채널 선택 메뉴 업데이트
      populateChannelSelect();
      
      // 비디오 표시
      displayVideos(filteredVideos);
      
      // 페이지네이션 업데이트
      updatePagination();
      
      isLoading = false;
      hideLoading();
      
      // 비디오가 없는 경우
      if (allVideos.length === 0) {
        showEmptyState();
      } else {
        hideEmptyState();
      }
    } catch (error) {
      console.error('비디오 가져오기 오류:', error);
      showError('좋아요한 영상을 가져오는 중 오류가 발생했습니다. 다시 시도해주세요.');
      isLoading = false;
      hideLoading();
    }
  }
  
  /**
   * 채널 정보 추출
   */
  function extractChannels() {
    channels.clear();
    
    allVideos.forEach(video => {
      const channelId = video.snippet.channelId;
      const channelTitle = video.snippet.channelTitle;
      
      if (!channels.has(channelId)) {
        channels.set(channelId, {
          id: channelId,
          title: channelTitle
        });
      }
    });
  }
  
  /**
   * 채널 선택 메뉴 업데이트
   */
  function populateChannelSelect() {
    // 기존 옵션 제거 ('모든 채널' 옵션 제외)
    while (channelSelect.options.length > 1) {
      channelSelect.remove(1);
    }
    
    // 채널 이름으로 정렬
    const sortedChannels = Array.from(channels.values())
      .sort((a, b) => a.title.localeCompare(b.title));
    
    // 채널 옵션 추가
    sortedChannels.forEach(channel => {
      const option = document.createElement('option');
      option.value = channel.id;
      option.textContent = channel.title;
      channelSelect.appendChild(option);
    });
  }
  
  /**
   * 필터 적용
   */
  function applyFilters() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedChannel = channelSelect.value;
    const selectedDate = dateFilter.value;
    const selectedDuration = durationFilter.value;
    
    // 모든 비디오 중 필터링
    filteredVideos = allVideos.filter(video => {
      // 제목 검색
      const title = video.snippet.title.toLowerCase();
      const description = video.snippet.description.toLowerCase();
      const matchesSearch = !searchTerm || 
                           title.includes(searchTerm) || 
                           description.includes(searchTerm);
      
      // 채널 필터링
      const matchesChannel = !selectedChannel || 
                            video.snippet.channelId === selectedChannel;
      
      // 날짜 필터링
      const publishedAt = new Date(video.snippet.publishedAt);
      const now = new Date();
      let matchesDate = true;
      
      if (selectedDate === 'day') {
        const oneDayAgo = new Date(now.setDate(now.getDate() - 1));
        matchesDate = publishedAt >= oneDayAgo;
      } else if (selectedDate === 'week') {
        const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
        matchesDate = publishedAt >= oneWeekAgo;
      } else if (selectedDate === 'month') {
        const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
        matchesDate = publishedAt >= oneMonthAgo;
      } else if (selectedDate === 'year') {
        const oneYearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
        matchesDate = publishedAt >= oneYearAgo;
      }
      
      // 영상 길이 필터링
      let matchesDuration = true;
      
      if (selectedDuration && video.contentDetails && video.contentDetails.duration) {
        const duration = video.contentDetails.duration;
        const durationInSeconds = parseDuration(duration);
        
        if (selectedDuration === 'short') {
          matchesDuration = durationInSeconds < 240; // 4분 미만
        } else if (selectedDuration === 'medium') {
          matchesDuration = durationInSeconds >= 240 && durationInSeconds <= 1200; // 4-20분
        } else if (selectedDuration === 'long') {
          matchesDuration = durationInSeconds > 1200; // 20분 초과
        }
      }
      
      return matchesSearch && matchesChannel && matchesDate && matchesDuration;
    });
    
    // 필터링된 결과 표시
    displayVideos(filteredVideos);
    
    // 결과가 없는 경우
    if (filteredVideos.length === 0) {
      showEmptyState();
    } else {
      hideEmptyState();
    }
  }
  
  /**
   * ISO 8601 기간을 초 단위로 변환
   * @param {string} isoDuration - ISO 8601 기간 형식 (예: PT1H30M15S)
   * @returns {number} 초 단위 기간
   */
  function parseDuration(isoDuration) {
    const hoursMatch = isoDuration.match(/(\d+)H/);
    const minutesMatch = isoDuration.match(/(\d+)M/);
    const secondsMatch = isoDuration.match(/(\d+)S/);
    
    let hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    let minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    let seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  /**
   * 필터 초기화
   */
  function clearFilters() {
    searchInput.value = '';
    channelSelect.value = '';
    dateFilter.value = '';
    durationFilter.value = '';
    
    // 모든 비디오 표시
    filteredVideos = [...allVideos];
    displayVideos(filteredVideos);
    
    // 결과가 없는 경우
    if (filteredVideos.length === 0) {
      showEmptyState();
    } else {
      hideEmptyState();
    }
  }
  
  /**
   * 비디오 새로고침
   */
  async function refreshVideos() {
    // 필터 초기화
    clearFilters();
    
    // 비디오 다시 가져오기
    await fetchLikedVideos();
  }
  
  /**
   * 페이지 변경
   * @param {string} direction - 'prev' 또는 'next'
   */
  function changePage(direction) {
    if (direction === 'prev' && prevPageToken) {
      fetchLikedVideos(prevPageToken);
      currentPage--;
    } else if (direction === 'next' && nextPageToken) {
      fetchLikedVideos(nextPageToken);
      currentPage++;
    }
  }
  
  /**
   * 페이지네이션 업데이트
   */
  function updatePagination() {
    // 페이지 정보 업데이트
    pageInfo.textContent = `${currentPage}페이지`;
    
    // 버튼 활성화/비활성화
    prevPageBtn.disabled = !prevPageToken;
    nextPageBtn.disabled = !nextPageToken;
    
    // 페이지네이션 표시/숨김
    if (!prevPageToken && !nextPageToken && allVideos.length <= 50) {
      document.getElementById('pagination').classList.add('hidden');
    } else {
      document.getElementById('pagination').classList.remove('hidden');
    }
  }
  
  /**
   * 데이터 내보내기
   * @param {string} format - 'csv' 또는 'json'
   */
  function exportData(format) {
    if (filteredVideos.length === 0) {
      showError('내보낼 데이터가 없습니다.');
      return;
    }
    
    if (format === 'csv') {
      exportToCsv();
    } else if (format === 'json') {
      exportToJson();
    }
  }
  
  /**
   * CSV 형식으로 내보내기
   */
  function exportToCsv() {
    // CSV 헤더
    let csv = '제목,채널,게시일,조회수,URL\n';
    
    // 비디오 데이터 추가
    filteredVideos.forEach(video => {
      const title = `"${video.snippet.title.replace(/"/g, '""')}"`;
      const channel = `"${video.snippet.channelTitle.replace(/"/g, '""')}"`;
      const publishedAt = formatDate(video.snippet.publishedAt);
      const viewCount = video.statistics?.viewCount || '0';
      const url = createYouTubeUrl(video.id);
      
      csv += `${title},${channel},${publishedAt},${viewCount},${url}\n`;
    });
    
    // 다운로드 링크 생성
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `youtube-liked-videos-${new Date().toISOString().slice(0, 10)}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * JSON 형식으로 내보내기
   */
  function exportToJson() {
    // 필요한 데이터만 추출
    const data = filteredVideos.map(video => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      publishedAt: video.snippet.publishedAt,
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
      duration: video.contentDetails?.duration,
      viewCount: video.statistics?.viewCount || '0',
      likeCount: video.statistics?.likeCount || '0',
      url: createYouTubeUrl(video.id),
      channelUrl: createChannelUrl(video.snippet.channelId)
    }));
    
    // 다운로드 링크 생성
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const filename = `youtube-liked-videos-${new Date().toISOString().slice(0, 10)}.json`;
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * 비디오 표시
   * @param {Array} videos - 표시할 비디오 배열
   */
  function displayVideos(videos) {
    // 컨테이너 비우기
    videosContainer.innerHTML = '';
    
    // 비디오 요소 추가
    videos.forEach(video => {
      const videoElement = createVideoElement(video);
      videosContainer.appendChild(videoElement);
    });
  }
  
  /**
   * 비디오 요소 생성
   * @param {Object} video - 비디오 데이터
   * @returns {HTMLElement} 비디오 카드 요소
   */
  function createVideoElement(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    
    // 썸네일 및 duration
    const thumbnail = document.createElement('div');
    thumbnail.className = 'video-thumbnail';
    
    const thumbnailImg = document.createElement('img');
    thumbnailImg.src = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url;
    thumbnailImg.alt = video.snippet.title;
    thumbnail.appendChild(thumbnailImg);
    
    // 영상 길이 (있는 경우)
    if (video.contentDetails && video.contentDetails.duration) {
      const duration = document.createElement('div');
      duration.className = 'video-duration';
      duration.textContent = formatDuration(video.contentDetails.duration);
      thumbnail.appendChild(duration);
    }
    
    // 비디오 정보
    const info = document.createElement('div');
    info.className = 'video-info';
    
    const title = document.createElement('div');
    title.className = 'video-title';
    title.textContent = video.snippet.title;
    info.appendChild(title);
    
    const channel = document.createElement('div');
    channel.className = 'video-channel';
    channel.textContent = video.snippet.channelTitle;
    info.appendChild(channel);
    
    const stats = document.createElement('div');
    stats.className = 'video-stats';
    
    const views = document.createElement('span');
    views.textContent = `조회수 ${formatViewCount(video.statistics?.viewCount || '0')}회`;
    stats.appendChild(views);
    
    const date = document.createElement('span');
    date.textContent = formatDate(video.snippet.publishedAt);
    stats.appendChild(date);
    
    info.appendChild(stats);
    
    // 클릭 이벤트로 유튜브 페이지 열기
    card.appendChild(thumbnail);
    card.appendChild(info);
    
    card.addEventListener('click', () => {
      window.open(createYouTubeUrl(video.id), '_blank');
    });
    
    return card;
  }
  
  /**
   * 뷰 모드 설정
   * @param {string} mode - 'grid' 또는 'list'
   */
  function setViewMode(mode) {
    // 뷰 모드 버튼 업데이트
    viewBtns.forEach(btn => {
      if (btn.dataset.view === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 비디오 컨테이너 클래스 업데이트
    if (mode === 'grid') {
      videosContainer.classList.add('grid-view');
      videosContainer.classList.remove('list-view');
    } else if (mode === 'list') {
      videosContainer.classList.add('list-view');
      videosContainer.classList.remove('grid-view');
    }
  }
  
  /**
   * 로딩 인디케이터 표시
   */
  function showLoading() {
    loadingIndicator.classList.remove('hidden');
    hideError();
  }
  
  /**
   * 로딩 인디케이터 숨김
   */
  function hideLoading() {
    loadingIndicator.classList.add('hidden');
  }
  
  /**
   * 빈 상태 표시
   */
  function showEmptyState() {
    emptyState.classList.remove('hidden');
  }
  
  /**
   * 빈 상태 숨김
   */
  function hideEmptyState() {
    emptyState.classList.add('hidden');
  }
  
  /**
   * 오류 메시지 표시
   * @param {string} message - 오류 메시지
   */
  function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  }
  
  /**
   * 오류 메시지 숨김
   */
  function hideError() {
    errorMessage.classList.add('hidden');
  }
});