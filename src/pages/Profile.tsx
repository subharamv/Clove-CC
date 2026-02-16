import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatDateToDDMMYYYY } from '../utils/dateFormatUtils';

interface User {
    id: string;
    email: string;
    created_at: string;
}

const Profile: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMessage, setInviteMessage] = useState('');
    const [showUserForm, setShowUserForm] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchCurrentUser();
        fetchUsers();
    }, []);

    const fetchCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*');

            if (error) {
                console.warn('Could not fetch profiles (check RLS policies):', error);
                setUsers([]);
            } else {
                setUsers(
                    (profiles || []).map((p: any) => ({
                        id: p.user_id || p.id,
                        email: p.email || 'No email',
                        created_at: p.created_at || new Date().toISOString(),
                    }))
                );
            }
        } catch (err) {
            console.warn('Could not fetch users', err);
            setUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteMessage('');
        try {
            const { error } = await supabase.auth.signUp({
                email: inviteEmail,
                password: invitePassword,
            });
            if (error) throw error;
            setInviteMessage('✓ User created successfully!');
            setInviteEmail('');
            setInvitePassword('');
            fetchUsers();
            setTimeout(() => { setShowUserForm(false); setInviteMessage(''); }, 2000);
        } catch (err: any) {
            setInviteMessage(err.message || 'Failed to create user');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleResetPasswordForUser = async (email: string) => {
        setActionLoading(email);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            });
            if (error) throw error;
            alert(`✓ Password reset link sent to ${email}`);
        } catch (err: any) {
            alert(err.message || 'Failed to send reset link');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-12 space-y-6 no-print">
            <header className="mb-4">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Account Profile</h1>
                <p className="text-slate-500 mt-1">Manage your personal information and team access.</p>
            </header>

            {/* Current User Details Section */}
            <section className="bg-white shadow-sm border border-slate-100 rounded-3xl p-4 md:p-8 mb-8">
                <h2 className="text-lg font-bold text-slate-900 mb-6">Personal Information</h2>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 flex-shrink-0">
                        <svg className="w-8 h-8 md:w-10 md:h-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 break-words">{currentUser?.email || 'Loading...'}</h3>
                        <p className="text-sm text-slate-500 mt-1 break-all">
                            Account ID: <span className="font-mono text-xs">{currentUser?.id || '...'}</span>
                        </p>
                    </div>
                    <div className="w-full md:w-auto md:text-right flex flex-col items-start md:items-end">
                        <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border border-indigo-200 shadow-sm whitespace-nowrap">
                            System Administrator
                        </span>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Member since: {currentUser?.created_at ? formatDateToDDMMYYYY(currentUser.created_at) : '...'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
                        <input
                            type="text"
                            disabled
                            value={currentUser?.email?.split('@')[0].toUpperCase() || 'USER'}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-bold"
                        />
                    </div>
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Account Status</label>
                        <div className="px-4 py-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-700 font-bold text-sm">ACTIVE ACCOUNT</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                    <button
                        onClick={() => handleResetPasswordForUser(currentUser?.email)}
                        disabled={actionLoading === currentUser?.email}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
                    >
                        {actionLoading === currentUser?.email ? (
                            <>
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                Sending Reset Link...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Change Password
                            </>
                        )}
                    </button>
                    <p className="text-xs text-slate-400 mt-3">We will send a secure password reset link to your email address.</p>
                </div>
            </section>

            <section className="bg-white shadow-sm border border-slate-100 rounded-3xl p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">User Management & Access Control</h2>
                        <p className="text-sm text-slate-500 mt-2">Add new users and manage system access.</p>
                    </div>
                    {!showUserForm && (
                        <button
                            type="button"
                            onClick={() => setShowUserForm(true)}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg"
                        >
                            + Add New User
                        </button>
                    )}
                </div>

                {showUserForm && (
                    <form onSubmit={handleInviteUser} className="mb-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                        {inviteMessage && (
                            <div className={`p-3 rounded-lg text-sm mb-4 ${inviteMessage.includes('✓') ? 'bg-green-50 border border-green-200 text-green-600' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                                {inviteMessage}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Email Address</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="user@company.com"
                                    required
                                    className="w-full px-4 py-3 border border-indigo-200 rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Temporary Password</label>
                                <input
                                    type="password"
                                    value={invitePassword}
                                    onChange={(e) => setInvitePassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full px-4 py-3 border border-indigo-200 rounded-xl bg-white focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex items-end gap-3">
                                <button
                                    type="submit"
                                    disabled={inviteLoading}
                                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                                >
                                    {inviteLoading ? 'Creating...' : 'Create User'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowUserForm(false)}
                                    className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 text-xs text-slate-600 font-bold uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Created</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loadingUsers ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading users...</td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No users yet. Create one to get started.</td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-100 transition">
                                        <td className="px-6 py-4 font-medium text-slate-900">{user.email}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{formatDateToDDMMYYYY(user.created_at)}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Active</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => handleResetPasswordForUser(user.email)}
                                                disabled={actionLoading === user.email}
                                                className="text-indigo-600 hover:text-indigo-700 text-sm font-bold disabled:opacity-50"
                                            >
                                                {actionLoading === user.email ? 'Sending...' : 'Reset Password'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Profile;
