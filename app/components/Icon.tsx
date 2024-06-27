import {cn} from '~/lib';

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
    <svg
      className={cn('size-6 text-black dark:text-white', className)}
      aria-hidden
      {...props}
    >
      <use href={`/sprite.svg#${name}`} />
    </svg>
  );
}
