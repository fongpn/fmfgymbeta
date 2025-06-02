import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import React from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-orange-600 text-white hover:bg-orange-700 shadow-sm',
        outline: 'border border-orange-600 text-orange-600 hover:bg-orange-50 shadow-sm',
        ghost: 'hover:bg-orange-50 text-orange-600',
        link: 'text-orange-600 underline-offset-4 hover:underline',
        success: 'bg-green-600 text-white hover:bg-green-700 shadow-sm',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        warning: 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="animate-spin h-4 w-4 mr-2 border-b-2 border-white rounded-full inline-block align-middle" aria-hidden="true"></span>
        )}
        {children}
        {loading && <span className="sr-only">Loading...</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };