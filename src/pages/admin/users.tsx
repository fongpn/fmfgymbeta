import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, ToggleLeft, ToggleRight, Download, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { User as UserType } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { exportToCSV } from '../../lib/utils';
import { useAuthStore, AuthUser } from '../../store/auth';

// No longer needed here as password reset is global
// interface MembershipSettings {
//   grace_period_days?: number;
//   adult_walkin_price?: number;
//   youth_walkin_price?: number;
// }

export default function UsersPanel() {
  console.log('[UsersPanel] Version X - Component rendering/re-rendering');
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const isSuperAdmin = authUser?.role === 'superadmin';
  const isAdmin = authUser?.role === 'admin';
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [showEditUserForm, setShowEditUserForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'cashier' as UserType['role'],
  });
  const [editFormData, setEditFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'cashier' as UserType['role'],
  });
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  
  const isFetchingRef = useRef(false);
  const dataLoadedForUserIdRef = useRef<string | null>(null);

  const fetchUsersStable = useCallback(async (currentAuthUser: AuthUser | null) => {
    if (isFetchingRef.current) {
      return;
    }
    if (!currentAuthUser || !currentAuthUser.id || !currentAuthUser.role || (currentAuthUser.role !== 'admin' && currentAuthUser.role !== 'superadmin')) {
      setUsers([]);
      setLoading(false);
      dataLoadedForUserIdRef.current = null;
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_accessible_users', { p_user_role: currentAuthUser.role });

      if (rpcError) throw rpcError;

      const sortedUsers = (rpcData || []).sort((a: UserType, b: UserType) => a.email.localeCompare(b.email));
      setUsers(sortedUsers);
      dataLoadedForUserIdRef.current = currentAuthUser.id;
    } catch (error: any) {
      toast.error('Error fetching users: ' + (error?.message || 'Unknown error'));
      setUsers([]); 
      dataLoadedForUserIdRef.current = null; 
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []); 

  useEffect(() => {
    const currentAuthUser = authUser;
    if (currentAuthUser && currentAuthUser.id && currentAuthUser.role) {
      if (currentAuthUser.role !== 'admin' && currentAuthUser.role !== 'superadmin') {
        setUsers([]);
        setLoading(false);
        dataLoadedForUserIdRef.current = currentAuthUser.id;
        return;
      }

      if (currentAuthUser.id !== dataLoadedForUserIdRef.current && !isFetchingRef.current) {
        fetchUsersStable(currentAuthUser);
      } else if (!isFetchingRef.current && users.length === 0 && dataLoadedForUserIdRef.current === currentAuthUser.id) {
         setLoading(false);
      } else if (!isFetchingRef.current && users.length > 0) {
        setLoading(false);
      }
    } else {
      setUsers([]);
      setLoading(false);
      dataLoadedForUserIdRef.current = null;
    }
  }, [authUser, fetchUsersStable, users.length]);

  // REMOVED fetchPasswordResetSetting
  // REMOVED handleSavePasswordResetSetting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
        toast.error("You are not authorized to create users.");
        return;
    }
    setSubmitting(true);
    let authUserIdFromSignUp: string | undefined = undefined;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        // options: { data: { name: formData.name } } // Add name to metadata if desired, though create_user RPC handles it
      });

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('unique constraint')) {
          throw new Error('An account with this email already exists.');
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('User creation failed: No user data returned from authentication.');
      }
      authUserIdFromSignUp = authData.user.id;

      const { error: userError } = await supabase
        .rpc('create_user', {
          p_id: authUserIdFromSignUp,
          p_email: formData.email,
          p_name: formData.name,
          p_role: formData.role
        });

      if (userError) {
        // Attempt to clean up the auth user if the profile creation failed
        if (authUserIdFromSignUp) {
            try {
                await supabase.auth.admin.deleteUser(authUserIdFromSignUp);
            } catch (cleanupError: any) {
                console.error('Failed to cleanup orphaned auth user:', cleanupError.message);
            }
        }
        throw userError; 
      }

      toast.success('User created successfully!');
      setShowNewUserForm(false);
      setFormData({ email: '', password: '', name: '', role: 'cashier' });
      fetchUsersStable(authUser); // Re-fetch users
    } catch (error: any) {
      toast.error(error.message || 'Error creating user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
        toast.error("You are not authorized to edit users or no user selected.");
        return;
    }
    
    setSubmitting(true);
    let detailsActuallyUpdated = false;
    let passwordActuallyUpdated = false;
    let overallErrorMessage = '';

    try {
      // Update user details in public.users table via RPC
      if (
        editFormData.name !== selectedUser.name ||
        editFormData.role !== selectedUser.role ||
        editFormData.email !== selectedUser.email
      ) {
        const { error: detailsUpdateError } = await supabase
          .rpc('admin_update_user_details', {
            p_user_id: selectedUser.id,
            p_name: editFormData.name,
            p_role: editFormData.role,
            p_email: editFormData.email
          });

        if (detailsUpdateError) {
          overallErrorMessage = `Failed to update user details: ${detailsUpdateError.message}`;
          throw new Error(overallErrorMessage);
        }
        detailsActuallyUpdated = true;
      }

      // Update password in auth.users if provided
      if (editFormData.password) {
        if (editFormData.password.length < 6) {
          throw new Error('New password must be at least 6 characters long.');
        }
        const { error: passwordUpdateError } = await supabase.auth.admin.updateUserById(
          selectedUser.id,
          { password: editFormData.password }
        );
        if (passwordUpdateError) {
          overallErrorMessage += `${overallErrorMessage ? ' ' : ''}Failed to update password: ${passwordUpdateError.message}`;
          throw new Error(overallErrorMessage);
        }
        passwordActuallyUpdated = true;
      }
      
      if (detailsActuallyUpdated || passwordActuallyUpdated) {
        toast.success('User updated successfully!');
        fetchUsersStable(authUser); // Re-fetch users
        setShowEditUserForm(false);
        setSelectedUser(null);
      } else {
        toast('No changes were made.');
        setShowEditUserForm(false);
      }

    } catch (error: any) {
      toast.error(error.message || 'Error updating user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (userToEdit: UserType) => {
    if (userToEdit.role === 'superadmin' && !isSuperAdmin) {
      toast.error('You do not have permission to edit superadmin users');
      return;
    }
    
    setSelectedUser(userToEdit);
    setEditFormData({
      email: userToEdit.email,
      password: '', // Clear password field for editing
      name: userToEdit.name || '',
      role: userToEdit.role
    });
    setShowEditUserForm(true);
  };

  const handleToggleActive = async (userToToggle: UserType) => {
    if (deactivating || !authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) return;
    
    if (userToToggle.role === 'superadmin' && !isSuperAdmin) {
      toast.error('You do not have permission to deactivate superadmin users');
      return;
    }
    if (userToToggle.id === authUser.id && authUser.role !== 'superadmin'){
      toast.error('Admins cannot deactivate their own account.');
      return;
    }
    
    setDeactivating(true);
    try {
      const newActiveStatus = !userToToggle.active;
      const { error } = await supabase
        .rpc('toggle_user_active_status', {
          p_user_id: userToToggle.id,
          p_active: newActiveStatus
        });
        
      if (error) throw error;
      
      // Optimistically update UI or re-fetch
      // setUsers(users.map(u => u.id === userToToggle.id ? { ...u, active: newActiveStatus } : u));
      fetchUsersStable(authUser); // Re-fetch for consistency
      toast.success(`User ${newActiveStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Error updating user status');
    } finally {
      setDeactivating(false);
    }
  };

  const handleExportCSV = () => {
    const exportData = users.map((user) => ({
      name: user.name || 'N/A',
      email: user.email,
      role: user.role,
      active: user.active !== false ? 'Yes' : 'No',
      created_at: format(new Date(user.created_at), 'dd MMM yyyy HH:mm')
    }));
    exportToCSV(exportData, 'users.csv');
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading && dataLoadedForUserIdRef.current !== authUser?.id) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">Users Management</h1>
        <div className="flex space-x-2 items-center">
          <Button variant="outline" onClick={handleExportCSV} disabled={users.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {(isSuperAdmin || isAdmin) && (
            <Button onClick={() => setShowNewUserForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New User
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Joined
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
                  </td>
                </tr>
              ) : !loading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No users found {searchQuery && 'matching your search'}.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(user.created_at), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.active !== false
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {(user.role !== 'superadmin' || isSuperAdmin) && (isAdmin || isSuperAdmin) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(user)}
                            className="mr-2"
                            disabled={user.role === 'superadmin' && !isSuperAdmin}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user)}
                            disabled={deactivating || (user.role === 'superadmin' && !isSuperAdmin) || (user.id === authUser?.id && authUser?.role !== 'superadmin')}
                          >
                            {user.active !== false ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Create New User
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <Input type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} minLength={6} />
                  <p className="mt-1 text-sm text-gray-500">Password must be at least 6 characters long</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserType['role'] })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500">
                    <option value="cashier">Cashier</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    {isSuperAdmin && (<option value="superadmin">Super Admin</option>)}
                  </select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowNewUserForm(false)} disabled={submitting}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create User'}</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditUserForm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Edit User: {selectedUser.email}</h2>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <Input type="email" required value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <Input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="mt-1 block w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <Input type="password" value={editFormData.password} onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })} minLength={6} placeholder="Leave blank to keep current password" />
                  <p className="mt-1 text-sm text-gray-500">If provided, password must be at least 6 characters long</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select value={editFormData.role} onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as UserType['role'] })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500">
                    <option value="cashier">Cashier</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    {isSuperAdmin && (<option value="superadmin">Super Admin</option>)}
                  </select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowEditUserForm(false)} disabled={submitting}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}