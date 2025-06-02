import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { Member } from '../../types';
import { compressImage } from '../../lib/utils';
import { PhotoUpload } from '../../components/members/PhotoUpload';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/auth';
import { formatLastValidDay } from '../../lib/utils';

export default function EditMember() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    nric: '',
    expiry_date: '',
    member_id: '',
    type: 'adult' as Member['type'],
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [memberIdError, setMemberIdError] = useState<string>('');

  useEffect(() => {
    fetchMember();
  }, [id]);

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        email: member.email || '',
        phone: member.phone || '',
        nric: member.nric,
        expiry_date: format(new Date(member.expiry_date), 'yyyy-MM-dd'),
        member_id: member.member_id,
        type: member.type,
      });
      if (member.photo_url) {
        setPhotoPreview(member.photo_url);
      }
    }
  }, [member]);

  const fetchMember = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setMember(data);
    } catch (error) {
      toast.error('Error fetching member details');
      navigate('/members');
    } finally {
      setLoading(false);
    }
  };

  const validateMemberId = async (id: string) => {
    if (!id) {
      setMemberIdError('Member ID is required');
      return false;
    }

    // Check if ID is numeric
    if (!/^\d+$/.test(id)) {
      setMemberIdError('Member ID must be numeric');
      return false;
    }

    try {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', id)
        .neq('id', member?.id); // Exclude current member

      if (count && count > 0) {
        setMemberIdError('Member ID already exists');
        return false;
      }

      setMemberIdError('');
      return true;
    } catch (error) {
      console.error('Error validating member ID:', error);
      setMemberIdError('Error validating member ID');
      return false;
    }
  };

  const handleMemberIdChange = async (value: string) => {
    setFormData(prev => ({ ...prev, member_id: value }));
    await validateMemberId(value);
  };

  const handlePhotoSelect = async (file: File) => {
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      setPhoto(compressedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      toast.error('Error processing image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAdmin && formData.member_id) {
      const isValid = await validateMemberId(formData.member_id);
      if (!isValid) {
        return;
      }
    }
    
    setSubmitting(true);

    try {
      let photoUrl = member?.photo_url || '';

      // Upload new photo if provided
      if (photo) {
        const fileExt = 'jpg';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `members/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        nric: formData.nric,
        photo_url: photoUrl,
      };

      // Only include admin-only fields if user is admin
      if (isAdmin) {
        updateData.expiry_date = new Date(formData.expiry_date).toISOString();
        updateData.member_id = formData.member_id;
        updateData.type = formData.type;
        
        // Update status based on new expiry date
        const now = new Date();
        const newExpiry = new Date(formData.expiry_date);
        
        if (newExpiry > now) {
          updateData.status = 'active';
        } else {
          // Keep existing status if expiry is in the past
          // This allows admins to set a past date without immediately changing status
          // Status will be updated on next check-in or status calculation
        }
      }

      // Update member record
      const { error: updateError } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', member!.id);

      if (updateError) throw updateError;

      toast.success('Member updated successfully');
      navigate(`/members/${member!.id}`);
    } catch (error) {
      toast.error('Error updating member');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Member not found
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(`/members/${member.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Member
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Edit Member
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <PhotoUpload
              photoUrl={photoPreview}
              onPhotoSelect={handlePhotoSelect}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Member ID - editable for admins */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Member ID
                </label>
                {isAdmin ? (
                  <div>
                    <Input
                      value={formData.member_id}
                      onChange={(e) => handleMemberIdChange(e.target.value)}
                      className={memberIdError ? 'border-red-500' : ''}
                    />
                    {memberIdError && (
                      <p className="mt-1 text-sm text-red-600">
                        {memberIdError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500">
                    {member.member_id}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="nric" className="block text-sm font-medium text-gray-700">
                  NRIC
                </label>
                <Input
                  id="nric"
                  required
                  value={formData.nric}
                  onChange={(e) => setFormData({ ...formData, nric: e.target.value })}
                  placeholder="YYMMDD-PB-####"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {isAdmin ? (
                <div>
                  <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700">
                    Expiry Date
                  </label>
                  <Input
                    id="expiry_date"
                    type="date"
                    required
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Valid Day
                  </label>
                  <div className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500">
                    {formatLastValidDay(member.expiry_date)}
                  </div>
                </div>
              )}

              {/* Membership Type - editable for admins */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Membership Type
                </label>
                {isAdmin ? (
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Member['type'] })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  >
                    <option value="adult">Adult</option>
                    <option value="youth">Youth</option>
                  </select>
                ) : (
                  <div className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 capitalize">
                    {member.type}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/members/${member.id}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || (isAdmin && !!memberIdError)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}