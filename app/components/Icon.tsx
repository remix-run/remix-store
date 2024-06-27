import {twMerge} from 'tailwind-merge';

export type IconName =
  | 'bag'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'computer'
  | 'filter'
  | 'globe'
  | 'info'
  | 'minus'
  | 'moon'
  | 'plus'
  | 'sun'
  | 'tag'
  | 'trash'
  | 'x';

export type IconProps = Omit<React.SVGProps<SVGElement>, 'ref'> & {
  name: IconName;
};
export default function Icon({name, className, ...props}: IconProps) {
  return (
    <svg className={twMerge('size-6 text-black', className)} aria-hidden>
      <use href={`/sprite.svg#${name}`} />
    </svg>
  );
}
