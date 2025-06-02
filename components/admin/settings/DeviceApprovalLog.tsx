import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Loader2, RefreshCw, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../../../store/auth';

// Helper function to capitalize the first letter of a string
const capitalizeFirstLetter = (str: string) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Define the structure of a device request item
interface DeviceRequestLogEntry {
  id: string;
  user_id: string;
  fingerprint: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by_user?: { name?: string | null; email?: string | null } | null; // User who reviewed
  requesting_user?: { name?: string | null; email?: string | null } | null; // User who requested
  user_description?: string | null;
  admin_notes?: string | null;
}

// Define structure for summary data
interface ApprovalLogSummary {
  pending: number;
  approvedToday: number;
  deniedToday: number;
  approvedLast7Days: number;
  deniedLast7Days: number;
}

interface DeviceApprovalLogProps {
  displayMode: 'pending' | 'historical';
}

const ITEMS_PER_PAGE = 15;

const DeviceApprovalLog: React.FC<DeviceApprovalLogProps> = ({ displayMode }) => {
  const [logEntries, setLogEntries] = useState<DeviceRequestLogEntry[]>([]);
  const [summary, setSummary] = useState<ApprovalLogSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchDeviceApprovalLog = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      setError('You are not authorized to view this log.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let combinedEntries: DeviceRequestLogEntry[] = [];
      let pendingCount = 0;
      // Placeholder for historical counts, to be implemented if RPC provides enough detail or via post-processing
      // let approvedTodayCount = 0; 
      // let deniedTodayCount = 0;

      if (displayMode === 'pending') {
        const { data: pendingData, error: pendingError } = await supabase
          .from('device_authorization_requests')
          .select(`
            id,
            user_id,
            fingerprint,
            status,
            requested_at,
            user_description,
            requesting_user:users!user_id (name, email)
          `)
          .eq('status', 'pending')
          .order('requested_at', { ascending: false });

        if (pendingError) {
          console.error('Error fetching pending device requests:', pendingError);
          console.error('Supabase pendingError object:', JSON.stringify(pendingError, null, 2));
          throw new Error(`Failed to fetch pending requests: ${pendingError.message}`);
        }
        const mappedPendingEntries: DeviceRequestLogEntry[] = (pendingData || []).map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          fingerprint: item.fingerprint,
          status: item.status as 'pending',
          requested_at: item.requested_at,
          requesting_user: item.requesting_user ? { name: item.requesting_user.name, email: item.requesting_user.email } : { name: 'N/A', email: 'N/A' },
          user_description: item.user_description,
        }));
        combinedEntries = mappedPendingEntries;
        pendingCount = mappedPendingEntries.length;
      } else if (displayMode === 'historical') {
        const { data: historicalData, error: historicalError } = await supabase.rpc(
          'get_historical_device_requests_with_user_info'
        );

        if (historicalError) {
          console.error('Error fetching historical device requests:', historicalError);
          throw new Error(`Failed to fetch historical log: ${historicalError.message}`);
        }
        
        const mappedHistoricalEntries: DeviceRequestLogEntry[] = (historicalData || []).map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          fingerprint: item.fingerprint,
          status: item.status,
          requested_at: item.requested_at,
          reviewed_at: item.reviewed_at,
          requesting_user: item.users ? { name: item.users.name, email: item.users.email } : null,
          reviewed_by_user: null, // Placeholder, requires fetching reviewer details
          user_description: item.user_description,
          admin_notes: item.admin_notes,
        }));
        combinedEntries = mappedHistoricalEntries.sort(
          (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
        );
        // TODO: Calculate historical summary data if needed from combinedEntries
      }
      
      setLogEntries(combinedEntries);

      // Update summary based on display mode
      if (displayMode === 'pending') {
        setSummary({
          pending: pendingCount,
          approvedToday: 0,
          deniedToday: 0,
          approvedLast7Days: 0,
          deniedLast7Days: 0,
        });
      } else if (displayMode === 'historical') {
        // For historical, we might want different summary data.
        // For now, let's clear or set a basic one.
        // A more complete summary would require processing 'combinedEntries' for counts.
        setSummary(null); // Or calculate and set historical summary
      }

    } catch (err: any) {
      console.error('Device Approval Log Error:', err);
      setError(err.message || 'An unknown error occurred.');
      toast.error(err.message || 'Could not load device approval log.');
    } finally {
      setLoading(false);
      setCurrentPage(1); // Reset to first page on new fetch
    }
  }, [user, displayMode]);

  useEffect(() => {
    fetchDeviceApprovalLog();
  }, [fetchDeviceApprovalLog]);

  const handleApproveDevice = async (request: DeviceRequestLogEntry) => {
    if (!user) {
      toast.error("User not found. Please log in again.");
      return;
    }
    setProcessingRequestId(request.id);
    try {
      const { error: rpcError } = await supabase.rpc('execute_approve_device_request', {
        p_request_id: request.id,
        p_admin_id: user.id,
        p_admin_notes: "", // Or prompt for notes
        p_device_description: request.user_description || "",
        p_user_id: request.user_id,
        p_fingerprint: request.fingerprint,
      });

      if (rpcError) {
        throw rpcError;
      }
      toast.success('Device approved successfully!');
      fetchDeviceApprovalLog(); // Refresh the list
    } catch (err: any) {
      console.error('Error approving device:', err);
      toast.error(`Failed to approve device: ${err.message}`);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDenyDevice = async (request: DeviceRequestLogEntry) => {
    if (!user) {
      toast.error("User not found. Please log in again.");
      return;
    }
    setProcessingRequestId(request.id);
    try {
      const { error: updateError } = await supabase
        .from('device_authorization_requests')
        .update({
          status: 'denied',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          // admin_notes: null, // Or prompt for notes
        })
        .eq('id', request.id);

      if (updateError) {
        throw updateError;
      }
      toast.success('Device denied successfully!');
      fetchDeviceApprovalLog(); // Refresh the list
    } catch (err: any) {
      console.error('Error denying device:', err);
      toast.error(`Failed to deny device: ${err.message}`);
    } finally {
      setProcessingRequestId(null);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-4 text-red-500">Unauthorized.</div>;
  }
  
  // TODO: UI for summary statistics

  // Pagination logic for historical view
  const historicalLogEntries = displayMode === 'historical' ? logEntries : [];
  const totalPages = displayMode === 'historical' ? Math.ceil(historicalLogEntries.length / ITEMS_PER_PAGE) : 1;
  const paginatedHistoricalEntries = displayMode === 'historical' 
    ? historicalLogEntries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : [];

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const entriesToDisplay = displayMode === 'pending' ? logEntries : paginatedHistoricalEntries;

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{displayMode === 'pending' ? 'Pending Device Approvals' : 'Device Approval Historical Log'}</h2>
        <Button onClick={fetchDeviceApprovalLog} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh Log
        </Button>
      </div>

      {error && <div className="text-red-500 bg-red-50 p-3 rounded-md">Error: {error}</div>}
      
      {/* Placeholder for Summary Cards - Show pending summary only in 'pending' mode for now */}
      {displayMode === 'pending' && summary && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-yellow-100 rounded-lg shadow">
            <div className="text-sm font-medium text-yellow-700">Pending</div>
            <div className="text-2xl font-bold text-yellow-900">{summary.pending}</div>
          </div>
          {/* Add other summary items here */}
        </div>
      )}


      {loading && entriesToDisplay.length === 0 ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Loading log entries...</p>
        </div>
      ) : !loading && entriesToDisplay.length === 0 && !error ? (
        <div className="text-center py-10">
          <p>No device approval requests found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '50px' }}>#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Device Description</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  {displayMode === 'pending' && <TableHead>Actions</TableHead>}
                  {displayMode === 'historical' && <TableHead>Reviewed At</TableHead>}
                  {displayMode === 'historical' && <TableHead>Reviewed By</TableHead>}
                  {displayMode === 'historical' && <TableHead>Admin Notes</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesToDisplay.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <div>{entry.requesting_user?.name || 'Unknown User'}</div>
                      <div className="text-xs text-muted-foreground">{entry.requesting_user?.email}</div>
                    </TableCell>
                    <TableCell>{entry.user_description || 'N/A'}</TableCell>
                    <TableCell>{capitalizeFirstLetter(formatDistanceToNow(new Date(entry.requested_at), { addSuffix: true }))}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === 'approved' ? 'default' :
                          entry.status === 'denied' ? 'destructive' :
                          'outline'
                        }
                        className={
                          entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                          entry.status === 'denied' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {capitalizeFirstLetter(entry.status)}
                      </Badge>
                    </TableCell>
                    {displayMode === 'pending' && (
                      <TableCell>
                        {entry.status === 'pending' ? (
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveDevice(entry)}
                              disabled={processingRequestId === entry.id}
                              className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                            >
                              {processingRequestId === entry.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDenyDevice(entry)}
                              disabled={processingRequestId === entry.id}
                              className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              {processingRequestId === entry.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              Deny
                            </Button>
                          </div>
                        ) : (
                          capitalizeFirstLetter(entry.status) // Should not happen if filter is correct
                        )}
                      </TableCell>
                    )}
                    {displayMode === 'historical' && (
                      <>
                        <TableCell>{entry.reviewed_at ? capitalizeFirstLetter(formatDistanceToNow(new Date(entry.reviewed_at), { addSuffix: true })) : 'N/A'}</TableCell>
                        <TableCell>
                          {entry.reviewed_by_user?.name || (entry.status !== 'pending' ? 'N/A' : '')}
                          {entry.reviewed_by_user?.email && <div className="text-xs text-muted-foreground">{entry.reviewed_by_user.email}</div>}
                        </TableCell>
                        <TableCell>{entry.admin_notes || 'N/A'}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {displayMode === 'historical' && totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
              <Button onClick={handlePreviousPage} disabled={currentPage === 1} variant="outline" size="sm">
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button onClick={handleNextPage} disabled={currentPage === totalPages} variant="outline" size="sm">
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DeviceApprovalLog; 