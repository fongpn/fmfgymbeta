import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { Download, Package, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight, Calendar, Smile, CheckCircle, ShoppingCart, ListChecks, BarChart3 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { exportToCSV, toGMT8 } from '../../lib/utils';
import toast from 'react-hot-toast';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'custom';

interface SalesData {
  date: string;
  total_sales: number;
  total_items: number;
  products: {
    [key: string]: {
      quantity: number;
      revenue: number;
    };
  };
}

interface ProductStats {
  id: string;
  name: string;
  total_quantity: number;
  total_revenue: number;
  current_stock: number;
}

export default function SalesReport() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('daily');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [lowStockThreshold] = useState(10);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    updateDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    fetchSalesData();
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

  const handlePreviousDay = () => {
    const date = new Date(startDate);
    const newStartDate = format(subDays(date, 1), 'yyyy-MM-dd');
    setStartDate(newStartDate);
    setEndDate(newStartDate);
  };

  const handleNextDay = () => {
    const date = new Date(startDate);
    const newStartDate = format(addDays(date, 1), 'yyyy-MM-dd');
    setStartDate(newStartDate);
    setEndDate(newStartDate);
  };

  const handleReset = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
    setDateRange('daily');
  };

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      // Use UTC for filtering
      const startTime = new Date(startDate + 'T00:00:00Z');
      startTime.setUTCHours(0, 0, 0, 0);
      const endTime = new Date(endDate + 'T00:00:00Z');
      endTime.setUTCHours(23, 59, 59, 999);

      // Fetch POS sales using UTC
      const { data: sales, error: salesError } = await supabase
        .from('payments')
        .select('created_at, amount, items')
        .eq('type', 'pos')
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString());

      if (salesError) throw salesError;

      // Fetch current product data
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock');

      if (productsError) throw productsError;

      // Initialize data for each date in the range (in GMT+8)
      const groupedData: { [key: string]: SalesData } = {};
      let currentDate = new Date(startDate + 'T00:00:00Z');
      const endDateObj = new Date(endDate + 'T00:00:00Z');
      while (currentDate <= endDateObj) {
        const dateStr = format(toGMT8(currentDate), 'yyyy-MM-dd');
        groupedData[dateStr] = {
          date: dateStr,
          total_sales: 0,
          total_items: 0,
          products: {}
        };
        currentDate = addDays(currentDate, 1);
      }

      // Process sales data
      const productTotals: { [key: string]: ProductStats } = {};

      // Initialize product totals
      products.forEach(product => {
        productTotals[product.id] = {
          id: product.id,
          name: product.name,
          total_quantity: 0,
          total_revenue: 0,
          current_stock: product.stock
        };
      });

      // Process each sale
      sales?.forEach(sale => {
        const date = format(toGMT8(new Date(sale.created_at)), 'yyyy-MM-dd');
        
        if (groupedData[date]) {
          // Add sale amount
          groupedData[date].total_sales += sale.amount;

          // Process items in the sale
          if (sale.items) {
            sale.items.forEach((item: any) => {
              // Update daily sales
              if (!groupedData[date].products[item.product_name]) {
                groupedData[date].products[item.product_name] = {
                  quantity: 0,
                  revenue: 0
                };
              }
              groupedData[date].products[item.product_name].quantity += item.quantity;
              groupedData[date].products[item.product_name].revenue += item.price * item.quantity;
              groupedData[date].total_items += item.quantity;

              // Update product totals
              const product = products.find(p => p.name === item.product_name);
              if (product) {
                productTotals[product.id].total_quantity += item.quantity;
                productTotals[product.id].total_revenue += item.price * item.quantity;
              }
            });
          }
        }
      });

      setSalesData(Object.values(groupedData));
      setProductStats(Object.values(productTotals));
    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast.error('Error fetching sales data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const exportData = salesData.map(data => ({
        'Date': format(new Date(data.date), 'dd MMM yyyy'),
        'Total Items': data.total_items,
        'Total Sales': `RM ${data.total_sales.toFixed(2)}`,
        ...Object.entries(data.products).reduce((acc, [product, stats]) => ({
          ...acc,
          [`${product} Quantity`]: stats.quantity,
          [`${product} Revenue`]: `RM ${stats.revenue.toFixed(2)}`
        }), {})
      }));
      exportToCSV(exportData, `sales-${dateRange}-${startDate}-${endDate}.csv`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <ShoppingCart className="h-7 w-7 mr-3 text-orange-600" /> Sales Report
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
              <Button variant="outline" size="sm" onClick={handlePreviousDay} className="h-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
               <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(e.target.value);
                }}
                className="h-9 text-sm w-36 border-gray-300"
              />
              <Button variant="outline" size="sm" onClick={handleNextDay} className="h-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={handleReset} className="h-9 px-4 text-sm text-gray-600 hover:bg-gray-100 border border-gray-300">
            Reset
          </Button>
          <Button onClick={handleExportCSV} disabled={exporting || loading || salesData.length === 0} className="h-9 px-4 text-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <TrendingUp className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : salesData.every(day => day.total_sales === 0 && day.total_items === 0) && productStats.every(p => p.total_quantity === 0) ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-600">No sales data found for this period.</p>
          <p className="text-sm text-gray-500">Try adjusting the date filters or check if sales have been recorded.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Daily Sales Cards */}
          {salesData.filter(day => day.total_sales > 0 || day.total_items > 0).map((data) => (
            <div key={data.date} className="bg-white rounded-xl shadow-xl overflow-hidden transition-all hover:shadow-2xl">
              <div className="p-5 sm:p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <h2 className="text-xl sm:text-2xl font-semibold flex items-center">
                  <Calendar className="h-6 w-6 mr-3" />
                  Sales for: {format(toGMT8(new Date(data.date + 'T00:00:00')), 'EEEE, dd MMM yyyy')}
                </h2>
              </div>
              <div className="p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-orange-50 p-4 rounded-lg shadow-sm">
                    <h3 className="text-md font-semibold text-orange-700 mb-1">Total Sales</h3>
                    <p className="text-2xl font-bold text-orange-600">RM {data.total_sales.toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
                    <h3 className="text-md font-semibold text-blue-700 mb-1">Total Items Sold</h3>
                    <p className="text-2xl font-bold text-blue-600">{data.total_items}</p>
                  </div>
                </div>

                {Object.keys(data.products).length > 0 ? (
                  <div>
                    <h4 className="text-md font-semibold text-gray-700 mb-2">Products Sold:</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(data.products).map(([productName, stats]) => (
                            <tr key={productName} className="hover:bg-slate-50">
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{productName}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">{stats.quantity}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">RM {stats.revenue.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-md">
                    <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No individual products sold this day.</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Product Performance & Stock Status Card */}
          <div className="bg-white rounded-xl shadow-xl overflow-hidden transition-all hover:shadow-2xl">
            <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
              <h2 className="text-xl sm:text-2xl font-semibold flex items-center">
                <BarChart3 className="h-6 w-6 mr-3" /> Product Performance & Stock
              </h2>
              <p className="text-sm opacity-90">Summary for the selected period: {format(toGMT8(new Date(startDate + 'T00:00:00')), 'dd MMM yyyy')} - {format(toGMT8(new Date(endDate + 'T00:00:00')), 'dd MMM yyyy')}</p>
            </div>
            <div className="p-5 sm:p-6">
              {productStats.length > 0 ? (
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product Name</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Qty Sold</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Revenue</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Current Stock</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productStats.map(product => (
                        <tr key={product.id} className={product.current_stock < lowStockThreshold && product.current_stock > 0 ? 'bg-yellow-50 hover:bg-yellow-100' : product.current_stock === 0 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">{product.name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{product.total_quantity}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">RM {product.total_revenue.toFixed(2)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{product.current_stock}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            {product.current_stock === 0 ? (
                              <span className="flex items-center justify-center px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Out of Stock
                              </span>
                            ) : product.current_stock < lowStockThreshold ? (
                              <span className="flex items-center justify-center px-2 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Low Stock
                              </span>
                            ) : (
                              <span className="flex items-center justify-center px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
                                <CheckCircle className="h-3 w-3 mr-1" /> In Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <ListChecks className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-md font-medium text-gray-600">No product performance data to display for this period.</p>
                  <p className="text-sm text-gray-500">This section shows overall product sales and stock levels.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}