import { createContext, useContext, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Form,
  useLocation,
  useNavigation,
  useSearchParams,
} from "react-router";
import { Icon } from "~/components/icon";
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
import { clsx } from "clsx";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
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
import { useSpinDelay } from "spin-delay";

type FiltersToolbarProps = {
  /**
   * The number of items to display in the toolbar, if undefined indicates
   * that the number of items is still pending
   */
  itemCount?: number;
};

export function FiltersToolbar({ itemCount }: FiltersToolbarProps) {
  return (
    <div className="flex h-[var(--header-height)] items-center justify-between">
      <FiltersTrigger itemCount={itemCount} />
      <SortDropdown />
    </div>
  );
}

/**
 * Returns true if the filters are still pending
 */
function useIsFiltersPending(itemCount?: number) {
  const location = useLocation();
  const navigation = useNavigation();

  let isPending = false;

  if (itemCount === undefined) {
    isPending = true;
  } else if (
    navigation.state === "loading" &&
    // navigating to the same page indicates the filters changed
    location.pathname === navigation.location.pathname
  ) {
    isPending = true;
  }

  return useSpinDelay(isPending, { delay: 200, minDuration: 200, ssr: true });
}

/**
 * Trigger and label for the filters aside
 */
function FiltersTrigger({ itemCount }: FiltersToolbarProps) {
  if (!useContext(filtersAsideCheckContext)) {
    throw new Error("FiltersTrigger must be used within a FiltersAside");
  }

  const isFilterApplied = useIsFilterApplied();
  const intent = isFilterApplied ? "primary" : "secondary";

  const isPending = useIsFiltersPending(itemCount);

  return (
    <>
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
              isPending ? (
                <div className="flex items-center gap-2">
                  <span>Loading items</span>
                  <div className="animate-blink h-5 w-3 bg-neutral-400" />
                </div>
              ) : (
                `Showing ${itemCount} items`
              )
            }
          >
            <Icon name="filter" />
          </ButtonWithWellText>
        </AsideTrigger>
      </div>
    </>
  );
}

const filtersAsideCheckContext = createContext(false);

/**
 * Aside that contains the filters and the form for submitting them
 *
 * Note: This must be rendered above any Suspense boundaries, otherwise it'll
 * it'll be remounted and close when the data finishes loading
 */
export function FiltersAside({ children }: { children: React.ReactNode }) {
  const [formRef, submitForm] = useFiltersSubmit();

  return (
    <Aside>
      <filtersAsideCheckContext.Provider value={true}>
        {children}
      </filtersAsideCheckContext.Provider>

      <AsideContent side="left">
        <AsideHeader>
          <AsideTitle>Filter By</AsideTitle>
        </AsideHeader>
        <AsideDescription className="sr-only">filter products</AsideDescription>
        <AsideBody>
          <Form ref={formRef}>
            <HiddenFilterInputs keys={[SORT_KEY]} include />
            <Accordion
              type="multiple"
              className="gap-0"
              defaultValue={["availability", "price", "product-type"]}
            >
              <FilterAccordionItem title="Availability" value="availability">
                <FilterProductStock submitForm={submitForm} />
              </FilterAccordionItem>
              <FilterAccordionItem title="Price" value="price">
                <FilterPriceRange submitForm={submitForm} />
              </FilterAccordionItem>
              <FilterAccordionItem title="Product Type" value="product-type">
                <FilterProductType submitForm={submitForm} />
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
        "-mx-6 border-b border-b-neutral-400/15 py-3 data-[state=open]:pb-9 dark:border-b-neutral-400/20",
        className,
      )}
    >
      <AccordionTrigger icon="chevron-up">{title}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

type FilterControlsProps = {
  submitForm: ReturnType<typeof useFiltersSubmit>[1];
};

/**
 * Acts like a radio button, however if you re-select the same value it'll
 * remove it from the form data
 */
function FilterProductStock({ submitForm }: FilterControlsProps) {
  const available = useIsAvailable();
  const [value, setValue] = useState(available);

  // Note: theoretically we can remove `flushSync` here and drive the state via
  // `onValueChange`: https://x.com/BrooksLybrand/status/1851984020411687409
  return (
    <ToggleGroup.Root
      className="flex w-[300px] flex-col gap-3"
      type="single"
      value={value}
      aria-label="select availability"
    >
      <ToggleGroup.Item value="true" asChild>
        <Button
          className="flex justify-between text-left uppercase"
          intent={value === "true" ? "primary" : "secondary"}
          onClick={() => {
            // remove the value from the form if it's already set
            flushSync(() => {
              setValue(value === "true" ? undefined : "true");
            });
            submitForm();
          }}
        >
          In Stock
          {value === "true" ? <Icon name="check" /> : null}
        </Button>
      </ToggleGroup.Item>
      <input
        type="checkbox"
        name={FILTER.AVAILABLE}
        value="true"
        checked={value === "true"}
        tabIndex={-1}
        aria-hidden="true"
        readOnly
        className="sr-only"
      />

      <ToggleGroup.Item value="false" asChild>
        <Button
          className="flex justify-between text-left uppercase"
          intent={value === "false" ? "primary" : "secondary"}
          onClick={() => {
            // remove the value from the form if it's already set
            flushSync(() => {
              setValue(value === "false" ? undefined : "false");
            });
            submitForm();
          }}
        >
          Out of Stock
          {value === "false" ? <Icon name="check" /> : null}
        </Button>
      </ToggleGroup.Item>
      <input
        type="checkbox"
        name={FILTER.AVAILABLE}
        value="false"
        checked={value === "false"}
        tabIndex={-1}
        aria-hidden="true"
        readOnly
        className="sr-only"
      />
    </ToggleGroup.Root>
  );
}

function FilterPriceRange({ submitForm }: FilterControlsProps) {
  const { min, max } = usePrice();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSubmit = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      submitForm();
      timeoutRef.current = null;
    }, 500);
  };

  return (
    <fieldset
      className="flex items-center gap-3 font-bold"
      onChange={() => {
        debouncedSubmit();
      }}
    >
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
    </fieldset>
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
      <span className="absolute top-1/2 left-3 -translate-y-1/2 select-none">
        $
      </span>
      <input
        className="text-blue-brand h-[58px] w-[120px] rounded-[14px] bg-black/5 p-[10px] pl-7 font-mono placeholder:text-neutral-600/30 dark:bg-black/20 dark:placeholder:text-neutral-300/20"
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

function FilterProductType({ submitForm }: FilterControlsProps) {
  const selectedProductTypes = useCurrentProductTypes();

  return (
    <fieldset
      className="flex flex-wrap gap-3"
      onChange={() => {
        submitForm();
      }}
    >
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
    </fieldset>
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
