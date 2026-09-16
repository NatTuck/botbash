# Continuous integration

Bot Bash uses GitHub Actions to run lint, unit tests, the production build, and
the Playwright end-to-end suite on every pull request and on every push to
`main`.

The workflow lives at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

Deployment (CD) is documented separately in [`notes/cd.md`](./cd.md).

## What runs, and when

```
pull request / push to main
            |
            v
  +--------------------------+
  |  GitHub Actions CI       |
  |  lint -> unit -> build   |
  |  -> Playwright e2e       |
  +--------------------------+
```

All checks run in a single `test` job so a PR cannot merge until the e2e tests
pass. A new push to the same ref cancels the previous run
(`concurrency.cancel-in-progress`).

## Workflow

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-playwright-

      - name: Install Playwright (chromium)
        run: pnpm exec playwright install --with-deps chromium

      - name: Lint, unit tests, build
        run: pnpm check

      - name: End-to-end tests
        run: pnpm test:e2e

      - name: Upload Playwright report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

## Notes

- `pnpm check` is `lint && test && build`. `lint` also runs
  `scripts/max-lines.mjs`, which fails if any file in `src`, `server`, or
  `shared` exceeds 300 lines of code.
- `build` typechecks the client and server (`tsc`, both `noEmit`) and runs
  `vite build` into `dist/`.
- Playwright's `webServer` starts `pnpm dev` on port 3000 automatically
  (`playwright.config.ts`), so no separate server step is needed.
- With the `~/.cache/ms-playwright` cache warm, the browser install drops to a
  few seconds; the tests themselves take roughly one to three minutes.
- The job runs on `ubuntu-latest` (4 vCPU for public repos, 2 vCPU for
  private). The suite is single-worker (`workers: 1`), so runner size is not a
  bottleneck.
- The Playwright HTML report is uploaded as an artifact even when the job
  fails, so you can download it from the run summary.

## Running the same checks locally

```sh
pnpm install --frozen-lockfile
pnpm check          # lint + unit tests + build
pnpm test:e2e:install   # once, to fetch Chromium
pnpm test:e2e
```

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `max-lines` failure | A file under `src`, `server`, or `shared` exceeds 300 code lines; split it. |
| Playwright fails on canvas timing | Re-run the job; if it is consistently flaky, consider adding `retries` to `playwright.config.ts` or `--retries=2` in CI. |
| `pnpm install --frozen-lockfile` fails | `pnpm-lock.yaml` is out of date; run `pnpm install` locally and commit the lockfile. |
