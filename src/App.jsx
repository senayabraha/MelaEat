import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import CustomerLayout from '@/components/layout/CustomerLayout';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import DriverLayout from '@/components/layout/DriverLayout';
import AdminLayout from '@/components/layout/AdminLayout';

import Home from '@/screens/Home';
import RestaurantDetail from '@/screens/RestaurantDetail';
import Cart from '@/screens/Cart';
import Checkout from '@/screens/Checkout';
import Orders from '@/screens/Orders';
import OrderTracking from '@/screens/OrderTracking';
import Favorites from '@/screens/Favorites';
import Profile from '@/screens/Profile';
import Addresses from '@/screens/Addresses';
import Login from '@/screens/Login';

import RestaurantOverview from '@/screens/restaurant/Overview';
import RestaurantOrders from '@/screens/restaurant/Orders';
import RestaurantMenu from '@/screens/restaurant/Menu';
import RestaurantPromotions from '@/screens/restaurant/Promotions';
import RestaurantReports from '@/screens/restaurant/Reports';
import RestaurantSettings from '@/screens/restaurant/Settings';

import DriverToday from '@/screens/driver/Today';
import DriverActive from '@/screens/driver/Active';
import DriverHistory from '@/screens/driver/History';
import DriverEarnings from '@/screens/driver/Earnings';
import DriverProfile from '@/screens/driver/Profile';

import RoleSelection from '@/screens/RoleSelection';
import AdminOverview from '@/screens/admin/Overview';
import AdminRestaurants from '@/screens/admin/Restaurants';
import AdminUsers from '@/screens/admin/Users';
import AdminOrders from '@/screens/admin/Orders';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  // Redirect authenticated users with no assigned role to role selection
  if (user && user.role === 'user' && window.location.pathname !== '/select-role') {
    return <Navigate to="/select-role" replace />;
  }

  return (
    <Routes>
      {/* Customer / public */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/restaurant/:id" element={<RestaurantDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/order/:id" element={<OrderTracking />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/addresses" element={<Addresses />} />
      </Route>

      {/* Restaurant dashboard */}
      <Route path="/restaurant" element={<RestaurantLayout />}>
        <Route index element={<RestaurantOverview />} />
        <Route path="orders" element={<RestaurantOrders />} />
        <Route path="menu" element={<RestaurantMenu />} />
        <Route path="promotions" element={<RestaurantPromotions />} />
        <Route path="reports" element={<RestaurantReports />} />
        <Route path="settings" element={<RestaurantSettings />} />
      </Route>

      {/* Driver dashboard */}
      <Route path="/driver" element={<DriverLayout />}>
        <Route index element={<DriverToday />} />
        <Route path="active" element={<DriverActive />} />
        <Route path="history" element={<DriverHistory />} />
        <Route path="earnings" element={<DriverEarnings />} />
        <Route path="profile" element={<DriverProfile />} />
      </Route>

      {/* Admin dashboard */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="orders" element={<AdminOrders />} />
      </Route>

      <Route path="/select-role" element={<RoleSelection />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
