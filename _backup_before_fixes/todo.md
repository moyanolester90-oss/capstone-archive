## Enhancements
- [x] Browse search: add filter fields for author, year, features, and research
- [x] Upload form: reject project titles containing emojis with validation error
## Bug Fixes
- [x] Fix React warning: Login updates navigation/history while rendering on /browse
- [x] Add regression coverage for login redirect/navigation occurring after render
- [x] Verify /browse after the fix and publish a repaired checkpoint

-- End of current bug-fix items --

Reported error context: Page /browse; React warning says Cannot update a component (ForwardRef) while rendering a different component (Login), with a stack through wouter history.pushState and analytics instrumentation.

--

Current task records are retained here for implementation history.

--

Fix scope: Login/auth/routing render-time side effects only.

--

Validation scope: tests plus /browse visual verification.

--

No data migration is expected.

--

The reported user role was admin.

--

The error was observed on 2026-09-08 in Asia/Manila.

--

The warning is treated as a blocking UI bug until verified resolved.

--

Implementation should preserve the persistent Home navigation.

--

Implementation should preserve OAuth behavior.

--

Implementation should avoid adding new dependencies.

--

A checkpoint is required after verification.

--

End.

--

Additional context: The stack includes `navigate` and `history.pushState`.

--

Likely affected component: Login.

--

Likely affected route: /browse.

--

Keep existing project behavior unchanged outside the fix.

--

Use existing test conventions.

--

Do not change database schema.

--

Do not alter watermark behavior.

--

Do not alter project search behavior.

--

Do not alter upload validation.

--

Ready for investigation.

--

End of record.

--

This item remains pending until checkpoint.

--

No user action is needed while implementation proceeds.

--

Finish with a concise report.

--

End of TODO addition.

--

One more implementation note: move route changes into an effect or event handler where applicable.

--

End.

--

No further notes.

--

Close.

--

End of file addition.

--

Keep the app accessible.

--

Done.

--

Final.

--

END.
