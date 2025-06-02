import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface MembershipPlan {
  id: string;
  type: 'adult' | 'youth';
  months: number;
  price: number;
  registration_fee: number;
  free_months: number;
  active: boolean;
}

export default function MembershipPlansSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [deletedPlanIds, setDeletedPlanIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .order('type')
        .order('months');

      if (error) throw error;
      setPlans(data || []);
      setDeletedPlanIds(new Set());
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Error loading membership plans');
    } finally {
      setLoading(false);
    }
  };

  const addPlan = () => {
    const newPlan: MembershipPlan = {
      id: 'new-' + Date.now(),
      type: 'adult',
      months: 1,
      price: 0,
      registration_fee: 0,
      free_months: 0,
      active: true
    };
    setPlans(prevPlans => [...prevPlans, newPlan]);
  };

  const updatePlan = (index: number, field: keyof MembershipPlan, value: any) => {
    setPlans(prevPlans => {
      const updatedPlans = [...prevPlans];
      updatedPlans[index] = {
        ...updatedPlans[index],
        [field]: value
      };
      return updatedPlans;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First, handle deletions
      if (deletedPlanIds.size > 0) {
        const { error: deleteError } = await supabase
          .from('membership_plans')
          .delete()
          .in('id', Array.from(deletedPlanIds));

        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw new Error('Failed to delete plans');
        }
      }

      // Then handle new plans
      const newPlans = plans.filter(plan => plan.id.startsWith('new-'));
      if (newPlans.length > 0) {
        const { error: insertError } = await supabase
          .from('membership_plans')
          .insert(
            newPlans.map(({ id, ...plan }) => ({
              type: plan.type,
              months: plan.months,
              price: plan.price,
              registration_fee: plan.registration_fee,
              free_months: plan.free_months,
              active: plan.active,
            }))
          );

        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error('Failed to create new plans');
        }
      }

      // Finally handle updates to existing plans
      const existingPlans = plans.filter(plan => !plan.id.startsWith('new-'));
      for (const plan of existingPlans) {
        const { error: updateError } = await supabase
          .from('membership_plans')
          .update({
            type: plan.type,
            months: plan.months,
            price: plan.price,
            registration_fee: plan.registration_fee,
            free_months: plan.free_months,
            active: plan.active
          })
          .eq('id', plan.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw new Error(`Failed to update plan ${plan.id}`);
        }
      }

      // Refresh the data from the database
      await fetchPlans();
      toast.success('Membership plans updated successfully');
    } catch (error) {
      console.error('Error saving plans:', error);
      toast.error(error instanceof Error ? error.message : 'Error updating membership plans');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = (planId: string) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) {
      return;
    }

    if (planId.startsWith('new-')) {
      // For new plans, just remove from state
      setPlans(prevPlans => prevPlans.filter(plan => plan.id !== planId));
    } else {
      // For existing plans, mark for deletion and remove from state
      setDeletedPlanIds(prev => new Set([...prev, planId]));
      setPlans(prevPlans => prevPlans.filter(plan => plan.id !== planId));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">
          Membership Plans
        </h2>
        <Button onClick={addPlan}>
          <Plus className="mr-2 h-4 w-4" />
          Add Plan
        </Button>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <div className="space-y-4">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-8 gap-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Type
                </label>
                <select
                  value={plan.type}
                  onChange={(e) => updatePlan(index, 'type', e.target.value as 'adult' | 'youth')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="adult">Adult</option>
                  <option value="youth">Youth</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Months
                </label>
                <Input
                  type="number"
                  min="1"
                  value={plan.months}
                  onChange={(e) => updatePlan(index, 'months', parseInt(e.target.value) || 1)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Price (RM)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={plan.price}
                  onChange={(e) => updatePlan(index, 'price', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Registration Fee (RM)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={plan.registration_fee}
                  onChange={(e) => updatePlan(index, 'registration_fee', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Free Months
                </label>
                <Input
                  type="number"
                  min="0"
                  value={plan.free_months}
                  onChange={(e) => updatePlan(index, 'free_months', parseInt(e.target.value) || 0)}
                />
              </div>

              {/* Active Checkbox Column */}
              <div className="flex justify-center">
                <div className="flex items-center mt-7">
                  <input
                    type="checkbox"
                    checked={plan.active}
                    onChange={(e) => updatePlan(index, 'active', e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Delete Button Column */}
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDeletePlan(plan.id)}
                  className="text-red-600 hover:text-red-700 mt-7"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}