# macOS memory-boundary research

> **Languages:** English | [Español](./README.es.md)

## Purpose

These probes investigate whether public macOS resource-limit APIs can provide
a hard memory boundary for Afila's sandboxed renderer, identified as Candidate
A in ADR-0001.

They do not execute user-written source and are not part of the packaged
application.

## Tested environment

Test date: 2026-08-05

```text
ProductName: macOS
ProductVersion: 26.5.2
BuildVersion: 25F84
Architecture: arm64
Apple clang version: 21.0.0
Target: arm64-apple-darwin25.5.0
```

## Probes

### `macos-rlimit-probe.c`

This probe:

1. measures the initial virtual and resident memory;
2. sets `RLIMIT_AS` to the current virtual size plus 64 MiB;
3. allocates and touches 16 MiB;
4. attempts to allocate another 96 MiB.

Observed result:

```json
{
  "available": true,
  "rssIsAs": true,
  "baselineVirtualBytes": 445745856512,
  "baselineResidentBytes": 1327104,
  "headroomBytes": 67108864,
  "requestedLimitBytes": 445812965376,
  "underLimitAllocationBytes": 16777216,
  "underLimitSucceeded": true,
  "overLimitAllocationBytes": 100663296,
  "overLimitSucceeded": false,
  "overLimitErrno": 12,
  "overLimitMessage": "Cannot allocate memory",
  "finalVirtualBytes": 445762633728,
  "finalResidentBytes": 18104320
}
```

The process exited with code `0`.

This demonstrates that `RLIMIT_AS` can reject new virtual allocations that
exceed the installed limit.

### `macos-rlimit-prereserved-probe.c`

This probe:

1. reserves 192 MiB of virtual address space before installing `RLIMIT_AS`;
2. installs a limit with only 64 MiB of additional headroom;
3. makes 128 MiB resident inside the previously reserved region;
4. attempts a new 96 MiB allocation.

Observed result:

```json
{
  "baselineVirtualBytes": 445746380800,
  "baselineResidentBytes": 1343488,
  "existingReservationBytes": 201326592,
  "existingTouchBytes": 134217728,
  "virtualBytesAfterReservation": 445947707392,
  "residentBytesAfterReservation": 1343488,
  "limitHeadroomBytes": 67108864,
  "requestedLimitBytes": 446014816256,
  "virtualBytesAfterTouch": 445947707392,
  "residentBytesAfterTouch": 135561216,
  "residentGrowthBytes": 134217728,
  "newAllocationBytes": 100663296,
  "newAllocationSucceeded": false,
  "newAllocationErrno": 12,
  "newAllocationMessage": "Cannot allocate memory"
}
```

The process exited with code `0`.

## Security conclusion

`RLIMIT_AS` limits virtual-address-space growth through new allocations, but it
does not limit resident-memory growth inside regions that existed before the
limit was installed.

In the second probe, the permitted headroom was 64 MiB, while resident memory
grew by 128 MiB inside a previously reserved region.

Therefore, `RLIMIT_AS` alone does not satisfy Afila's acceptance gate for a
hard renderer memory boundary.

Candidate A is not approved for production execution on macOS. The existing
renderer may remain as a prototype for isolation, capability denial, timeout
and termination, but user-written source remains disconnected.

Candidate C, a minimal JavaScript engine embedded in a restricted native
helper, must be evaluated as the successor for real execution. This conclusion
does not select Afila's future desktop shell.

## Research limitations

The probes:

- test small native processes, not a complete Chromium renderer;
- do not prove that every possible macOS boundary is infeasible;
- do prove that `RLIMIT_AS` does not constrain resident memory inside
  pre-existing mappings;
- do not evaluate Windows or Linux;
- do not approve Candidate C yet;
- do not execute user-written source.

## Reproduction

Build:

```bash
xcrun clang \
  -std=c17 \
  -O2 \
  -Wall \
  -Wextra \
  -Wpedantic \
  -Werror \
  tools/memory-boundary/macos-rlimit-probe.c \
  -o /tmp/afila-macos-rlimit-probe

xcrun clang \
  -std=c17 \
  -O2 \
  -Wall \
  -Wextra \
  -Wpedantic \
  -Werror \
  tools/memory-boundary/macos-rlimit-prereserved-probe.c \
  -o /tmp/afila-macos-rlimit-prereserved-probe
```

Run:

```bash
/tmp/afila-macos-rlimit-probe
echo "exit: $?"

/tmp/afila-macos-rlimit-prereserved-probe
echo "exit: $?"
```

Compiled binaries are written to `/tmp` and must not be committed.
