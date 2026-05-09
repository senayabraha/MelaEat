import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const UserNotRegisteredError = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const role = user?.role && user.role !== 'user' ? user.role : 'customer';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 px-4">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Access restricted</h1>
          <p className="text-slate-600 mb-6">
            Your account isn&apos;t registered for this section. Pick the right account type or sign out and try again.
          </p>
          <div className="flex flex-col gap-2 mb-6">
            <Button onClick={() => navigate('/select-role')} className="w-full">
              Choose my role
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to={`/login/${role}`}>Go to {role} sign in</Link>
            </Button>
            <Button onClick={() => logout()} variant="ghost" className="w-full">
              Sign out
            </Button>
          </div>
          <div className="p-4 bg-slate-50 rounded-md text-xs text-slate-500 text-left">
            <p className="font-medium mb-1">Still stuck?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Verify you signed in with the correct email.</li>
              <li>Drivers need approval from an admin before access is granted.</li>
              <li>Contact support if you believe this is an error.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
