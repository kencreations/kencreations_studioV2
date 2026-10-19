export const POD_DEFAULTS = Object.freeze({
    preset: 'provisional', diameter: 16, length: 65, exposure: 8,
    fitClearance: 0.35, axialClearance: 1, wall: 2, floor: 2,
    threadClearance: 0.3, threadLength: 5, loopClearance: 0.25,
    armThickness: 1.2, holeDiameter: 4.5,
    personalized: false, text: 'MY POD', font: 'BebasNeue', textStyle: 'engraved', textDepth: 0.6,
    bodyColor: '#C6D8AC', capColor: '#D9B6DB', loopColor: '#D89DB1', textColor: '#FFFFFF',
    viewMode: 'assembled', printMode: 'kit', showReference: true,
});
export const POD_LIMITS = Object.freeze({
    diameter: [12,30], length: [45,100], exposure: [8,20], fitClearance: [0.15,0.8],
    axialClearance: [0.5,3], wall: [1.6,3.2], floor: [1.6,3.2],
    threadClearance: [0.15,0.6], threadLength: [4,8], loopClearance: [0.15,0.4],
    armThickness: [1,1.6], holeDiameter: [3,6], textDepth: [0.3,1],
});
export function podConfig(input = {}) {
    const c = {...POD_DEFAULTS, ...input};
    for (const [key,[min,max]] of Object.entries(POD_LIMITS)) {
        const value = Number(c[key]); c[key] = Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : POD_DEFAULTS[key];
    }
    c.text = String(c.text ?? '').slice(0,32);
    c.printMode = ['kit','body','cap','loop','fitTest'].includes(c.printMode) ? c.printMode : 'kit';
    c.viewMode = c.viewMode === 'exploded' ? 'exploded' : 'assembled';
    c.textStyle = c.textStyle === 'embossed' ? 'embossed' : 'engraved';
    // Pickup is deliberately not a configurable or template-enabled feature.
    c.pickupEnabled = false; c.physicallyVerified = false;
    return c;
}
