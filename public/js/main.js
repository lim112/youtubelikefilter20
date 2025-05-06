// 기본 웹사이트 동작을 위한 스크립트

document.addEventListener('DOMContentLoaded', function() {
  // 스크롤 시 헤더에 그림자 효과
  const header = document.querySelector('header');
  window.addEventListener('scroll', function() {
    if (window.scrollY > 10) {
      header.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.1)';
    } else {
      header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    }
  });

  // 네비게이션 링크에 스무스 스크롤 적용
  document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 70,
          behavior: 'smooth'
        });
      }
    });
  });

  // 로그인 상태 확인
  checkLoginStatus();
});

// 로그인 상태 확인 함수
async function checkLoginStatus() {
  try {
    const response = await fetch('/api/user');
    const data = await response.json();
    
    // 이미 로그인되어 있으면 대시보드로 리디렉션
    if (data.isLoggedIn) {
      window.location.href = '/dashboard';
    }
  } catch (error) {
    console.error('로그인 상태 확인 중 오류 발생:', error);
  }
}