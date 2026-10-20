import type {
  DashboardLayoutPreference,
  DashboardPanelWidgetId,
  DashboardSummaryWidgetId,
  DashboardWidgetId,
} from '../types';

export const dashboardSummaryWidgetIds: DashboardSummaryWidgetId[] = [
  'receivedRevenue',
  'customers',
  'activeSubscriptions',
  'expiringSubscriptions',
  'outstandingPayments',
];

export const dashboardPanelWidgetIds: DashboardPanelWidgetId[] = [
  'attention',
  'revenueTrend',
  'subscriptionHealth',
  'recentSales',
];

export const defaultDashboardLayout: DashboardLayoutPreference = {
  summaryOrder: dashboardSummaryWidgetIds,
  panelOrder: dashboardPanelWidgetIds,
  hidden: [],
};

const reorderKnownIds = <T extends string>(value: unknown, knownIds: readonly T[]): T[] => {
  if (!Array.isArray(value)) return [...knownIds];
  const known = new Set<string>(knownIds);
  const seen = new Set<string>();
  const ordered = value.filter((id): id is T => {
    if (typeof id !== 'string' || !known.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...ordered, ...knownIds.filter(id => !seen.has(id))];
};

export function normalizeDashboardLayout(value: unknown): DashboardLayoutPreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      summaryOrder: [...defaultDashboardLayout.summaryOrder],
      panelOrder: [...defaultDashboardLayout.panelOrder],
      hidden: [],
    };
  }

  const candidate = value as Partial<DashboardLayoutPreference>;
  const knownWidgets = new Set<string>([
    ...dashboardSummaryWidgetIds,
    ...dashboardPanelWidgetIds,
  ]);
  const hidden = Array.isArray(candidate.hidden)
    ? [...new Set(candidate.hidden.filter((id): id is DashboardWidgetId =>
      typeof id === 'string' && knownWidgets.has(id)
    ))]
    : [];

  return {
    summaryOrder: reorderKnownIds(candidate.summaryOrder, dashboardSummaryWidgetIds),
    panelOrder: reorderKnownIds(candidate.panelOrder, dashboardPanelWidgetIds),
    hidden,
  };
}
