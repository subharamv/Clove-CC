import React from 'react';
import { View } from '../types';

interface MobileFooterProps {
    currentView: View;
    onNavigate: (view: View) => void;
}

const MobileFooter: React.FC<MobileFooterProps> = ({ currentView, onNavigate }) => {
    const navItems = [
        { view: View.DASHBOARD, label: 'Issue', icon: 'card_giftcard' },
        { view: View.PENDING, label: 'Pending', icon: 'hourglass_empty' },
        { view: View.SCAN_COUPON, label: 'Scan', icon: 'qr_code_scanner', isCenter: true },
        { view: View.ISSUED_HISTORY, label: 'History', icon: 'history' },
        { view: View.SETTLEMENT, label: 'Settlement', icon: 'payments' },
    ];

    const getIcon = (iconName: string, active: boolean) => {
        const iconMap: Record<string, React.ReactElement> = {
            payments: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-2 0H3V6h14v8zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm13 0v11c0 1.1-.9 2-2 2H4v-2h17V7h2z" />
                </svg>
            ),
            card_giftcard: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65c-.5-.3-1.17-.3-1.67 0C13.16 2.78 12.63 2 12 2c-1.66 0-3 1.34-3 3c0 .35.07.69.18 1H4c-1.11 0-1.99.9-1.99 2L2 19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-5c-.83 0-1.5.67-1.5 1.5S8.17 16.5 9 16.5s1.5-.67 1.5-1.5S9.83 13.5 9 13.5zm10 5c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
                </svg>
            ),
            qr_code_scanner: (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm16 6h-6v-2h4v-4h2v6zM7 7h4v4H7V7zm6 0h4v4h-4V7zm-6 6h4v4H7v-4zm6 0h4v4h-4v-4z" />
                </svg>
            ),
            history: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.53.85-1.41-3.63-2.12V8h-1.5z" />
                </svg>
            ),
            hourglass_empty: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 2c-1.1 0-2 .9-2 2v1h2V4h8v1h2V4c0-1.1-.9-2-2-2H6zm8 11.5c0-.83.67-1.5 1.5-1.5S17 12.67 17 13.5 16.33 15 15.5 15 14 14.33 14 13.5zM4 6h16v.5c0 .83-.67 1.5-1.5 1.5H5.5C4.67 8 4 7.33 4 6.5V6zm0 3.5h16V19c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-9.5zm6 4c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z" />
                </svg>
            ),
        };
        return iconMap[iconName] || null;
    };

    return (
        <nav className="flex desktop:hidden bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 h-16 items-center justify-around px-2 z-50">
            {navItems.map((item) => {
                const isActive = currentView === item.view;
                if (item.isCenter) {
                    return (
                        <button
                            key={item.view}
                            onClick={() => onNavigate(item.view)}
                            className="relative -top-5 flex flex-col items-center"
                        >
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all bg-orange-600 text-white active:scale-95`}>
                                {getIcon(item.icon, isActive)}
                            </div>
                            <span className={`text-[10px] mt-1 font-bold ${isActive ? 'text-orange-600' : 'text-slate-700'}`}>{item.label}</span>
                        </button>
                    );
                }
                return (
                    <button
                        key={item.view}
                        onClick={() => onNavigate(item.view)}
                        className="flex flex-col items-center flex-1 py-1"
                    >
                        <div className={`transition-colors ${isActive ? 'text-orange-600' : 'text-slate-500'}`}>
                            {getIcon(item.icon, isActive)}
                        </div>
                        <span className={`text-[10px] mt-1 font-semibold transition-colors ${isActive ? 'text-orange-600' : 'text-slate-600'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default MobileFooter;
