import Link from "next/link";
import type { CSSProperties } from "react";
import { AlbumSidebar } from "./album-sidebar";
import { CaptureSync } from "./capture-sync";
import { DashboardIcon } from "./dashboard-icon";
import { FavoriteButton } from "./favorite-button";
import { GalleryToolbar } from "./gallery-toolbar";
import { GalleryThumbnail } from "./gallery-thumbnail";
import { GalleryFocusRestore, MediaDialog } from "./media-dialog";
import styles from "./album-gallery.module.css";

type GalleryPhoto = {
  id: string;
  altText: string;
  collection: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  mediaType: "IMAGE" | "VIDEO";
  tags: string[];
  authorName: string | null;
  likeCount: number;
  durationSeconds: number | null;
  remoteEmbedUrl: string | null;
  isFavorite: boolean;
};

type GalleryProps = {
  event: { id: string; name: string | null; albumColor: string; coverPath: string | null };
  user: { name: string };
  photos: GalleryPhoto[];
  total: number;
  albumTotal: number;
  favoriteTotal: number;
  page: number;
  hasNextPage: boolean;
  selectedPhoto: GalleryPhoto | null;
  scope: "todas" | "envios" | "favoritos";
  search: string;
  type: "todos" | "fotos" | "videos";
  period: "todas" | "7d" | "30d" | "mes";
  tag: string | null;
  author: string | null;
  order: "recentes" | "antigas" | "curtidas";
  view: "grade" | "lista";
  tags: string[];
  capture: { lastSyncAt: string | null; lastError: string | null } | null;
};

type GalleryParams = {
  page?: number;
  photo?: string | null;
  scope?: GalleryProps["scope"];
  search?: string | null;
  type?: GalleryProps["type"];
  period?: GalleryProps["period"];
  tag?: string | null;
  author?: string | null;
  order?: GalleryProps["order"];
  view?: GalleryProps["view"];
};

const pageSize = 24;

function durationLabel(seconds: number | null) {
  if (!seconds || seconds < 0) return null;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function recordLabel(photo: GalleryPhoto) {
  const duration = photo.mediaType === "VIDEO" ? durationLabel(photo.durationSeconds) : null;
  const kind = photo.mediaType === "VIDEO" ? `vídeo${duration ? ` de ${duration}` : ""}` : "foto";
  const author = photo.authorName?.trim() ? ` enviado por ${photo.authorName.trim()}` : "";
  const tagLabel = photo.tags.length ? `, tags ${photo.tags.slice(0, 3).join(" e ")}` : "";
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(photo.createdAt);
  return `Abrir ${kind}${author}${tagLabel}, publicado em ${date}`;
}

export function AlbumGallery(props: GalleryProps) {
  const { event, user, photos, total, albumTotal, favoriteTotal, page, hasNextPage, selectedPhoto, scope, search, type, period, tag, author, order, view, tags, capture } = props;
  const route = `/eventos/${event.id}/fotos`;
  const imageUrl = (photo: GalleryPhoto) => `/api/eventos/${event.id}/fotos/${photo.id}?variante=miniatura`;
  const paramsFor = (next: GalleryParams) => {
    const query = new URLSearchParams();
    const nextPage = next.page ?? page;
    const nextScope = next.scope ?? scope;
    const nextSearch = next.search === undefined ? search : next.search;
    const nextType = next.type ?? type;
    const nextPeriod = next.period ?? period;
    const nextTag = next.tag === undefined ? tag : next.tag;
    const nextAuthor = next.author === undefined ? author : next.author;
    const nextOrder = next.order ?? order;
    const nextView = next.view ?? view;
    if (nextPage > 1) query.set("pagina", String(nextPage));
    if (nextScope !== "todas") query.set("aba", nextScope);
    if (nextSearch) query.set("busca", nextSearch);
    if (nextType !== "todos") query.set("tipo", nextType);
    if (nextPeriod !== "todas") query.set("periodo", nextPeriod);
    if (nextTag) query.set("tag", nextTag);
    if (nextAuthor) query.set("autor", nextAuthor);
    if (nextOrder !== "recentes") query.set("ordem", nextOrder);
    if (nextView !== "grade") query.set("visualizacao", nextView);
    if (next.photo) query.set("foto", next.photo);
    return `${route}${query.size ? `?${query}` : ""}`;
  };
  const closeUrl = paramsFor({ photo: null });
  const clearUrl = paramsFor({ page: 1, search: null, type: "todos", period: "todas", tag: null, author: null, order: "recentes" });
  const hasFilters = Boolean(search || type !== "todos" || period !== "todas" || tag || author || order !== "recentes");
  const filterSummary = [
    search ? `Busca: “${search}”` : null,
    type === "fotos" ? "Fotos" : type === "videos" ? "Vídeos" : null,
    period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : period === "mes" ? "Este mês" : null,
    tag ? `#${tag}` : null,
    author ? `Nome informado: ${author}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className={styles.shell} style={{ "--album-color": event.albumColor } as CSSProperties}>
      <AlbumSidebar eventId={event.id} userName={user.name} active="photos" styles={styles} />

      <main className={styles.page}>
        <section className={styles.content} aria-labelledby="gallery-title">
          <div className={styles.galleryHeader}>
            <div className={styles.titleRow}>
              <div><h1 id="gallery-title">Todas as memórias</h1><p>Explore as fotos e os vídeos compartilhados neste álbum.</p></div>
            </div>
            <button className={styles.uploadAction} type="button" disabled title="O envio direto de fotos será disponibilizado em breve."><DashboardIcon name="send" />Enviar fotos</button>
          </div>

          <nav className={styles.scopeTabs} aria-label="Coleções de fotos">
            <Link aria-current={scope === "todas" ? "page" : undefined} className={scope === "todas" ? styles.selectedScope : ""} href={paramsFor({ page: 1, photo: null, scope: "todas" })}><DashboardIcon name="album" />Todas <span>({albumTotal})</span></Link>
            <Link aria-current={scope === "envios" ? "page" : undefined} className={scope === "envios" ? styles.selectedScope : ""} href={paramsFor({ page: 1, photo: null, scope: "envios" })}><DashboardIcon name="send" />Meus envios</Link>
            <Link aria-current={scope === "favoritos" ? "page" : undefined} className={scope === "favoritos" ? styles.selectedScope : ""} href={paramsFor({ page: 1, photo: null, scope: "favoritos" })}><DashboardIcon name="heart" />Favoritos <span>({favoriteTotal})</span></Link>
          </nav>

          <GalleryToolbar action={route} search={search} type={type} period={period} tag={tag} order={order} preserved={{ scope, view, author }} />

          <div className={styles.secondaryControls}>
            <div className={styles.tagFilters} aria-label="Filtrar por tag">
              <span>Tags:</span>
              <Link aria-current={!tag ? "page" : undefined} className={!tag ? styles.selectedTag : ""} href={paramsFor({ page: 1, tag: null, photo: null })}>Todas</Link>
              {tags.map((item) => <Link aria-current={tag === item ? "page" : undefined} className={tag === item ? styles.selectedTag : ""} href={paramsFor({ page: 1, tag: item, photo: null })} key={item}>{item}</Link>)}
            </div>
            <div className={styles.viewControls}>
              <Link className={view === "grade" ? styles.selectedView : ""} aria-current={view === "grade" ? "page" : undefined} href={paramsFor({ page: 1, view: "grade", photo: null })} aria-label="Visualizar em grade"><DashboardIcon name="grid" /><span className={styles.srOnly}>Grade</span></Link>
              <Link className={view === "lista" ? styles.selectedView : ""} aria-current={view === "lista" ? "page" : undefined} href={paramsFor({ page: 1, view: "lista", photo: null })} aria-label="Visualizar em lista"><DashboardIcon name="list" /><span className={styles.srOnly}>Lista</span></Link>
            </div>
          </div>

          {(hasFilters || capture) && (
            <div className={styles.statusRow}>
              <div>
                {hasFilters && <p className={styles.filterSummary}>{filterSummary || "Filtros aplicados"} · {total} {total === 1 ? "resultado" : "resultados"} <Link href={clearUrl}>Limpar filtros</Link></p>}
                {capture?.lastError && <p className={styles.syncError}>Último acervo disponível. Não foi possível atualizar agora.</p>}
              </div>
              {capture && <CaptureSync eventId={event.id} lastSyncAt={capture.lastSyncAt} className={styles.captureSync} />}
            </div>
          )}

          <GalleryFocusRestore />
          {scope === "envios" ? (
            <UnavailableScope icon="send" title="Seus envios ainda não podem ser identificados" text="A captura do evento não associa cada registro à sua conta. Quando o envio autenticado estiver disponível, suas memórias aparecerão aqui." href={paramsFor({ page: 1, scope: "todas" })} />
          ) : photos.length ? (
            <ol className={`${styles.gallery} ${view === "lista" ? styles.list : styles.grid}`}>
              {scope === "todas" && view === "grade" && <UploadTile />}
              {photos.map((photo, index) => <MediaItem key={photo.id} eventId={event.id} photo={photo} href={paramsFor({ photo: photo.id })} src={imageUrl(photo)} eager={index < 4} />)}
            </ol>
          ) : (
            <div className={styles.empty}>
              <DashboardIcon name={scope === "favoritos" ? "heart" : "camera"} />
              <h2>{scope === "favoritos" && !hasFilters ? "Você ainda não favoritou nenhuma memória" : hasFilters ? "Nenhuma memória corresponde aos filtros" : "Este álbum ainda não tem mídias"}</h2>
              <p>{scope === "favoritos" && !hasFilters ? "Use o coração nos cards para guardar suas fotos e vídeos preferidos." : "Tente ajustar a busca ou limpar os filtros aplicados."}</p>
              <Link href={scope === "favoritos" && !hasFilters ? paramsFor({ page: 1, scope: "todas" }) : clearUrl}>{scope === "favoritos" && !hasFilters ? "Ver todas as memórias" : "Limpar filtros"}</Link>
            </div>
          )}

          {(page > 1 || hasNextPage) && scope !== "envios" && (
            <nav className={styles.pagination} aria-label="Paginação da galeria">
              {page > 1 ? <Link href={paramsFor({ page: page - 1, photo: null })}>← Anteriores</Link> : <span />}
              <span>Página {page}</span>
              {hasNextPage ? <Link href={paramsFor({ page: page + 1, photo: null })}>Próximas →</Link> : <span />}
            </nav>
          )}
        </section>

        {selectedPhoto && (
          <MediaDialog closeHref={closeUrl} returnFocusId={selectedPhoto.id}>
            {selectedPhoto.mediaType === "VIDEO" && selectedPhoto.remoteEmbedUrl
              ? <iframe src={selectedPhoto.remoteEmbedUrl} title="Vídeo do casamento" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen />
              : <img src={`/api/eventos/${event.id}/fotos/${selectedPhoto.id}?variante=original`} alt={selectedPhoto.altText} width={selectedPhoto.width ?? 1000} height={selectedPhoto.height ?? 1000} />}
            <div className={styles.detail}>
              <div className={styles.detailTitle}><strong>{selectedPhoto.mediaType === "VIDEO" ? "Vídeo" : "Foto"} do álbum</strong><FavoriteButton eventId={event.id} photoId={selectedPhoto.id} initialFavorite={selectedPhoto.isFavorite} /></div>
              <p>{selectedPhoto.authorName ? `Nome informado no envio: ${selectedPhoto.authorName}` : "Registro do evento"}</p>
              <div><time dateTime={selectedPhoto.createdAt.toISOString()}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(selectedPhoto.createdAt)}</time>{selectedPhoto.durationSeconds && <span>{durationLabel(selectedPhoto.durationSeconds)}</span>}<span>{selectedPhoto.likeCount} {selectedPhoto.likeCount === 1 ? "curtida no evento" : "curtidas no evento"}</span></div>
              {selectedPhoto.tags.length > 0 && <ul>{selectedPhoto.tags.map((item) => <li key={item}>#{item}</li>)}</ul>}
            </div>
          </MediaDialog>
        )}
      </main>
    </div>
  );
}

function MediaItem({ eventId, photo, href, src, eager }: { eventId: string; photo: GalleryPhoto; href: string; src: string; eager: boolean }) {
  const duration = durationLabel(photo.durationSeconds);
  return (
    <li id={photo.id} className={styles.mediaCard} style={{ "--media-ratio": `${photo.width ?? 4} / ${photo.height ?? 5}` } as CSSProperties}>
      <Link className={styles.mediaLink} href={href} prefetch={false} aria-label={recordLabel(photo)}>
        <span className={styles.preview}>
          <GalleryThumbnail src={src} alt={photo.altText} width={photo.width ?? 640} height={photo.height ?? 640} eager={eager} />
          {photo.mediaType === "VIDEO" && <i className={styles.videoBadge}><DashboardIcon name="eye" />{duration ?? "Vídeo"}</i>}
          <span className={styles.cardTags} aria-hidden="true">
            {(photo.tags.length ? photo.tags.slice(0, 2) : [photo.collection || "registro"]).map((item) => <b key={item}>#{item}</b>)}
            {photo.tags.length > 2 && <b>+{photo.tags.length - 2}</b>}
          </span>
          {photo.likeCount > 0 && <span className={styles.likeBadge}><DashboardIcon name="heart" />{photo.likeCount}</span>}
        </span>
        <span className={styles.cardInfo}>
          <strong>{photo.mediaType === "VIDEO" ? "Vídeo" : "Foto"} do álbum</strong>
          <span>{photo.authorName ? `Nome informado: ${photo.authorName}` : "Registro do evento"}</span>
          <time dateTime={photo.createdAt.toISOString()}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(photo.createdAt)}</time>
          <span>{photo.likeCount} {photo.likeCount === 1 ? "curtida no evento" : "curtidas no evento"}</span>
        </span>
      </Link>
      <FavoriteButton eventId={eventId} photoId={photo.id} initialFavorite={photo.isFavorite} />
    </li>
  );
}

function UploadTile() {
  return <li className={styles.uploadTile} aria-label="Envio direto de fotos em breve" title="O envio direto de fotos será disponibilizado em breve."><DashboardIcon name="send" /><strong>Enviar fotos</strong><span>Em breve você poderá selecionar fotos.</span></li>;
}

function UnavailableScope({ icon, title, text, href }: { icon: "send"; title: string; text: string; href: string }) {
  return <div className={styles.empty}><DashboardIcon name={icon} /><h2>{title}</h2><p>{text}</p><Link href={href}>Ver todas as memórias</Link></div>;
}

export const galleryPageSize = pageSize;
