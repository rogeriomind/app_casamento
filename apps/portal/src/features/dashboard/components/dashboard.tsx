import Link from "next/link";
import { DashboardIcon } from "./dashboard-icon";
import styles from "./dashboard.module.css";

type DashboardPhoto = {
  id: string;
  altText: string;
  collection: string | null;
  width: number | null;
  height: number | null;
  mediaType: "IMAGE" | "VIDEO";
  tags: string[];
  durationSeconds: number | null;
  grant: string;
};

type DashboardProps = {
  event: {
    id: string;
    name: string | null;
    description: string | null;
    type: string | null;
    albumColor: string;
    coverPath: string | null;
    displayNames: string | null;
    eventDate: string | null;
    venue: string | null;
  };
  user: { name: string };
  metrics: { mediaCount: number; guestSessions: number; likes: number; videoCount: number };
  recentPhotos: DashboardPhoto[];
};

export function AlbumDashboard({ event, user, metrics, recentPhotos }: DashboardProps) {
  const firstName = user.name.trim().split(/\s+/)[0] || "por aqui";
  const albumName = event.name?.trim() || "Seu álbum";
  const names = event.displayNames?.trim() || user.name;
  const imageUrl = (photo: DashboardPhoto) => `/api/eventos/${event.id}/fotos/${photo.id}?variante=miniatura&grant=${encodeURIComponent(photo.grant)}`;
  const photoHref = (photo: DashboardPhoto) => `/eventos/${event.id}/fotos?foto=${photo.id}`;
  const eventCover = event.coverPath
    ? `/api/eventos/${event.id}/capa?variante=miniatura`
    : recentPhotos[0]
      ? imageUrl(recentPhotos[0])
      : "/images/optimized/party-480.webp";

  return (
    <div className={styles.shell}>
      <main id="dashboard" className={styles.main}>
        <header className={styles.header}>
          <div className={styles.welcome}>
            <button className={styles.notification} type="button" disabled aria-label="Notificações em breve"><DashboardIcon name="bell" /></button>
            <h1>Olá, {firstName}! <span aria-hidden="true">👋</span></h1>
            <p>{event.description?.trim() || "Seu evento está incrível! Veja o resumo e acompanhe as fotos em tempo real."}</p>
          </div>
          <img className={styles.heroBanner} src="/images/optimized/colecione-momentos-640.webp" srcSet="/images/optimized/colecione-momentos-640.webp 640w, /images/optimized/colecione-momentos-1280.webp 1280w" sizes="(max-width: 720px) calc(100vw - 32px), 42vw" width="2048" height="768" fetchPriority="high" decoding="async" alt="Casal contemplando o pôr do sol" />
        </header>

        <dl className={styles.metrics}>
          <Metric icon="image" value={metrics.mediaCount} label="fotos e vídeos" />
          <Metric icon="people" value={metrics.guestSessions} label="convidados" />
          <Metric icon="heart" value={metrics.likes} label="curtidas" />
          <Metric icon="play" value={metrics.videoCount} label="vídeos" />
        </dl>

        <div className={styles.dashboardContent}>
          <section id="fotos" className={styles.recent} aria-labelledby="recent-title">
            <div className={styles.sectionHeader}>
              <div><h2 id="recent-title">Atividade recente</h2><p>As últimas fotos enviadas pelos seus convidados.</p></div>
              <Link href={`/eventos/${event.id}/fotos`}>Ver todas <DashboardIcon name="arrow" /></Link>
            </div>
            {recentPhotos.length ? (
              <div className={styles.photoGrid}>
                {recentPhotos.map((photo, index) => <MediaCard key={photo.id} photo={photo} href={photoHref(photo)} src={imageUrl(photo)} eager={index === 0} />)}
              </div>
            ) : <EmptyPhotos />}
          </section>

          <aside className={styles.eventCard} aria-labelledby="event-card-title">
            <div className={styles.eventCardHeader}><h2 id="event-card-title">Seu evento</h2><Link href={`/eventos/${event.id}/configuracoes`}><DashboardIcon name="pencil" />Editar</Link></div>
            <img className={styles.eventCover} src={eventCover} alt="Capa do evento" />
            <h3>{albumName}</h3>
            <dl className={styles.eventDetails}>
              <div><DashboardIcon name="people" /><dd>{names}</dd></div>
              {event.eventDate && <div><DashboardIcon name="calendar" /><dd>{formatEventDate(event.eventDate)}</dd></div>}
              {event.venue?.trim() && <div><DashboardIcon name="pin" /><dd>{event.venue}</dd></div>}
            </dl>
            <span className={styles.publicAlbum} aria-disabled="true">Ver álbum público <DashboardIcon name="external" /></span>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: "image" | "people" | "heart" | "play"; value: number; label: string }) {
  return <div className={styles.metric}><DashboardIcon name={icon} /><div><dt>{value}</dt><dd>{label}</dd></div></div>;
}

function MediaCard({ photo, href, src, eager }: { photo: DashboardPhoto; href: string; src: string; eager: boolean }) {
  return <Link className={styles.photoLink} href={href} aria-label={`Abrir ${photo.altText}`}>
    <img src={`${src}&largura=640`} srcSet={`${src}&largura=320 320w, ${src}&largura=640 640w, ${src}&largura=960 960w`} sizes="(max-width: 540px) 48vw, (max-width: 900px) 31vw, 18vw" alt={photo.altText} width={photo.width ?? 640} height={photo.height ?? 640} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" />
    {photo.mediaType === "VIDEO" && <span className={styles.videoBadge}>▶ Vídeo{photo.durationSeconds ? ` · ${photo.durationSeconds}s` : ""}</span>}
  </Link>;
}

function EmptyPhotos() {
  return <div className={styles.emptyPhotos}><DashboardIcon name="camera" /><p>Ainda não há fotos neste álbum.</p><span>Quando seus convidados começarem a enviar, elas aparecerão aqui.</span></div>;
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
