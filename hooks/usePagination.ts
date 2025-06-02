```typescript
import { useState, useMemo } from 'react';

interface PaginationOptions {
  initialPage?: number;
  pageSize?: number;
  totalItems: number;
}

export function usePagination({ initialPage = 1, pageSize = 15, totalItems }: PaginationOptions) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  
  const totalPages = useMemo(() => Math.ceil(totalItems / pageSize), [totalItems, pageSize]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);
  const firstPage = () => goToPage(1);
  const lastPage = () => goToPage(totalPages);

  return {
    currentPage,
    totalPages,
    getPageNumbers,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    pageSize
  };
}
```