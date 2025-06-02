import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { Coupon } from '../../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '../../../store/auth';

interface CouponFormProps {
  onSuccess: () => void;
}

export default function CouponForm({ onSuccess }: CouponFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    type: 'adult',
    price: 0,
    valid_until: format(new Date().setMonth(new Date().getMonth() + 1), 'yyyy-MM-dd'),
    max_uses: 1,
    uses: 0,
    active: true,
    owner_name: '',
  });

  useEffect(() => {
    if (id) {
      fetchCoupon();
    } else {
      setLoading(false);
    }
  }, [id]);

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
      navigate('/admin/coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSubmitting(true);

    try {
      const couponData = {
        ...formData,
        valid_until: new Date(formData.valid_until as string).toISOString(),
        price: Number(formData.price) || 0,
      };

      if (id) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Coupon updated successfully');
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert(couponData);

        if (error) throw error;
        toast.success('Coupon created successfully');
      }

      onSuccess();
    } catch (error) {
      toast.error(id ? 'Error updating coupon' : 'Error creating coupon');
    } finally {
      setSubmitting(false);
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/coupons')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Coupons
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {id ? 'Edit Coupon' : 'New Coupon'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Coupon Code
              </label>
              <Input
                id="code"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <label htmlFor="owner_name" className="block text-sm font-medium text-gray-700">
                Owner's Name
              </label>
              <Input
                id="owner_name"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                placeholder="Enter coupon holder's name"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Membership Type
                </label>
                <select
                  id="type"
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'adult' | 'youth' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="adult">Adult</option>
                  <option value="youth">Youth</option>
                </select>
              </div>

              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                  Price (RM)
                </label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label htmlFor="valid_until" className="block text-sm font-medium text-gray-700">
                  Valid Until
                </label>
                <Input
                  id="valid_until"
                  type="date"
                  required
                  value={formData.valid_until as string}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div>
                <label htmlFor="max_uses" className="block text-sm font-medium text-gray-700">
                  Maximum Uses
                </label>
                <Input
                  id="max_uses"
                  type="number"
                  required
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value, 10) || 1 })}
                  min="1"
                />
              </div>
              
              {id && isAdmin && (
                <div>
                  <label htmlFor="uses" className="block text-sm font-medium text-gray-700">
                    Current Uses
                  </label>
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
                      ? `${formData.max_uses - formData.uses} uses remaining` 
                      : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center">
              <input
                id="active"
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                Coupon is active
              </label>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/coupons')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
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
  );
}