import {
  SHOP_PAY_BUTTON_TAG_NAME,
  renderShopPayButton,
} from "@shopify/hydrogen";
import { css, ref, unsafeHTML, type Handle } from "remix/component";

// Hydrogen intentionally exposes only width and borderRadius. Keep this
// isolated override in sync with its internal `.shop-pay-button` class when
// upgrading Hydrogen so the local renderer keeps the previous height.
const HEIGHT_OVERRIDE_ATTRIBUTE = "data-remix-height-override";
const HEIGHT_OVERRIDE = `
  <style ${HEIGHT_OVERRIDE_ATTRIBUTE}>
    .shop-pay-button { height: 64px; }
    @media (min-width: 1400px) {
      .shop-pay-button { height: 66px; }
    }
  </style>
`;

/** A Shop Pay button that buys one of the variant directly. */
export function ExpressShopPayButton(
  handle: Handle<{ storeUrl: string; variantId: string }>,
) {
  let container: Element | undefined;

  return () => {
    let html = renderShopPayButton({
      checkoutUrl: handle.props.storeUrl,
      variants: [{ id: handle.props.variantId, quantity: 1 }],
      width: "100%",
      borderRadius: "54px",
    }).replace("</template>", `${HEIGHT_OVERRIDE}</template>`);

    // Browsers only attach declarative shadow roots while parsing, so a
    // client-rendered button needs the override appended to its shadow root.
    handle.queueTask((signal) => {
      if (signal.aborted || !container) return;
      let shadowRoot = container.querySelector(
        SHOP_PAY_BUTTON_TAG_NAME,
      )?.shadowRoot;
      if (
        !shadowRoot ||
        shadowRoot.querySelector(`style[${HEIGHT_OVERRIDE_ATTRIBUTE}]`)
      ) {
        return;
      }
      let template = document.createElement("template");
      template.innerHTML = HEIGHT_OVERRIDE;
      shadowRoot.append(template.content);
    });

    return (
      <div
        innerHTML={unsafeHTML(html)}
        mix={[
          shopPayStyle,
          ref((element) => {
            container = element;
          }),
        ]}
      />
    );
  };
}

const shopPayStyle = css({
  width: "100%",
  "@media (min-width: 1400px)": { gridColumn: "1 / -1" },
});
