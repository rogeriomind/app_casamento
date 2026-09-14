"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/features/auth/components/brand";
import { DashboardIcon } from "./dashboard-icon";
import { ProfileLogout } from "./profile-logout";
import styles from "./album-sidebar.module.css";

const items = [
  { id: "dashboard", label: "Dashboard", icon: "album" as const, path: "" },
  { id: "photos", label: "Fotos", icon: "image" as const, path: "/fotos" },
  { id: "guests", label: "Convidados", icon: "people" as const, path: "/convidados" },
  { id: "settings", label: "Configurações", icon: "settings" as const, path: "/configuracoes" },
] as const;

function PendingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? <span className={styles.pending} aria-label="Carregando seção" /> : null;
}

export function AlbumSidebar({ eventId, userName }: { eventId: string; userName: string }) {
  const pathname = usePathname();
  const firstName = userName.trim().split(/\s+/)[0] || "por aqui";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandLockup}>
        <Brand />
        <p>Mais que fotos, momentos que ficam.</p>
      </div>

      <nav className={styles.navigation} aria-label="Seções do álbum">
        {items.map((item) => {
          const href = `/eventos/${eventId}${item.path}`;
          const isActive = item.path ? pathname.startsWith(href) : pathname === href;
          return (
            <Link key={item.id} className={isActive ? styles.activeNav : styles.navItem} href={href} aria-current={isActive ? "page" : undefined} aria-label={item.label}>
              <DashboardIcon name={item.icon} /><span>{item.label}</span><PendingIndicator />{isActive && <i aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarProfile}>
          <div className={styles.avatar} aria-hidden="true">{firstName.slice(0, 1).toUpperCase()}</div>
          <div className={styles.profileIdentity}>
            <span>Conta do álbum</span>
            <strong title={userName}>{firstName}</strong>
          </div>
        </div>
        <ProfileLogout userName={firstName} styles={styles} />
      </div>
    </aside>
  );
}
