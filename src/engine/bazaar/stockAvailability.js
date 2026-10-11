// Allocations are cumulative units sent to an event. Consumption is cumulative.
// Global allocated stock counts only unconsumed units (including reservations).
export function stockAvailability(stock = {}, allocation = null, key = '') {
    const physical = Number(stock.on_hand ?? stock.physical_on_hand ?? 0);
    const workshopReserved = Number(stock.reserved || 0);
    const allocatedElsewhereAndHere = Number(stock.total_allocated_to_events || 0);
    const allocated = Number(allocation?.allocations?.[key] || 0);
    const reserved = Number(allocation?.reservations?.[key] || 0);
    const consumed = Number(allocation?.consumed?.[key] || 0);
    const workshopAvailable = physical - workshopReserved - allocatedElsewhereAndHere;
    const eventAvailable = allocated - reserved - consumed;
    const valid = [physical,workshopReserved,allocatedElsewhereAndHere,allocated,reserved,consumed].every(n=>Number.isSafeInteger(n) && n>=0)
        && workshopAvailable >= 0 && eventAvailable >= 0 && (!allocation || allocatedElsewhereAndHere >= allocated-consumed);
    return { physical,workshopReserved,allocatedElsewhereAndHere,allocated,reserved,consumed,workshopAvailable,eventAvailable,available:allocation ? eventAvailable : workshopAvailable,valid };
}

export function stockReadiness(requirements, inventory, allocation = null) {
    const map = new Map(inventory.map(item=>[item.item_key || item.id,item]));
    const combined = new Map();
    for(const part of requirements) {
        const previous=combined.get(part.component_key);
        combined.set(part.component_key,{...part,required_qty:(previous?.required_qty || 0)+part.required_qty});
    }
    const components=[...combined.values()].map(part=>{
        const stock=map.get(part.component_key),state=stockAvailability(stock,allocation,part.component_key);
        return {...part,...state,exists:!!stock,sufficient:!!stock && state.valid && state.available>=part.required_qty};
    });
    const missing=components.filter(c=>!c.sufficient);
    const capacity=components.length?Math.min(...components.map(c=>c.valid?Math.floor(c.available/c.required_qty):0)):0;
    const status=components.some(c=>!c.exists || !c.valid) || !components.length ? 'Missing Components'
        : allocation && components.every(c=>c.allocated===0) ? 'Not Allocated'
        : missing.length ? 'Missing Components' : capacity<=2 ? 'Limited Stock' : 'Ready to Sell';
    return {status,components,capacity,ready:!missing.length && components.length>0};
}
