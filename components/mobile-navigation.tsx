"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#categories", label: "Mithai" },
  { href: "#gifting", label: "Gifting" },
  { href: "#our-story", label: "Our Story" },
];

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        className="flex size-11 items-center justify-center text-maroon"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
      </button>
      {isOpen && (
        <nav
          id="mobile-navigation-menu"
          aria-label="Mobile navigation"
          className="absolute right-0 top-full z-20 mt-2 w-56 border border-gold/40 bg-ivory p-2 shadow-lg"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block px-4 py-3 text-sm text-brown hover:bg-white focus-visible:relative"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
