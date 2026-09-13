"use client";
import Link from "next/link";
import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { requestJson, jsonOptions } from "@/lib/client-api";
import { LoginIcon } from "@/features/auth/components/login-icons";
import styles from "./onboarding.module.css";

const normalized = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
export function VerificationForm({ initialEmail }: { initialEmail: string }) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nextEmail, setNextEmail] = useState(initialEmail);
  const focus = (index: number) => { inputs.current[index]?.focus(); inputs.current[index]?.select(); };
  function write(index: number, raw: string) {
    const chars = normalized(raw).slice(0, 6 - index).split("");
    const next = [...code];
    if (!raw) next[index] = "";
    else chars.forEach((char, offset) => { next[index + offset] = char; });
    setCode(next); setError("");
    if (chars.length) focus(Math.min(index + chars.length, 5));
  }
  function paste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    event.preventDefault();
    const value = normalized(event.clipboardData.getData("text"));
    write(value.length === 6 ? 0 : index, value);
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      event.preventDefault();
      setCode((old) => old.map((v, i) => i === index - 1 ? "" : v)); focus(index - 1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); focus(Math.max(0, Math.min(5, index + (event.key === "ArrowLeft" ? -1 : 1))));
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (code.join("").length !== 6) { setError("Informe os seis caracteres do código."); focus(code.findIndex((c) => !c)); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: code.join("") });
      if (result.error) throw new Error("Código inválido ou expirado. Reenvie o código e tente novamente.");
      // Confirmation already succeeded even if clearing the temporary cookie fails.
      await fetch("/api/cadastro/pendente", { method: "DELETE" }).catch(() => {});
      window.location.assign("/cadastro/concluido");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  async function resend() {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (result.error) throw new Error("Não foi possível reenviar agora. Aguarde um momento e tente novamente.");
      setCode(Array(6).fill("")); setMessage("Código reenviado. Verifique sua caixa de entrada."); focus(0);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function saveEmail(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await requestJson<{ email: string }>("/api/cadastro/alterar-email", jsonOptions("PATCH", { email: nextEmail }));
      setEmail(result.email); setEditing(false); setCode(Array(6).fill(""));
      setMessage("E-mail alterado. Enviamos um novo código para sua caixa de entrada.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <div className={styles.mailIllustration}><LoginIcon name="mail" /><i /></div>
    <h1 className={styles.title}>Só falta<br />um detalhe.</h1>
    {editing ? <form className={styles.changeEmail} onSubmit={saveEmail} noValidate>
      <label htmlFor="correct-email">Corrija seu e-mail</label>
      <input id="correct-email" autoFocus value={nextEmail} onChange={(e) => setNextEmail(e.target.value)} type="email" autoComplete="email" />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primaryButton} disabled={busy} type="submit">{busy ? "Salvando..." : "Salvar e reenviar"}<LoginIcon name="arrow" /></button>
      <button className={styles.skipLink} disabled={busy} type="button" onClick={() => { setEditing(false); setError(""); }}>Cancelar</button>
    </form> : <>
      <p className={styles.lead}>Enviamos um código para<br /><strong>{email}</strong></p>
      <p className={styles.hint}>Digite o código de seis caracteres enviado para seu e-mail.</p>
      <form className={styles.verifyForm} onSubmit={submit}>
        <div className={styles.codeFields} aria-label="Código de confirmação">
          {code.map((value, index) => <input key={index} ref={(el) => { inputs.current[index] = el; }} aria-label={`Caractere ${index + 1} do código`} value={value} autoComplete={index === 0 ? "one-time-code" : "off"} inputMode="text" maxLength={6} onFocus={(e) => e.currentTarget.select()} onChange={(e) => write(index, e.target.value)} onPaste={(e) => paste(e, index)} onKeyDown={(e) => keyDown(e, index)} />)}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {message && <p className={styles.success} role="status">{message}</p>}
        <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Aguarde..." : "Confirmar e-mail"}<LoginIcon name="arrow" /></button>
      </form>
      <div className={styles.verificationLinks}>
        <p>Não recebeu? <button type="button" disabled={busy} onClick={resend}>Reenviar código</button></p>
        <p>Digitou o e-mail errado? <button type="button" disabled={busy} onClick={() => { setEditing(true); setError(""); setNextEmail(email); }}>Alterar</button></p>
        <Link href="/login">Voltar para entrar</Link>
      </div>
    </>}
  </>;
}
