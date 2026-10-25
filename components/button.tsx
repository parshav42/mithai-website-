import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href: ComponentProps<typeof Link>["href"];
  variant?: "primary" | "outline" | "light";
  className?: string;
};

const variantStyles = {
  primary: "bg-maroon text-ivory hover:bg-brown",
  outline: "border border-maroon text-maroon hover:bg-maroon hover:text-ivory",
  light: "bg-ivory text-maroon hover:bg-white",
};

export function Button({
  children,
  href,
  variant = "primary",
  className = "",
}: ButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-semibold tracking-wide transition-colors duration-200 ${variantStyles[variant]} ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
