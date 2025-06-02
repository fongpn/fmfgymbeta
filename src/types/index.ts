import React from 'react';

export type User = {
  id: string;
  email: string;
  name?: string;
  role: 'cashier' | 'admin' | 'superadmin';
  created_at: string;
  active?: boolean;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  nric: string;
  type: 'adult' | 'youth';
  status: 'active' | 'grace' | 'expired' | 'suspended';
  photo_url: string;
  expiry_date: string;
  created_at: string;
  member_id: string;
};

export type CheckIn = {
  id: string;
  member_id: string;
  check_in_time: string;
  type: 'member' | 'walk-in';
  user_id?: string;
  user?: {
    email: string;
    name?: string;
  };
};

export type Payment = {
  id: string;
  member_id: string;
  amount: number;
  type: 'registration' | 'renewal' | 'walk-in' | 'pos' | 'coupon';
  payment_method: 'cash' | 'qr' | 'bank_transfer';
  created_at: string;
  coupon_id?: string;
  user?: {
    email: string;
    name?: string;
  };
};

export type MembershipHistory = {
  id: string;
  payment_id: string;
  member_id: string;
  previous_expiry_date: string | null;
  new_expiry_date: string | null;
  type: 'registration' | 'renewal';
  plan_details: {
    months: number;
    price: number;
    free_months?: number;
  };
  created_at: string;
  payment?: {
    amount: number;
    payment_method: 'cash' | 'qr' | 'bank_transfer';
    created_at: string;
  };
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  photo_url: string;
  stock: number;
  active: boolean;
};

export type CartItem = Product & {
  quantity: number;
};

export type SaleHistory = Payment & {
  items?: {
    product_name: string;
    quantity: number;
    price: number;
  }[];
  user?: {
    email: string;
    name?: string;
  };
};

export type Coupon = {
  id: string;
  code: string;
  type: 'adult' | 'youth';
  price: number;
  valid_until: string;
  max_uses: number;
  uses: number;
  active: boolean;
  owner_name?: string;
  created_at: string;
};