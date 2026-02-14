import React, { useEffect, useState } from 'react';
import { Employee, SystemSettings, CouponStatus, Settlement as SettlementType } from '../types';
import { supabase } from '../supabaseClient';
import { getTemplateImageUrl, DEFAULT_TEMPLATE } from '../imageUtils';
import { formatRupees } from '../utils/currencyUtils';
import { previewVoucher, downloadVoucherPDF, VoucherData } from '../utils/settlementVoucher';
import CalendarFilter, { DateFilterType } from '../components/CalendarFilter';
import { formatDateToDDMMYYYY } from '../utils/dateFormatUtils';

interface SettlementModal {
    visible: boolean;
    settlement: SettlementType | null;
    loading: boolean;
}

interface IssuedHistoryProps {
    employees: Employee[];
    settings: SystemSettings;
    onSelectCoupon: (employee: Employee) => void;
    onNavigateToPrint?: (selectedIds: string[]) => void;
    onRefresh?: () => Promise<void> | void;
}

const IssuedHistory: React.FC<IssuedHistoryProps> = ({ employees, settings, onSelectCoupon, onNavigateToPrint, onRefresh }) => {
    const [templateUrl, setTemplateUrl] = useState<string>(DEFAULT_TEMPLATE);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<CouponStatus | 'ALL'>('ALL');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
    const [isPrinting, setIsPrinting] = useState(false);
    const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [settlementModal, setSettlementModal] = useState<SettlementModal>({
        visible: false,
        settlement: null,
        loading: false
    });
    const [previewingVoucherId, setPreviewingVoucherId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

    const ITEMS_PER_PAGE = viewMode === 'grid' ? 6 : 10;

    const loadTemplateImage = async () => {
        try {
            const url = await getTemplateImageUrl();
            setTemplateUrl(url);
        } catch (err) {
            console.warn('Using default template image', err);
            setTemplateUrl(DEFAULT_TEMPLATE);
        }
    };

    useEffect(() => {
        loadTemplateImage();
    }, []);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterStatus, dateFilterType, startDate, endDate]);

    const handleDateRangeChange = (start: string, end: string, filterType: DateFilterType) => {
        setStartDate(start);
        setEndDate(end);
        setDateFilterType(filterType);
    };

    const fetchSettlementDetails = async (settlementId: string) => {
        setSettlementModal(prev => ({ ...prev, loading: true }));
        try {
            const { data, error } = await supabase
                .from('settlements')
                .select('*')
                .eq('id', settlementId)
                .single();

            if (error) throw error;

            const settlement: SettlementType = {
                id: data.id,
                totalAmount: data.total_amount,
                couponCount: data.coupon_count,
                settledBy: data.settled_by,
                settledAt: data.settled_at,
                referenceNumber: data.reference_number,
                notes: data.notes
            };

            setSettlementModal(prev => ({
                ...prev,
                settlement,
                visible: true,
                loading: false
            }));
        } catch (err) {
            console.error('Error fetching settlement:', err);
            alert('Failed to load settlement details');
            setSettlementModal(prev => ({ ...prev, loading: false }));
        }
    };

    const handlePreviewVoucher = async (settlement: SettlementType) => {
        try {
            setPreviewingVoucherId(settlement.id);
            const voucherData: VoucherData = {
                referenceNumber: settlement.referenceNumber,
                notes: settlement.notes,
                totalAmount: settlement.totalAmount,
                settledAt: settlement.settledAt
            };
            await previewVoucher(voucherData);
        } catch (err) {
            console.error('Failed to preview voucher:', err);
            alert('Failed to preview voucher');
        } finally {
            setPreviewingVoucherId(null);
        }
    };

    const handleDownloadVoucher = async (settlement: SettlementType) => {
        try {
            setPreviewingVoucherId(settlement.id);
            const voucherData: VoucherData = {
                referenceNumber: settlement.referenceNumber,
                notes: settlement.notes,
                totalAmount: settlement.totalAmount,
                settledAt: settlement.settledAt
            };
            await downloadVoucherPDF(voucherData);
        } catch (err) {
            console.error('Failed to download voucher:', err);
            alert('Failed to download voucher');
        } finally {
            setPreviewingVoucherId(null);
        }
    };

    const markReceived = async (id: string) => {
        try {
            const { data, error } = await supabase.from('coupons').update({
                status: CouponStatus.RECEIVED,
                received_at: new Date().toISOString()
            }).eq('id', id);

            if (error) {
                console.error('Error updating status:', error);
                alert('Failed to update coupon status: ' + (error.message || JSON.stringify(error)));
                return;
            }

            // Refresh parent list if provided
            if (typeof onRefresh === 'function') {
                await onRefresh();
            }

        } catch (error) {
            console.error('Unexpected error updating status:', error);
            alert('Failed to update coupon status');
        }
    };

    const deleteCoupon = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this coupon?')) {
            return;
        }

        try {
            const { error } = await supabase.from('coupons').delete().eq('id', id);
            if (error) {
                console.error('Error deleting coupon:', error);
                alert(`Failed to delete coupon: ${error.message || 'Unknown error'}`);
                return;
            }

            console.log('Coupon deleted successfully, refreshing list');

            // Refresh parent list if provided
            if (typeof onRefresh === 'function') {
                console.log('Calling onRefresh to update employee list');
                await onRefresh();
            } else {
                console.warn('onRefresh function not provided to IssuedHistory component');
                alert('Coupon deleted but list could not be refreshed. Please refresh the page.');
            }
        } catch (error) {
            console.error('Unexpected error deleting coupon:', error);
            alert(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
            emp.empId.toLowerCase().includes(search.toLowerCase()) ||
            emp.serialCode.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || emp.status === filterStatus;

        // Date filtering
        let matchesDate = true;
        if (dateFilterType !== 'all' && startDate && endDate) {
            const couponDate = emp.issueDate ? new Date(emp.issueDate.split('/').reverse().join('-')).toISOString().split('T')[0] : emp.created_at?.split('T')[0] || '';
            matchesDate = couponDate >= startDate && couponDate <= endDate;
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const toggleSelectForPrint = (id: string) => {
        const newSelected = new Set(selectedForPrint);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedForPrint(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedForPrint.size === paginatedEmployees.length) {
            setSelectedForPrint(new Set());
        } else {
            const allIds = paginatedEmployees.map(emp => emp.id);
            setSelectedForPrint(new Set(allIds));
        }
    };

    const handleBulkMarkReceived = async () => {
        if (selectedForPrint.size === 0) {
            alert('Please select at least one coupon');
            return;
        }

        if (!window.confirm(`Are you sure you want to mark ${selectedForPrint.size} coupons as received?`)) {
            return;
        }

        setIsPrinting(true);
        try {
            const { error } = await supabase
                .from('coupons')
                .update({
                    status: CouponStatus.RECEIVED,
                    received_at: new Date().toISOString()
                })
                .in('id', Array.from(selectedForPrint));

            if (error) throw error;

            alert('Selected coupons marked as received successfully!');
            setSelectedForPrint(new Set());
            if (typeof onRefresh === 'function') {
                await onRefresh();
            }
        } catch (error) {
            console.error('Error in bulk update:', error);
            alert('Failed to update coupons');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedForPrint.size === 0) {
            alert('Please select at least one coupon');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete ${selectedForPrint.size} coupons? This action cannot be undone.`)) {
            return;
        }

        setIsPrinting(true);
        try {
            const { error } = await supabase
                .from('coupons')
                .delete()
                .in('id', Array.from(selectedForPrint));

            if (error) throw error;

            alert('Selected coupons deleted successfully!');
            setSelectedForPrint(new Set());
            if (typeof onRefresh === 'function') {
                await onRefresh();
            }
        } catch (error) {
            console.error('Error in bulk delete:', error);
            alert('Failed to delete coupons');
        } finally {
            setIsPrinting(false);
        }
    };

    const getSelectedCoupons = () => {
        return employees.filter(emp => selectedForPrint.has(emp.id));
    };

    const handleBatchPrint = () => {
        if (selectedForPrint.size === 0) {
            alert('Please select at least one coupon to print');
            return;
        }
        if (onNavigateToPrint) {
            onNavigateToPrint(Array.from(selectedForPrint));
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 relative">
            <style>{`
                @media (max-width: 1023px) {
                    [data-main-content] {
                        padding-right: 1.5rem !important;
                        padding-left: 1.5rem !important;
                        padding-top: ${selectedForPrint.size > 0 ? (sidebarCollapsed ? '160px' : '500px') : '2rem'} !important;
                    }
                    [data-print-sidebar] {
                        width: 100% !important;
                        height: auto !important;
                        max-height: 80vh !important;
                        top: 64px !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: auto !important;
                        border-left: none !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                        transform: translateY(${selectedForPrint.size > 0 ? '0' : '-120%'}) !important;
                        z-index: 40;
                    }
                }
                @media (max-width: 500px) {
                    [data-print-sidebar] {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        max-height: 60vh !important;
                        transform: translateY(${selectedForPrint.size > 0 ? '0' : '-120%'}) !important;
                        border-left: none !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                        z-index: 60;
                    }
                }
                @media (max-width: 640px) {
                    .mobile-hide { display: none !important; }
                    .mobile-only { display: table-row !important; }
                    th, td { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
                    .select-cell { width: 48px; }
                    .employee-cell { width: 60%; }
                    .amount-cell { width: 20%; }
                    .action-cell { width: 20%; }
                }
                .mobile-only { display: none; }
            `}</style>

            {/* Main Content */}
            <div data-main-content className={`flex-1 p-8 transition-all duration-300 ${selectedForPrint.size > 0 ? 'desktop:pr-96' : ''}`}>
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">Issued Coupons History</h1>
                        <p className="text-slate-500 mt-1">View all issued coupons and track their status.</p>
                    </header>

                    {/* Search and Filter */}
                    <div className="mb-8 flex flex-col gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200">
                        <div className="w-full">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                </span>
                                <input
                                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-orange-500 focus:border-orange-500 transition"
                                    placeholder="Search by name, ID, or serial..."
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 min-w-0">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Calendar Filter</label>
                                <CalendarFilter onDateRangeChange={handleDateRangeChange} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-orange-500 focus:border-orange-500 transition"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as CouponStatus | 'ALL')}
                                >
                                    <option value="ALL">All Status</option>
                                    <option value={CouponStatus.PENDING}>Pending</option>
                                    <option value={CouponStatus.READY}>Ready</option>
                                    <option value={CouponStatus.RECEIVED}>Received</option>
                                    <option value={CouponStatus.ISSUED}>Issued</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">View</label>
                                <div className="flex gap-2 h-10">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${viewMode === 'grid'
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"></path></svg>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${viewMode === 'list'
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"></path></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Coupons Grid or List */}
                    {filteredEmployees.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            <p className="text-slate-400 text-lg">No coupons found.</p>
                            <p className="text-slate-300 text-sm mt-1">Issue coupons from the dashboard to see them here.</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 desktop:grid-cols-3 gap-6">
                            {paginatedEmployees.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => onSelectCoupon(emp)}
                                    className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden hover:shadow-xl hover:border-orange-400 transition-all cursor-pointer group"
                                >
                                    {/* Template Preview */}
                                    <div className="relative bg-slate-100 aspect-[16/9] overflow-hidden">
                                        <img
                                            src={templateUrl}
                                            alt="Coupon Template"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                            <div className="text-white text-center">
                                                <p className="text-xs font-bold uppercase opacity-70">Serial #</p>
                                                <p className="font-mono text-sm font-bold">{emp.serialCode}</p>
                                            </div>
                                        </div>
                                        <div className="absolute top-3 right-3 flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelectForPrint(emp.id);
                                                }}
                                                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition ${selectedForPrint.has(emp.id)
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-orange-500 text-white hover:bg-blue-500'
                                                    }`}
                                            >
                                                {selectedForPrint.has(emp.id) ? '✓ Selected' : emp.status}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Employee</p>
                                            <p className="text-lg font-bold text-slate-900">{emp.name}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Emp ID</p>
                                                <p className="text-sm font-mono text-slate-700">{emp.empId}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Amount</p>
                                                <p className="text-sm font-bold text-emerald-600">{formatRupees(emp.amount)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Issue Date</p>
                                                <p className="text-sm font-mono text-slate-700">{emp.issueDate}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Valid Till</p>
                                                <p className="text-sm font-mono text-slate-700">{emp.validTill}</p>
                                            </div>
                                        </div>

                                        {/* Status and Actions */}
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === CouponStatus.RECEIVED ? 'bg-emerald-100 text-emerald-700' :
                                                emp.status === CouponStatus.READY ? 'bg-amber-100 text-amber-700' :
                                                    emp.status === CouponStatus.ISSUED ? 'bg-blue-100 text-blue-700' :
                                                        emp.status === CouponStatus.SETTLED ? 'bg-purple-100 text-purple-700' :
                                                            'bg-slate-100 text-slate-700'
                                                }`}>
                                                {emp.status}
                                            </span>
                                            <div className="flex gap-1">
                                                {emp.status === CouponStatus.SETTLED && emp.settlement_id ? (
                                                    <>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                fetchSettlementDetails(emp.settlement_id!);
                                                            }}
                                                            title="View settlement voucher"
                                                            className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition text-xs"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                        </button>
                                                    </>
                                                ) : emp.status !== CouponStatus.RECEIVED && emp.status !== CouponStatus.SETTLED && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markReceived(emp.id);
                                                        }}
                                                        title="Mark as received"
                                                        className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition text-xs"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteCoupon(emp.id);
                                                    }}
                                                    title="Delete coupon"
                                                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition text-xs"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* View Details Link */}
                                        <button
                                            onClick={() => onSelectCoupon(emp)}
                                            className="w-full mt-2 py-2 px-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 rounded-xl text-xs font-bold uppercase tracking-wider transition"
                                        >
                                            View & Print Details →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3 text-center select-cell">
                                                <button
                                                    onClick={toggleSelectAll}
                                                    title={selectedForPrint.size === paginatedEmployees.length ? "Deselect All" : "Select All"}
                                                    className={`w-5 h-5 flex items-center justify-center rounded-md text-[8px] font-bold transition mx-auto ${selectedForPrint.size === paginatedEmployees.length && paginatedEmployees.length > 0
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-blue-100'
                                                        }`}
                                                >
                                                    {selectedForPrint.size === paginatedEmployees.length && paginatedEmployees.length > 0 ? '✓' : '○'}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider employee-cell">Employee</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider mobile-hide">Emp ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider mobile-hide">Serial</th>
                                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider amount-cell">Amount</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider mobile-hide">Issue Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider mobile-hide">Valid Till</th>
                                            <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider mobile-hide">Status</th>
                                            <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider action-cell">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {paginatedEmployees.map(emp => (
                                            <React.Fragment key={emp.id}>
                                                <tr className={`hover:bg-slate-50 transition ${selectedForPrint.has(emp.id) ? 'bg-blue-50' : ''}`}>
                                                    <td className="px-6 py-4 text-center select-cell">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSelectForPrint(emp.id);
                                                            }}
                                                            className={`w-5 h-5 flex items-center justify-center rounded-md text-[8px] font-bold transition mx-auto ${selectedForPrint.has(emp.id)
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-slate-100 text-slate-700 hover:bg-blue-100'
                                                                }`}
                                                        >
                                                            {selectedForPrint.has(emp.id) ? '✓' : '○'}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 employee-cell">
                                                        <button onClick={() => onSelectCoupon(emp)} className="font-semibold text-slate-900 hover:text-orange-600 transition truncate block w-full text-left">
                                                            {emp.name}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-bold font-mono text-slate-900 mobile-hide">{emp.empId}</td>
                                                    <td className="px-6 py-4 text-sm font-bold font-mono text-slate-900 mobile-hide">{emp.serialCode}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right amount-cell">{formatRupees(emp.amount)}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 mobile-hide">{formatDateToDDMMYYYY(emp.issueDate)}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 mobile-hide">{emp.validTill ? formatDateToDDMMYYYY(emp.validTill) : 'N/A'}</td>
                                                    <td className="px-6 py-4 text-center mobile-hide">
                                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === CouponStatus.RECEIVED ? 'bg-emerald-100 text-emerald-700' :
                                                            emp.status === CouponStatus.READY ? 'bg-amber-100 text-amber-700' :
                                                                emp.status === CouponStatus.ISSUED ? 'bg-blue-100 text-blue-700' :
                                                                    emp.status === CouponStatus.SETTLED ? 'bg-purple-100 text-purple-700' :
                                                                        'bg-slate-100 text-slate-700'
                                                            }`}>
                                                            {emp.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center action-cell">
                                                        <div className="flex gap-2 justify-center">
                                                            {emp.status === CouponStatus.SETTLED && emp.settlement_id ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => fetchSettlementDetails(emp.settlement_id!)}
                                                                        title="View settlement voucher"
                                                                        className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition"
                                                                    >
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                                    </button>
                                                                </>
                                                            ) : emp.status !== CouponStatus.RECEIVED && emp.status !== CouponStatus.SETTLED && (
                                                                <button
                                                                    onClick={() => markReceived(emp.id)}
                                                                    title="Mark Received"
                                                                    className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deleteCoupon(emp.id)}
                                                                title="Delete coupon"
                                                                className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className={`mobile-only`}>
                                                    <td colSpan={100} className="px-0 py-3">
                                                        <div className={`bg-white rounded-lg border overflow-hidden mx-4 hover:border-slate-300 transition ${selectedForPrint.has(emp.id) ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                                                            }`}>
                                                            {/* Card Header - Minimal */}
                                                            <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs text-slate-500">Emp ID: <span className="font-semibold text-slate-700">{emp.empId}</span></p>
                                                                </div>
                                                                <div className="flex-shrink-0 flex items-center gap-1">
                                                                    <span className={`flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${emp.status === CouponStatus.RECEIVED ? 'bg-emerald-100 text-emerald-700' :
                                                                        emp.status === CouponStatus.READY ? 'bg-amber-100 text-amber-700' :
                                                                            emp.status === CouponStatus.ISSUED ? 'bg-blue-100 text-blue-700' :
                                                                                emp.status === CouponStatus.SETTLED ? 'bg-purple-100 text-purple-700' :
                                                                                    'bg-slate-100 text-slate-700'
                                                                        }`}>
                                                                        {emp.status}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Card Details - Minimal */}
                                                            <div className="p-3 space-y-2">
                                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                                    <div>
                                                                        <p className="text-slate-500">Serial</p>
                                                                        <p className="font-semibold text-slate-800">{emp.serialCode}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-500">Issued</p>
                                                                        <p className="font-semibold text-slate-700">{formatDateToDDMMYYYY(emp.issueDate)}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-500">Valid</p>
                                                                        <p className="font-semibold text-slate-700">{emp.validTill ? formatDateToDDMMYYYY(emp.validTill) : 'N/A'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Pagination */}
                    {filteredEmployees.length > 0 && (
                        <div className="mt-8 flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200">
                            <div className="text-sm text-slate-600">
                                Showing <span className="font-semibold">{startIndex + 1}</span> to <span className="font-semibold">{Math.min(startIndex + ITEMS_PER_PAGE, filteredEmployees.length)}</span> of <span className="font-semibold">{filteredEmployees.length}</span> coupons
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={`px-4 py-2 rounded-lg font-semibold transition ${currentPage === 1
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                                        }`}
                                >
                                    ←
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`px-3 py-2 rounded-lg font-semibold transition ${currentPage === page
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className={`px-4 py-2 rounded-lg font-semibold transition ${currentPage === totalPages
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                                        }`}
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Stats Footer */}
                    {filteredEmployees.length > 0 && (
                        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Total</p>
                                <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                <p className="text-xs text-emerald-600 uppercase font-bold tracking-widest">Received</p>
                                <p className="text-2xl font-bold text-emerald-700">{employees.filter(e => e.status === CouponStatus.RECEIVED).length}</p>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <p className="text-xs text-amber-600 uppercase font-bold tracking-widest">Ready</p>
                                <p className="text-2xl font-bold text-amber-700">{employees.filter(e => e.status === CouponStatus.READY).length}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Pending</p>
                                <p className="text-2xl font-bold text-slate-700">{employees.filter(e => e.status === CouponStatus.PENDING).length}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Selection Sidebar */}
            <div data-print-sidebar className={`fixed right-0 top-0 h-screen w-96 bg-white border-l border-slate-200 shadow-2xl overflow-y-auto transition-transform duration-300 z-50 ${selectedForPrint.size > 0 ? 'translate-x-0' : 'translate-x-full'
                }`}>
                <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 border-b border-orange-600 z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">Print Queue</h2>
                        <p className="text-orange-100 text-sm">{selectedForPrint.size} coupon{selectedForPrint.size !== 1 ? 's' : ''} selected</p>
                    </div>
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="desktop:hidden p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                    >
                        {sidebarCollapsed ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        )}
                    </button>
                </div>

                <div className={`p-6 space-y-4 ${sidebarCollapsed ? 'hidden desktop:block' : 'block'}`}>
                    {getSelectedCoupons().length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            <p className="text-sm font-medium">No coupons selected</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                                {getSelectedCoupons().map(emp => (
                                    <div key={emp.id} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-900 text-sm">{emp.name}</p>
                                                <p className="text-xs text-slate-600 font-mono">{emp.empId}</p>
                                                <p className="text-xs text-slate-500 mt-1">{formatRupees(emp.amount)}</p>
                                            </div>
                                            <button
                                                onClick={() => toggleSelectForPrint(emp.id)}
                                                className="p-2 hover:bg-orange-200 rounded transition text-orange-600"
                                                title="Remove from print queue"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Print Summary */}
                            <div className="border-t border-slate-200 pt-4 mt-4">
                                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm text-slate-600">Total Coupons:</span>
                                        <span className="font-bold text-slate-900">{selectedForPrint.size}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-600">Total Value:</span>
                                        <span className="font-bold text-emerald-600">{formatRupees(getSelectedCoupons().reduce((sum, emp) => sum + emp.amount, 0), 0)}</span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={handleBulkMarkReceived}
                                            disabled={isPrinting || selectedForPrint.size === 0}
                                            className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition shadow-md disabled:cursor-not-allowed flex items-center justify-center"
                                            title="Mark Received"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </button>
                                        <button
                                            onClick={handleBulkDelete}
                                            disabled={isPrinting || selectedForPrint.size === 0}
                                            className="py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition shadow-md disabled:cursor-not-allowed flex items-center justify-center"
                                            title="Delete Selected"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => setSelectedForPrint(new Set())}
                                            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition flex items-center justify-center"
                                            title="Clear Selection"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleBatchPrint}
                                        disabled={isPrinting || selectedForPrint.size === 0}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold rounded-lg transition shadow-md disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 01-2-2v-4a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2zm-6-4h.01M12 8v.01M15 8v.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        Print Selected
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Settlement Voucher Modal */}
            {settlementModal.visible && settlementModal.settlement && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative">
                        <button
                            onClick={() => setSettlementModal({ ...settlementModal, visible: false })}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </button>

                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Settlement Voucher</h3>
                        <p className="text-slate-500 mb-6">Reference: {settlementModal.settlement.referenceNumber}</p>

                        <div className="space-y-4 mb-8 bg-slate-50 p-4 rounded-xl">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Total Amount:</span>
                                <span className="font-bold text-slate-900">{formatRupees(settlementModal.settlement.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Coupon Count:</span>
                                <span className="font-bold text-slate-900">{settlementModal.settlement.couponCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Settled Date:</span>
                                <span className="font-bold text-slate-900">
                                    {formatDateToDDMMYYYY(settlementModal.settlement.settledAt)}
                                </span>
                            </div>
                            {settlementModal.settlement.notes && (
                                <div>
                                    <span className="text-slate-600">Notes:</span>
                                    <p className="text-slate-900 mt-1">{settlementModal.settlement.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handlePreviewVoucher(settlementModal.settlement!)}
                                disabled={previewingVoucherId === settlementModal.settlement.id}
                                className="flex-1 py-2 px-4 bg-purple-100 hover:bg-purple-200 disabled:bg-slate-100 text-purple-700 disabled:text-slate-400 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                Preview
                            </button>
                            <button
                                onClick={() => handleDownloadVoucher(settlementModal.settlement!)}
                                disabled={previewingVoucherId === settlementModal.settlement.id}
                                className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IssuedHistory;