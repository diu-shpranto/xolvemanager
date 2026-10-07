import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Users,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Loader2,
  Trash2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import {
  parseCSV,
  downloadCSV,
  getCustomersSampleCSV,
  getSubscriptionsSampleCSV,
  processCustomerRows,
  processSubscriptionRows,
  ParsedCustomerRecord,
  ParsedSubscriptionRecord,
} from '../../utils/csvParser';
type ImportMode = 'customers' | 'subscriptions';

export const CsvImportUtility: React.FC = () => {
  const {
    customers,
    services,
    addCustomer,
    addSubscription,
    logActivity,
    language,
    t,
  } = useApp();
  const { showToast } = useToast();

  const [mode, setMode] = useState<ImportMode>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Parsing & Processing State
  const [parsedCustomerRecords, setParsedCustomerRecords] = useState<ParsedCustomerRecord[]>([]);
  const [parsedSubRecords, setParsedSubRecords] = useState<ParsedSubscriptionRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isImportingLocally, setIsImportingLocally] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ processed: number; total: number } | null>(null);
  const [uploadCompleteSummary, setUploadCompleteSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle template download
  const handleDownloadTemplate = () => {
    if (mode === 'customers') {
      downloadCSV('customers_template.csv', getCustomersSampleCSV());
      showToast(
        language === 'bn'
          ? 'কাস্টমারদের নমুনা সিএসভি টেমপ্লেট ডাউনলোড হয়েছে।'
          : 'Downloaded Customers sample CSV template.',
        'success'
      );
    } else {
      downloadCSV('subscriptions_template.csv', getSubscriptionsSampleCSV());
      showToast(
        language === 'bn'
          ? 'সাবস্ক্রিপশনের নমুনা সিএসভি টেমপ্লেট ডাউনলোড হয়েছে।'
          : 'Downloaded Subscriptions sample CSV template.',
        'success'
      );
    }
  };

  // Process text into records
  const handleProcessCSVText = (csvContent: string) => {
    setIsProcessing(true);
    setUploadCompleteSummary(null);

    try {
      const { rows } = parseCSV(csvContent);
      if (rows.length === 0) {
        showToast(
          language === 'bn'
            ? 'সিএসভি ফাইলে কোনো ডেটা পাওয়া যায়নি।'
            : 'No data rows found in CSV file.',
          'error'
        );
        setIsProcessing(false);
        return;
      }

      if (mode === 'customers') {
        const processed = processCustomerRows(rows, customers);
        setParsedCustomerRecords(processed);
        showToast(
          language === 'bn'
            ? `${processed.length} টি কাস্টমার রেকর্ড প্রিভিউ প্রস্তুত!`
            : `Parsed ${processed.length} customer records for preview!`,
          'info'
        );
      } else {
        const processed = processSubscriptionRows(rows, customers, services);
        setParsedSubRecords(processed);
        showToast(
          language === 'bn'
            ? `${processed.length} টি সাবস্ক্রিপশন রেকর্ড প্রিভিউ প্রস্তুত!`
            : `Parsed ${processed.length} subscription records for preview!`,
          'info'
        );
      }
    } catch {
      showToast(
        language === 'bn' ? 'সিএসভি পার্স করতে সমস্যা হয়েছে।' : 'Failed to parse CSV.',
        'error'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (uploadedFile: File) => {
    if (!uploadedFile.name.toLowerCase().endsWith('.csv') && uploadedFile.type !== 'text/csv') {
      showToast(
        language === 'bn' ? 'অনুগ্রহ করে একটি .csv ফাইল আপলোড করুন।' : 'Please upload a valid .csv file.',
        'error'
      );
      return;
    }

    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      setRawText(content);
      handleProcessCSVText(content);
    };
    reader.readAsText(uploadedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setFile(null);
    setRawText('');
    setParsedCustomerRecords([]);
    setParsedSubRecords([]);
    setUploadProgress(null);
    setUploadCompleteSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Import validated CSV records into the app's local state.
  const handleBulkImport = async () => {
    setIsImportingLocally(true);

    try {
      if (mode === 'customers') {
        const validRecords = parsedCustomerRecords.filter(r => r.isValid);
        if (validRecords.length === 0) {
          showToast('No valid customer records to import.', 'error');
          setIsImportingLocally(false);
          return;
        }

        const customersToSave = validRecords.map(r => r.customer);

        for (const [index, cust] of customersToSave.entries()) {
          addCustomer({
            name: cust.name,
            phone: cust.phone,
            email: cust.email,
            whatsapp: cust.whatsapp,
            facebookUrl: cust.facebookUrl,
            facebookId: cust.facebookId,
            address: cust.address,
            notes: cust.notes,
          });
          setUploadProgress({ processed: index + 1, total: customersToSave.length });
        }

        logActivity({
          type: 'customer_added',
          title: 'Bulk Customer CSV Import',
          description: `Imported ${customersToSave.length} customers from CSV.`,
        });

        const summary =
          language === 'bn'
            ? `সফলভাবে ${customersToSave.length} জন কাস্টমার যোগ করা হয়েছে!`
            : `Successfully imported ${customersToSave.length} customers!`;

        setUploadCompleteSummary(summary);
        showToast(summary, 'success');
      } else {
        const validRecords = parsedSubRecords.filter(r => r.isValid);
        if (validRecords.length === 0) {
          showToast('No valid subscription records to import.', 'error');
          setIsImportingLocally(false);
          return;
        }

        // Auto-provision new customers if any were detected in subscription CSV
        const newCusts = validRecords
          .filter(r => r.isNewCustomer && r.newCustomerPayload)
          .map(r => r.newCustomerPayload!);

        const importedCustomerIds = new Map<string, string>();
        for (const [index, newC] of newCusts.entries()) {
          const createdCustomer = await addCustomer({
            name: newC.name,
            phone: newC.phone,
            email: newC.email,
            whatsapp: newC.whatsapp,
            notes: newC.notes,
          });
          importedCustomerIds.set(newC.id, createdCustomer.id);
          setUploadProgress({ processed: index + 1, total: newCusts.length + validRecords.length });
        }

        for (const [index, record] of validRecords.entries()) {
          const sub = record.subscription;
          addSubscription({
            customerId: importedCustomerIds.get(sub.customerId) ?? sub.customerId,
            serviceId: sub.serviceId,
            plan: sub.plan,
            startDate: sub.startDate,
            durationDays: sub.durationDays,
            expiryDate: sub.expiryDate,
            price: sub.price,
            currency: sub.currency,
            paymentStatus: sub.paymentStatus,
            notes: sub.notes,
          });
          setUploadProgress({ processed: newCusts.length + index + 1, total: newCusts.length + validRecords.length });
        }

        logActivity({
          type: 'subscription_created',
          title: 'Bulk Subscription CSV Import',
          description: `Imported ${validRecords.length} subscriptions (${newCusts.length} new customer profiles auto-provisioned).`,
        });

        const summary =
          language === 'bn'
            ? `সফলভাবে ${validRecords.length} টি সাবস্ক্রিপশন এবং ${newCusts.length} জন নতুন গ্রাহক যোগ করা হয়েছে!`
            : `Successfully imported ${validRecords.length} subscriptions (${newCusts.length} new customers linked)!`;

        setUploadCompleteSummary(summary);
        showToast(summary, 'success');
      }
    } catch (err: unknown) {
      console.error('CSV import failed:', err);
      showToast(language === 'bn' ? 'ডেটা ইমপোর্ট করা যায়নি।' : 'Could not import the data.', 'error');
    } finally {
      setIsImportingLocally(false);
    }
  };

  const activeRecordsCount =
    mode === 'customers' ? parsedCustomerRecords.length : parsedSubRecords.length;
  const validRecordsCount =
    mode === 'customers'
      ? parsedCustomerRecords.filter(r => r.isValid).length
      : parsedSubRecords.filter(r => r.isValid).length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{language === 'bn' ? 'সিএসভি ফাইল বাল্ক ইমপোর্ট' : 'CSV Bulk Importer'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Batch API Ready
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'bn'
                ? 'এক ক্লিকে একাধিক কাস্টমার ও সাবস্ক্রিপশন রেকর্ড ইমপোর্ট করুন'
                : 'Import customer contacts and subscription orders from a CSV file.'}
            </p>
          </div>
        </div>

        {/* Template Downloader */}
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            {mode === 'customers'
              ? (language === 'bn' ? 'কাস্টমার টেমপ্লেট (.csv)' : 'Customers Template (.csv)')
              : (language === 'bn' ? 'সাবস্ক্রিপশন টেমপ্লেট (.csv)' : 'Subscriptions Template (.csv)')}
          </span>
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => {
            setMode('customers');
            handleClear();
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mode === 'customers'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{language === 'bn' ? 'কাস্টমার তালিকা (Customers)' : 'Customers Roster'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('subscriptions');
            handleClear();
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mode === 'subscriptions'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>{language === 'bn' ? 'সাবস্ক্রিপশন ব্যাচ (Subscriptions)' : 'Subscriptions Batch'}</span>
        </button>
      </div>

      {/* Upload Drag & Drop Box */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
            : file
            ? 'border-emerald-400 dark:border-emerald-600/60 bg-emerald-50/20 dark:bg-emerald-950/10'
            : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={e => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <Upload className="w-6 h-6 stroke-[2]" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {file ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 justify-center">
                  <FileText className="w-4 h-4" />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </span>
              ) : (
                <span>
                  {language === 'bn'
                    ? 'আপনার .CSV ফাইলটি ড্র্যাগ করুন বা ব্রাউজ করতে ক্লিক করুন'
                    : 'Click to upload or drag & drop CSV file'}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'customers'
                ? 'Required: Name, Phone or Email · Optional: WhatsApp, FacebookUrl, Address, Notes'
                : 'Required: CustomerEmail/Phone, ServiceName, Plan, Duration, Price'}
            </p>
          </div>
        </div>
      </div>

      {/* Alternative: Raw CSV Paste Box toggle */}
      <div className="flex items-center justify-between text-xs pt-1">
        <button
          type="button"
          onClick={() => setShowPasteBox(!showPasteBox)}
          className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{showPasteBox ? (language === 'bn' ? 'টেক্সট পেস্ট বক্স বন্ধ করুন' : 'Hide raw paste box') : (language === 'bn' ? 'বা সরাসরি CSV টেক্সট পেস্ট করুন' : 'Or paste raw CSV text directly')}</span>
        </button>

        {activeRecordsCount > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-rose-500 flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'পরিষ্কার করুন' : 'Clear parsed data'}</span>
          </button>
        )}
      </div>

      {showPasteBox && (
        <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {language === 'bn' ? 'এক্সেল বা গুগল শিট থেকে কপি করা CSV টেক্সট:' : 'Paste CSV rows (e.g. from Google Sheets / Excel):'}
          </label>
          <textarea
            rows={4}
            value={rawText}
            onChange={e => {
              setRawText(e.target.value);
              handleProcessCSVText(e.target.value);
            }}
            placeholder={
              mode === 'customers'
                ? 'Name,Phone,Email\nTanvir Hasan,+880 1711-223344,tanvir@example.com'
                : 'CustomerEmail,ServiceName,Plan,DurationDays,Price\ntanvir@example.com,Netflix,1 Month UHD,30,350'
            }
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
          />
        </div>
      )}

      {/* Progress & Summary Banners */}
      {uploadProgress && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Importing records...</span>
            </span>
            <span>
              {uploadProgress.processed} / {uploadProgress.total} records
            </span>
          </div>
          <div className="w-full h-2 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{
                width: `${Math.round((uploadProgress.processed / uploadProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {uploadCompleteSummary && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{uploadCompleteSummary}</span>
        </div>
      )}

      {/* Records Preview Table */}
      {activeRecordsCount > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {language === 'bn' ? 'ডেটা প্রিভিউ ও ভ্যালিডেশন' : 'Data Preview & Validation'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold font-mono">
                {validRecordsCount} / {activeRecordsCount} {language === 'bn' ? 'সঠিক' : 'valid'}
              </span>
            </div>

            <button
              type="button"
              disabled={isImportingLocally || validRecordsCount === 0}
              onClick={handleBulkImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isImportingLocally ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'bn' ? 'ইমপোর্ট হচ্ছে...' : 'Importing...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-100" />
                  <span>
                    {language === 'bn'
                      ? `${validRecordsCount} টি রেকর্ড ইমপোর্ট করুন`
                      : `Import ${validRecordsCount} Records`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="p-3 w-10">#</th>
                  <th className="p-3 w-28">Status</th>
                  {mode === 'customers' ? (
                    <>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">WhatsApp</th>
                      <th className="p-3">Notes</th>
                    </>
                  ) : (
                    <>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Service</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Start Date</th>
                      <th className="p-3">Calculated Expiry</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                {mode === 'customers'
                  ? parsedCustomerRecords.slice(0, 15).map((record, idx) => (
                      <tr
                        key={idx}
                        className={
                          !record.isValid
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : record.warnings.length > 0
                            ? 'bg-amber-50/30 dark:bg-amber-950/10'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                        }
                      >
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3">
                          {record.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{record.isExisting ? 'Update' : 'New'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                              <XCircle className="w-3 h-3" />
                              <span>Invalid</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {record.customer.name}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {record.customer.phone}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {record.customer.email}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {record.customer.whatsapp || '-'}
                        </td>
                        <td className="p-3 text-slate-500 truncate max-w-[150px]">
                          {record.customer.notes || '-'}
                        </td>
                      </tr>
                    ))
                  : parsedSubRecords.slice(0, 15).map((record, idx) => (
                      <tr
                        key={idx}
                        className={
                          !record.isValid
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : record.warnings.length > 0
                            ? 'bg-amber-50/30 dark:bg-amber-950/10'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                        }
                      >
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3">
                          {record.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{record.isNewCustomer ? 'Auto Cust' : 'Linked'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                              <XCircle className="w-3 h-3" />
                              <span>Invalid</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {record.matchedCustomerName}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {record.matchedServiceName}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {record.subscription.plan}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {record.subscription.durationDays}d
                        </td>
                        <td className="p-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {record.subscription.currency === 'BDT' ? '৳' : '$'}
                          {record.subscription.price}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {record.subscription.startDate}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {record.subscription.expiryDate}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {activeRecordsCount > 15 && (
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Showing first 15 of {activeRecordsCount} records. All valid records will be imported.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
