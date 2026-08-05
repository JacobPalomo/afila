# ADR-0001: Prototype execution in a dedicated sandboxed renderer

**Status:** Accepted  
**Date:** 2026-07-31  
**Decision type:** Security architecture  
**Scope:** Compilation and local execution of user-written TypeScript solutions

> **Languages:** English | [Español](./0001-sandboxed-renderer-execution.es.md)  
> **Synchronization policy:** The English and Spanish versions must be updated
> in the same change. Any semantic difference blocks the change until it is
> clarified.

## 1. Context

Afila currently sends validated execution requests to a fresh Electron utility
process. That process applies lifecycle controls and returns deterministic
simulated results. It does not compile or execute user-written `sourceCode`.

The execution threat model requires real user code to remain outside the
Electron main process, Afila UI renderer, preload context and any unrestricted
Node.js realm.

This decision selects the architecture for the first adversarial prototype. It
does not approve production execution.

## 2. Decision summary

Afila will prototype real execution using two disposable stages:

1. A fresh Electron utility process transpiles one in-memory TypeScript source
   file into JavaScript.
2. A fresh hidden Chromium renderer executes that JavaScript with Chromium
   process sandboxing enabled and Node.js unavailable.

The main process remains the coordinator. It validates all messages, creates and
terminates both stages, enforces the external timeout and returns only a
validated `RunSolutionResponse`.

The renderer prototype is selected because it:

- Preserves Afila's TypeScript-only application code.
- Uses the Chromium sandbox already distributed with Electron.
- Avoids adding a separately signed native runtime during the first prototype.
- Supports macOS first while retaining a plausible Windows and Linux path.
- Can be created and destroyed for every accepted execution.

This decision is conditional. The renderer architecture must not be enabled for
production if the prototype cannot prove the mandatory acceptance gates,
especially reliable process separation, termination, network denial, ephemeral
storage and enforceable memory control.

## 3. Constraints

The selected prototype must preserve these project constraints:

- Electron desktop application.
- TypeScript application code.
- Local-first execution.
- No account or cloud dependency.
- macOS-first development.
- A future Windows and Linux path.
- One source file and one synchronous named entry point initially.
- No imports, package resolution, network access, timers or unresolved Promise
  results in the initial language mode.
- No fallback to execution in Node.js, preload, main or the Afila UI renderer.

## 4. Evaluation criteria

Each candidate is evaluated against:

1. Host capability isolation.
2. External CPU-time enforcement.
3. Memory enforcement.
4. Process-lifecycle control.
5. Network denial.
6. Filesystem denial.
7. Cross-platform packaging.
8. TypeScript-only compatibility.
9. Supply-chain surface.
10. Implementation and maintenance cost.
11. Testability in development and packaged builds.
12. Ability to fail closed.

## 5. Candidate A: dedicated sandboxed Chromium renderer

A hidden `BrowserWindow` or equivalent `WebContents` is created for one
execution and destroyed afterward.

Required renderer properties:

- `sandbox: true`
- `nodeIntegration: false`
- `nodeIntegrationInWorker: false`
- `nodeIntegrationInSubFrames: false`
- `contextIsolation: true`
- `webviewTag: false`
- `devTools: false`
- No preload script
- A unique non-persistent session partition
- Cache disabled
- A fixed local runner document
- No navigation, popup creation or permission grants
- Network requests denied by the dedicated session
- An external timeout owned by the main process
- Destruction of the renderer after completion or failure

### Advantages

- Chromium renderer processes use an operating-system-backed sandbox.
- A sandboxed renderer has no Node.js environment.
- Electron already packages Chromium on supported platforms.
- The implementation can remain within Electron and TypeScript.
- Main can observe renderer crashes and unresponsiveness.
- Main can forcefully terminate the renderer.
- A non-persistent partition can isolate browser storage for one execution.

### Risks

- Browser APIs create a larger capability surface than a minimal JavaScript
  engine.
- Chromium may share a renderer process between compatible `WebContents`.
- Forcefully terminating a shared renderer could affect another `WebContents`.
- Electron does not expose a direct hard per-renderer memory limit.
- Polling process memory is not equivalent to an operating-system hard limit.
- CSP and API removal are defense-in-depth controls, not the primary sandbox.
- Electron explicitly treats rendering untrusted content as a difficult area.
- A Chromium or Electron sandbox escape remains possible.

### Required proof

Before any source executes, the prototype must obtain the runner's
operating-system process ID and compare it with every other live `WebContents`
returned by `webContents.getAllWebContents()`, including the Afila UI, DevTools,
extension pages and any other hidden content.

The runner PID must be exclusive to the runner. Sharing it with any other live
`WebContents`, privileged or not, or an unverifiable process identity causes
`execution-failed`. The PID must be checked after the fixed document finishes
loading and again immediately before source execution. Initial concurrency is
limited to one execution.

## 6. Candidate B: standalone restricted runtime executable

Afila could package and launch a separate JavaScript runtime executable, such
as a carefully configured QuickJS-NG command-line binary.

### Advantages

- Separate operating-system process.
- External timeout and process-tree termination.
- QuickJS-NG provides command-line memory limits.
- Smaller runtime than Chromium.
- Prebuilt binaries exist for major platforms.

### Risks

- A generic command-line runtime is not a purpose-built Afila sandbox.
- Runtime standard libraries or module features can expose host capabilities.
- A second operating-system sandbox is still required.
- Binary acquisition, verification, signing and update policy become part of
  Afila's supply chain.
- Each CPU architecture needs a compatible packaged binary.
- Stdin, stdout, arguments and error output require strict byte limits.
- The generic CLI exposes more behavior than Afila needs.

### Result

Not selected for the first prototype. It adds native binary distribution
without providing the control of a purpose-built embedded helper.

## 7. Candidate C: embedded JavaScript engine in a restricted helper

Afila could build a dedicated helper executable that embeds a minimal
JavaScript engine such as QuickJS-NG and exposes only Afila's test API.

QuickJS-NG provides runtime APIs for memory limits, stack limits and interrupt
handlers. Its optional standard and operating-system libraries are separate
from the core engine and would not be linked into the helper.

### Advantages

- Small and explicit capability surface.
- Runtime memory and stack limits.
- Engine interrupt handler for cooperative timeout enforcement.
- External supervisor can still terminate the whole helper.
- No browser APIs.
- No Node.js APIs.
- Strong control over serialization and entry-point invocation.

### Risks

- Requires native C or C++ build and maintenance.
- Conflicts with the current TypeScript-only implementation constraint.
- Requires per-platform compilation, packaging, signing and testing.
- Introduces a new security-sensitive native component.
- Still requires operating-system sandboxing and external termination.
- Engine vulnerabilities become part of Afila's attack surface.

### Result

Not selected initially. It is the preferred fallback if Candidate A cannot
satisfy the production acceptance gates, especially hard memory control or
reliable dedicated-process termination.

## 8. Comparison

| Criterion                      | A: sandboxed renderer | B: runtime CLI                              | C: embedded helper                          |
| ------------------------------ | --------------------- | ------------------------------------------- | ------------------------------------------- |
| Node.js absent from user realm | Yes                   | Depends on runtime                          | Yes by design                               |
| OS process boundary            | Chromium sandbox      | Separate process; additional sandbox needed | Separate process; additional sandbox needed |
| External timeout               | Yes                   | Yes                                         | Yes                                         |
| Hard runtime memory control    | Unproven              | CLI-dependent                               | Strong engine API support                   |
| Browser capability surface     | High                  | None                                        | None                                        |
| Custom host API surface        | Medium                | Medium                                      | Low                                         |
| TypeScript-only app code       | Yes                   | Mostly; bundles native binary               | No                                          |
| Native build required          | No                    | Not if using prebuilt binaries              | Yes                                         |
| Cross-platform packaging cost  | Low                   | Medium                                      | High                                        |
| Initial implementation cost    | Medium                | Medium                                      | High                                        |
| Long-term security potential   | Medium, conditional   | Medium                                      | High                                        |
| Selected                       | Prototype             | No                                          | Fallback                                    |

## 9. Selected architecture

### 9.1 Main process

The main process:

- Authenticates the original renderer sender.
- Validates `RunSolutionRequest`.
- Enforces source, test-count and value limits.
- Applies a global execution concurrency limit of one initially.
- Creates a fresh compiler utility process.
- Validates compiler output.
- Creates a fresh sandboxed runner renderer.
- Confirms runner process separation before sending source.
- Starts the external execution timeout before user source can run.
- Validates the runtime result against the original request.
- Terminates and destroys all execution resources.
- Returns only a validated response.

The main process never parses with user-selected plugins, transpiles or executes
user code directly.

### 9.2 Compiler utility process

The compiler stage:

- Is created fresh for each accepted execution.
- Receives one bounded in-memory source string.
- Uses a pinned TypeScript compiler dependency.
- Does not read a user `tsconfig.json`.
- Does not load TypeScript plugins.
- Does not resolve imports or packages.
- Does not inspect arbitrary project files.
- Rejects all static imports, exports, dynamic imports and unsupported
  language features.
- Produces bounded JavaScript text plus bounded sanitized diagnostics.
- Has its own externally enforced timeout and heap limit.
- Is terminated after completion or failure.

The first prototype may use `ts.transpileModule` with diagnostics. This provides
single-file transformation and syntax diagnostics but does not provide complete
semantic type checking. Full in-memory type checking requires a later decision
with a fixed allowlist of bundled TypeScript standard-library declarations.

### 9.3 Runner renderer

The runner uses a new hidden renderer for every execution. Main creates
`runnerSession` as described in section 9.4 and passes that exact session
object directly to the window.

Its minimum configuration is:

```ts
{
  show: false,
  webPreferences: {
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    webviewTag: false,
    devTools: false,
    javascript: true,
    session: runnerSession
  }
}
```

No preload script is attached.

The runner loads a fixed document through an Afila-owned custom scheme. Scheme
privileges, if registered, are configured once before `app.ready`; the per-run
handler is registered on the dedicated session through
`runnerSession.protocol.handle`.

The scheme must not enable `standard`, `secure`, `bypassCSP`,
`allowServiceWorkers`, `supportFetchAPI`, `corsEnabled`, `stream`, `codeCache`
or `allowExtensions`. The fixed document uses no relative or remote resources
and sends a restrictive CSP that includes `script-src 'none'`,
`connect-src 'none'`, `worker-src 'none'`, `frame-src 'none'` and
`object-src 'none'`.

CSP is defense in depth. The prototype must verify that Electron's injected
execution still works while page-created scripts, workers and external
resources remain blocked.

### 9.4 Session restrictions

Afila owns one dedicated non-persistent runner session for the lifetime of the
application process:

```ts
const runnerSession = session.fromPartition("afila-sandbox-runner", {
  cache: false,
});
```

The session may be reused only sequentially under one exclusive lease. A new
BrowserWindow, WebContents, renderer operating-system process and isolated
JavaScript realm are still created for every execution.

The lease is released only after the runner is destroyed, all handlers are
removed, active connections are closed, session data and auxiliary caches are
cleared, and the session is inspected as empty.

Concurrent runner creation fails closed.

Any initialization, validation or cleanup failure permanently poisons the
session lease for the remainder of the application process. A poisoned session
cannot be reused until Afila restarts.

The session must:

- Deny every permission request and permission check.
- Install one centralized `webRequest.onBeforeRequest` deny policy.
- Cancel every request except the initial fixed runner document.
- Deny HTTP, HTTPS, WebSocket, FTP, loopback and localhost access.
- Deny subframes and external resources.
- Cancel downloads.
- Close active connections and remove request, permission and protocol handlers
  during cleanup.
- Clear cache and session data before releasing application references.
- Never use a `persist:` partition.
- Permit at most one active runner lease.
- Create a fresh window, WebContents, renderer process and JavaScript realm for
  every execution.
- Release the lease only after complete cleanup and empty-session inspection.
- Permanently poison the lease after any incomplete initialization or cleanup.

`webRequest` and CSP are defense-in-depth layers, not proof that every Chromium
transport is disabled. The prototype must separately test WebRTC,
`RTCDataChannel`, STUN/TURN, WebTransport and any transport not represented by a
normal URL request.

The prototype must also run a repeated-execution soak test and reject the design
if sessions, handlers, connections or renderer processes accumulate without a
bounded release path.

A 200-cycle development soak test using one reusable in-memory session created
200 distinct sandboxed renderer processes. Every runner window, WebContents and
renderer process was released, the application returned to its exact baseline
window and WebContents sets, and the final 50 cycles showed no monotonic private
memory growth.

Creating a new named partition for every execution was rejected because the
browser process retained approximately 1.2 MiB per new partition during the
diagnostic soak test.

### 9.5 Navigation and window restrictions

The runner must:

- Deny `window.open`.
- Prevent all navigation after the fixed runner document loads.
- Prevent frame creation or navigation outside the expected main frame.
- Disable `<webview>`.
- Reject downloads.
- Reject attempts to open external URLs.
- Never attach DevTools.

### 9.6 Source invocation

Main sends one generated execution script through
`webContents.executeJavaScriptInIsolatedWorld` using a dedicated nonzero world
ID that is not Electron's context-isolation world.

The generated script:

- Uses a fixed Afila wrapper in strict mode.
- Captures the required pristine built-ins before user code runs.
- Places transpiled user code inside a fresh lexical scope.
- Resolves exactly the requested named entry point.
- Clones test arguments before each invocation.
- Runs test cases sequentially.
- Rejects Promise results.
- Converts thrown values into bounded sanitized errors.
- Accepts only values allowed by `TestValue`.
- Applies depth, item-count, string-length and total-byte limits inside the
  runner.
- Never returns a raw user-created object across the process boundary.
- Returns only a bounded runner-owned envelope or bounded serialized string.
- Does not expose an Afila IPC bridge to the user realm.

The bounded envelope remains untrusted. Main must validate it structurally and
correlate its exact result count and test identifiers with the original
request. A getter, proxy trap, serializer failure or oversized value must fail
closed inside the external timeout.

### 9.7 Timeout and termination

The timeout is owned by the main process, outside the untrusted renderer.

On completion, timeout, crash, invalid response or message failure, main must:

1. Settle the request once.
2. Prevent any further result from being accepted.
3. Forcefully terminate the runner renderer when necessary.
4. Destroy its `BrowserWindow` or `WebContents`.
5. Remove session listeners and the per-run protocol handler.
6. Close active session connections and clear cache and session data.
7. Terminate the compiler utility process.
8. Confirm that no execution resource remains active.

A timeout inside the user realm is not a security control.

#### Development termination diagnostics

Afila includes a development-only diagnostic entry point for the sandbox
runner termination boundary. It accepts only fixed internal scripts and is
disabled in packaged applications.

On August 4, 2026, the Electron preview build on macOS produced the following
results:

- A fixed synchronous script completed normally in 48 ms.
- A fixed infinite loop reached the 250 ms external timeout and completed
  forced termination and cleanup in 296 ms.
- A forced renderer termination produced `render-process-gone` with reason
  `killed` and exit code `2`, completing cleanup in 162 ms.
- Every scenario restored the exact baseline BrowserWindow and WebContents ID
  sets.
- Every scenario confirmed that the runner BrowserWindow, WebContents and
  renderer operating-system process were no longer registered.

The reusable Session is released only after the runner window, WebContents and
captured renderer process identity have disappeared. A failed release check
invalidates the Session lease instead of allowing reuse.

These diagnostics validate the termination and resource-release protocol for
the tested development configuration. They do not establish equivalent
behavior for packaged builds or every supported operating system, do not enable
user-written source execution and do not demonstrate hard memory containment.

### 9.8 Memory control

The prototype may monitor the renderer process using its operating-system PID
and Electron process metrics.

This is only an experimental guard. It is not accepted as a hard memory limit.

Production execution remains disabled until one of these is demonstrated:

- A reliable hard memory limit for the dedicated renderer process.
- A platform-level memory boundary that can be applied and tested.
- A superseding architecture using the restricted embedded helper.

Failure to prove memory containment supersedes this ADR for production use.

## 10. Prototype acceptance gates

The prototype must demonstrate all of the following in development and packaged
builds:

### Process isolation

- The runner uses a different OS process from the Afila UI.
- The runner PID is not shared with any other live `WebContents`.
- PID exclusivity is checked after load and immediately before execution.
- A runner crash does not crash or freeze the UI.
- A timeout kills the runner and leaves no active execution process.

### Capability denial

User code cannot:

- Access `process`, `require`, Electron or Node.js globals.
- Read, write or enumerate host files.
- Read environment variables.
- Spawn a process or thread.
- Create a Worker, SharedWorker or ServiceWorker.
- Connect through `fetch`, XHR, WebSocket, EventSource, images, media, fonts,
  stylesheets, forms, frames, pings, beacons or `navigator.sendBeacon`.
- Create network-capable WebRTC objects, `RTCDataChannel`, STUN/TURN traffic or
  WebTransport sessions.
- Reach loopback or localhost services through any Chromium transport.
- Navigate the runner.
- Open a popup.
- Trigger a download.
- Access persistent cookies, IndexedDB, Cache Storage or local storage from a
  later execution.
- Communicate with the Afila UI renderer.

### Resource handling

- Infinite loops are externally terminated.
- Deep recursion cannot freeze the UI.
- Oversized output is rejected before a raw user value crosses the process
  boundary.
- Oversized errors are truncated and sanitized before crossing the process
  boundary.
- Late results are ignored.
- Memory-growth attacks are detected during the prototype.
- The team either proves a hard memory boundary or records Candidate A as
  unsuitable for production.

### Correct behavior

- Valid synchronous solutions execute correctly.
- Missing entry points fail safely.
- Syntax diagnostics are bounded and sanitized.
- Runtime errors are bounded and sanitized.
- Result IDs and count match the original tests exactly.
- Repeated executions do not share mutable state.
- The deterministic simulator remains available behind the implementation
  boundary until real execution is explicitly enabled.

## 11. Consequences

### Positive

- The first prototype stays inside the existing Electron and TypeScript stack.
- It adds no native helper to the initial implementation.
- The user realm has no Node.js environment.
- Chromium's sandbox supplies an operating-system-backed boundary.
- The architecture is disposable and testable.
- Candidate C remains available as a stronger fallback.

### Negative

- A hidden Chromium renderer has meaningful startup and memory overhead.
- Browser APIs require extensive denial tests.
- Hard memory containment is unresolved.
- Process sharing must be detected and treated as failure.
- The implementation depends on Electron and Chromium security behavior.
- Passing the prototype does not eliminate sandbox-escape risk.

## 12. Alternatives rejected for now

### Execute in the existing utility process

Rejected because it has Node.js capabilities and is not a sandbox for malicious
source.

### Use `node:vm`

Rejected because it is not a security boundary for untrusted code.

### Use a worker thread

Rejected because it shares the Node.js process security boundary.

### Bundle a generic QuickJS CLI immediately

Rejected because it adds binary supply-chain and packaging work without the
minimal capability surface of a purpose-built helper.

### Build the native helper immediately

Deferred because it conflicts with the TypeScript-only constraint and would
delay the adversarial prototype. It remains the fallback architecture.

## 13. Rollback and supersession

This ADR must be superseded if any mandatory acceptance gate cannot be met.

Candidate A must not be retained merely because implementation work has already
been invested.

The simulator remains the safe fallback. Afila must never fall back to Node.js
execution.

## 14. Implementation sequence after this ADR

1. Add runner-specific contracts and validators without executing source.
2. Add dedicated session and custom-protocol setup with deterministic cleanup.
3. Add the disposable sandboxed renderer factory.
4. Prove exclusive process identity and deterministic renderer termination.
5. Add permission, navigation, popup, download, worker and network-denial tests,
   including WebRTC and WebTransport.
6. Add repeated-execution soak tests for sessions, handlers and processes.
7. Add adversarial timeout, crash and memory-growth tests.
8. Add the disposable TypeScript compiler stage.
9. Execute fixed trusted JavaScript and bounded runner-owned responses.
10. Execute bounded user JavaScript behind a development-only feature flag.
11. Run the full adversarial acceptance suite in a packaged build.
12. Decide whether Candidate A may proceed or Candidate C must supersede it.

## 15. References

- Electron Process Sandboxing:
  https://www.electronjs.org/docs/latest/tutorial/sandbox/
- Electron Security:
  https://www.electronjs.org/docs/latest/tutorial/security
- Electron BrowserWindow:
  https://www.electronjs.org/docs/latest/api/browser-window
- Electron WebContents:
  https://www.electronjs.org/docs/latest/api/web-contents/
- Electron Session:
  https://www.electronjs.org/docs/latest/api/session
- Electron WebRequest:
  https://www.electronjs.org/docs/latest/api/web-request
- Electron Protocol:
  https://www.electronjs.org/docs/latest/api/protocol
- TypeScript Compiler API:
  https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- QuickJS-NG:
  https://quickjs-ng.github.io/quickjs/
- QuickJS-NG C API:
  https://quickjs-ng.github.io/quickjs/developer-guide/intro/
