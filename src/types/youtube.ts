export type YouTubeCommentItem = {
  id: string;
  snippet: {
    topLevelComment: {
      snippet: {
        textOriginal: string;
        authorDisplayName: string | null;
        likeCount: number;
      };
    };
  };
};

export type YouTubeCommentThreadsResponse = { items?: YouTubeCommentItem[] };

export type YouTubeVideoItem = {
  id: string;
  snippet?: {
    title: string;
    channelTitle: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics?: { commentCount?: string };
};

export type YouTubeVideosResponse = { items?: YouTubeVideoItem[] };

export type Comment = {
  id: string;
  text: string;
  likeCount: number;
  author: string;
};
