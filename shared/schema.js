const { pgTable, serial, text, varchar, timestamp, jsonb } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

// 사용자 테이블
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  googleId: varchar('google_id', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  photoUrl: varchar('photo_url', { length: 512 }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// 좋아요한 영상 테이블
const likedVideos = pgTable('liked_videos', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id).notNull(),
  videoId: varchar('video_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 512 }).notNull(),
  description: text('description'),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  channelTitle: varchar('channel_title', { length: 255 }).notNull(),
  publishedAt: timestamp('published_at'),
  thumbnailUrl: varchar('thumbnail_url', { length: 512 }),
  duration: varchar('duration', { length: 50 }),
  viewCount: varchar('view_count', { length: 50 }),
  likeCount: varchar('like_count', { length: 50 }),
  metadata: jsonb('metadata'),  // 추가 메타데이터 저장을 위한 필드
  createdAt: timestamp('created_at').defaultNow()
});

// 사용자 정의 재생목록
const playlists = pgTable('playlists', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// 재생목록-영상 연결 테이블
const playlistVideos = pgTable('playlist_videos', {
  id: serial('id').primaryKey(),
  playlistId: serial('playlist_id').references(() => playlists.id).notNull(),
  videoId: serial('video_id').references(() => likedVideos.id).notNull(),
  position: serial('position').notNull(),  // 재생목록 내 순서
  createdAt: timestamp('created_at').defaultNow()
});

// 사용자 설정 테이블
const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id).unique().notNull(),
  defaultView: varchar('default_view', { length: 50 }).default('grid'),
  videosPerPage: serial('videos_per_page').default(50),
  theme: varchar('theme', { length: 50 }).default('light'),
  preferences: jsonb('preferences'),  // 추가 설정 저장을 위한 필드
  updatedAt: timestamp('updated_at').defaultNow()
});

// 관계 정의
const usersRelations = relations(users, ({ many }) => ({
  likedVideos: many(likedVideos),
  playlists: many(playlists),
  settings: many(userSettings),
}));

const likedVideosRelations = relations(likedVideos, ({ one, many }) => ({
  user: one(users, {
    fields: [likedVideos.userId],
    references: [users.id],
  }),
  playlistVideos: many(playlistVideos),
}));

const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  playlistVideos: many(playlistVideos),
}));

const playlistVideosRelations = relations(playlistVideos, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistVideos.playlistId],
    references: [playlists.id],
  }),
  video: one(likedVideos, {
    fields: [playlistVideos.videoId],
    references: [likedVideos.id],
  }),
}));

const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

module.exports = {
  users,
  likedVideos,
  playlists,
  playlistVideos,
  userSettings,
  usersRelations,
  likedVideosRelations,
  playlistsRelations,
  playlistVideosRelations,
  userSettingsRelations
};