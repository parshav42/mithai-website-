type ProductCardProps = {
  name: string;
  style: "ivory" | "maroon" | "saffron";
};

const artStyles = {
  ivory: "placeholder-art",
  maroon: "placeholder-art placeholder-art--maroon",
  saffron: "placeholder-art placeholder-art--saffron",
};

export function ProductCard({ name, style }: ProductCardProps) {
  return (
    <article className="group min-w-0">
      <div
        role="img"
        aria-label={`Decorative image placeholder for ${name}; product photography to be provided`}
        className={`${artStyles[style]} relative aspect-[4/4.6]`}
      >
        <span className="absolute inset-x-3 bottom-3 z-10 mx-auto w-fit bg-ivory/90 px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.1em] text-brown">
          PHOTO PLACEHOLDER
        </span>
      </div>
      <div className="pt-4">
        <h3 className="font-display text-xl text-brown">{name}</h3>
        <p className="mt-1 text-xs leading-5 text-brown/65">
          Representative mithai · details to be confirmed
        </p>
      </div>
    </article>
  );
}
