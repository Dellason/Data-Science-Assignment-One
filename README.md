# Dublin Rental Data Analysis

A Python data-science project that collects, cleans, analyses, and visualises rental-property listings from the Dublin Rental Property Database.

## Project overview

This project demonstrates an end-to-end data workflow:

1. **Web scraping** — identify source pages, handle pagination, parse rental listings, and save structured records.
2. **Data cleaning** — inspect missing values, standardise categorical fields, normalise locations, and prepare numeric variables for analysis.
3. **Exploratory analysis** — investigate rental prices and listing characteristics across property types, Dublin postcodes, bedrooms, bathrooms, parking, gardens, lease length, and contact type.
4. **Visualisation** — use tables and charts to communicate patterns in the collected rental data.

## Repository structure

```text
.
├── 01_web_scraping.ipynb       # Web scraping and data parsing
├── 02_cleaning_analysis.ipynb  # Cleaning, analysis and visualisation
├── data.csv                    # Scraped rental dataset
├── COMP47670 - Assignment 1.pdf
├── requirements.txt
└── .gitignore
```

## Dataset

The project uses the Dublin Rental Property Database provided for the module:

- Source: http://mlg.ucd.ie/modules/python/sources/rental/index.html

The scraped dataset contains fields including Month, Property type, Monthly price, Location, Dublin postcode, Bedrooms, Bathrooms, Parking, Garden, Lease length, and Contact type.

## Key data-processing decisions

The notebooks document the cleaning decisions used during the assignment. These include converting rental prices and room counts to numeric values, standardising Dublin postcode representations, normalising parking and garden values to consistent `Yes` / `No` categories, handling missing values, and standardising categorical text such as contact type.

These decisions are kept explicit because they affect how the resulting analysis should be interpreted.

## Running the project

Create a Python environment and install the dependencies:

```bash
pip install -r requirements.txt
```

Then open the notebooks with Jupyter:

```bash
jupyter notebook
```

Run the notebooks in order:

1. `01_web_scraping.ipynb`
2. `02_cleaning_analysis.ipynb`

## Future development

This repository is being prepared as part of a larger data-science portfolio. A future version will turn the analysis into a polished interactive web experience, allowing visitors to explore the rental dataset and visualisations without needing to run a Jupyter notebook.

## Original assignment

The original assignment brief is retained in the repository as `COMP47670 - Assignment 1.pdf`.
