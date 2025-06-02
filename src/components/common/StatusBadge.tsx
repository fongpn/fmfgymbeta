```tsx
import React from 'react';
import { getStatusColor, capitalizeStatus } from '../../utils/status';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(status)} ${className}`}>
      {capitalizeStatus(status)}
    </span>
  );
}
```