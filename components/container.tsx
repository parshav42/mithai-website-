import type { HTMLAttributes } from "react";

type ContainerProps = HTMLAttributes<HTMLDivElement>;

export function Container({ className = "", ...props }: ContainerProps) {
  return <div className={`container-width ${className}`.trim()} {...props} />;
}
