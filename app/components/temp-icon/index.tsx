import { cn } from "~/lib";
import type { IconName } from "./types.generated";

export type IconProps = Omit<React.SVGProps<SVGElement>, "ref"> & {
  name: IconName;
};

export default function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      className={cn("size-6", className)}
      aria-hidden={
        props["aria-label"] ? undefined : props["aria-hidden"] || true
      }
      {...props}
    >
      <use href={`/sprite.svg#${name}`} />
    </svg>
  );
}
