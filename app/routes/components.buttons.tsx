import { Button } from "~/components/ui/button";
import { cn } from "~/lib";
import { ShopPayButton } from "./($locale).products.$handle";

export default function Buttons() {
  return (
    <div className="bg-neutral-100 dark:bg-neutral-700">
      <Section title="CTA Buttons" className="flex w-[400px] flex-col gap-4">
        <ShopPayButton />
        <Button size="fw" intent="primary">
          Continue checkout
        </Button>
        <Button size="fw" intent="secondary">
          Add to cart
        </Button>
        <Button size="fw" disabled>
          Sold out
        </Button>
      </Section>
      <Section title="Icon Buttons"></Section>
    </div>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 px-8 py-4">
      <h2 className="text-4xl">{title}</h2>
      <div className={cn("mt-6", className)}>{children}</div>
    </section>
  );
}
