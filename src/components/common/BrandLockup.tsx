import React from 'react';
import Image from 'next/image';
import { productBrand } from '../../config/brand';

interface ProductLogoProps {
  size?: 'compact' | 'large';
  tone?: 'default' | 'inverse';
  className?: string;
  markOnly?: boolean;
  markSrc?: string;
  showTagline?: boolean;
  // 'stacked' renders the owner's original artwork as one image (icon
  // above the "XolveManager" text) instead of the rebuilt horizontal
  // wordmark. Only the auth pages use it; everything else keeps the
  // horizontal wordmark.
  layout?: 'horizontal' | 'stacked';
}

export const ProductLogo: React.FC<ProductLogoProps> = ({
  size = 'compact',
  tone = 'default',
  className = '',
  markOnly = false,
  markSrc,
  showTagline = false,
  layout = 'horizontal',
}) => {
  return (
    <div
      className={`brand-lockup brand-lockup--${size} brand-lockup--${tone} ${markOnly ? 'brand-lockup--mark-only' : ''} ${className}`.trim()}
      role="img"
      aria-label={productBrand.name}
      title={productBrand.name}
    >
      {markOnly ? (
        <span className="brand-lockup__mark" aria-hidden="true">
          <Image
            className="brand-lockup__uploaded-mark"
            src={markSrc ?? productBrand.iconUrl}
            alt=""
            width={192}
            height={192}
            sizes="(max-width: 768px) 32px, 48px"
            priority
            unoptimized
            loading="eager"
          />
        </span>
      ) : layout === 'stacked' ? (
        <div className="brand-lockup__copy">
          <Image
            className="brand-lockup__stacked"
            src={productBrand.stackedLogoUrl}
            alt=""
            width={1252}
            height={742}
            priority
          />
          {showTagline && <span className="brand-lockup__tagline">{productBrand.tagline}</span>}
        </div>
      ) : (
        <div className="brand-lockup__copy">
          <Image
            className="brand-lockup__wordmark"
            src={tone === 'inverse' ? productBrand.wordmarkDarkUrl : productBrand.wordmarkLightUrl}
            alt=""
            width={1080}
            height={200}
          />
          {showTagline && <span className="brand-lockup__tagline">{productBrand.tagline}</span>}
        </div>
      )}
    </div>
  );
};

export const BrandLockup = ProductLogo;
