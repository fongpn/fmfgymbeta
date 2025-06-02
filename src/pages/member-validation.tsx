import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserCheck, UserX, Clock, History, Loader2, AlertTriangle, RefreshCw, X, UserCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabase';
import { Member } from '../types';
import { CheckInHistoryModal } from '../components/members/CheckInHistoryModal';
import { updateMemberStatus, playStatusSound, formatLastValidDay } from '../lib/utils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface MultipleCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lastCheckIn: string;
}

function MultipleCheckInModal({ isOpen, onClose, onConfirm, lastCheckIn }: MultipleCheckInModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Multiple Check-ins</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center text-yellow-600 mb-4">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <p className="text-sm">This member has already checked in today.</p>
            </div>
            <p className="text-sm text-gray-600">
              Last check-in: <span className="font-medium">{format(new Date(lastCheckIn), 'dd MMM yyyy HH:mm')}</span>
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onConfirm}>
              <UserCheck className="mr-2 h-4 w-4" />
              Check In Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Define interface for the data structure returned by search_check_ins RPC
interface RpcCheckInData {
  id: string;
  type: 'member' | 'walk-in';
  check_in_time: string;
  name: string | null; // Walk-in name
  user_id: string | null;
  member_id_col: string | null; // Member ID from joined table
  member_name_col: string | null; // Member Name from joined table
}

export default function MemberValidation() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check-in history state
  const [showHistory, setShowHistory] = useState(false);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sortField, setSortField] = useState<any>('check_in_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);

  // Multiple check-in state
  const [showMultipleCheckInModal, setShowMultipleCheckInModal] = useState(false);
  const [lastCheckInTime, setLastCheckInTime] = useState<string>('');

  // State for validation feedback
  const [validationState, setValidationState] = useState<'default' | 'active' | 'grace' | 'expired' | 'suspended' | 'not-found'>('default');

  const ITEMS_PER_PAGE_HISTORY = 10;

  // DEFINE fetchCheckInHistory FIRST
  const fetchCheckInHistory = useCallback(async (
    currentQuery: string | null, 
    currentSelectedDate: string, 
    currentHistoryPage: number,
    currentSortField: string,
    currentSortOrder: 'asc' | 'desc'
  ) => {
    setHistoryLoading(true);
    setCheckIns([]); // Clear previous results
    try {
      // Prepare dates based on currentSelectedDate argument
      const baseDate = new Date(currentSelectedDate + 'T00:00:00Z'); 
      if (isNaN(baseDate.getTime())) {
        console.error("Invalid selectedDate format", currentSelectedDate);
        throw new Error("Invalid date format");
      }
      const startOfDay = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 23, 59, 59, 999));
      const startDateIso = startOfDay.toISOString();
      const endDateIso = endOfDay.toISOString();

      // Prepare pagination and search term based on arguments
      const startOffset = (currentHistoryPage - 1) * ITEMS_PER_PAGE_HISTORY;
      const effectiveSearchTerm = currentQuery?.trim() || null;

      // Determine sort parameters (assuming RPC needs these, adjust if necessary)
      // Currently, the RPC search_check_ins doesn't seem to accept sort params,
      // but we include them here for potential future use or if client-side sorting is needed.
      // const sortParam = currentSortField; 
      // const ascendingParam = currentSortOrder === 'asc';

      // --- Call RPC for Count ---      
      const countParams = {
        search_term: effectiveSearchTerm,
        start_date: effectiveSearchTerm ? null : startDateIso, 
        end_date: effectiveSearchTerm ? null : endDateIso,
        filter_type: 'member'
      };
      const { data: countData, error: countError } = await supabase.rpc('count_check_ins', countParams);

      if (countError) throw countError;
      const totalCount = countData || 0;
      setTotalHistoryCount(totalCount);
      setTotalPages(Math.ceil(totalCount / ITEMS_PER_PAGE_HISTORY));

      if (totalCount === 0) {
        setCheckIns([]);
        setHistoryLoading(false);
        return; 
      }

      // --- Call RPC for Data ---      
      const dataParams = {
        search_term: effectiveSearchTerm,
        start_date: effectiveSearchTerm ? null : startDateIso, 
        end_date: effectiveSearchTerm ? null : endDateIso,
        page_limit: ITEMS_PER_PAGE_HISTORY,
        page_offset: startOffset,
        filter_type: 'member'
      };
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_check_ins', dataParams);

      if (rpcError) throw rpcError;
      
      const checkInsData = rpcData as RpcCheckInData[] || [];
      // console.log('Raw check-in data from RPC:', checkInsData); // Keep original if desired, remove DEBUG logs
      
      // --- Fetch User Details ---
      // console.log("DEBUG: Starting user details fetch"); // Remove Log 1
      const userIds = checkInsData.map(item => item.user_id).filter((id): id is string => id !== null); 
      const uniqueUserIds = [...new Set(userIds)];
      const userIdToDetailsMap = new Map<string, { email: string; name?: string; }>();
      
      if (uniqueUserIds.length > 0) {
        // console.log("DEBUG: Attempting to fetch user details for IDs:", uniqueUserIds); // Remove Log Before Await
        // console.log("DEBUG: Fetching users for IDs:", uniqueUserIds); // Remove Log 2
        const { data: usersData, error: usersError } = await supabase
          .from('users') 
          .select('id, email, name')
          .in('id', uniqueUserIds);
        // console.log("DEBUG: Finished awaiting user fetch. Error:", usersError, "Data:", usersData); // Remove Log After Await
        if (usersError) {
          console.error('Error fetching user details:', usersError); // Keep original error log
          throw usersError;
        } 
        else if (usersData) {
          // console.log("DEBUG: Fetched users data:", usersData); // Remove Log 3
          usersData.forEach(user => userIdToDetailsMap.set(user.id, { email: user.email, name: user.name }));
        }
      } else {
        // console.log("DEBUG: No unique user IDs to fetch details for."); // Remove Log 4
      }
      // --- End Fetch User Details ---

      // --- Map RPC data ---
      // console.log("DEBUG: Starting final mapping"); // Remove Log 5
      const finalCheckIns = checkInsData.map(item => {
          const userDetails = item.user_id ? userIdToDetailsMap.get(item.user_id) : undefined; 
          return {
            id: item.id,
            type: item.type,
            check_in_time: item.check_in_time,
            ...(item.type === 'member' && {
              member: {
                member_id: item.member_id_col,
                name: item.member_name_col
              },
              name: null
            }),
            ...(item.type === 'walk-in' && {
              member: null,
              name: item.name 
            }),
            user: userDetails
          };
      });
      // console.log("DEBUG: Finished final mapping"); // Remove Log 6

      // --- Apply client-side sorting --- 
      // console.log("DEBUG: Starting sorting"); // Remove Log 7
      finalCheckIns.sort((a, b) => {
          if (currentSortField === 'check_in_time') {
            const timeA = new Date(a.check_in_time).getTime();
            const timeB = new Date(b.check_in_time).getTime();
            return currentSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
          }
          if (currentSortField === 'member_id') {
             const idA = a.member?.member_id || '';
             const idB = b.member?.member_id || '';
             const comparison = idA.localeCompare(idB);
             return currentSortOrder === 'asc' ? comparison : -comparison;
          }
          if (currentSortField === 'name') {
             const nameA = a.member?.name || a.name || '';
             const nameB = b.member?.name || b.name || '';
             const comparison = nameA.localeCompare(nameB);
             return currentSortOrder === 'asc' ? comparison : -comparison;
          }
          return 0; 
      });
      // console.log("DEBUG: Finished sorting"); // Remove Log 8
      
      // console.log("Final Check-ins data being set:", finalCheckIns); // Remove Final Log

      setCheckIns(finalCheckIns);

    } catch (error) {
      // console.error("DEBUG: Caught error in fetchCheckInHistory:", error); // Remove Log Catch Start 
      console.error('Error during fetchCheckInHistory process:', error); // Keep original error log
      toast.error('Error loading check-in history');
      setCheckIns([]);
      setTotalPages(1);
    } finally {
      setHistoryLoading(false);
    }
    // Dependencies ONLY include stable setters and external stable references (supabase)
  }, [setHistoryLoading, setCheckIns, setTotalPages, supabase]); 

  // DEFINE handleHistorySearch SECOND (depends on fetchCheckInHistory)
  const handleHistorySearch = useCallback((query: string) => {
    setHistorySearchQuery(query);
    setCurrentPage(1); 
    fetchCheckInHistory(query, selectedDate, 1, sortField, sortOrder); 
  }, [setHistorySearchQuery, setCurrentPage, fetchCheckInHistory]); 

  // DEFINE handleSort THIRD
  const handleSort = useCallback((field: string) => {
    const newSortOrder = (sortField === field && sortOrder === 'asc') ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(newSortOrder);
    setCurrentPage(1); 
  }, [sortField, sortOrder]); 

  // DEFINE useEffect LAST (depends on fetchCheckInHistory)
  useEffect(() => {
    if (showHistory) {
      fetchCheckInHistory(historySearchQuery, selectedDate, currentPage, sortField, sortOrder);
    }
  }, [showHistory, currentPage, selectedDate, sortField, sortOrder, historySearchQuery, fetchCheckInHistory]);

  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchQuery('');
        setSearchResults([]);
        setSelectedMember(null);
        searchInputRef.current?.focus();
      } else if (e.ctrlKey && e.key === 'Enter' && selectedMember) {
        handleCheckIn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember]);

  useEffect(() => {
    if (validationState !== 'default') {
      document.body.classList.add(`bg-validation-${validationState}`);
      const timer = setTimeout(() => {
        document.body.classList.remove(`bg-validation-${validationState}`);
        setValidationState('default');
      }, 2000);
      return () => {
        clearTimeout(timer);
        document.body.classList.remove(`bg-validation-${validationState}`);
      };
    }
  }, [validationState]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, email, phone, nric, type, status, photo_url, expiry_date, created_at, member_id')
        .or(`member_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,nric.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(5);

      if (error) throw error;

      if (data && data.length > 0) {
        const updatedMembers = await Promise.all(
          data.map(async (member) => {
            try {
              await updateMemberStatus(member);
              const { data: updatedData } = await supabase
                .from('members')
                .select('id, name, email, phone, nric, type, status, photo_url, expiry_date, created_at, member_id')
                .eq('id', member.id)
                .single();
              return updatedData || member;
            } catch (error) {
              console.error('Error updating member status:', error);
              return member;
            }
          })
        );

        setSearchResults(updatedMembers);
        if (updatedMembers.length === 1) {
          setSelectedMember(updatedMembers[0]);
          setValidationState(updatedMembers[0].status);
          playStatusSound(updatedMembers[0].status);
        } else {
          setSelectedMember(null);
          setValidationState('default');
        }
      } else {
        setSearchResults([]);
        setSelectedMember(null);
        setValidationState('not-found');
        toast.error('No members found');
        playStatusSound('expired');
      }
    } catch (error) {
      console.error('Error searching for members:', error);
      toast.error('Error searching for members');
      setValidationState('not-found');
      playStatusSound('expired');
    } finally {
      setLoading(false);
    }
  };

  const checkPreviousCheckIn = async (memberId: string) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('check_ins')
        .select('check_in_time')
        .eq('member_id', memberId)
        .eq('type', 'member')
        .gte('check_in_time', startOfDay)
        .lte('check_in_time', endOfDay)
        .order('check_in_time', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setLastCheckInTime(data[0].check_in_time);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking previous check-in:', error);
      return false;
    }
  };

  const handleCheckIn = async () => {
    if (!selectedMember) return;
    if (checkingIn) return;

    // Prevent check-in for suspended members
    if (selectedMember.status === 'suspended') {
      toast.error('Cannot check in suspended member');
      return;
    }

    // For expired members, directly navigate to walk-in page
    if (selectedMember.status === 'expired') {
      navigate('/walk-ins', {
        state: {
          name: selectedMember.name
        }
      });
      return;
    }

    // Check for previous check-in
    const hasCheckedInToday = await checkPreviousCheckIn(selectedMember.id);
    if (hasCheckedInToday) {
      setShowMultipleCheckInModal(true);
      return;
    }

    await processCheckIn();
  };

  const processCheckIn = async () => {
    if (!selectedMember) return;
    
    setCheckingIn(true);
    try {
      // Create check-in record
      const { data: checkIn, error: checkInError } = await supabase
        .from('check_ins')
        .insert({
          member_id: selectedMember.id,
          type: 'member',
          name: selectedMember.name,
          phone: '',
          user_id: user?.id
        })
        .select()
        .single();

      if (checkInError) throw checkInError;

      // If member is in grace period, record the access
      if (selectedMember.status === 'grace') {
        // Get current grace period setting and walk-in prices
        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'membership')
          .single();

        if (settingsError) {
          console.error('Error fetching membership settings for grace period access:', settingsError);
          // Decide if you want to proceed without settings or show an error
          // For now, we'll try to proceed but walk-in price might be 0
        }

        const gracePeriodDays = settingsData?.value?.grace_period_days || 7;
        let walkinPriceForThisAccess = 0;

        if (settingsData?.value) {
          if (selectedMember.type === 'adult') {
            walkinPriceForThisAccess = settingsData.value.adult_walkin_price || 0;
          } else if (selectedMember.type === 'youth') {
            walkinPriceForThisAccess = settingsData.value.youth_walkin_price || 0;
          }
        }

        if (walkinPriceForThisAccess === 0) {
          console.warn(`Walk-in price could not be determined for member type: ${selectedMember.type}. Check 'membership' settings in the database. Storing 0 for this grace period access.`);
          toast.error('Could not determine walk-in price for grace access. Please check admin settings.'); // Inform staff
        }

        // Record grace period access
        const { error: graceError } = await supabase
          .from('grace_period_access')
          .insert({
            member_id: selectedMember.id,
            check_in_time: checkIn.check_in_time, // Assuming checkIn object has check_in_time
            expiry_date: selectedMember.expiry_date,
            grace_period_days: gracePeriodDays,
            user_id: user?.id,
            walkin_price_at_time_of_access: walkinPriceForThisAccess // Add the determined walk-in price
          });

        if (graceError) {
          console.error('Error recording grace period access:', graceError);
          // Don't throw error here - we still want to allow check-in
        }
      }

      await playStatusSound(selectedMember.status);
      toast.success('Check-in successful');

      setSearchQuery('');
      setSearchResults([]);
      setSelectedMember(null);
      searchInputRef.current?.focus();

      if (showHistory) {
        fetchCheckInHistory(historySearchQuery, selectedDate, currentPage, sortField, sortOrder);
      }
      
      setValidationState(selectedMember.status);

    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Error checking in member');
      setValidationState('default');
    } finally {
      setCheckingIn(false);
      setShowMultipleCheckInModal(false);
    }
  };

  const handleRenew = () => {
    if (selectedMember) {
      navigate(`/members/${selectedMember.id}/renew`);
    }
  };

  const getStatusColor = (status: Member['status'] | 'default' | 'not-found') => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 transition-colors duration-500';
      case 'grace':
        return 'bg-yellow-100 text-yellow-800 transition-colors duration-500';
      case 'expired':
        return 'bg-red-100 text-red-800 transition-colors duration-500';
      case 'suspended':
        return 'bg-gray-100 text-gray-800 transition-colors duration-500';
      case 'not-found':
        return 'bg-red-200 text-red-900 transition-colors duration-500';
      default:
        return 'bg-gray-50 text-gray-800 transition-colors duration-500';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Member Validation</h1>
        <Button variant="outline" onClick={() => setShowHistory(true)}>
          <History className="mr-2 h-4 w-4" />
          View History
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search by ID, name, NRIC, or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
        </div>

        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          </div>
        )}

        {searchResults.length > 0 && !selectedMember && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Search Results</h2>
            <div className="grid gap-4">
              {searchResults.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="flex items-center space-x-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors text-left w-full"
                >
                  <div className="h-16 w-16 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-200">
                    {member.photo_url ? (
                      <img
                        src={member.photo_url}
                        alt={member.name}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <UserCircle2 className="h-12 w-12 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">{member.name}</h3>
                    <p className="text-sm text-gray-500">ID: {member.member_id}</p>
                    <p className="text-sm text-gray-500">{member.nric}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedMember && (
          <div className={`rounded-lg p-6 ${getStatusColor(validationState)}`}>
            <div className="flex items-start space-x-6">
              <div className="relative group">
                <div className="relative w-32 h-32 flex items-center justify-center rounded-lg bg-gray-200">
                  {selectedMember.photo_url ? (
                    <img
                      src={selectedMember.photo_url}
                      alt={selectedMember.name}
                      className="absolute top-0 left-0 w-full h-full rounded-lg object-cover transition-transform duration-300 ease-out transform-gpu group-hover:scale-[2] group-hover:z-50"
                    />
                  ) : (
                    <UserCircle2 className="h-24 w-24 text-gray-400" />
                  )}
                  <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-25 transition-opacity duration-300 rounded-lg"></div>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">{selectedMember.name}</h2>
                <p className="text-gray-600 mb-4">ID: {selectedMember.member_id}</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Membership Type</p>
                    <p className="font-medium capitalize">{selectedMember.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium capitalize">{selectedMember.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Last Valid Day</p>
                    <p className="font-medium">
                      {formatLastValidDay(selectedMember.expiry_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">NRIC</p>
                    <p className="font-medium">{selectedMember.nric}</p>
                  </div>
                </div>

                {selectedMember.status === 'expired' && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <p className="text-sm text-red-700">
                          This membership has expired. Member needs to renew to continue accessing the gym.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedMember.status === 'grace' && (
                  <div className="mb-4 bg-orange-50 border-l-4 border-orange-400 p-4">
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

                <div className="flex space-x-4">
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkingIn || selectedMember.status === 'suspended'}
                    className="flex-1"
                  >
                    {checkingIn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {selectedMember.status === 'active' ? (
                          <UserCheck className="mr-2 h-4 w-4" />
                        ) : selectedMember.status === 'grace' ? (
                          <Clock className="mr-2 h-4 w-4" />
                        ) : (
                          <UserX className="mr-2 h-4 w-4" />
                        )}
                        {selectedMember.status === 'expired' ? 'Register as Walk-in' : 'Check In'}
                      </>
                    )}
                  </Button>
                  {(selectedMember.status === 'active' || selectedMember.status === 'grace' || selectedMember.status === 'expired') && (
                    <Button
                      variant="outline"
                      onClick={handleRenew}
                      className="flex-1"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Renew Membership
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedMember(null);
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CheckInHistoryModal
        isOpen={showHistory}
        onClose={() => {
          setShowHistory(false);
          setHistorySearchQuery('');
        }}
        checkIns={checkIns}
        loading={historyLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalHistoryCount}
        onPageChange={setCurrentPage}
        onDateChange={setSelectedDate}
        selectedDate={selectedDate}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        type="member"
        onSearch={handleHistorySearch}
      />

      <MultipleCheckInModal
        isOpen={showMultipleCheckInModal}
        onClose={() => setShowMultipleCheckInModal(false)}
        onConfirm={processCheckIn}
        lastCheckIn={lastCheckInTime}
      />
    </div>
  );
}