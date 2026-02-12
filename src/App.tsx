import React, { useState, useEffect } from 'react';
import { View, Employee, SystemSettings, CouponStatus } from './types';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import MobileFooter from './components/MobileFooter';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IssuedHistory from './pages/IssuedHistory';
import Pending from './pages/Pending';
import Settlement from './pages/Settlement';
import Preview from './pages/Preview';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import ScanCoupon from './pages/ScanCoupon';
import { supabase } from './supabaseClient';
import SettingsService from './utils/settingsService';

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>(View.LANDING);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([]);

    useEffect(() => {
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            setError(null);
            await checkAuth();
            await loadSettings();
            await loadEmployees();
        } catch (err) {
            console.error('App initialization failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize app');
        } finally {
            setLoading(false);
        }
    };

    const checkAuth = async () => {
        try {
            // Check if Supabase is properly configured
            if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
                throw new Error('Supabase is not configured. Check .env.local file.');
            }

            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;

            if (data.session) {
                setIsLoggedIn(true);
                // If we're on a public landing/login page, go to dashboard. 
                // Otherwise keep the currentView (e.g. if we clicked "View All" on landing)
                setCurrentView(prev => (prev === View.LANDING || prev === View.LOGIN) ? View.DASHBOARD : prev);
            } else {
                setIsLoggedIn(false);
                // Keep the current view if it's already set (e.g. View.ISSUED_HISTORY for redirect)
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            const message = error instanceof Error ? error.message : 'Unable to connect to authentication service';
            throw new Error(message);
        }
    };

    const loadSettings = async () => {
        try {
            const settingsData = await SettingsService.loadSettings();
            setSettings(settingsData);
        } catch (error) {
            console.error('Failed to load settings:', error);
            // Use default settings if loading fails
            setSettings({
                prefix: 'COUP',
                startNumber: 1000,
                suffix: '2026',
                amount: 50,
                validityPeriod: 30,
                useFixedDate: false,
                backgroundTemplate: ''
            });
        }
    };

    const loadEmployees = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                console.log('No active session for loading employees');
                setEmployees([]);
                return;
            }

            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const transformed = (data || []).map((row: any) => ({
                id: row.id,
                name: row.name || '',
                empId: row.emp_id || '',
                otHours: row.ot_hours || 0,
                amount: row.amount || 0,
                status: row.status || CouponStatus.PENDING,
                serialCode: row.serial_code || '',
                issueDate: row.issue_date || '',
                validTill: row.valid_till || '',
                created_at: row.created_at,
                couponImageUrl: row.coupon_image_url
            }));

            setEmployees(transformed);
        } catch (error) {
            console.warn('Failed to load employees (this is ok if not logged in):', error);
            setEmployees([]);
        }
    };

    const handleNavigate = (view: View) => {
        if (view !== View.PREVIEW) {
            setSelectedCouponIds([]);
        }
        setCurrentView(view);
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            setIsLoggedIn(false);
            setCurrentView(View.LANDING);
            setEmployees([]);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleNavigateToPreview = () => {
        setCurrentView(View.ISSUED_HISTORY);
    };

    const handleNavigateToIssuedHistory = () => {
        setCurrentView(View.ISSUED_HISTORY);
    };

    const handleNavigateToPending = () => {
        setCurrentView(View.PENDING);
    };

    const handleBatchPrintNavigation = (ids: string[]) => {
        setSelectedCouponIds(ids);
        setCurrentView(View.PREVIEW);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center max-w-md">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium text-lg mb-2">Initializing app...</p>
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 font-medium text-sm">⚠️ Configuration Error</p>
                            <p className="text-red-600 text-sm mt-2">{error}</p>
                            <p className="text-red-500 text-xs mt-2">Please check your .env.local file is configured correctly.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (error && !isLoggedIn) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
                <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-xl border border-red-200">
                    <svg className="w-16 h-16 mx-auto mb-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4v2m0 4v2M7.08 6.47A9.01 9.01 0 0023 12a9 9 0 01-15.92 5.53M9 12h.01M15 12h.01" />
                    </svg>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Configuration Error</h1>
                    <p className="text-slate-600 mb-4">{error}</p>
                    <div className="bg-slate-50 p-4 rounded-lg text-left mb-4">
                        <p className="text-sm font-mono text-slate-700">
                            📝 Check that <code className="font-bold">.env.local</code> has:
                        </p>
                        <ul className="text-xs text-slate-600 mt-2 space-y-1 font-mono">
                            <li>✓ VITE_SUPABASE_URL</li>
                            <li>✓ VITE_SUPABASE_ANON_KEY</li>
                        </ul>
                        <p className="text-xs text-slate-500 mt-3">Then restart the dev server (Ctrl+C and npm run dev)</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <>
                {currentView === View.LANDING ? (
                    <Landing onNavigate={handleNavigate} />
                ) : (
                    <Login
                        onLogin={async () => {
                            await initializeApp();
                        }}
                    />
                )}
            </>
        );
    }

    return (
        <div className="flex flex-col desktop:flex-row h-screen">
            <Sidebar currentView={currentView} onNavigate={handleNavigate} onLogout={handleLogout} />
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <MobileHeader onNavigate={handleNavigate} onLogout={handleLogout} />
                <main className="flex-1 overflow-y-auto bg-slate-50 pb-20 desktop:pb-0">
                    {currentView === View.DASHBOARD && settings && (
                        <Dashboard
                            employees={employees}
                            settings={settings}
                            onNavigateToPreview={handleNavigateToPreview}
                            onNavigateToIssuedHistory={handleNavigateToIssuedHistory}
                            onNavigateToPending={handleNavigateToPending}
                        />
                    )}
                    {currentView === View.ISSUED_HISTORY && settings && (
                        <IssuedHistory
                            employees={employees}
                            settings={settings}
                            onSelectCoupon={() => setCurrentView(View.PREVIEW)}
                            onNavigateToPrint={handleBatchPrintNavigation}
                            onRefresh={loadEmployees}
                        />
                    )}
                    {currentView === View.PENDING && settings && (
                        <Pending
                            employees={employees}
                            settings={settings}
                            onSelectCoupon={() => setCurrentView(View.PREVIEW)}
                            onNavigateToPrint={handleBatchPrintNavigation}
                            onRefresh={loadEmployees}
                        />
                    )}
                    {currentView === View.SETTLEMENT && settings && (
                        <Settlement
                            employees={employees}
                            onUpdateEmployees={setEmployees}
                        />
                    )}
                    {currentView === View.PREVIEW && settings && (
                        <Preview
                            employees={employees}
                            settings={settings}
                            onUpdateEmployees={setEmployees}
                            selectedIds={selectedCouponIds}
                        />
                    )}
                    {currentView === View.SETTINGS && settings && (
                        <Settings
                            settings={settings}
                            onSaveSettings={(updatedSettings) => {
                                setSettings(updatedSettings);
                                loadSettings();
                            }}
                        />
                    )}
                    {currentView === View.PROFILE && (
                        <Profile />
                    )}
                    {currentView === View.SCAN_COUPON && (
                        <ScanCoupon onRefresh={loadEmployees} />
                    )}
                </main>
                <MobileFooter currentView={currentView} onNavigate={handleNavigate} />
            </div>
        </div>
    );
};

export default App;
