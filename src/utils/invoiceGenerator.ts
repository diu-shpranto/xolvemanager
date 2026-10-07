import type { AppCurrency } from '../types';
import { formatCurrency } from './dateUtils';

export interface InvoiceSaleDetails {
  saleId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  invoiceNo: string;
  customerId?: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceName: string;
  serviceDescription?: string;
  serviceLogoUrl?: string;
  planName: string;
  durationLabel?: string;
  allocation?: string;
  profileName?: string;
  durationDays?: number;
  startDate?: string;
  expiryDate?: string;
  amount: number;
  amountPaid?: number;
  amountDue?: number;
  subtotal?: number;
  discount?: number;
  currency: AppCurrency;
  paymentMethod: string;
  paymentMethodBreakdown?: { methodName: string; amount: number }[];
  paymentStatus: string;
  paymentDate?: string;
  transactionId?: string;
  paymentHistory?: {
    id: string;
    paymentDate: string;
    paymentMethod: string;
    amount: number;
    currency: AppCurrency;
    paymentStatus: string;
    transactionId?: string;
  }[];
  senderNumber?: string;
  notes?: string;
  storeName?: string;
  tagline?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  adminEmail?: string;
  businessAddress?: string;
  invoiceFooter?: string;
  invoiceLogoUrl?: string;
  invoiceSettings?: {
    showLogo?: boolean;
    showDescription?: boolean;
    showPlan?: boolean;
    showSubscriptionPeriod?: boolean;
    showPaymentMethod?: boolean;
    showCustomerPhone?: boolean;
    showCustomerEmail?: boolean;
    showTransactionId?: boolean;
  };
}

export interface GeneratedInvoiceResult {
  dataUrl: string;
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
}

const WIDTH = 900;
const HEIGHT = 1200;
const FONT = 'Arial, "Noto Sans Bengali", "Noto Sans", sans-serif';
const COLORS = {
  ink: '#17211f',
  muted: '#687572',
  green: '#087a57',
  greenLight: '#edf7f2',
  border: '#e2e9e6',
  background: '#f6f8f7',
  white: '#ffffff',
  amber: '#9a5a00',
  amberLight: '#fff4d6',
  red: '#ae3030',
  redLight: '#fde9e9',
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign = 'left'
): void {
  context.textAlign = align;
  let value = text;
  while (value.length > 1 && context.measureText(value).width > maxWidth) {
    value = `${value.slice(0, -2)}…`;
  }
  context.fillText(value, x, y);
}

function drawDivider(context: CanvasRenderingContext2D, y: number): void {
  context.strokeStyle = COLORS.border;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(92, y);
  context.lineTo(WIDTH - 92, y);
  context.stroke();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob && blob.size > 0) resolve(blob);
      else reject(new Error('Invoice image encoding returned an empty file.'));
    }, 'image/jpeg', 0.94);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to prepare the invoice preview.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read the invoice image.'));
    reader.readAsDataURL(blob);
  });
}

function loadInvoiceLogo(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The business logo could not be loaded for the invoice.'));
    image.src = url;
  });
}

function safeFileName(invoiceNo: string): string {
  const safeNumber = invoiceNo.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `Invoice-${safeNumber || 'Invoice'}.jpg`;
}

function formatInvoiceDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export async function generateInvoiceJpg(data: InvoiceSaleDetails): Promise<GeneratedInvoiceResult> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');

  let logo: HTMLImageElement | null = null;
  if (data.invoiceSettings?.showLogo !== false && data.invoiceLogoUrl?.trim()) {
    try {
      logo = await loadInvoiceLogo(data.invoiceLogoUrl.trim());
    } catch (error) {
      console.error('Invoice logo could not be loaded; generating a text-only header.', error);
    }
  }
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = COLORS.white;
  roundedRect(context, 24, 24, WIDTH - 48, HEIGHT - 48, 24);

  if (logo) {
    const scale = Math.min(150 / logo.width, 112 / logo.height);
    const logoWidth = logo.width * scale;
    const logoHeight = logo.height * scale;
    context.drawImage(logo, 72 + (150 - logoWidth) / 2, 62 + (112 - logoHeight) / 2, logoWidth, logoHeight);
  }

  context.fillStyle = COLORS.ink;
  context.font = `800 38px ${FONT}`;
  const hasLogo = Boolean(logo);
  const businessNameX = hasLogo ? 254 : WIDTH / 2;
  const businessNameWidth = hasLogo ? WIDTH - 326 : WIDTH - 184;
  drawText(context, data.storeName?.trim() || 'Your Business', businessNameX, 112, businessNameWidth, hasLogo ? 'left' : 'center');
  context.fillStyle = COLORS.muted;
  context.font = `400 24px ${FONT}`;
  const support = data.whatsappNumber?.trim();
  if (data.tagline?.trim()) {
    drawText(context, data.tagline.trim(), businessNameX, 154, businessNameWidth, hasLogo ? 'left' : 'center');
  } else if (support) {
    drawText(context, `WhatsApp: ${support}`, businessNameX, 154, businessNameWidth, hasLogo ? 'left' : 'center');
  }
  if (data.businessAddress?.trim()) {
    context.font = `400 18px ${FONT}`;
    context.fillStyle = COLORS.muted;
    drawText(context, data.businessAddress.trim(), businessNameX, 184, businessNameWidth, hasLogo ? 'left' : 'center');
  }
  if (data.businessAddress?.trim()) {
    context.font = `400 18px ${FONT}`;
    context.fillStyle = COLORS.muted;
    drawText(context, data.businessAddress.trim(), businessNameX, 184, businessNameWidth, hasLogo ? 'left' : 'center');
  }

  drawDivider(context, 210);

  context.fillStyle = COLORS.green;
  context.font = `800 30px ${FONT}`;
  context.textAlign = 'left';
  context.fillText('INVOICE', 92, 264);
  context.fillStyle = COLORS.ink;
  context.font = `700 24px ${FONT}`;
  drawText(context, data.invoiceNo, 92, 308, 460);
  context.fillStyle = COLORS.muted;
  context.font = `400 22px ${FONT}`;
  context.fillText(`Date: ${formatInvoiceDate(data.date)}`, 92, 344);
  const status = data.paymentStatus.replace(/_/g, ' ').toUpperCase();
  const statusColor = data.paymentStatus === 'paid'
    ? COLORS.green
    : data.paymentStatus === 'refunded' || data.paymentStatus === 'failed'
      ? COLORS.red
      : COLORS.amber;
  const statusBackground = data.paymentStatus === 'paid'
    ? COLORS.greenLight
    : data.paymentStatus === 'refunded' || data.paymentStatus === 'failed'
      ? COLORS.redLight
      : COLORS.amberLight;
  context.fillStyle = statusBackground;
  roundedRect(context, WIDTH - 276, 244, 184, 48, 18);
  context.fillStyle = statusColor;
  context.font = `700 19px ${FONT}`;
  context.textAlign = 'center';
  context.fillText(status, WIDTH - 184, 275);

  drawDivider(context, 378);

  const sectionLabel = (label: string, y: number) => {
    context.fillStyle = COLORS.green;
    context.font = `700 19px ${FONT}`;
    context.textAlign = 'left';
    context.fillText(label, 92, y);
  };
  const primaryText = (text: string, y: number) => {
    context.fillStyle = COLORS.ink;
    context.font = `700 27px ${FONT}`;
    drawText(context, text, 92, y, 716);
  };
  const secondaryText = (text: string, y: number) => {
    context.fillStyle = COLORS.muted;
    context.font = `400 22px ${FONT}`;
    drawText(context, text, 92, y, 716);
  };

  sectionLabel('CUSTOMER', 414);
  primaryText(data.customerName || 'Customer', 454);
  if (data.invoiceSettings?.showCustomerPhone !== false && data.customerPhone) secondaryText(data.customerPhone, 488);
  drawDivider(context, 520);

  sectionLabel('SERVICE & PLAN', 556);
  primaryText(data.serviceName || 'Service unavailable', 596);
  if (data.invoiceSettings?.showPlan !== false) secondaryText(data.planName || 'Plan information unavailable', 632);
  let detailY = data.invoiceSettings?.showPlan !== false ? 668 : 632;
  if (data.invoiceSettings?.showSubscriptionPeriod !== false && (data.durationLabel || (data.durationDays && data.durationDays > 0))) {
    secondaryText(`Duration: ${data.durationLabel || `${data.durationDays} days`}`, detailY);
    detailY += 36;
  }
  if (data.invoiceSettings?.showSubscriptionPeriod !== false && (data.startDate || data.expiryDate)) {
    const period = [data.startDate && formatInvoiceDate(data.startDate), data.expiryDate && formatInvoiceDate(data.expiryDate)]
      .filter(Boolean)
      .join(' – ');
    secondaryText(`Subscription period: ${period}`, detailY);
  }
  drawDivider(context, 738);

  sectionLabel('PAYMENT SUMMARY', 778);
  const paid = data.amountPaid ?? (data.paymentStatus === 'paid' ? data.amount : 0);
  const due = data.amountDue ?? Math.max(0, data.amount - paid);
  const paymentRow = (label: string, value: string, y: number, emphasis = false, valueColor?: string) => {
    context.fillStyle = emphasis ? COLORS.ink : COLORS.muted;
    context.font = `${emphasis ? '700' : '500'} ${emphasis ? '25' : '22'}px ${FONT}`;
    context.textAlign = 'left';
    context.fillText(label, 92, y);
    context.fillStyle = valueColor || (emphasis ? COLORS.green : COLORS.ink);
    drawText(context, value, WIDTH - 92, y, 430, 'right');
  };

  paymentRow('Total', formatCurrency(data.amount, data.currency), 822, true);
  paymentRow('Paid', formatCurrency(paid, data.currency), 866);
  paymentRow('Due', formatCurrency(due, data.currency), 910, due > 0, due > 0 ? COLORS.amber : undefined);
  if (data.invoiceSettings?.showPaymentMethod !== false) {
    const methods = data.paymentMethodBreakdown?.map(item =>
      `${item.methodName}: ${formatCurrency(item.amount, data.currency)}`
    ).join(', ');
    paymentRow('Method breakdown', methods || data.paymentMethod || 'Not specified', 954);
  }

  drawDivider(context, 1000);
  context.fillStyle = COLORS.green;
  context.font = `700 24px ${FONT}`;
  context.textAlign = 'center';
  context.fillText('Thank you for your purchase', WIDTH / 2, 1050);
  context.fillStyle = COLORS.muted;
  context.font = `400 17px ${FONT}`;
  if (support) context.fillText(`WhatsApp: ${support}`, WIDTH / 2, 1084);
  if (data.contactPhone && data.contactPhone !== support) context.fillText(`Phone: ${data.contactPhone}`, WIDTH / 2, 1110);
  if (data.invoiceFooter?.trim()) {
    context.font = `400 16px ${FONT}`;
    context.fillText(data.invoiceFooter.trim().slice(0, 110), WIDTH / 2, 1150);
  }
  if (data.invoiceFooter?.trim()) {
    context.font = `400 16px ${FONT}`;
    context.fillText(data.invoiceFooter.trim().slice(0, 110), WIDTH / 2, 1150);
  }

  const blob = await canvasToBlob(canvas);
  return {
    dataUrl: await blobToDataUrl(blob),
    blob,
    fileName: safeFileName(data.invoiceNo),
    width: WIDTH,
    height: HEIGHT,
  };
}

export function downloadInvoiceJpg(data: string | Blob, fileName: string): void {
  const objectUrl = typeof data === 'string' ? data : URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (typeof data !== 'string') window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function canShareInvoiceJpg(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare || typeof File === 'undefined') {
    return false;
  }
  try {
    const file = new File(['invoice'], 'invoice.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [file] });
  } catch (error) {
    console.error('Invoice file sharing capability could not be checked.', error);
    return false;
  }
}

export type InvoiceShareResult = 'shared' | 'unsupported' | 'cancelled';

export async function shareInvoiceJpg(
  blob: Blob,
  fileName: string,
  title: string,
  text: string
): Promise<InvoiceShareResult> {
  if (!canShareInvoiceJpg()) return 'unsupported';
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  try {
    await navigator.share({ files: [file], title, text });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}
