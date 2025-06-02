```typescript
import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export type DateRange = 'daily' | 'weekly' | 'monthly' | 'custom';

export function useDateRange(initialRange: DateRange = 'daily') {
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    updateDateRange(dateRange);
  }, [dateRange]);

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

  return {
    dateRange,
    setDateRange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    updateDateRange
  };
}
```