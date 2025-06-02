import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Download, CreditCard, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/utils';
import toast from 'react-hot-toast';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'custom';
type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';

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
}

export default function FinancialReport() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('daily');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);

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

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Fetch all payments during the shift, including the details field
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('created_at, amount, type, payment_method, details')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at');

      if (paymentsError) throw paymentsError;

      // Group payments by date
      const groupedData = payments.reduce((acc: { [key: string]: FinancialData }, payment) => {
        const date = format(new Date(payment.created_at), 'yyyy-MM-dd');
        
        if (!acc[date]) {
          acc[date] = {
            date,
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
            }
          };
        }

        // Add to payment method total
        acc[date].byMethod[payment.payment_method as PaymentMethod] += payment.amount;

        // Add to specific payment type
        switch (payment.type) {
          case 'registration':
            acc[date].registrations += payment.amount;
            break;
          case 'renewal':
            const renewalPlanPrice = payment.details?.renewal_plan?.price || 0;
            const graceSettlementAmount = payment.details?.grace_period_settlement?.amount || 0;
            
            acc[date].renewals += renewalPlanPrice;
            acc[date].gracePeriodSettlementFees += graceSettlementAmount;
            
            // If details are missing, or both extracted amounts are zero,
            // attribute the full payment.amount to renewals as a fallback.
            // This maintains previous behavior for old records or unexpected data.
            if (!payment.details || (renewalPlanPrice === 0 && graceSettlementAmount === 0)) {
              // Ensure we don't double-add if both were 0 but amount is > 0
              if (renewalPlanPrice === 0 && graceSettlementAmount === 0) {
                acc[date].renewals += payment.amount; 
              }
            }
            break;
          case 'walk-in':
            acc[date].walkIns += payment.amount;
            break;
          case 'pos':
            acc[date].posSales += payment.amount;
            break;
          case 'coupon':
            acc[date].couponSales += payment.amount;
            break;
        }

        acc[date].total += payment.amount;
        return acc;
      }, {});

      setFinancialData(Object.values(groupedData));
    } catch (error) {
      toast.error('Error fetching financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const exportData = financialData.map(data => ({
      'Date': format(new Date(data.date), 'dd MMM yyyy'),
      'Registrations': `RM ${data.registrations.toFixed(2)}`,
      'Renewals (Plan Fee)': `RM ${data.renewals.toFixed(2)}`,
      'Grace Period Fees': `RM ${data.gracePeriodSettlementFees.toFixed(2)}`,
      'Walk-ins': `RM ${data.walkIns.toFixed(2)}`,
      'POS Sales': `RM ${data.posSales.toFixed(2)}`,
      'Coupon Sales': `RM ${data.couponSales.toFixed(2)}`,
      'Cash': `RM ${data.byMethod.cash.toFixed(2)}`,
      'QR': `RM ${data.byMethod.qr.toFixed(2)}`,
      'Bank Transfer': `RM ${data.byMethod.bank_transfer.toFixed(2)}`,
      'Total': `RM ${data.total.toFixed(2)}`
    }));
    exportToCSV(exportData, `financial-${dateRange}-${startDate}-${endDate}.csv`);
  };

  const calculateTotals = () => {
    return financialData.reduce((acc, data) => ({
      registrations: acc.registrations + data.registrations,
      renewals: acc.renewals + data.renewals,
      walkIns: acc.walkIns + data.walkIns,
      posSales: acc.posSales + data.posSales,
      couponSales: acc.couponSales + data.couponSales,
      gracePeriodSettlementFees: acc.gracePeriodSettlementFees + data.gracePeriodSettlementFees,
      total: acc.total + data.total,
      byMethod: {
        cash: acc.byMethod.cash + data.byMethod.cash,
        qr: acc.byMethod.qr + data.byMethod.qr,
        bank_transfer: acc.byMethod.bank_transfer + data.byMethod.bank_transfer
      }
    }), {
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
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 items-stretch sm:items-end justify-between mb-6 w-full">
          <div className="space-y-2 sm:space-y-4 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <Button
                variant={dateRange === 'daily' ? 'default' : 'outline'}
                onClick={() => setDateRange('daily')}
                className="w-full sm:w-auto min-w-[1.5rem] min-h-[1.5rem]"
              >
                Daily
              </Button>
              <Button
                variant={dateRange === 'weekly' ? 'default' : 'outline'}
                onClick={() => setDateRange('weekly')}
                className="w-full sm:w-auto min-w-[1.5rem] min-h-[1.5rem]"
              >
                Weekly
              </Button>
              <Button
                variant={dateRange === 'monthly' ? 'default' : 'outline'}
                onClick={() => setDateRange('monthly')}
                className="w-full sm:w-auto min-w-[1.5rem] min-h-[1.5rem]"
              >
                Monthly
              </Button>
              <Button
                variant={dateRange === 'custom' ? 'default' : 'outline'}
                onClick={() => setDateRange('custom')}
                className="w-full sm:w-auto min-w-[1.5rem] min-h-[1.5rem]"
              >
                Custom
              </Button>
            </div>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-44 sm:w-44">
                  <Calendar className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-4 w-full"
                  />
                </div>
                <span className="text-gray-400 font-medium">to</span>
                <div className="relative w-44 sm:w-44">
                  <Calendar className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-4 w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" onClick={handleExportCSV} className="w-full sm:w-auto mt-2 sm:mt-0">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payment Method Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base sm:text-lg">
              {Object.entries(calculateTotals().byMethod).map(([method, amount]) => (
                <div
                  key={method}
                  className="bg-gray-50 rounded-lg p-4"
                >
                  <h3 className="text-sm font-medium text-gray-500 capitalize">
                    {method.replace('_', ' ')}
                  </h3>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    RM {amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm sm:text-base">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registrations
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Renewals (Plan Fee)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grace Period Fees
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Walk-ins
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      POS Sales
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coupon Sales
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {financialData.map((data) => (
                    <tr key={data.date}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(data.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM {data.registrations.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM {data.renewals.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM {data.gracePeriodSettlementFees.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM {data.walkIns.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM {data.posSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM {data.couponSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                        RM {data.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {financialData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                        No financial data found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
                {financialData.length > 0 && (
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Total
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        RM {calculateTotals().registrations.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        RM {calculateTotals().renewals.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        RM {calculateTotals().gracePeriodSettlementFees.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        RM {calculateTotals().walkIns.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        RM {calculateTotals().posSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        RM {calculateTotals().couponSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                        RM {calculateTotals().total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}