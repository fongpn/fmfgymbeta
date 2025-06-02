import React, { useState } from 'react';
import { format } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react';
import { SaleHistory } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { exportToCSV } from '../../lib/utils';

interface SalesHistoryProps {
  loading: boolean;
  sales: SaleHistory[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDateChange: (date: string) => void;
  selectedDate: string;
  sortField: keyof SaleHistory | 'items';
  sortOrder: 'asc' | 'desc';
  onSort: (field: keyof SaleHistory | 'items') => void;
  onExport?: () => void;
}

export function SalesHistory({
  loading,
  sales,
  currentPage,
  totalPages,
  onPageChange,
  onDateChange,
  selectedDate,
  sortField,
  sortOrder,
  onSort,
  onExport
}: SalesHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sales based on search queryia
  const filteredSales = sales.filter(sale => {
    if (!searchQuery) return true;
    
    // Search in payment method
    if (sale.payment_method.toLowerCase().includes(searchQuery.toLowerCase())) {
      return true;
    }
    
    // Search in items
    if (sale.items && sale.items.some(item => 
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase())
    )) {
      return true;
    }

    // Search in user name or email
    if (sale.user && (sale.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || sale.user.email.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return true;
    }
    
    return false;
  });

  // Generate page numbers for pagination
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

  // Handle export to CSV
  const handleExportCSV = () => {
    if (onExport) {
      onExport();
      return;
    }
    
    const exportData = sales.map(sale => ({
      'Date & Time': format(new Date(sale.created_at), 'dd MMM yyyy HH:mm'),
      'Amount': `RM ${sale.amount.toFixed(2)}`,
      'Payment Method': sale.payment_method.replace('_', ' '),
      'Items': sale.items ? sale.items.map((item: { quantity: number; product_name: string; }) => `${item.quantity}x ${item.product_name}`).join(', ') : '',
      'Processed By': sale.user?.name || sale.user?.email || 'System'
    }));
    
    exportToCSV(exportData, `sales-${selectedDate}.csv`);
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Sales History</h2>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
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

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search sales..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          </div>
        ) : (
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
                    onClick={() => onSort('created_at')}
                  >
                    Date & Time {sortField === 'created_at' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕️'}
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => onSort('amount')}
                  >
                    Amount {sortField === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕️'}
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => onSort('payment_method')}
                  >
                    Payment Method {sortField === 'payment_method' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕️'}
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => onSort('items')}
                  >
                    Items {sortField === 'items' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕️'}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processed By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No sales found for the selected date
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale, index) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(currentPage - 1) * 15 + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(sale.created_at), 'dd MMM yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        RM {sale.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {sale.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {sale.items?.map((item, index) => (
                          <div key={index}>
                            {item.quantity}x {item.product_name} (RM {item.price.toFixed(2)})
                          </div>
                        ))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sale.user?.name || sale.user?.email || 'System'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
}