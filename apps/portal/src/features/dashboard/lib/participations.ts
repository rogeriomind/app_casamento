export type Participation = {
  name: string;
  mediaCount: number;
  photoCount: number;
  videoCount: number;
  likeCount: number;
  latestAt: string;
  tags: string[];
};

type ParticipationMedia = {
  authorName: string | null;
  mediaType: "IMAGE" | "VIDEO";
  tags: string[];
  likeCount: number;
  createdAt: Date;
};

export function normalizeParticipationName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("pt-BR");
}

export function buildParticipations(media: ParticipationMedia[]) {
  const grouped = new Map<string, Participation & { latestTime: number; tagCounts: Map<string, number> }>();

  for (const item of media) {
    const displayName = item.authorName?.trim();
    if (!displayName) continue;

    const key = normalizeParticipationName(displayName);
    const itemTime = item.createdAt.getTime();
    const current = grouped.get(key) ?? {
      name: displayName,
      mediaCount: 0,
      photoCount: 0,
      videoCount: 0,
      likeCount: 0,
      latestAt: item.createdAt.toISOString(),
      latestTime: itemTime,
      tags: [],
      tagCounts: new Map<string, number>(),
    };

    current.mediaCount += 1;
    current.photoCount += item.mediaType === "IMAGE" ? 1 : 0;
    current.videoCount += item.mediaType === "VIDEO" ? 1 : 0;
    current.likeCount += item.likeCount;
    if (itemTime > current.latestTime) {
      current.name = displayName;
      current.latestAt = item.createdAt.toISOString();
      current.latestTime = itemTime;
    }
    for (const tag of item.tags) {
      current.tagCounts.set(tag, (current.tagCounts.get(tag) ?? 0) + 1);
    }
    grouped.set(key, current);
  }

  return [...grouped.values()].map(({ latestTime: _latestTime, tagCounts, ...item }) => ({
    ...item,
    tags: [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))
      .map(([tag]) => tag),
  }));
}

export function matchingAuthorVariants(authors: Array<string | null>, displayedName: string) {
  const key = normalizeParticipationName(displayedName);
  return [...new Set(authors.filter((author): author is string => Boolean(author) && normalizeParticipationName(author!) === key))];
}
