import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  Search,
  Plus,
  Lock,
  Copy,
  CheckCircle,
  Users,
  Shield,
  Trash2,
  Edit2,
  X,
  UserX,
  Tv,
  Sparkles,
  Palette,
  Music,
  Briefcase,
  Laptop,
  Key,
  Layers,
  ShieldCheck,
  Check,
  ChevronDown,
  Info,
  Mail,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { AccountProfile, ServiceCategory } from '../../types';
import { normalizeSearchText } from '../../services/globalSearch';
import { getAccountCapacity, getProfileStatus, isAccountOperational } from '../../utils/resourceManagement';

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
      badge: 'bg-rose-50 text-[#E50914] dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60',
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
      badge: 'bg-sky-50 text-[#007EA7] dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60',
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
      badge: 'bg-purple-50 text-[#7C3AED] dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60',
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
      badge: 'bg-amber-50 text-[#B45309] dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60',
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
      badge: 'bg-emerald-50 text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60',
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
      badge: 'bg-red-50 text-[#B91C1C] dark:bg-red-950/60 dark:text-red-300 border border-red-200/80 dark:border-red-800/60',
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
      badge: 'bg-rose-50 text-[#BE123C] dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60',
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
      badge: 'bg-amber-50 text-[#B45309] dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60',
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
      badge: 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60',
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
      badge: 'bg-sky-50 text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60',
      barFill: 'bg-[#0284C7] dark:bg-sky-500',
    };
  }

  // 11. Category Fallbacks
  switch (category) {
    case 'Streaming':
      return {
        leftBorder: 'border-l-rose-500',
        bgTint: 'bg-gradient-to-r from-rose-500/[0.04] via-white to-white dark:from-rose-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-rose-200/70 dark:border-rose-900/40',
        iconBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs',
        badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60',
        barFill: 'bg-rose-500',
      };
    case 'AI Tools':
      return {
        leftBorder: 'border-l-teal-500',
        bgTint: 'bg-gradient-to-r from-teal-500/[0.04] via-white to-white dark:from-teal-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-teal-200/70 dark:border-teal-900/40',
        iconBg: 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/80 dark:border-teal-800/60 shadow-2xs',
        badge: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60',
        barFill: 'bg-teal-500',
      };
    case 'Design':
      return {
        leftBorder: 'border-l-purple-500',
        bgTint: 'bg-gradient-to-r from-purple-500/[0.04] via-white to-white dark:from-purple-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-purple-200/70 dark:border-purple-900/40',
        iconBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/60 shadow-2xs',
        badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60',
        barFill: 'bg-purple-500',
      };
    case 'Music':
      return {
        leftBorder: 'border-l-emerald-500',
        bgTint: 'bg-gradient-to-r from-emerald-500/[0.04] via-white to-white dark:from-emerald-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-emerald-200/70 dark:border-emerald-900/40',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs',
        badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60',
        barFill: 'bg-emerald-500',
      };
    case 'Productivity':
      return {
        leftBorder: 'border-l-blue-500',
        bgTint: 'bg-gradient-to-r from-blue-500/[0.04] via-white to-white dark:from-blue-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-blue-200/70 dark:border-blue-900/40',
        iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs',
        badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60',
        barFill: 'bg-blue-500',
      };
    case 'VPN':
      return {
        leftBorder: 'border-l-indigo-500',
        bgTint: 'bg-gradient-to-r from-indigo-500/[0.04] via-white to-white dark:from-indigo-500/[0.06] dark:via-[#151C28] dark:to-[#151C28]',
        border: 'border-indigo-200/70 dark:border-indigo-900/40',
        iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs',
        badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60',
        barFill: 'bg-indigo-500',
      };
    default:
      return {
        leftBorder: 'border-l-slate-400 dark:border-l-slate-600',
        bgTint: 'bg-white dark:bg-[#151C28]',
        border: 'border-slate-200/80 dark:border-slate-800',
        iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700',
        barFill: 'bg-slate-500 dark:bg-slate-400',
      };
  }
}

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

interface ProfilesViewProps {
  serviceFilterId?: string;
}

export const ProfilesView: React.FC<ProfilesViewProps> = ({ serviceFilterId }) => {
  const {
    accounts,
    services,
    customers,
    subscriptions,
    assignCustomerToProfile,
    deleteProfile,
    addProfileToAccount,
    updateProfile,
    t,
    language,
  } = useApp();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (serviceFilterId) setSelectedServiceId(serviceFilterId);
  }, [serviceFilterId]);

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePin, setNewProfilePin] = useState('');
  const [newProfileStartDate, setNewProfileStartDate] = useState('');
  const [newProfileExpiryDate, setNewProfileExpiryDate] = useState('');
  const [newProfileNotes, setNewProfileNotes] = useState('');
  const [editingProfile, setEditingProfile] = useState<{ accountId: string; profile: AccountProfile } | null>(null);
  const [assigningProfile, setAssigningProfile] = useState<{ accountId: string; profileId: string } | null>(null);
  const [assignCustomerId, setAssignCustomerId] = useState('');
  const [assignSubscriptionId, setAssignSubscriptionId] = useState('');

  // Flatten all profiles with their parent account and service
  const allProfiles = useMemo(() => {
    const list: Array<{
      profile: AccountProfile;
      account: typeof accounts[0];
      service?: typeof services[0];
      customer?: typeof customers[0];
    }> = [];

    accounts.forEach(acc => {
      const srv = services.find(s => s.id === acc.serviceId);
      acc.profiles.forEach(prof => {
        const cust = customers.find(c => c.id === prof.assignedCustomerId);
        list.push({
          profile: prof,
          account: acc,
          service: srv,
          customer: cust,
        });
      });
    });

    return list;
  }, [accounts, services, customers]);

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    return allProfiles.filter(item => {
      const q = normalizeSearchText(searchQuery);
      const matchesSearch =
        q === '' ||
        [item.profile.id, item.profile.profileName, item.account.id, item.account.email,
          item.account.plan, item.customer?.name ?? '', item.service?.name ?? '']
          .some(value => normalizeSearchText(value).includes(q));

      const matchesService = selectedServiceId === 'all' || item.account.serviceId === selectedServiceId;
      const matchesStatus = selectedStatus === 'all'
        || getProfileStatus(item.profile, item.account) === selectedStatus;

      return matchesSearch && matchesService && matchesStatus;
    });
  }, [allProfiles, searchQuery, selectedServiceId, selectedStatus]);

  const copyToClipboard = (text: string, id: string, msg: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(msg, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAccountId || !newProfileName.trim()) {
      showToast('Please select an account and provide a profile name.', 'error');
      return;
    }
    try {
      addProfileToAccount(targetAccountId, newProfileName.trim(), newProfilePin.trim() || undefined, {
        startDate: newProfileStartDate || undefined,
        expiryDate: newProfileExpiryDate || undefined,
        notes: newProfileNotes.trim() || undefined,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add profile.', 'error');
      return;
    }
    showToast(t('profileSavedSuccess'), 'success');
    setIsAddModalOpen(false);
    setNewProfileName('');
    setNewProfilePin('');
    setNewProfileStartDate('');
    setNewProfileExpiryDate('');
    setNewProfileNotes('');
    setTargetAccountId('');
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    updateProfile(editingProfile.accountId, editingProfile.profile.id, {
      profileName: editingProfile.profile.profileName,
      startDate: editingProfile.profile.startDate || undefined,
      expiryDate: editingProfile.profile.expiryDate || undefined,
      notes: editingProfile.profile.notes || undefined,
      ...(editingProfile.profile.pin ? { pin: editingProfile.profile.pin } : {}),
    });
    showToast(t('profileSavedSuccess'), 'success');
    setEditingProfile(null);
  };

  const handleAssignProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!assigningProfile || !assignCustomerId || !assignSubscriptionId) return;
    try {
      assignCustomerToProfile(assigningProfile.accountId, assigningProfile.profileId, assignCustomerId, undefined, assignSubscriptionId);
      setAssigningProfile(null);
      setAssignCustomerId('');
      setAssignSubscriptionId('');
      showToast('Customer assigned to profile.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not assign customer.', 'error');
    }
  };

  // KPI Calculations
  const totalProfilesCount = allProfiles.length;
  const assignedProfilesCount = allProfiles.filter(p => p.profile.status === 'Assigned').length;
  const availableSlotsCount = allProfiles.filter(p => p.profile.status === 'Available').length;
  const pinProtectedCount = allProfiles.filter(p => Boolean(p.profile.pin)).length;
  const accountsWithCapacity = accounts.filter(account =>
    isAccountOperational(account)
    && getAccountCapacity(account).available > 0
  );
  const assignableSubscriptions = subscriptions.filter(subscription => {
    if (!assigningProfile || !assignCustomerId || subscription.customerId !== assignCustomerId || subscription.status === 'cancelled') return false;
    const account = accounts.find(item => item.id === assigningProfile.accountId);
    const profile = account?.profiles.find(item => item.id === assigningProfile.profileId);
    return Boolean(account && profile
      && subscription.serviceId === account.serviceId
      && (!account.planId || !subscription.planId || account.planId === subscription.planId)
      && (!subscription.accountId || subscription.accountId === account.id)
      && (!subscription.profileId || subscription.profileId === profile.id));
  });
  const activeCustomers = customers.filter(customer => !customer.isArchived && customer.status !== 'archived');

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-2xs">
              <UserCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span>{language === 'bn' ? 'প্রোফাইলসমূহ' : 'Profiles'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'অ্যাকাউন্টের প্রোফাইল ও গ্রাহক বরাদ্দ পরিচালনা করুন।'
              : 'Manage account profiles and customer assignments.'}
          </p>
        </div>

        <button
          onClick={() => {
            setTargetAccountId(accountsWithCapacity[0]?.id || '');
            setIsAddModalOpen(true);
          }}
          disabled={accountsWithCapacity.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer self-start sm:self-auto shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t('addProfile')}</span>
        </button>
      </div>

      {/* 2. REFINED KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Profiles */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'মোট প্রোফাইল' : 'Total Profiles'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalProfilesCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'সব অ্যাকাউন্ট' : 'all accounts'}
            </span>
          </div>
        </div>

        {/* Assigned Profiles */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'বরাদ্দকৃত প্রোফাইল' : 'Assigned Profiles'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {assignedProfilesCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {assignedProfilesCount} {language === 'bn' ? 'বরাদ্দ' : 'assigned'}
            </span>
          </div>
        </div>

        {/* Available Slots */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'উপলব্ধ প্রোফাইল' : 'Available Profiles'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {availableSlotsCount}
            </span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              {language === 'bn' ? 'বরাদ্দের জন্য খালি' : 'available'}
            </span>
          </div>
        </div>

        {/* PIN Protected */}
        <div className="bg-white dark:bg-[#151C28] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {language === 'bn' ? 'পিন সুরক্ষিত' : 'PIN Protected'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {pinProtectedCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {pinProtectedCount} of {totalProfilesCount} protected
            </span>
          </div>
        </div>
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
                  ? 'প্রোফাইল নাম, পিন, গ্রাহক অথবা অ্যাকাউন্ট ইমেইল দিয়ে খুঁজুন...'
                  : 'Search profiles, customer, or account email...'
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

          {/* Filters */}
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

            {/* Status Filter */}
            <div className="relative min-w-[140px] flex-1 sm:flex-initial">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full h-10 pl-3 pr-8 bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 cursor-pointer appearance-none"
              >
                <option value="all">{language === 'bn' ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
                <option value="Available">{t('status_available')}</option>
                <option value="Assigned">{t('status_assigned')}</option>
                <option value="Inactive">Inactive</option>
                <option value="Expired">Expired</option>
                <option value="Suspended">Suspended</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Reset shortcut */}
            {(searchQuery || selectedServiceId !== 'all' || selectedStatus !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedServiceId('all');
                  setSelectedStatus('all');
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

      {/* 4. PROFILES GRID (3 per row on Desktop, 2 on Tablet, 1 on Mobile) */}
      {filteredProfiles.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#151C28] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {totalProfilesCount === 0 ? 'No profiles yet.' : 'No matching profiles found.'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {totalProfilesCount === 0
              ? accounts.length ? 'Add a profile to an account to get started.' : 'Add an account first to create profiles.'
              : 'Try another search or filter.'}
          </p>
          <button
            onClick={() => {
              setTargetAccountId(accountsWithCapacity[0]?.id || '');
              setIsAddModalOpen(true);
            }}
            disabled={accountsWithCapacity.length === 0}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addProfile')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredProfiles.map(({ profile, account, service, customer }) => {
            const hasPin = Boolean(profile.pin);
            const profileStatus = getProfileStatus(profile, account);
            const isAssigned = profileStatus === 'Assigned';
            const accent = getServiceAccent(service?.name, service?.category, service?.color);
            const CategoryIcon = getCategoryIcon(service?.category);

            // Semantic Status Badge styling
            const getStatusBadge = () => {
              if (profileStatus === 'Assigned') {
                return {
                  text: language === 'bn' ? 'বরাদ্দকৃত' : 'Assigned',
                  cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
                  dot: 'bg-emerald-500',
                };
              }
              if (profileStatus === 'Available') {
                return {
                  text: language === 'bn' ? 'উপলব্ধ' : 'Available',
                  cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
                  dot: 'bg-blue-500',
                };
              }
              return {
                text: profileStatus,
                cls: profileStatus === 'Expired'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  : profileStatus === 'Suspended'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/80 dark:border-slate-700',
                dot: profileStatus === 'Expired' ? 'bg-rose-500' : profileStatus === 'Suspended' ? 'bg-amber-500' : 'bg-slate-400',
              };
            };

            const statusInfo = getStatusBadge();

            return (
              <div
                key={profile.id}
                className={`rounded-2xl border ${accent.border} border-l-[3.5px] sm:border-l-4 ${accent.leftBorder} ${accent.bgTint} shadow-2xs hover:shadow-xs transition-all p-4 sm:p-5 flex flex-col justify-between overflow-hidden`}
              >
                <div className="space-y-3.5">
                  {/* Card Header: Service Label + Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Service Label with Icon */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-md ${accent.iconBg} flex items-center justify-center shrink-0`}
                        title={service?.name}
                      >
                        {service?.logoUrl ? (
                          <img src={service.logoUrl} alt={service.name} className="w-3.5 h-3.5 object-contain" />
                        ) : (
                          <span aria-hidden="true" className="text-[10px] font-bold">{service?.name.trim().charAt(0).toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border truncate ${accent.badge}`}
                        title={service?.name || 'Service'}
                      >
                        {service?.name || 'Service'}
                      </span>
                    </div>

                    {/* Semantic Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${statusInfo.cls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                      <span>{statusInfo.text}</span>
                    </span>
                  </div>

                  {/* Profile Name (Main content) */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate tracking-tight">
                      {profile.profileName}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {isAssigned
                        ? language === 'bn'
                          ? 'সক্রিয় ব্যবহারকারী বরাদ্দ'
                          : 'Active customer allocation'
                        : language === 'bn'
                        ? 'বিক্রয় বা বরাদ্দের জন্য প্রস্তুত'
                        : 'Ready to allocate'}
                    </p>
                  </div>

                  {/* Account Information Block */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
                        {language === 'bn' ? 'মাস্টার অ্যাকাউন্ট' : 'Account'}
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                          title={account.email}
                        >
                          {account.email}
                        </span>
                        <button
                          onClick={() => copyToClipboard(account.email, `acc-${profile.id}`, 'Account email copied!')}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
                          title="Copy account email"
                        >
                          {copiedId === `acc-${profile.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* PIN Block */}
                    <div className="p-2.5 bg-slate-50/90 dark:bg-slate-900/80 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Lock className={`w-3.5 h-3.5 ${hasPin ? 'text-amber-500' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-semibold">
                          {language === 'bn' ? 'প্রোফাইল পিন' : 'Profile PIN'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasPin ? (
                          <>
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white tracking-widest">
                              ••••
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs italic">
                            {language === 'bn' ? 'পিন নেই' : 'No PIN'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assigned To Block */}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
                        {language === 'bn' ? 'বরাদ্দকৃত গ্রাহক' : 'Assigned To'}
                      </span>
                      {customer ? (
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {customer.name}
                            </span>
                          </div>
                          {customer.phone && (
                            <span className="font-mono text-[10px] text-slate-500 truncate">
                              {customer.phone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                          {language === 'bn' ? 'বরাদ্দহীন' : 'Unassigned'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom / Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    {isAssigned && customer ? (
                      <button
                        onClick={() => {
                          const subscription = subscriptions.find(item =>
                            item.id === profile.subscriptionId || item.profileId === profile.id
                          );
                          const confirmMessage = [
                            'Unassign this profile?',
                            `Customer: ${customer.name}`,
                            `Account: ${account.email}`,
                            `Profile: ${profile.profileName}`,
                            `Subscription: ${subscription?.id || 'None linked'}`,
                            'The subscription and sale history will be retained.',
                          ].join('\n');
                          if (window.confirm(confirmMessage)) {
                            assignCustomerToProfile(account.id, profile.id, undefined);
                            showToast('Customer unassigned from profile.', 'info');
                          }
                        }}
                        className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <UserX className="w-3 h-3" />
                        <span>{t('unassign')}</span>
                      </button>
                    ) : isAssigned ? (
                      <span className="text-xs text-slate-500">Customer unavailable</span>
                    ) : isAccountOperational(account) && profileStatus === 'Available' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningProfile({ accountId: account.id, profileId: profile.id });
                          setAssignCustomerId('');
                          setAssignSubscriptionId('');
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Assign
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{language === 'bn' ? 'খালি স্লট' : 'Available slot'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingProfile({ accountId: account.id, profile })}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit profile"
                      aria-label="Edit profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t('confirmDelete'))) {
                          try {
                            deleteProfile(account.id, profile.id);
                            showToast('Profile removed.', 'info');
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : 'Could not delete this profile.', 'error');
                          }
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete profile"
                      aria-label="Delete profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Profile Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title={t('addProfile')}
          subtitle={
            language === 'bn'
              ? 'মাস্টার অ্যাকাউন্টে নতুন স্ক্রিন প্রোফাইল স্লট যোগ করুন।'
              : 'Add a new screen profile slot to a master fulfillment account.'
          }
          maxWidth="md"
        >
          <form onSubmit={handleAddProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {language === 'bn' ? 'মাস্টার অ্যাকাউন্ট নির্বাচন করুন' : 'Select Target Account'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={targetAccountId}
                  onChange={e => setTargetAccountId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer appearance-none"
                  required
                >
                  {accountsWithCapacity.map(acc => {
                    const srv = services.find(s => s.id === acc.serviceId);
                    return (
                      <option key={acc.id} value={acc.id}>
                        {srv?.name} - {acc.email} ({acc.plan})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('profileName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter profile name"
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
                placeholder="e.g. 1423"
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
                onClick={() => setIsAddModalOpen(false)}
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

      {assigningProfile && (
        <Modal
          isOpen={Boolean(assigningProfile)}
          onClose={() => {
            setAssigningProfile(null);
            setAssignCustomerId('');
            setAssignSubscriptionId('');
          }}
          title="Assign Profile"
          maxWidth="md"
        >
          <form onSubmit={handleAssignProfile} className="space-y-4 text-sm">
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Customer
              <select
                value={assignCustomerId}
                onChange={event => setAssignCustomerId(event.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select customer</option>
                {activeCustomers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Subscription
              <select value={assignSubscriptionId} onChange={event => setAssignSubscriptionId(event.target.value)} required disabled={!assignCustomerId} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Select a compatible subscription</option>
                {assignableSubscriptions.map(subscription => (
                  <option key={subscription.id} value={subscription.id}>{subscription.id} · {subscription.plan} · {subscription.expiryDate}</option>
                ))}
              </select>
            </label>
            {activeCustomers.length === 0 && <p className="text-xs text-slate-500">No active customers to assign.</p>}
            {assignCustomerId && assignableSubscriptions.length === 0 && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">This customer has no compatible unassigned subscription for the selected service and plan.</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setAssigningProfile(null); setAssignCustomerId(''); setAssignSubscriptionId(''); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!activeCustomers.length || !assignSubscriptionId}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <Modal
          isOpen={Boolean(editingProfile)}
          onClose={() => setEditingProfile(null)}
          title={`${t('edit')} ${t('nav_profiles')}`}
          subtitle={
            language === 'bn'
              ? 'স্ক্রিন প্রোফাইলের নাম, পিন কোড এবং স্ট্যাটাস সংশোধন করুন।'
              : 'Modify screen profile slot details, PIN code, and active status.'
          }
          maxWidth="md"
        >
          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('profileName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editingProfile.profile.profileName}
                onChange={e =>
                  setEditingProfile({
                    ...editingProfile,
                    profile: { ...editingProfile.profile, profileName: e.target.value },
                  })
                }
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
                value={editingProfile.profile.pin || ''}
                onChange={e =>
                  setEditingProfile({
                    ...editingProfile,
                    profile: { ...editingProfile.profile, pin: e.target.value },
                  })
                }
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500"
                placeholder={editingProfile.profile.pin ? '•••• (saved)' : 'Leave blank to keep saved PIN'}
                maxLength={6}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Start Date<input type="date" value={editingProfile.profile.startDate || ''} onChange={event => setEditingProfile({ ...editingProfile, profile: { ...editingProfile.profile, startDate: event.target.value } })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" /></label>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Expiry Date<input type="date" value={editingProfile.profile.expiryDate || ''} onChange={event => setEditingProfile({ ...editingProfile, profile: { ...editingProfile.profile, expiryDate: event.target.value } })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" /></label>
            </div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Notes<textarea rows={2} value={editingProfile.profile.notes || ''} onChange={event => setEditingProfile({ ...editingProfile, profile: { ...editingProfile.profile, notes: event.target.value } })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" /></label>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
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
    </div>
  );
};
