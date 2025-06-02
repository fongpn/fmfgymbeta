import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import toast from 'react-hot-toast';

interface CouponFormProps {
  onSuccess: (formData: {
    code: string;
    discount_amount: number;
    expiry_date: string;
  }) => void;
}

export default function CouponForm({ onSuccess }: CouponFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_amount: 0,
    expiry_date: ''
  });
  const user = useAuthStore((state: any) => state.user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      if (!formData.code || !formData.discount_amount || !formData.expiry_date) {
        toast.error('Please fill in all fields');
        return;
      }

      // Create coupon record
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .insert({
          code: formData.code,
          discount_amount: formData.discount_amount,
          expiry_date: formData.expiry_date,
          created_by: user?.id,
          is_active: true
        })
        .select()
        .single();

      if (couponError) throw couponError;

      // Show success message
      toast.success('Coupon created successfully!');

      // Call onSuccess with form data
      onSuccess(formData);
    } catch (error) {
      console.error('Error creating coupon:', error);
      toast.error('Error creating coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="code">Coupon Code</Label>
        <Input
          id="code"
          type="text"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          placeholder="Enter coupon code"
          required
        />
      </div>

      <div>
        <Label htmlFor="discount_amount">Discount Amount (RM)</Label>
        <Input
          id="discount_amount"
          type="number"
          value={formData.discount_amount}
          onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) })}
          placeholder="Enter discount amount"
          required
          min="0"
          step="0.01"
        />
      </div>

      <div>
        <Label htmlFor="expiry_date">Expiry Date</Label>
        <Input
          id="expiry_date"
          type="date"
          value={formData.expiry_date}
          onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          required
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Coupon'}
        </Button>
      </div>
    </form>
  );
} 