// Subscription coordinator, independent of React and Firebase for race tests.
export function observeAccount(adapter, publish) {
    let generation = 0;
    let cleanups = [];
    const reset = () => { generation++; cleanups.forEach(stop => stop()); cleanups = []; };
    const stopAuth = adapter.auth(user => {
        reset();
        const epoch = generation;
        let state = { currentUser: user, userData: null, licenses: [], claims: {}, developerPreview: false, status: user ? 'loading' : 'ready', error: null };
        let timeout;
        const emit = patch => {
            if (generation !== epoch) return;
            state = { ...state, ...patch };
            publish(state);
        };
        emit({});
        if (!user) return;
        timeout = setTimeout(() => emit({ licenses: [], status: 'error', error: new Error('License verification timed out.') }), 10000);
        cleanups.push(() => clearTimeout(timeout));
        cleanups.push(adapter.profile(user.uid, data => emit({ userData: data }), () => emit({ userData: null })));
        cleanups.push(adapter.licenses(user.uid,
            (licenses, verified) => {
                if (generation !== epoch) return;
                clearTimeout(timeout);
                if (!verified) timeout = setTimeout(() => emit({ licenses: [], status: 'error', error: new Error('License verification timed out.') }), 10000);
                emit({ licenses: verified ? licenses : [], status: verified ? 'ready' : 'loading', error: null });
            },
            error => { clearTimeout(timeout); emit({ licenses: [], status: 'error', error }); }));
        if (adapter.claims) {
            cleanups.push(adapter.claims(user,
                claims => {
                    if (generation !== epoch) return;
                    emit({
                        claims: claims || {},
                        developerPreview: claims?.developerPreview === true,
                    });
                },
                () => {
                    if (generation !== epoch) return;
                    emit({ claims: {}, developerPreview: false });
                }
            ));
        }
    }, error => { reset(); publish({ currentUser: null, userData: null, licenses: [], claims: {}, developerPreview: false, status: 'error', error }); });
    return () => { reset(); stopAuth(); };
}

