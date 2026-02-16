import React, { useState, useEffect } from 'react';
import { Employee, CouponStatus, Settlement as SettlementType } from '../types';
import { supabase } from '../supabaseClient';
import { formatDateToDDMMYYYY } from '../utils/dateFormatUtils';
// html2canvas and jsPDF are loaded dynamically inside generateVoucherPdf

interface SettlementProps {
  employees: Employee[];
  onUpdateEmployees?: (employees: Employee[]) => void;
  userProfile?: any;
}

const Settlement: React.FC<SettlementProps> = ({ employees, onUpdateEmployees, userProfile }) => {
  if (!userProfile?.is_admin) return null;
  const [view, setView] = useState<'NEW' | 'HISTORY'>('NEW');
  const [settlements, setSettlements] = useState<SettlementType[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedHistoryVendor, setSelectedHistoryVendor] = useState<string>('all');
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementType | null>(null);
  const [settlementCoupons, setSettlementCoupons] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // RECEIVED coupons are eligible for settlement
  const receivableCoupons = employees.filter(emp => {
    const isReceived = emp.status === CouponStatus.RECEIVED;
    if (!isReceived) return false;

    if (selectedVendor === 'all') {
      // Show ALL received coupons (including those scanned by admins)
      return true;
    }
    
    // Show only coupons received by the selected vendor
    return emp.received_by === selectedVendor;
  });

  const filteredReceivable = receivableCoupons.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.empId.toLowerCase().includes(search.toLowerCase()) ||
    emp.serialCode.toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = receivableCoupons.reduce((sum, emp) => sum + emp.amount, 0);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, is_admin, access');
      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  useEffect(() => {
    if (view === 'HISTORY') {
      loadSettlementHistory();
    }
  }, [view]);

  const loadSettlementHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .order('settled_at', { ascending: false });

      if (error) throw error;

      setSettlements(data.map(s => ({
        id: s.id,
        totalAmount: s.total_amount,
        couponCount: s.coupon_count,
        settledBy: s.settled_by,
        vendorId: s.vendor_id,
        settledAt: s.settled_at,
        referenceNumber: s.reference_number,
        notes: s.notes
      })));
    } catch (err) {
      console.error('Error loading settlement history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    if (deleteConfirm !== settlementId) {
      setDeleteConfirm(settlementId);
      return;
    }

    setDeletingId(settlementId);
    try {
      // Revert coupons from SETTLED back to RECEIVED
      const { error: couponError } = await supabase
        .from('coupons')
        .update({
          status: CouponStatus.RECEIVED,
          settlement_id: null
        })
        .eq('settlement_id', settlementId);

      if (couponError) throw couponError;

      // Delete the settlement record
      const { error: settleError } = await supabase
        .from('settlements')
        .delete()
        .eq('id', settlementId);

      if (settleError) throw settleError;

      // Update local state
      setSettlements(settlements.filter(s => s.id !== settlementId));

      // Update employees if callback is provided
      if (onUpdateEmployees) {
        const updatedEmployees = employees.map(emp =>
          emp.settlement_id === settlementId
            ? { ...emp, status: CouponStatus.RECEIVED }
            : emp
        );
        onUpdateEmployees(updatedEmployees);
      }

      setDeleteConfirm(null);
      alert('Settlement deleted successfully and coupons reverted to RECEIVED status.');
    } catch (err: any) {
      console.error('Error deleting settlement:', err);
      alert('Failed to delete settlement: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const loadSettlementDetails = async (settlement: SettlementType) => {
    setShowDetailsModal(true);
    setSelectedSettlement(settlement);
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('settlement_id', settlement.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSettlementCoupons(data || []);
    } catch (err) {
      console.error('Error loading settlement coupons:', err);
      alert('Failed to load coupon details: ' + (err as any).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const downloadSettlementAsCSV = (settlement: SettlementType) => {
    if (settlementCoupons.length === 0) {
      alert('No coupons to download');
      return;
    }

    // Prepare CSV header
    const headers = ['Serial Code', 'Employee Name', 'Employee ID', 'Amount', 'Issue Date', 'Valid Till', 'OT Hours', 'Received By'];
    const rows = settlementCoupons.map(coupon => [
      coupon.serial_code,
      coupon.name,
      coupon.emp_id,
      coupon.amount || 0,
      formatDateToDDMMYYYY(coupon.issue_date),
      formatDateToDDMMYYYY(coupon.valid_till),
      coupon.ot_hours || 0,
      vendors.find(v => v.user_id === coupon.received_by)?.email || 'Unknown'
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add summary at the end
    const summary = [
      '',
      'Summary',
      `Reference Number,${settlement.referenceNumber}`,
      `Total Amount,₹${settlement.totalAmount.toLocaleString()}`,
      `Coupon Count,${settlement.couponCount}`,
      `Settlement Date,${formatDateToDDMMYYYY(settlement.settledAt)}`,
      `Notes,"${settlement.notes || ''}"`
    ].join('\n');

    const fullCSV = csvContent + '\n' + summary;

    // Download the file
    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `settlement_${settlement.referenceNumber}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSettlement = async () => {
    if (receivableCoupons.length === 0) {
      alert('No RECEIVED coupons to settle.');
      return;
    }

    if (!referenceNumber.trim()) {
      alert('Please enter a reference number for this settlement.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No active session');

      // 1. Create Settlement Record
      const { data: settlement, error: sError } = await supabase
        .from('settlements')
        .insert([{
          total_amount: totalAmount,
          coupon_count: receivableCoupons.length,
          settled_by: session.user.id,
          vendor_id: selectedVendor !== 'all' ? selectedVendor : null,
          reference_number: referenceNumber,
          notes: notes
        }])
        .select()
        .single();

      if (sError) throw sError;

      // 2. Update Coupons status to SETTLED and link to settlement_id
      const couponIds = receivableCoupons.map(emp => emp.id);
      const { error: cError } = await supabase
        .from('coupons')
        .update({
          status: CouponStatus.SETTLED,
          settlement_id: settlement.id
        })
        .in('id', couponIds);

      if (cError) throw cError;

      alert('Settlement completed successfully!');
      setReferenceNumber('');
      setNotes('');

      // Update local state if needed
      if (onUpdateEmployees) {
        const updatedEmployees = employees.map(emp =>
          couponIds.includes(emp.id)
            ? { ...emp, status: CouponStatus.SETTLED }
            : emp
        );
        onUpdateEmployees(updatedEmployees);
      }

      // generate voucher PDF for the settlement we just created
      try {
        await generateVoucherPdf({
          referenceNumber: settlement.reference_number || referenceNumber,
          notes: settlement.notes || notes,
          totalAmount: settlement.total_amount ?? totalAmount,
          settledAt: settlement.settled_at || new Date().toISOString()
        });
      } catch (pdfErr) {
        console.error('Failed to generate PDF:', pdfErr);
      }

      setView('HISTORY');
    } catch (err: any) {
      console.error('Settlement failed:', err);
      alert('Settlement failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateVoucherPreview = async () => {
    if (!referenceNumber.trim()) {
      alert('Please enter a reference number to preview the voucher.');
      return;
    }

    setPreviewLoading(true);
    try {
      // Generate preview data
      const previewData = {
        referenceNumber: referenceNumber,
        notes: notes || '',
        totalAmount: totalAmount,
        settledAt: new Date().toISOString()
      };

      // Create a new window for preview
      const previewWindow = window.open('', 'preview', 'width=1000,height=800,scrollbars=yes');
      if (!previewWindow) {
        alert('Please allow popups to view the preview');
        setPreviewLoading(false);
        return;
      }

      // Fetch logo
      let logoDataUri = '';
      try {
        const logoUrl = 'https://media.licdn.com/dms/image/v2/C510BAQEBDJmo9PH1Lw/company-logo_200_200/company-logo_200_200/0/1631386654731?e=2147483647&v=beta&t=qLYfIW4vWpMX_yJ88gZD-oqQN1ocul8mIc5ngu70VUk';
        const response = await fetch(logoUrl, { mode: 'cors', credentials: 'omit' });
        if (response.ok) {
          const blob = await response.blob();
          logoDataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn('Failed to load logo for preview');
        logoDataUri = '';
      }

      // Generate preview HTML
      const previewHtml = `<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Voucher Preview</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f0f0f0;
          padding: 20px;
          color: #000;
          margin: 0;
        }
        .voucher {
          width: 950px;
          margin: auto;
          background: #fff;
          border: 1.5px solid #000;
          border-radius: 20px;
          padding: 30px;
          position: relative;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
          width: 100%;
        }
        .company-info {
          font-size: 11px;
          line-height: 1.3;
          flex: 0 0 auto;
        }
        .company-name {
          font-size: 20px;
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
          font-weight: 900;
          margin-bottom: 3px;
          display: block;
        }
        .logo-container {
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          flex: 1;
          margin-left: 15px;
        }
        .logo-img {
          height: 100px;
          width: auto;
          display: block;
          object-fit: contain;
        }
        h2 {
          text-align: center;
          font-size: 16px;
          font-weight: 900;
          margin: 8px 0 20px 0;
          text-decoration: underline;
        }
        .field-row {
          display: flex;
          align-items: flex-start;
          margin-bottom: 12px;
          width: 100%;
        }
        .field-row > div {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .label {
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
          margin-right: 8px;
          flex-shrink: 0;
          height: 18px;
          display: flex;
          align-items: center;
        }
        .dots {
          flex-grow: 1;
          border-bottom: 1px solid #000;
          height: 18px;
          padding: 0 4px;
        }
        .field-value {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 1px;
          display: block;
          min-height: 16px;
          padding-left: 4px;
        }
        .footer-section {
          margin-top: 30px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          text-align: center;
          width: 100%;
        }
        .sig-box {
          width: 80px;
        }
        .sig-label {
          font-weight: 900;
          font-size: 11px;
          padding-top: 6px;
        }
        .sig-line {
          border-top: 1px solid #000;
          width: 100%;
          height: 20px;
        }
        .received-stamp {
          border: 1px solid #000;
          width: 120px;
          height: 40px;
          margin-bottom: 3px;
        }
        @media print {
          body { background: none; padding: 0; }
          .voucher { border: 2px solid #000; box-shadow: none; }
        }
      </style>
      </head>
      <body>
      <div class="voucher">
        <div class="header">
          <div class="company-info">
            <span class="company-name">Clove Technologies Pvt. Ltd.</span>
            Plot No. 9, Hill No. 2, Rushikonda, Madhurawada,<br>
            Visakhapatnam-530 045, AP, India.<br>
            <strong>CIN No: U72200TG2004PTC042728</strong>
          </div>
          <div class="logo-container">
            ${logoDataUri ? `<img src="${logoDataUri}" alt="Clove Technologies Logo" class="logo-img">` : ''}
          </div>
        </div>
        <h2>CASH / BANK PAYMENT VOUCHER</h2>
        <div class="field-row">
          <div style="width: 40%;">
            <span class="label">V.No.:</span>
            <span class="field-value">${previewData.referenceNumber}</span>
            <div class="dots"></div>
          </div>
          <div style="width: 45%; margin-left: 5%;">
            <span class="label">Date :</span>
            <span class="field-value">${formatDateToDDMMYYYY(previewData.settledAt)}</span>
            <div class="dots"></div>
          </div>
        </div>
        <div class="field-row">
          <div style="flex: 1; display: flex; flex-direction: column;">
            <span class="label">Debit:</span>
            <div class="dots"></div>
          </div>
        </div>
        <div class="field-row">
          <div style="flex: 1; display: flex; flex-direction: column;">
            <span class="label">Paid in credit of</span>
            <div class="dots"></div>
          </div>
        </div>
        <div class="field-row">
          <div style="width: 40%;">
            <span class="label">A Sum of Rs.</span>
            <span class="field-value">₹${previewData.totalAmount.toLocaleString()}</span>
            <div class="dots"></div>
          </div>
          <div style="width: 55%; margin-left: 3%;">
            <span class="label">(Rupees</span>
            <div class="dots"></div>
          </div>
        </div>
        <div class="field-row">
          <div style="flex: 1; display: flex; flex-direction: column;">
            <span class="label">Towards</span>
            <span class="field-value">${previewData.notes}</span>
            <div class="dots"></div>
          </div>
        </div>
        <div class="field-row">
          <div style="flex: 1; display: flex; flex-direction: column;">
            <div class="dots"></div>
          </div>
        </div>
        <div class="footer-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Verified</div>
          </div>
          <div class="sig-box" style="width: 110px;">
            <div class="sig-line"></div>
            <div class="sig-label">Authorised Signature</div>
          </div>
          <div class="sig-box" style="display: flex; flex-direction: column; align-items: center;">
            <div class="received-stamp"></div>
            <div class="sig-label">Received</div>
          </div>
        </div>
      </div>
      <script>
        window.print();
      </script>
      </body>
      </html>`;

      previewWindow.document.write(previewHtml);
      previewWindow.document.close();
    } catch (err) {
      console.error('Failed to generate preview:', err);
      alert('Failed to generate preview. See console for details.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const generateVoucherPdf = async (data: { referenceNumber: string; notes?: string; totalAmount: number; settledAt: string }) => {
    // Helper: try dynamic import, otherwise load from CDN and wait for global
    const ensureLib = async (pkgName: string, globalName: string, cdnUrl: string) => {
      try {
        const mod = await import(/* @vite-ignore */ pkgName);
        return mod.default || mod;
      } catch (e) {
        if ((window as any)[globalName]) return (window as any)[globalName];
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = cdnUrl;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load ' + cdnUrl));
          document.head.appendChild(s);
        });
        return (window as any)[globalName];
      }
    };

    const html2canvasLib = await ensureLib('html2canvas', 'html2canvas', 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js');
    const jspdfLib = await ensureLib('jspdf', 'window.jspdf || jspdf', 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
    const JsPDFCtor = (jspdfLib && (jspdfLib.jsPDF || jspdfLib.default || jspdfLib)) || (window as any).jspdf?.jsPDF;

    // Fetch and convert logo to data URI
    let logoDataUri = '';
    try {
      const logoUrl = 'https://media.licdn.com/dms/image/v2/C510BAQEBDJmo9PH1Lw/company-logo_200_200/company-logo_200_200/0/1631386654731?e=2147483647&v=beta&t=qLYfIW4vWpMX_yJ88gZD-oqQN1ocul8mIc5ngu70VUk';
      const response = await fetch(logoUrl, {
        mode: 'cors',
        credentials: 'omit'
      });
      if (!response.ok) throw new Error(`Failed to fetch logo: ${response.status}`);
      const blob = await response.blob();
      logoDataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      console.log('Logo loaded successfully');
    } catch (logoErr) {
      console.warn('Failed to load logo, using fallback:', logoErr);
      // Use a simple placeholder/fallback
      logoDataUri = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';
    }

    // Build voucher HTML using the provided template and injected data
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <title>Clove Technologies - Payment Voucher</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        background: #f0f0f0;
        padding: 20px;
        color: #000;
        margin: 0;
      }

      .voucher {
        width: 950px;
        margin: auto;
        background: #fff;
        border: 1.5px solid #000;
        border-radius: 20px;
        padding: 30px;
        position: relative;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 15px;
        width: 100%;
      }

      .company-info {
        font-size: 11px;
        line-height: 1.3;
        flex: 0 0 auto;
      }

      .company-name {
        font-size: 20px;
        text-decoration: underline;
        text-decoration-thickness: 2px;
        text-underline-offset: 3px;
        font-weight: 900;
        margin-bottom: 3px;
        display: block;
      }

      .logo-container {
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
        flex: 1;
        margin-left: 15px;
      }

      .logo-img {
        height: 200px;
        width: auto;
        display: block;
        object-fit: contain;
        margin-top: -30px;
        margin-left: 20px;
      }

      h2 {
        text-align: center;
        font-size: 18px;
        font-weight: 900;
        margin: 8px 0 20px 0;
        text-decoration: underline;
      }

      .field-row {
        display: flex;
        align-items: flex-start;
        margin-bottom: 12px;
        width: 100%;
      }

      .field-row > div {
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .label {
        font-weight: 900;
        font-size: 12px;
        white-space: nowrap;
        margin-right: 8px;
        flex-shrink: 0;
        height: 18px;
        display: flex;
        align-items: center;
      }

      .dots {
        flex-grow: 1;
        border-bottom: 1px solid #000;
        height: 18px;
        padding: 0 4px;
      }

      .field-value {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 1px;
        display: block;
        min-height: 16px;
        padding-left: 4px;
      }

      .footer-section {
        margin-top: 30px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        text-align: center;
        width: 100%;
      }

      .sig-box {
        width: 80px;
      }

      .sig-label {
        font-weight: 900;
        font-size: 11px;
        padding-top: 6px;
      }

      .sig-line {
        border-top: 1px solid #000;
        width: 100%;
        height: 20px;
      }

      .received-stamp {
        border: 1px solid #000;
        width: 120px;
        height: 40px;
        margin-bottom: 3px;
      }

      @media print {
        body { background: none; padding: 0; }
        .voucher { border: 2px solid #000; }
      }
    </style>
    </head>
    <body>

    <div class="voucher">
      <div class="header">
        <div class="company-info">
          <span class="company-name">Clove Technologies Pvt. Ltd.</span>
          Plot No. 9, Hill No. 2, Rushikonda, Madhurawada,<br>
          Visakhapatnam-530 045, AP, India.<br>
          <strong>CIN No: U72200TG2004PTC042728</strong>
        </div>
        <div class="logo-container">
          <img src="${logoDataUri}" alt="Clove Technologies Logo" class="logo-img">
        </div>
      </div>

      <h2>CASH / BANK PAYMENT VOUCHER</h2>

      <div class="field-row">
        <div style="width: 40%;">
          <span class="label">V.No.:</span>
          <span class="field-value">${data.referenceNumber}</span>
          <div class="dots"></div>
        </div>
        <div style="width: 45%; margin-left: 5%;">
          <span class="label">Date :</span>
          <span class="field-value">${formatDateToDDMMYYYY(data.settledAt)}</span>
          <div class="dots"></div>
        </div>
      </div>

      <div class="field-row">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <span class="label">Debit:</span>
          <div class="dots"></div>
        </div>
      </div>

      <div class="field-row">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <span class="label">Paid in credit of</span>
          <div class="dots"></div>
        </div>
      </div>

      <div class="field-row">
        <div style="width: 40%;">
          <span class="label">A Sum of Rs.</span>
          <span class="field-value">₹${data.totalAmount.toLocaleString()}</span>
          <div class="dots"></div>
        </div>
        <div style="width: 55%; margin-left: 3%;">
          <span class="label">(Rupees</span>
          <div class="dots"></div>
        </div>
      </div>

      <div class="field-row">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <span class="label">Towards</span>
          <span class="field-value">${data.notes || ''}</span>
          <div class="dots"></div>
        </div>
      </div>
      <div class="field-row">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div class="dots"></div>
        </div>
      </div>

      <div class="footer-section">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Prepared</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Verified</div>
        </div>
        <div class="sig-box" style="width: 110px;">
          <div class="sig-line"></div>
          <div class="sig-label">Authorised Signature</div>
        </div>
        <div class="sig-box" style="display: flex; flex-direction: column; align-items: center;">
          <div class="received-stamp"></div>
          <div class="sig-label">Received</div>
        </div>
      </div>
    </div>
    </body>
    </html>`;

    // create offscreen container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = html;
    document.body.appendChild(container);

    // Wait for images to load in the DOM
    const images = container.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(img => {
        return new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => {
              console.warn('Image failed to load:', img.src);
              resolve();
            };
          }
        });
      })
    );

    // render to canvas
    const node = container.querySelector('.voucher') as HTMLElement;
    if (!node) throw new Error('Voucher node not found');

    const canvas = await (html2canvasLib as any)(node, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: true,
      imageTimeout: 10000
    });
    const imgData = canvas.toDataURL('image/png', 1.0);

    // create PDF in A5 landscape
    if (!JsPDFCtor) throw new Error('jsPDF library not available');
    const pdf = new JsPDFCtor({ unit: 'pt', format: 'a5', orientation: 'landscape' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // apply small page margins and fit image keeping aspect ratio
    const margin = 20; // points
    const availableW = pageWidth - margin * 2;
    const availableH = pageHeight - margin * 2;
    const ratio = Math.min(availableW / canvas.width, availableH / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    pdf.save(`${data.referenceNumber || 'settlement'}-voucher.pdf`);

    // cleanup
    document.body.removeChild(container);
  };

  const filteredHistory = settlements.filter(s => {
    const matchesSearch = s.referenceNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
      (s.notes && s.notes.toLowerCase().includes(historySearch.toLowerCase()));
    
    const matchesVendor = selectedHistoryVendor === 'all' || s.vendorId === selectedHistoryVendor;
    
    return matchesSearch && matchesVendor;
  });

  const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null);

  const handleViewDetails = async (s: SettlementType) => {
    const sid = String(s.id ?? '');
    try {
      setPdfGeneratingId(sid);
      await generateVoucherPdf({
        referenceNumber: s.referenceNumber || '',
        notes: s.notes || '',
        totalAmount: s.totalAmount ?? 0,
        settledAt: s.settledAt || new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to open settlement voucher:', err);
      alert('Failed to open voucher. See console for details.');
    } finally {
      setPdfGeneratingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Settlement</h1>
          <p className="text-slate-500">Settle RECEIVED coupons and track history</p>
        </div>
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
          <button
            onClick={() => setView('NEW')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'NEW' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Settlement
          </button>
          <button
            onClick={() => setView('HISTORY')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'HISTORY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            History
          </button>
        </div>
      </header>

      {view === 'NEW' ? (
        <div className="grid grid-cols-1 desktop:grid-cols-3 gap-8">
          {/* Settlement Form */}
          <div className="desktop:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Settlement Slip</h2>

              <div className="space-y-6">
                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Total to Settle</p>
                  <p className="text-4xl font-black text-slate-900">₹{totalAmount.toLocaleString()}</p>
                  <p className="text-sm text-indigo-600 mt-2 font-medium">{receivableCoupons.length} coupons ready for settlement</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Select Vendor</label>
                    <select
                      value={selectedVendor}
                      onChange={(e) => setSelectedVendor(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 transition font-medium"
                    >
                      <option value="all">All Vendors</option>
                      {vendors.filter(v => !v.is_admin && v.access).map(v => (
                        <option key={v.user_id} value={v.user_id}>{v.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Reference Number</label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. SETTLE-2026-001"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 transition font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Notes (Optional)</label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any internal notes..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 transition font-medium resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={generateVoucherPreview}
                    disabled={previewLoading || !referenceNumber.trim()}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {previewLoading ? (
                      <><div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-700 rounded-full animate-spin" /> Generating Preview...</>
                    ) : (
                      <> Preview Voucher</>
                    )}
                  </button>
                  <button
                    onClick={handleSettlement}
                    disabled={loading || receivableCoupons.length === 0}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                    ) : (
                      <>Complete Settlement</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Eligible Coupons List */}
          <div className="desktop:col-span-2">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[70vh]">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Eligible Coupons</h3>
                <div className="relative w-64">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search RECEIVED..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></span>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-8 py-4">Employee</th>
                      <th className="px-8 py-4">Serial Code</th>
                      <th className="px-8 py-4">Amount</th>
                      <th className="px-8 py-4">Received Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {filteredReceivable.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                          No received coupons available for settlement.
                        </td>
                      </tr>
                    ) : (
                      filteredReceivable.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-8 py-4">
                            <p className="font-bold text-slate-900">{emp.name}</p>
                            <p className="text-xs text-slate-400">{emp.empId}</p>
                          </td>
                          <td className="px-8 py-4 font-mono text-xs text-indigo-600">{emp.serialCode}</td>
                          <td className="px-8 py-4 font-bold text-slate-900">₹{emp.amount}</td>
                          <td className="px-8 py-4 text-slate-400">{formatDateToDDMMYYYY(emp.issueDate)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-72">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Filter by reference or notes..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="w-64">
                <select
                  value={selectedHistoryVendor}
                  onChange={(e) => setSelectedHistoryVendor(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="all">All Vendors</option>
                  {vendors.filter(v => !v.is_admin && v.access).map(v => (
                    <option key={v.user_id} value={v.user_id}>{v.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500">Showing {filteredHistory.length} settlement records</p>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Reference</th>
                  <th className="px-8 py-5">Vendor</th>
                  <th className="px-8 py-5 text-center">Coupons</th>
                  <th className="px-8 py-5">Amount</th>
                  <th className="px-8 py-5">Notes</th>
                  <th className="px-8 py-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {loading ? (
                  <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400 animate-pulse">Loading histories...</td></tr>
                ) : filteredHistory.length === 0 ? (
                  <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400">No settlement history found.</td></tr>
                ) : (
                  filteredHistory.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-8 py-5 text-slate-600">{formatDateToDDMMYYYY(s.settledAt)}</td>
                      <td className="px-8 py-5 font-bold text-slate-900">{s.referenceNumber}</td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${s.vendorId ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.vendorId ? (vendors.find(v => v.user_id === s.vendorId)?.email || 'Vendor') : 'Multiple/All'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center font-bold text-indigo-600">{s.couponCount}</td>
                      <td className="px-8 py-5 font-black text-slate-900">₹{s.totalAmount.toLocaleString()}</td>
                      <td className="px-8 py-5 text-slate-400 max-w-xs truncate">{s.notes || '-'}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(s)}
                            disabled={pdfGeneratingId === String(s.id)}
                            className={`px-3 py-1 text-xs font-bold rounded transition ${pdfGeneratingId === String(s.id) ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                            title="Download voucher PDF"
                          >
                            📥 PDF
                          </button>
                          <button
                            onClick={() => loadSettlementDetails(s)}
                            className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                            title="View coupons in settlement"
                          >
                            📋 Details
                          </button>
                          <button
                            onClick={() => handleDeleteSettlement(String(s.id))}
                            disabled={deletingId === String(s.id)}
                            className={`px-3 py-1 text-xs font-bold rounded transition ${deletingId === String(s.id)
                              ? 'bg-slate-100 text-slate-400'
                              : deleteConfirm === String(s.id)
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            title={deleteConfirm === String(s.id) ? 'Confirm delete' : 'Delete settlement'}
                          >
                            {deletingId === String(s.id) ? '⏳' : deleteConfirm === String(s.id) ? '✓ Confirm' : '🗑️ Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mb-6">⚠️</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Delete Settlement?</h3>
              <p className="text-slate-600 text-sm mb-6">
                This will delete the settlement and revert all associated coupons back to RECEIVED status. This action cannot be undone.
              </p>

              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 w-full text-left">
                <p className="text-xs font-bold text-red-700 mb-1">SETTLEMENT ID</p>
                <p className="text-sm font-mono text-red-600">{deleteConfirm}</p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 px-4 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition"
                  disabled={deletingId !== null}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSettlement(deleteConfirm)}
                  disabled={deletingId !== null}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deletingId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Settlement'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Details Modal */}
      {showDetailsModal && selectedSettlement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-[2.5rem] max-w-3xl w-full shadow-2xl border border-white/20 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Settlement Details</h3>
                <p className="text-slate-500 text-sm">Reference: <span className="font-mono text-indigo-600">{selectedSettlement.referenceNumber}</span></p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition"
              >
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
              </button>
            </div>

            {/* Settlement Info */}
            <div className="grid grid-cols-3 gap-6 p-8 border-b border-slate-50">
              <div className="bg-indigo-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Total Amount</p>
                <p className="text-2xl font-black text-indigo-900">₹{selectedSettlement.totalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Coupon Count</p>
                <p className="text-2xl font-black text-blue-900">{selectedSettlement.couponCount}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Settlement Date</p>
                <p className="text-2xl font-black text-slate-900">{formatDateToDDMMYYYY(selectedSettlement.settledAt)}</p>
              </div>
            </div>

            {/* Coupons List */}
            <div className="flex-1 overflow-y-auto p-8">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
              ) : settlementCoupons.length === 0 ? (
                <p className="text-center text-slate-400 py-12">No coupons found for this settlement.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-600 mb-4">Coupons Included ({settlementCoupons.length})</p>
                  {settlementCoupons.map((coupon, idx) => (
                    <div key={coupon.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-slate-900">{idx + 1}. {coupon.name}</p>
                          <p className="text-xs text-slate-500">Employee ID: {coupon.emp_id}</p>
                        </div>
                        <p className="font-black text-indigo-600">₹{coupon.amount || 0}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500 font-semibold">Serial Code</p>
                          <p className="font-mono text-slate-700">{coupon.serial_code}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-semibold">Issue Date</p>
                          <p className="text-slate-700">{formatDateToDDMMYYYY(coupon.issue_date)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-semibold">Valid Till</p>
                          <p className="text-slate-700">{formatDateToDDMMYYYY(coupon.valid_till)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-semibold">Received By</p>
                          <p className="text-slate-700 text-[10px] truncate">{vendors.find(v => v.user_id === coupon.received_by)?.email || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-50 flex gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="py-4 px-6 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                onClick={() => downloadSettlementAsCSV(selectedSettlement)}
                className="py-4 px-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-2xl font-bold transition border border-emerald-200"
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleViewDetails(selectedSettlement);
                }}
                className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition"
              >
                📄 Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settlement;