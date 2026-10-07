import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
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
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div
      className={`brand-lockup brand-lockup--${size} brand-lockup--${tone} ${markOnly ? 'brand-lockup--mark-only' : ''} ${className}`.trim()}
      role="img"
      aria-label={productBrand.name}
      title={productBrand.name}
    >
      <div className="brand-lockup__mark" aria-hidden="true">
        {productBrand.logoUrl && !logoFailed ? (
          <img className="brand-lockup__uploaded-mark" src={productBrand.logoUrl} alt="" onError={() => setLogoFailed(true)} />
        ) : (
          <Building2 className="brand-lockup__icon" />
        )}
      </div>
      {!markOnly && (
        <div className="brand-lockup__copy">
          <span className="brand-lockup__name">{productBrand.name}</span>
          {showTagline && <span className="brand-lockup__tagline">{productBrand.tagline}</span>}
        </div>
      )}
    </div>
  );
};

export const BrandLockup = ProductLogo;
