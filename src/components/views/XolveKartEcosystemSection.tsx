'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Blocks, ExternalLink, LoaderCircle, Network } from 'lucide-react';
import type { EcosystemProduct, ProductDirectory } from '../../config/productDirectory';
import { loadProductDirectory, getSafeProductUrl } from '../../services/productDirectoryService';

const statusLabels: Record<EcosystemProduct['status'], string> = {
  active: 'Active',
  planned: 'Planned',
  'coming-soon': 'Coming soon',
};

export const XolveKartEcosystemSection: React.FC = () => {
  const [directory, setDirectory] = useState<ProductDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    loadProductDirectory()
      .then(result => {
        if (isMounted) setDirectory(result);
      })
      .catch(error => {
        console.error('The XolveKart product directory could not be loaded.', error);
        if (isMounted) setLoadError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  const markImageFailed = (id: string) => {
    setFailedImages(current => ({ ...current, [id]: true }));
  };

  return (
    <section className="about-page-section xolvekart-section" aria-labelledby="xolvekart-title">
      <header className="xolvekart-section__header">
        <div className="xolvekart-section__brand">
          {directory?.brand.logoUrl && !failedImages['xolvekart-brand'] ? (
            <Image
              className="xolvekart-section__brand-logo"
              src={directory.brand.logoUrl}
              alt={`${directory.brand.name} logo`}
              width={1536}
              height={1024}
              unoptimized
              onError={() => markImageFailed('xolvekart-brand')}
            />
          ) : (
            <span className="xolvekart-section__brand-fallback" aria-hidden="true">
              <Network />
            </span>
          )}
          <div>
            <p className="about-page-kicker">Parent brand · {directory?.brand.name || 'XolveKart'}</p>
            <h3 id="xolvekart-title">Part of the {directory?.brand.name || 'XolveKart'} Ecosystem</h3>
          </div>
        </div>
        <p className="xolvekart-section__description">
          {directory?.brand.description
            || 'XolveKart is the parent brand behind XolveManager and other products in its ecosystem.'}
        </p>
      </header>

      <div className="xolvekart-section__directory">
        <div className="xolvekart-section__directory-heading">
          <div>
            <p className="about-page-kicker">Product directory</p>
            <h4>Products in the ecosystem</h4>
          </div>
          {directory?.source === 'local' && (
            <span className="xolvekart-section__source">Local configuration</span>
          )}
        </div>

        {loading && (
          <p className="xolvekart-section__message" role="status">
            <LoaderCircle aria-hidden="true" /> Loading product information…
          </p>
        )}

        {!loading && loadError && (
          <p className="xolvekart-section__message xolvekart-section__message--error" role="alert">
            Product information is currently unavailable. Try again later.
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                setLoading(true);
                setReloadKey(key => key + 1);
              }}
            >
              Retry
            </button>
          </p>
        )}

        {!loading && !loadError && directory?.products.length === 0 && (
          <p className="xolvekart-section__message">No products are listed yet.</p>
        )}

        {!loading && !loadError && directory && directory.products.length > 0 && (
          <div className="xolvekart-products">
            {directory.products.map(product => {
              const productUrl = getSafeProductUrl(product.url);
              const showLogo = Boolean(product.logoUrl) && !failedImages[product.id];
              return (
                <article className="xolvekart-product" key={product.id}>
                  <div className="xolvekart-product__logo" aria-hidden="true">
                    {showLogo && product.logoUrl ? (
                      <Image
                        src={product.logoUrl}
                        alt=""
                        width={44}
                        height={44}
                        unoptimized
                        onError={() => markImageFailed(product.id)}
                      />
                    ) : (
                      <Blocks />
                    )}
                  </div>
                  <div className="xolvekart-product__body">
                    <div className="xolvekart-product__title-row">
                      <h5>{product.name}</h5>
                      <span className={`xolvekart-product__status xolvekart-product__status--${product.status}`}>
                        {statusLabels[product.status]}
                      </span>
                      {product.isCurrentProduct && (
                        <span className="xolvekart-product__current">You’re here</span>
                      )}
                    </div>
                    <p>{product.description}</p>
                    {productUrl && (
                      <a href={productUrl} target="_blank" rel="noreferrer">
                        Visit product <ExternalLink aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <p className="xolvekart-section__note">
        This directory is bundled local configuration, not a shared XolveKart service. Product changes appear here only after this app’s configuration is updated and deployed.
      </p>
    </section>
  );
};
