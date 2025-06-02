import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Download, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/utils';
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

        acc[date].newMembers[reg.type as 'adult' | 'youth']++;
        acc[date].newMembers.total++;

        return acc;
      }, {});

      // Add renewals data
      renewals.forEach(renewal => {
        const date = format(new Date(renewal.created_at), 'yyyy-MM-dd');
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
        .select('id', { count: 'exact' });

      // Get active members
      const { count: activeCount } = await supabase
        .from('members')
        .select('id', { count: 'exact' })
        .eq('status', 'active');

      // Get members expiring in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { count: expiringCount } = await supabase
        .from('members')
        .select('id', { count: 'exact' })
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

  const handleExportCSV = () => {
    const exportData = membershipData.map(data => ({
      'Date': format(new Date(data.date), 'dd MMM yyyy'),
      'New Adult Members': data.newMembers.adult,
      'New Youth Members': data.newMembers.youth,
      'Total New Members': data.newMembers.total,
      'Renewals': data.renewals.total
    }));
    exportToCSV(exportData, `membership-${dateRange}-${startDate}-${endDate}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base sm:text-lg">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Members</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {currentStats.totalMembers}
          </p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <Users className="mr-2 h-4 w-4" />
            <span>Currently registered</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Members</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {currentStats.activeMembers}
          </p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>{((currentStats.activeMembers / currentStats.totalMembers) * 100).toFixed(1)}% of total</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Expiring Soon</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {currentStats.expiringNext30Days}
          </p>
          <div className="mt-2 flex items-center text-sm text-yellow-600">
            <TrendingDown className="mr-2 h-4 w-4" />
            <span>Next 30 days</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 items-stretch sm:items-end justify-between mb-6 w-full">
          <div className="space-y-2 sm:space-y-4 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <Button
                variant={dateRange === 'daily' ? 'default' : 'outline'}
                onClick={() => setDateRange('daily')}
                className="w-full sm:w-auto"
              >
                Daily
              </Button>
              <Button
                variant={dateRange === 'weekly' ? 'default' : 'outline'}
                onClick={() => setDateRange('weekly')}
                className="w-full sm:w-auto"
              >
                Weekly
              </Button>
              <Button
                variant={dateRange === 'monthly' ? 'default' : 'outline'}
                onClick={() => setDateRange('monthly')}
                className="w-full sm:w-auto"
              >
                Monthly
              </Button>
              <Button
                variant={dateRange === 'custom' ? 'default' : 'outline'}
                onClick={() => setDateRange('custom')}
                className="w-full sm:w-auto"
              >
                Custom
              </Button>
            </div>

            {dateRange === 'custom' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="w-full sm:w-auto">
                  <label className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full sm:w-auto"
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <label className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full sm:w-auto"
                  />
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" onClick={handleExportCSV} className="w-full sm:w-auto mt-2 sm:mt-0">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New Adult Members
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New Youth Members
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total New Members
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Renewals
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {membershipData.map((data) => (
                  <tr key={data.date}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(data.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.newMembers.adult}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.newMembers.youth}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {data.newMembers.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.renewals.total}
                    </td>
                  </tr>
                ))}
                {membershipData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No membership data found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
              {membershipData.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {membershipData.reduce((sum, data) => sum + data.newMembers.adult, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {membershipData.reduce((sum, data) => sum + data.newMembers.youth, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {membershipData.reduce((sum, data) => sum + data.newMembers.total, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {membershipData.reduce((sum, data) => sum + data.renewals.total, 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}