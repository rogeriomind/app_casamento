"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { LoginIcon } from "@/features/auth/components/login-icons";
import { colorValues } from "@/lib/event-constants";
import { jsonOptions, requestJson } from "@/lib/client-api";
import { WizardFrame } from "./wizard-frame";
import { EventIcon } from "./event-icon";
import { useDraft, type Draft } from "./use-draft";
import styles from "./event-wizard.module.css";
const colorNames = ["Azul-marinho", "Verde", "Coral", "Areia", "Lavanda", "Preto"];
export function PersonalizationStep({ draft }: { draft: Draft }) {
  const router = useRouter();
  const form = useDraft(draft.id, "color", { albumColor: draft.albumColor });
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(draft.coverPath ? "/api/eventos/" + draft.id + "/capa" : "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = "";
    setError(""); setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Envie uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("A capa deve ter no máximo 5 MB."); return; }
    setUploading(true);
    try {
      const body = new FormData(); body.append("cover", file);
      const result = await requestJson<{ coverUrl: string }>("/api/eventos/" + draft.id + "/capa", { method: "POST", body });
      setPreview(result.coverUrl); setMessage("Capa adicionada.");
    } catch (e) { setError((e as Error).message); }
    finally { setUploading(false); }
  }
  async function navigate(mode: "back" | "create" | "defaults") {
    if (busy || uploading) return; setBusy(true); setError("");
    try {
      await form.flush();
      if (mode === "back") { router.push("/eventos/novo/informacoes"); return; }
      await requestJson("/api/eventos/" + draft.id + "/concluir", jsonOptions("POST", { useDefaults: mode === "defaults", albumColor: form.value.albumColor }));
      router.push("/eventos/" + draft.id + "/criado");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <WizardFrame step={3}><section className={styles.content}>
    <h1>Deixe com<br />a sua cara.</h1>
    <p className={styles.subtitle}>Escolha uma capa e uma cor para o seu álbum.<br />Você pode personalizar depois.</p>
    <div className={styles.personalization}>
      <p className={styles.label}>Foto de capa</p>
      <input ref={fileRef} aria-label="Foto de capa" className={styles.fileInput} disabled={busy || uploading} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
      <button className={styles.upload} aria-label={preview ? "Trocar foto de capa" : "Adicionar foto de capa"} disabled={busy || uploading} type="button" onClick={() => fileRef.current?.click()}>
        {preview ? <><img src={preview} alt="Prévia da capa" /><span className={styles.replaceCover}>Trocar foto de capa</span></> : <><EventIcon name="plus" /><span>{uploading ? "Enviando capa..." : "Adicionar foto de capa"}<small>JPG, PNG ou WEBP (máx. 5MB)</small></span></>}
      </button>
      <p className={styles.label}>Cor do álbum</p>
      <div className={styles.colors}>{colorValues.map((value, index) =>
        <button key={value} disabled={busy} title={colorNames[index]} aria-label={"Selecionar cor " + value} aria-pressed={form.value.albumColor === value} type="button" className={form.value.albumColor === value ? styles.currentColor : ""} style={{ background: value }} onClick={() => form.change({ albumColor: value })}>{form.value.albumColor === value && <EventIcon name="check" />}</button>
      )}</div>
    </div>
    {(error || form.error) && <p className={styles.error} role="alert">{error || form.error}</p>}
    <p className={styles.saveStatus} role="status">{uploading ? "Enviando capa..." : message || form.status}</p>
  </section><footer className={styles.footer}>
    <button className={styles.back} disabled={busy || uploading} type="button" onClick={() => navigate("back")}>← Voltar</button>
    <button className={styles.later} disabled={busy || uploading} type="button" onClick={() => navigate("defaults")}>Personalizar depois</button>
    <button className={styles.primary} disabled={busy || uploading} type="button" onClick={() => navigate("create")}>{busy ? "Criando..." : "Criar meu álbum"}<LoginIcon name="arrow" /></button>
  </footer></WizardFrame>;
}
