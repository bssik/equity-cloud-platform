# Week 3 Foundations: Identity, Storage & Resilience

This document breaks down the new concepts introduced while adding Authentication and Robustness to the backend.

## 1. Python Concept: `@dataclass`

You asked about this snippet:

```python
@dataclass(frozen=True)
class UserContext:
    user_id: str
    user_details: Optional[str] = None
```

### What is it?
In standard Python, creating a class just to hold data requires writing a lot of boilerplate code (an `__init__` method to assign variables, a `__repr__` method to print it nicely, etc.).

**`@dataclass`** is a code generator. It automatically writes those methods for you behind the scenes based on the type hints you provide.

### What is `frozen=True`?
This makes the object **Immutable** (Read-Only). Once you create a `UserContext`, you cannot change its `user_id`.

**Why use it here?**
Security context should never be tampered with. Passing a "Frozen" object around the system guarantees that a function further down the chain (like the Repository) can't accidentally (or maliciously) change the User ID to access someone else's data.

### New Concept: Thread Safety (`threading.Lock`)
We also added locks in the caching layer:
```python
with self._cache_lock:
    self._cache[key] = value
```
*   **The Problem:** Azure Functions can process multiple requests at once (Concurrency).
*   **The Fix:** The "Lock" ensures only one request writes to the cache at a time, preventing data corruption (Race Conditions).

---

## 2. Architecture Concept: "Routes" for Auth

You noticed we touched "Routes" in two different places. Here is the difference:

### A. The "Bouncer" (`staticwebapp.config.json`)
We added this config:
```json
{
  "route": "/api/watchlists*",
  "allowedRoles": ["authenticated"]
}
```
**Role:** **Infrastructure-Level Gatekeeper.**
Before the request even reaches your Python code, Azure checks if the user is logged in. If they aren't, Azure blocks them immediately (401 Unauthorized). Your Python code doesn't even wake up. This saves compute power and adds a layer of defense.

### B. The "Receptionist" (`function_app.py`)
We added this code:
```python
@app.route(route="watchlists", ...)
def watchlists(req):
    user = get_user_context_from_headers(req.headers)
```
**Role:** **Application-Level Handler.**
Once the Bouncer lets them in, the Function App (Receptionist) needs to know *specifically who they are*. It reads the "ID Badge" (headers) passed by Azure to determine which user's data to load.

---

## 3. Database Strategy: Multi-Tenancy

We moved from a "Global List" to "Per-User Lists" using Azure Table Storage.

### The PartitionKey Pattern
In `watchlist_repository.py`:
```python
self._table.upsert_entity({
    "PartitionKey": user_id,  # <--- CRITICAL
    "RowKey": watchlist_id,
    ...
})
```
*   **PartitionKey (`user_id`):** Groups all data for one user together. It enables "Multi-tenancy" (hosting millions of users in one table) efficiently.
*   **Isolation:** A query for User A's partition physically cannot see User B's data.

---

## 4. Pattern: Resilience (Retry & Cache)

We upgraded `FinnhubService` to handle the real world, where APIs fail and quotas exist.

### A. HTTP Session Reuse
*   **Concept:** Instead of opening a new connection for every call, we keep one `requests.Session()` open.
*   **Benefit:** Faster requests (no repeated SSL handshakes).

### B. The "Retry" Loop (Transient Fault Handling)
**Problem:** Sometimes the internet blips, or Finnhub is overloaded for 100ms.
**Solution:** Instead of crashing immediately, we try again with a "Jittered Backoff" (wait a random amount of time so we don't hammer the server).

### C. The "TTL Cache" (Time-To-Live)
**Problem:** Finnhub costs money or has strict limits (e.g., 60 calls/minute).
**Solution:** If we asked for "Apple's Profile" 5 seconds ago, don't ask Finnhub again. Remember the answer for 60 seconds.

---

## 5. Security & Availability: Handling Dependencies

We encountered an issue where the app threw a generic `500 Internal Server Error` when Watchlist storage wasn't configured.

### The "Fail Gracefully" Pattern
**The Fix:** We changed the `500` to a `503 Service Unavailable`.
**Why?**
- **500** means "We wrote bad code that crashed."
- **503** means "The code is fine, but a dependency (Database/API) is missing or down."
- This distinction helps SREs (Site Reliability Engineers) react faster. If it's a 503, they check the infrastructure configuration. If it's a 500, they wake up the developers.

### Secret Management Learning
**Lesson:** Never paste API keys in chat or commit them to git.
**Action:** Any key exposed in chat must be rotated immediately. In Azure, these live in **App Settings**, injected into the app as Environment Variables (`os.environ`).

## 6. Infrastructure: Managed Storage vs. Local Emulation

We hit a wall where watchlists worked locally but failed in the cloud.

### The "ReadOnly" Trap
**Scenario:** Locally, we saved JSON files to disk. In Azure, the Function App file system is often Read-Only (or ephemeral/wiped on restart).
**The Fix:** We added logic to *detect* the environment.
*   **Locally:** Use a file (fallback).
*   **Azure:** Force the use of Azure Table Storage.

### Config vs. Code
The error `503 Service Unavailable` now tells us: *'The code works, but you haven't given me a place to store data.'*
This separates **Application Logic** (Pyton code) from **Operational Configuration** (Environment Variables). We don't change the code to fix the storage; we just set the `AzureWebJobsStorage` connection string in the Azure Portal.



## 5. Pattern: The "Data Fallback" (Macro Calendar)

**Problem:** Good data (Economic Calendar) is often behind a paywall (Premium).
**Solution:** Rely on a **Curated Source** (our own JSON file) as the primary truth, and treat the API as a "Best Effort" enhancement.

*   **Primary:** `api/data/macro_calendar.json` (Free, controlled by us, always works).
*   **Secondary:** Finnhub API (might fail, might be empty).

This ensures the "Catalysts" feature always shows *something* valuable, even if our API credits run out.

*   **The Problem:** High-quality Macro data is expensive/premium.
*   **The Pattern:**
    *   **Core Truth:** `macro_calendar.json` (Local file). Free, reliable, curated by us.
    *   **Enhancement:** Finnhub API. "Nice to have" if available.
    *   **Degradation:** If Finnhub fails, the UI still renders the Core Truth, just without the extra "sparkle". This is "Graceful Degradation".

## 7. Resilience Pattern: Lazy Initialization

We hit a crash (`500 Error`) on the Catalysts page because `CatalystsService` was trying to connect to Azure Storage immediately upon creation, even though the user only wanted general market news (which doesn't need storage).

### The Eager Loading Bug
```python
# Bad: Crashes instantly if Watchlist config is missing
def __init__(self):
    self._watchlists = WatchlistService() # <--- Connects to DB immediately
```

### The Lazy Fix
```python
# Good: Only attempts connection when actually needed
def __init__(self):
    self._watchlists = None

def get_catalysts(self, ...):
    if user_wants_watchlists:
        if not self._watchlists:
             self._watchlists = WatchlistService() # <--- Late Binding
```

**Why this matters:**
This is crucial for **cloud reliability**. It allows parts of your application ("General Market News") to remain healthy (Returns 200 OK) even if other subsystems ("Watchlists") are misconfigured or down (Returns 503). This partial availability prevents a total system outage.

## 8. Tooling: The Hidden "PATH"

We struggled to run `az` commands because the Azure CLI was installed but not "visible" to our Git Bash terminal.

### The Problem
When you type `az`, the terminal looks through a list of folders stored in the `$PATH` environment variable. If the install folder (`.../Azure/CLI2/wbin`) isn't in that list, the terminal says "command not found", even if the file exists on disk.

### The "Find & Fix"
1.  **Locate:** We searched standard Program Files folders to find the actual `az` binary.
2.  **Export:** We temporarily added it to the session: `export PATH="/path/to/cli:$PATH"`.

## 9. Architecture Case Study: The "Managed Environment" Trap

We encountered a complex configuration issue when deploying the Watchlists feature. Here is the breakdown of the problem and our architectural solution.

### Phase 1: The Misconception (Standalone vs. Managed)
We initially configured a **Standalone Function App** (`func-equitycloud-dev-weu`), assuming the frontend would talk to it.
*   **Reality:** Azure Static Web Apps (SWA) automatically detects the `api/` folder and deploys it as a **Managed Function** *inside* the SWA resource.
*   **Result:** Our keys lived in the Standalone App, but our code ran in the SWA. They were two strangers in different houses.

### Phase 2: The Block (Platform Constraints)
Once we realized we needed to configure the SWA (`stapp-equity-web`), we tried adding `AzureWebJobsStorage` to its Environment Variables.
*   **Error:** "This setting name is not allowed."
*   **Reason:** `AzureWebJobsStorage` is a reserved system key in Managed Environments. Azure prevents manual overrides to ensure it can manage the underlying infrastructure upgrades.

### Phase 3: The Solution (The Alias Pattern)
Since we couldn't force the platform to accept the reserved name, we changed the **Application Architecture** to be flexible.

We updated `watchlist_repository.py` to use a **Priority Lookup**:
```python
connection_string = (
    os.environ.get("EQUITY_STORAGE_CONNECTION")  # 1. Custom Alias (Bypasses Restrictions)
    or os.environ.get("AzureWebJobsStorage")     # 2. Standard System Key (Default)
)
```

**Outcome:** We set `EQUITY_STORAGE_CONNECTION` in the SWA Portal. The code sees it, connects to the database, and the platform remains happy.

### Diagnostic Checklist
To know if you are using Managed or Linked functions:
1.  **Check URL:** `...azurestaticapps.net/api/` = Managed. `...azurewebsites.net/api/` = Standalone.
2.  **Check Portal:** SWA Resource → APIs. "No linked backend" = Managed.

### Environment Variable Propagation Issue (Dev Environments)
We discovered that environment variables set via **Azure Portal** or **Azure CLI** don't always propagate to SWA preview/dev environments reliably.

**The Problem:**
- Variables set on the SWA resource (`stapp-equity-web`) appeared in `az staticwebapp appsettings list`.
- The Python runtime in the **dev** environment (`-dev.westeurope...`) couldn't see them.
- The **production** environment (default hostname) saw them fine.

**How we proved it (no guessing):**
- `/api/health` showed `alpha_vantage: true` but `finnhub: false` and `watchlists_storage: false` even after setting those values.
- We added a temporary diagnostic endpoint (`/api/debug/env`) that returns **presence booleans** (and lengths) for key settings.
    - In `develop`/dev (`...-dev.westeurope...`), it reported `FINNHUB_API_KEY: false` and `EQUITY_STORAGE_CONNECTION: false`.
    - In `main`/default (`...azurestaticapps.net`), it reported all `true`.

This tells us the problem was not “bad code” or “wrong connection string”, but **the runtime environment not receiving the settings**.

**What we learned (important nuance):**
- **SWA Environments are separate runtimes.** The `dev` environment is its own environment (branch-linked), not just a UI label.
- **App Settings propagation is not symmetric.** Even when `az staticwebapp appsettings list` shows values, the `dev` runtime may still not see them.
- **GitHub Actions `env:` is not the same as runtime env.** Setting `env:` on the deploy step can help the *build step* and tooling, but it does not reliably become an environment variable inside the Managed Functions runtime.

**The Fix (what actually worked):**
1. Treat `main` / default hostname as the authoritative “configured runtime” for Managed Functions.
2. Configure secrets on the **Static Web App** resource (Portal/CLI) and validate them via `/api/health` (and, temporarily, `/api/debug/env`).
3. Promote fixes to production by merging `develop` → `main` so the default environment runs the same code that reads the settings.

**Recommended playbook going forward:**
- For reliable full-stack dev testing with secrets: use local emulation (`swa start ... --api-location api`) where `.env`/`local.settings.json` behavior is predictable.
- If we need truly reliable non-prod cloud environments with distinct app settings: switch to a **Linked Backend** (Standalone Function App) where settings are first-class and can be isolated per environment/slot.

### The "Mock Data" Misconception
Watchlists **require** persistent storage by design. There is no "mock mode" for CRUD operations because:
- User A's watchlist must remain separate from User B's.
- Data must survive restarts.
- This is a **stateful** feature.

Other features (like General Market catalysts) work without storage because they're **stateless** — they pull from APIs or static files and don't need to remember anything between requests.


