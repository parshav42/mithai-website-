"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/products", label: "Mithai" },
  { href: "/#gifting", label: "Gifting" },
  { href: "/#our-story", label: "Our Story" },
  { href: "/#contact", label: "Shop details" },
];

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const handleEscape = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      menuButtonRef.current?.focus();
    }
  };

  return (
    <div className="relative md:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 text-maroon"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-menu"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleEscape}
      >
        {isOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
        <span className="text-[0.62rem] font-semibold tracking-[0.14em]">
          {isOpen ? "CLOSE" : "MENU"}
        </span>
      </button>
      {isOpen && (
        <nav
          id="mobile-navigation-menu"
          aria-label="Mobile navigation"
          className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] border border-gold/45 bg-ivory p-2 shadow-lg"
          onKeyDown={handleEscape}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block border-b border-gold/15 px-4 py-3.5 text-sm text-brown transition-colors last:border-0 hover:bg-white hover:text-maroon"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
