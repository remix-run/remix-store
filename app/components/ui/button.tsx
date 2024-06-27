import {Slot} from '@radix-ui/react-slot';
import {cn} from '~/lib';

type ButtonSize = 'icon' | 'sm' | 'lg';
type ButtonVariant = 'primary' | 'secondary' | 'brand-shop-pay';
interface ButtonProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  size: ButtonSize;
  variant: ButtonVariant;
  asChild?: boolean;
}

export function Button({asChild, size, variant, ...props}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  const secondaryStyles =
    'text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-500 dark:hover:bg-neutral-400 bg-opacity-5 dark:bg-opacity-100 shadow-yamaha-grey -light dark:shadow-yamaha-grey';
  const primaryStyles =
    'text-white bg-success-brand dark:bg-success-brand bg-opacity-100 shadow-yamaha-blue';
  const textStyles = 'leading-6';
  const smTextStyles = 'font-bold uppercase leading-6';
  const lgTextStyles = 'font-bold leading-[29px] text-2xl';
  const smButtonStyles = 'rounded-[12px] px-4 py-3';
  const iconButtonStyles = 'rounded-[12px] px-[14px] py-3';
  const lgButtonStyles = 'rounded-[16px] py-5 w-full';
  const wellStyles =
    'rounded-[14px] bg-cyan-brand bg-opacity-5 dark:bg-opacity-20';
  const sizeStyles: Record<ButtonSize, string> = {
    ['sm']: smButtonStyles,
    lg: lgButtonStyles,
    icon: iconButtonStyles,
  };

  return (
    // <div className='overflow-hidden relative px-[4px] py-[3px]'>
    <Comp
      {...props}
      className={cn(
        'cursor-pointer',
        textStyles,
        size === 'sm' ? smTextStyles : size === 'lg' ? lgTextStyles : '',

        'active:translate-y-1',
        {
          [secondaryStyles]: variant === 'secondary',
          [primaryStyles]: variant === 'primary',
        },

        sizeStyles[size],
        // wellStyles,
        props.className,
      )}
    />
    //   <div className={cn(wellStyles, '-z-10 absolute left-0 right-0 top-0 bottom-0')} />
    // </div>
  );
}
