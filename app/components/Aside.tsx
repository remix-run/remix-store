import {createContext, type ReactNode, useContext, useState} from 'react';
import clsx from 'clsx';
import Icon from '~/components/Icon';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
  isOpen: boolean;
};

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 */
export function Aside({
  children,
  heading,
  type,
}: {
  children?: React.ReactNode;
  type: AsideType;
  heading: React.ReactNode;
}) {
  const {type: activeType, close} = useAside();
  const isOpen = type === activeType;
  const asideWidth = `w-[586px]`;

  return (
    <div data-type={`aside-${type}`} aria-modal role="dialog">
      <div
        role="presentation"
        onClick={close}
        className={clsx(
          `fixed pointer-none bg-neutral-800 bg-opacity-50 z-0`,
          isOpen && 'inset-0 backdrop-blur-md	pointer-events-auto z-10',
        )}
      />
      <aside
        className={clsx(
          isOpen ? 'translate-x-0' : 'translate-x-full',
          'bg-neutral-200 dark:bg-neutral-800 absolute top-0 right-0 h-dvh z-20 transition-transform duration-300 ease-in-out',
          asideWidth,
        )}
      >
        <header
          className={clsx(
            'top-0 sticky justify-between items-center flex px-8 h-[110px] bg-neutral-100 dark:bg-neutral-700',
          )}
        >
          <h3 className={clsx('m-0')}>{heading}</h3>
          <Icon
            name="x"
            aria-label="Close"
            className="cursor-pointer"
            onClick={close}
          />
        </header>
        <main className={clsx('flex h-[calc(100vh_-_110px)] w-full')}>
          {children}
        </main>
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
        isOpen: type !== 'closed',
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}
