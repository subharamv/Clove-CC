
import React from 'react';
import { View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onNavigate: (view: View) => void;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, onLogout }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 no-print">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-900 text-white flex-shrink-0 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-navy-700">
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <span className="text-red-600 font-bold text-xl">C</span>
              </div>
              <span className="text-xl font-bold tracking-tight">CLOVIANS</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => onNavigate(View.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-4 py-3 font-medium transition ${currentView === View.DASHBOARD ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-navy-800'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            Issue Coupons
          </button>
          <button
            onClick={() => onNavigate(View.ISSUED_HISTORY)}
            className={`w-full flex items-center gap-3 px-4 py-3 font-medium transition ${currentView === View.ISSUED_HISTORY ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-navy-800'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            Issued History
          </button>
          <button
            onClick={() => onNavigate(View.PENDING)}
            className={`w-full flex items-center gap-3 px-4 py-3 font-medium transition ${currentView === View.PENDING ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-navy-800'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            Pending Review
          </button>
          <button
            onClick={() => onNavigate(View.SETTINGS)}
            className={`w-full flex items-center gap-3 px-4 py-3 font-medium transition ${currentView === View.SETTINGS ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-navy-800'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            Settings
          </button>
        </nav>

        <div className="p-4 space-y-2">
          <button
            onClick={() => onLogout && onLogout()}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-navy-800 font-medium transition rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
