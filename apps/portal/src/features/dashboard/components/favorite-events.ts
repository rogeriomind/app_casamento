export const favoriteChangedEvent = "portal:favorite-changed";

export type FavoriteChangedDetail = {
  eventId: string;
  photoId: string;
  favorited: boolean;
};
