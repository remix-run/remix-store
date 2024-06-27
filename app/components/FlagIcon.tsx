import {twMerge} from 'tailwind-merge';
import {CountryCode, flagIcons} from './icons/flags';

export type FlagIconProps = React.SVGProps<SVGElement> & {code: CountryCode};
export default function FlagIcon({code, className}: FlagIconProps) {
  return (
    <svg className={twMerge('w-[20px] h-[15px]', className)} aria-hidden>
      <use href={flagIcons[code]} />
    </svg>
  );
}
