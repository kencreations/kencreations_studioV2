import { useState, useEffect } from 'react';
import { colors as hardcodedColors } from '../data/colors';

export function useFilamentBrands() {
  const [brands, setBrands] = useState(hardcodedColors);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch from local DB via IPC on mount
    const fetchBrands = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getAppConfig) {
          const configStr = await window.electronAPI.getAppConfig('filament_brands');
          if (configStr) {
            const parsed = JSON.parse(configStr);
            setBrands(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to load cloud filament brands:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();

    // 2. Listen for background sync updates
    let unsubscribe;
    if (window.electronAPI && window.electronAPI.onFilamentBrandsUpdated) {
      unsubscribe = window.electronAPI.onFilamentBrandsUpdated(() => {
        console.log('Received filament brands update via IPC');
        fetchBrands();
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { brands, loading };
}
