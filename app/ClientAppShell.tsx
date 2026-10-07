'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen place-items-center text-sm text-slate-500" role="status">
      Loading XolveManager…
    </div>
  ),
});

export default function ClientAppShell() {
  return <App />;
}
