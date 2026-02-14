import React, { useState } from 'react';
import { View } from '../types';

interface MobileHeaderProps {
    onNavigate: (view: View) => void;
    onLogout: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ onNavigate, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="flex desktop:hidden bg-white border-b border-slate-100 p-4 sticky top-0 z-50 items-center justify-between shadow-sm no-print">
            <div className="flex items-center gap-2" onClick={() => onNavigate(View.DASHBOARD)}>
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    🍽️
                </div>
                <div>
                    <h1 className="font-bold text-sm leading-tight text-slate-900">Clovians</h1>
                    <p className="text-[10px] text-slate-500">Coupons</p>
                </div>
            </div>

            <div className="relative">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1 hover:bg-slate-50 rounded-full transition-colors border-2 border-slate-200"
                >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                </button>

                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50">
                        <button
                            onClick={() => {
                                onNavigate(View.PROFILE);
                                setIsMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50"
                        >
                            <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                            <span className="font-semibold text-slate-700">Profile</span>
                        </button>
                        <button
                            onClick={() => {
                                onNavigate(View.SETTINGS);
                                setIsMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                            <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94c0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.64l-1.92-3.32c-.12-.22-.39-.3-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33c-.22-.09-.49 0-.61.22L2.71 8.87C2.6 9.08 2.66 9.34 2.86 9.48l2.03 1.58C4.84 11.36 4.8 11.69 4.8 12s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.64l1.92 3.32c.12.22.39.3.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.49 0 .61-.22l1.92-3.32c.12-.22.07-.49-.12-.64l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                            </svg>
                            <span className="font-semibold text-slate-700">Settings</span>
                        </button>
                        <div className="px-2 py-1">
                            <button
                                onClick={() => {
                                    onLogout();
                                    setIsMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17 12h-5v2h5v2l3-3-3-3v2zM11 2h9v15h-9V2zm-2 0h2v15H9V2zm0-2H7v19h2V0z" />
                                </svg>
                                <span className="font-bold">Logout</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default MobileHeader;
