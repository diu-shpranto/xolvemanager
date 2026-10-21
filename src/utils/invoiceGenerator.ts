import type { AppCurrency, CustomerType, Language } from '../types';
import { formatAppDate, formatCurrency } from './dateUtils';

export interface InvoiceSaleDetails {
  saleId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  invoiceNo: string;
  customerId?: string;
  customerType?: CustomerType;
  date: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceName: string;
  lineItems?: {
    serviceName: string;
    planName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discount?: number;
    total?: number;
    currency: AppCurrency;
    startDate?: string;
    expiryDate?: string;
    durationDays?: number;
  }[];
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
  amountReceived?: number;
  advanceCreditApplied?: number;
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

const FONT = 'Arial, "Noto Sans Bengali", "Noto Sans", sans-serif';
const COLORS = {
  ink: '#17211f',
  muted: '#687572',
  purple: '#6d28d9',
  purpleLight: '#f3edff',
  green: '#087a57',
  greenLight: '#edf7f2',
  border: '#e2e9e6',
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

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (context.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line);
        line = '';
      }
      let fragment = '';
      for (const character of word) {
        if (fragment && context.measureText(`${fragment}${character}`).width > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment += character;
        }
      }
      line = fragment;
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
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

function formatInvoiceDate(date: string, language: Language): string {
  return formatAppDate(date, language, { day: '2-digit' });
}

export async function generateInvoiceJpg(data: InvoiceSaleDetails, language: Language = 'en'): Promise<GeneratedInvoiceResult> {
  const invoiceItems = data.lineItems?.length
    ? data.lineItems
    : [{
      serviceName: data.serviceName || 'Service unavailable',
      planName: data.planName || 'Plan information unavailable',
      quantity: 1,
      unitPrice: data.subtotal ?? data.amount + (data.discount || 0),
      subtotal: data.subtotal ?? data.amount + (data.discount || 0),
      discount: data.discount || 0,
      total: data.amount,
      currency: data.currency,
      startDate: data.startDate,
      expiryDate: data.expiryDate,
      durationDays: data.durationDays,
    }];
  const statusLabel = data.paymentStatus === 'paid'
    ? 'PAID'
    : data.paymentStatus === 'partial'
      ? 'PARTIAL'
      : data.paymentStatus === 'pending'
        ? 'PENDING'
        : data.paymentStatus.replace(/_/g, ' ').toUpperCase();
  const paid = data.amountPaid ?? (data.paymentStatus === 'paid' ? data.amount : 0);
  const due = data.amountDue ?? Math.max(0, data.amount - paid);
  const received = data.amountReceived ?? paid;
  const advanceCredit = data.advanceCreditApplied ?? Math.max(0, paid - received);
  const itemDiscountTotal = invoiceItems.reduce((total, item) => total + (item.discount || 0), 0);
  const invoiceDiscount = Math.max(0, (data.discount || 0) - itemDiscountTotal);
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 10;
  let context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');

  let logo: HTMLImageElement | null = null;
  if (data.invoiceSettings?.showLogo !== false && data.invoiceLogoUrl?.trim()) {
    try {
      logo = await loadInvoiceLogo(data.invoiceLogoUrl.trim());
    } catch (error) {
      console.error('Invoice logo could not be loaded; generating a text-only header.', error);
    }
  }
  const lineLayouts = invoiceItems.map(item => {
    context!.font = `700 20px ${FONT}`;
    const title = `${item.serviceName}${data.invoiceSettings?.showPlan === false ? '' : ` · ${item.planName}`}`;
    const titleLines = wrapText(context!, title, 290);
    const period = [item.startDate && formatInvoiceDate(item.startDate, language), item.expiryDate && formatInvoiceDate(item.expiryDate, language)]
      .filter(Boolean)
      .join(' – ');
    const detail = period;
    context!.font = `400 15px ${FONT}`;
    const detailLines = detail ? wrapText(context!, detail, 290) : [];
    return { item, titleLines, detailLines, height: 22 + titleLines.length * 24 + detailLines.length * 19 };
  });
  const businessNameX = logo ? 160 : 72;
  const brandWidth = logo ? 465 : 535;
  context.font = `700 27px ${FONT}`;
  const businessLines = wrapText(context, data.storeName?.trim() || 'Your Business', brandWidth);
  context.font = `400 15px ${FONT}`;
  const contactLines = [
    data.tagline?.trim(),
    data.contactPhone?.trim() && `Phone: ${data.contactPhone.trim()}`,
    data.whatsappNumber?.trim() && data.whatsappNumber.trim() !== data.contactPhone?.trim() && `WhatsApp: ${data.whatsappNumber.trim()}`,
    data.adminEmail?.trim(),
    data.businessAddress?.trim(),
  ].filter(Boolean).join(' · ');
  const brandDetailLines = contactLines ? wrapText(context, contactLines, brandWidth) : [];
  context.font = `700 20px ${FONT}`;
  const customerNameLines = wrapText(
    context,
    `${data.customerName || 'Customer'}${data.customerType ? ` · ${data.customerType}` : ''}`,
    360
  );
  context.font = `400 15px ${FONT}`;
  const customerDetails = [
    data.customerId && `Customer ID: ${data.customerId}`,
    data.invoiceSettings?.showCustomerPhone !== false && data.customerPhone,
    data.invoiceSettings?.showCustomerEmail !== false && data.customerEmail,
  ].filter(Boolean);
  const customerDetailLines = customerDetails.flatMap(line => wrapText(context!, line!, 360));
  const paymentHistory = (data.paymentHistory || []).filter(payment => payment.amount > 0);
  const transactionLines = data.invoiceSettings?.showTransactionId !== false && data.transactionId
    ? wrapText(context, `Reference: ${data.transactionId}`, 420)
    : [];
  const paymentDateLines = data.paymentDate
    ? wrapText(context, `Latest payment: ${formatInvoiceDate(data.paymentDate, language)}`, 420)
    : [];
  const methodText = data.invoiceSettings?.showPaymentMethod !== false
    ? data.paymentMethodBreakdown?.map(item => `${item.methodName}: ${formatCurrency(item.amount, data.currency, language)}`).join(', ') || data.paymentMethod
    : '';
  context.font = `400 14px ${FONT}`;
  const methodLines = methodText ? wrapText(context, `Method: ${methodText}`, 420) : [];
  const senderLines = data.senderNumber ? wrapText(context, `Sender: ${data.senderNumber}`, 420) : [];
  context.font = `400 15px ${FONT}`;
  const footerNote = [data.invoiceFooter?.trim(), data.notes?.trim()].filter(Boolean).join(' · ');
  const footerLines = footerNote ? wrapText(context, footerNote, 740) : [];
  const footerContact = [
    data.contactPhone && `Phone: ${data.contactPhone}`,
    data.whatsappNumber && data.whatsappNumber !== data.contactPhone && `WhatsApp: ${data.whatsappNumber}`,
    data.adminEmail,
  ].filter(Boolean).join(' · ');
  context.font = `400 12px ${FONT}`;
  const footerContactLines = footerContact ? wrapText(context, footerContact, 800) : [];
  const paymentHistoryLayouts = paymentHistory.map(payment => {
    const title = `${formatInvoiceDate(payment.paymentDate, language)} · ${payment.paymentMethod}${payment.transactionId && data.invoiceSettings?.showTransactionId !== false ? ` · ${payment.transactionId}` : ''}`;
    context!.font = `500 13px ${FONT}`;
    const lines = wrapText(context!, title, 560);
    return { payment, lines, height: Math.max(42, lines.length * 17 + 16) };
  });
  const paymentRows: { label: string; amount: number; emphasis?: boolean; color?: string }[] = [
    { label: 'Subtotal', amount: data.subtotal ?? data.amount + (data.discount || 0) },
    ...(itemDiscountTotal > 0 ? [{ label: 'Item discounts', amount: -itemDiscountTotal, color: COLORS.purple }] : []),
    ...(invoiceDiscount > 0 ? [{ label: 'Invoice discount', amount: -invoiceDiscount, color: COLORS.purple }] : []),
    { label: 'Grand total', amount: data.amount, emphasis: true },
    { label: 'Amount paid / applied', amount: paid, color: COLORS.green },
    ...(received > 0 ? [{ label: 'Cash received', amount: received }] : []),
    ...(advanceCredit > 0 ? [{ label: 'Advance credit applied', amount: advanceCredit }] : []),
    { label: 'Outstanding due', amount: due, emphasis: true, color: due > 0 ? COLORS.amber : COLORS.green },
  ];
  const headerEndLayout = Math.max(184, 94 + businessLines.length * 30 + brandDetailLines.length * 19);
  const paymentDetailsLines = methodLines.length + paymentDateLines.length + transactionLines.length + senderLines.length;
  const paymentDetailGroups = [methodLines, paymentDateLines, transactionLines, senderLines].filter(lines => lines.length).length;
  const billDetailsEndOffset = Math.max(
    64 + customerNameLines.length * 23 + customerDetailLines.length * 19,
    61 + paymentDetailsLines * 19 + paymentDetailGroups * 5
  );
  const itemRowsHeight = lineLayouts.reduce((total, item) => total + item.height, 0);
  const historyHeight = paymentHistoryLayouts.length
    ? 49 + paymentHistoryLayouts.reduce((total, item) => total + item.height, 0) + 22
    : 0;
  const finalHeight = headerEndLayout
    + billDetailsEndOffset + 26 + 28 + 18 + 32 + itemRowsHeight
    + 56 + paymentRows.length * 31 + historyHeight
    + 37 + 25 + footerContactLines.length * 17
    + (footerLines.length ? 8 + footerLines.length * 17 : 0)
    + 24;
  canvas.height = finalHeight;
  context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  context.fillStyle = COLORS.white;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const contentLeft = 72;
  const contentRight = canvas.width - 72;
  const contentWidth = contentRight - contentLeft;
  const writeLines = (
    lines: string[],
    x: number,
    firstBaseline: number,
    lineHeight: number,
    color: string,
    font: string,
    maxWidth: number,
    align: CanvasTextAlign = 'left'
  ) => {
    context!.fillStyle = color;
    context!.font = font;
    context!.textAlign = align;
    lines.forEach((line, index) => context!.fillText(line, x, firstBaseline + index * lineHeight, maxWidth));
  };
  const divider = (y: number) => {
    context!.strokeStyle = COLORS.border;
    context!.lineWidth = 1;
    context!.beginPath();
    context!.moveTo(contentLeft, y);
    context!.lineTo(contentRight, y);
    context!.stroke();
  };
  const drawLabel = (text: string, y: number) => writeLines(
    [text.toUpperCase()], contentLeft, y, 18, COLORS.purple, `700 13px ${FONT}`, contentWidth
  );
  let brandY = 68;
  if (logo) {
    const scale = Math.min(68 / logo.width, 68 / logo.height);
    const logoWidth = logo.width * scale;
    const logoHeight = logo.height * scale;
    context.drawImage(logo, contentLeft, 52 + (68 - logoHeight) / 2, logoWidth, logoHeight);
  }
  writeLines(businessLines, businessNameX, brandY, 30, COLORS.ink, `700 27px ${FONT}`, brandWidth);
  brandY += businessLines.length * 30 + 7;
  writeLines(brandDetailLines, businessNameX, brandY, 19, COLORS.muted, `400 15px ${FONT}`, brandWidth);
  context.fillStyle = COLORS.purple;
  context.font = `800 25px ${FONT}`;
  context.textAlign = 'right';
  context.fillText('INVOICE', contentRight, 64);
  context.fillStyle = COLORS.ink;
  context.font = `700 17px ${FONT}`;
  context.fillText(data.invoiceNo, contentRight, 92, 260);
  context.fillStyle = COLORS.muted;
  context.font = `400 14px ${FONT}`;
  context.fillText(`Date · ${formatInvoiceDate(data.date, language)}`, contentRight, 117);
  const statusColor = data.paymentStatus === 'paid'
    ? COLORS.green
    : data.paymentStatus === 'failed' || data.paymentStatus === 'refunded'
      ? COLORS.red
      : data.paymentStatus === 'partial'
        ? COLORS.purple
        : COLORS.amber;
  const statusBackground = data.paymentStatus === 'paid'
    ? COLORS.greenLight
    : data.paymentStatus === 'failed' || data.paymentStatus === 'refunded'
      ? COLORS.redLight
      : data.paymentStatus === 'partial'
        ? COLORS.purpleLight
        : COLORS.amberLight;
  context.fillStyle = statusBackground;
  roundedRect(context, contentRight - 112, 133, 112, 28, 9);
  context.fillStyle = statusColor;
  context.font = `700 12px ${FONT}`;
  context.textAlign = 'center';
  context.fillText(statusLabel, contentRight - 56, 152);
  const headerEnd = Math.max(
    184,
    brandY + brandDetailLines.length * 19 + 12,
    169
  );
  divider(headerEnd);
  let y = headerEnd + 32;
  drawLabel('Bill to', y);
  y += 29;
  writeLines(customerNameLines, contentLeft, y, 23, COLORS.ink, `700 20px ${FONT}`, 360);
  const customerDetailY = y + customerNameLines.length * 23 + 3;
  writeLines(customerDetailLines, contentLeft, customerDetailY, 19, COLORS.muted, `400 15px ${FONT}`, 360);
  const paymentX = 520;
  context.fillStyle = COLORS.purple;
  context.font = `700 13px ${FONT}`;
  context.textAlign = 'left';
  context.fillText('PAYMENT DETAILS', paymentX, headerEnd + 32);
  let detailY = headerEnd + 61;
  for (const lines of [methodLines, paymentDateLines, transactionLines, senderLines]) {
    if (!lines.length) continue;
    writeLines(lines, paymentX, detailY, 19, COLORS.muted, `400 14px ${FONT}`, contentRight - paymentX);
    detailY += lines.length * 19 + 5;
  }
  y = Math.max(
    customerDetailY + customerDetailLines.length * 19,
    detailY
  ) + 26;
  divider(y);
  y += 28;
  drawLabel('Items and services', y);
  y += 18;
  const columns = [
    { label: 'ITEM / SERVICE AND PLAN', x: contentLeft, width: 300, align: 'left' as const },
    { label: 'DURATION', x: 386, width: 88, align: 'left' as const },
    { label: 'QTY', x: 487, width: 44, align: 'right' as const },
    { label: 'UNIT PRICE', x: 642, width: 106, align: 'right' as const },
    { label: 'DISCOUNT', x: 770, width: 100, align: 'right' as const },
    { label: 'LINE TOTAL', x: contentRight, width: 130, align: 'right' as const },
  ];
  context.fillStyle = COLORS.purpleLight;
  context.fillRect(contentLeft, y, contentWidth, 32);
  columns.forEach(column => {
    context!.fillStyle = COLORS.muted;
    context!.font = `700 10px ${FONT}`;
    context!.textAlign = column.align;
    context!.fillText(column.label, column.x, y + 20, column.width);
  });
  y += 32;
  for (const layout of lineLayouts) {
    const { item, titleLines, detailLines, height } = layout;
    const rowTop = y;
    writeLines(titleLines, contentLeft + 4, rowTop + 22, 23, COLORS.ink, `700 16px ${FONT}`, 292);
    writeLines(detailLines, contentLeft + 4, rowTop + 22 + titleLines.length * 23, 18, COLORS.muted, `400 12px ${FONT}`, 292);
    const itemDiscount = item.discount || 0;
    const duration = item.durationDays ? `${item.durationDays} days` : '—';
    const values = [
      { text: duration, x: 386, width: 88, align: 'left' as const, color: COLORS.muted },
      { text: String(item.quantity), x: 487, width: 44, align: 'right' as const, color: COLORS.ink },
      { text: formatCurrency(item.unitPrice, item.currency, language), x: 642, width: 106, align: 'right' as const, color: COLORS.ink },
      { text: formatCurrency(itemDiscount, item.currency, language), x: 770, width: 100, align: 'right' as const, color: COLORS.muted },
      { text: formatCurrency(item.total ?? Math.max(0, item.subtotal - itemDiscount), item.currency, language), x: contentRight, width: 130, align: 'right' as const, color: COLORS.ink },
    ];
    values.forEach(value => {
      context!.fillStyle = value.color;
      context!.font = `500 13px ${FONT}`;
      context!.textAlign = value.align;
      context!.fillText(value.text, value.x, rowTop + 23, value.width);
    });
    y += height;
    divider(y);
  }
  y += 28;
  const summaryX = 500;
  const summaryWidth = contentRight - summaryX;
  const summaryTop = y;
  context.fillStyle = '#fbfaff';
  context.fillRect(summaryX, summaryTop, summaryWidth, paymentRows.length * 31 + 18);
  let summaryY = summaryTop + 25;
  for (const row of paymentRows) {
    const isDiscount = row.amount < 0;
    context.fillStyle = row.emphasis ? COLORS.ink : COLORS.muted;
    context.font = `${row.emphasis ? '700' : '500'} ${row.emphasis ? '15' : '13'}px ${FONT}`;
    context.textAlign = 'left';
    context.fillText(row.label, summaryX + 12, summaryY);
    context.fillStyle = row.color || COLORS.ink;
    context.font = `${row.emphasis ? '700' : '500'} ${row.emphasis ? '15' : '13'}px ${FONT}`;
    context.textAlign = 'right';
    const amountText = formatCurrency(Math.abs(row.amount), data.currency, language);
    context.fillText(`${isDiscount ? '− ' : ''}${amountText}`, contentRight - 12, summaryY);
    if (row.label === 'Grand total') {
      context.strokeStyle = COLORS.border;
      context.beginPath();
      context.moveTo(summaryX + 10, summaryY + 9);
      context.lineTo(contentRight - 10, summaryY + 9);
      context.stroke();
    }
    summaryY += 31;
  }
  y = summaryTop + paymentRows.length * 31 + 28;
  if (paymentHistory.length) {
    divider(y);
    y += 27;
    drawLabel('Payment history', y);
    y += 22;
    paymentHistoryLayouts.forEach(({ payment, lines, height }) => {
      writeLines(lines, contentLeft, y + 15, 17, COLORS.muted, `500 13px ${FONT}`, 560);
      context!.fillStyle = COLORS.ink;
      context!.font = `700 13px ${FONT}`;
      context!.textAlign = 'right';
      context!.fillText(formatCurrency(payment.amount, payment.currency, language), contentRight, y + 15, 220);
      y += height;
      divider(y);
    });
    y += 22;
  }
  divider(y);
  y += 37;
  context.fillStyle = COLORS.purple;
  context.font = `700 18px ${FONT}`;
  context.textAlign = 'center';
  context.fillText('Thank you for your business', canvas.width / 2, y);
  y += 25;
  context.font = `400 12px ${FONT}`;
  context.fillStyle = COLORS.muted;
  if (footerContactLines.length) {
    writeLines(footerContactLines, canvas.width / 2, y, 17, COLORS.muted, `400 12px ${FONT}`, 800, 'center');
    y += footerContactLines.length * 17;
  }
  if (footerLines.length) {
    context.font = `400 12px ${FONT}`;
    const start = y + 8;
    writeLines(footerLines, canvas.width / 2, start, 17, COLORS.muted, `400 12px ${FONT}`, 800, 'center');
  }

  const blob = await canvasToBlob(canvas);
  return {
    dataUrl: await blobToDataUrl(blob),
    blob,
    fileName: safeFileName(data.invoiceNo),
    width: canvas.width,
    height: canvas.height,
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
