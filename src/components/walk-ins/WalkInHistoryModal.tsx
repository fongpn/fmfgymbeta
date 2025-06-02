import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface WalkInRecord {
  id: string;
  name: string;
  check_in_time: string;
  amount: number;
  payment_method: string;
  user?: {
    email: string;
    name?: string;
  };
}

interface WalkInHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: WalkInRecord[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onDateChange?: (date: string) => void;
  selectedDate?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  onSearch: (query: string) => void;
}

export function WalkInHistoryModal({
  isOpen,
  onClose,
  history,
  loading,
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
  onDateChange,
  selectedDate,
  sortField,
  sortOrder,
  onSort,
  onSearch
}: WalkInHistoryModalProps) {
  useEffect(() => {
    if (!isOpen) {
      onSearch('');
    }
  }, [isOpen, onSearch]);

  if (!isOpen) return null;

  // Generate page numbers
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

  // Function to capitalize the first letter of status
  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onPageChange(1);
    onSearch(query);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Walk-in History</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
            {onDateChange && selectedDate && (
              <div className="flex space-x-4 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const date = new Date(selectedDate);
                    date.setDate(date.getDate() - 1);
                    onDateChange(format(date, 'yyyy-MM-dd'));
                  }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const date = new Date(selectedDate);
                    date.setDate(date.getDate() + 1);
                    onDateChange(format(date, 'yyyy-MM-dd'));
                  }}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name..."
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th 
                    scope="col" 
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${onSort ? 'cursor-pointer' : ''}`}
                    onClick={() => onSort && onSort('check_in_time')}
                  >
                    Date & Time {sortField === 'check_in_time' ? (sortOrder === 'asc' ? '↑' : '↓') : onSort ? '↕️' : ''}
                  </th>
                  <th 
                    scope="col" 
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${onSort ? 'cursor-pointer' : ''}`}
                    onClick={() => onSort && onSort('name')}
                  >
                    Name {sortField === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : onSort ? '↕️' : ''}
                  </th>
                  <th 
                    scope="col" 
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${onSort ? 'cursor-pointer' : ''}`}
                    onClick={() => onSort && onSort('amount')}
                  >
                    Amount {sortField === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : onSort ? '↕️' : ''}
                  </th>
                  <th 
                    scope="col" 
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${onSort ? 'cursor-pointer' : ''}`}
                    onClick={() => onSort && onSort('payment_method')}
                  >
                    Payment Method {sortField === 'payment_method' ? (sortOrder === 'asc' ? '↑' : '↓') : onSort ? '↕️' : ''}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cashier
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      {totalCount > 0 ? 'No results match current filters' : 'No records found'}
                    </td>
                  </tr>
                ) : (
                  history.map((record, index) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(currentPage - 1) * 10 + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(record.check_in_time), 'dd MMM yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM {record.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {record.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.user?.name || record.user?.email || 'System'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && totalCount > 0 && (
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
                    Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalCount)} of{' '}
                    <span className="font-medium">{totalCount}</span> results
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  
                  <select
                    value={currentPage}
                    onChange={(e) => onPageChange(Number(e.target.value))}
                    className="block w-full rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    aria-label="Select page"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                      <option key={pageNumber} value={pageNumber}>
                        Page {pageNumber} of {totalPages}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}