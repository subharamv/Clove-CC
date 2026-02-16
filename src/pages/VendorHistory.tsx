import React, { useEffect, useState } from 'react';
import { Employee, SystemSettings, CouponStatus } from '../types';
import { supabase } from '../supabaseClient';
import CalendarFilter, { DateFilterType } from '../components/CalendarFilter';
import { formatDateToDDMMYYYY } from '../utils/dateFormatUtils';
import { formatRupees } from '../utils/currencyUtils';

interface VendorHistoryProps {
    employees: Employee[];
    settings: SystemSettings;
    onRefresh?: () => Promise<void> | void;
    userProfile?: any;
}

const VendorHistory: React.FC<VendorHistoryProps> = ({ employees, settings, onRefresh, userProfile }) => {
    const [view, setView] = useState<'SCANS' | 'SETTLEMENTS'>('SCANS');
    const [settlements, setSettlements] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [vendorId, setVendorId] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<Record<string, string>>({});

    const isAdmin = userProfile?.is_admin;
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setVendorId(user.id);

            if (isAdmin) {
                const { data } = await supabase.from('profiles').select('user_id, email');
                if (data) {
                    const profileMap: Record<string, string> = {};
                    data.forEach(p => {
                        profileMap[p.user_id] = p.email;
                    });
                    setProfiles(profileMap);
                }
            }
        };
        init();
    }, [isAdmin]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, dateFilterType, startDate, endDate]);

    useEffect(() => {
        if (view === 'SETTLEMENTS' && vendorId) {
            loadSettlements();
        }
    }, [view, vendorId]);

    const loadSettlements = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('settlements')
                .select('*')
                .order('settled_at', { ascending: false });

            if (!isAdmin && vendorId) {
                query = query.eq('vendor_id', vendorId);
            }

            const { data, error } = await query;
            if (error) throw error;
            setSettlements(data || []);
        } catch (err) {
            console.error('Error loading settlements:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDateRangeChange = (start: string, end: string, filterType: DateFilterType) => {
        setStartDate(start);
        setEndDate(end);
        setDateFilterType(filterType);
    };

    const filteredEmployees = employees.filter(emp => {
        // If not admin, must be received by this vendor
        // If admin, show all that have been received
        const isReceived = emp.status === CouponStatus.RECEIVED || emp.status === CouponStatus.SETTLED;
        if (!isReceived) return false;

        if (!isAdmin) {
            const isMyScan = emp.received_by === vendorId;
            if (!isMyScan) return false;
        }

        const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
            emp.empId.toLowerCase().includes(search.toLowerCase()) ||
            emp.serialCode.toLowerCase().includes(search.toLowerCase());

        // Date filtering
        let matchesDate = true;
        if (dateFilterType !== 'all' && startDate && endDate) {
            let couponDate = '';
            // For received history, we should probably filter by received_at if available
            // but for now sticking to the issueDate logic or created_at
            if (emp.issueDate) {
                if (emp.issueDate.includes('/')) {
                    couponDate = emp.issueDate.split('/').reverse().join('-');
                } else {
                    couponDate = emp.issueDate;
                }
            } else {
                couponDate = emp.created_at?.split('T')[0] || '';
            }
            matchesDate = couponDate >= startDate && couponDate <= endDate;
        }

        return matchesSearch && matchesDate;
    });

    const totalPages = view === 'SCANS' 
        ? Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE)
        : Math.ceil(settlements.length / ITEMS_PER_PAGE);
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    
    const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const paginatedSettlements = settlements.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleExportCSV = () => {
        if (filteredEmployees.length === 0) {
            alert('No coupons to export');
            return;
        }

        const headers = ['Name', 'Emp ID', 'Coupon ID', 'Issued Date', 'Amount', 'Status', 'Received By'];
        const rows = filteredEmployees.map(emp => [
            emp.name,
            emp.empId,
            emp.serialCode,
            formatDateToDDMMYYYY(emp.issueDate),
            emp.amount,
            emp.status,
            isAdmin ? (profiles[emp.received_by || ''] || 'Unknown') : 'You'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = dateFilterType !== 'all' ? `${startDate}_to_${endDate}` : 'all';
        link.download = `my_scanned_coupons_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-1 p-4 md:p-8 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                            {isAdmin ? 'History' : view === 'SCANS' ? 'My Scanned Coupons' : 'My Settlements'}
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm">
                            {isAdmin 
                                ? 'Complete history of all transactions.' 
                                : view === 'SCANS' 
                                    ? 'History of coupons you have verified and received.' 
                                    : 'History of settlements processed for your account.'}
                        </p>
                    </div>
                    <div className="flex w-full md:w-auto gap-3">
                        {!isAdmin && (
                            <div className="flex p-1 bg-slate-200 rounded-xl">
                                <button
                                    onClick={() => setView('SCANS')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${view === 'SCANS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Scans
                                </button>
                                <button
                                    onClick={() => setView('SETTLEMENTS')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${view === 'SETTLEMENTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Settlements
                                </button>
                            </div>
                        )}
                        <button
                            onClick={handleExportCSV}
                            className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 transition flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export
                        </button>
                    </div>
                </header>

                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-orange-500 focus:border-orange-500 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Date Filter</label>
                        <CalendarFilter onDateRangeChange={handleDateRangeChange} />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                    {view === 'SCANS' ? (
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-slate-50 text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 md:px-6 py-4">Employee</th>
                                    <th className="px-4 md:px-6 py-4">Coupon Info</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Amount</th>
                                    <th className="px-4 md:px-6 py-4">Status</th>
                                    {isAdmin && <th className="px-4 md:px-6 py-4">Received By</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {paginatedEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-slate-400">
                                            No coupons found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedEmployees.map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 md:px-6 py-4">
                                                <p className="font-bold text-slate-900 leading-tight">{emp.name}</p>
                                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{emp.empId}</p>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                                <p className="text-sm font-bold text-indigo-600">{emp.serialCode}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Issued: {formatDateToDDMMYYYY(emp.issueDate)}</p>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 text-center">
                                                <span className="font-black text-slate-900">{formatRupees(emp.amount)}</span>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider ${emp.status === CouponStatus.SETTLED ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            {isAdmin && (
                                                <td className="px-4 md:px-6 py-4">
                                                    <p className="text-xs font-bold text-slate-600">{profiles[emp.received_by || ''] || 'Unknown'}</p>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-slate-50 text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 md:px-6 py-4">Reference Number</th>
                                    <th className="px-4 md:px-6 py-4">Date</th>
                                    <th className="px-4 md:px-6 py-4 text-center">Coupons</th>
                                    <th className="px-4 md:px-6 py-4 text-right">Total Amount</th>
                                    <th className="px-4 md:px-6 py-4">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            Loading settlements...
                                        </td>
                                    </tr>
                                ) : settlements.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            No settlements found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedSettlements.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 md:px-6 py-4">
                                                <p className="font-bold text-slate-900 leading-tight">{s.reference_number}</p>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                                <p className="text-slate-600">{formatDateToDDMMYYYY(s.settled_at)}</p>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 text-center">
                                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-xs">{s.coupon_count}</span>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 text-right">
                                                <span className="font-black text-slate-900">{formatRupees(s.total_amount)}</span>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <p className="text-xs text-slate-500 truncate max-w-[200px]" title={s.notes}>{s.notes || '-'}</p>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {totalPages > 1 && (
                        <div className="p-4 md:p-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-4">
                            <p className="text-sm text-slate-500 font-medium order-2 md:order-1">
                                Showing <span className="text-slate-900 font-bold">{startIndex + 1}</span> to <span className="text-slate-900 font-bold">
                                    {Math.min(startIndex + ITEMS_PER_PAGE, view === 'SCANS' ? filteredEmployees.length : settlements.length)}
                                </span> of <span className="text-slate-900 font-bold">
                                    {view === 'SCANS' ? filteredEmployees.length : settlements.length}
                                </span>
                            </p>
                            <div className="flex gap-2 order-1 md:order-2 w-full md:w-auto">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="flex-1 md:flex-none px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-50 transition-all shadow-sm"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex-1 md:flex-none px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-50 transition-all shadow-sm"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VendorHistory;
