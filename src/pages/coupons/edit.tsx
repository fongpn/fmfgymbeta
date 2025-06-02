import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CouponForm from './form';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EditCoupon() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Just a small delay to simulate checking permissions
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/coupons')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Coupon Validation
          </Button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-xl font-semibold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-700">
            You don't have permission to edit coupons. This feature is restricted to administrators only.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <CouponForm onSuccess={() => navigate('/coupons')} />
  );
}