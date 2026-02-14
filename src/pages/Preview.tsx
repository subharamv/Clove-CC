
import React, { useState, useEffect, useRef } from 'react';
import { Employee, SystemSettings, CouponStatus } from '../types';
import { supabase } from '../supabaseClient';
import { getTemplateImageUrl, DEFAULT_TEMPLATE } from '../imageUtils';
import { renderCoupon, renderMultipleCouponsA4 } from '../utils/couponRenderer';
import { formatRupees } from '../utils/currencyUtils';
import CalendarFilter, { DateFilterType } from '../components/CalendarFilter';

interface PreviewProps {
  employees: Employee[];
  settings: SystemSettings;
  onUpdateEmployees: (employees: Employee[]) => void;
  selectedIds?: string[];
}

const Preview: React.FC<PreviewProps> = ({ employees, settings, onUpdateEmployees, selectedIds }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id || '');
  const [templateUrl, setTemplateUrl] = useState<string>(DEFAULT_TEMPLATE);
  const [isRendering, setIsRendering] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [batchPrintMode, setBatchPrintMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [cardsPerPage, setCardsPerPage] = useState(10);
  const [batchPages, setBatchPages] = useState<string[]>([]);
  const batchPrintContainerRef = useRef<HTMLDivElement>(null);
  const sidebarSearchRef = useRef<HTMLInputElement | null>(null);
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const handleDateRangeChange = (start: string, end: string, filterType: DateFilterType) => {
    setStartDate(start);
    setEndDate(end);
    setDateFilterType(filterType);
  };

  // If parent didn't provide employees (navigated directly), fetch them here
  useEffect(() => {
    if (employees && employees.length === 0) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.warn('Preview: failed to load coupons from Supabase', error);
            return;
          }

          if (!data) return;

          const transformed = (data || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            empId: row.emp_id,
            otHours: row.ot_hours || 0,
            amount: row.amount || 0,
            issueDate: row.issue_date,
            validTill: row.valid_till,
            serialCode: row.serial_code,
            status: row.status,
            created_at: row.created_at,
            couponImageUrl: row.coupon_image_url
          }));

          onUpdateEmployees(transformed);
        } catch (err) {
          console.warn('Preview: unexpected error loading coupons', err);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (employees && employees.length > 0) {
      if (selectedIds && selectedIds.length > 0) {
        setBatchPrintMode(true);
        setSelectedEmployees(new Set(selectedIds));
      } else {
        // Find coupons created in the last 5 minutes (as a proxy for "just issued")
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const recentCoupons = employees.filter(e => e.created_at && e.created_at >= fiveMinutesAgo);

        if (recentCoupons.length > 0) {
          setBatchPrintMode(true);
          setSelectedEmployees(new Set(recentCoupons.map(e => e.id)));
        }
      }
    }
  }, [employees, selectedIds]);

  useEffect(() => {
    loadTemplateImage();
  }, [settings]);

  useEffect(() => {
    if (batchPrintMode) {
      generateBatchPreviews();
    } else {
      renderCouponCanvas();
    }
  }, [selectedId, templateUrl, settings, batchPrintMode, selectedEmployees, cardsPerPage]);

  const loadTemplateImage = async () => {
    try {
      // Use template from settings first, then fall back to profile, then default
      const url = settings.backgroundTemplate || (await getTemplateImageUrl()) || DEFAULT_TEMPLATE;
      console.log('Template URL:', url);
      setTemplateUrl(url);
    } catch (err) {
      console.warn('Using default template image', err);
      setTemplateUrl(DEFAULT_TEMPLATE);
    }
  };

  const renderCouponCanvas = async () => {
    if (!activeEmployee || !templateUrl || batchPrintMode) return;

    setIsRendering(true);
    try {
      const canvas = await renderCoupon(activeEmployee, settings, templateUrl);

      // Safely render canvas using React ref
      if (canvasContainerRef.current) {
        // Remove old canvas if exists
        const oldCanvas = canvasContainerRef.current.querySelector('canvas');
        if (oldCanvas) {
          oldCanvas.remove();
        }

        // Style and append new canvas
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.borderRadius = '0.75rem';
        canvas.style.display = 'block';

        // Use innerHTML = '' to avoid React's removeChild issues if it was managing any nodes
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(canvas);
      }
    } catch (err) {
      console.error('Error rendering coupon:', err);
    } finally {
      setIsRendering(false);
    }
  };

  const generateBatchPreviews = async () => {
    if (selectedEmployees.size === 0 || !templateUrl) {
      setBatchPages([]);
      return;
    }

    const selectedEmps = Array.from(selectedEmployees)
      .map(id => employees.find(e => e.id === id))
      .filter((e): e is Employee => !!e);

    setIsRendering(true);
    try {
      const canvases = await renderMultipleCouponsA4(selectedEmps, settings, templateUrl, cardsPerPage);
      const pageDataUrls = canvases.map(canvas => canvas.toDataURL('image/png'));
      setBatchPages(pageDataUrls);
    } catch (err) {
      console.error('Error generating batch previews:', err);
    } finally {
      setIsRendering(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.empId.toLowerCase().includes(search.toLowerCase());

    // Date filtering
    let matchesDate = true;
    if (dateFilterType !== 'all' && startDate && endDate) {
      const couponDate = emp.issueDate ? new Date(emp.issueDate.split('/').reverse().join('-')).toISOString().split('T')[0] : emp.created_at?.split('T')[0] || '';
      matchesDate = couponDate >= startDate && couponDate <= endDate;
    }

    return matchesSearch && matchesDate;
  });

  const handleBatchPrint = () => {
    if (batchPages.length === 0) return;
    window.print();
  };

  const toggleEmployeeSelection = (id: string) => {
    const newSet = new Set(selectedEmployees);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedEmployees(newSet);
  };

  const activeEmployee = employees.find(e => e.id === selectedId) || filteredEmployees[0] || employees[0];

  const handlePrint = () => {
    window.print();
  };

  const handleMarkReceived = (id: string) => {
    const now = new Date().toISOString();
    const updated = employees.map(e =>
      e.id === id ? { ...e, status: CouponStatus.RECEIVED, received_at: now } : e
    );
    onUpdateEmployees(updated);
    // Persist change to Supabase (best-effort)
    (async () => {
      try {
        await supabase.from('coupons').update({
          status: CouponStatus.RECEIVED,
          received_at: now
        }).eq('id', id);
      } catch (err) {
        console.warn('Failed to update status in Supabase', err);
      }
    })();
  };

  if (!activeEmployee) return <div className="p-10">No coupons found.</div>;

  return (
    <div className="flex flex-col desktop:flex-row h-full min-h-screen relative">
      <style>{`
        @media (max-width: 1023px) {
          [data-sidebar] {
            width: 100% !important;
            height: auto !important;
            max-height: 80vh !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 40 !important;
            border-bottom: 1px solid #e2e8f0 !important;
            transform: translateY(0) !important;
          }
          [data-main-preview] {
            padding-top: ${sidebarCollapsed ? '80px' : '450px'} !important;
            width: 100% !important;
          }
          .sidebar-content {
            display: ${sidebarCollapsed ? 'none' : 'block'} !important;
          }
        }
      `}</style>

      {/* Sidebar - no-print */}
      <aside data-sidebar className="w-80 bg-white border-r border-slate-200 flex flex-col no-print desktop:h-[calc(100vh-0px)] overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
            Coupon List
          </h2>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="desktop:hidden p-2 bg-slate-100 rounded-lg text-slate-600"
          >
            {sidebarCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            )}
          </button>
        </div>

        <div className="sidebar-content flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 border-b border-slate-100 space-y-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Search</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                </span>
                <input
                  className="block w-full pl-10 pr-3 py-3 border border-slate-100 bg-slate-50 rounded-xl text-sm focus:ring-orange-500 focus:border-orange-500 transition"
                  placeholder="Search ID or Name..."
                  type="text"
                  value={search}
                  ref={sidebarSearchRef}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Calendar</label>
              <CalendarFilter onDateRangeChange={handleDateRangeChange} />
            </div>
          </div>

          {batchPrintMode && (
            <div className="p-4 bg-indigo-50 border-b border-indigo-200 sticky top-0 z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-indigo-700">SELECT COUPONS TO PRINT</p>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="lg:hidden p-2 bg-indigo-100 hover:bg-indigo-200 rounded text-indigo-700"
                  title="Close coupon list"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSelectedEmployees(new Set(employees.map(e => e.id)))}
                  className="flex-1 px-2 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedEmployees(new Set())}
                  className="flex-1 px-2 py-2 text-xs bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg font-semibold transition"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">Cards per page:</label>
                <div className="grid grid-cols-4 gap-1">
                  {[5, 10, 15, 20].map(num => (
                    <button
                      key={num}
                      onClick={() => setCardsPerPage(num)}
                      className={`px-2 py-2 rounded text-xs font-semibold transition ${cardsPerPage === num ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-2 space-y-1">
            {(batchPrintMode ? employees : filteredEmployees).map(emp => (
              batchPrintMode ? (
                <button
                  key={emp.id}
                  onClick={() => toggleEmployeeSelection(emp.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all border flex items-center gap-3 ${selectedEmployees.has(emp.id) ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'hover:bg-slate-50 border-transparent'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEmployees.has(emp.id)}
                    onChange={() => { }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{emp.name}</p>
                    <p className="text-xs text-slate-500 truncate">{emp.empId}</p>
                  </div>
                </button>
              ) : (
                <button
                  key={emp.id}
                  onClick={() => setSelectedId(emp.id)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${selectedId === emp.id
                    ? 'bg-orange-50 border-orange-200 shadow-sm'
                    : 'hover:bg-slate-50 border-transparent'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className={`text-sm font-bold ${selectedId === emp.id ? 'text-orange-900' : 'text-slate-900'}`}>
                        {emp.name}
                      </p>
                      <p className={`text-xs font-medium ${selectedId === emp.id ? 'text-orange-600' : 'text-slate-500'}`}>
                        Emp ID: {emp.empId}
                      </p>
                    </div>
                    {selectedId === emp.id && (
                      <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-full bg-orange-200 text-orange-700">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OT: {emp.otHours}h</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{formatRupees(emp.amount)}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${emp.status === CouponStatus.RECEIVED ? 'text-emerald-600' :
                      emp.status === CouponStatus.READY ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                      {emp.status}
                    </span>
                  </div>
                </button>
              )
            ))}
            {filteredEmployees.length === 0 && !batchPrintMode && (
              <div className="p-10 text-center text-slate-400 text-sm">No matches.</div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 no-print">
          {!batchPrintMode && (
            <div className="flex gap-2">
              <button
                onClick={() => handleMarkReceived(selectedId)}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition-shadow shadow-lg shadow-emerald-100 disabled:opacity-50"
                disabled={activeEmployee.status === CouponStatus.RECEIVED || activeEmployee.status === CouponStatus.SETTLED}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                Mark as Received
              </button>

              <button
                onClick={() => setSidebarCollapsed(true)}
                className="desktop:hidden flex items-center justify-center p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-700"
                title="Close coupon list"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Preview Area */}
      <section data-main-preview className="flex-1 overflow-y-auto bg-slate-100 flex flex-col items-center">
        {/* Header - no-print */}
        <div className="w-full max-w-4xl p-4 desktop:p-8 no-print flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-2">
              {batchPrintMode ? 'Batch Print Mode' : 'Coupon Preview'}
            </h2>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">
              {batchPrintMode ? `${selectedEmployees.size} coupon${selectedEmployees.size !== 1 ? 's' : ''} selected` : `${activeEmployee.name}'s Coupon`}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setBatchPrintMode(true);
                setSidebarCollapsed(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => sidebarSearchRef.current?.focus(), 320);
              }}
              className="bg-white border border-slate-200 p-3 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            </button>
            {!batchPrintMode && (
              <button
                onClick={() => setBatchPrintMode(true)}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                Batch Print
              </button>
            )}
            <button
              onClick={batchPrintMode ? handleBatchPrint : handlePrint}
              disabled={(batchPrintMode && selectedEmployees.size === 0) || isRendering}
              className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
              {batchPrintMode ? 'Print All' : 'Print Coupon'}
            </button>
            {batchPrintMode && (
              <button
                onClick={() => {
                  setBatchPrintMode(false);
                  setSelectedEmployees(new Set());
                }}
                className="flex items-center gap-2 px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-bold shadow-sm transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Print Area */}
        {batchPrintMode ? (
          <div id="batch-print-area" className="w-full flex flex-col items-center gap-8 p-4 bg-white print:p-0">
            {isRendering && (
              <div className="flex flex-col items-center justify-center py-20 no-print">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Preparing {selectedEmployees.size} coupon{selectedEmployees.size !== 1 ? 's' : ''}...</p>
              </div>
            )}

            {!isRendering && batchPages.length === 0 && (
              <div className="py-20 text-center no-print">
                <p className="text-slate-400">Select coupons from the sidebar to preview.</p>
              </div>
            )}

            {!isRendering && batchPages.map((pageData, idx) => (
              <div key={idx} className="page-container relative bg-white shadow-lg border border-slate-200 print:shadow-none print:border-none">
                <img
                  src={pageData}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-auto block"
                />
              </div>
            ))}
          </div>
        ) : (
          <div id="coupon-print-area" className="w-full flex justify-center p-4 desktop:p-8 bg-transparent">
            <div className="bg-white p-6 desktop:p-12 rounded-[1.5rem] desktop:rounded-[2.5rem] shadow-2xl border border-slate-200 max-w-4xl w-full relative print:p-0 print:border-none print:shadow-none print:m-0">
              {/* Loading Overlay */}
              {isRendering && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-[2.5rem]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Rendering coupon...</p>
                  </div>
                </div>
              )}

              {/* Canvas Coupon Renderer */}
              <div
                ref={canvasContainerRef}
                className="w-full aspect-[1048/598] rounded-xl overflow-hidden shadow-sm flex items-center justify-center bg-slate-50"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <p className="text-slate-400">Initializing canvas...</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Grid - no-print (hidden in batch print mode) */}
        {!batchPrintMode && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-4 desktop:px-8 mb-16 no-print">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status</span>
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${activeEmployee.status === CouponStatus.RECEIVED ? 'bg-emerald-400' :
                  activeEmployee.status === CouponStatus.READY ? 'bg-amber-400' : 'bg-slate-300'
                  }`}></span>
                <span className="text-sm font-bold text-slate-700">{activeEmployee.status === CouponStatus.PENDING ? 'Pending Distribution' : activeEmployee.status}</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Coupon Value</span>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M8.5 3.5a.5.5 0 11-1 0 .5.5 0 011 0zm-2 0a.5.5 0 11-1 0 .5.5 0 011 0z" clipRule="evenodd"></path></svg>
                <span className="text-sm font-bold text-emerald-600">{formatRupees(settings.amount)}</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Valid For</span>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v2h16V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a2 2 0 002 2h8a2 2 0 002-2H6z" clipRule="evenodd"></path></svg>
                <span className="text-sm font-bold text-slate-700">{settings.validityPeriod} days</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <style>{`
        #coupon-print-area canvas {
          width: 100% !important;
          height: 100% !important;
          display: block;
          border-radius: 0.75rem;
        }

        #batch-print-area {
          width: 100%;
          background: #f1f5f9;
        }

        .page-container {
          width: 100%;
          max-width: 800px;
          aspect-ratio: 210 / 297;
          margin-bottom: 2rem;
          background: white;
        }
        
        @media print {
          @page { 
            size: A4 portrait;
            margin: 0;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            width: 100% !important;
            overflow: visible !important;
          }

          body * { 
            visibility: hidden; 
          }
          
          #coupon-print-area, #coupon-print-area *,
          #batch-print-area, #batch-print-area * { 
            visibility: visible; 
          }

          .no-print, aside, header, .sidebar-content {
            display: none !important;
          }

          #batch-print-area, #coupon-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            z-index: 9999;
          }

          .page-container {
            width: 210mm !important;
            height: 297mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always;
            display: block !important;
            position: relative !important;
          }

          .page-container img {
            width: 100% !important;
            height: auto !important;
            display: block !important;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }

          #coupon-print-area canvas {
            width: 100% !important;
            height: auto !important;
            border-radius: 0 !important;
            image-rendering: -webkit-optimize-contrast;
          }
        }
      `}</style>
    </div>
  );
};

export default Preview;
