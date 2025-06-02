import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Receipt, Banknote, QrCode, Landmark, User, Calendar, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { EndShiftModal } from '../components/shifts/EndShiftModal';
import { toGMT8 } from '../lib/utils';
import { format } from 'date-fns';

interface ShiftSummary {
  total_cash: number;
  total_qr: number;
  total_bank_transfer: number;
  total_sales: number;
  member_payments: number;
  walk_in_payments: number;
  pos_sales: number;
  coupon_sales: number;
  grace_period_settlement_fees: number;
}

export default function EndShiftPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const userNameOrEmail = user?.name || user?.email || 'Unknown User';
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary>({
    total_cash: 0,
    total_qr: 0,
    total_bank_transfer: 0,
    total_sales: 0,
    member_payments: 0,
    walk_in_payments: 0,
    pos_sales: 0,
    coupon_sales: 0,
    grace_period_settlement_fees: 0,
  });
  const [users, setUsers] = useState<{ id: string; email: string; }[]>([]);

  useEffect(() => {
    // console.log(`[Effect] User ID changed/available: ${user?.id}`);
    // Only fetch if user is loaded
    if (user?.id) {
      // console.log(`[Effect] Fetching data for user: ${user.id}`);
      fetchShiftSummary();
      fetchUsers();
    } else {
      // console.log("[Effect] User ID not available, skipping fetch.");
    }
    // Add user dependency to re-fetch if user changes
  }, [user?.id]);

  const fetchShiftSummary = async () => {
    // console.log("[Fetch Summary] Attempting to fetch (Active Shift Logic)...");
    if (!user?.id) {
      setLoading(false); // Ensure loading stops if we exit early
      setShiftSummary({ /* Reset to zero state */
          total_cash: 0, total_qr: 0, total_bank_transfer: 0,
          total_sales: 0, member_payments: 0, walk_in_payments: 0,
          pos_sales: 0, coupon_sales: 0, grace_period_settlement_fees: 0
      });
      // console.log("[Fetch Summary] No user ID, skipping fetch.");
      return;
    }
    
    setLoading(true); 
    try {
      // Get today's end of day for the payment range
      const today = toGMT8(new Date());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      // 1. Find the current ACTIVE shift for this user
      // console.log(`[Fetch Summary] Finding ACTIVE shift for user ${user.id}...`);
      const { data: activeShift, error: activeShiftError } = await supabase
        .from('shifts')
        .select('id, created_at') // Use created_at instead of started_at
        .eq('user_id', user.id)
        .is('ended_at', null) 
        .order('created_at', { ascending: false }) // Order by created_at
        .limit(1)
        .maybeSingle(); 

      if (activeShiftError) {
        // console.error("[Fetch Summary] Error finding active shift:", activeShiftError);
        throw new Error("Could not check for active shift.");
      }

      let startTime = '';
      let payments: any[] | null = []; // Initialize payments array

      if (activeShift) {
        // 2. Active shift FOUND - Use its created_at time
        startTime = activeShift.created_at; // Use created_at here as well
        // console.log(`[Fetch Summary] Active shift FOUND (ID: ${activeShift.id}). startTime determined from created_at: ${startTime}`);
        
        // 3. Fetch Payments >= active shift's created_at time
        // console.log(`[Fetch Summary] Fetching payments for user ${user.id} since active shift start (${startTime})...`);
        const { data: fetchedPayments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id) 
          .gte('created_at', startTime) // Compare payment created_at with shift created_at
          .lte('created_at', endOfDay); 

        if (paymentsError) {
            // console.error("[Fetch Summary] Error fetching payments for active shift:", paymentsError);
            throw paymentsError;
        }
        payments = fetchedPayments;
        // console.log(`[Fetch Summary] Fetched ${payments?.length || 0} payments for active shift.`);

      } else {
        // 2. Active shift NOT FOUND - Summary must be zero
        // console.log(`[Fetch Summary] No active shift found for user ${user.id}. Summary will be zero.`);
        // payments remains an empty array
      }

      // Calculate totals (works correctly even if payments is empty)
      const summary = (payments || []).reduce((acc, payment) => {
        // Add to total sales regardless of payment method
        acc.total_sales += payment.amount;
        
        // Add to payment method totals
        switch (payment.payment_method) {
          case 'cash':
            acc.total_cash += payment.amount;
            break;
          case 'qr':
            acc.total_qr += payment.amount;
            break;
          case 'bank_transfer':
            acc.total_bank_transfer += payment.amount;
            break;
        }
        
        // Add to respective category totals
        switch (payment.type) {
          case 'registration':
          case 'renewal':
            acc.member_payments += payment.amount;
            break;
          case 'walk-in':
            acc.walk_in_payments += payment.amount;
            break;
          case 'pos':
            acc.pos_sales += payment.amount;
            break;
          case 'coupon':
            acc.coupon_sales += payment.amount;
            break;
        }
        
        return acc;
      }, {
        total_cash: 0,
        total_qr: 0,
        total_bank_transfer: 0,
        total_sales: 0,
        member_payments: 0,
        walk_in_payments: 0,
        pos_sales: 0,
        coupon_sales: 0,
        grace_period_settlement_fees: 0,
      });
      
      // console.log("[Fetch Summary] Calculated summary:", JSON.stringify(summary));
      setShiftSummary(summary);
      // console.log("[Fetch Summary] Set shiftSummary state.");

    } catch (error) {
      console.error('Error fetching shift summary:', error);
      toast.error('Error loading shift summary');
      // Reset summary on error? Maybe not, keep potentially stale data? Or clear it?
      setShiftSummary({ /* Reset to zero state */
        total_cash: 0, total_qr: 0, total_bank_transfer: 0,
        total_sales: 0, member_payments: 0, walk_in_payments: 0,
        pos_sales: 0, coupon_sales: 0, grace_period_settlement_fees: 0
      }); 
    } finally {
      // console.log("[Fetch Summary] Setting loading false.");
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Define a simple type for the user object returned by the RPC
      interface RpcUser {
        id: string;
        email: string;
        role: string;
      }
      // Use the get_active_users function
      const { data, error } = await supabase
        .rpc('get_active_users');

      if (error) throw error;

      // Format user display to include role, adding type to map parameter
      const formattedUsers = (data as RpcUser[] || []).map((user: RpcUser) => ({
        id: user.id,
        email: `${user.email} (${user.role})`
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading users');
    }
  };

  const handleEndShift = async (formData: {
    cashCollection: number;
    qrCollection: number;
    bankTransferCollection: number;
    nextUserId: string;
    stockCounts: Record<string, number>;
  }) => {
    if (!user?.id) {
      toast.error("User session error. Cannot end shift.");
      return;
    }

    try {
      // 1. Find the current active shift for this user
      // console.log(`[End Shift] Finding active shift for user: ${user.id}`);
      const { data: activeShift, error: findError } = await supabase
        .from('shifts')
        .select('id') // Select only the ID
        .eq('user_id', user.id)
        .is('ended_at', null)
        .maybeSingle();

      if (findError) {
        // console.error("[End Shift] Error finding active shift:", findError);
        throw new Error("Could not find the active shift to end.");
      }

      if (!activeShift) {
        // console.error("[End Shift] No active shift found for the current user.");
        toast.error("No active shift found to end. Perhaps it was already ended?");
        return; // Stop if no active shift is found
      }

      const activeShiftId = activeShift.id;
      // console.log(`[End Shift] Found active shift ID: ${activeShiftId}. Proceeding with update.`);

      // 2. Update the found shift record with final details and ended_at
      const { error: updateError } = await supabase
        .from('shifts')
        .update({
          // user_id should NOT be updated
          next_user_id: formData.nextUserId,
          cash_collection: formData.cashCollection,
          qr_collection: formData.qrCollection,
          bank_transfer_collection: formData.bankTransferCollection,
          system_cash: shiftSummary.total_cash,
          system_qr: shiftSummary.total_qr,
          system_bank_transfer: shiftSummary.total_bank_transfer,
          cash_variance: shiftSummary.total_cash - formData.cashCollection,
          qr_variance: shiftSummary.total_qr - formData.qrCollection,
          bank_transfer_variance: shiftSummary.total_bank_transfer - formData.bankTransferCollection,
          member_payments: shiftSummary.member_payments,
          walk_in_payments: shiftSummary.walk_in_payments,
          pos_sales: shiftSummary.pos_sales,
          coupon_sales: shiftSummary.coupon_sales,
          total_sales: shiftSummary.total_sales,
          ended_at: new Date().toISOString() // Set ended_at timestamp
        })
        .eq('id', activeShiftId); // Target the specific active shift

      if (updateError) {
          // console.error("[End Shift] Error updating shift record:", updateError);
          throw new Error("Failed to update shift details.");
      }
      
      // console.log(`[End Shift] Successfully updated shift ID: ${activeShiftId}`);

      // 3. Record stock counts (using the activeShiftId)
      if (Object.keys(formData.stockCounts).length > 0) { 
          // console.log(`[End Shift] Recording stock counts for shift ID: ${activeShiftId}`);
          const stockCountPromises = Object.entries(formData.stockCounts).map(async ([productId, countedStock]) => {
            // Get current system stock
            const { data: product } = await supabase
              .from('products')
              .select('stock')
              .eq('id', productId)
              .single();

            const systemStock = product?.stock || 0;

            // Record stock count linked to the now-ended shift
            const { error: stockCountError } = await supabase
              .from('shift_stock_counts')
              .insert({
                shift_id: activeShiftId, // Use the ID of the shift we just ended
                product_id: productId,
                counted_stock: countedStock,
                system_stock: systemStock,
                variance: countedStock - systemStock
              });
            if (stockCountError) {
                // console.error(`[End Shift] Error recording stock count for product ${productId}:`, stockCountError);
                // Decide if this should throw or just be logged
                toast.error(`Failed to save stock count for product ID ${productId}`);
            }
          });
          // Wait for all stock counts potentially, or handle errors individually
          try {
            await Promise.all(stockCountPromises);
          } catch (stockErrors) {
             // console.error("[End Shift] One or more stock counts failed to record.", stockErrors);
             // May not need to throw here, shift is already ended.
          }
      }

      toast.success('Shift ended successfully');
      
      // Reset state after successful submission
      setShiftSummary({ /* Reset to zero state */
        total_cash: 0,
        total_qr: 0,
        total_bank_transfer: 0,
        total_sales: 0,
        member_payments: 0,
        walk_in_payments: 0,
        pos_sales: 0,
        coupon_sales: 0,
        grace_period_settlement_fees: 0,
      });
      // Removed incorrect setFormData call - Form state is managed in the modal
      // setFormData({ ... }); 
      
      // Log out the user instead of navigating home
      // console.log("[End Shift] Shift ended. Logging out user...");
      await signOut(); 
      navigate('/login'); // Navigate to login page after sign out

    } catch (error: any) {
      // console.log('[End Shift] Finding active shift for user:', user?.id);
      console.error('Error ending shift:', error);
      toast.error(error.message || 'Error ending shift');
    } finally {
      // Ensure submitting state is reset if you have one
      // setSubmitting(false); 
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">End Shift</h1>

          <div className="flex flex-col sm:flex-row sm:items-center text-sm text-gray-500 mb-6 space-y-1 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1.5" />
              Cashier : {userNameOrEmail}
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1.5" />
              {format(new Date(), 'dd MMM yyyy')}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1.5" />
              {format(new Date(), 'HH:mm')}
            </div>
          </div>

          <div className="border border-gray-200 bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Shift Overview</h2>
            <dl className="space-y-3">
              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-600 flex items-center">
                  <Receipt className="h-4 w-4 mr-2 text-gray-500" />
                  Total Sales
                </dt>
                <dd className="text-sm font-medium text-gray-900">RM {shiftSummary.total_sales.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <dt className="text-sm font-medium text-gray-700 flex items-center">
                  <Banknote className="h-4 w-4 mr-2 text-orange-500" />
                  Cash Expected
                </dt>
                <dd className="text-sm font-semibold text-orange-600">RM {shiftSummary.total_cash.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-700 flex items-center">
                  <QrCode className="h-4 w-4 mr-2 text-orange-500" />
                  QR Expected
                </dt>
                <dd className="text-sm font-semibold text-orange-600">RM {shiftSummary.total_qr.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-700 flex items-center">
                  <Landmark className="h-4 w-4 mr-2 text-orange-500" />
                  Bank Transfer Expected
                </dt>
                <dd className="text-sm font-semibold text-orange-600">RM {shiftSummary.total_bank_transfer.toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Shift Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Membership Payments (New/Renew)</p>
                <p className="text-lg font-medium">
                  RM {shiftSummary.member_payments.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Grace Period Fees</p>
                <p className="text-lg font-medium">
                  RM {shiftSummary.grace_period_settlement_fees.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Walk-in Payments</p>
                <p className="text-lg font-medium">
                  RM {shiftSummary.walk_in_payments.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">POS Sales</p>
                <p className="text-lg font-medium">
                  RM {shiftSummary.pos_sales.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Coupon Sales</p>
                <p className="text-lg font-medium">
                  RM {shiftSummary.coupon_sales.toFixed(2)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold text-orange-600">
                  RM {shiftSummary.total_sales.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button onClick={() => setShowModal(true)}>
              End Shift
            </Button>
          </div>
        </div>
      </div>

      <EndShiftModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleEndShift}
        shiftSummary={shiftSummary}
        users={users}
        currentUserDisplayName={userNameOrEmail}
      />
    </div>
  );
}