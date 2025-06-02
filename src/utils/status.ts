```typescript
export function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'grace':
      return 'bg-yellow-100 text-yellow-800';
    case 'expired':
      return 'bg-red-100 text-red-800';
    case 'suspended':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStockStatusClass(stock: number, lowStockThreshold: number = 10): string {
  if (stock < 0) return 'text-red-600 font-bold';
  if (stock === 0) return 'text-yellow-600';
  if (stock <= lowStockThreshold) return 'text-orange-600';
  return 'text-gray-900';
}
```