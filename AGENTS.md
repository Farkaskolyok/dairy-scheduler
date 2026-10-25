# Project rules

- Roster rules live in `src/lib/roster/engine.ts` as shared functions (restIssue, prevNightIssue, restrictionIssue, …) called by the generator, `checkCell` and `validate` alike — so generation, manual-edit warnings and validation never disagree.
- Saved data (localStorage, AppState version 2) is only ever extended: new fields are optional and one-time additions run through `migrate()` in `defaults.ts`, tracked in `state.migrations` — real employee data and drafts must never be reset.
- Manual work-code edits lock the cell in the active draft (`Draft.locked`); regeneration inherits locks only from the active draft and never removes them — conflicts are flagged, not auto-fixed.
- Employee-specific limits are data (`Employee.restrictions`), never name checks inside the algorithm.
- Engine rule tests live in `tests/` (outside the typechecked `src`) and run with `bun test tests/`.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
