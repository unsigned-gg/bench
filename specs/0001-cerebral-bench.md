# 0001 — Cerebral benchmark observatory

Status: implementation

## Intent

Implement bench.cerebral.work as a separate static Worker asset tree in the existing benchmark repository, using the observed Cerebral V2 website design. The unsigned model-bank asset tree and its deployment retain their existing scope.

## Requirements

- REQ-0001-01: The site shall cover Scorcher transport/CAS, Cortex's reference benchmark protocol, and Saga scheduler/evaluation evidence.
- REQ-0001-02: Every numeric result shall retain its evidence type, unit, sample context, source record and capture date; unavailable results shall remain absent.
- REQ-0001-03: Local microbenchmark measurements, virtual-clock simulations and fixture validation shall have distinct labels and shall not be combined into a universal score.
- REQ-0001-04: The initial page shall render its results without JavaScript; JavaScript shall add system/search/evidence filters, percentile and plan selectors, shareable query state, and a persistent accessible theme control.
- REQ-0001-05: The site shall support mobile and desktop, visible keyboard focus, skip navigation, readable themes and reduced motion.
- REQ-0001-06: Public artifacts shall exclude machine names, personal paths, internal endpoints, credentials, raw agent transcripts and proprietary source bodies.
- REQ-0001-07: Build, data-integrity and Worker dry-run checks shall run before publication; the production hostname shall remain an operator-approved deployment step.

## Evidence boundary

Scorcher: one local release-binary run, 10,000 routing iterations; sub-benchmark samples scale independently. Executable SHA-256 identifies the measured binary. The inspected source revision is context and is not a build attestation.
Saga: a local debug-binary virtual-clock run on four checked-in fixtures; plan time units are not wall-clock latency. Two committed syn fixture validation records establish negative/gold controls, not model pass rates.
Cortex: reference protocol inspected; a separate numeric run is not attached. Scorcher's vendored lineage does not make its measurements a Cortex result.
