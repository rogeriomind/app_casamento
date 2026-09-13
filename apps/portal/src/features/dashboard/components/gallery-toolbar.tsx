"use client";

import { useRef } from "react";
import { DashboardIcon } from "./dashboard-icon";
import styles from "./album-gallery.module.css";

type Props = {
  action: string;
  search: string;
  type: "todos" | "fotos" | "videos";
  period: "todas" | "7d" | "30d" | "mes";
  tag: string | null;
  order: "recentes" | "antigas" | "curtidas";
  preserved: { scope: "todas" | "envios" | "favoritos"; view: "grade" | "lista"; author: string | null };
};

export function GalleryToolbar({ action, search, type, period, tag, order, preserved }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const applySelect = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} className={styles.toolbar} action={action} method="get" role="search">
      {preserved.scope !== "todas" && <input type="hidden" name="aba" value={preserved.scope} />}
      {preserved.view !== "grade" && <input type="hidden" name="visualizacao" value={preserved.view} />}
      {preserved.author && <input type="hidden" name="autor" value={preserved.author} />}
      {tag && <input type="hidden" name="tag" value={tag} />}

      <label className={styles.searchField}>
        <DashboardIcon name="search" />
        <span className={styles.srOnly}>Buscar memórias</span>
        <input name="busca" type="search" defaultValue={search} maxLength={120} placeholder="Buscar por data, nome informado ou tag…" />
      </label>

      <label className={styles.selectField}>
        <span className={styles.srOnly}>Tipo de mídia</span>
        <select name="tipo" defaultValue={type} onChange={applySelect}>
          <option value="todos">Todas as mídias</option>
          <option value="fotos">Somente fotos</option>
          <option value="videos">Somente vídeos</option>
        </select>
        <DashboardIcon name="chevron" />
      </label>

      <label className={styles.selectField}>
        <span className={styles.srOnly}>Período</span>
        <select name="periodo" defaultValue={period} onChange={applySelect}>
          <option value="todas">Todas as datas</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="mes">Este mês</option>
        </select>
        <DashboardIcon name="chevron" />
      </label>

      <label className={styles.selectField}>
        <span className={styles.srOnly}>Ordenação</span>
        <select name="ordem" defaultValue={order} onChange={applySelect}>
          <option value="recentes">Mais recentes</option>
          <option value="antigas">Mais antigas</option>
          <option value="curtidas">Mais curtidas</option>
        </select>
        <DashboardIcon name="chevron" />
      </label>

      <button className={styles.srOnly} type="submit">Aplicar busca e filtros</button>
    </form>
  );
}
