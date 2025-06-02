import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Download, Calendar, Smile, Users, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/utils';
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
  const [exporting, setExporting] = useState(false);

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
        .select('*')
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

  const handleReset = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
    setDateRange('daily');
  };

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const exportData = attendanceData.map(data => ({
        'Date': formatDate(data.date),
        'Members': data.members,
        'Walk-ins': data.walkIns,
        'Total': data.total
      }));
      exportToCSV(exportData, `attendance-${dateRange}-${startDate}-${endDate}.csv`);
    } finally {
      setExporting(false);
    }
  };

  // For display, use toGMT8 or formatInTimeZone for all user-facing date/time formatting
  const formatDate = (isoString: string) => {
    try { return formatInTimeZone(isoString, 'Asia/Singapore', 'dd MMM yy'); }
    catch { return 'Invalid Date'; }
  }

  const updateDateRangeHelper = (offset: number) => {
    // Use the current startDate as the base for offsetting
    const currentBaseDate = new Date(startDate + 'T00:00:00'); // Ensure parsing as local time
    let newDate;
    if (offset > 0) {
      newDate = addDays(currentBaseDate, offset);
    } else {
      newDate = subDays(currentBaseDate, Math.abs(offset));
    }
    setStartDate(format(newDate, 'yyyy-MM-dd'));
    setEndDate(format(newDate, 'yyyy-MM-dd')); // For daily view, start and end are the same
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Users className="h-7 w-7 mr-3 text-orange-600" /> Attendance Report
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
          {dateRange === 'daily' && (
            <div className="flex items-center gap-2">
              {/* Add Prev/Next Day buttons here if desired for daily view specifically */}
              <Button variant="outline" size="sm" onClick={() => updateDateRangeHelper(-1)} className="h-9">
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
              <Button variant="outline" size="sm" onClick={() => updateDateRangeHelper(1)} className="h-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div> 
          )}
          <Button variant="ghost" onClick={handleReset} className="h-9 px-4 text-sm text-gray-600 hover:bg-gray-100 border border-gray-300">
            Reset
          </Button>
          <Button onClick={handleExportCSV} disabled={exporting || loading || attendanceData.length === 0} className="h-9 px-4 text-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-600" /> {/* Consistent Loading Icon */}
        </div>
      ) : attendanceData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" /> {/* Themed Icon */}
          <p className="text-lg font-semibold text-gray-600">No attendance data found.</p>
          <p className="text-sm text-gray-500">Try adjusting the date filters or check back later.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700">Attendance Breakdown</h3>
            <p className="text-sm text-gray-500">
              {startDate && endDate ? 
                `Displaying data from ${formatDate(startDate)} to ${formatDate(endDate)}.`:
                'Select a date range.'
              }
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Members</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Walk-ins</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceData.map((data, index) => (
                  <tr key={data.date} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50 hover:bg-slate-100'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{formatDate(data.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{data.members}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{data.walkIns}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600 text-right">{data.total}</td>
                  </tr>
                ))}
              </tbody>
              {attendanceData.length > 0 && (
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700 uppercase">Grand Total</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700 text-right">{attendanceData.reduce((sum, data) => sum + data.members, 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700 text-right">{attendanceData.reduce((sum, data) => sum + data.walkIns, 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-700 text-right">{attendanceData.reduce((sum, data) => sum + data.total, 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}