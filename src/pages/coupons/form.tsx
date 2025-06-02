import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Loader2, Banknote, QrCode, CreditCard, AlertTriangle, X, Ticket } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { supabase } from '../../lib/supabase';
import { Coupon } from '../../types';
import toast from 'react-hot-toast';
import { format, addMonths } from 'date-fns';
import { useAuthStore } from '../../store/auth';
import { getOrCreateActiveShiftId } from '../../lib/shifts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

interface CouponFormProps {
  onSuccess: (formData: {
    code: string;
    discount_amount: number;
    expiry_date: string;
  }) => void;
}

type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';

interface CouponPriceSettings {
  adult: number;
  youth: number;
  max_uses: number;
}

const defaultCouponPrices = {
  adult: 45,
  youth: 35,
  max_uses: 1
};

export default function CouponForm({ onSuccess }: CouponFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    type: 'adult',
    price: 45, // Default price for adult
    valid_until: format(addMonths(new Date(), 3), 'yyyy-MM-dd'), // Default expiry 3 months from today
    max_uses: 1,
    uses: 0,
    active: true,
    owner_name: '',
  });
  const [couponPrices, setCouponPrices] = useState<CouponPriceSettings>(defaultCouponPrices);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [codeError, setCodeError] = useState<string>('');

  useEffect(() => {
    fetchCouponPrices();
    if (id) {
      fetchCoupon();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchCouponPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'coupon_prices')
        .single();

      if (error) {
        // If settings don't exist yet, create them with default values
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('settings')
            .insert({
              key: 'coupon_prices',
              value: defaultCouponPrices
            });
          
          if (insertError) {
            console.error('Error creating coupon price settings:', insertError);
          }
        } else {
          console.error('Error fetching coupon prices:', error);
        }
      } else if (data?.value) {
        const settings = data.value as CouponPriceSettings;
        setCouponPrices(settings);
        
        // If creating a new coupon, set the default price and max_uses based on the settings
        if (!id) {
          setFormData(prev => ({
            ...prev,
            price: settings.adult,
            max_uses: settings.max_uses || 1
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching coupon prices:', error);
    }
  };

  const fetchCoupon = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setFormData({
        ...data,
        valid_until: format(new Date(data.valid_until), 'yyyy-MM-dd'),
      });
    } catch (error) {
      toast.error('Error fetching coupon');
      navigate('/coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: 'adult' | 'youth') => {
    setFormData({
      ...formData,
      type,
      price: type === 'adult' ? couponPrices.adult : couponPrices.youth
    });
  };

  const checkCouponCodeExists = async (code: string): Promise<boolean> => {
    if (!code) return false;
    
    try {
      // Use a more reliable approach to check for existing codes
      const { data, error } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', code.toUpperCase());
        
      if (error) throw error;
      
      // If editing, filter out the current coupon
      if (id) {
        const filteredData = data.filter(coupon => coupon.id !== id);
        return filteredData.length > 0;
      }
      
      return data.length > 0;
    } catch (error) {
      console.error('Error checking coupon code:', error);
      return false;
    }
  };

  const handleCodeChange = async (code: string) => {
    setFormData({ ...formData, code: code.toUpperCase() });
    setCodeError('');
    
    if (code) {
      const exists = await checkCouponCodeExists(code);
      if (exists) {
        setCodeError('This coupon code is already in use');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if coupon code exists
    if (!id) {
      const exists = await checkCouponCodeExists(formData.code || '');
      if (exists) {
        setCodeError('This coupon code is already in use');
        return;
      }
    }
    
    if (codeError) {
      toast.error(codeError);
      return;
    }

    if (id) {
      setSubmitting(true);
      try {
        const couponData = {
          ...formData,
          valid_until: new Date(formData.valid_until as string).toISOString(),
          price: formData.type === 'adult' ? couponPrices.adult : couponPrices.youth,
          max_uses: couponPrices.max_uses
        };

        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Coupon updated successfully');
        onSuccess({
          code: formData.code || '',
          discount_amount: formData.type === 'adult' ? couponPrices.adult : couponPrices.youth,
          expiry_date: format(new Date(formData.valid_until as string), 'yyyy-MM-dd')
        });
      } catch (error: any) {
        console.error('Error:', error);
        toast.error(error.message || 'Error updating coupon');
      } finally {
        setSubmitting(false);
      }
    } else {
      // For new coupons, just show the modal first
      setSelectedCoupon({
        ...formData,
        valid_until: new Date(formData.valid_until as string).toISOString(),
        price: formData.type === 'adult' ? couponPrices.adult : couponPrices.youth,
        max_uses: couponPrices.max_uses
      });
      setShowUsageModal(true);
    }
  };

  const createCouponAndProcessPayment = async () => {
    if (!selectedCoupon) return null;
    
    try {
      // Create the coupon first
      const { data: coupon, error } = await supabase
        .from('coupons')
        .insert(selectedCoupon)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error('This coupon code is already assigned. Please use a different code.');
        }
        throw error;
      }

      // Then process payment
      await handlePayment(paymentMethod, coupon.id);
      
      return coupon;
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw error;
    }
  };

  const finalizeCoupon = async (shouldUse: boolean) => {
    if (!selectedCoupon || submitting) return;
    
    setSubmitting(true);
    setShowUsageModal(false); // Close modal first to prevent double-clicks
    
    try {
      console.log('Starting coupon creation...');
      const coupon = await createCouponAndProcessPayment();
      if (!coupon) {
        console.log('No coupon created, returning early');
        return;
      }
      console.log('Coupon created successfully:', coupon);

      if (shouldUse) {
        console.log('Attempting to use coupon...');
        // Call onSuccess synchronously since it's just passing data
        onSuccess({
          code: coupon.code,
          discount_amount: coupon.type === 'adult' ? couponPrices.adult : couponPrices.youth,
          expiry_date: format(new Date(coupon.valid_until), 'yyyy-MM-dd')
        });
        console.log('Coupon usage completed');
        toast.success('Coupon created and applied successfully');
      } else {
        console.log('Skipping coupon usage, navigating to list');
        toast.success('Coupon created successfully');
        navigate('/coupons');
      }
    } catch (error: any) {
      console.error('Error in finalizeCoupon:', error);
      toast.error('Error creating coupon');
      navigate('/coupons');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async (method: PaymentMethod, couponId: string) => {
    setProcessingPayment(true);
    setPaymentMethod(method);
    
    try {
      // Get User and Shift ID
      const currentUserId = user?.id;
      if (!currentUserId) {
        throw new Error("User not logged in.");
      }
      const currentShiftId = await getOrCreateActiveShiftId(currentUserId);
      if (!currentShiftId) {
        toast.error("Could not determine active shift. Payment cancelled.");
        throw new Error("Failed to get or create active shift.");
      }
      console.log(`Using Shift ID: ${currentShiftId} for Coupon purchase payment`);

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          amount: formData.type === 'adult' ? couponPrices.adult : couponPrices.youth,
          type: 'coupon',
          payment_method: method,
          coupon_id: couponId,
          user_id: currentUserId,
          shift_id: currentShiftId
        })
        .select()
        .single();
        
      if (paymentError) throw paymentError;
      
      return true;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/coupons')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Coupon Validation
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              {id ? 'Edit Coupon' : 'New Coupon'}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="code">Coupon Code</Label>
                <Input
                  id="code"
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Enter coupon code"
                  required
                  className={codeError ? 'border-red-500' : ''}
                />
                {codeError && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {codeError}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="owner_name" className="block text-sm font-medium text-gray-700">
                  Owner's Name
                </Label>
                <Input
                  id="owner_name"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder="Enter coupon holder's name"
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Membership Type
                </Label>
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
                      onChange={() => handleTypeChange('adult')}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <span className="block text-sm font-medium">Adult</span>
                      <span className="block text-lg font-bold text-orange-600 mt-1">
                        RM {couponPrices.adult.toFixed(2)}
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
                      onChange={() => handleTypeChange('youth')}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <span className="block text-sm font-medium">Youth</span>
                      <span className="block text-lg font-bold text-orange-600 mt-1">
                        RM {couponPrices.youth.toFixed(2)}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="valid_until" className="block text-sm font-medium text-gray-700">
                  Valid Until
                </Label>
                <Input
                  id="valid_until"
                  type="date"
                  required
                  value={formData.valid_until as string}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              {id && isAdmin && (
                <div>
                  <Label htmlFor="uses" className="block text-sm font-medium text-gray-700">
                    Current Uses
                  </Label>
                  <Input
                    id="uses"
                    type="number"
                    required
                    value={formData.uses}
                    onChange={(e) => setFormData({ ...formData, uses: parseInt(e.target.value, 10) || 0 })}
                    min="0"
                    max={formData.max_uses}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.max_uses && formData.uses !== undefined 
                      ? `${formData.max_uses - formData.uses} uses remaining out of ${formData.max_uses} maximum` 
                      : ''}
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  id="active"
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <Label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                  Coupon is active
                </Label>
              </div>

              {!id && (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Coupon Price</span>
                      <span>RM {(formData.type === 'adult' ? couponPrices.adult : couponPrices.youth).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 mt-1">
                      <span>Maximum Uses</span>
                      <span>{couponPrices.max_uses}</span>
                    </div>
                    <div className="flex items-center justify-between text-lg font-bold text-gray-900 mt-2 pt-2 border-t">
                      <span>Total Payable</span>
                      <span>RM {(formData.type === 'adult' ? couponPrices.adult : couponPrices.youth).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Payment Method</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <label className={`
                        relative flex flex-col items-center p-4 border rounded-lg cursor-pointer
                        ${paymentMethod === 'cash'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-200'}
                      `}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={() => setPaymentMethod('cash')}
                          className="sr-only"
                        />
                        <Banknote className="h-8 w-8 mb-2 text-gray-600" />
                        <span className="text-sm font-medium">Cash</span>
                      </label>

                      <label className={`
                        relative flex flex-col items-center p-4 border rounded-lg cursor-pointer
                        ${paymentMethod === 'qr'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-200'}
                      `}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="qr"
                          checked={paymentMethod === 'qr'}
                          onChange={() => setPaymentMethod('qr')}
                          className="sr-only"
                        />
                        <QrCode className="h-8 w-8 mb-2 text-gray-600" />
                        <span className="text-sm font-medium">QR Payment</span>
                      </label>

                      <label className={`
                        relative flex flex-col items-center p-4 border rounded-lg cursor-pointer
                        ${paymentMethod === 'bank_transfer'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-200'}
                      `}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="bank_transfer"
                          checked={paymentMethod === 'bank_transfer'}
                          onChange={() => setPaymentMethod('bank_transfer')}
                          className="sr-only"
                        />
                        <CreditCard className="h-8 w-8 mb-2 text-gray-600" />
                        <span className="text-sm font-medium">Bank Transfer</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/coupons')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || processingPayment || !!codeError}
                >
                  {submitting || processingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {id ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    id ? 'Update Coupon' : 'Create Coupon'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Dialog 
        open={showUsageModal} 
        modal={true}
        onOpenChange={() => {}}
      >
        <DialogContent className="bg-white rounded-lg shadow-xl w-full max-w-md [&>button]:hidden">
          <div className="p-6">
            <DialogTitle className="text-xl font-semibold text-gray-900 mb-4">
              Use Coupon Now?
            </DialogTitle>
            
            <DialogDescription className="text-gray-600 mb-6">
              Would you like to use this coupon now?
            </DialogDescription>

            <DialogFooter className="flex justify-end space-x-4">
              <Button 
                variant="outline" 
                onClick={() => finalizeCoupon(false)}
                disabled={submitting}
              >
                No, Skip
              </Button>
              <Button 
                onClick={() => finalizeCoupon(true)}
                disabled={submitting}
              >
                <Ticket className="mr-2 h-4 w-4" />
                Yes, Use Now
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}