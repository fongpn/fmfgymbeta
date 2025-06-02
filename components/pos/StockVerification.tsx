import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { Button } from '../ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface StockVerificationProps {
  localProducts: Product[];
}

export function StockVerification({ localProducts }: StockVerificationProps) {
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [syncingStock, setSyncingStock] = useState(false);

  const fetchDbProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setDbProducts(data || []);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error fetching products from database:', error);
      toast.error('Failed to verify stock with database');
    } finally {
      setLoading(false);
    }
  };

  // Find discrepancies between local state and database
  const findDiscrepancies = () => {
    return localProducts.filter(localProduct => {
      const dbProduct = dbProducts.find(p => p.id === localProduct.id);
      return dbProduct && dbProduct.stock !== localProduct.stock;
    });
  };

  // Sync local stock with database
  const syncStockWithDatabase = async () => {
    setSyncingStock(true);
    try {
      const discrepancies = findDiscrepancies();
      
      if (discrepancies.length === 0) {
        toast.success('Stock is already in sync with database');
        return;
      }
      
      // Update local state with database values
      const updatedProducts = [...localProducts];
      
      for (const discrepancy of discrepancies) {
        const dbProduct = dbProducts.find(p => p.id === discrepancy.id);
        if (dbProduct) {
          const index = updatedProducts.findIndex(p => p.id === discrepancy.id);
          if (index !== -1) {
            updatedProducts[index] = { ...updatedProducts[index], stock: dbProduct.stock };
          }
        }
      }
      
      // Force a page refresh to update all components with the latest stock data
      window.location.reload();
      
      toast.success(`Successfully synchronized ${discrepancies.length} product(s) with database`);
    } catch (error) {
      console.error('Error syncing stock with database:', error);
      toast.error('Failed to sync stock with database');
    } finally {
      setSyncingStock(false);
    }
  };

  const discrepancies = findDiscrepancies();

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Stock Verification</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDbProducts}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Verify Stock
          </Button>
          
          {discrepancies.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={syncStockWithDatabase}
              disabled={syncingStock}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncingStock ? 'animate-spin' : ''}`} />
              Sync with Database
            </Button>
          )}
        </div>
      </div>
      
      {lastChecked && (
        <p className="text-sm text-gray-500 mb-4">
          Last checked: {lastChecked.toLocaleTimeString()}
        </p>
      )}
      
      {discrepancies.length > 0 ? (
        <div>
          <div className="flex items-start mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              Found {discrepancies.length} discrepancies between local state and database. 
              This may cause issues with inventory management. Click "Sync with Database" to update.
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Local Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">DB Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {discrepancies.map(product => {
                  const dbProduct = dbProducts.find(p => p.id === product.id);
                  const difference = dbProduct ? dbProduct.stock - product.stock : 0;
                  
                  return (
                    <tr key={product.id}>
                      <td className="px-4 py-2 text-sm">{product.name}</td>
                      <td className="px-4 py-2 text-sm">{product.stock}</td>
                      <td className="px-4 py-2 text-sm">{dbProduct?.stock}</td>
                      <td className={`px-4 py-2 text-sm font-medium ${difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {difference > 0 ? `+${difference}` : difference}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : dbProducts.length > 0 ? (
        <p className="text-sm text-green-600">
          No discrepancies found. Local state matches database.
        </p>
      ) : (
        <p className="text-sm text-gray-500">
          Click "Verify Stock" to check for discrepancies.
        </p>
      )}
    </div>
  );
}