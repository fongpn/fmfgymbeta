import React, { useState, useEffect } from 'react';
import { ShoppingCart, History, Package } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Product, CartItem, SaleHistory } from '../types';
import toast from 'react-hot-toast';
import { ProductGrid } from '../components/pos/ProductGrid';
import { ShoppingCart as Cart } from '../components/pos/ShoppingCart';
import { SalesHistory } from '../components/pos/SalesHistory';
import { exportToCSV, toGMT8 } from '../lib/utils';
import { Button } from '../components/ui/button';
import { StockUpdateModal } from '../components/pos/StockUpdateModal';
import { StockHistoryModal } from '../components/pos/StockHistory';
import { useAuthStore } from '../store/auth';

type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';
type ActiveTab = 'pos' | 'history';

export default function POSPage() {
  const user = useAuthStore((state) => state.user);
  const activeShift = useAuthStore((state) => state.activeShift);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showStockUpdateModal, setShowStockUpdateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
  
  // Sales history state
  const [salesHistory, setSalesHistory] = useState<SaleHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sortField, setSortField] = useState<keyof SaleHistory | 'items'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchProducts();
    
    // Set up a refresh interval to keep stock data updated
    const intervalId = setInterval(() => {
      if (activeTab === 'pos') {
        fetchProducts(false); // silent refresh
      }
    }, 60000); // Refresh every minute
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchSalesHistory();
    }
  }, [activeTab, currentPage, selectedDate, sortField, sortOrder]);

  const fetchProducts = async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      
      // Update cart items with the latest stock information
      if (cart.length > 0) {
        const updatedCart = cart.map(cartItem => {
          const updatedProduct = data?.find(p => p.id === cartItem.id);
          if (updatedProduct) {
            return { ...cartItem, stock: updatedProduct.stock };
          }
          return cartItem;
        });
        setCart(updatedCart);
      }
      
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      if (showLoadingState) {
        toast.error('Error fetching products');
      }
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  const fetchSalesHistory = async () => {
    setLoadingHistory(true);
    try {
      // Convert selected date to GMT+8
      const startOfDay = toGMT8(new Date(selectedDate));
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = toGMT8(new Date(selectedDate));
      endOfDay.setHours(23, 59, 59, 999);

      // Get total count
      const { count } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'pos')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      setTotalPages(Math.ceil((count || 0) / 15));

      // Fetch paginated records
      const start = (currentPage - 1) * 15;
      const end = start + 14;

      let query = supabase
        .from('payments')
        .select(`
          *,
          user:user_id (
            email,
            name
          )
        `)
        .eq('type', 'pos')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .range(start, end);

      // Apply sorting for database fields
      if (sortField !== 'items') {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply client-side sorting for items if needed
      let sortedData = [...(data || [])];

      // Ensure user data is processed correctly (handle array if necessary)
      sortedData = sortedData.map(sale => ({ ...sale, user: sale.user || null }));

      if (sortField === 'items' && sortedData.length > 0) {
        sortedData.sort((a, b) => {
          const itemsA = a.items?.length || 0;
          const itemsB = b.items?.length || 0;
          
          if (sortOrder === 'asc') {
            return itemsA - itemsB;
          } else {
            return itemsB - itemsA;
          }
        });
      }

      setSalesHistory(sortedData);
    } catch (error) {
      toast.error('Error fetching sales history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const addToCart = (product: Product) => {
    // Check if product has enough stock
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }

    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.id === product.id);
      
      if (existingItem) {
        // Check if adding one more would exceed available stock
        if (existingItem.quantity + 1 > product.stock) {
          toast.error(`Cannot add more ${product.name}. Only ${product.stock} available.`);
          return currentCart;
        }
        
        return currentCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      return [...currentCart, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(currentCart => {
      const updatedCart = currentCart.map(item => {
        if (item.id === productId) {
          const newQuantity = item.quantity + change;
          
          // If trying to increase quantity, check stock
          if (change > 0) {
            const product = products.find(p => p.id === productId);
            if (product && newQuantity > product.stock) {
              toast.error(`Cannot add more ${item.name}. Only ${product.stock} available.`);
              return item;
            }
          }
          
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
        }
        return item;
      });
      
      return updatedCart.filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(currentCart => currentCart.filter(item => item.id !== productId));
  };

  const handlePayment = async (paymentMethod: PaymentMethod) => {
    if (cart.length === 0) return;

    // Check for active shift first
    if (!activeShift || !activeShift.id) {
      toast.error("No active shift found. Please ensure your shift has started before processing payments.");
      setProcessingPayment(false);
      return;
    }

    setProcessingPayment(true);
    try {
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Get current user ID
      const currentUserId = user?.id;
      if (!currentUserId) {
          throw new Error("User not logged in.");
      }
      
      console.log(`Using Shift ID: ${activeShift.id} for POS payment`);

      // Verify stock levels before proceeding
      for (const item of cart) {
        // Get the latest stock information
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();
          
        if (productError) throw productError;
        
        // Check if there's enough stock
        if (!productData || productData.stock < item.quantity) {
          throw new Error(`Not enough stock for ${item.name}. Only ${productData?.stock || 0} available.`);
        }
      }

      // Start a transaction by creating a payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          amount: total,
          type: 'pos',
          payment_method: paymentMethod,
          user_id: currentUserId,
          shift_id: activeShift.id,
          items: cart.map(item => ({
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            price: item.price
          }))
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update product stock in database and record history
      const stockUpdatePromises = cart.map(async (item) => {
        // Get current stock to ensure we're working with the latest data
        const { data: currentProduct, error: fetchError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();
          
        if (fetchError) throw fetchError;
        
        if (!currentProduct) {
          throw new Error(`Product ${item.name} not found`);
        }
        
        // Calculate new stock
        const newStock = currentProduct.stock - item.quantity;
        
        // Update the stock
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id);
          
        if (updateError) throw updateError;

        // Record stock history
        const { error: historyError } = await supabase
          .from('stock_history')
          .insert({
            product_id: item.id,
            user_id: currentUserId,
            previous_stock: currentProduct.stock,
            new_stock: newStock,
            change: -item.quantity, // Negative because it's a reduction
            type: 'sale' // Explicitly set type for sales
          });

        if (historyError) {
          console.error('Error recording stock history:', historyError);
          // Don't throw error here - we still want the transaction to complete
        }
        
        return { id: item.id, newStock };
      });
      
      // Wait for all stock updates to complete
      await Promise.all(stockUpdatePromises);

      // Refresh products from database to ensure we have the latest stock counts
      await fetchProducts(false);

      toast.success('Payment processed successfully');
      setCart([]);
      
      if (payment) {
        setSalesHistory(prev => [payment, ...prev]);
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'Error processing payment');
      // Refresh products to ensure we have the latest stock counts
      fetchProducts();
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSort = (field: keyof SaleHistory | 'items') => {
    setSortOrder(current => {
      if (sortField === field) {
        return current === 'asc' ? 'desc' : 'asc';
      }
      return 'asc';
    });
    setSortField(field);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setCurrentPage(1); // Reset to first page when date changes
  };

  const handleExportSales = () => {
    // Define fetchAllSalesForExport function *before* calling it
    const fetchAllSalesForExport = async () => {
      // Fetch ALL sales for the selected date for export, including user name
      const startOfDay = toGMT8(new Date(selectedDate));
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = toGMT8(new Date(selectedDate));
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          user:user_id (
            email,
            name // Select name
          )
        `)
        .eq('type', 'pos')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process user data (handle array if necessary)
      // Add :any to sale to bypass TS inference issue
      const processedData = (data || []).map((sale: any) => ({
        ...sale,
        user: Array.isArray(sale.user) && sale.user.length > 0 ? sale.user[0] : null
      }));

      return processedData;
    };

    // Now call the function
    toast.promise(
      fetchAllSalesForExport().then(exportData => {
        // Modify export data to include user name
        // Add type annotation to item
        const formattedExportData = exportData.map(sale => ({
            'Sale ID': sale.id,
            'Date': format(new Date(sale.created_at), 'dd MMM yyyy HH:mm'),
            'Processed By': sale.user?.name || sale.user?.email || 'System', // Use name
            'Payment Method': sale.payment_method,
            'Items': sale.items?.map((item: { product_name: string; quantity: number; }) => `${item.product_name} (x${item.quantity})`).join('; ') || 'N/A',
            'Total Amount': `RM ${sale.amount.toFixed(2)}`,
        }));
        exportToCSV(formattedExportData, `pos-sales-${selectedDate}.csv`);
      }),
      {
        loading: 'Preparing export...',
        success: 'Sales data exported successfully!',
        error: 'Error exporting sales data'
      }
    );
  };

  const handleStockUpdate = async (productId: string, newStock: number) => {
    try {
      // Get current stock to ensure we're working with the latest data
      const { data: currentProduct, error: fetchError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();
          
      if (fetchError) throw fetchError;
      
      
      if (!currentProduct) {
        throw new Error('Product not found');
      }

      // Calculate the change in stock
      const stockChange = newStock - currentProduct.stock;

      // Update stock in database
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Record stock history
      const { error: historyError } = await supabase
        .from('stock_history')
        .insert({
          product_id: productId,
          user_id: user?.id,
          previous_stock: currentProduct.stock,
          new_stock: newStock,
          change: stockChange,
          type: 'adjustment' // Explicitly set type for manual adjustments
        });

      if (historyError) {
        console.error('Error recording stock history:', historyError);
        // Don't throw error here - we still want the update to be considered successful
      }

      // Refresh products from database to ensure we have the latest stock counts
      await fetchProducts(false);

      // Update cart if product is in cart
      setCart(prevCart => 
        prevCart.map(item => 
          item.id === productId ? { ...item, stock: newStock } : item
        )
      );

      toast.success('Stock updated successfully');
      setShowStockUpdateModal(false);
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Error updating stock');
      // Refresh products to ensure we have the latest stock counts
      fetchProducts();
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pos')}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'pos'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <ShoppingCart className="inline-block mr-2 h-4 w-4" />
              Point of Sale
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === 'history'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <History className="inline-block mr-2 h-4 w-4" />
              Sales History
            </button>
          </nav>
          
          {activeTab === 'pos' && (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (products.length > 0) {
                    setSelectedProduct(products[0]);
                    setShowStockUpdateModal(true);
                  } else {
                    toast.error('No products available to update stock');
                  }
                }}
              >
                <Package className="mr-2 h-4 w-4" />
                Update Stock
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowStockHistoryModal(true)}
              >
                <History className="mr-2 h-4 w-4" />
                Stock History
              </Button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProductGrid
              products={products}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddToCart={addToCart}
            />
          </div>
          <div className="lg:col-span-1">
            <Cart
              cart={cart}
              processingPayment={processingPayment}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              onPayment={handlePayment}
            />
          </div>
        </div>
      ) : (
        <SalesHistory 
          loading={loadingHistory} 
          sales={salesHistory}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onDateChange={handleDateChange}
          selectedDate={selectedDate}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          onExport={handleExportSales}
        />
      )}

      {showStockUpdateModal && selectedProduct && (
        <StockUpdateModal
          isOpen={showStockUpdateModal}
          onClose={() => setShowStockUpdateModal(false)}
          product={selectedProduct}
          onUpdate={handleStockUpdate}
          products={products}
          onSelectProduct={setSelectedProduct}
        />
      )}

      {showStockHistoryModal && (
        <StockHistoryModal
          isOpen={showStockHistoryModal}
          onClose={() => setShowStockHistoryModal(false)}
          products={products}
          user={user}
          onStockAdjusted={() => fetchProducts(false)}
        />
      )}
    </div>
  );
}