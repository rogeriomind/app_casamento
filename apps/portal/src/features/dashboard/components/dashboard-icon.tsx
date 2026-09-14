import type { SVGProps } from "react";

type IconName = "album" | "camera" | "people" | "heart" | "send" | "image" | "bell" | "settings" | "logout" | "arrow" | "spark" | "play" | "eye" | "search" | "info" | "grid" | "list" | "sort" | "chevron" | "calendar" | "qr" | "card" | "pencil" | "message" | "pin" | "plus" | "check" | "phone" | "desktop" | "external" | "menu";

export function DashboardIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    album: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 14 3-3 2.5 2.5 2-2 2.5 2.5M8 8h.01" /></>,
    camera: <><path d="m5 7 1.6-2h4.8L13 7h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="11" cy="13" r="3" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1.3a6 6 0 0 1 12 0V20M16 5.5a3 3 0 0 1 0 5.7M21 20v-1.3a6 6 0 0 0-3.5-5.5" /></>,
    heart: <path d="M20.7 4.8a5.5 5.5 0 0 0-7.7 0L12 5.9l-1.1-1.1a5.5 5.5 0 1 0-7.7 7.8l1.1 1L12 21l7.7-7.4 1.1-1a5.5 5.5 0 0 0-.1-7.8Z" />,
    send: <><path d="m21 3-7.2 18-3.7-7.3L3 10.2 21 3Z" /><path d="m10.1 13.8 4.1-4.1" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="16" cy="9" r="1.2" /><path d="m4 17 5-5 3.4 3.4 2.1-2.1 5.5 5.5" /></>,
    bell: <><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2.2 2.2-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2h-3.2v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1-2.2-2.2.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H5v-3.2h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1 2.2-2.2.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3.6h3.2v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1 2.2 2.2-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2V14h-.2a1.6 1.6 0 0 0-1.4 1Z" /></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M18 12H8" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    spark: <path d="m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2Z" />,
    play: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    sort: <><path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3" /></>,
    chevron: <path d="m7 9 5 5 5-5" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    qr: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h2v2h-2zM19 14h1v4h-2M14 19h3v1M19 20h1" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    pencil: <><path d="m4 20 4.2-1 10.5-10.5a2.2 2.2 0 0 0-3.1-3.1L5.1 15.9 4 20Z" /><path d="m13.8 7.2 3.1 3.1" /></>,
    message: <path d="M21 11.5a8.2 8.2 0 0 1-8.5 8 9.5 9.5 0 0 1-4.1-.9L3 20l1.5-4.3A7.7 7.7 0 0 1 4 13a8.2 8.2 0 0 1 8.5-8A8.2 8.2 0 0 1 21 11.5Z" />,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M10 5h4M11 19h2" /></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  };

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
