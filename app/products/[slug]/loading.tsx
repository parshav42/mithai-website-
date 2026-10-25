import { Container } from "@/components/container";

export default function ProductLoading() {
  return (
    <main aria-busy="true" aria-label="Loading sweet details" className="bg-white">
      <Container className="py-12">
        <div className="grid animate-pulse gap-8 md:grid-cols-2">
          <div className="aspect-square bg-gold/15" />
          <div>
            <div className="h-3 w-24 bg-gold/25" />
            <div className="mt-5 h-12 max-w-sm bg-gold/20" />
            <div className="mt-8 h-28 bg-gold/15" />
          </div>
        </div>
      </Container>
    </main>
  );
}
