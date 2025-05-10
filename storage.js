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
      return null;
    }
  }

  async getUserByGoogleId(googleId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
      return user;
    } catch (error) {
      console.error('Google ID로 사용자 조회 오류:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      const [newUser] = await db.insert(users).values(userData).returning();
      return newUser;
    } catch (error) {
      console.error('사용자 생성 오류:', error);
      return null;
    }
  }

  async updateUser(id, userData) {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({...userData, updatedAt: new Date()})
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error('사용자 업데이트 오류:', error);
      return null;
    }
  }

  // 좋아요한 영상 관련 메서드
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
      query = query
        .where(eq(likedVideos.userId, userId))
        .limit(limit)
        .offset(offset)
        .orderBy(orderByClause);
      
      // 채널 필터 적용
      if (filter.channelId) {
        query = query.where(eq(likedVideos.channelId, filter.channelId));
      }
      
      // 검색어 필터 적용 (제목에만 포함)
      if (filter.search) {
        query = query.where(
          like(likedVideos.title, `%${filter.search}%`)
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
      
      // 영상 길이 필터 적용
      if (filter.duration) {
        // 영상 길이 필터링은 ISO 8601 형식을 사용하므로 쿼리에 맞게 조건을 작성
        // 여기서는 간단한 문자열 비교로 구현
        if (filter.duration === 'short') {
          // 4분 미만 (PT4M 미만)
          query = query.where(sql`${likedVideos.duration} < 'PT4M'`);
        } else if (filter.duration === 'medium') {
          // 4-20분 (PT4M 이상 PT20M 이하)
          query = query.where(sql`${likedVideos.duration} >= 'PT4M' AND ${likedVideos.duration} <= 'PT20M'`);
        } else if (filter.duration === 'long') {
          // 20분 초과 (PT20M 초과)
          query = query.where(sql`${likedVideos.duration} > 'PT20M'`);
        }
      }
      
      // 디버깅 로그 추가
      console.log(`DB 쿼리 실행: limit=${limit}, offset=${offset}, loadThumbnails=${loadThumbnails}`);
      
      const videos = await query;
      console.log(`DB에서 ${videos.length}개 비디오 조회됨${loadThumbnails ? '' : ' (메타데이터만)'}`);
      return videos;
    } catch (error) {
      console.error('좋아요한 영상 조회 오류:', error);
      return [];
    }
  }
  
  // 메타데이터만 가져오는 함수 (채널, 게시일, 영상 길이 정보)
  async getVideoMetadata(userId) {
    try {
      console.log(`사용자 ${userId}의 비디오 메타데이터 로드 중...`);
      
      // 1. 채널 정보 가져오기 - 전체 DB에서 채널 정보 로드
      const query = `
        SELECT 
          channel_id AS "channelId", 
          channel_title AS "channelTitle", 
          COUNT(*) AS "videoCount"
        FROM liked_videos
        WHERE user_id = $1
        GROUP BY channel_id, channel_title
        ORDER BY channel_title DESC
      `;
      
      const channelsResult = await pool.query(query, [userId]);
      const channels = channelsResult.rows;
      
      // 2. 모든 채널에 대해 첫/마지막 게시일 정보 추가 (선택적)
      const channelsWithDetails = await Promise.all(channels.map(async (channel) => {
        // 각 채널별 가장 최근 및 가장 오래된 영상 게시일 확인
        const dateQuery = `
          SELECT 
            MAX(published_at) AS "latestDate",
            MIN(published_at) AS "oldestDate"
          FROM liked_videos
          WHERE user_id = $1 AND channel_id = $2
        `;
        
        const dateResult = await pool.query(dateQuery, [userId, channel.channelId]);
        const dateInfo = dateResult.rows[0];
        
        return {
          ...channel,
          latestDate: dateInfo.latestDate,
          oldestDate: dateInfo.oldestDate,
          // 숫자값이 문자열로 인식되는 문제 방지를 위해 숫자로 변환하여 반환
          videoCount: parseInt(channel.videoCount)
        };
      }));
      
      console.log(`${channels.length}개 채널 메타데이터 로드됨`);
      
      return { 
        channels: channelsWithDetails,
        totalVideos: await this.countLikedVideos(userId)
      };
    } catch (error) {
      console.error('메타데이터 로드 오류:', error);
      return { 
        channels: [],
        totalVideos: 0
      };
    }
  }
  
  // 좋아요한 비디오 총 개수 조회
  async countLikedVideos(userId, filter = {}) {
    try {
      let query = db
        .select({ count: sql`count(*)` })
        .from(likedVideos)
        .where(eq(likedVideos.userId, userId));
      
      // 채널 필터 적용
      if (filter.channelId) {
        query = query.where(eq(likedVideos.channelId, filter.channelId));
      }
      
      // 검색어 필터 적용 (제목 또는 설명에 포함)
      if (filter.search) {
        query = query.where(
          or(
            like(likedVideos.title, `%${filter.search}%`),
            like(likedVideos.description, `%${filter.search}%`)
          )
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
      
      // 영상 길이 필터 적용
      if (filter.duration) {
        if (filter.duration === 'short') {
          // 4분 미만 (PT4M 미만)
          query = query.where(sql`${likedVideos.duration} < 'PT4M'`);
        } else if (filter.duration === 'medium') {
          // 4-20분 (PT4M 이상 PT20M 이하)
          query = query.where(sql`${likedVideos.duration} >= 'PT4M' AND ${likedVideos.duration} <= 'PT20M'`);
        } else if (filter.duration === 'long') {
          // 20분 초과 (PT20M 초과)
          query = query.where(sql`${likedVideos.duration} > 'PT20M'`);
        }
      }
      
      const [result] = await query;
      return result?.count || 0;
    } catch (error) {
      console.error('비디오 개수 조회 오류:', error);
      return 0;
    }
  }

  async getLikedVideoById(id) {
    try {
      const [video] = await db.select().from(likedVideos).where(eq(likedVideos.id, id));
      return video;
    } catch (error) {
      console.error('영상 조회 오류:', error);
      return null;
    }
  }

  async getLikedVideoByVideoId(userId, videoId) {
    try {
      const [video] = await db
        .select()
        .from(likedVideos)
        .where(and(
          eq(likedVideos.userId, userId),
          eq(likedVideos.videoId, videoId)
        ));
      return video;
    } catch (error) {
      console.error('videoId로 영상 조회 오류:', error);
      return null;
    }
  }

  async saveLikedVideo(userId, videoData) {
    try {
      // 이미 존재하는지 확인
      const existingVideo = await this.getLikedVideoByVideoId(userId, videoData.videoId);
      
      if (existingVideo) {
        // 업데이트 - 단, createdAt 필드는 변경하지 않음 (좋아요 한 시점 보존)
        // 좋아요 날짜로 사용되는 createdAt 필드를 업데이트 객체에서 제거
        const { createdAt, ...dataToUpdate } = videoData;
        
        const [updatedVideo] = await db
          .update(likedVideos)
          .set(dataToUpdate)
          .where(eq(likedVideos.id, existingVideo.id))
          .returning();
        return updatedVideo;
      } else {
        // 새로 저장 - 이 경우에는 현재 시간이 좋아요 한 시점으로 저장됨
        const [newVideo] = await db
          .insert(likedVideos)
          .values({...videoData, userId})
          .returning();
        return newVideo;
      }
    } catch (error) {
      console.error('좋아요한 영상 저장 오류:', error);
      return null;
    }
  }

  async deleteLikedVideo(id) {
    try {
      await db.delete(likedVideos).where(eq(likedVideos.id, id));
      return true;
    } catch (error) {
      console.error('좋아요한 영상 삭제 오류:', error);
      return false;
    }
  }

  // 재생목록 관련 메서드
  async getPlaylists(userId) {
    try {
      const userPlaylists = await db
        .select()
        .from(playlists)
        .where(eq(playlists.userId, userId))
        .orderBy(desc(playlists.createdAt));
      return userPlaylists;
    } catch (error) {
      console.error('재생목록 조회 오류:', error);
      return [];
    }
  }

  async getPlaylistById(id) {
    try {
      const [playlist] = await db.select().from(playlists).where(eq(playlists.id, id));
      return playlist;
    } catch (error) {
      console.error('재생목록 조회 오류:', error);
      return null;
    }
  }

  async createPlaylist(playlistData) {
    try {
      const [newPlaylist] = await db.insert(playlists).values(playlistData).returning();
      return newPlaylist;
    } catch (error) {
      console.error('재생목록 생성 오류:', error);
      return null;
    }
  }

  async updatePlaylist(id, playlistData) {
    try {
      const [updatedPlaylist] = await db
        .update(playlists)
        .set({...playlistData, updatedAt: new Date()})
        .where(eq(playlists.id, id))
        .returning();
      return updatedPlaylist;
    } catch (error) {
      console.error('재생목록 업데이트 오류:', error);
      return null;
    }
  }

  async deletePlaylist(id) {
    try {
      // 먼저 재생목록 내 영상 관계를 삭제
      await db.delete(playlistVideos).where(eq(playlistVideos.playlistId, id));
      // 그런 다음 재생목록 자체를 삭제
      await db.delete(playlists).where(eq(playlists.id, id));
      return true;
    } catch (error) {
      console.error('재생목록 삭제 오류:', error);
      return false;
    }
  }

  // 재생목록 내 영상 관련 메서드
  async getPlaylistVideos(playlistId) {
    try {
      // 재생목록 내 영상 순서대로 가져오기
      const playlistItems = await db
        .select({
          id: playlistVideos.id,
          position: playlistVideos.position,
          videoId: likedVideos.id,
          youtubeId: likedVideos.videoId,
          title: likedVideos.title,
          description: likedVideos.description,
          channelId: likedVideos.channelId,
          channelTitle: likedVideos.channelTitle,
          publishedAt: likedVideos.publishedAt,
          thumbnailUrl: likedVideos.thumbnailUrl,
          duration: likedVideos.duration,
          viewCount: likedVideos.viewCount,
          likeCount: likedVideos.likeCount
        })
        .from(playlistVideos)
        .leftJoin(likedVideos, eq(playlistVideos.videoId, likedVideos.id))
        .where(eq(playlistVideos.playlistId, playlistId))
        .orderBy(asc(playlistVideos.position));
      
      return playlistItems;
    } catch (error) {
      console.error('재생목록 영상 조회 오류:', error);
      return [];
    }
  }

  async addVideoToPlaylist(playlistId, videoId, position) {
    try {
      // 같은 영상이 이미 재생목록에 있는지 확인
      const [existing] = await db
        .select()
        .from(playlistVideos)
        .where(and(
          eq(playlistVideos.playlistId, playlistId),
          eq(playlistVideos.videoId, videoId)
        ));
      
      if (existing) {
        // 이미 있으면 위치만 업데이트
        const [updated] = await db
          .update(playlistVideos)
          .set({ position })
          .where(eq(playlistVideos.id, existing.id))
          .returning();
        return updated;
      }
      
      // 새로 추가
      const [newItem] = await db
        .insert(playlistVideos)
        .values({ playlistId, videoId, position })
        .returning();
      return newItem;
    } catch (error) {
      console.error('재생목록에 영상 추가 오류:', error);
      return null;
    }
  }

  async removeVideoFromPlaylist(itemId) {
    try {
      await db.delete(playlistVideos).where(eq(playlistVideos.id, itemId));
      return true;
    } catch (error) {
      console.error('재생목록에서 영상 제거 오류:', error);
      return false;
    }
  }

  // 사용자 설정 관련 메서드
  async getUserSettings(userId) {
    try {
      const [settings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      if (settings) {
        return settings;
      }
      
      // 없으면 기본 설정 생성
      return this.createUserSettings(userId, {
        defaultView: 'grid',
        videosPerPage: 50,
        theme: 'light',
        preferences: {}
      });
    } catch (error) {
      console.error('사용자 설정 조회 오류:', error);
      return null;
    }
  }

  async createUserSettings(userId, settingsData) {
    try {
      const [newSettings] = await db
        .insert(userSettings)
        .values({ userId, ...settingsData })
        .returning();
      return newSettings;
    } catch (error) {
      console.error('사용자 설정 생성 오류:', error);
      return null;
    }
  }

  async updateUserSettings(userId, settingsData) {
    try {
      // 기존 설정 확인
      const [existing] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      
      if (existing) {
        // 업데이트
        const [updated] = await db
          .update(userSettings)
          .set({...settingsData, updatedAt: new Date()})
          .where(eq(userSettings.id, existing.id))
          .returning();
        return updated;
      } else {
        // 생성
        return this.createUserSettings(userId, settingsData);
      }
    } catch (error) {
      console.error('사용자 설정 업데이트 오류:', error);
      return null;
    }
  }
}

// 단일 인스턴스 내보내기
module.exports = new Storage();