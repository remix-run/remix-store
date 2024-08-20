import { Button } from "~/components/ui/button";
import { cn } from "~/lib";
import { ShopPayButton } from "./($locale).products.$handle";
import Icon from "~/components/icon";
import { iconNames } from "~/components/icon/types.generated";
import { Fragment } from "react/jsx-runtime";

export default function Buttons() {
  return (
    <div className="bg-neutral-100 dark:bg-neutral-700">
      <Section title="CTA Buttons" className="flex w-[400px] flex-col gap-4">
        <ShopPayButton />
        <Button size="lg" intent="primary">
          Continue checkout
        </Button>
        <Button size="lg" intent="secondary">
          Add to cart
        </Button>
        <Button size="lg" disabled>
          Sold out
        </Button>
      </Section>
      <Section title="Icon Buttons" className="flex w-[500px] flex-wrap gap-10">
        {iconNames.map((name) => {
          if (name === "shop-pay") return null;
          return (
            <Button key={name} size="icon">
              <Icon name={name!} />
            </Button>
          );
        })}
        <Button intent="primary" size="icon">
          <Icon name="bag" className="text-inherit" aria-label="cart" /> 1
        </Button>
        <Button intent="secondary" size="sm">
          Shop
        </Button>
      </Section>
      <Section
        title="Product Sizing"
        className="grid w-[300px] grid-cols-3 gap-10"
      >
        {["xs", "s", "m", "l", "xl", "xxl"].map((size) => (
          <Fragment key={size}>
            <Button size="sm" disabled>
              {size}
            </Button>
            <Button size="sm" intent="secondary">
              {size}
            </Button>
            <Button size="sm" intent="primary">
              {size}
            </Button>
          </Fragment>
        ))}
      </Section>
    </div>
  );
}

// Might want to pull this out 🤷‍♂️
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
    <section className="mt-8 px-8 py-6">
      <h2 className="text-4xl">{title}</h2>
      <div className={cn("mt-6", className)}>{children}</div>
    </section>
  );
}
