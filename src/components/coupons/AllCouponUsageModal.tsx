import React, { useState, useEffect } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { X, Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { toGMT8 } from '../../lib/utils';
import toast from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface CouponData {
  code: string;
  owner_name: string | null;
}

interface UserData {
  email: string;
}

interface RpcCouponUseData {
  id: string;
  used_at: string;
  user_id: string | null;
  coupon_code: string;
  coupon_owner_name: string | null;
}

interface CouponUseData {
  id: string;
  used_at: string;
  user_id: string | null;
  coupons: CouponData;
  // users: UserData | null; // Removed - Fetched separately
}

interface CouponUse {
  id: string;
  used_at: string;
  coupon: {
    code: string;
    owner_name?: string;
  };
  user?: {
    email: string;
    name?: string;
  };
}

interface AllCouponUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AllCouponUsageModal({
  isOpen,
  onClose
}: AllCouponUsageModalProps) {
  const [history, setHistory] = useState<CouponUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (isOpen) {
      fetchAllCouponUsage();
    }
  }, [isOpen, selectedDate, currentPage, searchQuery]);

  const fetchAllCouponUsage = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    setHistory([]); // Clear previous history
    try {
      // Prepare dates and pagination params
      const startDate = toGMT8(new Date(selectedDate));
      startDate.setHours(0, 0, 0, 0);
      const endDate = toGMT8(new Date(selectedDate));
      endDate.setHours(23, 59, 59, 999);
      const startDateIso = startDate.toISOString();
      const endDateIso = endDate.toISOString();
      
      const startOffset = (currentPage - 1) * ITEMS_PER_PAGE;
      const effectiveSearchTerm = searchQuery.trim() || null; // Pass null if empty

      // --- Call RPC for Count ---      
      const { data: countData, error: countError } = await supabase.rpc('count_coupon_usage', {
          search_term: effectiveSearchTerm,
          start_date: effectiveSearchTerm ? null : startDateIso, // Only pass date if not searching
          end_date: effectiveSearchTerm ? null : endDateIso     // Only pass date if not searching
        });

      if (countError) {
        console.error('Error fetching count via RPC:', countError);
        throw countError; 
      }
      const totalCount = countData || 0;
      setTotalPages(Math.ceil(totalCount / ITEMS_PER_PAGE));
      // --- End Call RPC for Count ---      

      if (totalCount === 0) {
          setHistory([]);
          setLoading(false);
          return; // No data to fetch
      }

      // --- Call RPC for Data ---      
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_coupon_usage', {
          search_term: effectiveSearchTerm,
          start_date: effectiveSearchTerm ? null : startDateIso, // Only pass date if not searching
          end_date: effectiveSearchTerm ? null : endDateIso,     // Only pass date if not searching
          page_limit: ITEMS_PER_PAGE,
          page_offset: startOffset
      });

      if (rpcError) {
        console.error('Error fetching data via RPC:', rpcError);
        throw rpcError;
      }
      
      const couponUsesData = rpcData as RpcCouponUseData[] || [];
      console.log('Raw data from RPC:', couponUsesData);
      // --- End Call RPC for Data ---      

      // --- Fetch User Details ---
      const userIds = couponUsesData
        .map(item => item.user_id)
        .filter((id): id is string => id !== null); 
      
      const uniqueUserIds = [...new Set(userIds)];
      const userIdToDetailsMap = new Map<string, { email: string; name?: string; }>();

      if (uniqueUserIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, name')
          .in('id', uniqueUserIds);
        
        if (usersError) {
          console.error('Error fetching user details:', usersError);
        } else if (usersData) {
          usersData.forEach(user => {
            if (user.id && user.email) { // Keep check for valid data
              userIdToDetailsMap.set(user.id, { email: user.email, name: user.name });
            }
          });
        }
      } else {
      }
      // --- End Fetch User Details ---

      // Map coupon usage data and add user details
      const finalHistory = couponUsesData.map(item => {
        const userDetails = item.user_id ? userIdToDetailsMap.get(item.user_id) : undefined;
        return {
          id: item.id,
          used_at: item.used_at,
          coupon: { // Structure expected by the table component
            code: item.coupon_code,
            owner_name: item.coupon_owner_name || '-'
          },
          // Assign whole user details object
          user: userDetails
        };
      });
      
      setHistory(finalHistory);

    } catch (error) {
      // Ensure error is an object before accessing message
      const errorMessage = (error instanceof Error) ? error.message : JSON.stringify(error);
      console.error('Error fetching all coupon usage:', errorMessage);
      toast.error('Error fetching coupon usage data. Please try again.');
      setHistory([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSelect = (value: string) => {
    handlePageChange(parseInt(value, 10));
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    const newDate = direction === 'prev' 
      ? subDays(currentDate, 1)
      : addDays(currentDate, 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    setCurrentPage(1);
  };

  const generatePageOptions = () => {
    const options = [];
    for (let i = 1; i <= totalPages; i++) {
      options.push(
        <SelectItem key={i} value={i.toString()}>
          Page {i}
        </SelectItem>
      );
    }
    return options;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {searchQuery ? `Search Results for "${searchQuery}"` : "All Coupon Usage"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 overflow-auto">
          <div className="mb-6 flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by coupon code or owner name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange('prev')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="relative flex items-center">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-40"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coupon Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
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
                      {searchQuery ? 'No results found' : 'No coupon usage records found'}
                    </td>
                  </tr>
                ) : (
                  history.map((record, index) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(record.used_at), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(record.used_at), 'HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.coupon.code || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.coupon.owner_name || '-'}
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

          {/* Pagination */}
          {!loading && history.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, (totalPages * ITEMS_PER_PAGE))} of {totalPages * ITEMS_PER_PAGE} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Select
                  value={currentPage.toString()}
                  onValueChange={handlePageSelect}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Page..." />
                  </SelectTrigger>
                  <SelectContent>
                    {generatePageOptions()}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
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