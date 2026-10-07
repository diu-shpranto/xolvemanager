import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';
import { useApp } from '../../context/AppContext';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { Download, Share2, CheckCircle2, RefreshCw, MessageCircle, Printer, Image } from 'lucide-react';
import { formatAppDate, formatAppDateTime, formatCurrency } from '../../utils/dateUtils';
import {
  InvoiceSaleDetails,
  GeneratedInvoiceResult,
  generateInvoiceJpg,
  downloadInvoiceJpg,
  shareInvoiceJpg,
} from '../../utils/invoiceGenerator';

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'paid': return 'Paid';
    case 'partial': return 'Partially Paid';
    case 'failed': return 'Payment Failed';
    case 'refunded': return 'Refunded';
    default: return 'Payment Due';
  }
};

const getStatusColors = (status: string): { background: string; foreground: string; border: string } => {
  if (status === 'paid') return { background: '#ecfdf5', foreground: '#047857', border: '#a7f3d0' };
  if (status === 'failed' || status === 'refunded') return { background: '#fff1f2', foreground: '#be123c', border: '#fecdd3' };
  return { background: '#fffbeb', foreground: '#b45309', border: '#fde68a' };
};

const buildPrintableInvoice = (data: InvoiceSaleDetails): string => {
  const statusColors = getStatusColors(data.paymentStatus);
  const currency = data.currency;
  const showPhone = data.invoiceSettings?.showCustomerPhone !== false;
  const showEmail = data.invoiceSettings?.showCustomerEmail !== false;
  const showServiceDescription = data.invoiceSettings?.showDescription !== false && Boolean(data.serviceDescription);
  const showPlan = data.invoiceSettings?.showPlan !== false;
  const showPeriod = data.invoiceSettings?.showSubscriptionPeriod !== false
    && Boolean(data.startDate || data.expiryDate || data.durationLabel);
  const showPaymentMethod = data.invoiceSettings?.showPaymentMethod !== false;
  const subtotal = data.subtotal ?? data.amount;
  const discount = data.discount ?? 0;
  const paid = data.amountPaid ?? (data.paymentStatus === 'paid' ? data.amount : 0);
  const due = data.amountDue ?? Math.max(0, data.amount - paid);
  const logo = data.invoiceSettings?.showLogo !== false && data.invoiceLogoUrl
    ? `<img src="${escapeHtml(data.invoiceLogoUrl)}" alt="" style="width:64px;height:64px;object-fit:contain;border:1px solid #e2e8f0;border-radius:16px;padding:6px">`
    : '';
  const period = [data.startDate && formatAppDate(data.startDate), data.expiryDate && formatAppDate(data.expiryDate)]
    .filter(Boolean)
    .join(' – ');
  const contactLines = [
    data.contactPhone && `Phone: ${data.contactPhone}`,
    data.whatsappNumber && `WhatsApp: ${data.whatsappNumber}`,
    data.adminEmail,
    data.businessAddress,
  ].filter(Boolean).map(line => `<div>${escapeHtml(line)}</div>`).join('');
  const serviceDescription = showServiceDescription
    ? `<p style="margin:6px 0 0;color:#64748b">${escapeHtml(data.serviceDescription)}</p>`
    : '';
  const plan = showPlan ? `<div style="margin-top:4px;color:#64748b">${escapeHtml(data.planName)}</div>` : '';
  const periodBlock = showPeriod
    ? `<div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:10px"><small style="color:#94a3b8;text-transform:uppercase">Subscription Period</small><div style="margin-top:4px;font-weight:600">${escapeHtml(period || data.durationLabel || '')}</div>${period && data.durationLabel ? `<div style="margin-top:3px;color:#64748b;font-size:12px">${escapeHtml(data.durationLabel)}</div>` : ''}</div>`
    : '';
  const summaryRows = [
    ...(discount > 0 ? [`<div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(formatCurrency(subtotal, currency))}</strong></div>`, `<div class="summary-row"><span>Discount</span><strong>− ${escapeHtml(formatCurrency(discount, currency))}</strong></div>`] : []),
    `<div class="summary-row grand"><span>Total</span><strong>${escapeHtml(formatCurrency(data.amount, currency))}</strong></div>`,
    `<div class="summary-row"><span>Amount Paid</span><strong class="paid">${escapeHtml(formatCurrency(paid, currency))}</strong></div>`,
    `<div class="summary-row balance ${due > 0 ? 'due' : 'clear'}"><span>Balance Due</span><strong>${escapeHtml(formatCurrency(due, currency))}</strong></div>`,
  ].join('');
  const paymentDetails = [
    showPaymentMethod && `<div><small>Method breakdown</small><strong>${escapeHtml(data.paymentMethodBreakdown?.map(item => `${item.methodName}: ${formatCurrency(item.amount, data.currency)}`).join(', ') || data.paymentMethod || 'Not specified')}</strong></div>`,
    data.paymentDate && `<div><small>Paid At</small><strong>${escapeHtml(formatAppDate(data.paymentDate))}</strong></div>`,
    data.invoiceSettings?.showTransactionId !== false && data.transactionId && `<div><small>Transaction ID</small><strong class="break">${escapeHtml(data.transactionId)}</strong></div>`,
    data.senderNumber && `<div><small>Sender</small><strong>${escapeHtml(data.senderNumber)}</strong></div>`,
  ].filter(Boolean).join('');
  const paymentHistory = data.paymentHistory?.length
    ? `<section class="section"><div class="section-title">Payment History</div><div class="item">${data.paymentHistory.map(payment =>
      `<div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #f1f5f9"><span>${escapeHtml(formatAppDate(payment.paymentDate))} · ${escapeHtml(payment.paymentMethod)}${data.invoiceSettings?.showTransactionId !== false && payment.transactionId ? `<br><small>${escapeHtml(payment.transactionId)}</small>` : ''}</span><strong>${escapeHtml(formatCurrency(payment.amount, payment.currency))} · ${escapeHtml(payment.paymentStatus)}</strong></div>`
    ).join('')}</div></section>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${escapeHtml(data.invoiceNo)}</title><style>
    *{box-sizing:border-box}body{margin:0;padding:32px;background:#f1f5f9;color:#0f172a;font:14px Arial,sans-serif}.page{max-width:900px;margin:0 auto}.card{overflow:hidden;border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 24px 60px rgba(15,23,42,.12)}.accent{height:6px;background:linear-gradient(90deg,#10b981,#14b8a6,#06b6d4)}.content{padding:32px}.header{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #e2e8f0;padding-bottom:24px}.brand{display:flex;gap:16px;align-items:flex-start}.brand-name{font-size:22px;font-weight:800}.muted{color:#64748b}.contact{margin-top:12px;font-size:12px;line-height:1.7}.invoice-meta{text-align:right;min-width:210px}.label{font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.invoice-number{margin-top:14px;font:700 18px ui-monospace,monospace}.status{display:inline-block;border:1px solid ${statusColors.border};border-radius:20px;padding:7px 12px;background:${statusColors.background};color:${statusColors.foreground};font-size:11px;font-weight:700}.meta-row{margin-top:6px;color:#64748b;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}.box{border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;padding:18px}.box-title{font-size:10px;letter-spacing:.16em;color:#94a3b8;text-transform:uppercase;font-weight:700}.name{margin-top:10px;font-size:16px;font-weight:700}.box p{margin:6px 0;color:#64748b}.box strong{display:block;margin-top:5px}.section{margin-top:28px}.section-title{font-size:11px;letter-spacing:.16em;color:#047857;text-transform:uppercase;font-weight:800;margin-bottom:12px}.item{border:1px solid #e2e8f0;border-radius:16px;padding:18px}.item-head{display:flex;justify-content:space-between;gap:16px}.item-title{font-size:16px;font-weight:800}.price{white-space:nowrap;font-weight:800}.summary-wrap{display:flex;justify-content:flex-end;margin-top:24px}.summary{width:100%;max-width:420px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;padding:20px}.summary-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;color:#64748b}.summary-row strong{color:#0f172a}.summary-row.grand{border-top:1px solid #e2e8f0;margin-top:5px;padding-top:14px;color:#0f172a;font-size:16px}.summary-row.grand strong{font-size:22px}.summary-row .paid{color:#047857}.balance{border:1px solid;border-radius:12px;margin-top:10px;padding:12px}.balance.due{border-color:#fecdd3;background:#fff1f2;color:#be123c}.balance.due strong{color:#be123c}.balance.clear{border-color:#a7f3d0;background:#ecfdf5;color:#047857}.balance.clear strong{color:#047857}.payment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.payment-grid small{display:block;color:#94a3b8;margin-bottom:5px}.break{overflow-wrap:anywhere}.footer{border-top:1px solid #e2e8f0;margin-top:28px;padding-top:20px;text-align:center;color:#64748b}.footer strong{color:#0f172a}.footer p{margin:5px}.nowrap{white-space:nowrap}
    @media(max-width:600px){body{padding:12px}.content{padding:20px}.header{flex-direction:column}.invoice-meta{text-align:left}.grid{grid-template-columns:1fr}.item-head{flex-direction:column}.payment-grid{grid-template-columns:1fr 1fr}.summary-wrap{justify-content:stretch}}
    @media print{@page{size:A4 portrait;margin:12mm}body{padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.card{border:0;border-radius:0;box-shadow:none}.content{padding:12px}.box,.summary,.item{break-inside:avoid}.section,.grid,.header,.footer{break-inside:avoid}}
  </style></head><body><main class="page"><article class="card"><div class="accent"></div><div class="content">
    <header class="header"><div class="brand">${logo}<div><div class="brand-name">${escapeHtml(data.storeName || 'Your Business')}</div>${data.tagline ? `<div class="muted" style="margin-top:5px">${escapeHtml(data.tagline)}</div>` : ''}<div class="contact">${contactLines}</div></div></div><div class="invoice-meta"><span class="label">Invoice</span><div style="margin-top:10px"><span class="status">${escapeHtml(getStatusLabel(data.paymentStatus))}</span></div><div class="invoice-number">${escapeHtml(data.invoiceNo)}</div><div class="meta-row">Issued ${escapeHtml(formatAppDate(data.date))}</div></div></header>
    <section class="grid"><div class="box"><div class="box-title">Billed To</div><div class="name">${escapeHtml(data.customerName || 'Customer')}</div>${showPhone && data.customerPhone ? `<p>${escapeHtml(data.customerPhone)}</p>` : ''}${showEmail && data.customerEmail ? `<p>${escapeHtml(data.customerEmail)}</p>` : ''}</div><div class="box"><div class="box-title">Payment</div><div class="payment-grid">${paymentDetails || '<div class="muted">Payment details unavailable</div>'}</div></div></section>
    <section class="section"><div class="section-title">Service</div><div class="item"><div class="item-head"><div><div class="item-title">${escapeHtml(data.serviceName || 'Service unavailable')}</div>${plan}${serviceDescription}</div><div class="price">${escapeHtml(formatCurrency(data.amount, currency))}</div></div>${periodBlock}</div></section>
    ${paymentHistory}
    <div class="summary-wrap"><section class="summary"><div class="box-title">Payment Summary</div>${summaryRows}</section></div>
    <footer class="footer"><strong>Thank you for your business.</strong>${data.tagline ? `<p>${escapeHtml(data.tagline)}</p>` : ''}${data.invoiceFooter ? `<p>${escapeHtml(data.invoiceFooter)}</p>` : ''}</footer>
  </div></article></main></body></html>`;
};

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleData: InvoiceSaleDetails | null;
  onViewSale?: (saleId: string) => void;
  onViewCustomer?: (customerId: string) => void;
  onViewSubscription?: (subscriptionId: string) => void;
  onViewPayment?: (paymentId: string) => void;
  onAddPayment?: (saleId: string, customerId?: string) => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  saleData,
  onViewSale,
  onViewCustomer,
  onViewSubscription,
  onViewPayment,
  onAddPayment,
}) => {
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();
  const { logActivity, activityLogs } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<GeneratedInvoiceResult | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showJpgPreview, setShowJpgPreview] = useState(false);
  const generationTask = useRef<{ key: string; promise: Promise<GeneratedInvoiceResult> } | null>(null);
  const invoiceActivities = useMemo(() => activityLogs.filter(log =>
    Boolean(saleData?.invoiceId && log.invoiceId === saleData.invoiceId)
    || Boolean(saleData?.saleId && log.saleId === saleData.saleId)
    || Boolean(saleData?.saleId && log.entityId === saleData.saleId)
  ).sort((left, right) => right.timestamp.localeCompare(left.timestamp)), [activityLogs, saleData]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && saleData) {
      setIsGenerating(true);
      setInvoiceResult(null);
      setShowJpgPreview(false);
      const key = JSON.stringify(saleData);
      const task = generationTask.current?.key === key
        ? generationTask.current
        : { key, promise: generateInvoiceJpg(saleData) };
      generationTask.current = task;
      task.promise
        .then(result => {
          if (isMounted) {
            setInvoiceResult(result);
            setIsGenerating(false);
            showToast(`Invoice generated · ${(result.blob.size / 1024).toFixed(0)} KB`, 'success');
            if (saleData.saleId) {
              logActivity({
                type: 'invoice_generated',
                title: 'Invoice Generated',
                description: `Invoice ${saleData.invoiceNo} generated for ${saleData.customerName} · ${saleData.serviceName}.`,
                customerName: saleData.customerName,
                serviceName: saleData.serviceName,
                entityId: saleData.saleId,
                invoiceId: saleData.invoiceId,
                invoiceNumber: saleData.invoiceNo,
                saleId: saleData.saleId,
                customerId: saleData.customerId,
                amount: saleData.amount,
                currency: saleData.currency,
              });
            }
          }
        })
        .catch(err => {
          if (isMounted) {
            console.error('Invoice generation failed:', err);
            showToast('Unable to generate invoice. Please try again.', 'error');
            setIsGenerating(false);
          }
          if (generationTask.current === task) generationTask.current = null;
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, saleData]);

  if (!isOpen || !saleData) return null;

  const handleDownload = () => {
    if (!invoiceResult) return;
    try {
      downloadInvoiceJpg(invoiceResult.blob, invoiceResult.fileName);
      showToast(`Downloaded ${invoiceResult.fileName}`, 'success');
    } catch (error) {
      console.error('Invoice download failed:', error);
      showToast('Unable to download invoice. Please try again.', 'error');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Unable to open the print window. Check your browser pop-up settings.', 'error');
      return;
    }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(buildPrintableInvoice(saleData));
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    printWindow.document.close();
  };

  const handleShare = async () => {
    if (!invoiceResult) return;
    setIsSharing(true);
    try {
      const title = `${saleData.storeName || 'My Business'} Invoice ${saleData.invoiceNo}`;
      const text = `Receipt for ${saleData.serviceName} · ${saleData.planName} · ${formatCurrency(saleData.amount, saleData.currency)}`;
      const shared = await shareInvoiceJpg(
        invoiceResult.blob,
        invoiceResult.fileName,
        title,
        text
      );

      if (shared === 'shared') {
        showToast('Invoice shared successfully!', 'success');
      } else if (shared === 'cancelled') {
        showToast('Invoice sharing was cancelled.', 'info');
      } else {
        downloadInvoiceJpg(invoiceResult.blob, invoiceResult.fileName);
        showToast('File sharing is unavailable here. The JPG invoice was downloaded.', 'info');
      }
    } catch (error) {
      console.error('Invoice sharing failed:', error);
      showToast('Unable to share invoice. Please try downloading it instead.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!saleData.customerId || !canContact(saleData.customerId)) {
      showToast('Unable to open WhatsApp. Check the customer phone number and browser pop-up settings.', 'error');
      return;
    }
    openMessage({
      customerId: saleData.customerId,
      saleId: saleData.saleId,
      invoiceId: saleData.invoiceId,
      templateId: 'invoice_ready',
    });
  };

  const handleViewSale = () => {
    if (!saleData.saleId || !onViewSale) return;
    const saleId = saleData.saleId;
    onClose();
    onViewSale(saleId);
  };

  const handleNavigate = (callback: ((id: string) => void) | undefined, id: string | undefined) => {
    if (!callback || !id) return;
    onClose();
    callback(id);
  };

  const handleAddPayment = () => {
    if (!saleData.saleId || !onAddPayment) return;
    const { saleId, customerId } = saleData;
    onClose();
    onAddPayment(saleId, customerId);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invoice Preview"
      subtitle={`Invoice ${saleData.invoiceNo}`}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        <div className="relative max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950/80 sm:p-4">
          {isGenerating ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
              <span className="text-sm font-semibold">Generating invoice...</span>
            </div>
          ) : showJpgPreview && invoiceResult ? (
            <div className="relative flex w-full items-start justify-center">
              <img
                src={invoiceResult.dataUrl}
                alt={`Invoice ${saleData.invoiceNo}`}
                className="h-auto w-full max-w-[760px] rounded-lg border border-slate-200 object-contain shadow-lg"
              />
            </div>
          ) : (
            <article className="invoice-preview mx-auto max-w-[900px] overflow-hidden rounded-2xl border border-white bg-white text-slate-900 shadow-xl">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
              <div className="p-5 sm:p-8">
                <header className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 items-start gap-4">
                    {saleData.invoiceSettings?.showLogo !== false && saleData.invoiceLogoUrl ? (
                      <img src={saleData.invoiceLogoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1.5 sm:h-16 sm:w-16" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-lg font-black text-white sm:h-16 sm:w-16">
                        {(saleData.storeName || 'B').trim().slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-black tracking-tight sm:text-2xl">{saleData.storeName || 'Your Business'}</h2>
                      {saleData.tagline && <p className="mt-1 text-sm text-slate-500">{saleData.tagline}</p>}
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        {saleData.contactPhone && <p>Phone: {saleData.contactPhone}</p>}
                        {saleData.whatsappNumber && <p>WhatsApp: {saleData.whatsappNumber}</p>}
                        {saleData.adminEmail && <p className="break-all">{saleData.adminEmail}</p>}
                        {saleData.businessAddress && <p>{saleData.businessAddress}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Invoice</span>
                      <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        saleData.paymentStatus === 'paid'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : saleData.paymentStatus === 'failed' || saleData.paymentStatus === 'refunded'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}>{getStatusLabel(saleData.paymentStatus)}</span>
                    </div>
                    <p className="mt-3 break-all font-mono text-lg font-bold">{saleData.invoiceNo}</p>
                    <p className="mt-1 text-xs text-slate-500">Issued {formatAppDate(saleData.date)}</p>
                  </div>
                </header>

                <section className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Billed To</p>
                    <h3 className="mt-2 font-bold">{saleData.customerName || 'Customer'}</h3>
                    {saleData.invoiceSettings?.showCustomerPhone !== false && saleData.customerPhone && <p className="mt-1 break-all text-sm text-slate-500">{saleData.customerPhone}</p>}
                    {saleData.invoiceSettings?.showCustomerEmail !== false && saleData.customerEmail && <p className="mt-1 break-all text-sm text-slate-500">{saleData.customerEmail}</p>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Payment</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {saleData.invoiceSettings?.showPaymentMethod !== false && <div><p className="text-xs text-slate-400">Method breakdown</p><p className="mt-1 break-words text-sm font-bold">{saleData.paymentMethodBreakdown?.map(item => `${item.methodName}: ${formatCurrency(item.amount, saleData.currency)}`).join(', ') || saleData.paymentMethod || 'Not specified'}</p></div>}
                      {saleData.paymentDate && <div><p className="text-xs text-slate-400">Paid At</p><p className="mt-1 text-sm font-semibold">{formatAppDate(saleData.paymentDate)}</p></div>}
                      {saleData.invoiceSettings?.showTransactionId !== false && saleData.transactionId && <div className="min-w-0"><p className="text-xs text-slate-400">Transaction ID</p><p className="mt-1 break-all font-mono text-xs font-bold">{saleData.transactionId}</p></div>}
                      {saleData.senderNumber && <div><p className="text-xs text-slate-400">Sender</p><p className="mt-1 break-all text-sm font-semibold">{saleData.senderNumber}</p></div>}
                    </div>
                  </div>
                </section>

                <section className="mt-7">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Service</p>
                  <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <h3 className="font-bold">{saleData.serviceName || 'Service unavailable'}</h3>
                        {saleData.invoiceSettings?.showPlan !== false && <p className="mt-1 text-sm text-slate-500">{saleData.planName}</p>}
                        {saleData.invoiceSettings?.showDescription !== false && saleData.serviceDescription && <p className="mt-2 text-xs text-slate-500">{saleData.serviceDescription}</p>}
                      </div>
                      <p className="whitespace-nowrap font-bold">{formatCurrency(saleData.amount, saleData.currency)}</p>
                    </div>
                    {saleData.invoiceSettings?.showSubscriptionPeriod !== false && (saleData.startDate || saleData.expiryDate || saleData.durationLabel) && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Subscription Period</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{[saleData.startDate && formatAppDate(saleData.startDate), saleData.expiryDate && formatAppDate(saleData.expiryDate)].filter(Boolean).join(' – ') || saleData.durationLabel}</p>
                        {saleData.durationLabel && <p className="mt-1 text-xs text-slate-500">{saleData.durationLabel}</p>}
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-6 flex justify-end">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Payment Summary</p>
                    <div className="mt-3 space-y-2.5">
                      {(saleData.discount || 0) > 0 && <>
                        <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{formatCurrency(saleData.subtotal ?? saleData.amount + (saleData.discount || 0), saleData.currency)}</span></div>
                        <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Discount</span><span className="font-semibold">− {formatCurrency(saleData.discount || 0, saleData.currency)}</span></div>
                      </>}
                      <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-3"><span className="font-bold">Total</span><span className="text-xl font-black tabular-nums">{formatCurrency(saleData.amount, saleData.currency)}</span></div>
                      <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Amount Paid</span><span className="font-bold text-emerald-700">{formatCurrency(saleData.amountPaid ?? (saleData.paymentStatus === 'paid' ? saleData.amount : 0), saleData.currency)}</span></div>
                      <div className={`flex justify-between gap-3 rounded-xl border p-3 ${((saleData.amountDue ?? (saleData.amount - (saleData.amountPaid || 0))) > 0) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                        <span className="font-bold">Balance Due</span>
                        <span className="font-black tabular-nums">{formatCurrency(saleData.amountDue ?? Math.max(0, saleData.amount - (saleData.amountPaid || 0)), saleData.currency)}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {saleData.paymentHistory && saleData.paymentHistory.length > 0 && (
                  <section className="mt-6">
                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Payment History</h3>
                    <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                      {saleData.paymentHistory.map(payment => (
                        <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{formatAppDate(payment.paymentDate)}</span>
                            <span className="ml-2 text-slate-500">{payment.paymentMethod}</span>
                            {saleData.invoiceSettings?.showTransactionId !== false && payment.transactionId && <span className="ml-2 break-all font-mono text-[10px] text-slate-400">{payment.transactionId}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{formatCurrency(payment.amount, payment.currency)}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{payment.paymentStatus}</span>
                            {onViewPayment && <button type="button" onClick={() => handleNavigate(onViewPayment, payment.id)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View</button>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                <footer className="mt-7 border-t border-slate-200 pt-5 text-center">
                  <p className="text-sm font-bold text-slate-800">Thank you for your business.</p>
                  {saleData.tagline && <p className="mt-1 text-xs text-slate-400">{saleData.tagline}</p>}
                  {saleData.invoiceFooter && <p className="mt-1 text-xs text-slate-400">{saleData.invoiceFooter}</p>}
                </footer>
              </div>
            </article>
          )}
        </div>

        <section aria-label="Invoice activity timeline" className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Invoice Activity</h3>
          {invoiceActivities.length ? (
            <ol className="space-y-3">
              {invoiceActivities.map(log => (
                <li key={log.id} className="border-l-2 border-emerald-200 pl-3 dark:border-emerald-900">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{log.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{log.description}</p>
                  <time dateTime={log.timestamp} className="mt-1 block text-[10px] text-slate-400">{formatAppDateTime(log.timestamp)}</time>
                </li>
              ))}
            </ol>
          ) : <p className="text-xs text-slate-500">No invoice activity recorded.</p>}
        </section>

        {/* Action Controls */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
            {invoiceResult && (
              <>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Invoice generated · {(invoiceResult.blob.size / 1024).toFixed(0)} KB
                </span>
                <span className="mt-1 block truncate font-mono text-[11px]">{invoiceResult.fileName}</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="order-4 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:order-none"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={!invoiceResult || isSharing || isGenerating}
              className="order-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:order-none"
            >
              {isSharing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{isSharing ? 'Preparing…' : 'Share'}</span>
            </button>

            {invoiceResult && (
              <button
                type="button"
                onClick={() => setShowJpgPreview(value => !value)}
                className="order-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:order-none"
              >
                <Image className="h-3.5 w-3.5" />
                <span>{showJpgPreview ? 'Invoice Preview' : 'JPG Preview'}</span>
              </button>
            )}

            {saleData.saleId && onViewSale && (
              <button
                type="button"
                onClick={handleViewSale}
                className="order-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:order-none"
              >
                <span>View Sale</span>
              </button>
            )}

            {saleData.customerId && onViewCustomer && (
              <button
                type="button"
                onClick={() => handleNavigate(onViewCustomer, saleData.customerId)}
                className="order-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:order-none"
              >
                View Customer
              </button>
            )}

            {saleData.subscriptionId && onViewSubscription && (
              <button
                type="button"
                onClick={() => handleNavigate(onViewSubscription, saleData.subscriptionId)}
                className="order-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:order-none"
              >
                View Subscription
              </button>
            )}

            {saleData.saleId && onAddPayment && (saleData.amountDue ?? 0) > 0 && (
              <button
                type="button"
                onClick={handleAddPayment}
                className="order-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 sm:order-none"
              >
                Add Payment
              </button>
            )}

            {saleData.customerId && canContact(saleData.customerId) && (
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="order-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 sm:order-none"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Open WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating}
              className="order-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:order-none"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Invoice</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!invoiceResult || isGenerating}
              className="order-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 sm:order-none"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Download JPG</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
