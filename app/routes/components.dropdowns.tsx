import { Button } from "~/components/ui/button";
import Icon from "~/components/icon";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { Section } from "./components";
import { SortDropdown } from "~/components/filters";

export default function Dropdowns() {
  return (
    <div className="bg-neutral-100 dark:bg-neutral-700">
      <Section title="Dropdown Menus" className="flex flex-col gap-40">
        {/* TODO: replace with the component from toggle theme */}
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger asChild>
            <Button size="icon">
              <Icon name="sun" aria-label="Change theme" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[160px]">
            <DropdownMenuItem>
              <Icon name="sun" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon name="moon" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon name="computer" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SortDropdown />
      </Section>
    </div>
  );
}
