import "server-only";
import nodemailer from "nodemailer";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "./prisma";

const authUrl = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
const localMock = ["127.0.0.1", "localhost"].includes(new URL(authUrl).hostname) && !!process.env.MOCK_EMAIL_CODE;
const trustedOrigins = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3001",
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
];

function smtpTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from) {
    throw new Error("SMTP_HOST, SMTP_PORT e SMTP_FROM precisam estar configurados.");
  }
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user && password ? { user, pass: password } : undefined,
  });
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      generateOTP: () => localMock ? process.env.MOCK_EMAIL_CODE! : undefined,
      expiresIn: 60 * 10,
      allowedAttempts: 5,
      rateLimit: { window: 60, max: localMock ? 60 : 3 },
      async sendVerificationOTP({ email, otp, type }) {
        if (localMock) return;
        const subject = type === "email-verification" ? "Confirme seu e-mail no Nosso Álbum" : "Seu código do Nosso Álbum";
        await smtpTransport().sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject,
          text: `Seu código de confirmação é ${otp}. Ele expira em 10 minutos.`,
          html: `<p>Seu código de confirmação é <strong>${otp}</strong>.</p><p>Ele expira em 10 minutos.</p>`,
        });
      },
    }),
    nextCookies(),
  ],
});
