import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Gift, Banknote, QrCode, CreditCard, UserCheck, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { Member } from '../../types';
import toast from 'react-hot-toast';
import { format, addMonths } from 'date-fns';
import { useAuthStore } from '../../store/auth';
import { formatLastValidDay } from '../../lib/utils';

type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';

interface MembershipPlan {
  id: string;
  type: Member['type'];
  months: number;
  price: number;
  registration_fee: number;
  free_months: number;
  active: boolean;
}

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  memberName: string;
}

function CheckInModal({ isOpen, onClose, onConfirm, memberName }: CheckInModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Check In Member</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-gray-600 mb-6">
            Would you like to check in <span className="font-medium">{memberName}</span> now?
          </p>

          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose}>
              No, Skip
            </Button>
            <Button onClick={onConfirm}>
              <UserCheck className="mr-2 h-4 w-4" />
              Yes, Check In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Settings {
  grace_period_days: number;
  adult_walkin_price: number;
  youth_walkin_price: number;
}

interface WalkinPricesSettings {
  adult_walkin_price: number;
  youth_walkin_price: number;
}

export default function RenewMembership() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeShift } = useAuthStore((state) => ({
    user: state.user,
    activeShift: state.activeShift,
  }));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [formData, setFormData] = useState({
    planId: '',
    paymentMethod: 'cash' as PaymentMethod,
  });
  const [newExpiryDate, setNewExpiryDate] = useState<Date | null>(null);
  const [hasGracePeriodAccess, setHasGracePeriodAccess] = useState(false);
  const [gracePeriodAccesses, setGracePeriodAccesses] = useState<any[]>([]);
  const [gracePeriodCharges, setGracePeriodCharges] = useState<number>(0);
  const [walkInPrices, setWalkInPrices] = useState<{adult: number, youth: number} | null>(null);
  const [userAgreedToGraceCharges, setUserAgreedToGraceCharges] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [graceEndDate, setGraceEndDate] = useState<Date | null>(null);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    fetchMember();
    fetchPlans();
    fetchSystemSettings();
  }, []);

  useEffect(() => {
    if (member && selectedPlan) {
      calculateNewExpiryDate();
    }
  }, [member, selectedPlan]);

  useEffect(() => {
    if (gracePeriodAccesses.length > 0 && member && walkInPrices) {
      calculateGracePeriodCharges();
    } else {
      setGracePeriodCharges(0);
    }
  }, [gracePeriodAccesses, member, walkInPrices]);

  useEffect(() => {
    if (member && gracePeriodDays) {
      const expiry = new Date(member.expiry_date);
      const grace = new Date(expiry);
      grace.setDate(grace.getDate() + gracePeriodDays);
      setGraceEndDate(grace);
    }
  }, [member, gracePeriodDays]);

  useEffect(() => {
    if (!member || !settingsLoaded) return;
    const today = new Date();
    if (graceEndDate && today > graceEndDate) {
      // Only charge for grace period access if renewal is after grace period
      (async () => {
        try {
          const { data, error } = await supabase
            .from('grace_period_access')
            .select('*, member_id(type)')
            .eq('member_id', member.id)
            .is('paid_at', null)
            .gt('check_in_time', member.expiry_date);
          if (error) throw error;
          setHasGracePeriodAccess(data && data.length > 0);
          setGracePeriodAccesses(data || []);
        } catch (error) {
          console.error('Error checking grace period access:', error);
          setHasGracePeriodAccess(false);
          setGracePeriodAccesses([]);
        }
      })();
    } else {
      // No charge for grace period access if renewal is within grace period
      setGracePeriodCharges(0);
      setGracePeriodAccesses([]);
      setHasGracePeriodAccess(false);
    }
  }, [member, graceEndDate, settingsLoaded]);

  const fetchMember = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setMember(data);
    } catch (error) {
      toast.error('Error fetching member details');
      navigate('/members');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('active', true)
        .order('months');

      if (error) throw error;
      setPlans(data);
    } catch (error) {
      toast.error('Error fetching membership plans');
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'membership')
        .single();

      if (error) throw error;

      const membershipSettingsValue = data?.value;
      if (membershipSettingsValue) {
        setWalkInPrices({
          adult: membershipSettingsValue.adult_walkin_price || 0,
          youth: membershipSettingsValue.youth_walkin_price || 0
        });
        setGracePeriodDays(membershipSettingsValue.grace_period_days || 0);
      } else {
        toast.error('Membership settings (including walk-in prices) not found.');
        setWalkInPrices({ adult: 15, youth: 10 });
        setGracePeriodDays(0);
      }
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Error fetching system settings:', error);
      toast.error('Error loading system settings.');
      setSettingsLoaded(true);
    }
  };

  const calculateGracePeriodCharges = () => {
    if (!member || !walkInPrices || gracePeriodAccesses.length === 0) {
      setGracePeriodCharges(0);
      return;
    }

    let totalCharges = 0;
    gracePeriodAccesses.forEach(access => {
      const priceToUse = access.walkin_price_at_time_of_access || 
                         (member.type === 'adult' ? walkInPrices.adult : walkInPrices.youth);
      totalCharges += priceToUse;
    });
    setGracePeriodCharges(totalCharges);
  };

  const calculateNewExpiryDate = () => {
    if (!member || !selectedPlan) return;

    const totalMonths = selectedPlan.months + (selectedPlan.free_months || 0);
    let baseDate: Date;

    if (member.status === 'expired') {
      baseDate = new Date();
    } else {
      baseDate = new Date(member.expiry_date);
    }

    const newExpiry = addMonths(baseDate, totalMonths);
    setNewExpiryDate(newExpiry);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !newExpiryDate || !member) return;
    
    if (gracePeriodCharges > 0 && !userAgreedToGraceCharges) {
      toast.error('Please agree to the outstanding grace period charges to proceed.');
      return;
    }

    if (!activeShift || !activeShift.id) {
      toast.error('No active shift found. Please ensure your shift has started.');
      return;
    }

    setSubmitting(true);

    try {
      // Get User and Shift ID
      const currentUserId = user?.id;
      if (!currentUserId) {
        throw new Error("User not logged in.");
      }
      console.log(`Using Shift ID: ${activeShift.id} for Renewal payment`);

      // Record membership history
      const { error: historyError } = await supabase
        .from('membership_history')
        .insert({
          member_id: member.id,
          previous_expiry_date: member.expiry_date,
          new_expiry_date: newExpiryDate.toISOString(),
          type: 'renewal',
          plan_details: {
            months: selectedPlan.months,
            price: selectedPlan.price,
            free_months: selectedPlan.free_months
          },
        });

      if (historyError) throw historyError;

      // Update member status and expiry
      const { error: memberError } = await supabase
        .from('members')
        .update({
          status: 'active',
          expiry_date: newExpiryDate.toISOString(),
        })
        .eq('id', member.id);

      if (memberError) throw memberError;

      // Calculate total amount including grace period charges
      const totalAmount = selectedPlan.price + gracePeriodCharges;

      // Record the payment, including shift_id and total amount
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          member_id: member.id,
          amount: totalAmount,
          type: 'renewal',
          payment_method: formData.paymentMethod,
          shift_id: activeShift.id,
          user_id: currentUserId,
        })
        .select('id')
        .single();

      if (paymentError) throw paymentError;
      const newPaymentId = paymentData?.id;

      // ** Backend Step Placeholder: Mark grace period accesses as paid **
      // After successful payment, update the original grace_period_access records.
      if (gracePeriodCharges > 0 && newPaymentId && gracePeriodAccesses.length > 0) {
        const accessIdsToUpdate = gracePeriodAccesses.map(acc => acc.id);
        
        try {
          const { error: updateAccessError } = await supabase.rpc('mark_grace_accesses_paid', { 
            p_access_ids: accessIdsToUpdate
          });
          
          if (updateAccessError) {
            console.error('Error marking grace period accesses as paid:', updateAccessError);
            toast.error('Renewal successful, but failed to update grace access status. Please check system logs.');
            // Consider how to handle this partial failure - perhaps an admin alert or logging for manual reconciliation.
          } else {
            console.log('Successfully marked grace access IDs as paid:', accessIdsToUpdate);
            // Clear local state now that DB is updated (or re-fetch to be absolutely sure)
            setGracePeriodAccesses([]);
            setGracePeriodCharges(0);
            setHasGracePeriodAccess(false);
          }
        } catch (rpcError) { // Catch errors specifically from the RPC call itself
          console.error('RPC call to mark_grace_accesses_paid failed:', rpcError);
          toast.error('Renewal successful, but an error occurred updating grace access status. Contact support.');
        }
      }

      toast.success('Membership renewed successfully');
      
      // Show check-in modal after successful renewal
      setShowCheckInModal(true);
    } catch (error: any) {
      console.error('Error renewing membership:', error);
      toast.error(error.message || 'Error renewing membership');
      if (member) navigate(`/members/${member.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!member || checkingIn) return;
    
    setCheckingIn(true);
    try {
      // Create check-in record
      const { error: checkInError } = await supabase
        .from('check_ins')
        .insert({
          member_id: member.id,
          type: 'member',
          name: member.name,
          phone: '',
          user_id: user?.id
        });

      if (checkInError) throw checkInError;

      toast.success('Check-in successful');
      navigate(`/members/${member.id}`);
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Error checking in member');
      navigate(`/members/${member.id}`);
    }
  };

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    setSelectedPlan(plan || null);
    setFormData({ ...formData, planId });
  };

  // --- premature_renewal_blocked: block renewal if new expiry does not extend membership ---
  const today = new Date();
  let isPrematureRenewal = false;
  if (member && newExpiryDate) {
    if (member.status === 'expired') {
      isPrematureRenewal = newExpiryDate <= today;
    } else {
      isPrematureRenewal = newExpiryDate <= new Date(member.expiry_date);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Member not found
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredPlans = plans.filter(plan => plan.type === member.type);

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/members/${member.id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Member
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              Renew Membership
            </h1>

            <div className="mb-6">
              <div className="flex items-center space-x-4">
                <img
                  src={member.photo_url || 'https://via.placeholder.com/100'}
                  alt={member.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {member.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Last Valid Day: {formatLastValidDay(member.expiry_date)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Status: <span className="capitalize">{member.status}</span>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                  {isPrematureRenewal && (
                    <div className="mb-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
                      Renewal is not allowed because the selected plan does not extend the membership beyond the current expiry date.
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Plan Price</span>
                    <span>RM {selectedPlan.price.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    {member.status === 'expired' ? (
                      <p>New expiry date will be calculated from today ({format(new Date(), 'dd MMM yyyy')}).</p>
                    ) : (
                      <p>New expiry date will be calculated from current last valid day ({formatLastValidDay(member.expiry_date)}).</p>
                    )}
                  </div>
                  {newExpiryDate && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-sm font-medium text-gray-700">Extended until:</p>
                      <p className="text-lg font-bold text-orange-600">{formatLastValidDay(newExpiryDate.toISOString())}</p>
                      {member.status === 'expired' && hasGracePeriodAccess && gracePeriodAccesses.length > 0 && (
                        <p className="italic text-xs text-gray-500 mt-1">
                          Note : {gracePeriodAccesses.length} grace period access(es) utilised on : {gracePeriodAccesses.map(g => format(new Date(g.check_in_time), 'dd MMM yyyy')).join(', ')}.
                          The outstanding charges is RM {gracePeriodCharges.toFixed(2)}.
                        </p>
                      )}
                    </div>
                  )}
                  {gracePeriodCharges > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded text-xs text-red-800">
                      <p className="font-medium">Outstanding Grace Period Charges Notice</p>
                      <p className="mb-1">This member has pending charges for {gracePeriodAccesses.length} access(es) during previous grace period, totaling : <span className="font-bold">RM {gracePeriodCharges.toFixed(2)}</span>.</p>
                      <p className="italic">This outstanding amount must be settled together with renewal in order for the new membership period to start from today.</p>
                      <div className="mt-2 flex items-center">
                        <input 
                          type="checkbox" 
                          id="agreeGraceCharges"
                          checked={userAgreedToGraceCharges} 
                          onChange={(e) => setUserAgreedToGraceCharges(e.target.checked)} 
                          className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" 
                        />
                        <label htmlFor="agreeGraceCharges" className="ml-2 block text-sm text-gray-700">
                          The member agreed to pay these outstanding charges and proceed with renewal.
                        </label>
                      </div>
                    </div>
                  )}
                  {(selectedPlan && gracePeriodCharges >= 0) && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                        <span>Total Payable:</span>
                        <span>RM {(selectedPlan.price + gracePeriodCharges).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/members/${member.id}`)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !selectedPlan || isPrematureRenewal || (gracePeriodCharges > 0 && !userAgreedToGraceCharges)}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Pay & Renew'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <CheckInModal
        isOpen={showCheckInModal}
        onClose={() => {
          setShowCheckInModal(false);
          navigate(`/members/${member.id}`);
        }}
        onConfirm={handleCheckIn}
        memberName={member.name}
      />
    </>
  );
}