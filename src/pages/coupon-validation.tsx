import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, Check, X, Plus, List, History, MinusCircle, Edit2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { CouponHistoryModal } from '../components/coupons/CouponHistoryModal';
import { CouponsList } from '../components/coupons/CouponsList';
import { AllCouponUsageModal } from '../components/coupons/AllCouponUsageModal';
import { DeductUsageDialog } from '../components/coupons/DeductUsageDialog';

interface CouponDetails {
  id: string;
  code: string;
  type: 'adult' | 'youth';
  price: number;
  valid_until: string;
  max_uses: number;
  uses: number;
  active: boolean;
  owner_name?: string;
  created_at: string;
  created_by: string | null;
  cashier_name?: string | null;
}

interface CouponUse {
  id: string;
  used_at: string;
  amount_saved: number;
  user?: {
    email: string;
  };
  payment?: {
    amount: number;
    payment_method: string;
  };
}

export default function CouponValidation() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState<CouponDetails | null>(null);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [usageHistory, setUsageHistory] = useState<CouponUse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deducting, setDeducting] = useState(false);
  const [showAllCoupons, setShowAllCoupons] = useState(false);
  const [showAllUsageToday, setShowAllUsageToday] = useState(false);
  const [showDeductDialog, setShowDeductDialog] = useState(false);
  
  // History modal state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Check if we have a coupon code from the location state
  useEffect(() => {
    if (location.state?.couponCode) {
      setCouponCode(location.state.couponCode);
      handleSearch(location.state.couponCode);
      
      // Clear the state to prevent re-searching on navigation
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSearch = async (code?: string) => {
    const searchCode = code || couponCode;
    if (!searchCode.trim()) return;

    setLoading(true);
    setCoupon(null);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select(`
          *,
          cashier:users!created_by ( name, email )
        `)
        .eq('code', searchCode.toUpperCase())
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error("Error fetching coupon:", error);
          toast.error('Error validating coupon. ' + error.message);
        } else {
          toast.error('Coupon not found');
        }
        setCoupon(null);
        return;
      }

      if (!data) {
        toast.error('Coupon not found');
        setCoupon(null);
        return;
      }

      const couponDetails: CouponDetails = {
        ...data,
        cashier_name: data.cashier?.name || data.cashier?.email || null,
      };

      setCoupon(couponDetails);
    } catch (error) {
      console.error("Catch block error validating coupon:", error);
      toast.error('An unexpected error occurred while validating the coupon.');
      setCoupon(null);
    } finally {
      setLoading(false);
    }
  };

  const handleViewUsage = async () => {
    if (!coupon) return;
    
    setLoadingHistory(true);
    setShowUsageHistory(true);
    
    try {
      await fetchUsageHistory();
    } catch (error) {
      console.error('Error fetching usage history:', error);
      toast.error('Error loading usage history');
      setUsageHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchUsageHistory = async () => {
    if (!coupon) return;
    
    try {
      // Get total count
      const { count } = await supabase
        .from('coupon_uses')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id);

      setTotalPages(Math.ceil((count || 0) / 15));

      // Fetch paginated records
      const start = (currentPage - 1) * 15;
      const end = start + 14;

      interface CouponUseResponse {
        id: string;
        used_at: string;
        amount_saved: number;
        user: { email: string } | null;
        payment: { amount: number; payment_method: string } | null;
      }

      const { data, error } = await supabase
        .from('coupon_uses')
        .select(`
          id,
          used_at,
          amount_saved,
          user:user_id (
            email
          ),
          payment:payment_id (
            amount,
            payment_method
          )
        `)
        .eq('coupon_id', coupon.id)
        .order('used_at', { ascending: false })
        .range(start, end);

      if (error) throw error;
      
      // Transform the data to match the CouponUse type
      const transformedData: CouponUse[] = (data || []).map(item => {
        const rawItem = item as unknown as {
          id: string;
          used_at: string;
          amount_saved: number;
          user: { email: string } | null;
          payment: { amount: number; payment_method: string } | null;
        };
        
        return {
          id: rawItem.id,
          used_at: rawItem.used_at,
          amount_saved: rawItem.amount_saved,
          user: rawItem.user ? { email: rawItem.user.email } : undefined,
          payment: rawItem.payment ? {
            amount: rawItem.payment.amount,
            payment_method: rawItem.payment.payment_method
          } : undefined
        };
      });
      
      setUsageHistory(transformedData);
    } catch (error) {
      console.error('Error fetching usage history:', error);
      throw error;
    }
  };

  const handleDeductClick = () => {
    if (!coupon) return;
    setShowDeductDialog(true);
  };

  const handleDeductUsage = async () => {
    if (!coupon) return;

    setDeducting(true);
    try {
      // Create coupon use record first
      const { data: couponUse, error: couponUseError } = await supabase
        .from('coupon_uses')
        .insert({
          coupon_id: coupon.id,
          user_id: user?.id,
          amount_saved: coupon.price
        })
        .select()
        .single();

      if (couponUseError) throw couponUseError;

      // Then update coupon usage count
      const { error } = await supabase.rpc('update_coupon_usage', {
        p_coupon_id: coupon.id,
        p_increment: true
      });

      if (error) throw error;

      // Fetch the updated coupon
      const { data, error: fetchError } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', coupon.id)
        .single();

      if (fetchError) throw fetchError;

      setCoupon(data);
      toast.success('Coupon usage deducted successfully');
      
      // If history is showing, refresh it
      if (showUsageHistory) {
        fetchUsageHistory()
          .catch(error => {
            console.error('Error refreshing history:', error);
            toast.error('Error refreshing history');
          });
      }
    } catch (error) {
      console.error('Error deducting coupon usage:', error);
      toast.error('Error deducting coupon usage');
    } finally {
      setDeducting(false);
      setShowDeductDialog(false);
    }
  };

  const isValid = (coupon: CouponDetails) => {
    return (
      coupon.active &&
      new Date(coupon.valid_until) > new Date() &&
      coupon.uses < coupon.max_uses
    );
  };

  const canDeductUsage = (coupon: CouponDetails) => {
    return coupon && coupon.uses < coupon.max_uses;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Coupon Validation</h1>
        <div className="flex space-x-4">
          <Button variant="outline" onClick={() => setShowAllUsageToday(true)}>
            <History className="mr-2 h-4 w-4" />
            View All Coupon Usage
          </Button>
          <Button variant="outline" onClick={() => setShowAllCoupons(true)}>
            <List className="mr-2 h-4 w-4" />
            All Coupons
          </Button>
          <Button onClick={() => navigate('/coupons/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Coupon
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Enter coupon code..."
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
            </div>
          ) : coupon ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {coupon.code}
                  </h2>
                  <p className="text-sm text-gray-500 capitalize">
                    {coupon.type} Membership
                  </p>
                  {coupon.owner_name && (
                    <p className="text-sm text-gray-500">
                      Owner: {coupon.owner_name}
                    </p>
                  )}
                  {coupon.cashier_name && (
                    <p className="text-sm text-gray-500">
                      Coupon Sold By : {coupon.cashier_name}
                    </p>
                  )}
                </div>
                {isValid(coupon) ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <Check className="mr-1 h-4 w-4" />
                    Valid
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <X className="mr-1 h-4 w-4" />
                    Invalid
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Coupon Price</p>
                  <p className="text-2xl font-bold text-orange-600">
                    RM {coupon.price.toFixed(2)}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Usage</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {coupon.uses} / {coupon.max_uses}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    {coupon.active ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-red-500" />
                    )}
                    <span className="ml-2">
                      {coupon.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center">
                    {new Date(coupon.valid_until) > new Date() ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-red-500" />
                    )}
                    <span className="ml-2">
                      Valid until {format(new Date(coupon.valid_until), 'dd MMM yyyy')}
                    </span>
                  </div>

                  <div className="flex items-center">
                    {coupon.uses < coupon.max_uses ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-red-500" />
                    )}
                    <span className="ml-2">
                      {coupon.max_uses - coupon.uses} uses remaining
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-500">
                Coupon created on : {format(new Date(coupon.created_at), 'dd MMM yyyy, hh:mm a')}
              </div>

              {!isValid(coupon) && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-700">
                        This coupon is not valid because :
                        {!coupon.active && <span className="block">- Coupon is inactive.</span>}
                        {new Date(coupon.valid_until) <= new Date() && (
                          <span className="block">- Coupon has expired.</span>
                        )}
                        {coupon.uses >= coupon.max_uses && (
                          <span className="block">- Maximum uses reached.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  onClick={handleViewUsage}
                  disabled={loadingHistory}
                >
                  <History className="mr-2 h-4 w-4" />
                  View Usage
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeductClick}
                  disabled={deducting || !canDeductUsage(coupon)}
                >
                  <MinusCircle className="mr-2 h-4 w-4" />
                  Deduct Usage
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/coupons/edit/${coupon.id}`)}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Coupon Usage History Modal */}
      <CouponHistoryModal
        isOpen={showUsageHistory}
        onClose={() => setShowUsageHistory(false)}
        history={usageHistory}
        loading={loadingHistory}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        selectedDate={selectedDate}
        couponCode={coupon?.code || ''}
      />

      {/* All Coupons Modal */}
      <CouponsList
        isOpen={showAllCoupons}
        onClose={() => setShowAllCoupons(false)}
        onSelectCoupon={(code) => {
          setShowAllCoupons(false);
          setCouponCode(code);
          handleSearch(code);
        }}
      />

      {/* All Coupon Usage Today Modal */}
      <AllCouponUsageModal
        isOpen={showAllUsageToday}
        onClose={() => setShowAllUsageToday(false)}
      />

      {/* Add the dialog component */}
      <DeductUsageDialog
        isOpen={showDeductDialog}
        onClose={() => setShowDeductDialog(false)}
        onConfirm={handleDeductUsage}
        couponCode={coupon?.code || ''}
        loading={deducting}
        isValid={coupon ? isValid(coupon) : false}
        validationMessage={
          coupon
            ? !coupon.active
              ? 'Coupon is inactive'
              : new Date(coupon.valid_until) <= new Date()
                ? 'Coupon has expired'
                : coupon.uses >= coupon.max_uses
                  ? 'Maximum uses reached'
                  : undefined
            : undefined
        }
      />
    </div>
  );
}