import { ArrowUpRight } from "lucide-react";
import { MobileNavigation } from "@/components/mobile-navigation";

const links = [
  { href: "#categories", label: "Mithai" },
  { href: "#gifting", label: "Gifting" },
  { href: "#our-story", label: "Our Story" },
];

export function Navbar() {
  return (
    <header className="border-b border-gold/25 bg-ivory">
      <div className="container-width flex min-h-[5.25rem] items-center justify-between gap-5">
        <a
          href="#home"
          aria-label="Mithai House home"
          className="group flex min-w-0 items-center gap-3"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center border border-gold text-maroon"
          >
            <span className="font-display text-xl leading-none">M</span>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg tracking-wide text-maroon sm:text-xl">
              Mithai House
            </span>
            <span className="mt-1 block text-[0.55rem] font-semibold tracking-[0.16em] text-brown/65">
              TEMPORARY WORDMARK
            </span>
          </span>
        </a>

        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-brown/85 transition-colors hover:text-maroon"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="inline-flex items-center gap-1 border-b border-gold pb-1 text-sm font-semibold text-maroon transition-colors hover:text-brown"
          >
            Get in touch <ArrowUpRight aria-hidden="true" size={15} />
          </a>
        </nav>
        <MobileNavigation />
      </div>
    </header>
  );
}
