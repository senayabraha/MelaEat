'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App.jsx'), { ssr: false });

export default function CatchAllPage() {
  return <App />;
}
