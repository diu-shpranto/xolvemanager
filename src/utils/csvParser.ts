import { Customer, Subscription, Service, AppCurrency, PaymentStatus } from '../types';
import { calculateExpiryDate, getTodayDateString } from './dateUtils';

/**
 * Robust RFC 4180 compliant CSV parser.
 * Handles quoted fields, escaped quotes (""), newlines within fields, and trims headers.
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleanText = text.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM if present
  if (!cleanText) {
    return { headers: [], rows: [] };
  }

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    lines.push(currentRow);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Header normalization (lowercase, stripped punctuation for safe lookup)
  const rawHeaders = lines[0];
  const headers = rawHeaders.map(h => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty lines
    if (line.length === 0 || (line.length === 1 && !line[0])) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = line[index] !== undefined ? line[index].trim() : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Downloads text as a .csv file in the browser.
 */
export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// Sample CSV Templates
// -------------------------------------------------------------

export function getCustomersSampleCSV(): string {
  return [
    'Name,Phone,Email,WhatsApp,FacebookUrl,Address,Notes',
    'Tanvir Hasan,+880 1711-223344,tanvir.hasan@example.com,+880 1711-223344,facebook.com/tanvir.prime,"House 12, Road 4, Dhanmondi, Dhaka",VIP Customer',
    'Nusrat Jahan,+880 1822-334455,nusrat.jahan@gmail.com,+880 1822-334455,facebook.com/nusrat.prime,"GEC Circle, Chittagong",Frequent streaming buyer',
    'Arif Hossain,+880 1933-445566,arif.design@outlook.com,+880 1933-445566,,,"Software developer / AI tools"',
    'Sadia Rahman,+880 1644-556677,sadia.rahman@yahoo.com,+880 1644-556677,facebook.com/sadia.prime,"Uttara Sector 7, Dhaka",Family plan user',
  ].join('\n');
}

export function getSubscriptionsSampleCSV(): string {
  return [
    'CustomerEmail,CustomerName,CustomerPhone,ServiceName,Plan,StartDate,DurationDays,Price,Currency,PaymentStatus,Notes',
    'tanvir.hasan@example.com,Tanvir Hasan,+880 1711-223344,Netflix,1 Month (1 Screen UHD),2026-09-20,30,350,BDT,paid,Auto-renewal preference',
    'nusrat.jahan@gmail.com,Nusrat Jahan,+880 1822-334455,ChatGPT Plus,1 Month Shared,2026-09-15,30,450,BDT,paid,bKash Payment TrxID: 9J4K2L1',
    'arif.design@outlook.com,Arif Hossain,+880 1933-445566,Canva Pro,1 Year Invite,2026-09-01,365,550,BDT,paid,Edu email invite license',
    'sadia.rahman@yahoo.com,Sadia Rahman,+880 1644-556677,Spotify Premium,3 Months Individual,2026-09-10,90,300,BDT,paid,Family slot',
  ].join('\n');
}

// -------------------------------------------------------------
// Validation & Transformation for Customers
// -------------------------------------------------------------

export interface ParsedCustomerRecord {
  isValid: boolean;
  warnings: string[];
  customer: Customer;
  isExisting: boolean;
}

export function processCustomerRows(
  rows: Record<string, string>[],
  existingCustomers: Customer[]
): ParsedCustomerRecord[] {
  const existingMap = new Map<string, Customer>();
  existingCustomers.forEach(c => {
    if (c.email) existingMap.set(c.email.toLowerCase().trim(), c);
    if (c.phone) existingMap.set(c.phone.replace(/[^0-9]/g, ''), c);
  });

  return rows.map((row, index) => {
    const warnings: string[] = [];

    // Find keys regardless of casing
    const findVal = (keys: string[]): string => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase()
        );
        if (foundKey && row[foundKey]) return row[foundKey].trim();
      }
      return '';
    };

    const name = findVal(['name', 'customername', 'fullname']);
    const phone = findVal(['phone', 'phonenumber', 'mobile', 'contactphone']);
    const email = findVal(['email', 'customeremail', 'emailaddress']);
    const whatsapp = findVal(['whatsapp', 'whatsappnumber', 'wanumber']) || phone;
    const facebookUrl = findVal(['facebookurl', 'facebook', 'fburl', 'fbprofile']);
    const facebookId = findVal(['facebookid', 'fbid', 'fbusername']);
    const address = findVal(['address', 'shippingaddress', 'location']);
    const notes = findVal(['notes', 'note', 'remarks', 'comment']);

    let isValid = true;
    if (!name) {
      isValid = false;
      warnings.push('Customer Name is missing');
    }
    if (!phone && !email) {
      isValid = false;
      warnings.push('Requires at least a Phone or Email');
    }

    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const cleanEmail = email.toLowerCase().trim();

    // Check if customer already exists in database
    const existing = (cleanEmail ? existingMap.get(cleanEmail) : undefined) ||
                     (cleanPhone ? existingMap.get(cleanPhone) : undefined);

    const customerId = existing ? existing.id : `cust-csv-${Date.now()}-${index}`;

    const customer: Customer = {
      id: customerId,
      name: name || 'Unnamed Customer',
      phone: phone || existing?.phone || '+880 1700-000000',
      whatsapp: whatsapp || existing?.whatsapp,
      email: email || existing?.email || `customer_${Date.now()}_${index}@shopique.store`,
      facebookUrl: facebookUrl || existing?.facebookUrl,
      facebookId: facebookId || existing?.facebookId,
      address: address || existing?.address,
      notes: notes || existing?.notes,
      createdAt: existing?.createdAt || getTodayDateString(),
      updatedAt: getTodayDateString(),
    };

    return {
      isValid,
      warnings,
      customer,
      isExisting: !!existing,
    };
  });
}

// -------------------------------------------------------------
// Validation & Transformation for Subscriptions
// -------------------------------------------------------------

export interface ParsedSubscriptionRecord {
  isValid: boolean;
  warnings: string[];
  subscription: Subscription;
  matchedCustomerName: string;
  matchedServiceName: string;
  isNewCustomer: boolean;
  newCustomerPayload?: Customer;
}

export function processSubscriptionRows(
  rows: Record<string, string>[],
  existingCustomers: Customer[],
  existingServices: Service[]
): ParsedSubscriptionRecord[] {
  const customerMap = new Map<string, Customer>();
  existingCustomers.forEach(c => {
    if (c.email) customerMap.set(c.email.toLowerCase().trim(), c);
    if (c.phone) customerMap.set(c.phone.replace(/[^0-9]/g, ''), c);
    if (c.name) customerMap.set(c.name.toLowerCase().trim(), c);
  });

  const serviceMap = new Map<string, Service>();
  existingServices.forEach(s => {
    serviceMap.set(s.name.toLowerCase().trim(), s);
    serviceMap.set(s.id.toLowerCase().trim(), s);
  });

  return rows.map((row, index) => {
    const warnings: string[] = [];

    const findVal = (keys: string[]): string => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase()
        );
        if (foundKey && row[foundKey]) return row[foundKey].trim();
      }
      return '';
    };

    const custEmail = findVal(['customeremail', 'email']);
    const custPhone = findVal(['customerphone', 'phone', 'mobile']);
    const custName = findVal(['customername', 'name', 'customer']);

    const serviceNameInput = findVal(['servicename', 'service', 'product', 'item']);
    const plan = findVal(['plan', 'tier', 'package', 'duration']) || 'Standard Plan';
    const startDateRaw = findVal(['startdate', 'date', 'createddate']);
    const durationDaysRaw = findVal(['durationdays', 'duration', 'days', 'validity']);
    const priceRaw = findVal(['price', 'amount', 'fee', 'charge']);
    const currencyRaw = findVal(['currency', 'cur']);
    const statusRaw = findVal(['paymentstatus', 'status', 'paystatus']);
    const notes = findVal(['notes', 'note', 'remarks']);

    let isValid = true;

    // 1. Resolve Customer
    let matchedCustomer: Customer | undefined;
    if (custEmail) matchedCustomer = customerMap.get(custEmail.toLowerCase().trim());
    if (!matchedCustomer && custPhone) matchedCustomer = customerMap.get(custPhone.replace(/[^0-9]/g, ''));
    if (!matchedCustomer && custName) matchedCustomer = customerMap.get(custName.toLowerCase().trim());

    let isNewCustomer = false;
    let newCustomerPayload: Customer | undefined;

    if (!matchedCustomer) {
      if (custName || custPhone || custEmail) {
        // Auto-provision customer
        isNewCustomer = true;
        const newCustId = `cust-auto-${Date.now()}-${index}`;
        newCustomerPayload = {
          id: newCustId,
          name: custName || (custEmail ? custEmail.split('@')[0] : 'Auto Customer'),
          phone: custPhone || '+880 1700-000000',
          email: custEmail || `${newCustId}@shopique.store`,
          whatsapp: custPhone || '',
          createdAt: getTodayDateString(),
          notes: 'Auto-created via Subscription CSV Bulk Import',
        };
        matchedCustomer = newCustomerPayload;
        warnings.push(`New customer profile will be created (${matchedCustomer.name})`);
      } else {
        isValid = false;
        warnings.push('No customer identifier provided (Email, Phone or Name required)');
      }
    }

    // 2. Resolve Service
    let matchedService = serviceMap.get(serviceNameInput.toLowerCase());
    if (!matchedService) {
      // Fuzzy search services
      const match = existingServices.find(s =>
        s.name.toLowerCase().includes(serviceNameInput.toLowerCase()) ||
        serviceNameInput.toLowerCase().includes(s.name.toLowerCase())
      );
      if (match) {
        matchedService = match;
      } else if (existingServices.length > 0) {
        matchedService = existingServices[0];
        warnings.push(`Service "${serviceNameInput}" not found in catalog; defaulted to ${matchedService.name}`);
      } else {
        isValid = false;
        warnings.push(`Unknown service "${serviceNameInput}"`);
      }
    }

    // Dates & calculations
    const startDate = startDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)
      ? startDateRaw
      : getTodayDateString();

    const durationDays = Number(durationDaysRaw) > 0
      ? Number(durationDaysRaw)
      : matchedService?.defaultDurationDays || 30;

    const expiryDate = calculateExpiryDate(startDate, durationDays);

    const price = !isNaN(Number(priceRaw)) && Number(priceRaw) >= 0
      ? Number(priceRaw)
      : matchedService?.defaultPriceBDT || 350;

    const currency: AppCurrency = currencyRaw.toUpperCase() === 'USD' ? 'USD' : 'BDT';

    let paymentStatus: PaymentStatus = 'paid';
    if (statusRaw) {
      const lower = statusRaw.toLowerCase();
      if (lower === 'pending') paymentStatus = 'pending';
      else if (lower === 'partial') paymentStatus = 'partial';
      else if (lower === 'refunded') paymentStatus = 'refunded';
    }

    const subscription: Subscription = {
      id: `sub-csv-${Date.now()}-${index}`,
      customerId: matchedCustomer ? matchedCustomer.id : '',
      serviceId: matchedService ? matchedService.id : '',
      plan: plan || `${matchedService?.name || 'Service'} Plan`,
      startDate,
      durationDays,
      expiryDate,
      price,
      currency,
      paymentStatus,
      notes: notes || 'Imported via CSV',
      createdAt: getTodayDateString(),
      updatedAt: getTodayDateString(),
    };

    return {
      isValid,
      warnings,
      subscription,
      matchedCustomerName: matchedCustomer?.name || 'Unknown',
      matchedServiceName: matchedService?.name || 'Default Service',
      isNewCustomer,
      newCustomerPayload,
    };
  });
}
