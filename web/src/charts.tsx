import { useEffect, useState, type ReactNode } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { MONTHS, euro, shortArea, type Listing } from "./data";
import type { AreaStat, RentColor } from "./DoorMap";

type Tip = { x: number; y: number; body: ReactNode } | null;

function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const view = tip && <div className="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.body}</div>;
  return { setTip, view };
}

// Charts draw at their real pixel width, so text keeps one size everywhere
// and viewBox units are pixels.
export function useWidth(fallback = 560) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

const place = (x: number, y: number) => ({ x, y });

export function AreaRanking({ stats, color, budget, selected, onSelect }: {
  stats: Map<string, AreaStat>;
  color: RentColor;
  budget: number;
  selected: string | null;
  onSelect: (area: string) => void;
}) {
  const { setTip, view } = useTip();
  const [frame, width] = useWidth();
  const rows = [...stats.entries()]
    .filter((e): e is [string, { median: number; count: number }] => e[1].median !== null)
    .sort((a, b) => a[1].median - b[1].median);
  const row = 22, top = 26, left = 64, right = 56;
  const height = top + rows.length * row + 8;
  const max = Math.max(budget, ...rows.map(r => r[1].median)) * 1.05;
  const x = scaleLinear().domain([0, max]).range([left, width - right]);
  const y = scaleBand().domain(rows.map(r => r[0])).range([top, height - 8]).padding(0.28);
  const ticks = x.ticks(4);

  return (
    <div className="chart-frame" ref={frame}>
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Median monthly rent for ${rows.length} areas, lowest to highest, with the budget at ${euro(budget)}`}>
        <g className="grid">
          {ticks.map(t => <line key={t} x1={x(t)} x2={x(t)} y1={top - 6} y2={height - 8} />)}
        </g>
        {ticks.map(t => <text key={t} x={x(t)} y={top - 12} textAnchor="middle">{euro(t)}</text>)}
        <line x1={x(budget)} x2={x(budget)} y1={top - 4} y2={height - 6} stroke="var(--ink)" strokeWidth={2} opacity={0.7} strokeDasharray="5 4" />
        {rows.map(([area, s]) => {
          const yy = y(area)!;
          const active = area === selected;
          return (
            <g key={area} style={{ cursor: "pointer" }} onClick={() => onSelect(area)}
              onMouseEnter={() => setTip({ ...place(x(s.median), yy), body: <><b>{area}</b><br />{euro(s.median)} median · {s.count} listings</> })}
              onMouseLeave={() => setTip(null)}>
              <rect x={0} y={yy - 3} width={width} height={y.bandwidth() + 6} fill="transparent" />
              <text x={left - 8} y={yy + y.bandwidth() / 2} dy="0.35em" textAnchor="end" className={active ? "label-strong" : undefined}>{shortArea(area)}</text>
              <rect x={left} y={yy} width={Math.max(0, x(s.median) - left)} height={y.bandwidth()} rx={4}
                fill={color(s.median)} stroke={active ? "var(--ink)" : "none"} strokeWidth={2} />
              <text x={x(s.median) + 6} y={yy + y.bandwidth() / 2} dy="0.35em" className={active ? "label-strong" : undefined}>{euro(s.median)}</text>
            </g>
          );
        })}
        <text x={x(budget)} y={height + 12} textAnchor="middle" className="label-strong">your budget</text>
      </svg>
      {view}
    </div>
  );
}

export function PriceStrip({ listings, cityMedian }: { listings: Listing[]; cityMedian: number | null }) {
  const { setTip, view } = useTip();
  const [frame, width] = useWidth();
  const height = 150, left = 82, right = 12;
  const max = Math.max(4000, ...listings.map(l => l.price)) * 1.04;
  const x = scaleLinear().domain([0, max]).range([left, width - right]).nice();
  const lane = { Apartment: 52, House: 102 };
  // Deterministic jitter so dots don't shuffle on every render.
  const jitter = (id: number) => ((id * 9301 + 49297) % 233280) / 233280 - 0.5;

  return (
    <div className="chart-frame" ref={frame}>
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Monthly rent of ${listings.length} listings, apartments and houses`}>
        <g className="grid">{x.ticks(5).map(t => <line key={t} x1={x(t)} x2={x(t)} y1={24} y2={height - 20} />)}</g>
        {x.ticks(5).map(t => <text key={t} x={x(t)} y={height - 4} textAnchor="middle">{euro(t)}</text>)}
        <text x={0} y={lane.Apartment} dy="0.35em">Apartments</text>
        <text x={0} y={lane.House} dy="0.35em">Houses</text>
        {cityMedian !== null && (
          <g>
            <line x1={x(cityMedian)} x2={x(cityMedian)} y1={14} y2={height - 20} stroke="var(--ink)" strokeDasharray="3 3" />
            <text x={x(cityMedian) + 5} y={16}>all Dublin median</text>
          </g>
        )}
        {listings.map(l => (
          <circle key={l.id} cx={x(l.price)} cy={lane[l.type] + jitter(l.id) * 30} r={4.2}
            fill={l.type === "House" ? "var(--house)" : "var(--apartment)"} stroke="var(--paper-raised)" strokeWidth={1.2}
            onMouseEnter={() => setTip({ ...place(x(l.price), lane[l.type] + jitter(l.id) * 30), body: <>{euro(l.price)} · {l.bedrooms} bed {l.type.toLowerCase()}<br />{MONTHS[l.month]} · {l.bathrooms} bath{l.parking ? " · parking" : ""}{l.garden ? " · garden" : ""}</> })}
            onMouseLeave={() => setTip(null)} />
        ))}
      </svg>
      {view}
    </div>
  );
}

export function MonthBars({ listings }: { listings: Listing[] }) {
  const { setTip, view } = useTip();
  const [frame, width] = useWidth();
  const height = 120, top = 10, bottom = 20;
  const counts = MONTHS.map((_, m) => ({
    apartment: listings.filter(l => l.month === m && l.type === "Apartment").length,
    house: listings.filter(l => l.month === m && l.type === "House").length,
  }));
  const x = scaleBand().domain(MONTHS).range([0, width]).padding(0.25);
  const y = scaleLinear().domain([0, Math.max(1, ...counts.map(c => c.apartment + c.house))]).range([height - bottom, top]);
  return (
    <div className="chart-frame" ref={frame}>
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Listings per month, apartments and houses stacked">
        {counts.map((c, m) => {
          const xx = x(MONTHS[m])!;
          const total = c.apartment + c.house;
          return (
            <g key={m} onMouseEnter={() => setTip({ ...place(xx + x.bandwidth() / 2, y(total)), body: <><b>{MONTHS[m]}</b><br />{c.apartment} apartments · {c.house} houses</> })}
              onMouseLeave={() => setTip(null)}>
              <rect x={xx - 2} y={top} width={x.bandwidth() + 4} height={height - bottom - top} fill="transparent" />
              <rect x={xx} y={y(c.apartment)} width={x.bandwidth()} height={y(0) - y(c.apartment)} fill="var(--apartment)" rx={2} />
              <rect x={xx} y={y(total)} width={x.bandwidth()} height={Math.max(0, y(c.apartment) - y(total) - 2)} fill="var(--house)" rx={2} />
              <text x={xx + x.bandwidth() / 2} y={height - 4} textAnchor="middle">{MONTHS[m][0]}</text>
            </g>
          );
        })}
      </svg>
      {view}
    </div>
  );
}
