import React, { useState, useEffect } from 'react';
import {
  X, Search, Calendar, ChevronLeft, ChevronRight, Loader2, Edit2, AlertTriangle, Check, RotateCcw
} from 'lucide-react'; // Keep Calendar for potential future use
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { Product, User } from '../../types'; // Import User type
import toast from 'react-hot-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { toGMT8 } from '../../lib/utils';

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  user: User | null; // Changed from userRole to user object
  onStockAdjusted?: () => void;
}

// Using internal type definition
interface StockHistoryEntry {
  id: string;
  product_id: string;
  user_id: string | null;
  previous_stock: number;
  new_stock: number;
  change: number;
  created_at: string;
  type: string; // Added type field (assuming it exists in fetched data)
  product: {
    name: string | null;
  } | null;
  user: {
    email: string | null;
    name?: string | null; // Add name
  } | null;
  // Flattened properties
  product_name: string;
  user_email: string; // Keep this for potential sorting/filtering compatibility?
  user_name?: string; // Add separate flattened name
}

// Define specific types stored in the DB 'type' column
type DbHistoryType = 'sale' | 'adjustment'; // Adjusted to match the actual allowed values
// Define filter options
type HistoryFilterType = 'all' | DbHistoryType;

type DateRange = 'day' | 'week' | 'month' | 'custom';
type SortField = 'created_at' | 'product_name' | 'user_email' | 'change' | 'type'; // Added 'type'
type SortOrder = 'asc' | 'desc';

const pageSize = 10; // Change from 15 to 10

export function StockHistoryModal({ isOpen, onClose, products, user, onStockAdjusted }: StockHistoryModalProps) {
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryFilterType>('all'); // Default to 'all'
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdjustmentInput, setShowAdjustmentInput] = useState(false);
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'; // Determine if admin

  // Updated dependencies for fetching history
  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, currentPage, selectedDate, selectedProductFilter, historyTypeFilter, sortField, sortOrder, searchQuery]); // Added searchQuery

  // Reset adjustment input when product filter changes
  useEffect(() => {
    setShowAdjustmentInput(false);
    setAdjustmentValue(0);
    setAdjustmentReason('');
  }, [selectedProductFilter]);

  // Function to handle date change from the calendar input OR buttons
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setCurrentPage(1); // Reset page when date changes
  };
  
  // Function for Previous Day button
  const handlePreviousDay = () => {
    const currentDate = new Date(selectedDate); // Parse current date string
    const previousDate = subDays(currentDate, 1);
    handleDateChange(format(previousDate, 'yyyy-MM-dd'));
  };
  
  // Function for Next Day button
  const handleNextDay = () => {
    const currentDate = new Date(selectedDate); // Parse current date string
    const nextDate = addDays(currentDate, 1);
    handleDateChange(format(nextDate, 'yyyy-MM-dd'));
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Use selectedDate for time range ONLY if not searching
      const isSearching = searchQuery.trim().length > 0;
      const startTime = toGMT8(new Date(selectedDate)); startTime.setHours(0, 0, 0, 0);
      const endTime = toGMT8(new Date(selectedDate)); endTime.setHours(23, 59, 59, 999);

      let countQuery = supabase
        .from('stock_history')
        .select('*', { count: 'exact', head: true });

      let dataQuery = supabase
        .from('stock_history')
        .select(`*, user:user_id ( email, name )`);

      // Apply date filter ONLY if not searching
      if (!isSearching) {
        countQuery = countQuery
          .gte('created_at', startTime.toISOString())
          .lte('created_at', endTime.toISOString());
        dataQuery = dataQuery
          .gte('created_at', startTime.toISOString())
          .lte('created_at', endTime.toISOString());
      }

      // Apply other filters (Product, Type)
      if (selectedProductFilter) {
        countQuery = countQuery.eq('product_id', selectedProductFilter);
        dataQuery = dataQuery.eq('product_id', selectedProductFilter);
      }
      if (historyTypeFilter !== 'all') {
        countQuery = countQuery.eq('type', historyTypeFilter);
        dataQuery = dataQuery.eq('type', historyTypeFilter);
      }
      // Note: Search term filtering is still done client-side below

      // Get total count (reflects date filter only if not searching)
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      
      let preliminaryTotalPages = Math.ceil((count || 0) / pageSize);

      // Fetch paginated data (reflects date filter only if not searching)
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize - 1;
      dataQuery = dataQuery
        .order(sortField, { ascending: sortOrder === 'asc' })
        .range(start, end);

      const { data, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      const productMap = new Map(products.map(p => [p.id, p.name]));

      // Process data and apply client-side search filter
      let processedHistory = (data || []).map(item => ({
        ...item,
        product_name: productMap.get(item.product_id) || 'Unknown Product',
        user_email: item.user?.email || 'System',
        user_name: item.user?.name || null,
        user: undefined
      })).filter(item => { 
        // This filter applies the actual search term comparison
        if (!isSearching) return true; // If not searching, keep all fetched items
        const lowerQuery = searchQuery.toLowerCase();
        return (
          item.user_email.toLowerCase().includes(lowerQuery) ||
          (item.user_name && item.user_name.toLowerCase().includes(lowerQuery)) ||
          // Optional: Add search on product name as well?
          item.product_name.toLowerCase().includes(lowerQuery)
        );
      });
      
      // Adjust total pages if client-side filtering significantly reduced results
      // This is an approximation; accurate count requires DB changes or fetching all results
      if (isSearching && count && count > processedHistory.length) {
         // Recalculate based on filtered length ONLY if it affects current page view
         const filteredTotalPages = Math.ceil(processedHistory.length / pageSize);
         // For simplicity, let's stick with the server count for pagination controls
         // as client-side filtering only affects the *display* on the current page.
         // preliminaryTotalPages = filteredTotalPages > 0 ? filteredTotalPages : 1; 
      }
      
      setTotalPages(preliminaryTotalPages > 0 ? preliminaryTotalPages : 1);
      if (currentPage > preliminaryTotalPages && preliminaryTotalPages > 0) {
          setCurrentPage(preliminaryTotalPages);
      }

      setHistory(processedHistory);

    } catch (error: any) {
      console.error("Error fetching stock history:", error);
      toast.error(`Failed to fetch history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    setSortOrder(current => {
      if (sortField === field) {
        return current === 'asc' ? 'desc' : 'asc';
      }
      return field === 'created_at' ? 'desc' : 'asc'; 
    });
    setSortField(field);
    setCurrentPage(1);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user) { toast.error("User not identified."); return; }
     if (!selectedProductFilter) { toast.error("No product selected for adjustment."); return; }
     if (adjustmentValue <= 0) { toast.error("Adjustment value must be positive."); return; }
     if (!adjustmentReason.trim()) { toast.error("Adjustment reason cannot be empty."); return; }
 
     setSubmittingAdjustment(true);
    try {
      const { data: currentProductData, error: fetchError } = await supabase
        .from('products').select('stock').eq('id', selectedProductFilter).single();
      if (fetchError || !currentProductData) throw fetchError || new Error("Product not found");
      const currentStock = currentProductData.stock;
       const newStockLevel = currentStock + adjustmentValue;

      const { error: historyError } = await supabase.from('stock_history').insert({
        product_id: selectedProductFilter,
         user_id: user.id, 
        previous_stock: currentStock,
        new_stock: newStockLevel,
         change: adjustmentValue,
         type: 'adjustment', 
         reason: adjustmentReason.trim()
      });
      if (historyError) throw historyError;

      const { error: productUpdateError } = await supabase.from('products')
        .update({ stock: newStockLevel }).eq('id', selectedProductFilter);
      if (productUpdateError) throw productUpdateError;

      toast.success("Stock adjusted successfully.");
       setShowAdjustmentInput(false); 
       setAdjustmentValue(0);
       setAdjustmentReason('');
       await fetchHistory();
       if (onStockAdjusted) onStockAdjusted();

    } catch (error: any) {
       console.error("Error submitting stock adjustment:", error);
      toast.error(`Adjustment failed: ${error.message}`);
    } finally {
       setSubmittingAdjustment(false);
     }
  };

  // Corrected getPageNumbers to always return an array
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 1) return [1]; // Return array even for single page

    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust range if it's too small
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Always show first page and ellipsis if needed
    if (startPage > 1) pages.push(1);
    if (startPage > 2) pages.push('...');

    // Add page numbers in the calculated range
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    // Always show last page and ellipsis if needed
    if (endPage < totalPages - 1) pages.push('...');
    if (endPage < totalPages) pages.push(totalPages);
    
        return pages;
   };

  if (!isOpen) return null;

  const selectedProdDetails = products.find(p => p.id === selectedProductFilter);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">
            {showAdjustmentInput ? `Adjust Stock: ${selectedProdDetails?.name || '...'}` : 'Stock History'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!showAdjustmentInput && (
          <div className="p-4 md:p-6 border-b border-gray-200 mb-4 flex-shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-4">
              <div>
                <label htmlFor="stockHistoryDate" className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousDay}
                    className="h-9 w-9"
                  >
                    <ChevronLeft className="h-5 w-5" />
                   </Button>
                  <div className="relative flex-grow">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="stockHistoryDate"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="pl-10 h-9 text-sm w-full"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextDay}
                    className="h-9 w-9"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  </div>
            </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select
                  value={historyTypeFilter}
                    onChange={(e) => { setHistoryTypeFilter(e.target.value as HistoryFilterType); setCurrentPage(1); }}
                    className="h-9 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  >
                    <option value="all">All Types</option>
                  <option value="sale">Sales</option>
                  <option value="adjustment">Adjustments</option>
                  </select>
                </div>

               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
                <select value={selectedProductFilter} onChange={(e) => { setSelectedProductFilter(e.target.value); setCurrentPage(1); }} className="h-9 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500">
                   <option value="">All Products</option>
                   {products.sort((a, b) => a.name.localeCompare(b.name)).map((product) => (<option key={product.id} value={product.id}>{product.name}</option>))}
                 </select>
               </div>

              <div className="relative">
                <label htmlFor="stockHistorySearch" className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                <Search className="absolute left-3 top-8 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="stockHistorySearch"
                  type="text"
                  placeholder="Search by user or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 text-sm"
                />
              </div>
            </div>

               {isAdmin && selectedProductFilter && (
                <div className="flex justify-end">
                   <Button variant="outline" size="sm" onClick={() => setShowAdjustmentInput(true)}>
                       <Edit2 className="h-4 w-4 mr-2"/> Adjust Stock for "{selectedProdDetails?.name || '...'}"
                     </Button>
                     </div>
                   )}
                 </div>
               )}

        {showAdjustmentInput && (
          <div className="p-4 md:p-6 border-b mb-4 flex-shrink-0">
            <form onSubmit={handleAdjustmentSubmit} className='p-4 border rounded-md bg-gray-50 space-y-4 max-w-md mx-auto'>
               <div className='flex items-center gap-2'>
                 <label htmlFor='adjustmentValue' className='text-sm font-medium'>Add Quantity (+):</label>
                 <Input 
                    id='adjustmentValue' 
                    type="number" 
                    value={adjustmentValue} 
                    onChange={(e) => setAdjustmentValue(parseInt(e.target.value, 10) || 0)} 
                    placeholder={`Current: ${selectedProdDetails?.stock ?? 'N/A'}`} 
                    className="h-9 text-sm flex-grow" 
                    min="1" 
                    required 
                 />
               </div>
               <div>
                 <label htmlFor='adjustmentReason' className='text-sm font-medium'>Reason:</label>
                 <Input 
                    id='adjustmentReason' 
                    type="text" 
                    value={adjustmentReason} 
                    onChange={(e) => setAdjustmentReason(e.target.value)} 
                    placeholder="Reason for adjustment" 
                    className="mt-1 h-9 text-sm w-full" 
                    required 
                 />
               </div>
               <div className='flex gap-2 justify-end'>
                 <Button variant="ghost" size="sm" type="button" onClick={() => setShowAdjustmentInput(false)} disabled={submittingAdjustment}>Cancel</Button>
                 <Button size="sm" type="submit" disabled={submittingAdjustment}> 
                   {submittingAdjustment ? <Loader2 className='h-4 w-4 animate-spin mr-1'/> : <Check className='h-4 w-4 mr-1'/>}
                   Confirm Adjustment
                 </Button>
            </div>
            </form>
          </div>
        )}

        {!showAdjustmentInput && (
           <>
              <div className="flex-grow overflow-auto min-h-[400px]">
                <div className="px-4 md:px-6"> 
          {loading ? (
                      <div className="flex justify-center items-center min-h-[200px]"> 
                         <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                      </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    {(['created_at', 'product_name', 'user_email', 'previous_stock', 'new_stock', 'change', 'type'] as const).map(field => (
                      <th key={field} scope="col"
                          className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${['created_at', 'product_name', 'user_email', 'change', 'type'].includes(field) ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                          onClick={() => ['created_at', 'product_name', 'user_email', 'change', 'type'].includes(field) ? handleSort(field as SortField) : undefined}
                      >
                        {field === 'user_email' ? 'Cashier' : field.replace('_', ' ')}
                        {sortField === field && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                        No stock history found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    history.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                          {format(toGMT8(new Date(item.created_at)), 'dd MMM yy, HH:mm')}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">
                          {item.product_name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                          {item.user_name || item.user_email}
                        </td>
                        <td className="px-4 py-2 text-center whitespace-nowrap text-gray-500">
                          {item.previous_stock}
                        </td>
                        <td className="px-4 py-2 text-center whitespace-nowrap text-gray-500">
                          {item.new_stock}
                        </td>
                        <td className={`px-4 py-2 text-center whitespace-nowrap font-medium ${item.change > 0 ? 'text-green-600' : item.change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {item.change > 0 ? `+${item.change}` : item.change}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {item.type || 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
              </div>
              {!loading && totalPages > 1 && (
                 <div className="p-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                    <span className="text-sm text-gray-700">
                       Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                    </span>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                       <Button 
                           onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                           disabled={currentPage === 1}
                           variant="outline"
                           className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                       >
                          <ChevronLeft className="h-5 w-5" />
                       </Button>
                       
                       {getPageNumbers().map((pageNum, index) => 
                          typeof pageNum === 'number' ? (
                             <Button 
                                 key={pageNum} 
                                 onClick={() => setCurrentPage(pageNum)} 
                                 variant={currentPage === pageNum ? 'default' : 'outline'}
                                 className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === pageNum ? 'z-10' : ''}`}
                             >
                                {pageNum}
                             </Button>
                          ) : (
                             <span key={`ellipsis-${index}`} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                             </span>
                          )
                       )}

                       <Button 
                           onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                           disabled={currentPage === totalPages}
                           variant="outline"
                           className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                       >
                          <ChevronRight className="h-5 w-5" />
                       </Button>
             </nav>
          </div>
              )}
           </>
        )}

      </div>
    </div>
  );
} 