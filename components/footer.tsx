import Link from "next/link";
import { Container } from "@/components/container";
import { IntroReplayButton } from "@/components/intro-replay-button";

export function Footer({ showIntroReplay = false }: { showIntroReplay?: boolean }) {
  return (
    <footer id="contact" className="bg-brown text-ivory">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-9 border-b border-gold/35 pb-9 sm:grid-cols-2 md:grid-cols-[1.35fr_0.75fr_1fr] md:gap-12 md:pb-12">
          <div>
            <Link href="/#home" className="inline-flex items-center gap-3 font-display text-2xl text-ivory transition-colors hover:text-gold">
              <span aria-hidden="true" className="flex size-9 items-center justify-center border border-gold font-display text-lg text-gold">M</span>
              Mithai House
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-ivory/80">
              A thoughtful home for India&apos;s beloved sweets. Our shop name and story will be updated when confirmed.
            </p>
          </div>
          <div>
            <h2 className="text-[0.68rem] font-semibold tracking-[0.17em] text-gold">EXPLORE</h2>
            <ul className="mt-4 space-y-3.5 text-sm text-ivory/85">
              <li><Link className="transition-colors hover:text-gold" href="/products">Mithai</Link></li>
              <li><Link className="transition-colors hover:text-gold" href="/#bestsellers">Sweet selections</Link></li>
              <li><Link className="transition-colors hover:text-gold" href="/#gifting">Gifting</Link></li>
              <li><Link className="transition-colors hover:text-gold" href="/#our-story">Our story</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-[0.68rem] font-semibold tracking-[0.17em] text-gold">SHOP INFORMATION</h2>
            <p className="mt-4 max-w-xs text-sm leading-6 text-ivory/80">
              Contact details, delivery information and shop policies will be published once confirmed by the business.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-6 text-[0.68rem] leading-5 text-ivory/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Mithai House · Temporary name pending confirmation.</p>
          <p>Illustrative stock photography via Unsplash; shop photography pending.</p>
          {showIntroReplay ? <IntroReplayButton /> : null}
        </div>
      </Container>
    </footer>
  );
}
