export const ICON_MAX_BYTES = 2 * 1024 * 1024;
export const ICON_MAX_DIMENSION = 2048;
export function validateIconHeader(bytes, mime) {
    if (!bytes.length || bytes.length > ICON_MAX_BYTES) throw new Error('Choose an image no larger than 2 MB.');
    const matches = (signature, offset = 0) => signature.every((n,i) => bytes[offset+i] === n);
    if (mime === 'image/png' && matches([137,80,78,71,13,10,26,10])) return;
    if (mime === 'image/webp' && matches([82,73,70,70]) && matches([87,69,66,80],8)) return;
    if (mime === 'image/svg+xml') return; // XML is checked with a strict allowlist before decoding.
    throw new Error('Choose a valid PNG, WebP, or SVG image; the file contents must match its type.');
}
export function sanitizeIconSvg(text) {
    if (/<!DOCTYPE|<!ENTITY|<\?/i.test(text.replace(/^\s*<\?xml[^?]*\?>/i,''))) throw new Error('SVG declarations and entities are not supported.');
    const document = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (document.getElementsByTagName('parsererror').length || document.documentElement.localName !== 'svg') throw new Error('Invalid SVG image.');
    const elements = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','linearGradient','radialGradient','stop','clipPath','title','desc']);
    const attributes = new Set(['xmlns','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-opacity','opacity','transform','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','fx','fy','clip-path']);
    const nodes = [...document.getElementsByTagName('*')];
    if (nodes.length > 5000) throw new Error('SVG is too complex. Use a PNG or WebP export.');
    for (const node of nodes) {
        if (!elements.has(node.localName) || (node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/2000/svg')) throw new Error('SVG contains unsupported or active content. Export it as PNG or WebP.');
        for (const attribute of [...node.attributes]) {
            if (!attributes.has(attribute.name)) throw new Error(`Unsupported SVG attribute: ${attribute.name}. Export as PNG or WebP.`);
            if (attribute.name !== 'xmlns' && /(?:https?:|data:|javascript:|\/\/|@import|expression|\\)/i.test(attribute.value)) throw new Error('SVG external resources are not allowed.');
            if (/url\(/i.test(attribute.value) && !/^url\(#[a-zA-Z][\w-]*\)$/.test(attribute.value)) throw new Error('SVG must use local paint references only.');
        }
    }
    return new XMLSerializer().serializeToString(document.documentElement);
}
// Always rasterize; never store or inject uploaded SVG markup in the application.
export async function prepareIconUpload(file) {
    validateIconHeader(new Uint8Array(await file.arrayBuffer()), file.type);
    const source = file.type === 'image/svg+xml' ? new Blob([sanitizeIconSvg(await file.text())], {type:'image/svg+xml'}) : file;
    const url = URL.createObjectURL(source);
    try {
        const image = new Image(); image.src = url;
        await image.decode();
        if (!image.naturalWidth || !image.naturalHeight || Math.max(image.naturalWidth,image.naturalHeight) > ICON_MAX_DIMENSION) throw new Error('Image dimensions must be between 1 and 2048 pixels.');
        const canvas = document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
        canvas.getContext('2d').drawImage(image,0,0);
        const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
        if (!blob || blob.size > ICON_MAX_BYTES) throw new Error('Processed image exceeds 2 MB. Reduce the dimensions.');
        return {blob, width:canvas.width, height:canvas.height};
    } finally { URL.revokeObjectURL(url); }
}
