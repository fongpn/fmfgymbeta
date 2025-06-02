```tsx
import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'custom';

interface DateRangePickerProps {
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  onDateRangeChange: (range: DateRange) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function DateRangePicker({
  dateRange,
  startDate,
  endDate,
  onDateRangeChange,
  onStartDateChange,
  onEndDateChange
}: DateRangePickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex space-x-4">
        <Button
          variant={dateRange === 'daily' ? 'default' : 'outline'}
          onClick={() => onDateRangeChange('daily')}
        >
          Daily
        </Button>
        <Button
          variant={dateRange === 'weekly' ? 'default' : 'outline'}
          onClick={() => onDateRangeChange('weekly')}
        >
          Weekly
        </Button>
        <Button
          variant={dateRange === 'monthly' ? 'default' : 'outline'}
          onClick={() => onDateRangeChange('monthly')}
        >
          Monthly
        </Button>
        <Button
          variant={dateRange === 'custom' ? 'default' : 'outline'}
          onClick={() => onDateRangeChange('custom')}
        >
          Custom
        </Button>
      </div>

      {dateRange === 'custom' && (
        <div className="flex space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```