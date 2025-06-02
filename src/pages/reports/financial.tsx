import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { Download, ChevronLeft, ChevronRight, Calendar, Info, Smile, Package, TrendingUp } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { toGMT8 } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/auth';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'custom';
type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';

interface ShiftData {
  id: string;
  ended_at: string;
  cash_collection: number;
  qr_collection: number;
  bank_transfer_collection: number;
  system_cash: number;
  system_qr: number;
  system_bank_transfer: number;
  cash_variance: number;
  qr_variance: number;
  bank_transfer_variance: number;
  user: {
    email: string;
    name?: string;
  } | null;
  next_user: {
    email: string;
    name?: string;
  } | null;
}

interface ShiftSubtotal {
  system_cash: number;
  system_qr: number;
  system_bank_transfer: number;
  cash_collection: number;
  qr_collection: number;
  bank_transfer_collection: number;
  cash_variance: number;
  qr_variance: number;
  bank_transfer_variance: number;
}

interface FinancialData {
  date: string;
  registrations: number;
  renewals: number;
  walkIns: number;
  posSales: number;
  couponSales: number;
  gracePeriodSettlementFees: number;
  total: number;
  byMethod: Record<PaymentMethod, number>;
  shifts: ShiftData[];
}

export default function FinancialReport() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('daily');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const user = useAuthStore ? useAuthStore((state) => state.user) : null;
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('Current user:', user);
    }
    if (window && window.localStorage) {
      // If using Supabase JS client, session is stored in localStorage
      const session = window.localStorage.getItem('supabase.auth.token');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          console.log('Supabase session:', parsed);
        } catch (e) {
          console.log('Could not parse Supabase session:', session);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    updateDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    fetchFinancialData();
  }, [startDate, endDate]);

  const updateDateRange = (range: DateRange) => {
    const today = new Date();
    
    switch (range) {
      case 'daily':
        setStartDate(format(startOfDay(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfDay(today), 'yyyy-MM-dd'));
        break;
      case 'weekly':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'monthly':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      // For custom range, don't update dates automatically
    }
  };

  const handlePreviousDay = () => {
    const date = new Date(startDate);
    const newStartDate = format(subDays(date, 1), 'yyyy-MM-dd');
    setStartDate(newStartDate);
    setEndDate(newStartDate);
  };

  const handleNextDay = () => {
    const date = new Date(startDate);
    const newStartDate = format(addDays(date, 1), 'yyyy-MM-dd');
    setStartDate(newStartDate);
    setEndDate(newStartDate);
  };

  const calculateShiftSubtotals = (shifts: ShiftData[]): ShiftSubtotal => {
    return shifts.reduce((acc, shift) => ({
      system_cash: acc.system_cash + (shift.system_cash || 0),
      system_qr: acc.system_qr + (shift.system_qr || 0),
      system_bank_transfer: acc.system_bank_transfer + (shift.system_bank_transfer || 0),
      cash_collection: acc.cash_collection + (shift.cash_collection || 0),
      qr_collection: acc.qr_collection + (shift.qr_collection || 0),
      bank_transfer_collection: acc.bank_transfer_collection + (shift.bank_transfer_collection || 0),
      cash_variance: acc.cash_variance + (shift.cash_variance || 0),
      qr_variance: acc.qr_variance + (shift.qr_variance || 0),
      bank_transfer_variance: acc.bank_transfer_variance + (shift.bank_transfer_variance || 0)
    }), {
      system_cash: 0,
      system_qr: 0,
      system_bank_transfer: 0,
      cash_collection: 0,
      qr_collection: 0,
      bank_transfer_collection: 0,
      cash_variance: 0,
      qr_variance: 0,
      bank_transfer_variance: 0
    });
  };

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Use UTC for filtering
      const startTime = new Date(startDate + 'T00:00:00Z');
      startTime.setUTCHours(0, 0, 0, 0);
      const endTime = new Date(endDate + 'T00:00:00Z');
      endTime.setUTCHours(23, 59, 59, 999);

      // Fetch all payments for the period using UTC
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString())
        .order('created_at');

      if (paymentsError) throw paymentsError;

      // Group data by date in GMT+8
      const groupedData: { [key: string]: FinancialData } = {};
      let currentDate = new Date(startDate + 'T00:00:00Z');
      const endDateObj = new Date(endDate + 'T00:00:00Z');
      while (currentDate <= endDateObj) {
        const dateStr = format(toGMT8(currentDate), 'yyyy-MM-dd');
        groupedData[dateStr] = {
          date: dateStr,
          registrations: 0,
          renewals: 0,
          walkIns: 0,
          posSales: 0,
          couponSales: 0,
          gracePeriodSettlementFees: 0,
          total: 0,
          byMethod: {
            cash: 0,
            qr: 0,
            bank_transfer: 0
          },
          shifts: []
        };
        currentDate = addDays(currentDate, 1);
      }

      // Process payments
      payments?.forEach(payment => {
        // Convert payment date to GMT+8 for grouping
        const paymentDate = toGMT8(new Date(payment.created_at));
        const date = format(paymentDate, 'yyyy-MM-dd');
        if (groupedData[date]) {
          groupedData[date].byMethod[payment.payment_method as PaymentMethod] += payment.amount;
          groupedData[date].total += payment.amount;
          switch (payment.type) {
            case 'registration':
              groupedData[date].registrations += payment.amount;
              break;
            case 'renewal':
              const renewalPlanPrice = payment.details?.renewal_plan?.price || 0;
              const graceSettlementAmount = payment.details?.grace_period_settlement?.amount || 0;
              
              groupedData[date].renewals += renewalPlanPrice;
              groupedData[date].gracePeriodSettlementFees += graceSettlementAmount;

              // Fallback for missing details or zero extracted amounts
              if (!payment.details || (renewalPlanPrice === 0 && graceSettlementAmount === 0)) {
                if (renewalPlanPrice === 0 && graceSettlementAmount === 0) {
                  groupedData[date].renewals += payment.amount; 
                }
              }
              break;
            case 'walk-in':
              groupedData[date].walkIns += payment.amount;
              break;
            case 'pos':
              groupedData[date].posSales += payment.amount;
              break;
            case 'coupon':
              groupedData[date].couponSales += payment.amount;
              break;
          }
        }
      });

      // Process shifts
      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select(`
          id,
          ended_at,
          cash_collection,
          qr_collection,
          bank_transfer_collection,
          system_cash,
          system_qr,
          system_bank_transfer,
          cash_variance,
          qr_variance,
          bank_transfer_variance,
          user:user_id (
            id,
            name,
            email
          ),
          next_user:next_user_id (
            id,
            name,
            email
          )
        `)
        .gte('ended_at', startTime.toISOString())
        .lte('ended_at', endTime.toISOString())
        .order('ended_at');

      if (shiftsError) throw shiftsError;

      console.log('Fetched shifts:', shifts);
      shifts?.forEach(shift => {
        // Convert shift end time to GMT+8 for grouping
        const shiftDate = toGMT8(new Date(shift.ended_at));
        const date = format(shiftDate, 'yyyy-MM-dd');
        if (groupedData[date]) {
          // Ensure processedUser/processedNextUser are always object or null
          let processedUser = null;
          if (Array.isArray(shift.user)) {
            processedUser = shift.user.length > 0 ? shift.user[0] : null;
          } else if (shift.user && typeof shift.user === 'object') {
            processedUser = shift.user;
          }
          let processedNextUser = null;
          if (Array.isArray(shift.next_user)) {
            processedNextUser = shift.next_user.length > 0 ? shift.next_user[0] : null;
          } else if (shift.next_user && typeof shift.next_user === 'object') {
            processedNextUser = shift.next_user;
          }

          groupedData[date].shifts.push({
            ...shift,
            user: processedUser,
            next_user: processedNextUser
          });
        }
      });

      setFinancialData(Object.values(groupedData));
    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast.error('Error fetching financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
    setDateRange('daily');
  };

  const handleExportCSV = () => {
    setExporting(true);
    try {
      // Define structure for export rows for type safety
      interface ExportRow {
        'Date': string;
        'Registrations': string;
        'Renewals (Plan Fee)': string;
        'Grace Period Fees': string;
        'Walk-ins': string;
        'Point Of Sale': string;
        'Coupon Sales': string;
        'Cash': string;
        'QR': string;
        'Bank Transfer': string;
        'Total': string;
      }

      const exportData = financialData.map((data): ExportRow => ({ // Type the row explicitly
        'Date': format(new Date(data.date), 'dd MMM yyyy'),
        'Registrations': `RM ${data.registrations.toFixed(2)}`,
        'Renewals (Plan Fee)': `RM ${data.renewals.toFixed(2)}`,
        'Grace Period Fees': `RM ${data.gracePeriodSettlementFees.toFixed(2)}`,
        'Walk-ins': `RM ${data.walkIns.toFixed(2)}`,
        'Point Of Sale': `RM ${data.posSales.toFixed(2)}`,
        'Coupon Sales': `RM ${data.couponSales.toFixed(2)}`,
        'Cash': `RM ${data.byMethod.cash.toFixed(2)}`,
        'QR': `RM ${data.byMethod.qr.toFixed(2)}`,
        'Bank Transfer': `RM ${data.byMethod.bank_transfer.toFixed(2)}`,
        'Total': `RM ${data.total.toFixed(2)}`
      }));

      if (exportData.length === 0) {
          toast.error("No data to export.");
          return; // Handle empty data case
      }

      // Create CSV content
      const headers = Object.keys(exportData[0]) as Array<keyof ExportRow>; // Type headers explicitly
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => headers.map(header => row[header]).join(',')) // Should be type-safe now
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `collections-${dateRange}-${startDate}-${endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">Financial Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value as DateRange);
              if (e.target.value !== 'custom') {
                updateDateRange(e.target.value as DateRange);
              }
            }}
            className="h-9 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm w-36"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-sm w-36"
                min={startDate} 
              />
            </>
          )}
          {dateRange === 'daily' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousDay} className="h-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={startDate} // For daily, startDate and endDate are the same
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(e.target.value);
                }}
                className="h-9 text-sm w-36"
              />
              <Button variant="outline" size="sm" onClick={handleNextDay} className="h-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div> 
          )}
           <Button variant="ghost" onClick={handleReset} className="h-9 px-4 text-sm text-gray-600 hover:bg-gray-100 border border-gray-300">
            Reset Filters
          </Button>
          <Button onClick={handleExportCSV} disabled={exporting || loading || financialData.length === 0} className="h-9 px-4 text-sm bg-orange-600 hover:bg-orange-700 text-white">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <TrendingUp className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : financialData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-600">No financial data found for this range.</p>
          <p className="text-sm text-gray-500">Try adjusting the date filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {financialData.map(data => (
            <div key={data.date} className="bg-white rounded-xl shadow-xl overflow-hidden transition-all hover:shadow-2xl">
              <div className="p-5 sm:p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <h2 className="text-xl sm:text-2xl font-semibold">Daily Financial Summary: {format(new Date(data.date + 'T00:00:00'), 'EEEE, dd MMM yyyy')}</h2> 
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* Revenue & Collections Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {/* Revenue Breakdown Card */}
                  <div className="md:col-span-2 bg-gray-50 p-5 rounded-lg shadow-sm space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">Revenue Breakdown</h3>
                    {[ 
                      { label: 'Registrations', value: data.registrations },
                      { label: 'Renewals (Plan Fee)', value: data.renewals },
                      { label: 'Grace Period Fees', value: data.gracePeriodSettlementFees },
                      { label: 'Walk-ins', value: data.walkIns },
                      { label: 'Point Of Sale', value: data.posSales },
                      { label: 'Coupon Sales', value: data.couponSales },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{item.label}:</span>
                        <span className="font-medium text-gray-800">RM {item.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Collections & Total Card */}
                  <div className="bg-orange-50 p-5 rounded-lg shadow-sm space-y-4">
                    <h3 className="text-lg font-semibold text-orange-700 mb-3 pb-2 border-b border-orange-200">Collections & Total</h3>
                    {[ 
                      { label: 'Cash', value: data.byMethod.cash },
                      { label: 'QR Code', value: data.byMethod.qr },
                      { label: 'Bank Transfer', value: data.byMethod.bank_transfer },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{item.label}:</span>
                        <span className="font-medium text-gray-800">RM {item.value.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-orange-200">
                      <div className="flex justify-between items-center text-md">
                        <span className="font-semibold text-orange-700">Total Revenue:</span>
                        <span className="font-bold text-xl text-orange-700">RM {data.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shift Accountability Table */}
                {data.shifts.length > 0 && (
                  <div className="overflow-x-auto">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Shift Accountability</h3>
                    <div className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Shift End</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Next Staff</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Payment Method</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">System Collection</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actual Collection</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Variance</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.shifts.map((shift, shiftIndex) => {
                            const cashVariance = shift.cash_variance || 0;
                            const qrVariance = shift.qr_variance || 0;
                            const bankTransferVariance = shift.bank_transfer_variance || 0;
                            const systemCash = shift.system_cash || 0;
                            const cashCollection = shift.cash_collection || 0;
                            const systemQr = shift.system_qr || 0;
                            const qrCollection = shift.qr_collection || 0;
                            const systemBankTransfer = shift.system_bank_transfer || 0;
                            const bankTransferCollection = shift.bank_transfer_collection || 0;

                            return (
                              <React.Fragment key={shift.id}>
                                <tr className={shiftIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 row-span-3 align-top">{format(toGMT8(new Date(shift.ended_at)), 'dd MMM, hh:mm a')}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 row-span-3 align-top">{shift.user?.name || shift.user?.email || 'N/A'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 row-span-3 align-top">{shift.next_user?.name || shift.next_user?.email || 'N/A'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">Cash</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 text-right">RM {systemCash.toFixed(2)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 text-right">RM {cashCollection.toFixed(2)}</td>
                                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-right ${cashVariance > 0 ? 'text-red-600' : cashVariance < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {cashVariance !== 0 ? (cashVariance > 0 ? '+' : '') + cashVariance.toFixed(2) : '-'}
                                  </td>
                                </tr>
                                <tr className={shiftIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td colSpan={3}></td> {/* Spacers for merged cells */}
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">QR Code</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 text-right">RM {systemQr.toFixed(2)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 text-right">RM {qrCollection.toFixed(2)}</td>
                                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-right ${qrVariance > 0 ? 'text-red-600' : qrVariance < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {qrVariance !== 0 ? (qrVariance > 0 ? '+' : '') + qrVariance.toFixed(2) : '-'}
                                  </td>
                                </tr>
                                <tr className={shiftIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td colSpan={3}></td> {/* Spacers for merged cells */}
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">Bank Transfer</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 text-right">RM {systemBankTransfer.toFixed(2)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 text-right">RM {bankTransferCollection.toFixed(2)}</td>
                                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-right ${bankTransferVariance > 0 ? 'text-red-600' : bankTransferVariance < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {bankTransferVariance !== 0 ? (bankTransferVariance > 0 ? '+' : '') + bankTransferVariance.toFixed(2) : '-'}
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                          {/* Grand Total Row for Shift Accountability Table */}
                          {data.shifts.length > 1 && (() => {
                            const subtotals = calculateShiftSubtotals(data.shifts);
                            return (
                              <>
                                <tr className="bg-gray-100 font-semibold text-gray-700">
                                    <td colSpan={3} className="px-4 py-3 text-left text-sm">TOTALS</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">Cash</td>
                                    <td className="px-4 py-3 text-sm text-right">RM {(subtotals.system_cash || 0).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-sm text-right">RM {(subtotals.cash_collection || 0).toFixed(2)}</td>
                                    <td className={`px-4 py-3 text-sm font-medium text-right ${(subtotals.cash_variance || 0) > 0 ? 'text-red-600' : (subtotals.cash_variance || 0) < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {(subtotals.cash_variance || 0) !== 0 ? ((subtotals.cash_variance || 0) > 0 ? '+' : '') + (subtotals.cash_variance || 0).toFixed(2) : '-'}
                                    </td>
                                </tr>
                                <tr className="bg-gray-100 font-semibold text-gray-700">
                                    <td colSpan={4} className="px-4 py-3 text-sm text-gray-500">QR Code</td>
                                    <td className="px-4 py-3 text-sm text-right">RM {(subtotals.system_qr || 0).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-sm text-right">RM {(subtotals.qr_collection || 0).toFixed(2)}</td>
                                    <td className={`px-4 py-3 text-sm font-medium text-right ${(subtotals.qr_variance || 0) > 0 ? 'text-red-600' : (subtotals.qr_variance || 0) < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {(subtotals.qr_variance || 0) !== 0 ? ((subtotals.qr_variance || 0) > 0 ? '+' : '') + (subtotals.qr_variance || 0).toFixed(2) : '-'}
                                    </td>
                                </tr>
                                 <tr className="bg-gray-100 font-semibold text-gray-700">
                                    <td colSpan={4} className="px-4 py-3 text-sm text-gray-500">Bank Transfer</td>
                                    <td className="px-4 py-3 text-sm text-right">RM {(subtotals.system_bank_transfer || 0).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-sm text-right">RM {(subtotals.bank_transfer_collection || 0).toFixed(2)}</td>
                                    <td className={`px-4 py-3 text-sm font-medium text-right ${(subtotals.bank_transfer_variance || 0) > 0 ? 'text-red-600' : (subtotals.bank_transfer_variance || 0) < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {(subtotals.bank_transfer_variance || 0) !== 0 ? ((subtotals.bank_transfer_variance || 0) > 0 ? '+' : '') + (subtotals.bank_transfer_variance || 0).toFixed(2) : '-'}
                                    </td>
                                </tr>
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {data.shifts.length === 0 && (
                  <div className="mt-6 text-center py-8 bg-gray-50 rounded-lg shadow-sm">
                    <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-md font-medium text-gray-600">No shift records found for this date.</p>
                    <p className="text-sm text-gray-500">Shift accountability details will appear here if shifts ended on this day.</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}