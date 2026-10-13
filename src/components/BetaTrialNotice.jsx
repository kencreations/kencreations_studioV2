import { useEffect, useState } from 'react';
import { useAccess } from '../contexts/AccessContext';
import { formatBetaDeadline, formatBetaRemaining, betaExpiryMillis } from '../utils/betaTrialPolicy';

export default function BetaTrialNotice() {
    const { betaTrial, endedBetaTrial, tier } = useAccess();
    const [now, setNow] = useState(Date.now);
    const trial = betaTrial || endedBetaTrial;
    useEffect(() => {
        if (!trial) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [trial]);
    if (!trial) return null;
    const expired = now >= betaExpiryMillis(trial);
    const active = !!betaTrial && !expired;
    return <aside className="border-b border-teal-200 bg-teal-50 px-4 py-2 text-center text-sm text-teal-950" role="status">
        {active ? <><strong>Pro · Beta Trial</strong> — temporary access. Ends {formatBetaDeadline(trial)} · {formatBetaRemaining(trial, now)}.</>
            : <>Your Pro beta trial {expired ? 'has ended' : 'is no longer active'}. Thank you for testing! Your other valid licenses and purchased generators remain available. Current tier: <strong>{tier === 'pro_plus' ? 'Pro+' : tier.toUpperCase()}</strong>.</>}
    </aside>;
}
