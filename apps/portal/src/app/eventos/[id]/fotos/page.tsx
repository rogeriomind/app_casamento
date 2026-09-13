import { notFound, redirect } from "next/navigation";
import { EventState, MediaType, type Prisma } from "@/generated/prisma/client";
import { AlbumGallery, galleryPageSize } from "@/features/dashboard/components/album-gallery";
import { matchingAuthorVariants } from "@/features/dashboard/lib/participations";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/session";

type Scope = "todas" | "envios" | "favoritos";
type Period = "todas" | "7d" | "30d" | "mes";
type Order = "recentes" | "antigas" | "curtidas";
type View = "grade" | "lista";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    pagina?: string;
    foto?: string;
    aba?: string;
    busca?: string;
    tipo?: string;
    periodo?: string;
    tag?: string;
    autor?: string;
    ordem?: string;
    visualizacao?: string;
  }>;
};

function oneOf<T extends string>(value: string | undefined, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

function positivePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 10_000) : 1;
}

function saoPauloToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

function saoPauloDate(year: number, month: number, day: number) {
  return new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00-03:00`);
}

function periodStart(period: Period) {
  if (period === "todas") return null;
  const today = saoPauloToday();
  const start = saoPauloDate(today.year, today.month, period === "mes" ? 1 : today.day);
  if (period === "7d") start.setUTCDate(start.getUTCDate() - 6);
  if (period === "30d") start.setUTCDate(start.getUTCDate() - 29);
  return start;
}

function searchDateRange(search: string) {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(search);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(search);
  const year = br ? Number(br[3]) : iso ? Number(iso[1]) : 0;
  const month = br ? Number(br[2]) : iso ? Number(iso[2]) : 0;
  const day = br ? Number(br[1]) : iso ? Number(iso[3]) : 0;
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const start = saoPauloDate(year, month, day);
  if (Number.isNaN(start.getTime())) return null;
  const normalized = saoPauloToday(start);
  if (normalized.year !== year || normalized.month !== month || normalized.day !== day) return null;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

export default async function EventPhotosPage({ params, searchParams }: PageProps) {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const query = await searchParams;
  const requestedPage = positivePage(query.pagina);
  const photoId = query.foto?.trim().slice(0, 64) || undefined;
  const scope = oneOf<Scope>(query.aba, ["todas", "envios", "favoritos"], "todas");
  const search = query.busca?.trim().slice(0, 120) || "";
  const selectedType = oneOf(query.tipo, ["todos", "fotos", "videos"] as const, "todos");
  const period = oneOf<Period>(query.periodo, ["todas", "7d", "30d", "mes"], "todas");
  const order = oneOf<Order>(query.ordem, ["recentes", "antigas", "curtidas"], "recentes");
  const view = oneOf<View>(query.visualizacao, ["grade", "lista"], "grade");
  const rawTag = query.tag?.trim().slice(0, 64) || null;
  const author = query.autor?.trim().slice(0, 120) || null;

  const event = await prisma.event.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, name: true, state: true, albumColor: true, coverPath: true },
  });
  if (!event) notFound();
  if (event.state !== EventState.CREATED) redirect("/eventos/novo/personalizacao");

  const baseFilter: Prisma.PhotoWhereInput = { eventId: id, isVisible: true };
  const [tagRows, integration, albumTotal, favoriteTotal, authorRows] = await Promise.all([
    prisma.$queryRaw<{ tag: string }[]>`SELECT DISTINCT unnest(tags) AS tag FROM "Photo" WHERE "eventId" = ${id} AND "isVisible" = true ORDER BY tag`,
    prisma.captureIntegration.findUnique({ where: { eventId: id }, select: { lastSyncAt: true, lastError: true } }),
    prisma.photo.count({ where: baseFilter }),
    prisma.photo.count({ where: { ...baseFilter, favorites: { some: { userId: user.id } } } }),
    author
      ? prisma.photo.findMany({ where: { ...baseFilter, authorName: { not: null } }, select: { authorName: true }, distinct: ["authorName"] })
      : Promise.resolve([]),
  ]);

  const tags = tagRows.map((row) => row.tag).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const selectedTag = rawTag && tags.includes(rawTag) ? rawTag : null;
  const authorVariants = author ? matchingAuthorVariants(authorRows.map((row) => row.authorName), author) : [];
  const mediaType = selectedType === "fotos" ? MediaType.IMAGE : selectedType === "videos" ? MediaType.VIDEO : null;
  const start = periodStart(period);
  const normalizedSearch = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const matchingTags = search
    ? tags.filter((item) => item.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(normalizedSearch))
    : [];
  const dateRange = searchDateRange(search);
  const searchFilters: Prisma.PhotoWhereInput[] = search ? [
    { altText: { contains: search, mode: "insensitive" } },
    { authorName: { contains: search, mode: "insensitive" } },
    { collection: { contains: search, mode: "insensitive" } },
    ...(matchingTags.length ? [{ tags: { hasSome: matchingTags } } satisfies Prisma.PhotoWhereInput] : []),
    ...(dateRange ? [{ createdAt: dateRange } satisfies Prisma.PhotoWhereInput] : []),
  ] : [];

  const filter: Prisma.PhotoWhereInput = {
    ...baseFilter,
    ...(scope === "favoritos" ? { favorites: { some: { userId: user.id } } } : {}),
    ...(mediaType ? { mediaType } : {}),
    ...(selectedTag ? { tags: { has: selectedTag } } : {}),
    ...(author ? { authorName: { in: authorVariants } } : {}),
    ...(start ? { createdAt: { gte: start } } : {}),
    ...(searchFilters.length ? { OR: searchFilters } : {}),
  };
  const ordering: Prisma.PhotoOrderByWithRelationInput[] = order === "antigas"
    ? [{ createdAt: "asc" }, { id: "asc" }]
    : order === "curtidas"
      ? [{ likeCount: "desc" }, { createdAt: "desc" }, { id: "desc" }]
      : [{ createdAt: "desc" }, { id: "desc" }];
  const detailSelect = {
    id: true,
    altText: true,
    collection: true,
    width: true,
    height: true,
    createdAt: true,
    mediaType: true,
    tags: true,
    authorName: true,
    likeCount: true,
    durationSeconds: true,
    remoteEmbedUrl: true,
    favorites: { where: { userId: user.id }, select: { userId: true } },
  } as const;

  const isUnsupportedUploads = scope === "envios";
  const usesDefaultFilter = scope === "todas" && !search && !mediaType && !selectedTag && !author && !start;
  const filteredTotal = isUnsupportedUploads ? 0 : usesDefaultFilter ? albumTotal : await prisma.photo.count({ where: filter });
  const totalPages = Math.max(Math.ceil(filteredTotal / galleryPageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const [rows, selectedRow] = await Promise.all([
    isUnsupportedUploads
      ? Promise.resolve([])
      : prisma.photo.findMany({ where: filter, orderBy: ordering, skip: (page - 1) * galleryPageSize, take: galleryPageSize, select: detailSelect }),
    photoId && !isUnsupportedUploads
      ? prisma.photo.findFirst({ where: { ...filter, id: photoId }, select: detailSelect })
      : null,
  ]);
  const photos = rows.map(({ favorites, ...photo }) => ({ ...photo, isFavorite: favorites.length > 0 }));
  const selectedPhoto = selectedRow
    ? (({ favorites, ...photo }) => ({ ...photo, isFavorite: favorites.length > 0 }))(selectedRow)
    : null;

  return (
    <AlbumGallery
      event={event}
      user={{ name: user.name }}
      photos={photos}
      total={filteredTotal}
      albumTotal={albumTotal}
      favoriteTotal={favoriteTotal}
      page={page}
      hasNextPage={page * galleryPageSize < filteredTotal}
      selectedPhoto={selectedPhoto}
      scope={scope}
      search={search}
      type={selectedType}
      period={period}
      tag={selectedTag}
      author={author}
      order={order}
      view={view}
      tags={tags}
      capture={integration ? { lastSyncAt: integration.lastSyncAt?.toISOString() ?? null, lastError: integration.lastError } : null}
    />
  );
}
