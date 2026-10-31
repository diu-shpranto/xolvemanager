import type { MetadataRoute } from 'next';
import { INDEXABLE_PUBLIC_PATHS, getCanonicalUrl } from '../src/config/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PUBLIC_PATHS.map(path => ({ url: getCanonicalUrl(path) }));
}
