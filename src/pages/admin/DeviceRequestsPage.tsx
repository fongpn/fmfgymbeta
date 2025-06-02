import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table";
import { Loader2, CheckCircle, XCircle, ShieldCheck, Save, X as XIcon, PlusCircle, History, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../../store/auth';

interface DeviceRequest {
  id: string;
  user_id: string;
  fingerprint: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  users: {
    name: string | null;
    email: string | null;
  } | null;
  device_description?: string; // For the input field
  isProcessing?: boolean;
}

const ALL_DEFINED_ROLES = ['superadmin', 'admin', 'cashier'];
const ITEMS_PER_PAGE = 10;

const DeviceRequestsPage = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for device description input, mapping requestId to description
  const [deviceDescriptions, setDeviceDescriptions] = useState<Record<string, string>>({});

  const fetchDeviceRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('device_authorization_requests')
        .select(`
          id,
          user_id,
          fingerprint,
          status,
          created_at,
          users (name, email) 
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching device requests:', fetchError);
        throw new Error(fetchError.message);
      }
      
      // Transform the data to match the DeviceRequest interface for the 'users' property
      const transformedData = data ? data.map(req => {
        // Supabase might return users as an array from a join.
        // We expect a single user object or null.
        const userData = Array.isArray(req.users) ? req.users[0] : req.users;
        return {
          ...req,
          users: userData || null, // Ensure it's null if userData is undefined (e.g., empty array)
          isProcessing: false, // Initialize isProcessing state
        };
      }) : [];

      setRequests(transformedData as DeviceRequest[]);
    } catch (e: any) {
      console.error('Failed to load device requests:', e);
      setError('Failed to load device requests. ' + e.message);
      toast.error('Failed to load device requests. ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      fetchDeviceRequests();
    } else {
      // Redirect or show an unauthorized message if not an admin
      // This should ideally be handled by route protection as well
      setError('You are not authorized to view this page.');
      setLoading(false);
      toast.error('Unauthorized access.');
      // navigate('/'); // Example redirect
    }
  }, [user, fetchDeviceRequests]);

  const handleDescriptionChange = (requestId: string, description: string) => {
    setDeviceDescriptions(prev => ({ ...prev, [requestId]: description }));
  };

  const setItemProcessing = (requestId: string, processing: boolean) => {
    setRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === requestId ? { ...req, isProcessing: processing } : req
      )
    );
  };

  const handleApprove = async (requestId: string) => {
    if (!user) return toast.error('User not authenticated');

    const description = deviceDescriptions[requestId]?.trim() || '';
    if (!description) {
      toast.error('Device description is required for approval.');
      return;
    }
    
    setItemProcessing(requestId, true);
    try {
      // Ensure the Authorization header is set for function invocation
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        throw new Error('No active session found. Please re-login.');
      }
      
      const { data: responseData, error: approveError } = await supabase.functions.invoke('approve-device-request', {
        body: { requestId, deviceDescription: description },
        // headers: { Authorization: `Bearer ${session.data.session.access_token}` } // Supabase client handles this automatically
      });

      if (approveError) {
        throw new Error(approveError.message);
      }
      
      if (responseData?.error) { // Handle errors returned in the RPC response body
        throw new Error(responseData.error.details || responseData.error.message || 'Failed to approve request.');
      }

      toast.success(responseData?.message || 'Device request approved!');
      // Remove approved request from the list instead of full refetch for better UX
      setRequests(prevRequests => prevRequests.filter(req => req.id !== requestId));
      setDeviceDescriptions(prev => {
        const newState = {...prev};
        delete newState[requestId];
        return newState;
      });
    } catch (e: any) {
      console.error('Error approving device request:', e);
      toast.error(`Error approving request: ${e.message}`);
      // setError(`Error approving request: ${e.message}`); // Avoid global error for item-specific action
    } finally {
      setItemProcessing(requestId, false);
    }
  };

  const handleDeny = async (requestId: string, adminNotes?: string) => {
    if (!user) return toast.error('User not authenticated');

    setItemProcessing(requestId, true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        throw new Error('No active session found. Please re-login.');
      }

      const { data: responseData, error: denyError } = await supabase.functions.invoke('deny-device-request', {
        body: { requestId, adminNotes: adminNotes || 'Denied by admin via UI.' },
        // headers: { Authorization: `Bearer ${session.data.session.access_token}` } // Supabase client handles this automatically
      });

      if (denyError) {
        throw new Error(denyError.message);
      }
      
      if (responseData?.error) { // Handle errors returned in the RPC response body
        throw new Error(responseData.error.message || 'Failed to deny request.');
      }

      toast.success(responseData?.message ||'Device request denied!');
      // Remove denied request from the list
      setRequests(prevRequests => prevRequests.filter(req => req.id !== requestId));
    } catch (e: any) {
      console.error('Error denying device request:', e);
      toast.error(`Error denying request: ${e.message}`);
      // setError(`Error denying request: ${e.message}`); // Avoid global error
    } finally {
      setItemProcessing(requestId, false);
    }
  };

  if (loading && requests.length === 0) { // Show global loading only on initial fetch
    return <div className="p-4 text-center">Loading device requests...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 text-center">Error: {error}</div>;
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="p-4 text-red-500 text-center">Unauthorized. Please log in as an admin.</div>;
  }

  if (requests.length === 0) {
    return <div className="p-4 text-center">No pending device authorization requests.</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Pending Device Authorization Requests</h1>
      <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Fingerprint</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Description (Optional)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests.map((request) => (
              <TableRow key={request.id} className={request.isProcessing ? 'opacity-50' : ''}>
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{request.users?.name || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{request.users?.email || 'N/A'}</div>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="outline" className="cursor-pointer" title="Copy fingerprint" onClick={() => {
                    navigator.clipboard.writeText(request.fingerprint);
                    toast.success('Fingerprint copied!');
                  }}>
                    {request.fingerprint.substring(0, 15)}... <Copy size={12} className="ml-1 inline-block" />
                  </Badge>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <Input
                    type="text"
                    placeholder="e.g., Front Desk PC, User's Laptop"
                    value={deviceDescriptions[request.id] || ''}
                    onChange={(e) => handleDescriptionChange(request.id, e.target.value)}
                    className="max-w-xs"
                    disabled={request.isProcessing}
                  />
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Button
                    onClick={() => handleApprove(request.id)}
                    variant="default"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={request.isProcessing || !deviceDescriptions[request.id]?.trim()}
                  >
                    {request.isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle size={16} className="mr-1" />}
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleDeny(request.id)}
                    variant="danger"
                    size="sm"
                    disabled={request.isProcessing}
                  >
                    {request.isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle size={16} className="mr-1" />}
                    Deny
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeviceRequestsPage; 