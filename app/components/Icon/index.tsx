import {cn} from '~/lib';
import type {IconName} from './types';

export type IconProps = Omit<React.SVGProps<SVGElement>, 'ref'> & {
  name: IconName;
};

export default function Icon({name, className, ...props}: IconProps) {
  return (
    <svg
      className={cn('size-6 text-black dark:text-white', className)}
      aria-hidden={
        props['aria-label'] ? undefined : props['aria-hidden'] || true
      }
      {...props}
    >
      <use href={`/sprite.svg#${name}`} />
    </svg>
  );
}
