import type { Metadata } from "next";
import "./globals.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/latin-900.css";
import "@fontsource/caveat/latin-500.css";

export const metadata: Metadata = {
  title: "Nosso Álbum",
  description: "Reúna as fotos dos seus eventos e reviva grandes momentos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
