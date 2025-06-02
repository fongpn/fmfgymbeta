import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, ToggleLeft, ToggleRight, Download, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { Coupon } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { exportToCSV } from '../../lib/utils';
import { useAuthStore } from '../../store/auth';

export default function CouponsList() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

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

  const handleExportCSV = () => {
    const exportData = coupons.map(({ id, ...coupon }) => ({
      ...coupon,
      active: coupon.active ? 'Yes' : 'No',
      created_at: new Date(coupon.created_at).toLocaleDateString(),
      valid_until: new Date(coupon.valid_until).toLocaleDateString()
    }));
    exportToCSV(exportData, 'coupons.csv');
  };

  const handleRowClick = (coupon: Coupon) => {
    // Navigate to coupon validation page and simulate a successful search
    navigate('/coupons', { state: { couponCode: coupon.code } });
  };

  const handleEditClick = (coupon: Coupon, event: React.MouseEvent) => {
    event.stopPropagation();
    navigate(`/coupons/edit/${coupon.id}`);
  };

  const filteredCoupons = coupons.filter(coupon =>
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (coupon.owner_name && coupon.owner_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/coupons')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Coupon Validation
        </Button>
      </div>
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Search by code or owner's name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex space-x-4">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button onClick={() => navigate('/coupons/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Coupon
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valid Until
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {isAdmin && (
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCoupons.map((coupon) => (
                  <tr 
                    key={coupon.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(coupon)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {coupon.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {coupon.owner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {coupon.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      RM {coupon.price.toFixed(2)}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEditClick(coupon, e)}
                          className="mr-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => toggleCouponStatus(coupon, e)}
                        >
                          {coupon.active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}