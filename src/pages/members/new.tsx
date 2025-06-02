import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Gift, Banknote, QrCode, CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { Member } from '../../types';
import { compressImage } from '../../lib/utils';
import { PhotoUpload } from '../../components/members/PhotoUpload';
import toast from 'react-hot-toast';
import { addMonths, format } from 'date-fns';
import { useAuthStore } from '../../store/auth';

type MembershipType = Member['type'];
type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';

interface FormData {
  name: string;
  email: string;
  phone: string;
  nric: string;
  type: MembershipType;
  photo: File | null;
  planId: string;
  paymentMethod: PaymentMethod;
  memberId: string;
}

interface MembershipPlan {
  id: string;
  type: MembershipType;
  months: number;
  price: number;
  registration_fee: number;
  free_months: number;
  active: boolean;
}

export default function NewMember() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    nric: '',
    type: 'adult',
    photo: null,
    planId: '',
    paymentMethod: 'cash',
    memberId: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [memberIdError, setMemberIdError] = useState<string>('');
  const { user } = useAuthStore();
  const activeShift = useAuthStore((state) => state.activeShift);
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [newMemberId, setNewMemberId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('active', true)
        .order('type')
        .order('months');

      if (error) throw error;
      setPlans(data);
    } catch (error) {
      toast.error('Error fetching membership plans');
    } finally {
      setLoading(false);
    }
  };

  const validateMemberId = async (id: string) => {
    if (!id) {
      setMemberIdError('');
      return true;
    }

    // Check if ID is numeric
    if (!/^\d+$/.test(id)) {
      setMemberIdError('Member ID must be numeric');
      return false;
    }

    try {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', id);

      if (count && count > 0) {
        setMemberIdError('Member ID already exists');
        return false;
      }

      setMemberIdError('');
      return true;
    } catch (error) {
      console.error('Error validating member ID:', error);
      setMemberIdError('Error validating member ID');
      return false;
    }
  };

  const handleMemberIdChange = async (value: string) => {
    setFormData(prev => ({ ...prev, memberId: value }));
    await validateMemberId(value);
  };

  const handlePhotoSelect = async (file: File) => {
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      setFormData({ ...formData, photo: compressedFile });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      toast.error('Error processing image');
    }
  };

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    setSelectedPlan(plan || null);
    setFormData({ ...formData, planId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlan) {
      toast.error('Please select a membership plan');
      return;
    }

    if (memberIdError) {
      toast.error('Please fix the Member ID error');
      return;
    }

    // Check for active shift
    if (!activeShift || !activeShift.id) {
      toast.error("No active shift found. Please ensure your shift has started before registering a new member.");
      setSubmitting(false); // Ensure submitting state is reset if it was set before this check
      return;
    }

    setSubmitting(true);

    try {
      // Get User ID
      const currentUserId = user?.id;
      if (!currentUserId) {
        throw new Error("User not logged in.");
      }
      console.log(`Using Shift ID: ${activeShift.id} for Registration payment`);

      let photoUrl = '';

      // Upload photo if provided
      if (formData.photo) {
        const fileExt = 'jpg';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `members/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, formData.photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      // Calculate expiry date
      const totalMonths = selectedPlan.months + selectedPlan.free_months;
      const expiryDate = addMonths(new Date(), totalMonths);

      // Create member record
      const memberData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        nric: formData.nric,
        type: formData.type,
        status: 'active',
        photo_url: photoUrl,
        expiry_date: expiryDate.toISOString(),
      };

      // Only include member_id if manually provided
      if (formData.memberId) {
        memberData.member_id = formData.memberId;
      }

      const { data: member, error: memberError } = await supabase
        .from('members')
        .insert(memberData)
        .select()
        .single();

      if (memberError) throw memberError;

      // Record the payment, including shift_id
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          member_id: member.id,
          amount: selectedPlan.price + selectedPlan.registration_fee,
          type: 'registration',
          payment_method: formData.paymentMethod,
          user_id: currentUserId,
          shift_id: activeShift.id
        });

      if (paymentError) throw paymentError;

      toast.success('Member created successfully');
      setNewMemberId(member.id);
      setShowCheckInPrompt(true);
    } catch (error: any) {
      console.error('Error creating member:', error);
      toast.error(error.message || 'Error creating member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!newMemberId) return;
    try {
      const { error } = await supabase
        .from('check_ins')
        .insert({
          member_id: newMemberId,
          type: 'member',
          name: formData.name,
          phone: formData.phone,
          user_id: user?.id
        });
      if (error) throw error;
      toast.success('Member checked in successfully!');
      navigate(`/members/${newMemberId}`);
    } catch (error) {
      toast.error('Error checking in member');
      navigate(`/members/${newMemberId}`);
    }
  };

  const filteredPlans = plans.filter(plan => plan.type === formData.type);

  const getNewMemberExpiryDate = () => {
    if (!selectedPlan) return null;
    const totalMonths = selectedPlan.months + (selectedPlan.free_months || 0);
    const baseDate = new Date();
    return addMonths(baseDate, totalMonths);
  };

  const newMemberExpiryDate = getNewMemberExpiryDate();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/members')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Members
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Register New Member
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <PhotoUpload
              photoUrl={photoPreview}
              onPhotoSelect={handlePhotoSelect}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="memberId" className="block text-sm font-medium text-gray-700">
                  Member ID (Optional)
                </label>
                <Input
                  id="memberId"
                  value={formData.memberId}
                  onChange={(e) => handleMemberIdChange(e.target.value)}
                  placeholder="Leave blank for auto-generated ID"
                  className={memberIdError ? 'border-red-500' : ''}
                />
                {memberIdError && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {memberIdError}
                  </p>
                )}
              </div>

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
                <label htmlFor="nric" className="block text-sm font-medium text-gray-700">
                  NRIC
                </label>
                <Input
                  id="nric"
                  required
                  value={formData.nric}
                  onChange={(e) => setFormData({ ...formData, nric: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="membershipType" className="block text-sm font-medium text-gray-700">
                  Membership Type
                </label>
                <select
                  id="membershipType"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as MembershipType })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="adult">Adult</option>
                  <option value="youth">Youth</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Select Membership Plan
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPlans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`
                      relative flex flex-col p-4 border rounded-lg cursor-pointer
                      ${formData.planId === plan.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-200'}
                    `}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={plan.id}
                      checked={formData.planId === plan.id}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-lg font-medium text-gray-900">
                          {plan.months} {plan.months === 1 ? 'Month' : 'Months'}
                        </p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">
                          RM {plan.price.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          + RM {plan.registration_fee.toFixed(2)} registration
                        </p>
                      </div>
                      {plan.free_months > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Gift className="mr-1 h-3 w-3" />
                          +{plan.free_months} Free
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {plan.months + plan.free_months} months total
                    </p>
                  </label>
                ))}
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

            {selectedPlan && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Plan Price</span>
                  <span>RM {selectedPlan.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500 mt-1">
                  <span>Registration Fee</span>
                  <span>RM {selectedPlan.registration_fee.toFixed(2)}</span>
                </div>
                {selectedPlan.free_months > 0 && (
                  <div className="flex items-center justify-between text-sm text-green-600 mt-1">
                    <span>Free Months</span>
                    <span>+{selectedPlan.free_months} months</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-bold text-gray-900 mt-2 pt-2 border-t">
                  <span>Total</span>
                  <span>RM {(selectedPlan.price + selectedPlan.registration_fee).toFixed(2)}</span>
                </div>
                {newMemberExpiryDate && (
                  <div className="flex items-center justify-between text-sm text-gray-700 mt-2">
                    <span>Membership Expiry</span>
                    <span className="font-semibold text-orange-600">{format(newMemberExpiryDate, 'dd MMM yyyy')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/members')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !!memberIdError || !selectedPlan}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register Member'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {showCheckInPrompt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-4">Check In Member?</h2>
            <p className="mb-6">Do you want to check in this member right away?</p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => { setShowCheckInPrompt(false); navigate(`/members/${newMemberId}`); }}>
                No, just register
              </Button>
              <Button onClick={handleCheckIn}>
                Yes, check in now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}