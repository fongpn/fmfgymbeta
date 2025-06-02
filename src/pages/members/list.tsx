import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, Download, ArrowUpDown, UserCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { Member } from '../../types';
import { calculateMemberStatus, updateMemberStatus, exportToCSV, formatLastValidDay } from '../../lib/utils';
import toast from 'react-hot-toast';

type SortField = 'name' | 'type' | 'status' | 'expiry_date' | 'member_id';
type SortOrder = 'asc' | 'desc';
type PageSize = 15 | 50 | 100 | 'all';

export default function MemberList() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Member['status'] | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<Member['type'] | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [pageSize, setPageSize] = useState<PageSize>(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchMembersCount();
  }, [searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    fetchMembers();
  }, [searchQuery, statusFilter, typeFilter, sortField, sortOrder, pageSize, currentPage]);

  const fetchMembersCount = async () => {
    try {
      let query = supabase
        .from('members')
        .select('id', { count: 'exact', head: true });

      // Apply filters
      if (searchQuery) {
        query = query.or(
          `member_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,nric.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
        );
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      const { count, error } = await query;

      if (error) throw error;
      
      setTotalMembers(count || 0);
      setTotalPages(pageSize === 'all' ? 1 : Math.ceil((count || 0) / Number(pageSize)));
      
      // Reset to page 1 if current page is now out of bounds
      if (currentPage > Math.ceil((count || 0) / Number(pageSize)) && count !== 0) {
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching members count:', error);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('members')
        .select('id, member_id, name, nric, phone, email, type, status, photo_url, expiry_date, created_at');

      // Apply filters
      if (searchQuery) {
        query = query.or(
          `member_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,nric.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
        );
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      // Apply pagination if not showing all
      if (pageSize !== 'all') {
        const start = (currentPage - 1) * Number(pageSize);
        const end = start + Number(pageSize) - 1;
        query = query.range(start, end);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Update member statuses
      const updatedMembers = await Promise.all(
        (data || []).map(async (member) => {
          try {
            const newStatus = await calculateMemberStatus(member.expiry_date, member.status);
            if (newStatus !== member.status) {
              await updateMemberStatus(member);
              return { ...member, status: newStatus };
            }
            return member;
          } catch (error) {
            console.error('Error updating member status:', error);
            return member;
          }
        })
      );

      setMembers(updatedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Error fetching members');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const getStatusColor = (status: Member['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'grace':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Function to capitalize the first letter of status
  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleExportCSV = () => {
    // First fetch all members for export
    const fetchAllMembersForExport = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('members')
          .select('member_id, name, nric, phone, email, type, status, photo_url, expiry_date, created_at');

        // Apply filters
        if (searchQuery) {
          query = query.or(
            `member_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,nric.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
          );
        }
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }
        if (typeFilter !== 'all') {
          query = query.eq('type', typeFilter);
        }

        // Apply sorting
        query = query.order(sortField, { ascending: sortOrder === 'asc' });

        const { data, error } = await query;

        if (error) throw error;

        const exportData = data.map(member => ({
          'Member ID': member.member_id,
          'Name': member.name,
          'NRIC': member.nric,
          'Phone': member.phone || '',
          'Email': member.email || '',
          'Type': member.type,
          'Status': capitalizeStatus(member.status),
          'Expiry Date': format(new Date(member.expiry_date), 'dd MMM yyyy'),
          'Created At': format(new Date(member.created_at), 'dd MMM yyyy')
        }));
        
        exportToCSV(exportData, 'members.csv');
      } catch (error) {
        console.error('Error exporting members:', error);
        toast.error('Error exporting members');
      } finally {
        setLoading(false);
      }
    };

    fetchAllMembersForExport();
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Members</h1>
          <p className="mt-2 text-sm text-gray-700">
            List of all registered members in FMF.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button onClick={() => navigate('/members/new')}>
            <UserPlus className="mr-2 h-4 w-4" />
            New Member
          </Button>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Member['status'] | 'all')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="grace">Grace Period</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as Member['type'] | 'all')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
              >
                <option value="all">Member Type</option>
                <option value="adult">Adult</option>
                <option value="youth">Youth</option>
              </select>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                  Name {getSortIcon('name')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('member_id')}>
                  Member ID {getSortIcon('member_id')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NRIC
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>
                  Type {getSortIcon('type')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                  Status {getSortIcon('status')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('expiry_date')}>
                  Last Valid Day {getSortIcon('expiry_date')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No members found
                  </td>
                </tr>
              ) : (
                members.map((member, index) => (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/members/${member.id}`)}
                  >
                    <td className="px-3 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {pageSize === 'all' ? index + 1 : (currentPage - 1) * Number(pageSize) + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-200">
                          {member.photo_url ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={member.photo_url}
                              alt={member.name}
                            />
                          ) : (
                            <UserCircle2 className="h-8 w-8 text-gray-400" /> 
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.member_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.nric}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {member.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(member.status)}`}>
                        {capitalizeStatus(member.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatLastValidDay(member.expiry_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 flex flex-wrap items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Show:</span>
            <div className="flex space-x-1">
              {[15, 50, 100, 'all'].map((size) => (
                <Button
                  key={size}
                  variant={pageSize === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageSizeChange(size as PageSize)}
                  className="px-2 py-1 text-xs"
                >
                  {size === 'all' ? 'All' : size}
                </Button>
              ))}
            </div>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center space-x-2 mt-4 sm:mt-0">
              <span className="text-sm text-gray-700">
                Showing {(currentPage - 1) * Number(pageSize) + 1} to {Math.min(currentPage * Number(pageSize), totalMembers)} of {totalMembers} members
              </span>
              <div className="flex space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs"
                >
                  Prev
                </Button>
                
                {getPageNumbers().map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="px-2 py-1 text-xs"
                  >
                    {page}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}