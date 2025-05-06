// 유틸리티 함수들

/**
 * 날짜 포맷 함수
 * @param {string} dateString - ISO 형식의 날짜 문자열
 * @returns {string} 포맷된 날짜 문자열 (예: 2025년 5월 6일)
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
  count = Number(count);
  if (isNaN(count)) return '0';
  
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + '천';
  if (count < 100000) return (count / 10000).toFixed(1) + '만';
  if (count < 100000000) return Math.floor(count / 10000) + '만';
  return (count / 100000000).toFixed(1) + '억';
}

/**
 * ISO 8601 기간 포맷 함수
 * @param {string} isoDuration - ISO 8601 기간 형식 (예: PT1H30M15S)
 * @returns {string} 포맷된 기간 (예: 1:30:15)
 */
function formatDuration(isoDuration) {
  if (!isoDuration) return '';
  
  // PT1H30M15S 같은 형식 파싱
  let hours = 0, minutes = 0, seconds = 0;
  
  const hoursMatch = isoDuration.match(/(\d+)H/);
  const minutesMatch = isoDuration.match(/(\d+)M/);
  const secondsMatch = isoDuration.match(/(\d+)S/);
  
  if (hoursMatch) hours = parseInt(hoursMatch[1]);
  if (minutesMatch) minutes = parseInt(minutesMatch[1]);
  if (secondsMatch) seconds = parseInt(secondsMatch[1]);
  
  // 시간 포맷팅
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  return text.slice(0, maxLength) + '...';
}

/**
 * HTML 이스케이프 함수
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHTML(text) {
  if (!text) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 지연 시간 (밀리초)
 * @returns {Function} 디바운스된 함수
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
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
  
  // youtube.com/watch?v=VIDEO_ID 형식
  const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  
  // youtu.be/VIDEO_ID 형식
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  
  // youtube.com/embed/VIDEO_ID 형식
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];
  
  return null;
}

/**
 * 비디오 ID로 유튜브 URL 생성
 * @param {string} videoId - 유튜브 비디오 ID
 * @returns {string} 유튜브 비디오 URL
 */
function createYouTubeUrl(videoId) {
  if (!videoId) return '';
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * 채널 ID로 유튜브 채널 URL 생성
 * @param {string} channelId - 유튜브 채널 ID
 * @returns {string} 유튜브 채널 URL
 */
function createChannelUrl(channelId) {
  if (!channelId) return '';
  return `https://www.youtube.com/channel/${channelId}`;
}