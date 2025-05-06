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
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
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
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
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
    const limit = parseInt(req.query.limit) || 50;
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
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: req.user.accessToken
      });
      
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });

      const params = {
        part: 'snippet,contentDetails,statistics',
        myRating: 'like',
        maxResults: 50
      };

      if (req.query.pageToken) {
        params.pageToken = req.query.pageToken;
      }

      // 첫 번째 페이지 결과 가져오기
      const response = await youtube.videos.list(params);
      let allVideos = response.data.items;
      let nextPageTokenValue = response.data.nextPageToken;
      
      // 최대 40페이지까지 추가 데이터 가져오기 (refresh=true인 경우에만)
      if (req.query.refresh === 'true' && nextPageTokenValue) {
        try {
          for (let i = 0; i < 39; i++) {  // 최대 39페이지 추가 (첫 페이지 포함 총 40페이지, 약 2000개 영상)
            if (!nextPageTokenValue) break;
            
            const nextPageParams = { ...params, pageToken: nextPageTokenValue };
            const nextPageResponse = await youtube.videos.list(nextPageParams);
            
            // 진행 상황 로깅
            console.log(`페이지 ${i+2}/${40} 로드 중... 현재 ${allVideos.length}개 영상`);
            
            if (nextPageResponse.data.items && nextPageResponse.data.items.length > 0) {
              allVideos = [...allVideos, ...nextPageResponse.data.items];
              nextPageTokenValue = nextPageResponse.data.nextPageToken;
            } else {
              break;
            }
            
            // API 호출 제한을 방지하기 위한 짧은 지연
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          console.log(`총 ${allVideos.length}개 영상 로드 완료`);
        } catch (pageError) {
          console.error('추가 페이지 로딩 오류:', pageError);
          // 오류가 발생해도 이미 로드된 데이터는 계속 사용
        }
      }
      
      // 응답 객체 업데이트
      response.data.items = allVideos;
      
      // 데이터베이스에 저장
      const apiVideos = response.data.items;
      for (let i = 0; i < apiVideos.length; i++) {
        const video = apiVideos[i];
        await storage.saveLikedVideo(req.user.id, {
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
        }, i);
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