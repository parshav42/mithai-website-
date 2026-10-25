import Image from "next/image";
import type { ImageProps } from "next/image";

type ProductCardProps = {
  name: string;
  image: ImageProps["src"];
  imageAlt: string;
};

export function ProductCard({ name, image, imageAlt }: ProductCardProps) {
  return (
    <article className="group min-w-0">
      <div className="relative aspect-[1.08/1] overflow-hidden bg-[#ead9bb]">
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
        />
        <span className="absolute bottom-3 left-3 bg-ivory px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.1em] text-brown">
          ILLUSTRATIVE PHOTO
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 border-b border-gold/35 py-4 sm:py-5">
        <div>
          <h3 className="font-display text-xl leading-tight text-brown sm:text-2xl">{name}</h3>
          <p className="mt-1.5 text-xs leading-5 text-brown/75">
            Example only · shop range to be confirmed
          </p>
        </div>
        <p className="shrink-0 pt-1 text-right text-[0.6rem] font-semibold leading-4 tracking-[0.11em] text-maroon sm:text-[0.65rem]">
          DETAILS
          <br />
          PENDING
        </p>
      </div>
    </article>
  );
}
