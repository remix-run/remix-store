import { useColorScheme } from "~/lib/color-scheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Form, useLocation } from "@remix-run/react";
import Icon from "./Icon";
import { Button } from "./ui/button";

const themeIconMap = {
  light: "sun",
  dark: "moon",
  system: "computer",
} as const;

export function ThemeToggle() {
  const theme = useColorScheme();
  const location = useLocation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon">
            <Icon name={themeIconMap[theme]} aria-label="Change theme" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <Form
            preventScrollReset
            replace
            action="/_actions/color-scheme"
            method="post"
            className="flex flex-col gap-px"
          >
            <input
              type="hidden"
              name="returnTo"
              value={location.pathname + location.search}
            />
            <DropdownButton theme="light" />
            <DropdownButton theme="dark" />
            <DropdownButton theme="system" />
          </Form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function DropdownButton({ theme }: { theme: "light" | "dark" | "system" }) {
  const currentTheme = useColorScheme();
  const icon = themeIconMap[theme];
  return (
    <DropdownMenuItem asChild>
      <button
        className="cursor-pointer gap-2 capitalize dark:hover:opacity-65"
        value={theme}
        name="colorScheme"
        aria-current={theme === currentTheme}
      >
        <Icon name={icon} />
        {theme}
      </button>
    </DropdownMenuItem>
  );
}
