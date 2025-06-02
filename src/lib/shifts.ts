// src/lib/shifts.ts
import { supabase } from './supabase';

/**
 * Gets the ID of the active (un-ended) shift for a given user.
 * If no active shift exists, it creates a new one and returns its ID.
 * Returns null if the user ID is invalid or if there's an error fetching/creating.
 *
 * @param userId The UUID of the user whose active shift is needed.
 * @returns A Promise resolving to the active shift ID (string) or null.
 */
export const getOrCreateActiveShiftId = async (userId: string): Promise<string | null> => {
  console.log(`[ShiftHelper] --- getOrCreateActiveShiftId CALLED for user ${userId} at ${new Date().toISOString()} ---`);
  if (!userId) {
    console.error("getOrCreateActiveShiftId called with invalid userId");
    return null;
  }

  try {
    // 1. Fetch ALL shifts for the user to filter client-side
    console.log(`[ShiftHelper] Fetching ALL shifts for user ${userId}...`);
    let { data: userShifts, error: fetchError } = await supabase
      .from('shifts')
      .select('id, ended_at') // Fetch ended_at to check
      .eq('user_id', userId)
      .order('created_at', { ascending: false }); // Order for potentially finding latest easily, though filter is main goal

    if (fetchError) {
      console.error(`[ShiftHelper] Error fetching shifts for user ${userId}:`, fetchError);
      return null; 
    }

    // 2. Filter client-side for an active shift
    const activeShift = userShifts?.find(shift => shift.ended_at === null) || null;
    console.log(`[ShiftHelper] Client-side filter result:`, { activeShift });

    if (activeShift) {
      console.log(`[ShiftHelper] Found existing active shift ID via client filter: ${activeShift.id}`);
      return activeShift.id;
    } else {
      // 3. No active shift found, create a new one
      console.log(`[ShiftHelper] No active shift found for user ${userId} after client filter. Creating new shift...`);
      const { data: newShift, error: createError } = await supabase
        .from('shifts')
        .insert({
          user_id: userId,
          // Add defaults for NOT NULL columns as identified before
          cash_collection: 0, 
          qr_collection: 0,
          bank_transfer_collection: 0,
          system_cash: 0,
          system_qr: 0,
          system_bank_transfer: 0,
          cash_variance: 0,
          qr_variance: 0,
          bank_transfer_variance: 0,
          member_payments: 0,
          walk_in_payments: 0,
          pos_sales: 0,
          coupon_sales: 0,
          total_sales: 0
          // Add any other NOT NULL columns with default 0 or appropriate value
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`[ShiftHelper] Error creating new shift for user ${userId}:`, createError);
        return null; 
      }

      if (newShift) {
        console.log(`[ShiftHelper] New shift created with ID: ${newShift.id}`);
        return newShift.id;
      } else {
        console.error("[ShiftHelper] Failed to create new shift or retrieve its ID after insert.");
        return null;
      }
    }
  } catch (error) {
    console.error(`[ShiftHelper] Unexpected error in getOrCreateActiveShiftId for user ${userId}:`, error);
    return null;
  }
};

