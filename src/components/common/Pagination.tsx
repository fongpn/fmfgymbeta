import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  getPageNumbers: () => number[];
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  getPageNumbers
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-between">
      <div className="flex-1 flex justify-between sm:hidden">
        <Button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          variant="outline"
        >
          Previous
        </Button>
        <Button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          variant="outline"
        >
          Next
        </Button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing page <span className="font-medium">{currentPage}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <Button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              variant="outline"
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              First
            </Button>
            <Button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              variant="outline"
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            {getPageNumbers().map((pageNum) => (
              <Button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  currentPage === pageNum
                    ? 'z-10 bg-orange-600 border-orange-600 text-white'
                    : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </Button>
            ))}

            <Button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              variant="outline"
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              variant="outline"
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Last
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
```