import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import CustomerLayout from '@/components/layout/CustomerLayout';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import DriverLayout from '@/components/layout/DriverLayout';
import AdminLayout from '@/components/layout/AdminLayout';

import Home from '@/screens/Home';
import Landing from '@/screens/Landing';
import RestaurantDetail from '@/screens/RestaurantDetail';
import Cart from '@/screens/Cart';
import Checkout from '@/screens/Checkout';
import Orders from '@/screens/Orders';
import OrderTracking from '@/screens/OrderTracking';
import Favorites from '@/screens/Favorites';
import Profile from '@/screens/Profile';
import Addresses from '@/screens/Addresses';
import Login from '@/screens/Login';
import Logout from '@/screens/Logout';
import ProtectedRoute from '@/components/ProtectedRoute';

import RestaurantOverview from '@/screens/restaurant/Overview';
import RestaurantOrders from '@/screens/restaurant/Orders';
import RestaurantMenu from '@/screens/restaurant/Menu';
import RestaurantPromotions from '@/screens/restaurant/Promotions';
import RestaurantReports from '@/screens/restaurant/Reports';
import RestaurantSettings from '@/screens/restaurant/Settings';
import RestaurantProfile from '@/screens/restaurant/Profile';

import DriverToday from '@/screens/driver/Today';
import DriverActive from '@/screens/driver/Active';
import DriverHistory from '@/screens/driver/History';
import DriverEarnings from '@/screens/driver/Earnings';
import DriverProfile from '@/screens/driver/Profile';
import DriverSettings from '@/screens/driver/Settings';

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

  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Customer / public */}
      <Route element={<CustomerLayout />}>
        <Route path="/browse" element={<Home />} />
        <Route path="/restaurant/:id" element={<RestaurantDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login/customer" replace />} />}>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/order/:id" element={<OrderTracking />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/addresses" element={<Addresses />} />
        </Route>
      </Route>

      {/* Restaurant dashboard */}
      <Route element={<ProtectedRoute roles={['restaurant', 'admin']} unauthenticatedElement={<Navigate to="/login/restaurant" replace />} unauthorizedElement={<Navigate to="/" replace />} />}>
        <Route path="/restaurant" element={<RestaurantLayout />}>
          <Route index element={<RestaurantOverview />} />
          <Route path="orders" element={<RestaurantOrders />} />
          <Route path="menu" element={<RestaurantMenu />} />
          <Route path="promotions" element={<RestaurantPromotions />} />
          <Route path="reports" element={<RestaurantReports />} />
          <Route path="profile" element={<RestaurantProfile />} />
          <Route path="settings" element={<RestaurantSettings />} />
        </Route>
      </Route>

      {/* Driver dashboard */}
      <Route element={<ProtectedRoute roles={['driver', 'admin']} unauthenticatedElement={<Navigate to="/login/driver" replace />} unauthorizedElement={<Navigate to="/" replace />} />}>
        <Route path="/driver" element={<DriverLayout />}>
          <Route index element={<DriverToday />} />
          <Route path="active" element={<DriverActive />} />
          <Route path="history" element={<DriverHistory />} />
          <Route path="earnings" element={<DriverEarnings />} />
          <Route path="profile" element={<DriverProfile />} />
          <Route path="settings" element={<DriverSettings />} />
        </Route>
      </Route>

      {/* Admin dashboard */}
      <Route element={<ProtectedRoute roles={['admin']} unauthenticatedElement={<Navigate to="/login/admin" replace />} unauthorizedElement={<Navigate to="/" replace />} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="restaurants" element={<AdminRestaurants />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
        </Route>
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/login/:role" element={<Login />} />
      <Route path="/signup/:role" element={<Login />} />
      <Route path="/reset-password/:role?" element={<Login />} />
      <Route path="/logout/:role" element={<Logout />} />
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
