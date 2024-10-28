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
import * as Checkbox from "@radix-ui/react-checkbox";
import {
  type FilterKey,
  SORT_KEY,
  SORT_OPTIONS,
  PRODUCT_TYPES,
  useCurrentSort,
  useCurrentProductTypes,
  FILTER,
  useIsFilterApplied,
  useIsAvailable,
  usePrice,
  useFiltersSubmit,
} from "~/lib/filters";

type FiltersToolbarProps = {
  itemCount?: number;
};

export function FiltersToolbar({ itemCount }: FiltersToolbarProps) {
  return (
    <div className="flex h-[var(--header-height)] items-center justify-between">
      <FiltersAside itemCount={itemCount} />
      <SortDropdown />
    </div>
  );
}

function FiltersAside({ itemCount }: FiltersToolbarProps) {
  const submit = useFiltersSubmit();
  const isFilterApplied = useIsFilterApplied();
  const intent = isFilterApplied ? "primary" : "secondary";

  return (
    <Aside>
      <div className="md:hidden">
        <AsideTrigger asChild>
          <Button intent={intent} size="icon">
            <Icon name="filter" />
          </Button>
        </AsideTrigger>
      </div>
      <div className="hidden w-[250px] md:block">
        <AsideTrigger asChild>
          <ButtonWithWellText
            intent={intent}
            size="icon"
            wellPostfix={
              itemCount ? `Showing ${itemCount} items` : "Loading items"
            }
          >
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
            onChange={submit}
          >
            <HiddenFilterInputs keys={[SORT_KEY]} include />
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
  const available = useIsAvailable();

  return (
    <RadioGroup.Root
      className="flex w-[300px] flex-col gap-3"
      aria-label="select availability"
      name={FILTER.AVAILABLE}
      defaultValue={available}
    >
      <RadioGroup.Item value="true" id="true" asChild>
        <Button
          className="flex justify-between text-left uppercase"
          intent={available === "true" ? "primary" : "secondary"}
        >
          In Stock
          {available === "true" ? <Icon name="check" /> : null}
        </Button>
      </RadioGroup.Item>
      <RadioGroup.Item value="false" id="false" asChild>
        <Button
          className="flex justify-between text-left uppercase"
          intent={available === "false" ? "primary" : "secondary"}
        >
          Out of Stock
          {available === "false" ? <Icon name="check" /> : null}
        </Button>
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}

function FilterPriceRange() {
  const { min, max } = usePrice();

  return (
    <div className="flex items-center gap-3 font-bold">
      <label htmlFor="from">
        From <span className="sr-only">minimum price</span>
      </label>
      <PriceInput
        id="from"
        name={FILTER.PRICE_MIN}
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
        name={FILTER.PRICE_MAX}
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

function FilterProductType() {
  const selectedProductTypes = useCurrentProductTypes();

  return (
    <div className="flex flex-wrap gap-3">
      {PRODUCT_TYPES.map((productType) => {
        const checked = selectedProductTypes.has(productType);
        return (
          <Checkbox.Root
            key={productType}
            className="CheckboxRoot"
            name={FILTER.PRODUCT_TYPE}
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

export function SortDropdown() {
  const currentSort = useCurrentSort();

  return (
    <DropdownMenu>
      <div className="w-fit md:w-[280px]">
        <DropdownMenuTrigger asChild>
          <ButtonWithWellText size="icon" wellPrefix={currentSort?.label}>
            <Icon name="chevron-down" />
          </ButtonWithWellText>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="w-fit md:w-[280px]" align="end">
        <Form
          method="get"
          className="flex flex-col gap-1"
          preventScrollReset
          replace
        >
          <HiddenFilterInputs keys={[SORT_KEY]} include={false} />
          {SORT_OPTIONS.map((option) => (
            <SortButton
              key={option.value}
              value={option.value}
              selected={currentSort.value === option.value}
            >
              {option.label}
            </SortButton>
          ))}
        </Form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Add hidden inputs for all filters set in the query params
 * Takes an array of keys to include or exclude from the search params
 */
export function HiddenFilterInputs({
  keys = [],
  include = true,
}: {
  keys: Array<FilterKey | typeof SORT_KEY>;
  include?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const keysToIncludeSet = new Set(keys);

  return Array.from(searchParams.entries()).map(([key, value]) => {
    if (include && !keysToIncludeSet.has(key)) {
      return null;
    }
    if (!include && keysToIncludeSet.has(key)) {
      return null;
    }

    return <input key={key} type="hidden" name={key} value={value} />;
  });
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
      <button value={value} name={SORT_KEY}>
        {children}
        {selected ? <Icon name="check" /> : null}
      </button>
    </DropdownMenuItem>
  );
}
