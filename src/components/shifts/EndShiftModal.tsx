import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Loader2, Calculator, Calendar, Clock, Banknote, QrCode, Landmark, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface EndShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    cashCollection: number;
    qrCollection: number;
    bankTransferCollection: number;
    nextUserId: string;
    stockCounts: Record<string, number>;
  }) => Promise<void>;
  shiftSummary: {
    total_cash: number;
    total_qr: number;
    total_bank_transfer: number;
    total_sales: number;
    member_payments: number;
    walk_in_payments: number;
    pos_sales: number;
    coupon_sales: number;
    grace_period_settlement_fees: number;
  };
  users: { id: string; email: string; }[];
  currentUserDisplayName: string;
}

interface ManualCollection {
  cash: string;
  qr: string;
  bank_transfer: string;
}

export function EndShiftModal({
  isOpen,
  onClose,
  onSubmit,
  shiftSummary,
  users,
  currentUserDisplayName
}: EndShiftModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; stock: number; }[]>([]);
  const [formData, setFormData] = useState({
    nextUserId: '',
    stockCounts: {} as Record<string, number>
  });
  
  // Manual collection inputs
  const [manualCollection, setManualCollection] = useState<ManualCollection>({
    cash: '',
    qr: '',
    bank_transfer: ''
  });

  // Current date and time state
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      setProducts(data || []);
      
      // Initialize stock counts with current values
      const initialStockCounts = (data || []).reduce((acc, product) => ({
        ...acc,
        [product.id]: product.stock
      }), {});
      
      setFormData(prev => ({
        ...prev,
        stockCounts: initialStockCounts
      }));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error loading products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nextUserId) {
      toast.error('Please select the handover person');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        cashCollection: parseFloat(manualCollection.cash) || 0,
        qrCollection: parseFloat(manualCollection.qr) || 0,
        bankTransferCollection: parseFloat(manualCollection.bank_transfer) || 0,
        nextUserId: formData.nextUserId,
        stockCounts: formData.stockCounts
      });
    } catch (error) {
      console.error('Error submitting end shift:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockChange = (productId: string, value: string) => {
    const newValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      stockCounts: {
        ...prev.stockCounts,
        [productId]: newValue
      }
    }));
  };

  // Calculate totals and variances
  const manualTotal = {
    cash: parseFloat(manualCollection.cash) || 0,
    qr: parseFloat(manualCollection.qr) || 0,
    bank_transfer: parseFloat(manualCollection.bank_transfer) || 0
  };

  const variance = {
    cash: shiftSummary.total_cash - manualTotal.cash,
    qr: shiftSummary.total_qr - manualTotal.qr,
    bank_transfer: shiftSummary.total_bank_transfer - manualTotal.bank_transfer
  };

  const totalVariance = variance.cash + variance.qr + variance.bank_transfer;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">End Shift</h2>
            <div className="flex flex-col sm:flex-row sm:items-center text-sm text-gray-500 space-y-1 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-1.5" />
                Cashier: {currentUserDisplayName}
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {format(currentDateTime, 'dd MMM yyyy')}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {format(currentDateTime, 'HH:mm')}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Collections Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* System Collections */}
              <div className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">System Collections</h3>
                <div className="space-y-3 divide-y divide-gray-200">
                  <div className="flex justify-between pt-2">
                    <span className="text-sm text-gray-600">Membership Payments (New/Renew)</span>
                    <span className="text-sm font-medium">RM {shiftSummary.member_payments.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3">
                    <span className="text-sm text-gray-600">Grace Period Fees</span>
                    <span className="text-sm font-medium">RM {shiftSummary.grace_period_settlement_fees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3">
                    <span className="text-sm text-gray-600">Walk-in Payments</span>
                    <span className="text-sm font-medium">RM {shiftSummary.walk_in_payments.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3">
                    <span className="text-sm text-gray-600">POS Sales</span>
                    <span className="text-sm font-medium">RM {shiftSummary.pos_sales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3">
                    <span className="text-sm text-gray-600">Coupon Sales</span>
                    <span className="text-sm font-medium">RM {shiftSummary.coupon_sales.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 mt-3 border-t border-gray-300 flex justify-between">
                    <span className="font-semibold text-gray-900">Total Sales</span>
                    <span className="font-bold text-lg text-gray-900">
                      RM {shiftSummary.total_sales.toFixed(2)}
                    </span>
                  </div>
                  <div className="pt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700 flex items-center">
                        <Banknote className="h-4 w-4 mr-2 text-orange-500" />
                        Cash Expected
                      </span>
                      <span className="font-semibold text-orange-600">RM {shiftSummary.total_cash.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700 flex items-center">
                        <QrCode className="h-4 w-4 mr-2 text-orange-500" />
                        QR Expected
                      </span>
                      <span className="font-semibold text-orange-600">RM {shiftSummary.total_qr.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700 flex items-center">
                        <Landmark className="h-4 w-4 mr-2 text-orange-500" />
                        Bank Transfer Expected
                      </span>
                      <span className="font-semibold text-orange-600">RM {shiftSummary.total_bank_transfer.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Collections */}
              <div className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Handover Amount</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cash</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">RM</span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={manualCollection.cash}
                        onChange={(e) => setManualCollection({ ...manualCollection, cash: e.target.value })}
                        className="pl-12"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">QR Payments</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">RM</span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={manualCollection.qr}
                        onChange={(e) => setManualCollection({ ...manualCollection, qr: e.target.value })}
                        className="pl-12"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Bank Transfers</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">RM</span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={manualCollection.bank_transfer}
                        onChange={(e) => setManualCollection({ ...manualCollection, bank_transfer: e.target.value })}
                        className="pl-12"
                      />
                    </div>
                  </div>
                  <div className="pt-2 mt-2 border-t">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">Total Cash</span>
                      <span className="font-bold text-orange-600">RM {manualTotal.cash.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-medium text-gray-900">Total QR</span>
                      <span className="font-bold text-orange-600">RM {manualTotal.qr.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-medium text-gray-900">Total Bank Transfer</span>
                      <span className="font-bold text-orange-600">RM {manualTotal.bank_transfer.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Variance Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Variance Summary</h3>
              <div className="space-y-3 divide-y divide-gray-200">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-medium text-gray-700">Cash Variance</span>
                  <span className={`text-sm font-semibold ${variance.cash === 0 ? 'text-green-600' : variance.cash < 0 ? 'text-yellow-600' : 'text-red-600'}`}>RM {variance.cash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-3">
                  <span className="text-sm font-medium text-gray-700">QR Variance</span>
                  <span className={`text-sm font-semibold ${variance.qr === 0 ? 'text-green-600' : variance.qr < 0 ? 'text-yellow-600' : 'text-red-600'}`}>RM {variance.qr.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-3">
                  <span className="text-sm font-medium text-gray-700">Bank Transfer Variance</span>
                  <span className={`text-sm font-semibold ${variance.bank_transfer === 0 ? 'text-green-600' : variance.bank_transfer < 0 ? 'text-yellow-600' : 'text-red-600'}`}>RM {variance.bank_transfer.toFixed(2)}</span>
                </div>
                <div className="pt-4 mt-3 border-t border-gray-300 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Variance</span>
                  <span className={`font-bold text-lg ${totalVariance === 0 ? 'text-green-700' : totalVariance < 0 ? 'text-yellow-700' : 'text-red-700'}`}>RM {totalVariance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Stock Count */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Count</h3>
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center space-x-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700">
                          {product.name}
                        </label>
                        <div className="mt-1">
                          <Input
                            type="number"
                            value={formData.stockCounts[product.id]}
                            onChange={(e) => handleStockChange(product.id, e.target.value)}
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Next Cashier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Handover to...
              </label>
              <div className="relative">
                <select
                  required
                  value={formData.nextUserId}
                  onChange={(e) => setFormData({ ...formData, nextUserId: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-base focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none"
                >
                  <option value="">Please select...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    End Shift
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}