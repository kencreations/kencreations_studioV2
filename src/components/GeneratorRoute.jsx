import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccess } from '../contexts/AccessContext';
import { useAuth } from '../contexts/AuthContext';
import { useGenerators } from '../hooks/useGenerators';
import ActivateLicenseModal from './UI/ActivateLicenseModal';
import PricingModal from './UI/PricingModal';

export default function GeneratorRoute({ children }) {
    const { pathname } = useLocation();
    const { generators, status } = useGenerators();
    const { evaluate } = useAccess();
    const { currentUser, loginWithGoogle } = useAuth();
    const [activate, setActivate] = useState(false);
    const [pricing, setPricing] = useState(false);
    const [error, setError] = useState('');
    const generator = generators.find(g => g.link === pathname);
    const access = evaluate(generator);
    const state = status === 'ready' || window.electronAPI ? access.state : status;
    if (state === 'authorized') return children;
    const message = state === 'loading' ? 'Verifying generator access…'
        : state === 'error' ? 'We could not verify access. Check your connection and try again.'
        : access.reason === 'UNAVAILABLE' ? 'This generator is currently unavailable.'
        : 'An active VIP license or this generator’s entitlement is required.';
    return <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p role="status">{message}</p>
        {error && <p role="alert">{error}</p>}
        {state === 'unauthorized' && access.reason !== 'UNAVAILABLE' && <>
            {!currentUser && !window.electronAPI && <button onClick={() => loginWithGoogle().catch(() => setError('Sign-in failed. Please try again.'))}>Sign in</button>}
            {currentUser && <button onClick={() => setActivate(true)}>Activate license</button>}
            <button onClick={() => setPricing(true)}>View license options</button>
        </>}
        {state === 'error' && <button onClick={() => window.location.reload()}>Retry verification</button>}
        <Link to="/" className="text-teal-600 underline">Back to Studio</Link>
        <ActivateLicenseModal isOpen={activate} onClose={() => setActivate(false)} />
        <PricingModal isOpen={pricing} onClose={() => setPricing(false)} />
    </div>;
}
