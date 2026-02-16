import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { formatDateToDDMMYYYY } from '../utils/dateFormatUtils';

interface User {
    id: string;
    user_id: string;
    email: string;
    is_admin: boolean;
    access: boolean;
    created_at: string;
}

interface ProfileProps {
    onRefresh?: () => void;
    userProfile?: any;
}

const Profile: React.FC<ProfileProps> = ({ onRefresh, userProfile }) => {
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(userProfile);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMessage, setInviteMessage] = useState('');
    const [showUserForm, setShowUserForm] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (!userProfile) {
            fetchCurrentUser();
        } else {
            setCurrentUserProfile(userProfile);
        }
        fetchUsers();
    }, [userProfile]);

    const fetchCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
            setCurrentUserProfile(profile);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Could not fetch profiles (check RLS policies):', error);
                setUsers([]);
            } else {
                setUsers(
                    (profiles || []).map((p: any) => ({
                        id: p.id,
                        user_id: p.user_id,
                        email: p.email || 'No email',
                        is_admin: p.is_admin || false,
                        access: p.access || false,
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

    const handleUpdateRoles = async (userId: string, roles: { is_admin: boolean, access: boolean }) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update(roles)
                .eq('user_id', userId);

            if (error) throw error;
            
            // Update local state for immediate feedback
            setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, ...roles } : u));
            
            // If it's current user, update their profile too
            if (currentUserProfile?.user_id === userId) {
                setCurrentUserProfile((prev: any) => ({ ...prev, ...roles }));
            }

            if (onRefresh) {
                onRefresh();
            }
        } catch (err: any) {
            alert('Failed to update roles: ' + err.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this user profile? This won\'t delete their auth account but will remove their access.')) return;
        
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('user_id', userId);

            if (error) throw error;
            setUsers(prev => prev.filter(u => u.user_id !== userId));
        } catch (err: any) {
            alert('Failed to delete user profile: ' + err.message);
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
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 break-words">{currentUserProfile?.email || 'Loading...'}</h3>
                        <p className="text-sm text-slate-500 mt-1 break-all">
                            Account ID: <span className="font-mono text-xs">{currentUserProfile?.user_id || '...'}</span>
                        </p>
                    </div>
                    <div className="w-full md:w-auto md:text-right flex flex-col items-start md:items-end">
                        {currentUserProfile?.is_admin ? (
                            <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border border-indigo-200 shadow-sm whitespace-nowrap">
                                System Administrator
                            </span>
                        ) : currentUserProfile?.access ? (
                            <span className="px-4 py-1.5 bg-orange-100 text-orange-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border border-orange-200 shadow-sm whitespace-nowrap">
                                Vendor Access
                            </span>
                        ) : (
                            <span className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border border-slate-200 shadow-sm whitespace-nowrap">
                                No Access
                            </span>
                        )}
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Member since: {currentUserProfile?.created_at ? formatDateToDDMMYYYY(currentUserProfile.created_at) : '...'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
                        <input
                            type="text"
                            disabled
                            value={currentUserProfile?.email?.split('@')[0].toUpperCase() || 'USER'}
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
                        onClick={() => handleResetPasswordForUser(currentUserProfile?.email)}
                        disabled={actionLoading === currentUserProfile?.email || !currentUserProfile?.email}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
                    >
                        {actionLoading === currentUserProfile?.email ? (
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

            {currentUserProfile?.is_admin && (
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
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Created</th>
                                    <th className="px-6 py-4 text-center">Access Role</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-sm">
                                {loadingUsers ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading users...</td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No users yet. Invite one to get started.</td>
                                    </tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-100 transition group">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-900 truncate max-w-[200px]">{user.email}</p>
                                                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{user.user_id}</p>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{formatDateToDDMMYYYY(user.created_at)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <select
                                                    value={user.is_admin ? 'admin' : user.access ? 'vendor' : 'none'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === 'admin') {
                                                            handleUpdateRoles(user.user_id, { is_admin: true, access: true });
                                                        } else if (val === 'vendor') {
                                                            handleUpdateRoles(user.user_id, { is_admin: false, access: true });
                                                        } else {
                                                            handleUpdateRoles(user.user_id, { is_admin: false, access: false });
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border focus:ring-2 transition ${
                                                        user.is_admin ? 'bg-indigo-50 border-indigo-200 text-indigo-700 focus:ring-indigo-500' :
                                                        user.access ? 'bg-orange-50 border-orange-200 text-orange-700 focus:ring-orange-500' :
                                                        'bg-slate-50 border-slate-200 text-slate-500 focus:ring-slate-400'
                                                    }`}
                                                >
                                                    <option value="none">No Access</option>
                                                    <option value="vendor">Vendor (Scan)</option>
                                                    <option value="admin">System Admin</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handleResetPasswordForUser(user.email)}
                                                        disabled={actionLoading === user.email}
                                                        className="text-indigo-600 hover:text-indigo-700 font-bold disabled:opacity-50 text-xs"
                                                        title="Send Password Reset"
                                                    >
                                                        {actionLoading === user.email ? 'Sending...' : 'Reset'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteUser(user.user_id)}
                                                        className="text-slate-300 hover:text-red-600 transition"
                                                        title="Delete profile"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
};

export default Profile;
