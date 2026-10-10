import { createContext, createElement, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { editors } from '../data/editors';
import { normalizeGenerator } from '../utils/generatorCatalog';

const CatalogContext = createContext();
export function GeneratorProvider({ children }) {
    const [state, setState] = useState({ generators: editors.map(e => normalizeGenerator(e.id, e)), status: 'loading', fromCache: true });
    useEffect(() => {
        let verified = false;
        const timeout = setTimeout(() => {
            if (!verified) setState(previous => ({ ...previous, status: 'error' }));
        }, 10000);
        const stop = onSnapshot(collection(db, 'generators'), { includeMetadataChanges: true }, snapshot => {
            verified = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
            if (verified) clearTimeout(timeout);
            setState({ generators: snapshot.docs.map(d => normalizeGenerator(d.id, d.data())), status: verified ? 'ready' : 'loading', fromCache: !verified });
        }, () => {
            clearTimeout(timeout);
            setState(previous => ({ ...previous, status: 'error' }));
        });
        return () => { clearTimeout(timeout); stop(); };
    }, []);
    return createElement(CatalogContext.Provider, { value: { ...state, isLoading: state.status === 'loading' } }, children);
}
export const useGenerators = () => useContext(CatalogContext);
