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
  imageUrl: string;
  thumbnailUrl: string | null;
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
