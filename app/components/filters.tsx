import { Form, useSearchParams, useSubmit } from "@remix-run/react";
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
import * as Checkbox from "@radix-ui/react-checkbox";

export function FiltersToolbar() {
  return (
    <div className="flex h-[var(--header-height)] items-center justify-between">
      <FiltersAside />
      <SortDropdown />
    </div>
  );
}

function FiltersAside() {
  const submit = useSubmit();

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
        <AsideDescription className="sr-only">filter products</AsideDescription>
        <AsideBody>
          <Form
            // This form automatically submits any time any of the filter controls change
            onChange={(e) => {
              submit(e.currentTarget, { preventScrollReset: true });
            }}
            method="get"
            preventScrollReset
          >
            <Accordion
              type="multiple"
              className="gap-0"
              defaultValue={["availability", "price", "product-type"]}
            >
              <FilterAccordionItem title="Availability" value="availability">
                <FilterProductStock />
              </FilterAccordionItem>
              <FilterAccordionItem title="Price" value="price">
                <FilterPriceRange />
              </FilterAccordionItem>
              <FilterAccordionItem title="Product Type" value="product-type">
                <FilterProductType />
              </FilterAccordionItem>
            </Accordion>
          </Form>
        </AsideBody>
      </AsideContent>
    </Aside>
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
        "-mx-6 border-b border-b-neutral-400 border-opacity-15 py-3 dark:border-opacity-20 [&[data-state=open]]:pb-9",
        className,
      )}
    >
      <AccordionTrigger icon="chevron-up">{title}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

function FilterProductStock() {
  const [searchParams] = useSearchParams();
  let availability: string | undefined =
    searchParams.get("availability") || undefined;
  if (availability !== "in-stock" && availability !== "out-of-stock") {
    availability = undefined;
  }

  return (
    <RadioGroup.Root
      className="flex w-[300px] flex-col gap-3"
      aria-label="select availability"
      name="availability"
      defaultValue={availability}
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

// TODO: need some client-side validation and probably want to throttle submitting the form
function FilterPriceRange() {
  const [searchParams] = useSearchParams();
  const min = searchParams.get("min") || "";
  const max = searchParams.get("max") || "";

  return (
    <div className="flex items-center gap-3 font-bold">
      <label htmlFor="from">
        From <span className="sr-only">minimum price</span>
      </label>
      <PriceInput
        id="from"
        name="min"
        placeholder="0"
        defaultValue={min}
        min={0}
        max={max}
      />
      <label htmlFor="to">
        To <span className="sr-only">maximum price</span>
      </label>
      <PriceInput
        id="to"
        name="max"
        placeholder="1000"
        defaultValue={max}
        min={min}
        max={1000}
      />
    </div>
  );
}

function PriceInput({
  id,
  name,
  placeholder,
  defaultValue,
  min,
  max,
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative font-normal">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 select-none">
        $
      </span>
      <input
        className="h-[58px] w-[120px] rounded-[14px] bg-black bg-opacity-5 p-[10px] pl-7 font-mono text-blue-brand placeholder:text-neutral-600 placeholder:text-opacity-30 dark:bg-opacity-20 dark:placeholder:text-neutral-300 dark:placeholder:text-opacity-20"
        type="number"
        id={id}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        max={max}
      />
    </div>
  );
}

// TODO: get this from the storefront API
const productTypes = [
  "apparel",
  "accessories",
  "stationary",
  "stickers",
  "toys",
];

function FilterProductType() {
  const [searchParams] = useSearchParams();

  const selectedProductTypes = new Set(searchParams.getAll("product-type"));

  return (
    <div className="flex flex-wrap gap-3">
      {productTypes.map((productType) => {
        const checked = selectedProductTypes.has(productType);
        return (
          <Checkbox.Root
            key={productType}
            className="CheckboxRoot"
            name="product-type"
            value={productType}
            defaultChecked={checked}
            asChild
          >
            <Button
              size="sm"
              className="uppercase"
              intent={checked ? "primary" : "secondary"}
            >
              {productType}
            </Button>
          </Checkbox.Root>
        );
      })}
    </div>
  );
}

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price-high-to-low", label: "Price: High To Low" },
  { value: "price-low-to-high", label: "Price: Low To High" },
  { value: "best-selling", label: "Best Selling" },
  { value: "newest", label: "Newest" },
];

export function SortDropdown() {
  const [searchParams] = useSearchParams();
  const currentSort = searchParams.get("sort") || "featured";

  const currentSortLabel =
    sortOptions.find((option) => option.value === currentSort)?.label || "Sort";

  return (
    <DropdownMenu>
      <div className="w-fit md:w-[280px]">
        <DropdownMenuTrigger asChild>
          <ButtonWithWellText size="icon" wellPrefix={currentSortLabel}>
            <Icon name="chevron-down" />
          </ButtonWithWellText>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="w-fit md:w-[280px]" align="end">
        <Form method="get" className="flex flex-col gap-1" preventScrollReset>
          {sortOptions.map((option) => (
            <SortButton
              key={option.value}
              value={option.value}
              selected={currentSort === option.value}
            >
              {option.label}
            </SortButton>
          ))}
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
