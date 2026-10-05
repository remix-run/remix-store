import { render, screen } from "@testing-library/react";
import { FreeShippingNotice } from "~/components/cart";

it("updates the remaining amount and caps progress as the USD subtotal changes", () => {
  const { rerender } = render(
    <FreeShippingNotice
      countryCode="US"
      subtotalAmount={{ amount: "50", currencyCode: "USD" }}
    />,
  );

  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "66",
  );
  expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();

  rerender(
    <FreeShippingNotice
      countryCode="US"
      subtotalAmount={{ amount: "75", currencyCode: "USD" }}
    />,
  );

  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  expect(screen.queryByText(/\$25\.00/)).not.toBeInTheDocument();

  rerender(
    <FreeShippingNotice
      countryCode="US"
      subtotalAmount={{ amount: "150", currencyCode: "USD" }}
    />,
  );

  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
});

it("removes progress when a Canadian cart changes from USD to CAD", () => {
  const { rerender } = render(
    <FreeShippingNotice
      countryCode="CA"
      subtotalAmount={{ amount: "50", currencyCode: "USD" }}
    />,
  );

  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "66",
  );

  rerender(
    <FreeShippingNotice
      countryCode="CA"
      subtotalAmount={{ amount: "106", currencyCode: "CAD" }}
    />,
  );

  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  // The fallback still names the USD minimum, not a CAD threshold.
  expect(screen.getByText(/US\$75/)).toBeInTheDocument();
});

it("shows the international explanation only outside the U.S., without changing USD progress", () => {
  const subtotalAmount = { amount: "50", currencyCode: "USD" } as const;
  const { rerender } = render(
    <FreeShippingNotice countryCode="US" subtotalAmount={subtotalAmount} />,
  );

  expect(screen.queryByText(/US\$75/)).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "66",
  );

  rerender(
    <FreeShippingNotice countryCode="CA" subtotalAmount={subtotalAmount} />,
  );

  expect(screen.getByText(/US\$75/)).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "66",
  );
});
