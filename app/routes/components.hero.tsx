import { Section } from "./components";
import { Hero } from "~/components/hero";

const imageData = {
  url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/shirt-hanging.png?v=1726259004",
  width: 1200,
  height: 1200,
  altText: "Remix t-shirt hanging from a rack",
};

export default function Buttons() {
  return (
    <div className="-mx-9 bg-neutral-100 dark:bg-neutral-700">
      <Section title="Hero component" className="p">
        <Hero
          title="Remix Logo Apparel"
          subtitle="New for Fall/Winter 2024"
          image={imageData}
          href={{
            to: "collections/all",
            text: "shop collection",
          }}
        />
      </Section>

      {/* <Section title="Hero component -- with/without subtitle, no link">
        <div />
      </Section>
      <Section title="Hero component -- Title only">
        <div />
      </Section> */}
    </div>
  );
}
