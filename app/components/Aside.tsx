import {createContext, type ReactNode, useContext, useState} from 'react';
import clsx from 'clsx';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
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

  return (
    <div
      className={clsx(
        `overlay fixed inset-0 pointer-none`,
        isOpen && 'expanded',
      )}
      aria-modal
      role="dialog"
    >
      <button className="close-outside" onClick={close} />
      <aside
        className={clsx(
          isOpen ? 'right-0' : 'right-[-586px]',
          'bg-white dark:bg-black w-[586px] fixed top-0 h-dvh transition-transform duration-300 ease-in-out',
        )}
      >
        <header
          className={clsx(
            'justify-between items-center flex px-8 h-[110px] dark:bg-gray',
          )}
        >
          <h3 className={clsx('m-0')}>{heading}</h3>
          <button className="close reset" onClick={close}>
            &times;
          </button>
        </header>
        <main className={clsx('m-8')}>{children}</main>
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
