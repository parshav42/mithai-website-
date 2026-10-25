import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isAdministratorConfigured, verifyAdminPassword } from "./lib/admin/password.ts";
import {
  clearAdministratorLoginAttempts,
  reserveAdministratorLoginAttempt,
} from "./lib/admin/login-limit.ts";

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: { signIn: "/admin/login" },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [
    Credentials({
      credentials: {
        email: { label: "Administrator email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          !isAdministratorConfigured() ||
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string" ||
          credentials.password.length > 1024
        ) {
          return null;
        }

        const configuredEmail = process.env.ADMIN_EMAIL!.trim().toLowerCase();
        const submittedEmail = credentials.email.trim().toLowerCase();
        if (!(await reserveAdministratorLoginAttempt(configuredEmail))) return null;
        const passwordMatches = await verifyAdminPassword(
          credentials.password,
          process.env.ADMIN_PASSWORD_HASH!,
        );
        if (submittedEmail !== configuredEmail || !passwordMatches) return null;
        await clearAdministratorLoginAttempts(configuredEmail);

        return {
          id: "shop-administrator",
          email: configuredEmail,
          name: "Shop administrator",
          role: "admin",
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.role === "admin") token.role = "admin";
      return token;
    },
    session({ session, token }) {
      if (session.user && token.role === "admin") session.user.role = "admin";
      return session;
    },
  },
});
