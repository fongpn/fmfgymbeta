import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2, AlertTriangle, ListChecks, LogOut } from 'lucide-react';
import { Button } from '../../components/ui/button';
import toast from 'react-hot-toast';

interface ActiveShiftDetail {
  shift_id: string;
  user_name: string;
  user_role: string;
  shift_started_at: string;
  shift_ip_address?: string | null;
}

export default function ActiveShiftsPage() {
  const navigate = useNavigate();
  const { user, activeShift: currentUsersActiveShift } = useAuthStore((state) => ({
    user: state.user,
    activeShift: state.activeShift,
  }));

  const [activeShifts, setActiveShifts] = useState<ActiveShiftDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endingShiftId, setEndingShiftId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      navigate('/');
      toast.error('You are not authorized to view this page.');
      return;
    }
    fetchActiveShifts();
  }, [user, navigate, currentUsersActiveShift]);

  const fetchActiveShifts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_active_shifts_details');
      if (rpcError) throw rpcError;
      setActiveShifts(data || []);
    } catch (e: any) {
      console.error('Error fetching active shifts:', e);
      setError('Failed to load active shifts. ' + (e.message || ''));
      toast.error('Failed to load active shifts.');
    } finally {
      setLoading(false);
    }
  };

  const executeManualEndShift = async (shift: ActiveShiftDetail, notes: string | null) => {
    if (!user || !user.id) {
      toast.error('Admin user information not found.');
      return;
    }
    setEndingShiftId(shift.shift_id);
    try {
      const { data: rpcResponse, error: rpcError } = await supabase.rpc('admin_manually_end_shift', {
        p_shift_id_to_end: shift.shift_id,
        p_admin_user_id: user.id,
        p_notes: notes,
      });

      if (rpcError) throw rpcError;

      if (rpcResponse && rpcResponse.status === 'success') {
        toast.success(rpcResponse.message || 'Shift manually ended successfully.');
        fetchActiveShifts();
      } else {
        throw new Error(rpcResponse?.message || 'Failed to end shift.');
      }
    } catch (e: any) {
      console.error('Error manually ending shift:', e);
      toast.error(e.message || 'Could not manually end shift.');
    } finally {
      setEndingShiftId(null);
    }
  };
  
  const handleAttemptEndShift = (shift: ActiveShiftDetail) => {
    if (shift.shift_id === currentUsersActiveShift?.id) {
      toast.error("You cannot manually end your own currently active shift using this admin tool. Please use the standard 'End Shift' procedure.", { duration: 5000 });
      return;
    }

    const confirmationMessage = `Are you sure you want to manually end the shift for ${shift.user_name} (${shift.user_role})?\nShift started: ${format(new Date(shift.shift_started_at), 'dd MMM yyyy, hh:mm a')}\n\nThis action should only be used in case of system issues. If the Cashier forgot to end their shift, please contact the Cashier.`;
    
    if (window.confirm(confirmationMessage)) {
      const notes = window.prompt("Enter reason/notes for manually ending the shift (optional):", "User forgot to clock out.");
      executeManualEndShift(shift, notes);
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <ListChecks className="mr-3 h-8 w-8 text-orange-600" />
            Currently Active Shifts
          </h1>
          <Button onClick={fetchActiveShifts} disabled={loading || !!endingShiftId}>
            {(loading && !endingShiftId) ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Refresh List'
            )}
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-orange-600" />
            <p className="ml-4 text-lg text-gray-600">Loading active shifts...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-md shadow">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold text-red-700">Error Loading Shifts</h2>
                <p className="text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && activeShifts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-xl text-gray-500">No shifts are currently active.</p>
          </div>
        )}

        {!loading && !error && activeShifts.length > 0 && (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift Started At</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeShifts.map((shift) => (
                    <tr key={shift.shift_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shift.user_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{shift.user_role}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(shift.shift_started_at), 'dd MMM yyyy, hh:mm a')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{shift.shift_ip_address || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAttemptEndShift(shift)}
                          disabled={endingShiftId === shift.shift_id || (shift.shift_id === currentUsersActiveShift?.id)}
                          title={shift.shift_id === currentUsersActiveShift?.id ? "Use standard 'End Shift' for your own active shift" : "Manually end this user's shift"}
                          className={shift.shift_id !== currentUsersActiveShift?.id ? "hover:bg-red-100 hover:border-red-500 hover:text-red-700 text-red-600 border-red-400" : ""}
                        >
                          {endingShiftId === shift.shift_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                          <span className="ml-2">End Shift</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 