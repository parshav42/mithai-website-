import { Container } from "@/components/container";

export default function ProductsLoading() {
  return (
    <main aria-busy="true" aria-label="Loading sweets catalog" className="bg-white">
      <Container className="section-space">
        <div className="h-3 w-40 animate-pulse bg-gold/30" />
        <div className="mt-5 h-10 max-w-md animate-pulse bg-gold/20" />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="aspect-square animate-pulse bg-gold/15" />
          ))}
        </div>
      </Container>
    </main>
  );
}
