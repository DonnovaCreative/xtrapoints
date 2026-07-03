# Commands cheat sheet

Everyday terminal commands for working on the XtraPoint site. Run from the repo
root (`~/Code/xtrapoints`) unless a step says `cd studio`.

> **zsh gotcha:** `#` is **not** a comment when typed interactively. If you copy a
> command with a trailing `# note`, delete the note before pasting or the shell
> errors. (Commands in this file are clean — the notes are on their own lines.)

---

## Preview the site locally

```sh
npm run dev
```

Serves at **http://localhost:4321**, hot-reloading as you save. Needs
`SANITY_READ_TOKEN` in `.env` (already set) to load school + legal content.

Styles look stale after editing `globals.css` or a React island? Clear the cache:

```sh
rm -rf node_modules/.vite .astro && npm run dev
```

Check a real production build (the true "is it broken?" test — `dev` is more
forgiving than the build):

```sh
npm run build     # builds to ./dist and .vercel/output
npm run preview   # serve that build locally
```

---

## Commit your work (on `staging`)

Day-to-day work happens on the `staging` branch. You commit **on** staging — you
don't commit "between" branches; going to production is a *merge* (next section).

```sh
git checkout staging      # make sure you're on staging
git add -A                # stage all changes
git commit -m "describe what changed"
git push origin staging   # → rebuilds staging.xtrapoint.com
```

---

## Deploy staging → production (promote)

Production (`xtrapoint.com`) only ships what's on the `main` branch. When staging
looks good, fast-forward `main` to it:

```sh
git checkout main
git merge --ff-only staging   # safe: fails loudly if main has diverged
git push origin main          # → rebuilds xtrapoint.com
git checkout staging          # return to your working branch
```

If `--ff-only` fails, **stop** — it means `main` has changes staging doesn't.
Don't force it; ask for help reconciling.

Preview what will ship before you promote:

```sh
git log main..staging --oneline   # commits on staging not yet on main
git diff main staging             # full diff
```

---

## "Deploy to both at once"

There's no single command — code always lands on `staging` first (it's the review
environment). To get both live with the same code, push to staging (above), then
immediately run the promote steps. Within a couple minutes both are identical.

Content (schools, legal pages) is separate — see the Sanity section.

---

## Add / edit content in Sanity

### Add a school

**No terminal (recommended for one-offs):**
Open **https://xtrapoint.sanity.studio** → **Schools → Create new** → fill fields,
upload logo/photos, pick colors → **Publish**.

**Batch import from a JSON file** (from `studio/`):

```sh
cd studio
IMPORT_FILE=import/schools.json npm run import           # creates drafts to review
IMPORT_FILE=import/schools.json PUBLISH=1 npm run import  # publishes live
```

**Auto-fill a college from ESPN** (from `studio/`):

```sh
cd studio
SEARCH="oregon" npm run seed:college           # find ESPN's exact team name
COLLEGE="Oregon Ducks" npm run seed:college    # creates a draft to review + publish
```

### Legal pages (Terms / Privacy)

Edit them in the Studio under **Legal pages** (rich text). To re-seed from the
script instead (from `studio/`):

```sh
cd studio
npm run seed:legal              # re-seed as drafts
PUBLISH=1 npm run seed:legal    # re-seed and publish live
```

### Deploy the Studio itself

Only needed after a **schema** change (adding a new field, doc type, etc.), from
`studio/`:

```sh
cd studio
npx sanity deploy
```

Check your Sanity login if a script errors with an auth message:

```sh
cd studio && npx sanity debug --secrets
```

---

## Handy checks & fixes

Is it live right now? (quick check without a browser)

```sh
curl -sI https://xtrapoint.com | head -n1
curl -sI https://staging.xtrapoint.com | head -n1
```

Re-trigger a stuck Vercel deploy (occasionally a build gets superseded and doesn't
publish — see HANDOFF.md):

```sh
git commit --allow-empty -m "chore: re-trigger deploy"
git push origin staging   # or main
```

> **Don't spam this** — repeated pushes in a short window can trip Vercel's deploy
> rate limit, which makes things worse. One empty commit, then wait.
