import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Product } from '../../types';

interface StockUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onUpdate: (productId: string, newStock: number) => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export function StockUpdateModal({
  isOpen,
  onClose,
  product,
  onUpdate,
  products,
  onSelectProduct
}: StockUpdateModalProps) {
  const [newStock, setNewStock] = useState<number>(product.stock);
  const [adjustment, setAdjustment] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);

  useEffect(() => {
    setNewStock(product.stock);
    setAdjustment(0);
  }, [product]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredProducts(
        products.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const handleAdjustmentChange = (value: number) => {
    setAdjustment(value);
    setNewStock(product.stock + value);
  };

  const handleNewStockChange = (value: number) => {
    setNewStock(value);
    setAdjustment(value - product.stock);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(product.id, newStock);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Update Stock
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-6">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="h-[400px] overflow-y-auto border rounded-lg">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProduct(p)}
                  className={`w-full text-left p-4 border-b hover:bg-gray-50 flex items-center ${
                    p.id === product.id ? 'bg-orange-50 border-orange-300' : ''
                  }`}
                >
                  <div className="h-12 w-12 flex-shrink-0 mr-4">
                    <img
                      src={p.photo_url || 'https://via.placeholder.com/100'}
                      alt={p.name}
                      className="h-full w-full object-cover rounded"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{p.name}</h3>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">
                        RM {p.price.toFixed(2)}
                      </span>
                      <span className={`text-sm ${p.stock < 0 ? 'text-red-600 font-bold' : p.stock === 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                        Stock: {p.stock}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No products found
                </div>
              )}
            </div>
          </div>

          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-1">
                  <div className="h-16 w-16 flex-shrink-0 mr-4">
                    <img
                      src={product.photo_url || 'https://via.placeholder.com/100'}
                      alt={product.name}
                      className="h-full w-full object-cover rounded"
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-500">
                      Current Stock: <span className={product.stock < 0 ? 'text-red-600 font-bold' : ''}>{product.stock}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adjust Stock (+ / -)
                    </label>
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustmentChange(adjustment - 1)}
                        className="rounded-r-none"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={adjustment}
                        onChange={(e) => handleAdjustmentChange(parseInt(e.target.value) || 0)}
                        className="rounded-none text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustmentChange(adjustment + 1)}
                        className="rounded-l-none"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Stock Value
                    </label>
                    <Input
                      type="number"
                      value={newStock}
                      onChange={(e) => handleNewStockChange(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Current Stock:</span>
                      <span className="font-medium">{product.stock}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500">Adjustment:</span>
                      <span className={`font-medium ${adjustment > 0 ? 'text-green-600' : adjustment < 0 ? 'text-red-600' : ''}`}>
                        {adjustment > 0 ? `+${adjustment}` : adjustment}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-lg font-bold mt-2 pt-2 border-t">
                      <span>New Stock:</span>
                      <span className={newStock < 0 ? 'text-red-600' : ''}>{newStock}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                >
                  <Package className="mr-2 h-4 w-4" />
                  Update Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}