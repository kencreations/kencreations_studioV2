import { useState } from 'react';
import { normalizeIcon } from '../../engine/bazaar/icons.js';

export default function IconArtwork({ icon, className = 'w-10 h-10' }) {
    const value = normalizeIcon(icon);
    const src = value.thumbnailUrl || value.imageUrl;
    const [failed, setFailed] = useState('');
    return <span className={`${className} inline-flex items-center justify-center shrink-0 overflow-hidden`}>
        {src && failed !== src ? <img src={src} alt={value.name} className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} />
            : <span className="text-xs text-center" title={value.name}>{src ? 'Image unavailable' : value.emoji || value.name}</span>}
    </span>;
}
