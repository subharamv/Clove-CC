import { Employee, SystemSettings } from '../types';
import QRCode from 'qrcode';
import { formatRupees } from './currencyUtils';

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
        this.canvas.width = 1048;
        this.canvas.height = 598;
        const context = this.canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');
        this.ctx = context;
    }

    /**
     * Load and cache the template image
     */
    async loadTemplate(templateUrl: string): Promise<void> {
        if (imageCache[templateUrl]) {
            this.templateImage = imageCache[templateUrl];
            return;
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                this.templateImage = img;
                imageCache[templateUrl] = img;
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
                x: nameEl?.x || 241,
                y: nameEl?.y || 326,
                fontSize: nameEl?.fontSize || 48,
                color: nameEl?.color || '#1e293b',
                fontWeight: nameEl?.fontWeight || 'bold'
            },
            employeeId: {
                x: empIdEl?.x || 220,
                y: empIdEl?.y || 398,
                fontSize: empIdEl?.fontSize || 48,
                color: empIdEl?.color || '#1e293b',
                fontWeight: empIdEl?.fontWeight || 'bold'
            },
            date: {
                x: dateEl?.x || 220,
                y: dateEl?.y || 517,
                fontSize: dateEl?.fontSize || 24,
                color: dateEl?.color || '#1e293b',
                fontWeight: dateEl?.fontWeight || 'bold'
            },
            serial: {
                x: serialEl?.x || 778,
                y: serialEl?.y || 141,
                fontSize: serialEl?.fontSize || 36,
                color: serialEl?.color || '#334155',
                fontWeight: serialEl?.fontWeight || 'bold'
            },
            amount: {
                x: amountEl?.x || 740,
                y: amountEl?.y || 251,
                fontSize: amountEl?.fontSize || 56,
                color: amountEl?.color || '#059669',
                fontWeight: amountEl?.fontWeight || 'bold'
            },
            qr: {
                x: qrEl?.x || 800,
                y: qrEl?.y || 400,
                width: qrEl?.width || 150,
                height: qrEl?.height || 150,
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
        this.ctx.fillText(employee.issueDate, positions.date.x, positions.date.y);

        // Draw serial code (prominent with box background for visibility)
        this.ctx.font = `${positions.serial.fontWeight} ${positions.serial.fontSize}px monospace`;
        this.ctx.fillStyle = positions.serial.color;

        // Draw rectangle background for serial code
        const textMetrics = this.ctx.measureText(employee.serialCode);
        const boxX = positions.serial.x - 10;
        const boxY = positions.serial.y - 28;
        const boxWidth = textMetrics.width + 20;
        const boxHeight = 40;

        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Serial code text
        this.ctx.fillStyle = '#1e293b';
        this.ctx.font = 'bold 36px monospace';
        this.ctx.fillText(employee.serialCode, positions.serial.x, positions.serial.y);

        // Draw amount in emerald green
        this.ctx.font = `${positions.amount.fontWeight} ${positions.amount.fontSize}px Inter, sans-serif`;
        this.ctx.fillStyle = positions.amount.color;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(formatRupees(employee.amount), positions.amount.x, positions.amount.y);

        // Draw QR Code if enabled
        if (positions.qr.enabled) {
            try {
                const qrDataUrl = await QRCode.toDataURL(employee.serialCode, {
                    margin: 1,
                    width: positions.qr.width,
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

    // A4 dimensions in pixels at 96 DPI: 210mm x 297mm
    const a4Width = 1240;
    const a4Height = 1754;

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

    // Padding around cards
    const padding = 5;
    const effectiveCardWidth = cardWidth - padding * 2;
    const effectiveCardHeight = cardHeight - padding * 2;

    // Scale coupon to fit card (original is 1048 x 598)
    const scaleX = effectiveCardWidth / 1048;
    const scaleY = effectiveCardHeight / 598;
    const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

    // Create pages
    const renderer = new CouponRenderer();
    try {
        await renderer.loadTemplate(templateUrl);
    } catch (err) {
        console.error('Failed to load template for batch rendering:', err);
        throw err;
    }

    for (let pageIdx = 0; pageIdx < Math.ceil(employees.length / cardsPerPage); pageIdx++) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = a4Width;
        pageCanvas.height = a4Height;
        const ctx = pageCanvas.getContext('2d');
        if (!ctx) continue;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, a4Width, a4Height);

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
                // Render coupon canvas
                const couponCanvas = await renderer.render(employee, settings, templateUrl);

                // Draw scaled coupon onto page
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);
                ctx.drawImage(couponCanvas, 0, 0);
                ctx.restore();

                // Draw border around card (optional, for visual separation)
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, effectiveCardWidth, effectiveCardHeight);
            } catch (err) {
                console.error(`Failed to render coupon for employee ${employee.name}:`, err);
            }
        }

        canvases.push(pageCanvas);
    }

    return canvases;
}
