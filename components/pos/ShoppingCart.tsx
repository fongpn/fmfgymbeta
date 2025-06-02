import React from 'react';
import { ShoppingCart as CartIcon, Plus, Minus, Trash2, Banknote, QrCode, CreditCard, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { CartItem } from '../../types';

interface ShoppingCartProps {
  cart: CartItem[];
  processingPayment: boolean;
  onUpdateQuantity: (productId: string, change: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onPayment: (method: 'cash' | 'qr' | 'bank_transfer') => void;
}

export function ShoppingCart({
  cart,
  processingPayment,
  onUpdateQuantity,
  onRemoveFromCart,
  onPayment
}: ShoppingCartProps) {
  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Check if any items in cart have insufficient stock
  const hasStockIssues = cart.some(item => item.quantity > item.stock);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 sticky top-20">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Shopping Cart</h2>
        <CartIcon className="h-5 w-5 text-gray-500" />
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Cart is empty
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6 max-h-[calc(100vh-20rem)] overflow-y-auto">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">{item.name}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    RM {item.price.toFixed(2)} × {item.quantity}
                  </p>
                  {item.quantity > item.stock && (
                    <p className="text-xs text-red-600 flex items-center mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Only {item.stock} available
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    className="p-1 sm:p-2"
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    disabled={item.quantity >= item.stock}
                    className="p-1 sm:p-2"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 p-1 sm:p-2"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between text-lg font-semibold mb-6">
              <span>Total:</span>
              <span>RM {calculateTotal().toFixed(2)}</span>
            </div>

            {hasStockIssues && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <p>
                    Some items have insufficient stock. Please adjust quantities before proceeding.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                onClick={() => onPayment('cash')}
                disabled={processingPayment || hasStockIssues || cart.length === 0}
                className="w-full"
              >
                {processingPayment ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="mr-2 h-4 w-4" />
                )}
                Cash
              </Button>
              <Button
                onClick={() => onPayment('qr')}
                disabled={processingPayment || hasStockIssues || cart.length === 0}
                variant="outline"
                className="w-full"
              >
                <QrCode className="mr-2 h-4 w-4" />
                QR
              </Button>
              <Button
                onClick={() => onPayment('bank_transfer')}
                disabled={processingPayment || hasStockIssues || cart.length === 0}
                variant="outline"
                className="w-full"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Bank
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}