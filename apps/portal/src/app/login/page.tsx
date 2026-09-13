import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = {
  title: "Entrar | Nosso Álbum",
};

export default function LoginPage() {
  return <AuthShell />;
}
