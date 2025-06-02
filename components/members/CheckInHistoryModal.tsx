import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface CheckIn {
  id: string;
  check_in_time: string;
  type: 'member' | 'walk-in';
  member?: {
    member_id: string;
    name: string;
  };
  name: string;
  phone: string;
  user?: {
    email: string;
    name?: string;
  };
}

interface CheckInHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkIns: CheckIn[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onDateChange: (date: string) => void;
  selectedDate: string;
  sortField: keyof CheckIn | 'member_id' | 'name';
  sortOrder: 'asc' | 'desc';
  onSort: (field: keyof CheckIn | 'member_id' | 'name') => void;
  type: 'member' | 'walk-in';
  onSearch: (query: string) => void;
}

export function CheckInHistoryModal({
  isOpen,
  onClose,
  checkIns,
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
  type,
  onSearch
}: CheckInHistoryModalProps) {
  useEffect(() => {
    if (!isOpen) {
      onSearch('');
    }
  }, [isOpen, onSearch]);

  if (!isOpen) return null;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onPageChange(1);
    onSearch(query);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {type === 'member' ? 'Member Check-in History' : 'Walk-in History'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder={type === 'member' ? "Search by member ID or name..." : "Search by name..."}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            {(totalCount === checkIns.length && !loading) && (
              <div className="flex items-center space-x-2">
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
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => onSort('check_in_time')}
                  >
                    Date & Time {sortField === 'check_in_time' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕️'}
                  </th>
                  {type === 'member' ? (
                    <>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => onSort('member_id')}
                      >
                        Member ID {sortField === 'member_id' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕️'}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => onSort('name')}
                      >
                        Name {sortField === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕️'}
                      </th>
                    </>
                  ) : (
                    <>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                    </>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Checked in by
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
                ) : checkIns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      {totalCount > 0 ? 'No results match current filters' : 'No check-ins found'}
                    </td>
                  </tr>
                ) : (
                  checkIns.map((checkIn, index) => (
                    <tr key={checkIn.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(currentPage - 1) * 10 + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(checkIn.check_in_time), 'dd MMM yyyy HH:mm')}
                      </td>
                      {type === 'member' ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {checkIn.member?.member_id || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {checkIn.member?.name || '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {checkIn.name}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {checkIn.user?.name || checkIn.user?.email || 'System'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalCount > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalCount)} of {totalCount} results
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
          )}
        </div>
      </div>
    </div>
  );
}