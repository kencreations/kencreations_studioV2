import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
// IMPORTANT: Update this import path to point to your actual initialized Firebase db instance
import { db } from '../firebase'; 

// Import our original static editors to use as the fallback/offline cache
import { editors as fallbackEditors } from '../data/editors';

export function useGenerators() {
    // 1. Instantly load from local cache on boot for offline support and zero-latency UI
    const [generators, setGenerators] = useState(() => {
        const cachedData = localStorage.getItem('kc_cached_generators');
        return cachedData ? JSON.parse(cachedData) : fallbackEditors;
    });
    
    // Set loading to false initially if we have cached data, so the UI doesn't flicker
    const [isLoading, setIsLoading] = useState(!localStorage.getItem('kc_cached_generators'));

    useEffect(() => {
        let isMounted = true;

        // SAFETY TIMEOUT: Force load after 3 seconds if Firebase is hanging
        const fallbackTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn("Firebase connection timeout. Loading from cache/fallback.");
                setIsLoading(false);
            }
        }, 3000);

        try {
            const generatorsRef = collection(db, 'generators');
            
            const unsubscribe = onSnapshot(
                generatorsRef, 
                (snapshot) => {
                    if (!isMounted) return;
                    clearTimeout(fallbackTimeout); // Connection successful, cancel timeout
                    
                    const liveData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    setGenerators(liveData);
                    localStorage.setItem('kc_cached_generators', JSON.stringify(liveData));
                    setIsLoading(false);
                },
                (error) => {
                    if (!isMounted) return;
                    clearTimeout(fallbackTimeout);
                    console.error("Firebase sync failed:", error.message);
                    setIsLoading(false);
                }
            );

            return () => {
                isMounted = false;
                clearTimeout(fallbackTimeout);
                unsubscribe();
            };
        } catch (error) {
            console.error("Firebase initialization error:", error);
            clearTimeout(fallbackTimeout);
            setIsLoading(false);
        }
    }, []);

    // Helper function to determine what the user has unlocked
    const getAccessibleEditors = (entitlements = []) => {
        return generators.filter((editor) => {
            if (!editor.isExclusive) return true;
            return entitlements.includes(editor.requiredEntitlement || editor.id);
        });
    };

    return { generators, getAccessibleEditors, isLoading };
}
