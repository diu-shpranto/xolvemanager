import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { CustomerNameWithType } from '../common/CustomerNameWithType';
import { useToast } from '../common/Toast';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { Download, Share2, CheckCircle2, RefreshCw, MessageCircle, Printer, Image } from 'lucide-react';
import { formatAppDate, formatCurrency } from '../../utils/dateUtils';
import type { Language } from '../../types';
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
    case 'partial': return 'Partial';
    case 'pending': return 'Pending';
    case 'failed': return 'Payment Failed';
    case 'refunded': return 'Refunded';
    default: return 'Due';
  }
};

const getStatusColors = (status: string): { background: string; foreground: string; border: string } => {
  if (status === 'paid') return { background: '#ecfdf5', foreground: '#047857', border: '#a7f3d0' };
  if (status === 'failed' || status === 'refunded') return { background: '#fff1f2', foreground: '#be123c', border: '#fecdd3' };
  if (status === 'partial') return { background: '#f3edff', foreground: '#6d28d9', border: '#ddd6fe' };
  return { background: '#fffbeb', foreground: '#b45309', border: '#fde68a' };
};

const buildPrintableInvoice = (data: InvoiceSaleDetails, language: Language): string => {
  const statusColors = getStatusColors(data.paymentStatus);
  const currency = data.currency;
  const showPlan = data.invoiceSettings?.showPlan !== false;
  const showPaymentMethod = data.invoiceSettings?.showPaymentMethod !== false;
  const subtotal = data.subtotal ?? data.amount;
  const discount = data.discount ?? 0;
  const paid = data.amountPaid ?? (data.paymentStatus === 'paid' ? data.amount : 0);
  const due = data.amountDue ?? Math.max(0, data.amount - paid);
  const itemDiscountTotal = data.lineItems?.reduce((total, item) => total + (item.discount || 0), 0) || 0;
  const invoiceDiscount = Math.max(0, discount - itemDiscountTotal);
  const received = data.amountReceived ?? paid;
  const advanceCredit = data.advanceCreditApplied ?? Math.max(0, paid - received);
  const logo = data.invoiceSettings?.showLogo !== false && data.invoiceLogoUrl
    ? `<img src="${escapeHtml(data.invoiceLogoUrl)}" alt="" class="logo">`
    : '';
  const contactLines = [
    data.contactPhone && `Phone: ${data.contactPhone}`,
    data.whatsappNumber && data.whatsappNumber !== data.contactPhone && `WhatsApp: ${data.whatsappNumber}`,
    data.adminEmail,
    data.businessAddress,
  ].filter(Boolean).map(line => `<span>${escapeHtml(line)}</span>`).join('');
  const customerTypeBadge = data.customerType
    ? `<span class="customer-type">${escapeHtml(data.customerType)}</span>`
    : '';
  const invoiceLineItems = data.lineItems?.length
    ? data.lineItems
    : [{
      serviceName: data.serviceName,
      planName: data.planName,
      quantity: 1,
      unitPrice: data.amount,
      subtotal: data.amount,
      discount: 0,
      total: data.amount,
      currency,
      startDate: data.startDate,
      expiryDate: data.expiryDate,
      durationDays: data.durationDays,
    }];
  const lineItemRows = invoiceLineItems.map(item => {
    const itemPeriod = [item.startDate && formatAppDate(item.startDate, language), item.expiryDate && formatAppDate(item.expiryDate, language)]
      .filter(Boolean)
      .join(' – ');
    const itemDiscount = item.discount || 0;
    const lineTotal = item.total ?? Math.max(0, item.subtotal - itemDiscount);
    const title = `${item.serviceName}${showPlan ? ` · ${item.planName}` : ''}`;
    const duration = item.durationDays ? `${item.durationDays} days` : '—';
    return {
      title,
      duration,
      quantity: item.quantity,
      unitPrice: formatCurrency(item.unitPrice, item.currency, language),
      discount: formatCurrency(itemDiscount, item.currency, language),
      lineTotal: formatCurrency(lineTotal, item.currency, language),
      details: itemPeriod,
    };
  });
  const rows = lineItemRows.map(item => `<tr>
    <td class="item-cell"><strong>${escapeHtml(item.title)}</strong>${item.details ? `<small>${escapeHtml(item.details)}</small>` : ''}</td>
    <td>${escapeHtml(item.duration)}</td><td class="numeric">${escapeHtml(item.quantity)}</td>
    <td class="numeric nowrap">${escapeHtml(item.unitPrice)}</td><td class="numeric nowrap">${escapeHtml(item.discount)}</td>
    <td class="numeric nowrap">${escapeHtml(item.lineTotal)}</td>
  </tr>`).join('');
  const mobileRows = lineItemRows.map(item => `<article class="mobile-item">
    <div class="mobile-item-title"><strong>${escapeHtml(item.title)}</strong><strong class="nowrap">${escapeHtml(item.lineTotal)}</strong></div>
    ${item.details ? `<small>${escapeHtml(item.details)}</small>` : ''}
    <div class="mobile-metrics"><span>Duration <b>${escapeHtml(item.duration)}</b></span><span>Qty <b>${escapeHtml(item.quantity)}</b></span><span>Unit price <b class="nowrap">${escapeHtml(item.unitPrice)}</b></span><span>Discount <b class="nowrap">${escapeHtml(item.discount)}</b></span></div>
  </article>`).join('');
  const paymentDetails = [
    showPaymentMethod && `<div class="payment-detail"><small>Payment method</small><strong>${escapeHtml(data.paymentMethodBreakdown?.map(item => `${item.methodName}: ${formatCurrency(item.amount, data.currency, language)}`).join(', ') || data.paymentMethod || 'Not specified')}</strong></div>`,
    data.paymentDate && `<div class="payment-detail"><small>Latest payment</small><strong>${escapeHtml(formatAppDate(data.paymentDate, language))}</strong></div>`,
    data.invoiceSettings?.showTransactionId !== false && data.transactionId && `<div class="payment-detail"><small>Transaction reference</small><strong class="break">${escapeHtml(data.transactionId)}</strong></div>`,
    data.senderNumber && `<div class="payment-detail"><small>Sender</small><strong>${escapeHtml(data.senderNumber)}</strong></div>`,
  ].filter(Boolean).join('');
  const paymentHistory = data.paymentHistory?.length
    ? `<section class="section"><h2 class="section-title">Payment history</h2><div class="payment-history">${data.paymentHistory.map(payment =>
      `<div class="history-row"><div><strong>${escapeHtml(formatAppDate(payment.paymentDate, language))} · ${escapeHtml(payment.paymentMethod)}</strong>${data.invoiceSettings?.showTransactionId !== false && payment.transactionId ? `<small class="break">${escapeHtml(payment.transactionId)}</small>` : ''}</div><div class="history-amount"><strong>${escapeHtml(formatCurrency(payment.amount, payment.currency, language))}</strong><small>${escapeHtml(payment.paymentStatus)}</small></div></div>`
    ).join('')}</div></section>`
    : '';
  const summaryRows = [
    `<div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(formatCurrency(subtotal, currency, language))}</strong></div>`,
    itemDiscountTotal > 0 ? `<div class="summary-row"><span>Item discounts</span><strong class="discount">− ${escapeHtml(formatCurrency(itemDiscountTotal, currency, language))}</strong></div>` : '',
    invoiceDiscount > 0 ? `<div class="summary-row"><span>Invoice discount</span><strong class="discount">− ${escapeHtml(formatCurrency(invoiceDiscount, currency, language))}</strong></div>` : '',
    `<div class="summary-row grand"><span>Grand total</span><strong>${escapeHtml(formatCurrency(data.amount, currency, language))}</strong></div>`,
    `<div class="summary-row"><span>Amount paid / applied</span><strong class="paid">${escapeHtml(formatCurrency(paid, currency, language))}</strong></div>`,
    received > 0 ? `<div class="summary-row"><span>Cash received</span><strong>${escapeHtml(formatCurrency(received, currency, language))}</strong></div>` : '',
    advanceCredit > 0 ? `<div class="summary-row"><span>Advance credit applied</span><strong>${escapeHtml(formatCurrency(advanceCredit, currency, language))}</strong></div>` : '',
    `<div class="summary-row balance ${due > 0 ? 'due' : 'clear'}"><span>Outstanding due</span><strong>${escapeHtml(formatCurrency(due, currency, language))}</strong></div>`,
  ].filter(Boolean).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${escapeHtml(data.invoiceNo)}</title><style>
    *{box-sizing:border-box}html{background:#fff}body{margin:0;padding:28px;background:#f5f3fa;color:#172033;font:14px/1.5 Arial,"Noto Sans",sans-serif}.page{max-width:960px;margin:0 auto}.card{overflow:hidden;background:#fff;border:1px solid #e8e5ed}.accent{height:5px;background:#6d28d9}.content{padding:38px 44px}.header{display:flex;justify-content:space-between;align-items:flex-start;gap:28px;border-bottom:1px solid #e7e5eb;padding-bottom:26px}.brand{display:flex;min-width:0;align-items:flex-start;gap:15px}.logo{width:58px;height:58px;flex:none;object-fit:contain;border:1px solid #ece9f0;padding:5px}.brand-name{font-size:20px;line-height:1.25;font-weight:700;color:#241f2b;overflow-wrap:anywhere}.muted,.contact{color:#6b6672}.contact{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:10px;font-size:11px}.invoice-meta{min-width:170px;text-align:right}.invoice-title{color:#6d28d9;font-size:25px;font-weight:800;letter-spacing:.09em}.invoice-number{margin-top:5px;font:700 15px ui-monospace,monospace;overflow-wrap:anywhere}.status{display:inline-block;margin-top:10px;border:1px solid ${statusColors.border};border-radius:999px;padding:4px 10px;background:${statusColors.background};color:${statusColors.foreground};font-size:10px;font-weight:700}.meta-row{margin-top:5px;color:#6b6672;font-size:11px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:25px}.box-title,.section-title{color:#6d28d9;font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:800}.name{margin-top:8px;font-size:15px;font-weight:700;overflow-wrap:anywhere}.customer-type{margin-left:7px;border-radius:999px;background:#f2edfb;color:#5b21b6;padding:3px 7px;font-size:10px;white-space:nowrap}.customer-line{margin-top:4px;color:#625d69;font-size:12px;overflow-wrap:anywhere}.section{margin-top:27px}.section-title{margin:0 0 11px}.items-table{width:100%;border-collapse:collapse;table-layout:fixed}.items-table th{padding:9px 7px;background:#f7f5fa;color:#625d69;text-align:left;font-size:9px;letter-spacing:.06em;text-transform:uppercase}.items-table td{padding:12px 7px;border-bottom:1px solid #eeecf1;vertical-align:top;font-size:11px}.items-table th:first-child,.items-table td:first-child{padding-left:10px;width:35%}.items-table th:nth-child(2){width:13%}.items-table th:nth-child(3){width:7%}.items-table th:nth-child(4){width:15%}.items-table th:nth-child(5){width:13%}.items-table th:nth-child(6){width:17%;padding-right:10px}.item-cell strong{display:block;overflow-wrap:anywhere;color:#25212c}.item-cell small{display:block;margin-top:3px;color:#77717e;font-size:10px}.numeric{text-align:right;font-variant-numeric:tabular-nums}.nowrap{white-space:nowrap}.mobile-items{display:none}.summary-wrap{display:flex;justify-content:flex-end;margin-top:22px}.summary{width:100%;max-width:410px}.summary-row{display:flex;justify-content:space-between;gap:14px;padding:7px 1px;color:#625d69;font-size:12px}.summary-row strong{color:#25212c;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.summary-row .discount{color:#6d28d9}.summary-row .paid{color:#087a57}.summary-row.grand{margin-top:5px;border-top:1px solid #d9d4e0;padding-top:13px;color:#24202b;font-weight:700;font-size:14px}.summary-row.grand strong{color:#6d28d9;font-size:20px}.balance{margin-top:9px;border-radius:4px;padding:10px 11px}.balance.due{background:#fff6e5;color:#81500a}.balance.due strong{color:#81500a}.balance.clear{background:#edf7f2;color:#087a57}.balance.clear strong{color:#087a57}.payment-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px;margin-top:12px;padding-top:14px;border-top:1px solid #eeecf1}.payment-detail small,.history-row small{display:block;color:#77717e;font-size:9px}.payment-detail strong{display:block;margin-top:3px;color:#25212c;font-size:11px;overflow-wrap:anywhere}.payment-history{border-top:1px solid #eeecf1}.history-row{display:flex;justify-content:space-between;gap:16px;padding:9px 1px;border-bottom:1px solid #eeecf1;font-size:11px}.history-row strong{overflow-wrap:anywhere}.history-amount{text-align:right;white-space:nowrap}.break{overflow-wrap:anywhere}.footer{margin-top:28px;padding-top:17px;border-top:1px solid #e7e5eb;text-align:center;color:#6b6672;font-size:11px}.footer strong{color:#332e39;font-size:12px}.footer p{margin:4px 0}.footer-note{margin:10px auto 0;max-width:620px;white-space:pre-wrap;overflow-wrap:anywhere}
    @media(max-width:640px){body{padding:0;background:#fff}.card{border:0}.content{padding:22px 17px}.header{gap:16px;flex-direction:column}.invoice-meta{width:100%;text-align:left}.grid{grid-template-columns:1fr;gap:16px;margin-top:20px}.items-table{display:none}.mobile-items{display:block}.mobile-item{padding:12px 2px;border-bottom:1px solid #eeecf1}.mobile-item-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.mobile-item-title strong:first-child{overflow-wrap:anywhere}.mobile-item-title strong:last-child{font-size:11px}.mobile-item>small{display:block;margin-top:4px;color:#77717e;font-size:10px}.mobile-metrics{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;margin-top:9px;color:#77717e;font-size:10px}.mobile-metrics span{display:flex;justify-content:space-between;gap:5px}.mobile-metrics b{color:#332e39;text-align:right}.summary{max-width:none}.payment-details{grid-template-columns:1fr 1fr}}
    @media print{@page{size:A4 portrait;margin:12mm}html,body{background:#fff!important}body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{max-width:none}.card{border:0}.content{padding:0}.accent{height:3px}.items-table{display:table}.mobile-items{display:none}.section{break-inside:auto}.items-table thead{display:table-header-group}.items-table tr{break-inside:avoid;page-break-inside:avoid}.summary-wrap,.summary,.payment-details,.payment-history,.history-row,.footer,.header,.grid{break-inside:avoid}.section-title{break-after:avoid}}
  </style></head><body><main class="page"><article class="card"><div class="accent"></div><div class="content">
    <header class="header"><div class="brand">${logo}<div><div class="brand-name">${escapeHtml(data.storeName || 'Your Business')}</div>${data.tagline ? `<div class="muted" style="margin-top:4px;font-size:11px">${escapeHtml(data.tagline)}</div>` : ''}<div class="contact">${contactLines}</div></div></div><div class="invoice-meta"><div class="invoice-title">INVOICE</div><div class="invoice-number">${escapeHtml(data.invoiceNo)}</div><div class="meta-row">Date · ${escapeHtml(formatAppDate(data.date, language))}</div><span class="status">${escapeHtml(getStatusLabel(data.paymentStatus))}</span></div></header>
    <section class="grid"><div><div class="box-title">Bill To</div><div class="name">${escapeHtml(data.customerName || 'Customer')}${customerTypeBadge}</div>
      ${data.customerId ? `<div class="customer-line">Customer ID · ${escapeHtml(data.customerId)}</div>` : ''}
      ${data.invoiceSettings?.showCustomerPhone !== false && data.customerPhone ? `<div class="customer-line">${escapeHtml(data.customerPhone)}</div>` : ''}
      ${data.invoiceSettings?.showCustomerEmail !== false && data.customerEmail ? `<div class="customer-line">${escapeHtml(data.customerEmail)}</div>` : ''}
    </div><div><div class="box-title">Payment</div><div class="payment-details" style="margin-top:8px;padding-top:0;border:0">${paymentDetails || '<div class="payment-detail"><small>Status</small><strong>Payment not recorded</strong></div>'}</div></div></section>
    <section class="section"><h2 class="section-title">Items and services</h2><table class="items-table"><thead><tr><th>Item / service and plan</th><th>Duration</th><th class="numeric">Qty</th><th class="numeric">Unit price</th><th class="numeric">Discount</th><th class="numeric">Line total</th></tr></thead><tbody>${rows}</tbody></table><div class="mobile-items">${mobileRows}</div></section>
    <section class="summary-wrap"><div class="summary">${summaryRows}</div></section>
    ${paymentHistory}
    <footer class="footer"><strong>Thank you for your business.</strong>${data.tagline ? `<p>${escapeHtml(data.tagline)}</p>` : ''}${data.invoiceFooter ? `<p class="footer-note">${escapeHtml(data.invoiceFooter)}</p>` : ''}${data.notes ? `<p class="footer-note">Note: ${escapeHtml(data.notes)}</p>` : ''}</footer>
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
  const { formatCurrency, formatDate: formatAppDate, formatDateTime: formatAppDateTime, language } = useAppFormatting();
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
        : { key, promise: generateInvoiceJpg(saleData, language) };
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
      showToast(`Download requested · ${invoiceResult.fileName}`, 'info');
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
    printWindow.document.write(buildPrintableInvoice(saleData, language));
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
        showToast('File sharing is unavailable here. A JPG download was requested.', 'info');
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

  const invoiceItems = saleData.lineItems?.length
    ? saleData.lineItems
    : [{
      serviceName: saleData.serviceName || 'Service unavailable',
      planName: saleData.planName || 'Plan information unavailable',
      quantity: 1,
      unitPrice: saleData.subtotal ?? saleData.amount + (saleData.discount || 0),
      subtotal: saleData.subtotal ?? saleData.amount + (saleData.discount || 0),
      discount: 0,
      total: saleData.amount,
      currency: saleData.currency,
      startDate: saleData.startDate,
      expiryDate: saleData.expiryDate,
      durationDays: saleData.durationDays,
    }];
  const itemDiscountTotal = invoiceItems.reduce((total, item) => total + (item.discount || 0), 0);
  const invoiceDiscount = Math.max(0, (saleData.discount || 0) - itemDiscountTotal);
  const amountPaid = saleData.amountPaid ?? (saleData.paymentStatus === 'paid' ? saleData.amount : 0);
  const amountReceived = saleData.amountReceived ?? amountPaid;
  const advanceCreditApplied = saleData.advanceCreditApplied ?? Math.max(0, amountPaid - amountReceived);
  const amountDue = saleData.amountDue ?? Math.max(0, saleData.amount - amountPaid);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invoice Preview"
      subtitle={`Invoice ${saleData.invoiceNo}`}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        <div className="min-w-0 w-full overflow-x-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950/80 sm:p-4">
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
            <article className="invoice-preview mx-auto w-full min-w-0 max-w-[960px] overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-sm">
              <div className="h-1 bg-violet-700" />
              <div className="p-4 sm:p-7">
                <header className="flex min-w-0 flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 items-start gap-4">
                    {saleData.invoiceSettings?.showLogo !== false && saleData.invoiceLogoUrl ? (
                      <img src={saleData.invoiceLogoUrl} alt="" className="h-12 w-12 shrink-0 border border-slate-200 bg-white object-contain p-1 sm:h-14 sm:w-14" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-violet-700 text-lg font-bold text-white sm:h-14 sm:w-14">
                        {(saleData.storeName || 'B').trim().slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{saleData.storeName || 'Your Business'}</h2>
                      {saleData.tagline && <p className="mt-1 break-words text-xs text-slate-500">{saleData.tagline}</p>}
                      <div className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        {saleData.contactPhone && <span>Phone: {saleData.contactPhone}</span>}
                        {saleData.whatsappNumber && saleData.whatsappNumber !== saleData.contactPhone && <span>WhatsApp: {saleData.whatsappNumber}</span>}
                        {saleData.adminEmail && <p className="break-all">{saleData.adminEmail}</p>}
                        {saleData.businessAddress && <span className="break-words">{saleData.businessAddress}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 sm:shrink-0 sm:text-right">
                    <p className="text-xl font-extrabold tracking-[0.12em] text-violet-800">INVOICE</p>
                    <p className="mt-1 break-all font-mono text-sm font-bold text-slate-900">{saleData.invoiceNo}</p>
                    <p className="mt-1 text-xs text-slate-500">Date · {formatAppDate(saleData.date)}</p>
                    <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        saleData.paymentStatus === 'paid'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : saleData.paymentStatus === 'failed' || saleData.paymentStatus === 'refunded'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : saleData.paymentStatus === 'partial'
                              ? 'border-violet-200 bg-violet-50 text-violet-800'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}>{getStatusLabel(saleData.paymentStatus)}</span>
                  </div>
                </header>

                <section className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-violet-800">Bill To</p>
                    <h3 className="mt-2 break-words text-sm font-bold text-slate-900"><CustomerNameWithType name={saleData.customerName || 'Customer'} customer={saleData.customerType ? { name: saleData.customerName, customerType: saleData.customerType } : undefined} /></h3>
                    {saleData.customerId && <p className="mt-1 break-all text-xs text-slate-500">Customer ID · {saleData.customerId}</p>}
                    {saleData.invoiceSettings?.showCustomerPhone !== false && saleData.customerPhone && <p className="mt-1 break-all text-xs text-slate-500">{saleData.customerPhone}</p>}
                    {saleData.invoiceSettings?.showCustomerEmail !== false && saleData.customerEmail && <p className="mt-1 break-all text-xs text-slate-500">{saleData.customerEmail}</p>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-violet-800">Payment details</p>
                    <div className="mt-2 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3">
                      {saleData.invoiceSettings?.showPaymentMethod !== false && <div className="min-w-0"><p className="text-[10px] text-slate-500">Method</p><p className="mt-1 break-words text-xs font-semibold text-slate-800">{saleData.paymentMethodBreakdown?.map(item => `${item.methodName}: ${formatCurrency(item.amount, saleData.currency)}`).join(', ') || saleData.paymentMethod || 'Not specified'}</p></div>}
                      {saleData.paymentDate && <div><p className="text-[10px] text-slate-500">Latest payment</p><p className="mt-1 text-xs font-semibold text-slate-800">{formatAppDate(saleData.paymentDate)}</p></div>}
                      {saleData.invoiceSettings?.showTransactionId !== false && saleData.transactionId && <div className="min-w-0"><p className="text-[10px] text-slate-500">Reference</p><p className="mt-1 break-all font-mono text-xs font-semibold text-slate-800">{saleData.transactionId}</p></div>}
                      {saleData.senderNumber && <div className="min-w-0"><p className="text-[10px] text-slate-500">Sender</p><p className="mt-1 break-all text-xs font-semibold text-slate-800">{saleData.senderNumber}</p></div>}
                    </div>
                  </div>
                </section>

                <section className="mt-6">
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-violet-800">Items and services</h3>
                  <div className="hidden overflow-hidden border-y border-slate-200 md:block">
                    <table className="w-full table-fixed text-left">
                      <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        <tr><th className="w-[31%] px-2 py-2">Item / service and plan</th><th className="w-[13%] px-2 py-2">Duration</th><th className="w-[7%] px-2 py-2 text-right">Qty</th><th className="w-[16%] px-2 py-2 text-right">Unit price</th><th className="w-[14%] px-2 py-2 text-right">Discount</th><th className="w-[19%] px-2 py-2 text-right">Line total</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoiceItems.map((item, index) => (
                          <tr key={`${item.serviceName}-${item.planName}-${index}`} className="align-top text-[11px]">
                            <td className="break-words px-2 py-3"><p className="font-bold text-slate-900">{item.serviceName}</p>{saleData.invoiceSettings?.showPlan !== false && <p className="mt-0.5 break-words text-slate-500">{item.planName}</p>}{saleData.invoiceSettings?.showSubscriptionPeriod !== false && (item.startDate || item.expiryDate) && <p className="mt-1 break-words text-[10px] text-slate-500">{[item.startDate && formatAppDate(item.startDate), item.expiryDate && formatAppDate(item.expiryDate)].filter(Boolean).join(' – ')}</p>}</td>
                            <td className="px-2 py-3 text-slate-600">{item.durationDays ? `${item.durationDays} days` : '—'}</td>
                            <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
                            <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{formatCurrency(item.unitPrice, item.currency)}</td>
                            <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{formatCurrency(item.discount || 0, item.currency)}</td>
                            <td className="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums">{formatCurrency(item.total ?? Math.max(0, item.subtotal - (item.discount || 0)), item.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="divide-y divide-slate-100 border-y border-slate-200 md:hidden">
                    {invoiceItems.map((item, index) => (
                      <article key={`${item.serviceName}-${item.planName}-${index}`} className="min-w-0 py-3">
                        <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words text-xs font-bold text-slate-900">{item.serviceName}</h4>{saleData.invoiceSettings?.showPlan !== false && <p className="mt-0.5 break-words text-[11px] text-slate-500">{item.planName}</p>}</div><span className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums">{formatCurrency(item.total ?? Math.max(0, item.subtotal - (item.discount || 0)), item.currency)}</span></div>
                        {saleData.invoiceSettings?.showSubscriptionPeriod !== false && (item.startDate || item.expiryDate) && <p className="mt-1 break-words text-[10px] text-slate-500">{[item.startDate && formatAppDate(item.startDate), item.expiryDate && formatAppDate(item.expiryDate)].filter(Boolean).join(' – ')}</p>}
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]"><span className="flex justify-between gap-2 text-slate-500">Duration <b className="text-right text-slate-700">{item.durationDays ? `${item.durationDays} days` : '—'}</b></span><span className="flex justify-between gap-2 text-slate-500">Qty <b className="text-right tabular-nums text-slate-700">{item.quantity}</b></span><span className="flex justify-between gap-2 text-slate-500">Unit price <b className="whitespace-nowrap text-right tabular-nums text-slate-700">{formatCurrency(item.unitPrice, item.currency)}</b></span><span className="flex justify-between gap-2 text-slate-500">Discount <b className="whitespace-nowrap text-right tabular-nums text-slate-700">{formatCurrency(item.discount || 0, item.currency)}</b></span></div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="mt-5 flex justify-end">
                  <div className="w-full max-w-sm">
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-violet-800">Financial summary</h3>
                    <div className="space-y-2 border-t border-slate-200 pt-2 text-xs">
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Subtotal</span><span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(saleData.subtotal ?? saleData.amount + (saleData.discount || 0), saleData.currency)}</span></div>
                      {itemDiscountTotal > 0 && <div className="flex justify-between gap-3"><span className="text-slate-500">Item discounts</span><span className="whitespace-nowrap font-semibold tabular-nums">− {formatCurrency(itemDiscountTotal, saleData.currency)}</span></div>}
                      {invoiceDiscount > 0 && <div className="flex justify-between gap-3"><span className="text-slate-500">Invoice discount</span><span className="whitespace-nowrap font-semibold tabular-nums">− {formatCurrency(invoiceDiscount, saleData.currency)}</span></div>}
                      <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-3"><span className="font-bold text-slate-900">Grand total</span><span className="whitespace-nowrap text-xl font-extrabold tabular-nums text-violet-800">{formatCurrency(saleData.amount, saleData.currency)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Amount paid / applied</span><span className="whitespace-nowrap font-bold tabular-nums text-emerald-700">{formatCurrency(amountPaid, saleData.currency)}</span></div>
                      {amountReceived > 0 && <div className="flex justify-between gap-3"><span className="text-slate-500">Cash received</span><span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(amountReceived, saleData.currency)}</span></div>}
                      {advanceCreditApplied > 0 && <div className="flex justify-between gap-3"><span className="text-slate-500">Advance credit applied</span><span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(advanceCreditApplied, saleData.currency)}</span></div>}
                      <div className={`flex justify-between gap-3 border-t px-3 py-2.5 ${amountDue > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                        <span className="font-bold">Outstanding due</span>
                        <span className="whitespace-nowrap font-extrabold tabular-nums">{formatCurrency(amountDue, saleData.currency)}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {saleData.paymentHistory && saleData.paymentHistory.length > 0 && (
                  <section className="mt-6">
                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.13em] text-violet-800">Payment History</h3>
                    <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                      {saleData.paymentHistory.map(payment => (
                        <li key={payment.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{formatAppDate(payment.paymentDate)}</span>
                            <span className="ml-2 text-slate-500">{payment.paymentMethod}</span>
                            {saleData.invoiceSettings?.showTransactionId !== false && payment.transactionId && <span className="ml-2 break-all font-mono text-[10px] text-slate-400">{payment.transactionId}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap font-bold tabular-nums">{formatCurrency(payment.amount, payment.currency)}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{payment.paymentStatus}</span>
                            {onViewPayment && <button type="button" onClick={() => handleNavigate(onViewPayment, payment.id)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View</button>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                <footer className="mt-7 border-t border-slate-200 pt-4 text-center">
                  <p className="text-xs font-bold text-slate-800">Thank you for your business.</p>
                  {saleData.tagline && <p className="mt-1 break-words text-[10px] text-slate-500">{saleData.tagline}</p>}
                  {saleData.invoiceFooter && <p className="mt-1 whitespace-pre-wrap break-words text-[10px] text-slate-500">{saleData.invoiceFooter}</p>}
                  {saleData.notes && <p className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-500">Note: {saleData.notes}</p>}
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
