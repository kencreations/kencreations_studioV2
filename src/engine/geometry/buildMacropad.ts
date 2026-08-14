// src/engine/geometry/buildMacropad.ts
import type { MacropadBuildParams, ClickerPart, RGB, SwitchPlacement } from '../types';

type Wasm = any;
type Solid = any;
type Section = any;

export function buildMacropad(
  wasm: Wasm,
  socket: Solid,
  stem: Solid,
  params: MacropadBuildParams
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const { Manifold, CrossSection } = wasm;
  const trash: { delete(): void }[] = [];
  const track = <T extends { delete(): void }>(o: T): T => {
    trash.push(o);
    return o;
  };

  const warnings: string[] = [];
  const parts: ClickerPart[] = [];
  
  const toPart = (solid: Solid, name: string, colorRgb: RGB): ClickerPart => {
    const mesh = solid.getMesh();
    return {
      kind: 'body',
      group: 'body',
      colorRgb: colorRgb,
      name,
      numProp: mesh.numProp,
      vertProperties: new Float32Array(mesh.vertProperties),
      triVerts: new Uint32Array(mesh.triVerts),
    } as ClickerPart;
  };

  // Switch placements
  const placements: SwitchPlacement[] = [];
  const { rows, columns, pitchX, pitchY } = params;
  
  const totalW = (columns - 1) * pitchX;
  const totalH = (rows - 1) * pitchY;
  const startX = -totalW / 2;
  const startY = -totalH / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      placements.push({
        x: startX + c * pitchX,
        y: startY + r * pitchY,
        rotation: 0
      });
    }
  }

  const socketBB = socket.boundingBox();
  const cavityFloorZ = socketBB.max[2];
  const bodyBottomZ = socketBB.min[2] - params.floorThickness;
  const bodyTopZ = cavityFloorZ; // Top is flush with the switch socket top

  // Helpers
  const roundedRect = (w: number, h: number, r: number) => {
    return track(CrossSection.square([w, h], true).offset(-r, 'Round', 0.5, 32).offset(r, 'Round', 2.0, 32));
  };
  const makeHexagon = (rr: number) => track(CrossSection.circle(rr, 6).rotate(30));
  const makeCircle = (rr: number) => track(CrossSection.circle(rr, 32));

  let footprint: Section;
  const margin = Math.max(1.0, params.margin);
  
  if (params.style === 'joined') {
    // A shape around each switch
    const rr = Math.min(pitchX, pitchY) / 2 + margin;
    let baseFn: () => Section;
    
    switch (params.baseShape) {
      case 'hexagon': baseFn = () => makeHexagon(rr); break;
      case 'circle':  baseFn = () => makeCircle(rr); break;
      case 'square':  baseFn = () => roundedRect(rr * 2, rr * 2, rr * 0.22); break;
      default:        baseFn = () => roundedRect(rr * 2, rr * 2, Math.max(1, rr * 0.4)); break;
    }

    let union: Section | null = null;
    for (const p of placements) {
      const moved = track(baseFn().translate([p.x, p.y]));
      union = union ? track(union.add(moved)) : moved;
    }
    footprint = union!;
  } else {
    // Unified bounding box
    const outerW = totalW + pitchX + 2 * margin; 
    const outerH = totalH + pitchY + 2 * margin;
    const cornerR = Math.max(1, Math.min(outerW, outerH) * 0.2);
    
    if (params.baseShape === 'scalloped') {
      footprint = roundedRect(outerW, outerH, cornerR);
      // Create scallops by subtracting small circles along the perimeter
      // To be properly implemented based on perimeter points, but for now fallback to rect
    } else {
      footprint = roundedRect(outerW, outerH, cornerR);
    }
  }

  // Get exact bounding box of the footprint for keychain placement
  const fpBounds = footprint.bounds();
  const minX = fpBounds.min[0];
  const maxX = fpBounds.max[0];
  const minY = fpBounds.min[1];
  const maxY = fpBounds.max[1];
  const fpCenterY = (minY + maxY) / 2;
  warnings.push(`Footprint: bounds [${minX}, ${minY}] to [${maxX}, ${maxY}], bodyZ: ${bodyBottomZ} to ${bodyTopZ}`);

  let body = track(Manifold.extrude(footprint, Math.max(0.01, bodyTopZ - bodyBottomZ)).translate([0, 0, bodyBottomZ]));
  warnings.push(`Extruded body isEmpty: ${body.isEmpty()}`);

  // Patterns
  if (params.sidePattern !== 'none') {
    // Generate a subtractive pattern around the side walls
    const pBounds = body.boundingBox();
    let cutter: Solid | null = null;
    const ribRadius = 1.0;
    const spacing = 3.0;

    if (params.sidePattern === 'ribbed') {
      const rib = track(Manifold.cylinder(bodyTopZ - bodyBottomZ, ribRadius).translate([0, 0, bodyBottomZ]));
      // We'll just scatter ribs along X and Y boundaries for now
      // This is a simplified ribbed pattern that cuts into the box
      for (let x = pBounds.min[0]; x <= pBounds.max[0]; x += spacing) {
        const r1 = track(rib.translate([x, pBounds.min[1], 0]));
        const r2 = track(rib.translate([x, pBounds.max[1], 0]));
        cutter = cutter ? track(cutter.add(r1)).add(r2) : track(r1.add(r2));
      }
      for (let y = pBounds.min[1]; y <= pBounds.max[1]; y += spacing) {
        const r1 = track(rib.translate([pBounds.min[0], y, 0]));
        const r2 = track(rib.translate([pBounds.max[0], y, 0]));
        cutter = cutter ? track(cutter.add(r1)).add(r2) : track(r1.add(r2));
      }
      if (cutter) {
        body = track(body.subtract(cutter));
      }
    }
  }

  // Keychain
  const kc = params.keychain;
  if (kc && kc.enabled) {
    const holeR = Math.max(1.5, (kc.holeDiameterMm ?? 5.2) / 2);
    const th = bodyTopZ - bodyBottomZ;
    // Place loop on the left side (minX)
    const loopExt = holeR + 3.0;
    const loopX = minX - loopExt / 2 + (kc.offsetMm ?? 0);
    const loopY = fpCenterY;
    
    let kcBody = track(Manifold.cylinder(th, loopExt).translate([loopX, loopY, bodyBottomZ]));
    let kcBridge = track(Manifold.cube([loopExt, loopExt * 2, th], true).translate([loopX + loopExt / 2, loopY, bodyBottomZ + th/2]));
    
    kcBody = track(kcBody.add(kcBridge));
    const hole = track(Manifold.cylinder(th + 2, holeR).translate([loopX, loopY, bodyBottomZ - 1]));
    kcBody = track(kcBody.subtract(hole));
    
    body = track(body.add(kcBody));
  }
  warnings.push(`Keychain added. body isEmpty: ${body.isEmpty()}`);
  
  // Socket Cut
  for (const p of placements) {
    let s = socket;
    if (Math.abs(p.x) > 0.001 || Math.abs(p.y) > 0.001) {
      s = track(s.translate([p.x, p.y, 0]));
    }
    body = track(body.subtract(s));
  }
  
  warnings.push(`Sockets cut. Final body isEmpty: ${body.isEmpty()}`);
  
  if (body.isEmpty()) {
    warnings.push("Warning: Final body mesh is empty! Check parameters or extrude dimensions.");
  }
  parts.push(toPart(body, 'macropad-body', params.bodyColorRgb));

  trash.forEach((o) => o.delete());
  return { parts, switchPlacements: placements, warnings };
}
