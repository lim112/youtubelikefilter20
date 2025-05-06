require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const path = require('path');

// 데이터베이스 및 스토리지 가져오기
const storage = require('./storage');
const { db } = require('./db');
const schema = require('./shared/schema');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'youtube_filter_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
  store: storage.sessionStore
}));

// Passport 설정
app.use(passport.initialize());
app.use(passport.session());

// 사용자 직렬화/역직렬화
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await storage.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth 전략 설정
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "https://aaf1bf4e-db4b-4c00-a54b-6795102745aa-00-2inq0qxzvmr15.janeway.replit.dev/auth/google/callback",
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly'],
  accessType: 'offline',  // 리프레시 토큰을 받기 위해 'offline' 설정
  prompt: 'consent'       // 사용자에게 항상 동의 요청하여 리프레시 토큰 발급받기
},
async function(accessToken, refreshToken, profile, done) {
  try {
    // Google ID로 기존 사용자 확인
    let user = await storage.getUserByGoogleId(profile.id);
    
    if (user) {
      // 기존 사용자 업데이트
      user = await storage.updateUser(user.id, {
        accessToken,
        refreshToken: refreshToken || user.refreshToken, // 리프레시 토큰은 항상 전달되지 않을 수 있음
        updatedAt: new Date()
      });
    } else {
      // 새 사용자 생성
      user = await storage.createUser({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        photoUrl: profile.photos[0]?.value || '',
        accessToken,
        refreshToken,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // 사용자 기본 설정 생성
      await storage.createUserSettings(user.id, {
        defaultView: 'grid',
        videosPerPage: 50,
        theme: 'light',
        preferences: {}
      });
    }
    
    return done(null, user);
  } catch (error) {
    console.error('Auth Error:', error);
    return done(error, null);
  }
}));

// 인증 확인 미들웨어
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

// 라우트 설정
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 인증 라우트
app.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly'],
  accessType: 'offline',
  prompt: 'consent'
}));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// 사용자 정보
app.get('/api/user', (req, res) => {
  if (req.user) {
    res.json({
      isLoggedIn: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        email: req.user.email,
        photo: req.user.photo
      }
    });
  } else {
    res.json({ isLoggedIn: false });
  }
});

// 로그아웃
app.get('/api/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

// 대시보드 페이지
app.get('/dashboard', (req, res) => {
  if (req.isAuthenticated()) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.redirect('/');
  }
});

// 좋아요한 영상 가져오기
app.get('/api/liked-videos', isAuthenticated, async (req, res) => {
  try {
    // 페이지네이션 및 필터링 매개변수
    const limit = parseInt(req.query.limit) || 1000; // 대부분의 사용자가 1000개 이상의 좋아요를 누르지 않으므로 충분히 큰 값 설정
    const offset = parseInt(req.query.offset) || 0;
    const filter = {}; // 기본적으로 필터 없음
    
    // 필터 매개변수가 있는 경우에만 적용
    if (req.query.channelId) {
      filter.channelId = req.query.channelId;
    }
    
    if (req.query.title) {
      filter.title = req.query.title;
    }
    
    // 로컬 데이터베이스에서 먼저, 필터가 없으면 모든 영상 반환
    const dbVideos = await storage.getLikedVideos(req.user.id, limit, offset, filter);
    
    // API에서 새 데이터 가져오기 (새로고침 요청 또는 데이터가 없는 경우)
    if (req.query.refresh === 'true' || dbVideos.length === 0) {
      // OAuth 인증을 사용하여 YouTube API 클라이언트 생성
      const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        "https://aaf1bf4e-db4b-4c00-a54b-6795102745aa-00-2inq0qxzvmr15.janeway.replit.dev/auth/google/callback"
      );
      
      // 액세스 토큰 설정
      oauth2Client.setCredentials({
        access_token: req.user.accessToken,
        refresh_token: req.user.refreshToken
      });
      
      // 토큰 갱신이 필요한 경우 새 토큰 발급
      try {
        const isTokenExpired = oauth2Client.isTokenExpiring();
        if (isTokenExpired) {
          console.log('토큰이 만료되었습니다. 토큰을 갱신합니다...');
          const { credentials } = await oauth2Client.refreshAccessToken();
          
          // 새 액세스 토큰으로 사용자 정보 업데이트
          await storage.updateUser(req.user.id, {
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || req.user.refreshToken
          });
          
          req.user.accessToken = credentials.access_token;
          if (credentials.refresh_token) {
            req.user.refreshToken = credentials.refresh_token;
          }
          
          console.log('토큰이 성공적으로 갱신되었습니다.');
        }
      } catch (tokenError) {
        console.error('토큰 갱신 오류:', tokenError);
      }
      
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });

      const params = {
        part: 'snippet,contentDetails,statistics',
        myRating: 'like',
        maxResults: 50 // YouTube API는 한 번에 최대 50개만 지원
      };

      if (req.query.pageToken) {
        params.pageToken = req.query.pageToken;
      }

      // 첫 번째 페이지 결과 가져오기
      let response;
      try {
        response = await youtube.videos.list(params);
        console.log('YouTube API 응답 성공: 첫 번째 페이지');
      } catch (apiError) {
        console.error('YouTube API 오류:', apiError);
        
        // 인증 오류인 경우 토큰 문제일 수 있음
        if (apiError.code === 401) {
          try {
            console.log('인증 오류로 토큰을 새로 고침합니다...');
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            // 새 토큰으로 사용자 정보 업데이트
            await storage.updateUser(req.user.id, {
              accessToken: credentials.access_token,
              refreshToken: credentials.refresh_token || req.user.refreshToken
            });
            
            // 세션 업데이트
            req.user.accessToken = credentials.access_token;
            if (credentials.refresh_token) {
              req.user.refreshToken = credentials.refresh_token;
            }
            
            // 새 토큰으로 다시 시도
            oauth2Client.setCredentials({
              access_token: req.user.accessToken,
              refresh_token: req.user.refreshToken
            });
            
            // 다시 API 호출
            response = await youtube.videos.list(params);
            console.log('토큰 새로고침 후 API 호출 성공');
          } catch (refreshError) {
            console.error('토큰 새로고침 오류:', refreshError);
            
            // 새로고침 실패 시, 인증 오류가 있음을 사용자에게 알리고 기존 데이터 반환
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
              // API 요청인 경우 JSON 응답
              return res.json({
                items: dbVideos,
                pageInfo: {
                  totalResults: dbVideos.length,
                  resultsPerPage: limit
                },
                fromCache: true,
                error: '인증 오류가 발생했습니다. 다시 로그인해주세요.'
              });
            } else {
              // 일반 요청인 경우 리디렉션
              req.logout(() => {
                return res.redirect('/?auth_error=true');
              });
            }
          }
        } else {
          // 기타 API 오류
          if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            // API 요청인 경우 JSON 응답
            return res.json({
              items: dbVideos,
              pageInfo: {
                totalResults: dbVideos.length,
                resultsPerPage: limit
              },
              fromCache: true,
              error: `API 오류: ${apiError.message || '알 수 없는 오류'}`
            });
          } else {
            // 일반 요청인 경우 리디렉션 (API 오류 메시지와 함께)
            const errorMsg = encodeURIComponent(apiError.message || '알 수 없는 오류');
            return res.redirect(`/dashboard?api_error=${errorMsg}`);
          }
        }
      }
      
      let allVideos = response.data.items || [];
      let nextPageTokenValue = response.data.nextPageToken;
      
      // 첫 페이지만 먼저 로드하고, 나머지는 백그라운드에서 비동기적으로 로드
      if ((req.query.refresh === 'true' || dbVideos.length === 0) && nextPageTokenValue) {
        // 첫 페이지 데이터는 이미 로드되었으므로, 첫 페이지 데이터 저장
        const firstPageVideos = [...allVideos];
        
        // 첫 페이지 데이터를 데이터베이스에 저장
        await saveVideosToDatabase(req.user.id, firstPageVideos, storage);
        
        // 먼저 첫 페이지 데이터만 응답 준비
        const firstPageResponse = { ...response };
        firstPageResponse.data.items = firstPageVideos;
        
        // 첫 페이지 데이터로 응답 객체 업데이트
        response = firstPageResponse;
        
        // 백그라운드에서 나머지 페이지 로드 작업 시작 (비동기적으로 실행)
        loadRemainingPages(req.user.id, params, nextPageTokenValue, storage);
      }
      
      // 점진적 로딩이 아닌 경우, 모든 비디오를 한번에 저장
      if (!((req.query.refresh === 'true' || dbVideos.length === 0) && nextPageTokenValue)) {
        response.data.items = allVideos;
        // 일반적인 케이스: 모든 비디오를 데이터베이스에 저장
        await saveVideosToDatabase(req.user.id, response.data.items, storage);
      }
      
      // 저장 후 필터링된 데이터 다시 가져오기
      const updatedVideos = await storage.getLikedVideos(req.user.id, limit, offset, filter);
      
      return res.json({
        items: updatedVideos,
        pageInfo: {
          totalResults: updatedVideos.length,
          resultsPerPage: limit
        },
        fromCache: false,
        nextPageToken: response.data.nextPageToken || null,
        prevPageToken: response.data.prevPageToken || null
      });
    }
    
    // 캐시된 데이터 반환
    return res.json({
      items: dbVideos,
      pageInfo: {
        totalResults: dbVideos.length,
        resultsPerPage: limit
      },
      fromCache: true,
      nextPageToken: null,
      prevPageToken: null
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '좋아요한 영상을 가져오는데 실패했습니다', details: error.message });
  }
});

// 비디오 데이터베이스 저장 함수
async function saveVideosToDatabase(userId, videos, storage) {
  try {
    for (const video of videos) {
      await storage.saveLikedVideo(userId, {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        channelId: video.snippet.channelId,
        channelTitle: video.snippet.channelTitle,
        publishedAt: new Date(video.snippet.publishedAt),
        thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
        duration: video.contentDetails?.duration || null,
        viewCount: video.statistics?.viewCount || '0',
        likeCount: video.statistics?.likeCount || '0',
        metadata: {
          tags: video.snippet.tags || [],
          categoryId: video.snippet.categoryId,
          defaultLanguage: video.snippet.defaultLanguage,
          privacyStatus: video.status?.privacyStatus || 'public'
        }
      });
    }
    console.log(`저장 완료: ${videos.length} 개의 비디오`);
  } catch (error) {
    console.error('비디오 저장 오류:', error);
  }
}

// 백그라운드에서 남은 페이지 로드 함수
async function loadRemainingPages(userId, params, nextPageToken, storage) {
  try {
    let currentPageToken = nextPageToken;
    let pageCount = 1; // 첫 페이지는 이미 로드됨
    let totalVideos = [];
    
    // YouTube API 클라이언트 초기화
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      `${process.env.REDIRECT_URI || 'http://localhost:5000'}/auth/google/callback`
    );
    
    // 인증된 클라이언트로 YouTube API 초기화
    const user = await storage.getUserById(userId);
    oauth2Client.setCredentials({
      access_token: user.tokens.accessToken,
      refresh_token: user.tokens.refreshToken
    });
    
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });
    
    // 최대 399페이지까지 추가 데이터 로드 (첫 페이지는 이미 로드됨)
    while (currentPageToken && pageCount < 400) {
      try {
        console.log(`YouTube API 페이지 로드 중: ${pageCount + 1} 번째 페이지`);
        
        const nextPageParams = { ...params, pageToken: currentPageToken };
        const nextPageResponse = await youtube.videos.list(nextPageParams);
        
        if (nextPageResponse.data.items && nextPageResponse.data.items.length > 0) {
          // 데이터베이스에 순차적으로 저장
          await saveVideosToDatabase(userId, nextPageResponse.data.items, storage);
          
          totalVideos = [...totalVideos, ...nextPageResponse.data.items];
          currentPageToken = nextPageResponse.data.nextPageToken;
          pageCount++;
          
          // 각 페이지마다 서버 로그
          console.log(`YouTube API 응답 성공: ${pageCount} 번째 페이지, ${nextPageResponse.data.items.length} 개의 비디오`);
        } else {
          console.log('더 이상 로드할 비디오가 없습니다.');
          break;
        }
      } catch (pageError) {
        console.error(`페이지 ${pageCount + 1} 로딩 오류:`, pageError);
        // 오류가 발생해도 다음 페이지 시도
        if (pageError.response && pageError.response.status === 403) {
          console.log('API 할당량 초과. 페이지 로딩 중단.');
          break;
        }
      }
      
      // API 요청 사이에 짧은 지연 추가 (할당량 문제 방지)
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`백그라운드 로딩 완료. 총 ${pageCount} 페이지, ${totalVideos.length} 개의 비디오 추가 로드됨.`);
  } catch (error) {
    console.error('백그라운드 페이지 로딩 오류:', error);
  }
}

// 채널별 좋아요한 영상 가져오기
app.get('/api/channels', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT DISTINCT channel_id, channel_title, COUNT(*) as video_count
      FROM liked_videos
      WHERE user_id = $1
      GROUP BY channel_id, channel_title
      ORDER BY video_count DESC
    `;
    
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('채널 조회 오류:', error);
    res.status(500).json({ error: '채널 목록을 가져오는데 실패했습니다' });
  }
});

// 재생목록 관련 엔드포인트
// 사용자의 모든 재생목록 가져오기
app.get('/api/playlists', isAuthenticated, async (req, res) => {
  try {
    const playlists = await storage.getPlaylists(req.user.id);
    res.json(playlists);
  } catch (error) {
    console.error('재생목록 조회 오류:', error);
    res.status(500).json({ error: '재생목록을 가져오는데 실패했습니다' });
  }
});

// 특정 재생목록 정보 가져오기
app.get('/api/playlists/:id', isAuthenticated, async (req, res) => {
  try {
    const playlist = await storage.getPlaylistById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ error: '재생목록을 찾을 수 없습니다' });
    }
    
    if (playlist.userId !== req.user.id) {
      return res.status(403).json({ error: '이 재생목록에 접근할 권한이 없습니다' });
    }
    
    // 재생목록 내 영상 가져오기
    const videos = await storage.getPlaylistVideos(playlist.id);
    
    res.json({
      ...playlist,
      videos: videos
    });
  } catch (error) {
    console.error('재생목록 조회 오류:', error);
    res.status(500).json({ error: '재생목록을 가져오는데 실패했습니다' });
  }
});

// 새 재생목록 생성
app.post('/api/playlists', isAuthenticated, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '재생목록 이름은 필수입니다' });
    }
    
    const newPlaylist = await storage.createPlaylist({
      userId: req.user.id,
      name,
      description: description || ''
    });
    
    res.status(201).json(newPlaylist);
  } catch (error) {
    console.error('재생목록 생성 오류:', error);
    res.status(500).json({ error: '재생목록을 생성하는데 실패했습니다' });
  }
});

// 재생목록 수정
app.put('/api/playlists/:id', isAuthenticated, async (req, res) => {
  try {
    const { name, description } = req.body;
    const playlistId = req.params.id;
    
    // 재생목록 존재 및 소유권 확인
    const playlist = await storage.getPlaylistById(playlistId);
    
    if (!playlist) {
      return res.status(404).json({ error: '재생목록을 찾을 수 없습니다' });
    }
    
    if (playlist.userId !== req.user.id) {
      return res.status(403).json({ error: '이 재생목록을 수정할 권한이 없습니다' });
    }
    
    const updatedPlaylist = await storage.updatePlaylist(playlistId, {
      name: name || playlist.name,
      description: description !== undefined ? description : playlist.description
    });
    
    res.json(updatedPlaylist);
  } catch (error) {
    console.error('재생목록 수정 오류:', error);
    res.status(500).json({ error: '재생목록을 수정하는데 실패했습니다' });
  }
});

// 재생목록 삭제
app.delete('/api/playlists/:id', isAuthenticated, async (req, res) => {
  try {
    const playlistId = req.params.id;
    
    // 재생목록 존재 및 소유권 확인
    const playlist = await storage.getPlaylistById(playlistId);
    
    if (!playlist) {
      return res.status(404).json({ error: '재생목록을 찾을 수 없습니다' });
    }
    
    if (playlist.userId !== req.user.id) {
      return res.status(403).json({ error: '이 재생목록을 삭제할 권한이 없습니다' });
    }
    
    const result = await storage.deletePlaylist(playlistId);
    
    if (result) {
      res.status(200).json({ success: true, message: '재생목록이 삭제되었습니다' });
    } else {
      res.status(500).json({ error: '재생목록 삭제 중 오류가 발생했습니다' });
    }
  } catch (error) {
    console.error('재생목록 삭제 오류:', error);
    res.status(500).json({ error: '재생목록을 삭제하는데 실패했습니다' });
  }
});

// 재생목록에 영상 추가
app.post('/api/playlists/:id/videos', isAuthenticated, async (req, res) => {
  try {
    const { videoId, position } = req.body;
    const playlistId = req.params.id;
    
    if (!videoId) {
      return res.status(400).json({ error: '영상 ID는 필수입니다' });
    }
    
    // 재생목록 존재 및 소유권 확인
    const playlist = await storage.getPlaylistById(playlistId);
    
    if (!playlist) {
      return res.status(404).json({ error: '재생목록을 찾을 수 없습니다' });
    }
    
    if (playlist.userId !== req.user.id) {
      return res.status(403).json({ error: '이 재생목록에 영상을 추가할 권한이 없습니다' });
    }
    
    // 영상 존재 확인
    const video = await storage.getLikedVideoById(videoId);
    
    if (!video) {
      return res.status(404).json({ error: '영상을 찾을 수 없습니다' });
    }
    
    // 재생목록 내 현재 영상 수 확인 (기본 위치 설정용)
    const videos = await storage.getPlaylistVideos(playlistId);
    const defaultPosition = videos.length > 0 ? videos.length : 0;
    
    // 재생목록에 영상 추가
    const playlistItem = await storage.addVideoToPlaylist(
      playlistId,
      videoId,
      position !== undefined ? position : defaultPosition
    );
    
    res.status(201).json(playlistItem);
  } catch (error) {
    console.error('재생목록에 영상 추가 오류:', error);
    res.status(500).json({ error: '재생목록에 영상을 추가하는데 실패했습니다' });
  }
});

// 재생목록에서 영상 제거
app.delete('/api/playlists/:id/videos/:itemId', isAuthenticated, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const itemId = req.params.itemId;
    
    // 재생목록 존재 및 소유권 확인
    const playlist = await storage.getPlaylistById(playlistId);
    
    if (!playlist) {
      return res.status(404).json({ error: '재생목록을 찾을 수 없습니다' });
    }
    
    if (playlist.userId !== req.user.id) {
      return res.status(403).json({ error: '이 재생목록에서 영상을 제거할 권한이 없습니다' });
    }
    
    const result = await storage.removeVideoFromPlaylist(itemId);
    
    if (result) {
      res.status(200).json({ success: true, message: '영상이 재생목록에서 제거되었습니다' });
    } else {
      res.status(500).json({ error: '영상 제거 중 오류가 발생했습니다' });
    }
  } catch (error) {
    console.error('재생목록에서 영상 제거 오류:', error);
    res.status(500).json({ error: '재생목록에서 영상을 제거하는데 실패했습니다' });
  }
});

// 사용자 설정 관련 엔드포인트
// 사용자 설정 가져오기
app.get('/api/settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await storage.getUserSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    console.error('사용자 설정 조회 오류:', error);
    res.status(500).json({ error: '사용자 설정을 가져오는데 실패했습니다' });
  }
});

// 사용자 설정 업데이트
app.put('/api/settings', isAuthenticated, async (req, res) => {
  try {
    const { defaultView, videosPerPage, theme, preferences } = req.body;
    
    const updatedSettings = await storage.updateUserSettings(req.user.id, {
      defaultView,
      videosPerPage,
      theme,
      preferences
    });
    
    res.json(updatedSettings);
  } catch (error) {
    console.error('사용자 설정 업데이트 오류:', error);
    res.status(500).json({ error: '사용자 설정을 업데이트하는데 실패했습니다' });
  }
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 http://0.0.0.0:${PORT} 에서 실행 중입니다.`);
  console.log(`Replit 환경에서 접속 가능한 주소: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
});