import {twMerge} from 'tailwind-merge';
import bag from '../assets/icons/bag.svg';
import check from '../assets/icons/check.svg';
import chevronDown from '../assets/icons/chevron-down.svg';
import chevronUp from '../assets/icons/chevron-up.svg';
import filter from '../assets/icons/filter.svg';
import globe from '../assets/icons/globe.svg';
import info from '../assets/icons/info.svg';
import minus from '../assets/icons/minus.svg';
import moon from '../assets/icons/moon.svg';
import plus from '../assets/icons/plus.svg';
import tag from '../assets/icons/tag.svg';
import trash from '../assets/icons/trash.svg';
import x from '../assets/icons/x.svg';

type IconName =
  | 'bag'
  | 'check'
  | 'chevronDown'
  | 'chevronUp'
  | 'filter'
  | 'globe'
  | 'info'
  | 'minus'
  | 'moon'
  | 'plus'
  | 'tag'
  | 'trash'
  | 'x';
const icons: Record<IconName, string> = {
  bag,
  check,
  chevronDown,
  chevronUp,
  filter,
  globe,
  info,
  minus,
  moon,
  plus,
  tag,
  trash,
  x,
};

export type IconProps = React.SVGProps<SVGElement> & {name: IconName};
export default function Icon({name, className}: IconProps) {
  return (
    <svg className={twMerge('size-6 text-black', className)} aria-hidden>
      <use href={icons[name]} />
    </svg>
  );
}
