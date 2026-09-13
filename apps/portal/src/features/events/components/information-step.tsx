"use client";
import { useState, type FormEvent } from "react";
import { LoginIcon } from "@/features/auth/components/login-icons";
import { eventInformationSchema } from "@/lib/validation";
import { WizardFrame } from "./wizard-frame";
import { EventIcon } from "./event-icon";
import { useDraft, type Draft } from "./use-draft";
import styles from "./event-wizard.module.css";
export function InformationStep({ draft }: { draft: Draft }) {
  const form = useDraft(draft.id, "information", { name: draft.name ?? "", eventDate: draft.eventDate?.slice(0, 10) ?? "", description: draft.description ?? "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function navigate(next: boolean, event?: FormEvent) {
    event?.preventDefault(); if (busy) return; setError("");
    if (next) {
      const result = eventInformationSchema.safeParse(form.value);
      if (!result.success) { setError(result.error.issues[0].message); document.getElementById("event-" + String(result.error.issues[0].path[0]))?.focus(); return; }
    }
    setBusy(true);
    try { await form.flush(); window.location.assign(next ? "/eventos/novo/personalizacao" : "/eventos/novo/tipo"); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <WizardFrame step={2}><form className={styles.stepForm} onSubmit={(event) => navigate(true, event)} noValidate>
    <section className={styles.content}><h1>Dê um nome<br />a esse momento.</h1>
      <div className={styles.fields}>
        <label htmlFor="event-name">Nome do evento</label>
        <input id="event-name" disabled={busy} value={form.value.name} maxLength={120} onChange={(e) => form.change({ ...form.value, name: e.target.value })} placeholder="Ex.: Aniversário da Ana" required />
        <label htmlFor="event-eventDate">Data do evento</label>
        <div className={styles.dateWrap}><EventIcon name="calendar" /><input id="event-eventDate" disabled={busy} value={form.value.eventDate} onChange={(e) => form.change({ ...form.value, eventDate: e.target.value })} type="date" required /></div>
        <label htmlFor="event-description">Descrição <span>(opcional)</span></label>
        <textarea id="event-description" disabled={busy} aria-label="Descrição" value={form.value.description} maxLength={300} onChange={(e) => form.change({ ...form.value, description: e.target.value })} placeholder="Conte um pouquinho sobre esse momento..." />
        <p className={styles.counter}>{form.value.description.length}/300</p>
      </div>
      {(error || form.error) && <p className={styles.error} role="alert">{error || form.error}</p>}
      <p className={styles.saveStatus} role="status">{form.status}</p>
    </section><footer className={styles.footer}>
      <button className={styles.back} disabled={busy} type="button" onClick={() => navigate(false)}>← Voltar</button>
      <button className={styles.primary} disabled={busy} type="submit">{busy ? "Salvando..." : "Continuar"}<LoginIcon name="arrow" /></button>
    </footer>
  </form></WizardFrame>;
}
