import { useState } from 'react';

/** Older draft-only records can be prepared here without leaving administration. */
export default function PrepareSchoolBrand({ partnerId, revision }: { partnerId: string; revision: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin-schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare', partnerId, revision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Unable to prepare this school. Please try again.');
      window.location.reload();
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
    <h2 className="text-lg font-bold">Continue setting up this school</h2>
    <p className="mt-2 max-w-2xl text-gray-600">This older school has a saved draft. Prepare its workspace to add logos and imagery here. Its existing content stays attached, and its pages remain private.</p>
    <button type="button" disabled={busy} onClick={prepare} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-ink px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Preparing…' : 'Prepare workspace and add branding'}</button>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
  </div>;
}
