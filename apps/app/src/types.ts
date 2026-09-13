export type PublicEvent = {
  id: string;
  slug: string;
  name: string;
  coupleName: string;
  monogram: string;
  eventDate: string;
  isActive: boolean;
};

export type PublicGuestSession = {
  guestSessionId: string;
  guestName: string;
};

export type PublicPhoto = {
  id: string;
  mediaType: "image" | "video";
  imageUrl: string | null;
  thumbnailUrl: string | null;
  videoEmbedUrl: string | null;
  playbackUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  guestName: string;
  tags: string[];
  likeCount: number;
  isLiked: boolean;
  canDelete: boolean;
  createdAt: string;
};

export type GalleryViewMode = "grid" | "feed";

export type PaginatedPhotos = {
  items: PublicPhoto[];
  page: number;
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
};

export type ApiError = {
  error: string;
  code?: string;
};
