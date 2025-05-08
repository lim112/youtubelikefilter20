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

// 비디오 API 라우트
app.get('/videos', isAuthenticated, async (req, res) => {
  try {
    // 페이지네이션 및 필터링 매개변수
    const pageSize = 100; // 한 페이지당 100개 항목
    let offset = 0;
    let limit = pageSize;
    
    // 페이지 토큰이 있으면 해당 값을 offset으로 사용
    if (req.query.pageToken) {
      const tokenValue = req.query.pageToken;
      if (tokenValue && !isNaN(parseInt(tokenValue))) {
        offset = parseInt(tokenValue);
        console.log(`페이지 토큰으로 offset 설정: ${offset}`);
      }
    }
    
    // 필터링 매개변수
    const filter = {}; // 기본적으로 필터 없음
    
    // 요청 로그 출력
    console.log(`DB 조회 요청: page=${Math.floor(offset/pageSize) + 1}, offset=${offset}, limit=${limit}`);
    
    // 필터 매개변수가 있는 경우에만 적용
    if (req.query.channel) {
      filter.channelId = req.query.channel;
    }
    
    if (req.query.search) {
      filter.search = req.query.search;
    }
    
    if (req.query.date) {
      filter.date = req.query.date;
    }
    
    if (req.query.duration) {
      filter.duration = req.query.duration;
    }
    
    if (req.query.sort) {
      filter.sort = req.query.sort;
    }
    
    // 썸네일 이미지 로드 여부 (기본: true)
    // 메타데이터만 먼저 로드하려면 loadThumbnails=false 파라미터 사용
    const loadThumbnails = req.query.loadThumbnails !== 'false';
    
    // 스토리지 객체 가져오기
    const { Storage } = require('../../storage');
    const storage = new Storage();
    
    // 로컬 데이터베이스에서 먼저, 필터가 없으면 모든 영상 반환
    const dbVideos = await storage.getLikedVideos(req.user.id, limit, offset, filter, loadThumbnails);
    
    // API에서 새 데이터 가져오기 (새로고침 요청 또는 데이터가 없는 경우)
    if (req.query.refresh === 'true' || dbVideos.length === 0) {
      // OAuth 인증을 사용하여 YouTube API 클라이언트 생성
      const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.NODE_ENV === 'production'
          ? `${process.env.URL}/.netlify/functions/api/auth/google/callback`
          : 'http://localhost:8888/.netlify/functions/api/auth/google/callback'
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
        maxResults: 100 // 페이지당 100개 항목으로 설정
      };

      // API 새로고침 요청이면 YouTube API의 pageToken을 사용
      // 그 외의 경우(DB 조회)에는 사용하지 않음
      if (req.query.pageToken && req.query.refresh === 'true') {
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
            
            return res.json({
              items: dbVideos,
              pageInfo: {
                totalResults: dbVideos.length,
                resultsPerPage: limit
              },
              fromCache: true,
              error: '인증 오류가 발생했습니다. 다시 로그인해주세요.'
            });
          }
        } else {
          // 기타 API 오류
          try {
            // 전체 비디오 개수 가져오기
            const totalCount = await storage.countLikedVideos(req.user.id, filter);
            
            // 다음 페이지 토큰 (offset 기반)
            const nextPageOffset = offset + limit < totalCount ? offset + limit : null;
            
            // 이전 페이지 토큰 (offset 기반)
            const prevPageOffset = offset - limit >= 0 ? offset - limit : null;
            
            return res.json({
              items: dbVideos,
              pageInfo: {
                totalResults: totalCount,
                resultsPerPage: limit,
                currentOffset: offset
              },
              fromCache: true,
              nextPageToken: nextPageOffset !== null ? nextPageOffset.toString() : null,
              prevPageToken: prevPageOffset !== null ? prevPageOffset.toString() : null,
              error: `API 오류: ${apiError.message || '알 수 없는 오류'}`
            });
          } catch (countError) {
            console.error('카운트 조회 오류:', countError);
            
            // 카운트 조회 오류 시 기본 응답
            return res.json({
              items: dbVideos,
              pageInfo: {
                totalResults: dbVideos.length,
                resultsPerPage: limit,
                currentOffset: offset
              },
              fromCache: true,
              error: `API 오류: ${apiError.message || '알 수 없는 오류'}`
            });
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
      const updatedVideos = await storage.getLikedVideos(req.user.id, limit, offset, filter, loadThumbnails);
      
      // 전체 비디오 개수 구하기
      const totalCount = await storage.countLikedVideos(req.user.id, filter);
      
      // 다음 페이지 토큰 (offset 기반)
      const nextPageOffset = offset + pageSize < totalCount ? offset + pageSize : null;
      
      // 이전 페이지 토큰 (offset 기반)
      const prevPageOffset = offset - pageSize >= 0 ? offset - pageSize : null;
      
      return res.json({
        items: updatedVideos,
        pageInfo: {
          totalResults: totalCount,
          resultsPerPage: pageSize,
          currentOffset: offset
        },
        fromCache: false,
        nextPageToken: nextPageOffset !== null ? nextPageOffset.toString() : null,
        prevPageToken: prevPageOffset !== null ? prevPageOffset.toString() : null
      });
    }
    
    // 전체 비디오 개수 가져오기
    const totalCount = await storage.countLikedVideos(req.user.id, filter);
    
    // 다음 페이지 토큰 (offset 기반)
    const nextPageOffset = offset + pageSize < totalCount ? offset + pageSize : null;
    
    // 이전 페이지 토큰 (offset 기반)
    const prevPageOffset = offset - pageSize >= 0 ? offset - pageSize : null;
    
    // 캐시된 데이터 반환
    return res.json({
      items: dbVideos,
      pageInfo: {
        totalResults: totalCount,
        resultsPerPage: pageSize,
        currentOffset: offset
      },
      fromCache: true,
      nextPageToken: nextPageOffset !== null ? nextPageOffset.toString() : null,
      prevPageToken: prevPageOffset !== null ? prevPageOffset.toString() : null
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '좋아요한 영상을 가져오는데 실패했습니다', details: error.message });
  }
});

// 비디오 메타데이터 API (채널, 게시일, 영상 길이 정보만 가져옴)
app.get('/metadata', isAuthenticated, async (req, res) => {
  try {
    console.log('메타데이터 API 호출됨');
    const { Storage } = require('../../storage');
    const storage = new Storage();
    const metadata = await storage.getVideoMetadata(req.user.id);
    
    return res.json({
      metadata,
      success: true
    });
  } catch (error) {
    console.error('메타데이터 API 오류:', error);
    res.status(500).json({ 
      error: '메타데이터를 가져오는데 실패했습니다', 
      details: error.message 
    });
  }
});

// 데이터 새로고침 API
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
      
      // 사용자 정보 가져오기
      const user = await storage.getUserById(userId);
      
      if (!user) {
        console.error('사용자를 찾을 수 없음');
        break;
      }
      
      // YouTube API 초기화
      const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.NODE_ENV === 'production'
          ? `${process.env.URL}/.netlify/functions/api/auth/google/callback`
          : 'http://localhost:8888/.netlify/functions/api/auth/google/callback'
      );
      
      // 액세스 토큰 설정
      oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken
      });
      
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
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
    
    console.log('백그라운드 로딩 완료. 총 ' + (pageCount - 1) + ' 페이지, ' + (pageCount - 1) * 50 + ' 개의 비디오 추가 로드됨.');
  } catch (error) {
    console.error('백그라운드 데이터 로드 오류:', error);
  }
}

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