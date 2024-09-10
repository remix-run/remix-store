import { Button, ButtonWithWellText } from "~/components/ui/button";
import { ShopPayButton } from "./($locale).products.$handle";
import Icon from "~/components/icon";
import { iconNames } from "~/components/icon/types.generated";
import { Fragment } from "react/jsx-runtime";
import { Section } from "./components";

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
      <Section
        title="Buttons with extended wells"
        className="flex flex-col gap-4"
      >
        <div className="w-[150px]">
          <ButtonWithWellText
            size="icon"
            wellPrefix="🇺🇸 USD"
            className="max-w-[250px]"
          >
            <Icon name="globe" />
          </ButtonWithWellText>
        </div>
        <div className="w-[250px]">
          <ButtonWithWellText size="icon" wellPostfix="Showing 6 items">
            <Icon name="filter" />
          </ButtonWithWellText>
        </div>
        <div className="w-fit md:w-[280px]">
          <ButtonWithWellText size="icon" wellPrefix="Price: High To Low">
            <Icon name="chevron-down" />
          </ButtonWithWellText>
        </div>
      </Section>
    </div>
  );
}
