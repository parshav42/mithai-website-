import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CartIndicator } from "@/components/cart-indicator";
import { MobileNavigation } from "@/components/mobile-navigation";

const links = [
  { href: "/products", label: "Mithai" },
  { href: "/#gifting", label: "Gifting" },
  { href: "/#our-story", label: "Our Story" },
];

export function Navbar() {
  return (
    <header className="relative z-20 border-b border-gold/30 bg-ivory">
      <div className="container-width flex min-h-[5.5rem] items-center justify-between gap-5 sm:min-h-24">
        <Link
          href="/#home"
          aria-label="Mithai House home"
          className="group flex min-w-0 items-center gap-3.5"
        >
          <span
            aria-hidden="true"
            className="relative flex size-11 shrink-0 items-center justify-center border border-gold text-maroon after:absolute after:inset-1 after:border after:border-gold/45 after:content-['']"
          >
            <span className="relative font-display text-2xl leading-none">M</span>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-xl tracking-wide text-maroon transition-colors group-hover:text-brown sm:text-2xl">
              Mithai House
            </span>
            <span className="mt-1.5 block text-[0.55rem] font-semibold tracking-[0.17em] text-brown/75">
              TEMPORARY SHOP NAME
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-9 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative py-2 text-sm text-brown/85 transition-colors hover:text-maroon"
            >
              {link.label}
              <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-gold transition-transform duration-200 group-hover:scale-x-100" />
            </a>
          ))}
          <Link
            href="/#contact"
            className="inline-flex min-h-11 items-center gap-2 border border-maroon px-4 text-sm font-semibold text-maroon transition-colors hover:bg-maroon hover:text-ivory"
          >
            Shop details <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
          <CartIndicator />
        </nav>
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <CartIndicator />
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
