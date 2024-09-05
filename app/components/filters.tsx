import Icon from "~/components/icon";
import { Button, ButtonWithWellText } from "~/components/ui/button";

export function FiltersToolbar() {
  return (
    <div className="flex h-[var(--header-height)] items-center justify-between">
      <div className="md:hidden">
        <Button size="icon">
          <Icon name="filter" />
        </Button>
      </div>
      <div className="hidden w-[250px] md:block">
        <ButtonWithWellText size="icon" wellPostfix="Showing 6 items">
          <Icon name="filter" />
        </ButtonWithWellText>
      </div>
      <div className="w-fit md:w-[280px]">
        <ButtonWithWellText size="icon" wellPrefix="Price: High To Low">
          <Icon name="chevron-down" />
        </ButtonWithWellText>
      </div>
    </div>
  );
}
