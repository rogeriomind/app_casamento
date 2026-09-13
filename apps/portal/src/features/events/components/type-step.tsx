"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginIcon } from "@/features/auth/components/login-icons";
import { WizardFrame } from "./wizard-frame";
import { EventIcon } from "./event-icon";
import { useDraft, type Draft } from "./use-draft";
import styles from "./event-wizard.module.css";
const types = [
  ["WEDDING", "Casamento", "ring"], ["BIRTHDAY", "Aniversário", "cake"], ["GRADUATION", "Formatura", "graduation"],
  ["GATHERING", "Confraternização", "toast"], ["CORPORATE", "Corporativo", "briefcase"], ["OTHER", "Outro", "sparkle"],
] as const;
export function TypeStep({ draft }: { draft: Draft }) {
  const router = useRouter();
  const form = useDraft(draft.id, "type", { type: draft.type });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function navigate(next: boolean) {
    if (busy) return;
    if (next && !form.value.type) { setError("Escolha o tipo de evento para continuar."); return; }
    setBusy(true); setError("");
    try { await form.flush(); router.push(next ? "/eventos/novo/informacoes" : "/cadastro/concluido"); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <WizardFrame step={1}><section className={styles.content}>
    <h1>O que vamos<br />celebrar?</h1>
    <p className={styles.subtitle}>Escolha o tipo de evento para personalizarmos<br className={styles.desktopOnly} /> sua experiência.</p>
    <div className={styles.typeGrid}>{types.map(([value, label, icon]) =>
      <button key={value} disabled={busy} type="button" aria-pressed={form.value.type === value} className={`${styles.typeCard} ${form.value.type === value ? styles.selected : ""}`} onClick={() => { form.change({ type: value }); setError(""); }}>
        <EventIcon name={icon} /><span>{label}</span>
      </button>)}</div>
    {(error || form.error) && <p className={styles.error} role="alert">{error || form.error}</p>}
    <p className={styles.saveStatus} role="status">{form.status}</p>
  </section><footer className={styles.footer}>
    <button className={styles.back} disabled={busy} type="button" onClick={() => navigate(false)}>← Voltar</button>
    <button className={styles.primary} disabled={busy} type="button" onClick={() => navigate(true)}>{busy ? "Salvando..." : "Continuar"}<LoginIcon name="arrow" /></button>
  </footer></WizardFrame>;
}
