import {Slot} from '@radix-ui/react-slot';
import {cn} from '~/lib';

type ButtonSize = 'icon' | 'sm' | 'lg';
interface ButtonProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  size: ButtonSize;
  asChild?: boolean;
}

export function Button({asChild, size, ...props}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  const textStyles = 'text-neutral-600 dark:text-neutral-300 leading-6';
  const smTextStyles = 'font-bold uppercase leading-6';
  const lgTextStyles = 'font-bold leading-[29px] text-2xl';
  const buttonStyles =
    'bg-neutral-50 dark:bg-neutral-500 bg-opacity-5 dark:bg-opacity-100';
  const smButtonStyles = 'rounded-[12px] px-4 py-3';
  const iconButtonStyles = 'rounded-[12px] px-[14px] py-3';
  const lgButtonStyles = 'rounded-[16px] py-5 w-full';
  const borderStyles = 'shadow-yamaha-button';
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
        textStyles,
        size === 'sm' ? smTextStyles : size === 'lg' ? lgTextStyles : '',
        buttonStyles,
        sizeStyles[size],
        borderStyles,
        // wellStyles,
        props.className,
      )}
    />
    //   <div className={cn(wellStyles, '-z-10 absolute left-0 right-0 top-0 bottom-0')} />
    // </div>
  );
}
