import { useMemo, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { POSTCODE_GRID, euro, median, shortArea, type Listing } from "./data";
import { useWidth } from "./charts";

type Strategy = "fill" | "drop";

const incomplete = (l: Listing) => Boolean(l.parkingImputed || l.gardenRule || l.leaseImputed);

export default function Cleaning({ listings }: { listings: Listing[] }) {
  const [strategy, setStrategy] = useState<Strategy>("fill");
  const [frame, width] = useWidth();

  const variants = useMemo(() => {
    const count = new Map<string, { to: string; n: number }>();
    for (const l of listings) {
      if (l.rawLocation) {
        const v = count.get(l.rawLocation) ?? { to: l.location, n: 0 };
        v.n++;
        count.set(l.rawLocation, v);
      }
    }
    return [...count.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [listings]);

  const contactFixes = listings.filter(l => l.rawContact).length;
  const garden = {
    apartment: listings.filter(l => l.gardenRule === "apartment").length,
    house: listings.filter(l => l.gardenRule && l.gardenRule !== "apartment").length,
  };
  const parking = listings.filter(l => l.parkingImputed);
  const lease = listings.filter(l => l.leaseImputed).length;
  const county = listings.filter(l => !l.postcode).length;
  const withPostcode = listings.filter(l => l.postcode);
  const dropped = withPostcode.filter(incomplete).length;
  const droppedGardens = withPostcode.filter(l => l.gardenRule === "apartment").length;

  const comparison = useMemo(() => {
    const kept = strategy === "fill" ? withPostcode : withPostcode.filter(l => !incomplete(l));
    return POSTCODE_GRID.map(({ area }) => {
      const all = withPostcode.filter(l => l.postcode === area && l.type === "Apartment").map(l => l.price);
      const mine = kept.filter(l => l.postcode === area && l.type === "Apartment").map(l => l.price);
      return { area, fill: median(all), current: median(mine), lost: all.length - mine.length };
    }).sort((a, b) => (a.fill ?? 0) - (b.fill ?? 0));
  }, [strategy, withPostcode]);

  const row = 22, top = 24, left = 44, right = 20;
  const height = top + comparison.length * row + 10;
  const values = comparison.flatMap(c => [c.fill, c.current]).filter((v): v is number => v !== null);
  const x = scaleLinear().domain([Math.min(...values) * 0.92, Math.max(...values) * 1.04]).range([left, width - right - 24]).nice();
  const y = scaleBand().domain(comparison.map(c => c.area)).range([top, height - 10]);

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div className="decisions">
        <div className="decision" style={{ gridColumn: "1 / -1" }}>
          <h3>Same place, different spellings</h3>
          <p className="small muted">{variants.reduce((s, [, v]) => s + v.n, 0)} listings used one of {variants.length} non-standard area names. Each was mapped to one of four.</p>
          <div className="variant-list two-col">
            {variants.map(([from, v]) => (
              <div key={from}><span className="from">{JSON.stringify(from)} → {v.to}</span><b>{v.n}</b></div>
            ))}
            <div><span className="from">"Estate  Agent" → Estate Agent</span><b>{contactFixes}</b></div>
          </div>
        </div>
        <div className="decision">
          <span className="count">{garden.apartment + garden.house}</span>
          <h3>Missing gardens</h3>
          <p className="small muted">
            All 402 gardens in the data belong to houses, and 1,306 of the 1,325 listings without one are apartments. So {garden.apartment} apartments became <b>No</b>.
            Nine in ten houses have a garden, so the other {garden.house} houses became <b>Yes</b>.
          </p>
        </div>
        <div className="decision">
          <span className="count">{parking.length}</span>
          <h3>Missing parking</h3>
          <p className="small muted">
            No single rule held, so a logistic regression learned from the 1,790 listings that did report parking — area, type, bedrooms, bathrooms and price — and predicted
            {" "}<b>{parking.filter(l => l.parking).length} Yes</b> and <b>{parking.filter(l => !l.parking).length} No</b>.
          </p>
        </div>
        <div className="decision">
          <span className="count">{lease}</span>
          <h3>Missing lease lengths</h3>
          <p className="small muted">The median and the most common lease were both 12 months for every contact and property type, so each gap became 12 months.</p>
        </div>
        <div className="decision">
          <span className="count">{county}</span>
          <h3>Missing postcodes</h3>
          <p className="small muted">
            Every one is in North or South County Dublin, which the source gives no postcodes. Inventing them would be wrong, so they sit outside the postcode charts.
            This site keeps them as their own areas on the map.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <p className="chart-title">What if the gaps were just deleted?</p>
            <p className="chart-sub" style={{ marginBottom: 0 }}>Median apartment rent per postcode. Grey dots use every listing, with the gaps filled.</p>
          </div>
          <div className="segmented" role="group" aria-label="Cleaning strategy">
            <button type="button" aria-pressed={strategy === "fill"} onClick={() => setStrategy("fill")}>Fill the gaps</button>
            <button type="button" aria-pressed={strategy === "drop"} onClick={() => setStrategy("drop")}>Delete incomplete rows</button>
          </div>
        </div>
        <p className="small" role="status" style={{ marginBottom: 12 }}>
          {strategy === "fill"
            ? <>All {withPostcode.length.toLocaleString("en-IE")} postcode listings kept.</>
            : <>{dropped} listings deleted, {(withPostcode.length - dropped).toLocaleString("en-IE")} left. The largest group, {droppedGardens}, is apartments missing a garden they never had.</>}
        </p>
        <div ref={frame}>
        <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Median apartment rent by postcode under the selected cleaning strategy">
          <g className="grid">{x.ticks(4).map(t => <line key={t} x1={x(t)} x2={x(t)} y1={top - 6} y2={height - 10} />)}</g>
          {x.ticks(4).map(t => <text key={t} x={x(t)} y={top - 10} textAnchor="middle">{euro(t)}</text>)}
          {comparison.map(c => {
            const cy = y(c.area)! + y.bandwidth() / 2;
            return (
              <g key={c.area}>
                <text x={left - 8} y={cy} dy="0.35em" textAnchor="end">{shortArea(c.area)}</text>
                {c.fill !== null && c.current !== null && (
                  <line x1={x(c.fill)} x2={x(c.current)} y1={cy} y2={cy} stroke="var(--ink-soft)" strokeWidth={2} />
                )}
                {c.fill !== null && <circle cx={x(c.fill)} cy={cy} r={4.5} fill="var(--rule)" stroke="var(--ink-soft)" />}
                {c.current !== null && (
                  <circle cx={x(c.current)} cy={cy} r={5} fill="var(--apartment)" stroke="var(--paper-raised)" strokeWidth={1.5}
                    style={{ transition: "cx 400ms ease" }} />
                )}
                {strategy === "drop" && c.lost > 0 && (
                  <text x={width - right} y={cy} dy="0.35em" textAnchor="end">−{c.lost}</text>
                )}
              </g>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
}
