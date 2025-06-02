```tsx
import React from 'react';

interface EmptyStateProps {
  message: string;
  colSpan?: number;
}

export function EmptyState({ message, colSpan = 1 }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-4 text-center text-sm text-gray-500">
        {message}
      </td>
    </tr>
  );
}
```