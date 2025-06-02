import React, { useState, useEffect } from 'react';
import { Calendar, Users, TrendingUp, Banknote, QrCode, Landmark, Gift, History, UserCheck, RefreshCw, ArrowRight, List, Clock, ChevronLeft, ChevronRight, UserPlus, Receipt, Wallet, Coins, UserCircle, Ticket, Smile, ShoppingCart } from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, subDays, isFuture } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';
import { Member } from '../../types'; 
import toast from 'react-hot-toast'; 

// Type for overall summary data
interface DailySummaryData {
  totalSales: number;
  totalCheckIns: number;
  memberCheckIns: number;
  walkInCheckIns: number;
  newMembers: number;
  membershipRevenue: number;
  walkInRevenue: number;
  posRevenue: number;
  couponRevenue: number;
  gracePeriodSettlementFees: number;
  cashCollections: number;
  qrCollections: number;
  bankTransferCollections: number;
  renewals: number;
  posItemsSold: number;
}

// Type for grace period entries list
interface GracePeriodEntry {
  id: string;
  check_in_time: string;
  expiry_date: string;
  member_id: string;
  member_name: string | null;
  member?: { name: string | null }; // Include nested member for mapping
}

// Type for newly registered list
interface NewlyRegisteredMember {
  id: string;
  member_id: string;
  name: string | null;
  phone: string | null;
  photo_url?: string | null;
}

// Type for Walk-in list
interface WalkInEntry {
  id: string;
  check_in_time: string;
  name: string | null;
}

// Type for Shift Breakdown
interface ShiftBreakdown {
  shiftId: string | null; 
  userId: string | null;  
  userName: string | null;
  startTime: string; 
  endTime: string;   
  cashCollections: number;
  qrCollections: number;
  bankTransferCollections: number;
  totalSales: number;
}

// Interface for active shifts displayed on the summary
interface ActiveShiftDisplayData {
  shiftId: string;
  userId: string;
  userName: string | null;
  startTime: string;
  // endTime is 'Ongoing' or similar for display
  cashCollections: number;
  qrCollections: number;
  bankTransferCollections: number;
  totalSales: number;
  // isActive: true; // Not strictly needed if in separate list/typed
}

const PAGE_SIZE = 5; // Define page size

export default function DailySummaryPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<DailySummaryData | null>(null);
  const [newlyRegistered, setNewlyRegistered] = useState<NewlyRegisteredMember[]>([]);
  const [gracePeriodEntries, setGracePeriodEntries] = useState<GracePeriodEntry[]>([]);
  const [shiftBreakdowns, setShiftBreakdowns] = useState<ShiftBreakdown[]>([]); 
  const [pendingShiftBreakdowns, setPendingShiftBreakdowns] = useState<ActiveShiftDisplayData[]>([]);
  const [newMembersPage, setNewMembersPage] = useState(1);
  const [gracePeriodPage, setGracePeriodPage] = useState(1);
  const [walkIns, setWalkIns] = useState<WalkInEntry[]>([]); // State for walk-ins
  const [walkInPage, setWalkInPage] = useState(1);         // State for walk-in pagination
  const [filterExporting, setFilterExporting] = useState(false);

  useEffect(() => {
    fetchDailyData();
    // Reset pages when date or time changes
    setNewMembersPage(1);
    setGracePeriodPage(1);
    setWalkInPage(1); // Reset walk-in page
  }, [startDate, endDate, startTime, endTime]);

  const fetchDailyData = async () => {
    setLoading(true);
    setSummaryData(null); 
    setNewlyRegistered([]);
    setGracePeriodEntries([]);
    setShiftBreakdowns([]);
    setPendingShiftBreakdowns([]); // Reset pending shifts
    setWalkIns([]); // Reset walk-ins

    try {
      // Calculate date range using UTC for consistency with walk-ins/list.tsx RPC calls
      // Combine startDate/endDate with startTime and endTime
      const baseStart = new Date(startDate + 'T00:00:00Z');
      const baseEnd = new Date(endDate + 'T00:00:00Z');
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const startDateTime = new Date(Date.UTC(baseStart.getUTCFullYear(), baseStart.getUTCMonth(), baseStart.getUTCDate(), startHour, startMinute, 0, 0));
      const endDateTime = new Date(Date.UTC(baseEnd.getUTCFullYear(), baseEnd.getUTCMonth(), baseEnd.getUTCDate(), endHour, endMinute, 59, 999));
      const startTimeIso = startDateTime.toISOString();
      const endTimeIso = endDateTime.toISOString();
      console.log(`[Fetch Summary] Querying data using UTC range: ${startTimeIso} to ${endTimeIso}`); // Updated log

      // --- Fetch Data (Removed direct walk-in fetch from here) --- 
      const [paymentsRes, checkInsRes, newMembersRes, graceAccessRes, shiftsTodayRes, lastShiftBeforeTodayRes /* removed walkInsRes */] = await Promise.all([
        supabase.from('payments').select('*, user:user_id(id, name, email)').gte('created_at', startTimeIso).lte('created_at', endTimeIso),
        supabase.from('check_ins').select('type', { count: 'exact' }).gte('check_in_time', startTimeIso).lte('check_in_time', endTimeIso), // Keep total check-in count
        supabase.from('members').select('id, member_id, name, phone, photo_url', { count: 'exact' }).gte('created_at', startTimeIso).lte('created_at', endTimeIso),
        supabase.from('grace_period_access').select('*, member:members(name)').gte('check_in_time', startTimeIso).lte('check_in_time', endTimeIso),
        supabase.from('shifts').select('*, user:user_id(id, name, email)').gte('ended_at', startTimeIso).lte('ended_at', endTimeIso).order('ended_at', { ascending: true }),
        supabase.from('shifts').select('ended_at').lt('ended_at', startTimeIso).order('ended_at', { ascending: false }).limit(1)
        // Removed direct walk-in fetch: supabase.from('check_ins').select('id, check_in_time, name').eq('type', 'walk-in')...
      ]);
      
      // --- Fetch Walk-in Data using RPC (like walk-ins/list.tsx) --- 
      const WALK_IN_SUMMARY_LIMIT = 50; // Limit for summary view
      const walkInSearchParams = {
          search_term: null,
          start_date: startTimeIso, // Use UTC based ISO
          end_date: endTimeIso,     // Use UTC based ISO
          page_limit: WALK_IN_SUMMARY_LIMIT,
          page_offset: 0, 
          filter_type: 'walk-in'
      };
      const walkInCountParams = { ...walkInSearchParams, page_limit: undefined, page_offset: undefined }; // Params for count RPC
      
      console.log("[Fetch Summary] Fetching walk-in count via RPC...");
      const { data: walkInTotalCount, error: walkInCountError } = await supabase.rpc('count_check_ins', walkInCountParams);
      console.log("[Fetch Summary] Fetching walk-in data via RPC...");
      const { data: walkInRpcData, error: walkInRpcError } = await supabase.rpc('search_check_ins', walkInSearchParams);

      // Check for errors (including new RPC calls)
      if (paymentsRes.error) throw paymentsRes.error;
      if (checkInsRes.error) throw checkInsRes.error;
      if (newMembersRes.error) throw newMembersRes.error;
      if (graceAccessRes.error) throw graceAccessRes.error;
      if (shiftsTodayRes.error) throw shiftsTodayRes.error;
      if (lastShiftBeforeTodayRes.error) throw lastShiftBeforeTodayRes.error;
      if (walkInCountError) throw walkInCountError; // Check walk-in count error
      if (walkInRpcError) throw walkInRpcError; // Check walk-in data error

      // --- Fetch Active Shifts (Started within the period, not ended) ---
      const { data: activeShiftsRaw, error: activeShiftsError } = await supabase
        .from('shifts')
        .select('id, created_at, user_id, user:user_id(id, name, email)')
        .gte('created_at', startTimeIso)   // Started on or after period start
        .lte('created_at', endTimeIso)   // Started on or before period end
        .is('ended_at', null);          // And not ended

      if (activeShiftsError) {
        console.error("Error fetching active shifts:", activeShiftsError);
        throw activeShiftsError;
      }
      
      const allPaymentsForPeriod = paymentsRes.data || [];

      // --- Process Active Shifts ---
      const tempPendingBreakdowns: ActiveShiftDisplayData[] = [];
      if (activeShiftsRaw && activeShiftsRaw.length > 0) {
        for (const activeShift of activeShiftsRaw) {
          let cash = 0;
          let qr = 0;
          let bank = 0;
          let sales = 0;

          const relevantPayments = allPaymentsForPeriod.filter(p =>
            p.user_id === activeShift.user_id &&
            new Date(p.created_at) >= new Date(activeShift.created_at) 
            // No need to check p.created_at <= endTimeIso, as allPaymentsForPeriod is already filtered
          );

          relevantPayments.forEach(p => {
            sales += p.amount;
            if (p.payment_method === 'cash') cash += p.amount;
            if (p.payment_method === 'qr') qr += p.amount;
            if (p.payment_method === 'bank_transfer') bank += p.amount;
          });

          const userDetails = Array.isArray(activeShift.user) ? activeShift.user[0] : activeShift.user;

          if (sales > 0) {
            tempPendingBreakdowns.push({
              shiftId: activeShift.id,
              userId: activeShift.user_id,
              userName: userDetails?.name || userDetails?.email || 'Unknown User',
              startTime: activeShift.created_at,
              cashCollections: cash,
              qrCollections: qr,
              bankTransferCollections: bank,
              totalSales: sales,
            });
          }
        }
      }
      setPendingShiftBreakdowns(tempPendingBreakdowns);

      // --- Process Shifts and Intervals (for completed shifts) --- 
      const shiftsToday = shiftsTodayRes.data || [];
      const lastShiftBefore = lastShiftBeforeTodayRes.data?.[0];
      
      const intervals: { start: string; end: string; shiftData: any | null }[] = [];
      let lastEndTime = lastShiftBefore?.ended_at || startTimeIso;

      shiftsToday.forEach(shift => {
          intervals.push({ start: lastEndTime, end: shift.ended_at, shiftData: shift });
          lastEndTime = shift.ended_at;
      });
      // Only add the last interval if it is not in the future
      const now = new Date();
      if (new Date(lastEndTime) < endDateTime && new Date(lastEndTime) < now && new Date(endTimeIso) <= now) {
           intervals.push({ start: lastEndTime, end: endTimeIso, shiftData: null });
      }

      // If no intervals were created (no shifts for the day), add a single interval for the whole day
      if (intervals.length === 0) {
        intervals.push({ start: startTimeIso, end: endTimeIso, shiftData: null });
      }

      // --- Process Payments into Shift Breakdowns --- 
      const payments = paymentsRes.data || [];
      let tempShiftBreakdowns: ShiftBreakdown[] = intervals.map(interval => ({
          shiftId: interval.shiftData?.id || null,
          userId: interval.shiftData?.user_id || null,
          userName: interval.shiftData?.user?.name || interval.shiftData?.user?.email || (interval.shiftData ? 'Unknown User' : null), // Handle user possibly being null
          startTime: interval.start,
          endTime: interval.end,
          cashCollections: 0, qrCollections: 0, bankTransferCollections: 0, totalSales: 0
      }));

      payments.forEach((p, index) => {
        const paymentTime = new Date(p.created_at).toISOString();
        const intervalIndex = tempShiftBreakdowns.findIndex(interval => 
            paymentTime > interval.startTime && paymentTime <= interval.endTime
        );
        if (intervalIndex !== -1) {
          tempShiftBreakdowns[intervalIndex].totalSales += p.amount;
          if (p.payment_method === 'cash') tempShiftBreakdowns[intervalIndex].cashCollections += p.amount;
          if (p.payment_method === 'qr') tempShiftBreakdowns[intervalIndex].qrCollections += p.amount;
          if (p.payment_method === 'bank_transfer') tempShiftBreakdowns[intervalIndex].bankTransferCollections += p.amount;
        }
      });
      // Filter out intervals that are in the future
      const filteredShiftBreakdowns = tempShiftBreakdowns.filter(b => new Date(b.startTime) <= now);
      setShiftBreakdowns(filteredShiftBreakdowns);

      // --- Process Other Aggregations (Overall Summary) --- 
      let tempSummary: DailySummaryData = { /* Initialize */ 
         totalSales: 0, totalCheckIns: 0, memberCheckIns: 0, walkInCheckIns: 0,
         newMembers: 0, membershipRevenue: 0, walkInRevenue: 0, posRevenue: 0,
         couponRevenue: 0, gracePeriodSettlementFees: 0, cashCollections: 0, qrCollections: 0, 
         bankTransferCollections: 0, renewals: 0, posItemsSold: 0
      };
      payments.forEach((p, index) => {
        tempSummary.totalSales += p.amount;

        // Adjust revenue attribution for renewals
        if (p.type === 'renewal') {
          const renewalPlanPrice = p.details?.renewal_plan?.price || 0;
          const graceSettlementAmount = p.details?.grace_period_settlement?.amount || 0;

          tempSummary.membershipRevenue += renewalPlanPrice;
          tempSummary.gracePeriodSettlementFees += graceSettlementAmount;
          tempSummary.renewals += 1; // Count renewals

          // Fallback if details are missing or amounts are zero (for old data)
          if (!p.details || (renewalPlanPrice === 0 && graceSettlementAmount === 0)) {
            if (renewalPlanPrice === 0 && graceSettlementAmount === 0) {
              // If both are zero, and details might be missing, attribute full amount to membershipRevenue
              // but avoid double counting if it was already added via renewalPlanPrice.
              // This specific condition ensures it only adds if both are truly zero from details.
               tempSummary.membershipRevenue += p.amount; 
            }
          }
        } else if (p.type === 'registration') {
          tempSummary.membershipRevenue += p.amount; // Registrations contribute fully to membership revenue
        } else if (p.type === 'walk-in') {
          tempSummary.walkInRevenue += p.amount;
        } else if (p.type === 'pos') {
          tempSummary.posRevenue += p.amount;
        } else if (p.type === 'coupon') {
          tempSummary.couponRevenue += p.amount;
        }

        // Payment method collections (remains the same)
        if (p.payment_method === 'cash') tempSummary.cashCollections += p.amount;
        if (p.payment_method === 'qr') tempSummary.qrCollections += p.amount;
        if (p.payment_method === 'bank_transfer') tempSummary.bankTransferCollections += p.amount;
      });
      
      // Process Check-ins (Total count remains)
      tempSummary.totalCheckIns = checkInsRes.count || 0;
      // const checkIns = checkInsRes.data || []; // We don't need the full checkin list here anymore
      // tempSummary.memberCheckIns = checkIns.filter(c => c.type === 'member').length; // Calculate later
      // tempSummary.walkInCheckIns = checkIns.filter(c => c.type === 'walk-in').length; // Calculate later

      // Process Walk-ins from RPC data
      const fetchedWalkIns = (walkInRpcData as any[] || []).map(item => ({
        id: item.id,
        name: item.name || 'N/A', // Match expected structure
        check_in_time: item.check_in_time
      }));
      setWalkIns(fetchedWalkIns);
      tempSummary.walkInCheckIns = walkInTotalCount || 0; // Use count from RPC
      
      // Calculate member check-ins based on total and RPC walk-in count
      tempSummary.memberCheckIns = Math.max(0, tempSummary.totalCheckIns - tempSummary.walkInCheckIns); 
      
      // Process New Members
      tempSummary.newMembers = newMembersRes.count || 0;
      setNewlyRegistered((newMembersRes.data as NewlyRegisteredMember[]) || []);

      // Process Grace Period Access
      const graceData = (graceAccessRes.data || []).map(g => ({ ...g, member_name: g.member?.name }));
      setGracePeriodEntries(graceData);

      console.log("[Fetch Summary] Final Calculated tempSummary:", JSON.stringify(tempSummary)); 
      setSummaryData(tempSummary); 

    } catch (error: any) {
      console.error("Error fetching daily summary:", error);
      toast.error(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (offset: number) => {
    const currentDate = new Date(startDate + 'T00:00:00'); // Ensure correct parsing
    const newDate = offset === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1);
    setStartDate(format(newDate, 'yyyy-MM-dd'));
  };

  const isNextDayDisabled = () => {
    const currentDate = new Date(startDate + 'T00:00:00'); 
    const nextDate = addDays(currentDate, 1);
    return isFuture(nextDate);
  };

  const formatTime = (isoString: string) => {
     const targetTimeZone = 'Asia/Singapore'; // Or Asia/Kuala_Lumpur, etc.
     try { 
       // Directly format the UTC input string into the target timezone
       return formatInTimeZone(isoString, targetTimeZone, 'hh:mm a');
     } 
     catch(e) { 
       console.error(`[formatTime] Error formatting date: ${isoString}`, e);
       return 'Invalid Time'; 
     }
  }
  const formatDate = (isoString: string) => {
     try { return formatInTimeZone(isoString, 'Asia/Singapore', 'dd MMM yy'); } 
     catch { return 'Invalid Date'; }
  }
  const formatCurrency = (amount: number) => `RM ${amount.toFixed(2)}`;

  // Pagination calculations
  const totalNewMembersPages = Math.ceil(newlyRegistered.length / PAGE_SIZE);
  const paginatedNewMembers = newlyRegistered.slice((newMembersPage - 1) * PAGE_SIZE, newMembersPage * PAGE_SIZE);

  const totalGracePeriodPages = Math.ceil(gracePeriodEntries.length / PAGE_SIZE);
  const paginatedGracePeriodEntries = gracePeriodEntries.slice((gracePeriodPage - 1) * PAGE_SIZE, gracePeriodPage * PAGE_SIZE);

  const totalWalkInPages = Math.ceil(walkIns.length / PAGE_SIZE); // Calculate total walk-in pages
  const paginatedWalkIns = walkIns.slice((walkInPage - 1) * PAGE_SIZE, walkInPage * PAGE_SIZE); // Slice walk-in data

  // Page change handlers
  const handleNewMembersPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalNewMembersPages) {
      setNewMembersPage(newPage);
    }
  };

  const handleGracePeriodPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalGracePeriodPages) {
      setGracePeriodPage(newPage);
    }
  };

  // Handler for walk-in page changes
  const handleWalkInPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalWalkInPages) {
      setWalkInPage(newPage);
    }
  };

  const handleReset = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
    setStartTime('00:00');
    setEndTime('23:59');
  };

  return (
    <div className="space-y-6 pb-8"> {/* Added padding bottom */} 
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap flex-1 h-16 sm:h-16"><Receipt className="h-7 w-7 text-orange-500" /> Daily Summary</h1>
        {/* Date Range and Time Range Selector with Today & Reset Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 bg-white rounded-lg shadow px-2 sm:px-4 py-2 sm:py-0 mb-6 min-w-0 overflow-x-auto w-full sm:w-auto sm:ml-auto flex-shrink-0 h-16 sm:h-16">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                setStartDate(today);
                setEndDate(today);
                setStartTime('00:00');
                setEndTime('23:59');
              }}
              className="h-9 px-4 font-semibold w-full sm:w-auto"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-9 px-4 font-semibold text-gray-500 border border-gray-200 hover:bg-gray-100 w-full sm:w-auto"
            >
              Reset
            </Button>
          </div>
          {/* Start Date & Time */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Calendar className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-6 h-9 text-sm w-full sm:w-36"
                max={endDate}
              />
            </div>
            <Input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="pl-3 h-9 text-sm w-full sm:w-28"
            />
          </div>
          {/* To */}
          <span className="mx-2 text-gray-400 font-medium hidden sm:inline">to</span>
          {/* End Date & Time */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Calendar className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-6 h-9 text-sm w-full sm:w-36"
                min={startDate}
                max={todayStr}
              />
            </div>
            <Input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="pl-3 h-9 text-sm w-full sm:w-28"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : !summaryData ? (
         <div className="flex flex-col items-center justify-center bg-white rounded-lg shadow p-8 my-8">
           <Smile className="h-10 w-10 text-gray-300 mb-2" />
           <div className="text-lg font-semibold text-gray-500 mb-1">Could not load summary data for the selected date.</div>
           <div className="text-sm text-gray-400">Try changing the date range or filters above.</div>
         </div>
      ) : (
        <div className="space-y-8">
        
          {/* KPIs Section with Icons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow text-base sm:text-lg">
                <div className="flex items-center text-sm text-gray-500">
                    <Banknote className="h-4 w-4 mr-2"/> Total Sales
                </div>
                <div className="text-2xl font-bold mt-1">{formatCurrency(summaryData.totalSales)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow text-base sm:text-lg">
                <div className="flex items-center text-sm text-gray-500">
                    <TrendingUp className="h-4 w-4 mr-2"/> Total Check-ins
                </div>
                <div className="text-2xl font-bold mt-1">{summaryData.totalCheckIns}</div>
                <div className="text-xs text-gray-600">({summaryData.memberCheckIns} Members / {summaryData.walkInCheckIns} Walk-ins)</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow text-base sm:text-lg">
                <div className="flex items-center text-sm text-gray-500">
                    <UserPlus className="h-4 w-4 mr-2"/> New Members
                </div>
                <div className="text-2xl font-bold mt-1">{summaryData.newMembers}</div>
            </div>
          </div>

          {/* Quick Lists - Now 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Changed to md:grid-cols-3 */}
          
            {/* Newly Registered */}
            <div className="bg-white p-4 rounded-lg shadow flex flex-col text-sm sm:text-base">
              <h3 className="text-base font-semibold mb-3 flex items-center">
                <Users className="h-5 w-5 mr-2 text-green-600" /> Newly Registered Members ({newlyRegistered.length})
              </h3>
              {newlyRegistered.length === 0 ? (
                <p className="text-sm text-gray-500 flex-grow">No new members registered on this day.</p>
              ) : (
                <>
                <ul className="space-y-2 flex-grow text-sm min-h-[150px] overflow-x-auto"> {/* Added overflow-x-auto */} 
                  {paginatedNewMembers.map(member => (
                    <li key={member.id} className="flex items-center space-x-3 py-1.5 border-b border-gray-100 last:border-b-0">
                       {/* Member Photo/Placeholder */} 
                       {member.photo_url ? (
                            <img 
                                src={member.photo_url} 
                                alt={member.name || 'Member'} 
                                className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                            />
                       ) : (
                            <UserCircle className="h-8 w-8 text-gray-400 flex-shrink-0" />
                       )}
                       {/* Member Info */}
                       <div className="flex-grow min-w-0">
                            <Link to={`/members/${member.id}`} className="font-medium hover:text-orange-600 truncate block">
                                {member.name || 'N/A'}
                            </Link>
                            <div className="text-xs text-gray-500 truncate">ID: {member.member_id}</div>
                       </div>
                       {/* Member Phone */}
                       <span className="text-gray-500 text-xs flex-shrink-0">{member.phone || 'No phone'}</span>
                    </li>
                  ))}
                </ul>
                {/* Pagination Controls for Newly Registered */} 
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-3 mt-2 border-t border-gray-100 text-xs gap-2">
                    <Button 
                        variant="outline" size="sm"
                        onClick={() => handleNewMembersPageChange(newMembersPage - 1)} 
                        disabled={newMembersPage === 1}
                        className="px-2 py-2 w-full sm:w-auto"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <span className="text-center w-full sm:w-auto">Page {newMembersPage} of {totalNewMembersPages}</span>
                    <Button 
                        variant="outline" size="sm"
                        onClick={() => handleNewMembersPageChange(newMembersPage + 1)} 
                        disabled={newMembersPage === totalNewMembersPages}
                        className="px-2 py-2 w-full sm:w-auto"
                    >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
                </>
              )}
            </div>

            {/* Grace Period Access */}
            <div className="bg-white p-4 rounded-lg shadow flex flex-col text-sm sm:text-base">
              <h3 className="text-base font-semibold mb-3 flex items-center">
                <UserCheck className="h-5 w-5 mr-2 text-blue-600" /> Grace Period Access ({gracePeriodEntries.length})
              </h3>
              {gracePeriodEntries.length === 0 ? (
                <p className="text-sm text-gray-500 flex-grow">No grace period access recorded.</p>
              ) : (
                <>
                <ul className="space-y-2 flex-grow text-sm min-h-[150px] overflow-x-auto"> {/* Added overflow-x-auto */} 
                  {paginatedGracePeriodEntries.map(entry => (
                    <li key={entry.id} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-b-0">
                      <Link to={`/members/${entry.member_id}`} className="hover:text-orange-600 truncate mr-2">
                        {entry.member_name || 'Unknown Member'}
                      </Link>
                      <div className="text-right text-xs flex-shrink-0">
                        <span className="text-gray-500 block">Checked in: {formatTime(entry.check_in_time)}</span>
                        <span className="text-red-500 text-xs block">Expired: {formatDate(entry.expiry_date)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {/* Pagination Controls for Grace Period */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-3 mt-2 border-t border-gray-100 text-xs gap-2">
                    <Button 
                        variant="outline" size="sm"
                        onClick={() => handleGracePeriodPageChange(gracePeriodPage - 1)} 
                        disabled={gracePeriodPage === 1}
                        className="px-2 py-2 w-full sm:w-auto"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <span className="text-center w-full sm:w-auto">Page {gracePeriodPage} of {totalGracePeriodPages}</span>
                    <Button 
                        variant="outline" size="sm"
                        onClick={() => handleGracePeriodPageChange(gracePeriodPage + 1)} 
                        disabled={gracePeriodPage === totalGracePeriodPages}
                        className="px-2 py-2 w-full sm:w-auto"
                    >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
                </>
              )}
            </div>
            
            {/* Walk-Ins */} 
            <div className="bg-white p-4 rounded-lg shadow flex flex-col text-sm sm:text-base">
              <h3 className="text-base font-semibold mb-3 flex items-center">
                <Ticket className="h-5 w-5 mr-2 text-purple-600" /> Walk-Ins ({summaryData.walkInCheckIns}) 
              </h3>
              {walkIns.length === 0 ? (
                <p className="text-sm text-gray-500 flex-grow">No walk-ins recorded on this day.</p>
              ) : (
                <>
                <ul className="space-y-2 flex-grow text-sm min-h-[150px] overflow-x-auto"> {/* Added overflow-x-auto */} 
                  {paginatedWalkIns.map(entry => (
                    <li key={entry.id} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-b-0">
                       {/* Display Customer Name or Fallback */}
                       <span className="font-medium truncate mr-2">{entry.name || 'Walk-In'}</span>
                       {/* Display Check-in Time */}
                       <span className="text-gray-500 text-xs flex-shrink-0">{formatTime(entry.check_in_time)}</span>
                    </li>
                  ))}
                </ul>
                {/* Pagination Controls for Walk-ins */} 
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-3 mt-2 border-t border-gray-100 text-xs gap-2">
                    <Button 
                        variant="outline" size="sm"
                        onClick={() => handleWalkInPageChange(walkInPage - 1)} 
                        disabled={walkInPage === 1}
                        className="px-2 py-2 w-full sm:w-auto"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <span className="text-center w-full sm:w-auto">Page {walkInPage} of {totalWalkInPages}</span>
                    <Button 
                        variant="outline" size="sm"
                        onClick={() => handleWalkInPageChange(walkInPage + 1)} 
                        disabled={walkInPage === totalWalkInPages}
                        className="px-2 py-2 w-full sm:w-auto"
                    >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
                </>
              )}
            </div>

          </div>
          
          {/* Financial Summary - Shift Breakdown with Icons */}
          <div className="bg-white p-6 rounded-lg shadow">
             <h2 className="text-xl font-semibold mb-6 flex items-center text-gray-800">
                <Receipt className="h-6 w-6 mr-3 text-orange-600"/> Shift Summary (Completed)
             </h2>
             {shiftBreakdowns.length === 0 && pendingShiftBreakdowns.length === 0 ? (
                <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
                  <Smile className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  No shift data found for this day.
                </div>
             ) : null}

             {shiftBreakdowns.length > 0 && (
                <div className="space-y-8">
                   {shiftBreakdowns.map((shift, index) => (
                      <div key={shift.shiftId || `interval-${index}`} className="bg-white rounded-lg shadow-lg overflow-hidden">
                         <div className="p-5 bg-gray-50 border-b border-gray-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                              <h3 className="font-semibold text-lg text-gray-700 flex items-center mb-2 sm:mb-0">
                                <Users className="inline h-5 w-5 mr-2 text-orange-500"/> 
                                {shift.userName || (shift.userId ? 'Unknown User' : 'System (Before First Shift)')} 
                              </h3>
                              <div className="text-xs text-gray-500 flex items-center">
                                 <Clock className="inline h-4 w-4 mr-1.5 text-gray-400"/> 
                                 {`${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`}
                                 {formatDate(shift.startTime) !== formatDate(shift.endTime) ? ` (${formatDate(shift.endTime)})` : ` (${formatDate(shift.startTime)})`}
                              </div>
                            </div>
                         </div>
                         
                         <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {/* Collections Section */}
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm uppercase text-gray-500 tracking-wider flex items-center pb-1 border-b border-gray-200">
                                 <Wallet className="h-4 w-4 mr-2 text-gray-400"/> Collections
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-gray-600"><Coins className="h-4 w-4 mr-2 text-yellow-500"/>Cash:</span> 
                                  <span className="font-medium text-gray-700">{formatCurrency(shift.cashCollections)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-gray-600"><QrCode className="h-4 w-4 mr-2 text-blue-500"/>QR Code:</span> 
                                  <span className="font-medium text-gray-700">{formatCurrency(shift.qrCollections)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-gray-600"><Landmark className="h-4 w-4 mr-2 text-purple-500"/>Bank Transfer:</span> 
                                  <span className="font-medium text-gray-700">{formatCurrency(shift.bankTransferCollections)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Sales Section */}
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm uppercase text-gray-500 tracking-wider flex items-center pb-1 border-b border-gray-200">
                                 <TrendingUp className="h-4 w-4 mr-2 text-gray-400"/> Sales
                              </h4>
                               <div className="flex justify-between items-center text-sm">
                                 <span className="text-gray-600">Total Sales:</span> 
                                 <span className="font-semibold text-lg text-orange-600">{formatCurrency(shift.totalSales)}</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             )}

             {/* Pending Shift Breakdowns */}
             {pendingShiftBreakdowns.length > 0 && (
               <>
                 <h2 className="text-xl font-semibold mt-10 mb-6 flex items-center text-yellow-700">
                   <Clock className="h-6 w-6 mr-3"/> Active Shifts (Collections Pending)
                 </h2>
                 <div className="space-y-8">
                   {pendingShiftBreakdowns.map((shift, index) => (
                     <div key={shift.shiftId || `pending-${index}`} className="bg-yellow-50 rounded-lg shadow-lg overflow-hidden border-2 border-yellow-400">
                       <div className="p-5 bg-yellow-100 border-b border-yellow-300">
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                           <h3 className="font-semibold text-lg text-yellow-800 flex items-center mb-2 sm:mb-0">
                             <Users className="inline h-5 w-5 mr-2 text-yellow-700"/> 
                             {shift.userName || 'Unknown User'} 
                           </h3>
                           <div className="text-xs text-yellow-700 flex items-center">
                             <Clock className="inline h-4 w-4 mr-1.5 text-yellow-600"/> 
                             {`${formatTime(shift.startTime)} - Ongoing (${formatDate(shift.startTime)})`}
                           </div>
                         </div>
                       </div>
                       <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                         {/* Collections Section */}
                         <div className="space-y-3">
                           <h4 className="font-medium text-sm uppercase text-yellow-600 tracking-wider flex items-center pb-1 border-b border-yellow-200">
                             <Wallet className="h-4 w-4 mr-2 text-yellow-500"/> Current Collections
                           </h4>
                           <div className="space-y-2 text-sm">
                             <div className="flex justify-between items-center">
                               <span className="flex items-center text-yellow-700"><Coins className="h-4 w-4 mr-2 text-yellow-600"/>Cash:</span> 
                               <span className="font-medium text-yellow-800">{formatCurrency(shift.cashCollections)}</span>
                             </div>
                             <div className="flex justify-between items-center">
                               <span className="flex items-center text-yellow-700"><QrCode className="h-4 w-4 mr-2 text-sky-600"/>QR Code:</span> 
                               <span className="font-medium text-yellow-800">{formatCurrency(shift.qrCollections)}</span>
                             </div>
                             <div className="flex justify-between items-center">
                               <span className="flex items-center text-yellow-700"><Landmark className="h-4 w-4 mr-2 text-purple-600"/>Bank Transfer:</span> 
                               <span className="font-medium text-yellow-800">{formatCurrency(shift.bankTransferCollections)}</span>
                             </div>
                           </div>
                         </div>
                         {/* Sales Section */}
                         <div className="space-y-3">
                           <h4 className="font-medium text-sm uppercase text-yellow-600 tracking-wider flex items-center pb-1 border-b border-yellow-200">
                             <TrendingUp className="h-4 w-4 mr-2 text-yellow-500"/> Current Sales
                           </h4>
                           <div className="flex justify-between items-center text-sm">
                             <span className="text-yellow-700">Total Sales:</span> 
                             <span className="font-semibold text-lg text-yellow-700">{formatCurrency(shift.totalSales)}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </>
             )}
             
             {/* Overall Daily Totals with Icons */} 
             <div className="bg-white p-6 rounded-lg shadow-lg mt-10"> {/* Added mt-10 for spacing from shift summaries */}
                 <h3 className="text-xl font-semibold mb-6 text-gray-800 flex items-center">
                   <List className="h-6 w-6 mr-3 text-orange-600" />
                   Overall Daily Totals
                 </h3>
                 
                 <div className="mb-6 pb-4 border-b border-gray-200">
                    <span className="text-sm text-gray-500">Total Sales</span>
                    <div className="text-3xl font-bold text-orange-600 mt-1">{formatCurrency(summaryData.totalSales)}</div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                     {/* Revenue Breakdown */}
                     <div className="space-y-3">
                         <h4 className="font-medium text-sm uppercase text-gray-500 tracking-wider mb-3 pb-1 border-b border-gray-200">Revenue Breakdown:</h4>
                         <div className="space-y-2 text-sm">
                             {[
                                 { icon: UserCircle, color: "text-blue-500", label: "Membership Plan Fees:", value: summaryData.membershipRevenue },
                                 { icon: Wallet, color: "text-teal-500", label: "Grace Period Fees:", value: summaryData.gracePeriodSettlementFees },
                                 { icon: Ticket, color: "text-indigo-500", label: "Walk-In Fees:", value: summaryData.walkInRevenue },
                                 { icon: ShoppingCart, color: "text-purple-500", label: "POS Revenue:", value: summaryData.posRevenue },
                                 { icon: Gift, color: "text-pink-500", label: "Coupon Revenue:", value: summaryData.couponRevenue }
                             ].map((item, idx) => (
                                 <div key={idx} className="flex justify-between items-center">
                                     <span className="flex items-center text-gray-600">
                                         <item.icon className={`h-4 w-4 mr-2 ${item.color}`} />
                                         {item.label}
                                     </span>
                                     <span className="font-medium text-gray-700">{formatCurrency(item.value)}</span>
                                 </div>
                             ))}
                         </div>
                     </div>

                     {/* Collection Method Breakdown */}
                     <div className="space-y-3">
                         <h4 className="font-medium text-sm uppercase text-gray-500 tracking-wider mb-3 pb-1 border-b border-gray-200">Collection Methods:</h4>
                         <div className="space-y-2 text-sm">
                             {[
                                 { icon: Coins, color: "text-yellow-500", label: "Cash:", value: summaryData.cashCollections },
                                 { icon: QrCode, color: "text-sky-500", label: "QR Code:", value: summaryData.qrCollections },
                                 { icon: Landmark, color: "text-green-500", label: "Bank Transfer:", value: summaryData.bankTransferCollections }
                             ].map((item, idx) => (
                                 <div key={idx} className="flex justify-between items-center">
                                     <span className="flex items-center text-gray-600">
                                         <item.icon className={`h-4 w-4 mr-2 ${item.color}`} />
                                         {item.label}
                                     </span>
                                     <span className="font-medium text-gray-700">{formatCurrency(item.value)}</span>
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
             </div>
           </div> {/* Closing div for "space-y-8" wrapping KPIs and Summaries */}
          </div>
      )}
    </div>
  );
}
