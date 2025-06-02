import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  requiredAsterisk?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, requiredAsterisk, required, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'shadow-sm',
            icon ? 'pl-10' : '',
            className
          )}
          ref={ref}
          required={required}
          {...props}
        />
        {requiredAsterisk && required && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-lg select-none">*</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };