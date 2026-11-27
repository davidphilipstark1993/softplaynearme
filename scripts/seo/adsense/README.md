# AdSense / thin-content audit

Read-only tools behind `seo-data/adsense/phase1-report.md`. They measure how much of each
indexable page is the page's own content, and list the URLs each indexing rule touches.
Outputs go to `seo-data/adsense/` (gitignored: it can hold GSC data).

Requires Python 3 with `beautifulsoup4` and `lxml`.

```bash
npm run build && SOFTPLAY_STATIC_BUILD=1 npx next start -p 3123   # in another terminal
python3 scripts/seo/adsense/crawl.py            # -> seo-data/adsense/crawl/pages.jsonl + sitemap.xml
python3 scripts/seo/adsense/analyze.py          # -> page-inventory.csv, summary-by-type.json, templates-by-type.json
python3 scripts/seo/adsense/boilerplate.py      # -> boilerplate.json
python3 scripts/seo/adsense/dataquality.py      # -> data-quality.json, off-category-candidates.csv, duplicate-candidates.csv
python3 scripts/seo/adsense/copyclaims.py       # -> copy-claims.json
python3 scripts/seo/adsense/pruning.py          # -> pruning-candidates.csv, pruning-summary.json
```

Add `--gsc=seo-data/gsc-YYYY-MM-DD/perf/Pages.csv` to `analyze.py` and `pruning.py` for the
clicks columns. `analyze.py --prefix=after-` writes a second set of files for before/after.

Definitions: text inside `<main>` only. A sentence is *templated* when, with venue names,
addresses, towns, postcodes, numbers and dates replaced by tokens, it appears on 5 or more
pages of the same type. *Unique words* are the words in the remaining sentences.
