// import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
// import {cva, type VariantProps} from 'class-variance-authority';

import {cn} from '~/lib';

// const buttonVariants = cva(
//   'inline-flex items-center justify-center whitespace-nowrap ' +
//     'rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-neutral-950 dark:focus-visible:ring-neutral-300',
//   {
//     variants: {
//       variant: {
//         default:
//           'bg-neutral-900 text-neutral-50 hover:bg-neutral-900/90 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/90',
//         destructive:
//           'bg-red-500 text-neutral-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-neutral-50 dark:hover:bg-red-900/90',
//         outline:
//           'border border-neutral-200 bg-white hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
//         secondary:
//           'bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-800/80',
//         ghost:
//           'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
//         link: 'text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50',
//       },
//       size: {
//         default: 'h-10 px-4 py-2',
//         sm: 'h-9 rounded-md px-3',
//         lg: 'h-11 rounded-md px-8',
//         icon: 'h-10 w-10',
//       },
//     },
//     defaultVariants: {
//       variant: 'default',
//       size: 'default',
//     },
//   },
// );

// export interface ButtonProps
//   extends React.ButtonHTMLAttributes<HTMLButtonElement>,
//     VariantProps<typeof buttonVariants> {
//   asChild?: boolean;
// }

// const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
//   ({className, variant, size, asChild = false, ...props}, ref) => {
//     const Comp = asChild ? Slot : 'button';
//     return (
//       <Comp
//         className={cn(buttonVariants({variant, size, className}))}
//         ref={ref}
//         {...props}
//       />
//     );
//   },
// );
// Button.displayName = 'Button';

// export {Button, buttonVariants};

interface ButtonProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  asChild?: boolean;
}

// color: var(--Text, #DADADA);
// font-family: Inter;
// font-size: 16px;
// font-style: normal;
// font-weight: 700;
// line-height: normal;
// letter-spacing: 0.64px;

// border-radius: 12px;
// background: var(--Button, #59585C);
// box-shadow:
//   0px 2px 2px 0px rgba(255, 255, 255, 0.10) inset,
//   0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset,
//   0px 6px 2px 0px rgba(0, 0, 0, 0.10),
//   0px 4px 0px 0px var(--Button, #59585C);

/// WELL

// border-radius: 14px;
// background: var(--Button-Well-or-Form-Field, rgba(0, 0, 0, 0.20));

export function Button({asChild, ...props}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  const textStyles = 'text-neutral-600 dark:text-neutral-300 leading-6';
  const buttonStyles =
    'rounded-[12px] py-3 bg-neutral-50 dark:bg-neutral-500 bg-opacity-5 dark:bg-opacity-100';
  const textButtonStyles = 'px-4';
  const iconButtonStyles = 'px-[14px]';
  const borderStyles = 'shadow-yamaha-button';
  const wellStyles = 'rounded-[14px] bg-cyan-brand bg-opacity-5 dark:bg-opacity-20';

  return (
    // <div className='overflow-hidden relative px-[4px] py-[3px]'>
      <Comp
        {...props}
        className={cn(
          textStyles,
          buttonStyles,
          textButtonStyles,
          borderStyles,
          // wellStyles,
          // 'shadow-inner',

          // 'hover:bg-white dark:hover:bg-white dark:hover:bg-opacity-20',
          // 'border-[4px] border-opacity-5 border-black',

          props.className,
        )}
      />
    //   <div className={cn(wellStyles, '-z-10 absolute left-0 right-0 top-0 bottom-0')} />
    // </div>
  );
}
