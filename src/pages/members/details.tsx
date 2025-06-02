import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { formatLastValidDay } from '../../lib/utils';
import { 
  ArrowLeft, 
  UserCog, 
  Ban, 
  History, 
  CreditCard, 
  DoorOpen,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { supabase } from '../../lib/supabase';
import { Member, CheckIn, Payment, MembershipHistory } from '../../types';
import { useAuthStore } from '../../store/auth';
import toast from 'react-hot-toast';

const CHECK_IN_PAGE_SIZE = 10;
const GRACE_PERIOD_PAGE_SIZE = 10;

type HistoryTab = 'check-ins' | 'payments' | 'membership' | 'grace-period';

interface GracePeriodAccess {
  id: string;
  check_in_time: string;
  expiry_date: string;
  grace_period_days: number;
  user?: {
    email: string;
    name?: string;
  } | null;
}

export default function MemberDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<HistoryTab>('check-ins');
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [membershipHistory, setMembershipHistory] = useState<MembershipHistory[]>([]);
  const [gracePeriodAccess, setGracePeriodAccess] = useState<GracePeriodAccess[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [checkInPage, setCheckInPage] = useState(1);
  const [gracePeriodPage, setGracePeriodPage] = useState(1);
  const [checkInSortField, setCheckInSortField] = useState<'check_in_time'>('check_in_time');
  const [checkInSortDirection, setCheckInSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchMember();
  }, [id]);

  useEffect(() => {
    if (member) {
      setCheckInPage(1);
      setGracePeriodPage(1);
      fetchHistory();
    }
  }, [member, activeTab]);

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

  const fetchHistory = async () => {
    if (!member) return;
    setLoadingHistory(true);

    try {
      if (activeTab === 'check-ins') {
        const { data, error } = await supabase
          .from('check_ins')
          .select(`id, member_id, check_in_time, type, user_id, user:user_id (email, name)`)
          .eq('member_id', member.id)
          .order('check_in_time', { ascending: false });

        if (error) throw error;
        setCheckIns((data || []).map((g: any) => ({ ...g, user: Array.isArray(g.user) ? g.user[0] : g.user })));
      } else if (activeTab === 'payments') {
        const { data, error } = await supabase
          .from('payments')
          .select('id, member_id, amount, type, payment_method, created_at, coupon_id')
          .eq('member_id', member.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setPayments(data);
      } else if (activeTab === 'membership') {
        const { data: paymentData, error: paymentError } = await supabase
          .from('payments')
          .select('id, member_id, amount, type, payment_method, created_at, coupon_id')
          .eq('member_id', member.id)
          .in('type', ['registration', 'renewal'])
          .order('created_at', { ascending: true })
          .limit(50);

        if (paymentError) throw paymentError;

        const historyItems: MembershipHistory[] = [];
        
        let currentExpiryDate: Date | null = null;
        
        paymentData.forEach((payment, index) => {
          const paymentDate = new Date(payment.created_at);
          
          const previousExpiryDate = currentExpiryDate ? new Date(currentExpiryDate) : null;
          
          if (payment.type === 'registration') {
            currentExpiryDate = new Date(paymentDate);
            currentExpiryDate.setMonth(currentExpiryDate.getMonth() + 1);
          } else if (payment.type === 'renewal' && previousExpiryDate) {
            currentExpiryDate = new Date(previousExpiryDate);
            currentExpiryDate.setMonth(currentExpiryDate.getMonth() + 1);
          }
          
          historyItems.push({
            id: payment.id,
            payment_id: payment.id,
            member_id: payment.member_id,
            previous_expiry_date: previousExpiryDate?.toISOString() || null,
            new_expiry_date: currentExpiryDate?.toISOString() || null,
            type: payment.type as 'registration' | 'renewal',
            plan_details: {
              months: 1,
              price: payment.amount,
            },
            created_at: payment.created_at,
            payment: {
              amount: payment.amount,
              payment_method: payment.payment_method,
              created_at: payment.created_at
            }
          });
        });
        
        setMembershipHistory(historyItems.reverse());
      } else if (activeTab === 'grace-period') {
        const { data, error } = await supabase
          .from('grace_period_access')
          .select(`
            id,
            check_in_time,
            expiry_date,
            grace_period_days,
            user:user_id (
              email,
              name
            )
          `)
          .eq('member_id', member.id)
          .order('check_in_time', { ascending: false });

        if (error) throw error;
        const processedGraceAccess = (data || []).map((g: any) => ({
          ...g,
          user: g.user || null
        }));
        setGracePeriodAccess(processedGraceAccess);
      }
    } catch (error) {
      console.error('Supabase Error:', error);
      toast.error('Error fetching history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSuspend = async () => {
    if (!member || !['admin', 'superadmin'].includes(user?.role || '')) return;

    const confirmed = window.confirm(
      member.status === 'suspended'
        ? 'Are you sure you want to unsuspend this member?'
        : 'Are you sure you want to suspend this member? They will not be able to check in until unsuspended.'
    );

    if (!confirmed) return;

    try {
      if (member.status === 'suspended') {
        const expiryDate = new Date(member.expiry_date);
        const now = new Date();
        
        let gracePeriodDays = 7;
        
        try {
          const { data: settingsData, error: settingsError } = await supabase.rpc('get_settings', {
            p_key: 'membership'
          });

          if (!settingsError && settingsData?.grace_period_days) {
            gracePeriodDays = settingsData.grace_period_days;
          }
        } catch (error) {
          console.error('Error fetching settings:', error);
        }

        const graceDate = new Date(expiryDate);
        graceDate.setDate(graceDate.getDate() + gracePeriodDays);

        let newStatus: Member['status'];
        if (expiryDate > now) {
          newStatus = 'active';
        } else if (graceDate > now) {
          newStatus = 'grace';
        } else {
          newStatus = 'expired';
        }

        const { error } = await supabase
          .from('members')
          .update({ status: newStatus })
          .eq('id', member.id);

        if (error) throw error;

        toast.success(`Member has been unsuspended (Status: ${capitalizeStatus(newStatus)})`);
      } else {
        const { error } = await supabase
          .from('members')
          .update({ status: 'suspended' })
          .eq('id', member.id);

        if (error) throw error;

        toast.success('Member has been suspended');
      }

      fetchMember();
    } catch (error) {
      toast.error('Error updating member status');
    }
  };

  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status: Member['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'grace':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const sortedCheckIns = useMemo(() => {
    return [...checkIns].sort((a, b) => {
        const timeA = new Date(a.check_in_time).getTime();
        const timeB = new Date(b.check_in_time).getTime();
        if (checkInSortDirection === 'asc') {
            return timeA - timeB;
        } else {
            return timeB - timeA;
        }
    });
  }, [checkIns, checkInSortDirection]);

  const totalCheckInPages = Math.ceil(sortedCheckIns.length / CHECK_IN_PAGE_SIZE);
  const paginatedCheckIns = sortedCheckIns.slice((checkInPage - 1) * CHECK_IN_PAGE_SIZE, checkInPage * CHECK_IN_PAGE_SIZE);

  const totalGracePeriodPages = Math.ceil(gracePeriodAccess.length / GRACE_PERIOD_PAGE_SIZE);
  const paginatedGracePeriodAccess = gracePeriodAccess.slice((gracePeriodPage - 1) * GRACE_PERIOD_PAGE_SIZE, gracePeriodPage * GRACE_PERIOD_PAGE_SIZE);

  const handleCheckInPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalCheckInPages) {
      setCheckInPage(newPage);
    }
  };

  const handleGracePeriodPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalGracePeriodPages) {
      setGracePeriodPage(newPage);
    }
  };

  const handleCheckInSort = () => {
    setCheckInSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    setCheckInPage(1);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900">Member not found</h2>
          <p className="mt-1 text-sm text-gray-500">
            The member you're looking for doesn't exist or has been removed.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate('/members')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Members
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/members')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Members
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-shrink-0 mb-6 sm:mb-0 sm:mr-8">
              <img
                src={member.photo_url || 'https://via.placeholder.com/200'}
                alt={member.name}
                className="h-48 w-48 rounded-lg object-cover"
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{member.name}</h1>
                  <p className="text-lg text-gray-600 mt-1">
                    Member ID: <span className="font-mono">{member.member_id}</span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => navigate(`/members/${member.id}/edit`)}>
                    <UserCog className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/members/${member.id}/renew`)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Renew
                  </Button>
                  {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <Button
                      variant={member.status === 'suspended' ? 'outline' : 'ghost'}
                      onClick={handleSuspend}
                    >
                      {member.status === 'suspended' ? (
                        <>
                          <DoorOpen className="mr-2 h-4 w-4" />
                          Unsuspend
                        </>
                      ) : (
                        <>
                          <Ban className="mr-2 h-4 w-4" />
                          Suspend
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-gray-500">Membership Type</p>
                  <p className="mt-1 text-lg font-medium capitalize">{member.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className={`mt-1 inline-flex px-2 text-sm font-semibold rounded-full ${getStatusColor(member.status)}`}>
                    {capitalizeStatus(member.status)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Valid Day</p>
                  <p className="mt-1 text-lg font-medium">
                    {formatLastValidDay(member.expiry_date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NRIC</p>
                  <p className="mt-1 text-lg font-medium">{member.nric}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="mt-1 text-lg font-medium">{member.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="mt-1 text-lg font-medium">{member.email || '-'}</p>
                </div>
              </div>

              {member.status === 'expired' && (
                <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        This membership has expired. Member needs to renew to continue accessing the gym.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {member.status === 'grace' && (
                <div className="mt-6 bg-orange-50 border-l-4 border-orange-400 p-4">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                    <div className="ml-3">
                      <p className="text-sm text-orange-700">
                        This member is in their grace period. They should renew their membership soon.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('check-ins')}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === 'check-ins'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <History className="inline-block mr-2 h-4 w-4" />
                  Check-ins
                </button>
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === 'payments'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <CreditCard className="inline-block mr-2 h-4 w-4" />
                  Payments
                </button>
                <button
                  onClick={() => setActiveTab('membership')}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === 'membership'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <Calendar className="inline-block mr-2 h-4 w-4" />
                  Membership History
                </button>
                <button
                  onClick={() => setActiveTab('grace-period')}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === 'grace-period'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <Clock className="inline-block mr-2 h-4 w-4" />
                  Grace Period Access
                </button>
              </nav>
            </div>

            <div className="mt-6">
              {loadingHistory ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                </div>
              ) : (
                <> 
                  {activeTab === 'check-ins' && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                               #
                            </th>
                            <th 
                               scope="col" 
                               className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                               onClick={handleCheckInSort}
                            >
                               <div className="flex items-center">
                                  Time 
                                  <ArrowUpDown className="ml-2 h-3 w-3 text-gray-400" />
                               </div>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cashier
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedCheckIns.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                                No check-in history found.
                              </td>
                            </tr>
                          ) : (
                            paginatedCheckIns.map((checkIn, index) => (
                              <tr key={checkIn.id}>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                  {(checkInPage - 1) * CHECK_IN_PAGE_SIZE + index + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {format(new Date(checkIn.check_in_time), 'dd MMM yyyy (EEE), hh:mm a')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {checkIn.user?.name || checkIn.user?.email || 'N/A'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      {totalCheckInPages > 1 && (
                        <div className="flex justify-between items-center pt-4 text-sm">
                          <Button 
                            variant="outline" size="sm"
                            onClick={() => handleCheckInPageChange(checkInPage - 1)} 
                            disabled={checkInPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                          </Button>
                          <span>Page {checkInPage} of {totalCheckInPages}</span>
                          <Button 
                            variant="outline" size="sm"
                            onClick={() => handleCheckInPageChange(checkInPage + 1)} 
                            disabled={checkInPage === totalCheckInPages}
                          >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'payments' && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Payment Method
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {payments.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                No payments found
                              </td>
                            </tr>
                          ) : (
                            payments.map((payment) => (
                              <tr key={payment.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {format(new Date(payment.created_at), 'dd MMM yyyy')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                  {payment.type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  RM {payment.amount.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                  {payment.payment_method.replace('_', ' ')}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {activeTab === 'membership' && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Previous Expiry
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              New Expiry
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Payment Method
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {membershipHistory.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                No membership history found
                              </td>
                            </tr>
                          ) : (
                            membershipHistory.map((history) => (
                              <tr key={history.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {format(new Date(history.created_at), 'dd MMM yyyy')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                  {history.type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {history.previous_expiry_date 
                                    ? format(new Date(history.previous_expiry_date), 'dd MMM yyyy')
                                    : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {history.new_expiry_date
                                    ? format(new Date(history.new_expiry_date), 'dd MMM yyyy')
                                    : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  RM {history.payment?.amount.toFixed(2) || '0.00'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                  {history.payment?.payment_method.replace('_', ' ') || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {activeTab === 'grace-period' && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date & Time
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Expiry Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Grace Period Days
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Processed By
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedGracePeriodAccess.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                No grace period access records found
                              </td>
                            </tr>
                          ) : (
                            paginatedGracePeriodAccess.map((record) => (
                              <tr key={record.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {format(new Date(record.check_in_time), 'dd MMM yyyy HH:mm')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {format(new Date(record.expiry_date), 'dd MMM yyyy')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {record.grace_period_days} days
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {record.user?.name || record.user?.email || 'System'} 
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      {totalGracePeriodPages > 1 && (
                        <div className="flex justify-between items-center pt-4 text-sm">
                          <Button 
                            variant="outline" size="sm"
                            onClick={() => handleGracePeriodPageChange(gracePeriodPage - 1)} 
                            disabled={gracePeriodPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                          </Button>
                          <span>Page {gracePeriodPage} of {totalGracePeriodPages}</span>
                          <Button 
                            variant="outline" size="sm"
                            onClick={() => handleGracePeriodPageChange(gracePeriodPage + 1)} 
                            disabled={gracePeriodPage === totalGracePeriodPages}
                          >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}