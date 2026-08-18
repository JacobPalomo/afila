# ADR-0002: Resource efficiency, privacy and application integrity as release gates

**Status:** Accepted<br>
**Date:** 2026-08-05<br>
**Decision type:** Product and platform architecture<br>
**Scope:** Desktop shell, local execution runtime, packaging, updates and release validation

> **Languages:** English | [Español](./0002-resource-privacy-integrity-requirements.es.md)<br>
> **Synchronization policy:** The English and Spanish versions must be updated
> in the same change. Any semantic difference blocks the change until it is
> clarified.

## 1. Context

Afila is intended to be healthy and respectful toward the user's device and
data. Low RAM consumption, small installed size, minimal background activity,
local privacy and verifiable application integrity are product requirements,
not optional optimizations.

ADR-0001 demonstrated useful security properties for a disposable Electron
renderer, but Candidate A did not demonstrate a hard memory boundary on macOS.
Electron also carries the resource cost of its desktop runtime independently of
the execution sandbox decision.

The execution runtime and the desktop shell are separate decisions:

- Candidate C concerns execution of untrusted user source.
- Electron, a system-WebView shell or a native UI concerns the application
  shell.

Neither decision may be made solely from implementation convenience.

## 2. Decision

Afila adopts resource efficiency, privacy and integrity as mandatory release
gates.

The selected architecture must be the smallest and least resource-intensive
option that satisfies all required functionality, security, privacy and
integrity properties. A resource reduction never justifies weakening a security
boundary, hiding an integrity failure or transmitting user data.

No replacement desktop shell is selected by this ADR. Electron and candidate
shells must first be measured using the same reproducible procedure.

Candidate C must be evaluated independently as the execution successor for
untrusted code. Its selection does not automatically select a desktop shell.

## 3. Resource requirements

Afila must:

- keep no execution helper alive while no execution is active;
- start with one execution at a time;
- avoid unnecessary background processes, timers and polling;
- perform no idle work that can be event-driven;
- package only runtime files needed by the target architecture;
- avoid duplicated engines, assets and development dependencies in releases;
- place explicit byte limits on every inter-process message;
- terminate and release disposable execution resources deterministically;
- measure release size and memory before every supported-platform release;
- treat unexplained resource regressions as release-blocking.

Optimizations must target the complete application, not only the user
interface bundle.

## 4. Privacy requirements

Afila is local-first and offline-capable by default.

Unless a future feature has its own reviewed decision and explicit user action,
Afila must have:

- no telemetry or analytics;
- no advertising identifiers;
- no automatic crash-report upload;
- no remote content rendered inside the application;
- no network activity while idle;
- no upload of source code, tests, results, progress or local metadata;
- no background account synchronization;
- no hidden or bundled third-party tracking endpoints.

A networked feature must identify its destination, purpose, transmitted fields,
retention behavior and user-visible control before implementation. Denial or
unavailability of the network must not make local execution unsafe.

## 5. Integrity requirements

Production artifacts must:

- be signed with the platform-appropriate application identity;
- be notarized where the platform requires or supports it;
- verify update metadata and update artifacts before installation;
- reject unsigned, invalidly signed or unexpectedly changed helpers;
- pin security-sensitive dependencies and toolchains;
- verify the source, version and digest of embedded native components;
- keep development diagnostics and test probes out of packaged releases;
- fail closed when protocol versions, signatures, hashes or resource cleanup
  cannot be verified.

The execution helper must be treated as a security-sensitive component with its
own build, test, signing and update policy.

## 6. Required measurements

Every shell comparison and release baseline must record, per operating system
and CPU architecture:

1. uncompressed application size;
2. installer or archive size;
3. installed size after first launch;
4. number and identity of processes at idle;
5. private or resident memory after a defined idle stabilization period;
6. peak memory during cold start;
7. memory with the main interface loaded;
8. memory during and after one bounded execution;
9. idle CPU usage;
10. cold-start and warm-start time;
11. network connections and bytes transferred while idle;
12. files, caches and persistent data created by first launch;
13. helper binary size and helper peak memory;
14. cleanup state after the application exits.

Measurements must use release builds on the same machine and operating-system
version when comparing shells. The procedure must document tooling, duration
and environmental conditions. At least five runs must be collected; the median
and worst observed result must be retained.

## 7. Shell decision gate

Before replacing Electron, Afila must build a minimal but representative spike
for each serious shell candidate.

A candidate may proceed only when it:

- preserves the required interface behavior;
- exposes no broader privileged API than necessary;
- does not weaken process isolation or update integrity;
- does not regress either installed size or steady-state memory and materially
  improves at least one of them;
- introduces no unexplained idle network or disk activity;
- has a viable signing, packaging and update path on every supported platform;
- has maintainable, testable and auditable dependencies.

The comparison must produce a follow-up ADR that selects the shell and records
hard budgets. Until then, claims that one shell is lighter are hypotheses, not
accepted architecture.

## 8. Execution-runtime decision gate

Candidate C must demonstrate, with fixed internal probes before user source is
connected:

- an engine-owned hard allocation limit;
- a demonstrated total helper-memory ceiling covering engine allocations,
  native allocations, stack, serialization and protocol buffers, and fixed
  runtime overhead;
- no unbounded dynamic allocation path outside the accounted memory budget;
- a maximum stack size;
- interruptibility of infinite loops;
- external process termination;
- bounded input, output and diagnostics;
- no filesystem, network, process or environment access;
- no optional standard or operating-system library linked into the user realm;
- deterministic cleanup after success, failure, timeout and memory exhaustion;
- acceptable helper binary size and peak memory;
- reproducible, signed builds for every supported platform.

Candidate C is not approved for production unless both the engine allocation
limit and the total helper-memory ceiling are demonstrated under adversarial
probes.

User-written source remains disconnected until these gates and the existing
ADR-0001 protocol and validation gates are satisfied.

## 9. Budget policy

The first reproducible Electron baseline and candidate-shell spikes will define
initial numerical budgets.

After those budgets are accepted:

- exceeding a hard budget blocks release;
- increasing a budget requires a reviewed ADR with a security or functional
  justification;
- normal feature work may not silently consume the remaining margin;
- CI and release validation must retain historical measurements.

The target is not merely to beat Electron. The target is the minimum practical
footprint compatible with Afila's complete security, privacy, integrity and
functionality requirements.

## 10. Consequences

### Positive

- Device health becomes an enforceable product property.
- Privacy defaults are explicit and testable.
- Shell and runtime choices are based on measurements.
- Security cannot be traded away for smaller binaries.
- Resource regressions become visible before release.

### Negative

- Release validation becomes more demanding.
- Native helpers and multiple platforms require dedicated measurements.
- Signing, notarization and reproducible packaging add operational work.
- The lightest acceptable architecture may require migration away from
  Electron.
- Numerical budgets cannot be finalized until representative baselines exist.

## 11. Next steps

1. Complete the macOS Candidate A memory-boundary evidence in PR #42.
2. Record the current Electron release baseline.
3. Build and measure representative shell spikes without deleting Electron.
4. Build and measure the fixed-probe Candidate C helper.
5. Select the desktop shell in a follow-up ADR.
6. Select or reject Candidate C in a separate execution-runtime ADR.
7. Establish hard release budgets from the accepted measurements.
