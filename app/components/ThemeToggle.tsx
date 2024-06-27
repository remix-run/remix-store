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
import Icon from './Icon';

export function ThemeToggle() {
  const theme = useColorScheme();
  const location = useLocation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Icon
            name={theme === 'dark' ? 'sun' : 'moon'}
            aria-label="Change theme"
          />
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

            <DropdownMenuItem asChild>
              <button
                value="light"
                name="colorScheme"
                disabled={theme === 'light'}
              >
                Light
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                value="dark"
                name="colorScheme"
                disabled={theme === 'dark'}
              >
                Dark
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                value="system"
                name="colorScheme"
                disabled={theme === 'system'}
              >
                System
              </button>
            </DropdownMenuItem>
          </Form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
