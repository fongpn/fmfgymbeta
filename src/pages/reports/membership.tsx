import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { Download, Users, TrendingUp, TrendingDown, Calendar, Smile, UserPlus, UserCheck, UserX, Bell, ChevronLeft, ChevronRight, BarChartHorizontalBig } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/utils';
import toast from 'react-hot-toast';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'custom';
type MembershipType = 'adult' | 'youth';
type MembershipStatus = 'active' | 'grace' | 'expired' | 'suspended';

interface MembershipData {
  date: string;
  newMembers: {
    adult: number;
    youth: number;
    total: number;
  };
  renewals: {
    adult: number;
    youth: number;
    total: number;
  };
  statusDistribution: {
    active: number;
    grace: number;
    expired: number;
    suspended: number;
  };
}

export default function MembershipReport() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('daily');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [membershipData, setMembershipData] = useState<MembershipData[]>([]);
  const [currentStats, setCurrentStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    expiringNext30Days: 0
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    updateDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    fetchMembershipData();
    fetchCurrentStats();
  }, [startDate, endDate]);

  const updateDateRange = (range: DateRange) => {
    const today = new Date();
    
    switch (range) {
      case 'daily':
        setStartDate(format(startOfDay(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfDay(today), 'yyyy-MM-dd'));
        break;
      case 'weekly':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'monthly':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
    }
  };

  const fetchMembershipData = async () => {
    setLoading(true);
    try {
      // Fetch new registrations
      const { data: registrations, error: registrationsError } = await supabase
        .from('members')
        .select('created_at, type')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      if (registrationsError) throw registrationsError;

      // Fetch renewals
      const { data: renewals, error: renewalsError } = await supabase
        .from('payments')
        .select('created_at, member_id')
        .eq('type', 'renewal')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      if (renewalsError) throw renewalsError;

      // Group data by date
      const groupedData = registrations.reduce((acc: { [key: string]: MembershipData }, reg) => {
        const date = format(new Date(reg.created_at), 'yyyy-MM-dd');
        
        if (!acc[date]) {
          acc[date] = {
            date,
            newMembers: {
              adult: 0,
              youth: 0,
              total: 0
            },
            renewals: {
              adult: 0,
              youth: 0,
              total: 0
            },
            statusDistribution: {
              active: 0,
              grace: 0,
              expired: 0,
              suspended: 0
            }
          };
        }

        if (reg.type === 'adult' || reg.type === 'youth') {
          acc[date].newMembers[reg.type as 'adult' | 'youth']++;
        }
        acc[date].newMembers.total++;

        return acc;
      }, {});

      // Add renewals data
      renewals.forEach(renewal => {
        const date = format(new Date( renewal.created_at), 'yyyy-MM-dd');
        if (groupedData[date]) {
          groupedData[date].renewals.total++;
        }
      });

      setMembershipData(Object.values(groupedData));
    } catch (error) {
      toast.error('Error fetching membership data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentStats = async () => {
    try {
      // Get total members
      const { count: totalCount } = await supabase
        .from('members')
        .select('*', { count: 'exact' });

      // Get active members
      const { count: activeCount } = await supabase
        .from('members')
        .select('*', { count: 'exact' })
        .eq('status', 'active');

      // Get members expiring in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { count: expiringCount } = await supabase
        .from('members')
        .select('*', { count: 'exact' })
        .eq('status', 'active')
        .lte('expiry_date', thirtyDaysFromNow.toISOString())
        .gte('expiry_date', new Date().toISOString());

      setCurrentStats({
        totalMembers: totalCount || 0,
        activeMembers: activeCount || 0,
        expiringNext30Days: expiringCount || 0
      });
    } catch (error) {
      toast.error('Error fetching current statistics');
    }
  };

  const handleReset = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
    setDateRange('daily');
  };

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const exportData = membershipData.map(data => ({
        'Date': format(new Date(data.date), 'dd MMM yyyy'),
        'New Adult Members': data.newMembers.adult,
        'New Youth Members': data.newMembers.youth,
        'Total New Members': data.newMembers.total,
        'Renewals': data.renewals.total
      }));
      exportToCSV(exportData, `membership-${dateRange}-${startDate}-${endDate}.csv`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Users className="h-7 w-7 mr-3 text-orange-600" /> Membership Report
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value as DateRange);
              if (e.target.value !== 'custom') {
                updateDateRange(e.target.value as DateRange);
              }
            }}
            className="h-9 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm w-36 border-gray-300"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-sm w-36 border-gray-300"
                min={startDate}
              />
            </>
          )}
          {/* Added Daily Navigation Buttons */}
          {dateRange === 'daily' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const newDate = format(subDays(new Date(startDate), 1), 'yyyy-MM-dd');
                setStartDate(newDate);
                setEndDate(newDate);
              }} className="h-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={startDate} // For daily, startDate and endDate are the same
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(e.target.value);
                }}
                className="h-9 text-sm w-36 border-gray-300"
              />
              <Button variant="outline" size="sm" onClick={() => {
                const newDate = format(addDays(new Date(startDate), 1), 'yyyy-MM-dd');
                setStartDate(newDate);
                setEndDate(newDate);
              }} className="h-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={handleReset} className="h-9 px-4 text-sm text-gray-600 hover:bg-gray-100 border border-gray-300">
            Reset
          </Button>
          <Button onClick={handleExportCSV} disabled={exporting || loading || membershipData.length === 0} className="h-9 px-4 text-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Current Overall Statistics Card */}
      <div className="bg-white rounded-xl shadow-lg p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
          <BarChartHorizontalBig className="h-6 w-6 mr-3 text-indigo-600" /> Current Snapshot
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg shadow-sm text-center">
            <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-700">{currentStats.totalMembers}</p>
            <p className="text-sm text-blue-600">Total Members</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow-sm text-center">
            <UserCheck className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-700">{currentStats.activeMembers}</p>
            <p className="text-sm text-green-600">Active Members</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow-sm text-center">
            <Bell className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-700">{currentStats.expiringNext30Days}</p>
            <p className="text-sm text-red-600">Expiring Soon (30 Days)</p>
          </div>
        </div>
      </div>

      {/* Main Content Area for Dated Membership Data */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <TrendingUp className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : membershipData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Smile className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-600">No membership activity found for this period.</p>
          <p className="text-sm text-gray-500">Try adjusting the date filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {membershipData.map(data => (
            <div key={data.date} className="bg-white rounded-xl shadow-xl overflow-hidden transition-all hover:shadow-2xl">
              <div className="p-5 sm:p-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white">
                <h2 className="text-xl sm:text-2xl font-semibold flex items-center">
                  <Calendar className="h-6 w-6 mr-3" />
                  Activity for: {format(new Date(data.date + 'T00:00:00'), 'EEEE, dd MMM yyyy')}
                </h2>
              </div>
              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* New Members Section */}
                <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                    <UserPlus className="h-5 w-5 mr-2 text-green-600" /> New Members: {data.newMembers.total}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Adult:</span>
                      <span className="font-medium text-gray-800">{data.newMembers.adult}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Youth:</span>
                      <span className="font-medium text-gray-800">{data.newMembers.youth}</span>
                    </div>
                  </div>
                </div>

                {/* Renewals Section */}
                <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                    <UserCheck className="h-5 w-5 mr-2 text-blue-600" /> Renewals: {data.renewals.total}
                  </h3>
                  {/* Placeholder if more renewal details were needed */}
                   <p className="text-sm text-gray-600">Total members who renewed their plans.</p>
                </div>
              </div>
              {/* Status Distribution - Placeholder if data becomes available */}
              {/* data.statusDistribution && (Object.values(data.statusDistribution).some(v => v > 0)) && (
                <div className="p-5 sm:p-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">Status Distribution (End of Day)</h3>
                   <p className="text-sm text-gray-500">Detailed status breakdown not yet implemented for daily view.</p> 
                </div>
              )*/}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}