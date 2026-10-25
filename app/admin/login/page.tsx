import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { isAdministratorConfigured } from "@/lib/admin/password";
import { isDatabaseConfigured } from "@/lib/db";
import { getAdministratorSession } from "@/lib/admin/access";
import { AdministratorLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Administrator sign in | Mithai House",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdministratorLoginPage() {
  if (await getAdministratorSession()) redirect("/admin" as Route);
  const configured = isAdministratorConfigured() && isDatabaseConfigured();

  return (
    <main className="min-h-screen bg-ivory px-5 py-16 text-brown">
      <section className="mx-auto max-w-md border border-gold/50 bg-white p-7 sm:p-10">
        <p className="eyebrow">Private shop access</p>
        <h1 className="mt-3 font-display text-3xl">Administrator sign in</h1>
        {!configured ? (
          <p role="status" className="mt-5 border-l-2 border-saffron pl-4 text-sm leading-6">
            Administrator access requires AUTH_SECRET, the pre-provisioned
            administrator email and password hash, DATABASE_URL, and the
            administrator database migration. Public registration is disabled.
          </p>
        ) : (
          <AdministratorLoginForm />
        )}
        <Link href="/" className="mt-7 inline-block text-sm underline underline-offset-4">
          Return to storefront
        </Link>
      </section>
    </main>
  );
}
