'use client';

import { useEffect, useState } from 'react';

import { consumeReferralAuthNotice } from '@/lib/referral-client';

export default function ReferralAuthNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextMessage = consumeReferralAuthNotice();
    if (!nextMessage) {
      return;
    }

    setMessage(nextMessage);
    const timer = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!message) {
    return null;
  }

  return (
    <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 sm:mb-4">
      {message}
    </div>
  );
}
