import type { ReactNode } from "react";
export function EventIcon({ name }: { name: string }) {
  const shapes: Record<string, ReactNode> = {
    ring: <><circle cx="12" cy="15" r="6.5" /><path d="m9 8-1-4 4-2 4 2-1 4M8 4h8m-4-2v6" /></>,
    cake: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M4 15c2 3 3-2 5 0s3-2 5 0 4 1 6-1M8 11V7m8 4V7M8 4V2m8 2V2M3 21h18" /></>,
    graduation: <><path d="m2 8 10-5 10 5-10 5L2 8ZM6 10v7c2 3 10 3 12 0v-7M22 8v7" /></>,
    toast: <><path d="m4 5 6 2-2 6c-2 3-6 1-5-2l1-6Zm16 0-6 2 2 6c2 3 6 1 5-2l-1-6ZM5 14l-2 6m-2-1 5 2m13-7 2 6m2-1-5 2M4 9l5 2m6 0 5-2M12 2v2m-4-2 1 2m7-2-1 2" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3" /></>,
    sparkle: <><path d="m8 2 2 4-2 4-3-4 3-4Zm10 8 2 4-2 4-3-4 3-4ZM7 14l2 4-2 4-3-4 3-4Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4m8-4v4" /></>,
    party: <><path d="m3 21 5-16 11 11L3 21Z" /><path d="m9 5 10 11M14 2v3m7 1-3 3m4 5-3-1M7 1l1 2" /></>,
    check: <path d="m5 12 5 5L20 7" />,
    plus: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 12h8m-4-4v8" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}
