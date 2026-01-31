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
