import { unstable_useRouterState as useRouterState } from "react-router";
import { forwardRef, useEffect, useRef, useState } from "react";

/**
 * Enhanced `<details>` menu that closes on outside click/focus and navigation.
 */
export let DetailsMenu = forwardRef<
  HTMLDetailsElement,
  React.ComponentPropsWithRef<"details">
>(function DetailsMenu(props, forwardedRef) {
  let { onToggle, onMouseDown, onTouchStart, onFocus, open, ...rest } = props;
  let [isOpen, setIsOpen] = useState(false);
  let { active, pending } = useRouterState();
  let clickRef = useRef(false);
  let focusRef = useRef(false);

  useEffect(() => {
    if (pending?.formData) {
      setIsOpen(false);
    }
  }, [pending]);

  useEffect(() => {
    setIsOpen(false);
  }, [active.location.key]);

  useEffect(() => {
    if (!isOpen) return;

    let clickHandler = () => {
      if (!clickRef.current) setIsOpen(false);
      clickRef.current = false;
    };
    let focusHandler = () => {
      if (!focusRef.current) setIsOpen(false);
      focusRef.current = false;
    };
    let keydownHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("touchstart", clickHandler);
    document.addEventListener("focusin", focusHandler);
    document.addEventListener("keydown", keydownHandler);

    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("touchstart", clickHandler);
      document.removeEventListener("focusin", focusHandler);
      document.removeEventListener("keydown", keydownHandler);
    };
  }, [isOpen]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- details needs these handlers to distinguish internal interactions from outside click/focus dismissal.
    <details
      ref={forwardedRef}
      open={open ?? isOpen}
      onToggle={(event) => {
        onToggle?.(event);
        if (event.defaultPrevented) return;
        setIsOpen(event.currentTarget.open);
      }}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        if (event.defaultPrevented) return;
        if (isOpen) clickRef.current = true;
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        if (event.defaultPrevented) return;
        if (isOpen) clickRef.current = true;
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (event.defaultPrevented) return;
        if (isOpen) focusRef.current = true;
      }}
      {...rest}
    />
  );
});

DetailsMenu.displayName = "DetailsMenu";
