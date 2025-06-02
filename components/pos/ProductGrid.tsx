import React from 'react';
import { Product } from '../../types';
import { Input } from '../ui/input';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddToCart: (product: Product) => void;
}

export function ProductGrid({ 
  products, 
  loading, 
  searchQuery, 
  onSearchChange, 
  onAddToCart 
}: ProductGridProps) {
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Function to determine the appropriate styling based on stock level
  const getProductCardStyle = (product: Product) => {
    if (product.stock <= 0) {
      return 'border-red-300 bg-red-50 opacity-75';
    } else if (product.stock < 5) {
      return 'border-yellow-300 bg-yellow-50';
    } else {
      return 'hover:border-orange-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => onAddToCart(product)}
              disabled={product.stock <= 0}
              className={`
                text-left p-3 sm:p-4 rounded-lg border hover:shadow-md transition-shadow
                ${getProductCardStyle(product)}
              `}
            >
              <div className="aspect-square mb-3 sm:mb-4 rounded-md overflow-hidden bg-gray-100">
                <img
                  src={product.photo_url || 'https://via.placeholder.com/200'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2">{product.name}</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-2 line-clamp-2">{product.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-lg font-bold text-orange-600">
                  RM {product.price.toFixed(2)}
                </span>
                <span className={`text-xs sm:text-sm ${
                  product.stock <= 0 
                    ? 'text-red-600 font-bold' 
                    : product.stock < 5 
                      ? 'text-yellow-600' 
                      : 'text-gray-500'
                }`}>
                  Stock: {product.stock}
                  {product.stock <= 0 && " (Out of stock)"}
                  {product.stock > 0 && product.stock < 5 && " (Low)"}
                </span>
              </div>
            </button>
          ))}
          
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No products found matching your search
            </div>
          )}
        </div>
      )}
    </div>
  );
}