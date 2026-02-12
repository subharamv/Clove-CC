import React, { useEffect, useState } from 'react';
import { Employee, SystemSettings, CouponStatus, Settlement as SettlementType } from '../types';
import { supabase } from '../supabaseClient';
import { getTemplateImageUrl, DEFAULT_TEMPLATE } from '../imageUtils';
import { formatRupees } from '../utils/currencyUtils';
import { previewVoucher, downloadVoucherPDF, VoucherData } from '../utils/settlementVoucher';

interface SettlementModal {
    visible: boolean;
    settlement: SettlementType | null;
    loading: boolean;
}

interface PendingProps {
    employees: Employee[];
    settings: SystemSettings;
    onSelectCoupon: (employee: Employee) => void;
    onNavigateToPrint?: (selectedIds: string[]) => void;
    onRefresh?: () => Promise<void> | void;
}

const Pending: React.FC<PendingProps> = ({ employees, settings, onSelectCoupon, onNavigateToPrint, onRefresh }) => {
    const [templateUrl, setTemplateUrl] = useState<string>(DEFAULT_TEMPLATE);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<CouponStatus | 'ALL'>('ALL');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
    const [isPrinting, setIsPrinting] = useState(false);
    const [printReviewMode, setPrintReviewMode] = useState(false);
    const [settlementModal, setSettlementModal] = useState<SettlementModal>({
        visible: false,
        settlement: null,
        loading: false
    });
    const [previewingVoucherId, setPreviewingVoucherId] = useState<string | null>(null);

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
    }, [search, filterStatus]);

    const pendingCoupons = employees.filter(emp => emp.status !== CouponStatus.RECEIVED);

    const filteredCoupons = pendingCoupons.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
            emp.empId.toLowerCase().includes(search.toLowerCase()) ||
            emp.serialCode.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || emp.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredCoupons.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCoupons = filteredCoupons.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

            if (typeof onRefresh === 'function') {
                await onRefresh();
            }

        } catch (error) {
            console.error('Unexpected error updating status:', error);
            alert('Failed to update coupon status');
        }
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

    const toggleSelectForPrint = (id: string) => {
        const newSelected = new Set(selectedForPrint);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedForPrint(newSelected);
    };

    const getSelectedCoupons = () => {
        return filteredCoupons.filter(emp => selectedForPrint.has(emp.id));
    };

    const handleBatchPrint = async () => {
        if (selectedForPrint.size === 0) {
            alert('Please select at least one coupon to print');
            return;
        }

        if (onNavigateToPrint) {
            onNavigateToPrint(Array.from(selectedForPrint));
            return;
        }

        setIsPrinting(true);
        try {
            // Trigger browser print dialog
            window.print();

            // Mark selected coupons as printed
            const printPromises = Array.from(selectedForPrint).map(id =>
                supabase.from('coupons').update({ print_status: 'PRINTED' }).eq('id', id)
            );

            await Promise.all(printPromises);

            // Clear selection and show success message
            setSelectedForPrint(new Set());
            alert('Coupons marked as printed successfully!');
        } catch (error) {
            console.error('Error marking as printed:', error);
            alert('Failed to mark coupons as printed');
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Main Content */}
            <div className={`flex-1 p-8 transition-all duration-300 ${selectedForPrint.size > 0 ? 'pr-96' : ''}`}>
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">Pending Coupons</h1>
                        <p className="text-slate-500 mt-1">Coupons awaiting distribution or receipt confirmation.</p>
                    </header>

                    {pendingCoupons.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <svg className="w-16 h-16 mx-auto text-emerald-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            <p className="text-slate-400 text-lg font-semibold">All coupons received! 🎉</p>
                            <p className="text-slate-300 text-sm mt-1">Great job! All issued coupons have been marked as received.</p>
                        </div>
                    ) : (
                        <>
                            {/* Search and Filter */}
                            <div className="mb-8 flex flex-col md:flex-row gap-4 bg-white p-6 rounded-2xl border border-slate-200">
                                <div className="flex-1">
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
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-orange-500 focus:border-orange-500 transition"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as CouponStatus | 'ALL')}
                                    >
                                        <option value="ALL">All Status</option>
                                        <option value={CouponStatus.PENDING}>Pending</option>
                                        <option value={CouponStatus.READY}>Ready</option>
                                        <option value={CouponStatus.ISSUED}>Issued</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">View</label>
                                    <div className="flex gap-2 h-10">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${viewMode === 'grid'
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${viewMode === 'list'
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Coupons Grid or List */}
                            {filteredCoupons.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                                    <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                    <p className="text-slate-400 text-lg">No pending coupons found.</p>
                                    <p className="text-slate-300 text-sm mt-1">Adjust your filters to see more coupons.</p>
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                    {paginatedCoupons.map(emp => (
                                        <div
                                            key={emp.id}
                                            onClick={() => onSelectCoupon(emp)}
                                            className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden hover:shadow-xl hover:border-amber-400 transition-all cursor-pointer group bg-gradient-to-br from-white to-amber-50"
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
                                                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition ${selectedForPrint.has(emp.id)
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-amber-500 text-white hover:bg-blue-500'
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

                                                <div>
                                                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Issue Date</p>
                                                    <p className="text-sm font-mono text-slate-700">{emp.issueDate}</p>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2 pt-4 border-t border-amber-100">
                                                    {emp.status === CouponStatus.SETTLED && emp.settlement_id ? (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    fetchSettlementDetails(emp.settlement_id!);
                                                                }}
                                                                className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition"
                                                                title="View settlement voucher"
                                                            >
                                                                View Voucher
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    markReceived(emp.id);
                                                                }}
                                                                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition"
                                                            >
                                                                ✓ Mark Received
                                                            </button>
                                                            <button
                                                                onClick={() => onSelectCoupon(emp)}
                                                                className="flex-1 py-2 px-3 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                                                            >
                                                                View Details
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
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
                                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Select</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Employee</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Emp ID</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Serial</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Amount</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Issue Date</th>
                                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {paginatedCoupons.map(emp => (
                                                    <tr key={emp.id} className={`hover:bg-slate-50 transition ${selectedForPrint.has(emp.id) ? 'bg-blue-50' : ''}`}>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSelectForPrint(emp.id);
                                                                }}
                                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${selectedForPrint.has(emp.id)
                                                                    ? 'bg-blue-500 text-white'
                                                                    : 'bg-slate-100 text-slate-700 hover:bg-blue-100'
                                                                    }`}
                                                            >
                                                                {selectedForPrint.has(emp.id) ? '✓' : '○'}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button onClick={() => onSelectCoupon(emp)} className="font-semibold text-slate-900 hover:text-orange-600 transition">
                                                                {emp.name}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-mono text-slate-700">{emp.empId}</td>
                                                        <td className="px-6 py-4 text-sm font-mono text-slate-700">{emp.serialCode}</td>
                                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">{formatRupees(emp.amount)}</td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">{emp.issueDate}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === CouponStatus.READY ? 'bg-amber-100 text-amber-700' :
                                                                emp.status === CouponStatus.ISSUED ? 'bg-blue-100 text-blue-700' :
                                                                    emp.status === CouponStatus.SETTLED ? 'bg-purple-100 text-purple-700' :
                                                                        'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                {emp.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex gap-2 justify-center">
                                                                {emp.status === CouponStatus.SETTLED && emp.settlement_id ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => fetchSettlementDetails(emp.settlement_id!)}
                                                                            title="View settlement voucher"
                                                                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-xs font-semibold"
                                                                        >
                                                                            View Voucher
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => markReceived(emp.id)}
                                                                            title="Mark as received"
                                                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-xs font-semibold"
                                                                        >
                                                                            Mark Received
                                                                        </button>
                                                                        <button
                                                                            onClick={() => onSelectCoupon(emp)}
                                                                            title="View details"
                                                                            className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition text-xs font-semibold border border-amber-300"
                                                                        >
                                                                            Details
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Pagination */}
                            {filteredCoupons.length > 0 && (
                                <div className="mt-8 flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200">
                                    <div className="text-sm text-slate-600">
                                        Showing <span className="font-semibold">{startIndex + 1}</span> to <span className="font-semibold">{Math.min(startIndex + ITEMS_PER_PAGE, filteredCoupons.length)}</span> of <span className="font-semibold">{filteredCoupons.length}</span> coupons
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
                                            ← Previous
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
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Summary Stats */}
                            {filteredCoupons.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-6 mt-8">
                                    <div>
                                        <p className="text-xs text-amber-600 uppercase font-bold tracking-widest mb-1">Pending</p>
                                        <p className="text-3xl font-bold text-amber-700">{filteredCoupons.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-amber-600 uppercase font-bold tracking-widest mb-1">Total Value</p>
                                        <p className="text-3xl font-bold text-amber-700">{formatRupees(filteredCoupons.reduce((sum, emp) => sum + emp.amount, 0), 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-600 uppercase font-bold tracking-widest mb-1">Action Needed</p>
                                        <p className="text-lg font-semibold text-slate-700">Mark each as received to complete</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Floating Print Queue Button */}
                {selectedForPrint.size > 0 && (
                    <button
                        onClick={() => document.querySelector('[data-print-sidebar]')?.scrollIntoView()}
                        className="fixed bottom-8 right-8 z-40 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-full shadow-2xl transition-all hover:shadow-3xl hover:scale-110 animate-pulse"
                        title="Open print queue"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 01-2-2v-4a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2zm-6-4h.01M12 8v.01M15 8v.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        <span className="text-lg font-bold">{selectedForPrint.size}</span>
                        <span className="hidden sm:inline">Ready to Print</span>
                    </button>
                )}
            </div>

            {/* Print Selection Sidebar */}
            <div data-print-sidebar className={`fixed right-0 top-0 h-screen w-96 bg-white border-l border-slate-200 shadow-2xl overflow-y-auto transition-transform duration-300 ${selectedForPrint.size > 0 ? 'translate-x-0' : 'translate-x-full'
                }`}>
                <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 border-b border-orange-600">
                    <h2 className="text-xl font-bold mb-2">Print Queue</h2>
                    <p className="text-orange-100 text-sm">{selectedForPrint.size} coupon{selectedForPrint.size !== 1 ? 's' : ''} selected</p>
                </div>

                <div className="p-6 space-y-4">
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
                                                className="p-1 hover:bg-orange-200 rounded transition text-orange-600"
                                                title="Remove from print queue"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
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
                                    <button
                                        onClick={handleBatchPrint}
                                        disabled={isPrinting || selectedForPrint.size === 0}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold rounded-lg transition shadow-md disabled:cursor-not-allowed"
                                    >
                                        {isPrinting ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 01-2-2v-4a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2zm-6-4h.01M12 8v.01M15 8v.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                Print Selected
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setSelectedForPrint(new Set())}
                                        className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                                    >
                                        Clear Selection
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
                                    {new Date(settlementModal.settlement.settledAt).toLocaleDateString()}
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

export default Pending;
