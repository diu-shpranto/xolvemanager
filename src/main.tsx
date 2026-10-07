import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { productBrand } from './config/brand';
import { registerPwa } from './services/pwaService';
import './index.css';

document.title = productBrand.name;
document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', productBrand.description);
document.querySelector<HTMLMetaElement>('meta[name="application-name"]')?.setAttribute('content', productBrand.name);
document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', productBrand.primaryColor);
document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', productBrand.name);
document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', productBrand.description);
document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', productBrand.faviconUrl);
document.documentElement.style.setProperty('--brand-primary', productBrand.primaryColor);
document.documentElement.style.setProperty('--brand-primary-hover', productBrand.primaryHoverColor);
document.documentElement.style.setProperty('--brand-accent', productBrand.accentColor);
document.documentElement.style.setProperty('--brand-surface', productBrand.surfaceColor);
document.documentElement.style.setProperty('--brand-background', productBrand.backgroundColor);
registerPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
