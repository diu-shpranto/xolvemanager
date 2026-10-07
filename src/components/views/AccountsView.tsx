import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit2,
  Trash2,
  Users,
  Search,
  Lock,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  UserX,
  UserPlus,
  Tv,
  Sparkles,
  Palette,
  Music,
  Briefcase,
  Laptop,
  Key,
  Layers,
  X,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers2,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { Account, AccountProfile, AccountStatus, ServiceCategory } from '../../types';
import { formatAppDate, getDaysDifference } from '../../utils/dateUtils';
import { createRecordId } from '../../services/localStorageStore';
import { normalizeSearchText } from '../../services/globalSearch';
import { getAccountCapacity, isAccountOperational, RESOURCE_CAPACITY_THRESHOLDS } from '../../utils/resourceManagement';

function getCategoryIcon(category?: ServiceCategory) {
  switch (category) {
    case 'Streaming':
      return Tv;
    case 'AI Tools':
      return Sparkles;
    case 'Design':
      return Palette;
    case 'Music':
      return Music;
    case 'Productivity':
      return Briefcase;
    case 'VPN':
      return Shield;
    case 'Software':
      return Laptop;
    case 'License':
      return Key;
    default:
      return Layers;
  }

}

function isAccountActive(account: Account): boolean {
  return isAccountOperational(account);
}

interface AccountsViewProps {
  selectedAccountId?: string;
  serviceFilterId?: string;
  createRequest?: number;
  onCreateRequestHandled?: () => void;
}

interface ServiceAccent {
  leftBorder: string;
  bgTint: string;
  border: string;
  iconBg: string;
  badge: string;
  barFill: string;
}

function getServiceAccent(name?: string, category?: ServiceCategory, customColor?: string): ServiceAccent {
  const n = (name || '').toLowerCase();

  // 1. Netflix (#E50914 Crimson / Red)
  if (n.includes('netflix')) {
    return {
      leftBorder: 'border-l-[#E50914]',
      bgTint: 'bg-gradient-to-r from-rose-500/[0.04] via-white to-white dark:from-rose-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-rose-200/70 dark:border-rose-900/40',
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 text-[#E50914] dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs',
      badge: 'bg-rose-50 text-[#E50914] dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
      barFill: 'bg-[#E50914] dark:bg-rose-500',
    };
  }

  // 2. Amazon Prime Video (#00A8E1 / #1677FF Sky / Blue)
  if (n.includes('prime') || n.includes('amazon')) {
    return {
      leftBorder: 'border-l-[#00A8E1]',
      bgTint: 'bg-gradient-to-r from-sky-500/[0.04] via-white to-white dark:from-sky-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-sky-200/70 dark:border-sky-900/40',
      iconBg: 'bg-sky-50 dark:bg-sky-950/60 text-[#00A8E1] dark:text-sky-400 border border-sky-200/80 dark:border-sky-800/60 shadow-2xs',
      badge: 'bg-sky-50 text-[#007EA7] dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60',
      barFill: 'bg-[#00A8E1] dark:bg-sky-500',
    };
  }

  // 3. Canva (#7C3AED Purple / Indigo)
  if (n.includes('canva')) {
    return {
      leftBorder: 'border-l-[#7C3AED]',
      bgTint: 'bg-gradient-to-r from-purple-500/[0.04] via-white to-white dark:from-purple-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-purple-200/70 dark:border-purple-900/40',
      iconBg: 'bg-purple-50 dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/60 shadow-2xs',
      badge: 'bg-purple-50 text-[#7C3AED] dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60',
      barFill: 'bg-[#7C3AED] dark:bg-purple-500',
    };
  }

  // 4. ChatGPT / OpenAI (#D97706 Amber / Orange)
  if (n.includes('chatgpt') || n.includes('openai') || n.includes('gpt')) {
    return {
      leftBorder: 'border-l-[#D97706]',
      bgTint: 'bg-gradient-to-r from-amber-500/[0.04] via-white to-white dark:from-amber-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-amber-200/70 dark:border-amber-900/40',
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-[#D97706] dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs',
      badge: 'bg-amber-50 text-[#B45309] dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
      barFill: 'bg-[#D97706] dark:bg-amber-500',
    };
  }

  // 5. Spotify (#10B981 / #1DB954 Emerald / Green)
  if (n.includes('spotify')) {
    return {
      leftBorder: 'border-l-[#10B981]',
      bgTint: 'bg-gradient-to-r from-emerald-500/[0.04] via-white to-white dark:from-emerald-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-emerald-200/70 dark:border-emerald-900/40',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-[#10B981] dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs',
      badge: 'bg-emerald-50 text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
      barFill: 'bg-[#10B981] dark:bg-emerald-500',
    };
  }

  // 6. YouTube (#EF4444 Red)
  if (n.includes('youtube')) {
    return {
      leftBorder: 'border-l-[#EF4444]',
      bgTint: 'bg-gradient-to-r from-red-500/[0.04] via-white to-white dark:from-red-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-red-200/70 dark:border-red-900/40',
      iconBg: 'bg-red-50 dark:bg-red-950/60 text-[#EF4444] dark:text-red-400 border border-red-200/80 dark:border-red-800/60 shadow-2xs',
      badge: 'bg-red-50 text-[#B91C1C] dark:bg-red-950/60 dark:text-red-300 border-red-200/80 dark:border-red-800/60',
      barFill: 'bg-[#EF4444] dark:bg-red-500',
    };
  }

  // 7. Hoichoi (#E11D48 Crimson)
  if (n.includes('hoichoi')) {
    return {
      leftBorder: 'border-l-[#E11D48]',
      bgTint: 'bg-gradient-to-r from-rose-500/[0.04] via-white to-white dark:from-rose-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-rose-200/70 dark:border-rose-900/40',
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 text-[#E11D48] dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs',
      badge: 'bg-rose-50 text-[#BE123C] dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
      barFill: 'bg-[#E11D48] dark:bg-rose-500',
    };
  }

  // 8. Chorki (#F59E0B Amber / Gold)
  if (n.includes('chorki')) {
    return {
      leftBorder: 'border-l-[#F59E0B]',
      bgTint: 'bg-gradient-to-r from-amber-500/[0.04] via-white to-white dark:from-amber-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-amber-200/70 dark:border-amber-900/40',
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-[#F59E0B] dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs',
      badge: 'bg-amber-50 text-[#B45309] dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
      barFill: 'bg-[#F59E0B] dark:bg-amber-500',
    };
  }

  // 9. NordVPN (#2563EB Blue)
  if (n.includes('vpn') || n.includes('nord')) {
    return {
      leftBorder: 'border-l-[#2563EB]',
      bgTint: 'bg-gradient-to-r from-blue-500/[0.04] via-white to-white dark:from-blue-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-blue-200/70 dark:border-blue-900/40',
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs',
      badge: 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
      barFill: 'bg-[#2563EB] dark:bg-blue-500',
    };
  }

  // 10. Microsoft / Office 365 (#0284C7 Sky)
  if (n.includes('microsoft') || n.includes('office') || n.includes('365')) {
    return {
      leftBorder: 'border-l-[#0284C7]',
      bgTint: 'bg-gradient-to-r from-sky-500/[0.04] via-white to-white dark:from-sky-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
      border: 'border-sky-200/70 dark:border-sky-900/40',
      iconBg: 'bg-sky-50 dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-400 border border-sky-200/80 dark:border-sky-800/60 shadow-2xs',
      badge: 'bg-sky-50 text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60',
      barFill: 'bg-[#0284C7] dark:bg-sky-500',
    };
  }

  // 11. Category Fallbacks for other services
  switch (category) {
    case 'Streaming':
      return {
        leftBorder: 'border-l-rose-500',
        bgTint: 'bg-gradient-to-r from-rose-500/[0.04] via-white to-white dark:from-rose-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-rose-200/70 dark:border-rose-900/40',
        iconBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs',
        badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
        barFill: 'bg-rose-500',
      };
    case 'AI Tools':
      return {
        leftBorder: 'border-l-teal-500',
        bgTint: 'bg-gradient-to-r from-teal-500/[0.04] via-white to-white dark:from-teal-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-teal-200/70 dark:border-teal-900/40',
        iconBg: 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/80 dark:border-teal-800/60 shadow-2xs',
        badge: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/60',
        barFill: 'bg-teal-500',
      };
    case 'Design':
      return {
        leftBorder: 'border-l-purple-500',
        bgTint: 'bg-gradient-to-r from-purple-500/[0.04] via-white to-white dark:from-purple-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-purple-200/70 dark:border-purple-900/40',
        iconBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/60 shadow-2xs',
        badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60',
        barFill: 'bg-purple-500',
      };
    case 'Music':
      return {
        leftBorder: 'border-l-emerald-500',
        bgTint: 'bg-gradient-to-r from-emerald-500/[0.04] via-white to-white dark:from-emerald-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-emerald-200/70 dark:border-emerald-900/40',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs',
        badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
        barFill: 'bg-emerald-500',
      };
    case 'Productivity':
      return {
        leftBorder: 'border-l-blue-500',
        bgTint: 'bg-gradient-to-r from-blue-500/[0.04] via-white to-white dark:from-blue-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-blue-200/70 dark:border-blue-900/40',
        iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs',
        badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
        barFill: 'bg-blue-500',
      };
    case 'VPN':
      return {
        leftBorder: 'border-l-indigo-500',
        bgTint: 'bg-gradient-to-r from-indigo-500/[0.04] via-white to-white dark:from-indigo-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-indigo-200/70 dark:border-indigo-900/40',
        iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs',
        badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60',
        barFill: 'bg-indigo-500',
      };
    default:
      return {
        leftBorder: 'border-l-slate-400 dark:border-l-slate-600',
        bgTint: 'bg-white dark:bg-[#151C28]',
        border: 'border-slate-200/80 dark:border-slate-800',
        iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/80 dark:border-slate-700',
        barFill: 'bg-slate-500 dark:bg-slate-400',
      };
  }
}

function getCategoryBadgeStyle(category?: ServiceCategory) {
  switch (category) {
    case 'Streaming':
      return {
        text: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        border: 'border-rose-200/60 dark:border-rose-800/40',
      };
    case 'AI Tools':
      return {
        text: 'text-teal-700 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/40',
        border: 'border-teal-200/60 dark:border-teal-800/40',
      };
    case 'Design':
      return {
        text: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        border: 'border-purple-200/60 dark:border-purple-800/40',
      };
    case 'Music':
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200/60 dark:border-emerald-800/40',
      };
    case 'Productivity':
      return {
        text: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-200/60 dark:border-blue-800/40',
      };
    case 'VPN':
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200/60 dark:border-amber-800/40',
      };
    default:
      return {
        text: 'text-slate-700 dark:text-slate-300',
        bg: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-slate-200/60 dark:border-slate-700/60',
      };
  }
}

export const AccountsView: React.FC<AccountsViewProps> = ({ selectedAccountId, serviceFilterId, createRequest, onCreateRequestHandled }) => {
  const {
    accounts,
    services,
    customers,
    subscriptions,
    sales,
    addAccount,
    updateAccount,
    deleteAccount,
    addProfileToAccount,
    assignCustomerToProfile,
    t,
    language,
  } = useApp();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCapacity, setSelectedCapacity] = useState<string>('all');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('all');

  useEffect(() => {
    if (serviceFilterId) setSelectedServiceId(serviceFilterId);
  }, [serviceFilterId]);

  // Expanded profiles accordion state
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedAccountId) return;
    setExpandedAccountIds(previous => ({ ...previous, [selectedAccountId]: true }));
    window.requestAnimationFrame(() => document.getElementById(`account-${selectedAccountId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [selectedAccountId]);
  useEffect(() => {
    if (!createRequest) return;
    openAddModal();
    onCreateRequestHandled?.();
  }, [createRequest, onCreateRequestHandled]);


  // Modal states
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);

  // Profile modal
  const [profileModalAccount, setProfileModalAccount] = useState<Account | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePin, setNewProfilePin] = useState('');
  const [newProfileStartDate, setNewProfileStartDate] = useState('');
  const [newProfileExpiryDate, setNewProfileExpiryDate] = useState('');
  const [newProfileNotes, setNewProfileNotes] = useState('');

  // Assign customer modal
  const [assigningSlot, setAssigningSlot] = useState<{
    accountId: string;
    profileId: string;
    profileName: string;
    accountEmail: string;
    serviceName: string;
  } | null>(null);
  const [selectedCustomerIdForSlot, setSelectedCustomerIdForSlot] = useState<string>('');
  const [selectedSubscriptionIdForSlot, setSelectedSubscriptionIdForSlot] = useState<string>('');

  // Account form states
  const [accServiceId, setAccServiceId] = useState(services[0]?.id || '');
  const [accName, setAccName] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [accUsername, setAccUsername] = useState('');
  const [accPassword, setAccPassword] = useState('');
  const [accPlan, setAccPlan] = useState('');
  const [accPlanId, setAccPlanId] = useState('');
  const [accStatus, setAccStatus] = useState<AccountStatus>('Available');
  const [accMaxProfiles, setAccMaxProfiles] = useState(1);
  const [accPurchaseDate, setAccPurchaseDate] = useState('');
  const [accExpiryDate, setAccExpiryDate] = useState('');
  const [accNotes, setAccNotes] = useState('');
  const [allowProfileSharing, setAllowProfileSharing] = useState(false);
  const [requireCustomerAssignment, setRequireCustomerAssignment] = useState(true);
  const [allowNewAssignment, setAllowNewAssignment] = useState(true);

  const toggleExpand = (accId: string) => {
    setExpandedAccountIds(prev => ({ ...prev, [accId]: !prev[accId] }));
  };

  const openAddModal = () => {
    const preselectedService = services.find(service => service.id === serviceFilterId && service.status === 'active' && !service.isArchived);
    setAccServiceId(preselectedService?.id || services.find(service => service.status === 'active' && !service.isArchived)?.id || '');
    setAccName('');
    setAccEmail('');
    setAccUsername('');
    setAccPassword('');
    setAccPlan('');
    setAccPlanId('');
    setAccStatus('Available');
    setAccMaxProfiles(1);
    setAccPurchaseDate('');
    setAccExpiryDate('');
    setAccNotes('');
    setAllowProfileSharing(false);
    setRequireCustomerAssignment(true);
    setAllowNewAssignment(true);
    setShowPasswordInModal(false);
    setIsAddAccountModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setAccServiceId(acc.serviceId);
    setAccName(acc.name || '');
    setAccEmail(acc.email);
    setAccUsername(acc.username || '');
    setAccPassword('');
    setAccPlan(acc.plan || '');
    setAccPlanId(acc.planId || '');
    setAccStatus(isAccountActive(acc) ? 'Available' : acc.status);
    setAccMaxProfiles(acc.maxProfiles);
    setAccPurchaseDate(acc.purchaseDate || '');
    setAccExpiryDate(acc.expiryDate || '');
    setAccNotes(acc.notes || '');
    setAllowProfileSharing(acc.allowProfileSharing ?? false);
    setRequireCustomerAssignment(acc.requireCustomerAssignment ?? true);
    setAllowNewAssignment(acc.allowNewAssignment ?? true);
    setShowPasswordInModal(false);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accServiceId || !accEmail.trim()) {
      showToast(
        language === 'bn'
        ? 'সার্ভিস এবং ইমেইল লিখুন।'
        : 'Select a service and enter an email address.',
        'error'
      );
      return;
    }
    if (!Number.isInteger(accMaxProfiles) || accMaxProfiles < 1 || accMaxProfiles > 100) {
      showToast('Enter a profile count between 1 and 100.', 'error');
      return;
    }
    if ([accPurchaseDate, accExpiryDate].some(date => date && !Number.isFinite(Date.parse(`${date}T00:00:00`)))) {
      showToast('Enter valid account dates.', 'error');
      return;
    }
    if (editingAccount && accMaxProfiles < editingAccount.profiles.length) {
      showToast('Profile count cannot be lower than the profiles already on this account.', 'error');
      return;
    }
    const selectedService = services.find(service => service.id === accServiceId);
    if (!selectedService || (!editingAccount && (selectedService.status !== 'active' || selectedService.isArchived))) {
      showToast('Choose an active service.', 'error');
      return;
    }

    if (editingAccount) {
      const profiles = [...editingAccount.profiles];
      while (profiles.length < accMaxProfiles) {
        profiles.push({
          id: createRecordId('profile'),
          accountId: editingAccount.id,
          profileName: `Profile ${profiles.length + 1}`,
          status: 'Available',
        });
      }
      updateAccount(editingAccount.id, {
        serviceId: accServiceId,
        name: accName.trim() || undefined,
        email: accEmail.trim(),
        username: accUsername.trim() || undefined,
        password: accPassword.trim() || editingAccount.password,
        plan: accPlan.trim(),
        planId: accPlanId || undefined,
        status: accStatus,
        allowProfileSharing,
        requireCustomerAssignment,
        allowNewAssignment,
        maxProfiles: Number(accMaxProfiles),
        profiles,
        purchaseDate: accPurchaseDate || undefined,
        expiryDate: accExpiryDate || undefined,
        notes: accNotes.trim(),
      });
      showToast(
        language === 'bn' ? 'অ্যাকাউন্ট সফলভাবে আপডেট হয়েছে।' : 'Account updated successfully.',
        'success'
      );
      setEditingAccount(null);
    } else {
      // Create the number of profile slots selected for this account.
      const generatedProfiles: AccountProfile[] = [];
      if (accMaxProfiles > 0) {
        for (let i = 1; i <= accMaxProfiles; i++) {
          generatedProfiles.push({
            id: `prof-${Date.now()}-${i}`,
            accountId: '',
            profileName: `Profile ${i}`,
            status: 'Available',
          });
        }
      }

      addAccount({
        serviceId: accServiceId,
        name: accName.trim() || undefined,
        email: accEmail.trim(),
        username: accUsername.trim() || undefined,
        password: accPassword.trim(),
        plan: accPlan.trim(),
        planId: accPlanId || undefined,
        status: accStatus,
        allowProfileSharing,
        requireCustomerAssignment,
        allowNewAssignment,
        maxProfiles: Number(accMaxProfiles),
        purchaseDate: accPurchaseDate || undefined,
        expiryDate: accExpiryDate || undefined,
        notes: accNotes.trim(),
        profiles: generatedProfiles,
      });

      showToast(t('accountSavedSuccess'), 'success');
      setIsAddAccountModalOpen(false);
    }
  };

  const handleDelete = (account: Account) => {
    const isInUse = account.profiles.length > 0
      || subscriptions.some(subscription => subscription.accountId === account.id)
      || sales.some(sale => subscriptions.some(subscription =>
        subscription.id === sale.subscriptionId && subscription.accountId === account.id
      ));
    if (isInUse) {
      showToast('This account is already in use, so it cannot be deleted. You can deactivate it instead.', 'info');
      return;
    }
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      deleteAccount(account.id);
      showToast(`Account ${account.email} deleted.`, 'info');
    } catch (error) {
      console.error('Could not delete account.', error);
      showToast(error instanceof Error ? error.message : 'Could not delete this account.', 'error');
    }
  };

  const handleAddProfileSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileModalAccount || !newProfileName.trim()) return;

    try {
      addProfileToAccount(
        profileModalAccount.id,
        newProfileName.trim(),
        newProfilePin.trim() || undefined,
        {
          startDate: newProfileStartDate || undefined,
          expiryDate: newProfileExpiryDate || undefined,
          notes: newProfileNotes.trim() || undefined,
        }
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add profile.', 'error');
      return;
    }
    showToast(
      language === 'bn'
        ? `প্রোফাইল স্লট যোগ করা হয়েছে: ${newProfileName}`
        : `Added profile: ${newProfileName}`,
      'success'
    );
    setNewProfileName('');
    setNewProfilePin('');
    setNewProfileStartDate('');
    setNewProfileExpiryDate('');
    setNewProfileNotes('');
    setProfileModalAccount(null);
  };

  const handleAssignCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningSlot || !selectedCustomerIdForSlot || !selectedSubscriptionIdForSlot) return;

    try {
      assignCustomerToProfile(assigningSlot.accountId, assigningSlot.profileId, selectedCustomerIdForSlot, undefined, selectedSubscriptionIdForSlot);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not assign customer.', 'error');
      return;
    }
    const assignedCust = customers.find(c => c.id === selectedCustomerIdForSlot);
    showToast(
      language === 'bn'
        ? `${assignedCust?.name || 'গ্রাহক'} কে ${assigningSlot.profileName} এ বরাদ্দ করা হয়েছে`
        : `Assigned ${assignedCust?.name || 'Customer'} to ${assigningSlot.profileName}`,
      'success'
    );
    setAssigningSlot(null);
    setSelectedCustomerIdForSlot('');
    setSelectedSubscriptionIdForSlot('');
  };

  // Filtered accounts list
  const filteredAccounts = accounts.filter(acc => {
    const q = normalizeSearchText(searchQuery);
    const srv = services.find(s => s.id === acc.serviceId);
    const plan = srv?.planDetails?.find(item => item.id === acc.planId || item.name === acc.plan);
    const matchesSearch =
      q === '' ||
      [acc.id, acc.email, acc.username ?? '', acc.name ?? '', acc.plan, srv?.name ?? '']
        .some(value => normalizeSearchText(value).includes(q));

    const matchesService = selectedServiceId === 'all' || acc.serviceId === selectedServiceId;
    const matchesPlan = selectedPlanId === 'all'
      || acc.planId === selectedPlanId
      || (!acc.planId && plan?.id === selectedPlanId);
    const matchesStatus = selectedStatus === 'all'
      || (selectedStatus === 'active' && isAccountActive(acc))
      || (selectedStatus === 'inactive' && acc.status === 'Inactive')
      || (selectedStatus === 'suspended' && acc.status === 'Suspended')
      || (selectedStatus === 'expired' && (acc.status === 'Expired' || Boolean(acc.expiryDate && getDaysDifference(acc.expiryDate) < 0)));
    const capacity = getAccountCapacity(acc);
    const matchesCapacity = selectedCapacity === 'all'
      || (selectedCapacity === 'available' && capacity.available > 0 && capacity.utilization < RESOURCE_CAPACITY_THRESHOLDS.almostFull)
      || (selectedCapacity === 'almost-full' && capacity.status === 'Almost Full')
      || (selectedCapacity === 'full' && capacity.status === 'Full');
    const expiryDays = acc.expiryDate ? getDaysDifference(acc.expiryDate) : null;
    const matchesExpiry = selectedExpiry === 'all'
      || (selectedExpiry === 'active' && (expiryDays === null || expiryDays >= RESOURCE_CAPACITY_THRESHOLDS.expiringSoonDays))
      || (selectedExpiry === 'expiring' && expiryDays !== null && expiryDays >= 0 && expiryDays < RESOURCE_CAPACITY_THRESHOLDS.expiringSoonDays)
      || (selectedExpiry === 'expired' && expiryDays !== null && expiryDays < 0);

    return matchesSearch && matchesService && matchesPlan && matchesStatus && matchesCapacity && matchesExpiry;
  });

  // Calculate subtle inventory overview metrics
  const totalAccountsCount = accounts.length;
  const activeAccountCount = accounts.filter(isAccountActive).length;
  const totalAssignedSlots = accounts.reduce((sum, account) => sum + getAccountCapacity(account).used, 0);
  const totalAvailableSlots = accounts.reduce((sum, account) => {
    if (!isAccountActive(account)) return sum;
    return sum + getAccountCapacity(account).availableProfiles;
  }, 0);
  const fullAccountsCount = accounts.filter(account => getAccountCapacity(account).status === 'Full').length;
  const accountsWithCapacityCount = accounts.filter(account =>
    isAccountActive(account) && getAccountCapacity(account).available > 0
  ).length;
  const totalProfileCapacity = accounts.reduce((total, account) => total + getAccountCapacity(account).capacity, 0);
  const activeCustomers = customers.filter(customer => !customer.isArchived && customer.status !== 'archived');

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-2xs">
              <KeyRound className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span>{language === 'bn' ? 'অ্যাকাউন্ট ইনভেন্টরি' : 'Accounts'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'আপনার সার্ভিস অ্যাকাউন্ট ও প্রোফাইল পরিচালনা করুন।'
              : 'Manage service accounts, capacity and customer assignments.'}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer self-start sm:self-auto shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t('addAccount')}</span>
        </button>
      </div>

      {/* 2. SUBTLE INVENTORY STATS STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Accounts */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'মোট অ্যাকাউন্ট' : 'Total Accounts'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalAccountsCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'অ্যাকাউন্ট' : 'accounts'}
            </span>
          </div>
        </div>

        {/* Total Profiles */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'সক্রিয় অ্যাকাউন্ট' : 'Active Accounts'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {activeAccountCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'সক্রিয়' : 'ready to use'}
            </span>
          </div>
        </div>

        {/* Assigned Profiles */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'ব্যবহৃত প্রোফাইল' : 'Used Profiles'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {totalAssignedSlots}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'বরাদ্দকৃত' : 'assigned'}
            </span>
          </div>
        </div>

        {/* Available Profiles */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'উপলব্ধ প্রোফাইল' : 'Available Profiles'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {totalAvailableSlots}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {language === 'bn' ? 'বিক্রয়ের জন্য প্রস্তুত' : 'ready to assign'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Available Accounts', accountsWithCapacityCount],
          ['Full Accounts', fullAccountsCount],
          ['Total Profiles', totalProfileCapacity],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs dark:border-slate-800 dark:bg-[#151C28]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* 3. SEARCH + FILTER TOOLBAR */}
      <div className="bg-white dark:bg-[#151C28] p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={
                language === 'bn'
                  ? 'অ্যাকাউন্ট ইমেইল, সার্ভিস, প্ল্যান খুঁজুন...'
                  : 'Search accounts...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-9 bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Unified Filters toolbar */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Service Filter */}
            <div className="relative min-w-[150px] flex-1 sm:flex-initial">
              <select
                value={selectedServiceId}
                onChange={e => setSelectedServiceId(e.target.value)}
                className="w-full h-10 pl-3 pr-8 bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 cursor-pointer appearance-none"
              >
                <option value="all">{language === 'bn' ? 'সকল সার্ভিস' : 'All Services'}</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative min-w-[150px] flex-1 sm:flex-initial">
              <select aria-label="Filter by plan" value={selectedPlanId} onChange={event => setSelectedPlanId(event.target.value)} className="w-full h-10 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 pr-8 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                <option value="all">All Plans</option>
                {services.filter(service => selectedServiceId === 'all' || service.id === selectedServiceId)
                  .flatMap(service => (service.planDetails || []).map(plan => (
                    <option key={`${service.id}:${plan.id}`} value={plan.id}>{service.name} · {plan.name}</option>
                  )))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative min-w-[140px] flex-1 sm:flex-initial">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full h-10 pl-3 pr-8 bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 cursor-pointer appearance-none"
              >
                <option value="all">{language === 'bn' ? 'সকল অ্যাকাউন্ট' : 'All Accounts'}</option>
                <option value="active">{language === 'bn' ? 'সক্রিয়' : 'Active'}</option>
                <option value="inactive">{language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive'}</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative min-w-[140px] flex-1 sm:flex-initial">
              <select aria-label="Filter by capacity" value={selectedCapacity} onChange={event => setSelectedCapacity(event.target.value)} className="w-full h-10 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                <option value="all">All Capacity</option><option value="available">Available</option><option value="almost-full">Almost Full</option><option value="full">Full</option>
              </select>
            </div>
            <div className="relative min-w-[140px] flex-1 sm:flex-initial">
              <select aria-label="Filter by expiry" value={selectedExpiry} onChange={event => setSelectedExpiry(event.target.value)} className="w-full h-10 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                <option value="all">All Expiry</option><option value="active">Active</option><option value="expiring">Expiring Soon</option><option value="expired">Expired</option>
              </select>
            </div>

            {/* Reset filters shortcut if filtered */}
            {(searchQuery || selectedServiceId !== 'all' || selectedPlanId !== 'all' || selectedStatus !== 'all' || selectedCapacity !== 'all' || selectedExpiry !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedServiceId('all');
                  setSelectedPlanId('all');
                  setSelectedStatus('all');
                  setSelectedCapacity('all');
                  setSelectedExpiry('all');
                }}
                className="h-10 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200/70 dark:border-rose-900/50 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                title="Reset filters"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'bn' ? 'রিসেট' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. ACCOUNT CARDS LIST */}
      <div className="space-y-4">
        {filteredAccounts.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#151C28] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {accounts.length === 0 ? 'No accounts yet.' : 'No matching accounts found.'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {accounts.length === 0
                ? 'Add your first account to get started.'
                : 'Try another search or filter.'}
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addAccount')}</span>
            </button>
          </div>
        ) : (
          filteredAccounts.map(acc => {
            const srv = services.find(s => s.id === acc.serviceId);
            const CategoryIcon = getCategoryIcon(srv?.category);
            const accent = getServiceAccent(srv?.name, srv?.category, srv?.color);

            const isExpanded = expandedAccountIds[acc.id];
            const capacity = getAccountCapacity(acc);
            const assignedCount = capacity.used;
            const totalProfiles = capacity.capacity;

            // Expiry checks
            const daysRemaining = acc.expiryDate ? getDaysDifference(acc.expiryDate) : null;
            const isExpired = daysRemaining !== null && daysRemaining < 0;
            const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

            // Status Badge Styling
            const getStatusBadge = () => {
              if (isAccountActive(acc)) {
                return {
                  text: language === 'bn' ? 'সক্রিয়' : 'Active',
                  cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
                  dot: 'bg-emerald-500',
                };
              }
              return {
                text: language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive',
                cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80',
                dot: 'bg-slate-400',
              };
            };

            const statusInfo = getStatusBadge();

            return (
              <div
                key={acc.id}
                id={`account-${acc.id}`}
                className={`rounded-2xl border ${accent.border} border-l-[3.5px] sm:border-l-4 ${accent.leftBorder} ${accent.bgTint} shadow-2xs hover:shadow-xs transition-all overflow-hidden`}
              >
                {/* 3. ACCOUNT CARD HEADER & DETAILS */}
                <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* Service and account details */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Service Category/Brand Icon Avatar */}
                    <div className={`w-11 h-11 rounded-xl ${accent.iconBg} flex items-center justify-center shrink-0 shadow-2xs mt-0.5`}>
                      {srv?.logoUrl ? (
                        <img src={srv.logoUrl} alt={srv.name} className="w-6 h-6 object-contain" />
                      ) : (
                        <span aria-hidden="true" className="text-sm font-bold">{srv?.name.trim().charAt(0).toUpperCase() || '?'}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Email + Service Tag + Status Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight break-all">
                          {acc.name || acc.email}
                        </span>

                        {/* Service Name Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${accent.badge}`}
                        >
                          {srv?.name || 'Service'}
                        </span>

                        {/* Semantic Account Status */}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusInfo.cls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          <span>{statusInfo.text}</span>
                        </span>
                      </div>

                      {/* Secondary Meta Row: Tier + Expiration */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {acc.plan}
                        </span>

                        <span>Profiles: {assignedCount} / {totalProfiles} used</span>
                        <span aria-hidden="true">·</span>
                        <span>Used: {assignedCount}</span>
                        <span aria-hidden="true">·</span>
                        <span className={capacity.status === 'Full' ? 'font-semibold text-rose-700 dark:text-rose-400' : capacity.status === 'Almost Full' ? 'font-semibold text-amber-700 dark:text-amber-400' : 'font-semibold text-emerald-700 dark:text-emerald-400'}>
                          {capacity.status} · {capacity.available} available
                        </span>

                        {acc.expiryDate && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span
                              className={`inline-flex items-center gap-1 ${
                                isExpired
                                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                  : isExpiringSoon
                                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {language === 'bn' ? 'মেয়াদ:' : 'Expires:'}{' '}
                                {formatAppDate(acc.expiryDate, language)}
                              </span>
                              {isExpired && (
                                <span className="text-[10px] bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 px-1.5 py-0.2 rounded font-bold">
                                  {language === 'bn' ? 'মেয়াদ শেষ' : 'Expired'}
                                </span>
                              )}
                              {isExpiringSoon && !isExpired && (
                                <span className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 px-1.5 py-0.2 rounded font-bold">
                                  {daysRemaining}d left
                                </span>
                              )}
                            </span>
                          </>
                        )}

                        {acc.notes && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] truncate max-w-[200px]" title={acc.notes}>
                              {acc.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Profile counts */}
                  <div className="w-full xl:w-64 px-3 py-2.5 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-center">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>Profiles</span>
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {assignedCount} / {totalProfiles} used
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span>{assignedCount} Used</span>
                      <span className={capacity.status === 'Full' ? 'font-semibold text-rose-700 dark:text-rose-400' : capacity.status === 'Almost Full' ? 'font-semibold text-amber-700 dark:text-amber-400' : 'font-semibold text-emerald-700 dark:text-emerald-400'}>
                        {capacity.available} Available · {capacity.status}
                      </span>
                    </div>
                  </div>

                  {/* Account actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end shrink-0">
                    <button
                      onClick={() => openEditModal(acc)}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      title="Edit account"
                      aria-label="Edit account"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => updateAccount(acc.id, { status: acc.status === 'Inactive' ? 'Available' : 'Inactive' })}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {acc.status === 'Inactive' ? 'Activate' : 'Deactivate'}
                    </button>
                    <button
                      onClick={() => handleDelete(acc)}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => toggleExpand(acc.id)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {isExpanded ? 'Hide' : 'View'}
                    </button>
                  </div>
                </div>

                {/* Profiles for this account */}
                {isExpanded && (
                  <div className="bg-slate-50/70 dark:bg-[#101622] border-t border-slate-200/70 dark:border-slate-800/90 p-4 sm:p-5">
                    {/* Profile Section Header Strip */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            {language === 'bn'
                              ? 'প্রোফাইল ও গ্রাহক'
                              : 'Profiles'}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.2 bg-slate-200/70 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 font-semibold">
                            {assignedCount}/{totalProfiles} {language === 'bn' ? 'বরাদ্দ' : 'Assigned'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {language === 'bn'
                            ? `${acc.email} এর প্রোফাইল ও গ্রাহক পরিচালনা করুন।`
                            : `Manage profiles and assigned customers for ${acc.email}.`}
                        </p>
                      </div>

                      {/* 7. ADD PROFILE SLOT BUTTON */}
                      <button
                        type="button"
                        onClick={() => setProfileModalAccount(acc)}
                        disabled={!isAccountActive(acc) || acc.profiles.length >= acc.maxProfiles}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{acc.profiles.length >= acc.maxProfiles ? 'Full' : 'Add Profile'}</span>
                      </button>
                    </div>

                    {/* Profile Slots Grid */}
                    {acc.profiles.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                        No profiles yet. Add a profile to this account.
                      </div>
                    ) : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {acc.profiles.map(prof => {
                        const assignedCust = customers.find(c => c.id === prof.assignedCustomerId);
                        const isAssigned = prof.status === 'Assigned';

                        return (
                          <div
                            key={prof.id}
                            className={`p-3.5 rounded-xl text-xs space-y-2.5 flex flex-col justify-between transition-all ${
                              isAssigned
                                ? 'bg-white dark:bg-[#151C28] border border-slate-200/90 dark:border-slate-800 shadow-2xs'
                                : 'bg-emerald-50/20 dark:bg-emerald-950/10 border border-dashed border-emerald-300 dark:border-emerald-800/80 hover:border-emerald-400 dark:hover:border-emerald-700 shadow-2xs'
                            }`}
                          >
                            {/* Card Top: Profile Name & Distinct Status Badge */}
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div
                                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                      isAssigned
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    }`}
                                  >
                                    {isAssigned ? (
                                      <UserCheck className="w-3.5 h-3.5" />
                                    ) : (
                                      <Users className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                                    {prof.profileName}
                                  </span>
                                </div>

                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    isAssigned
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                                  }`}
                                >
                                  {isAssigned
                                    ? language === 'bn'
                                      ? 'বরাদ্দ'
                                      : 'Assigned'
                                    : language === 'bn'
                                    ? 'উপলব্ধ'
                                    : 'Available'}
                                </span>
                              </div>

                              {/* Customer / Inventory Status */}
                              {isAssigned ? (
                                <div className="bg-slate-50 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 text-[11px] space-y-0.5">
                                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                    <UserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span className="text-[10px] uppercase font-semibold">
                                      {language === 'bn' ? 'গ্রাহক:' : 'Customer:'}
                                    </span>
                                  </div>
                                  <p className="font-bold text-slate-900 dark:text-white truncate">
                                    {assignedCust?.name || 'Assigned User'}
                                  </p>
                                  {assignedCust?.phone && (
                                    <p className="font-mono text-[10px] text-slate-500 truncate">
                                      {assignedCust.phone}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span>{language === 'bn' ? 'বরাদ্দের জন্য প্রস্তুত' : 'Ready to allocate'}</span>
                                </div>
                              )}

                              {/* PIN Badge if present */}
                              {prof.pin && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 rounded text-[11px] font-mono font-bold">
                                  <Lock className="w-3 h-3 text-amber-500" />
                                  <span>PIN: ••••</span>
                                </div>
                              )}
                            </div>

                            {/* Card Bottom: Allocation & Delete actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                              {isAssigned ? (
                                <button
                                  onClick={() => {
                                    if (window.confirm('Remove this customer from this profile?')) {
                                      assignCustomerToProfile(acc.id, prof.id, undefined);
                                      showToast('Customer unassigned from profile.', 'info');
                                    }
                                  }}
                                  className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  title="Unassign current customer from this profile"
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>{t('unassign')}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!isAccountActive(acc)}
                                  onClick={() => {
                                    setSelectedSubscriptionIdForSlot('');
                                    setAssigningSlot({
                                      accountId: acc.id,
                                      profileId: prof.id,
                                      profileName: prof.profileName,
                                      accountEmail: acc.email,
                                      serviceName: srv?.name || 'Service',
                                    });
                                    setSelectedCustomerIdForSlot('');
                                  }}
                                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  title="Allocate to customer"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  <span>Assign</span>
                                </button>
                              )}

                            </div>
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 8. ADD / EDIT ACCOUNT MODAL */}
      {(isAddAccountModalOpen || editingAccount) && (
        <Modal
          isOpen={isAddAccountModalOpen || Boolean(editingAccount)}
          onClose={() => {
            setIsAddAccountModalOpen(false);
            setEditingAccount(null);
          }}
          title={editingAccount ? 'Edit Account' : 'Add Account'}
          subtitle={
            editingAccount
              ? language === 'bn'
                ? 'মাস্টার সাবস্ক্রিপশন অ্যাকাউন্টের বিবরণ আপডেট করুন।'
                : 'Update this service account.'
              : language === 'bn'
              ? 'ইনভেন্টরিতে নতুন মাস্টার সাবস্ক্রিপশন অ্যাকাউন্ট যুক্ত করুন।'
              : 'Add an account for one of your services.'
          }
          maxWidth="lg"
        >
          <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
            {/* Section 1: Service Selection */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('serviceName')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={accServiceId}
                  onChange={e => {
                    const serviceId = e.target.value;
                    const service = services.find(item => item.id === serviceId);
                    const firstPlan = service?.planDetails?.find(plan => plan.status === 'active');
                    setAccServiceId(serviceId);
                    setAccPlanId(firstPlan?.id || '');
                    setAccPlan(firstPlan?.name || '');
                  }}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer appearance-none"
                  required
                >
                  {services.filter(service =>
                    (!service.isArchived && service.status === 'active') || service.id === accServiceId
                  ).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Account Name</label>
              <input type="text" value={accName} onChange={event => setAccName(event.target.value)} placeholder="e.g. Netflix Account 01" className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>

            {/* Section 2: Account Email & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('accountEmail')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter account email"
                  value={accEmail}
                  onChange={e => setAccEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('accountUsername')} <span className="text-slate-400 font-normal">({language === 'bn' ? 'ঐচ্ছিক' : 'Optional'})</span>
                </label>
                <input
                  type="text"
                  placeholder="account_username"
                  value={accUsername}
                  onChange={e => setAccUsername(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Section 3: Master Password */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Password <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type={showPasswordInModal ? 'text' : 'password'}
                  placeholder={editingAccount ? 'Leave blank to keep the current password' : 'Enter account password'}
                  value={accPassword}
                  onChange={e => setAccPassword(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordInModal(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                  title={showPasswordInModal ? 'Hide password' : 'Show password'}
                >
                  {showPasswordInModal ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Plan, profiles, and status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Plan
                </label>
                <select
                  value={accPlanId || (accPlan ? 'legacy-plan' : '')}
                  onChange={e => {
                    const selectedPlan = services.find(service => service.id === accServiceId)?.planDetails?.find(plan => plan.id === e.target.value);
                    setAccPlanId(selectedPlan?.id || '');
                    setAccPlan(selectedPlan?.name || (e.target.value === 'legacy-plan' ? accPlan : ''));
                  }}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="">No plan</option>
                  {accPlan && !services.find(service => service.id === accServiceId)?.planDetails?.some(plan => plan.id === accPlanId)
                    && <option value="legacy-plan">{accPlan}</option>}
                  {services.find(service => service.id === accServiceId)?.planDetails?.filter(plan => plan.status === 'active').map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Number of Profiles
                </label>
                <input
                  type="number"
                  value={accMaxProfiles}
                  onChange={e => setAccMaxProfiles(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                  min={1}
                  max={100}
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('status')}
                </label>
                <div className="relative">
                  <select
                    value={accStatus}
                    onChange={e => setAccStatus(e.target.value as AccountStatus)}
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer appearance-none"
                  >
                    <option value="Available">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <fieldset className="grid gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700 sm:grid-cols-3">
              <legend className="px-1 font-semibold text-slate-600 dark:text-slate-300">Assignment Settings</legend>
              <label className="flex items-center gap-2"><input type="checkbox" checked={allowProfileSharing} onChange={event => setAllowProfileSharing(event.target.checked)} />Allow profile sharing</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={requireCustomerAssignment} onChange={event => setRequireCustomerAssignment(event.target.checked)} />Require customer assignment</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={allowNewAssignment} onChange={event => setAllowNewAssignment(event.target.checked)} />Allow new assignments</label>
            </fieldset>

            {/* Section 5: Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('purchaseDate')}
                </label>
                <input
                  type="date"
                  value={accPurchaseDate}
                  onChange={e => setAccPurchaseDate(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('expiryDate')}
                </label>
                <input
                  type="date"
                  value={accExpiryDate}
                  onChange={e => setAccExpiryDate(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Section 6: Notes */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('notes')}
              </label>
              <textarea
                rows={2}
                placeholder="Billing card, Turkish/Nigerian region, renewal notes, customer restrictions..."
                value={accNotes}
                onChange={e => setAccNotes(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddAccountModalOpen(false);
                  setEditingAccount(null);
                }}
                className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Save Account
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 9. ADD PROFILE SLOT TO ACCOUNT MODAL */}
      {profileModalAccount && (
        <Modal
          isOpen={Boolean(profileModalAccount)}
          onClose={() => setProfileModalAccount(null)}
          title={t('addProfile')}
          subtitle={
            language === 'bn'
              ? `${profileModalAccount.email} এ একটি নতুন স্ক্রিন প্রোফাইল স্লট যোগ করুন।`
              : `Add a new screen profile slot to ${profileModalAccount.email}.`
          }
          maxWidth="md"
        >
          <form onSubmit={handleAddProfileSlot} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('profileName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Screen 3, Profile 4, Kids"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('profilePin')} <span className="text-slate-400 font-normal">({language === 'bn' ? 'ঐচ্ছিক' : 'Optional'})</span>
              </label>
              <input
                type="password"
                placeholder="4-digit PIN (e.g. 1423)"
                value={newProfilePin}
                onChange={e => setNewProfilePin(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                maxLength={6}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Start Date<input type="date" value={newProfileStartDate} onChange={event => setNewProfileStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" /></label>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Expiry Date<input type="date" value={newProfileExpiryDate} onChange={event => setNewProfileExpiryDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" /></label>
            </div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Notes<textarea rows={2} value={newProfileNotes} onChange={event => setNewProfileNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" /></label>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setProfileModalAccount(null)}
                className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 10. ASSIGN CUSTOMER TO PROFILE MODAL */}
      {assigningSlot && (
        <Modal
          isOpen={Boolean(assigningSlot)}
          onClose={() => {
            setAssigningSlot(null);
            setSelectedCustomerIdForSlot('');
            setSelectedSubscriptionIdForSlot('');
          }}
          title={language === 'bn' ? 'প্রোফাইল বরাদ্দ করুন' : 'Allocate Profile to Customer'}
          subtitle={`${assigningSlot.serviceName} (${assigningSlot.accountEmail}) - ${assigningSlot.profileName}`}
          maxWidth="md"
        >
          <form onSubmit={handleAssignCustomer} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {language === 'bn' ? 'গ্রাহক নির্বাচন করুন' : 'Select Customer'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCustomerIdForSlot}
                  onChange={e => setSelectedCustomerIdForSlot(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer appearance-none"
                  required
                >
                  <option value="" disabled>
                    {language === 'bn' ? '-- গ্রাহক বেছে নিন --' : '-- Choose a Customer --'}
                  </option>
                  {activeCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.email})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <label className="block text-slate-700 dark:text-slate-300 font-semibold">
              Subscription <span className="text-rose-500">*</span>
              <select value={selectedSubscriptionIdForSlot} onChange={event => setSelectedSubscriptionIdForSlot(event.target.value)} disabled={!selectedCustomerIdForSlot} required className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Choose a compatible subscription</option>
                {subscriptions.filter(subscription => {
                  const account = accounts.find(item => item.id === assigningSlot.accountId);
                  const profile = account?.profiles.find(item => item.id === assigningSlot.profileId);
                  return subscription.customerId === selectedCustomerIdForSlot
                    && subscription.status !== 'cancelled'
                    && subscription.serviceId === account?.serviceId
                    && (!account.planId || !subscription.planId || account.planId === subscription.planId)
                    && (!subscription.accountId || subscription.accountId === account?.id)
                    && (!subscription.profileId || subscription.profileId === profile?.id);
                }).map(subscription => (
                  <option key={subscription.id} value={subscription.id}>{subscription.id} · {subscription.plan} · {subscription.expiryDate}</option>
                ))}
              </select>
            </label>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200/80 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p>
                {language === 'bn'
                  ? 'এই প্রোফাইল স্লটটি সংশ্লিষ্ট গ্রাহকের সাবস্ক্রিপশন এবং ইনভেন্টরিতে তৎক্ষণাৎ যুক্ত হবে।'
                  : 'Assigning will mark this screen profile as Assigned and link it to the selected customer in your inventory.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAssigningSlot(null);
                  setSelectedCustomerIdForSlot('');
                  setSelectedSubscriptionIdForSlot('');
                }}
                className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={!selectedSubscriptionIdForSlot}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
              >
                {language === 'bn' ? 'বরাদ্দ নিশ্চিত করুন' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
