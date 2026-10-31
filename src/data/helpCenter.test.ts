import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getContextualHelpArticle,
  getHelpArticle,
  getLocalizedHelpArticle,
  helpArticles,
  helpCategories,
  searchHelpArticles,
} from './helpCenter.ts';
import { helpArticlesBn, helpCategoriesBn } from '../i18n/helpCenterBn.ts';

test('Help Center covers every category and every related article resolves', () => {
  const articleIds = new Set(helpArticles.map(article => article.id));
  assert.equal(articleIds.size, helpArticles.length);
  assert.ok(helpCategories.every(category => helpArticles.some(article => article.category === category)));
  assert.ok(helpArticles.every(article => article.steps.length > 0));
  assert.ok(helpArticles.every(article => article.related.every(id => articleIds.has(id))));
});

test('Help Center search matches titles, article instructions, and troubleshooting keywords', () => {
  assert.equal(searchHelpArticles('partial payment')[0]?.id, 'payment-partial');
  assert.ok(searchHelpArticles('no receiving account').some(article => article.id === 'trouble-no-receiving-account'));
  assert.ok(searchHelpArticles('backup integrity').some(article => article.id === 'trouble-restore'));
  assert.deepEqual(searchHelpArticles('unmatched-term').map(article => article.id), []);
});

test('Help Center category filtering and contextual guides are available', () => {
  assert.ok(searchHelpArticles('', 'Payments & Due Collection').every(article =>
    article.category === 'Payments & Due Collection'
  ));
  assert.equal(getContextualHelpArticle('customers'), 'customer-create');
  assert.equal(getContextualHelpArticle('cashbook'), 'receiving-account');
  assert.equal(getContextualHelpArticle('accounts'), 'receiving-account');
  assert.equal(getContextualHelpArticle('invoices'), 'invoice-create');
  assert.ok(getHelpArticle(getContextualHelpArticle('services')));
});

test('Help Center documents each requested workflow and troubleshooting state', () => {
  const requiredIds = [
    'customer-create',
    'service-create',
    'receiving-account',
    'sales-create',
    'invoice-create',
    'payment-partial',
    'advance-credit',
    'due-collection',
    'renewals-manage',
    'backup-restore',
    'trouble-no-customers',
    'trouble-no-services',
    'trouble-no-receiving-account',
    'trouble-invalid-amount',
    'trouble-missing-information',
    'trouble-restore',
  ];
  assert.ok(requiredIds.every(id => getHelpArticle(id)));
  assert.ok(helpArticles.filter(article => article.problem).every(article => article.nextAction));
});

test('Bangla Help Center translates every article and searches Bengali guidance', () => {
  assert.deepEqual(Object.keys(helpArticlesBn).sort(), helpArticles.map(article => article.id).sort());
  assert.equal(Object.keys(helpCategoriesBn).length, helpCategories.length);
  assert.ok(helpArticles.every(article => {
    const translated = getLocalizedHelpArticle(article, 'bn');
    return translated.title && translated.introduction && translated.steps.length === article.steps.length;
  }));
  assert.ok(searchHelpArticles('বকেয়া পেমেন্ট', 'All', 'bn').some(article =>
    article.id === 'due-collection'
  ));
  assert.ok(searchHelpArticles('রিসিভিং অ্যাকাউন্ট নেই', 'All', 'bn').some(article =>
    article.id === 'trouble-no-receiving-account'
  ));
});
