import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Should only be used if arbitrary classnames can be passed into a component
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
