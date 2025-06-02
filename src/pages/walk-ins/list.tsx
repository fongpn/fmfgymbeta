import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, History, Banknote, QrCode, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { WalkInHistoryModal } from '../../components/walk-ins/WalkInHistoryModal';
import { toGMT8 } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
// import { getOrCreateActiveShiftId } from '../../lib/shifts'; // Ensure this path is correct for your project structure

type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';
type WalkInType = 'adult' | 'youth';

interface WalkInForm {
  name: string;
  type: WalkInType;
  paymentMethod: PaymentMethod;
}

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

interface Settings {
  adult_walkin_price: number;
  youth_walkin_price: number;
}

interface RpcCheckInData {
  id: string;
  type: 'member' | 'walk-in';
  check_in_time: string;
  name: string | null; 
  user_id: string | null;
  member_id_col: string | null; 
  member_name_col: string | null; 
}

export default function WalkInList() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const activeShift = useAuthStore((state) => state.activeShift);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    adult_walkin_price: 0,
    youth_walkin_price: 0
  });
  const [formData, setFormData] = useState<WalkInForm>({
    name: location.state?.name || '',
    type: 'adult',
    paymentMethod: 'cash',
  });

  // History modal state
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<WalkInRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sortField, setSortField] = useState<string>('check_in_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);

  const ITEMS_PER_PAGE_HISTORY = 10;

  // DEFINE CALLBACKS FIRST
  const fetchHistory = useCallback(async (
    currentQuery: string | null,
    currentSelectedDate: string,
    currentHistoryPage: number,
    currentSortField: string,
    currentSortOrder: 'asc' | 'desc'
  ) => {
    setHistoryLoading(true);
    setHistory([]);
    try {
      // Calculate date range using toGMT8 helper for consistency
      const startDate = toGMT8(new Date(currentSelectedDate)); startDate.setHours(0, 0, 0, 0);
      const endDate = toGMT8(new Date(currentSelectedDate)); endDate.setHours(23, 59, 59, 999);
      const startDateIso = startDate.toISOString();
      const endDateIso = endDate.toISOString();
      // console.log(`[Walk-in History Fetch] Querying data for range: ${startDateIso} to ${endDateIso}`);

      const startOffset = (currentHistoryPage - 1) * ITEMS_PER_PAGE_HISTORY;
      const effectiveSearchTerm = currentQuery?.trim() || null;

      // Pass consistent ISO strings to RPC calls
      const countParams = {
        search_term: effectiveSearchTerm,
        start_date: effectiveSearchTerm ? null : startDateIso, 
        end_date: effectiveSearchTerm ? null : endDateIso,
        filter_type: 'walk-in'
      };
      const { data: countData, error: countError } = await supabase.rpc('count_check_ins', countParams);
      if (countError) throw countError;
      const totalCount = countData || 0;
      setTotalHistoryCount(totalCount);
      setTotalPages(Math.ceil(totalCount / ITEMS_PER_PAGE_HISTORY));

      if (totalCount === 0) {
        setHistoryLoading(false);
        return;
      }

      const dataParams = {
        search_term: effectiveSearchTerm,
        start_date: effectiveSearchTerm ? null : startDateIso,
        end_date: effectiveSearchTerm ? null : endDateIso,
        page_limit: ITEMS_PER_PAGE_HISTORY,
        page_offset: startOffset,
        filter_type: 'walk-in'
      };
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_check_ins', dataParams);
      if (rpcError) throw rpcError;
      const checkInsData = rpcData as RpcCheckInData[] || [];

      const userIds = checkInsData.map(item => item.user_id).filter((id): id is string => id !== null);
      const uniqueUserIds = [...new Set(userIds)];
      const userIdToDetailsMap = new Map<string, { email: string; name?: string; }>();
      if (uniqueUserIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, email, name')
            .in('id', uniqueUserIds);
            
          if (usersError) console.error('Error fetching user details:', usersError);
          else if (usersData) {
            usersData.forEach(user => userIdToDetailsMap.set(user.id, { email: user.email, name: user.name }));
          }
      }

      const checkInIds = checkInsData.map(c => c.id);
      let paymentsMap = new Map<string, { amount: number; payment_method: string }>();
      if (checkInIds.length > 0) {
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('amount, payment_method, check_in_id')
            .eq('type', 'walk-in')
            .in('check_in_id', checkInIds);
          if (paymentsError) throw paymentsError;
          payments.forEach(p => paymentsMap.set(p.check_in_id, { amount: p.amount, payment_method: p.payment_method }));
      }

      const finalHistory: WalkInRecord[] = checkInsData.map(item => {
          const userDetails = item.user_id ? userIdToDetailsMap.get(item.user_id) : undefined;
          const payment = paymentsMap.get(item.id);
          return {
            id: item.id,
            name: item.name || 'N/A',
            check_in_time: item.check_in_time,
            amount: payment?.amount || 0, 
            payment_method: payment?.payment_method || 'N/A',
            user: userDetails
          };
      });

      finalHistory.sort((a, b) => {
        if (currentSortField === 'check_in_time') {
            const timeA = new Date(a.check_in_time).getTime();
            const timeB = new Date(b.check_in_time).getTime();
            return currentSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        if (currentSortField === 'name') {
            const comparison = a.name.localeCompare(b.name);
            return currentSortOrder === 'asc' ? comparison : -comparison;
        }
        if (currentSortField === 'amount') {
            return currentSortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
        }
        if (currentSortField === 'payment_method') {
            const comparison = a.payment_method.localeCompare(b.payment_method);
            return currentSortOrder === 'asc' ? comparison : -comparison;
        }
        return 0;
      });

      setHistory(finalHistory);

    } catch (error) {
      console.error('Error fetching walk-in history:', error);
      toast.error('Error loading walk-in history');
      setHistory([]);
      setTotalPages(1);
      setTotalHistoryCount(0);
    } finally {
      setHistoryLoading(false);
    }
  }, [setHistoryLoading, setHistory, setTotalPages, setTotalHistoryCount, supabase]);

  const handleHistorySearch = useCallback((query: string) => {
    setHistorySearchQuery(query);
    setCurrentPage(1); 
    fetchHistory(query, selectedDate, 1, sortField, sortOrder); 
  }, [setHistorySearchQuery, setCurrentPage, fetchHistory, selectedDate, sortField, sortOrder]);

  const handleSort = useCallback((field: string) => {
    const newSortOrder = (sortField === field && sortOrder === 'asc') ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(newSortOrder);
    setCurrentPage(1); 
  }, [sortField, sortOrder]);

  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    setCurrentPage(1);
  }, []);

  // DEFINE USEEFFECTS AFTER CALLBACKS
  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (showHistory) {
      fetchHistory(historySearchQuery, selectedDate, currentPage, sortField, sortOrder);
    }
  }, [showHistory, currentPage, selectedDate, sortField, sortOrder, historySearchQuery, fetchHistory]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'membership')
        .single();

      if (error) throw error;

      setSettings({
        adult_walkin_price: data.value.adult_walkin_price || 0,
        youth_walkin_price: data.value.youth_walkin_price || 0
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Error loading walk-in fees');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user || !user.id) {
      toast.error("User not authenticated. Please log in again.");
      setLoading(false);
      return;
    }

    // Check for active shift first
    if (!activeShift || !activeShift.id) {
      toast.error("No active shift found. Please ensure your shift has started before recording a walk-in.");
      setLoading(false);
      return;
    }

    const price = formData.type === 'adult' ? settings.adult_walkin_price : settings.youth_walkin_price;

    try {
      // Create check-in record
      const { data: checkInData, error: checkInError } = await supabase
        .from('check_ins')
        .insert({
          name: formData.name,
          type: 'walk-in',
          user_id: user.id, // user_id for who recorded it
          // No member_id or member_name for walk-ins
        })
        .select('id')
        .single();

      if (checkInError) throw checkInError;
      const checkInId = checkInData?.id;
      if (!checkInId) throw new Error('Failed to create check-in record.');

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          amount: price,
          type: 'walk-in',
          payment_method: formData.paymentMethod,
          user_id: user.id,
          check_in_id: checkInId,
          shift_id: activeShift.id
        });

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
        throw paymentError;
      }
      console.log('Payment record created successfully');

      toast.success('Walk-in registered successfully');
      
      // Reset form and refetch history
      setFormData({ name: '', type: 'adult', paymentMethod: 'cash' });
      fetchHistory(historySearchQuery, selectedDate, currentPage, sortField, sortOrder);
    } catch (error: any) {
      toast.error(error.message || 'Error registering walk-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Walk-in Registration</h1>
        <Button variant="outline" onClick={() => setShowHistory(true)}>
          <History className="mr-2 h-4 w-4" />
          View History
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Walk-in Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`
                  relative flex items-center justify-center p-4 border rounded-lg cursor-pointer
                  ${formData.type === 'adult'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-200'}
                `}>
                  <input
                    type="radio"
                    name="type"
                    value="adult"
                    checked={formData.type === 'adult'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as WalkInType })}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <span className="block text-sm font-medium">Adult</span>
                    <span className="block text-lg font-bold text-orange-600 mt-1">
                      RM {settings.adult_walkin_price.toFixed(2)}
                    </span>
                  </div>
                </label>

                <label className={`
                  relative flex items-center justify-center p-4 border rounded-lg cursor-pointer
                  ${formData.type === 'youth'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-200'}
                `}>
                  <input
                    type="radio"
                    name="type"
                    value="youth"
                    checked={formData.type === 'youth'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as WalkInType })}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <span className="block text-sm font-medium">Youth</span>
                    <span className="block text-lg font-bold text-orange-600 mt-1">
                      RM {settings.youth_walkin_price.toFixed(2)}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Payment Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className={`
                  relative flex flex-col items-center p-4 border rounded-lg cursor-pointer
                  ${formData.paymentMethod === 'cash'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-200'}
                `}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={formData.paymentMethod === 'cash'}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                    className="sr-only"
                  />
                  <Banknote className="h-8 w-8 mb-2 text-gray-600" />
                  <span className="text-sm font-medium">Cash</span>
                </label>

                <label className={`
                  relative flex flex-col items-center p-4 border rounded-lg cursor-pointer
                  ${formData.paymentMethod === 'qr'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-200'}
                `}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="qr"
                    checked={formData.paymentMethod === 'qr'}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                    className="sr-only"
                  />
                  <QrCode className="h-8 w-8 mb-2 text-gray-600" />
                  <span className="text-sm font-medium">QR Payment</span>
                </label>

                <label className={`
                  relative flex flex-col items-center p-4 border rounded-lg cursor-pointer
                  ${formData.paymentMethod === 'bank_transfer'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-200'}
                `}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank_transfer"
                    checked={formData.paymentMethod === 'bank_transfer'}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                    className="sr-only"
                  />
                  <CreditCard className="h-8 w-8 mb-2 text-gray-600" />
                  <span className="text-sm font-medium">Bank Transfer</span>
                </label>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium text-gray-900">Walk-in Fee:</span>
                <span className="text-2xl font-bold text-orange-600">
                  RM {(formData.type === 'adult' ? settings.adult_walkin_price : settings.youth_walkin_price).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {formData.type === 'adult' ? 'Adult Rate' : 'Youth Rate'}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Register Walk-in'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <WalkInHistoryModal
        isOpen={showHistory}
        onClose={() => {
          setShowHistory(false);
          setHistorySearchQuery('');
        }}
        history={history}
        loading={historyLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalHistoryCount}
        onPageChange={setCurrentPage}
        onDateChange={handleDateChange}
        selectedDate={selectedDate}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        onSearch={handleHistorySearch}
      />
    </div>
  );
}