/* ============================================================
   Java Backend Interview Hub — Curriculum data
   Each phase: { id, title, icon, blurb, modules: [...] }
   Each module: { id, title, hours, notes(md), code[], flashcards[] }
   Notes use markdown. Callouts: > [!TIP] / [!WARNING] / [!EU] / [!DANGER] / [!SUCCESS]
   Backticks inside notes are escaped as \` (template-literal safe).
   ============================================================ */

const CURRICULUM = [
/* ===================== PHASE 1: JVM ===================== */
{
  id: 'p1',
  title: 'JVM Internals & Runtime',
  icon: 'cpu',
  blurb: 'How the JVM loads, runs, optimises and reclaims memory for your code.',
  modules: [
    {
      id: '1.1',
      title: 'JVM Architecture',
      hours: 4,
      notes: `
# JVM Architecture

The **Java Virtual Machine** is an abstract computing machine with its own instruction set (bytecode) that manipulates memory areas at runtime. "Write once, run anywhere" works because \`javac\` compiles to platform-neutral bytecode and each OS ships a native JVM.

## The three subsystems

1. **Class Loader Subsystem** — loads, links, and initialises \`.class\` files.
2. **Runtime Data Areas** — the memory the JVM manages while a program runs.
3. **Execution Engine** — interpreter, JIT compiler, and garbage collector.

## Runtime data areas

| Area | Shared? | Holds | OOM error |
|------|---------|-------|-----------|
| **Heap** | Per-JVM (all threads) | Objects, arrays, instance fields | \`OutOfMemoryError: Java heap space\` |
| **Method Area / Metaspace** | Shared | Class metadata, static fields, runtime constant pool | \`OutOfMemoryError: Metaspace\` |
| **JVM Stack** | Per-thread | Stack frames (locals, operand stack) | \`StackOverflowError\` |
| **PC Register** | Per-thread | Address of current bytecode instruction | — |
| **Native Method Stack** | Per-thread | State for native (JNI) calls | — |

> [!TIP]
> Since **Java 8**, the permanent generation (PermGen) was replaced by **Metaspace**, which lives in *native* memory and grows dynamically. This eliminated the classic \`PermGen space\` errors but a class-loader leak can still exhaust native memory — watch \`-XX:MaxMetaspaceSize\`.

## Class loading: load → link → initialise

- **Loading** — find the binary, create a \`Class\` object in the heap.
- **Linking** — *verify* (bytecode safety), *prepare* (allocate statics with defaults), *resolve* (symbolic → direct references).
- **Initialisation** — run static initialisers and static field assignments, top-down.

### Parent-delegation model

Each class loader asks its **parent** first, and only loads the class itself if the parent fails. Hierarchy: **Bootstrap** (core \`java.*\`) → **Platform/Extension** → **Application (system) classpath** → custom loaders.

> [!WARNING]
> Delegation prevents a malicious \`java.lang.String\` from overriding the real one. Frameworks (Tomcat, OSGi, Spring Boot fat-jars) deliberately *break* strict delegation with child-first loaders to isolate web apps — a common senior follow-up question.

## Execution engine: interpret then compile

The JVM **interprets** bytecode first (fast startup), profiles "hot" methods, then the **JIT** (C1 client + C2 server, tiered compilation) compiles them to native code. \`-XX:+PrintCompilation\` shows it happening.

> [!EU]
> **European panels love depth-over-breadth.** For a senior/staff role at SAP, Zalando, Adyen, or N26, expect: *"Walk me through what happens from \`java MyApp\` to the first line of \`main\` executing."* Narrate class loading → linking → \`main\` thread stack frame → interpretation → JIT warm-up. Mentioning Metaspace vs PermGen and tiered compilation signals real seniority.

## Mental model to memorise

\`\`\`
Source.java --javac--> Bytecode (.class)
        |
   ClassLoader (load/link/init, parent-delegation)
        v
  +-------------------- JVM Process --------------------+
  | Heap (shared)        Metaspace (shared, native)     |
  | Thread1: [stack][pc] Thread2: [stack][pc] ...       |
  | Execution Engine: Interpreter + JIT(C1/C2) + GC     |
  +-----------------------------------------------------+
\`\`\`
`,
      code: [
        {
          lang: 'java',
          title: 'Inspect the running JVM & class loaders',
          code: `public class JvmIntro {
    static int counter = 42; // lives in Metaspace (static), value prepared then initialised

    public static void main(String[] args) {
        Runtime rt = Runtime.getRuntime();
        long mb = 1024 * 1024;
        System.out.println("Available processors : " + rt.availableProcessors());
        System.out.println("Max heap (MB)        : " + rt.maxMemory() / mb);
        System.out.println("Total heap (MB)      : " + rt.totalMemory() / mb);
        System.out.println("Free heap (MB)       : " + rt.freeMemory() / mb);

        // Parent-delegation hierarchy
        ClassLoader cl = JvmIntro.class.getClassLoader();
        System.out.println("\\nClass loader chain:");
        while (cl != null) {
            System.out.println("  -> " + cl);
            cl = cl.getParent();
        }
        // Bootstrap loader is native -> shows as null
        System.out.println("  -> Bootstrap (null)");
        System.out.println("\\nString loaded by  : " + String.class.getClassLoader());
        System.out.println("counter           : " + counter);
    }
}`
        }
      ],
      flashcards: [
        { q: 'Which runtime data areas are shared across all threads vs per-thread?', a: 'Shared: Heap and Method Area/Metaspace (class metadata, statics, constant pool). Per-thread: JVM Stack, PC Register, and Native Method Stack.' },
        { q: 'What replaced PermGen in Java 8 and why does it matter?', a: 'Metaspace, which lives in native memory and grows dynamically (bounded by -XX:MaxMetaspaceSize). It removed fixed PermGen sizing and the classic "PermGen space" OOM, but class-loader leaks can still exhaust native memory.' },
        { q: 'Explain the parent-delegation model and why it exists.', a: 'A class loader delegates to its parent before attempting to load a class itself (Bootstrap → Platform → Application → custom). It guarantees core classes (java.lang.String) can\'t be spoofed and avoids duplicate class definitions.' },
        { q: 'What are the three phases of linking?', a: 'Verify (bytecode integrity & safety), Prepare (allocate static fields with default values), Resolve (replace symbolic references with direct references).' },
        { q: 'How does the JVM decide to JIT-compile a method?', a: 'It interprets bytecode first and profiles invocation/loop counts. "Hot" methods crossing a threshold are compiled by the JIT (tiered: C1 client for quick compiles, C2 server for aggressive optimisation).' }
      ]
    },

    {
      id: '1.2',
      title: 'Garbage Collection Internals',
      hours: 5,
      notes: `
# Garbage Collection Internals

GC automates memory reclamation by finding objects no longer **reachable** from GC roots and freeing them. Senior interviews probe *which* collector, *why*, and *how to tune* for latency vs throughput.

## Reachability, not reference counting

The JVM does **tracing GC**: starting from **GC roots** (thread stacks, static fields, JNI refs), it marks everything reachable; the rest is garbage. This handles **cyclic references** that naive reference counting cannot.

## The weak generational hypothesis

> *Most objects die young.*

So the heap is split into generations to make collection cheap:

- **Young generation** — Eden + two Survivor spaces (S0/S1). New objects land in Eden.
- **Old (tenured) generation** — objects that survive enough young GCs are *promoted*.
- **Minor GC** collects young gen (frequent, fast, stop-the-world but short).
- **Major / Full GC** collects old gen (rarer, more expensive).

### Copying collection in young gen

A **minor GC** copies live Eden+from-Survivor objects into the to-Survivor (or promotes them), then clears Eden in one shot. Because most objects are dead, copying the few survivors is cheap — **allocation is just a pointer bump**.

## The collectors you must compare

| Collector | Flag | Best for | Trade-off |
|-----------|------|----------|-----------|
| **Serial** | \`-XX:+UseSerialGC\` | Tiny heaps, single core | STW, single-threaded |
| **Parallel (Throughput)** | \`-XX:+UseParallelGC\` | Batch jobs, max throughput | Longer STW pauses |
| **G1** (default 9+) | \`-XX:+UseG1GC\` | Balanced, large heaps | Predictable pauses, some overhead |
| **ZGC** | \`-XX:+UseZGC\` | Very large heaps, <1ms pauses | More CPU/footprint |
| **Shenandoah** | \`-XX:+UseShenandoahGC\` | Low pause, OpenJDK | Concurrent compaction cost |

> [!TIP]
> **G1 (Garbage-First)** divides the heap into ~2048 equal **regions** that are dynamically labelled Eden/Survivor/Old/Humongous. It collects regions with the most garbage first and targets a **pause goal** (\`-XX:MaxGCPauseMillis=200\`). It is the default since JDK 9.

> [!SUCCESS]
> **ZGC & Shenandoah** are *concurrent compacting* collectors achieving **sub-millisecond pauses** even on multi-TB heaps by doing marking *and* relocation concurrently with the application (using load/read barriers and coloured pointers). Mention these for low-latency trading/streaming systems.

## Stop-The-World (STW)

Every collector pauses application threads at *safepoints* for some phases. The goal of modern GCs is to shrink STW to the minimum. A "GC pause" complaint in production almost always means: long Full GCs, an undersized heap, or allocation pressure.

> [!WARNING]
> A **memory leak in a GC'd language** is real: objects stay *reachable* but are never used — static collections, unbounded caches, unclosed resources, listeners never deregistered, \`ThreadLocal\` not removed in a pool. The GC can't help because they're still referenced. Diagnose with a heap dump (\`jmap\`) + Eclipse MAT "dominator tree".

## Tuning workflow

1. **Measure first** — enable GC logs: \`-Xlog:gc*:file=gc.log:time,uptime,level,tags\`.
2. Pick a goal: **throughput** (batch) → Parallel; **latency** (services) → G1/ZGC.
3. Size the heap: \`-Xms = -Xmx\` (avoid resize jitter); leave headroom for Metaspace + threads.
4. Set a pause target, **don't** micro-tune generation sizes prematurely.
5. Re-measure with realistic load. Tools: \`jstat -gcutil\`, GCViewer, JFR/Flight Recorder.

> [!EU]
> Classic European deep-dive: *"Your service shows periodic 2-second latency spikes. How do you find the cause?"* — Walk through: check GC logs for Full GC correlation → heap dump for retained set → identify the unbounded cache/leak → fix + right-size heap → consider G1→ZGC if pauses inherent. Showing a **measurement-first, hypothesis-driven** method beats reciting flags.
`,
      code: [
        {
          lang: 'java',
          title: 'Watch generational GC & promotion happen',
          code: `import java.util.*;

public class GcDemo {
    public static void main(String[] args) {
        // Run with:  -Xlog:gc -Xmx64m  to see minor/major GCs in the log
        List<byte[]> tenured = new ArrayList<>();
        long start = System.currentTimeMillis();

        for (int i = 0; i < 200; i++) {
            // Short-lived garbage: dies in Eden, collected by cheap minor GC
            byte[] ephemeral = new byte[256 * 1024]; // 256 KB
            ephemeral[0] = 1;

            // Every 10th allocation survives -> eventually promoted to old gen
            if (i % 10 == 0) tenured.add(new byte[256 * 1024]);
        }

        Runtime rt = Runtime.getRuntime();
        long usedMb = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        System.out.println("Retained (tenured) blocks : " + tenured.size());
        System.out.println("Heap used (MB)            : " + usedMb);
        System.out.println("Elapsed (ms)              : " + (System.currentTimeMillis() - start));
        System.out.println("Tip: re-run with -Xlog:gc -Xmx64m to see GC pauses.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'Why does the JVM use tracing GC instead of reference counting?', a: 'Tracing from GC roots correctly reclaims cyclic references (A→B→A) that reference counting would leak, and it avoids per-assignment counter bookkeeping overhead.' },
        { q: 'State the weak generational hypothesis and its consequence.', a: '"Most objects die young." Therefore the heap is split into young/old generations so cheap, frequent minor GCs reclaim short-lived objects, while expensive major GCs run rarely.' },
        { q: 'How does G1 differ from Parallel GC?', a: 'G1 splits the heap into ~2048 equal regions dynamically tagged Eden/Survivor/Old/Humongous, collects highest-garbage regions first, and targets a configurable pause goal (MaxGCPauseMillis). Parallel maximises throughput but with longer, less predictable STW pauses.' },
        { q: 'How do ZGC/Shenandoah achieve sub-millisecond pauses?', a: 'They perform marking AND object relocation/compaction concurrently with the application using load/read barriers (and coloured pointers in ZGC), so STW phases are tiny and largely independent of heap size.' },
        { q: 'Can you have a memory leak in Java? Give examples.', a: 'Yes — objects that remain reachable but unused: unbounded static collections/caches, unremoved listeners, ThreadLocals in thread pools, unclosed resources. GC won\'t reclaim them because they\'re still referenced. Diagnose via heap dump + dominator tree.' },
        { q: 'First step when diagnosing GC-related latency spikes?', a: 'Enable and read GC logs (-Xlog:gc*) to confirm pauses correlate with the spikes, then take a heap dump to inspect the retained set — measure before tuning any flags.' }
      ]
    },

    {
      id: '1.3',
      title: 'Java Memory Model & Safe Publication',
      hours: 4,
      notes: `
# Java Memory Model (JMM)

The JMM defines **when** a write by one thread becomes **visible** to a read by another, and which reorderings the compiler/CPU may perform. Without it, "shared mutable state" would be undefined behaviour.

## The core relation: happens-before

If action A *happens-before* B, then A's effects are visible to B. Key edges:

- **Program order** within a single thread.
- **Monitor lock** — unlock of a monitor happens-before every subsequent lock of the same monitor.
- **Volatile** — a write to a volatile field happens-before every subsequent read of it.
- **Thread start/join** — \`Thread.start()\` happens-before the thread's actions; a thread's actions happen-before another's \`join()\` returns.
- **Final fields** — correctly constructed objects publish their finals safely.

## Visibility, atomicity, ordering — three distinct problems

- **Visibility** — without \`volatile\`/sync, a thread may read a stale cached value forever (e.g. a spin on a non-volatile \`boolean running\`).
- **Atomicity** — \`count++\` is read-modify-write; needs \`synchronized\` or \`AtomicInteger\`.
- **Ordering** — the JIT/CPU can reorder independent instructions; barriers prevent harmful reordering.

> [!WARNING]
> \`volatile\` guarantees **visibility + ordering** but **not atomicity**. \`volatile int x; x++\` is still a race. Use \`AtomicInteger\`/\`LongAdder\` or a lock for compound actions.

## Safe publication

To hand an object to another thread safely, publish it via: a volatile field, an \`AtomicReference\`, a final field set in the constructor, a value guarded by a lock, or a concurrent collection. Otherwise the reader may see a **partially constructed** object.

> [!TIP]
> The **double-checked locking** singleton is only correct if the instance field is \`volatile\` — otherwise a reader can see a non-null but not-yet-initialised object due to reordering of the constructor and the reference write.

> [!EU]
> A favourite senior question: *"What does \`volatile\` actually guarantee?"* The strong answer separates **visibility** and **ordering** (guaranteed) from **atomicity** (NOT guaranteed), then ties it to happens-before. Bonus: mention false sharing and \`@Contended\`.
`,
      code: [
        {
          lang: 'java',
          title: 'Visibility bug vs volatile fix',
          code: `import java.util.concurrent.TimeUnit;

public class VisibilityDemo {
    // Try removing 'volatile' and the worker may loop forever on some JVMs/CPUs
    private static volatile boolean running = true;

    public static void main(String[] args) throws InterruptedException {
        Thread worker = new Thread(() -> {
            long count = 0;
            while (running) { count++; }      // reads 'running' each iteration
            System.out.println("Worker stopped after " + count + " iterations");
        });
        worker.start();

        TimeUnit.MILLISECONDS.sleep(50);
        running = false;                       // volatile write -> visible to worker
        System.out.println("main set running=false");
        worker.join(1000);
        System.out.println("Done. Worker alive? " + worker.isAlive());
    }
}`
        }
      ],
      flashcards: [
        { q: 'What does volatile guarantee and what does it NOT?', a: 'Guarantees visibility (no stale reads) and ordering (happens-before across the volatile access). Does NOT guarantee atomicity of compound operations like x++.' },
        { q: 'Define the happens-before relationship.', a: 'A partial ordering: if A happens-before B, A\'s memory effects are visible to B. Edges include program order, unlock→lock on same monitor, volatile write→read, Thread.start, and Thread.join.' },
        { q: 'Why must the double-checked-locking singleton field be volatile?', a: 'Without volatile, the constructor\'s writes and the reference assignment can be reordered, so another thread may observe a non-null but partially constructed instance.' },
        { q: 'List safe publication mechanisms.', a: 'Store the reference in a volatile field or AtomicReference, initialise it as a final field in the constructor, guard it with a lock, or place it in a thread-safe/concurrent collection.' }
      ]
    },

    {
      id: '1.4',
      title: 'JIT Compilation & Performance',
      hours: 3,
      notes: `
# JIT Compilation & Performance

The JIT turns interpreted bytecode into optimised native code based on **runtime profiles** — something an ahead-of-time C++ compiler can't do as adaptively.

## Tiered compilation

- **Level 0** — interpreter (collects profiling data).
- **Levels 1–3** — **C1 (client)**: fast compiles, light optimisation, more profiling.
- **Level 4** — **C2 (server)**: aggressive, profile-guided optimisation.

A method climbs tiers as it gets hotter. \`-XX:+PrintCompilation\` shows transitions.

## Key optimisations

- **Inlining** — small hot methods are inlined to remove call overhead and unlock further optimisation. The biggest win.
- **Escape analysis** — if an object never escapes its method, the JIT may **scalar-replace** it (no heap allocation) or elide locks.
- **Loop unrolling, dead-code elimination, branch prediction hints, monomorphic inline caches** for virtual calls.
- **Deoptimisation** — speculative optimisations (e.g. assuming a call site is monomorphic) can be undone if assumptions break, falling back to the interpreter.

> [!TIP]
> **Warm-up matters.** Benchmarks must discard early iterations or the interpreter/C1 phase skews results. Use **JMH** (Java Microbenchmark Harness) — it handles warm-up, dead-code elimination, and fork isolation correctly.

> [!WARNING]
> Don't hand-optimise prematurely. The JIT inlines and unrolls far better than manual tricks, and manual "optimisations" often *prevent* its analysis. Profile (async-profiler, JFR) before changing code.

## AOT & GraalVM

**GraalVM Native Image** compiles ahead-of-time to a native binary: millisecond startup, low memory — ideal for serverless/CLI — at the cost of no JIT peak throughput and closed-world constraints (reflection needs config). Spring Boot 3 + Spring Native target this.

> [!EU]
> If you claim "I optimised performance" on your CV, expect: *"How did you measure it?"* Answer with JMH for micro and async-profiler/JFR + flame graphs for production, and mention warm-up and statistical significance. European engineering cultures value rigour over anecdote.
`,
      code: [
        {
          lang: 'java',
          title: 'Escape analysis & JIT warm-up effect',
          code: `public class JitDemo {
    // This object does not escape -> JIT may scalar-replace it (no heap alloc)
    static long distanceSquared(int x, int y) {
        int[] point = new int[] { x, y };  // candidate for scalar replacement
        return (long) point[0] * point[0] + (long) point[1] * point[1];
    }

    public static void main(String[] args) {
        long sink = 0;
        // Warm-up: let the method get hot and JIT-compile
        for (int i = 0; i < 100_000; i++) sink += distanceSquared(i, i + 1);

        long start = System.nanoTime();
        for (int i = 0; i < 10_000_000; i++) sink += distanceSquared(i, i + 1);
        long ns = System.nanoTime() - start;

        System.out.println("sink = " + sink);
        System.out.printf("10M hot calls took %.2f ms%n", ns / 1_000_000.0);
        System.out.println("Run with -XX:+PrintCompilation to watch tiers, " +
                           "or -XX:-DoEscapeAnalysis to disable scalar replacement.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is tiered compilation?', a: 'The JVM starts interpreting (level 0), compiles hot methods with C1 (levels 1–3, fast + profiling), and promotes the hottest to C2 (level 4, aggressive profile-guided optimisation).' },
        { q: 'What is escape analysis and what does it enable?', a: 'Analysis determining whether an object escapes its creating method/thread. If it doesn\'t, the JIT can scalar-replace it (avoid heap allocation) and elide locks (lock coarsening/elision).' },
        { q: 'Why use JMH instead of System.nanoTime loops?', a: 'JMH handles JIT warm-up, prevents dead-code elimination from removing your benchmark, forks fresh JVMs, and reports statistically meaningful results — naive timing loops measure interpreter/C1 noise.' },
        { q: 'What does GraalVM Native Image trade away for fast startup?', a: 'Peak JIT throughput and runtime adaptivity, plus a closed-world assumption (reflection/proxies/resources need explicit build-time configuration).' }
      ]
    }
  ]
},

/* ===================== PHASE 2: Modern Java ===================== */
{
  id: 'p2',
  title: 'Core & Modern Java (8 → 21)',
  icon: 'code-2',
  blurb: 'Collections, concurrency, and the language leaps: lambdas, records, sealed types, pattern matching, virtual threads.',
  modules: [
    {
      id: '2.1',
      title: 'Collections & Equals/HashCode Contracts',
      hours: 4,
      notes: `
# Collections & the Equals/HashCode Contract

A senior must know the data-structure trade-offs cold and the subtle contracts that break \`HashMap\` and \`HashSet\`.

## The map/set family

| Type | Ordering | Null keys | Backing | Get/Put |
|------|----------|-----------|---------|---------|
| \`HashMap\` | none | 1 null key | array of buckets (+ tree) | O(1) avg |
| \`LinkedHashMap\` | insertion / access | yes | hash + linked list | O(1) |
| \`TreeMap\` | sorted (comparator) | no | red-black tree | O(log n) |
| \`ConcurrentHashMap\` | none | no nulls | striped/CAS buckets | O(1), thread-safe |

## HashMap internals (Java 8+)

Buckets are an array; collisions form a **linked list** that **treeifies** into a red-black tree once a bucket exceeds 8 entries (and capacity ≥ 64), giving O(log n) worst case instead of O(n). Default load factor 0.75 triggers resize (doubling + rehash).

## The equals/hashCode contract

1. Consistent: equal objects **must** return equal hashCodes.
2. Unequal objects *should* (not must) return different hashCodes — but good distribution matters for performance.
3. Reflexive, symmetric, transitive, consistent; \`x.equals(null)\` is false.

> [!WARNING]
> Override **both or neither**. Override \`equals\` but not \`hashCode\` and your object vanishes in a \`HashSet\`/\`HashMap\`. Use a **mutable field** in \`hashCode\` and then mutate it after insertion → the entry is lost in the wrong bucket. Prefer immutable keys.

> [!TIP]
> \`record\` types auto-generate \`equals\`, \`hashCode\`, and \`toString\` from components — perfect immutable map keys and DTOs. Reach for them in Java 16+.

## Fail-fast iterators

\`ArrayList\`/\`HashMap\` iterators throw \`ConcurrentModificationException\` if the collection is structurally modified during iteration (modCount check). Use \`Iterator.remove()\`, \`removeIf\`, or a concurrent collection.

> [!EU]
> Expect *"What happens internally when two keys collide in a HashMap?"* and *"Why must keys be immutable?"* Draw the bucket array, mention treeification at 8, load factor 0.75, and the hashCode→bucket index (\`(n-1) & hash\` with a spread function).
`,
      code: [
        {
          lang: 'java',
          title: 'Broken vs correct map key',
          code: `import java.util.*;

public class EqualsHashDemo {
    // A correct, immutable key
    record Point(int x, int y) {}        // equals/hashCode auto-generated

    // A BROKEN key: equals without hashCode
    static final class BadKey {
        final String id;
        BadKey(String id) { this.id = id; }
        @Override public boolean equals(Object o) {
            return o instanceof BadKey b && b.id.equals(id);
        }
        // No hashCode() -> uses identity hash -> lookups fail!
    }

    public static void main(String[] args) {
        Map<Point, String> good = new HashMap<>();
        good.put(new Point(1, 2), "origin-ish");
        System.out.println("record key lookup : " + good.get(new Point(1, 2))); // found

        Map<BadKey, String> bad = new HashMap<>();
        bad.put(new BadKey("A"), "value");
        System.out.println("bad key lookup    : " + bad.get(new BadKey("A"))); // null!
    }
}`
        }
      ],
      flashcards: [
        { q: 'What happens inside a HashMap bucket when collisions grow large (Java 8+)?', a: 'The bucket\'s linked list treeifies into a red-black tree once it exceeds 8 nodes and table capacity ≥ 64, improving worst-case lookup from O(n) to O(log n).' },
        { q: 'State the equals/hashCode contract.', a: 'Equal objects must have equal hashCodes; equals must be reflexive, symmetric, transitive, consistent, and false for null. Unequal objects ideally have different hashCodes for good distribution.' },
        { q: 'Why must HashMap keys be immutable (or at least their hash-relevant fields)?', a: 'The bucket index is derived from hashCode at insertion. If a field used in hashCode changes afterward, the entry sits in the wrong bucket and becomes unreachable by get().' },
        { q: 'How do you avoid ConcurrentModificationException while removing during iteration?', a: 'Use Iterator.remove(), Collection.removeIf(predicate), iterate over a copy, or use a concurrent collection (CopyOnWriteArrayList / ConcurrentHashMap).' }
      ]
    },

    {
      id: '2.2',
      title: 'Concurrency: Threads, Executors, Locks',
      hours: 5,
      notes: `
# Concurrency: Executors, Locks, and java.util.concurrent

Raw \`Thread\` management doesn't scale. The \`java.util.concurrent\` (JUC) toolkit is the senior baseline.

## Executors — never \`new Thread()\` in app code

\`\`\`
ExecutorService pool = Executors.newFixedThreadPool(8);
Future<Integer> f = pool.submit(() -> compute());
pool.shutdown();
\`\`\`

Prefer \`ThreadPoolExecutor\` directly for control over **core/max size, queue, rejection policy**. \`Executors.newFixedThreadPool\` uses an *unbounded* queue → hidden OOM risk under load.

## Coordination primitives

- **\`CompletableFuture\`** — composable async pipelines (\`thenApply\`, \`thenCompose\`, \`allOf\`); the modern way to orchestrate I/O.
- **Locks** — \`ReentrantLock\` (tryLock, fairness), \`ReadWriteLock\`, \`StampedLock\` (optimistic reads).
- **Atomics** — \`AtomicInteger\`, \`LongAdder\` (better under high contention).
- **Synchronizers** — \`CountDownLatch\`, \`CyclicBarrier\`, \`Semaphore\`, \`Phaser\`.
- **Concurrent collections** — \`ConcurrentHashMap\`, \`BlockingQueue\`, \`CopyOnWriteArrayList\`.

> [!WARNING]
> **Deadlock** needs four conditions (mutual exclusion, hold-and-wait, no preemption, circular wait). Break the cycle by **acquiring locks in a global order**, using \`tryLock\` with timeout, or avoiding nested locks entirely.

> [!TIP]
> Prefer **immutability + message passing** over shared mutable state. The cheapest concurrency bug is the one you design out. When you must share, confine state to one thread or guard it with a single lock.

## synchronized vs ReentrantLock

| | \`synchronized\` | \`ReentrantLock\` |
|--|--|--|
| Acquire | implicit, block scope | explicit lock()/unlock() |
| Try / timeout | no | \`tryLock(timeout)\` |
| Fairness | no | optional |
| Interruptible | no | \`lockInterruptibly()\` |
| Condition | one (wait/notify) | multiple \`Condition\`s |

> [!EU]
> Be ready to *implement* a bounded producer-consumer with \`BlockingQueue\` on a whiteboard, and to explain thread-pool sizing: CPU-bound ≈ \`#cores\`; I/O-bound ≈ \`#cores × (1 + wait/compute)\`. Then pivot to "...or just use virtual threads (2.4)".
`,
      code: [
        {
          lang: 'java',
          title: 'CompletableFuture pipeline + pool',
          code: `import java.util.concurrent.*;
import java.util.*;
import java.util.stream.*;

public class ConcurrencyDemo {
    static int slowSquare(int n) {
        try { Thread.sleep(100); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        return n * n;
    }

    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        long start = System.currentTimeMillis();

        List<CompletableFuture<Integer>> futures = IntStream.rangeClosed(1, 8)
            .mapToObj(n -> CompletableFuture.supplyAsync(() -> slowSquare(n), pool))
            .collect(Collectors.toList());

        // Combine all results when every future completes
        int total = CompletableFuture
            .allOf(futures.toArray(new CompletableFuture[0]))
            .thenApply(v -> futures.stream().mapToInt(CompletableFuture::join).sum())
            .get();

        System.out.println("Sum of squares 1..8 = " + total);
        System.out.println("Wall time (ms)      = " + (System.currentTimeMillis() - start) + " (vs ~800 serial)");
        pool.shutdown();
    }
}`
        }
      ],
      flashcards: [
        { q: 'Why avoid Executors.newFixedThreadPool for untrusted load?', a: 'It uses an unbounded LinkedBlockingQueue; tasks pile up without backpressure and can exhaust memory. Configure ThreadPoolExecutor with a bounded queue and a rejection policy instead.' },
        { q: 'Name the four conditions for deadlock and one way to break it.', a: 'Mutual exclusion, hold-and-wait, no preemption, circular wait. Break it by imposing a global lock-acquisition order (or using tryLock with timeout).' },
        { q: 'When prefer ReentrantLock over synchronized?', a: 'When you need tryLock/timeouts, interruptible acquisition, fairness, or multiple Condition objects. Otherwise synchronized is simpler and now comparably fast.' },
        { q: 'How do you size a thread pool?', a: 'CPU-bound ≈ number of cores (±1). I/O-bound ≈ cores × (1 + wait time / compute time). Measure under real load; or sidestep sizing with virtual threads for blocking I/O.' },
        { q: 'Why LongAdder over AtomicInteger under high contention?', a: 'LongAdder spreads updates across multiple cells to reduce CAS contention, trading exact instantaneous reads for far higher write throughput.' }
      ]
    },

    {
      id: '2.3',
      title: 'Streams, Lambdas & Functional Java',
      hours: 3,
      notes: `
# Streams, Lambdas & Functional Java

Java 8 streams express **what** to compute, not **how** to loop — declarative, composable, and parallelisable.

## Anatomy of a stream

\`source → intermediate ops (lazy) → terminal op (eager)\`

- **Intermediate** (\`map\`, \`filter\`, \`sorted\`, \`distinct\`, \`flatMap\`) return a new stream and are **lazy** — nothing runs until a terminal op.
- **Terminal** (\`collect\`, \`reduce\`, \`forEach\`, \`count\`, \`findFirst\`) trigger execution and consume the stream (single-use).

## Collectors you should know

\`groupingBy\`, \`partitioningBy\`, \`toMap\`, \`joining\`, \`counting\`, \`summingInt\`, \`mapping\`, and downstream collectors for multi-level grouping.

> [!TIP]
> \`Optional\` models "maybe a value" — use \`map\`/\`flatMap\`/\`orElseGet\`/\`orElseThrow\`, never \`Optional.get()\` without \`isPresent()\`. Don't use \`Optional\` for fields or method parameters; it's a **return type** tool.

> [!WARNING]
> **Parallel streams** use the common ForkJoinPool and only help for large, CPU-bound, splittable, side-effect-free work. They hurt for small data, I/O, or ordered/stateful operations, and one slow task can starve the shared pool. Measure; don't sprinkle \`.parallel()\`.

## Functional interfaces

\`Function\`, \`BiFunction\`, \`Predicate\`, \`Consumer\`, \`Supplier\`, \`UnaryOperator\` — plus method references (\`String::length\`, \`this::handle\`, \`Type::new\`).

> [!EU]
> A common live-coding task: *"Given a list of \`Employee\`, group by department and compute average salary."* One \`groupingBy(Employee::dept, averagingDouble(Employee::salary))\` shows fluency. Then discuss when an imperative loop is clearer or faster.
`,
      code: [
        {
          lang: 'java',
          title: 'Grouping, partitioning & reduction',
          code: `import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.*;

public class StreamDemo {
    record Employee(String name, String dept, int salary) {}

    public static void main(String[] args) {
        List<Employee> staff = List.of(
            new Employee("Ana",  "ENG", 95000),
            new Employee("Ben",  "ENG", 80000),
            new Employee("Cara", "SALES", 70000),
            new Employee("Dieter","SALES", 90000),
            new Employee("Eva",  "ENG", 120000)
        );

        Map<String, Double> avgByDept = staff.stream()
            .collect(groupingBy(Employee::dept, averagingInt(Employee::salary)));
        System.out.println("Avg salary by dept : " + avgByDept);

        Map<Boolean, List<String>> highEarners = staff.stream()
            .collect(partitioningBy(e -> e.salary() >= 90000,
                                    mapping(Employee::name, toList())));
        System.out.println("High earners (>=90k): " + highEarners.get(true));

        String roster = staff.stream()
            .sorted(Comparator.comparingInt(Employee::salary).reversed())
            .map(Employee::name)
            .collect(joining(", ", "[", "]"));
        System.out.println("By pay desc        : " + roster);
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is lazy evaluation in streams?', a: 'Intermediate operations build a pipeline but execute nothing until a terminal operation runs, enabling fusion and short-circuiting (e.g., findFirst stops early).' },
        { q: 'When do parallel streams actually help?', a: 'Large, CPU-bound, easily splittable datasets with stateless, side-effect-free operations. They hurt for small/IO-bound/ordered/stateful work and share the common ForkJoinPool.' },
        { q: 'Proper Optional usage?', a: 'Use as a return type; chain map/flatMap/filter; resolve with orElseGet/orElseThrow. Avoid Optional.get() without a presence check and don\'t use it for fields or parameters.' },
        { q: 'Can a stream be reused after a terminal operation?', a: 'No — streams are single-use. After a terminal op the stream is consumed; reusing it throws IllegalStateException. Create a new stream from the source.' }
      ]
    },

    {
      id: '2.4',
      title: 'Virtual Threads & Structured Concurrency',
      hours: 5,
      notes: `
# Virtual Threads (Project Loom, JDK 21)

**Virtual threads** are lightweight threads managed by the JVM, not the OS. You can run **millions** of them. They make the simple "thread-per-request" blocking style scale like async/reactive code — without the callback complexity.

## The problem they solve

A platform (OS) thread costs ~1 MB of stack and a kernel scheduling slot, so a server caps at a few thousand. To scale I/O-bound services we resorted to **reactive** programming (WebFlux, callbacks) — fast, but hard to read, debug, and profile.

Virtual threads give you **synchronous, blocking code that scales**: when a virtual thread blocks on I/O, the JVM **unmounts** it from its carrier (platform) thread, freeing the carrier to run another virtual thread.

## Mounting & carriers

\`\`\`
Millions of virtual threads
        |  mount/unmount on block
        v
Small pool of carrier (platform) threads  (≈ #CPU cores, a ForkJoinPool)
        v
            OS threads
\`\`\`

A blocking call (\`socket.read()\`, \`Thread.sleep\`, JDBC on a Loom-ready driver) **parks** the virtual thread and its stack is stored on the heap; the carrier moves on. When I/O completes, the virtual thread is rescheduled onto any free carrier.

## Creating them

\`\`\`
Thread.startVirtualThread(() -> handle(request));

try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 1_000_000)
             .forEach(i -> executor.submit(() -> callService(i)));
} // closes & joins all
\`\`\`

> [!WARNING]
> **Pinning.** A virtual thread cannot unmount while inside a \`synchronized\` block/method *if it blocks there*, or during a native (JNI) call — it stays **pinned** to its carrier, hurting scalability. Fix: replace \`synchronized\` guarding I/O with \`ReentrantLock\`. Diagnose with \`-Djdk.tracePinnedThreads=full\`. (JDK 24 removes most synchronized pinning, but interviewers still ask.)

> [!TIP]
> **Don't pool virtual threads.** They're cheap and disposable — create one per task. Pooling exists to amortise *expensive* platform threads; that rationale disappears. Likewise, don't cache them in \`ThreadLocal\` heavily (millions × ThreadLocal = memory blow-up). Loom adds **scoped values** as the replacement.

## Structured concurrency (preview)

\`StructuredTaskScope\` ties the lifetime of concurrent subtasks to a code block: if one fails, siblings are cancelled; the parent waits for all. This makes concurrent code as reasoned-about as sequential code (no leaked threads).

\`\`\`
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var user  = scope.fork(() -> fetchUser(id));
    var order = scope.fork(() -> fetchOrder(id));
    scope.join().throwIfFailed();          // wait, propagate first error
    return new Response(user.get(), order.get());
}
\`\`\`

## When NOT to use virtual threads

- **CPU-bound** work — no I/O to unmount on; a bounded platform pool is correct.
- Tasks that hold \`synchronized\` across blocking calls until you fix pinning.

> [!EU]
> **The 2024-2025 flagship topic.** Expect: *"What are virtual threads, how do they differ from platform threads, and what is pinning?"* Strong answer: lightweight JVM-scheduled threads that unmount on blocking I/O onto a small carrier pool, enabling millions of cheap thread-per-task units; pinning occurs in synchronized/native sections and is fixed with ReentrantLock. Then contrast with reactive: *"Loom gives reactive-like scalability with imperative readability."* This signals you track the modern JVM.

> [!SUCCESS]
> **Migration story interviewers love:** "We had a WebFlux service that was hard to debug. With JDK 21 we moved hot paths to virtual threads + plain blocking JDBC, kept p99 latency, and halved the code/onboarding cost." Concrete trade-off thinking wins offers.
`,
      code: [
        {
          lang: 'java',
          title: 'A million virtual threads vs platform threads',
          code: `import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.time.Duration;

public class VirtualThreadDemo {
    public static void main(String[] args) throws InterruptedException {
        final int TASKS = 100_000;          // try 1_000_000 on JDK 21+
        AtomicLong done = new AtomicLong();
        long start = System.currentTimeMillis();

        // One virtual thread PER TASK — unthinkable with platform threads
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < TASKS; i++) {
                executor.submit(() -> {
                    try {
                        Thread.sleep(Duration.ofMillis(100)); // simulates blocking I/O
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    done.incrementAndGet();
                });
            }
        } // close() waits for all tasks

        System.out.println("Completed tasks : " + done.get());
        System.out.println("Wall time (ms)  : " + (System.currentTimeMillis() - start));
        System.out.println("Each task slept 100ms, yet total time is tiny — they all ran concurrently.");
        System.out.println("A fixed platform pool of, say, 200 threads would need ~" +
                           (TASKS / 200 * 100) + "ms.");
    }
}`
        },
        {
          lang: 'java',
          title: 'Structured concurrency style (JDK 21 preview API)',
          code: `import java.util.concurrent.*;

// NOTE: StructuredTaskScope is a preview API; on the sandbox we emulate the
// pattern with a virtual-thread executor to show the same "fan-out, join, combine" shape.
public class StructuredDemo {
    record User(String name) {}
    record Order(String id, double total) {}
    record Dashboard(User user, Order order) {}

    static User  fetchUser(long id)  throws InterruptedException { Thread.sleep(120); return new User("Raja#" + id); }
    static Order fetchOrder(long id) throws InterruptedException { Thread.sleep(150); return new Order("ORD-" + id, 249.50); }

    public static void main(String[] args) throws Exception {
        long id = 7;
        long start = System.currentTimeMillis();

        try (var scope = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<User>  user  = scope.submit(() -> fetchUser(id));
            Future<Order> order = scope.submit(() -> fetchOrder(id));
            Dashboard dash = new Dashboard(user.get(), order.get()); // both run concurrently
            System.out.println("Dashboard : " + dash);
        }
        // ~150ms (the slower call), not 270ms — the two I/O calls overlapped
        System.out.println("Wall time : " + (System.currentTimeMillis() - start) + " ms (concurrent, not 270ms)");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is a virtual thread and how does it differ from a platform thread?', a: 'A lightweight thread scheduled by the JVM (not the OS). Many virtual threads multiplex onto a small pool of carrier platform threads; on blocking I/O a virtual thread unmounts (its stack moves to the heap), freeing the carrier. You can run millions; platform threads cap in the thousands.' },
        { q: 'What is pinning and how do you fix it?', a: 'A virtual thread cannot unmount from its carrier while blocking inside a synchronized block/method or a native call, so it stays pinned and reduces scalability. Fix by replacing synchronized (around blocking I/O) with ReentrantLock; diagnose via -Djdk.tracePinnedThreads=full.' },
        { q: 'Should you pool virtual threads? Why or why not?', a: 'No. Pooling exists to amortise the cost of expensive platform threads. Virtual threads are cheap and disposable — create one per task (newVirtualThreadPerTaskExecutor).' },
        { q: 'When should you NOT use virtual threads?', a: 'For CPU-bound work (no blocking point to unmount on — a bounded platform pool is better) and for tasks that hold synchronized across blocking calls until pinning is resolved.' },
        { q: 'What does structured concurrency (StructuredTaskScope) give you?', a: 'It binds subtask lifetimes to a syntactic scope: fork subtasks, join all, propagate the first failure and auto-cancel siblings — eliminating leaked threads and making concurrent code reason like sequential code.' },
        { q: 'How do virtual threads compare to reactive (WebFlux)?', a: 'Both scale I/O-bound workloads with few OS threads, but virtual threads keep simple imperative/blocking code that\'s easy to read, debug, and profile, whereas reactive uses callbacks/operators that are harder to maintain. Loom offers reactive-like scalability with synchronous readability.' }
      ]
    },

    {
      id: '2.5',
      title: 'Records, Sealed Types & Pattern Matching',
      hours: 3,
      notes: `
# Records, Sealed Classes & Pattern Matching

Modern Java (16–21) adds **algebraic-data-type**-style modelling: immutable data carriers, closed hierarchies, and exhaustive pattern matching — making domain code safer and terser.

## Records (16)

Immutable, transparent data carriers. The compiler generates the canonical constructor, private final fields, accessors, \`equals\`, \`hashCode\`, \`toString\`.

\`\`\`
record Money(long minor, String currency) {
    Money {                              // compact constructor: validation
        if (minor < 0) throw new IllegalArgumentException("negative");
    }
}
\`\`\`

## Sealed classes/interfaces (17)

Restrict **who** can implement/extend a type, giving the compiler a *closed* set for exhaustiveness.

\`\`\`
sealed interface Shape permits Circle, Square, Rectangle {}
record Circle(double r) implements Shape {}
record Square(double side) implements Shape {}
record Rectangle(double w, double h) implements Shape {}
\`\`\`

## Pattern matching (16–21)

- **\`instanceof\` patterns** — \`if (o instanceof String s) use(s);\` (no cast).
- **Switch patterns + records deconstruction (21)** — match on type *and* destructure components, with **exhaustiveness** checked by the compiler when the type is sealed.

> [!TIP]
> Sealed + records + switch patterns = **exhaustive, refactor-safe domain logic**. Add a new \`permits\` subtype and every non-exhaustive switch fails to compile — the compiler becomes your checklist. This is the idiomatic replacement for the Visitor pattern.

> [!EU]
> Demonstrate you model domains with **immutability and closed hierarchies**, not anaemic mutable beans. Show a sealed \`Result\`/\`Either\` or a \`Shape\` area calculator with switch patterns. European product teams value type-safety and maintainability.
`,
      code: [
        {
          lang: 'java',
          title: 'Sealed + records + switch pattern matching',
          code: `public class PatternDemo {
    sealed interface Shape permits Circle, Square, Rectangle {}
    record Circle(double r) implements Shape {}
    record Square(double side) implements Shape {}
    record Rectangle(double w, double h) implements Shape {}

    // Exhaustive switch with record deconstruction (JDK 21).
    static double area(Shape s) {
        return switch (s) {
            case Circle(double r)        -> Math.PI * r * r;
            case Square(double side)     -> side * side;
            case Rectangle(double w, double h) -> w * h;
            // No default needed: 'permits' makes the set closed & exhaustive.
        };
    }

    static String describe(Object o) {
        return switch (o) {
            case Integer i when i > 100 -> "big int " + i;   // guarded pattern
            case Integer i              -> "int " + i;
            case String str             -> "string of length " + str.length();
            case null                   -> "null!";
            default                     -> "something else";
        };
    }

    public static void main(String[] args) {
        Shape[] shapes = { new Circle(2), new Square(3), new Rectangle(2, 5) };
        for (Shape s : shapes)
            System.out.printf("%-28s area = %.2f%n", s, area(s));

        System.out.println(describe(250));
        System.out.println(describe("hello"));
        System.out.println(describe(null));
    }
}`
        }
      ],
      flashcards: [
        { q: 'What does a record generate for you?', a: 'A canonical constructor, private final fields, public accessors named after components, plus equals, hashCode, and toString derived from the components. Records are implicitly final and immutable.' },
        { q: 'What problem do sealed types solve?', a: 'They restrict which classes may extend/implement a type (via permits), giving a closed hierarchy so the compiler can verify exhaustiveness in switch expressions and prevent unexpected subtypes.' },
        { q: 'What is a guarded pattern in a switch?', a: 'A pattern with a boolean condition: case Integer i when i > 100 -> ... matches only when both the type pattern and the guard hold.' },
        { q: 'How do sealed + records + switch patterns replace the Visitor pattern?', a: 'They provide exhaustive, type-safe dispatch with destructuring in one place; adding a new permitted subtype causes non-exhaustive switches to fail compilation, surfacing every site that must handle it.' }
      ]
    }
  ]
},

/* ===================== PHASE 3: Spring ===================== */
{
  id: 'p3',
  title: 'Spring & Spring Boot',
  icon: 'leaf',
  blurb: 'IoC/DI internals, Boot auto-configuration, transactions, Data JPA, and security.',
  modules: [
    {
      id: '3.1',
      title: 'IoC, DI & Bean Lifecycle',
      hours: 4,
      notes: `
# Inversion of Control & Dependency Injection

Spring's core is an **IoC container** (the \`ApplicationContext\`) that creates objects (**beans**), wires their dependencies, and manages their lifecycle — so your classes declare *what* they need, not *how* to build it.

## Why DI

- **Testability** — inject mocks/fakes instead of \`new\`-ing collaborators.
- **Loose coupling** — depend on interfaces; swap implementations via config.
- **Single responsibility** — wiring lives in the container, not in business code.

## Injection styles

| Style | Recommendation |
|-------|----------------|
| **Constructor** | ✅ Preferred — immutable, final fields, fails fast, easy to test, no reflection magic |
| **Setter** | optional/changeable dependencies |
| **Field (\`@Autowired\` on field)** | ❌ Avoid — hides dependencies, can't be final, hard to test without container |

> [!TIP]
> With a single constructor, Spring auto-wires it — no \`@Autowired\` needed. Combine with Lombok \`@RequiredArgsConstructor\` + \`final\` fields for clean, immutable beans.

## Bean scopes

\`singleton\` (default, one per container), \`prototype\` (new each request), and web scopes \`request\`/\`session\`/\`application\`.

> [!WARNING]
> Injecting a **prototype** bean into a **singleton** captures one instance forever. Use \`ObjectProvider\`, \`@Lookup\`, or a \`Provider<T>\` to get a fresh instance per use.

## Lifecycle hooks

\`@PostConstruct\` → after dependencies injected; \`@PreDestroy\` → before container shutdown. Or implement \`InitializingBean\`/\`DisposableBean\`, or define \`@Bean(initMethod, destroyMethod)\`.

## Bean creation order & cycles

Spring resolves the dependency graph topologically. **Circular constructor dependencies** fail at startup — a design smell. Fixes: refactor the shared logic into a third bean, use setter injection, or (last resort) \`@Lazy\`.

> [!EU]
> Expect: *"Field vs constructor injection — which and why?"* Answer constructor (immutability, explicit deps, testability, fail-fast). And *"singleton bean with mutable state — what's the risk?"* → it's shared across threads; keep beans stateless or guard state.
`,
      code: [
        {
          lang: 'java',
          title: 'Constructor injection & lifecycle (conceptual)',
          code: `import java.util.*;
import java.util.function.*;

// Plain-Java illustration of the IoC idea Spring automates.
public class DiDemo {
    interface PaymentGateway { String charge(int cents); }

    // Two implementations — the container picks one
    static class StripeGateway implements PaymentGateway {
        public String charge(int cents) { return "Stripe charged " + cents + "c"; }
    }
    static class MockGateway implements PaymentGateway {
        public String charge(int cents) { return "MOCK ok " + cents + "c"; }
    }

    // Business class depends on the ABSTRACTION, injected via constructor (final = immutable)
    static class CheckoutService {
        private final PaymentGateway gateway;
        CheckoutService(PaymentGateway gateway) { this.gateway = gateway; } // @Autowired implied
        String buy(int cents) { return gateway.charge(cents); }
    }

    public static void main(String[] args) {
        // A tiny 'container': map of bean factories
        Map<String, Supplier<PaymentGateway>> ctx = Map.of(
            "prod", StripeGateway::new,
            "test", MockGateway::new
        );

        var prod = new CheckoutService(ctx.get("prod").get());
        var test = new CheckoutService(ctx.get("test").get());
        System.out.println(prod.buy(1999));  // real impl
        System.out.println(test.buy(1999));  // swapped for tests — that's DI's payoff
    }
}`
        }
      ],
      flashcards: [
        { q: 'Why is constructor injection preferred over field injection?', a: 'It allows final (immutable) fields, makes dependencies explicit, fails fast at startup if a dependency is missing, and lets you instantiate the class in unit tests without the Spring container or reflection.' },
        { q: 'What breaks when you inject a prototype bean into a singleton?', a: 'The singleton captures a single prototype instance at creation time, so you never get fresh instances. Use ObjectProvider/Provider/@Lookup to obtain a new one per use.' },
        { q: 'Difference between @PostConstruct and a constructor?', a: 'The constructor runs before dependency injection completes; @PostConstruct runs after all dependencies are injected, so it can safely use them for initialisation.' },
        { q: 'What is the default bean scope and its threading implication?', a: 'Singleton — one shared instance per container. It\'s shared across all threads, so beans must be stateless or have their mutable state externally synchronised.' }
      ]
    },

    {
      id: '3.2',
      title: 'Spring Boot Auto-Configuration',
      hours: 3,
      notes: `
# Spring Boot Auto-Configuration

Boot's "convention over configuration" magic is **conditional bean registration** driven by what's on the classpath and your properties.

## How it works

1. \`@SpringBootApplication\` = \`@Configuration\` + \`@ComponentScan\` + **\`@EnableAutoConfiguration\`**.
2. \`@EnableAutoConfiguration\` loads auto-config classes listed in \`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports\` (was \`spring.factories\` pre-2.7).
3. Each auto-config class is gated by **\`@Conditional\`** annotations:
   - \`@ConditionalOnClass\` — a type is on the classpath (e.g. \`DataSource\`).
   - \`@ConditionalOnMissingBean\` — you haven't defined your own → Boot backs off.
   - \`@ConditionalOnProperty\` — a property toggles it.

> [!TIP]
> The golden rule: **define your own bean and Boot's auto-config backs off** (\`@ConditionalOnMissingBean\`). That's how you override defaults — just declare the bean.

## Diagnosing it

Run with \`--debug\` to print the **Condition Evaluation Report**: which auto-configs matched, which didn't, and why. Indispensable for "why isn't my bean created?".

## Starters & properties

- **Starters** (\`spring-boot-starter-web\`) are curated dependency bundles — no version juggling.
- **\`application.yml\`/\`.properties\`** → bound to \`@ConfigurationProperties\` POJOs (type-safe config). Profiles (\`application-prod.yml\`) layer environment-specific overrides.

> [!WARNING]
> The **actuator** (\`/actuator\`) exposes health, metrics, env, and more. In production, secure it and expose only \`health\`/\`info\` over the web; never leak \`/env\` or \`/heapdump\` publicly.

> [!EU]
> Be ready for *"What is auto-configuration and how would you override a default DataSource?"* and *"How do you provide environment-specific config?"* (profiles + externalised config + secrets via env/Vault, never committed).
`,
      code: [
        {
          lang: 'java',
          title: 'Conditional bean registration (the auto-config idea)',
          code: `import java.util.*;

// Emulates @ConditionalOnMissingBean / @ConditionalOnProperty logic.
public class AutoConfigDemo {
    interface DataSource { String url(); }
    static class H2DataSource   implements DataSource { public String url() { return "jdbc:h2:mem:default"; } }
    static class UserDataSource implements DataSource { public String url() { return "jdbc:postgresql://prod/db"; } }

    // 'Container' state: user-defined beans + properties
    static DataSource autoConfigure(Map<String, DataSource> userBeans, Map<String, String> props) {
        // @ConditionalOnMissingBean(DataSource): only create default if user didn't
        if (userBeans.containsKey("dataSource")) {
            System.out.println("User bean present -> auto-config BACKS OFF");
            return userBeans.get("dataSource");
        }
        // @ConditionalOnProperty
        boolean embedded = !"false".equals(props.getOrDefault("app.db.embedded", "true"));
        System.out.println("No user bean -> auto-config creates default (embedded=" + embedded + ")");
        return embedded ? new H2DataSource() : new UserDataSource();
    }

    public static void main(String[] args) {
        System.out.println(autoConfigure(Map.of(), Map.of()).url());                 // default H2
        System.out.println(autoConfigure(Map.of("dataSource", new UserDataSource()), // user override wins
                                         Map.of()).url());
    }
}`
        }
      ],
      flashcards: [
        { q: 'What three annotations does @SpringBootApplication combine?', a: '@Configuration, @ComponentScan, and @EnableAutoConfiguration.' },
        { q: 'How does Boot decide whether to apply an auto-configuration?', a: 'Via @Conditional annotations — @ConditionalOnClass (type on classpath), @ConditionalOnMissingBean (you didn\'t define your own), @ConditionalOnProperty (toggle), etc. Auto-config classes are listed in AutoConfiguration.imports.' },
        { q: 'How do you override a Boot default bean?', a: 'Define your own bean of that type; @ConditionalOnMissingBean makes the auto-configuration back off. Verify with the --debug Condition Evaluation Report.' },
        { q: 'How do you supply environment-specific configuration?', a: 'Spring profiles (application-{profile}.yml) plus externalised config and @ConfigurationProperties for type-safe binding; secrets come from env vars/Vault, never committed.' }
      ]
    },

    {
      id: '3.3',
      title: 'Transactions, AOP & @Transactional',
      hours: 4,
      notes: `
# Transactions & AOP

\`@Transactional\` is the most misunderstood Spring annotation. Knowing *how* it works (proxies) explains its sharp edges.

## It's a proxy

Spring wraps your bean in a **proxy** (JDK dynamic proxy for interfaces, CGLIB subclass otherwise). The proxy opens a transaction before the method and commits/rolls back after. This has consequences:

> [!WARNING]
> **Self-invocation doesn't work.** Calling a \`@Transactional\` method from *another method in the same class* bypasses the proxy → no transaction. Fix: move the method to another bean, or self-inject the proxy.

> [!WARNING]
> \`@Transactional\` on \`private\`/\`final\` methods is ignored — the proxy can't intercept them. Use \`public\` methods.

## Rollback rules

By default Spring rolls back on **unchecked** exceptions (\`RuntimeException\`, \`Error\`) but **commits on checked exceptions**. Override with \`@Transactional(rollbackFor = Exception.class)\`.

## Propagation

| Propagation | Behaviour |
|-------------|-----------|
| \`REQUIRED\` (default) | join existing tx or create one |
| \`REQUIRES_NEW\` | suspend current, start independent tx (e.g. audit log that must persist even if outer rolls back) |
| \`NESTED\` | savepoint within current tx |
| \`SUPPORTS\` / \`NOT_SUPPORTED\` / \`MANDATORY\` / \`NEVER\` | situational |

## Isolation

Maps to DB isolation levels (READ_COMMITTED default in most DBs) — see DB phase for anomalies.

> [!TIP]
> Keep transactions **short**. Never do remote/HTTP calls or long computations inside a transaction — you hold DB connections/locks the whole time. Load data, close the tx, then call out.

> [!EU]
> Killer question: *"Why didn't my @Transactional roll back / why is it ignored?"* Strong answers: self-invocation bypasses the proxy; checked exception committed (need rollbackFor); method not public; or no transaction manager. Demonstrating the **proxy mental model** marks a senior.
`,
      code: [
        {
          lang: 'java',
          title: 'The self-invocation proxy pitfall (illustrated)',
          code: `// Demonstrates WHY self-invocation skips the transactional proxy.
public class TxProxyDemo {

    interface OrderOps { void placeOrder(); void chargeCard(); }

    // The 'real' bean
    static class OrderService implements OrderOps {
        public void placeOrder() {
            System.out.println("  placeOrder(): business logic");
            // BUG: direct self-call -> bypasses the proxy -> chargeCard runs WITHOUT a tx
            chargeCard();
        }
        public void chargeCard() {
            System.out.println("  chargeCard(): should be @Transactional, but proxy was bypassed!");
        }
    }

    // A proxy that 'opens a transaction' around intercepted calls
    static OrderOps transactionalProxy(OrderService target) {
        return new OrderOps() {
            public void placeOrder() { tx("placeOrder", target::placeOrder); }
            public void chargeCard() { tx("chargeCard", target::chargeCard); }
            private void tx(String name, Runnable r) {
                System.out.println("[proxy] BEGIN tx for " + name);
                r.run();
                System.out.println("[proxy] COMMIT tx for " + name);
            }
        };
    }

    public static void main(String[] args) {
        OrderOps proxied = transactionalProxy(new OrderService());
        System.out.println("Calling placeOrder() via proxy:");
        proxied.placeOrder();
        System.out.println("\\nNotice: chargeCard ran INSIDE placeOrder without its own BEGIN/COMMIT");
        System.out.println("-> that is the self-invocation pitfall.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'Why does calling a @Transactional method from the same class not start a transaction?', a: 'Spring transactions work via a proxy that wraps the bean. Self-invocation calls the target directly (this.method()), bypassing the proxy, so no transactional advice runs. Fix by moving the method to another bean or self-injecting the proxy.' },
        { q: 'Default rollback behaviour of @Transactional?', a: 'Rolls back on unchecked exceptions (RuntimeException/Error), commits on checked exceptions. Use rollbackFor to roll back on checked exceptions too.' },
        { q: 'When use REQUIRES_NEW propagation?', a: 'When a sub-operation must commit independently of the outer transaction — e.g. writing an audit/log record that should persist even if the surrounding business transaction rolls back. It suspends the current tx and runs in a new one.' },
        { q: 'Why avoid remote calls inside a transaction?', a: 'The transaction holds a DB connection and locks for its entire duration; a slow HTTP/remote call extends lock/connection hold time, throttling throughput and risking pool exhaustion and deadlocks.' }
      ]
    },

    {
      id: '3.4',
      title: 'Spring Data JPA in Practice',
      hours: 3,
      notes: `
# Spring Data JPA

Repositories give you CRUD + query derivation for free, but the abstraction hides performance traps.

## Repository tiers

\`Repository\` → \`CrudRepository\` → \`PagingAndSortingRepository\` → \`JpaRepository\`. Declare an interface; Spring generates the implementation.

- **Derived queries**: \`findByEmailAndActiveTrue(...)\` parsed from the method name.
- **\`@Query\`**: JPQL or native SQL for complex cases.
- **Projections**: interface/DTO projections to fetch only needed columns.

## The N+1 problem (must-know)

Loading N parents then lazily fetching each one's children issues **1 + N** queries.

> [!WARNING]
> **N+1 selects** is the #1 JPA performance bug. Fix with \`JOIN FETCH\` (JPQL), an \`@EntityGraph\`, or batch fetching (\`@BatchSize\` / \`hibernate.default_batch_fetch_size\`). Always check the SQL log (\`spring.jpa.show-sql\` / datasource-proxy) — the ORM hides query counts.

## LAZY vs EAGER

Default LAZY for collections, EAGER for \`@ManyToOne\`. Prefer **LAZY everywhere** and fetch explicitly when needed. EAGER causes surprise joins and N+1.

> [!WARNING]
> \`LazyInitializationException\` — accessing a lazy association after the persistence context (session) closed, e.g. in the controller/view. Fix by fetching within the transaction (JOIN FETCH/entity graph) or mapping to a DTO inside the service — **not** by enabling open-session-in-view.

## Pagination & locking

\`Pageable\` for paging; \`@Lock(PESSIMISTIC_WRITE)\` or \`@Version\` (optimistic locking) for concurrency.

> [!EU]
> Almost guaranteed: *"What is the N+1 problem and how do you solve it?"* and *"LAZY vs EAGER — what would you default to?"* Show you read the SQL logs and think in queries-per-request.
`,
      code: [
        {
          lang: 'sql',
          title: 'N+1 vs JOIN FETCH (SQL the ORM emits)',
          code: `-- ❌ N+1: ORM first loads authors, then one query PER author for books
SELECT * FROM author;                          -- 1 query
SELECT * FROM book WHERE author_id = 1;        -- +1
SELECT * FROM book WHERE author_id = 2;        -- +1
SELECT * FROM book WHERE author_id = 3;        -- +1  ... (N queries)

-- ✅ One query with JOIN FETCH (JPQL: "select a from Author a join fetch a.books")
SELECT a.*, b.*
FROM   author a
JOIN   book   b ON b.author_id = a.id;         -- 1 query total

-- ✅ Or batch the children: hibernate.default_batch_fetch_size = 20
SELECT * FROM author;                           -- 1
SELECT * FROM book WHERE author_id IN (1,2,3);  -- 1 (IN clause)`
        }
      ],
      flashcards: [
        { q: 'What is the N+1 select problem and how do you fix it?', a: 'Loading N parent rows then firing one extra query per parent to fetch its association = 1+N queries. Fix with JOIN FETCH, @EntityGraph, or batch fetching (@BatchSize / default_batch_fetch_size). Always verify via SQL logs.' },
        { q: 'What causes LazyInitializationException and the right fix?', a: 'Accessing a lazy association after the persistence context/session has closed (e.g. in the view layer). Fix by fetching the data within the transaction (JOIN FETCH/entity graph) or mapping to a DTO in the service — not by enabling open-session-in-view.' },
        { q: 'Default fetch types and recommendation?', a: '@ManyToOne/@OneToOne default EAGER; collections default LAZY. Best practice: make everything LAZY and fetch explicitly where needed to avoid surprise joins and N+1.' },
        { q: 'Optimistic vs pessimistic locking in JPA?', a: 'Optimistic uses a @Version column and fails on conflicting concurrent writes (no DB locks held) — good for low contention. Pessimistic (@Lock PESSIMISTIC_WRITE) takes a DB row lock for the transaction — for high-contention critical sections.' }
      ]
    }
  ]
},

/* ===================== PHASE 4: Databases ===================== */
{
  id: 'p4',
  title: 'Databases & Persistence',
  icon: 'database',
  blurb: 'SQL mastery, indexing, transaction isolation & anomalies, and SQL-vs-NoSQL trade-offs.',
  modules: [
    {
      id: '4.1',
      title: 'SQL Mastery & Joins',
      hours: 4,
      notes: `
# SQL Mastery

Backend seniors write SQL daily and are expected to reason about correctness and performance, not just call an ORM.

## Join types

- **INNER** — rows matching in both tables.
- **LEFT/RIGHT OUTER** — all rows from one side, NULLs where no match.
- **FULL OUTER** — union of left & right.
- **CROSS** — cartesian product.
- **SELF** — table joined to itself (hierarchies, pairs).

## Aggregation & grouping

\`GROUP BY\` + \`HAVING\` (filter *after* aggregation, vs \`WHERE\` *before*). \`COUNT\`, \`SUM\`, \`AVG\`, \`MIN\`, \`MAX\`.

## Window functions (senior signal)

\`ROW_NUMBER()\`, \`RANK()\`, \`DENSE_RANK()\`, \`LAG/LEAD\`, running totals via \`SUM() OVER (...)\`. They compute across a "window" of rows **without collapsing** them like \`GROUP BY\` does.

> [!TIP]
> "Top N per group" (e.g. top 2 highest-paid per department) is a classic test — solve it with \`ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC)\` then filter \`rn <= 2\`. Knowing window functions separates seniors from juniors.

## Execution order (not text order!)

\`FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT\`. This explains why you can't use a \`SELECT\` alias in \`WHERE\`.

> [!EU]
> Live SQL is common in EU loops: *"second-highest salary"*, *"top N per group"*, *"find duplicates"*. Practise window functions and correlated subqueries. Verbalise the execution order as you write.
`,
      code: [
        {
          lang: 'sql',
          title: 'Top-N-per-group & second highest (window functions)',
          code: `-- Top 2 highest-paid employees per department
SELECT dept, name, salary
FROM (
    SELECT dept, name, salary,
           ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn
    FROM   employee
) ranked
WHERE rn <= 2;

-- Second-highest salary overall (handles ties with DENSE_RANK)
SELECT DISTINCT salary
FROM (
    SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS r
    FROM   employee
) t
WHERE r = 2;

-- Find duplicate emails
SELECT email, COUNT(*) AS n
FROM   users
GROUP  BY email
HAVING COUNT(*) > 1;

-- Running total of revenue by day
SELECT day, amount,
       SUM(amount) OVER (ORDER BY day ROWS UNBOUNDED PRECEDING) AS running_total
FROM   daily_revenue;`
        }
      ],
      flashcards: [
        { q: 'Difference between WHERE and HAVING?', a: 'WHERE filters individual rows before aggregation; HAVING filters groups after GROUP BY aggregation. You can reference aggregate functions in HAVING but not in WHERE.' },
        { q: 'How do window functions differ from GROUP BY?', a: 'Window functions compute a value across a set of related rows (a "window") while preserving each individual row, whereas GROUP BY collapses rows into one per group.' },
        { q: 'How do you get the top N rows per group?', a: 'Use ROW_NUMBER() OVER (PARTITION BY group_col ORDER BY sort_col) in a subquery, then filter WHERE row_number <= N.' },
        { q: 'What is the logical execution order of a SELECT?', a: 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. This is why SELECT aliases aren\'t visible in WHERE/GROUP BY.' }
      ]
    },

    {
      id: '4.2',
      title: 'Indexing & Query Performance',
      hours: 4,
      notes: `
# Indexing & Query Performance

An index is a sorted data structure (usually a **B-tree**) that lets the DB find rows without scanning the whole table — the single biggest lever on query speed.

## B-tree indexes

Balanced tree, O(log n) lookups, supports equality **and** range (\`>\`, \`BETWEEN\`, \`ORDER BY\`, prefix \`LIKE 'abc%'\`). The default for most columns.

## Composite indexes & the leftmost-prefix rule

An index on \`(a, b, c)\` serves queries filtering on \`a\`, \`a,b\`, or \`a,b,c\` — **left to right**. It does **not** help a query filtering only on \`b\` or \`c\`. Order columns by selectivity and query pattern.

## Covering indexes

If an index contains **all** columns a query needs, the DB answers from the index alone (**index-only scan**) — no table lookup.

## EXPLAIN / EXPLAIN ANALYZE

The interview centrepiece. \`EXPLAIN\` shows the planner's chosen plan; \`EXPLAIN ANALYZE\` runs it and shows real timings. Look for **Seq Scan** on big tables (bad for selective queries), and confirm **Index Scan/Index Only Scan**.

> [!WARNING]
> Indexes **cost** writes (every INSERT/UPDATE/DELETE maintains them) and storage. Don't over-index. A function on the column (\`WHERE UPPER(email)=...\`) or a leading wildcard (\`LIKE '%x'\`) **disables** a normal index — use a functional/expression index or full-text search.

## Other index types

- **Hash** — equality only, no ranges.
- **GIN/GiST** (Postgres) — full-text, arrays, JSONB, geospatial.
- **Partial** — \`WHERE active = true\`, smaller & faster for filtered queries.

> [!EU]
> Expect: *"A query is slow — how do you debug it?"* → run EXPLAIN ANALYZE, spot the seq scan/expensive node, add/adjust an index (mind leftmost-prefix), verify the plan changed, re-measure. *"Trade-offs of indexes?"* → faster reads vs slower writes + storage.
`,
      code: [
        {
          lang: 'sql',
          title: 'EXPLAIN-driven index tuning',
          code: `-- Before: full table scan on a 10M-row table
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42 AND status = 'SHIPPED';
--  Seq Scan on orders  (cost=0..210000 rows=...) actual time=850ms   <-- slow!

-- Composite index matching the filter (most selective column considerations apply)
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);

EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42 AND status = 'SHIPPED';
--  Index Scan using idx_orders_customer_status  actual time=0.4ms     <-- fast!

-- Leftmost-prefix rule: this index ALSO serves customer_id-only queries...
SELECT * FROM orders WHERE customer_id = 42;            -- uses index
-- ...but NOT status-only queries:
SELECT * FROM orders WHERE status = 'SHIPPED';          -- cannot use it -> seq scan

-- Index-disabling anti-patterns:
SELECT * FROM users WHERE UPPER(email) = 'A@B.COM';     -- function kills index
-- Fix with an expression index:
CREATE INDEX idx_users_email_upper ON users (UPPER(email));`
        }
      ],
      flashcards: [
        { q: 'What data structure backs a typical SQL index and why?', a: 'A balanced B-tree: O(log n) lookups that support both equality and range scans, ordered traversal (ORDER BY), and prefix matches — versatile for most query shapes.' },
        { q: 'Explain the leftmost-prefix rule for composite indexes.', a: 'An index on (a,b,c) can be used for predicates on a, a+b, or a+b+c (left to right), but not for queries filtering only on b or c.' },
        { q: 'What is a covering index?', a: 'An index that includes every column a query needs, letting the DB satisfy it with an index-only scan without touching the table heap.' },
        { q: 'Name patterns that prevent index usage.', a: 'Wrapping the column in a function (UPPER(col)=...), leading wildcard LIKE \'%x\', implicit type casts, or OR across different columns. Use expression/functional indexes or rewrite the query.' },
        { q: 'What is the cost of adding indexes?', a: 'Slower writes (each INSERT/UPDATE/DELETE must maintain every index) and extra storage — so index to match real query patterns, not speculatively.' }
      ]
    },

    {
      id: '4.3',
      title: 'Transactions, ACID & Isolation Levels',
      hours: 4,
      notes: `
# Transactions, ACID & Isolation

## ACID

- **Atomicity** — all-or-nothing.
- **Consistency** — constraints/invariants preserved.
- **Isolation** — concurrent txns don't corrupt each other.
- **Durability** — committed data survives crashes (WAL/redo log).

## Isolation levels & the anomalies they prevent

| Level | Dirty read | Non-repeatable read | Phantom read |
|-------|:---------:|:-------------------:|:------------:|
| READ UNCOMMITTED | ✅ possible | ✅ | ✅ |
| READ COMMITTED *(default in PG/Oracle)* | ❌ | ✅ | ✅ |
| REPEATABLE READ *(default in MySQL/InnoDB)* | ❌ | ❌ | ✅* |
| SERIALIZABLE | ❌ | ❌ | ❌ |

- **Dirty read** — reading another txn's uncommitted change.
- **Non-repeatable read** — same row read twice gives different values (another txn updated+committed between).
- **Phantom read** — same range query returns new rows (another txn inserted).

> [!TIP]
> Higher isolation = more correctness but more locking/aborts = less concurrency. Most OLTP apps run **READ COMMITTED** and handle the rest with optimistic locking (\`@Version\`) or explicit \`SELECT ... FOR UPDATE\`.

## MVCC

Postgres/InnoDB use **Multi-Version Concurrency Control**: readers see a consistent **snapshot** without blocking writers, and writers don't block readers. Each row keeps versions; vacuum/undo cleans old ones.

> [!WARNING]
> **Lost update**: two txns read a balance, both add, both write — one update is lost. Prevent with optimistic locking (version check on write) or \`SELECT ... FOR UPDATE\` to serialise.

> [!EU]
> Reliable question: *"Explain isolation levels and which anomaly each prevents."* Memorise the table. Then *"How do you prevent a lost update / handle concurrent edits?"* → optimistic (@Version) vs pessimistic (FOR UPDATE) with trade-offs.
`,
      code: [
        {
          lang: 'sql',
          title: 'Preventing lost updates: optimistic vs pessimistic',
          code: `-- ❌ Lost update race:
--   Tx A: SELECT balance FROM account WHERE id=1;   -- reads 100
--   Tx B: SELECT balance FROM account WHERE id=1;   -- reads 100
--   Tx A: UPDATE account SET balance=120 WHERE id=1;-- +20
--   Tx B: UPDATE account SET balance=110 WHERE id=1;-- +10 -> A's +20 LOST

-- ✅ Optimistic locking (version column; app retries on conflict)
UPDATE account
SET    balance = balance + 20, version = version + 1
WHERE  id = 1 AND version = 7;        -- affects 0 rows if someone else bumped version

-- ✅ Pessimistic locking (serialise the critical section)
BEGIN;
SELECT balance FROM account WHERE id = 1 FOR UPDATE;  -- locks the row
UPDATE account SET balance = balance + 20 WHERE id = 1;
COMMIT;                                                -- lock released

-- ✅ Or just make it atomic in one statement (no read-modify-write gap)
UPDATE account SET balance = balance + 20 WHERE id = 1;`
        }
      ],
      flashcards: [
        { q: 'What do the four ACID properties mean?', a: 'Atomicity (all-or-nothing), Consistency (invariants/constraints preserved), Isolation (concurrent transactions don\'t interfere), Durability (committed changes survive crashes via WAL/redo).' },
        { q: 'Which anomalies does READ COMMITTED still allow?', a: 'It prevents dirty reads but still allows non-repeatable reads and phantom reads.' },
        { q: 'What is MVCC and what does it buy you?', a: 'Multi-Version Concurrency Control keeps multiple row versions so readers see a consistent snapshot without locking, and readers don\'t block writers (or vice versa) — high read concurrency.' },
        { q: 'How do you prevent a lost update?', a: 'Optimistic locking (a version column checked on write; retry on conflict), pessimistic locking (SELECT ... FOR UPDATE), or expressing the change as a single atomic UPDATE (balance = balance + x).' },
        { q: 'Default isolation level in PostgreSQL vs MySQL/InnoDB?', a: 'PostgreSQL (and Oracle) default to READ COMMITTED; MySQL/InnoDB defaults to REPEATABLE READ.' }
      ]
    }
  ]
},

/* ===================== PHASE 5: System Design ===================== */
{
  id: 'p5',
  title: 'System Design',
  icon: 'network',
  blurb: 'Scalability, caching, load balancing, API design, and the microservice patterns interviewers probe.',
  modules: [
    {
      id: '5.1',
      title: 'Scalability Fundamentals',
      hours: 4,
      notes: `
# Scalability Fundamentals

System design rounds test whether you can reason about **trade-offs** under scale, not recite buzzwords. Start every answer by clarifying requirements and estimating load.

## The framework (use this every time)

1. **Clarify** functional + non-functional requirements (latency, availability, consistency).
2. **Estimate** scale — QPS, data size, read/write ratio (back-of-envelope).
3. **Draw** the high-level diagram: clients → LB → stateless app tier → data tier.
4. **Deep-dive** the bottleneck the interviewer probes.
5. **Discuss** trade-offs, failure modes, and how you'd evolve it.

## Vertical vs horizontal scaling

- **Vertical** — bigger machine. Simple, but a ceiling + single point of failure.
- **Horizontal** — more machines behind a load balancer. Needs **stateless** app servers (push session/state to Redis/DB) and partitioning for data.

## Load balancing

L4 (TCP) vs L7 (HTTP-aware, path/host routing). Algorithms: round-robin, least-connections, consistent hashing (sticky to a node while minimising reshuffle on membership change).

## Statelessness & the data tier

Scale stateless tiers trivially; the **database is usually the bottleneck**. Scale reads with **replicas**, scale writes with **sharding/partitioning**, and absorb load with **caching** (next module).

## CAP theorem

Under a network **P**artition you must choose **C**onsistency or **A**vailability. CP (e.g. ZooKeeper) refuses to serve stale/partitioned data; AP (e.g. Dynamo, Cassandra) stays available and reconciles later (eventual consistency). No real system is "CA".

> [!TIP]
> Latency numbers every engineer should know: L1 cache ~1ns, main memory ~100ns, SSD read ~16µs, intra-DC round trip ~0.5ms, disk seek ~2ms, US↔EU round trip ~100ms. Use these for back-of-envelope estimates.

> [!WARNING]
> Don't jump to microservices/Kafka/sharding before establishing load. Over-engineering is a red flag. State your assumptions and scale *the part that needs it*.

> [!EU]
> European loops favour **pragmatic, trade-off-driven** design over FAANG-scale fantasy. Design a realistic system (URL shortener, rate limiter, ticket booking), justify each component, name the failure modes, and say what you'd monitor. Communication and reasoning are graded as much as the diagram.
`,
      code: [
        {
          lang: 'java',
          title: 'Back-of-envelope capacity estimate',
          code: `public class CapacityEstimate {
    public static void main(String[] args) {
        // Example: a URL shortener
        long dailyWrites = 100_000_000L;       // 100M new URLs/day
        long readWriteRatio = 100;             // 100:1 reads:writes
        int  bytesPerRecord = 500;             // url + metadata
        int  retentionYears = 5;

        long writeQps = dailyWrites / 86_400;
        long readQps  = writeQps * readWriteRatio;
        long records  = dailyWrites * 365 * retentionYears;
        double storageTB = records * bytesPerRecord / 1e12;

        System.out.printf("Write QPS (avg)   : %,d%n", writeQps);
        System.out.printf("Read QPS (avg)    : %,d%n", readQps);
        System.out.printf("Peak QPS (~2x avg): %,d reads%n", readQps * 2);
        System.out.printf("5yr records       : %,d%n", records);
        System.out.printf("5yr storage       : %.1f TB%n", storageTB);
        System.out.println("\\n-> reads dominate: add caching + read replicas; " +
                           "writes modest: single primary + sharding later.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is the structured approach to a system-design question?', a: 'Clarify functional/non-functional requirements, estimate scale (QPS, data, read/write ratio), draw the high-level architecture, deep-dive the bottleneck, then discuss trade-offs and failure modes.' },
        { q: 'Vertical vs horizontal scaling trade-offs?', a: 'Vertical (bigger box) is simple but has a hardware ceiling and a single point of failure. Horizontal (more boxes behind an LB) scales further but requires stateless services and data partitioning.' },
        { q: 'State the CAP theorem.', a: 'During a network partition a distributed system can guarantee either Consistency or Availability, not both. CP systems reject requests to stay consistent; AP systems stay available and become eventually consistent.' },
        { q: 'Why must app servers be stateless to scale horizontally?', a: 'So any request can hit any instance and instances can be added/removed freely. Session/state is pushed to a shared store (Redis/DB), avoiding sticky sessions and enabling load balancing and failover.' }
      ]
    },

    {
      id: '5.2',
      title: 'Caching Strategies',
      hours: 3,
      notes: `
# Caching Strategies

Caching trades memory and staleness for latency and load reduction — usually the highest-leverage performance fix.

## Where caches live

Client → CDN (edge) → API gateway → **application cache (Redis/Memcached)** → DB buffer pool. Each layer cuts load on the next.

## Patterns

- **Cache-aside (lazy loading)** — app checks cache; on miss, loads from DB and populates cache. Most common. Stale risk handled via TTL.
- **Read-through** — cache library loads from DB on miss transparently.
- **Write-through** — write to cache and DB synchronously (consistent, slower writes).
- **Write-behind** — write to cache, async-flush to DB (fast, risk of loss).

## Eviction policies

**LRU** (least recently used, default), **LFU** (least frequently used), **TTL** (time-based), FIFO. Redis supports several \`maxmemory-policy\` modes.

> [!WARNING]
> **The three cache failure modes:**
> - **Cache stampede / thundering herd** — a hot key expires and thousands of requests hit the DB at once. Fix: request coalescing / locks / staggered TTL / early recompute.
> - **Cache penetration** — queries for non-existent keys always miss and hit the DB. Fix: cache negative results or use a Bloom filter.
> - **Cache avalanche** — many keys expire simultaneously. Fix: jittered TTLs.

## Invalidation — "one of the two hard things"

TTL (simple, bounded staleness), explicit invalidation on write, or versioned keys. Choose based on tolerance for staleness.

> [!TIP]
> Redis is more than a cache: distributed locks (Redlock), rate limiting (token bucket), leaderboards (sorted sets), pub/sub, session store. Mentioning these shows range.

> [!EU]
> Expect: *"How would you add caching here, and how do you keep it consistent?"* Name the pattern (cache-aside), the invalidation strategy (TTL vs write-invalidate), and the failure modes (stampede/penetration/avalanche) with mitigations.
`,
      code: [
        {
          lang: 'java',
          title: 'Cache-aside with TTL + stampede guard',
          code: `import java.util.*;
import java.util.concurrent.*;

public class CacheAsideDemo {
    record Entry(String value, long expiresAt) {}
    static final Map<String, Entry> cache = new ConcurrentHashMap<>();
    static final Map<String, Object> locks = new ConcurrentHashMap<>(); // per-key lock
    static int dbHits = 0;

    static String loadFromDb(String key) {
        dbHits++;
        try { Thread.sleep(20); } catch (InterruptedException ignored) {}
        return "value-for-" + key;
    }

    static String get(String key, long ttlMs) {
        Entry e = cache.get(key);
        long now = System.currentTimeMillis();
        if (e != null && e.expiresAt() > now) return e.value();        // cache hit

        // miss: coalesce concurrent loads on this key (stampede guard)
        synchronized (locks.computeIfAbsent(key, k -> new Object())) {
            Entry again = cache.get(key);
            if (again != null && again.expiresAt() > now) return again.value();
            String fresh = loadFromDb(key);
            cache.put(key, new Entry(fresh, now + ttlMs));
            return fresh;
        }
    }

    public static void main(String[] args) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(50);
        CountDownLatch done = new CountDownLatch(50);
        for (int i = 0; i < 50; i++)                 // 50 concurrent requests, same hot key
            pool.submit(() -> { get("hot", 1000); done.countDown(); });
        done.await();
        pool.shutdown();
        System.out.println("50 concurrent requests for 'hot' -> DB hits = " + dbHits +
                           " (without the lock it could be ~50)");
    }
}`
        }
      ],
      flashcards: [
        { q: 'Describe the cache-aside pattern.', a: 'The application checks the cache first; on a miss it loads from the database, stores the result in the cache (with a TTL), and returns it. Writes update the DB and invalidate/refresh the cache entry.' },
        { q: 'What is a cache stampede and how do you prevent it?', a: 'When a popular key expires, many concurrent requests miss and hammer the DB simultaneously. Mitigate with request coalescing/locks (single loader), staggered/jittered TTLs, or proactive early recomputation.' },
        { q: 'Cache penetration vs avalanche?', a: 'Penetration: repeated queries for non-existent keys always miss and hit the DB — fix by caching negative results or a Bloom filter. Avalanche: many keys expire at once overwhelming the DB — fix with jittered TTLs.' },
        { q: 'Write-through vs write-behind caching?', a: 'Write-through writes to cache and DB synchronously (consistent, slower writes). Write-behind writes to cache and asynchronously flushes to the DB (fast writes, risk of data loss on crash).' }
      ]
    },

    {
      id: '5.3',
      title: 'API Design: REST, gRPC & Idempotency',
      hours: 3,
      notes: `
# API Design

A clean, evolvable API is a senior deliverable. Know REST conventions, when to reach for gRPC/GraphQL, and how to make writes safe.

## RESTful conventions

- **Resources as nouns**, HTTP verbs as actions: \`GET /orders/42\`, \`POST /orders\`, \`PUT/PATCH /orders/42\`, \`DELETE /orders/42\`.
- **Status codes** mean something: 200/201/204, 400 (bad request), 401/403 (auth), 404, 409 (conflict), 422, 429 (rate limit), 5xx.
- **Statelessness** — every request carries its auth/context; no server session affinity.

## Idempotency & safety

| Method | Safe (no side effects) | Idempotent (repeat = same effect) |
|--------|:----------------------:|:---------------------------------:|
| GET | ✅ | ✅ |
| PUT | ❌ | ✅ |
| DELETE | ❌ | ✅ |
| POST | ❌ | ❌ |

> [!WARNING]
> \`POST\` isn't idempotent — a retried payment could double-charge. Use an **idempotency key** (client-generated UUID header): the server records the key + result and returns the stored result on retry. Essential for payments and at-least-once messaging.

## Versioning & evolution

URI (\`/v1/\`), header, or media-type versioning. Evolve **backward-compatibly**: add optional fields, never repurpose/remove fields in place. Document with OpenAPI.

## REST vs gRPC vs GraphQL

- **REST/JSON** — ubiquitous, cacheable, human-readable. Default for public APIs.
- **gRPC/Protobuf** — binary, HTTP/2 streaming, contract-first, low latency. Great **internal** service-to-service.
- **GraphQL** — client picks fields; solves over/under-fetching; cost is caching/complexity.

> [!TIP]
> Pagination: prefer **cursor/keyset** (\`WHERE id > :last LIMIT n\`) over OFFSET for large datasets — OFFSET scans and skips rows, getting slower as you page deeper, and can skip/duplicate rows under concurrent inserts.

> [!EU]
> Common: *"Design a REST API for X"* and *"How do you make a payment endpoint safe to retry?"* (idempotency key). Mention error contracts, rate limiting (429 + Retry-After), and versioning strategy.
`,
      code: [
        {
          lang: 'java',
          title: 'Idempotency-key handling for POST',
          code: `import java.util.*;
import java.util.concurrent.*;

public class IdempotencyDemo {
    // Server-side store of processed idempotency keys -> their result
    static final Map<String, String> processed = new ConcurrentHashMap<>();
    static int chargesExecuted = 0;

    // Simulates POST /payments with an Idempotency-Key header
    static synchronized String charge(String idempotencyKey, int cents) {
        // If we've seen this key, return the SAME stored result (no double charge)
        if (processed.containsKey(idempotencyKey)) {
            return "REPLAY -> " + processed.get(idempotencyKey);
        }
        chargesExecuted++;
        String receipt = "charged " + cents + "c, receipt#" + UUID.randomUUID();
        processed.put(idempotencyKey, receipt);
        return "NEW    -> " + receipt;
    }

    public static void main(String[] args) {
        String key = "client-key-abc-123";          // client generates once, reuses on retry
        System.out.println(charge(key, 4999));        // first attempt -> NEW
        System.out.println(charge(key, 4999));        // network retry -> REPLAY (same receipt)
        System.out.println(charge(key, 4999));        // another retry  -> REPLAY
        System.out.println("Actual charges executed: " + chargesExecuted + " (correctly 1)");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What does idempotent mean and which HTTP methods are idempotent?', a: 'Repeating the request produces the same server state as doing it once. GET, PUT, and DELETE are idempotent; POST is not (and GET/PUT/DELETE... GET is also safe).' },
        { q: 'How do you make a POST payment endpoint safe to retry?', a: 'Require a client-generated idempotency key (header). The server stores the key with its result; on a retry with the same key it returns the stored result instead of charging again.' },
        { q: 'Why prefer cursor/keyset pagination over OFFSET for large datasets?', a: 'OFFSET must scan and discard all skipped rows, getting slower as pages deepen, and can skip/duplicate rows under concurrent writes. Keyset (WHERE id > last_seen LIMIT n) uses the index and stays O(page size).' },
        { q: 'When choose gRPC over REST?', a: 'For internal service-to-service calls needing low latency, strong contracts (Protobuf), bidirectional streaming, and efficient binary serialization over HTTP/2. REST/JSON remains better for public, cacheable, human-debuggable APIs.' }
      ]
    }
  ]
},

/* ===================== PHASE 6: Distributed & Messaging ===================== */
{
  id: 'p6',
  title: 'Distributed Systems & Messaging',
  icon: 'share-2',
  blurb: 'Microservice communication, Kafka, sagas, idempotency, and eventual consistency.',
  modules: [
    {
      id: '6.1',
      title: 'Microservice Patterns',
      hours: 4,
      notes: `
# Microservice Patterns

Microservices trade in-process simplicity for independent deployability and scaling — at the cost of distributed-systems complexity. Know when *not* to use them.

## When (not) to split

> [!WARNING]
> Start with a **modular monolith**. Split to microservices only when you have real scaling/team-autonomy/deploy-cadence pressure. Premature microservices create a "distributed monolith" — all the pain (network, partial failure, eventual consistency) with none of the benefits.

## Communication

- **Synchronous** — REST/gRPC request-response. Simple but couples availability (caller fails if callee is down).
- **Asynchronous** — messaging/events (Kafka, RabbitMQ). Decouples; better resilience and load absorption; eventual consistency.

## Resilience patterns

- **Circuit breaker** (Resilience4j) — stop calling a failing dependency; fail fast, give it time to recover.
- **Retry with exponential backoff + jitter** — for transient faults; combine with idempotency.
- **Bulkhead** — isolate resource pools so one slow dependency can't exhaust all threads.
- **Timeout** — never call a remote service without one.
- **Fallback** — degrade gracefully (cached/default response).

## Service discovery & gateway

- **Discovery** (Eureka/Consul/k8s DNS) — find instances dynamically.
- **API gateway** — single entry, auth, rate-limit, routing, aggregation.

## Data per service

Each service **owns its database** — no shared DB. Cross-service queries via API composition or CQRS read models. Cross-service writes need **sagas** (next module), not 2PC.

> [!TIP]
> The **Database-per-service** rule is what makes services independently deployable. A shared DB recreates tight coupling at the schema level — change one table, redeploy everyone.

> [!EU]
> Expect *"Monolith vs microservices — when would you choose each?"* (and the courage to say "monolith first"). Plus *"How do you handle a downstream service being slow/down?"* → timeout + circuit breaker + fallback + bulkhead, with retries+idempotency for transient errors.
`,
      code: [
        {
          lang: 'java',
          title: 'Circuit breaker + retry with backoff (minimal)',
          code: `import java.util.concurrent.ThreadLocalRandom;

public class ResilienceDemo {
    // Tiny circuit breaker: opens after N consecutive failures
    static class CircuitBreaker {
        int failures = 0; final int threshold = 3; boolean open = false;
        boolean allow() { return !open; }
        void onSuccess() { failures = 0; open = false; }
        void onFailure() { if (++failures >= threshold) open = true; }
    }

    static String unreliableCall() {
        if (ThreadLocalRandom.current().nextDouble() < 0.6) throw new RuntimeException("downstream 503");
        return "OK";
    }

    static String callWithResilience(CircuitBreaker cb) {
        if (!cb.allow()) return "FAIL-FAST (circuit open, using fallback)";
        long backoff = 50;
        for (int attempt = 1; attempt <= 3; attempt++) {   // retry transient faults
            try {
                String r = unreliableCall();
                cb.onSuccess();
                return "success on attempt " + attempt;
            } catch (RuntimeException e) {
                cb.onFailure();
                long jitter = ThreadLocalRandom.current().nextLong(20);
                try { Thread.sleep(backoff + jitter); } catch (InterruptedException ignored) {}
                backoff *= 2;                               // exponential backoff
            }
        }
        return "exhausted retries -> fallback";
    }

    public static void main(String[] args) {
        CircuitBreaker cb = new CircuitBreaker();
        for (int i = 1; i <= 8; i++)
            System.out.println("Request " + i + ": " + callWithResilience(cb));
    }
}`
        }
      ],
      flashcards: [
        { q: 'Why start with a monolith instead of microservices?', a: 'Microservices add network calls, partial failure, eventual consistency, and operational overhead. Without real scaling/team-autonomy pressure you get a "distributed monolith" — the costs without the benefits. A modular monolith is simpler and can be split later.' },
        { q: 'What does a circuit breaker do?', a: 'It monitors calls to a dependency and "opens" after repeated failures, short-circuiting further calls to fail fast (with a fallback) and giving the dependency time to recover, then half-opens to test before closing.' },
        { q: 'Why database-per-service?', a: 'It keeps services loosely coupled and independently deployable. A shared database couples services at the schema level, so a table change forces coordinated redeploys — defeating the purpose of microservices.' },
        { q: 'Why combine retries with idempotency and backoff+jitter?', a: 'Retries can duplicate side effects, so the operation must be idempotent. Exponential backoff with jitter prevents synchronized retry storms (thundering herd) against a recovering service.' }
      ]
    },

    {
      id: '6.2',
      title: 'Apache Kafka & Event Streaming',
      hours: 5,
      notes: `
# Apache Kafka

Kafka is a distributed, durable, partitioned **commit log**. It's the backbone of event-driven architectures — decoupling producers from consumers and enabling replay.

## Core concepts

- **Topic** — a named stream, split into **partitions** (the unit of parallelism & ordering).
- **Partition** — an ordered, immutable, append-only log. Order is guaranteed **within** a partition, not across.
- **Offset** — a message's position in a partition; consumers track it.
- **Producer** — writes; chooses partition by key hash (same key → same partition → ordered).
- **Consumer group** — consumers sharing the work; each partition is consumed by **exactly one** member of a group. Parallelism is capped by partition count.
- **Broker / cluster** — servers; partitions are **replicated** (leader + followers) for durability.

## Delivery semantics

- **At-most-once** — commit offset before processing (may lose).
- **At-least-once** — process then commit (may duplicate) — **the common default**.
- **Exactly-once** — idempotent producer + transactions (within Kafka). Across external systems you still design **idempotent consumers**.

> [!WARNING]
> "Exactly-once" end-to-end is largely a myth once an external DB/API is involved. Design **at-least-once + idempotent consumers** (dedupe on a business key or processed-offset table). This is the pragmatic senior answer.

## Ordering, keys & rebalancing

- Need ordering for an entity? Use its id as the **message key** → all its events land in one partition.
- Adding/removing consumers triggers a **rebalance** (partitions reassigned); design for it (commit offsets, idempotent processing).

## Retention & replay

Kafka **retains** messages (time/size based) independent of consumption, so new consumers can **replay from offset 0** — great for rebuilding state, new read models, or reprocessing after a bug.

> [!TIP]
> Kafka vs RabbitMQ: Kafka = high-throughput durable **log** with replay and ordered partitions (event streaming, analytics, event sourcing). RabbitMQ = flexible **message broker** with routing, per-message ack, priorities (task queues, RPC). Pick by use case.

> [!EU]
> Expect: *"How does Kafka guarantee ordering?"* (within a partition, via keys) and *"How do you achieve exactly-once?"* (idempotent producer + transactions inside Kafka; idempotent consumers for end-to-end). Mention consumer groups, partitions = parallelism, and replay.
`,
      code: [
        {
          lang: 'java',
          title: 'Partitioning by key & idempotent consumer (model)',
          code: `import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class KafkaModelDemo {
    // Model: a topic with N partitions; key hash decides the partition (ordering per key)
    static int partitionFor(String key, int partitions) {
        return Math.floorMod(key.hashCode(), partitions);
    }

    // Idempotent consumer: dedupe by business id so at-least-once delivery is safe
    static final Set<String> processedEventIds = ConcurrentHashMap.newKeySet();
    static int sideEffects = 0;

    static void consume(String eventId, String payload) {
        if (!processedEventIds.add(eventId)) {     // already processed -> skip
            System.out.println("  duplicate " + eventId + " ignored");
            return;
        }
        sideEffects++;
        System.out.println("  processed " + eventId + " : " + payload);
    }

    public static void main(String[] args) {
        int partitions = 3;
        String[] keys = {"order-1", "order-2", "order-1", "user-9"};
        System.out.println("Key -> partition (same key always same partition = ordered):");
        for (String k : keys)
            System.out.println("  " + k + " -> p" + partitionFor(k, partitions));

        System.out.println("\\nAt-least-once delivery with idempotent consumer:");
        consume("evt-100", "OrderPlaced");
        consume("evt-100", "OrderPlaced");   // redelivery after a rebalance/retry
        consume("evt-101", "OrderShipped");
        System.out.println("Actual side effects: " + sideEffects + " (correctly 2, not 3)");
    }
}`
        }
      ],
      flashcards: [
        { q: 'How does Kafka guarantee message ordering?', a: 'Order is guaranteed only within a single partition. To keep an entity\'s events ordered, produce them with the entity id as the message key so they hash to the same partition.' },
        { q: 'What determines Kafka consumer parallelism?', a: 'The number of partitions. Within a consumer group each partition is consumed by exactly one consumer, so you cannot have more active consumers than partitions.' },
        { q: 'Why is end-to-end exactly-once usually replaced by at-least-once + idempotent consumers?', a: 'True exactly-once across external systems (DB/APIs) is impractical. The pragmatic design is at-least-once delivery with consumers that dedupe on a business key or track processed offsets, making reprocessing safe.' },
        { q: 'Kafka vs RabbitMQ — when each?', a: 'Kafka: a durable, partitioned, replayable log for high-throughput event streaming, event sourcing, and analytics. RabbitMQ: a broker with flexible routing, per-message acks, and priorities for task queues and RPC.' },
        { q: 'What enables replay in Kafka?', a: 'Messages are retained by time/size independent of consumption, and consumers track offsets, so a consumer can reset its offset and reprocess from any point (e.g. offset 0) to rebuild state.' }
      ]
    },

    {
      id: '6.3',
      title: 'Saga Pattern & Distributed Transactions',
      hours: 3,
      notes: `
# Sagas & Distributed Data Consistency

You can't use a single ACID transaction across multiple services' databases. The **saga** pattern maintains consistency via a sequence of **local transactions** with **compensating actions**.

## Why not 2PC?

Two-phase commit (XA) locks resources across services and a coordinator failure can block everyone. It scales poorly and hurts availability. Modern microservices avoid it.

## Saga = local txns + compensations

Each step commits locally and publishes an event/command for the next. If a later step fails, previously completed steps run **compensating** transactions to semantically undo their effect (you can't rollback a committed local txn, so you *counteract* it — refund, release stock).

### Two coordination styles

- **Choreography** — services react to each other's events. No central coordinator; simple for few steps, but logic is scattered and hard to follow as it grows.
- **Orchestration** — a central **orchestrator** (e.g. Camunda, a saga state machine) tells each service what to do and handles compensation. Clearer, easier to monitor/debug; the orchestrator is a dependency.

> [!WARNING]
> Sagas give **eventual consistency**, not isolation. Other transactions can see intermediate states (e.g. order created but not yet paid). Handle with semantic locks, status flags ("PENDING"), or commutative updates. Design the UX/API for in-flight states.

## The outbox pattern (must-know)

> [!TIP]
> **Dual-write problem:** writing to your DB *and* publishing to Kafka isn't atomic — a crash between them loses the event or creates a phantom. The **transactional outbox** fixes it: write the event to an \`outbox\` table **in the same DB transaction** as the business change; a separate relay (CDC/Debezium or poller) publishes outbox rows to Kafka. Now the event is published **iff** the business data committed.

> [!EU]
> Strong senior answer to *"How do you keep data consistent across services?"*: "Local transactions + sagas (orchestrated via Camunda for complex flows) with compensating actions, the transactional outbox to avoid dual-write, and idempotent consumers — accepting eventual consistency rather than 2PC." This ties Phases 6 and 8 together.
`,
      code: [
        {
          lang: 'java',
          title: 'Orchestrated saga with compensation',
          code: `import java.util.*;
import java.util.function.*;

public class SagaDemo {
    // Each step: an action + its compensating action
    record Step(String name, Supplier<Boolean> action, Runnable compensate) {}

    static boolean runSaga(List<Step> steps) {
        Deque<Step> completed = new ArrayDeque<>();
        for (Step s : steps) {
            System.out.println("-> " + s.name());
            boolean ok = s.action().get();
            if (!ok) {
                System.out.println("   FAILED: " + s.name() + " -> compensating in reverse");
                while (!completed.isEmpty()) {
                    Step done = completed.pop();
                    System.out.println("   <- compensate " + done.name());
                    done.compensate().run();
                }
                return false;
            }
            completed.push(s);
        }
        return true;
    }

    public static void main(String[] args) {
        // Order saga: reserve stock -> charge card -> ship. Charge fails -> undo stock.
        boolean[] chargeWillFail = { true };
        List<Step> order = List.of(
            new Step("reserveStock", () -> { System.out.println("   stock reserved"); return true; },
                                     () -> System.out.println("   stock released")),
            new Step("chargeCard",   () -> { boolean ok = !chargeWillFail[0];
                                             System.out.println("   charge " + (ok ? "ok" : "declined"));
                                             return ok; },
                                     () -> System.out.println("   refund issued")),
            new Step("shipOrder",    () -> { System.out.println("   shipped"); return true; },
                                     () -> System.out.println("   shipment cancelled"))
        );

        boolean success = runSaga(order);
        System.out.println("\\nSaga result: " + (success ? "COMMITTED" : "ROLLED BACK via compensation"));
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is the saga pattern?', a: 'A way to maintain data consistency across services without a distributed transaction: a sequence of local transactions, each publishing an event/command; if a step fails, previously completed steps run compensating transactions to semantically undo their effects.' },
        { q: 'Choreography vs orchestration sagas?', a: 'Choreography: services react to each other\'s events with no central coordinator (simple but logic is scattered). Orchestration: a central orchestrator directs each step and compensation (clearer, easier to monitor; adds a coordinator dependency).' },
        { q: 'What is the dual-write problem and how does the outbox pattern solve it?', a: 'Writing to the DB and publishing to a broker aren\'t atomic, so a crash between them loses or fabricates events. The transactional outbox writes the event to an outbox table in the same DB transaction; a relay (CDC/poller) then publishes it, so the event is sent iff the data committed.' },
        { q: 'Why avoid two-phase commit (2PC) in microservices?', a: 'XA/2PC holds locks across services and a coordinator failure can block all participants, reducing availability and scalability. Sagas with compensations preserve autonomy and availability at the cost of eventual consistency.' }
      ]
    }
  ]
},

/* ===================== PHASE 7: DevOps / K8s / Helm ===================== */
{
  id: 'p7',
  title: 'DevOps: Docker, Kubernetes & Helm',
  icon: 'ship',
  blurb: 'Containers, orchestration, and Helm from zero to advanced as a practical hands-on guide.',
  modules: [
    {
      id: '7.1',
      title: 'Docker & Containers',
      hours: 4,
      notes: `
# Docker & Containers

A container packages an app with its dependencies into an **isolated, portable** unit that runs the same everywhere. Unlike a VM, containers share the host **kernel** — they start in milliseconds and are lightweight.

## Containers vs VMs

| | Container | VM |
|--|-----------|----|
| Isolation | process-level (namespaces, cgroups) | full OS + hypervisor |
| Boot | milliseconds | seconds–minutes |
| Size | MBs | GBs |
| Kernel | shared with host | own kernel |

Namespaces isolate what a process *sees* (PID, network, mount); **cgroups** limit what it *uses* (CPU, memory).

## Images & layers

An **image** is a stack of read-only **layers** built from a \`Dockerfile\`. Each instruction adds a layer; layers are **cached** and shared. A **container** is a running image with a writable top layer.

## Dockerfile best practices

- **Multi-stage builds** — compile in a fat builder image, copy only the artifact into a slim runtime → tiny, secure images.
- **Layer ordering** — put rarely-changing steps (dependency download) before code copy to maximise cache hits.
- **\`.dockerignore\`**, pin base image tags, run as **non-root**, prefer \`distroless\`/\`alpine\`/\`-jre\` bases.

> [!WARNING]
> Don't bake secrets into images (they persist in layers/history). Inject at runtime via env/secrets. Don't run as root. Scan images (Trivy) for CVEs.

> [!TIP]
> For Java: use a JRE (not JDK) runtime base, enable container-aware JVM (\`-XX:MaxRAMPercentage=75\`), and leverage **layered jars** (Spring Boot) or **jlink/jib** so dependency layers cache separately from your fast-changing app code.

> [!EU]
> Expect: *"Container vs VM?"*, *"What is a multi-stage build and why?"*, *"How do you keep images small/secure?"* Have a real Dockerfile you can explain line by line.
`,
      code: [
        {
          lang: 'bash',
          title: 'Multi-stage Dockerfile for a Spring Boot app',
          code: `# ---- Stage 1: build (fat image with Maven + JDK) ----
# FROM maven:3.9-eclipse-temurin-21 AS build
# WORKDIR /app
# COPY pom.xml .
# RUN mvn -q dependency:go-offline        # cached layer: deps rarely change
# COPY src ./src
# RUN mvn -q clean package -DskipTests    # produces target/app.jar

# ---- Stage 2: runtime (slim JRE only) ----
# FROM eclipse-temurin:21-jre-alpine
# WORKDIR /app
# RUN addgroup -S app && adduser -S app -G app   # non-root user
# COPY --from=build /app/target/*.jar app.jar    # copy ONLY the artifact
# USER app
# EXPOSE 8080
# ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
# ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]

echo "Multi-stage build keeps the final image to ~200MB (JRE) instead of ~700MB (JDK+Maven)."
echo ""
echo "Common commands you must know:"
echo "  docker build -t myapp:1.0 ."
echo "  docker run -p 8080:8080 -e SPRING_PROFILES_ACTIVE=prod myapp:1.0"
echo "  docker images          # list images & sizes"
echo "  docker ps -a           # running + stopped containers"
echo "  docker logs -f <id>    # follow logs"
echo "  docker exec -it <id> sh  # shell into a container"
echo "  docker system prune -f # reclaim space"`
        }
      ],
      flashcards: [
        { q: 'How do containers differ from VMs?', a: 'Containers share the host kernel and isolate at the process level (namespaces + cgroups), so they\'re MBs in size and start in milliseconds. VMs virtualize hardware with their own OS kernel via a hypervisor — GBs and slower to boot.' },
        { q: 'What is a multi-stage Docker build and why use it?', a: 'A Dockerfile with multiple FROM stages: build/compile in a heavy image, then COPY only the final artifact into a slim runtime image. Result: much smaller, more secure images with no build tools or source in the final layer.' },
        { q: 'Why order Dockerfile instructions carefully?', a: 'Each instruction is a cached layer. Placing rarely-changing steps (dependency download) before copying source maximizes cache hits, so code changes don\'t re-trigger expensive dependency rebuilds.' },
        { q: 'Two JVM/container pitfalls and fixes?', a: 'Baking secrets into image layers (inject at runtime instead) and the JVM ignoring container memory limits (use a container-aware JVM with -XX:MaxRAMPercentage). Also run as non-root and use a JRE base.' }
      ]
    },

    {
      id: '7.2',
      title: 'Kubernetes Core Concepts',
      hours: 5,
      notes: `
# Kubernetes Core Concepts

Kubernetes orchestrates containers across a cluster: scheduling, scaling, self-healing, service discovery, and rolling updates — declaratively.

## Control plane vs workers

- **Control plane**: \`api-server\` (the front door), \`etcd\` (cluster state KV store), \`scheduler\` (places pods), \`controller-manager\` (reconciliation loops).
- **Worker nodes**: \`kubelet\` (runs pods), \`kube-proxy\` (networking), container runtime.

## The reconciliation loop (the big idea)

You declare **desired state** (YAML); controllers continuously drive **actual state** toward it. Pod dies → ReplicaSet creates a new one. This is **declarative**, self-healing infrastructure.

## Core objects

- **Pod** — smallest unit; one or more co-located containers sharing network/storage. Ephemeral.
- **ReplicaSet** — keeps N pod replicas running.
- **Deployment** — manages ReplicaSets; gives **rolling updates** + rollback.
- **Service** — stable virtual IP/DNS load-balancing across pods (pods are ephemeral; Services are stable). Types: \`ClusterIP\` (internal), \`NodePort\`, \`LoadBalancer\`.
- **Ingress** — L7 HTTP routing (host/path) into Services.
- **ConfigMap / Secret** — externalised config & sensitive data.
- **StatefulSet** — stable identity/storage for stateful apps (DBs, Kafka).
- **DaemonSet** — one pod per node (log/metric agents).
- **Namespace** — logical isolation/quota boundary.

## Health & scaling

- **Probes**: \`liveness\` (restart if dead), \`readiness\` (remove from Service until ready), \`startup\` (slow boot grace).
- **Resources**: \`requests\` (scheduling guarantee) vs \`limits\` (hard cap; exceeding memory → OOMKilled).
- **HPA** — Horizontal Pod Autoscaler scales replicas on CPU/custom metrics.

> [!WARNING]
> Set **resource requests/limits** and **readiness probes** on every workload. Missing readiness → traffic hits not-ready pods (errors during deploys). Missing limits → a noisy neighbour starves the node. Liveness too aggressive → restart loops.

> [!TIP]
> Pods are cattle, not pets — never rely on a pod's IP or identity. Talk to **Services**. Store state in PersistentVolumes/StatefulSets or external stores, keep app pods stateless.

> [!EU]
> Common: *"What happens when you \`kubectl apply\` a Deployment?"* (api-server → etcd → scheduler → kubelet → pods, reconciled). *"Liveness vs readiness?"* *"How does a rolling update work and how do you roll back?"* (\`kubectl rollout undo\`).
`,
      code: [
        {
          lang: 'bash',
          title: 'A Deployment + Service manifest & kubectl essentials',
          code: `cat <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata: { name: payment-api }
spec:
  replicas: 3
  selector: { matchLabels: { app: payment-api } }
  template:
    metadata: { labels: { app: payment-api } }
    spec:
      containers:
        - name: app
          image: myreg/payment-api:1.4.2
          ports: [{ containerPort: 8080 }]
          resources:                       # ALWAYS set these
            requests: { cpu: "250m", memory: "256Mi" }
            limits:   { cpu: "1",    memory: "512Mi" }
          readinessProbe:                  # don't send traffic until ready
            httpGet: { path: /actuator/health/readiness, port: 8080 }
            initialDelaySeconds: 10
          livenessProbe:                   # restart if wedged
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            initialDelaySeconds: 30
---
apiVersion: v1
kind: Service
metadata: { name: payment-api }
spec:
  selector: { app: payment-api }          # routes to the 3 pods above
  ports: [{ port: 80, targetPort: 8080 }]
  type: ClusterIP
YAML

echo ""
echo "kubectl essentials:"
echo "  kubectl apply -f deploy.yaml          # declarative create/update"
echo "  kubectl get pods -o wide              # list pods + nodes/IPs"
echo "  kubectl describe pod <name>           # events: why is it pending/crashing?"
echo "  kubectl logs -f <pod> [-c <container>]"
echo "  kubectl rollout status deploy/payment-api"
echo "  kubectl rollout undo deploy/payment-api   # roll back a bad deploy"
echo "  kubectl scale deploy/payment-api --replicas=5"
echo "  kubectl exec -it <pod> -- sh"`
        }
      ],
      flashcards: [
        { q: 'What is the reconciliation loop in Kubernetes?', a: 'Controllers continuously compare desired state (your declarative YAML in etcd) with actual cluster state and take actions to converge them — e.g. recreating a pod that died — giving self-healing, declarative infrastructure.' },
        { q: 'Why talk to a Service instead of a Pod IP?', a: 'Pods are ephemeral; their IPs change as they\'re rescheduled. A Service provides a stable virtual IP/DNS name and load-balances across the current healthy pods selected by labels.' },
        { q: 'Liveness vs readiness vs startup probes?', a: 'Liveness: restart the container if it fails (deadlock/wedged). Readiness: remove the pod from Service endpoints until it can serve traffic (no errors during startup/deploys). Startup: give slow-booting apps time before liveness kicks in.' },
        { q: 'Requests vs limits for resources?', a: 'Requests are guaranteed amounts used for scheduling placement; limits are hard caps. Exceeding a memory limit gets the container OOMKilled; exceeding CPU limit throttles it. Always set both to protect node stability.' },
        { q: 'How do you roll back a bad Deployment?', a: 'Deployments keep ReplicaSet revision history; run kubectl rollout undo deployment/<name> (optionally --to-revision=N) to revert, and kubectl rollout status to watch it.' }
      ]
    },

    {
      id: '7.3',
      title: 'Helm: Zero to Advanced',
      hours: 5,
      notes: `
# Helm — Zero to Advanced (Practical Guide)

**Helm is the package manager for Kubernetes.** A **chart** is a versioned, parameterised bundle of K8s manifests. Instead of hand-editing dozens of YAMLs per environment, you template them once and supply **values** per environment. This module is a hands-on path from first install to production patterns.

---

## 0 → Why Helm exists

Without Helm you copy-paste \`deployment.yaml\`, \`service.yaml\`, \`ingress.yaml\`, \`configmap.yaml\`… for **dev/staging/prod**, each with slightly different image tags, replica counts, and hosts. That drifts and breaks. Helm gives you:

- **Templating** — one set of manifests, many environments via \`values.yaml\`.
- **Releases** — a named, **versioned** install you can \`upgrade\` and \`rollback\`.
- **Packaging/sharing** — charts in repos (like npm/apt for K8s).
- **Dependencies** — pull in Postgres/Redis subcharts.

---

## 1 → Core concepts

| Term | Meaning |
|------|---------|
| **Chart** | A package: templates + default values + metadata |
| **Release** | An instance of a chart installed in a cluster (named) |
| **Values** | Parameters that fill the templates (\`values.yaml\` + \`--set\`/\`-f\`) |
| **Repository** | A place to publish/fetch charts |
| **Revision** | Each install/upgrade bumps a revision you can roll back to |

## 2 → Chart anatomy

\`\`\`
mychart/
  Chart.yaml          # name, version, appVersion, dependencies
  values.yaml         # DEFAULT values (overridable)
  templates/
    deployment.yaml   # Go-templated manifests
    service.yaml
    ingress.yaml
    _helpers.tpl      # reusable template snippets (named templates)
    NOTES.txt         # post-install message
  charts/             # vendored dependency charts (subcharts)
\`\`\`

## 3 → Templating basics (Go templates + Sprig)

- Inject a value: \`{{ .Values.replicaCount }}\`
- Built-in objects: \`{{ .Release.Name }}\`, \`{{ .Chart.Name }}\`, \`{{ .Values.* }}\`
- Defaults & pipelines: \`{{ .Values.image.tag | default .Chart.AppVersion }}\`
- Conditionals: \`{{- if .Values.ingress.enabled }} ... {{- end }}\`
- Loops: \`{{- range .Values.env }} ... {{- end }}\`
- Named templates (\`_helpers.tpl\`): \`{{ include "mychart.fullname" . }}\`
- Whitespace control: \`{{-\` trims left, \`-}}\` trims right (avoid stray blank lines).

> [!TIP]
> **\`helm template\` and \`--dry-run\` are your best friends.** \`helm template ./mychart -f prod-values.yaml\` renders the YAML **locally** so you can see exactly what will be applied — no cluster needed. Always render before you install.

## 4 → The essential commands (the daily loop)

\`\`\`
helm create mychart                 # scaffold a chart
helm lint ./mychart                 # static checks
helm template ./mychart             # render locally (no cluster)
helm install myrel ./mychart -f prod.yaml      # first install
helm upgrade myrel ./mychart -f prod.yaml      # apply changes (new revision)
helm upgrade --install myrel ./mychart         # idempotent install-or-upgrade (CI/CD)
helm rollback myrel 2               # revert to revision 2
helm history myrel                  # see revisions
helm list -A                        # all releases, all namespaces
helm uninstall myrel                # remove the release
helm get values myrel               # what values are live?
\`\`\`

> [!SUCCESS]
> In CI/CD always use **\`helm upgrade --install\`** — it installs on first run and upgrades thereafter, so the same pipeline step is idempotent. Add \`--atomic\` to auto-rollback on a failed upgrade and \`--wait\` to block until resources are ready.

## 5 → Values & environment overrides (the payoff)

Precedence (lowest → highest): chart \`values.yaml\` → \`-f myvalues.yaml\` (repeatable) → \`--set key=val\`. So:

\`\`\`
helm upgrade --install api ./api-chart \\
  -f values-prod.yaml \\
  --set image.tag=1.8.3 --set replicaCount=6
\`\`\`

## 6 → Advanced patterns

- **Subcharts & dependencies** — declare in \`Chart.yaml\` \`dependencies:\`, run \`helm dependency update\`. Parent values can override child values under the child's key.
- **\`_helpers.tpl\` named templates** — DRY labels/names (\`{{ include "app.labels" . }}\`).
- **Hooks** — \`pre-install\`, \`post-install\`, \`pre-upgrade\`, \`post-delete\` (annotation \`helm.sh/hook\`) for DB migrations/jobs.
- **\`required\` & \`fail\`** — \`{{ required "image.repository is required" .Values.image.repository }}\` to enforce inputs.
- **\`tpl\` function** — render a string that itself contains template syntax (config files).
- **\`lookup\`** — read existing cluster objects at render time.
- **Library charts** — shareable template-only charts (no resources of their own).

> [!WARNING]
> **Helm pitfalls:** (1) Changing an immutable field (e.g. a Deployment \`selector\`) makes upgrades fail — you must uninstall/recreate. (2) Secrets in \`values.yaml\` end up in release history in etcd — use **helm-secrets/SOPS** or external secret operators. (3) \`--set\` with dots/commas needs escaping. (4) CRDs aren't upgraded by Helm by default — manage them carefully.

## 7 → How Helm 3 stores state

Helm 3 has **no Tiller** (the Helm-2 in-cluster server was a security problem). Release state is stored as **Secrets** in the release's namespace (\`sh.helm.release.v1.<name>.<rev>\`). \`helm\` talks straight to the K8s API with your kubeconfig.

> [!EU]
> Helm questions are increasingly common for backend roles touching deployment. Be ready for: *"What problem does Helm solve over raw kubectl?"* (templating + releases + rollback), *"How do you manage per-environment config?"* (values files + precedence), *"How do DB migrations fit a Helm deploy?"* (pre-upgrade hooks / Job), and *"How do you handle a bad release?"* (\`helm rollback\`, or \`--atomic\` to auto-revert). Tie it back to GitOps (Argo CD/Flux render Helm charts).
`,
      code: [
        {
          lang: 'bash',
          title: 'A real chart: template + values + the deploy loop',
          code: `# ---------- templates/deployment.yaml (Go-templated) ----------
cat <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "api.fullname" . }}
  labels: {{- include "api.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels: {{- include "api.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{- include "api.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          ports: [{ containerPort: {{ .Values.service.port }} }]
          {{- if .Values.env }}
          env:
            {{- range .Values.env }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
          {{- end }}
YAML

# ---------- values.yaml (defaults) ----------
cat <<'YAML'
replicaCount: 2
image:
  repository: myreg/payment-api
  tag: ""              # falls back to Chart.appVersion
service: { port: 8080 }
env:
  - { name: SPRING_PROFILES_ACTIVE, value: prod }
YAML

# ---------- the daily loop ----------
echo "helm lint ./api-chart"
echo "helm template ./api-chart -f values-prod.yaml   # render & eyeball BEFORE applying"
echo "helm upgrade --install payment ./api-chart \\\\"
echo "     -f values-prod.yaml --set image.tag=1.8.3 --atomic --wait"
echo "helm history payment        # 1 deployed, 2 deployed ..."
echo "helm rollback payment 1     # instant revert if 1.8.3 misbehaves"`
        }
      ],
      flashcards: [
        { q: 'What problem does Helm solve over plain kubectl apply?', a: 'It templates manifests so one chart serves many environments via values files, and it manages releases as versioned units you can upgrade and roll back — instead of copy-pasting and hand-editing YAML per environment.' },
        { q: 'Explain Helm value precedence.', a: 'Lowest to highest: the chart\'s default values.yaml, then any -f override files (later files win), then --set flags (highest). Higher-precedence sources override lower ones key by key.' },
        { q: 'Why use "helm upgrade --install" in CI/CD?', a: 'It\'s idempotent: installs the release on first run and upgrades it on subsequent runs, so the same pipeline step works every time. Add --atomic to auto-rollback on failure and --wait to block until resources are ready.' },
        { q: 'How does Helm 3 store release state and why no Tiller?', a: 'Release state is stored as Secrets in the release namespace (sh.helm.release.v1.*). Helm 3 removed Tiller (the Helm 2 in-cluster server) because it was a security/RBAC liability; the CLI now uses your kubeconfig directly.' },
        { q: 'How do you run a DB migration as part of a Helm deploy?', a: 'Use a Helm hook — annotate a Job with helm.sh/hook: pre-upgrade (or pre-install) so it runs before the new app version rolls out, with hook-weight to order multiple hooks.' },
        { q: 'Name two common Helm pitfalls.', a: 'Secrets placed in values.yaml end up in release history in etcd (use SOPS/helm-secrets/external secrets); and changing immutable fields like a Deployment selector breaks upgrades, requiring uninstall/recreate. Also CRDs aren\'t auto-upgraded by Helm.' }
      ]
    },

    {
      id: '7.4',
      title: 'CI/CD & GitOps',
      hours: 3,
      notes: `
# CI/CD & GitOps

Automate build → test → package → deploy so changes ship safely and repeatably.

## The pipeline

1. **CI** — on push/PR: compile, unit + integration tests, static analysis (SonarQube), build artifact, **build & scan image**, push to registry.
2. **CD** — deploy to staging, run smoke/e2e tests, promote to prod with a safe strategy.

## Deployment strategies

- **Rolling** — replace pods gradually (K8s default). Zero downtime if readiness probes are set.
- **Blue-green** — stand up new version alongside old, switch traffic at once; instant rollback.
- **Canary** — route a small % to the new version, watch metrics, ramp up.

## GitOps

> [!TIP]
> **GitOps** (Argo CD / Flux): Git is the **single source of truth** for desired cluster state. An in-cluster agent continuously syncs the cluster to the repo. Benefits: auditable history, easy rollback (\`git revert\`), no manual \`kubectl\`/credentials sprawl, drift detection. Often renders **Helm charts** or Kustomize.

## Quality gates & safety

- Required tests + coverage thresholds before merge.
- Image vulnerability scanning (Trivy) blocks criticals.
- Progressive delivery + automated rollback on SLO breach.
- Secrets via Vault/sealed-secrets/external-secrets — never in the repo.

> [!WARNING]
> Pipelines need least-privilege credentials and signed/provenance-tracked artifacts (supply-chain security — SLSA, Sigstore). A compromised CI runner can push malicious images.

> [!EU]
> Expect: *"Describe your CI/CD pipeline."* Walk build→test→scan→package→deploy with a named strategy (rolling/canary) and rollback plan. Bonus points for GitOps, trunk-based development, and how you keep deploys safe (feature flags, progressive rollout, observability).
`,
      code: [
        {
          lang: 'bash',
          title: 'A CI/CD pipeline outline (GitHub Actions style)',
          code: `cat <<'YAML'
# .github/workflows/deploy.yml
name: build-test-deploy
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 21, cache: maven }
      - run: mvn -B clean verify              # compile + unit + integration tests
      - run: docker build -t $REG/api:$GIT_SHA .
      - run: trivy image --exit-code 1 --severity CRITICAL $REG/api:$GIT_SHA   # gate
      - run: docker push $REG/api:$GIT_SHA
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: |
          helm upgrade --install api ./charts/api \\
            -f charts/api/values-prod.yaml \\
            --set image.tag=$GIT_SHA \\
            --atomic --wait --timeout 5m       # auto-rollback if it fails
YAML
echo ""
echo "GitOps alternative: the pipeline only bumps image.tag in a Git repo;"
echo "Argo CD detects the commit and syncs the cluster to match. Rollback = git revert."`
        }
      ],
      flashcards: [
        { q: 'Rolling vs blue-green vs canary deployments?', a: 'Rolling gradually replaces old pods with new (zero-downtime with readiness probes). Blue-green runs new alongside old and switches all traffic at once (instant rollback). Canary sends a small traffic % to the new version, monitors, then ramps up.' },
        { q: 'What is GitOps?', a: 'A model where Git is the single source of truth for desired cluster state and an in-cluster agent (Argo CD/Flux) continuously reconciles the cluster to the repo. It gives auditability, easy rollback via git revert, and drift detection.' },
        { q: 'What quality gates belong in a CI pipeline?', a: 'Automated unit/integration tests with coverage thresholds, static analysis, and image vulnerability scanning that blocks critical CVEs — all required before an artifact is promoted/deployed.' },
        { q: 'Why does supply-chain security matter in CI/CD?', a: 'A compromised CI runner or dependency can inject malicious code into images you deploy. Mitigate with least-privilege credentials, dependency/image scanning, artifact signing and provenance (Sigstore, SLSA).' }
      ]
    }
  ]
},

/* ===================== PHASE 8: Camunda & BPMN ===================== */
{
  id: 'p8',
  title: 'Camunda & Process Orchestration',
  icon: 'workflow',
  blurb: 'BPMN-driven workflow orchestration, Camunda 7 vs 8, and how it fits microservice sagas.',
  modules: [
    {
      id: '8.1',
      title: 'BPMN & Workflow Fundamentals',
      hours: 3,
      notes: `
# BPMN & Workflow Orchestration

**BPMN 2.0** (Business Process Model and Notation) is a standard graphical language for modelling business processes as executable diagrams. **Camunda** executes BPMN: it's a workflow/orchestration engine that drives long-running, stateful processes across services and humans.

## Why a process engine?

Some logic is **long-running, stateful, and must survive crashes**: an onboarding that waits days for approval, an order that orchestrates payment → inventory → shipping with compensation. Encoding this in scattered \`if/else\` + cron + DB flags is fragile. A BPMN engine gives you:

- **Persistent state** — each process instance's position is stored; survives restarts.
- **Visual model = executable** — the diagram *is* the source of truth (great for business + dev alignment).
- **Timers, retries, error/compensation handling** built in.
- **Auditability** — full history of every instance.

## Core BPMN elements

| Element | Meaning |
|---------|---------|
| **Start / End event** | process entry / completion |
| **Task** | a unit of work: *User task* (human), *Service task* (code/worker), *Script task* |
| **Gateway** | branching: *exclusive* (XOR, one path), *parallel* (AND, all paths), *inclusive*, *event-based* |
| **Sequence flow** | arrows connecting steps (can carry conditions) |
| **Event** | timer, message, signal, error — start/intermediate/boundary |
| **Pool / Lane** | participant / responsibility |

## Boundary events & compensation

A **boundary event** attached to a task handles a timeout or error (e.g. escalate if approval not given in 2 days). **Compensation** events model "undo" — the BPMN-native saga (ties to Phase 6).

> [!TIP]
> Camunda shines as a **saga orchestrator**: model the order saga in BPMN with service tasks calling each microservice and compensation tasks for rollback. You get visual monitoring of in-flight sagas and automatic retry/timeout — far clearer than choreography for complex flows.

> [!EU]
> Camunda is widely used in **European enterprises** (banking, insurance, telco — many Camunda customers are DACH/EU). For roles mentioning it, know: BPMN basics, what a process engine buys you over hand-rolled state machines, and Camunda 7 vs 8.
`,
      code: [
        {
          lang: 'java',
          title: 'A service-task worker (external task pattern)',
          code: `import java.util.*;

// Conceptual model of a Camunda "external task" worker that handles a service task.
public class CamundaWorkerDemo {
    // The engine holds process state; workers poll for jobs of a given topic.
    record Job(String topic, String processInstanceId, Map<String,Object> vars) {}

    static Map<String,Object> handleChargePayment(Job job) {
        int amount = (int) job.vars().get("amount");
        System.out.println("[worker:charge-payment] instance " + job.processInstanceId() +
                           " charging " + amount + "c");
        boolean ok = amount < 100_000;            // pretend gateway
        // Worker reports completion + output variables back to the engine
        return Map.of("paymentSucceeded", ok, "receiptId", "R-" + UUID.randomUUID());
    }

    public static void main(String[] args) {
        // Engine -> worker: a fetched-and-locked external task
        Job job = new Job("charge-payment", "order-42", Map.of("amount", 4999));
        Map<String,Object> result = handleChargePayment(job);
        System.out.println("Completed task -> engine continues BPMN with vars: " + result);

        // The BPMN exclusive gateway then routes on 'paymentSucceeded':
        boolean ok = (boolean) result.get("paymentSucceeded");
        System.out.println("Gateway routes to: " + (ok ? "reserve-inventory" : "compensate/notify-failure"));
    }
}`
        }
      ],
      flashcards: [
        { q: 'What does a process/workflow engine like Camunda give you over hand-rolled logic?', a: 'Persistent, crash-safe process state; a visual BPMN model that is itself executable; built-in timers, retries, error and compensation handling; and full audit history of every instance — ideal for long-running, stateful flows.' },
        { q: 'Name the main BPMN gateway types.', a: 'Exclusive (XOR — exactly one outgoing path based on conditions), Parallel (AND — all paths concurrently, join waits for all), Inclusive (one or more), and Event-based (route on which event occurs first).' },
        { q: 'How does Camunda relate to the saga pattern?', a: 'Camunda acts as a saga orchestrator: BPMN service tasks invoke each microservice in sequence and compensation events/tasks model the rollback, giving visual monitoring, retries, and timeouts for distributed transactions.' },
        { q: 'What is a boundary event?', a: 'An event attached to the edge of a task/subprocess that interrupts or runs alongside it — e.g. a timer boundary event to escalate after a deadline, or an error boundary event to handle a failure path.' }
      ]
    },

    {
      id: '8.2',
      title: 'Camunda 7 vs 8 & Spring Integration',
      hours: 3,
      notes: `
# Camunda 7 vs 8 & Spring Integration

## Camunda Platform 7 (the classic)

- **Embeddable** Java library — runs **inside** your Spring Boot app, sharing its JVM and (often) its relational DB for process state.
- Engine executes BPMN; service tasks via Java delegates or **external task** workers.
- Mature, simple to embed, JPA-friendly. Great for monoliths/single-service orchestration.

## Camunda Platform 8 (cloud-native)

- Built on **Zeebe** — a horizontally scalable, distributed workflow engine (no relational DB; event-sourced, partitioned like Kafka).
- **Job workers** poll over gRPC; designed for high-throughput, microservice-scale orchestration.
- SaaS or self-managed (k8s). Decoupled from your app's JVM/DB.

| | Camunda 7 | Camunda 8 (Zeebe) |
|--|-----------|-------------------|
| Deployment | embedded in your JVM | standalone distributed engine |
| State store | relational DB (shared) | event log, partitioned |
| Scale | vertical / single engine | horizontal, partitioned |
| Worker protocol | Java delegate / external task (REST) | job workers over gRPC |
| Best for | monolith, embedded orchestration | cloud-native microservices at scale |

> [!TIP]
> **Migration awareness** is a great talking point: many EU enterprises are moving from Camunda 7 (embedded) to 8 (Zeebe) for scalability and to decouple orchestration from the application. Know that 8 trades the convenient shared-DB embedding for distributed scale.

## Spring Boot integration (Camunda 7)

Add the starter, drop \`.bpmn\` files in \`resources/\`, implement service tasks as Spring beans (\`JavaDelegate\`) or external workers, and use the engine's APIs (\`RuntimeService\`, \`TaskService\`) to start/manage instances.

> [!WARNING]
> Keep service tasks **idempotent** — the engine retries failed jobs, and at-least-once execution means a task may run more than once. Same discipline as Kafka consumers (Phase 6).

> [!EU]
> If a JD lists Camunda, expect: *"7 vs 8 — what's the difference?"*, *"How do you integrate Camunda with Spring Boot?"*, and *"How does it help with distributed transactions?"* (orchestrated saga + compensation). Connect it to your microservice and messaging knowledge.
`,
      code: [
        {
          lang: 'java',
          title: 'JavaDelegate service task + idempotency (Camunda 7 style)',
          code: `import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// Sketch of a Camunda 7 JavaDelegate. The engine calls execute() for a service task.
public class SpringDelegateDemo {
    interface DelegateExecution {
        String getProcessInstanceId();
        Object getVariable(String name);
        void setVariable(String name, Object value);
    }

    // Idempotency guard: the engine may retry, so dedupe by instance id
    static final Set<String> charged = ConcurrentHashMap.newKeySet();

    // @Component("chargePaymentDelegate")  -> referenced in BPMN: camunda:delegateExpression
    static class ChargePaymentDelegate {
        public void execute(DelegateExecution ex) {
            String id = ex.getProcessInstanceId();
            if (!charged.add(id)) {                      // already done on a prior retry
                System.out.println("Instance " + id + " already charged -> skip (idempotent)");
                ex.setVariable("paymentSucceeded", true);
                return;
            }
            int amount = (int) ex.getVariable("amount");
            System.out.println("Charging instance " + id + " amount=" + amount);
            ex.setVariable("paymentSucceeded", true);    // engine routes the next gateway on this
        }
    }

    // Minimal in-memory execution to demonstrate the retry/idempotency behaviour
    public static void main(String[] args) {
        var vars = new HashMap<String,Object>(Map.of("amount", 2500));
        DelegateExecution ex = new DelegateExecution() {
            public String getProcessInstanceId() { return "proc-7"; }
            public Object getVariable(String n) { return vars.get(n); }
            public void setVariable(String n, Object v) { vars.put(n, v); }
        };
        var delegate = new ChargePaymentDelegate();
        delegate.execute(ex);       // first run: charges
        delegate.execute(ex);       // engine retry: skipped, no double charge
        System.out.println("Final vars: " + vars);
    }
}`
        }
      ],
      flashcards: [
        { q: 'Core architectural difference between Camunda 7 and 8?', a: 'Camunda 7 is an embeddable Java engine running inside your app, storing process state in a relational DB. Camunda 8 is built on Zeebe — a standalone, horizontally scalable, event-sourced/partitioned engine with job workers over gRPC, decoupled from your JVM and DB.' },
        { q: 'How do you integrate Camunda 7 with Spring Boot?', a: 'Add the Camunda Spring Boot starter, place .bpmn models in resources, implement service tasks as Spring beans (JavaDelegate / delegateExpression) or external task workers, and drive instances via RuntimeService/TaskService APIs.' },
        { q: 'Why must Camunda service tasks be idempotent?', a: 'The engine retries failed jobs and executes at-least-once, so a task may run multiple times. Idempotent handlers (dedupe by process instance/business key) prevent duplicate side effects like double charges.' },
        { q: 'Why are enterprises migrating from Camunda 7 to 8?', a: 'For horizontal scalability and to decouple orchestration from the application JVM/DB. Zeebe\'s partitioned event-sourced design handles far higher throughput than a single embedded relational-DB-backed engine.' }
      ]
    }
  ]
},

/* ===================== PHASE 9: Linux & Networking ===================== */
{
  id: 'p9',
  title: 'Linux, Networking & Observability',
  icon: 'terminal',
  blurb: 'Shell fluency, process/memory tools, TCP/HTTP fundamentals, and production debugging.',
  modules: [
    {
      id: '9.1',
      title: 'Linux Essentials & Shell',
      hours: 4,
      notes: `
# Linux Essentials for Backend Engineers

Production runs on Linux. You'll be expected to navigate, inspect processes, tail logs, and debug a misbehaving JVM over SSH — without an IDE.

## Filesystem & navigation

\`pwd\`, \`ls -la\`, \`cd\`, \`find / -name '*.log'\`, \`du -sh *\` (sizes), \`df -h\` (disk free). Everything is a file; \`/proc\` and \`/sys\` expose kernel/process state.

## Text processing (the daily power tools)

\`grep\` (search), \`awk\` (columns/compute), \`sed\` (stream edit), \`cut\`, \`sort\`, \`uniq -c\`, \`wc -l\`, \`head/tail -f\`. Pipe them: \`cat access.log | awk '{print $9}' | sort | uniq -c | sort -rn\` → count HTTP status codes.

## Processes & resources

- \`ps aux\`, \`top\`/\`htop\` — what's running, CPU/mem.
- \`kill -TERM/-9 <pid>\`, \`jobs\`, \`bg/fg\`, \`nohup\`, \`&\`.
- \`free -h\` (memory), \`vmstat\`, \`iostat\`, \`uptime\` (load average).
- Signals: \`SIGTERM\` (graceful), \`SIGKILL\` (forced), \`SIGHUP\`.

## Permissions

\`chmod\` (rwx for user/group/other → octal 755/644), \`chown\`, \`sudo\`. \`r=4 w=2 x=1\`.

## JVM debugging on a box

> [!TIP]
> Diagnosing a stuck/hot Java service over SSH: \`jps\` (find PID) → \`jstack <pid>\` (thread dump: find deadlocks/blocked threads) → \`jmap -histo <pid>\` or heap dump (memory) → \`jstat -gcutil <pid> 1s\` (GC activity) → \`top -H -p <pid>\` (hot threads, map TID→thread in jstack). This sequence solves most production JVM incidents.

> [!WARNING]
> Be careful with \`kill -9\` — it skips shutdown hooks (no graceful connection drain, no flush). Prefer \`SIGTERM\` and let the app shut down cleanly; containers/k8s send TERM then KILL after a grace period.

> [!EU]
> Expect practical prompts: *"A service is using 100% CPU in production — how do you debug it?"* Walk top → top -H -p pid → jstack → find the hot thread's stack. *"How do you find what's filling the disk?"* → \`du -sh /* | sort -h\`. Hands-on Linux fluency signals operational maturity.
`,
      code: [
        {
          lang: 'bash',
          title: 'Production debugging one-liners',
          code: `# --- Find the heaviest directories (disk filling up) ---
echo '$ du -sh /var/* 2>/dev/null | sort -h | tail -5'

# --- Top HTTP status codes from an access log (field 9) ---
echo '$ awk '"'"'{print $9}'"'"' access.log | sort | uniq -c | sort -rn | head'

# --- Find & follow errors across rotated logs ---
echo '$ grep -ri "exception" /var/log/myapp/ | tail -20'
echo '$ tail -f /var/log/myapp/app.log | grep --line-buffered ERROR'

# --- Who is listening on port 8080? ---
echo '$ ss -ltnp | grep :8080      # or: lsof -i :8080'

# --- JVM incident triage ---
echo '$ jps -l                      # find the PID of your jar'
echo '$ top -H -p <pid>             # hottest THREADS (note the TID in decimal)'
echo '$ printf "%x\\n" <tid>         # convert TID to hex (nid in the dump)'
echo '$ jstack <pid> | less         # find that nid -> the hot stack trace'
echo '$ jstat -gcutil <pid> 1000    # GC% every 1s: is it GC-bound?'
echo '$ jmap -histo:live <pid> | head   # top object counts (leak hunting)'

# --- Graceful vs forceful stop ---
echo '$ kill -TERM <pid>   # graceful: runs shutdown hooks (preferred)'
echo '$ kill -9   <pid>    # forceful: last resort, skips cleanup'

echo ""
echo "Run these on a real Linux box; this sandbox just prints the commands to memorise."`
        }
      ],
      flashcards: [
        { q: 'How do you debug a Java service pinning a CPU core in production?', a: 'top -H -p <pid> to find the hottest thread\'s TID, convert it to hex (printf %x), then locate that nid in a jstack thread dump to read the exact stack trace consuming CPU. Cross-check GC with jstat -gcutil.' },
        { q: 'Difference between SIGTERM and SIGKILL?', a: 'SIGTERM (kill -TERM/15) asks the process to terminate gracefully, allowing shutdown hooks/cleanup. SIGKILL (kill -9) forcibly terminates immediately and cannot be caught — skipping cleanup, connection draining, and flushes.' },
        { q: 'Build a pipeline to count HTTP status codes in an access log.', a: 'awk \'{print $9}\' access.log | sort | uniq -c | sort -rn — extract the status field, sort, count unique occurrences, then sort by count descending.' },
        { q: 'Which tools inspect a running JVM\'s threads, heap, and GC?', a: 'jstack (thread dump/deadlocks), jmap (heap histogram/dump), jstat -gcutil (live GC statistics), and jps to find the PID — all part of the JDK.' }
      ]
    },

    {
      id: '9.2',
      title: 'Networking & HTTP',
      hours: 3,
      notes: `
# Networking & HTTP for Backend Engineers

## The TCP/IP stack

Application (HTTP/gRPC) → Transport (TCP/UDP) → Network (IP) → Link. Know where things live and fail.

## TCP fundamentals

- **3-way handshake** — SYN → SYN-ACK → ACK establishes a connection. Reliable, ordered, flow/congestion-controlled.
- **TCP vs UDP** — TCP: reliable, ordered, connection-based (HTTP, DBs). UDP: fire-and-forget, low overhead (DNS, video, QUIC).
- **Connection pooling** matters — the handshake + TLS adds latency; reuse connections (HTTP keep-alive, DB pools).

## HTTP essentials

- **Methods/semantics** & status codes (see API module).
- **HTTP/1.1** — keep-alive, but head-of-line blocking per connection.
- **HTTP/2** — multiplexed streams over one connection, header compression, server push.
- **HTTP/3 (QUIC)** — over UDP, eliminates TCP head-of-line blocking, faster handshakes.
- **TLS** — handshake, certificates, SNI; terminate at the LB/ingress.

## DNS

Name → IP resolution, cached with TTLs. A surprising amount of "the network is slow" is DNS or connection-pool exhaustion.

## Diagnosis tools

\`curl -v\` (full request/response + TLS), \`dig\`/\`nslookup\` (DNS), \`ping\`/\`traceroute\` (reachability/path), \`ss\`/\`netstat\` (sockets), \`tcpdump\`/Wireshark (packets), \`telnet host port\`/\`nc\` (is the port open?).

> [!WARNING]
> Classic production traps: **connection pool exhaustion** (too-small pool + slow downstream → requests queue), **no timeouts** (a hung TCP read blocks a thread forever), **DNS TTL caching** (stale IP after failover), **TLS cert expiry**. Always set connect + read timeouts.

> [!TIP]
> When "service A can't reach service B": \`curl -v\` from A's pod, check DNS (\`nslookup B\`), check the port (\`nc -zv B 8080\`), check the K8s Service/endpoints, then NetworkPolicies/firewall. Work up the stack methodically.

> [!EU]
> Expect: *"What happens when you type a URL and press enter?"* (DNS → TCP handshake → TLS → HTTP request → response → render — a whole-stack narration). And *"TCP vs UDP"*, *"HTTP/1.1 vs 2 vs 3"*, *"What's a 3-way handshake?"*
`,
      code: [
        {
          lang: 'bash',
          title: 'Network debugging toolkit',
          code: `# --- Full HTTP+TLS trace (timing, headers, cert) ---
echo '$ curl -v -o /dev/null -w "dns:%{time_namelookup} connect:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\\n" https://api.example.com/health'

# --- DNS resolution ---
echo '$ dig +short api.example.com        # A records'
echo '$ nslookup api.example.com'

# --- Is the port reachable? (no curl needed) ---
echo '$ nc -zv api.example.com 443         # TCP connect test'
echo '$ telnet api.example.com 443'

# --- What sockets/ports is this host using? ---
echo '$ ss -tunap | head                   # tcp/udp, numeric, all, processes'

# --- Path & latency to host ---
echo '$ traceroute api.example.com'
echo '$ ping -c 4 api.example.com'

# --- Inspect TLS certificate & expiry ---
echo '$ echo | openssl s_client -connect api.example.com:443 -servername api.example.com 2>/dev/null | openssl x509 -noout -dates'

echo ""
echo "Mental model: when A cannot reach B, climb the stack:"
echo "  1) DNS resolves?  2) TCP connects (nc)?  3) TLS ok?  4) HTTP 200 (curl -v)?"
echo "  5) K8s Service/Endpoints populated?  6) NetworkPolicy/firewall allowing it?"`
        }
      ],
      flashcards: [
        { q: 'Describe the TCP 3-way handshake.', a: 'SYN (client→server) → SYN-ACK (server→client) → ACK (client→server). It synchronizes sequence numbers and establishes a reliable, ordered connection before data flows.' },
        { q: 'TCP vs UDP — when each?', a: 'TCP is connection-oriented, reliable, and ordered (HTTP, databases). UDP is connectionless, fire-and-forget, low-overhead — used for DNS, real-time media, and QUIC/HTTP3 where the app handles reliability.' },
        { q: 'Key improvements of HTTP/2 and HTTP/3?', a: 'HTTP/2 multiplexes many streams over a single TCP connection with header compression, eliminating HTTP/1.1 head-of-line blocking at the app layer. HTTP/3 runs over QUIC/UDP, removing TCP-level head-of-line blocking and enabling faster (0-RTT) handshakes.' },
        { q: 'Common production networking failures to guard against?', a: 'Connection pool exhaustion under slow downstreams, missing connect/read timeouts (threads block forever), stale DNS due to TTL caching after failover, and expired TLS certificates. Always set timeouts and monitor cert expiry.' },
        { q: 'Methodical approach when service A cannot reach service B?', a: 'Climb the stack: verify DNS resolves (dig/nslookup), TCP port connects (nc -zv), TLS succeeds, HTTP responds (curl -v), then check K8s Service/endpoints and NetworkPolicies/firewall rules.' }
      ]
    },

    {
      id: '9.3',
      title: 'Observability: Logs, Metrics, Traces',
      hours: 3,
      notes: `
# Observability — Logs, Metrics, Traces

You can't operate what you can't see. The **three pillars** let you answer "is it healthy?", "what's wrong?", and "where exactly?".

## The three pillars

- **Logs** — discrete, timestamped events. Use **structured (JSON) logging** + a **correlation/trace id** per request so you can stitch a request across services. Ship to ELK/Loki.
- **Metrics** — numeric time series (counters, gauges, histograms): request rate, error rate, latency percentiles, JVM heap, GC. **Prometheus** scrapes; **Grafana** visualises. Spring Boot **Micrometer + Actuator** exposes \`/actuator/prometheus\`.
- **Traces** — the path of a single request across services with timing per span. **OpenTelemetry** → Jaeger/Tempo/Zipkin. Reveals which hop is slow.

## The signals to alert on (Golden Signals / RED / USE)

- **RED** (services): **R**ate, **E**rrors, **D**uration.
- **USE** (resources): **U**tilisation, **S**aturation, **E**rrors.
- Alert on **percentiles** (p95/p99), not averages — averages hide tail latency.

> [!TIP]
> **Correlation IDs** are the cheapest, highest-value observability practice: generate/propagate a trace id (W3C \`traceparent\`) through every service and log it on every line. Then one id reconstructs the entire request journey across logs, metrics, and traces.

> [!WARNING]
> Don't log secrets/PII (GDPR!). Don't log at DEBUG in prod by default (cost + noise). Cardinality explosions in metrics labels (e.g. user id as a label) can OOM Prometheus — label by bounded dimensions only.

## SLIs / SLOs / error budgets

- **SLI** — a measured indicator (e.g. % requests < 300ms).
- **SLO** — the target (e.g. 99.9% of requests succeed monthly).
- **Error budget** — the allowed failure (0.1%); spend it on releases, freeze when exhausted.

> [!EU]
> European ops culture values reliability engineering. Expect: *"How do you debug a latency spike in production?"* → traces to find the slow span, metrics to see scope/correlation, logs (via trace id) for the error detail. *"What would you monitor for this service?"* → RED + JVM (heap/GC) + dependency health, alerting on p99.
`,
      code: [
        {
          lang: 'java',
          title: 'Structured logging with a correlation id (MDC pattern)',
          code: `import java.util.*;
import java.util.concurrent.*;

// Models the MDC (Mapped Diagnostic Context) + correlation-id pattern used with SLF4J.
public class ObservabilityDemo {
    // Per-thread context, like SLF4J MDC
    static final ThreadLocal<Map<String,String>> MDC =
        ThreadLocal.withInitial(HashMap::new);

    static void log(String level, String msg) {
        Map<String,String> ctx = MDC.get();
        // Structured (key=value) line including the trace id -> greppable & parseable
        System.out.printf("{\\"level\\":\\"%s\\",\\"traceId\\":\\"%s\\",\\"service\\":\\"%s\\",\\"msg\\":\\"%s\\"}%n",
            level, ctx.getOrDefault("traceId","-"), ctx.getOrDefault("service","-"), msg);
    }

    static void handleRequest(String traceId) {
        MDC.get().put("traceId", traceId);     // set once at the edge, propagate downstream
        MDC.get().put("service", "checkout");
        log("INFO", "received order");
        callPayment();                          // same trace id flows through
        log("INFO", "order completed");
        MDC.remove();                           // ALWAYS clear (thread pools reuse threads!)
    }

    static void callPayment() {
        MDC.get().put("service", "payment");
        log("INFO", "charging card");
        MDC.get().put("service", "checkout");
    }

    public static void main(String[] args) {
        // Two concurrent requests, each with its own trace id — logs stay attributable
        var pool = Executors.newFixedThreadPool(2);
        pool.submit(() -> handleRequest("trace-AAA"));
        pool.submit(() -> handleRequest("trace-BBB"));
        pool.shutdown();
        try { pool.awaitTermination(2, TimeUnit.SECONDS); } catch (InterruptedException ignored) {}
        System.out.println("\\n-> Grep one traceId to replay an entire request across services.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What are the three pillars of observability?', a: 'Logs (discrete structured events), Metrics (numeric time series like rate/errors/latency/JVM stats), and Traces (the timed path of one request across services/spans). Together they answer is-it-healthy, what\'s-wrong, and where.' },
        { q: 'Why are correlation/trace IDs so valuable?', a: 'Propagating a single trace id (e.g. W3C traceparent) through every service and logging it on each line lets you reconstruct an entire request\'s journey across distributed logs and traces from one identifier — the cheapest high-leverage observability practice.' },
        { q: 'Why alert on percentiles instead of averages?', a: 'Averages hide tail latency — a p99 of 2s can coexist with a 50ms average. Users feel the tail, so SLOs and alerts use p95/p99 (and RED: Rate, Errors, Duration).' },
        { q: 'What are SLI, SLO, and error budget?', a: 'SLI is a measured reliability indicator (e.g. % of requests <300ms); SLO is the target for it (e.g. 99.9% monthly); the error budget is the permitted shortfall (0.1%) you spend on releases and freeze when exhausted.' },
        { q: 'Observability pitfalls to avoid?', a: 'Logging secrets/PII (GDPR), DEBUG logging in prod by default (cost/noise), and high-cardinality metric labels (e.g. user id) that can OOM Prometheus. Use bounded label dimensions and structured logs.' }
      ]
    }
  ]
},

/* ===================== PHASE 10: Behavioral & EU ===================== */
{
  id: 'p10',
  title: 'Behavioral & EU Interview Strategy',
  icon: 'compass',
  blurb: 'STAR stories, system-design communication, and the realities of EU visa-sponsorship interviews.',
  modules: [
    {
      id: '10.1',
      title: 'STAR Stories & Behavioral Rounds',
      hours: 3,
      notes: `
# Behavioral Rounds & STAR

European companies weight **behavioral fit, communication, and collaboration** heavily — sometimes decisively. Technical brilliance with poor communication fails loops here.

## The STAR method

Structure every story as:

- **S**ituation — context (brief).
- **T**ask — your specific responsibility/goal.
- **A**ction — what **you** did (use "I", not "we"; show decisions and trade-offs).
- **R**esult — quantified outcome + what you learned.

> [!TIP]
> Prepare **6–8 reusable stories** covering: a hard technical problem, a production incident you fixed, a conflict/disagreement, a leadership/mentoring moment, a failure + lesson, and a tight-deadline trade-off. Most behavioral questions map onto these. Keep each to ~2 minutes.

## Questions to prepare

- "Tell me about a challenging bug you debugged in production."
- "Describe a time you disagreed with a teammate/architect."
- "A time you made a mistake — what happened and what did you learn?"
- "How do you handle conflicting priorities / tight deadlines?"
- "Tell me about a system you designed end to end."

## Quantify everything

> [!SUCCESS]
> Weak: "I improved performance." Strong: "I profiled with async-profiler, found a JPA N+1 issuing 400 queries per request, added an entity graph, and cut p99 latency from 1.2s to 180ms — a 6x improvement that removed our scaling alarms." Numbers + method + impact = credibility.

> [!WARNING]
> Avoid badmouthing past employers/colleagues, vague "we" answers that hide your contribution, and rambling. Pause, structure, answer. It's fine to take 3 seconds to think.

> [!EU]
> **Cultural notes:** Dutch/German cultures value **directness and honesty** — saying "I don't know, but here's how I'd find out" scores *well*, not poorly. Nordic cultures emphasise **consensus and teamwork** — show collaboration. Generally, EU teams prize humility, reliability, and clear reasoning over bravado.
`,
      code: [
        {
          lang: 'java',
          title: 'A STAR story, structured (template you can fill in)',
          code: `public class StarStoryTemplate {
    record Story(String title, String situation, String task,
                 String action, String result) {}

    public static void main(String[] args) {
        Story incident = new Story(
            "Production latency incident",
            // Situation
            "Our checkout API p99 latency spiked to 2s during peak, triggering SLO alerts.",
            // Task
            "As the on-call senior, I owned root-causing and restoring the SLO within the hour.",
            // Action (THE important part — your decisions & trade-offs, first person)
            "I correlated the spike with GC logs and a distributed trace, isolating a slow span "
          + "in the pricing service. A heap dump showed an unbounded in-memory cache leaking. "
          + "I shipped a bounded Caffeine cache with TTL, added a readiness probe gap fix, and "
          + "right-sized the heap. I chose the bounded-cache fix over scaling out because the "
          + "root cause was a leak, not load.",
            // Result (quantified + lesson)
            "p99 fell from 2s to 220ms, alerts cleared, and I added a Grafana panel + alert on "
          + "cache size to catch recurrence. Lesson: always bound caches and alert on their size."
        );

        for (var s : new Story[]{ incident }) {
            System.out.println("=== " + s.title() + " ===");
            System.out.println("S: " + s.situation());
            System.out.println("T: " + s.task());
            System.out.println("A: " + s.action());
            System.out.println("R: " + s.result());
        }
        System.out.println("\\nFill this template for 6-8 stories; rehearse each to ~2 minutes.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What does STAR stand for and what is the most important part?', a: 'Situation, Task, Action, Result. Action is most important — it should describe what YOU specifically did, including decisions and trade-offs (use "I"), not what the team did.' },
        { q: 'How many behavioral stories should you prepare and covering what?', a: '6–8 reusable ~2-minute stories covering: a hard technical problem, a production incident, a conflict/disagreement, leadership/mentoring, a failure + lesson, and a tight-deadline trade-off — most questions map onto these.' },
        { q: 'How should you answer "tell me about improving performance"?', a: 'Quantify with method and impact: the measurement tool used, the root cause found, the fix, and the before/after numbers (e.g. p99 1.2s→180ms). Method + numbers + impact reads as senior credibility.' },
        { q: 'How is directness perceived in Dutch/German interview cultures?', a: 'Positively. Honest, direct answers — including "I don\'t know, but here\'s how I\'d find out" — are respected. Humility and clear reasoning beat bravado; consensus/teamwork is especially valued in Nordic cultures.' }
      ]
    },

    {
      id: '10.2',
      title: 'System Design Communication & Visa Logistics',
      hours: 3,
      notes: `
# System-Design Communication & EU Visa Logistics

## Driving the design round

The design round grades **communication and structured thinking** as much as the architecture. Make your thinking visible.

1. **Clarify before drawing** — "Who are the users? What scale? Read- or write-heavy? Consistency vs availability priority?" (asking good questions *is* a positive signal).
2. **State assumptions out loud** and estimate (Phase 5).
3. **Start high-level**, then drive into the component the interviewer cares about.
4. **Name trade-offs explicitly** — "I'll use eventual consistency here to keep the write path available; the cost is the UI must handle in-flight states."
5. **Address failure & scale** — what breaks at 10x? single points of failure? how do you monitor it?
6. **Invite collaboration** — "Does that match your constraints, or should I optimise for X instead?"

> [!TIP]
> Think out loud the *entire* time. Silence reads as being stuck. Even "I'm weighing a queue vs synchronous call here because…" keeps the interviewer with you and shows reasoning.

## EU visa-sponsorship realities

> [!EU]
> **Practical landscape (verify current rules):**
> - **Germany** — EU Blue Card for graduates with a qualifying salary threshold; the Opportunity/*Chancenkarte* points system; strong demand for backend engineers.
> - **Netherlands** — the **30% ruling** tax benefit (being scaled back, check current terms); the *kennismigrant* (highly-skilled migrant) route via recognised sponsors; lots of English-first companies (Adyen, Booking, Mollie, ING).
> - **Ireland** — Critical Skills Employment Permit (software roles qualify); English-speaking; many US/EU HQs.
> - **Sweden/Denmark/Nordics** — strong English, structured processes; Klarna, Spotify, etc.
> - Companies that sponsor advertise it; filter for "visa sponsorship available". Recognised-sponsor lists exist (e.g. IND public register in NL).

> [!WARNING]
> Sponsorship adds employer cost and lead time, so the technical bar can be **higher** for sponsored roles — you must clearly clear it. Be upfront about needing sponsorship early; don't hide it to the offer stage. Have documents ready (degree, references, passport validity).

## Closing strong

Prepare **questions for them** (team, tech stack, on-call, growth, relocation support) — engaged candidates stand out. Send a concise thank-you that references something specific from the conversation.

> [!SUCCESS]
> The winning profile for EU sponsorship: **solid fundamentals + clear communication + collaborative attitude + genuine interest in the product/company**. You don't need to be the world's best coder; you need to be a reliable, communicative engineer they'd want on the team — and worth the sponsorship paperwork.
`,
      code: [
        {
          lang: 'java',
          title: 'A reusable system-design checklist',
          code: `import java.util.*;

public class DesignRoundChecklist {
    public static void main(String[] args) {
        List<String> steps = List.of(
            "1. CLARIFY  : users, core features, read/write ratio, scale, consistency vs availability",
            "2. ESTIMATE : QPS, data size, peak factor (back-of-envelope, say the numbers)",
            "3. API      : define the key endpoints / contracts first",
            "4. HIGH-LVL : clients -> LB -> stateless app -> data tier; draw it",
            "5. DATA     : SQL vs NoSQL, schema, partitioning/sharding key, replication",
            "6. SCALE    : caching (pattern + invalidation), async/queues, CDN, read replicas",
            "7. DEEP-DIVE: expand the component the interviewer probes",
            "8. FAILURE  : SPOFs, what breaks at 10x, timeouts, retries, circuit breakers",
            "9. OBSERVE  : metrics (RED), tracing, alerting on p99",
            "10.TRADEOFFS: state each choice's cost out loud; invite feedback"
        );
        System.out.println("=== System Design Round — say each step aloud ===");
        steps.forEach(System.out::println);
        System.out.println("\\nRemember: communication + trade-off reasoning are graded as much as the diagram.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What should you do before drawing anything in a system-design round?', a: 'Clarify requirements — users, core features, scale/QPS, read vs write heavy, and consistency-vs-availability priorities — then state assumptions and rough estimates. Asking good clarifying questions is itself a positive signal.' },
        { q: 'Why think out loud throughout a design interview?', a: 'The round grades communication and structured reasoning as much as the final architecture. Verbalizing trade-offs ("queue vs sync call because…") keeps the interviewer engaged and demonstrates how you reason; silence reads as being stuck.' },
        { q: 'Name two common EU highly-skilled migration routes.', a: 'Germany\'s EU Blue Card (salary-threshold route for graduates) and the Netherlands\' kennismigrant (highly-skilled migrant) route via recognised sponsors. Ireland\'s Critical Skills Permit is another. (Always verify current thresholds/rules.)' },
        { q: 'Why might the technical bar be higher for visa-sponsored roles, and how do you handle it?', a: 'Sponsorship adds employer cost and lead time, so they must justify it. Be upfront about needing sponsorship early, clearly clear the technical bar, and have your documents (degree, references, valid passport) ready.' },
        { q: 'What is the winning candidate profile for EU sponsorship?', a: 'Solid fundamentals plus clear communication, a collaborative attitude, and genuine interest in the product — a reliable, communicative engineer worth the sponsorship effort, rather than necessarily the strongest pure coder.' }
      ]
    }
  ]
},
];
