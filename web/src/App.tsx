import { useEffect, useMemo, useState } from "react";
import DoorMap, { RAMP_GRADIENT, makeRentColor, type AreaStat } from "./DoorMap";
import { AreaRanking, MonthBars, PriceStrip } from "./charts";
import Estimator from "./Estimator";
import { ParseDemo, ScraperReplay } from "./Scraper";
import Cleaning from "./Cleaning";
import ThemeToggle from "./ThemeToggle";
import {
  COUNTY_AREAS, MONTHS, POSTCODE_GRID, areaOf, euro, loadData, median,
  type Listing, type Model, type PropertyType,
} from "./data";

const PORTFOLIO = "https://jjmensah.github.io/enam_portfolio/";
const CASE_STUDY = `${PORTFOLIO}projects/dublin-rental-market/`;
const AREAS = [...POSTCODE_GRID.map(p => p.area), ...COUNTY_AREAS];

type Beds = "any" | 1 | 2 | 3 | 4;
const bedLabel = (b: Beds) => (b === "any" ? "Any size" : b === 4 ? "4+ bed" : `${b} bed`);
const matchesBeds = (l: Listing, b: Beds) => b === "any" || (b === 4 ? l.bedrooms >= 4 : l.bedrooms === b);

function downloadCsv(listings: Listing[]) {
  const header = ["month", "type", "price", "location", "postcode", "bedrooms", "bathrooms", "parking", "garden",
    "lease_months", "contact", "parking_imputed", "garden_imputed", "lease_imputed"];
  const lines = listings.map(l => [MONTHS[l.month], l.type, l.price, l.location, l.postcode ?? "", l.bedrooms, l.bathrooms,
    l.parking ? "Yes" : "No", l.garden ? "Yes" : "No", l.lease, l.agent ? "Estate Agent" : "Owner",
    Boolean(l.parkingImputed), Boolean(l.gardenRule), Boolean(l.leaseImputed)].join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dublin_rentals_2025_cleaned.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function App() {
  const [data, setData] = useState<{ listings: Listing[]; model: Model } | null>(null);
  const [failed, setFailed] = useState(false);
  const [budget, setBudget] = useState(2000);
  const [type, setType] = useState<PropertyType>("Apartment");
  const [beds, setBeds] = useState<Beds>(2);
  const [selected, setSelected] = useState<string>("Dublin 8");

  useEffect(() => {
    loadData().then(setData).catch(() => setFailed(true));
  }, []);

  const listings = useMemo(() => data?.listings ?? [], [data]);
  const matching = useMemo(() => listings.filter(l => l.type === type && matchesBeds(l, beds)), [listings, type, beds]);
  const stats = useMemo(() => {
    const m = new Map<string, AreaStat>();
    for (const area of AREAS) {
      const prices = matching.filter(l => areaOf(l) === area).map(l => l.price);
      m.set(area, { median: median(prices), count: prices.length });
    }
    return m;
  }, [matching]);

  const medians = [...stats.values()].flatMap(s => (s.median === null ? [] : [s.median]));
  const color = makeRentColor(medians);

  if (failed) return <div className="loading">The listings could not be loaded. Refresh the page to try again.</div>;
  if (!data) return <div className="loading">Loading 1,900 listings…</div>;

  const withData = [...stats.values()].filter(s => s.median !== null);
  const lit = withData.filter(s => s.median! <= budget).length;
  const affordable = matching.filter(l => l.price <= budget).length;
  const what = `${beds === "any" ? "" : `${bedLabel(beds).replace(" bed", "-bed")} `}${type.toLowerCase()}`;

  const areaListings = listings.filter(l => areaOf(l) === selected);
  const selectedStat = stats.get(selected);
  const cityMedian = median(matching.map(l => l.price));
  const bedMix = [1, 2, 3, 4, 5].map(b => {
    const rows = areaListings.filter(l => l.bedrooms === b);
    return {
      b,
      apartment: median(rows.filter(l => l.type === "Apartment").map(l => l.price)),
      house: median(rows.filter(l => l.type === "House").map(l => l.price)),
      n: rows.length,
    };
  }).filter(r => r.n);

  return (
    <>
      <a className="skip" href="#main">Skip to the map</a>
      <div className="bar">
        <header className="wrap topbar">
          <a className="brand" href="#main"><img src="./door.svg" width="26" height="26" alt="" />Dublin rent, door by door</a>
          <div className="topbar-end">
            <nav aria-label="Sections">
              <a href="#explore">Explore</a>
              <a href="#estimate">Estimate</a>
              <a href="#scraper">How it was built</a>
              <a href="#data">Data</a>
            </nav>
            <ThemeToggle />
          </div>
        </header>
      </div>

      <main id="main">
        <section className="wrap hero" aria-labelledby="title">
          <div className="hero-copy">
            <h1 id="title">What does your rent buy in Dublin?</h1>
            <p className="lede">Every door is a postcode. Set a monthly budget and see which ones open, using 1,900 listings from 2025.</p>
            <div className="controls">
              <label className="control">
                <span className="control-label">Monthly budget <output>{euro(budget)}</output></span>
                <input type="range" min={800} max={6000} step={50} value={budget} onChange={e => setBudget(Number(e.target.value))}
                  aria-valuetext={`${euro(budget)} a month`} />
              </label>
              <div className="control">
                <span className="control-label">Looking for</span>
                <div className="segmented" role="group" aria-label="Property type">
                  {(["Apartment", "House"] as const).map(t => (
                    <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
                      <span className="swatch" style={{ background: t === "House" ? "var(--house)" : "var(--apartment)" }} />{t}
                    </button>
                  ))}
                </div>
                <div className="segmented" role="group" aria-label="Bedrooms">
                  {(["any", 1, 2, 3, 4] as const).map(b => (
                    <button key={b} type="button" aria-pressed={beds === b} onClick={() => setBeds(b)}>{bedLabel(b)}</button>
                  ))}
                </div>
              </div>
            </div>
            <p className="verdict" role="status">
              {withData.length === 0
                ? <>No {what}s were listed. Try another size.</>
                : <>A typical {what} fits <strong>{euro(budget)}</strong> in <strong>{lit} of {withData.length} areas</strong>.{" "}
                  <span className="muted">{affordable.toLocaleString("en-IE")} of {matching.length.toLocaleString("en-IE")} matching listings were at or under budget.</span></>}
            </p>
          </div>

          <div>
            <DoorMap stats={stats} color={color} budget={budget} selected={selected} onSelect={area => {
              setSelected(area);
              document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }} />
            <div className="map-note">
              <span className="ramp">Median rent <span className="ramp-bar" style={{ background: RAMP_GRADIENT }} /> {medians.length ? <>{euro(Math.min(...medians))} to {euro(Math.max(...medians))}</> : "no listings"}</span>
              <span>A lit fanlight means the median fits your budget. Map is schematic, not to scale.</span>
            </div>
          </div>
        </section>

        <section id="explore" className="section" aria-labelledby="explore-title">
          <div className="wrap">
            <div className="section-head">
              <span className="step-no">Explore</span>
              <h2 id="explore-title">{selected}</h2>
              <p>
                {selectedStat?.median != null
                  ? <>Median {what} rent here is <b style={{ color: "var(--ink)" }}>{euro(selectedStat.median)}</b>{cityMedian !== null && <>, against {euro(cityMedian)} across Dublin</>}. Pick any door or bar to switch area.</>
                  : <>No {what}s were listed here. Pick another door, or change the filters above.</>}
              </p>
            </div>
            <div className="grid-explore">
              <div className="panel">
                <p className="chart-title">Every area, ranked</p>
                <p className="chart-sub">Median rent for a {what}. The dashed line is your budget.</p>
                <div style={{ paddingBottom: 16 }}>
                  <AreaRanking stats={stats} color={color} budget={budget} selected={selected} onSelect={setSelected} />
                </div>
              </div>
              <div style={{ display: "grid", gap: "clamp(20px, 3vw, 36px)" }}>
                <div className="panel">
                  <p className="chart-title">All {areaListings.length} listings in {selected}</p>
                  <div className="legend">
                    <span><i className="swatch" style={{ background: "var(--apartment)" }} />Apartment</span>
                    <span><i className="swatch" style={{ background: "var(--house)" }} />House</span>
                  </div>
                  <PriceStrip listings={areaListings} cityMedian={cityMedian} />
                </div>
                <div className="grid-2">
                  <div className="panel">
                    <p className="chart-title">By bedrooms</p>
                    <table className="data">
                      <thead><tr><th>Beds</th><th className="num">Apartment</th><th className="num">House</th></tr></thead>
                      <tbody>
                        {bedMix.map(r => (
                          <tr key={r.b}>
                            <td>{r.b}</td>
                            <td className="num">{r.apartment !== null ? euro(r.apartment) : "—"}</td>
                            <td className="num">{r.house !== null ? euro(r.house) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="panel">
                    <p className="chart-title">Listed each month</p>
                    <p className="chart-sub">Apartments below, houses on top.</p>
                    <MonthBars listings={areaListings} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="estimate" className="section" aria-labelledby="estimate-title">
          <div className="wrap">
            <div className="section-head">
              <span className="step-no">Estimate</span>
              <h2 id="estimate-title">Price a home that isn't listed</h2>
              <p>Describe a place and a model trained on all 1,900 listings estimates its rent, shows what drives the number, and lists the closest real listings.</p>
            </div>
            <Estimator model={data.model} listings={listings} />
          </div>
        </section>

        <section id="scraper" className="section" aria-labelledby="scraper-title">
          <div className="wrap">
            <div className="section-head">
              <span className="step-no">How it was built, part one</span>
              <h2 id="scraper-title">97 pages, no page count</h2>
              <p>
                The listings lived on paginated pages with no download or API. Rather than hard-code how many pages each quarter had,
                the scraper kept asking for the next one until the server said it didn't exist.
              </p>
            </div>
            <ScraperReplay listings={listings} />
            <ParseDemo listings={listings} />
          </div>
        </section>

        <section id="cleaning" className="section" aria-labelledby="cleaning-title">
          <div className="wrap">
            <div className="section-head">
              <span className="step-no">How it was built, part two</span>
              <h2 id="cleaning-title">Every gap got a reason</h2>
              <p>
                Scraped data is messy. One listing in five had a gap, and area names came in ten spellings. Each fix below was decided from the data,
                and you can see what would have happened with the lazy option.
              </p>
            </div>
            <Cleaning listings={listings} />
          </div>
        </section>

        <section id="data" className="section" aria-labelledby="data-title">
          <div className="wrap grid-2">
            <div className="section-head" style={{ marginBottom: 0 }}>
              <span className="step-no">Data</span>
              <h2 id="data-title">Take the listings with you</h2>
              <p>
                The cleaned dataset: 1,900 listings from the Dublin Rental Property Database, collected for UCD's COMP47670 module.
                Imputed values are flagged so you can leave them out.
              </p>
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="button" onClick={() => downloadCsv(listings)}>Download the CSV</button>
                <a className="button ghost" href={CASE_STUDY}>Read the case study</a>
              </div>
            </div>
            <div className="panel">
              <p className="chart-title">Caveats</p>
              <ul className="small muted" style={{ paddingLeft: 18, margin: "8px 0 0", display: "grid", gap: 8 }}>
                <li>Asking rents from one listings source, not agreed rents.</li>
                <li>County Dublin listings have no postcode and appear as two broad areas.</li>
                <li>Postcodes with few listings, especially for houses, have noisy medians. Hover a bar to see how many listings it rests on.</li>
                <li>The estimator is a linear model on log rent. Its typical error is {euro(data.model.evaluation.mae)}, so treat it as a guide, not a valuation.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="wrap footer">
        <p>
          Analysis and data collection by <a href={PORTFOLIO}>Jessica Mawuenam Dellason</a>.
          {" "}<a href={CASE_STUDY}>The full write-up</a> covers the notebooks, charts and findings.
        </p>
      </footer>
    </>
  );
}
