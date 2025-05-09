document.addEventListener('DOMContentLoaded', async function() {
  // 로그인 상태 확인
  try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    
    if (data.authenticated) {
      // 이미 로그인되어 있으면 대시보드로 리디렉션
      window.location.href = '/dashboard';
    }
  } catch (error) {
    console.error('로그인 상태 확인 중 오류 발생:', error);
  }
  
  // URL 파라미터 확인하여 오류 메시지 표시
  function checkAuthError() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
      const errorContainer = document.createElement('div');
      errorContainer.className = 'error-message';
      errorContainer.textContent = '인증 오류가 발생했습니다. 다시 시도해주세요.';
      
      const authCard = document.querySelector('.auth-card');
      if (authCard) {
        authCard.insertBefore(errorContainer, authCard.querySelector('.login-button'));
      }
    }
  }
  
  checkAuthError();
});