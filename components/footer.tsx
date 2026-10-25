import { Container } from "@/components/container";

export function Footer() {
  return (
    <footer id="contact" className="bg-brown text-ivory">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 border-b border-ivory/15 pb-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <a href="#home" className="font-display text-2xl text-ivory">
              Mithai House
            </a>
            <p className="mt-2 text-[0.62rem] font-semibold tracking-[0.16em] text-gold">
              TEMPORARY WORDMARK
            </p>
            <p className="mt-5 max-w-xs text-sm leading-6 text-ivory/70">
              A place for the traditions, flavours and moments that bring us together.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-[0.15em] text-gold">EXPLORE</h2>
            <ul className="mt-4 space-y-3 text-sm text-ivory/80">
              <li><a className="hover:text-white" href="#categories">Mithai</a></li>
              <li><a className="hover:text-white" href="#gifting">Gifting</a></li>
              <li><a className="hover:text-white" href="#our-story">Our Story</a></li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-[0.15em] text-gold">SHOP DETAILS</h2>
            <p className="mt-4 max-w-xs text-sm leading-6 text-ivory/70">
              Shop contact details and policies will be added once confirmed by the business.
            </p>
          </div>
        </div>
        <p className="pt-6 text-xs text-ivory/55">
          © {new Date().getFullYear()} Mithai House · Temporary name pending shop details.
        </p>
      </Container>
    </footer>
  );
}
