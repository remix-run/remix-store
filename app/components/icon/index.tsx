import { cn } from "~/lib/cn";
import type { IconName } from "./types.generated";

export type IconProps = Omit<React.SVGProps<SVGElement>, "ref"> & {
  name: IconName;
};

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      className={cn("h-6 w-6", className)}
      aria-hidden={
        props["aria-label"] ? undefined : props["aria-hidden"] || true
      }
      {...props}
    >
      <use href={`/sprites.svg#${name}`} />
    </svg>
  );
}
