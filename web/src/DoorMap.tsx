import { scaleLinear } from "d3-scale";
import { COUNTY_AREAS, POSTCODE_GRID, euro, shortArea } from "./data";

export type AreaStat = { median: number | null; count: number };

export type RentColor = (rent: number) => string;

// One hue, light to dark, stretched over the medians currently on screen.
export function makeRentColor(medians: number[]): RentColor {
  const lo = Math.min(...medians), hi = Math.max(...medians);
  return scaleLinear<string>()
    .domain(medians.length ? [lo, (lo + hi) / 2, hi] : [0, 1, 2])
    .range(["#d5e6e3", "#5e98a0", "#123f4a"])
    .clamp(true);
}

export const RAMP_GRADIENT = "linear-gradient(90deg, #d5e6e3, #5e98a0, #123f4a)";

function DoorArt({ fill, lit, empty }: { fill: string; lit: boolean; empty: boolean }) {
  const spokes = [-60, -30, 0, 30, 60];
  return (
    <svg viewBox="0 0 60 96" aria-hidden="true">
      <path className="door-body" d="M6 90V34a24 24 0 0 1 48 0v56z"
        fill={empty ? "none" : fill} opacity={lit || empty ? 1 : 0.3}
        stroke="var(--door-stroke)" strokeWidth="2.2" strokeDasharray={empty ? "4 3" : undefined} />
      {!empty && (
        <>
          <path className="fanlight" d="M13 34a17 17 0 0 1 34 0z"
            fill={lit ? "var(--lamp)" : "rgb(22 32 42 / 0.35)"} stroke="var(--door-stroke)" strokeWidth="1.6" />
          {spokes.map(a => (
            <line key={a} x1="30" y1="34" x2={30 + 17 * Math.sin((a * Math.PI) / 180)} y2={34 - 17 * Math.cos((a * Math.PI) / 180)}
              stroke="var(--door-stroke)" strokeWidth="1.1" />
          ))}
          <rect x="15" y="44" width="12" height="18" rx="1.5" fill="none" stroke="var(--door-stroke)" strokeWidth="1.2" opacity="0.55" />
          <rect x="33" y="44" width="12" height="18" rx="1.5" fill="none" stroke="var(--door-stroke)" strokeWidth="1.2" opacity="0.55" />
          <rect x="15" y="68" width="12" height="16" rx="1.5" fill="none" stroke="var(--door-stroke)" strokeWidth="1.2" opacity="0.55" />
          <rect x="33" y="68" width="12" height="16" rx="1.5" fill="none" stroke="var(--door-stroke)" strokeWidth="1.2" opacity="0.55" />
          <circle cx="30" cy="64" r="2.2" fill="var(--lamp)" stroke="var(--door-stroke)" strokeWidth="1" />
        </>
      )}
      <rect x="2" y="90" width="56" height="5" rx="1.5" fill="var(--rule)" />
    </svg>
  );
}

export default function DoorMap({ stats, color, budget, selected, onSelect }: {
  stats: Map<string, AreaStat>;
  color: RentColor;
  budget: number;
  selected: string | null;
  onSelect: (area: string) => void;
}) {
  const describe = (area: string) => {
    const s = stats.get(area);
    if (!s || s.median === null) return { label: "no listings", lit: false, empty: true, fill: "none" };
    return {
      label: euro(s.median),
      lit: s.median <= budget,
      empty: false,
      fill: color(s.median),
    };
  };

  const county = (area: string) => {
    const d = describe(area);
    const count = stats.get(area)?.count ?? 0;
    return (
      <button type="button" className={`county ${d.lit || d.empty ? "" : "out"}`} aria-pressed={selected === area}
        onClick={() => onSelect(area)}
        aria-label={`${area}: median ${d.label}, ${count} listings${d.empty ? "" : d.lit ? ", within budget" : ", over budget"}`}>
        <span className="row"><span className="dot" style={{ background: d.empty ? "transparent" : d.fill, outline: d.lit ? "2px solid var(--lamp)" : undefined }} />{area}</span>
        <span className="muted">{d.label} · no postcodes</span>
      </button>
    );
  };

  return (
    <figure className="map" style={{ margin: 0 }}>
      <div className="map-grid">
        <div className="map-county">{county(COUNTY_AREAS[0])}</div>
        {POSTCODE_GRID.filter(p => p.row < 2).map(door)}
        <div className="liffey" style={{ gridRow: 4 }} aria-hidden="true">
          <svg viewBox="0 0 600 20" preserveAspectRatio="none">
            <path d="M0 10c50-10 100-10 150 0s100 10 150 0 100-10 150 0 100 10 150 0" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        {POSTCODE_GRID.filter(p => p.row >= 2).map(door)}
        <div className="map-county" style={{ gridRow: 8 }}>{county(COUNTY_AREAS[1])}</div>
      </div>
    </figure>
  );

  function door({ area, col, row }: { area: string; col: number; row: number }) {
    const d = describe(area);
    const count = stats.get(area)?.count ?? 0;
    return (
      <button key={area} type="button" className={`door ${d.lit || d.empty ? "" : "out"}`} aria-pressed={selected === area}
        style={{ gridColumn: col + 1, gridRow: row < 2 ? row + 2 : row + 3 }}
        onClick={() => onSelect(area)}
        aria-label={`${area}: median ${d.label}, ${count} listings${d.empty ? "" : d.lit ? ", within budget" : ", over budget"}`}>
        <DoorArt fill={d.fill} lit={d.lit} empty={d.empty} />
        <span className="door-name">{shortArea(area)}</span>
        <span className="door-rent">{d.label}</span>
      </button>
    );
  }
}
