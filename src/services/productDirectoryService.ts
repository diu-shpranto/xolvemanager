import { localProductDirectory } from '../config/productDirectory.ts';
import type { ProductDirectory } from '../config/productDirectory';

export interface ProductDirectoryProvider {
  getDirectory(): Promise<ProductDirectory>;
}

export const localProductDirectoryProvider: ProductDirectoryProvider = {
  async getDirectory() {
    return localProductDirectory;
  },
};

export function loadProductDirectory(
  provider: ProductDirectoryProvider = localProductDirectoryProvider
): Promise<ProductDirectory> {
  return provider.getDirectory();
}

export function getSafeProductUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' ? parsedUrl.toString() : undefined;
  } catch {
    return undefined;
  }
}
