import { useMemo, useState } from "react";
import { COUNTY_AREAS, MONTHS, POSTCODE_GRID, areaOf, estimate, euro, type Listing, type Model, type PropertyType } from "./data";

const AREAS = [
  ...POSTCODE_GRID.map(p => p.area).sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7)) || a.localeCompare(b)),
  ...COUNTY_AREAS,
];

const pct = (log: number) => {
  const p = (Math.exp(log) - 1) * 100;
  return `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p))}%`;
};

export default function Estimator({ model, listings }: { model: Model; listings: Listing[] }) {
  const [type, setType] = useState<PropertyType>("Apartment");
  const [area, setArea] = useState("Dublin 8");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [parking, setParking] = useState(false);
  const [garden, setGarden] = useState(false);

  const input = { type, area, bedrooms, bathrooms, parking, garden: type === "House" && garden };
  const result = estimate(model, input);
  const c = model.coefficients;

  // Contributions against a one-bed, one-bath apartment in Dublin 1.
  const factors = [
    { label: type === "House" ? "A house, not an apartment" : "An apartment", log: type === "House" ? c.house : 0 },
    { label: area === "Dublin 1" ? "Dublin 1 (the baseline area)" : area, log: c[`area:${area}`] ?? 0 },
    { label: `${bedrooms} bedroom${bedrooms > 1 ? "s" : ""}`, log: c[`beds:${bedrooms}`] ?? 0 },
    { label: `${bathrooms} bathroom${bathrooms > 1 ? "s" : ""}`, log: c.baths * (bathrooms - 1) },
    { label: parking ? "Parking" : "No parking", log: parking ? c.parking : 0 },
    ...(type === "House" ? [{ label: input.garden ? "Garden" : "No garden", log: input.garden ? c.garden : 0 }] : []),
  ];
  const baseline = Math.exp(model.intercept + c.baths);
  const span = Math.max(0.5, ...factors.map(f => Math.abs(f.log)));

  const seen = listings.filter(l => l.type === type && l.bedrooms === bedrooms).length;
  const comparables = useMemo(() => {
    const pool = listings.filter(l => l.type === type && areaOf(l) === area);
    return pool
      .map(l => ({ l, score: Math.abs(l.bedrooms - bedrooms) * 2 + Math.abs(l.bathrooms - bathrooms) + (l.parking === parking ? 0 : 0.5) }))
      .sort((a, b) => a.score - b.score || Math.abs(a.l.price - result.value) - Math.abs(b.l.price - result.value))
      .slice(0, 5)
      .map(x => x.l);
  }, [listings, type, area, bedrooms, bathrooms, parking, result.value]);

  return (
    <div className="grid-2">
      <div className="panel controls">
        <div className="control">
          <span className="control-label">Property</span>
          <div className="segmented" role="group" aria-label="Property type">
            {(["Apartment", "House"] as const).map(t => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
                <span className="swatch" style={{ background: t === "House" ? "var(--house)" : "var(--apartment)" }} />{t}
              </button>
            ))}
          </div>
        </div>
        <label className="control">
          <span className="control-label">Area</span>
          <select value={area} onChange={e => setArea(e.target.value)}>
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
        </label>
        <div className="control">
          <span className="control-label">Bedrooms</span>
          <div className="segmented" role="group" aria-label="Bedrooms">
            {[1, 2, 3, 4, 5].map(b => <button key={b} type="button" aria-pressed={bedrooms === b} onClick={() => setBedrooms(b)}>{b}</button>)}
          </div>
        </div>
        <div className="control">
          <span className="control-label">Bathrooms</span>
          <div className="segmented" role="group" aria-label="Bathrooms">
            {[1, 2, 3].map(b => <button key={b} type="button" aria-pressed={bathrooms === b} onClick={() => setBathrooms(b)}>{b}</button>)}
          </div>
        </div>
        <div className="row" style={{ gap: 22 }}>
          <label className="switch"><input type="checkbox" checked={parking} onChange={e => setParking(e.target.checked)} />Parking</label>
          <label className="switch" style={{ opacity: type === "House" ? 1 : 0.5 }}>
            <input type="checkbox" checked={input.garden} disabled={type !== "House"} onChange={e => setGarden(e.target.checked)} />Garden
          </label>
        </div>
        {type === "Apartment" && <p className="small muted">No apartment in the data has a garden, so it only applies to houses.</p>}
        {seen === 0 && (
          <p className="small" style={{ color: "var(--warn)" }} role="status">
            There are no {bedrooms}-bedroom {type.toLowerCase()}s in the listings, so this estimate is an extrapolation.
          </p>
        )}
      </div>

      <div className="panel" aria-live="polite">
        <p className="small muted">Estimated monthly rent</p>
        <p className="estimate-number">{euro(result.value)}</p>
        <p className="small muted" style={{ marginTop: 8 }}>
          Likely between <b style={{ color: "var(--ink)" }}>{euro(result.low)}</b> and <b style={{ color: "var(--ink)" }}>{euro(result.high)}</b>. In testing,
          8 in 10 real listings fell inside a band this wide.
        </p>

        <h3 style={{ marginTop: 26, fontSize: "var(--step-0)" }}>What moves the price</h3>
        <p className="small muted" style={{ marginBottom: 6 }}>Starting from {euro(baseline)} for a one-bed, one-bath apartment in Dublin 1.</p>
        {factors.map(f => (
          <div className="factor" key={f.label}>
            <span>{f.label}</span>
            <b>{Math.abs(f.log) < 0.005 ? "—" : pct(f.log)}</b>
            <div className="factor-bar" aria-hidden="true">
              <i style={{
                left: f.log >= 0 ? "50%" : `${50 - (Math.abs(f.log) / span) * 50}%`,
                width: `${(Math.abs(f.log) / span) * 50}%`,
                background: f.log >= 0 ? "var(--liffey)" : "var(--ink-soft)",
              }} />
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: "var(--step-0)" }}>Closest real listings in {area}</h3>
          <span className="small muted">
            Model: ridge regression on log rent, {model.evaluation.folds}-fold cross-validated. Typical error {euro(model.evaluation.mae)}, R² {model.evaluation.r2}.
          </span>
        </div>
        {comparables.length ? (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Month</th><th>Property</th><th className="num">Bath</th><th>Extras</th><th className="num">Rent</th></tr></thead>
              <tbody>
                {comparables.map(l => (
                  <tr key={l.id}>
                    <td>{MONTHS[l.month]}</td>
                    <td>{l.bedrooms}-bed {l.type.toLowerCase()}</td>
                    <td className="num">{l.bathrooms}</td>
                    <td className="muted">{[l.parking && "parking", l.garden && "garden"].filter(Boolean).join(", ") || "none"}</td>
                    <td className="num"><b>{euro(l.price)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted small">No {type.toLowerCase()}s were listed in {area}. Try another area or property type.</p>
        )}
      </div>
    </div>
  );
}
