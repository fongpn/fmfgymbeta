import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import CouponForm from './form';
import { useAuthStore } from '../../store/auth';

export default function NewCoupon() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const handleSuccess = async (formData: {
    code: string;
    discount_amount: number;
    expiry_date: string;
  }) => {
    try {
      // Get the coupon details
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', formData.code)
        .single();

      if (coupon) {
        // Record the usage
        const { error: usageError } = await supabase
          .from('coupon_uses')
          .insert({
            coupon_id: coupon.id,
            amount_saved: coupon.price,
            user_id: user?.id
          });

        if (usageError) throw usageError;

        // Update the uses count
        const { error: updateError } = await supabase
          .from('coupons')
          .update({ uses: coupon.uses + 1 })
          .eq('id', coupon.id);

        if (updateError) throw updateError;
      }

      // Navigate to coupons list
      navigate('/coupons');
    } catch (error) {
      console.error('Error recording coupon usage:', error);
      toast.error('Error recording coupon usage');
      navigate('/coupons');
    }
  };

  return <CouponForm onSuccess={handleSuccess} />;
}