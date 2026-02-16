import { Employee, SystemSettings } from '../types';
import QRCode from 'qrcode';
import { formatRupees } from './currencyUtils';
import { formatDateToDDMMYYYY } from './dateFormatUtils';

/**
 * Simple image cache to avoid reloading same template multiple times
 */
const imageCache: Record<string, HTMLImageElement> = {};

/**
 * Canvas-based coupon renderer for high-quality preview and printing
 */
export class CouponRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private templateImage: HTMLImageElement | null = null;

    constructor() {
        this.canvas = document.createElement('canvas');
        // Standard high-quality base resolution
        this.canvas.width = 1048;
        this.canvas.height = 598;
        const context = this.canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Could not get canvas context');
        this.ctx = context;

        // Improve image smoothing
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    /**
     * Load and cache the template image
     */
    async loadTemplate(templateUrl: string): Promise<void> {
        if (imageCache[templateUrl]) {
            this.templateImage = imageCache[templateUrl];
            // Match canvas to image original size if possible
            if (this.templateImage.width > 0) {
                this.canvas.width = this.templateImage.width;
                this.canvas.height = this.templateImage.height;
            }
            return;
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                this.templateImage = img;
                imageCache[templateUrl] = img;

                // Set canvas to original image dimensions for max quality
                if (img.width > 0) {
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                }

                resolve();
            };

            img.onerror = () => {
                console.warn('Failed to load template image:', templateUrl);
                reject(new Error('Template image failed to load'));
            };

            img.src = templateUrl;
        });
    }

    /**
     * Render coupon with employee data overlaid on template
     */
    async render(
        employee: Employee,
        settings: SystemSettings,
        templateUrl: string
    ): Promise<HTMLCanvasElement> {
        // Load template if not already loaded
        if (!this.templateImage) {
            await this.loadTemplate(templateUrl);
        }

        // Calculate scale factor relative to reference 1048x598 dimensions
        // to maintain relative positioning on different sized templates
        const scale = this.templateImage ? this.templateImage.width / 1048 : 1;

        // Clear canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw template image
        if (this.templateImage) {
            this.ctx.drawImage(this.templateImage, 0, 0, this.canvas.width, this.canvas.height);
        }

        // Use custom positions if saved in settings, otherwise use defaults
        const getElement = (id: string) => settings.templateElements?.find(e => e.id === id);

        const nameEl = getElement('name');
        const empIdEl = getElement('empId');
        const dateEl = getElement('date');
        const serialEl = getElement('serial');
        const amountEl = getElement('amount');
        const qrEl = getElement('qr');

        const positions = {
            employeeName: {
                x: (nameEl?.x || 241) * scale,
                y: (nameEl?.y || 326) * scale,
                fontSize: (nameEl?.fontSize || 48) * scale,
                color: nameEl?.color || '#1e293b',
                fontWeight: nameEl?.fontWeight || 'bold'
            },
            employeeId: {
                x: (empIdEl?.x || 220) * scale,
                y: (empIdEl?.y || 398) * scale,
                fontSize: (empIdEl?.fontSize || 48) * scale,
                color: empIdEl?.color || '#1e293b',
                fontWeight: empIdEl?.fontWeight || 'bold'
            },
            date: {
                x: (dateEl?.x || 220) * scale,
                y: (dateEl?.y || 517) * scale,
                fontSize: (dateEl?.fontSize || 24) * scale,
                color: dateEl?.color || '#1e293b',
                fontWeight: dateEl?.fontWeight || 'bold'
            },
            serial: {
                x: (serialEl?.x || 778) * scale,
                y: (serialEl?.y || 141) * scale,
                fontSize: (serialEl?.fontSize || 36) * scale,
                color: serialEl?.color || '#334155',
                fontWeight: serialEl?.fontWeight || 'bold'
            },
            amount: {
                x: (amountEl?.x || 740) * scale,
                y: (amountEl?.y || 251) * scale,
                fontSize: (amountEl?.fontSize || 56) * scale,
                color: amountEl?.color || '#059669',
                fontWeight: amountEl?.fontWeight || 'bold',
                enabled: settings.amountVisible !== false
            },
            qr: {
                x: (qrEl?.x || 800) * scale,
                y: (qrEl?.y || 400) * scale,
                width: (qrEl?.width || 150) * scale,
                height: (qrEl?.height || 150) * scale,
                enabled: settings.qrEnabled
            }
        };

        // Draw employee name
        this.ctx.font = `${positions.employeeName.fontWeight} ${positions.employeeName.fontSize}px Inter, sans-serif`;
        this.ctx.fillStyle = positions.employeeName.color;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(employee.name, positions.employeeName.x, positions.employeeName.y);

        // Draw employee ID
        this.ctx.font = `${positions.employeeId.fontWeight} ${positions.employeeId.fontSize}px Inter, sans-serif`;
        this.ctx.fillStyle = positions.employeeId.color;
        this.ctx.fillText(employee.empId, positions.employeeId.x, positions.employeeId.y);

        // Draw date
        this.ctx.font = `${positions.date.fontWeight} ${positions.date.fontSize}px Inter, sans-serif`;
        this.ctx.fillStyle = positions.date.color;
        this.ctx.fillText(formatDateToDDMMYYYY(employee.issueDate), positions.date.x, positions.date.y);

        // Draw serial code
        this.ctx.font = `${positions.serial.fontWeight} ${positions.serial.fontSize}px monospace`;
        this.ctx.fillStyle = positions.serial.color;

        // Draw rectangle background for serial code
        this.ctx.font = `bold ${36 * scale}px monospace`;
        const textMetrics = this.ctx.measureText(employee.serialCode);
        const boxX = positions.serial.x - (10 * scale);
        const boxY = positions.serial.y - (28 * scale);
        const boxWidth = textMetrics.width + (20 * scale);
        const boxHeight = 40 * scale;

        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Serial code text
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fillText(employee.serialCode, positions.serial.x, positions.serial.y);

        // Draw amount in emerald green if enabled
        if (positions.amount.enabled) {
            this.ctx.font = `${positions.amount.fontWeight} ${positions.amount.fontSize}px Inter, sans-serif`;
            this.ctx.fillStyle = positions.amount.color;
            this.ctx.textAlign = 'left';
            this.ctx.fillText(formatRupees(employee.amount), positions.amount.x, positions.amount.y);
        }

        // Draw QR Code if enabled
        if (positions.qr.enabled) {
            try {
                const qrDataUrl = await QRCode.toDataURL(employee.serialCode, {
                    margin: 1,
                    width: Math.round(positions.qr.width),
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                });

                const qrImage = new Image();
                await new Promise((resolve, reject) => {
                    qrImage.onload = resolve;
                    qrImage.onerror = reject;
                    qrImage.src = qrDataUrl;
                });

                this.ctx.drawImage(qrImage, positions.qr.x, positions.qr.y, positions.qr.width, positions.qr.height);
            } catch (err) {
                console.error('Failed to generate QR code:', err);
            }
        }

        return this.canvas;
    }

    /**
     * Clear the renderer
     */
    clear(): void {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

/**
 * Factory function to create and render a coupon
 */
export async function renderCoupon(
    employee: Employee,
    settings: SystemSettings,
    templateUrl: string
): Promise<HTMLCanvasElement> {
    const renderer = new CouponRenderer();
    await renderer.loadTemplate(templateUrl);
    return renderer.render(employee, settings, templateUrl);
}

/**
 * Render multiple coupons on A4 pages with configurable cards per page
 * Supports: 5 (1x5), 10 (2x5), 15 (3x5), 20 (4x5)
 */
export async function renderMultipleCouponsA4(
    employees: Employee[],
    settings: SystemSettings,
    templateUrl: string,
    cardsPerPageParam: number = 10
): Promise<HTMLCanvasElement[]> {
    const canvases: HTMLCanvasElement[] = [];

    // TARGET DPI for max quality (300 is standard for high-quality print)
    const TARGET_DPI = 600;
    const SCALE_FACTOR = TARGET_DPI / 96;

    // A4 dimensions in pixels
    // 210mm x 297mm -> approx 8.27in x 11.69in
    const a4Width = Math.round(8.27 * TARGET_DPI);
    const a4Height = Math.round(11.69 * TARGET_DPI);

    // Determine layout based on cards per page
    let cols: number, rows: number;
    switch (cardsPerPageParam) {
        case 5:
            cols = 1; rows = 5;
            break;
        case 15:
            cols = 3; rows = 5;
            break;
        case 20:
            cols = 4; rows = 5;
            break;
        case 10:
        default:
            cols = 2; rows = 5;
    }

    const cardsPerPage = cols * rows;

    // Card dimensions
    const cardWidth = a4Width / cols;
    const cardHeight = a4Height / rows;

    // Padding around cards (scaled)
    const padding = 5 * SCALE_FACTOR;
    const effectiveCardWidth = cardWidth - padding * 2;
    const effectiveCardHeight = cardHeight - padding * 2;

    // Create renderer
    const renderer = new CouponRenderer();
    try {
        await renderer.loadTemplate(templateUrl);
    } catch (err) {
        console.error('Failed to load template for batch rendering:', err);
        throw err;
    }

    // Original coupon base size is 1048x598, but we now use original image size
    // We scale the coupon to fit the card slot while maintaining aspect ratio

    for (let pageIdx = 0; pageIdx < Math.ceil(employees.length / cardsPerPage); pageIdx++) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = a4Width;
        pageCanvas.height = a4Height;
        const ctx = pageCanvas.getContext('2d', { alpha: false });
        if (!ctx) continue;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, a4Width, a4Height);

        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Render coupons for this page
        const startIdx = pageIdx * cardsPerPage;
        const endIdx = Math.min(startIdx + cardsPerPage, employees.length);

        for (let cardIdx = startIdx; cardIdx < endIdx; cardIdx++) {
            const employee = employees[cardIdx];
            const posInPage = cardIdx - startIdx;
            const col = posInPage % cols;
            const row = Math.floor(posInPage / cols);

            // Position on page
            const x = col * cardWidth + padding;
            const y = row * cardHeight + padding;

            try {
                // Render coupon canvas at its original/max quality
                const couponCanvas = await renderer.render(employee, settings, templateUrl);

                // Calculate scale to fit in the card slot
                const scaleX = effectiveCardWidth / couponCanvas.width;
                const scaleY = effectiveCardHeight / couponCanvas.height;
                const scale = Math.min(scaleX, scaleY);

                // Draw scaled coupon onto page
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);
                ctx.drawImage(couponCanvas, 0, 0);
                ctx.restore();

                // Draw border around card (scaled)
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1 * SCALE_FACTOR;
                ctx.strokeRect(x, y, effectiveCardWidth, effectiveCardHeight);
            } catch (err) {
                console.error(`Failed to render coupon for employee ${employee.name}:`, err);
            }
        }

        canvases.push(pageCanvas);
    }

    return canvases;
}
