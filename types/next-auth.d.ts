import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "admin";
  }

  interface Session {
    user: DefaultSession["user"] & {
      role?: "admin";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin";
  }
}
