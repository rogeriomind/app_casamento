import Link from "next/link";
import { AlbumSidebar } from "./album-sidebar";
import { CaptureSync } from "./capture-sync";
import { DashboardIcon } from "./dashboard-icon";
import { normalizeParticipationName, type Participation } from "../lib/participations";
import styles from "./guests-dashboard.module.css";

type Props = {
  event: { id: string; name: string | null; coverPath: string | null };
  user: { name: string };
  metrics: {
    identifiedNames: number;
    mediaCount: number;
    guestSessions: number | null;
    likes: number;
    withPhotos: number;
    withVideos: number;
  };
  participations: Participation[];
  filteredCount: number;
  filters: {
    search: string;
    type: "todos" | "fotos" | "videos";
    order: "recentes" | "midias" | "curtidas";
    page: number;
    totalPages: number;
  };
  capture: { lastSyncAt: string | null; lastError: string | null } | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function GuestsDashboard({
  event,
  user,
  metrics,
  participations,
  filteredCount,
  filters,
  capture,
}: Props) {
  const paramsFor = (updates: Partial<Props["filters"]>) => {
    const next = { ...filters, ...updates };
    const query = new URLSearchParams();
    if (next.search) query.set("busca", next.search);
    if (next.type !== "todos") query.set("tipo", next.type);
    if (next.order !== "recentes") query.set("ordem", next.order);
    if (next.page > 1) query.set("pagina", String(next.page));
    const value = query.toString();
    return `/eventos/${event.id}/convidados${value ? `?${value}` : ""}`;
  };

  return (
    <div className={styles.shell}>
      <AlbumSidebar eventId={event.id} userName={user.name} active="guests" styles={styles} />

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.title}>
            <DashboardIcon name="people" />
            <div>
              <h1>Convidados</h1>
              <p>Acompanhe as participações identificadas nos registros deste álbum.</p>
            </div>
          </div>
          {capture && <CaptureSync eventId={event.id} lastSyncAt={capture.lastSyncAt} className={styles.captureSync} />}
          {capture?.lastError && <p className={styles.syncError} role="status">Os dados podem estar desatualizados. {capture.lastError}</p>}
        </header>

        <dl className={styles.metrics}>
          <Metric icon="people" value={metrics.identifiedNames} label="nomes informados" />
          <Metric icon="image" value={metrics.mediaCount} label="mídias compartilhadas" />
          <Metric icon="eye" value={metrics.guestSessions ?? "—"} label="sessões de acesso" hint="Sessões não representam pessoas únicas." />
          <Metric icon="heart" value={metrics.likes} label="curtidas nas mídias" />
        </dl>

        <div className={styles.contentGrid}>
          <section className={styles.directory} aria-labelledby="directory-title">
            <div className={styles.tabs} aria-label="Filtrar participações">
              <Link aria-current={filters.type === "todos" ? "page" : undefined} className={filters.type === "todos" ? styles.selectedTab : ""} href={paramsFor({ type: "todos", page: 1 })}>Todos ({metrics.identifiedNames})</Link>
              <Link aria-current={filters.type === "fotos" ? "page" : undefined} className={filters.type === "fotos" ? styles.selectedTab : ""} href={paramsFor({ type: "fotos", page: 1 })}>Com fotos ({metrics.withPhotos})</Link>
              <Link aria-current={filters.type === "videos" ? "page" : undefined} className={filters.type === "videos" ? styles.selectedTab : ""} href={paramsFor({ type: "videos", page: 1 })}>Com vídeos ({metrics.withVideos})</Link>
            </div>

            <form className={styles.filters} method="get">
              <label className={styles.search}>
                <DashboardIcon name="search" />
                <span className={styles.srOnly}>Buscar</span>
                <input type="search" name="busca" defaultValue={filters.search} placeholder="Buscar por nome ou tag…" />
              </label>
              <label>
                <span className={styles.srOnly}>Tipo de participação</span>
                <select name="tipo" defaultValue={filters.type}>
                  <option value="todos">Todos</option>
                  <option value="fotos">Com fotos</option>
                  <option value="videos">Com vídeos</option>
                </select>
              </label>
              <label>
                <span className={styles.srOnly}>Ordenar por</span>
                <select name="ordem" defaultValue={filters.order}>
                  <option value="recentes">Mais recentes</option>
                  <option value="midias">Mais mídias</option>
                  <option value="curtidas">Mais curtidas</option>
                </select>
              </label>
              <button type="submit">Aplicar filtros</button>
              {(filters.search || filters.type !== "todos" || filters.order !== "recentes") && (
                <Link className={styles.clear} href={`/eventos/${event.id}/convidados`}>Limpar</Link>
              )}
            </form>

            <div className={styles.directoryHeader}>
              <div>
                <h2 id="directory-title">Participações por nome informado</h2>
                <p>{filteredCount} {filteredCount === 1 ? "resultado" : "resultados"} · dados derivados dos registros publicados</p>
              </div>
            </div>
            <p className={styles.disclaimer}>
              <DashboardIcon name="info" />
              Os nomes são informados no momento do envio e podem se repetir ou representar pessoas diferentes.
            </p>

            {participations.length ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Nome informado</th><th>Participação</th><th>Mídias</th><th>Último registro</th><th>Tags</th><th>Ação</th></tr></thead>
                    <tbody>{participations.map((item) => (
                      <tr key={normalizeParticipationName(item.name)}>
                        <td><span className={styles.initials} aria-hidden="true">{initials(item.name)}</span><strong>{item.name}</strong></td>
                        <td><span className={styles.status}><i aria-hidden="true" />Registros publicados</span><small>{item.photoCount} fotos · {item.videoCount} vídeos</small></td>
                        <td><b>{item.mediaCount}</b></td>
                        <td><time dateTime={item.latestAt}>{dateLabel(item.latestAt)}</time></td>
                        <td><TagList tags={item.tags} /></td>
                        <td><Link className={styles.viewLink} href={`/eventos/${event.id}/fotos?autor=${encodeURIComponent(item.name)}`}>Ver registros</Link></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <ol className={styles.mobileList}>{participations.map((item) => (
                  <li key={normalizeParticipationName(item.name)}>
                    <div><span className={styles.initials} aria-hidden="true">{initials(item.name)}</span><div><strong>{item.name}</strong><small>{item.photoCount} fotos · {item.videoCount} vídeos</small></div></div>
                    <dl><div><dt>Mídias</dt><dd>{item.mediaCount}</dd></div><div><dt>Último registro</dt><dd><time dateTime={item.latestAt}>{dateLabel(item.latestAt)}</time></dd></div></dl>
                    <TagList tags={item.tags} />
                    <Link className={styles.viewLink} href={`/eventos/${event.id}/fotos?autor=${encodeURIComponent(item.name)}`}>Ver registros</Link>
                  </li>
                ))}</ol>
              </>
            ) : (
              <div className={styles.empty}>
                <DashboardIcon name="people" />
                <h3>Nenhuma participação encontrada</h3>
                <p>{filters.search || filters.type !== "todos" ? "Nenhum nome corresponde aos filtros aplicados." : "Os nomes aparecerão após a sincronização de registros com autoria."}</p>
                {(filters.search || filters.type !== "todos") && <Link href={`/eventos/${event.id}/convidados`}>Limpar filtros</Link>}
              </div>
            )}

            {filters.totalPages > 1 && (
              <nav className={styles.pagination} aria-label="Paginação das participações">
                {filters.page === 1 ? <span className={styles.disabledPage}>← Anterior</span> : <Link href={paramsFor({ page: filters.page - 1 })}>← Anterior</Link>}
                <span>Página {filters.page} de {filters.totalPages}</span>
                {filters.page === filters.totalPages ? <span className={styles.disabledPage}>Próxima →</span> : <Link href={paramsFor({ page: filters.page + 1 })}>Próxima →</Link>}
              </nav>
            )}
          </section>

          <aside className={styles.sideCards} aria-label="Informações sobre participação">
            <section className={styles.participationCard}>
              <h2>Participação no álbum</h2>
              <p>Os registros enviados aparecem aqui após cada sincronização.</p>
              <dl><div><dt>Nomes informados</dt><dd>{metrics.identifiedNames}</dd></div><div><dt>Sessões registradas</dt><dd>{metrics.guestSessions ?? "—"}</dd></div></dl>
              <span>Convites e compartilhamento serão liberados em breve.</span>
            </section>
            <section className={styles.tipsCard}>
              <h2>Como os dados são calculados</h2>
              <ul><li>Autores vêm dos nomes informados nos envios</li><li>Sessões são acessos agregados ao álbum</li><li>Curtidas e mídias usam apenas registros visíveis</li></ul>
            </section>
            <blockquote className={styles.quote}>Quanto mais registros, mais histórias para lembrar.</blockquote>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, value, label, hint }: { icon: "people" | "image" | "eye" | "heart"; value: number | string; label: string; hint?: string }) {
  return <div className={styles.metric}><DashboardIcon name={icon} /><div><dt>{value}</dt><dd>{label}</dd>{hint && <small>{hint}</small>}</div></div>;
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className={styles.noTags}>Sem tags</span>;
  return (
    <span className={styles.tagList}>
      {tags.slice(0, 2).map((tag) => (
        <span key={tag}>#{tag}</span>
      ))}
      {tags.length > 2 && <span>+{tags.length - 2}</span>}
    </span>
  );
}
