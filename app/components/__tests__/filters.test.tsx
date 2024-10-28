import { render, screen } from "@testing-library/react";
import { createRemixStub } from "@remix-run/testing";
import { HiddenFilterInputs } from "~/components/filters";

function createRemixStubWithHiddenFilterInputs(
  props: Parameters<typeof HiddenFilterInputs>[0],
) {
  return createRemixStub([
    {
      path: "/",
      Component: () => <HiddenFilterInputs {...props} />,
    },
  ]);
}

describe("HiddenFilterInputs", () => {
  it("renders hidden inputs for all filters set in the search params", async () => {
    const RemixStub = createRemixStubWithHiddenFilterInputs({
      keys: ["available", "price.min", "price.max", "product-type"],
    });
    render(
      <RemixStub
        initialEntries={[
          "/?available=true&price.min=10&price.max=100&product-type=t-shirt",
        ]}
      />,
    );

    // query all hidden inputs
    const availableInput = screen.getByDisplayValue("true");
    expect(availableInput).toHaveAttribute("name", "available");

    const priceMinInput = screen.getByDisplayValue("10");
    expect(priceMinInput).toHaveAttribute("name", "price.min");

    const priceMaxInput = screen.getByDisplayValue("100");
    expect(priceMaxInput).toHaveAttribute("name", "price.max");

    const productTypeInput = screen.getByDisplayValue("t-shirt");
    expect(productTypeInput).toHaveAttribute("name", "product-type");
  });

  it("renders hidden inputs for filters set in the search params when include is false", () => {
    const RemixStub = createRemixStubWithHiddenFilterInputs({
      keys: ["available"],
      include: false,
    });

    render(<RemixStub initialEntries={["/?sort=best-selling"]} />);

    const productTypeInput = screen.getByDisplayValue("best-selling");
    expect(productTypeInput).toHaveAttribute("name", "sort");
  });

  it("does not render any hidden inputs when search params are empty", () => {
    const RemixStub = createRemixStubWithHiddenFilterInputs({
      keys: ["available", "price.min", "price.max", "product-type", "sort"],
    });

    const { container } = render(<RemixStub />);

    const hiddenInputs = container.querySelectorAll("input[type='hidden']");
    expect(hiddenInputs).toHaveLength(0);
  });
});
