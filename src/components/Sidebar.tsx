import React, { useState } from 'react';
import { View } from '../types';

interface SidebarProps {
    currentView: View;
    onNavigate: (view: View) => void;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onLogout }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navItems = [
        { view: View.DASHBOARD, label: 'Issue Coupons', icon: 'card_giftcard' },
        { view: View.SCAN_COUPON, label: 'Scan Coupon', icon: 'qr_code_scanner' },
        { view: View.ISSUED_HISTORY, label: 'Issued History', icon: 'history' },
        { view: View.PENDING, label: 'Pending Review', icon: 'hourglass_empty' },
        { view: View.SETTLEMENT, label: 'Settlement', icon: 'payments' },
        { view: View.SETTINGS, label: 'Settings', icon: 'settings' },
    ];

    const getIcon = (iconName: string) => {
        const iconMap: Record<string, React.ReactElement> = {
            dashboard: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 13h2v8H3zm4-8h2v16H7zm4-2h2v18h-2zm4 4h2v14h-2zm4-2h2v16h-2z" />
                </svg>
            ),
            payments: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-2 0H3V6h14v8zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm13 0v11c0 1.1-.9 2-2 2H4v-2h17V7h2z" />
                </svg>
            ),
            card_giftcard: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65c-.5-.3-1.17-.3-1.67 0C13.16 2.78 12.63 2 12 2c-1.66 0-3 1.34-3 3c0 .35.07.69.18 1H4c-1.11 0-1.99.9-1.99 2L2 19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-5c-.83 0-1.5.67-1.5 1.5S8.17 16.5 9 16.5s1.5-.67 1.5-1.5S9.83 13.5 9 13.5zm10 5c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
                </svg>
            ),
            qr_code_scanner: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 12L12 7L17 12L12 17L7 12ZM2 7H5V2H2V7ZM7 2V5H17V2H7ZM19 2V7H22V2H19ZM2 19H5V22H2V19ZM7 22H17V19H7V22ZM19 22H22V19H19V22ZM2 9H4V15H2V9ZM20 9H22V15H20V9ZM9 4V2H15V4H9ZM9 20V22H15V20H9Z" />
                </svg>
            ),
            history: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 11H7v2h2zm4 0h-2v2h2zm4 0h-2v2h2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
                </svg>
            ),
            hourglass_empty: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 2c-1.1 0-2 .9-2 2v1h2V4h8v1h2V4c0-1.1-.9-2-2-2H6zm8 11.5c0-.83.67-1.5 1.5-1.5S17 12.67 17 13.5 16.33 15 15.5 15 14 14.33 14 13.5zM4 6h16v.5c0 .83-.67 1.5-1.5 1.5H5.5C4.67 8 4 7.33 4 6.5V6zm0 3.5h16V19c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-9.5zm6 4c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z" />
                </svg>
            ),
            restaurant: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" />
                </svg>
            ),
            settings: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94c0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.64l-1.92-3.32c-.12-.22-.39-.3-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33c-.22-.09-.49 0-.61.22L2.71 8.87C2.6 9.08 2.66 9.34 2.86 9.48l2.03 1.58C4.84 11.36 4.8 11.69 4.8 12s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.64l1.92 3.32c.12.22.39.3.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.49 0 .61-.22l1.92-3.32c.12-.22.07-.49-.12-.64l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
            ),
            logout: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 12h-5v2h5v2l3-3-3-3v2zM11 2h9v15h-9V2zm-2 0h2v15H9V2zm0-2H7v19h2V0z" />
                </svg>
            ),
            profile: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
            ),
            menu_open: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
            ),
            chevron_left: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
            ),
        };
        return iconMap[iconName] || null;
    };

    return (
        <aside
            className={`hidden desktop:flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white h-screen sticky top-0 overflow-y-auto shadow-xl transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Header with Logo and Collapse Button */}
            <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    {!isCollapsed && (
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0">
                                🍽️
                            </div>
                            <div>
                                <h1 className="font-bold text-lg leading-tight">Clovians</h1>
                                <p className="text-xs text-slate-400">Coupons</p>
                            </div>
                        </div>
                    )}
                    {isCollapsed && <div className="w-10 h-10" />}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors ml-2 flex-shrink-0"
                        title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                        {getIcon(isCollapsed ? 'menu_open' : 'chevron_left')}
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-2">
                {navItems.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => onNavigate(item.view)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${currentView === item.view
                            ? 'bg-orange-600 text-white shadow-lg'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                        title={isCollapsed ? item.label : ''}
                    >
                        <span className="flex-shrink-0">{getIcon(item.icon)}</span>
                        {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                    </button>
                ))}
            </nav>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 space-y-3">
                <button
                    onClick={() => onNavigate(View.PROFILE)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''
                        }`}
                    title={isCollapsed ? 'Profile' : ''}
                >
                    <span className="flex-shrink-0">{getIcon('profile')}</span>
                    {!isCollapsed && <span className="font-medium text-sm">Profile</span>}
                </button>
                <button
                    onClick={onLogout}
                    className={`w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-all flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''
                        }`}
                    title={isCollapsed ? 'Logout' : ''}
                >
                    <span className="flex-shrink-0">{getIcon('logout')}</span>
                    {!isCollapsed && <span className="text-sm">Logout</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
