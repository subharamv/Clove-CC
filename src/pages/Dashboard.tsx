
import React, { useRef, useState } from 'react';
import { Employee, CouponStatus, SystemSettings } from '../types';
import { supabase } from '../supabaseClient';
import SettingsService from '../utils/settingsService';
import { getRupeeSymbol, formatRupees } from '../utils/currencyUtils';
import { parseDateFromCSV, getValidityDate } from '../utils/dateUtils';

interface DashboardProps {
  employees: Employee[];
  settings: SystemSettings;
  onNavigateToPreview: () => void;
  onNavigateToIssuedHistory?: () => void;
  onNavigateToPending?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  employees,
  settings,
  onNavigateToPreview,
  onNavigateToIssuedHistory,
  onNavigateToPending
}) => {
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showSingleCoupon, setShowSingleCoupon] = useState(false);
  const [lastUploadedCoupons, setLastUploadedCoupons] = useState<any[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [pendingUploadRecords, setPendingUploadRecords] = useState<any[]>([]);
  const [confirmAmount, setConfirmAmount] = useState(settings.amount);
  const [selectedCouponConfig, setSelectedCouponConfig] = useState<string | null>(null);
  const [singleCoupon, setSingleCoupon] = useState({
    name: '',
    empId: '',
    otHours: 0,
    issueDate: new Date().toISOString().split('T')[0],
    couponAmountId: ''
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getAvailableCouponAmounts = () => {
    return settings.couponAmounts && settings.couponAmounts.length > 0
      ? settings.couponAmounts
      : [{ id: 'default', amount: settings.amount, validityPeriod: settings.validityPeriod, isDefault: true }];
  };

  const getDefaultCouponAmount = () => {
    const amounts = getAvailableCouponAmounts();
    return amounts.find(a => a.isDefault) || amounts[0];
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.empId.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalIssued: employees.length,
    pending: employees.filter(e =>
      e.status === CouponStatus.PENDING ||
      e.status === CouponStatus.READY ||
      e.status === CouponStatus.ISSUED
    ).length,
    totalSpent: employees.reduce((sum, e) => sum + e.amount, 0),
    pendingAmount: employees
      .filter(e => e.status === CouponStatus.PENDING || e.status === CouponStatus.READY || e.status === CouponStatus.ISSUED)
      .reduce((sum, e) => sum + e.amount, 0),
    settlementAmount: employees
      .filter(e => e.status === CouponStatus.RECEIVED)
      .reduce((sum, e) => sum + e.amount, 0)
  };

  const handleCSVClick = () => fileInputRef.current?.click();

  const uploadCSV = async (file: File) => {
    setUploading(true);
    try {
      // Get current user for created_by field
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('User session not found');
      }

      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());

      if (lines.length < 2) {
        alert('CSV must have at least header and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const empIdIdx = headers.findIndex(h => h.includes('emp') || h.includes('id'));
      const otHoursIdx = headers.findIndex(h => h.includes('ot') || h.includes('hour') || h.includes('overtime'));
      const issueDateIdx = headers.findIndex(h => h.includes('issue') && h.includes('date'));
      const validTillIdx = headers.findIndex(h => h.includes('valid') || h.includes('expiry') || h.includes('till'));

      if (nameIdx === -1 || empIdIdx === -1) {
        alert('CSV must have "name" and "emp_id" (or similar) columns');
        return;
      }

      const records: any[] = [];
      let serialCounter = settings.startNumber;

      // Helper: find next available serial (avoids duplicates)
      const findNextAvailableSerial = async (startNum: number): Promise<{ serial: string; usedNumber: number }> => {
        let candidate = startNum;
        // Safety cap to avoid infinite loops in pathological cases
        const maxAttempts = 1000000;
        let attempts = 0;

        while (attempts < maxAttempts) {
          const serialCandidate = `${settings.prefix}${candidate}${settings.suffix}`;
          const { data: existing, error: checkErr } = await supabase
            .from('coupons')
            .select('id')
            .eq('serial_code', serialCandidate)
            .limit(1);

          if (checkErr) throw checkErr;

          if (!existing || existing.length === 0) {
            return { serial: serialCandidate, usedNumber: candidate };
          }

          candidate++;
          attempts++;
        }

        throw new Error('Unable to find available serial number');
      };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 2) continue;

        const name = cols[nameIdx] || '';
        const empId = cols[empIdIdx] || '';
        const otHours = otHoursIdx !== -1 ? parseFloat(cols[otHoursIdx]) || 0 : 0;

        if (!name || !empId) continue;

        // Auto-generate serial code (ensure uniqueness)
        const { serial: serialCode, usedNumber } = await findNextAvailableSerial(serialCounter);
        serialCounter = usedNumber + 1;

        // Parse issue date from CSV or use today's date
        let issueDate = new Date().toISOString().split('T')[0];
        if (issueDateIdx !== -1 && cols[issueDateIdx]) {
          const parsedDate = parseDateFromCSV(cols[issueDateIdx]);
          if (parsedDate) {
            issueDate = parsedDate;
          }
        }

        // Parse valid till from CSV or calculate from validity period
        let validTill = getValidityDate(issueDate, settings.validityPeriod);
        if (validTillIdx !== -1 && cols[validTillIdx]) {
          const parsedDate = parseDateFromCSV(cols[validTillIdx]);
          if (parsedDate) {
            validTill = parsedDate;
          }
        }

        // Generate a unique ID for the coupon
        const couponId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        records.push({
          id: couponId,
          name,
          emp_id: empId,
          ot_hours: otHours,
          amount: settings.amount,
          serial_code: serialCode,
          issue_date: issueDate,
          valid_till: validTill,
          status: CouponStatus.ISSUED,
          created_by: session.user.id,
          created_at: new Date().toISOString()
        });
      }

      if (records.length === 0) {
        alert('No valid records found in CSV');
        return;
      }

      setPendingUploadRecords(records);
      setConfirmAmount(settings.amount);
      setShowMappingModal(true);
    } catch (err: any) {
      console.error('Error parsing CSV:', err);
      alert('Failed to parse CSV: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const executeUpload = async () => {
    setUploading(true);
    try {
      // Get the selected coupon config
      const selectedConfig = getAvailableCouponAmounts().find(
        c => c.id === (selectedCouponConfig || getDefaultCouponAmount().id)
      ) || getDefaultCouponAmount();

      // Apply the selected amount and validity to all records
      const finalRecords = pendingUploadRecords.map(r => {
        const issueDate = r.issue_date;
        const validTill = getValidityDate(issueDate, selectedConfig.validityPeriod);
        return {
          ...r,
          amount: selectedConfig.amount,
          valid_till: validTill
        };
      });

      console.log('Uploading confirmed coupons:', finalRecords);
      const { data, error } = await supabase.from('coupons').insert(finalRecords);

      if (error) {
        console.error('Supabase insert error:', error);
        alert('Upload failed: ' + error.message);
        return;
      }

      // Persist advanced startNumber
      const lastUsedNumber = parseInt(finalRecords[finalRecords.length - 1].serial_code.replace(settings.prefix, '').replace(settings.suffix, ''));
      try {
        const saved = await SettingsService.saveSettings({ ...settings, startNumber: lastUsedNumber + 1 });
        if (!saved) console.warn('Failed to persist updated start number');
      } catch (e) {
        console.warn('Error saving updated start number:', e);
      }

      setLastUploadedCoupons(finalRecords);
      setShowMappingModal(false);
      setShowSuccessModal(true);
      setSearch('');
    } catch (err: any) {
      console.error('Error uploading coupons:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Update a pending record's date
  const updatePendingRecord = (index: number, field: string, value: string) => {
    const updated = [...pendingUploadRecords];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setPendingUploadRecords(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCSV(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      uploadCSV(file);
    } else {
      alert('Please drop a CSV file');
    }
  };

  const downloadCSVTTemplate = () => {
    const csvContent = [
      'name,empId,otHours,amount,issueDate,validTill,serialCode,status',
      `John Doe,EMP001,8,${settings.amount},${new Date().toLocaleDateString()},${new Date(Date.now() + settings.validityPeriod * 24 * 60 * 60 * 1000).toLocaleDateString()},SERIAL001,ISSUED`,
      `Jane Smith,EMP002,6,${settings.amount},${new Date().toLocaleDateString()},${new Date(Date.now() + settings.validityPeriod * 24 * 60 * 60 * 1000).toLocaleDateString()},SERIAL002,ISSUED`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coupon_template_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const createSingleCoupon = async () => {
    if (!singleCoupon.name || !singleCoupon.empId) {
      alert('Please fill in all required fields');
      return;
    }

    setUploading(true);
    try {
      // Get current user for created_by field
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('User session not found');
      }

      // Get the selected coupon config
      const selectedConfig = getAvailableCouponAmounts().find(
        c => c.id === (singleCoupon.couponAmountId || getDefaultCouponAmount().id)
      ) || getDefaultCouponAmount();

      // Use the selected issue date or default to today
      const issueDate = singleCoupon.issueDate || new Date().toISOString().split('T')[0];
      const validTill = getValidityDate(issueDate, selectedConfig.validityPeriod);

      // Generate a unique ID for the coupon
      const couponId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // Find and reserve a next available serial code (avoid duplicates)
      const findNextAvailableSerialSingle = async (startNum: number): Promise<{ serial: string; usedNumber: number }> => {
        let candidate = startNum;
        const maxAttempts = 1000000;
        let attempts = 0;

        while (attempts < maxAttempts) {
          const serialCandidate = `${settings.prefix}${candidate}${settings.suffix}`;
          const { data: existing, error: checkErr } = await supabase
            .from('coupons')
            .select('id')
            .eq('serial_code', serialCandidate)
            .limit(1);

          if (checkErr) throw checkErr;
          if (!existing || existing.length === 0) {
            return { serial: serialCandidate, usedNumber: candidate };
          }
          candidate++;
          attempts++;
        }

        throw new Error('Unable to find available serial number');
      };

      const { serial: reservedSerial, usedNumber } = await findNextAvailableSerialSingle(settings.startNumber);
      const nextStartNumber = usedNumber + 1;

      // Map to database column names (snake_case)
      const newCoupon = {
        id: couponId,
        name: singleCoupon.name,
        emp_id: singleCoupon.empId,
        ot_hours: singleCoupon.otHours || 0,
        amount: selectedConfig.amount,
        issue_date: issueDate,
        valid_till: validTill,
        serial_code: reservedSerial,
        status: CouponStatus.ISSUED,
        created_by: session.user.id,
        created_at: new Date().toISOString()
      };

      console.log('Creating coupon:', newCoupon);
      const { data, error } = await supabase.from('coupons').insert([newCoupon]);

      if (error) {
        console.error('Supabase insert error:', error);
        alert('Failed to create coupon: ' + error.message);
        return;
      }

      console.log('Coupon created successfully:', data);
      // Persist advanced start number for next generation
      try {
        const saved = await SettingsService.saveSettings({ ...settings, startNumber: nextStartNumber });
        if (!saved) console.warn('Failed to persist updated start number after creating single coupon');
      } catch (e) {
        console.warn('Error saving updated start number:', e);
      }

      setLastUploadedCoupons([newCoupon]);
      setShowSuccessModal(true);
      setSingleCoupon({ name: '', empId: '', otHours: 0, issueDate: new Date().toISOString().split('T')[0], couponAmountId: '' });
      setShowSingleCoupon(false);
    } catch (err: any) {
      console.error('Error creating coupon:', err);
      alert('Failed to create coupon: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <header className="mb-12">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm">Real-time coupon management system</p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Issued Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:border-blue-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3">Total Issued</p>
              <p className="text-4xl font-black text-slate-900 group-hover:scale-110 transition-transform origin-left">{stats.totalIssued}</p>
            </div>
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-2xl shadow-inner group-hover:bg-blue-100 transition-colors">
              ✓
            </div>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:border-amber-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3">Pending</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-400">{getRupeeSymbol()}</span>
                <p className="text-4xl font-black text-slate-900 group-hover:scale-110 transition-transform origin-left">{stats.pendingAmount}</p>
              </div>
            </div>
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-2xl shadow-inner group-hover:bg-amber-100 transition-colors">
              ⌛
            </div>
          </div>
        </div>

        {/* Total Value Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:border-emerald-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3">Total Value</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-400">{getRupeeSymbol()}</span>
                <p className="text-4xl font-black text-slate-900 group-hover:scale-110 transition-transform origin-left">{stats.totalSpent}</p>
              </div>
            </div>
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-2xl shadow-inner group-hover:bg-emerald-100 transition-colors">
              💰
            </div>
          </div>
        </div>

        {/* Settlement Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:border-indigo-400 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3">Settlement</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-400">{getRupeeSymbol()}</span>
                <p className="text-4xl font-black text-slate-900 group-hover:scale-110 transition-transform origin-left">{stats.settlementAmount}</p>
              </div>
            </div>
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-2xl shadow-inner group-hover:bg-indigo-100 transition-colors">
              🤝
            </div>
          </div>
        </div >
      </div >

      {/* CSV Upload Area */}
      < section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100" >
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Issue Coupons</h2>
            <p className="text-slate-500 text-sm">Upload employee CSV to bulk-issue coupons</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadCSVTTemplate}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 transition flex items-center gap-1"
            >
              <img width="20" height="20" className="mr-2" src="https://img.icons8.com/ios-glyphs/30/FFFFFF/download--v1.png" alt="download--v1" />
              CSV Template
            </button>
            <button
              onClick={() => setShowSingleCoupon(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition flex items-center gap-1"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Single Coupon
            </button>
          </div>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleCSVClick}
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer ${dragActive
            ? 'border-orange-500 bg-orange-50'
            : 'border-slate-200 hover:border-orange-400 hover:bg-orange-50'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 text-3xl">
              📁
            </div>
            <p className="text-xl font-bold text-slate-900">
              {uploading ? 'Uploading...' : 'Drag & Drop CSV File'}
            </p>
            <p className="text-slate-500 mt-2">or click to browse from your computer</p>
            <p className="text-xs text-slate-400 mt-10">Simple format: .csv with columns "name" and "emp_id". Serial numbers auto-generated with prefix "{settings.prefix}" and auto-calculated dates.</p>
          </div>
        </div>
      </section >

      {/* Single Coupon Form Modal */}
      {
        showSingleCoupon && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Create Single Coupon</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Employee Name</label>
                  <input
                    type="text"
                    value={singleCoupon.name}
                    onChange={(e) => setSingleCoupon({ ...singleCoupon, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Employee ID</label>
                  <input
                    type="text"
                    value={singleCoupon.empId}
                    onChange={(e) => setSingleCoupon({ ...singleCoupon, empId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="EMP001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">OT Hours</label>
                  <input
                    type="number"
                    value={singleCoupon.otHours}
                    onChange={(e) => setSingleCoupon({ ...singleCoupon, otHours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Issue Date</label>
                  <input
                    type="date"
                    value={singleCoupon.issueDate}
                    onChange={(e) => setSingleCoupon({ ...singleCoupon, issueDate: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Coupon Amount</label>
                  <select
                    value={singleCoupon.couponAmountId || (getDefaultCouponAmount().id || '')}
                    onChange={(e) => setSingleCoupon({ ...singleCoupon, couponAmountId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    {getAvailableCouponAmounts().map((config) => (
                      <option key={config.id} value={config.id}>
                        {getRupeeSymbol()} {config.amount} ({config.validityPeriod} days) {config.isDefault ? '(Default)' : ''} {config.isVisible === false ? '(Hidden)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl">
                  {(() => {
                    const selectedConfig = getAvailableCouponAmounts().find(
                      c => c.id === (singleCoupon.couponAmountId || getDefaultCouponAmount().id)
                    ) || getDefaultCouponAmount();
                    const validTill = getValidityDate(singleCoupon.issueDate, selectedConfig.validityPeriod);
                    return (
                      <p className="text-sm text-indigo-700">
                        <strong>Coupon Details:</strong><br />
                        Amount: {formatRupees(selectedConfig.amount)}<br />
                        Valid Till: {validTill} ({selectedConfig.validityPeriod} days)<br />
                        Serial Code: {settings.prefix}{settings.startNumber}{settings.suffix}
                      </p>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSingleCoupon(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createSingleCoupon}
                  disabled={uploading}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {uploading ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Recent Coupons Table */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Coupons</h2>
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
            </span>
            <input
              className="w-full pl-12 pr-4 py-3 border border-slate-100 bg-slate-50 rounded-xl text-sm focus:ring-orange-500 focus:border-orange-500 transition"
              placeholder="Search employee..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Sl No</th>
                <th className="px-8 py-5">Employee Name</th>
                <th className="px-8 py-5">Employee ID</th>
                <th className="px-8 py-5">Serial Code</th>
                <th className="px-8 py-5">Issue Date</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-slate-400">
                    {employees.length === 0 ? 'No coupons issued yet. Upload CSV to get started.' : 'No results found.'}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition">
                    <td className="px-8 py-5 text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                    <td className="px-8 py-5 font-medium text-slate-900">{emp.name}</td>
                    <td className="px-8 py-5 text-slate-500">{emp.empId}</td>
                    <td className="px-8 py-5 font-mono text-xs text-slate-400">{emp.serialCode}</td>
                    <td className="px-8 py-5 text-slate-500">{emp.issueDate}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === CouponStatus.RECEIVED ? 'bg-emerald-100 text-emerald-700' :
                        emp.status === CouponStatus.ISSUED ? 'bg-blue-100 text-blue-700' :
                          emp.status === CouponStatus.READY ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-500'
                        }`}>
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mapping & Confirmation Modal */}
      {
        showMappingModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-4xl w-full shadow-2xl border border-white/20 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Verify Import Data</h3>
                  <p className="text-slate-500 text-sm">Review the mapped data from your CSV before issuing coupons.</p>
                </div>
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition"
                >
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl">💰</div>
                  <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Select Coupon Amount</p>
                    <p className="text-slate-600 text-sm">Choose an amount for <span className="font-bold">{pendingUploadRecords.length}</span> coupons.</p>
                  </div>
                </div>
                <select
                  value={selectedCouponConfig || (getDefaultCouponAmount().id || '')}
                  onChange={(e) => setSelectedCouponConfig(e.target.value)}
                  className="px-4 py-3 bg-white border border-amber-200 rounded-xl font-bold text-lg text-slate-900 focus:ring-amber-500 focus:border-amber-500"
                >
                  {getAvailableCouponAmounts().map((config) => (
                    <option key={config.id} value={config.id}>
                      {getRupeeSymbol()} {config.amount} ({config.validityPeriod} days) {config.isDefault ? '(Default)' : ''} {config.isVisible === false ? '(Hidden)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl mb-8">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4">Employee Name</th>
                      <th className="px-6 py-4">Employee ID</th>
                      <th className="px-6 py-4">OT Hours</th>
                      <th className="px-6 py-4">Serial Code</th>
                      <th className="px-6 py-4">Issue Date</th>
                      <th className="px-6 py-4">Valid Till</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {pendingUploadRecords.map((rec, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-900">{rec.name}</td>
                        <td className="px-6 py-3 text-slate-500 font-mono text-xs">{rec.emp_id}</td>
                        <td className="px-6 py-3 text-amber-600 font-bold">{rec.ot_hours}h</td>
                        <td className="px-6 py-3 text-indigo-600 font-mono text-xs">{rec.serial_code}</td>
                        <td className="px-6 py-3">
                          <input
                            type="date"
                            value={rec.issue_date}
                            onChange={(e) => updatePendingRecord(i, 'issue_date', e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="date"
                            value={rec.valid_till}
                            onChange={(e) => updatePendingRecord(i, 'valid_till', e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel & Re-upload
                </button>
                <button
                  onClick={executeUpload}
                  disabled={uploading}
                  className="flex-[2] py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                  ) : (
                    <>Confirm & Issue {pendingUploadRecords.length} Coupons</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Success Modal */}
      {
        showSuccessModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-5xl mb-8 animate-bounce">
                  🎉
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4">Coupons Issued!</h3>
                <p className="text-slate-500 mb-10 leading-relaxed">
                  Successfully issued <span className="font-bold text-slate-900">{lastUploadedCoupons.length}</span> coupons.
                  What would you like to do next?
                </p>

                <div className="grid grid-cols-1 gap-4 w-full">
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      onNavigateToPreview();
                    }}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    Print Coupons Now
                  </button>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      window.location.reload();
                    }}
                    className="w-full py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default Dashboard;
