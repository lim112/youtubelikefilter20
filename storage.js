const { db } = require('./db');
const { users, likedVideos, playlists, playlistVideos, userSettings } = require('./shared/schema');
const { eq, desc, asc, and, or, like } = require('drizzle-orm');
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
  async getLikedVideos(userId, limit = 50, offset = 0, filter = {}) {
    try {
      let query = db
        .select()
        .from(likedVideos)
        .where(eq(likedVideos.userId, userId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(likedVideos.createdAt));
      
      // 필터 적용
      if (filter.channelId) {
        query = query.where(eq(likedVideos.channelId, filter.channelId));
      }
      
      if (filter.title) {
        query = query.where(like(likedVideos.title, `%${filter.title}%`));
      }
      
      const videos = await query;
      return videos;
    } catch (error) {
      console.error('좋아요한 영상 조회 오류:', error);
      return [];
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
        // 업데이트
        const [updatedVideo] = await db
          .update(likedVideos)
          .set(videoData)
          .where(eq(likedVideos.id, existingVideo.id))
          .returning();
        return updatedVideo;
      } else {
        // 새로 저장
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