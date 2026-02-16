import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { View } from '../types';

interface ResetPasswordProps {
    onNavigate: (view: View) => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const logoUrl = 'https://rzudkvuovoehruxfrlaz.supabase.co/storage/v1/object/public/Logo/1690550663868-removebg-preview.png';

    useEffect(() => {
        const handleSessionDetection = async () => {
            // Check hash immediately for faster detection
            const currentHash = window.location.hash;
            if (currentHash.includes('type=recovery') || currentHash.includes('access_token=')) {
                console.log("ResetPassword: Hash detected on mount");
                // Don't setIsLoading(false) yet, we need to wait for Supabase to parse it
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log("ResetPassword: Session detected");
                setIsLoading(false);
                return;
            }

            // Fallback for double hash tokens
            const hash = window.location.hash;
            if (hash.includes('access_token=') && (hash.includes('type=recovery') || hash.includes('type=signup'))) {
                console.log("ResetPassword: Manual token detection from hash");
                try {
                    const tokenFragment = hash.substring(hash.lastIndexOf('#') + 1);
                    const params = new URLSearchParams(tokenFragment);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        const { data, error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        });
                        
                        if (!error && data.session) {
                            console.log("ResetPassword: Session established manually");
                            setIsLoading(false);
                            return;
                        }
                    }
                } catch (err) {
                    console.error("ResetPassword: Manual session set failed", err);
                }
            }

            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                    setIsLoading(false);
                }
            });

            return subscription;
        };

        let authSubscription: any;
        handleSessionDetection().then(sub => {
            authSubscription = sub;
        });

        return () => {
            if (authSubscription) authSubscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (isLoading) {
                setError("Your password reset link is invalid or has expired.");
                setIsLoading(false);
            }
        }, 10000);

        return () => clearTimeout(timeout);
    }, [isLoading]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsSubmitting(true);
        setError('');
        setMessage('');

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) {
                setError(updateError.message);
            } else {
                setMessage('Password updated successfully! Redirecting to login...');
                setTimeout(() => {
                    onNavigate(View.LOGIN);
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                    <p className="text-slate-500 text-sm">Verifying recovery link...</p>
                    <button 
                        onClick={() => onNavigate(View.LOGIN)}
                        className="mt-6 text-indigo-600 hover:underline text-sm font-medium"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
                <div className="text-center mb-8">
                    <img src={logoUrl} alt="Logo" className="h-12 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900">Create New Password</h2>
                    <p className="text-slate-500 mt-2">Please enter your new password below.</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {message && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                        <p className="text-sm text-green-600">{message}</p>
                    </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="Min 6 characters"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="Confirm your new password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Updating...' : 'Reset Password'}
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate(View.LOGIN)}
                        className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Back to Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
