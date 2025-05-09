const express = require('express');
const serverless = require('serverless-http');
const session = require('express-session');
const { google } = require('googleapis');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const connectPg = require('connect-pg-simple');
const { db, pool } = require('../../db');

// 세션 암호화 키 생성 (환경 변수에서 가져오거나 임의로 생성)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');

// Express 앱 생성
const app = express();
app.use(express.json());
app.use(cookieParser());

// 세션 설정
const PostgresStore = connectPg(session);
const sessionConfig = {
  store: new PostgresStore({
    pool: pool,
    createTableIfMissing: true
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
};

app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth 설정
const GOOGLE_CLIENT_ID = process.env.CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.CLIENT_SECRET;
const CALLBACK_URL = process.env.NODE_ENV === 'production'
  ? `${process.env.URL}/.netlify/functions/api/auth/google/callback`
  : 'http://localhost:8888/.netlify/functions/api/auth/google/callback';

// 인증 확인 미들웨어
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

// Passport 인증 설정
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: CALLBACK_URL,
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { db } = require('../../db');
    const { users } = require('../../shared/schema');
    const { eq } = require('drizzle-orm');

    // 사용자가 이미 존재하는지 확인
    const [existingUser] = await db.select().from(users).where(eq(users.googleId, profile.id));

    if (existingUser) {
      // 사용자가 존재하면 토큰 업데이트
      const [updatedUser] = await db
        .update(users)
        .set({
          accessToken,
          refreshToken: refreshToken || existingUser.refreshToken,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      return done(null, updatedUser);
    } else {
      // 새 사용자 생성
      const [newUser] = await db
        .insert(users)
        .values({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          accessToken,
          refreshToken,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return done(null, newUser);
    }
  } catch (error) {
    console.error('인증 오류:', error);
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { db } = require('../../db');
    const { users } = require('../../shared/schema');
    const { eq } = require('drizzle-orm');

    const [user] = await db.select().from(users).where(eq(users.id, id));
    done(null, user || null);
  } catch (error) {
    console.error('사용자 복원 오류:', error);
    done(error);
  }
});

// 인증 라우트
app.get('/auth/google', passport.authenticate('google'));

app.get('/auth/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/', 
    session: true 
  }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.get('/auth/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: '로그아웃 오류' });
    }
    res.redirect('/');
  });
});

// YouTube API 라우트
app.get('/videos', isAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const loadThumbnails = req.query.loadThumbnails !== 'false';
    
    // 스토리지에서 비디오 가져오기
    const { Storage } = require('../../storage');
    const storage = new Storage();
    
    const filter = {
      channelId: req.query.channelId || '',
      search: req.query.search || '',
      date: req.query.date || '',
      duration: req.query.duration || '',
      sort: req.query.sort || 'publishedAt'
    };
    
    const videos = await storage.getLikedVideos(req.user.id, limit, offset, filter, loadThumbnails);
    const totalCount = await storage.countLikedVideos(req.user.id, filter);
    
    res.json({
      videos,
      page,
      limit,
      offset,
      total: totalCount,
      hasMore: offset + videos.length < totalCount
    });
  } catch (error) {
    console.error('비디오 조회 오류:', error);
    res.status(500).json({ error: '비디오를 가져오는 중 오류가 발생했습니다.' });
  }
});

app.get('/metadata', isAuthenticated, async (req, res) => {
  try {
    const { Storage } = require('../../storage');
    const storage = new Storage();
    
    const metadata = await storage.getVideoMetadata(req.user.id);
    res.json(metadata);
  } catch (error) {
    console.error('메타데이터 조회 오류:', error);
    res.status(500).json({ error: '메타데이터를 가져오는 중 오류가 발생했습니다.' });
  }
});

app.get('/refresh', isAuthenticated, async (req, res) => {
  try {
    const pageToken = req.query.pageToken || '';
    const loadAll = req.query.loadAll === 'true';
    
    // YouTube API 초기화
    const youtube = google.youtube({
      version: 'v3',
      auth: req.user.accessToken
    });
    
    const params = {
      part: 'snippet,contentDetails,statistics',
      myRating: 'like',
      maxResults: 50
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    const response = await youtube.videos.list(params);
    
    // 비디오 저장
    const { Storage } = require('../../storage');
    const storage = new Storage();
    
    const videos = response.data.items || [];
    
    // 비디오 변환 및 저장
    const savedVideos = [];
    for (const video of videos) {
      const videoData = {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        publishedAt: video.snippet.publishedAt,
        channelId: video.snippet.channelId,
        channelTitle: video.snippet.channelTitle,
        thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        duration: video.contentDetails?.duration || '',
        viewCount: video.statistics?.viewCount || '0',
        likeCount: video.statistics?.likeCount || '0',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const savedVideo = await storage.saveLikedVideo(req.user.id, videoData);
      if (savedVideo) {
        savedVideos.push(savedVideo);
      }
    }
    
    console.log(`저장 완료: ${savedVideos.length} 개의 비디오`);
    
    if (loadAll && response.data.nextPageToken) {
      // 다음 페이지 로드 전 결과 반환하고 백그라운드에서 계속 로드
      res.json({
        videos: savedVideos,
        nextPageToken: response.data.nextPageToken,
        loadingMore: true
      });
      
      // 백그라운드에서 나머지 페이지 로드
      loadRemainingPages(req.user.id, params, response.data.nextPageToken, storage);
    } else {
      res.json({
        videos: savedVideos,
        nextPageToken: response.data.nextPageToken,
        loadingMore: false
      });
    }
  } catch (error) {
    console.error('YouTube API 오류:', error);
    res.status(500).json({ error: '데이터를 새로고침하는 중 오류가 발생했습니다.' });
  }
});

// 백그라운드에서 남은 페이지 로드
async function loadRemainingPages(userId, params, nextPageToken, storage) {
  try {
    let currentPageToken = nextPageToken;
    let pageCount = 2; // 첫 페이지는 이미 로드했으므로 2부터 시작
    
    while (currentPageToken && pageCount <= 400) { // 최대 20,000개 비디오 (50개 * 400페이지)
      console.log(`YouTube API 페이지 로드 중: ${pageCount} 번째 페이지`);
      
      const { google } = require('googleapis');
      
      // 사용자 정보 가져오기
      const { Storage } = require('../../storage');
      const storageInstance = new Storage();
      const user = await storageInstance.getUserById(userId);
      
      if (!user) {
        console.error('사용자를 찾을 수 없음');
        break;
      }
      
      // YouTube API 초기화
      const youtube = google.youtube({
        version: 'v3',
        auth: user.accessToken
      });
      
      // 다음 페이지 요청
      params.pageToken = currentPageToken;
      const response = await youtube.videos.list(params);
      
      const videos = response.data.items || [];
      
      // 비디오 변환 및 저장
      const savedVideos = [];
      for (const video of videos) {
        const videoData = {
          videoId: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          publishedAt: video.snippet.publishedAt,
          channelId: video.snippet.channelId,
          channelTitle: video.snippet.channelTitle,
          thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
          duration: video.contentDetails?.duration || '',
          viewCount: video.statistics?.viewCount || '0',
          likeCount: video.statistics?.likeCount || '0',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const savedVideo = await storage.saveLikedVideo(userId, videoData);
        if (savedVideo) {
          savedVideos.push(savedVideo);
        }
      }
      
      console.log(`YouTube API 응답 성공: ${pageCount} 번째 페이지, ${savedVideos.length} 개의 비디오`);
      
      // 다음 페이지 토큰 업데이트
      currentPageToken = response.data.nextPageToken;
      pageCount++;
      
      // API 속도 제한 방지를 위한 지연
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('모든 페이지 로드 완료');
  } catch (error) {
    console.error('백그라운드 데이터 로드 오류:', error);
  }
}

// 기타 필요한 API 라우트를 여기에 추가

// 404 처리
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 오류 처리
app.use((err, req, res, next) => {
  console.error('API 오류:', err);
  res.status(500).json({ error: '서버에서 오류가 발생했습니다.' });
});

// 서버리스 함수로 래핑
module.exports.handler = serverless(app);