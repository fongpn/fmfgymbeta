import React, { useState, useEffect } from 'react';
import { X, Search, ToggleLeft, ToggleRight, Edit2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { supabase } from '../../lib/supabase';
import { Coupon } from '../../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';

interface CouponsListProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCoupon: (code: string) => void;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export function CouponsList({ isOpen, onClose, onSelectCoupon }: CouponsListProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'created_at',
    direction: 'desc'
  });
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (isOpen) {
      fetchCoupons();
    }
  }, [isOpen, currentPage, searchQuery, sortConfig]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);

      // Get total count with search filter
      let countQuery = supabase
        .from('coupons')
        .select('*', { count: 'exact', head: true });

      if (searchQuery) {
        countQuery = countQuery.or(`code.ilike.%${searchQuery}%,owner_name.ilike.%${searchQuery}%`);
      }

      const { count } = await countQuery;
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));

      // Fetch paginated records
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + (ITEMS_PER_PAGE - 1);

      let query = supabase
        .from('coupons')
        .select('*')
        .order(sortConfig.column, { ascending: sortConfig.direction === 'asc' })
        .range(start, end);

      if (searchQuery) {
        query = query.or(`code.ilike.%${searchQuery}%,owner_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      toast.error('Error fetching coupons');
    } finally {
      setLoading(false);
    }
  };

  const toggleCouponStatus = async (coupon: Coupon, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!isAdmin) {
      toast.error('Only administrators can change coupon status');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ active: !coupon.active })
        .eq('id', coupon.id);

      if (error) throw error;

      setCoupons(coupons.map(c => 
        c.id === coupon.id ? { ...c, active: !c.active } : c
      ));

      toast.success(`Coupon ${coupon.active ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast.error('Error updating coupon status');
    }
  };

  const handleEditClick = (coupon: Coupon, event: React.MouseEvent) => {
    event.stopPropagation();
    onClose();
    navigate(`/coupons/edit/${coupon.id}`);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSelect = (value: string) => {
    handlePageChange(parseInt(value, 10));
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

  const handleSort = (column: string) => {
    setSortConfig(current => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (column: string) => {
    if (sortConfig.column !== column) {
      return <ChevronUp className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="h-4 w-4 text-orange-600" /> : 
      <ChevronDown className="h-4 w-4 text-orange-600" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">All Coupons</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 overflow-auto">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by code or owner's name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('code')}
                    >
                      <div className="flex items-center gap-1">
                        Code
                        {getSortIcon('code')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('owner_name')}
                    >
                      <div className="flex items-center gap-1">
                        Owner
                        {getSortIcon('owner_name')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-1">
                        Type
                        {getSortIcon('type')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('uses')}
                    >
                      <div className="flex items-center gap-1">
                        Usage
                        {getSortIcon('uses')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('valid_until')}
                    >
                      <div className="flex items-center gap-1">
                        Valid Until
                        {getSortIcon('valid_until')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('active')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {getSortIcon('active')}
                      </div>
                    </th>
                    {isAdmin && (
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-6 py-4 text-center text-gray-500">
                        No coupons found
                      </td>
                    </tr>
                  ) : (
                    coupons.map((coupon, index) => (
                      <tr 
                        key={coupon.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => onSelectCoupon(coupon.code)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {coupon.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {coupon.owner_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {coupon.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {coupon.uses} / {coupon.max_uses}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(coupon.valid_until), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            coupon.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {coupon.active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => toggleCouponStatus(coupon, e)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              {coupon.active ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleEditClick(coupon, e)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && coupons.length > 0 && (
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
                  <ChevronLeft className="h-4 w-4" />
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
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}