import type { SVGProps } from "react";

type IconName = "camera" | "people" | "image" | "heart" | "mail" | "lock" | "eye" | "eye-off" | "arrow" | "external";

export function LoginIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    camera: <><path d="M8 5.5 9.5 3h5L16 5.5h3.5A2.5 2.5 0 0 1 22 8v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2.5 2.5 0 0 1 2.5-2.5Z" /><circle cx="12" cy="13" r="4" /><path d="M18 9h.01" /></>,
    people: <><circle cx="10" cy="7" r="4" /><path d="M2 21v-2a8 8 0 0 1 16 0v2M17 3.5a4 4 0 0 1 0 7.5M22 21v-2a8 8 0 0 0-5-7.4" /></>,
    image: <><rect x="2" y="3" width="20" height="18" rx="2" /><circle cx="16.5" cy="8.5" r="1" /><path d="m2 16 5-5 4 4 3-3 8 7" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="1.5" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v2" /><circle cx="12" cy="14.5" r=".7" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    "eye-off": <><path d="m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3.1 3.9M6.1 6.1A20 20 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5.8-1.7M10 10a3 3 0 0 0 4 4" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    external: <><path d="M14 3h7v7m0-7L11 13M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /></>,
  };

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285f4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.43h11a9.4 9.4 0 0 1-4.08 6.18v5.14h6.61c3.87-3.56 6.08-8.81 6.08-14.83Z" />
      <path fill="#34a853" d="M24 44c5.51 0 10.13-1.83 13.5-4.97l-6.61-5.14C29.06 35.13 26.71 35.88 24 35.88c-5.32 0-9.85-3.6-11.47-8.45H5.71v5.3A20.4 20.4 0 0 0 24 44Z" />
      <path fill="#fbbc05" d="M12.53 27.43a12.3 12.3 0 0 1 0-7.86v-5.3H5.71a20.3 20.3 0 0 0 0 18.46Z" />
      <path fill="#ea4335" d="M24 11.12c3.02 0 5.71 1.04 7.85 3.1l5.89-5.89A19.64 19.64 0 0 0 24 3a20.4 20.4 0 0 0-18.29 11.27l6.82 5.3c1.62-4.85 6.15-8.45 11.47-8.45Z" />
    </svg>
  );
}
