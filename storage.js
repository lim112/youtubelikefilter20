const { db, pool } = require('./db');
const { users, likedVideos, playlists, playlistVideos, userSettings } = require('./shared/schema');
const { eq, desc, asc, and, or, like, sql } = require('drizzle-orm');
const connectPg = require('connect-pg-simple');

// 스토리지 인터페이스 - 데이터 관리를 위한 일관된 메서드 제공
class Storage {
  constructor() {
    // Express 세션을 PostgreSQL에 저장하기 위한 스토어
    this.sessionStore = null;
    this.setupSessionStore();
  }

  setupSessionStore() {
    const session = require('express-session');
    const PostgresStore = connectPg(session);
    
    this.sessionStore = new PostgresStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true
    });
  }

  // 사용자 관련 메서드
  async getUserById(id) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('사용자 조회 오류:', error);
      throw error;
    }
  }

  async getUserByGoogleId(googleId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
      return user;
    } catch (error) {
      console.error('사용자 조회 오류:', error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      // 사용자 생성
      const [user] = await db.insert(users).values(userData).returning();
      
      // 기본 설정 생성
      await this.createUserSettings(user.id, {
        theme: 'light',
        itemsPerPage: 100,
        defaultView: 'grid'
      });
      
      return user;
    } catch (error) {
      console.error('사용자 생성 오류:', error);
      throw error;
    }
  }

  async updateUser(id, userData) {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error('사용자 업데이트 오류:', error);
      throw error;
    }
  }

  // 좋아요 영상 관련 메서드
  async getLikedVideos(userId, limit = 100, offset = 0, filter = {}, loadThumbnails = true) {
    try {
      // 기본 정렬 설정 (기본값: 게시일 내림차순)
      let orderByClause = desc(likedVideos.publishedAt);
      
      // 정렬 설정이 있으면 적용
      if (filter.sort) {
        if (filter.sort === 'publishedAt') {
          orderByClause = desc(likedVideos.publishedAt); // 최신순
        } else if (filter.sort === 'publishedAtOldest') {
          orderByClause = asc(likedVideos.publishedAt); // 오래된순
        } else if (filter.sort === 'viewCount') {
          orderByClause = desc(likedVideos.viewCount); // 조회수 내림차순
        } else if (filter.sort === 'likeCount') {
          orderByClause = desc(likedVideos.likeCount); // 좋아요 내림차순
        }
      }
      
      let query;
      
      if (loadThumbnails) {
        // 썸네일 포함 전체 데이터 로드
        query = db.select().from(likedVideos);
      } else {
        // 메타데이터만 로드 (썸네일 URL 제외)
        query = db.select({
          id: likedVideos.id,
          userId: likedVideos.userId,
          videoId: likedVideos.videoId,
          title: likedVideos.title,
          channelId: likedVideos.channelId,
          channelTitle: likedVideos.channelTitle,
          publishedAt: likedVideos.publishedAt,
          duration: likedVideos.duration,
          viewCount: likedVideos.viewCount,
          likeCount: likedVideos.likeCount,
          createdAt: likedVideos.createdAt,
          updatedAt: likedVideos.updatedAt,
          metadata: likedVideos.metadata
        }).from(likedVideos);
      }
      
      // 공통 쿼리 조건 추가
      query = query.where(eq(likedVideos.userId, userId));
      
      if (filter.channelId) {
        query = query.where(eq(likedVideos.channelId, filter.channelId));
      }
      
      // 검색어 필터 적용 (제목에만 포함, 대소문자 구분 없음)
      if (filter.search) {
        query = query.where(
          like(sql`LOWER(${likedVideos.title})`, `%${filter.search.toLowerCase()}%`)
        );
      }
      
      // 날짜 필터 적용
      if (filter.date) {
        const now = new Date();
        let dateLimit;
        
        if (filter.date === 'day') {
          dateLimit = new Date(now.setDate(now.getDate() - 1));
        } else if (filter.date === 'week') {
          dateLimit = new Date(now.setDate(now.getDate() - 7));
        } else if (filter.date === 'month') {
          dateLimit = new Date(now.setMonth(now.getMonth() - 1));
        } else if (filter.date === 'year') {
          dateLimit = new Date(now.setFullYear(now.getFullYear() - 1));
        }
        
        if (dateLimit) {
          query = query.where(sql`${likedVideos.publishedAt} >= ${dateLimit}`);
        }
      }
      
      // 기간 필터 적용
      if (filter.duration) {
        let durationSeconds;
        
        if (filter.duration === 'short') {
          // 4분 미만
          durationSeconds = 4 * 60;
          query = query.where(sql`${likedVideos.duration} < ${durationSeconds}`);
        } else if (filter.duration === 'medium') {
          // 4분 이상 20분 미만
          const minSeconds = 4 * 60;
          const maxSeconds = 20 * 60;
          query = query.where(
            and(
              sql`${likedVideos.duration} >= ${minSeconds}`,
              sql`${likedVideos.duration} < ${maxSeconds}`
            )
          );
        } else if (filter.duration === 'long') {
          // 20분 이상
          durationSeconds = 20 * 60;
          query = query.where(sql`${likedVideos.duration} >= ${durationSeconds}`);
        }
      }
      
      // 정렬 적용
      query = query.orderBy(orderByClause);
      
      // 페이지네이션 적용
      const videos = await query.limit(limit).offset(offset);
      
      // 총 비디오 수 조회
      const total = await this.countLikedVideos(userId, filter);
      
      return {
        videos,
        total,
        limit,
        offset
      };
    } catch (error) {
      console.error('좋아요 영상 조회 오류:', error);
      throw error;
    }
  }

  async getVideoMetadata(userId) {
    try {
      // 메타데이터만 필요한 정보 추출 (썸네일 제외)
      const query = db.select({
        channelId: likedVideos.channelId,
        channelTitle: likedVideos.channelTitle,
        title: likedVideos.title,
        publishedAt: likedVideos.publishedAt,
        duration: likedVideos.duration,
        videoId: likedVideos.videoId
      }).from(likedVideos);
      
      // 사용자 ID로 필터링
      query.where(eq(likedVideos.userId, userId));
      
      // 중복 채널 제거를 위한 Set
      const channelsMap = new Map();
      const videos = [];
      
      // 결과 처리
      const results = await query;
      
      results.forEach(video => {
        // 비디오 정보 저장
        videos.push({
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          title: video.title,
          publishedAt: video.publishedAt,
          duration: video.duration,
          videoId: video.videoId
        });
        
        // 채널 정보 저장 (중복 제거)
        if (video.channelId && !channelsMap.has(video.channelId)) {
          channelsMap.set(video.channelId, {
            id: video.channelId,
            title: video.channelTitle,
            videoCount: 1
          });
        } else if (video.channelId) {
          // 채널이 이미 있으면 비디오 개수 증가
          const channel = channelsMap.get(video.channelId);
          channel.videoCount++;
          channelsMap.set(video.channelId, channel);
        }
      });
      
      return {
        channels: Array.from(channelsMap.values()),
        videos,
        totalVideos: videos.length
      };
    } catch (error) {
      console.error('메타데이터 조회 오류:', error);
      throw error;
    }
  }

  async countLikedVideos(userId, filter = {}) {
    try {
      let query = db.select({ count: sql`count(*)` }).from(likedVideos);
      
      // 기본 필터: 사용자 ID
      query = query.where(eq(likedVideos.userId, userId));
      
      // 채널 필터 적용
      if (filter.channelId) {
        query = query.where(eq(likedVideos.channelId, filter.channelId));
      }
      
      // 검색어 필터 적용 (제목에만 포함, 대소문자 구분 없음)
      if (filter.search) {
        query = query.where(
          like(sql`LOWER(${likedVideos.title})`, `%${filter.search.toLowerCase()}%`)
        );
      }
      
      // 날짜 필터 적용
      if (filter.date) {
        const now = new Date();
        let dateLimit;
        
        if (filter.date === 'day') {
          dateLimit = new Date(now.setDate(now.getDate() - 1));
        } else if (filter.date === 'week') {
          dateLimit = new Date(now.setDate(now.getDate() - 7));
        } else if (filter.date === 'month') {
          dateLimit = new Date(now.setMonth(now.getMonth() - 1));
        } else if (filter.date === 'year') {
          dateLimit = new Date(now.setFullYear(now.getFullYear() - 1));
        }
        
        if (dateLimit) {
          query = query.where(sql`${likedVideos.publishedAt} >= ${dateLimit}`);
        }
      }
      
      // 기간 필터 적용
      if (filter.duration) {
        let durationSeconds;
        
        if (filter.duration === 'short') {
          // 4분 미만
          durationSeconds = 4 * 60;
          query = query.where(sql`${likedVideos.duration} < ${durationSeconds}`);
        } else if (filter.duration === 'medium') {
          // 4분 이상 20분 미만
          const minSeconds = 4 * 60;
          const maxSeconds = 20 * 60;
          query = query.where(
            and(
              sql`${likedVideos.duration} >= ${minSeconds}`,
              sql`${likedVideos.duration} < ${maxSeconds}`
            )
          );
        } else if (filter.duration === 'long') {
          // 20분 이상
          durationSeconds = 20 * 60;
          query = query.where(sql`${likedVideos.duration} >= ${durationSeconds}`);
        }
      }
      
      const result = await query;
      return parseInt(result[0].count || '0', 10);
    } catch (error) {
      console.error('영상 개수 조회 오류:', error);
      throw error;
    }
  }

  async getLikedVideoById(id) {
    try {
      const [video] = await db.select().from(likedVideos).where(eq(likedVideos.id, id));
      return video;
    } catch (error) {
      console.error('좋아요 영상 조회 오류:', error);
      throw error;
    }
  }

  async getLikedVideoByVideoId(userId, videoId) {
    try {
      const [video] = await db.select().from(likedVideos)
        .where(
          and(
            eq(likedVideos.userId, userId),
            eq(likedVideos.videoId, videoId)
          )
        );
      return video;
    } catch (error) {
      console.error('좋아요 영상 조회 오류:', error);
      throw error;
    }
  }

  async saveLikedVideo(userId, videoData) {
    try {
      // 이미 있는지 확인
      const existing = await this.getLikedVideoByVideoId(userId, videoData.videoId);
      
      if (existing) {
        // 이미 있으면 업데이트
        const [updatedVideo] = await db
          .update(likedVideos)
          .set({
            title: videoData.title,
            description: videoData.description,
            thumbnail: videoData.thumbnail,
            channelTitle: videoData.channelTitle,
            publishedAt: videoData.publishedAt,
            duration: videoData.duration,
            viewCount: videoData.viewCount,
            likeCount: videoData.likeCount,
            updatedAt: new Date(),
            metadata: videoData.metadata
          })
          .where(eq(likedVideos.id, existing.id))
          .returning();
        return updatedVideo;
      } else {
        // 없으면 새로 추가
        const [newVideo] = await db
          .insert(likedVideos)
          .values({
            userId,
            videoId: videoData.videoId,
            title: videoData.title,
            description: videoData.description,
            thumbnail: videoData.thumbnail,
            channelId: videoData.channelId,
            channelTitle: videoData.channelTitle,
            publishedAt: videoData.publishedAt,
            duration: videoData.duration,
            viewCount: videoData.viewCount,
            likeCount: videoData.likeCount,
            metadata: videoData.metadata
          })
          .returning();
        return newVideo;
      }
    } catch (error) {
      console.error('좋아요 영상 저장 오류:', error);
      throw error;
    }
  }

  async deleteLikedVideo(id) {
    try {
      await db.delete(likedVideos).where(eq(likedVideos.id, id));
      return true;
    } catch (error) {
      console.error('좋아요 영상 삭제 오류:', error);
      throw error;
    }
  }

  // 재생목록 관련 메서드
  async getPlaylists(userId) {
    try {
      const userPlaylists = await db.select().from(playlists).where(eq(playlists.userId, userId));
      return userPlaylists;
    } catch (error) {
      console.error('재생목록 조회 오류:', error);
      throw error;
    }
  }

  async getPlaylistById(id) {
    try {
      const [playlist] = await db.select().from(playlists).where(eq(playlists.id, id));
      return playlist;
    } catch (error) {
      console.error('재생목록 조회 오류:', error);
      throw error;
    }
  }

  async createPlaylist(playlistData) {
    try {
      const [playlist] = await db.insert(playlists).values(playlistData).returning();
      return playlist;
    } catch (error) {
      console.error('재생목록 생성 오류:', error);
      throw error;
    }
  }

  async updatePlaylist(id, playlistData) {
    try {
      const [updatedPlaylist] = await db
        .update(playlists)
        .set(playlistData)
        .where(eq(playlists.id, id))
        .returning();
      return updatedPlaylist;
    } catch (error) {
      console.error('재생목록 업데이트 오류:', error);
      throw error;
    }
  }

  async deletePlaylist(id) {
    try {
      // 재생목록 항목 먼저 삭제
      await db.delete(playlistVideos).where(eq(playlistVideos.playlistId, id));
      
      // 재생목록 삭제
      await db.delete(playlists).where(eq(playlists.id, id));
      return true;
    } catch (error) {
      console.error('재생목록 삭제 오류:', error);
      throw error;
    }
  }

  // 재생목록 영상 관련 메서드
  async getPlaylistVideos(playlistId) {
    try {
      const items = await db.select({
        item: playlistVideos,
        video: likedVideos
      })
      .from(playlistVideos)
      .innerJoin(likedVideos, eq(playlistVideos.videoId, likedVideos.id))
      .where(eq(playlistVideos.playlistId, playlistId))
      .orderBy(asc(playlistVideos.position));
      
      return items.map(item => ({
        ...item.item,
        video: item.video
      }));
    } catch (error) {
      console.error('재생목록 영상 조회 오류:', error);
      throw error;
    }
  }

  async addVideoToPlaylist(playlistId, videoId, position) {
    try {
      const [item] = await db
        .insert(playlistVideos)
        .values({ playlistId, videoId, position })
        .returning();
      return item;
    } catch (error) {
      console.error('재생목록에 영상 추가 오류:', error);
      throw error;
    }
  }

  async removeVideoFromPlaylist(itemId) {
    try {
      await db.delete(playlistVideos).where(eq(playlistVideos.id, itemId));
      return true;
    } catch (error) {
      console.error('재생목록에서 영상 제거 오류:', error);
      throw error;
    }
  }

  // 사용자 설정 관련 메서드
  async getUserSettings(userId) {
    try {
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
      return settings;
    } catch (error) {
      console.error('사용자 설정 조회 오류:', error);
      throw error;
    }
  }

  async createUserSettings(userId, settingsData) {
    try {
      const [settings] = await db
        .insert(userSettings)
        .values({
          userId,
          ...settingsData
        })
        .returning();
      return settings;
    } catch (error) {
      console.error('사용자 설정 생성 오류:', error);
      throw error;
    }
  }

  async updateUserSettings(userId, settingsData) {
    try {
      // 설정이 있는지 확인
      const settings = await this.getUserSettings(userId);
      
      if (settings) {
        // 있으면 업데이트
        const [updatedSettings] = await db
          .update(userSettings)
          .set(settingsData)
          .where(eq(userSettings.userId, userId))
          .returning();
        return updatedSettings;
      } else {
        // 없으면 생성
        return await this.createUserSettings(userId, settingsData);
      }
    } catch (error) {
      console.error('사용자 설정 업데이트 오류:', error);
      throw error;
    }
  }
}

module.exports = new Storage();
