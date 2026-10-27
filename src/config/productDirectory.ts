import { productBrand } from './brand.ts';

export type EcosystemProductStatus = 'active' | 'planned' | 'coming-soon';

export interface EcosystemProduct {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  url?: string;
  status: EcosystemProductStatus;
  isCurrentProduct?: boolean;
}

export interface ProductDirectory {
  source: 'local';
  brand: {
    name: string;
    description: string;
    logoUrl?: string;
  };
  products: EcosystemProduct[];
}

export const localProductDirectory: ProductDirectory = {
  source: 'local',
  brand: {
    name: 'XolveKart',
    description: 'The parent brand behind XolveManager and other products in the XolveKart ecosystem.',
    logoUrl: '/xolvekartbrand.png',
  },
  products: [
    {
      id: 'xolvemanager',
      name: productBrand.name,
      description: productBrand.description,
      logoUrl: productBrand.iconUrl,
      status: 'active',
      isCurrentProduct: true,
    },
  ],
};
