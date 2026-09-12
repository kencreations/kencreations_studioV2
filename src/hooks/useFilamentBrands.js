import { useState, useEffect } from 'react';
import { colors as hardcodedColors } from '../data/colors';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useFilamentBrands() {
  const [brands, setBrands] = useState(hardcodedColors);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'app_config', 'filament_brands'),
      (docSnap) => {
        if (docSnap.exists()) {
          const configStr = docSnap.data().data; // Assuming it's stored under a 'data' field, or maybe it's stored directly? Let's check.
          try {
            const docData = docSnap.data();
            // The document is stored as a JSON string under a "data" field
            if (docData && typeof docData.data === 'string') {
                setBrands(JSON.parse(docData.data));
            } else if (docData && docData.value && typeof docData.value === 'string') {
                setBrands(JSON.parse(docData.value));
            } else {
                // If it's already an object
                const { ...brandsObj } = docData;
                setBrands(brandsObj);
            }
          } catch (e) {
            console.error('Failed to parse filament brands', e);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error('Failed to listen to filament brands:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return { brands, loading };
}
