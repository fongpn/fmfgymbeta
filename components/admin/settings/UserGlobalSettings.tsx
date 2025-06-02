import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAuthStore } from '../../../store/auth'; // Assuming roles might be relevant or for future auth checks

const availableRoles = [
    { value: 'cashier', label: 'Cashier' },
    { value: 'staff', label: 'Staff' },
    // Add other roles as necessary, ensure these values match your system's role identifiers
];

const UserGlobalSettings: React.FC = () => {
    const [defaultRole, setDefaultRole] = useState<string>('');
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [originalRole, setOriginalRole] = useState<string>('');
    const user = useAuthStore((state) => state.user);

    const fetchSettings = useCallback(async () => {
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            setInitialLoading(false);
            return;
        }
        setInitialLoading(true);
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'default_new_user_role')
                .maybeSingle();

            if (error) {
                toast.error(`Error fetching default role: ${error.message}`);
                setDefaultRole('cashier'); // Default on error
                setOriginalRole('cashier');
            } else if (data && data.value) {
                const role = data.value as string || 'cashier';
                setDefaultRole(role);
                setOriginalRole(role);
            } else {
                // No setting found in DB, or value is null
                setDefaultRole('cashier'); // Default if not set
                setOriginalRole('cashier');
            }
        } catch (e: any) {
            toast.error('An unexpected error occurred while fetching settings.');
            setDefaultRole('cashier');
            setOriginalRole('cashier');
        } finally {
            setInitialLoading(false);
            setHasChanges(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    useEffect(() => {
        setHasChanges(defaultRole !== originalRole);
    }, [defaultRole, originalRole]);

    const handleSave = async () => {
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            toast.error('You are not authorized to perform this action.');
            return;
        }
        setIsSaving(true);
        toast.loading('Saving default role...', { id: 'saving-default-role' });

        try {
            const { error } = await supabase
                .from('settings')
                .upsert({ key: 'default_new_user_role', value: defaultRole }, { onConflict: 'key' });

            if (error) {
                toast.error(`Failed to save default role: ${error.message}`, { id: 'saving-default-role' });
            } else {
                toast.success('Default role saved successfully!', { id: 'saving-default-role' });
                setOriginalRole(defaultRole);
                setHasChanges(false);
            }
        } catch (e: any) {
            toast.error('An unexpected error occurred while saving.', { id: 'saving-default-role' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (initialLoading) {
        return <p>Loading default user role settings...</p>;
    }

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return <p>You are not authorized to view or manage these settings.</p>;
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Default User Role</h3>
                <p className="text-sm text-muted-foreground">
                    Set the default role assigned to newly created users.
                </p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="default-role-select">Default Role</Label>
                <Select
                    value={defaultRole}
                    onValueChange={(value: string) => setDefaultRole(value)}
                    disabled={isSaving}
                >
                    <SelectTrigger id="default-role-select" className="w-[280px]">
                        <SelectValue placeholder="Select default role" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableRoles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                                {role.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? 'Saving...' : 'Save Default Role'}
            </Button>
        </div>
    );
};

export default UserGlobalSettings; 