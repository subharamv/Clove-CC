import { Settlement } from '../types';
import { formatDateToDDMMYYYY } from './dateFormatUtils';

export interface VoucherData {
    referenceNumber: string;
    notes?: string;
    totalAmount: number;
    settledAt: string;
}

/**
 * Generates the HTML voucher template with styling and data
 */
export const generateVoucherHTML = async (data: VoucherData): Promise<string> => {
    // Fetch and convert logo to data URI
    let logoDataUri = '';
    try {
        const logoUrl = 'https://media.licdn.com/dms/image/v2/C510BAQEBDJmo9PH1Lw/company-logo_200_200/company-logo_200_200/0/1631386654731?e=2147483647&v=beta&t=qLYfIW4vWpMX_yJ88gZD-oqQN1ocul8mIc5ngu70VUk';
        const response = await fetch(logoUrl, {
            mode: 'cors',
            credentials: 'omit'
        });
        if (response.ok) {
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
        }
    } catch (logoErr) {
        console.warn('Failed to load logo:', logoErr);
        logoDataUri = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';
    }

    const formatDate = (dateString: string) => {
        return formatDateToDDMMYYYY(dateString);
    };

    return `<!DOCTYPE html>
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
      <span class="field-value">${formatDate(data.settledAt)}</span>
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
};

/**
 * Opens the voucher in a new window for preview
 */
export const previewVoucher = async (data: VoucherData): Promise<void> => {
    try {
        const html = await generateVoucherHTML(data);
        const previewWindow = window.open('', 'voucherPreview', 'width=1000,height=800,scrollbars=yes');
        if (!previewWindow) {
            throw new Error('Could not open preview window. Please check popup settings.');
        }
        previewWindow.document.write(html);
        previewWindow.document.close();
    } catch (err) {
        console.error('Failed to preview voucher:', err);
        throw err;
    }
};

/**
 * Generates and downloads the voucher as PDF
 */
export const downloadVoucherPDF = async (data: VoucherData): Promise<void> => {
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

    try {
        const html2canvas = await ensureLib('html2canvas', 'html2canvas', 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js');
        const jspdf = await ensureLib('jspdf', 'window.jspdf || jspdf', 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
        const JsPDFCtor = (jspdf && (jspdf.jsPDF || jspdf.default || jspdf)) || (window as any).jspdf?.jsPDF;

        const html = await generateVoucherHTML(data);

        // Create a temporary div to hold the voucher
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        const voucherElement = tempDiv.querySelector('.voucher') as HTMLElement;
        if (!voucherElement) {
            throw new Error('Voucher element not found');
        }

        const canvas = await html2canvas(voucherElement, {
            scale: 12.5, // Targeting 1200 DPI (1200 / 96 = 12.5)
            useCORS: true,
            backgroundColor: '#ffffff',
            imageTimeout: 30000,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new JsPDFCtor('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        pdf.save(`voucher-${data.referenceNumber}.pdf`);

        document.body.removeChild(tempDiv);
    } catch (err) {
        console.error('Failed to generate PDF:', err);
        throw err;
    }
};
