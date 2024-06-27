import {Slot} from '@radix-ui/react-slot';
import {forwardRef} from 'react';
import {cn} from '~/lib';

type ButtonSize = 'icon' | 'sm' | 'lg';
type ButtonVariant = 'primary' | 'secondary';
interface ButtonProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  size?: ButtonSize;
  variant?: ButtonVariant;
  asChild?: boolean;
}

export const Button = forwardRef(function Button(
  {asChild, size = 'sm', variant = 'secondary', ...props}: ButtonProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const Comp = asChild ? Slot : 'button';

  const secondaryStyles =
    'text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-500 dark:hover:bg-neutral-400 hover:bg-neutral-100 bg-opacity-5 dark:bg-opacity-100 shadow-yamaha-grey-light dark:shadow-yamaha-grey';
  const primaryStyles =
    'text-white bg-success-brand dark:bg-success-brand bg-opacity-100 shadow-yamaha-blue';
  const smTextStyles = 'font-bold uppercase leading-6';
  const lgTextStyles = 'font-bold leading-[29px] text-2xl';
  const smButtonStyles = 'rounded-[12px] px-4 py-3';
  const iconButtonStyles = 'rounded-[12px] px-[14px] py-3';
  const lgButtonStyles = 'rounded-[16px] py-5 w-full';
  const lgWellStyles = 'rounded-[18px] pb-[7px]';
  const smWellStyles = 'rounded-[14px] pb-[7px]';

  return (
    <div
      ref={ref}
      className={cn(
        'h-fit',
        'overflow-hidden relative rounded-[14px] bg-black bg-opacity-5 dark:bg-opacity-15 p-[2px]',
        {
          [lgWellStyles]: size === 'lg',
          [smWellStyles]: size === 'sm' || size === 'icon',
        },
      )}
    >
      <Comp
        {...props}
        className={cn(
          'block leading-6',
          'active:translate-y-1',
          {
            [iconButtonStyles]: size === 'icon',
            [smTextStyles]: size === 'sm',
            [lgTextStyles]: size === 'lg',
            [smButtonStyles]: size === 'sm',
            [lgButtonStyles]: size === 'lg',
            [secondaryStyles]: variant === 'secondary',
            [primaryStyles]: variant === 'primary',
          },
          props.className,
        )}
      />
    </div>
  );
});
