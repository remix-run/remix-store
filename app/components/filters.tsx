import { Form } from "@remix-run/react";
import Icon from "~/components/icon";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";

export function FiltersToolbar() {
  return (
    <div className="flex h-[var(--header-height)] items-center justify-between">
      <DropdownMenu>
        <div className="md:hidden">
          <DropdownMenuTrigger asChild>
            <Button size="icon">
              <Icon name="filter" />
            </Button>
          </DropdownMenuTrigger>
        </div>

        <div className="hidden w-[250px] md:block">
          <DropdownMenuTrigger asChild>
            <ButtonWithWellText size="icon" wellPostfix="Showing 6 items">
              <Icon name="filter" />
            </ButtonWithWellText>
          </DropdownMenuTrigger>
        </div>

        <DropdownMenuContent></DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <div className="w-fit md:w-[280px]">
          <DropdownMenuTrigger asChild>
            <ButtonWithWellText size="icon" wellPrefix="Price: High To Low">
              <Icon name="chevron-down" />
            </ButtonWithWellText>
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent>
          <Form method="get" className="flex flex-col gap-1">
            <SortButton value="featured">Featured</SortButton>
            <SortButton value="price-high-to-low">
              Price: High To Low
            </SortButton>
            <SortButton value="price-low-to-high">
              Price: Low To High
            </SortButton>
            <SortButton value="best-selling">Best Selling</SortButton>
            <SortButton value="newest">Newest</SortButton>
          </Form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
      <DropdownMenuContent className="w-fit md:w-[280px]">
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
