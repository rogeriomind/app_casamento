"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { DashboardIcon } from "./dashboard-icon";
import defaultStyles from "./dashboard.module.css";

type LogoutStyles = Readonly<Record<string, string>>;

export function ProfileLogout({ userName, styles = defaultStyles }: { userName: string; styles?: LogoutStyles }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setError("");
    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) throw new Error("Não foi possível sair da conta. Tente novamente.");
      window.location.assign("/login");
    } catch (logoutError) {
      setError((logoutError as Error).message);
      setIsLoggingOut(false);
    }
  }

  return <div className={styles.profileLogoutArea}>
    <button className={styles.profileLogout} type="button" onClick={logout} disabled={isLoggingOut} aria-label={`Sair da conta de ${userName}`}>
      <DashboardIcon name="logout" />
      <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
    </button>
    {error && <p className={styles.profileLogoutError} role="alert">{error}</p>}
  </div>;
}
