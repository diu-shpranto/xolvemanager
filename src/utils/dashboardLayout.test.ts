import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dashboardPanelWidgetIds,
  dashboardSummaryWidgetIds,
  defaultDashboardLayout,
  normalizeDashboardLayout,
} from './dashboardLayout.ts';

test('default dashboard layout includes every summary and primary panel', () => {
  assert.deepEqual(defaultDashboardLayout.summaryOrder, dashboardSummaryWidgetIds);
  assert.deepEqual(defaultDashboardLayout.panelOrder, dashboardPanelWidgetIds);
  assert.deepEqual(defaultDashboardLayout.hidden, []);
});

test('normalization removes unknown and duplicate IDs while appending missing widgets', () => {
  const normalized = normalizeDashboardLayout({
    summaryOrder: ['customers', 'customers', 'unknown'],
    panelOrder: ['recentSales', 'attention'],
    hidden: ['customers', 'unknown', 'customers', 1],
  });

  assert.deepEqual(normalized.summaryOrder, ['customers', 'receivedRevenue', 'activeSubscriptions', 'expiringSubscriptions', 'outstandingPayments']);
  assert.deepEqual(normalized.panelOrder, ['recentSales', 'attention', 'revenueTrend', 'subscriptionHealth']);
  assert.deepEqual(normalized.hidden, ['customers']);
});

test('invalid preference shapes safely fall back to the default layout', () => {
  for (const value of [null, undefined, 'invalid', 42, [], { summaryOrder: 'bad', panelOrder: null, hidden: {} }]) {
    assert.deepEqual(normalizeDashboardLayout(value), {
      summaryOrder: dashboardSummaryWidgetIds,
      panelOrder: dashboardPanelWidgetIds,
      hidden: [],
    });
  }
});
