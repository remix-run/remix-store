import { cn } from "~/lib/cn";

let runnerWidth = 326;
let runnerHeight = 206;

type RemixRunnerProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "height" | "src" | "width"
> & {
  animate?: boolean;
};

export function RemixRunner({
  animate = true,
  alt,
  className,
  ...props
}: RemixRunnerProps) {
  return (
    <>
      <img
        {...props}
        alt={alt}
        src="/brand/remix-runner.svg"
        width={runnerWidth}
        height={runnerHeight}
        className={cn(
          className,
          animate ? "hidden motion-reduce:block" : "block",
        )}
      />
      <img
        {...props}
        alt={alt}
        src="/brand/remix-runner-animated.svg"
        width={runnerWidth}
        height={runnerHeight}
        className={cn(
          className,
          animate ? "hidden motion-safe:block motion-reduce:hidden" : "hidden",
        )}
      />
    </>
  );
}
