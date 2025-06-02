import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';

interface DeductUsageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  couponCode: string;
  loading: boolean;
  isValid: boolean;
  validationMessage?: string;
}

export function DeductUsageDialog({
  isOpen,
  onClose,
  onConfirm,
  couponCode,
  loading,
  isValid,
  validationMessage
}: DeductUsageDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Confirm Coupon Usage
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {isValid ? (
              <>Are you sure you want to deduct one use from coupon <span className="font-mono font-medium">{couponCode}</span>? This action cannot be undone.</>
            ) : (
              <div className="text-red-600">
                Cannot deduct usage because: {validationMessage}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading || !isValid}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 