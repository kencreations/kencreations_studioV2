const colors = ['#e76f51', '#2a9d8f', '#6b5b95', '#dfae2d', '#457b9d', '#bf5b99'];
const path = shapes => shapes.flatMap(s => [s, ...s.holes]).map(r => `M${r.getPoints().map(p => `${p.x},${-p.y}`).join(' L')} Z`).join(' ');

/** Rendered only when the development query flag typographyDebug=1 is set. */
export default function TypographyDiagnostics({ layout }) {
    if (!layout) return null;
    return <div className="absolute right-3 top-16 w-60 rounded-xl border bg-white/95 p-2 text-xs shadow-lg" data-testid="typography-diagnostics">
        <strong>Glyph contours · mm</strong>
        <svg viewBox="-22 -22 44 44" aria-label="Typography contour diagnostics">
            <circle r={layout.safeRadius} fill="#faf5ed" stroke="#64748b" strokeWidth=".15" strokeDasharray=".6 .6" />
            {layout.glyphs.map(g => {
                const points=g.shapes.flatMap(s=>s.getPoints());
                const x=points.reduce((n,p)=>n+p.x,0)/points.length;
                const y=points.reduce((n,p)=>n+p.y,0)/points.length;
                return <g key={g.index}><path d={path(g.shapes)} fill={colors[g.index%colors.length]} fillRule="evenodd" stroke="#263342" strokeWidth=".07" />
                    <text x={x} y={-y} fontSize="1.4" fill="white" textAnchor="middle">{g.index+1}:{g.char}</text></g>;
            })}
            {(layout.collisions||[]).map((c,i)=><path key={i} d={path(c.shapes)} fill="#ff0000" fillRule="evenodd" />)}
            <path d="M-1 0 H1 M0 -1 V1" stroke="#222" strokeWidth=".15" />
        </svg>
        <p>Ink area: {(layout.coverage*100).toFixed(1)}% · rows: {layout.rows.join(' / ')}</p>
        <p>Red marks overlapping clearance envelopes.</p>
    </div>;
}
