import { redirect } from "react-router";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";

describe("filters", () => {
  it("gets the correct filters from the search params", () => {
    const searchParams = new URLSearchParams(
      "?sort=best-selling&available=false&price.min=10&price.max=100&product-type=toys&product-type=apparel",
    );
    const filters = getFilterQueryVariables(searchParams);
    expect(filters).toEqual({
      sortKey: "BEST_SELLING",
      reverse: false,
      filters: [
        { available: false },
        { price: { min: 10, max: 100 } },
        { productType: "toys" },
        { productType: "apparel" },
      ],
    });
  });

  it("gets only the correct filters from the search params", () => {
    const searchParams = new URLSearchParams("?price.min=0");
    const filters = getFilterQueryVariables(searchParams);
    expect(filters).toEqual({
      filters: [{ price: { min: 0 } }],
    });
  });

  it("gets the correct sort variables from search params", () => {
    expect(
      getFilterQueryVariables(new URLSearchParams("?sort=best-selling")),
    ).toEqual({
      sortKey: "BEST_SELLING",
      reverse: false,
      filters: [],
    });
    expect(
      getFilterQueryVariables(new URLSearchParams("?sort=price-high-to-low")),
    ).toEqual({
      sortKey: "PRICE",
      reverse: true,
      filters: [],
    });
    expect(
      getFilterQueryVariables(new URLSearchParams("?sort=price-low-to-high")),
    ).toEqual({
      sortKey: "PRICE",
      reverse: false,
      filters: [],
    });
    expect(
      getFilterQueryVariables(new URLSearchParams("?sort=newest")),
    ).toEqual({
      sortKey: "CREATED",
      reverse: true,
      filters: [],
    });
    expect(
      getFilterQueryVariables(new URLSearchParams("?sort=best-selling")),
    ).toEqual({
      sortKey: "BEST_SELLING",
      reverse: false,
      filters: [],
    });
  });

  it("redirects to a valid url when invalid filters are provided", () => {
    const searchParams = new URLSearchParams(
      "?sort=test&available=blah&price.min=asdf&price.max=fdsa&product-type=toys&product-type=not-toys&product-type=apparel",
    );
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    const r = redirect("?product-type=toys&product-type=apparel");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
  });

  it("redirects with when invalid sort provided", () => {
    const searchParams = new URLSearchParams("?sort=test");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    const r = redirect("?");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
  });

  it("redirects with when invalid available provided", () => {
    const searchParams = new URLSearchParams("?available=blah");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    const r = redirect("?");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
  });

  it("redirects with when invalid price.min provided", () => {
    let searchParams = new URLSearchParams("?price.min=blah");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    let r = redirect("?");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
    searchParams = new URLSearchParams("?price.min=-10");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    r = redirect("?");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
  });

  it("redirects with when invalid price.max provided", () => {
    let searchParams = new URLSearchParams("?price.max=blah");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    let r = redirect("?");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
    searchParams = new URLSearchParams("?price.max=-10");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    r = redirect("?");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
  });

  it("redirects with when invalid product-type provided", () => {
    const searchParams = new URLSearchParams("?product-type=blah");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(Response);
    const r = redirect("?");
    expect(() => getFilterQueryVariables(searchParams)).toThrow(
      expect.objectContaining(r),
    );
  });
});
