import type { Service } from '../types';

export type ServiceSelectionSort = 'name' | 'plans' | 'recent';

export function getServiceSelectionCategories(services: Service[]): string[] {
  return [...new Set(services
    .map(service => service.category.trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function hasServiceCreationDates(services: Service[]): boolean {
  return services.some(service => Number.isFinite(Date.parse(service.createdAt || '')));
}

export function getActiveServicePlanCount(service: Service): number {
  return service.planDetails?.filter(plan => plan.status === 'active').length || 0;
}

export function filterAndSortServiceSelection(
  services: Service[],
  query: string,
  category: string,
  sort: ServiceSelectionSort
): Service[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = services.filter(service => {
    const matchesQuery = !normalizedQuery
      || [service.name, service.description]
        .some(value => value?.toLocaleLowerCase().includes(normalizedQuery));
    const matchesCategory = !category || service.category.trim() === category;
    return matchesQuery && matchesCategory;
  });

  return filtered.sort((left, right) => {
    if (sort === 'plans') {
      const planCountDifference = getActiveServicePlanCount(right) - getActiveServicePlanCount(left);
      if (planCountDifference) return planCountDifference;
    } else if (sort === 'recent') {
      const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
      const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;
      if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
        return rightCreatedAt - leftCreatedAt;
      }
      if (Number.isFinite(leftCreatedAt) !== Number.isFinite(rightCreatedAt)) {
        return Number.isFinite(rightCreatedAt) ? 1 : -1;
      }
    }

    return left.name.localeCompare(right.name);
  });
}
