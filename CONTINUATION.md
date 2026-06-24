# Java Interview Hub — Continuation Guide & Expansion Roadmap

> Read this before touching `curriculum.js`. It tells you exactly what's done, what's pending, and the rules you must follow.

---

## Quick start on any machine

```bash
git clone https://github.com/RajaSuriyaS/java-interview-hub.git
cd java-interview-hub
npm install
npm start          # http://localhost:3030
```

Verify content at `http://localhost:3030/api/stats` — shows version hash + word count per module.

---

## Current data model

Each module supports **sections** for sub-navigation (app.js already handles this):

```javascript
{
  id: '1.1',
  title: 'JVM Architecture',
  hours: 4,
  sections: [
    {
      title: 'JVM Overview & Bytecode',       // shown as pill button
      notes: `...800-1000 word markdown...`,  // Study Guide tab
      code: [{ lang: 'java', title: '...', code: `...` }],  // Code Sandbox (2-3 examples)
      flashcards: [{ q: '...', a: '...' }]   // Flashcards tab (8-10 cards)
    },
    // 3-5 sections per module
  ]
}
```

Old flat format (`notes/code/flashcards` directly on module) still works — app.js handles both.  
**The goal:** convert every flat module to sections with deep per-section content.

---

## Template literal safety — CRITICAL

All `notes` strings are backtick template literals. Breaking this crashes the entire file:

| Wrong | Correct |
|---|---|
| `${DB_URL}` inside notes | `\${DB_URL}` |
| `` `127.0.0.1` `` inside notes | `` \`127.0.0.1\` `` |
| ` ```java ``` ` inside notes | `` \`\`\`java ... \`\`\` `` |

**Validate after every edit:**
```bash
node --check public/js/curriculum.js
node -e "
  const fs=require('fs');
  const src=fs.readFileSync('public/js/curriculum.js','utf8').replace('const CURRICULUM','global.CURRICULUM');
  eval(src);
  const ids=CURRICULUM.flatMap(p=>p.modules.map(m=>m.id));
  const dupes=ids.filter((x,i)=>ids.indexOf(x)!==i);
  console.log('OK:', CURRICULUM.length, 'phases,', ids.length, 'modules', dupes.length?'DUPES:'+dupes:'');
"
```

---

## Section content targets (per section)

| Item | Target |
|---|---|
| `notes` | **800–1000 words** — from basics to advanced, ASCII diagrams, callouts |
| `code` | **2–3 runnable Java examples** focused on THIS section only |
| `flashcards` | **8–10 cards** covering THIS section's key concepts |

Use callouts liberally:
- `> [!TIP]` — helpful insight
- `> [!WARNING]` — common mistake / gotcha
- `> [!EU]` — what European senior interviewers specifically look for
- `> [!SUCCESS]` — strong answer pattern

---

## Expansion Roadmap

Legend: ✅ Done (has sections, 800w+/section) · 📝 Has content, needs sectioning · ⏳ Needs full expansion + sectioning

---

### Phase 1 — JVM Internals & Runtime

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 1.1 JVM Architecture | 2163w flat, 3 examples, 9 cards | 📝 Section it | **1.** JVM Overview & Bytecode (800w) · **2.** ClassLoader Lifecycle (900w) · **3.** Runtime Memory Areas (900w) · **4.** Execution Engine & JIT (800w) |
| 1.2 Garbage Collection | 1866w flat, 3 examples, 9 cards | 📝 Section it | **1.** GC Fundamentals & Object Reachability (800w) · **2.** Generational GC & Collection Types (900w) · **3.** Modern GC Collectors: G1, ZGC, Shenandoah (900w) · **4.** GC Tuning & Diagnosing Leaks (800w) |
| 1.3 Java Memory Model | 1624w flat, 3 examples, 7 cards | 📝 Section it | **1.** Visibility Problem & CPU Caches (800w) · **2.** Happens-Before & volatile (900w) · **3.** synchronized, Locks & Atomics (900w) · **4.** Safe Publication & Immutability (800w) |
| 1.4 JIT Compilation | 1485w flat, 3 examples, 7 cards | 📝 Section it | **1.** Why Interpretation is Slow (800w) · **2.** Tiered Compilation: C1 & C2 (800w) · **3.** Key JIT Optimisations (900w) · **4.** Profiling & Measuring JIT (800w) |

**Rule for Phase 1:** Do NOT split existing content and spread it thin. Each section gets its OWN 800–1000 words — expand the existing flat notes into deeper, richer per-section content.

---

### Phase 2 — Core & Modern Java (8 → 21)

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 2.1 Collections | 1671w flat, 3 examples, 8 cards | 📝 Section it | **1.** List Internals: ArrayList vs LinkedList (800w) · **2.** HashMap: Buckets, Treeification & hashCode Contract (900w) · **3.** TreeMap, LinkedHashMap & Iteration Order (800w) · **4.** Concurrent Collections & Fail-Fast Iterators (800w) |
| 2.2 Concurrency | 1548w flat, 3 examples, 9 cards | 📝 Section it | **1.** Thread Lifecycle & Creation Patterns (800w) · **2.** ExecutorService & Thread Pool Sizing (900w) · **3.** ReentrantLock, ReadWriteLock & StampedLock (800w) · **4.** CompletableFuture & Async Composition (900w) |
| 2.3 Streams & Lambdas | 1124w flat, 3 examples, 7 cards | 📝 Section it | **1.** Lambdas & Functional Interfaces (800w) · **2.** Stream Pipeline & Lazy Evaluation (900w) · **3.** Collectors: groupingBy, partitioning, joining (800w) · **4.** Parallel Streams & When to Avoid (800w) |
| 2.4 Virtual Threads | 1282w flat, 2 examples, 6 cards | 📝 Section it | **1.** The Problem with Platform Threads (800w) · **2.** Virtual Thread Internals: Mount/Unmount (900w) · **3.** Pinning, Detection & Structured Concurrency (800w) |
| 2.5 Records & Sealed | 1249w flat, 1 example, 4 cards | 📝 Section it | **1.** Records: Immutable Data Carriers (800w) · **2.** Sealed Classes & Algebraic Types (800w) · **3.** Pattern Matching & Modern Switch (900w) |

---

### Phase 3 — Spring & Spring Boot

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 3.1 IoC, DI & Bean Lifecycle | 1185w flat, 1 example, 4 cards | 📝 Section it | **1.** Why IoC? Inversion of Control Explained (800w) · **2.** Bean Lifecycle: Create → Wire → Use → Destroy (900w) · **3.** Bean Scopes & Circular Dependencies (800w) · **4.** Auto-Configuration & @Conditional (800w) |
| 3.2 Auto-Configuration | 1066w flat, 1 example, 4 cards | 📝 Section it | **1.** Spring Boot Startup: What Happens (800w) · **2.** Auto-Config Mechanism: @EnableAutoConfiguration (900w) · **3.** Writing Custom Starters (800w) · **4.** Externalized Config & Profiles (800w) |
| 3.3 Transactions & AOP | 1195w flat, 1 example, 4 cards | 📝 Section it | **1.** What is a Transaction? ACID Recap (800w) · **2.** @Transactional Mechanics & Proxy Trap (900w) · **3.** Propagation Levels Deep Dive (900w) · **4.** AOP: Aspects, Pointcuts & Advice (800w) |
| 3.4 Spring Data JPA | 1332w flat, 1 example, 4 cards | 📝 Section it | **1.** JPA Entity Mapping & Relationships (900w) · **2.** Repository Pattern & Query Methods (800w) · **3.** N+1 Problem: Causes & All Fixes (1000w) · **4.** Transactions in JPA & LazyInitializationException (800w) |

---

### Phase 4 — Databases & Persistence ⏳ NEEDS FULL EXPANSION

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 4.1 SQL Mastery & Joins | 222w, 3 examples, 8 cards | ⏳ Expand + Section | **1.** SQL Execution Order (FROM → WHERE → GROUP → HAVING → SELECT → ORDER) (900w) · **2.** JOIN Types: INNER/LEFT/RIGHT/FULL/CROSS/SELF with visual diagrams (1000w) · **3.** Window Functions: ROW_NUMBER, RANK, LAG, LEAD, SUM OVER (900w) · **4.** CTEs, Subqueries & Query Optimisation (900w) |
| 4.2 Indexing & Query Plans | 281w, 1 example, 5 cards | ⏳ Expand + Section | **1.** B-Tree Index Internals: How Indexes Work (900w) · **2.** Composite Indexes, Covering Indexes & Index Selectivity (900w) · **3.** Reading EXPLAIN ANALYZE Output (900w) · **4.** When NOT to Index & Index Maintenance (800w) |
| 4.3 Transactions & Isolation | 271w, 1 example, 5 cards | ⏳ Expand + Section | **1.** ACID Properties Deep Dive (900w) · **2.** Isolation Levels: READ UNCOMMITTED → SERIALIZABLE with Anomaly Examples (1000w) · **3.** Optimistic vs Pessimistic Locking (900w) · **4.** Distributed Transactions & Two-Phase Commit (800w) |

---

### Phase 5 — System Design ⏳ NEEDS FULL EXPANSION

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 5.1 Scalability Fundamentals | 321w | ⏳ | **1.** Vertical vs Horizontal Scaling (800w) · **2.** Load Balancing: Algorithms & Health Checks (900w) · **3.** Database Scaling: Replication, Sharding, Read Replicas (1000w) · **4.** CAP Theorem & Consistency Models (900w) |
| 5.2 Caching Strategies | 288w | ⏳ | **1.** Why Cache? Cache Hit/Miss/Eviction (800w) · **2.** Cache Patterns: Cache-Aside, Write-Through, Write-Behind (900w) · **3.** Redis Deep Dive: Data Structures & Use Cases (900w) · **4.** Cache Invalidation, Stampede & Thundering Herd (900w) |
| 5.3 API Design | 293w | ⏳ | **1.** REST Principles & Richardson Maturity Model (800w) · **2.** REST Best Practices: Versioning, Pagination, Error Formats (900w) · **3.** gRPC vs REST: When to Choose Which (900w) · **4.** Idempotency, Retry Strategies & API Gateway (800w) |

---

### Phase 6 — Distributed Systems & Messaging ⏳ NEEDS FULL EXPANSION

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 6.1 Microservice Patterns | 289w | ⏳ | **1.** Monolith → Microservices: When & Why (800w) · **2.** Service Discovery & API Gateway Patterns (900w) · **3.** Circuit Breaker, Bulkhead & Retry Patterns (1000w) · **4.** Event-Driven Architecture & Choreography vs Orchestration (900w) |
| 6.2 Apache Kafka | 351w, 3 examples | ⏳ | **1.** Kafka Architecture: Topics, Partitions, Offsets (900w) · **2.** Producers, Consumers & Consumer Groups (900w) · **3.** Delivery Guarantees: At-Most/At-Least/Exactly-Once (1000w) · **4.** Kafka Streams & Real-World Patterns (900w) |
| 6.3 Saga Pattern | 332w | ⏳ | **1.** Why Distributed Transactions Fail (800w) · **2.** Choreography-Based Saga (900w) · **3.** Orchestration-Based Saga with Camunda (900w) · **4.** Compensating Transactions & Idempotency (800w) |

---

### Phase 7 — DevOps: Docker, Kubernetes & Helm ⏳ NEEDS FULL EXPANSION

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 7.1 Docker & Containers | 282w | ⏳ | **1.** Containers vs VMs: Namespaces & Cgroups (900w) · **2.** Writing Production Dockerfiles (900w) · **3.** Docker Networking & Volumes (800w) · **4.** Docker Compose for Local Dev (800w) |
| 7.2 Kubernetes Core | 335w | ⏳ | **1.** Kubernetes Architecture: Control Plane & Nodes (900w) · **2.** Pods, Deployments, Services & Ingress (1000w) · **3.** ConfigMaps, Secrets & Resource Limits (900w) · **4.** Health Probes, HPA & Rolling Updates (900w) |
| 7.3 Helm | 819w | ⏳ | **1.** What Helm Solves: Chart Structure (800w) · **2.** Values, Templates & Overrides (900w) · **3.** Hooks, Tests & Chart Dependencies (800w) · **4.** Helm in CI/CD & GitOps (800w) |
| 7.4 CI/CD & GitOps | 253w | ⏳ | **1.** CI Pipeline Design: Build, Test, Lint, Scan (900w) · **2.** CD Strategies: Blue/Green, Canary, Feature Flags (900w) · **3.** GitOps with ArgoCD or Flux (900w) · **4.** Secrets Management in Pipelines (800w) |

---

### Phase 8 — Camunda & Process Orchestration ⏳ NEEDS FULL EXPANSION

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 8.1 BPMN & Workflow Fundamentals | 340w | ⏳ | **1.** Why Workflow Engines? Long-Running Processes (800w) · **2.** BPMN Elements: Events, Tasks, Gateways, Flows (900w) · **3.** Process Variables, Subprocesses & Error Handling (900w) · **4.** When to Use Workflows vs Simple Code (800w) |
| 8.2 Camunda 7 vs 8 | 328w | ⏳ | **1.** Camunda 7 Architecture: Embedded vs Remote Engine (900w) · **2.** Spring Boot Integration & Service Tasks (900w) · **3.** Camunda 8 / Zeebe: Cloud-Native Workflow (900w) · **4.** Decision Tables (DMN) & Monitoring (800w) |

---

### Phase 9 — Linux, Networking & Observability ⏳ NEEDS FULL EXPANSION

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 9.1 Linux Essentials | 306w | ⏳ | **1.** Linux for Java Devs: Processes & Signals (800w) · **2.** File System, Permissions & I/O Redirection (800w) · **3.** Networking Commands: ss, netstat, curl, tcpdump (900w) · **4.** Performance Tools: top, htop, vmstat, iostat (900w) |
| 9.2 Networking & HTTP | 304w | ⏳ | **1.** TCP/IP: Sockets, Handshake & TIME_WAIT (900w) · **2.** HTTP/1.1 vs HTTP/2 vs HTTP/3 (900w) · **3.** TLS: Certificates, Handshake & HTTPS (900w) · **4.** DNS, Load Balancing & CDN (800w) |
| 9.3 Observability | 323w | ⏳ | **1.** The Three Pillars: Logs, Metrics, Traces (800w) · **2.** Structured Logging with SLF4J & Logback (900w) · **3.** Metrics with Micrometer & Prometheus/Grafana (900w) · **4.** Distributed Tracing with OpenTelemetry (900w) |

---

### Phase 10 — Behavioral & EU Interview Strategy ⏳ NEEDS FULL EXPANSION

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 10.1 STAR Stories | 293w | ⏳ | **1.** The STAR Framework Explained (700w) · **2.** Crafting Strong Technical STAR Stories (800w) · **3.** Common Behavioral Questions & Winning Answers (900w) · **4.** Culture Fit Questions for European Companies (800w) |
| 10.2 System Design Communication | 407w | ⏳ | **1.** How to Structure a System Design Interview (900w) · **2.** Estimating Scale & Back-of-Envelope Calculations (900w) · **3.** EU Visa Sponsorship: What Companies Look For (800w) · **4.** Salary Negotiation & Contract Review Tips (800w) |

---

### Phase 11 — Real-World Java Backend Architecture

| Module | Current | Status | Planned Sections |
|---|---|---|---|
| 11.1 Multi-Module Maven | 646w, 3 examples, 8 cards | 📝 Section it | **1.** Why Multi-Module? Module Graph Design (800w) · **2.** Parent POM, BOM & Dependency Management (800w) · **3.** Build Profiles, Filtering & Assembly (800w) |
| 11.2 Production Infrastructure | 779w, 2 examples, 7 cards | 📝 Section it | **1.** Docker Compose in Production (800w) · **2.** Caddy as Reverse Proxy + TLS (800w) · **3.** VPS Setup, Systemd & Auto-Deploy (800w) |
| 11.3 Spring Security & OAuth2 | 701w, 3 examples, 8 cards | 📝 Section it | **1.** Spring Security Filter Chain (800w) · **2.** Google OAuth2 Integration (900w) · **3.** Per-User Data Isolation & Row-Level Security (900w) |

---

## Priority order

1. **Phase 1** — already has deep content, just needs sectioning (split existing 2000w into 4 × 800w sections, EXPAND don't dilute)
2. **Phase 2** — same: has 1100–1671w, needs sectioning with expansion
3. **Phase 3** — same: has 1066–1332w, needs sectioning with expansion
4. **Phase 4** — needs full expansion from 220w to 3600w + sections
5. **Phases 5–10** — needs full expansion + sections
6. **Phase 11** — has decent content, needs sectioning

## Key rule when sectioning

> **Do NOT take 2000 words and split them into 5 × 400 words.** That dilutes the content and the user will see LESS on each page.  
> Instead: take the 2000 word flat notes as a SEED, then EXPAND each section to 800–1000 words by going deeper on that specific sub-topic.  
> Result: 4 sections × 900 words = 3600 words total — richer than the original 2000.

---

## Module IDs are stable

Never change existing module IDs — users store progress by ID in localStorage.

## Files

- `public/js/curriculum.js` — all content (8249 lines currently)
- `public/js/app.js` — rendering engine (sections support already implemented)
- `server.js` — Express + Wandbox executor + `/api/stats` debug endpoint
- `CONTINUATION.md` — this file
