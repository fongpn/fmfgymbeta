import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  ShoppingCart,
  Settings,
  LogOut,
  UserCheck,
  Ticket,
  Tag,
  Clock,
  Menu,
  X,
  BarChart2,
  Newspaper,
  ChevronDown,
  Package,
  Gift,
  ListChecks,
  LayoutDashboard
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/ui/button';
import { Logo } from '../components/Logo';
// Import standard Dialog components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "../components/ui/dialog"; 
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = React.useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleSignOut = () => {
    setIsLogoutDialogOpen(true);
  };

  const executeLogout = async () => {
    if (isLoggingOut) {
      console.warn("[Logout Check] executeLogout called while already logging out. Aborting.");
      return;
    }
    setIsLoggingOut(true);

    if (!isLogoutDialogOpen) {
      console.warn("[Logout Check] executeLogout called while isLogoutDialogOpen is false. Aborting.");
      return;
    }

    if (!user) {
      setIsLogoutDialogOpen(false);
      navigate('/login'); 
      return;
    }

    let proceedToLogout = true; 
    console.log(`[Logout Check] User ID: ${user.id}`); 

    try {
      // === Step 1: Find Active Shift ID ===
      console.log("[Logout Check] Step 1: Querying for ANY active shift record..."); 
      // Use select() without maybeSingle() to be more resilient to read-after-write
      const { data: activeShifts, error: shiftError } = await supabase
        .from('shifts')
        .select('id') 
        .eq('user_id', user.id)
        .is('ended_at', null); // No .maybeSingle()

      // Check if the array has items instead of checking if the single object exists
      const activeShiftFound = activeShifts && activeShifts.length > 0;
      const activeShiftId = activeShiftFound ? activeShifts[0].id : null; // Get ID if found

      // Log slightly differently
      console.log("[Logout Check] Step 1 Result:", { activeShiftsData: activeShifts, shiftError });

      if (shiftError) {
        console.error("[Logout Check] Error finding active shift:", shiftError);
        toast.error("Could not verify shift status. Logout cancelled for safety.");
        proceedToLogout = false; 
        setIsLogoutDialogOpen(false); 
      } else if (activeShiftFound && activeShiftId) { // Check if we found a shift and got its ID
        // === Step 2: Check Payments for Active Shift ===
        console.log(`[Logout Check] Step 2: Active shift ID found: ${activeShiftId}. Checking payments...`);
        
        const { count: paymentCount, error: paymentError } = await supabase
          .from('payments')
          .select('id', { count: 'exact', head: true }) 
          .eq('shift_id', activeShiftId);

        console.log("[Logout Check] Step 2 Result (Payments Query):", { paymentCount, paymentError });

        if (paymentError) {
          console.error("[Logout Check] Error checking payments for active shift:", paymentError);
          toast.error("Could not verify pending transactions. Logout cancelled for safety.");
          proceedToLogout = false; 
          setIsLogoutDialogOpen(false);
        } else if (paymentCount !== null && paymentCount > 0) {
          // === Decision: Block Logout ===
          console.log(`[Logout Check] Decision: ${paymentCount} payments found for active shift. Preventing logout.`); 
          proceedToLogout = false;
          setIsLogoutDialogOpen(false);
          toast.error("You have pending transactions in your active shift. Please end shift first.", { duration: 4000 });
          navigate('/end-shift');
        } else {
           // === Decision: Allow Logout (Active Shift, No Payments) ===
           console.log("[Logout Check] Decision: Active shift found, but no linked payments. Allowing logout.");
           // proceedToLogout remains true
        }
      } else {
        // === Decision: Allow Logout (No Active Shift Record) ===
         console.log("[Logout Check] Decision: No active shift record found. Allowing logout."); 
         // proceedToLogout remains true
      }
    } catch (error) {
      // === Decision: Block Logout (Unexpected Error) ===
      console.error("[Logout Check] Unexpected error during checks:", error);
      toast.error("An unexpected error occurred checking shift status. Logout cancelled for safety.");
      proceedToLogout = false; // <<-- Cancel on unexpected error
      setIsLogoutDialogOpen(false);
    } finally {
      setIsLoggingOut(false);
      if (!proceedToLogout) {
         setIsLogoutDialogOpen(false);
      }
    }

    console.log(`[Logout Check] Final Decision: Proceed to logout = ${proceedToLogout}`); 

    // === Step 3: Execute Logout (If Allowed) ===
    if (proceedToLogout) {
      try {
        console.log("[Logout Check] Step 3: Executing signOut..."); 
        await signOut();
        navigate('/login');
      } catch (error) { 
        console.error("Error signing out:", error);
        toast.error("Logout failed. Please try again.");
      } finally {
        setIsLoggingOut(false);
        setIsLogoutDialogOpen(false);
      }
    } else {
       console.log("[Logout Check] Step 3: Logout blocked by previous checks.");
       setIsLoggingOut(false);
       setIsLogoutDialogOpen(false);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const NavLink = ({ to, icon: Icon, children }: { to: string; icon: React.ElementType; children: React.ReactNode }) => (
    <Link
      to={to}
      onClick={() => setMobileMenuOpen(false)}
      className={`
        inline-flex items-center px-3 py-3 min-h-11 text-sm font-medium w-full sm:w-auto rounded-md
        transition-colors duration-200 ease-in-out
        ${isActive(to)
          ? 'text-orange-600 bg-orange-50 sm:bg-transparent sm:border-b-2 sm:border-orange-600'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 sm:hover:bg-transparent sm:hover:border-b-2 sm:hover:border-gray-300'}
      `}
      aria-label={typeof children === 'string' ? children : undefined}
    >
      <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
      {children}
    </Link>
  );

  const renderAdminLinks = () => (
    <div className="mt-1 space-y-1 pl-8 sm:pl-0 sm:mt-0 sm:space-y-0">
      <NavLink to="/admin/users" icon={Users}>Users</NavLink>
      <NavLink to="/admin/products" icon={Package}>Products</NavLink>
      <NavLink to="/admin/coupons" icon={Gift}>Coupons</NavLink>
      <NavLink to="/admin/plans" icon={ListChecks}>Plans</NavLink>
      <NavLink to="/admin/settings" icon={Settings}>Settings</NavLink>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="relative flex justify-between h-16">
            <div className="flex items-center">
              <Logo showText={true} />

              <div className="sm:hidden ml-4">
                <Button
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 min-h-11"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </Button>
              </div>

              <div className="hidden sm:ml-6 sm:flex sm:space-x-1 sm:overflow-x-auto sm:flex-nowrap sm:gap-x-1">
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                   <NavLink to="/admin/daily-summary" icon={Newspaper}>Dashboard</NavLink>
                )}
                <NavLink to="/" icon={UserCheck}>Validation</NavLink>
                <NavLink to="/walk-ins" icon={Ticket}>Walk-In</NavLink>
                <NavLink to="/coupons" icon={Tag}>Coupons</NavLink>
                <NavLink to="/pos" icon={ShoppingCart}>POS</NavLink>
                <NavLink to="/members" icon={Users}>Members</NavLink>
                <NavLink to="/reports" icon={BarChart2}>Reports</NavLink>
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <NavLink to="/admin/settings" icon={Settings}>Admin</NavLink>
                )}
              </div>
            </div>

            <div className="hidden sm:flex items-center space-x-4">
              <Link
                to="/end-shift"
                className={`inline-flex items-center text-sm font-medium ${
                  isActive('/end-shift')
                    ? 'text-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clock className="mr-2 h-4 w-4" />
                End Shift
              </Link>
              
              <span className="text-sm text-gray-500 hidden lg:inline">
                {user?.name || user?.email}
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-gray-500"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile menu backdrop */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 z-30 bg-black bg-opacity-40 transition-opacity duration-300 sm:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu backdrop"
            />
          )}
          <div 
            className={`
              fixed inset-0 top-16 bg-white z-40 transition-transform duration-300 ease-in-out transform
              ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
              sm:hidden
            `}
            style={{ minHeight: 'calc(100vh - 4rem)' }}
            aria-label="Mobile navigation menu"
          >
            <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-4rem)]">
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                 <NavLink to="/admin/daily-summary" icon={Newspaper}>Dashboard</NavLink>
              )}
              <NavLink to="/" icon={UserCheck}>Validation</NavLink>
              <NavLink to="/walk-ins" icon={Ticket}>Walk-In</NavLink>
              <NavLink to="/coupons" icon={Tag}>Coupons</NavLink>
              <NavLink to="/pos" icon={ShoppingCart}>POS</NavLink>
              <NavLink to="/members" icon={Users}>Members</NavLink>
              <NavLink to="/reports" icon={BarChart2}>Reports</NavLink>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                   <NavLink to="/admin/settings" icon={Settings}>Admin</NavLink>
               )}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <NavLink to="/end-shift" icon={Clock}>End Shift</NavLink>
                <div className="px-3 py-2 text-sm text-gray-500">
                  {user?.name || user?.email}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full justify-start text-gray-500"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={executeLogout}>
              Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}