import React from 'react';
import Image from 'next/image';
import { productBrand } from '../../config/brand';

interface ProductLogoProps {
  size?: 'compact' | 'large';
  tone?: 'default' | 'inverse';
  className?: string;
  markOnly?: boolean;
  showTagline?: boolean;
}

export const ProductLogo: React.FC<ProductLogoProps> = ({
  size = 'compact',
  tone = 'default',
  className = '',
  markOnly = false,
  showTagline = false,
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
            src={productBrand.iconUrl}
            alt=""
            width={192}
            height={192}
          />
        </span>
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
