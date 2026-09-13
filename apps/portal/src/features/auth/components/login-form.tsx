"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { requestJson, jsonOptions } from "@/lib/client-api";
import { GoogleMark, LoginIcon } from "./login-icons";
import styles from "./login.module.css";

export function LoginForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "", form: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingSignup, setIsStartingSignup] = useState(false);
  const [availability, setAvailability] = useState("");

  useEffect(() => { router.prefetch("/cadastro?nova-conta=1"); }, [router]);

  function startSignup() {
    if (isStartingSignup) return;
    setIsStartingSignup(true);
    setErrors((current) => ({ ...current, form: "" }));
    // A jornada de nova conta não deve encerrar a sessão atual antes de a
    // pessoa efetivamente concluir outro cadastro. O parâmetro permite que a
    // página de cadastro não redirecione uma sessão já autenticada para a
    // tela de conclusão da conta existente.
    router.push("/cadastro?nova-conta=1");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    const nextErrors = {
      email: email ? "" : "Informe seu e-mail.",
      password: password ? "" : "Informe sua senha.",
      form: "",
    };
    setErrors(nextErrors);

    if (nextErrors.email) emailRef.current?.focus();
    else if (nextErrors.password) passwordRef.current?.focus();
    else {
      setIsSubmitting(true);
      try {
      const { error } = await authClient.signIn.email({ email, password });

      if (error) {
        // Better Auth has returned different error payload shapes across minor
        // releases. The resume endpoint verifies the password again and is a
        // safe fallback for an unconfirmed account.
        const resumed = await requestJson("/api/cadastro/pendente", jsonOptions("POST", { email, password }))
          .then(() => true)
          .catch(() => false);
        if (error.code === "EMAIL_NOT_VERIFIED" || resumed) {
          if (!resumed) {
            setErrors((current) => ({ ...current, form: "Confirme seu e-mail antes de entrar." }));
            return;
          }
          router.replace("/cadastro/confirmar-email");
          return;
        }
        const message = error.message?.toLowerCase() ?? "";
        setErrors((current) => ({
          ...current,
          form: message.includes("verify") || message.includes("verifi")
            ? "Confirme seu e-mail antes de entrar."
            : "E-mail ou senha inválidos.",
        }));
        return;
      }

      router.replace("/logou");
      } catch (error) {
        setErrors((current) => ({ ...current, form: (error as Error).message }));
      } finally { setIsSubmitting(false); }
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="login-email">E-mail</label>
        <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ""}`}>
          <LoginIcon name="mail" />
          <input ref={emailRef} id="login-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} onChange={() => errors.email && setErrors((current) => ({ ...current, email: "" }))} />
        </div>
        {errors.email && <p className={styles.error} id="email-error" role="alert">{errors.email}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="login-password">Senha</label>
        <div className={`${styles.inputWrapper} ${errors.password ? styles.inputError : ""}`}>
          <LoginIcon name="lock" />
          <input ref={passwordRef} id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" required aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} onChange={() => errors.password && setErrors((current) => ({ ...current, password: "" }))} />
          <button className={styles.visibilityButton} type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}><LoginIcon name={showPassword ? "eye-off" : "eye"} /></button>
        </div>
        {errors.password && <p className={styles.error} id="password-error" role="alert">{errors.password}</p>}
      </div>

      <div className={styles.forgotRow}><button className={styles.textButton} type="button" onClick={() => setAvailability("A recuperação de senha ainda não está disponível. Use uma conta já cadastrada ou crie uma nova.")}>Esqueci minha senha</button></div>
      {errors.form && <p className={styles.error} role="alert">{errors.form}</p>}
      {availability && <p className={styles.availability} role="status">{availability}</p>}
      <button className={styles.submitButton} type="submit" disabled={isSubmitting}><span>{isSubmitting ? "Entrando..." : "Entrar"}</span><LoginIcon name="arrow" /></button>
      <div className={styles.divider}><span />ou<span /></div>
      <button className={styles.googleButton} type="button" onClick={() => setAvailability("A entrada com Google será disponibilizada em uma próxima etapa.")}><GoogleMark /><span>Entrar com Google</span><small>Em breve</small></button>
      <p className={styles.signup}>Ainda não tem uma conta? <button className={styles.textButton} type="button" onClick={startSignup} disabled={isStartingSignup}>{isStartingSignup ? "Abrindo cadastro..." : "Criar conta"}</button></p>
    </form>
  );
}
