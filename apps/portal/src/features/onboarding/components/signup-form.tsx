"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { requestJson, jsonOptions } from "@/lib/client-api";
import { GoogleMark, LoginIcon } from "@/features/auth/components/login-icons";
import styles from "./onboarding.module.css";

type Errors = { name: string; email: string; password: string; form: string };

export function SignupForm() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({ name: "", email: "", password: "", form: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const name = nameRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value.trim().toLowerCase() ?? "";
    const password = passwordRef.current?.value ?? "";
    const next = {
      name: name ? "" : "Informe seu nome.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Informe um e-mail válido.",
      password: password.length >= 8 ? "" : "A senha precisa ter pelo menos 8 caracteres.",
      form: "",
    };
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    setIsSubmitting(true);
    try {
      await requestJson("/api/cadastro", jsonOptions("POST", { name, email, password }));
      router.push("/cadastro/confirmar-email");
    } catch (error) {
      setErrors((current) => ({ ...current, form: (error as Error).message }));
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.field}>
        <label htmlFor="signup-name">Nome</label>
        <div className={`${styles.inputWrap} ${errors.name ? styles.inputError : ""}`}>
          <LoginIcon name="people" /><input ref={nameRef} id="signup-name" name="name" autoComplete="name" placeholder="Como podemos te chamar?" onChange={() => errors.name && setErrors((old) => ({ ...old, name: "" }))} />
        </div>
        {errors.name && <p className={styles.error} role="alert">{errors.name}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="signup-email">E-mail</label>
        <div className={`${styles.inputWrap} ${errors.email ? styles.inputError : ""}`}>
          <LoginIcon name="mail" /><input ref={emailRef} id="signup-email" name="email" type="email" autoComplete="email" placeholder="seu@email.com" onChange={() => errors.email && setErrors((old) => ({ ...old, email: "" }))} />
        </div>
        {errors.email && <p className={styles.error} role="alert">{errors.email}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="signup-password">Senha</label>
        <div className={`${styles.inputWrap} ${errors.password ? styles.inputError : ""}`}>
          <LoginIcon name="lock" /><input ref={passwordRef} id="signup-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Crie uma senha" onChange={() => errors.password && setErrors((old) => ({ ...old, password: "" }))} />
          <button className={styles.iconButton} type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((current) => !current)}><LoginIcon name={showPassword ? "eye-off" : "eye"} /></button>
        </div>
        {errors.password ? <p className={styles.error} role="alert">{errors.password}</p> : <p className={styles.hint}>Mínimo de 8 caracteres</p>}
      </div>
      {errors.form && <p className={styles.error} role="alert">{errors.form}</p>}
      <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>{isSubmitting ? "Criando conta..." : "Criar minha conta"}<LoginIcon name="arrow" /></button>
      <div className={styles.divider}><span />ou<span /></div>
      <button className={styles.googleButton} type="button"><GoogleMark />Entrar com Google</button>
      <p className={styles.accountPrompt}>Já tem uma conta? <Link href="/login">Entrar</Link></p>
    </form>
  );
}
