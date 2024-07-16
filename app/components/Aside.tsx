import { createContext, type ReactNode, useContext, useState } from "react";
import clsx from "clsx";
import Icon from "~/components/Icon";

type AsideType = "search" | "cart" | "mobile" | "closed";
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
  const { type: activeType, close } = useAside();
  const isOpen = type === activeType;
  const asideWidth = `w-[586px]`;

  return (
    <div data-type={`aside-${type}`} aria-modal role="dialog">
      <div
        role="presentation"
        onClick={close}
        className={clsx(
          `pointer-none fixed z-0 bg-neutral-800 bg-opacity-50`,
          isOpen && "pointer-events-auto inset-0 z-10 backdrop-blur-md",
        )}
      />
      <aside
        className={clsx(
          isOpen ? "translate-x-0" : "translate-x-full",
          "absolute right-0 top-0 z-20 h-dvh bg-neutral-200 transition-transform duration-300 ease-in-out dark:bg-neutral-800",
          asideWidth,
        )}
      >
        <header
          className={clsx(
            "sticky top-0 flex h-[110px] items-center justify-between bg-neutral-100 px-8 dark:bg-neutral-700",
          )}
        >
          <h3 className={clsx("m-0")}>{heading}</h3>
          <Icon
            name="x"
            aria-label="Close"
            className="cursor-pointer"
            onClick={close}
          />
        </header>
        <main className={clsx("flex h-[calc(100vh_-_110px)] w-full")}>
          {children}
        </main>
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

Aside.Provider = function AsideProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<AsideType>("closed");

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType("closed"),
        isOpen: type !== "closed",
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error("useAside must be used within an AsideProvider");
  }
  return aside;
}
