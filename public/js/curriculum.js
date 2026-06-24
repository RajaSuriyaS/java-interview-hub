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
        },
        {
          lang: 'java',
          title: 'Stack frames, StackOverflow, and tail-call insight',
          code: `public class StackFrameDemo {
    // Each call to recurse() pushes a new STACK FRAME onto the thread's JVM stack.
    // Frame contains: local variables, operand stack, reference back to constant pool.
    // Default stack size ~512KB-1MB per thread. Deep recursion overflows it.
    static long recurse(int n, long acc) {
        if (n <= 0) return acc;
        // This call creates a new frame. JVM does NOT do tail-call elimination
        // (unlike Scala/Haskell), so even though this IS tail-recursive, it will overflow.
        return recurse(n - 1, acc + n);
    }

    // Safe iterative version — O(1) stack space
    static long iterate(int n) {
        long sum = 0;
        for (int i = 1; i <= n; i++) sum += i;
        return sum;
    }

    public static void main(String[] args) {
        // How deep can we go? (varies by JVM/-Xss setting)
        int depth = 0;
        try {
            recurse(100_000, 0);    // likely StackOverflowError
            System.out.println("100k calls completed (uncommon without -Xss)");
        } catch (StackOverflowError e) {
            System.out.println("StackOverflowError hit (stack full of frames)");
        }

        // Iterative is always safe and avoids frame allocation overhead
        System.out.println("Iterative sum 1..1M = " + iterate(1_000_000));

        System.out.println("\\nStack size tuning: -Xss512k (smaller, more threads) or -Xss2m (deeper recursion)");
        System.out.println("Thread count × stack size = OS memory committed for stacks.");
        System.out.println("Virtual threads (JDK 21) use heap-allocated stacks -> millions possible.");
    }
}`
        },
        {
          lang: 'java',
          title: 'Custom ClassLoader: load a class from bytes at runtime',
          code: `// Custom ClassLoaders power OSGi, plugin systems, hot-reload, and Spring Boot fat-jars.
// They break parent delegation (child-first) to isolate different versions of the same library.
public class ClassLoaderDemo {

    // A classloader that loads a class from a raw byte array (e.g. from a DB or network).
    // In real frameworks this would load from a JAR stream.
    static class ByteArrayClassLoader extends ClassLoader {
        private final String className;
        private final byte[] bytecode;

        ByteArrayClassLoader(String className, byte[] bytecode) {
            super(ClassLoaderDemo.class.getClassLoader()); // parent = app classloader
            this.className = className;
            this.bytecode  = bytecode;
        }

        @Override
        protected Class<?> findClass(String name) throws ClassNotFoundException {
            if (name.equals(className)) {
                System.out.println("[CustomCL] defining class: " + name);
                return defineClass(name, bytecode, 0, bytecode.length);
            }
            return super.findClass(name);
        }
    }

    // Minimal valid .class bytecode for: public class Hello { public static String greet() { return "Hi!"; } }
    // Generated with: javac Hello.java && xxd -i Hello.class
    // (Using a tiny pre-built bytecode array for this demo)
    static final byte[] HELLO_CLASS_BYTECODE = buildTinyClass();

    static byte[] buildTinyClass() {
        // A real example would load bytes from a file/DB/network.
        // Here we just return the bytes of a class we ALREADY have (to show the mechanism).
        // In practice: return Files.readAllBytes(Path.of("plugins/MyPlugin.class"));
        try {
            return ClassLoaderDemo.class.getResourceAsStream(
                "ClassLoaderDemo.class") != null
                ? ClassLoaderDemo.class.getResourceAsStream("ClassLoaderDemo.class").readAllBytes()
                : new byte[0];
        } catch (Exception e) { return new byte[0]; }
    }

    public static void main(String[] args) throws Exception {
        // Demonstrate isolation: same class name, different loaders = different Class objects
        ClassLoader loaderA = new ByteArrayClassLoader("Isolated", new byte[0]);
        ClassLoader loaderB = new ByteArrayClassLoader("Isolated", new byte[0]);

        System.out.println("loaderA == loaderB? " + (loaderA == loaderB));  // false
        System.out.println("Parent of loaderA: " + loaderA.getParent());

        // Key insight: Class identity = class name + ClassLoader
        // Two classes with identical bytecode loaded by different ClassLoaders are NOT the same type.
        // This is how Tomcat isolates web apps: each app has its own ClassLoader.
        System.out.println("\\nParent-delegation in action:");
        System.out.println("  String class loader: " + String.class.getClassLoader()); // null = Bootstrap
        System.out.println("  This class loader:   " + ClassLoaderDemo.class.getClassLoader());
        System.out.println("  Bootstrap is null because it's native (C++), not a Java object.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'Which runtime data areas are shared across all threads vs per-thread?', a: 'Shared: Heap and Method Area/Metaspace (class metadata, statics, constant pool). Per-thread: JVM Stack, PC Register, and Native Method Stack.' },
        { q: 'What replaced PermGen in Java 8 and why does it matter?', a: 'Metaspace, which lives in native memory and grows dynamically (bounded by -XX:MaxMetaspaceSize). It removed fixed PermGen sizing and the classic "PermGen space" OOM, but class-loader leaks can still exhaust native memory.' },
        { q: 'Explain the parent-delegation model and why it exists.', a: 'A class loader delegates to its parent before attempting to load a class itself (Bootstrap → Platform → Application → custom). It guarantees core classes (java.lang.String) can\'t be spoofed and avoids duplicate class definitions.' },
        { q: 'What are the three phases of linking?', a: 'Verify (bytecode integrity & safety), Prepare (allocate static fields with default values), Resolve (replace symbolic references with direct references).' },
        { q: 'How does the JVM decide to JIT-compile a method?', a: 'It interprets bytecode first and profiles invocation/loop counts. "Hot" methods crossing a threshold are compiled by the JIT (tiered: C1 client for quick compiles, C2 server for aggressive optimisation).' },
        { q: 'What constitutes a JVM stack frame?', a: 'Each method invocation creates a frame containing: local variable array, operand stack (where bytecode instructions push/pop values), and a reference to the runtime constant pool of the current class.' },
        { q: 'Why does the JVM throw StackOverflowError instead of OutOfMemoryError for deep recursion?', a: 'The JVM stack is a fixed-size per-thread structure (tuned with -Xss). When recursion exhausts the space for new frames, the JVM throws StackOverflowError — distinct from heap OOM. Fix: convert to iteration or increase -Xss (but more threads × larger stack = more native memory).' },
        { q: 'What is the class identity contract in Java?', a: 'A class\'s identity is defined by BOTH its fully-qualified name AND the ClassLoader that loaded it. Two classes with the same bytecode loaded by different ClassLoaders are different types and cannot be cast to each other — this enables web app isolation in Tomcat/OSGi.' },
        { q: 'How does Spring Boot\'s fat-jar ClassLoader differ from standard parent delegation?', a: 'Spring Boot\'s LaunchedURLClassLoader loads nested JARs inside the fat-jar (BOOT-INF/lib/) using a custom protocol handler. It loads application classes first (child-first), overriding standard parent delegation, to isolate the app\'s dependencies from the host JVM\'s classpath.' }
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
        },
        {
          lang: 'java',
          title: 'Common memory leak patterns and how to find them',
          code: `import java.util.*;
import java.util.concurrent.*;

// The four most common Java memory leak patterns — all produce reachable-but-unused objects.
// GC cannot reclaim them because they have live references.
public class MemoryLeakPatterns {

    // LEAK 1: Unbounded static cache (most common in production)
    static final Map<String, byte[]> REPORT_CACHE = new HashMap<>();
    static void leakPattern1_UnboundedCache(String key) {
        // Cache grows without limit. Never evicted. Heap fills up with stale reports.
        // Fix: use Caffeine/Guava cache with size limit + TTL
        REPORT_CACHE.computeIfAbsent(key, k -> new byte[1024]); // "cache" that never shrinks
    }

    // LEAK 2: Listener / observer never deregistered
    interface EventListener { void onEvent(String e); }
    static final List<EventListener> listeners = new ArrayList<>();
    static void leakPattern2_UnregisteredListener() {
        // A new listener is added every time a component is created.
        // If the component is GC-able but the listener is still in the list, it won't be collected.
        // Fix: remove listener in the component's destroy/close method.
        listeners.add(e -> System.out.println("event: " + e));
        System.out.println("Listeners registered: " + listeners.size() + " (keeps growing!)");
    }

    // LEAK 3: ThreadLocal not removed in a thread pool
    static final ThreadLocal<List<String>> PER_THREAD_CONTEXT = ThreadLocal.withInitial(ArrayList::new);
    static void leakPattern3_ThreadLocal() {
        // Thread-pool threads live forever. ThreadLocal values attached to them live forever too.
        // Fix: always call remove() in a finally block.
        PER_THREAD_CONTEXT.get().add("user-session-data-" + UUID.randomUUID()); // keeps accumulating
        System.out.println("Thread context size: " + PER_THREAD_CONTEXT.get().size());
        // CORRECT PATTERN:
        try {
            PER_THREAD_CONTEXT.get().add("safe");
        } finally {
            PER_THREAD_CONTEXT.remove(); // ALWAYS clean up in thread pools
        }
    }

    // LEAK 4: Inner class / lambda holding outer class reference
    static class HeavyService {
        byte[] bigData = new byte[10 * 1024 * 1024]; // 10MB
        Runnable createLeakyTask() {
            // Anonymous inner class / lambda implicitly holds 'this' (the HeavyService).
            // If the task is submitted to a long-lived executor, HeavyService is pinned in memory.
            return () -> System.out.println("I hold a ref to HeavyService via outer 'this'");
            // Fix: make the closure variables local finals, don't capture 'this'
        }
    }

    // HOW TO DIAGNOSE: heap dump + Eclipse MAT
    // jmap -dump:format=b,file=heap.hprof <pid>
    // Then open in Eclipse MAT -> "Leak Suspects" report -> look at dominator tree

    public static void main(String[] args) {
        System.out.println("=== Demonstrating leak patterns ===");
        for (int i = 0; i < 5; i++) {
            leakPattern1_UnboundedCache("report-" + i);
            leakPattern2_UnregisteredListener();
            leakPattern3_ThreadLocal();
        }
        System.out.println("Cache size: " + REPORT_CACHE.size());
        System.out.println("Listeners:  " + listeners.size());
        System.out.println("\\nDiagnosis: jmap -histo:live <pid> | head -20 shows top object counts.");
        System.out.println("A growing byte[] at the top of the list -> memory leak.");
    }
}`
        },
        {
          lang: 'java',
          title: 'G1 GC tuning: reading pause logs and setting goals',
          code: `// This demo generates GC activity you can observe with -Xlog:gc*
// Run with: java -Xmx128m -Xms128m -XX:+UseG1GC -XX:MaxGCPauseMillis=50 -Xlog:gc*:stdout GcTuningDemo
// Then watch G1 try to hit the 50ms pause goal.
import java.util.*;

public class GcTuningDemo {
    public static void main(String[] args) throws InterruptedException {
        List<byte[]> survivors = new ArrayList<>();
        long totalPause = 0;
        int gcCount = 0;

        // Simulate a mixed workload: short-lived + long-lived objects
        for (int i = 0; i < 500; i++) {
            // Short-lived: dies in Eden (cheap minor GC)
            byte[] ephemeral = new byte[100_000];
            ephemeral[0] = (byte) i;

            // 1 in 10 survives (simulates a cache that grows the old gen)
            if (i % 10 == 0) survivors.add(new byte[50_000]);

            // Periodically release some survivors to simulate cache eviction
            if (i % 50 == 0 && survivors.size() > 20) {
                survivors.subList(0, 10).clear();
            }

            Thread.sleep(2); // Slow down so GC logs are readable
        }

        System.out.println("Surviving objects: " + survivors.size());
        System.out.println();
        System.out.println("Key GC log lines to look for:");
        System.out.println("  [gc] GC(n) Pause Young (Normal) -> minor GC, short");
        System.out.println("  [gc] GC(n) Pause Young (Concurrent Start) -> triggers concurrent marking");
        System.out.println("  [gc] GC(n) Pause Remark -> STW, short: finalizes marking");
        System.out.println("  [gc] GC(n) Pause Cleanup -> STW, very short: selects regions");
        System.out.println("  [gc] GC(n) Pause Mixed -> reclaims old gen regions (the payoff)");
        System.out.println();
        System.out.println("Tuning knobs:");
        System.out.println("  -XX:MaxGCPauseMillis=200  (default; lower = more frequent GCs)");
        System.out.println("  -XX:G1HeapRegionSize=4m   (for humongous obj tuning)");
        System.out.println("  -XX:G1NewSizePercent=20   (min young gen %)");
        System.out.println("  -XX:G1MaxNewSizePercent=60 (max young gen %)");
        System.out.println("  -XX:ConcGCThreads=4       (concurrent marking threads)");
        System.out.println();
        System.out.println("Rule: set -Xms == -Xmx to avoid heap resize pauses in prod.");
        System.out.println("Leave 25% of container RAM for Metaspace, threads, direct memory.");
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
        { q: 'First step when diagnosing GC-related latency spikes?', a: 'Enable and read GC logs (-Xlog:gc*) to confirm pauses correlate with the spikes, then take a heap dump to inspect the retained set — measure before tuning any flags.' },
        { q: 'Why set -Xms equal to -Xmx in production?', a: 'If Xms < Xmx, the JVM starts with a small heap and grows it on demand. Heap growth triggers a Full GC (to copy/compact) — an avoidable pause. Setting them equal allocates the full heap at startup, trading startup memory for stable, predictable runtime behaviour.' },
        { q: 'What is a "humongous object" in G1 GC?', a: 'An object that is 50%+ of a G1 region size (default ~1-32MB depending on heap). G1 allocates these directly in the old generation (Humongous regions), bypassing Eden. They can trigger mixed GCs early — if you see many humongous allocations, increase G1HeapRegionSize or redesign the allocation.' },
        { q: 'Name the four classic Java memory leak patterns.', a: '1) Unbounded static caches/collections that grow without eviction. 2) Listeners/observers registered but never deregistered. 3) ThreadLocals not cleared in thread-pool threads (pool threads are reused, values accumulate). 4) Inner classes/lambdas that capture references to large outer objects submitted to long-lived executors.' }
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
        },
        {
          lang: 'java',
          title: 'Double-checked locking: broken vs correct singleton',
          code: `// The classic broken DCL vs the correct volatile version — a JMM favourite.
public class DoubleCheckedLocking {

    // ❌ BROKEN: without volatile, another thread can see non-null but uninitialised instance.
    // The JVM/CPU can reorder: 1) allocate memory, 2) assign reference, 3) run constructor.
    // Another thread reading after step 2 sees non-null but step 3 hasn't happened yet!
    static class BrokenSingleton {
        private static BrokenSingleton instance; // NOT volatile
        private final String config;
        private BrokenSingleton() { this.config = "loaded"; }
        static BrokenSingleton getInstance() {
            if (instance == null) {                    // first check (no lock)
                synchronized (BrokenSingleton.class) {
                    if (instance == null) {             // second check (with lock)
                        instance = new BrokenSingleton(); // reordering can leak partial object!
                    }
                }
            }
            return instance;
        }
    }

    // ✅ CORRECT: volatile prevents the constructor/reference-write reordering.
    static class CorrectSingleton {
        private static volatile CorrectSingleton instance; // volatile = happens-before guarantee
        private final String config;
        private CorrectSingleton() { this.config = "loaded"; }
        static CorrectSingleton getInstance() {
            if (instance == null) {
                synchronized (CorrectSingleton.class) {
                    if (instance == null) {
                        instance = new CorrectSingleton(); // safe: volatile write happens-after constructor
                    }
                }
            }
            return instance;
        }
        public String getConfig() { return config; }
    }

    // ✅ BEST: Initialization-on-demand holder — zero synchronization overhead, lazy, correct.
    // The JVM guarantees class initialisation is atomic (single-threaded by the ClassLoader).
    static class HolderSingleton {
        private final String config = "loaded";
        private static class Holder { static final HolderSingleton INSTANCE = new HolderSingleton(); }
        static HolderSingleton getInstance() { return Holder.INSTANCE; }
        // Holder class is loaded lazily when getInstance() is first called.
        // Class loading is synchronised by the JVM — no explicit locking needed.
    }

    // ✅ SIMPLEST: enum (Josh Bloch Item 3) — serialization-safe, reflection-safe
    enum EnumSingleton { INSTANCE;
        public String getConfig() { return "loaded"; }
    }

    public static void main(String[] args) {
        System.out.println(CorrectSingleton.getInstance().getConfig());
        System.out.println(HolderSingleton.getInstance().config);
        System.out.println(EnumSingleton.INSTANCE.getConfig());
        System.out.println("\\nFor interview: prefer Initialization-on-demand holder or enum.");
        System.out.println("If asked about DCL, explain the volatile requirement and WHY.");
    }
}`
        },
        {
          lang: 'java',
          title: 'False sharing and @Contended — cache-line performance trap',
          code: `import java.util.concurrent.CountDownLatch;
import java.lang.annotation.*;

// False sharing: two variables on the SAME CPU cache line (64 bytes) are written
// by different threads. Each write invalidates the other thread's cache line,
// causing bouncing between CPU caches — massive throughput loss.
public class FalseSharingDemo {

    // ❌ False sharing: x and y likely share a cache line
    static class Shared {
        volatile long x = 0;
        volatile long y = 0; // probably within 64 bytes of x -> false sharing!
    }

    // ✅ Padded: force x and y onto separate cache lines (each field + 7 longs = 64 bytes)
    // In production use: @jdk.internal.vm.annotation.Contended (JDK internal, needs --add-opens)
    // or simply structure your data so hot fields are in separate objects.
    static class Padded {
        volatile long x = 0; long p1,p2,p3,p4,p5,p6,p7;  // padding
        volatile long y = 0; long q1,q2,q3,q4,q5,q6,q7;  // separate cache line
    }

    static final int ITERATIONS = 50_000_000;

    static long benchmark(boolean padded) throws InterruptedException {
        Object obj = padded ? new Padded() : new Shared();
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done  = new CountDownLatch(2);

        Thread t1 = new Thread(() -> {
            try { start.await(); } catch (InterruptedException e) { return; }
            if (padded) { Padded p = (Padded) obj; for (int i=0;i<ITERATIONS;i++) p.x++; }
            else        { Shared s = (Shared) obj; for (int i=0;i<ITERATIONS;i++) s.x++; }
            done.countDown();
        });
        Thread t2 = new Thread(() -> {
            try { start.await(); } catch (InterruptedException e) { return; }
            if (padded) { Padded p = (Padded) obj; for (int i=0;i<ITERATIONS;i++) p.y++; }
            else        { Shared s = (Shared) obj; for (int i=0;i<ITERATIONS;i++) s.y++; }
            done.countDown();
        });
        t1.start(); t2.start();
        long t = System.nanoTime();
        start.countDown();
        done.await();
        return System.nanoTime() - t;
    }

    public static void main(String[] args) throws InterruptedException {
        long shared = benchmark(false);
        long padded  = benchmark(true);
        System.out.printf("Shared  (false sharing): %,d ms%n", shared  / 1_000_000);
        System.out.printf("Padded  (no false share): %,d ms%n", padded  / 1_000_000);
        System.out.println("Padded can be 3-10x faster for write-heavy shared counters.");
        System.out.println("java.util.concurrent.atomic.LongAdder uses this technique internally.");
        System.out.println("@jdk.internal.vm.annotation.Contended pads automatically.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What does volatile guarantee and what does it NOT?', a: 'Guarantees visibility (no stale reads) and ordering (happens-before across the volatile access). Does NOT guarantee atomicity of compound operations like x++.' },
        { q: 'Define the happens-before relationship.', a: 'A partial ordering: if A happens-before B, A\'s memory effects are visible to B. Edges include program order, unlock→lock on same monitor, volatile write→read, Thread.start, and Thread.join.' },
        { q: 'Why must the double-checked-locking singleton field be volatile?', a: 'Without volatile, the JVM/CPU can reorder the constructor execution and the reference assignment, so another thread may observe a non-null but partially constructed instance. volatile ensures the constructor happens-before the reference write.' },
        { q: 'List safe publication mechanisms.', a: 'Store the reference in a volatile field or AtomicReference, initialise it as a final field in the constructor, guard it with a lock, or place it in a thread-safe/concurrent collection.' },
        { q: 'What is false sharing and how does it degrade performance?', a: 'When two variables on the same 64-byte CPU cache line are written by different threads, each write invalidates the other\'s cached line, causing constant cache coherence traffic. The fix is padding to force hot fields onto separate cache lines. LongAdder uses this internally.' },
        { q: 'What is the initialization-on-demand holder singleton pattern and why is it safe without synchronisation?', a: 'A private static inner class holds the singleton instance as a static final field. The JVM guarantees class initialisation is single-threaded (done by the ClassLoader under synchronisation) so the instance is created safely and lazily on first access — zero explicit locking overhead.' },
        { q: 'What happens-before edges does Thread.start() and Thread.join() establish?', a: 'Thread.start(): all actions before start() happen-before any action in the started thread. Thread.join(): all actions in the joined thread happen-before Thread.join() returns to the joining thread. These allow safe publication of data to new threads.' }
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
        },
        {
          lang: 'java',
          title: 'Proper JMH microbenchmark — the correct way to measure Java performance',
          code: `// JMH (Java Microbenchmark Harness) is the ONLY correct way to benchmark JVM code.
// Naive System.nanoTime loops are invalid: JIT may eliminate the code, warm-up skews results.

// PRODUCTION DEPENDENCY: org.openjdk.jmh:jmh-core:1.37

// In a real JMH benchmark project:
/*
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.runner.Runner;
import org.openjdk.jmh.runner.options.*;
import java.util.concurrent.TimeUnit;

@BenchmarkMode(Mode.AverageTime)        // measure average time per operation
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@State(Scope.Thread)                    // one state instance per thread
@Warmup(iterations = 5, time = 1, timeUnit = TimeUnit.SECONDS)   // discard first 5s
@Measurement(iterations = 10, time = 1, timeUnit = TimeUnit.SECONDS)
@Fork(2)                                // run in 2 fresh JVM processes (eliminates JVM startup noise)
public class StringConcatBenchmark {

    @Param({"10", "100", "1000"})
    private int count;

    // ❌ Slow: creates N intermediate String objects
    @Benchmark
    public String plusConcat() {
        String s = "";
        for (int i = 0; i < count; i++) s += i;
        return s;
    }

    // ✅ Fast: StringBuilder reuses internal buffer
    @Benchmark
    public String stringBuilder() {
        StringBuilder sb = new StringBuilder(count * 3);
        for (int i = 0; i < count; i++) sb.append(i);
        return sb.toString();
    }

    public static void main(String[] args) throws Exception {
        Options opt = new OptionsBuilder()
            .include(StringConcatBenchmark.class.getSimpleName())
            .build();
        new Runner(opt).run();
    }
}
*/

// This runnable version shows WHAT JMH protects against:
public class JmhConceptDemo {
    static String plusConcat(int n) {
        String s = ""; for (int i = 0; i < n; i++) s += i; return s;
    }
    static String builderConcat(int n) {
        var sb = new StringBuilder(); for (int i = 0; i < n; i++) sb.append(i); return sb.toString();
    }

    public static void main(String[] args) {
        int n = 1000;

        // Warm up the JIT (as JMH does automatically with @Warmup)
        for (int w = 0; w < 10000; w++) { plusConcat(10); builderConcat(10); }

        long t1 = System.nanoTime();
        for (int i = 0; i < 1000; i++) plusConcat(n);
        long plusNs = (System.nanoTime() - t1) / 1000;

        long t2 = System.nanoTime();
        for (int i = 0; i < 1000; i++) builderConcat(n);
        long sbNs = (System.nanoTime() - t2) / 1000;

        System.out.printf("String +   (1000 iters, n=%d): avg %,d ns%n", n, plusNs);
        System.out.printf("StringBuilder (1000 iters, n=%d): avg %,d ns%n", n, sbNs);
        System.out.println("\\nIMPORTANT: this is still a naive benchmark.");
        System.out.println("For real numbers: use JMH with @Fork(2) @Warmup(iterations=5).");
        System.out.println("JMH prevents dead-code elimination and reports confidence intervals.");
    }
}`
        },
        {
          lang: 'java',
          title: 'GraalVM Native Image: tradeoffs made concrete',
          code: `// GraalVM Native Image compiles Java AOT to a native binary.
// Startup: milliseconds (vs seconds for JVM). Memory: ~10x lower at startup.
// Cost: no JIT runtime optimisation, closed-world assumption.
// Best for: CLI tools, serverless functions, microservices where cold-start matters.

// To build (requires GraalVM installed):
//   native-image -cp myapp.jar com.example.Main -o myapp
//   ./myapp   # runs without a JVM!

// Restrictions that catch teams off-guard:
public class GraalvmNativeDemo {
    // ❌ Dynamic class loading breaks native image (open world assumption)
    static void brokenDynamic() throws Exception {
        // This fails at native-image build time unless you add a reflect-config.json
        Class<?> clazz = Class.forName("com.example.plugins.DynamicPlugin");
        Object inst = clazz.getDeclaredConstructor().newInstance();
        System.out.println(inst);
    }

    // ✅ Static analysis friendly — the class reference is known at build time
    static void staticFriendly() {
        // Native image can trace this; no reflection config needed
        var service = new ConcreteService();
        service.run();
    }

    static class ConcreteService { void run() { System.out.println("running"); } }

    // Spring Native / Spring Boot 3 handles most of this automatically via AOT processing.
    // It generates reflect-config.json, proxy-config.json etc. at build time.

    public static void main(String[] args) {
        System.out.println("GraalVM Native Image trade-offs:");
        System.out.println();
        System.out.println("  Wins:");
        System.out.println("    Startup: ~50ms (vs 3-5s JVM Spring Boot)");
        System.out.println("    Memory:  ~50MB RSS (vs 300-500MB JVM)");
        System.out.println("    No JVM required at runtime");
        System.out.println();
        System.out.println("  Costs:");
        System.out.println("    Build time: 3-10 minutes (vs seconds for jar)");
        System.out.println("    No JIT peak throughput (peak ~20-30% lower than JVM)");
        System.out.println("    Reflection/proxies need explicit config or AOT hints");
        System.out.println("    Debugging is harder (no JVM tooling)");
        System.out.println();
        System.out.println("  When to use:");
        System.out.println("    Serverless (Lambda, Cloud Run) — cold starts matter");
        System.out.println("    CLI tools — instant startup");
        System.out.println("    Batch jobs — high throughput matters less than startup");
        System.out.println();
        System.out.println("  When NOT to use:");
        System.out.println("    Long-running services where JIT peak throughput matters");
        System.out.println("    Heavy reflection/dynamic proxies (frameworks that resist AOT)");

        staticFriendly(); // would work in native image
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is tiered compilation?', a: 'The JVM starts interpreting (level 0), compiles hot methods with C1 (levels 1–3, fast + profiling), and promotes the hottest to C2 (level 4, aggressive profile-guided optimisation).' },
        { q: 'What is escape analysis and what does it enable?', a: 'Analysis determining whether an object escapes its creating method/thread. If it doesn\'t, the JIT can scalar-replace it (avoid heap allocation) and elide locks (lock coarsening/elision).' },
        { q: 'Why use JMH instead of System.nanoTime loops?', a: 'JMH handles JIT warm-up (discards early iterations), prevents dead-code elimination from removing your benchmark (via Blackhole), forks fresh JVMs per benchmark, and reports statistically meaningful averages and confidence intervals.' },
        { q: 'What does GraalVM Native Image trade away for fast startup?', a: 'Peak JIT throughput (profiling-guided optimisation cannot happen AOT), runtime adaptivity, and the ability to load classes dynamically — reflection/proxies need explicit build-time configuration. Build time is also 3-10 minutes vs seconds for a JAR.' },
        { q: 'What JVM optimisation does method inlining enable?', a: 'Inlining copies a called method\'s body into the caller, eliminating call overhead and exposing the combined code to further optimisations (escape analysis, constant folding, dead-code elimination). It is the most impactful single JIT optimisation.' },
        { q: 'What is deoptimisation and when does it happen?', a: 'The JIT makes speculative optimisations (e.g. assuming a call site is monomorphic). If an assumption is later violated (a new subclass appears), the JIT deoptimises — falls back to the interpreter for that code path — and recompiles with the new type information.' },
        { q: 'When is GraalVM Native Image the right choice vs the JVM?', a: 'Native image wins for serverless functions, CLI tools, and batch jobs where cold-start time and memory footprint matter more than peak throughput. The JVM wins for long-running services where JIT profiling delivers peak throughput that AOT cannot match.' }
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
        },
        {
          lang: 'java',
          title: 'LRU Cache using LinkedHashMap — a real interview question',
          code: `import java.util.*;

// Classic interview question: implement an LRU (Least Recently Used) cache.
// LinkedHashMap with accessOrder=true maintains access order — the tail is the most-recently-used.
// Override removeEldestEntry to evict when capacity is exceeded.
public class LruCacheDemo {

    static class LruCache<K, V> extends LinkedHashMap<K, V> {
        private final int capacity;

        LruCache(int capacity) {
            super(capacity, 0.75f, true); // accessOrder=true: get() moves entry to tail
            this.capacity = capacity;
        }

        @Override
        protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > capacity; // evict oldest (head) when over capacity
        }
    }

    public static void main(String[] args) {
        LruCache<Integer, String> cache = new LruCache<>(3);
        cache.put(1, "one");
        cache.put(2, "two");
        cache.put(3, "three");
        System.out.println("After 3 puts: " + cache.keySet()); // [1, 2, 3]

        cache.get(1); // access key 1 -> moves to tail (most recently used)
        System.out.println("After get(1): " + cache.keySet()); // [2, 3, 1]

        cache.put(4, "four"); // capacity exceeded -> evicts LRU (key 2, the head)
        System.out.println("After put(4): " + cache.keySet()); // [3, 1, 4] — 2 evicted

        // For thread-safety: wrap with Collections.synchronizedMap() or use Caffeine
        // For production: com.github.ben-manes.caffeine:caffeine
        // Caffeine.newBuilder().maximumSize(1000).expireAfterWrite(10, MINUTES).build()

        System.out.println("\\nAlgorithm insight:");
        System.out.println("  LinkedHashMap with accessOrder maintains a doubly-linked list.");
        System.out.println("  get/put moves the entry to the tail in O(1).");
        System.out.println("  removeEldestEntry evicts the head (LRU) in O(1).");
        System.out.println("  Total: O(1) get and put for LRU — the optimal solution.");
    }
}`
        },
        {
          lang: 'java',
          title: 'ConcurrentHashMap: atomic operations and common pitfalls',
          code: `import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

// ConcurrentHashMap is the workhorse of concurrent Java code.
// Key: operations are NOT synchronized across multiple method calls.
public class ConcurrentMapDemo {

    public static void main(String[] args) throws InterruptedException {
        ConcurrentHashMap<String, AtomicInteger> wordCount = new ConcurrentHashMap<>();

        // ✅ computeIfAbsent is ATOMIC — safe for concurrent initialization
        // Only one thread creates the AtomicInteger for a key; others get the same instance.
        ExecutorService pool = Executors.newFixedThreadPool(8);
        String[] words = {"java","python","java","go","java","python","rust","java"};

        for (String w : words) {
            pool.submit(() -> {
                wordCount.computeIfAbsent(w, k -> new AtomicInteger(0)).incrementAndGet();
            });
        }
        pool.shutdown();
        pool.awaitTermination(2, TimeUnit.SECONDS);
        System.out.println("Word counts: " + wordCount);

        // ❌ WRONG: check-then-act is NOT atomic across two calls
        ConcurrentHashMap<String, Integer> broken = new ConcurrentHashMap<>();
        // Two threads could both pass the null check and both put a value
        if (broken.get("key") == null) {
            broken.put("key", 1); // RACE: another thread may also do this
        }

        // ✅ CORRECT: putIfAbsent or compute
        broken.putIfAbsent("key", 1);                     // atomic
        broken.merge("key", 1, Integer::sum);             // atomic increment: null-safe
        broken.compute("key", (k, v) -> v == null ? 1 : v + 1); // full control

        System.out.println("Atomic put result: " + broken.get("key"));

        // NULL keys/values are NOT allowed (unlike HashMap) — common NPE source
        try {
            ConcurrentHashMap<String,String> m = new ConcurrentHashMap<>();
            m.put(null, "value"); // throws NullPointerException!
        } catch (NullPointerException e) {
            System.out.println("ConcurrentHashMap rejects null keys/values (NPE caught)");
        }

        // WHY? In CHM, null would be ambiguous: does get() return null because the key
        // is absent, or because the value IS null? Without separate containsKey(),
        // the API would be unusable. HashMap allows it because it's single-threaded.
        System.out.println("\\nKey rule: in CHM, treat every operation as potentially racing.");
        System.out.println("Use atomic compound ops: computeIfAbsent, merge, compute.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What happens inside a HashMap bucket when collisions grow large (Java 8+)?', a: 'The bucket\'s linked list treeifies into a red-black tree once it exceeds 8 nodes and table capacity ≥ 64, improving worst-case lookup from O(n) to O(log n).' },
        { q: 'State the equals/hashCode contract.', a: 'Equal objects must have equal hashCodes; equals must be reflexive, symmetric, transitive, consistent, and false for null. Unequal objects ideally have different hashCodes for good distribution.' },
        { q: 'Why must HashMap keys be immutable (or at least their hash-relevant fields)?', a: 'The bucket index is derived from hashCode at insertion. If a field used in hashCode changes afterward, the entry sits in the wrong bucket and becomes unreachable by get().' },
        { q: 'How do you avoid ConcurrentModificationException while removing during iteration?', a: 'Use Iterator.remove(), Collection.removeIf(predicate), iterate over a copy, or use a concurrent collection (CopyOnWriteArrayList / ConcurrentHashMap).' },
        { q: 'Why does ConcurrentHashMap not allow null keys or values while HashMap does?', a: 'In CHM, a null return from get() is ambiguous — it could mean the key is absent OR the value is null. Without a separate containsKey() call (which would create a race condition), the API becomes unusable. HashMap avoids this issue because it\'s single-threaded.' },
        { q: 'What is the difference between putIfAbsent, computeIfAbsent, and merge on ConcurrentHashMap?', a: 'putIfAbsent: inserts only if key absent (returns existing value). computeIfAbsent: inserts using a factory function if absent — the function is called only once (atomic for initialization). merge: combines an existing value with a new one using a BiFunction — perfect for accumulation (e.g. word count).' },
        { q: 'How would you implement an O(1) get and put LRU cache in Java?', a: 'Extend LinkedHashMap with accessOrder=true and override removeEldestEntry to return true when size() > capacity. accessOrder=true moves entries to the tail on get(), so the head is always the least recently used. The JDK\'s doubly-linked list maintenance makes all operations O(1).' },
        { q: 'When would you choose TreeMap over HashMap?', a: 'When you need keys in sorted order (e.g. range queries: subMap, headMap, tailMap), ceiling/floor lookups, or iteration in natural/comparator order. TreeMap gives O(log n) operations via a red-black tree. HashMap is O(1) average but unordered.' }
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
        },
        {
          lang: 'java',
          title: 'Producer-consumer with BlockingQueue — the classic pattern',
          code: `import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

// BlockingQueue is the canonical producer-consumer building block.
// put() blocks when full; take() blocks when empty — no explicit synchronisation needed.
public class ProducerConsumerDemo {
    static final int CAPACITY = 5;
    static final BlockingQueue<String> queue = new LinkedBlockingQueue<>(CAPACITY);
    static final AtomicInteger produced = new AtomicInteger();
    static final AtomicInteger consumed = new AtomicInteger();

    static class Producer implements Runnable {
        private final String name;
        Producer(String name) { this.name = name; }
        public void run() {
            for (int i = 0; i < 5; i++) {
                String item = name + "-item-" + i;
                try {
                    queue.put(item);  // BLOCKS if queue is full (backpressure!)
                    System.out.println("[P:" + name + "] produced: " + item
                                       + " (queue size=" + queue.size() + ")");
                    produced.incrementAndGet();
                    Thread.sleep(100);
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); return; }
            }
        }
    }

    static class Consumer implements Runnable {
        private final String name;
        Consumer(String name) { this.name = name; }
        public void run() {
            try {
                while (true) {
                    // poll with timeout so consumers can exit gracefully
                    String item = queue.poll(500, TimeUnit.MILLISECONDS);
                    if (item == null) break; // no new items for 500ms -> done
                    System.out.println("  [C:" + name + "] consumed: " + item);
                    consumed.incrementAndGet();
                    Thread.sleep(200); // consumers slower than producers -> tests backpressure
                }
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
    }

    public static void main(String[] args) throws InterruptedException {
        ExecutorService pool = Executors.newCachedThreadPool();
        pool.submit(new Producer("P1"));
        pool.submit(new Producer("P2"));
        pool.submit(new Consumer("C1"));
        pool.submit(new Consumer("C2"));
        pool.shutdown();
        pool.awaitTermination(10, TimeUnit.SECONDS);
        System.out.printf("\\nTotal produced=%d consumed=%d%n", produced.get(), consumed.get());
        System.out.println("Key: queue capacity=5 provides backpressure. If consumers lag,");
        System.out.println("producers block at put() instead of flooding memory with tasks.");
    }
}`
        },
        {
          lang: 'java',
          title: 'StampedLock: optimistic reads for read-heavy data',
          code: `import java.util.concurrent.locks.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.LongAdder;

// StampedLock (Java 8+) adds OPTIMISTIC reading to ReadWriteLock.
// Optimistic read: read WITHOUT acquiring a lock, then validate the stamp.
// If the stamp is invalid (a write happened during our read), fall back to a real read lock.
// For data that is MOSTLY read with rare writes, this eliminates read-lock overhead.
public class StampedLockDemo {
    static class Point {
        private double x, y;
        private final StampedLock lock = new StampedLock();

        void move(double deltaX, double deltaY) {
            long stamp = lock.writeLock();           // exclusive write lock
            try { x += deltaX; y += deltaY; }
            finally { lock.unlockWrite(stamp); }
        }

        double distanceFromOrigin() {
            // OPTIMISTIC: try to read without locking
            long stamp = lock.tryOptimisticRead();
            double cx = x, cy = y;                  // read the data
            if (!lock.validate(stamp)) {             // was there a write during our read?
                // A write happened -> fall back to a real read lock
                stamp = lock.readLock();
                try { cx = x; cy = y; }
                finally { lock.unlockRead(stamp); }
            }
            return Math.sqrt(cx * cx + cy * cy);
        }
    }

    public static void main(String[] args) throws InterruptedException {
        Point point = new Point();
        LongAdder reads = new LongAdder(), writes = new LongAdder(), retries = new LongAdder();

        ExecutorService pool = Executors.newFixedThreadPool(8);

        // Many readers, few writers — the scenario where StampedLock shines
        for (int i = 0; i < 7; i++) pool.submit(() -> {
            for (int j = 0; j < 10000; j++) {
                point.distanceFromOrigin(); reads.increment();
            }
        });
        pool.submit(() -> {
            for (int j = 0; j < 100; j++) {
                point.move(1, 1); writes.increment();
                try { Thread.sleep(1); } catch (InterruptedException e) {}
            }
        });

        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
        System.out.printf("Reads=%,d  Writes=%d%n", reads.sum(), writes.sum());
        System.out.println("Point distance: " + point.distanceFromOrigin());
        System.out.println("\\nWhen to use StampedLock:");
        System.out.println("  - Read : write ratio >> 100:1 (cache-like data)");
        System.out.println("  - Short read critical sections (copy values, not compute)");
        System.out.println("When NOT to use:");
        System.out.println("  - StampedLock is NOT reentrant (a thread cannot re-acquire its own lock)");
        System.out.println("  - Complex read sections where optimistic retry is expensive");
    }
}`
        }
      ],
      flashcards: [
        { q: 'Why avoid Executors.newFixedThreadPool for untrusted load?', a: 'It uses an unbounded LinkedBlockingQueue; tasks pile up without backpressure and can exhaust memory. Configure ThreadPoolExecutor with a bounded queue and a rejection policy instead.' },
        { q: 'Name the four conditions for deadlock and one way to break it.', a: 'Mutual exclusion, hold-and-wait, no preemption, circular wait. Break it by imposing a global lock-acquisition order (or using tryLock with timeout).' },
        { q: 'When prefer ReentrantLock over synchronized?', a: 'When you need tryLock/timeouts, interruptible acquisition, fairness, or multiple Condition objects. Otherwise synchronized is simpler and now comparably fast.' },
        { q: 'How do you size a thread pool?', a: 'CPU-bound ≈ number of cores (±1). I/O-bound ≈ cores × (1 + wait time / compute time). Measure under real load; or sidestep sizing with virtual threads for blocking I/O.' },
        { q: 'Why LongAdder over AtomicInteger under high contention?', a: 'LongAdder spreads updates across multiple cells to reduce CAS contention, trading exact instantaneous reads for far higher write throughput.' },
        { q: 'What is the optimistic read pattern with StampedLock and when does it help?', a: 'tryOptimisticRead() returns a stamp without locking; you read the data, then validate(stamp) checks if a write occurred. If valid, no lock was ever acquired. If invalid, fall back to readLock(). Helps when reads are >>100x more frequent than writes, eliminating read-lock overhead.' },
        { q: 'What provides backpressure in a producer-consumer queue?', a: 'A bounded BlockingQueue (e.g. LinkedBlockingQueue(capacity)). When the queue is full, producer.put() blocks until a consumer takes an item, naturally slowing the producer to match consumer throughput instead of growing the queue without bound.' },
        { q: 'How does CompletableFuture.allOf work and what does it return?', a: 'allOf(cf1, cf2, ...) returns a CompletableFuture<Void> that completes when all given futures complete. It does NOT aggregate results — you must call .join() on each individual future afterward to retrieve their values. Combine with thenApply to collect results.' },
        { q: 'What is the difference between thenApply and thenCompose on CompletableFuture?', a: 'thenApply maps the result synchronously (like Stream.map): takes T, returns U. thenCompose chains an async operation (like Stream.flatMap): takes T, returns CompletableFuture<U>. Use thenCompose when the next step is itself async to avoid nested CompletableFuture<CompletableFuture<U>>.' }
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
        },
        {
          lang: 'java',
          title: 'Custom Collector and infinite streams',
          code: `import java.util.*;
import java.util.stream.*;
import java.util.function.*;

public class AdvancedStreamsDemo {

    // 1. Custom Collector: collect into an ImmutableMap (demonstrating Collector anatomy)
    // A Collector has: supplier (creates accumulator), accumulator (folds element in),
    // combiner (merges two accumulators for parallel), finisher (transforms accumulator to result).
    static <K, V> Collector<Map.Entry<K,V>, Map<K,V>, Map<K,V>> toUnmodifiableMap() {
        return Collector.of(
            HashMap::new,                                          // supplier
            (map, e) -> map.put(e.getKey(), e.getValue()),        // accumulator
            (m1, m2) -> { m1.putAll(m2); return m1; },           // combiner (parallel)
            Collections::unmodifiableMap                          // finisher
        );
    }

    // 2. Infinite streams: generate and iterate
    static void infiniteStreams() {
        // Fibonacci sequence — infinite, lazy: nothing is computed until terminal op
        Stream<long[]> fibs = Stream.iterate(
            new long[]{0, 1},
            pair -> new long[]{pair[1], pair[0] + pair[1]}
        );
        List<Long> first10 = fibs.limit(10)
                                 .map(p -> p[0])
                                 .collect(Collectors.toList());
        System.out.println("First 10 Fibonacci: " + first10);

        // Random numbers until we get one > 0.99
        OptionalDouble rare = DoubleStream.generate(Math::random)
                                          .filter(x -> x > 0.99)
                                          .findFirst();
        System.out.printf("First random > 0.99: %.4f%n", rare.getAsDouble());

        // Primes via an infinite stream (Sieve is better for large N, but elegant demo)
        List<Integer> primes = IntStream.iterate(2, n -> n + 1)
            .filter(n -> IntStream.rangeClosed(2, (int)Math.sqrt(n)).allMatch(d -> n % d != 0))
            .limit(15)
            .boxed()
            .collect(Collectors.toList());
        System.out.println("First 15 primes: " + primes);
    }

    // 3. flatMap: flattening nested structures
    static void flatMapDemo() {
        List<List<Integer>> nested = List.of(List.of(1,2,3), List.of(4,5), List.of(6,7,8,9));
        List<Integer> flat = nested.stream()
                                   .flatMap(Collection::stream)
                                   .sorted()
                                   .collect(Collectors.toList());
        System.out.println("flatMap nested: " + flat);

        // Practical: all words in all sentences
        List<String> sentences = List.of("hello world", "java streams are cool");
        long uniqueWords = sentences.stream()
                                    .flatMap(s -> Arrays.stream(s.split(" ")))
                                    .distinct()
                                    .count();
        System.out.println("Unique words: " + uniqueWords);
    }

    public static void main(String[] args) {
        infiniteStreams();
        flatMapDemo();

        // Multi-level grouping: dept -> senior/junior -> list of names
        record Person(String name, String dept, int yoe) {}
        List<Person> people = List.of(
            new Person("Ana","ENG",8), new Person("Ben","ENG",2),
            new Person("Cara","HR",5), new Person("Dan","ENG",10), new Person("Eve","HR",1)
        );
        Map<String, Map<String, List<String>>> grouped = people.stream()
            .collect(Collectors.groupingBy(Person::dept,
                     Collectors.groupingBy(p -> p.yoe() >= 5 ? "senior" : "junior",
                     Collectors.mapping(Person::name, Collectors.toList()))));
        System.out.println("Multi-level grouping: " + grouped);
    }
}`
        },
        {
          lang: 'java',
          title: 'Stream performance: when parallel helps and when it hurts',
          code: `import java.util.*;
import java.util.stream.*;
import java.util.concurrent.ForkJoinPool;

public class StreamPerformanceDemo {
    // ✅ Good candidate for parallel: large array, CPU-bound, stateless, no ordering needed
    static long sumLargeArray(boolean parallel) {
        int[] data = IntStream.rangeClosed(1, 10_000_000).toArray();
        IntStream s = Arrays.stream(data);
        if (parallel) s = s.parallel();
        return s.filter(n -> n % 2 == 0).mapToLong(n -> (long) n * n).sum();
    }

    // ❌ Bad candidate for parallel: small data (overhead dominates)
    static List<String> processSmall(boolean parallel) {
        List<String> names = List.of("Ana","Ben","Cara","Dan","Eve");
        Stream<String> s = names.stream();
        if (parallel) s = s.parallel();
        return s.map(String::toUpperCase).collect(Collectors.toList());
    }

    // ❌ Bad candidate for parallel: ordered operation with LinkedList (poor splittability)
    // LinkedList splits into halves recursively in O(n) — no benefit from parallel

    public static void main(String[] args) {
        System.out.println("=== Large CPU-bound sum ===");
        long t1 = System.nanoTime();
        long r1 = sumLargeArray(false);
        long seqMs = (System.nanoTime() - t1) / 1_000_000;

        long t2 = System.nanoTime();
        long r2 = sumLargeArray(true);
        long parMs = (System.nanoTime() - t2) / 1_000_000;

        System.out.printf("Sequential: %dms  Parallel: %dms  (result=%d)%n", seqMs, parMs, r1);
        System.out.println("Parallel speedup: " + seqMs / Math.max(parMs, 1) + "x (up to #cores)");

        System.out.println("\\n=== Small list ===");
        long t3 = System.nanoTime();
        processSmall(false);
        long s1 = System.nanoTime() - t3;
        long t4 = System.nanoTime();
        processSmall(true);
        long s2 = System.nanoTime() - t4;
        System.out.printf("Sequential: %dns  Parallel: %dns — parallel is SLOWER for 5 elements%n", s1, s2);

        System.out.println("\\nParallel stream uses the COMMON ForkJoinPool (shared by all parallel streams).");
        System.out.println("A slow parallel stream blocks ALL parallel computation in the JVM.");
        System.out.println("Custom pool workaround: pool.submit(() -> stream.parallel()...).get()");

        System.out.println("\\nDecision guide:");
        System.out.println("  dataset >> 10k elements AND CPU-bound AND stateless AND splittable -> try parallel");
        System.out.println("  contains I/O / shared state / ordering / small data -> sequential");
        System.out.println("  ALWAYS measure: .parallel() on the wrong stream is a pessimisation");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is lazy evaluation in streams?', a: 'Intermediate operations build a pipeline but execute nothing until a terminal operation runs, enabling fusion and short-circuiting (e.g., findFirst stops early).' },
        { q: 'When do parallel streams actually help?', a: 'Large, CPU-bound, easily splittable datasets with stateless, side-effect-free operations. They hurt for small/IO-bound/ordered/stateful work and share the common ForkJoinPool.' },
        { q: 'Proper Optional usage?', a: 'Use as a return type; chain map/flatMap/filter; resolve with orElseGet/orElseThrow. Avoid Optional.get() without a presence check and don\'t use it for fields or parameters.' },
        { q: 'Can a stream be reused after a terminal operation?', a: 'No — streams are single-use. After a terminal op the stream is consumed; reusing it throws IllegalStateException. Create a new stream from the source.' },
        { q: 'What does flatMap do and when do you use it?', a: 'flatMap maps each element to a Stream and flattens the resulting streams into one. Use it when each element produces zero or more output elements (e.g. splitting sentences to words, expanding nested lists). It is Stream\'s equivalent of list monad bind.' },
        { q: 'What are the four components of a custom Collector?', a: 'Supplier (creates the mutable accumulator container), Accumulator (folds a single element into the container), Combiner (merges two containers for parallel execution), Finisher (transforms the final container to the result type).' },
        { q: 'Why does parallel stream performance depend on the data source\'s Spliterator?', a: 'Parallel streams split the source recursively for parallel processing. Arrays and ArrayList split in O(1) (index arithmetic). LinkedList, IO streams, and custom iterators split poorly (O(n) or sequential only) — no parallelism benefit. Always consider the source\'s splittability before adding .parallel().' }
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
        },
        {
          lang: 'sql',
          title: 'CTEs, recursive queries, and practical patterns',
          code: `-- CTEs (Common Table Expressions) make complex queries readable and reusable.
-- They are NOT materialized by default in Postgres (optimizer can inline them).

-- 1. Simple CTE: name intermediate results for clarity
WITH
recent_orders AS (
    SELECT customer_id, SUM(total) AS order_total
    FROM   orders
    WHERE  created_at > NOW() - INTERVAL '30 days'
    GROUP  BY customer_id
),
customers_with_totals AS (
    SELECT c.id, c.name, c.email, COALESCE(ro.order_total, 0) AS recent_total
    FROM   customer c
    LEFT   JOIN recent_orders ro ON c.id = ro.customer_id
)
SELECT * FROM customers_with_totals WHERE recent_total > 1000 ORDER BY recent_total DESC;

-- 2. Recursive CTE: employee hierarchy (org chart)
WITH RECURSIVE org_tree AS (
    -- Base case: top-level employees (no manager)
    SELECT id, name, manager_id, 1 AS depth, name AS path
    FROM   employee
    WHERE  manager_id IS NULL

    UNION ALL

    -- Recursive case: employees reporting to someone already in the tree
    SELECT e.id, e.name, e.manager_id, ot.depth + 1, ot.path || ' -> ' || e.name
    FROM   employee e
    JOIN   org_tree ot ON e.manager_id = ot.id
)
SELECT depth, path FROM org_tree ORDER BY path;

-- 3. De-duplicate: keep one row per group (common data-cleaning task)
-- Strategy: number rows within each group, keep row_number = 1
WITH numbered AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
    FROM   user_signups
)
DELETE FROM user_signups
WHERE  id IN (SELECT id FROM numbered WHERE rn > 1);  -- remove all but the most recent

-- 4. Gap-and-island problem: find consecutive date ranges
WITH gaps AS (
    SELECT date,
           date - (ROW_NUMBER() OVER (ORDER BY date))::int AS island_id
    FROM   active_days
)
SELECT MIN(date) AS start_date, MAX(date) AS end_date, COUNT(*) AS days
FROM   gaps
GROUP  BY island_id
ORDER  BY start_date;`
        },
        {
          lang: 'java',
          title: 'SQL in Java: PreparedStatement, ResultSet, and N+1 detection',
          code: `import java.sql.*;
import java.util.*;

// Core JDBC patterns every backend engineer must know — the foundation under all ORMs.
public class JdbcPatternsDemo {

    // ✅ ALWAYS use PreparedStatement — never string concatenation (SQL injection!)
    static List<Map<String, Object>> findOrders(Connection conn, long customerId, String status)
            throws SQLException {
        String sql = "SELECT id, total, status, created_at FROM orders " +
                     "WHERE customer_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50";

        List<Map<String, Object>> results = new ArrayList<>();
        // try-with-resources ensures stmt + rs are closed even on exception
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, customerId);   // position 1 corresponds to first ?
            stmt.setString(2, status);     // position 2 = second ?

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",         rs.getLong("id"));
                    row.put("total",      rs.getBigDecimal("total"));
                    row.put("status",     rs.getString("status"));
                    row.put("created_at", rs.getTimestamp("created_at").toLocalDateTime());
                    results.add(row);
                }
            }
        }
        return results;
    }

    // N+1 detection at the JDBC layer: count queries per request
    static class QueryCountingDataSource {
        private int queryCount = 0;
        void beforeQuery(String sql) { queryCount++; }
        int getCount() { return queryCount; }
        void reset() { queryCount = 0; }
    }

    // Batch insert: much faster than individual INSERTs for bulk operations
    static void batchInsert(Connection conn, List<String> emails) throws SQLException {
        String sql = "INSERT INTO newsletter_subscriber (email, created_at) VALUES (?, NOW())";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            conn.setAutoCommit(false);          // wrap batch in one transaction
            for (String email : emails) {
                stmt.setString(1, email);
                stmt.addBatch();                // queue up — no DB round-trip yet
            }
            int[] counts = stmt.executeBatch(); // ONE round-trip for all rows
            conn.commit();
            System.out.println("Inserted " + counts.length + " rows in one batch");
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        }
    }

    public static void main(String[] args) {
        System.out.println("JDBC golden rules:");
        System.out.println("  1. Always use PreparedStatement (never string concat)");
        System.out.println("  2. try-with-resources for Connection/Statement/ResultSet");
        System.out.println("  3. Use connection pools (HikariCP) — never create new Connection per query");
        System.out.println("  4. Batch inserts/updates for bulk operations (addBatch/executeBatch)");
        System.out.println("  5. Set query timeout: stmt.setQueryTimeout(10) in seconds");
        System.out.println("  6. Log slow queries: datasource-proxy or p6spy in dev");
        System.out.println();
        System.out.println("N+1 detection in production:");
        System.out.println("  Enable: spring.jpa.show-sql=true OR use datasource-proxy");
        System.out.println("  Count queries per HTTP request — if count grows with result size -> N+1");
        System.out.println("  Fix: JOIN FETCH, @EntityGraph, or batch loading");
    }
}`
        }
      ],
      flashcards: [
        { q: 'Difference between WHERE and HAVING?', a: 'WHERE filters individual rows before aggregation; HAVING filters groups after GROUP BY aggregation. You can reference aggregate functions in HAVING but not in WHERE.' },
        { q: 'How do window functions differ from GROUP BY?', a: 'Window functions compute a value across a set of related rows (a "window") while preserving each individual row, whereas GROUP BY collapses rows into one per group.' },
        { q: 'How do you get the top N rows per group?', a: 'Use ROW_NUMBER() OVER (PARTITION BY group_col ORDER BY sort_col) in a subquery, then filter WHERE row_number <= N.' },
        { q: 'What is the logical execution order of a SELECT?', a: 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. This is why SELECT aliases aren\'t visible in WHERE/GROUP BY.' },
        { q: 'What is a CTE and how does it differ from a subquery?', a: 'A CTE (WITH clause) names a result set and can be referenced multiple times in the same query, improving readability. It can also be recursive. In PostgreSQL, CTEs are generally not materialized (optimizer inlines them) unless WITH MATERIALIZED is specified.' },
        { q: 'How do you write a recursive SQL query? Give a use case.', a: 'WITH RECURSIVE cte AS ( base_case UNION ALL recursive_case JOIN cte ... ) SELECT from cte. Use cases: org chart traversal, bill of materials, file system tree, consecutive date ranges (gap-and-island).' },
        { q: 'Why must you always use PreparedStatement and never string concatenation?', a: 'String concatenation of user input creates SQL injection vulnerability — an attacker can inject arbitrary SQL (e.g. OR 1=1; DROP TABLE). PreparedStatement parameterizes the query; the driver escapes parameters, making injection structurally impossible.' },
        { q: 'What is batch insert and when does it matter?', a: 'Batching groups multiple INSERT statements into a single database round-trip (addBatch()/executeBatch()). For bulk inserts of 100+ rows, batch inserts are 10-100x faster than individual INSERTs because they eliminate per-statement round-trip latency and can use optimized server-side bulk paths.' }
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
        },
        {
          lang: 'java',
          title: 'Dead Letter Queue (DLQ) pattern for Kafka error handling',
          code: `import java.util.*;

// When a Kafka consumer fails to process a message (parse error, downstream down),
// retrying forever blocks the partition. The DLQ pattern sends failed messages
// to a separate "dead letter" topic for manual review / replay.
public class KafkaDlqDemo {

    record KafkaMessage(String topic, int partition, long offset, String key, String payload) {}

    interface KafkaProducer {
        void send(String topic, String key, String payload);
    }

    static class OrderConsumer {
        private final KafkaProducer producer;
        private final int MAX_RETRIES = 3;

        OrderConsumer(KafkaProducer producer) { this.producer = producer; }

        void processWithDlq(KafkaMessage msg) {
            int attempt = 0;
            Exception lastError = null;

            while (attempt < MAX_RETRIES) {
                try {
                    processOrder(msg.payload());
                    System.out.println("[OK] Processed: " + msg.key() + " offset=" + msg.offset());
                    return;  // success — commit offset
                } catch (Exception e) {
                    lastError = e;
                    attempt++;
                    System.out.printf("[RETRY %d/%d] %s: %s%n", attempt, MAX_RETRIES, msg.key(), e.getMessage());
                    // Exponential backoff between retries (for transient errors)
                    try { Thread.sleep(100L * (1L << attempt)); } catch (InterruptedException ie) { break; }
                }
            }

            // Retries exhausted: send to DLQ topic for human review
            String dlqPayload = String.format(
                "{\"original\":%s,\"error\":\"%s\",\"topic\":\"%s\",\"partition\":%d,\"offset\":%d}",
                msg.payload(), lastError.getMessage(), msg.topic(), msg.partition(), msg.offset()
            );
            producer.send("orders.DLQ", msg.key(), dlqPayload);
            System.out.println("[DLQ] Sent to dead letter: " + msg.key());
            // Still commit the offset — we don't block the partition for a poison pill
        }

        void processOrder(String payload) {
            // Simulate: some messages are "poison pills" (permanently bad)
            if (payload.contains("INVALID")) throw new RuntimeException("invalid order format");
            System.out.println("  -> Order processed: " + payload);
        }
    }

    public static void main(String[] args) throws InterruptedException {
        List<String> dlqMessages = new ArrayList<>();
        KafkaProducer mockProducer = (topic, key, payload) -> {
            if (topic.endsWith("DLQ")) dlqMessages.add(key + ":" + payload);
        };

        OrderConsumer consumer = new OrderConsumer(mockProducer);
        consumer.processWithDlq(new KafkaMessage("orders", 0, 1L, "order-1", "{\"id\":1,\"total\":100}"));
        consumer.processWithDlq(new KafkaMessage("orders", 0, 2L, "order-2", "INVALID_DATA"));
        consumer.processWithDlq(new KafkaMessage("orders", 0, 3L, "order-3", "{\"id\":3,\"total\":200}"));

        System.out.println("\nDLQ messages: " + dlqMessages.size());
        System.out.println("\nDLQ replay: when the bug is fixed, replay the DLQ topic to reprocess");
        System.out.println("In Spring Kafka: @DltHandler / SeekToCurrentErrorHandler / DeadLetterPublishingRecoverer");
    }
}`
        },
        {
          lang: 'java',
          title: 'Kafka consumer group & partition assignment simulation',
          code: `import java.util.*;
import java.util.stream.*;

// Models how Kafka distributes partitions across a consumer group.
// Rule: each partition is consumed by EXACTLY ONE consumer in a group.
// Parallelism ceiling = number of partitions.
public class KafkaConsumerGroupDemo {

    record Partition(String topic, int id) {}
    record Consumer(String id, List<Partition> assigned) {}

    // Range assignor: divides sorted partitions evenly across sorted consumers
    static List<Consumer> rangeAssign(String topic, int partitionCount, List<String> consumerIds) {
        List<Partition> partitions = IntStream.range(0, partitionCount)
            .mapToObj(i -> new Partition(topic, i))
            .collect(Collectors.toList());

        List<String> sorted = consumerIds.stream().sorted().collect(Collectors.toList());
        List<Consumer> consumers = sorted.stream()
            .map(id -> new Consumer(id, new ArrayList<>()))
            .collect(Collectors.toList());

        // Distribute partitions round-robin style (simplified range assignor)
        for (int i = 0; i < partitions.size(); i++) {
            consumers.get(i % consumers.size()).assigned().add(partitions.get(i));
        }
        return consumers;
    }

    static void printAssignment(List<Consumer> consumers) {
        consumers.forEach(c -> {
            List<Integer> pIds = c.assigned().stream().map(Partition::id).collect(Collectors.toList());
            System.out.printf("  Consumer %-10s -> partitions %s%n", c.id(), pIds);
        });
    }

    public static void main(String[] args) {
        System.out.println("=== 6 partitions, 3 consumers (ideal: 2 each) ===");
        printAssignment(rangeAssign("orders", 6, List.of("C1","C2","C3")));

        System.out.println("\n=== 6 partitions, 2 consumers (3 each) ===");
        printAssignment(rangeAssign("orders", 6, List.of("C1","C2")));

        System.out.println("\n=== 6 partitions, 8 consumers (2 idle!) ===");
        List<Consumer> over = rangeAssign("orders", 6, List.of("C1","C2","C3","C4","C5","C6","C7","C8"));
        printAssignment(over);
        long idle = over.stream().filter(c -> c.assigned().isEmpty()).count();
        System.out.println("  Idle consumers: " + idle + " (adding consumers beyond partition count is wasteful)");

        System.out.println("\n=== After consumer C2 dies -> REBALANCE ===");
        printAssignment(rangeAssign("orders", 6, List.of("C1","C3"))); // C2 removed
        System.out.println("  Rebalance: all consumers stop, coordinator reassigns, all resume");
        System.out.println("  During rebalance: no messages consumed! Design for it (idempotency)");
    }
}`
        }
      ],
      flashcards: [
        { q: 'How does Kafka guarantee message ordering?', a: 'Order is guaranteed only within a single partition. To keep an entity\'s events ordered, produce them with the entity id as the message key so they hash to the same partition.' },
        { q: 'What determines Kafka consumer parallelism?', a: 'The number of partitions. Within a consumer group each partition is consumed by exactly one consumer, so you cannot have more active consumers than partitions.' },
        { q: 'Why is end-to-end exactly-once usually replaced by at-least-once + idempotent consumers?', a: 'True exactly-once across external systems (DB/APIs) is impractical. The pragmatic design is at-least-once delivery with consumers that dedupe on a business key or track processed offsets, making reprocessing safe.' },
        { q: 'Kafka vs RabbitMQ — when each?', a: 'Kafka: a durable, partitioned, replayable log for high-throughput event streaming, event sourcing, and analytics. RabbitMQ: a broker with flexible routing, per-message acks, and priorities for task queues and RPC.' },
        { q: 'What enables replay in Kafka?', a: 'Messages are retained by time/size independent of consumption, and consumers track offsets, so a consumer can reset its offset and reprocess from any point (e.g. offset 0) to rebuild state.' },
        { q: 'What is a Dead Letter Queue (DLQ) in Kafka and when do you use it?', a: 'A DLQ is a separate topic where messages that fail processing after N retries are sent instead of blocking the partition. It prevents a single "poison pill" message from halting all downstream processing. Messages are manually inspected and replayed after the bug is fixed.' },
        { q: 'What happens during a Kafka consumer group rebalance?', a: 'All consumers in the group stop processing, the group coordinator reassigns partitions (using a configured assignor like Range or CooperativeSticky), then consumers resume. During rebalance no messages are consumed. CooperativeSticky rebalancing (Kafka 2.4+) minimizes the disruption by only moving partitions that need to move.' },
        { q: 'What is the ISR (In-Sync Replica) and why does it matter for durability?', a: 'The ISR is the set of replicas fully caught up with the leader. With acks=all, the producer waits for all ISR replicas to acknowledge the write, ensuring the message survives a leader failure. min.insync.replicas controls how many ISR replicas must ack before the write is accepted.' }
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

/* ===================== PHASE 11: Real-World Architecture ===================== */
{
  id: 'p11',
  title: 'Real-World Java Backend Architecture',
  icon: 'layers',
  blurb: 'How production Spring Boot systems are actually built, deployed, and operated — modelled on a real trading platform. Zero to production.',
  modules: [
    {
      id: '11.1',
      title: 'Multi-Module Maven Monolith Design',
      hours: 5,
      notes: `
# Multi-Module Maven Monolith Design

The most important architectural decision for a new backend is **not** microservices vs monolith — it is **how you enforce module boundaries** so the system can evolve without becoming a big ball of mud.

## Why start with a modular monolith

A modular monolith gives you:
- Single deployable unit (simple ops, fast CI)
- In-process calls (no network latency, no serialization cost)
- Real transactional guarantees across modules
- Can extract to microservices later by cutting along module seams

The key is that modules are **enforced by Maven**, not just convention: module A cannot import module B unless B is a declared dependency. If you leave everything in one Maven module, "modular" is a lie — anyone can import anything.

## The module graph (strict acyclic)

\`\`\`
core ← broker ← engine ← web ← app (runnable jar)
       └─ ai  ←┘
       └─ news ←┘
\`\`\`

- **core** — domain models, enums, shared config properties. No Spring, no DB, no external libs. Any module can depend on core.
- **broker** — adapter interfaces + implementations for stock brokers/exchanges. Knows core; knows nothing of engine.
- **ai** — LLM API clients. Knows core.
- **news** — RSS/news aggregation. Knows core.
- **engine** — business logic: risk, orders, journal, analytics. Knows core + broker + ai + news.
- **web** — REST controllers, dashboard. Knows engine.
- **app** — bootstraps everything: Spring Boot main class, Flyway migrations, scheduler config.

> [!TIP]
> The strict downward dependency rule means **business logic never depends on HTTP**. If you need to extract a module to a service later, you just add a thin REST adapter — the logic doesn't change. This also makes unit testing trivial: no Spring context needed for core/engine tests.

## Parent POM structure

\`\`\`xml
<!-- pom.xml (root parent) -->
<groupId>com.example</groupId>
<artifactId>myapp-parent</artifactId>
<packaging>pom</packaging>
<modules>
  <module>core</module>
  <module>broker</module>
  <module>ai</module>
  <module>engine</module>
  <module>web</module>
  <module>app</module>
</modules>
<dependencyManagement>
  <!-- BOM: all versions declared here, child modules just name the artifact -->
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>\${spring-boot.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
\`\`\`

Each child module declares only the **siblings it needs** — enforcing the graph:

\`\`\`xml
<!-- engine/pom.xml -->
<dependencies>
  <dependency><groupId>com.example</groupId><artifactId>core</artifactId></dependency>
  <dependency><groupId>com.example</groupId><artifactId>broker</artifactId></dependency>
  <dependency><groupId>com.example</groupId><artifactId>ai</artifactId></dependency>
</dependencies>
\`\`\`

If engine tried to import web classes, Maven would fail the build. **The build is the architecture enforcer.**

## The shared kernel (core module)

Core should contain only:
- **Domain value objects**: \`Money\`, \`OrderId\`, \`Symbol\`, \`Side\` (BUY/SELL)
- **Domain events**: \`OrderPlaced\`, \`TradeExecuted\`
- **Enums and constants** shared across modules
- **Config properties** interfaces (\`@ConfigurationProperties\` POJOs)
- No Spring beans, no DB, no Jackson (just plain Java)

> [!WARNING]
> The temptation is to throw everything into core "for convenience." Resist it. Every class in core is a dependency of every other module — a poorly-placed class in core creates hidden coupling across the entire system. If something is only needed by two adjacent modules, put it in the higher one.

## The app (runnable jar) module

The app module's job is assembly:
- \`@SpringBootApplication\` lives here
- Flyway migrations in \`src/main/resources/db/migration/\`
- \`application.yml\` and profile configs
- \`@EnableScheduling\`, \`@EnableAsync\`, \`@EnableCaching\`
- Docker / deployment config

**It contains almost no business logic.** If you find yourself writing business code in app, something is in the wrong module.

## Testing across modules

- **core, ai, news**: pure JUnit 5, no Spring
- **engine**: JUnit 5 + Mockito for broker/AI collaborators
- **web**: \`@WebMvcTest\` (loads only the web slice)
- **Integration/E2E**: only in app module (has all deps)

This layering means CI can test core/engine/ai in parallel and fast, without a database.

> [!EU]
> Senior EU interviews increasingly probe *how* you structure large codebases. "We started with a modular monolith with strict Maven-enforced boundaries. Module A could never accidentally import module B unless declared as a dependency — this prevented the big-ball-of-mud anti-pattern and gave us clean seams to extract services later." This shows architectural maturity.
`,
      code: [
        {
          lang: 'java',
          title: 'Enforcing module boundaries — the shared kernel pattern',
          code: `// core module: pure Java, no Spring, no DB
// com.example.core.domain.Money
public record Money(long minorUnits, String currency) {
    public Money {
        if (minorUnits < 0) throw new IllegalArgumentException("negative money");
        if (currency == null || currency.isBlank()) throw new IllegalArgumentException("currency required");
    }

    public Money add(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
        return new Money(minorUnits + other.minorUnits, currency);
    }

    public Money multiply(int factor) { return new Money(minorUnits * factor, currency); }

    @Override public String toString() {
        return String.format("%s %.2f", currency, minorUnits / 100.0);
    }

    public static Money of(double amount, String currency) {
        return new Money(Math.round(amount * 100), currency);
    }
}

// com.example.core.domain.OrderSide
public enum OrderSide { BUY, SELL }

// com.example.core.domain.OrderRequest
public record OrderRequest(
    String symbol,
    OrderSide side,
    int quantity,
    Money limitPrice  // null for market orders
) {
    public OrderRequest {
        if (symbol == null || symbol.isBlank()) throw new IllegalArgumentException("symbol required");
        if (quantity <= 0) throw new IllegalArgumentException("quantity must be positive");
    }
    public boolean isMarket() { return limitPrice == null; }
}

// engine module: depends on core, broker, ai — NOT on web
// com.example.engine.OrderExecutionService
// @Service  (Spring bean but pure business logic, testable without HTTP)
class OrderExecutionService {
    private final BrokerAdapter broker;       // interface from broker module
    private final RiskService riskService;

    OrderExecutionService(BrokerAdapter broker, RiskService riskService) {
        this.broker = broker;
        this.riskService = riskService;
    }

    public String placeOrder(OrderRequest req) {
        riskService.validate(req);             // throws if breaches risk limits
        return broker.submitOrder(req);        // broker-specific; paper/Upstox/Dhan
    }
}

// web module: knows engine, NOT business logic
// com.example.web.OrderController
// @RestController — this is the only place HTTP concepts live
class OrderController {
    private final OrderExecutionService execService;
    OrderController(OrderExecutionService execService) { this.execService = execService; }

    // @PostMapping("/api/v1/orders")
    String placeOrder(/* @RequestBody */ OrderRequest req) {
        return execService.placeOrder(req);    // delegate everything; no logic here
    }
}

// Demo: test engine independently — no Spring, no HTTP, no DB
public class ModuleArchDemo {
    public static void main(String[] args) {
        // Pure unit test of business logic — no container needed
        BrokerAdapter paperBroker = req -> "PAPER-ORDER-" + req.symbol() + "-" + req.quantity();
        RiskService risk = req -> {
            if (req.quantity() > 100) throw new RuntimeException("quantity exceeds limit");
        };
        var svc = new OrderExecutionService(paperBroker, risk);
        String id = svc.placeOrder(new OrderRequest("NIFTY24DEC20000CE", OrderSide.BUY, 1,
                                                     Money.of(150.0, "INR")));
        System.out.println("Order placed: " + id);

        // The module boundary is enforced by Maven: web cannot skip to broker directly
        System.out.println("Money demo: " + Money.of(100.50, "EUR").add(Money.of(49.50, "EUR")));
    }

    interface BrokerAdapter { String submitOrder(OrderRequest req); }
    interface RiskService   { void validate(OrderRequest req); }
}`
        },
        {
          lang: 'java',
          title: 'Adapter pattern: swappable broker implementations',
          code: `import java.util.*;

// The broker module: defines the interface in core; implementations here.
// This is the adapter pattern — the engine doesn't care which broker executes the trade.
public class BrokerAdapterDemo {

    // In the broker module:
    interface BrokerAdapter {
        String submitOrder(String symbol, String side, int qty, double price);
        String getOrderStatus(String orderId);
        double getLtp(String symbol);
    }

    // Paper broker: simulates trades, no real money. Safe default.
    static class PaperBrokerAdapter implements BrokerAdapter {
        private final Map<String, String> orders = new LinkedHashMap<>();
        private int seq = 1;

        public String submitOrder(String symbol, String side, int qty, double price) {
            String id = "PAPER-" + seq++;
            orders.put(id, "COMPLETE");
            System.out.printf("[PAPER] %s %s x%d @ %.2f -> %s%n", side, symbol, qty, price, id);
            return id;
        }
        public String getOrderStatus(String id) { return orders.getOrDefault(id, "NOT_FOUND"); }
        public double getLtp(String symbol) { return 150.25 + Math.random() * 5; } // simulated
    }

    // Upstox broker: calls real REST API (simplified)
    static class UpstoxBrokerAdapter implements BrokerAdapter {
        private final String accessToken;
        UpstoxBrokerAdapter(String accessToken) { this.accessToken = accessToken; }

        public String submitOrder(String symbol, String side, int qty, double price) {
            // In reality: HTTP POST to https://api.upstox.com/v2/order/place
            System.out.printf("[UPSTOX] Calling Upstox API with token %s... %s %s x%d%n",
                              accessToken.substring(0, 8) + "...", side, symbol, qty);
            return "UPX-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
        public String getOrderStatus(String id) { return "COMPLETE"; } // simplified
        public double getLtp(String symbol) { return 150.50; }
    }

    // Per-user routing: each user selects their broker; the router dispatches correctly
    static class BrokerAdapterRouter {
        private final Map<String, BrokerAdapter> userAdapters = new HashMap<>();
        private final BrokerAdapter defaultAdapter = new PaperBrokerAdapter();

        void setUserBroker(String userId, BrokerAdapter adapter) {
            userAdapters.put(userId, adapter);
        }
        BrokerAdapter forUser(String userId) {
            return userAdapters.getOrDefault(userId, defaultAdapter);
        }
    }

    public static void main(String[] args) {
        BrokerAdapterRouter router = new BrokerAdapterRouter();

        // user1 uses paper (default — safe!)
        // user2 configured live Upstox
        router.setUserBroker("user2", new UpstoxBrokerAdapter("real-token-xyz"));

        // Engine calls router.forUser(userId).submitOrder(...)
        // It never cares which broker is behind it
        router.forUser("user1").submitOrder("NIFTY24C20000", "BUY", 1, 150.0);
        router.forUser("user2").submitOrder("NIFTY24C20000", "BUY", 1, 150.0);
        router.forUser("user3").submitOrder("NIFTY24C20000", "BUY", 1, 150.0); // defaults to paper
    }
}`
        },
        {
          lang: 'java',
          title: 'Flyway migrations: safe database evolution',
          code: `// Flyway manages DB schema evolution with versioned, checksummed SQL scripts.
// Location: app/src/main/resources/db/migration/
// Naming: V{version}__{description}.sql  (two underscores!)

// V1__create_users.sql
/*
CREATE TABLE app_user (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    role        VARCHAR(50)  NOT NULL DEFAULT 'VIEWER',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
*/

// V2__create_trade_journal.sql
/*
CREATE TABLE trade_journal (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES app_user(id),
    symbol       VARCHAR(100) NOT NULL,
    side         VARCHAR(10)  NOT NULL,    -- BUY / SELL
    quantity     INT          NOT NULL,
    entry_price  NUMERIC(12,4),
    exit_price   NUMERIC(12,4),
    broker       VARCHAR(50),             -- which broker executed this trade
    status       VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_journal_user ON trade_journal(user_id);
CREATE INDEX idx_journal_status ON trade_journal(user_id, status) WHERE status = 'OPEN';
*/

// V3__add_risk_settings.sql  (single-row config table — runtime overrides YAML)
/*
CREATE TABLE risk_settings (
    id               BIGINT PRIMARY KEY DEFAULT 1,
    max_daily_loss   NUMERIC(12,2) NOT NULL DEFAULT 5000,
    max_position_pct NUMERIC(5,2)  NOT NULL DEFAULT 10,
    trading_enabled  BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO risk_settings DEFAULT VALUES;
*/

// Safe migration rules:
// ✅ ADD columns (nullable or with DEFAULT)
// ✅ ADD tables, indexes
// ✅ UPDATE existing data in the migration
// ❌ DROP columns in use (remove code first, deploy, then drop)
// ❌ Change column type without a migration plan
// ❌ Edit an already-deployed migration (Flyway checksums will fail!)

// Demonstrating the Flyway "two-step" pattern for removing a column:
// Step 1: V10__stop_using_old_col.sql  -> code change: stop reading/writing it
// Step 2: V11__drop_old_col.sql (in the NEXT release, after Step 1 is live)
/*
ALTER TABLE trade_journal DROP COLUMN IF EXISTS legacy_notes;
*/

public class FlywayConceptDemo {
    public static void main(String[] args) {
        System.out.println("Flyway migration naming: V{n}__{desc}.sql");
        System.out.println("  V1__create_users.sql");
        System.out.println("  V2__create_trade_journal.sql");
        System.out.println("  V14__add_api_usage_log.sql");
        System.out.println();
        System.out.println("Flyway checks the checksum of applied migrations.");
        System.out.println("NEVER edit a migration that's already been applied to any env.");
        System.out.println("To fix: create a NEW migration V{n+1} that corrects the data/schema.");
        System.out.println();
        System.out.println("Local profile: set spring.flyway.enabled=false + ddl-auto=create-drop");
        System.out.println("for fast iteration without real migrations during dev.");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is a modular monolith and what makes it different from a "big ball of mud" monolith?', a: 'A modular monolith enforces module boundaries structurally (e.g. via Maven modules) so code in module A cannot access module B without a declared dependency. A ball-of-mud monolith has everything in one module where anyone can import anything — creating hidden coupling.' },
        { q: 'What belongs in the "core" module of a multi-module Spring Boot app?', a: 'Domain value objects, enums, domain events, shared config property classes (@ConfigurationProperties POJOs) — pure Java with no Spring beans, no DB, no HTTP. Every other module depends on core, so it must stay lean.' },
        { q: 'What is the role of the "app" (runnable jar) module?', a: 'Assembly only: @SpringBootApplication, Flyway migrations, application.yml, scheduling/async config. Almost no business logic — if you write business code there, it belongs in a lower module.' },
        { q: 'Why does the engine module never depend on the web module?', a: 'To keep business logic decoupled from HTTP. Engine can be tested without a web server, extracted to a separate service later, and reused by multiple frontends (REST, CLI, bot). The web module adapts HTTP calls to engine service calls — never the reverse.' },
        { q: 'What is the adapter pattern in the context of broker integrations?', a: 'A BrokerAdapter interface is defined in the broker module. Implementations (PaperAdapter, UpstoxAdapter, DhanAdapter) fulfil it. The engine depends only on the interface; swapping brokers requires no engine changes — just registering a different implementation.' },
        { q: 'What is the Flyway two-step migration pattern for removing a column?', a: 'Step 1 (current release): stop reading/writing the column in code and deploy. Step 2 (next release): add a migration that DROPs the column. This ensures no running code references the column when it is dropped — zero-downtime schema evolution.' },
        { q: 'What is the "default paper broker" safety invariant?', a: 'When a user has no broker configured, the system routes to the paper (simulated) broker by default. This prevents real-money order submission for unconfigured users — a capital-safety guarantee baked into routing, not a UI toggle.' },
        { q: 'How do you test engine-layer business logic without Spring or a database?', a: 'Pure JUnit 5 + Mockito: inject mock BrokerAdapter, RiskService, etc. No @SpringBootTest, no container startup. Fast, isolated unit tests are only possible because the module graph keeps engine free of HTTP/DB dependencies.' }
      ]
    },

    {
      id: '11.2',
      title: 'Production Infrastructure: Docker, Caddy & VPS',
      hours: 4,
      notes: `
# Production Infrastructure: Docker + Caddy + VPS

This module covers how a real production Java backend is deployed on a VPS (Hetzner/DigitalOcean) using Docker Compose, Caddy as a reverse proxy, and automated deployments. This is the actual setup used by many European startups and small product teams.

## The technology choices explained

### Why Hetzner instead of AWS?
Hetzner VPS is **10x cheaper** than AWS EC2 for equivalent CPU/RAM. A CX21 (2 vCPU, 4GB RAM) costs €4/month vs ~$40 for an equivalent AWS instance. For a product serving thousands of users, the economics are clear. Tradeoffs: less managed tooling, more ops responsibility.

### Why Docker Compose instead of Kubernetes?
K8s for a single-machine deployment is significant complexity overhead. Docker Compose gives:
- Declarative multi-container setup
- Service discovery (containers address each other by service name)
- Healthchecks and restarts
- Network isolation
- Zero learning curve for teams already using Docker

Rule of thumb: use K8s when you have **multiple VPS nodes** and need auto-scheduling across them. One or two machines → Docker Compose.

### Why Caddy instead of Nginx?
Caddy automatically provisions **Let's Encrypt TLS certificates** (HTTPS) and renews them. Zero config. With Nginx you write certbot cronjobs and reload configs. Caddy's config (the Caddyfile) is 3 lines vs 40 for Nginx for the same setup.

## Production architecture on a single VPS

\`\`\`
Internet
    |
 [Caddy :443]  ← TLS termination, auto-HTTPS, gzip
    |            ← routes by hostname
    ├─ myapp.com  → [app:8080]         # Spring Boot
    ├─ dashboard.myapp.com → [caddy serving static]
    └─ api.myapp.com → [app:8080]

[Docker network "prod-default"]
  app (Java)     - port 127.0.0.1:8080:8080 (not public!)
  postgres       - port 127.0.0.1:5432:5432 (not public!)
  redis          - port 127.0.0.1:6379:6379 (not public!)
  caddy          - ports 80:80, 443:443 (public — the only entry point)
\`\`\`

**Key principle:** only Caddy is exposed to the internet. App and database ports are bound to \`127.0.0.1\` only — not \`0.0.0.0\`. A firewall rule only allows 80/443/22.

## Docker Compose for multi-service setup

\`\`\`yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"    # NOT 0.0.0.0 — internal only!
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_URL: jdbc:postgresql://postgres:5432/myapp   # service name DNS
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data   # persist across container restarts!
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER} -d myapp"]
      interval: 10s
      retries: 5
    ports:
      - "127.0.0.1:5432:5432"

volumes:
  pgdata:                              # named volume: survives container recreation
\`\`\`

> [!WARNING]
> **Never put secrets in docker-compose.yml** (committed to git). Use a **\`.env\`** file (gitignored, chmod 600) in the same directory. Docker Compose reads it automatically. On the VPS: \`cp .env.example .env && nano .env\`. Only copy .env.example to git.

## The Caddyfile (auto-HTTPS in 4 lines)

\`\`\`
myapp.com {
    encode gzip
    reverse_proxy app:8080
}
\`\`\`

That's the entire config. Caddy fetches a Let's Encrypt cert for \`myapp.com\`, renews it automatically, terminates TLS, gzips responses, and proxies to the app container. Adding a second domain is two more lines.

## Push-to-deploy with a systemd timer

Instead of GitHub Actions (which needs secrets and external network), a systemd timer on the VPS polls git every minute:

\`\`\`bash
# /root/auto-pull.sh
cd /root/myapp
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  git reset --hard origin/main
  docker compose up -d --build
  docker image prune -f
  echo "Deployed at $(date)" >> deploy.log
fi
\`\`\`

Timer fires every minute, redeploys only when there's a new commit. **No secrets needed, no GitHub Actions, no manual SSH.**

> [!TIP]
> The combination of Docker Compose + Caddy + systemd timer is the **simplest possible production setup** for a Java backend. Learn it deeply — you will use this or something equivalent at most startups and scale-ups. It handles production load for hundreds of thousands of users before you need to think about Kubernetes.

## Monitoring a single-VPS production app

- **Caddy logs** — structured JSON access logs; tail -f for real-time
- **Docker logs** — \`docker compose logs -f app\`
- **Spring Boot Actuator** — \`/actuator/health\`, \`/actuator/metrics\`, \`/actuator/prometheus\`
- **Host metrics** — \`htop\`, \`df -h\`, \`free -h\`
- **Alerting** — send a Telegram message from a scheduled Spring task or a simple cron script

> [!EU]
> EU interviewers at seed/Series A companies will ask: *"How did you deploy and operate your previous product?"* "We used Docker Compose on a Hetzner VPS with Caddy for TLS, automated deploys via a systemd git-poll timer, and Actuator + Telegram alerts for monitoring" is a **solid, pragmatic answer** that shows real ops experience — more valuable than "we used AWS EKS with Helm" which often means "our platform team did it."
`,
      code: [
        {
          lang: 'bash',
          title: 'Complete VPS setup from scratch (annotated)',
          code: `#!/usr/bin/env bash
# --- Day-1 VPS setup: security hardening, Docker, Caddy ---

# 1. Secure SSH: disable password auth (keys only)
echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
systemctl restart sshd

# 2. Firewall: only allow SSH(22), HTTP(80), HTTPS(443)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 3. Install Docker (one-liner from docs.docker.com)
curl -fsSL https://get.docker.com | sh

# 4. Install Caddy (Debian/Ubuntu)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y

# 5. Clone the app
git clone https://github.com/yourorg/myapp.git /root/myapp
cd /root/myapp
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
# Edit .env with real secrets:  nano deploy/.env

# 6. Start everything
docker compose -f deploy/docker-compose.yml up -d --build

# 7. Set up auto-deploy timer
cp deploy/systemd/myapp-autodeploy.service /etc/systemd/system/
cp deploy/systemd/myapp-autodeploy.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now myapp-autodeploy.timer

# 8. Verify
systemctl list-timers myapp-autodeploy.timer
docker compose -f deploy/docker-compose.yml ps
curl -f https://myapp.com/actuator/health   # should return {"status":"UP"}

echo ""
echo "Production checklist:"
echo "  [ ] Firewall: only 22/80/443 open"
echo "  [ ] .env: chmod 600, not in git"
echo "  [ ] Postgres data: named volume (persists restarts)"
echo "  [ ] Caddy: verify HTTPS works and cert auto-renewed"
echo "  [ ] Healthcheck: actuator/health returns UP"
echo "  [ ] Auto-deploy: timer active and log shows picks up pushes"`
        },
        {
          lang: 'bash',
          title: 'Docker Compose healthcheck patterns and zero-downtime redeploy',
          code: `# Full docker-compose.yml with healthchecks, restart policies, and safe redeploy

cat << 'YAML'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime          # multi-stage: pick the slim JRE stage
    image: myapp:\${GIT_SHA:-latest}
    restart: unless-stopped    # restart on crash but respect manual stops
    ports:
      - "127.0.0.1:8080:8080"
    env_file: deploy/.env      # loaded from .env file — NOT in this yaml
    environment:
      SPRING_PROFILES_ACTIVE: prod
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider",
             "http://localhost:8080/actuator/health/readiness"]
      interval: 20s
      timeout: 5s
      start_period: 40s        # give Spring Boot time to start
      retries: 3
    depends_on:
      postgres: { condition: service_healthy }
    deploy:
      resources:
        limits:   { memory: 512m }
        reservations: { memory: 256m }

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    env_file: deploy/.env
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 5s
      retries: 10
    ports:
      - "127.0.0.1:5432:5432"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data            # TLS cert storage — must persist!
      - caddy_config:/config
    depends_on:
      app: { condition: service_healthy }  # only start Caddy when app is healthy

volumes:
  pgdata:
  caddy_data:      # CRITICAL: if this volume is deleted, certs are lost (re-issue triggers rate limits)
  caddy_config:
YAML

echo ""
echo "=== Zero-downtime redeploy steps ==="
echo "1. docker compose pull (if using registry) OR docker compose build"
echo "2. docker compose up -d app   # rolling: Compose stops old, starts new"
echo "   Caddy keeps routing to old app until the new one passes healthcheck"
echo ""
echo "=== Rollback if new version is broken ==="
echo "docker compose down app"
echo "docker compose up -d --no-build app  # uses previously built image"
echo ""
echo "=== See what's running ==="
echo "docker compose ps"
echo "docker compose logs -f --tail=100 app"
echo "docker inspect myapp-app-1 | grep -A5 Health"`
        }
      ],
      flashcards: [
        { q: 'Why bind app and database ports to 127.0.0.1 instead of 0.0.0.0 in Docker Compose?', a: 'Binding to 127.0.0.1 means the port is only accessible from the host itself, not from the public internet. Caddy (bound to 0.0.0.0:443) is the only public entry point. Containers on the same Docker network communicate via service names, not host ports.' },
        { q: 'What does Caddy give you over Nginx for TLS?', a: 'Automatic Let\'s Encrypt certificate provisioning and renewal with zero configuration. Nginx requires certbot, cronjobs, and reload automation. A Caddy reverse proxy for a domain is 3 lines vs ~40 for Nginx with the same functionality.' },
        { q: 'Why use a named Docker volume for Postgres data and Caddy certs?', a: 'Named volumes persist across container restarts and recreations (docker compose up --build). If you use a bind-mount in /tmp or omit the volume, your database data and TLS certificates are wiped on every rebuild — a production disaster.' },
        { q: 'What is the systemd timer push-to-deploy pattern?', a: 'A oneshot systemd service runs a shell script that does: git fetch, compare local vs remote revision, git reset --hard + docker compose up --build only when there\'s a new commit. A timer fires it every minute. Result: deploys happen within 60 seconds of a push, no GitHub secrets or external CI needed.' },
        { q: 'What is the start_period in a Docker healthcheck and why is it important for Spring Boot?', a: 'start_period is a grace time before health failures count. Spring Boot can take 20-40 seconds to start; without start_period, Docker would restart the container before it finishes booting. Set start_period longer than your worst-case startup time.' },
        { q: 'How do you handle secrets (DB passwords, API keys) on a VPS deployment?', a: 'Store them in a .env file (gitignored, chmod 600) on the VPS. Docker Compose reads it automatically via env_file. Never commit secrets to git — commit only .env.example with placeholder values and document what each variable does.' },
        { q: 'When would you graduate from Docker Compose to Kubernetes?', a: 'When you need to run across multiple VPS nodes and want automatic pod scheduling, or when you need advanced autoscaling, rolling deploys with zero-downtime at the orchestration level, or when your team has platform engineers who own the K8s cluster. For 1-2 servers with a small team, Docker Compose is the right tool.' }
      ]
    },

    {
      id: '11.3',
      title: 'Spring Security, OAuth2 & Per-User Data Isolation',
      hours: 5,
      notes: `
# Spring Security, OAuth2 & Per-User Data Isolation

This module covers the full authentication and authorisation stack for a production Spring Boot application: the security filter chain, OAuth2/OIDC login (Google), role-based access control, and the patterns for keeping one user's data isolated from another's.

## The Spring Security filter chain

Every HTTP request passes through a chain of \`Filter\` implementations before reaching your controller. Spring Security inserts its own filters into this chain.

\`\`\`
Request
  -> SecurityContextPersistenceFilter   (restore auth from session/token)
  -> UsernamePasswordAuthenticationFilter (form login — if enabled)
  -> OAuth2LoginAuthenticationFilter    (social login — if enabled)
  -> BearerTokenAuthenticationFilter    (JWT — if enabled)
  -> ExceptionTranslationFilter         (401/403 routing)
  -> FilterSecurityInterceptor          (access decisions)
  -> Your Controller
\`\`\`

Configuring security means customising this chain — adding filters, disabling defaults, configuring which paths need which roles.

## Configuring Spring Security 6 (Lambda DSL)

\`\`\`java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/api/v1/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .userInfoEndpoint(ui -> ui.userService(customOAuth2UserService()))
                .defaultSuccessUrl("/dashboard", true)
            )
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**")) // REST API: stateless
            .build();
    }
}
\`\`\`

## Google OAuth2 login (most common in EU startups)

Spring Boot makes this almost config-only:

\`\`\`yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: \${GOOGLE_CLIENT_ID}
            client-secret: \${GOOGLE_CLIENT_SECRET}
            scope: openid, email, profile
\`\`\`

Flow: user clicks "Login with Google" → redirect to Google → user authenticates → Google redirects back with a code → Spring exchanges code for tokens → loads user info → creates/updates your User entity → sets SecurityContext.

> [!TIP]
> Implement a \`OAuth2UserService\` to map the Google user (by email) to your own \`AppUser\` entity on first login, and to refresh their name/picture on subsequent logins. Store roles in your DB, not in the OAuth token — you control who is an ADMIN.

## JWT for stateless APIs

Session-based auth doesn't work for mobile clients or microservices. JWT (JSON Web Token) embeds claims in a signed token:

- **Header**: algorithm (HS256/RS256)
- **Payload**: \`sub\` (user id), \`roles\`, \`exp\` (expiry)
- **Signature**: HMAC or RSA signature

The server verifies the signature on every request — no session lookup needed. The token is stateless; invalidation requires short expiry + a refresh token.

> [!WARNING]
> JWTs cannot be revoked before expiry (unlike sessions). Use short expiry (15 min access token + longer refresh token). Never put sensitive data in the payload — it's Base64-encoded, not encrypted. Use HTTPS — a stolen JWT is a stolen identity.

## Per-user data isolation

In a multi-tenant application, every DB query must be scoped to the current user. The common patterns:

### Pattern 1: Repository-level filtering (safest)
\`\`\`java
// Every query includes userId — impossible to forget if you use this as the only repository method
public interface JournalRepository extends JpaRepository<TradeJournal, Long> {
    List<TradeJournal> findByUserId(Long userId);
    Optional<TradeJournal> findByIdAndUserId(Long id, Long userId); // ownership check built in
}

// Service: never expose findById without ownership check
public TradeJournal getForCurrentUser(Long tradeId) {
    Long userId = SecurityUtils.currentUserId();
    return repo.findByIdAndUserId(tradeId, userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
}
\`\`\`

### Pattern 2: @PostFilter / @PreFilter (Spring Security)
Annotation-driven but can leak N+1 queries — not recommended for large datasets.

### Pattern 3: Hibernate multi-tenancy (for stricter isolation)
Separate schemas or databases per tenant. More complex, but appropriate for compliance-heavy applications (GDPR, finance).

> [!WARNING]
> **Insecure direct object reference (IDOR)** — the OWASP #1 access-control vulnerability: \`GET /api/trades/42\` where 42 is another user's trade. Always check ownership in the repository query, not just "is the user authenticated." \`findByIdAndUserId\` not \`findById\` is the pattern.

## Role-based access control (RBAC)

\`\`\`
ADMIN  → everything
USER   → own data + trading
VIEWER → own data, read-only (no trading)
\`\`\`

Implement with Spring Security method security:

\`\`\`java
@EnableMethodSecurity
@Service
public class TradingService {
    @PreAuthorize("hasRole('USER') and not hasRole('VIEWER')")
    public void placeOrder(OrderRequest req) { ... }

    @PreAuthorize("hasAnyRole('USER', 'ADMIN', 'VIEWER')")
    public List<Trade> getMyTrades() { ... }
}
\`\`\`

> [!EU]
> EU GDPR requires knowing **who accessed whose data**. Log authenticated user id on every sensitive operation. Store userId in MDC (Mapped Diagnostic Context) at the filter layer so it appears in every log line — this is your audit trail. This is both a legal requirement and an interviewer-pleasing operational maturity signal.
`,
      code: [
        {
          lang: 'java',
          title: 'OAuth2 user service: map Google login to your AppUser',
          code: `import java.util.*;

// In a real Spring Boot app, this is a @Service implementing OAuth2UserService<OidcUserRequest, OidcUser>
// Here we model the essential logic without the Spring dependencies.
public class OAuth2UserServiceDemo {

    // Your domain entity
    static class AppUser {
        Long id; String email; String name; String role; String googleSub;
        AppUser(Long id, String email, String name, String role, String googleSub) {
            this.id=id; this.email=email; this.name=name;
            this.role=role; this.googleSub=googleSub;
        }
        @Override public String toString() {
            return "AppUser{id=" + id + ", email=" + email + ", role=" + role + "}";
        }
    }

    // Simulated DB
    static final Map<String, AppUser> userDb = new LinkedHashMap<>();
    static long idSeq = 1;

    // The Google OIDC attributes we care about
    record GoogleClaims(String sub, String email, String name, String picture) {}

    // This is the core logic of a custom OidcUserService:
    // Called after Google authenticates the user and returns their claims.
    static AppUser loadOrCreateUser(GoogleClaims claims, String adminEmail) {
        // Try to find by Google's sub (stable unique ID — email can change!)
        AppUser existing = userDb.values().stream()
            .filter(u -> claims.sub().equals(u.googleSub))
            .findFirst().orElse(null);

        if (existing != null) {
            // Refresh name (user might have changed it on Google)
            existing.name = claims.name();
            System.out.println("Returning user updated: " + existing);
            return existing;
        }

        // First login: create account
        // ADMIN role if email matches the configured admin; everyone else starts as VIEWER
        String role = claims.email().equalsIgnoreCase(adminEmail) ? "ADMIN" : "VIEWER";
        AppUser newUser = new AppUser(idSeq++, claims.email(), claims.name(), role, claims.sub());
        userDb.put(claims.email(), newUser);
        System.out.println("New user created: " + newUser);
        return newUser;
    }

    public static void main(String[] args) {
        String adminEmail = "admin@example.com";

        // First login by admin
        loadOrCreateUser(new GoogleClaims("google-sub-111", "admin@example.com", "Raja Admin", "photo1"), adminEmail);
        // First login by regular user
        loadOrCreateUser(new GoogleClaims("google-sub-222", "user@example.com", "John Doe", "photo2"), adminEmail);
        // Second login by admin (returns existing, updates name)
        loadOrCreateUser(new GoogleClaims("google-sub-111", "admin@example.com", "Raja S", "photo1"), adminEmail);

        System.out.println("\\nAll users: " + userDb.values());
        System.out.println("\\nKey point: role is stored in YOUR DB, not in the Google token.");
        System.out.println("An ADMIN can elevate any user via the admin panel.");
    }
}`
        },
        {
          lang: 'java',
          title: 'Per-user data isolation: IDOR prevention pattern',
          code: `import java.util.*;
import java.util.stream.Collectors;

// Demonstrates the correct pattern for preventing Insecure Direct Object Reference (IDOR)
// OWASP Top 10 A01: Broken Access Control
public class PerUserIsolationDemo {

    record Trade(Long id, Long userId, String symbol, String status) {}

    // Simulates the trade_journal table
    static final List<Trade> trades = List.of(
        new Trade(1L, 100L, "NIFTY24C20000", "OPEN"),
        new Trade(2L, 100L, "BANKNIFTY", "CLOSED"),
        new Trade(3L, 200L, "SENSEX", "OPEN"),   // belongs to user 200
        new Trade(4L, 200L, "NIFTY", "OPEN")
    );

    // ❌ VULNERABLE: no ownership check — user 100 can access user 200's trade!
    static Trade getTradeVulnerable(Long tradeId) {
        return trades.stream().filter(t -> t.id().equals(tradeId)).findFirst()
                     .orElseThrow(() -> new RuntimeException("not found"));
    }

    // ✅ SAFE: always filter by BOTH id AND userId — this is the repository pattern
    static Optional<Trade> getTradeForUser(Long tradeId, Long currentUserId) {
        return trades.stream()
                     .filter(t -> t.id().equals(tradeId) && t.userId().equals(currentUserId))
                     .findFirst();
    }

    // ✅ SAFE: list only returns the current user's trades
    static List<Trade> getOpenTradesForUser(Long currentUserId) {
        return trades.stream()
                     .filter(t -> t.userId().equals(currentUserId) && "OPEN".equals(t.status()))
                     .collect(Collectors.toList());
    }

    // Security audit helper: log who accessed what
    static void auditLog(Long currentUserId, String action, Long resourceId, boolean success) {
        System.out.printf("[AUDIT] user=%d action=%s resource=%d success=%s%n",
                          currentUserId, action, resourceId, success);
    }

    public static void main(String[] args) {
        Long attacker = 100L;   // authenticated as user 100
        Long victim   = 200L;   // user 100 is trying to access user 200's trade

        System.out.println("=== VULNERABLE endpoint ===");
        // User 100 requests trade #3 (belongs to user 200) — gets it! IDOR!
        Trade stolen = getTradeVulnerable(3L);
        System.out.println("IDOR: attacker got " + stolen);

        System.out.println("\n=== SAFE endpoint ===");
        // Same request through safe endpoint — returns empty
        Optional<Trade> result = getTradeForUser(3L, attacker);
        boolean allowed = result.isPresent();
        auditLog(attacker, "GET_TRADE", 3L, allowed);
        System.out.println("Safe result for user " + attacker + " requesting trade 3: "
                           + result.map(Object::toString).orElse("NOT FOUND (correct!)"));

        System.out.println("\n=== User 100's own trades ===");
        getOpenTradesForUser(attacker).forEach(t ->
            System.out.println("  " + t + " (belongs to them)"));
    }
}`
        },
        {
          lang: 'java',
          title: 'JWT: creation, signing, and verification',
          code: `import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

// JWT concept demo (no external library — educational implementation).
// In production use: io.jsonwebtoken:jjwt or com.auth0:java-jwt
public class JwtConceptDemo {

    // A JWT has three Base64URL-encoded parts: header.payload.signature
    static String base64UrlEncode(String input) {
        return Base64.getUrlEncoder().withoutPadding()
                     .encodeToString(input.getBytes(StandardCharsets.UTF_8));
    }

    static String hmacSha256(String data, String secret) throws Exception {
        // Simplified HMAC — real code uses javax.crypto.Mac
        byte[] key  = secret.getBytes(StandardCharsets.UTF_8);
        byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        // In reality: javax.crypto.Mac.getInstance("HmacSHA256"), mac.init(SecretKeySpec), mac.doFinal()
        byte[] hash = md.digest(data.getBytes(StandardCharsets.UTF_8)); // simplified (not real HMAC)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    }

    static String createToken(long userId, String email, String role, long expiryMs, String secret) throws Exception {
        String header  = base64UrlEncode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        long   expEpoch = (System.currentTimeMillis() + expiryMs) / 1000;
        String payload = base64UrlEncode(String.format(
            "{\"sub\":\"%d\",\"email\":\"%s\",\"role\":\"%s\",\"exp\":%d}",
            userId, email, role, expEpoch));
        String signingInput = header + "." + payload;
        String signature = hmacSha256(signingInput, secret);
        return signingInput + "." + signature;
    }

    static Map<String, String> parsePayload(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) throw new IllegalArgumentException("invalid token");
        String payload = new String(Base64.getUrlDecoder().decode(parts[1]));
        // Simplified parse — real code uses ObjectMapper
        Map<String, String> claims = new LinkedHashMap<>();
        payload = payload.replaceAll("[{}\"]", "");
        for (String kv : payload.split(",")) {
            String[] pair = kv.split(":");
            if (pair.length == 2) claims.put(pair[0].trim(), pair[1].trim());
        }
        return claims;
    }

    public static void main(String[] args) throws Exception {
        String secret = "my-super-secret-key-min-256-bits-for-hs256-security";

        // 1. Issue a token on login
        String token = createToken(42L, "user@example.com", "USER", 900_000 /*15min*/, secret);
        System.out.println("Token: " + token.substring(0, 60) + "...");

        // 2. Parse and verify on every request (BearerTokenFilter does this)
        Map<String, String> claims = parsePayload(token);
        System.out.println("Claims: " + claims);
        System.out.println("User id: " + claims.get("sub"));
        System.out.println("Role: "    + claims.get("role"));

        // Key points about JWT in production:
        System.out.println("\nProduction rules:");
        System.out.println("  - Access token: 15min expiry (short! can't revoke before expiry)");
        System.out.println("  - Refresh token: 7-30 days, stored in DB (can be revoked)");
        System.out.println("  - Never put passwords or PII in payload (it's BASE64, not encrypted)");
        System.out.println("  - Always use HTTPS — a stolen token = stolen identity until expiry");
        System.out.println("  - Use RS256 (asymmetric) when multiple services verify tokens");
        System.out.println("    (they need the public key only, not the secret)");
    }
}`
        }
      ],
      flashcards: [
        { q: 'What is the Spring Security filter chain and what is its role?', a: 'A chain of Filter implementations through which every HTTP request passes before reaching a controller. Spring Security inserts filters for authentication (OAuth2, JWT, form-login), authorization, exception translation (401/403), and session management. Configuring security means customising this chain.' },
        { q: 'Why store roles in your own database rather than in the OAuth2 token?', a: 'The OAuth2 token contains identity (email, name) from the provider, but your application defines what roles/permissions that identity has. Storing roles in your DB lets you change a user\'s role without re-authenticating them and keeps authorisation decisions under your control.' },
        { q: 'What is an IDOR vulnerability and how do you prevent it?', a: 'Insecure Direct Object Reference: accessing another user\'s resource by guessing its ID (e.g. GET /trades/3 where 3 belongs to another user). Prevent it by always querying with BOTH the resource ID AND the authenticated user\'s ID in the WHERE clause — findByIdAndUserId not findById.' },
        { q: 'What are the trade-offs of JWT vs session-based auth?', a: 'JWT: stateless (no server-side lookup), scales horizontally, works for mobile/API clients — but cannot be revoked before expiry. Sessions: can be revoked instantly (delete the session), but require server-side storage and sticky sessions or a shared session store (Redis).' },
        { q: 'How does Spring\'s @PreAuthorize prevent access-control bugs?', a: '@PreAuthorize checks the authenticated user\'s roles/authorities before the method executes. Combined with @EnableMethodSecurity it moves authorisation rules to the service layer rather than controllers, so authorisation is enforced even when called from jobs or other services.' },
        { q: 'Why use findByEmailOrSub (stable Google ID) rather than findByEmail to look up users?', a: 'Google\'s "sub" (subject) claim is a stable unique identifier that never changes for a user. Email can change (user renames their account). If you look up only by email and the user changes their email, they\'d get a new account and lose their data.' },
        { q: 'What is a short-lived access token + refresh token pattern and why use it?', a: 'Access token expires in 15 minutes (limits damage if stolen — theft window is short). Refresh token lives 7-30 days, stored in DB, and can be revoked. The client exchanges the refresh token for a new access token silently. This balances security with user experience.' },
        { q: 'How do you implement a GDPR-compliant audit log for data access?', a: 'Store the authenticated user\'s ID in MDC (Mapped Diagnostic Context) at the filter layer so it appears on every log line. Log authenticated userId, action (READ/WRITE/DELETE), resource type, resource ID, and timestamp for every sensitive operation. This trace is your GDPR data-access audit trail.' }
      ]
    }
  ]
},
];
