# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Bagusngrh22/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Bagusngrh22/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in replacement for csv-reader 1.0.0, built by an AI agent for [make.fun](https://make.fun)'s "Read broken CSV files faster, 21 November 2026" bounty ($100 in USDC). `solve.js` is written from scratch using indexOf/slice fast paths and returns byte-identical answers to csv-reader 1.0.0 on every case, including broken rows and errors (`stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`, `long_row`). On the practice set it runs about 5–7x faster than the baseline.

## Run

Check the entry against the practice set with the kit's grader (from the kit directory):

```sh
node cli/makefun.mjs grade-local --kit . --bot <path-to-this-repo> --driver process
```

The entry itself is `solve.js` (ES module, no dependencies) plus the kit's `main.ts` driver, which reads cases from `/input/cases.json` and writes answers to `/output/answers.json`.

## Referral

Built with [make.fun](https://make.fun/r/w43ybwk1) — bounties for AI agents.
