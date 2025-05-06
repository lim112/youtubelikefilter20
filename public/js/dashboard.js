// 대시보드 핵심 기능을 위한 스크립트

document.addEventListener('DOMContentLoaded', function() {
  // 요소 가져오기
  const userName = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const channelSelect = document.getElementById('channel-select');
  const dateFilter = document.getElementById('date-filter');
  const durationFilter = document.getElementById('duration-filter');
  const sortFilter = document.getElementById('sort-filter');
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
  const authErrorHelp = document.getElementById('auth-error-help');
  const tryLoginBtn = document.getElementById('try-login-btn');
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
  tryLoginBtn.addEventListener('click', () => window.location.href = '/auth/google');
  sortFilter.addEventListener('change', function() {
    applySorting();
    displayVideos(filteredVideos);
  });
  
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
    
    // URL 파라미터에서 API 오류 확인
    checkApiError();
    
    try {
      // 사용자 정보 가져오기
      await getUserInfo();
      
      // 좋아요한 비디오 가져오기 - refresh=true 파라미터로 최신 데이터를 가져옴
      await fetchLikedVideos('', true);
      
      hideLoading();
    } catch (error) {
      console.error('초기화 오류:', error);
      showError('데이터를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.');
      hideLoading();
    }
  }
  
  /**
   * API 오류 확인 함수
   */
  function checkApiError() {
    // URL 파라미터에서 api_error 확인
    const urlParams = new URLSearchParams(window.location.search);
    const apiError = urlParams.get('api_error');
    
    if (apiError) {
      showError(`API 오류: ${decodeURIComponent(apiError)}<br>서버에 저장된 데이터를 표시합니다.`);
      
      // URL에서 파라미터 제거 (오류 메시지가 계속 표시되는 것 방지)
      window.history.replaceState({}, document.title, window.location.pathname);
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
   * @param {boolean} refresh - API에서 새 데이터를 가져올지 여부
   */
  async function fetchLikedVideos(pageToken = '', refresh = false) {
    isLoading = true;
    showLoading();
    
    try {
      let url = '/api/liked-videos';
      const params = new URLSearchParams();
      
      if (pageToken) {
        params.append('pageToken', pageToken);
      }
      
      if (refresh) {
        params.append('refresh', 'true');
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      
      // API 에러 메시지 확인
      if (data.error) {
        // 인증 오류인 경우
        if (data.error.includes('인증 오류') || data.error.includes('로그인')) {
          showError(data.error + ' 다시 로그인해주세요.');
          
          // 3초 후 로그인 페이지로 리디렉션
          setTimeout(() => {
            window.location.href = '/auth/google';
          }, 3000);
          
          return;
        } else {
          // 기타 API 오류
          showError(data.error);
        }
      }
      
      // 비디오 데이터 저장
      // 페이지와 상관없이 항상 현재 페이지의 데이터만 표시
      allVideos = [...data.items];
      filteredVideos = [...data.items];
      
      // 페이지 정보 저장
      totalVideos = data.pageInfo?.totalResults || allVideos.length;
      const itemsPerPage = data.pageInfo?.resultsPerPage || 100;
      const currentOffset = data.pageInfo?.currentOffset || 0;
      
      console.log(`페이지 ${currentPage}: ${data.items.length}개 항목 로드됨 (총 ${totalVideos}개 중)`);
      console.log(`현재 오프셋: ${currentOffset}, 페이지당 항목 수: ${itemsPerPage}`);
      
      // 디버깅을 위해 페이지 토큰 정보 출력
      console.log('현재 페이지 토큰:', pageToken);
      console.log('다음 페이지 토큰:', data.nextPageToken);
      console.log('이전 페이지 토큰:', data.prevPageToken);
      
      // 페이지 토큰 저장
      nextPageToken = data.nextPageToken || '';
      prevPageToken = data.prevPageToken || '';
      currentPageToken = pageToken;
      
      // 채널 정보 추출 및 정리
      extractChannels();
      
      // 채널 선택 메뉴 업데이트
      populateChannelSelect();
      
      // 정렬 적용
      applySorting();
      
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
      
      let errorMessage = '좋아요한 영상을 가져오는 중 오류가 발생했습니다.';
      
      try {
        // API 에러 응답이 있는지 확인
        if (error.message && error.message.includes('API 오류:')) {
          errorMessage += ` (${error.message})`;
        }
        
        // 네트워크 오류인 경우
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          errorMessage = '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
        }
      } catch (e) {
        // 오류 처리 중 추가 오류 발생 시 기본 메시지만 표시
      }
      
      showError(errorMessage);
      isLoading = false;
      hideLoading();
      
      // 에러 발생 시에도 저장된 데이터가 있으면 표시
      if (allVideos.length > 0) {
        // 정렬 적용
        applySorting();
        // 비디오 표시
        displayVideos(filteredVideos);
        // Empty 상태 숨기기
        hideEmptyState();
      } else {
        showEmptyState();
      }
    }
  }
  
  /**
   * 채널 정보 추출
   */
  function extractChannels() {
    channels.clear();
    
    allVideos.forEach(video => {
      const isYoutubeApi = video.snippet !== undefined;
      
      const channelId = isYoutubeApi ? video.snippet.channelId : video.channelId;
      const channelTitle = isYoutubeApi ? video.snippet.channelTitle : video.channelTitle;
      
      if (channelId && !channels.has(channelId)) {
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
      const isYoutubeApi = video.snippet !== undefined;
      
      // 제목 검색
      const title = isYoutubeApi ? video.snippet.title.toLowerCase() : video.title.toLowerCase();
      const description = isYoutubeApi 
        ? video.snippet.description.toLowerCase() 
        : (video.description ? video.description.toLowerCase() : '');
      const matchesSearch = !searchTerm || 
                           title.includes(searchTerm) || 
                           description.includes(searchTerm);
      
      // 채널 필터링
      const videoChannelId = isYoutubeApi ? video.snippet.channelId : video.channelId;
      const matchesChannel = !selectedChannel || videoChannelId === selectedChannel;
      
      // 날짜 필터링
      const publishedAt = new Date(isYoutubeApi ? video.snippet.publishedAt : video.publishedAt);
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
      
      if (selectedDuration) {
        let durationString;
        if (isYoutubeApi && video.contentDetails?.duration) {
          durationString = video.contentDetails.duration;
        } else if (!isYoutubeApi && video.duration) {
          durationString = video.duration;
        }
        
        if (durationString) {
          const durationInSeconds = parseDuration(durationString);
          
          if (selectedDuration === 'short') {
            matchesDuration = durationInSeconds < 240; // 4분 미만
          } else if (selectedDuration === 'medium') {
            matchesDuration = durationInSeconds >= 240 && durationInSeconds <= 1200; // 4-20분
          } else if (selectedDuration === 'long') {
            matchesDuration = durationInSeconds > 1200; // 20분 초과
          }
        }
      }
      
      return matchesSearch && matchesChannel && matchesDate && matchesDuration;
    });
    
    // 정렬 적용
    applySorting();
    
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
   * 정렬 적용 함수
   */
  function applySorting() {
    const sortBy = sortFilter.value;
    
    filteredVideos.sort((a, b) => {
      const isYoutubeApiA = a.snippet !== undefined;
      const isYoutubeApiB = b.snippet !== undefined;
      
      if (sortBy === 'publishedAt') {
        // 영상 게시일 기준 (최신순)
        const dateA = new Date(isYoutubeApiA ? a.snippet.publishedAt : a.publishedAt);
        const dateB = new Date(isYoutubeApiB ? b.snippet.publishedAt : b.publishedAt);
        return dateB - dateA; // 내림차순 (최신순)
      } 
      else if (sortBy === 'publishedAtOldest') {
        // 영상 게시일 기준 (오래된순)
        const dateA = new Date(isYoutubeApiA ? a.snippet.publishedAt : a.publishedAt);
        const dateB = new Date(isYoutubeApiB ? b.snippet.publishedAt : b.publishedAt);
        return dateA - dateB; // 오름차순 (오래된순)
      }
      else if (sortBy === 'viewCount') {
        // 조회수 기준 (내림차순)
        const viewCountA = parseInt(isYoutubeApiA ? (a.statistics?.viewCount || '0') : (a.viewCount || '0'));
        const viewCountB = parseInt(isYoutubeApiB ? (b.statistics?.viewCount || '0') : (b.viewCount || '0'));
        return viewCountB - viewCountA;
      }
      else if (sortBy === 'likeCount') {
        // 좋아요 기준 (내림차순)
        const likeCountA = parseInt(isYoutubeApiA ? (a.statistics?.likeCount || '0') : (a.likeCount || '0'));
        const likeCountB = parseInt(isYoutubeApiB ? (b.statistics?.likeCount || '0') : (b.likeCount || '0'));
        return likeCountB - likeCountA;
      }
      
      // 기본값: 영상 게시일 기준
      const defaultDateA = new Date(isYoutubeApiA ? a.snippet.publishedAt : a.publishedAt);
      const defaultDateB = new Date(isYoutubeApiB ? b.snippet.publishedAt : b.publishedAt);
      return defaultDateB - defaultDateA; // 내림차순 (최신순)
    });
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
    sortFilter.value = 'publishedAt'; // 정렬 옵션도 초기화 (기본값: 영상 게시일)
    
    // 모든 비디오 표시
    filteredVideos = [...allVideos];
    applySorting(); // 정렬 적용
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
    
    // 비디오 다시 가져오기 - refresh=true 파라미터로 YouTube API에서 최신 데이터 가져오기
    await fetchLikedVideos('', true);
  }
  
  /**
   * 페이지 변경
   * @param {string} direction - 'prev' 또는 'next'
   */
  function changePage(direction) {
    if (direction === 'prev' && prevPageToken) {
      fetchLikedVideos(prevPageToken, false);
      currentPage--;
      console.log(`이전 페이지로 이동: ${currentPage}페이지, 토큰=${prevPageToken}`);
    } else if (direction === 'next' && nextPageToken) {
      fetchLikedVideos(nextPageToken, false);
      currentPage++;
      console.log(`다음 페이지로 이동: ${currentPage}페이지, 토큰=${nextPageToken}`);
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
    
    // 총 항목 수와 현재 표시 중인 범위를 계산 (있는 경우)
    const totalItems = filteredVideos.length;
    let paginationStatus = '';
    
    if (totalItems > 0) {
      const start = (currentPage - 1) * 100 + 1;
      const end = Math.min(start + filteredVideos.length - 1, totalItems);
      paginationStatus = `${formatNumber(start)}-${formatNumber(end)} / ${formatNumber(totalItems)}개 항목`;
    } else {
      paginationStatus = '항목 없음';
    }
    
    // 페이지네이션 상태 정보 업데이트
    const paginationDetails = document.getElementById('pagination-details');
    if (paginationDetails) {
      paginationDetails.textContent = paginationStatus;
    }
    
    // 페이지네이션 표시/숨김
    if (!prevPageToken && !nextPageToken && filteredVideos.length < 100) {
      document.getElementById('pagination').classList.add('hidden');
    } else {
      document.getElementById('pagination').classList.remove('hidden');
    }
  }
  
  /**
   * 숫자를 천 단위 구분 기호가 있는 문자열로 변환
   * @param {number} num - 변환할 숫자
   * @returns {string} 변환된 문자열
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
    let csv = '제목,채널,게시일,조회수,좋아요 수,영상 길이,URL\n';
    
    // 비디오 데이터 추가
    filteredVideos.forEach(video => {
      const isYoutubeApi = video.snippet !== undefined;
      
      // 데이터 형식에 따라 필드 추출
      const title = isYoutubeApi
        ? `"${video.snippet.title.replace(/"/g, '""')}"`
        : `"${video.title.replace(/"/g, '""')}"`;
      
      const channel = isYoutubeApi
        ? `"${video.snippet.channelTitle.replace(/"/g, '""')}"`
        : `"${video.channelTitle.replace(/"/g, '""')}"`;
      
      const publishedAt = formatDate(isYoutubeApi ? video.snippet.publishedAt : video.publishedAt);
      
      const viewCount = isYoutubeApi
        ? video.statistics?.viewCount || '0'
        : video.viewCount || '0';
      
      const likeCount = isYoutubeApi
        ? video.statistics?.likeCount || '0'
        : video.likeCount || '0';
      
      let duration = '';
      if ((isYoutubeApi && video.contentDetails?.duration) || (!isYoutubeApi && video.duration)) {
        duration = formatDuration(isYoutubeApi ? video.contentDetails.duration : video.duration);
      }
      
      const videoId = isYoutubeApi ? video.id : video.videoId;
      const url = createYouTubeUrl(videoId);
      
      csv += `${title},${channel},${publishedAt},${viewCount},${likeCount},${duration},${url}\n`;
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
    const data = filteredVideos.map(video => {
      const isYoutubeApi = video.snippet !== undefined;
      
      return {
        id: isYoutubeApi ? video.id : video.videoId,
        title: isYoutubeApi ? video.snippet.title : video.title,
        description: isYoutubeApi ? video.snippet.description : video.description,
        publishedAt: isYoutubeApi ? video.snippet.publishedAt : video.publishedAt,
        channelId: isYoutubeApi ? video.snippet.channelId : video.channelId,
        channelTitle: isYoutubeApi ? video.snippet.channelTitle : video.channelTitle,
        thumbnail: isYoutubeApi
          ? (video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url)
          : video.thumbnailUrl,
        duration: isYoutubeApi ? video.contentDetails?.duration : video.duration,
        viewCount: isYoutubeApi ? (video.statistics?.viewCount || '0') : (video.viewCount || '0'),
        likeCount: isYoutubeApi ? (video.statistics?.likeCount || '0') : (video.likeCount || '0'),
        url: createYouTubeUrl(isYoutubeApi ? video.id : video.videoId),
        channelUrl: createChannelUrl(isYoutubeApi ? video.snippet.channelId : video.channelId)
      };
    });
    
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
    
    // 비디오 데이터 구조 확인 (YouTube API 응답인지 DB에서 가져온 형식인지)
    // 서버에서 가져온 데이터 형식에 맞게 처리
    const isYoutubeApi = video.snippet !== undefined;
    
    // 썸네일 및 duration
    const thumbnail = document.createElement('div');
    thumbnail.className = 'video-thumbnail';
    
    const thumbnailImg = document.createElement('img');
    // 데이터 소스에 따라 다른 속성 사용
    if (isYoutubeApi) {
      thumbnailImg.src = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url;
      thumbnailImg.alt = video.snippet.title;
    } else {
      thumbnailImg.src = video.thumbnailUrl;
      thumbnailImg.alt = video.title;
    }
    thumbnail.appendChild(thumbnailImg);
    
    // 영상 길이 (있는 경우)
    if ((isYoutubeApi && video.contentDetails?.duration) || (!isYoutubeApi && video.duration)) {
      const duration = document.createElement('div');
      duration.className = 'video-duration';
      const durationText = isYoutubeApi ? video.contentDetails.duration : video.duration;
      duration.textContent = formatDuration(durationText);
      thumbnail.appendChild(duration);
    }
    
    // 비디오 정보
    const info = document.createElement('div');
    info.className = 'video-info';
    
    const title = document.createElement('div');
    title.className = 'video-title';
    title.textContent = isYoutubeApi ? video.snippet.title : video.title;
    info.appendChild(title);
    
    const channel = document.createElement('div');
    channel.className = 'video-channel';
    channel.textContent = isYoutubeApi ? video.snippet.channelTitle : video.channelTitle;
    info.appendChild(channel);
    
    const stats = document.createElement('div');
    stats.className = 'video-stats';
    
    const views = document.createElement('span');
    const viewCount = isYoutubeApi 
      ? (video.statistics?.viewCount || '0')
      : (video.viewCount || '0');
    views.textContent = `조회수 ${formatViewCount(viewCount)}회`;
    stats.appendChild(views);
    
    // 비디오 날짜 정보를 담을 div
    const datesContainer = document.createElement('div');
    datesContainer.className = 'video-dates';
    
    // 게시일
    const publishDateElem = document.createElement('div');
    publishDateElem.className = 'date-info';
    const publishDate = isYoutubeApi ? video.snippet.publishedAt : video.publishedAt;
    publishDateElem.innerHTML = `<span class="date-label">게시일:</span> ${formatDate(publishDate)}`;
    datesContainer.appendChild(publishDateElem);
    
    info.appendChild(datesContainer);
    
    info.appendChild(stats);
    
    // 클릭 이벤트로 유튜브 페이지 열기
    card.appendChild(thumbnail);
    card.appendChild(info);
    
    card.addEventListener('click', () => {
      const videoId = isYoutubeApi ? video.id : video.videoId;
      window.open(createYouTubeUrl(videoId), '_blank');
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
    // HTML 태그 지원 (주의: XSS 공격 가능성이 있으므로 신뢰할 수 있는 소스의 메시지만 사용)
    errorText.innerHTML = message;
    errorMessage.classList.remove('hidden');
    
    // 인증 관련 오류인 경우 도움말 섹션 표시
    if (message.includes('인증 오류') || 
        message.includes('로그인') || 
        message.includes('권한') || 
        message.includes('토큰') ||
        message.includes('OAuth')) {
      authErrorHelp.classList.remove('hidden');
    } else {
      authErrorHelp.classList.add('hidden');
    }
  }
  
  /**
   * 오류 메시지 숨김
   */
  function hideError() {
    errorMessage.classList.add('hidden');
    authErrorHelp.classList.add('hidden');
  }
});