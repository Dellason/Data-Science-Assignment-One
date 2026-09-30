import { quantile } from "d3-array";

export type PropertyType = "Apartment" | "House";

export type Listing = {
  id: number;
  month: number;
  type: PropertyType;
  price: number;
  location: string;
  postcode: string | null;
  bedrooms: number;
  bathrooms: number;
  parking: boolean;
  garden: boolean;
  lease: number;
  agent: boolean;
  rawLocation?: string;
  rawContact?: string;
  parkingImputed?: true;
  gardenRule?: "apartment" | "north-county-house" | "house";
  leaseImputed?: true;
};

export type Model = {
  intercept: number;
  coefficients: Record<string, number>;
  interval: [number, number];
  evaluation: { folds: number; mae: number; r2: number; withinFifteenPercent: number };
};

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// Pages the scraper found per quarter before the next request returned 404.
export const PAGES_PER_QUARTER = [26, 25, 23, 23];

// Schematic, not to scale: odd districts sit north of the Liffey and even
// ones south, as on the real map. Columns run west to east.
export const POSTCODE_GRID: { area: string; col: number; row: number }[] = [
  { area: "Dublin 15", col: 0, row: 0 },
  { area: "Dublin 11", col: 1, row: 0 },
  { area: "Dublin 9", col: 2, row: 0 },
  { area: "Dublin 17", col: 3, row: 0 },
  { area: "Dublin 5", col: 4, row: 0 },
  { area: "Dublin 13", col: 5, row: 0 },
  { area: "Dublin 7", col: 1, row: 1 },
  { area: "Dublin 1", col: 2, row: 1 },
  { area: "Dublin 3", col: 3, row: 1 },
  { area: "Dublin 20", col: 0, row: 2 },
  { area: "Dublin 8", col: 1, row: 2 },
  { area: "Dublin 2", col: 2, row: 2 },
  { area: "Dublin 4", col: 3, row: 2 },
  { area: "Dublin 22", col: 0, row: 3 },
  { area: "Dublin 10", col: 1, row: 3 },
  { area: "Dublin 12", col: 2, row: 3 },
  { area: "Dublin 6W", col: 3, row: 3 },
  { area: "Dublin 6", col: 4, row: 3 },
  { area: "Dublin 24", col: 1, row: 4 },
  { area: "Dublin 16", col: 2, row: 4 },
  { area: "Dublin 14", col: 3, row: 4 },
  { area: "Dublin 18", col: 4, row: 4 },
];

export const COUNTY_AREAS = ["North County Dublin", "South County Dublin"];

export const areaOf = (l: Listing) => l.postcode ?? l.location;

export const shortArea = (area: string) =>
  area.startsWith("Dublin ") ? `D${area.slice(7)}` : area.replace(" County Dublin", " Co.");

export function median(values: number[]) {
  if (!values.length) return null;
  return quantile([...values].sort((a, b) => a - b), 0.5) ?? null;
}

export const euro = (value: number) =>
  `€${Math.round(value).toLocaleString("en-IE")}`;

export async function loadData() {
  const base = import.meta.env.BASE_URL;
  const [listings, model] = await Promise.all([
    fetch(`${base}data/listings.json`).then(r => r.json() as Promise<Listing[]>),
    fetch(`${base}data/model.json`).then(r => r.json() as Promise<Model>),
  ]);
  return { listings, model };
}

export type EstimateInput = {
  type: PropertyType;
  area: string;
  bedrooms: number;
  bathrooms: number;
  parking: boolean;
  garden: boolean;
};

// Log-price ridge regression fitted by scripts/build_data.py.
export function estimate(model: Model, input: EstimateInput) {
  const c = model.coefficients;
  let log = model.intercept;
  if (input.type === "House") log += c.house;
  log += c[`area:${input.area}`] ?? 0;
  log += c[`beds:${input.bedrooms}`] ?? 0;
  log += c.baths * input.bathrooms;
  if (input.parking) log += c.parking;
  if (input.garden) log += c.garden;
  return {
    value: Math.exp(log),
    low: Math.exp(log + model.interval[0]),
    high: Math.exp(log + model.interval[1]),
  };
}
