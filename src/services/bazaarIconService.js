import { auth } from '../firebase.js';
import { bazaarApiUrl } from './orderSubmissionService.js';
import { bazaarOperation } from './bazaarDiagnostics.js';

// Adapter contract only: no upload backend has been provisioned or deployed.
async function call(method, id = '', body) {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in to manage your icon library.');
    const token = await user.getIdToken();
    return bazaarOperation('icon-library', 'seller/icons/{id}', async () => {
        const response = await fetch(`${bazaarApiUrl()}/icons${id ? '/' + encodeURIComponent(id) : ''}`, {
            method, headers: { Authorization:`Bearer ${token}`, ...(body instanceof FormData ? {} : {'Content-Type':'application/json'}) },
            body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not update the icon library.');
        return data;
    });
}
export const listSellerIcons = () => call('GET');
export const updateSellerIcon = (id, changes) => call('PATCH', id, changes);
export const uploadSellerIcon = (image, name) => {
    const data = new FormData(); data.append('image', image.blob, 'icon.png'); data.append('name',name.trim());
    return call('POST','',data);
};
