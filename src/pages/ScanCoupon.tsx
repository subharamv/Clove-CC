import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Employee, CouponStatus } from '../types';
import { supabase } from '../supabaseClient';
import { CheckCircle, XCircle, Info, QrCode } from 'lucide-react';
import { formatRupees } from '../utils/currencyUtils';

interface ScanCouponProps {
    onRefresh: () => Promise<void> | void;
}

const ScanCoupon: React.FC<ScanCouponProps> = ({ onRefresh }) => {
    const [scannedCoupon, setScannedCoupon] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [mode, setMode] = useState<'camera' | 'gallery'>('camera');
    const [cameras, setCameras] = useState<Array<{ id: string; label?: string }>>([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const [isCameraRunning, setIsCameraRunning] = useState(false);
    const html5QrRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                const cams = await Html5Qrcode.getCameras();
                if (!mounted) return;
                if (Array.isArray(cams) && cams.length) {
                    setCameras(cams.map(c => ({ id: c.id, label: c.label })));

                    // detect mobile to prefer back camera
                    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                    let preferredIndex = 0;
                    if (isMobile) {
                        const backIndex = cams.findIndex(c => /back|rear|environment/i.test(c.label || ''));
                        if (backIndex >= 0) preferredIndex = backIndex;
                    }
                    setCurrentCameraIndex(preferredIndex);

                    // if mode is camera, start it
                    if (mode === 'camera') {
                        await startCameraAtIndex(preferredIndex);
                    }
                }
            } catch (err) {
                console.warn('Could not get cameras', err);
            }
        };

        init();

        return () => {
            mounted = false;
            stopCamera();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // start camera helper
    const startCameraAtIndex = async (index: number) => {
        stopCamera();
        const cam = cameras[index];
        const readerId = 'reader';
        html5QrRef.current = new Html5Qrcode(readerId);
        try {
            await html5QrRef.current.start(
                cam ? { deviceId: { exact: cam.id } } : { facingMode: 'environment' } as any,
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                onScanFailure
            );
            setIsCameraRunning(true);
        } catch (err) {
            console.error('Failed to start camera', err);
            setIsCameraRunning(false);
            setError('Unable to access camera');
        }
    };

    const stopCamera = () => {
        if (html5QrRef.current) {
            html5QrRef.current.stop().catch(() => { }).finally(() => {
                try { html5QrRef.current?.clear(); } catch (e) { }
                html5QrRef.current = null;
            });
        }
        setIsCameraRunning(false);
    };

    const onScanSuccess = async (decodedText: string) => {
        // Stop scanning after success
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Check if the decoded text is a serial code or an ID
            // Assuming the QR code contains the serial code
            const { data, error: fetchError } = await supabase
                .from('coupons')
                .select('*')
                .eq('serial_code', decodedText)
                .single();

            if (fetchError) {
                // Try matching by ID if serial code doesn't work
                const { data: dataById, error: fetchErrorById } = await supabase
                    .from('coupons')
                    .select('*')
                    .eq('id', decodedText)
                    .single();

                if (fetchErrorById) {
                    throw new Error('Coupon not found');
                }
                setScannedCoupon(transformRow(dataById));
            } else {
                setScannedCoupon(transformRow(data));
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load coupon');
            setScannedCoupon(null);
        } finally {
            setLoading(false);
        }
    };

    const transformRow = (row: any): Employee => ({
        id: row.id,
        name: row.name || '',
        empId: row.emp_id || '',
        otHours: row.ot_hours || 0,
        amount: row.amount || 0,
        status: row.status || CouponStatus.PENDING,
        serialCode: row.serial_code || '',
        issueDate: row.issue_date || '',
        validTill: row.valid_till || '',
        created_at: row.created_at,
        couponImageUrl: row.coupon_image_url
    });

    const onScanFailure = (error: any) => {
        // console.warn(`Code scan error = ${error}`);
    };

    const handleModeChange = async (next: 'camera' | 'gallery') => {
        setError(null);
        setSuccess(null);
        setMode(next);
        if (next === 'camera') {
            // start camera
            await startCameraAtIndex(currentCameraIndex);
        } else {
            // stop camera
            stopCamera();
        }
    };

    const switchCamera = async () => {
        if (!cameras || cameras.length <= 1) return;
        const next = (currentCameraIndex + 1) % cameras.length;
        setCurrentCameraIndex(next);
        if (mode === 'camera') {
            await startCameraAtIndex(next);
        }
    };

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        setSuccess(null);
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            const decoded = await scanImageFile(file);
            if (decoded) await onScanSuccess(decoded);
            else setError('No QR code found in image');
        } catch (err: any) {
            setError(err?.message || 'No QR code found in image');
        } finally {
            e.currentTarget.value = '';
        }
    };

    // Scans an image file for QR code. Tries BarcodeDetector first, falls back to jsQR loaded from CDN.
    const scanImageFile = async (file: File): Promise<string | null> => {
        // load image
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(new Error('Failed to load image'));
        });

        // draw to canvas
        const maxDim = 1600;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.floor(w * scale));
        h = Math.max(1, Math.floor(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');
        ctx.drawImage(img, 0, 0, w, h);

        // Try BarcodeDetector if available
        try {
            const BD = (window as any).BarcodeDetector;
            if (BD) {
                const detector = new BD({ formats: ['qr_code'] });
                const results = await detector.detect(canvas as any);
                if (results && results.length) {
                    URL.revokeObjectURL(objectUrl);
                    return results[0].rawValue || results[0].rawvalue || null;
                }
            }
        } catch (e) {
            // ignore and fallback
        }

        // Fallback: load jsQR from CDN if needed
        const ensureJsQr = async () => {
            if ((window as any).jsQR) return (window as any).jsQR;
            await new Promise<void>((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://unpkg.com/jsqr/dist/jsQR.js';
                s.async = true;
                s.onload = () => resolve();
                s.onerror = () => reject(new Error('Failed to load jsQR'));
                document.head.appendChild(s);
            });
            return (window as any).jsQR;
        };

        const jsQR = await ensureJsQr();
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h);
        URL.revokeObjectURL(objectUrl);
        return code ? code.data : null;
    };

    const markReceived = async () => {
        if (!scannedCoupon) return;
        // Prevent marking coupons that are already settled
        if (scannedCoupon.status === CouponStatus.SETTLED) {
            setError('This coupon is already SETTLED and cannot be marked as received.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { error: updateError } = await supabase
                .from('coupons')
                .update({
                    status: CouponStatus.RECEIVED,
                    received_at: new Date().toISOString()
                })
                .eq('id', scannedCoupon.id);

            if (updateError) throw updateError;

            setSuccess('Coupon marked as received successfully!');
            setScannedCoupon({ ...scannedCoupon, status: CouponStatus.RECEIVED });

            if (onRefresh) {
                await onRefresh();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to update coupon status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
            {/* Main Content - Scanner */}
            <div className="flex-1 p-4 md:p-8">
                <div className="max-w-xl mx-auto">
                    <header className="mb-6">
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <QrCode className="text-orange-600" />
                            Scan Coupon
                        </h1>
                        <p className="text-slate-500 text-sm">Point your camera at a coupon QR code to verify and mark as received.</p>
                    </header>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-4">
                        <div className="flex gap-3 mb-4">
                            <button
                                onClick={() => handleModeChange('camera')}
                                className={`px-4 py-2 rounded-lg font-bold ${mode === 'camera' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
                                Camera
                            </button>
                            <button
                                onClick={() => handleModeChange('gallery')}
                                className={`px-4 py-2 rounded-lg font-bold ${mode === 'gallery' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
                                Gallery
                            </button>
                            {mode === 'camera' && cameras.length > 1 && (
                                <button onClick={switchCamera} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold">Switch Camera</button>
                            )}
                        </div>

                        <div id="reader" className="w-full" style={{ minHeight: 240, display: mode === 'camera' ? 'block' : 'none' }}></div>

                        <div style={{ display: mode === 'gallery' ? 'block' : 'none' }} className="py-6">
                            <input type="file" accept="image/*" onChange={onFileChange} className="w-full" />
                            <p className="text-xs text-slate-400 mt-2">Upload an image of the coupon QR code from your device.</p>
                        </div>


                    </div>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-700">
                            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium">{success}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar - Coupon Details */}
            <div className="w-full md:w-80 lg:w-96 bg-white border-l border-slate-200 p-6 shadow-xl flex flex-col">
                <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-4">
                    <Info className="w-5 h-5 text-slate-400" />
                    Coupon Details
                </h2>

                {scannedCoupon ? (
                    <div className="flex-1 flex flex-col">
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</label>
                                <p className="text-xl font-bold text-slate-900 mt-1">{scannedCoupon.name}</p>
                                <p className="text-slate-500 font-mono text-sm">{scannedCoupon.empId}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</label>
                                    <p className="text-lg font-bold text-emerald-600">{formatRupees(scannedCoupon.amount)}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold mt-1 ${scannedCoupon.status === CouponStatus.RECEIVED
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-orange-100 text-orange-700'
                                        }`}>
                                        {scannedCoupon.status}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Serial Code</span>
                                    <span className="text-xs font-mono font-bold text-slate-700">{scannedCoupon.serialCode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Issue Date</span>
                                    <span className="text-xs font-mono text-slate-700">{scannedCoupon.issueDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Valid Till</span>
                                    <span className="text-xs font-mono text-slate-700">{scannedCoupon.validTill}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-8">
                            <button
                                onClick={markReceived}
                                disabled={loading || scannedCoupon.status === CouponStatus.RECEIVED}
                                className={`w-full py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 ${scannedCoupon.status === CouponStatus.RECEIVED
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg active:scale-95'
                                    }`}
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : scannedCoupon.status === CouponStatus.RECEIVED ? (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        Received
                                    </>
                                ) : (
                                    'Mark as Received'
                                )}
                            </button>

                            {scannedCoupon.status === CouponStatus.RECEIVED && (
                                <p className="text-center text-xs text-slate-400 mt-4">
                                    This coupon has already been processed.
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                        <QrCode className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-slate-400 font-medium">No coupon scanned yet</p>
                        <p className="text-slate-300 text-xs mt-2">The scanned coupon details will appear here automatically.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScanCoupon;
