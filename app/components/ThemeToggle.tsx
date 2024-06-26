import {useColorScheme} from '~/lib/color-scheme';

export function ThemeToggle() {
  const theme = useColorScheme();

  return (
    <>
      <button>{theme}</button>
    </>
  );
}
