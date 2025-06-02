import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Download, Calendar } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/utils';
import toast from 'react-hot-toast';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'custom';

interface AttendanceData {
  date: string;
  members: number;
  walkIns: number;
  total: number;
}

export default function AttendanceReport() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('daily');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);

  useEffect(() => {
    updateDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    fetchAttendanceData();
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
      // For custom range, don't update dates automatically
    }
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select('check_in_time, type')
        .gte('check_in_time', `${startDate}T00:00:00`)
        .lte('check_in_time', `${endDate}T23:59:59`)
        .order('check_in_time');

      if (error) throw error;

      // Group check-ins by date
      const groupedData = checkIns.reduce((acc: { [key: string]: AttendanceData }, checkIn) => {
        const date = format(new Date(checkIn.check_in_time), 'yyyy-MM-dd');
        
        if (!acc[date]) {
          acc[date] = {
            date,
            members: 0,
            walkIns: 0,
            total: 0
          };
        }

        if (checkIn.type === 'member') {
          acc[date].members++;
        } else {
          acc[date].walkIns++;
        }
        acc[date].total++;

        return acc;
      }, {});

      setAttendanceData(Object.values(groupedData));
    } catch (error) {
      toast.error('Error fetching attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const exportData = attendanceData.map(data => ({
      'Date': format(new Date(data.date), 'dd MMM yyyy'),
      'Members': data.members,
      'Walk-ins': data.walkIns,
      'Total': data.total
    }));
    exportToCSV(exportData, `attendance-${dateRange}-${startDate}-${endDate}.csv`);
  };

  return (
    <div className="space-y-6">
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
            <table className="min-w-full divide-y divide-gray-200 text-sm sm:text-base">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Walk-ins
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceData.map((data) => (
                  <tr key={data.date}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(data.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.members}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.walkIns}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {data.total}
                    </td>
                  </tr>
                ))}
                {attendanceData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      No attendance data found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
              {attendanceData.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {attendanceData.reduce((sum, data) => sum + data.members, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {attendanceData.reduce((sum, data) => sum + data.walkIns, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {attendanceData.reduce((sum, data) => sum + data.total, 0)}
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