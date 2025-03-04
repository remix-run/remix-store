import { AnimatedLink } from "~/components/ui/animated-link";
import { Section } from "./components";
import { Fragment } from "react";

export default function AnimatedLinks() {
  return (
    <div className="bg-neutral-100 dark:bg-neutral-700">
      <Section title="AnimatedLink Component" className="mb-8">
        <p className="mb-6 text-lg">
          The AnimatedLink component provides three animation types with
          customizable options:
        </p>
        <ul className="mb-8 list-disc pl-6">
          <li className="mb-2">
            <strong>Icon Animation</strong> - Animates an icon on hover
          </li>
          <li className="mb-2">
            <strong>Text Animation</strong> - Reveals additional text on hover
          </li>
          <li className="mb-2">
            <strong>Both</strong> - Combines icon and text animations
          </li>
        </ul>
      </Section>

      <Section
        title="1. Icon Animation (animationType='icon')"
        className="flex flex-col gap-8"
      >
        <p className="mb-4">
          The icon animation shows a smooth transition when hovering. Required
          props: <code>iconName</code>
        </p>

        <div className="flex flex-wrap gap-6">
          <AnimatedLink
            animationType="icon"
            to="#"
            iconName="bag"
            className="relative"
          >
            Shop Now
          </AnimatedLink>

          <AnimatedLink
            animationType="icon"
            to="#"
            iconName="chevron-right"
            iconPosition="right"
            className="relative"
          >
            View More
          </AnimatedLink>

          <AnimatedLink
            animationType="icon"
            to="#"
            iconName="info"
            className="relative"
          >
            Learn More
          </AnimatedLink>
        </div>
      </Section>

      <Section
        title="2. Text Animation (animationType='text')"
        className="flex flex-col gap-8"
      >
        <p className="mb-4">
          The text animation reveals additional text on hover. Required props:{" "}
          <code>expandedText</code>
        </p>

        <div className="flex flex-wrap gap-6">
          <AnimatedLink
            animationType="text"
            to="#"
            expandedText="Products"
            className="relative"
          >
            Browse
          </AnimatedLink>

          <AnimatedLink
            animationType="text"
            to="#"
            expandedText="Collection"
            iconName="chevron-right"
            className="relative"
          >
            Explore
          </AnimatedLink>

          <AnimatedLink
            animationType="text"
            to="#"
            expandedText="Details"
            iconName="info"
            iconPosition="right"
            className="relative"
          >
            More
          </AnimatedLink>
        </div>
      </Section>

      <Section
        title="3. Combined Animation (animationType='both')"
        className="flex flex-col gap-8"
      >
        <p className="mb-4">
          Combines both icon and text animations. Required props:{" "}
          <code>iconName</code> and <code>expandedText</code>
        </p>

        <div className="flex flex-wrap gap-6">
          <AnimatedLink
            animationType="both"
            to="#"
            iconName="bag"
            expandedText="All Products"
            className="relative"
          >
            Shop
          </AnimatedLink>

          <AnimatedLink
            animationType="both"
            to="#"
            iconName="chevron-right"
            expandedText="Collection"
            iconPosition="right"
            className="relative"
          >
            View
          </AnimatedLink>
        </div>
      </Section>
    </div>
  );
}
