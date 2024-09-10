import { Form, useSearchParams } from "@remix-run/react";
import Icon from "~/components/icon";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import {
  Aside,
  AsideTrigger,
  AsideContent,
  AsideHeader,
  AsideBody,
  AsideTitle,
  AsideDescription,
} from "~/components/ui/aside";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import clsx from "clsx";
import * as RadioGroup from "@radix-ui/react-radio-group";

export function FiltersToolbar() {
  return (
    <div className="flex h-[var(--header-height)] items-center justify-between">
      <FiltersAside />
      <SortDropdown />
    </div>
  );
}

function FiltersAside() {
  return (
    <Aside>
      <div className="md:hidden">
        <AsideTrigger asChild>
          <Button size="icon">
            <Icon name="filter" />
          </Button>
        </AsideTrigger>
      </div>
      <div className="hidden w-[250px] md:block">
        {/* TODO: This trigger isn't picking up the :before pseudo-element */}
        <AsideTrigger asChild>
          <ButtonWithWellText size="icon" wellPostfix="Showing 6 items">
            <Icon name="filter" />
          </ButtonWithWellText>
        </AsideTrigger>
      </div>

      <AsideContent side="left">
        <AsideHeader>
          <AsideTitle>Filter By</AsideTitle>
        </AsideHeader>
        <AsideBody>
          {/* TODO: clean up accordion padding */}
          <Accordion
            type="multiple"
            defaultValue={["availability", "price", "product-type"]}
            className="w-full"
          >
            <AsideDescription className="sr-only">
              filter products
            </AsideDescription>
            <FilterAccordionItem title="Availability" value="availability">
              <FilterStockRadioButtons />
            </FilterAccordionItem>
            <FilterAccordionItem
              title="Price"
              value="price"
            ></FilterAccordionItem>
            <FilterAccordionItem
              title="Product Type"
              value="product-type"
            ></FilterAccordionItem>
          </Accordion>
        </AsideBody>
      </AsideContent>
    </Aside>
  );
}

function FilterStockRadioButtons() {
  const [searchParams, setSearchParams] = useSearchParams();
  let availability: string | undefined =
    searchParams.get("availability") || undefined;
  if (availability !== "in-stock" && availability !== "out-of-stock") {
    availability = undefined;
  }

  return (
    <RadioGroup.Root
      className="flex w-[300px] flex-col gap-3"
      aria-label="select availability"
      value={availability}
      onValueChange={(newAvailability) => {
        setSearchParams({ availability: newAvailability });
      }}
    >
      <RadioGroup.Item value="in-stock" id="in-stock" asChild>
        <Button
          className="flex justify-between text-left uppercase"
          intent={availability === "in-stock" ? "primary" : "secondary"}
        >
          In Stock
          {availability === "in-stock" ? <Icon name="check" /> : null}
        </Button>
      </RadioGroup.Item>
      <RadioGroup.Item value="out-of-stock" id="out-of-stock" asChild>
        <Button
          className="flex justify-between text-left uppercase"
          intent={availability === "out-of-stock" ? "primary" : "secondary"}
        >
          Out of Stock
          {availability === "out-of-stock" ? <Icon name="check" /> : null}
        </Button>
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}

function FilterAccordionItem({
  title,
  value,
  children,
  className,
}: {
  title: string;
  value: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <AccordionItem
      value={value}
      className={clsx(
        "border-b border-b-neutral-400 border-opacity-15 dark:border-opacity-20",
        className,
      )}
    >
      <AccordionTrigger icon="chevron-up">{title}</AccordionTrigger>
      <AccordionContent className="p-0">{children}</AccordionContent>
    </AccordionItem>
  );
}
export function SortDropdown() {
  return (
    <DropdownMenu>
      <div className="w-fit md:w-[280px]">
        <DropdownMenuTrigger asChild>
          <ButtonWithWellText size="icon" wellPrefix="Price: High To Low">
            <Icon name="chevron-down" />
          </ButtonWithWellText>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="w-fit md:w-[280px]" align="end">
        <Form method="get" className="flex flex-col gap-1">
          <SortButton value="featured" selected>
            Featured
          </SortButton>
          <SortButton value="price-high-to-low">Price: High To Low</SortButton>
          <SortButton value="price-low-to-high">Price: Low To High</SortButton>
          <SortButton value="best-selling">Best Selling</SortButton>
          <SortButton value="newest">Newest</SortButton>
        </Form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortButton({
  value,
  children,
  selected = false,
}: {
  value: string;
  children: React.ReactNode;
  selected?: boolean;
}) {
  return (
    <DropdownMenuItem asChild className="justify-between">
      <button value={value} name="sort">
        {children}
        {selected ? <Icon name="check" /> : null}
      </button>
    </DropdownMenuItem>
  );
}
