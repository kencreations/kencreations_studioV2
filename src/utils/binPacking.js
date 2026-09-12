/**
 * binPacking.js — Shelf-first-fit-decreasing 2D bin packing.
 *
 * Packs a list of rectangular items onto one or more build plates,
 * respecting usable dimensions, item spacing, and exclusion zones.
 *
 * Algorithm: Shelf First-Fit Decreasing (SFFD)
 *   1. Sort items by height (depth) descending.
 *   2. For each item, try to place it on the current shelf.
 *   3. If it doesn't fit (width overflows), try rotation (swap w/d).
 *   4. If it still doesn't fit, open a new shelf.
 *   5. If the new shelf exceeds usable depth, open a new plate.
 *
 * Exclusion zones are treated as "occupied" rectangles that items
 * cannot overlap. The algorithm checks every candidate placement
 * against all zones before committing.
 *
 * All units are in millimeters. Origin is bottom-left of the plate.
 */

/**
 * @typedef {Object} PackItem
 * @property {string|number} id   — unique identifier
 * @property {string} text        — display label
 * @property {number} width       — item width (mm)
 * @property {number} depth       — item depth/height (mm)
 * @property {number} [qty]       — quantity (each instance is packed individually)
 */

/**
 * @typedef {Object} ExclusionZone
 * @property {number} x      — left edge (mm, from plate origin)
 * @property {number} y      — bottom edge (mm, from plate origin)
 * @property {number} width  — zone width (mm)
 * @property {number} depth  — zone depth (mm)
 */

/**
 * @typedef {Object} PackedItem
 * @property {string|number} id
 * @property {string} text
 * @property {number} width       — final width after possible rotation
 * @property {number} depth       — final depth after possible rotation
 * @property {number} x           — placement X (mm, bottom-left corner)
 * @property {number} y           — placement Y (mm, bottom-left corner)
 * @property {number} rotation    — 0 or Math.PI/2 (radians)
 * @property {number} plateNumber — 1-indexed plate number
 */

/**
 * Check if a rectangle overlaps any exclusion zone.
 * @param {number} rx - rect left
 * @param {number} ry - rect bottom
 * @param {number} rw - rect width
 * @param {number} rd - rect depth
 * @param {ExclusionZone[]} zones
 * @returns {boolean} true if overlapping
 */
function overlapsExclusion(rx, ry, rw, rd, zones) {
    for (const zone of zones) {
        const zRight = zone.x + zone.width;
        const zTop = zone.y + zone.depth;
        const rRight = rx + rw;
        const rTop = ry + rd;

        // Standard AABB overlap test
        if (rx < zRight && rRight > zone.x && ry < zTop && rTop > zone.y) {
            return true;
        }
    }
    return false;
}

/**
 * Pack items onto plates using a shelf-first-fit-decreasing heuristic.
 *
 * @param {Object} options
 * @param {number} options.usableWidth   — plate usable width (mm)
 * @param {number} options.usableDepth   — plate usable depth (mm)
 * @param {number} [options.spacing=5]   — gap between items (mm)
 * @param {PackItem[]} options.items     — items to pack
 * @param {ExclusionZone[]} [options.exclusionZones=[]] — forbidden areas
 * @returns {{ packed: PackedItem[], plateCount: number }}
 */
export function packItems({
    usableWidth,
    usableDepth,
    spacing = 5,
    items,
    exclusionZones = [],
}) {
    if (!items || items.length === 0) {
        return { packed: [], plateCount: 0 };
    }

    const expanded = [];
    for (const item of items) {
        const qty = item.qty || 1;
        for (let q = 0; q < qty; q++) {
            expanded.push({
                id: item.id,
                text: item.text,
                origWidth: item.width,
                origDepth: item.depth,
                instanceIndex: q,
            });
        }
    }

    // Sort by height (depth) descending for better packing
    expanded.sort((a, b) => b.origDepth - a.origDepth);

    const packed = [];
    const MARGIN = 15;
    let currentX = MARGIN;
    let currentY = MARGIN;
    let rowHeight = 0;
    let currentPlate = 0;
    const gap = Number(spacing) || 5;
    const verticalGap = gap * 2; // Extra padding to account for keyrings

    const packedItems = expanded.map(item => {
        const itemWidth = item.origWidth;
        const itemHeight = item.origDepth;

        // 1. Check Row Wrap
        if (currentX + itemWidth > usableWidth - MARGIN) {
            currentX = MARGIN;
            currentY += rowHeight + verticalGap;
            rowHeight = 0; // reset for new row
        }

        // 2. Check Plate Wrap
        if (currentY + itemHeight > usableDepth - MARGIN) {
            currentPlate++;
            currentX = MARGIN;
            currentY = MARGIN;
            rowHeight = 0;
        }

        // 3. Assign 2D Coordinates (Top-Left Origin)
        const placedItem = {
            id: item.id,
            text: item.text,
            width: itemWidth,
            height: itemHeight,
            depth: itemHeight,
            x: currentX,
            y: currentY,
            rotation: 0,
            plateIndex: currentPlate,
            plateNumber: currentPlate + 1,
            instanceIndex: item.instanceIndex,
        };

        // 4. Advance X and track max row height
        currentX += itemWidth + gap;
        rowHeight = Math.max(rowHeight, itemHeight);

        return placedItem;
    });

    // POST-PROCESSING: Center the clusters per plate
    for (let p = 0; p <= currentPlate; p++) {
        const plateItems = packedItems.filter(i => i.plateIndex === p);
        if (plateItems.length === 0) continue;
        
        // Find the boundary of the packed cluster
        const maxRight = Math.max(...plateItems.map(i => i.x + i.width));
        const maxBottom = Math.max(...plateItems.map(i => i.y + i.height));
        
        // Calculate the empty space and divide by 2 to get the shift amount
        const shiftX = (usableWidth - maxRight) / 2;
        const shiftY = (usableDepth - maxBottom) / 2;
        
        // Shift all items on this plate
        plateItems.forEach(i => {
            i.x += shiftX;
            i.y += Math.max(0, shiftY); // Prevent shifting up into the negative margin
        });
    }

    packed.push(...packedItems);

    return {
        packed,
        plateCount: currentPlate,
    };
}

/**
 * Estimate the bounding box of a keychain item based on text length
 * and editor config. Uses a rough heuristic: each character is
 * approximately (fontSize × 0.75) wide, plus base padding on all sides.
 *
 * @param {string} text
 * @param {Object} editorConfig — the keychain config object
 * @returns {{ width: number, depth: number }}
 */
export function estimateKeychainSize(text, editorConfig) {
    const fontSize = editorConfig.texts?.[0]?.size || 20;
    const basePadding = editorConfig.base?.padding || 4;
    const baseThickness = editorConfig.base?.thickness || 3;
    
    // Add keyring allowance
    const keyringOffset = editorConfig.keyring?.enabled ? (editorConfig.keyring?.diameter || 10) : 0;

    // Heuristic: average character width ≈ 75% of font size
    const estimatedWidth = (text.length * (fontSize * 0.75)) + (basePadding * 2) + keyringOffset;
    const estimatedDepth = fontSize + (basePadding * 2);

    return {
        width: Math.max(estimatedWidth, 15), // minimum 15mm
        depth: Math.max(estimatedDepth, 10),  // minimum 10mm
    };
}
