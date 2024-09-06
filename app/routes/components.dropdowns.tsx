import { Section } from "./components";
import { SortDropdown } from "~/components/filters";
import { ThemeToggle } from "~/components/theme-toggle";

export default function Dropdowns() {
  return (
    <div className="bg-neutral-100 dark:bg-neutral-700">
      <Section title="Dropdown Menus" className="flex flex-col gap-40">
        <div className="flex items-center gap-4">
          <ThemeToggle display="icon" />
          <div className="w-[160px]">
            <ThemeToggle display="button" />
          </div>
        </div>

        <SortDropdown />
      </Section>
    </div>
  );
}
