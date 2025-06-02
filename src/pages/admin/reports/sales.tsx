import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Download, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/utils';
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

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      // Fetch POS sales
      const { data: sales, error: salesError } = await supabase
        .from('payments')
        .select('created_at, amount, items')
        .eq('type', 'pos')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      if (salesError) throw salesError;

      // Fetch current product data
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock');

      if (productsError) throw productsError;

      // Process sales data
      const dailySales: { [key: string]: SalesData } = {};
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
      sales.forEach(sale => {
        const date = format(new Date(sale.created_at), 'yyyy-MM-dd');
        
        if (!dailySales[date]) {
          dailySales[date] = {
            date,
            total_sales: 0,
            total_items: 0,
            products: {}
          };
        }

        // Add sale amount
        dailySales[date].total_sales += sale.amount;

        // Process items in the sale
        if (sale.items) {
          sale.items.forEach((item: any) => {
            // Update daily sales
            if (!dailySales[date].products[item.product_name]) {
              dailySales[date].products[item.product_name] = {
                quantity: 0,
                revenue: 0
              };
            }
            dailySales[date].products[item.product_name].quantity += item.quantity;
            dailySales[date].products[item.product_name].revenue += item.price * item.quantity;
            dailySales[date].total_items += item.quantity;

            // Update product totals
            const product = products.find(p => p.name === item.product_name);
            if (product) {
              productTotals[product.id].total_quantity += item.quantity;
              productTotals[product.id].total_revenue += item.price * item.quantity;
            }
          });
        }
      });

      setSalesData(Object.values(dailySales));
      setProductStats(Object.values(productTotals));
    } catch (error) {
      toast.error('Error fetching sales data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const exportData = salesData.map(data => ({
      'Date': format(new Date(data.date), 'dd MMM yyyy'),
      'Total Sales': `RM ${data.total_sales.toFixed(2)}`,
      'Total Items': data.total_items,
      ...Object.entries(data.products).reduce((acc, [product, stats]) => ({
        ...acc,
        [`${product} Quantity`]: stats.quantity,
        [`${product} Revenue`]: `RM ${stats.revenue.toFixed(2)}`
      }), {})
    }));
    exportToCSV(exportData, `sales-${dateRange}-${startDate}-${endDate}.csv`);
  };

  const calculateTotals = () => {
    return salesData.reduce((acc, data) => ({
      total_sales: acc.total_sales + data.total_sales,
      total_items: acc.total_items + data.total_items
    }), { total_sales: 0, total_items: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            RM {calculateTotals().total_sales.toFixed(2)}
          </p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>For selected period</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Items Sold</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {calculateTotals().total_items}
          </p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <Package className="mr-2 h-4 w-4" />
            <span>Total units</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Low Stock Items</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {productStats.filter(p => p.current_stock <= lowStockThreshold).length}
          </p>
          <div className="mt-2 flex items-center text-sm text-yellow-600">
            <AlertTriangle className="mr-2 h-4 w-4" />
            <span>Need restock</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Filter Bar */}
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
          <div className="space-y-8">
            {/* Product Performance Table */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Product Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Units Sold
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Stock
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productStats.map((product) => (
                      <tr key={product.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.total_quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          RM {product.total_revenue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.current_stock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.current_stock <= lowStockThreshold ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Sales Table */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Daily Sales
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm sm:text-base">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items Sold
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesData.map((data) => (
                      <tr key={data.date}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(data.date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {data.total_items}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                          RM {data.total_sales.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {salesData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                          No sales data found for the selected period
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {salesData.length > 0 && (
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          Total
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {calculateTotals().total_items}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                          RM {calculateTotals().total_sales.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}