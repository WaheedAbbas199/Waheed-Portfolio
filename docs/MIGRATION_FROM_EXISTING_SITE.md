# Bringing your existing portfolio content over

The original repo (`WaheedAbbas199/portfolio`) was not reachable during the build, so `js/data.js` and `css/style.css` could not be read. Nothing was overwritten or deleted.

**What was preserved from the live site:** section order and numbering, hero fact chips (stack/focus/runtime/status), availability indicator, services intro text, résumé path
(no CV link is pre-filled: upload your PDF in Admin → Media library, or set a same-site path such as `/assets/resume/cv.pdf` in Website content → resume), contact categories, and your GitHub/LinkedIn/email.

**To import your real data:**
1. Easiest: open Admin and paste/edit content in *Projects*, *Skills*, *Experience & credentials* and *Website content*.
2. For an automated import, share `js/data.js` (paste it or make the repo accessible / upload a zip) and the mapping to the project/skill/item tables can be scripted in a few minutes.
3. Review the **seeded projects**: their titles/stacks come from projects you described, but links, case studies and results are intentionally empty. Nothing claims results.
4. Keep your old repo as-is until the new site is deployed and checked. Deploy this project as a **new** Vercel project (Root Directory `vercel-site`) so nothing from the old setup can interfere.
