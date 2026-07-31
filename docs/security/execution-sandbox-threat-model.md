# Execution Sandbox Threat Model

**Status:** Proposed  
**Date:** 2026-07-31  
**Scope:** Local execution of user-written TypeScript solutions

> **Languages:** English | [Español](./execution-sandbox-threat-model.es.md)  
> **Synchronization policy:** The English and Spanish versions must be
> updated in the same change. If they differ, the security requirements
> must be clarified before the change is merged.

## 1. Purpose

Afila accepts TypeScript source code written or pasted by a user and
evaluates it against local test cases.

The source code must always be treated as hostile, even when it was
entered by the owner of the computer. Pasted code, generated code,
shared solutions and accidental infinite computations can all threaten
the host application and operating system.

This document defines the security boundaries and minimum acceptance
criteria that must be satisfied before Afila executes real user-written
code.

It does not select a final sandbox implementation. Candidate runtimes
must be evaluated against these requirements in a separate architecture
decision.

## 2. Current architecture

The current execution path is:

1. The renderer submits an execution request through a restricted
   preload API.
2. The main process validates the IPC sender.
3. The main process validates the request payload.
4. A fresh Electron utility process is created for the request.
5. The main process and utility process communicate through a typed and
   runtime-validated protocol.
6. The utility process returns deterministic simulated results.
7. The main process validates the response.
8. The utility process is terminated.
9. The validated response is returned to the renderer.

The current utility process has a Node.js environment. It is an
execution supervisor and lifecycle boundary, not a security sandbox for
user code.

User-written `sourceCode` is currently transferred but is not compiled,
evaluated or executed.

## 3. Security objective

Executing a solution must not grant the solution any capability beyond
the explicitly defined programming challenge API.

A solution may:

- Receive cloned test arguments.
- Use an approved subset of the JavaScript language and standard
  built-ins.
- Return a serializable result.
- Throw a bounded error that can be converted into a safe result.
- Consume CPU and memory only within enforced limits.

A solution must not:

- Read or write files.
- Discover filesystem paths.
- Read environment variables.
- Access application state, drafts or problem data not included in the
  request.
- Access Electron or Node.js APIs.
- Load modules, packages or native addons.
- Start processes, workers or threads.
- Access the network.
- Open sockets or IPC channels.
- Use the system shell.
- Access the clipboard, camera, microphone or other device APIs.
- Persist data outside its isolated execution.
- Communicate with another execution.
- Modify the Afila renderer, preload or main process.
- Prevent the execution supervisor from terminating it.

## 4. Protected assets

The sandbox must protect:

### 4.1 Host data

- User files.
- Application data.
- Environment variables.
- Credentials, tokens and cookies.
- Browser and application storage.
- Clipboard contents.
- Operating-system configuration.

### 4.2 Application integrity

- Electron main process.
- Preload bridge.
- Renderer state.
- Installed application files.
- Problem catalog.
- Test cases.
- Stored solution drafts.
- Execution protocol.

### 4.3 Host availability

- CPU time.
- Memory.
- Process count.
- File descriptors.
- Network sockets.
- Disk capacity.
- IPC capacity.
- Renderer responsiveness.

### 4.4 Result integrity

- Test identifiers.
- Test order.
- Expected values.
- Actual values.
- Execution status.
- Error messages.
- Timing information.

## 5. Trust assumptions

The following values are untrusted:

- User source code.
- Function names received through IPC.
- Test arguments received across a process boundary.
- Results returned by an execution runtime.
- Error names, messages and stack traces.
- Compiler diagnostics.
- Serialized values.
- Process exit codes.
- Messages received after an execution has settled.

The following components are trusted within this threat model:

- The packaged Afila application.
- The Electron main process.
- The restricted preload bridge.
- Request and response validators.
- The selected compiler and runtime binaries after dependency review.
- The operating system and its process-isolation primitives.

Trusting a component does not remove the need to validate every message
that crosses a process boundary.

## 6. Attacker capabilities

An attacker may submit source code designed to:

- Loop forever.
- Allocate memory until exhaustion.
- Produce extremely deep or large values.
- Generate very large strings or error messages.
- Trigger parser, compiler or runtime edge cases.
- Modify built-in prototypes.
- Escape a language context.
- Access Node.js globals.
- Dynamically load code.
- Discover host objects through prototype chains.
- Create asynchronous work that survives the entry-point call.
- Race process startup, timeout and termination.
- Forge execution results.
- Reuse or mismatch request identifiers.
- Exploit stale messages from an earlier execution.
- Cause abnormal process termination.
- Exploit vulnerabilities in the compiler or runtime.

The attacker does not need access to Afila's source code or filesystem.
The submitted solution alone is considered sufficient attacker input.

## 7. Trust boundaries

### Boundary A: renderer to preload

The renderer may call only narrowly scoped methods exposed by the
preload bridge.

Raw Electron IPC APIs must never be exposed.

### Boundary B: preload to main

The main process must authenticate the sender, frame and renderer URL.

Every request must pass runtime validation before any process is
created.

### Boundary C: main to compiler

TypeScript source must be treated as data.

Compilation must not occur in the main process or renderer.

The compiler stage must be disposable and resource-limited. It must not
load:

- Project configuration files.
- TypeScript plugins.
- Arbitrary modules.
- Package exports.
- Ambient project source files.
- User-controlled compiler extensions.

The initial language mode must operate on one in-memory source file and
must not perform module resolution.

### Boundary D: compiler to runtime

Only compiler output and explicit execution metadata may cross this
boundary.

Compiler objects, functions, prototypes and host references must never
be transferred.

### Boundary E: runtime to supervisor

The runtime response is untrusted.

It must be validated for:

- Message type.
- Request identifier.
- Result count.
- Unique test identifiers.
- Allowed statuses.
- Finite durations.
- Value depth.
- Value type.
- Message length.
- Sparse arrays.
- Unsupported prototypes.

### Boundary F: supervisor to renderer

Only a validated `RunSolutionResponse` may reach the renderer.

Raw process errors, diagnostic reports and unrestricted stack traces
must not be exposed.

## 8. Threats and mandatory controls

| Threat                  | Example                               | Mandatory controls                                                         |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| Arbitrary host access   | `process.env`, `require('node:fs')`   | User code executes in an environment without Node or Electron capabilities |
| Filesystem access       | Reading SSH keys or drafts            | No filesystem capability; deny by runtime and operating-system boundary    |
| Network access          | Exfiltrating source or credentials    | No network APIs; deny sockets and browser networking                       |
| Process creation        | Spawning a shell                      | No process APIs; no shell invocation; deny child-process capability        |
| Dynamic code loading    | `eval`, `Function`, dynamic import    | Remove or reject dynamic-code facilities and module loading                |
| CPU exhaustion          | Infinite loop                         | External wall-clock timeout enforced by the supervisor                     |
| Memory exhaustion       | Unbounded arrays or strings           | Per-execution memory limit and process termination                         |
| Output exhaustion       | Huge return values or errors          | Serialization, depth, item-count and byte-size limits                      |
| Process flooding        | Repeated parallel submissions         | Concurrency limit and one supervised runtime per accepted execution        |
| Prototype manipulation  | Replacing built-in methods            | Fresh runtime per execution and no shared mutable realm                    |
| Runtime persistence     | Pending timers after return           | Terminate the runtime after the response; no reusable user realm           |
| Forged response         | Fake test IDs or statuses             | Runtime validation and request-ID correlation                              |
| Stale messages          | Previous process responds late        | Single-settlement guard; ignore all post-settlement events                 |
| Compiler abuse          | Pathological TypeScript input         | Compiler timeout, source-size limit and disposable process                 |
| Sandbox escape          | Runtime vulnerability                 | Defense in depth, dependency updates and an OS-backed process boundary     |
| Information leakage     | Host paths in stack traces            | Sanitize diagnostics, errors and filenames before returning them           |
| UI compromise           | Running source in the editor renderer | Never evaluate user code in the Afila UI renderer or preload               |
| Main-process compromise | Compilation or execution in main      | Main coordinates only; no parsing plugins, compilation or evaluation       |
| Cross-execution leakage | Shared globals or caches              | Fresh isolated runtime and explicit cloned inputs per execution            |

## 9. Mandatory resource limits

Before real execution is enabled, the implementation must enforce:

- Maximum source-code length.
- Maximum test-case count.
- Maximum argument and result depth.
- Maximum serialized request size.
- Maximum serialized response size.
- Maximum error-message size.
- Maximum compiler wall-clock duration.
- Maximum execution wall-clock duration.
- Maximum runtime memory.
- Maximum concurrent executions.
- Maximum queued executions.
- Maximum result count.
- Maximum number of asynchronous tasks, preferably zero in the initial
  synchronous language mode.

A timeout implemented inside the same JavaScript realm as the untrusted
code is insufficient. The supervisor must be able to terminate the
entire runtime externally.

## 10. Initial language restrictions

The first real execution version should support a deliberately small,
synchronous subset:

- One in-memory TypeScript source file.
- One required named entry point.
- No imports.
- No exports required by the user.
- No package resolution.
- No filesystem-backed module resolution.
- No dynamic import.
- No `require`.
- No `eval`.
- No `Function` constructor.
- No WebAssembly compilation.
- No workers.
- No child processes.
- No network APIs.
- No timers.
- No top-level asynchronous execution.
- No unresolved Promise as a result.

Additional language capabilities must be introduced explicitly and
threat-modeled before they are enabled.

## 11. Rejected security boundaries

The following mechanisms are not sufficient as the primary sandbox:

### 11.1 Electron utility process alone

An Electron utility process has Node.js integration. Process separation,
timeouts and heap limits improve resilience but do not remove host
capabilities from malicious JavaScript.

The utility process may remain the execution supervisor, but user source
must not be evaluated directly in its Node.js realm.

### 11.2 `node:vm`

A separate V8 context is not a security boundary for untrusted code.

`node:vm` must not be used as Afila's sandbox.

### 11.3 Node.js Permission Model alone

The Permission Model may be evaluated as defense in depth for trusted
compiler or supervisor code.

It must not be treated as protection against malicious user code.

### 11.4 Worker thread alone

A worker shares the host process security boundary. Resource limits and
thread termination do not prevent access to Node.js capabilities or
protect the parent process from a runtime escape.

### 11.5 In-process JavaScript interpreter alone

An embedded interpreter without an operating-system process boundary
would make a vulnerability in that interpreter a vulnerability in the
Afila process.

An embedded engine may be considered only inside a disposable,
externally supervised process.

## 12. Candidate architecture classes

The following classes require a separate architecture decision and
prototype:

### Candidate A: sandboxed Chromium renderer

A dedicated renderer could provide:

- Chromium process sandboxing.
- No Node.js integration.
- A separate process from the Afila UI.
- External termination through `webContents`.

It would also require proof that:

- All networking is blocked.
- Navigation and popup creation are blocked.
- No preload exposes privileged APIs.
- Browser storage is unavailable or ephemeral.
- Permissions are denied.
- User code cannot reach the Afila UI origin.
- Timeouts and memory failures terminate the renderer reliably.

### Candidate B: standalone restricted runtime helper

A separate helper executable could host a JavaScript engine without
Node.js APIs.

It would require:

- Cross-platform packaging.
- Operating-system sandboxing.
- Strict stdin/stdout or message protocol.
- Process-tree termination.
- Runtime and compiler supply-chain review.
- Memory and CPU enforcement on every supported platform.

### Candidate C: embedded engine in a restricted helper process

A small JavaScript engine could run inside a disposable helper process.

The helper must still be considered hostile after receiving user source
and must be constrained by operating-system process controls.

## 13. Acceptance tests

Real execution must remain disabled until automated or reproducible tests
demonstrate that source code cannot:

- Read an arbitrary file.
- Write a file.
- List directories.
- Read environment variables.
- Access Node.js globals.
- Import built-in or installed modules.
- Spawn a process.
- Start a worker.
- Open a network connection.
- Reach localhost services.
- Open a window or navigate.
- Access persistent browser storage.
- Access another execution's state.
- Return unsupported prototypes.
- Return sparse arrays.
- Return non-finite numbers.
- Return an oversized result.
- Produce an oversized error.
- Continue running after timeout.
- Leave a child process alive.
- Freeze the Afila renderer.
- Crash the Electron main process.

The test suite must also verify:

- Valid synchronous solutions still execute correctly.
- Compiler errors are sanitized and bounded.
- Runtime errors are sanitized and bounded.
- Request identifiers cannot be forged.
- Late messages are ignored.
- Every execution process exits or is terminated.
- Development and packaged builds behave consistently.

## 14. Fail-closed requirements

Any ambiguous condition must result in `execution-failed`.

Examples include:

- Compiler timeout.
- Runtime timeout.
- Invalid compiler output.
- Invalid runtime response.
- Unexpected process exit.
- Message-delivery failure.
- Request-ID mismatch.
- Unknown result status.
- Unsupported value.
- Failed process termination.
- Missing sandbox capability.
- Platform-specific sandbox initialization failure.

Afila must never silently fall back to executing source in the main
process, renderer, preload or an unrestricted Node.js process.

## 15. Security invariants

The following invariants must remain true:

1. User source never executes in the Electron main process.
2. User source never executes in the Afila renderer.
3. User source never executes in the preload context.
4. User source never executes directly in a Node-enabled utility-process
   realm.
5. Compilation never loads user-selected modules or plugins.
6. Every execution uses a fresh isolated runtime.
7. Every process-boundary message is validated.
8. Every execution has externally enforced time and memory limits.
9. Every execution process is reaped.
10. No execution response is trusted before validation.
11. No sandbox failure causes a less restricted fallback.
12. Real execution remains disabled until all acceptance gates pass.

## 16. Non-goals

This threat model does not claim to protect against:

- A compromised operating system.
- A malicious administrator with control of the machine.
- A compromised signed Afila binary.
- A vulnerability in Electron, Chromium, the selected runtime or the
  operating system that defeats all configured isolation.
- Microarchitectural side channels.
- Denial of service created by the user repeatedly launching Afila
  outside the application's own concurrency controls.

Supply-chain security, dependency pinning, code signing and application
updates remain required but are tracked separately.

## 17. Decision gates

Before implementation of real execution:

1. Compare candidate architecture classes.
2. Select the runtime and compiler boundary.
3. Document the decision in an architecture decision record.
4. Build a minimal adversarial prototype.
5. Run all acceptance tests in development and packaged builds.
6. Review process lifecycle and termination behavior.
7. Review platform differences.
8. Approve the sandbox design before connecting it to the renderer.

Until these gates are complete, the deterministic simulator remains the
only execution implementation.

## 18. References

- Electron Security:
  https://www.electronjs.org/docs/latest/tutorial/security
- Electron Process Sandboxing:
  https://www.electronjs.org/docs/latest/tutorial/sandbox/
- Electron Context Isolation:
  https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron Utility Process:
  https://www.electronjs.org/docs/latest/api/utility-process
- Node.js VM:
  https://nodejs.org/api/vm.html
- Node.js Permissions:
  https://nodejs.org/api/permissions.html
