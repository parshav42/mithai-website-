import Link from "next/link";
import {
  Activity,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  PackageCheck,
  Settings,
  LogOut,
  FileText,
} from "lucide-react";
import { administratorSignOut } from "@/app/admin/actions";

const navigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/analytics", label: "Analytics", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  children,
  administrator,
}: {
  children: React.ReactNode;
  administrator: string;
}) {
  return (
    <div className="min-h-screen bg-[#f5eee2] text-brown">
      <header className="sticky top-0 z-20 border-b border-gold/40 bg-ivory">
        <div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-7">
          <Link href="/admin" className="font-display text-lg text-maroon">
            Mithai House <span className="text-xs text-brown/65">/ Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-52 truncate text-sm text-brown/70 sm:block">
              {administrator}
            </span>
            <form action={administratorSignOut}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 border border-maroon/30 px-3 text-sm font-medium text-maroon hover:bg-maroon hover:text-ivory focus-visible:outline-2 focus-visible:outline-saffron"
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Administrator navigation" className="border-t border-gold/25">
          <ul className="mx-auto flex max-w-[90rem] gap-1 overflow-x-auto px-3 sm:px-6">
            {navigation.map(({ href, label, icon: Icon }) => (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  className="flex min-h-12 items-center gap-2 border-b-2 border-transparent px-3 text-sm text-brown/75 hover:border-gold hover:text-maroon focus-visible:outline-2 focus-visible:outline-saffron"
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-7 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-gold/30 px-4 py-5 text-center text-xs text-brown/60">
        Private shop administration · Customer information must be handled securely
      </footer>
    </div>
  );
}

export function AdminPageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl text-maroon sm:text-4xl">{title}</h1>
      {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-brown/70">{description}</p> : null}
    </div>
  );
}

export function AdminEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-gold/60 bg-white/70 px-5 py-10 text-center text-sm leading-6 text-brown/70">
      <PackageCheck className="mx-auto mb-3 text-gold" aria-hidden="true" />
      {children}
    </div>
  );
}
