# Worker initialization — local exploratory measurement

28 September 2026 BDT. `mac-exploratory.json` retains five fresh-browser-context samples for each
of four emitted workers, with file hashes, Chrome version and Mac CPU identity. The module wrapper
imports the actual built worker and posts readiness only after module evaluation; it sends no chess
search request. Timing includes worker creation, local-network module fetch, parsing and evaluation.
Browser service workers are disabled. OS/filesystem caches are not cleared. Repair tests were also
running during this first capture, so it is exploratory rather than isolated device benchmarking.

Observed medians were approximately 73 ms (generic engine), 51 ms (Fischer), 106 ms (Spassky), and
129 ms (Tal). These are not search durations, internet download measurements, physical-phone results
or proof that worker reuse would improve play. No pooling/reuse or frozen playing source was changed.

The repeatable browser measurement is `tests/browser/worker-startup.spec.ts`. Its account-session
request is mocked as a guest to keep external account access out of the probe; this fixture was
added after the first capture to remove irrelevant local API connection errors. Real-phone startup,
memory and cancellation evidence remain necessary before selecting an optimization.

`mac-guest-fixture.json` retains the second successful run after that guest fixture was added.
Both runs remain exploratory; neither is selected as a calibrated performance result.
