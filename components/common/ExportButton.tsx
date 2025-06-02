```tsx
import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';

interface ExportButtonProps {
  onClick: () => void;
  className?: string;
}

export function ExportButton({ onClick, className }: ExportButtonProps) {
  return (
    <Button variant="outline" onClick={onClick} className={className}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
```