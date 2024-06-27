import {useColorScheme} from '~/lib/color-scheme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {Form, useLocation} from '@remix-run/react';
import Icon, {IconName} from './Icon';

const themeIconMap = {
  light: 'sun',
  dark: 'moon',
  system: 'computer',
} as const;

export function ThemeToggle() {
  const theme = useColorScheme();
  const location = useLocation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Icon name={themeIconMap[theme]} aria-label="Change theme" />
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

function DropdownButton({theme}: {theme: 'light' | 'dark' | 'system'}) {
  const currentTheme = useColorScheme();
  const icon = themeIconMap[theme];
  return (
    <DropdownMenuItem asChild>
      <button
        className="capitalize gap-2"
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
