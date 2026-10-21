import React from 'react';
import type { Customer, CustomerType } from '../../types';
import { getCustomerType } from '../../utils/relationships';

interface CustomerNameWithTypeProps {
  customer?: Pick<Customer, 'name' | 'customerType'> | null;
  name?: string;
  nameClassName?: string;
  className?: string;
}

export const CustomerNameWithType: React.FC<CustomerNameWithTypeProps> = ({
  customer,
  name,
  nameClassName = 'min-w-0 break-words',
  className = 'inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1',
}) => {
  const customerType: CustomerType | undefined = getCustomerType(customer);
  const displayName = name ?? (
    typeof customer?.name === 'string' && customer.name.trim()
      ? customer.name.trim()
      : 'Customer unavailable'
  );
  return (
    <span className={className}>
      <span className={nameClassName}>{displayName}</span>
      {customerType && (
        <span
          aria-label={`Customer type: ${customerType}`}
          className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${
            customerType === 'Reseller'
              ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200'
              : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
          }`}
        >
          {customerType}
        </span>
      )}
    </span>
  );
};
