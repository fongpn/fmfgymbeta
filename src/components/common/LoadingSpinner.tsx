```tsx
import React from 'react';

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className = 'h-8 w-8' }: LoadingSpinnerProps) {
  return (
    <div className="text-center py-8">
      <div className={`animate-spin rounded-full border-b-2 border-orange-600 mx-auto ${className}`}></div>
    </div>
  );
}
```