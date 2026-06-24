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
# JVM Architecture — From Zero to Senior Level

## What is the JVM? (Start Here)

Imagine you write a recipe in English. A French chef can't follow it directly — they need a translator. The **JVM (Java Virtual Machine)** is that universal translator for Java programs.

When you write Java code and compile it with \`javac\`, you don't get machine code (the 0s and 1s your CPU understands). You get **bytecode** — a middle language that NO real CPU understands natively. The JVM reads this bytecode and translates it to whatever the real machine needs. That's why Java is "write once, run anywhere": the bytecode is the same everywhere, only the JVM is different per OS.

\`\`\`
You write:   HelloWorld.java
javac gives: HelloWorld.class  (bytecode — portable, platform-neutral)
JVM reads:   HelloWorld.class  → translates → real CPU instructions
\`\`\`

> [!TIP]
> The JVM is a **specification**, not a product. OpenJDK (free, open source), Oracle JDK, Amazon Corretto, Eclipse Temurin, GraalVM — these are all different *implementations* of the same spec. They all run the same \`.class\` files identically.

---

## The Big Picture: Three Subsystems

Every JVM has three major subsystems. Think of them as three departments in a company:

\`\`\`
┌─────────────────────────────────────────────────────┐
│                    JVM Process                      │
│                                                     │
│  1. CLASS LOADER       2. RUNTIME DATA AREAS        │
│  ┌─────────────┐       ┌─────────────────────────┐  │
│  │ Bootstrap   │       │ Heap (all threads share) │  │
│  │ Platform    │──────▶│ Metaspace (class meta)   │  │
│  │ Application │       │ Stack (per thread)       │  │
│  │ Custom      │       │ PC Register (per thread) │  │
│  └─────────────┘       │ Native Stack (per thread)│  │
│                        └─────────────────────────┘  │
│  3. EXECUTION ENGINE                                │
│  ┌───────────────────────────────────────────────┐  │
│  │  Interpreter → JIT Compiler (C1+C2) → GC      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
\`\`\`

---

## Subsystem 1: Class Loader — "The Librarian"

The class loader finds your \`.class\` files and prepares them for execution. This is a three-phase process:

### Phase 1: Loading
- Finds the binary representation of the class (from classpath, jar, network, etc.)
- Creates a \`java.lang.Class\` object in the **heap** representing that class
- Triggered the first time you reference a class — lazy by default

### Phase 2: Linking (3 sub-steps)

**a) Verification** — the JVM checks the bytecode is safe. Is it well-formed? Does it try to call methods that don't exist? Does it mix incompatible types? If verification fails → \`VerifyError\`. This is a security step — it prevents malicious bytecode from crashing the VM.

**b) Preparation** — allocates memory for **static fields** and sets them to their **default values** (0, null, false). NOT your declared values yet — just defaults.
\`\`\`java
static int count = 42;   // after prepare: count = 0 (not 42 yet!)
\`\`\`

**c) Resolution** — replaces symbolic references (class names as strings) with direct references (actual memory pointers). E.g. the string \`"java/lang/String"\` in bytecode becomes a pointer to the loaded String class.

### Phase 3: Initialisation
- Runs **static initialiser blocks** and **static field assignments** in the order they appear in source code
- Now \`count = 42\` actually happens
- Guaranteed to run **at most once** per class, and **thread-safe** (the JVM serialises it)

> [!WARNING]
> **Class initialisation order trap** — a common interview gotcha:
> \`\`\`java
> class A { static int x = B.y + 1; }   // depends on B
> class B { static int y = A.x + 1; }   // depends on A — circular!
> \`\`\`
> Circular dependencies between static initialisers produce surprising results. One class's statics will still be at default values (0) when the other reads them. Always keep static initialisers simple.

### The Parent Delegation Model (Critical Concept)

There are four built-in class loaders forming a hierarchy. When any loader is asked to load a class:
1. **Ask parent first** — delegate upward
2. Only if parent fails (class not found) → load it yourself

\`\`\`
Bootstrap ClassLoader  (built into JVM, loads java.*, javax.*, sun.*)
       ↑ parent of
Platform ClassLoader   (loads java.se.* module classes, formerly Extension)
       ↑ parent of
Application ClassLoader (loads YOUR classes from -classpath / module-path)
       ↑ parent of
Custom ClassLoaders    (you write these for plugins, hot-reload, OSGi)
\`\`\`

**Why does delegation matter?**
- Security: you cannot replace \`java.lang.String\` with your own — Bootstrap loads it first, always wins
- Consistency: \`String\` loaded by Bootstrap == \`String\` loaded by Bootstrap, no matter who asks. Two classes are the same type only if same name AND same class loader.

> [!WARNING]
> **Class identity crisis**: if two different classloaders both load \`com.example.Foo\`, you get TWO distinct \`Class\` objects. A \`Foo\` from loader A **cannot be cast** to a \`Foo\` from loader B — you get \`ClassCastException\` even though the name looks identical. Tomcat, OSGi, and Spring Boot fat-jars all use child-first loading and can trigger this.

**When frameworks BREAK delegation on purpose:**
- Tomcat gives each web app its own classloader (child-first) so different apps can use different versions of the same library
- Spring Boot fat-jars use a custom \`LaunchedURLClassLoader\` to load classes from nested jars
- OSGi creates a classloader per bundle for complete isolation

---

## Subsystem 2: Runtime Data Areas — "The Memory Rooms"

### The Heap — Shared, Biggest, Most Important

Every object you create with \`new\` lives here. All threads share the same heap. The GC manages it.

The heap is divided into **generations** (in traditional GC designs):
\`\`\`
HEAP
├── Young Generation (new objects born here)
│   ├── Eden Space          (most new objects allocated here)
│   ├── Survivor Space S0   (survivors of one GC cycle)
│   └── Survivor Space S1   (survivors of another cycle)
└── Old Generation (Tenured)  (objects that survived many GC cycles)
\`\`\`

Why generations? Because most objects die young (the **Weak Generational Hypothesis**). Collecting only young gen (Minor GC) is fast. Collecting everything (Full GC) is slow and rare.

**What causes \`OutOfMemoryError: Java heap space\`?**
- You created more objects than the heap can hold AND GC couldn't free enough
- Tune with: \`-Xms512m\` (initial heap) \`-Xmx2g\` (max heap)

### Metaspace — Where Classes Live (Java 8+)

Before Java 8 there was **PermGen** (Permanent Generation) — a fixed-size heap region holding class metadata. It caused the dreaded \`OutOfMemoryError: PermGen space\` whenever you deployed too many classes (common in app servers).

Java 8 replaced PermGen with **Metaspace** which:
- Lives in **native memory** (outside the Java heap)
- Grows dynamically (no fixed size by default)
- Still can OOM if you have a classloader leak (e.g. hot-deploying web apps without unloading old classloaders)
- Cap it with: \`-XX:MaxMetaspaceSize=256m\`

Metaspace holds:
- Class structures (field names, method signatures, bytecode)
- Runtime constant pool (string and numeric literals)
- Static field **references** (the actual object the static points to lives in the heap)

> [!TIP]
> Static fields themselves (references) live in the Class object on the heap in Java 8+. The Metaspace holds the class *structure*, not the object *values*.

### JVM Stack — Per Thread, Last-In-First-Out

Each thread gets its own stack. When you call a method, a **stack frame** is pushed. When the method returns, it's popped.

Each stack frame contains:
- **Local variable array** — \`this\`, method parameters, declared local variables
- **Operand stack** — scratch pad for calculations (like a calculator's temporary memory)
- **Frame data** — reference to the constant pool, return address

\`\`\`
Thread stack (top = currently executing):
┌──────────────────────────┐
│  Frame: doWork()         │ ← currently running
│    locals: [this, x, y]  │
│    operand stack: [42]   │
├──────────────────────────┤
│  Frame: process()        │ ← called doWork()
│    locals: [this, list]  │
├──────────────────────────┤
│  Frame: main()           │ ← called process()
└──────────────────────────┘
\`\`\`

**What causes \`StackOverflowError\`?**
- Too many frames — infinite recursion is the classic cause
- Each frame takes memory. Default stack size is 512KB–1MB. Tune with: \`-Xss2m\`

> [!TIP]
> Local variables in the stack are NOT garbage-collected — they disappear automatically when the frame is popped. Only objects on the **heap** need GC.

### PC Register — The Bookmark

Each thread has a Program Counter (PC) register that holds the address of the bytecode instruction currently being executed. When you context-switch between threads, the CPU saves/restores each thread's PC so execution can resume where it left off. For native methods, the PC is undefined.

### Native Method Stack

When Java calls a C/C++ function through **JNI (Java Native Interface)**, a native method stack frame is created here. Usually you never think about this unless you're writing JNI code.

---

## Subsystem 3: Execution Engine — "How Code Actually Runs"

### Step 1: Interpretation (Slow but Instant Start)

When a method is first called, the JVM **interprets** bytecode — reading each instruction one by one and executing it. This is slow (10-100x slower than native code) but starts immediately.

### Step 2: Profiling

While interpreting, the JVM **profiles** which methods are "hot" (called frequently). The threshold is configurable but roughly 10,000 invocations.

### Step 3: JIT Compilation (The Speed Magic)

Hot methods get compiled by the **JIT (Just-In-Time) compiler** to native machine code. Two compilers work together:

| Compiler | Level | Speed | Quality | Use case |
|----------|-------|-------|---------|----------|
| **C1** (Client) | 1-3 | Fast | Lower | Methods hot quickly, needs code soon |
| **C2** (Server) | 4 | Slow | Highest | Very hot methods, maximum optimization |

This is called **Tiered Compilation** (default since Java 7). A method moves through tiers 0→1→2→3→4 as it gets hotter.

**What optimisations does JIT apply?**
- **Inlining**: replaces a method call with the method's body — eliminates call overhead
- **Escape analysis**: if an object never escapes the method, allocate it on the stack (not heap!) — no GC needed
- **Dead code elimination**: removes code that can never execute
- **Loop unrolling**: replaces short loops with repeated statements
- **Devirtualization**: if a virtual call always goes to the same implementation, compile it as a direct call

> [!TIP]
> This is why Java benchmarks must **warm up** before measuring. Cold (interpreted) performance is 10-100x slower than warm (JIT-compiled) performance. A benchmark that measures cold startup is not measuring Java's production performance. Use **JMH** for correct benchmarks.

---

## What Happens When You Run \`java HelloWorld\`? (The Full Journey)

This is the most common senior interview question on JVM. Walk through it step by step:

1. **OS launches the JVM process** — the JVM binary starts, allocates heap, creates the main thread
2. **Bootstrap ClassLoader initialises** — loads core classes like \`java.lang.Object\`, \`java.lang.String\`
3. **Application ClassLoader finds** \`HelloWorld.class\` on the classpath
4. **Loading** — \`HelloWorld.class\` binary read into memory, \`Class\` object created in heap
5. **Linking** — bytecode verified, statics prepared (set to defaults), symbolic refs resolved
6. **Initialisation** — static initialisers run, static fields get their declared values
7. **Main thread stack created** — a new JVM stack is allocated for the main thread
8. **\`main()\` frame pushed** onto the stack — parameters (\`String[] args\`) in local variable slot 0
9. **Interpreter starts** — reads bytecode instructions one by one
10. **JIT kicks in** — as methods get hot, C1 then C2 compile them to native code
11. **GC runs** — periodically frees unreachable heap objects
12. **\`main()\` returns** — frame popped, main thread exits, JVM shuts down (if no non-daemon threads remain)

> [!EU]
> At Adyen, N26, Zalando, or SAP: narrate all 12 steps above when asked "what happens when you run a Java program?" Most candidates stop at step 4. Getting to step 12 — especially mentioning Metaspace vs PermGen, tiered JIT, and daemon threads — puts you in the top 5% of candidates.

---

## Common Interview Questions & Strong Answers

**Q: What's the difference between heap and stack?**
A: Heap is shared across all threads and holds objects (managed by GC). Stack is per-thread, holds method frames (local variables + operand stack), and is automatically reclaimed when frames pop. Stack is faster (no GC), smaller, and LIFO-ordered. Objects that escape a method must go on the heap; purely local temporaries can stay on the stack (JIT escape analysis does this automatically).

**Q: What replaced PermGen and why?**
A: Metaspace (Java 8+). PermGen was a fixed-size heap region — easy to overflow when loading many classes. Metaspace lives in native memory and grows dynamically, eliminating most PermGen OOM errors. The risk now is native memory exhaustion from classloader leaks, controlled by \`-XX:MaxMetaspaceSize\`.

**Q: Why is parent delegation important?**
A: Three reasons — (1) Security: core classes like \`String\` always loaded by Bootstrap, can't be overridden. (2) Consistency: same class name + same loader = same Class object, enabling safe casting. (3) Avoid duplication: class loaded once by parent, not re-loaded by each child.

**Q: When would you write a custom ClassLoader?**
A: Plugin systems (load user-provided jars at runtime), hot-reload (reload changed classes without restarting), application isolation (multiple versions of same library in one JVM — like Tomcat does per web app), loading classes from non-standard sources (database, network, encrypted jar).
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
      ],
      sections: [
            {
              title: 'JVM Overview & Bytecode',
              notes: `
      # JVM Overview & Bytecode
      
      ### What is the JVM?
      
      The **Java Virtual Machine (JVM)** is the execution engine for Java applications. It acts as an abstract computing machine that enables a computer to run a Java program. Instead of compiling Java source code (\`.java\`) directly into native machine instructions (like C++ or Rust), the \`javac\` compiler translates it into an intermediate, platform-neutral representation called **bytecode** (\`.class\` files). 
      
      The JVM then takes this bytecode and translates it into native CPU instructions at runtime.
      
      ### Why Bytecode Exists (Compile-Once, Run-Anywhere)
      
      The core proposition of Java is "Write Once, Run Anywhere" (WORA). Because the bytecode is universally standardized, a \`.class\` file compiled on a Windows machine will run flawlessly on a Linux server or an Apple Silicon Mac. You don't need to cross-compile your application for different architectures; you just need to install the appropriate JVM for that operating system.
      
      \`\`\`
      HelloWorld.java  ──javac──→  HelloWorld.class (bytecode)
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                    Linux JVM         macOS JVM         Windows JVM
                          │                │                │
                          ▼                ▼                ▼
                    x86_64 code      ARM64 code        x86_64 code
      \`\`\`
      
      ### The JVM as a Specification
      
      The JVM is a **specification**, not a single product. Sun Microsystems (now Oracle) wrote the *Java Virtual Machine Specification*, which defines exactly how bytecode must be executed. Anyone can build a JVM as long as it adheres to this specification.
      
      > [!TIP]
      > The Java Runtime Environment (JRE) contains the JVM and core libraries. The Java Development Kit (JDK) contains the JRE plus tools like \`javac\` and \`jmap\`. For modern microservices, you usually package a stripped-down JRE using \`jlink\`.
      
      ### Comparison of JVM Implementations
      
      | Vendor | License | Key Feature | When to Use |
      |--------|---------|-------------|-------------|
      | **Eclipse Temurin (OpenJDK)** | GPLv2+CE | Upstream reference; community-governed | The default, safe choice for almost all standard production workloads. |
      | **Oracle JDK** | Oracle No-Fee / Commercial | Java Flight Recorder, commercial support | Enterprise environments with an Oracle support contract. |
      | **Amazon Corretto** | GPLv2+CE | LTS, security backports, highly tuned | AWS deployments; consistency with Amazon's internal JVM. |
      | **GraalVM** | GPLv2 | AOT native-image, polyglot (JS/Python) | Serverless/microservices needing <50ms cold starts. |
      
      ### The Three Subsystems Overview
      
      Every JVM implementation consists of three major subsystems working together:
      
      1. **ClassLoader Subsystem**: Loads the compiled \`.class\` files from disk or network into memory.
      2. **Runtime Data Areas**: The memory spaces (Heap, Stack, Metaspace) where the JVM stores objects, local variables, and method metadata.
      3. **Execution Engine**: Translates the loaded bytecode into machine code using an Interpreter and a Just-In-Time (JIT) compiler, and manages memory via the Garbage Collector.
      
      \`\`\`
      ┌─────────────────────────────────────────────────────┐
      │                    JVM Process                      │
      │                                                     │
      │  1. CLASS LOADER       2. RUNTIME DATA AREAS        │
      │  ┌─────────────┐       ┌─────────────────────────┐  │
      │  │ Bootstrap   │       │ Heap (shared)           │  │
      │  │ Platform    │──────▶│ Metaspace (shared)      │  │
      │  │ Application │       │ JVM Stack (per thread)  │  │
      │  │ Custom      │       │ PC Register (per thread)│  │
      │  └─────────────┘       │ Native Stack (per thrd) │  │
      │                        └─────────────────────────┘  │
      │  3. EXECUTION ENGINE                                │
      │  ┌───────────────────────────────────────────────┐  │
      │  │  Interpreter → JIT Compiler (C1+C2) → GC      │  │
      │  └───────────────────────────────────────────────┘  │
      └─────────────────────────────────────────────────────┘
      \`\`\`
      
      > [!EU]
      > European tech interviews (e.g., at Zalando or N26) love asking you to trace the lifecycle of a Java application from typing \`java MyApp\` to the GC kicking in. Nailing the interaction between these three subsystems is the key to passing the "JVM Internals" round.
              `,
              code: [
                {
                  lang: 'java',
                  title: 'Detecting the JVM Environment at Runtime',
                  code: `import java.lang.management.ManagementFactory;
      import java.lang.management.RuntimeMXBean;
      
      public class JvmInspector {
          public static void main(String[] args) {
              RuntimeMXBean runtimeMx = ManagementFactory.getRuntimeMXBean();
              
              System.out.println("JVM Name     : " + runtimeMx.getVmName());
              System.out.println("JVM Vendor   : " + runtimeMx.getVmVendor());
              System.out.println("JVM Version  : " + runtimeMx.getVmVersion());
              System.out.println("Spec Name    : " + runtimeMx.getSpecName());
              System.out.println("Uptime (ms)  : " + runtimeMx.getUptime());
              
              // System properties
              System.out.println("\\n--- System Properties ---");
              System.out.println("OS architecture: " + System.getProperty("os.arch"));
              System.out.println("OS name        : " + System.getProperty("os.name"));
              System.out.println("Available CPUs : " + Runtime.getRuntime().availableProcessors());
              
              // Check if we are running GraalVM Native Image
              boolean isNativeImage = System.getProperty("org.graalvm.nativeimage.imagecode") != null;
              System.out.println("Running as GraalVM Native Image: " + isNativeImage);
          }
      }`
                },
                {
                  lang: 'java',
                  title: 'Generating and Understanding Bytecode',
                  code: `/**
       * Compile this file using: javac BytecodeDemo.java
       * View bytecode using:     javap -c -p BytecodeDemo
       */
      public class BytecodeDemo {
          private int counter;
      
          public BytecodeDemo(int initial) {
              this.counter = initial;
          }
      
          public int add(int a, int b) {
              /*
               * Bytecode for a + b will look like:
               *  0: iload_1 (load a)
               *  1: iload_2 (load b)
               *  2: iadd    (add the top two stack ints)
               *  3: ireturn (return the result)
               */
              return a + b;
          }
      
          public void incrementCounter() {
              this.counter++;
          }
      
          public static void main(String[] args) {
              BytecodeDemo demo = new BytecodeDemo(10);
              System.out.println(demo.add(5, 7));
          }
      }`
                }
              ],
              flashcards: [
                { q: 'What is the JVM?', a: 'The Java Virtual Machine is an abstract computing machine and specification that enables a computer to run a Java program by translating bytecode to native machine instructions.' },
                { q: 'What does "Write Once, Run Anywhere" mean in the context of Java?', a: 'Java source code is compiled into platform-independent bytecode (.class files). A platform-specific JVM translates this bytecode to native code at runtime, meaning the same compiled code runs unchanged on Windows, Mac, or Linux.' },
                { q: 'What are the three main subsystems of the JVM?', a: '1. ClassLoader Subsystem, 2. Runtime Data Areas (memory), 3. Execution Engine (interpreter, JIT, GC).' },
                { q: 'What is the difference between JDK, JRE, and JVM?', a: 'The JVM is the execution engine. The JRE contains the JVM plus core class libraries. The JDK contains the JRE plus development tools like javac and debugging utilities.' },
                { q: 'If you need extremely fast startup times (e.g., for AWS Lambda), which JVM implementation should you consider?', a: 'GraalVM Native Image, which performs Ahead-Of-Time (AOT) compilation to create a standalone native executable with sub-millisecond startup.' },
                { q: 'What does the javap tool do?', a: 'It disassembles one or more class files. Running "javap -c" prints out the compiled JVM bytecode instructions, which is crucial for performance analysis.' },
                { q: 'Is the JVM solely built for Java?', a: 'No. The JVM executes bytecode, so any language that can compile to valid JVM bytecode (like Kotlin, Scala, Groovy, or Clojure) can run on the JVM.' },
                { q: 'What is Eclipse Temurin?', a: 'It is a highly popular, open-source, production-ready distribution of OpenJDK maintained by the Eclipse Foundation (formerly AdoptOpenJDK).' }
              ]
            },
            {
              title: 'ClassLoader Subsystem',
              notes: `
      # ClassLoader Subsystem
      
      The ClassLoader subsystem is the JVM's gateway. Its job is to find \`.class\` files and load them into memory. It is incredibly important for frameworks like Spring Boot, Tomcat, and OSGi.
      
      ### The Three Phases of Class Loading
      
      Loading a class is not a single step; it happens in three distinct phases: **Loading**, **Linking**, and **Initialisation**.
      
      **1. Loading**
      The JVM finds the binary representation of the class (from the filesystem, a JAR, or the network) and creates a \`java.lang.Class\` object in the heap. Loading is **lazy** — it only happens the first time a class is referenced.
      
      **2. Linking (Three Sub-Steps)**
      - **Verification**: The bytecode verifier ensures the \`.class\` file is structurally correct and safe to execute (no illegal memory jumps, valid magic number \`0xCAFEBABE\`).
      - **Preparation**: Allocates memory for **static fields** and sets them to their **default zero values** (e.g., \`0\`, \`null\`, \`false\`). It does *not* execute assignments yet.
      - **Resolution**: Replaces symbolic references in the constant pool (like a string representing a method name) with direct references (actual memory pointers).
      
      **3. Initialisation**
      The JVM executes static initialiser blocks (\`static { ... }\`) and assigns the actual defined values to static fields. This phase is guaranteed to run exactly once and is thread-safe.
      
      > [!WARNING]
      > **The Circular Static Initialiser Trap:** If Class A's static block references Class B, and B references A, one will see the uninitialised default value (\`0\` or \`null\`) of the other. This is a common interview gotcha!
      
      ### Parent Delegation Model
      
      Java uses a hierarchical parent-delegation model for class loading. When a ClassLoader is asked to load a class, it **delegates the request to its parent first**. It only attempts to load the class itself if the parent cannot find it.
      
      \`\`\`
                Bootstrap ClassLoader (C++ native)
                           ↑
                Platform ClassLoader (Java)
                           ↑
                Application ClassLoader (Java)
                           ↑
                Custom ClassLoaders (e.g., Tomcat)
      \`\`\`
      
      **Why does delegation exist?**
      1. **Security**: You cannot write a malicious \`java.lang.String\` class and inject it. The Application ClassLoader delegates to the Bootstrap ClassLoader, which loads the real \`String\` class first.
      2. **Consistency**: It ensures core libraries are loaded exactly once and shared across the application.
      
      ### The Class Identity Rule
      
      In the JVM, a class is uniquely identified by its **Fully Qualified Class Name AND its defining ClassLoader**. 
      If ClassLoader A and ClassLoader B both load \`com.example.User\`, the JVM treats them as **two entirely different classes**. Casting \`User\` to \`User\` will throw a \`ClassCastException\`.
      
      > [!SUCCESS]
      > **When Frameworks Break Delegation:**
      > - **Tomcat** uses a custom ClassLoader for each web app to isolate them. It breaks delegation by checking the local \`WEB-INF/lib\` *before* delegating to the parent, allowing App1 and App2 to use different versions of the same library.
      > - **Spring Boot Fat-JARs** use a \`LaunchedURLClassLoader\` to load classes from JARs nested *inside* the fat JAR, which the standard Application ClassLoader cannot read.
      
      ### ClassLoader Types Comparison
      
      | ClassLoader Type | What it loads | Java API | When you'd use/override it |
      |------------------|---------------|----------|----------------------------|
      | **Bootstrap** | Core Java API (\`java.lang.*\`, \`java.util.*\`) | Returns \`null\` | Never. It is written in native C/C++ code. |
      | **Platform** | Java platform extensions and modules | \`ClassLoader.getPlatformClassLoader()\` | Rarely. Replaced the Extension ClassLoader in Java 9. |
      | **Application** | Classes on the classpath (\`-cp\`), your app code | \`ClassLoader.getSystemClassLoader()\` | Default loader. Frameworks interact with this frequently. |
      | **Custom** | Dynamically loaded classes (network, DB, hot-reload) | \`extends ClassLoader\` | Writing a plugin system, hot-reloading code, or OSGi bundles. |
              `,
              code: [
                {
                  lang: 'java',
                  title: 'Circular Static Initialisation Trap',
                  code: `public class CircularInitDemo {
          
          static class A {
              // A relies on B
              static final int aValue = B.bValue + 1;
          }
      
          static class B {
              // B relies on A. This creates a circular dependency!
              static final int bValue = A.aValue + 1;
          }
      
          public static void main(String[] args) {
              // What does this print? 
              // When A initializes, it triggers B's initialization.
              // B reads A.aValue, which is currently its default prepared value (0).
              // So bValue becomes 0 + 1 = 1.
              // Then A finishes, aValue becomes 1 + 1 = 2.
              System.out.println("A.aValue = " + A.aValue); // Prints 2
              System.out.println("B.bValue = " + B.bValue); // Prints 1
          }
      }`
                },
                {
                  lang: 'java',
                  title: 'Inspecting the ClassLoader Hierarchy',
                  code: `import java.util.ArrayList;
      
      public class ClassLoaderHierarchy {
          public static void main(String[] args) {
              // 1. Application ClassLoader loads our own classes
              ClassLoader myLoader = ClassLoaderHierarchy.class.getClassLoader();
              System.out.println("ClassLoaderHierarchy loader: " + myLoader);
      
              // 2. Platform ClassLoader is its parent
              ClassLoader platformLoader = myLoader.getParent();
              System.out.println("Platform loader (Parent): " + platformLoader);
      
              // 3. Bootstrap ClassLoader is the root (shows as null because it's native)
              ClassLoader bootstrapLoader = platformLoader.getParent();
              System.out.println("Bootstrap loader: " + bootstrapLoader);
      
              // 4. Core classes like ArrayList are loaded by Bootstrap
              ClassLoader arrayListLoader = ArrayList.class.getClassLoader();
              System.out.println("ArrayList loader: " + arrayListLoader); // Prints null
          }
      }`
                }
              ],
              flashcards: [
                { q: 'What are the three distinct phases of class loading?', a: 'Loading, Linking (Verify, Prepare, Resolve), and Initialisation.' },
                { q: 'What happens during the Preparation step of Linking?', a: 'The JVM allocates memory for static fields and initializes them to their default values (e.g., 0, false, null). It does NOT assign the values defined in the code yet.' },
                { q: 'How does the Parent Delegation Model work?', a: 'When a ClassLoader is asked to load a class, it delegates the request to its parent ClassLoader first. It only attempts to load the class if the parent and all ancestors fail to find it.' },
                { q: 'Why is the Parent Delegation Model important for security?', a: 'It prevents malicious code from replacing core Java classes. For example, a custom java.lang.String will never be loaded because the Application ClassLoader will delegate to the Bootstrap ClassLoader, which loads the genuine String class.' },
                { q: 'What constitutes the unique identity of a class in the JVM?', a: 'Its Fully Qualified Class Name AND the instance of the ClassLoader that loaded it. The same bytecode loaded by two different ClassLoaders results in two incompatible classes.' },
                { q: 'Why does Tomcat break standard parent delegation?', a: 'To provide web application isolation. Tomcat\'s WebAppClassLoader checks the web app\'s WEB-INF/lib first (child-first) so different applications can use different, conflicting versions of the same library.' },
                { q: 'What is a java.lang.VerifyError?', a: 'An error thrown during the Verification linking step if the bytecode is structurally invalid, violates JVM semantics, or appears to have been maliciously tampered with.' },
                { q: 'What does the Bootstrap ClassLoader load, and what is it written in?', a: 'It loads core Java APIs (rt.jar in Java 8, base modules in Java 9+) and is written in native C/C++ code, which is why calling getClassLoader() on String.class returns null.' }
              ]
            },
            {
              title: 'Runtime Memory Areas',
              notes: `
      # Runtime Memory Areas
      
      When a Java program executes, the JVM allocates several memory areas. Understanding these areas is the most critical skill for troubleshooting \`OutOfMemoryError\` and \`StackOverflowError\` crashes.
      
      ### ASCII Diagram: Memory Layout
      
      \`\`\`
      ┌──────────────────────────────────────────────────────────────┐
      │                    JVM MEMORY LAYOUT                         │
      │                                                              │
      │  [ SHARED ACROSS ALL THREADS ]                               │
      │  ┌──────────────────────────────┐ ┌────────────────────────┐ │
      │  │ HEAP                         │ │ METASPACE              │ │
      │  │ ┌───────┐ ┌────┐ ┌────┐      │ │ - Class Metadata       │ │
      │  │ │ Eden  │ │ S0 │ │ S1 │      │ │ - Static variables     │ │
      │  │ └───────┘ └────┘ └────┘      │ │ - Constant Pool        │ │
      │  │   Young Generation           │ └────────────────────────┘ │
      │  │                              │                            │
      │  │ ┌──────────────────────────┐ │                            │
      │  │ │       Old / Tenured      │ │                            │
      │  │ └──────────────────────────┘ │                            │
      │  └──────────────────────────────┘                            │
      │                                                              │
      │  [ PER-THREAD DATA AREAS ]                                   │
      │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
      │  │ Thread 1   │  │ Thread 2   │  │ Thread N   │              │
      │  ├────────────┤  ├────────────┤  ├────────────┤              │
      │  │ JVM Stack  │  │ JVM Stack  │  │ JVM Stack  │              │
      │  │ Native Stk │  │ Native Stk │  │ Native Stk │              │
      │  │ PC Register│  │ PC Register│  │ PC Register│              │
      │  └────────────┘  └────────────┘  └────────────┘              │
      └──────────────────────────────────────────────────────────────┘
      \`\`\`
      
      ### 1. The Heap (Shared)
      The Heap is the largest memory area. **All object instances and arrays are allocated here** via the \`new\` keyword. The heap is managed by the Garbage Collector. 
      
      It is traditionally divided into generations:
      - **Young Generation**: Where new objects are born (Eden) and survive minor GC cycles (Survivor spaces S0 and S1).
      - **Old (Tenured) Generation**: Objects that survive multiple minor GC cycles are promoted here. Full GC collects this space.
      
      ### 2. Metaspace (Shared)
      Replaced the notorious **PermGen** (Permanent Generation) in Java 8. It stores class metadata, static fields, and the runtime constant pool.
      - **Why replace PermGen?** PermGen was part of the heap with a hardcoded fixed maximum size, leading to frequent \`OutOfMemoryError: PermGen space\` during dynamic class loading (like hot-deploying web apps).
      - Metaspace lives in **Native OS Memory** and can grow dynamically. However, severe classloader leaks can still cause native memory OOMs, so it's best tuned with \`-XX:MaxMetaspaceSize\`.
      
      ### 3. JVM Stack (Per-Thread)
      Every time a thread invokes a method, a new **Stack Frame** is pushed. The frame contains:
      - **Local Variables Array**: method parameters and local variables.
      - **Operand Stack**: scratchpad memory for bytecode instructions to push and pop values during arithmetic/logic.
      When the method returns, the frame is popped. If recursion goes too deep, you get a \`StackOverflowError\`.
      
      ### 4. PC Register (Per-Thread)
      The Program Counter holds the memory address of the JVM instruction currently being executed by the thread. It is used to keep track of thread execution during context switches.
      
      ### 5. Native Method Stack (Per-Thread)
      Similar to the JVM stack, but used for native code (C/C++) invoked via the Java Native Interface (JNI).
      
      > [!TIP]
      > Objects *always* live on the Heap (unless eliminated by JIT Escape Analysis). Only object *references* (pointers) and primitives live on the JVM Stack.
      
      ### Comparison of Memory Areas
      
      | Memory Area | Shared / Per-Thread | What lives there | Common error | JVM flag to tune |
      |-------------|---------------------|------------------|--------------|------------------|
      | **Heap** | Shared | Objects, arrays | \`OutOfMemoryError: Java heap space\` | \`-Xms\` (min), \`-Xmx\` (max) |
      | **Metaspace** | Shared | Class definitions, static vars | \`OutOfMemoryError: Metaspace\` | \`-XX:MaxMetaspaceSize\` |
      | **JVM Stack**| Per-Thread | Frames, local vars, references | \`StackOverflowError\` | \`-Xss\` (stack size per thread) |
      | **Native Stack**| Per-Thread | C/C++ JNI execution frames | \`OutOfMemoryError: unable to create native thread\` | OS limits / \`-Xss\` |
              `,
              code: [
                {
                  lang: 'java',
                  title: 'Triggering and Catching a StackOverflowError',
                  code: `public class StackOverflowDemo {
      
          // Infinite recursion: every call pushes a new frame to the JVM stack
          public static void deepRecurse(long counter) {
              if (counter % 1000 == 0) {
                  System.out.println("Depth: " + counter);
              }
              // No base case!
              deepRecurse(counter + 1);
          }
      
          public static void main(String[] args) {
              try {
                  deepRecurse(1);
              } catch (StackOverflowError e) {
                  // Note: StackOverflowError is an Error, not an Exception!
                  System.err.println("CRASH! JVM Stack exhausted.");
                  System.err.println("Tip: Use -Xss to increase thread stack size, " +
                                     "or better, fix the infinite recursion.");
              }
          }
      }`
                },
                {
                  lang: 'java',
                  title: 'Inspecting Heap Usage at Runtime',
                  code: `public class MemoryInspector {
          public static void main(String[] args) {
              int mb = 1024 * 1024;
              Runtime runtime = Runtime.getRuntime();
      
              // Print memory statistics in MB
              System.out.println("##### Heap Utilization Statistics #####");
              
              // Total memory currently allocated by the JVM from the OS
              System.out.println("Total Memory : " + runtime.totalMemory() / mb + " MB");
              
              // Free memory within the allocated total
              System.out.println("Free Memory  : " + runtime.freeMemory() / mb + " MB");
              
              // Actual used memory
              long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / mb;
              System.out.println("Used Memory  : " + usedMemory + " MB");
              
              // Maximum memory the JVM will attempt to use (-Xmx)
              System.out.println("Max Memory   : " + runtime.maxMemory() / mb + " MB");
      
              // Force a garbage collection (Not recommended in production!)
              System.out.println("\\nCalling System.gc()...");
              System.gc();
              
              System.out.println("Free Memory after GC: " + runtime.freeMemory() / mb + " MB");
          }
      }`
                }
              ],
              flashcards: [
                { q: 'Which JVM memory areas are shared among all threads?', a: 'The Heap and the Metaspace (Method Area).' },
                { q: 'Which JVM memory areas are strictly per-thread?', a: 'The JVM Stack, the Native Method Stack, and the PC Register.' },
                { q: 'Where are objects and arrays allocated?', a: 'Always on the Heap (unless JIT escape analysis scalar-replaces them onto the stack).' },
                { q: 'Where are local primitive variables and object references stored?', a: 'On the JVM Stack, within the local variables array of the current method\'s stack frame.' },
                { q: 'What is a JVM Stack Frame?', a: 'A block of memory pushed onto the JVM stack every time a method is called. It contains local variables, an operand stack, and a reference to the constant pool.' },
                { q: 'Why was PermGen replaced by Metaspace in Java 8?', a: 'PermGen had a fixed maximum size and resided in the JVM memory space, causing frequent OOM errors during dynamic class loading. Metaspace uses native OS memory and can grow dynamically.' },
                { q: 'What command line flags control the initial and maximum Heap size?', a: '-Xms (initial heap size) and -Xmx (maximum heap size).' },
                { q: 'What causes a StackOverflowError?', a: 'Exhausting the memory allocated for a thread\'s JVM stack, almost always caused by infinitely deep recursive method calls.' },
                { q: 'What happens in the Eden space?', a: 'The Eden space is part of the Young Generation on the heap. Almost all newly instantiated objects are initially allocated here.' }
              ]
            },
            {
              title: 'Execution Engine & JIT',
              notes: `
      # Execution Engine & JIT Compilation
      
      The JVM does not execute bytecode directly on the CPU. The **Execution Engine** is responsible for interpreting the bytecode and intelligently compiling the hottest parts into native machine code.
      
      ### The Problem with Interpretation
      When a Java program starts, the JVM uses an **Interpreter** to read and execute bytecode instructions one by one. Interpretation is slow because it involves a software loop mapping bytecode to CPU instructions. However, it requires zero startup delay.
      
      ### Enter the JIT Compiler
      To achieve high performance, the JVM uses a **Just-In-Time (JIT) Compiler**. 
      While the interpreter runs, the JVM **profiles** the code to identify "hot" methods (methods executed frequently or loops executing many iterations). Once a method crosses a threshold, the JIT compiles it directly into highly optimized native machine code. Subsequent calls bypass the interpreter and execute the native code directly.
      
      ### Tiered Compilation
      
      Modern HotSpot JVMs use **Tiered Compilation**, employing two different JIT compilers working in tandem:
      
      1. **C1 (Client Compiler)**: Compiles quickly but applies less aggressive optimizations. It gets the code running faster than the interpreter very quickly.
      2. **C2 (Server Compiler)**: Takes much longer to compile and consumes more CPU/memory, but produces heavily optimized, highly efficient machine code.
      
      \`\`\`
      [Method Call] → JVM Interpreter starts executing bytecode
                          │
                          ↓ (Method becomes warm)
                    C1 Compiler (Tier 1-3) generates basic native code
                          │
                          ↓ (Method becomes incredibly hot)
                    C2 Compiler (Tier 4) generates highly optimized native code
      \`\`\`
      
      > [!TIP]
      > The JIT uses **runtime profile data** to make optimizations that AOT compilers (like C++) cannot. For example, if an \`if\` statement evaluates to \`true\` 99.9% of the time, C2 will optimize the code assuming it is always true, placing a deoptimization trap for the rare 0.1% case.
      
      ### Key JIT Optimizations
      
      - **Method Inlining**: The most important optimization. The JIT replaces a method call with the actual body of the method, eliminating the overhead of creating stack frames and jumping to new memory addresses.
      - **Escape Analysis**: If the JIT proves that an object allocated via \`new\` never "escapes" the method (i.e., its reference is not returned or assigned to a global variable), it may allocate the object's fields directly on the **JVM Stack** instead of the Heap. This means zero garbage collection!
      - **Loop Unrolling**: Reducing the number of loop iterations by executing multiple operations per loop cycle, minimizing branch predictions and jump instructions.
      - **Dead Code Elimination**: Removing code paths that the profiling data proves are never executed.
      
      ### GraalVM and Ahead-Of-Time (AOT)
      
      While JIT is fantastic for peak throughput, it suffers from **Cold Starts** (the time it takes to warm up the JIT). For Serverless environments (like AWS Lambda), this is unacceptable. 
      **GraalVM Native Image** solves this by performing Ahead-Of-Time (AOT) compilation. It analyzes your application at build time and generates a standalone native binary, completely bypassing interpretation and JIT for instantaneous startup.
      
      ### Tiered Compilation Levels
      
      | Tier | Name | When triggered | What it does |
      |------|------|----------------|--------------|
      | **0** | Interpreter | Application startup | Executes bytecode line-by-line; collects profiling data. |
      | **1-3** | C1 Compiler | Method hits basic threshold | Fast compilation with minimal to moderate profiling overhead. |
      | **4** | C2 Compiler | Method hits high threshold | Aggressive compilation utilizing full profiling data for peak performance. |
      
      > [!WARNING]
      > If you run a microbenchmark in a \`main()\` method loop for just 100 iterations, you are benchmarking the *interpreter*, not Java's actual performance. Always use tools like **JMH (Java Microbenchmark Harness)** which automatically handle JIT warmup before measuring.
              `,
              code: [
                {
                  lang: 'java',
                  title: 'Demonstrating JIT Warmup Performance',
                  code: `public class JitWarmupDemo {
      
          public static void main(String[] args) {
              // Run with: java -XX:+PrintCompilation JitWarmupDemo
              // You will see the JVM compiling 'doMath' into native code
              
              System.out.println("Warming up...");
              for (int i = 0; i < 100000; i++) {
                  doMath(i); // Triggers C1, then C2 compilation
              }
      
              System.out.println("Measuring hot performance...");
              long start = System.nanoTime();
              for (int i = 0; i < 100000; i++) {
                  doMath(i);
              }
              long duration = System.nanoTime() - start;
              System.out.println("100,000 iterations took: " + (duration / 1000000.0) + " ms");
          }
      
          // A dummy method to simulate work
          private static double doMath(int input) {
              double result = input;
              for (int i = 0; i < 10; i++) {
                  result = Math.sqrt(result * result + input);
              }
              return result;
          }
      }`
                },
                {
                  lang: 'java',
                  title: 'Escape Analysis (Stack Allocation)',
                  code: `public class EscapeAnalysisDemo {
      
          static class Point {
              int x, y;
              Point(int x, int y) { this.x = x; this.y = y; }
          }
      
          public static void main(String[] args) {
              // Run with: java -XX:+PrintGCDetails EscapeAnalysisDemo
              // Despite creating 100 million objects, you may see ZERO garbage collections!
              // The JIT Escape Analysis proves 'Point' never escapes the loop, 
              // and allocates 'x' and 'y' directly on the stack as local primitives.
              
              long sum = 0;
              for (int i = 0; i < 100_000_000; i++) {
                  sum += createAndSum(i, i + 1);
              }
              System.out.println("Sum: " + sum);
          }
      
          private static int createAndSum(int a, int b) {
              // This object never escapes this method
              Point p = new Point(a, b);
              return p.x + p.y;
          }
      }`
                }
              ],
              flashcards: [
                { q: 'What is the role of the JVM Interpreter?', a: 'It translates bytecode into CPU instructions line-by-line. It starts instantly but executes slowly.' },
                { q: 'What is the JIT compiler?', a: 'The Just-In-Time compiler monitors executing code, identifies frequently executed "hot" methods, and compiles them into highly optimized native machine code at runtime.' },
                { q: 'What is Tiered Compilation?', a: 'A JVM strategy that uses multiple compilation tiers. It starts with the Interpreter (Tier 0), moves to the fast C1 client compiler (Tiers 1-3), and finally to the heavily optimized C2 server compiler (Tier 4) for the hottest code.' },
                { q: 'What is Method Inlining?', a: 'A crucial JIT optimization where the body of a called method is copied directly into the caller\'s code, eliminating the overhead of a method call (stack frame creation).' },
                { q: 'What is Escape Analysis?', a: 'A JIT optimization that determines if an object\'s reference is passed outside the current method or thread. If it does not escape, the JVM may allocate the object on the stack instead of the heap, preventing GC overhead.' },
                { q: 'Why might warmed-up Java code execute faster than AOT compiled C++ code?', a: 'Because the JIT compiler has access to runtime profiling data (e.g., exact branch probabilities, actual class hierarchy loaded) and can perform aggressive, optimistic optimizations that an AOT compiler cannot.' },
                { q: 'What JVM flag allows you to monitor JIT compilation in real-time?', a: '-XX:+PrintCompilation' },
                { q: 'What is GraalVM Native Image?', a: 'A technology that performs Ahead-Of-Time (AOT) compilation of Java bytecode into a standalone native executable, offering instant startup and low memory footprint at the cost of peak JIT throughput.' },
                { q: 'Why is it a mistake to benchmark Java code in a simple main method loop?', a: 'Because the JVM requires a "warmup" period for the JIT compiler to kick in. A naive benchmark will measure the slow interpreter performance, not the optimized native code.' }
              ]
            }
          ]
    },

    {
      id: '1.2',
      title: 'Garbage Collection Internals',
      hours: 5,
      notes: `
# Garbage Collection Internals — From Zero to Senior Level

## What Is Garbage Collection? (Start Here)

In C/C++, you manually \`malloc\` memory and \`free\` it when done. Forget to free it → **memory leak**. Free it too early → **dangling pointer** crash. This is a huge source of bugs.

Java's **Garbage Collector (GC)** does this automatically. You create objects with \`new\`; the GC figures out when you're done with them and reclaims the memory. You never call \`free()\`.

**The key question:** how does the GC know when you're "done" with an object?

Answer: **reachability**. If you can reach an object by following references from a GC root, it's alive. If not, it's garbage.

\`\`\`
GC Roots (always alive):
  - Local variables in any thread's stack frame
  - Static fields of loaded classes
  - Active Java threads themselves
  - JNI references

If object A is reachable from a root → A is ALIVE
If object B is NOT reachable from any root → B is GARBAGE → GC can free it
\`\`\`

> [!TIP]
> GC handles **circular references** correctly. If A references B and B references A, but nothing else references either — both are unreachable and both get collected. Reference-counting (like Python uses) would fail here; tracing GC does not.

---

## Why Generations? The Weak Generational Hypothesis

Researchers observed: **most objects die young**. In a typical web server:
- A request comes in → dozens of temporary objects are created (Strings, DTOs, etc.)
- Request completes in 50ms → all those objects are immediately garbage
- A few objects (caches, connection pools, user sessions) live for hours

This observation — "most objects die young" — is called the **Weak Generational Hypothesis**. It leads to a key design: split the heap into **generations** and collect them separately.

\`\`\`
JAVA HEAP
┌─────────────────────────────────────────────────────────┐
│  YOUNG GENERATION (~25% of heap)                        │
│  ┌──────────────┬──────────────┬────────────────────┐   │
│  │  Eden Space  │ Survivor S0  │   Survivor S1      │   │
│  │  (new objs)  │  (age 1-N)   │   (bounce here)    │   │
│  └──────────────┴──────────────┴────────────────────┘   │
│                                                         │
│  OLD GENERATION / TENURED (~75% of heap)                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Long-lived objects (survived enough minor GCs) │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
\`\`\`

### How Object Lifecycle Works

1. New object created → goes to **Eden** space
2. Eden fills up → triggers a **Minor GC** (also called Young GC)
3. Minor GC scans Eden + one Survivor space
4. Live objects copied to the other Survivor space, age incremented by 1
5. Objects with age ≥ 15 (default, tune with \`-XX:MaxTenuringThreshold\`) → **promoted to Old Gen**
6. Eden and the from-Survivor space are cleared (just a pointer reset — instant!)
7. When Old Gen fills up → **Major GC** or **Full GC** (much more expensive)

**Why is Minor GC cheap?** Because most objects in Eden are dead. You only copy the few survivors. Clearing Eden is just resetting a pointer to the start of the region — O(1).

**Why is Major GC expensive?** Old gen is large, mostly full of live objects, needs to compact everything, and pauses ALL application threads (stop-the-world).

---

## How Marking Works: Mark-Sweep-Compact

Most collectors use a three-phase algorithm:

### Phase 1: Mark
Starting from GC roots, traverse ALL reachable objects and mark them as live. This is like a graph traversal (DFS/BFS). Everything unmarked at the end is garbage.

### Phase 2: Sweep
Scan the heap and reclaim memory occupied by unmarked (dead) objects. Now you have free holes scattered throughout the heap — **fragmentation**.

### Phase 3: Compact (optional, expensive)
Slide all live objects together to eliminate fragmentation, update all references to point to new locations. Makes future allocation fast (pointer bump) but requires pausing all threads.

\`\`\`
Before GC:  [LIVE][dead][LIVE][dead][dead][LIVE][dead][LIVE]
After sweep: [LIVE][    ][LIVE][              ][LIVE][    ][LIVE]
After compact: [LIVE][LIVE][LIVE][LIVE][          free          ]
\`\`\`

---

## The Five Collectors You Must Know

### 1. Serial GC (\`-XX:+UseSerialGC\`)
- Single-threaded for both Minor and Major GC
- **Stop-the-world**: pauses ALL application threads during collection
- Only makes sense for tiny heaps (<100MB) or single-CPU containers
- Never use in production web services

### 2. Parallel GC (\`-XX:+UseParallelGC\`) — "Throughput Collector"
- Multiple GC threads working in parallel → faster collection
- Still stop-the-world, but shorter pauses than Serial
- Optimised for **maximum throughput** — minimise total GC time, not individual pauses
- Good for: batch jobs, data pipelines, scientific computing
- Bad for: low-latency web services (pauses can be 500ms–5s on large heaps)

### 3. G1 GC (\`-XX:+UseG1GC\`) — Default since Java 9

G1 (Garbage-First) is a fundamentally different design. Instead of fixed-size Eden/Old regions, it divides the heap into **~2048 equal-sized regions** (typically 1MB-32MB each). Each region is labelled dynamically as Eden, Survivor, Old, or Humongous (for objects > half region size).

\`\`\`
G1 Heap = grid of regions, each ~2MB:
┌──┬──┬──┬──┬──┬──┬──┬──┐
│E │E │S │O │O │H │E │O │  E=Eden, S=Survivor
├──┼──┼──┼──┼──┼──┼──┼──┤  O=Old,  H=Humongous
│O │E │O │O │E │O │S │E │
├──┼──┼──┼──┼──┼──┼──┼──┤
│O │O │E │H │H │O │O │E │
└──┴──┴──┴──┴──┴──┴──┴──┘
\`\`\`

**Why "Garbage First"?** G1 tracks how much garbage is in each region. It collects the regions with the MOST garbage first — maximising reclaimed memory per pause time.

**Key G1 feature: Pause Target**
\`-XX:MaxGCPauseMillis=200\` (default 200ms)
G1 tries to stay within this target by choosing how many regions to collect per cycle. It's a *goal*, not a guarantee, but G1 usually hits it on reasonably-sized heaps.

G1 also does **concurrent marking** — it marks live objects concurrently with your application running, so the stop-the-world phase only needs to do the final snapshot.

**G1 tuning tips:**
- \`-Xms = -Xmx\` (same initial and max heap) prevents resize overhead
- \`-XX:MaxGCPauseMillis=100\` for stricter latency needs
- \`-XX:G1HeapRegionSize=4m\` if you have many large objects
- Watch for "to-space exhaustion" — G1 falls back to a full STW Full GC

### 4. ZGC (\`-XX:+UseZGC\`) — Java 11+, production-ready Java 15+

ZGC targets **sub-millisecond pauses** even on multi-terabyte heaps. It achieves this by doing almost everything **concurrently** — while your application threads keep running.

How? ZGC uses:
- **Coloured pointers** — stores GC metadata in unused bits of 64-bit pointers
- **Load barriers** — tiny code snippets injected by JIT at every object reference read; they fix up stale pointers in-flight
- **Concurrent relocation** — moves objects while the app runs (other GCs must stop for this)

**Pauses in ZGC:** only ~1ms for root scanning + safepoint sync, regardless of heap size. ZGC was designed for low-latency services (financial trading, real-time gaming, ML inference).

**Trade-offs:** uses ~15% more CPU (for load barriers and concurrent work) and more memory footprint than G1. Don't use it for CPU-bound batch jobs.

### 5. Shenandoah (\`-XX:+UseShenandoahGC\`) — OpenJDK only

Similar goals to ZGC but different implementation. Also concurrent, also sub-millisecond pauses. Uses **Brooks pointers** (forwarding pointers in object header) instead of coloured pointers. Available in OpenJDK, NOT Oracle JDK.

| | G1 | ZGC | Shenandoah |
|---|---|---|---|
| Pause goal | ≤200ms | <1ms | <10ms |
| Concurrent marking | ✅ | ✅ | ✅ |
| Concurrent compaction | ❌ (STW) | ✅ | ✅ |
| Heap size sweet spot | 4GB–16GB | Any (TB scale) | Any |
| CPU overhead | Low | ~15% | ~10% |
| Default | Java 9+ | No | No |

---

## Stop-The-World (STW): Why Pauses Happen

A **safepoint** is a moment when all application threads have reached a safe state (e.g. between bytecode instructions, not in the middle of updating a data structure). The JVM can only safely inspect the heap at safepoints.

When a GC phase needs the world to stop:
1. JVM signals all threads to stop at their next safepoint
2. Threads finish their current instruction and park
3. GC thread does its work
4. Threads resume

The pause = time to reach safepoints + time to do GC work

Long STW pauses cause latency spikes in your service. A 2-second Full GC means your service was completely unresponsive for 2 seconds — all HTTP requests timeout.

---

## Memory Leaks in Java — Yes, They Happen

Common misconception: "Java has GC so there are no memory leaks." Wrong. Memory leaks in Java mean objects that are **reachable but unused** — GC can't collect them because you still hold a reference.

**The five patterns:**

**1. Static collections that grow forever**
\`\`\`java
static Map<String, Object> cache = new HashMap<>();
// If you put() but never evict, this grows unbounded
\`\`\`

**2. Event listeners never removed**
\`\`\`java
button.addActionListener(this);  // holds reference to 'this'
// If button outlives 'this' and you never removeActionListener(), leak
\`\`\`

**3. ThreadLocal not cleaned up**
\`\`\`java
ThreadLocal<HeavyObject> tl = new ThreadLocal<>();
tl.set(new HeavyObject());
// In a thread pool, threads are reused — ThreadLocal survives!
// Must call tl.remove() in a finally block
\`\`\`

**4. Inner classes holding outer reference**
\`\`\`java
class Outer {
    class Inner { }  // Inner holds implicit reference to Outer
    // If Inner escapes (e.g. registered as listener), Outer can't be GC'd
    // Fix: use static nested class instead
}
\`\`\`

**5. Unclosed resources**
\`\`\`java
Connection conn = dataSource.getConnection();
// If you forget conn.close() and there's an exception path, connection leaks
// Fix: always use try-with-resources
\`\`\`

**How to diagnose a memory leak:**
1. Take a heap dump: \`jmap -dump:format=b,file=heap.hprof <pid>\`
2. Open in **Eclipse Memory Analyzer (MAT)**
3. Look at the **Dominator Tree** — which objects retain the most memory?
4. Follow the reference chain back to the GC root — that's your leak

---

## GC Tuning Workflow (Production)

> [!DANGER]
> Never tune GC without measurements. Premature tuning based on guessing GC flags makes things worse.

**Step 1: Enable GC logging**
\`\`\`
-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=20m
\`\`\`

**Step 2: Identify the problem**
- Frequent Minor GCs → allocation rate too high, or survivors too large
- Long Full GCs → old gen too small, or memory leak filling old gen
- Long pauses despite G1 → consider ZGC

**Step 3: Sizing rules of thumb**
- Heap: 2–4× your live data set size (leave room for garbage accumulation)
- \`-Xms = -Xmx\` in production (prevent heap resize overhead)
- Leave OS 1–2GB for Metaspace, thread stacks, native buffers

**Step 4: Collector selection by use case**
- Batch/throughput job → Parallel GC
- Web service, ≤16GB heap → G1 with \`-XX:MaxGCPauseMillis=100\`
- Low-latency service, large heap → ZGC
- Never tune what you don't measure

**Step 5: Tools**
- \`jstat -gcutil <pid> 1000\` — live GC stats every 1 second
- **GCViewer** or **GCEasy** — visualise GC log
- **JFR (Java Flight Recorder)** + **JMC** — production-safe deep profiling
- **async-profiler** — CPU + allocation profiling with low overhead

> [!EU]
> The classic European interview question: *"Your service has periodic 2-second latency spikes. Walk me through how you'd diagnose it."* Strong answer: (1) Check GC logs first — correlate spike timestamps with GC events; (2) If Full GC → take heap dump, find leak with MAT dominator tree; (3) If pause inherent to collector → switch to ZGC; (4) If allocation rate too high → profile with async-profiler to find hot allocation sites and reduce object creation. Showing measurement-first thinking beats reciting flags.
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
      ],
      sections: [
        {
          title: 'GC Fundamentals & Object Reachability',
          notes: `
### Why Garbage Collection Exists

Garbage collection exists to separate **object lifetime** from **programmer memory bookkeeping**. Java code still allocates memory explicitly with \`new\`, but it does not explicitly release heap objects. The JVM watches the object graph, determines which objects can still affect the program, and reuses memory occupied by objects that can no longer be reached.

Manual memory management fails in two opposite ways: freeing too late causes leaks, freeing too early causes use-after-free bugs. Java chooses a different contract: as long as an object is reachable through ordinary Java execution, it remains valid; once it is unreachable, the runtime may reclaim it at any later GC cycle.

> [!TIP]
> GC does not mean memory is infinite. It means unreachable memory is reclaimed automatically. Reachable-but-unused objects are still leaks.

### Reference Counting vs Tracing

Reference counting stores a counter on each object. Assigning a reference increments the counter; overwriting or clearing it decrements the counter. When the counter reaches zero, the object is immediately reclaimable. The model is simple, but it has two hard problems: it adds overhead to every reference update and it cannot reclaim cycles by itself.

Tracing GC, used by modern JVM collectors, starts from a known set of always-live references called **GC roots** and follows references outward. Anything reached by this graph walk is live. Anything not reached is garbage, even if it is part of a cycle.

\`\`\`
GC Roots
  |
  +-- Thread stack local: orderService
  |       |
  |       +-- OrderService
  |              |
  |              +-- Repository
  |                     |
  |                     +-- ConnectionPool
  |
  +-- Static field: AppConfig.INSTANCE
  |       |
  |       +-- AppConfig
  |
  +-- JNI global reference
          |
          +-- NativeHandle

Unreachable island:
  CustomerDraft <----> AddressDraft
       ^                    |
       +--------------------+

The island has references inside itself, but no path from a GC root.
It is garbage.
\`\`\`

> [!SUCCESS]
> The interview phrase is: **Java uses tracing reachability, not simple reference counting.** That is why cycles are collectible.

### GC Roots

GC roots are entry points into the heap. The exact implementation is JVM-specific, but common root categories are stable:

- Local variables and operand stack values in active Java stack frames.
- Static fields of loaded classes.
- Active Java threads and objects used by JVM internals.
- JNI local and global references held by native code.
- Some monitor and synchronization structures while they are active.

Because stack frames change constantly, a local variable can accidentally keep an object alive longer than expected. In tight memory demos you may see people set a large local variable to \`null\`; in production, better scoping and letting methods return is usually cleaner.

### Strong, Soft, Weak, and Phantom Reachability

Java exposes several reference strengths in \`java.lang.ref\`. They do not replace normal references; they let you express how aggressively the GC may clear a reference.

| Reference Type | When collected | Java API | Use case |
|----------------|----------------|----------|----------|
| Strong | Not collected while reachable through a strong path | Ordinary object reference | Normal application ownership |
| Soft | May be cleared under memory pressure after no strong path remains | \`java.lang.ref.SoftReference\` | Memory-sensitive caches, though Caffeine is usually better |
| Weak | Cleared at the next suitable GC after no strong/soft path remains | \`java.lang.ref.WeakReference\`, \`WeakHashMap\` | Canonical maps, metadata keyed by object identity |
| Phantom | Enqueued after final reachability is lost and finalization is complete | \`java.lang.ref.PhantomReference\` | Post-mortem cleanup of off-heap/native resources |

> [!WARNING]
> Soft references are not a high-quality cache policy. They are controlled by GC heuristics, not product requirements. Prefer bounded caches with size and time eviction.

### Object Lifecycle

An object usually follows this path:

1. Allocation request reaches the JVM.
2. Memory is reserved, often by a fast pointer bump in a thread-local allocation buffer.
3. The object header and fields are initialized.
4. Constructor code runs.
5. The object becomes reachable from some variable, field, array slot, or collection.
6. Later, references are overwritten, scopes exit, collections remove entries, or owners are collected.
7. Once no GC-root path reaches it, the object is eligible for collection.
8. A future GC reclaims or evacuates memory.

Eligibility is not collection. \`System.gc()\` is only a request, and modern production JVMs may ignore or delay it depending on flags and collector.

### Minor, Major, and Full GC

A **Minor GC** usually collects the young generation. It is frequent and normally short because most new objects die quickly.

A **Major GC** is commonly used to mean a collection involving the old generation. The phrase is less precise across collectors and log formats than developers think.

A **Full GC** means a broad stop-the-world collection across the heap and often class metadata. Full GCs are expensive because they tend to inspect and compact a large live set.

> [!EU]
> A common European interview prompt is: "If two objects reference each other, can Java collect them?" The senior answer is yes, if neither is reachable from a GC root. Reachability, not reference count, decides liveness.
`,
          code: [
            {
              lang: 'java',
              title: 'Reachability and Cycles',
              code: `public class ReachabilityCycleDemo {
    static class Node {
        final String name;
        Node next;

        Node(String name) {
            this.name = name;
        }

        @Override
        protected void finalize() throws Throwable {
            System.out.println("Collected " + name);
        }
    }

    private static void createUnreachableCycle() {
        Node a = new Node("A");
        Node b = new Node("B");
        a.next = b;
        b.next = a;
        System.out.println("Created cycle: " + a.name + " <-> " + b.name);
    }

    public static void main(String[] args) throws Exception {
        createUnreachableCycle();

        for (int i = 0; i < 5; i++) {
            byte[] pressure = new byte[4 * 1024 * 1024];
            pressure[0] = 1;
            System.gc();
            Thread.sleep(200);
        }

        System.out.println("Cycle had internal references, but no root path.");
    }
}`
            },
            {
              lang: 'java',
              title: 'WeakReference and ReferenceQueue',
              code: `import java.lang.ref.ReferenceQueue;
import java.lang.ref.WeakReference;

public class WeakReferenceQueueDemo {
    static class BigObject {
        private final byte[] data = new byte[8 * 1024 * 1024];
        private final String id;

        BigObject(String id) {
            this.id = id;
        }

        @Override
        public String toString() {
            return id + " bytes=" + data.length;
        }
    }

    public static void main(String[] args) throws Exception {
        ReferenceQueue<BigObject> queue = new ReferenceQueue<>();
        BigObject strong = new BigObject("payload-1");
        WeakReference<BigObject> weak = new WeakReference<>(strong, queue);

        System.out.println("Before clearing strong ref: " + weak.get());
        strong = null;

        while (weak.get() != null) {
            byte[] pressure = new byte[2 * 1024 * 1024];
            pressure[0] = 7;
            System.gc();
            Thread.sleep(100);
        }

        System.out.println("Weak reference cleared: " + (weak.get() == null));
        System.out.println("Reference enqueued: " + (queue.remove(1000) == weak));
    }
}`
            }
          ],
          flashcards: [
            { q: 'What makes an object live in Java?', a: 'An object is live if it is reachable by following references from at least one GC root.' },
            { q: 'Why does tracing GC collect cycles?', a: 'It marks objects reachable from roots. A cycle with no root path is unmarked and therefore collectible.' },
            { q: 'Name four common GC root categories.', a: 'Thread stack locals, static fields of loaded classes, JNI references, and active threads/JVM internal references.' },
            { q: 'What is the difference between eligible for GC and collected?', a: 'Eligible means unreachable. Collected means a later GC cycle actually reclaimed or moved the memory.' },
            { q: 'When is a weak reference cleared?', a: 'After the referent has no strong or soft path, a suitable GC may clear the weak reference and enqueue it if a queue was supplied.' },
            { q: 'What is a phantom reference for?', a: 'It supports cleanup after an object is no longer reachable, commonly for native or off-heap resources.' },
            { q: 'Why are soft references risky for caches?', a: 'They are cleared according to GC memory-pressure heuristics, not predictable business eviction rules.' },
            { q: 'What is usually collected by a Minor GC?', a: 'The young generation: Eden and one survivor space, depending on collector implementation.' },
            { q: 'What makes Full GC dangerous for latency?', a: 'It is usually stop-the-world and may inspect, compact, and update references across a large heap.' },
            { q: 'What is the key weakness of reference counting?', a: 'It cannot reclaim isolated cycles without extra cycle detection and adds overhead to reference updates.' }
          ]
        },
        {
          title: 'Generational GC & Collection Mechanics',
          notes: `
### Weak Generational Hypothesis

The weak generational hypothesis says **most objects die young**. Web requests, JSON parsing, validation objects, temporary collections, builders, streams, and logging strings often live for milliseconds. A much smaller set, such as caches, Spring singletons, connection pools, and session state, survives for a long time.

Generational collectors exploit that shape by collecting young memory often and old memory less often. Young collections are cheap because the collector copies the few survivors instead of processing every dead temporary object individually.

### Heap Generations

Classic generational layouts split the heap into Eden, two survivor spaces, and Old/Tenured. New objects usually start in Eden. Live objects bounce between survivor spaces and age. Objects that survive enough young collections, or do not fit in survivor space, are promoted to Old.

\`\`\`
                         promotion
                            |
                            v
┌────────────────────────────────────────────────────────────────┐
│                         JAVA HEAP                              │
│                                                                │
│  Young Generation                                              │
│  ┌──────────────────┐   Young GC   ┌────────┐   age++          │
│  │ Eden             │ -----------> │  S0    │ <------┐         │
│  │ new objects      │              └────────┘        │         │
│  └──────────────────┘                  |             │         │
│                                        v             │         │
│                                    ┌────────┐ -------┘         │
│                                    │  S1    │                  │
│                                    └────────┘                  │
│                                        |                       │
│                                        | age threshold / space  │
│                                        v                       │
│  Old Generation / Tenured          ┌───────────────────────┐   │
│  long-lived objects                │ promoted objects      │   │
│                                    └───────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
\`\`\`

> [!TIP]
> Survivor spaces are not both active in the same way during a young collection. One is the source, one is the destination, and then they swap roles.

### Promotion Lifecycle

The happy path is:

1. Thread allocates in Eden.
2. Eden fills.
3. Young GC pauses application threads.
4. GC scans roots plus old-to-young references.
5. Live young objects are copied into the empty survivor space.
6. Their age is incremented.
7. Objects above the tenuring threshold, or objects that cannot fit in survivor space, move to Old.
8. Eden and the old survivor space become empty allocation space.

This copying design makes young GC fast when mortality is high. The cost is proportional to live young objects, not total young garbage.

### Card Tables and Remembered Sets

A young GC cannot scan the entire old generation every time just to find references into young objects. That would destroy the benefit of generations. Instead, JVMs use write barriers and metadata structures.

A **card table** divides the heap into small cards, often a few hundred bytes. When application code stores a reference into an object field, a write barrier marks the corresponding card dirty. During young GC, the collector scans only dirty cards that might contain Old-to-Young references.

G1 generalizes this idea with **remembered sets** per region. Each region tracks which other regions may contain references into it. This lets G1 collect selected regions without scanning the whole heap.

> [!WARNING]
> Old-to-young references are why write barriers exist. The JVM adds a tiny cost to reference writes so young GC can remain fast.

### Allocation Fast Path: TLAB

Most Java allocations do not call a slow allocator. Each thread gets a **Thread-Local Allocation Buffer** (TLAB), a small private chunk of Eden. Allocation is usually a pointer bump:

1. Check whether enough bytes remain in the thread's TLAB.
2. Reserve bytes by moving the TLAB pointer.
3. Initialize object header and fields.

No lock is needed on the fast path because the TLAB belongs to one thread. When the TLAB is full, the thread asks the JVM for another chunk or triggers allocation slow-path logic.

### Promotion Failure and Full GC

Promotion fails when live young objects need to move to Old but Old has insufficient contiguous or available space. Depending on collector and JVM version, this can trigger a costly fallback, often a Full GC.

Common causes:

- Old generation is too small for the live data set.
- Allocation rate is high and objects survive longer than expected.
- Survivor spaces are too small, causing premature promotion.
- Humongous or large objects fragment old regions.
- A real memory leak keeps old objects reachable.

| GC event | What is collected | Thread pause | Typical frequency |
|----------|-------------------|--------------|-------------------|
| Young / Minor GC | Eden plus one survivor space; live objects copied to survivor or old | Stop-the-world, usually short | Frequent |
| Mixed GC in G1 | Young regions plus selected old regions with high garbage | Stop-the-world evacuation pause | Periodic after concurrent marking |
| Major GC | Old generation involvement; meaning varies by collector/logs | Often stop-the-world or partly concurrent | Less frequent |
| Full GC | Whole heap and often class metadata | Stop-the-world, usually longest | Rare; a warning sign in services |

> [!SUCCESS]
> For interviews, connect mechanics to cost: young GC is cheap because dead objects cost almost nothing; old/full GC is expensive because live objects dominate the work.
`,
          code: [
            {
              lang: 'java',
              title: 'Allocation Pressure and Young GC',
              code: `import java.util.ArrayList;
import java.util.List;

public class YoungGcPressureDemo {
    public static void main(String[] args) {
        List<byte[]> survivors = new ArrayList<>();

        for (int i = 1; i <= 10_000; i++) {
            byte[] requestBuffer = new byte[32 * 1024];
            requestBuffer[0] = (byte) i;

            if (i % 250 == 0) {
                survivors.add(new byte[128 * 1024]);
            }

            if (survivors.size() > 20) {
                survivors.subList(0, 5).clear();
            }
        }

        System.out.println("Survivor objects retained: " + survivors.size());
        System.out.println("Run with: -Xms64m -Xmx64m -Xlog:gc*");
    }
}`
            },
            {
              lang: 'java',
              title: 'Old-to-Young Reference Shape',
              code: `import java.util.ArrayList;
import java.util.List;

public class OldToYoungReferenceDemo {
    static final class Registry {
        private final List<byte[]> recentPayloads = new ArrayList<>();

        void remember(byte[] payload) {
            recentPayloads.add(payload);
            if (recentPayloads.size() > 100) {
                recentPayloads.remove(0);
            }
        }

        int size() {
            return recentPayloads.size();
        }
    }

    private static final Registry LONG_LIVED_REGISTRY = new Registry();

    public static void main(String[] args) {
        for (int i = 0; i < 50_000; i++) {
            byte[] youngObject = new byte[8 * 1024];
            LONG_LIVED_REGISTRY.remember(youngObject);
        }

        System.out.println("Long-lived registry points to young payloads.");
        System.out.println("Registry size: " + LONG_LIVED_REGISTRY.size());
        System.out.println("A JVM write barrier tracks these old-to-young stores.");
    }
}`
            }
          ],
          flashcards: [
            { q: 'What does the weak generational hypothesis say?', a: 'Most allocated objects become unreachable quickly, so young memory should be collected frequently and cheaply.' },
            { q: 'Where do most new Java objects start?', a: 'In Eden, usually inside the allocating thread\'s TLAB.' },
            { q: 'What happens to objects that survive young GC repeatedly?', a: 'They age in survivor spaces and are eventually promoted to the old generation.' },
            { q: 'Why are two survivor spaces used?', a: 'Copying collectors move live objects from one survivor space to the other, then clear the source space.' },
            { q: 'What is a TLAB?', a: 'A Thread-Local Allocation Buffer: a private Eden chunk that lets a thread allocate with a fast pointer bump.' },
            { q: 'Why does young GC need remembered sets or card tables?', a: 'To find old-generation objects that reference young objects without scanning the entire old generation.' },
            { q: 'What is a write barrier?', a: 'Small JVM-inserted code that records reference writes, such as marking a card dirty.' },
            { q: 'What is promotion failure?', a: 'A young GC has live objects to move to Old, but Old does not have enough suitable space.' },
            { q: 'Why can survivor spaces being too small hurt performance?', a: 'Objects may promote prematurely, increasing old-generation pressure and Full GC risk.' },
            { q: 'What usually makes a Full GC appear in a healthy service?', a: 'It should be rare; if frequent, suspect old-gen pressure, allocation bursts, fragmentation, or a memory leak.' }
          ]
        },
        {
          title: 'Modern GC Algorithms: G1, ZGC, Shenandoah',
          notes: `
### Serial and Parallel GC

Serial GC is simple: one GC thread performs collection work, and application threads stop during collection. It is still relevant for tiny heaps, command-line tools, small containers with one CPU, and teaching.

Parallel GC uses multiple GC threads and optimizes throughput. It can still produce long stop-the-world pauses, but it is excellent when total work completed matters more than tail latency: batch processing, ETL, simulations, and offline jobs.

### G1 GC

G1, the default collector since Java 9, divides the heap into equal-sized regions. A region can be Eden, Survivor, Old, or Humongous. G1 tracks remembered sets for regions and uses concurrent marking to estimate where garbage is concentrated. It then performs evacuation pauses that collect young regions and, after marking, selected old regions. Those old-region evacuations are called mixed collections.

\`\`\`
G1 region grid

┌────┬────┬────┬────┬────┬────┐
│ E  │ E  │ S  │ O  │ O  │ H  │
├────┼────┼────┼────┼────┼────┤
│ E  │ O  │ O  │ E  │ S  │ O  │
├────┼────┼────┼────┼────┼────┤
│ H  │ H  │ O  │ E  │ O  │ F  │
└────┴────┴────┴────┴────┴────┘

E = Eden, S = Survivor, O = Old, H = Humongous, F = Free

Young pause: evacuate E/S regions
Mixed pause: evacuate E/S plus selected O regions with high garbage
\`\`\`

\`-XX:MaxGCPauseMillis=200\` gives G1 a pause target. It is not a promise. G1 uses it to decide how much collection work to attempt per pause. Lower targets usually mean smaller, more frequent pauses and potentially lower throughput.

### ZGC

ZGC is designed for very low latency. It performs marking, relocation, and reference remapping concurrently with the application. Pauses are mostly for root processing and coordination, so pause time is designed to stay tiny even when heaps are very large.

Key ideas:

- **Colored pointers** store GC state in unused pointer bits.
- **Load barriers** run when application code loads object references.
- **Concurrent relocation** moves objects while application threads continue.

> [!TIP]
> ZGC trades some CPU and memory overhead for dramatically lower pause times. It is a latency choice, not a magic throughput booster.

### Shenandoah

Shenandoah has similar latency goals to ZGC: concurrent marking and concurrent compaction. It uses forwarding metadata, commonly explained through Brooks forwarding pointers, so references can be resolved correctly while objects are being moved.

Shenandoah is attractive when you want low pauses in OpenJDK distributions that include it and you are comfortable validating collector behavior for your workload.

### Epsilon GC

Epsilon is the no-op collector. It allocates memory but never reclaims it. When the heap is full, the JVM exits with \`OutOfMemoryError\`.

Why use it?

- Allocation benchmarking without GC noise.
- Short-lived jobs where the process ends before memory fills.
- Testing application behavior on OOM.

> [!WARNING]
> Epsilon is not for normal services. It is a measurement and testing tool.

### Collector Comparison

| Algorithm | Stop-the-world | Heap size sweet spot | Java version | Enable flag | Best for |
|-----------|----------------|----------------------|--------------|-------------|----------|
| Serial GC | Yes, single-threaded | Tiny heaps, single CPU | All modern Java | \`-XX:+UseSerialGC\` | CLI tools, small containers, demos |
| Parallel GC | Yes, parallel workers | Small to large throughput heaps | All modern Java | \`-XX:+UseParallelGC\` | Batch jobs and throughput-first workloads |
| G1 GC | Short evacuation pauses plus concurrent marking | Medium to large heaps, commonly 4GB-64GB | Default since Java 9 | \`-XX:+UseG1GC\` | General services needing balanced latency |
| ZGC | Very short pauses; most work concurrent | Large heaps and low-latency services | Production since Java 15 | \`-XX:+UseZGC\` | Tail-latency-sensitive APIs, large live sets |
| Shenandoah | Very short pauses; most work concurrent | Medium to large heaps | Production in many OpenJDK builds since Java 15 era | \`-XX:+UseShenandoahGC\` | Low-latency OpenJDK workloads |
| Epsilon | No collection pauses because it never collects | Must fit entire run in heap | Java 11+ | \`-XX:+UnlockExperimentalVMOptions -XX:+UseEpsilonGC\` | Allocation tests, OOM behavior tests |

> [!EU]
> If asked "Which collector should we use?", start with requirements: pause SLO, heap size, allocation rate, CPU budget, Java version, and observability. Collector choice is an engineering trade, not a badge.
`,
          code: [
            {
              lang: 'java',
              title: 'Collector and Heap Introspection',
              code: `import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryPoolMXBean;

public class GcIntrospectionDemo {
    public static void main(String[] args) {
        System.out.println("Garbage collectors:");
        for (GarbageCollectorMXBean bean : ManagementFactory.getGarbageCollectorMXBeans()) {
            System.out.println("  " + bean.getName());
            System.out.println("    collections: " + bean.getCollectionCount());
            System.out.println("    time ms:     " + bean.getCollectionTime());
        }

        System.out.println();
        System.out.println("Memory pools:");
        for (MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans()) {
            System.out.println("  " + pool.getName() + " -> " + pool.getType());
        }
    }
}`
            },
            {
              lang: 'java',
              title: 'Latency Probe for Collector Experiments',
              code: `import java.util.ArrayList;
import java.util.List;

public class CollectorLatencyProbe {
    public static void main(String[] args) {
        List<byte[]> retained = new ArrayList<>();
        long worstMicros = 0;

        for (int i = 0; i < 200_000; i++) {
            long before = System.nanoTime();

            byte[] data = new byte[4 * 1024];
            data[0] = (byte) i;
            if (i % 500 == 0) {
                retained.add(new byte[128 * 1024]);
            }
            if (retained.size() > 200) {
                retained.subList(0, 50).clear();
            }

            long elapsedMicros = (System.nanoTime() - before) / 1_000;
            worstMicros = Math.max(worstMicros, elapsedMicros);
        }

        System.out.println("Retained chunks: " + retained.size());
        System.out.println("Worst loop latency in microseconds: " + worstMicros);
        System.out.println("Compare runs with G1, ZGC, Shenandoah, or Parallel GC plus -Xlog:gc*.");
    }
}`
            }
          ],
          flashcards: [
            { q: 'When is Serial GC still reasonable?', a: 'Tiny heaps, single-CPU environments, short CLI tools, and educational demos.' },
            { q: 'What is Parallel GC optimized for?', a: 'Throughput: minimizing total time spent in GC rather than minimizing individual pause latency.' },
            { q: 'How is G1 heap layout different from classic generations?', a: 'G1 uses many equal-sized regions dynamically labeled Eden, Survivor, Old, Humongous, or Free.' },
            { q: 'What is a G1 mixed collection?', a: 'A pause that collects young regions plus selected old regions with high reclaimable garbage.' },
            { q: 'What does -XX:MaxGCPauseMillis do for G1?', a: 'It gives G1 a pause-time goal used to size collection work; it is not a hard guarantee.' },
            { q: 'How does ZGC keep pauses very small?', a: 'It performs most marking, relocation, and remapping concurrently using colored pointers and load barriers.' },
            { q: 'What is a load barrier?', a: 'JIT-inserted logic that runs when reading references, allowing a concurrent collector to fix or validate references.' },
            { q: 'How does Shenandoah compact concurrently?', a: 'It uses forwarding metadata/read barriers so objects can move while application threads continue.' },
            { q: 'What is Epsilon GC?', a: 'A no-op collector that never reclaims memory and fails with OOM when the heap fills.' },
            { q: 'What should drive GC collector selection?', a: 'Latency SLO, heap size, live set, allocation rate, CPU budget, Java version, and operational tooling.' }
          ]
        },
        {
          title: 'GC Tuning & Diagnosing Leaks',
          notes: `
### Enable and Read GC Logs

Modern Java uses unified logging. A strong default for production investigation is:

\`\`\`
-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=20m
\`\`\`

Read logs for patterns, not isolated lines:

- Are pauses correlated with latency spikes?
- Are young collections too frequent?
- Is old occupancy climbing after each cycle?
- Do Full GCs appear?
- Is G1 reporting evacuation failure, humongous allocations, or to-space exhaustion?

> [!TIP]
> Always align GC log timestamps with application latency graphs. The best GC diagnosis starts by proving whether GC and the user-visible symptom happen at the same time.

### Key Metrics

Pause time is the wall-clock time application threads are stopped. Throughput is the percentage of total time not spent in GC. Allocation rate measures how quickly the app creates objects. Promotion rate measures how quickly young survivors move to Old.

A service can have short pauses but terrible throughput if it collects constantly. Another service can have excellent throughput but unacceptable p99.9 latency because of rare long pauses.

### Tools

- **GCViewer**: local visual inspection of GC logs.
- **GCEasy**: hosted GC log analysis with useful summaries.
- **VisualVM**: heap, sampler, thread, and heap-dump inspection.
- **JFR/JMC**: production-safe events, allocation profiling, pauses, safepoints.
- **MAT**: strong heap-dump dominator tree and leak-suspects reports.

### Diagnosing Memory Leaks

Java leaks are usually reachable-but-dead-to-the-business objects. The workflow is:

1. Enable GC logs and confirm old generation grows over time.
2. Capture a heap dump near high occupancy:
   \`jmap -dump:format=b,file=heap.hprof <pid>\`
3. Open the dump in MAT or VisualVM.
4. Sort by retained size in the dominator tree.
5. Follow the reference chain back to a GC root.
6. Fix the owner that keeps stale objects reachable.

> [!WARNING]
> Heap dumps can contain customer data, tokens, passwords, and payloads. Treat them as production secrets.

### Common Leak Patterns

Static collections leak when they grow without eviction. Listeners leak when registered observers are never removed. ThreadLocal leaks happen in pools because the thread outlives the request. Classloader leaks happen when a parent or global object keeps a reference to a class, object, thread, ThreadLocal, or static field from an application classloader.

### G1 Tuning

Start with sizing and evidence:

- Set \`-Xms\` and \`-Xmx\` equal for stable services.
- Choose a heap large enough for live data plus allocation headroom.
- Use \`-XX:MaxGCPauseMillis\` as a goal, not a command.
- Avoid over-tuning young generation unless logs show a clear reason.
- Watch humongous allocations; adjust region size or allocation shape if needed.

| Flag | Description | Example value |
|------|-------------|---------------|
| \`-Xms\` | Initial heap size | \`-Xms4g\` |
| \`-Xmx\` | Maximum heap size | \`-Xmx4g\` |
| \`-XX:+UseG1GC\` | Enables G1 explicitly | \`-XX:+UseG1GC\` |
| \`-XX:MaxGCPauseMillis\` | Target pause goal for G1 | \`-XX:MaxGCPauseMillis=150\` |
| \`-XX:G1HeapRegionSize\` | G1 region size; useful for humongous allocation tuning | \`-XX:G1HeapRegionSize=8m\` |
| \`-XX:InitiatingHeapOccupancyPercent\` | Old occupancy percent that starts concurrent marking | \`-XX:InitiatingHeapOccupancyPercent=30\` |
| \`-XX:ConcGCThreads\` | Threads for concurrent GC phases | \`-XX:ConcGCThreads=4\` |
| \`-XX:ParallelGCThreads\` | Worker threads for parallel pause phases | \`-XX:ParallelGCThreads=8\` |
| \`-XX:+HeapDumpOnOutOfMemoryError\` | Writes heap dump automatically on OOM | \`-XX:+HeapDumpOnOutOfMemoryError\` |
| \`-XX:HeapDumpPath\` | Heap dump output path | \`-XX:HeapDumpPath=/var/log/app/heap.hprof\` |

> [!SUCCESS]
> A senior tuning answer is measurement-first: logs, live-set estimate, allocation profile, heap dump if old gen grows, then small flag changes with before/after evidence.

### Classloader Leak and Fix

Classloader leaks are common in app servers, plugin systems, test frameworks, and hot-reload tooling. The leak shape is: a long-lived parent classloader object stores something loaded by a short-lived child classloader. That child cannot be unloaded, so its classes, static fields, and metadata remain alive.

In the code examples below, a global registry simulates a parent-level singleton. The leak stores plugin objects and their classloaders forever. The fix removes registrations and closes the loader during undeploy.

> [!EU]
> Interviewers like classloader leaks because they test whether you understand that classes themselves are garbage-collected only when their defining classloader becomes unreachable.
`,
          code: [
            {
              lang: 'java',
              title: 'Classloader Leak',
              code: `import javax.tools.JavaCompiler;
import javax.tools.SimpleJavaFileObject;
import javax.tools.ToolProvider;
import java.net.URI;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class ClassLoaderLeakDemo {
    private static final List<Object> GLOBAL_REGISTRY = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        Path dir = Files.createTempDirectory("plugin");
        compilePlugin(dir);

        URLClassLoader pluginLoader = new URLClassLoader(new URL[]{dir.toUri().toURL()}, null);
        Class<?> pluginClass = Class.forName("Plugin", true, pluginLoader);
        Object plugin = pluginClass.getConstructor().newInstance();

        GLOBAL_REGISTRY.add(plugin);

        plugin = null;
        pluginClass = null;
        pluginLoader = null;
        System.gc();

        System.out.println("Registry size: " + GLOBAL_REGISTRY.size());
        System.out.println("The plugin object is still reachable from GLOBAL_REGISTRY.");
        System.out.println("Therefore its defining classloader cannot be collected.");
    }

    private static void compilePlugin(Path dir) throws Exception {
        String source = "public class Plugin { private final byte[] data = new byte[1024 * 1024]; }";
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new IllegalStateException("Run with a JDK, not a JRE.");
        }
        SimpleJavaFileObject file = new SimpleJavaFileObject(URI.create("string:///Plugin.java"), javax.tools.JavaFileObject.Kind.SOURCE) {
            @Override
            public CharSequence getCharContent(boolean ignoreEncodingErrors) {
                return source;
            }
        };
        int exit = compiler.getTask(null, null, null, List.of("-d", dir.toString()), null, List.of(file)).call() ? 0 : 1;
        if (exit != 0) {
            throw new IllegalStateException("Compilation failed");
        }
    }
}`
            },
            {
              lang: 'java',
              title: 'Classloader Leak Fix',
              code: `import javax.tools.JavaCompiler;
import javax.tools.SimpleJavaFileObject;
import javax.tools.ToolProvider;
import java.lang.ref.WeakReference;
import java.net.URI;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ClassLoaderLeakFixDemo {
    private static final Map<String, Object> GLOBAL_REGISTRY = new ConcurrentHashMap<>();

    public static void main(String[] args) throws Exception {
        Path dir = Files.createTempDirectory("plugin");
        compilePlugin(dir);

        URLClassLoader loader = new URLClassLoader(new URL[]{dir.toUri().toURL()}, null);
        Object plugin = Class.forName("Plugin", true, loader).getConstructor().newInstance();
        WeakReference<ClassLoader> loaderRef = new WeakReference<>(loader);

        GLOBAL_REGISTRY.put("plugin-1", plugin);

        GLOBAL_REGISTRY.remove("plugin-1");
        plugin = null;
        loader.close();
        loader = null;

        for (int i = 0; i < 10 && loaderRef.get() != null; i++) {
            byte[] pressure = new byte[2 * 1024 * 1024];
            pressure[0] = 1;
            System.gc();
            Thread.sleep(100);
        }

        System.out.println("Registry size after undeploy: " + GLOBAL_REGISTRY.size());
        System.out.println("Loader collected or ready for collection: " + (loaderRef.get() == null));
    }

    private static void compilePlugin(Path dir) throws Exception {
        String source = "public class Plugin { private final byte[] data = new byte[1024 * 1024]; }";
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new IllegalStateException("Run with a JDK, not a JRE.");
        }
        SimpleJavaFileObject file = new SimpleJavaFileObject(URI.create("string:///Plugin.java"), javax.tools.JavaFileObject.Kind.SOURCE) {
            @Override
            public CharSequence getCharContent(boolean ignoreEncodingErrors) {
                return source;
            }
        };
        boolean ok = compiler.getTask(null, null, null, List.of("-d", dir.toString()), null, List.of(file)).call();
        if (!ok) {
            throw new IllegalStateException("Compilation failed");
        }
    }
}`
            }
          ],
          flashcards: [
            { q: 'What JVM flag enables detailed modern GC logging?', a: '-Xlog:gc*; commonly with file rotation: -Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=20m.' },
            { q: 'Which GC metrics matter most?', a: 'Pause time, throughput, allocation rate, promotion rate, old-gen occupancy, and Full GC frequency.' },
            { q: 'What tool is commonly used for heap-dump dominator analysis?', a: 'Eclipse MAT, especially the dominator tree and leak suspects report.' },
            { q: 'How do you capture a heap dump from a running JVM?', a: 'Use jmap -dump:format=b,file=heap.hprof <pid>, or configure HeapDumpOnOutOfMemoryError for OOM cases.' },
            { q: 'Why can static collections leak?', a: 'Static fields are reachable through loaded classes, so entries remain live until removed or the classloader unloads.' },
            { q: 'Why are ThreadLocals risky in thread pools?', a: 'Pool threads are long-lived, so ThreadLocal values can survive across requests unless remove() is called.' },
            { q: 'What is a classloader leak?', a: 'A long-lived reference keeps a child classloader or its classes/objects reachable, preventing class unloading and metadata cleanup.' },
            { q: 'Why set -Xms equal to -Xmx?', a: 'It avoids runtime heap resizing and makes GC behavior more predictable in stable production services.' },
            { q: 'What does InitiatingHeapOccupancyPercent tune for G1?', a: 'The old-generation occupancy threshold at which G1 starts concurrent marking.' },
            { q: 'What is the safest GC tuning workflow?', a: 'Measure with logs/JFR, identify the bottleneck, change one thing, then compare before and after under realistic load.' }
          ]
        }
      ]
    },

    {
        id: '1.3',
        title: 'Java Memory Model & Safe Publication',
        hours: 4,
        notes: `
    # Java Memory Model (JMM) — From Zero to Senior Level
    
    ## The Problem: Why Do We Need a Memory Model?
    
    In a single-threaded program, instructions execute in order and everything is predictable. But in a multi-threaded program, **three things conspire to make shared memory dangerous:**
    
    ### Problem 1: CPU Caches (Visibility)
    Modern CPUs don't read directly from RAM — they have L1/L2/L3 caches. When thread A writes a value, it goes into A's CPU cache. Thread B on a different CPU core reads from ITS cache, which may still have the old stale value.
    
    \`\`\`
    CPU Core 1 (Thread A)          CPU Core 2 (Thread B)
      L1 Cache: running = true        L1 Cache: running = true (STALE!)
         ↕                                ↕
      L2/L3 Cache                    L2/L3 Cache
         ↕                                ↕
                        RAM: running = false   ← A wrote this
    \`\`\`
    
    Thread B may never see the update! This is a **visibility** problem.
    
    ### Problem 2: Compiler & CPU Reordering (Ordering)
    Both the Java compiler (JIT) and the CPU reorder instructions for performance — as long as the reordering doesn't change the result **within a single thread**. But this can break multi-threaded code.
    
    \`\`\`java
    // Single-threaded: these two lines can be reordered (same result)
    x = 1;          // ← compiler may execute this second
    ready = true;   // ← compiler may execute this first
    
    // Multi-threaded: if another thread reads 'ready' and then 'x',
    // it might see ready=true but x=0 (old value) — broken!
    \`\`\`
    
    ### Problem 3: Non-Atomic Compound Operations (Atomicity)
    Some operations look atomic but aren't:
    \`\`\`java
    count++;   // This is actually THREE operations:
               // 1. READ count from memory
               // 2. ADD 1
               // 3. WRITE result back
    // If two threads do this simultaneously, you can lose increments
    \`\`\`
    
    **The JMM (Java Memory Model)** solves all three by defining exactly what guarantees the language provides and what programmers must do to achieve them.
    
    ---
    
    ## The Happens-Before Relationship
    
    The JMM uses the concept of **happens-before** to describe visibility guarantees formally.
    
    > If action A **happens-before** action B, then all effects of A are **visible** to B.
    
    This is NOT about time (A doesn't necessarily execute before B in wall-clock time). It's about **guaranteed visibility**: if happens-before exists, B is guaranteed to see A's effects.
    
    ### The Six Happens-Before Rules (Memorise These)
    
    **1. Program Order Rule**
    Within a single thread, every action happens-before the next action in program order.
    (Trivial — a thread always sees its own writes)
    
    **2. Monitor Lock Rule**
    An **unlock** of a \`synchronized\` block happens-before every subsequent **lock** of the same monitor.
    \`\`\`java
    synchronized (lock) {
        x = 42;
    }  // ← unlock here
    
    // Later in another thread:
    synchronized (lock) {
        // ← lock here. Guaranteed to see x = 42
        System.out.println(x);
    }
    \`\`\`
    
    **3. Volatile Variable Rule**
    A **write** to a \`volatile\` field happens-before every subsequent **read** of that field.
    \`\`\`java
    volatile boolean ready = false;
    volatile int data = 0;
    
    // Thread A:
    data = 42;        // ← happens-before the volatile write below
    ready = true;     // ← volatile WRITE
    
    // Thread B:
    while (!ready) {} // ← volatile READ (sees ready=true)
    System.out.println(data); // ← guaranteed to see data=42 (because of HB chain)
    \`\`\`
    
    **4. Thread Start Rule**
    \`Thread.start()\` happens-before all actions in the started thread.
    (The new thread sees everything the starting thread did before calling \`start()\`)
    
    **5. Thread Termination Rule**
    All actions in a thread happen-before another thread's \`thread.join()\` returns.
    (After \`join()\` returns, you can safely read results the other thread wrote)
    
    **6. Final Field Rule**
    All writes to \`final\` fields in a constructor happen-before any thread reads those fields (as long as \`this\` doesn't escape the constructor).
    \`\`\`java
    class SafePoint {
        final int x, y;  // final fields are safely published
        SafePoint(int x, int y) { this.x = x; this.y = y; }
    }
    // Even without synchronisation, x and y are guaranteed correct once
    // another thread has a reference to the SafePoint object
    \`\`\`
    
    ---
    
    ## volatile: What It Actually Guarantees (Critical Interview Topic)
    
    \`volatile\` provides TWO guarantees:
    
    ### Guarantee 1: Visibility
    A volatile write is immediately flushed to main memory (or at least made visible to all other CPU caches). A volatile read always reads the latest written value — bypasses the CPU cache.
    
    ### Guarantee 2: Ordering (Memory Barriers)
    A volatile write acts like a **store fence**: all writes before it cannot be reordered to after it.
    A volatile read acts like a **load fence**: all reads after it cannot be reordered to before it.
    
    \`\`\`
    Before volatile write: all preceding writes are committed first
    volatile WRITE
    After volatile write: subsequent operations see the committed state
    \`\`\`
    
    ### What volatile Does NOT Guarantee: Atomicity
    
    \`\`\`java
    volatile int counter = 0;
    
    // Thread A and Thread B both do:
    counter++;  // ← NOT atomic! Still three ops: read, increment, write
    \`\`\`
    
    Two threads can both read \`0\`, both increment to \`1\`, both write \`1\`. You lose one increment. Use \`AtomicInteger\` or \`synchronized\` for compound operations.
    
    > [!WARNING]
    > The #1 volatile mistake: thinking \`volatile\` makes a variable "thread-safe". It only makes SINGLE READ/WRITE operations atomic (for primitive types up to 32 bits; 64-bit longs/doubles need volatile too). For compound operations (\`++\`, check-then-act, read-modify-write), you need atomics or locks.
    
    ---
    
    ## synchronized: The Complete Tool
    
    \`synchronized\` gives you ALL THREE guarantees: visibility, ordering, AND atomicity.
    
    \`\`\`java
    class Counter {
        private int count = 0;
    
        synchronized void increment() {  // acquires monitor lock on 'this'
            count++;  // now atomic — no other thread can enter while we hold the lock
        }            // releases lock — happens-before next lock acquisition
    
        synchronized int get() {
            return count;  // guaranteed to see the latest value written by increment()
        }
    }
    \`\`\`
    
    **synchronized** is the heavy option. It's correct but:
    - Can block threads (contention → threads wait)
    - Cannot be acquired in a non-blocking way (no tryLock)
    - Not always needed — use the lighter tools when appropriate
    
    ---
    
    ## Safe Publication: Handing Objects Between Threads
    
    **Safe publication** means making an object available to other threads in a state where they'll see it fully initialised.
    
    **Unsafe publication:**
    \`\`\`java
    class UnsafeHolder {
        Object obj;
        // Thread A:
        holder.obj = new Object();   // the reference write and constructor
                                     // can be reordered — B might see non-null
                                     // but partially constructed object!
        // Thread B:
        if (holder.obj != null) holder.obj.doSomething(); // NPE or stale state
    }
    \`\`\`
    
    **Safe publication methods:**
    1. Store in a **\`volatile\`** field (volatile write happens-before volatile read)
    2. Store in an **\`AtomicReference\`**
    3. Store in a **\`final\`** field set in the constructor
    4. Store while **holding a lock** (and reader holds the same lock)
    5. Put in a **\`ConcurrentHashMap\`**, \`BlockingQueue\`, or other concurrent collection
    
    ---
    
    ## False Sharing: The Hidden Performance Killer
    
    Modern CPUs move memory in **cache lines** (typically 64 bytes). If two threads write to different variables that happen to be in the same cache line, they compete — each write invalidates the other thread's cache line.
    
    \`\`\`
    Cache line (64 bytes):
    ┌────────────────────────────────────────────────────────────────┐
    │  counter1 (8 bytes) │ counter2 (8 bytes) │  padding (48 bytes) │
    └────────────────────────────────────────────────────────────────┘
    Thread A writes counter1 → invalidates entire cache line
    Thread B (different core) must reload the cache line → now reads counter2
    Thread B writes counter2 → invalidates the line again
    → Thread A must reload...
    → This ping-pong effect can be 10x SLOWER than uncontended access!
    \`\`\`
    
    **Fix: pad to different cache lines**
    \`\`\`java
    // JDK 8+ annotation (requires -XX:-RestrictContended in some JVMs)
    @sun.misc.Contended
    class PaddedCounter {
        volatile long value;
        // @Contended adds 128 bytes of padding around the field
        // ensuring it occupies its own cache line
    }
    \`\`\`
    
    Or manually pad with dummy fields to push variables apart in memory.
    
    > [!TIP]
    > \`LongAdder\` (Java 8+) is faster than \`AtomicLong\` for high-contention counters precisely because it uses an array of cells (spread across cache lines) and only sums them on \`sum()\`. Use \`LongAdder\` for counters, \`AtomicLong\` when you need compare-and-swap.
    
    ---
    
    ## The Singleton Pattern: A JMM Case Study
    
    This is the most-asked JMM interview question. There are four common implementations, only some are correct:
    
    **1. Eager initialisation (always safe, often best):**
    \`\`\`java
    class Singleton {
        // Class initialisation is thread-safe — JVM guarantees it runs once
        private static final Singleton INSTANCE = new Singleton();
        public static Singleton getInstance() { return INSTANCE; }
    }
    \`\`\`
    
    **2. Broken lazy double-checked locking (do NOT use):**
    \`\`\`java
    private static Singleton instance;  // NOT volatile
    public static Singleton getInstance() {
        if (instance == null) {          // check 1 (no lock)
            synchronized (Singleton.class) {
                if (instance == null) {  // check 2 (with lock)
                    instance = new Singleton(); // BROKEN: write of reference can be
                }                              // reordered before constructor finishes
            }
        }
        return instance;  // reader might see non-null but uninitialised!
    }
    \`\`\`
    
    **3. Correct double-checked locking (volatile required):**
    \`\`\`java
    private static volatile Singleton instance;  // volatile fixes the reordering
    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) instance = new Singleton();
            }
        }
        return instance;
    }
    \`\`\`
    
    **4. Initialisation-on-demand holder (elegant, always correct):**
    \`\`\`java
    class Singleton {
        private static class Holder {
            static final Singleton INSTANCE = new Singleton(); // class init = thread safe
        }
        public static Singleton getInstance() { return Holder.INSTANCE; }
        // Holder class is not loaded until getInstance() is first called -> lazy
        // No synchronisation needed — JVM class initialisation handles it
    }
    \`\`\`
    
    > [!EU]
    > When asked "what does \`volatile\` guarantee?", give the three-part answer: (1) **Visibility** — reads always see the latest write; (2) **Ordering** — memory barriers prevent harmful reordering; (3) NOT atomicity — compound operations still need locks or atomics. Then mention the double-checked locking example to prove you understand why. This answer alone separates senior candidates from mid-level.
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
        ],
        sections: [
          {
            title: 'The Visibility Problem & CPU Caches',
            notes: `
    ### Why Threads Can See Stale Data
    
    Modern CPUs are incredibly fast, much faster than main memory (RAM). To bridge this gap, each CPU core has its own **cache hierarchy** (L1, L2, and sometimes a shared L3 cache). When a thread writes a value to a variable, it doesn't write directly to RAM. Instead, it writes to the L1 cache or a **write buffer**. 
    
    \`\`\`text
         CPU Core 1                        CPU Core 2
    ┌──────────────────┐              ┌──────────────────┐
    │ L1 Cache (local) │              │ L1 Cache (local) │
    └──────────────────┘              └──────────────────┘
             ↓                                 ↓
    ┌────────────────────────────────────────────────────┐
    │                  L3 Cache (Shared)                 │
    └────────────────────────────────────────────────────┘
             ↓                                 ↓
    ┌────────────────────────────────────────────────────┐
    │                    Main Memory                     │
    └────────────────────────────────────────────────────┘
    \`\`\`
    
    If Thread A running on Core 1 updates a variable, Thread B running on Core 2 might still read the old value from its own L1 cache. This is known as the **visibility problem**. 
    
    > [!WARNING]
    > Stale data is arguably the most insidious bug in concurrent programming because it may not crash your app immediately, but rather corrupt your state silently over time.
    
    ### Write Buffers and Store-Load Reordering
    
    CPUs use **write buffers** to hold updates before flushing them to cache. This introduces **store-load reordering**. If a thread stores a value and immediately loads another, the CPU might execute the load *before* the store is visible to other cores. 
    
    ### What the JMM Actually Specifies
    
    The **Java Memory Model (JMM)** does not define how your code maps to specific CPU architectures. It is an **abstract model**. It specifies under what conditions a thread is guaranteed to see the effects of another thread's actions. It provides a formal contract (via *happens-before*) that all Java implementations must obey, shielding you from differences between x86, ARM, and other architectures.
    
    ### The Double-Checked Locking Bug
    
    The classic double-checked locking singleton relies on checking if an instance is null before acquiring a lock. Without \`volatile\`, the JVM or CPU might reorder the instantiation.
    
    | Without JMM Guarantees | Potential Consequence |
    | ---------------------- | --------------------- |
    | Stale Cache Reads | Thread processes outdated state indefinitely. |
    | Store-Load Reordering | Thread sees partially-constructed objects. |
    | Unordered Writes | Lock-free structures become wildly inconsistent. |
    
    > [!EU]
    > The JMM was heavily revised in Java 5 (JSR-133) because the original model was broken. It didn't provide strong enough guarantees for final fields, allowing threads to see uninitialised states of ostensibly immutable objects.
            `,
            code: [
              {
                lang: 'java',
                title: 'Visibility Problem in Action',
                code: `public class VisibilityProblem {
        private static boolean stopRequested = false;
    
        public static void main(String[] args) throws InterruptedException {
            Thread backgroundThread = new Thread(() -> {
                int i = 0;
                // Without volatile, this thread may never see stopRequested = true
                while (!stopRequested) {
                    i++;
                }
                System.out.println("Background thread terminated.");
            });
            
            backgroundThread.start();
            Thread.sleep(1000);
            
            stopRequested = true; 
            System.out.println("Main thread set stopRequested to true.");
        }
    }`
              },
              {
                lang: 'java',
                title: 'Classic Double-Checked Locking Bug',
                code: `public class BrokenSingleton {
        private static BrokenSingleton instance; // NO VOLATILE
    
        private BrokenSingleton() {}
    
        public static BrokenSingleton getInstance() {
            if (instance == null) {
                synchronized (BrokenSingleton.class) {
                    if (instance == null) {
                        // This write can be reordered!
                        // Another thread might see a non-null 'instance' 
                        // before the constructor has fully finished executing.
                        instance = new BrokenSingleton(); 
                    }
                }
            }
            return instance;
        }
    }`
              }
            ],
            flashcards: [
              { q: 'Why do threads see stale data in a multi-threaded program?', a: 'Modern CPUs use local L1/L2 caches and write buffers. A thread on Core A may write to its cache, while a thread on Core B reads from its own cache, never seeing Core A\'s update.' },
              { q: 'What is store-load reordering?', a: 'An optimisation where a CPU executes a load operation before a preceding store operation becomes visible to other cores, often due to write buffers.' },
              { q: 'Does the JMM dictate how specific CPU architectures handle memory?', a: 'No, the JMM is an abstract model. It provides a platform-independent contract defining when memory effects are guaranteed to be visible across threads.' },
              { q: 'What was the primary issue with the pre-Java 5 memory model?', a: 'It was broken regarding \'final\' fields, allowing threads to potentially see the default values of final fields even after the constructor had finished.' },
              { q: 'Why does double-checked locking fail without volatile?', a: 'Because the instantiation of the object and the assignment of the reference to the variable can be reordered. Another thread might see a non-null reference to an incompletely constructed object.' },
              { q: 'What is the JVM specification that overhauled the JMM?', a: 'JSR-133, introduced in Java 5.' },
              { q: 'What are the two main consequences of not having JMM guarantees?', a: 'Stale cache reads (visibility issues) and instruction reordering (ordering issues), leading to inconsistent state.' },
              { q: 'Can a thread crash from reading a partially constructed object?', a: 'Yes, reading a partially constructed object can lead to NullPointerExceptions or unexpected application logic errors since the object\'s invariants are not yet established.' }
            ]
          },
          {
            title: 'Happens-Before & volatile',
            notes: `
    ### Happens-Before (HB) Definition
    
    The **happens-before** relationship is the foundation of the JMM. If action A *happens-before* action B, then the effects of A are guaranteed to be **visible** to B, and A is ordered before B. 
    
    > [!TIP]
    > Happens-before is a formal guarantee about visibility and ordering, not necessarily wall-clock time. If there is no happens-before relationship, the JVM is free to reorder instructions.
    
    ### The Essential Happens-Before Rules
    
    | Rule | Description |
    | ---- | ----------- |
    | **Program Order** | Within a thread, an action happens-before the next action in the source code. |
    | **Monitor Lock** | An unlock on a monitor happens-before every subsequent lock on that same monitor. |
    | **Volatile** | A write to a \`volatile\` field happens-before every subsequent read of that same field. |
    | **Thread Start** | A call to \`Thread.start()\` happens-before any action in the started thread. |
    | **Thread Join** | Any action in a thread happens-before any other thread successfully returns from a \`join()\` on that thread. |
    | **Finalizer** | The end of an object's constructor happens-before the start of its \`finalize()\` method. |
    
    ### Volatile Internals: Memory Barriers
    
    When you declare a variable as \`volatile\`, the JVM inserts **memory barriers** (or memory fences) around the variable at the CPU level.
    - **Store Barrier**: Ensures that all writes before the volatile write are committed to memory first.
    - **Load Barrier**: Ensures that all reads after the volatile read load fresh data from main memory.
    
    \`\`\`text
    [All preceding writes committed]
          ↓
    (Store Barrier)
    VOLATILE WRITE
          ↓
    (Load Barrier)
    [All subsequent reads see fresh data]
    \`\`\`
    
    ### Limitations of volatile
    
    \`volatile\` guarantees visibility and ordering, but **not atomicity** for compound actions.
    
    > [!WARNING]
    > Operations like \`counter++\` are actually read-modify-write sequences. If multiple threads perform \`counter++\` on a volatile variable, updates can still be lost because the entire sequence is not atomic.
    
    ### Usage Patterns
    
    **Correct:** State flags (e.g., stopping a loop), double-checked locking (singleton).
    **Incorrect:** Counters, accumulators, or any state that depends on its previous value.
            `,
            code: [
              {
                lang: 'java',
                title: 'Volatile Write-Read establishing Happens-Before',
                code: `public class VolatileHappensBefore {
        int a = 0;
        volatile boolean flag = false;
    
        public void writer() {
            a = 1;          // Step 1: Normal write
            flag = true;    // Step 2: Volatile write (Store barrier placed before this)
        }
    
        public void reader() {
            if (flag) {     // Step 3: Volatile read (Load barrier placed after this)
                // Guaranteed to see a = 1 because Step 1 happens-before Step 2, 
                // Step 2 happens-before Step 3, and HB is transitive!
                System.out.println("a is: " + a);
            }
        }
    }`
              },
              {
                lang: 'java',
                title: 'Volatile Limitation: Lost Updates',
                code: `public class VolatileLimitation {
        private static volatile int count = 0;
    
        public static void main(String[] args) throws InterruptedException {
            Runnable task = () -> {
                for (int i = 0; i < 10000; i++) {
                    count++; // NOT ATOMIC! Read-modify-write
                }
            };
    
            Thread t1 = new Thread(task);
            Thread t2 = new Thread(task);
    
            t1.start(); t2.start();
            t1.join(); t2.join();
    
            // Likely less than 20000 due to race conditions
            System.out.println("Final count: " + count); 
        }
    }`
              }
            ],
            flashcards: [
              { q: 'What does the happens-before relationship guarantee?', a: 'It guarantees that the memory effects of the first action will be visible to the second action, and the first action is ordered before the second.' },
              { q: 'State the Monitor Lock Rule.', a: 'An unlock on a monitor happens-before every subsequent lock on that exact same monitor.' },
              { q: 'State the Volatile Variable Rule.', a: 'A write to a volatile variable happens-before every subsequent read of that exact same volatile variable.' },
              { q: 'How does the JVM enforce volatile semantics at the hardware level?', a: 'By inserting memory barriers (fences) that prevent the CPU from reordering instructions and force caches to flush/invalidate.' },
              { q: 'Is volatile sufficient for a shared counter?', a: 'No. Volatile does not provide atomicity for compound actions like incrementing (read-modify-write). You need atomics or synchronization.' },
              { q: 'What is the Thread Start Rule?', a: 'A call to Thread.start() happens-before any action executed within the newly started thread.' },
              { q: 'What is the transitive property of happens-before?', a: 'If A happens-before B, and B happens-before C, then A happens-before C. This is crucial for reasoning about visibility chains.' },
              { q: 'Can a volatile variable act as a memory fence for other variables?', a: 'Yes. A volatile write prevents preceding writes from being reordered after it, ensuring their visibility to any thread that subsequently reads the volatile variable.' }
            ]
          },
          {
            title: 'synchronized, Locks & Atomics',
            notes: `
    ### Synchronized Intrinsic Locks
    
    Every object in Java has an intrinsic lock (a monitor). Using \`synchronized\` guarantees visibility, ordering, and atomicity. You can synchronize an entire method or a specific block.
    
    > [!SUCCESS]
    > **Historical Context:** In early Java, \`synchronized\` was slow. Modern JVMs use techniques like **lock coarsening** (merging adjacent locks) and **biased locking** (optimizing for the case where only one thread acquires the lock repeatedly) to make it highly performant.
    
    ### ReentrantLock vs synchronized
    
    \`java.util.concurrent.locks.ReentrantLock\` implements the same semantics as \`synchronized\` but offers advanced features:
    
    | Mechanism | Reentrant | Interruptible | Condition support | When to prefer |
    | --------- | --------- | ------------- | ----------------- | -------------- |
    | **synchronized** | Yes | No | Single (wait/notify) | Default choice, simple scopes |
    | **ReentrantLock** | Yes | Yes (\`lockInterruptibly\`) | Multiple (\`newCondition\`) | Timeout (\`tryLock\`), fairness, advanced signaling |
    
    ### ReadWriteLock & StampedLock
    
    For read-heavy workloads, a \`ReentrantReadWriteLock\` allows multiple readers concurrently but exclusive access for writers.
    Java 8 introduced \`StampedLock\`, which provides **optimistic reads**. You grab a stamp, read data, and then validate the stamp. If a writer intervened, you fall back to a full read lock.
    
    ### java.util.concurrent.atomic
    
    The \`java.util.concurrent.atomic\` package (e.g., \`AtomicInteger\`, \`AtomicReference\`) provides lock-free, thread-safe operations on single variables.
    
    ### CAS (Compare-And-Swap) Internals
    
    Atomics are powered by **CAS (Compare-And-Swap)**, a hardware-level instruction.
    A CAS operation takes three operands: a memory location, an expected old value, and a new value. It atomically updates the memory location to the new value *only if* the current value matches the expected old value.
    
    > [!WARNING]
    > **The ABA Problem:** A thread reads value 'A', another thread changes it to 'B', then back to 'A'. The first thread's CAS succeeds, unaware of the intermediate changes. Use \`AtomicStampedReference\` to attach a version number and prevent this.
            `,
            code: [
              {
                lang: 'java',
                title: 'CAS Loop with AtomicReference',
                code: `import java.util.concurrent.atomic.AtomicReference;
    
    public class LockFreeStack<T> {
        private static class Node<T> {
            final T value;
            Node<T> next;
            Node(T value) { this.value = value; }
        }
    
        private final AtomicReference<Node<T>> head = new AtomicReference<>();
    
        public void push(T value) {
            Node<T> newHead = new Node<>(value);
            Node<T> oldHead;
            do {
                oldHead = head.get();
                newHead.next = oldHead;
                // Atomically update head to newHead IF it is still oldHead
            } while (!head.compareAndSet(oldHead, newHead));
        }
    }`
              },
              {
                lang: 'java',
                title: 'ReentrantLock with tryLock',
                code: `import java.util.concurrent.locks.ReentrantLock;
    import java.util.concurrent.TimeUnit;
    
    public class LockTimeoutDemo {
        private final ReentrantLock lock = new ReentrantLock();
    
        public void doWork() {
            try {
                // Attempt to acquire lock for 2 seconds
                if (lock.tryLock(2, TimeUnit.SECONDS)) {
                    try {
                        System.out.println("Lock acquired, doing work...");
                    } finally {
                        lock.unlock();
                    }
                } else {
                    System.out.println("Could not acquire lock, timing out...");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }`
              }
            ],
            flashcards: [
              { q: 'What three guarantees does synchronized provide?', a: 'Visibility, ordering, and atomicity.' },
              { q: 'What is lock coarsening?', a: 'A JVM optimization where multiple adjacent synchronized blocks using the same lock are merged into a single block to reduce locking overhead.' },
              { q: 'What is biased locking?', a: 'A JVM optimization that heavily optimizes the acquisition of a lock by the same thread repeatedly, assuming contention is rare.' },
              { q: 'Name three features of ReentrantLock not found in synchronized.', a: 'Interruptible lock acquisition (lockInterruptibly), timed lock acquisition (tryLock with timeout), and fairness (granting locks to the longest-waiting thread).' },
              { q: 'When should you use a ReadWriteLock?', a: 'In scenarios where data is read frequently but modified infrequently, allowing multiple concurrent readers to improve throughput.' },
              { q: 'What is optimistic reading in StampedLock?', a: 'Reading data without acquiring a full lock, then validating a stamp afterward. If validation fails (a write occurred), it falls back to a pessimistic lock.' },
              { q: 'Explain how Compare-And-Swap (CAS) works.', a: 'It is a hardware instruction that updates a memory location to a new value only if the current value matches the expected old value, doing so atomically.' },
              { q: 'What is the ABA problem and how is it solved?', a: 'It occurs when a value changes from A to B and back to A, tricking a CAS operation into succeeding. Solved using AtomicStampedReference, which pairs the reference with an integer version stamp.' }
            ]
          },
          {
            title: 'Safe Publication & Immutability',
            notes: `
    ### What is Safe Publication?
    
    **Safe publication** is the act of making an object visible to other threads in a way that guarantees they see the object in a fully initialized, consistent state. 
    
    ### Four Ways to Safely Publish
    
    | Publication Mechanism | Guarantee | Caveat |
    | --------------------- | --------- | ------ |
    | **\`volatile\` Field** | HB edge from write to read | Object must be effectively immutable |
    | **Static Initializer** | JVM class loading is thread-safe | Done once at class loading |
    | **\`final\` Field** | Guarantee of visibility after constructor | \`this\` must not escape constructor |
    | **Concurrent Collection** | e.g., \`ConcurrentHashMap\` handles HB | Collection overhead |
    
    ### The Final Field Guarantee
    
    The JMM provides a special guarantee for \`final\` fields: once a constructor completes, any thread that acquires a reference to the newly created object is guaranteed to see the correctly initialized values of its \`final\` fields.
    
    > [!EU]
    > The final field guarantee is what makes immutability so powerful in Java. An immutable object is inherently thread-safe and requires no synchronization to be shared across threads.
    
    ### Immutability Recipe
    
    To create a truly immutable object:
    1. Make all fields \`final\` and \`private\`.
    2. Do not provide setter methods.
    3. If fields are mutable objects, make **defensive copies** in the constructor and getters.
    4. Ensure the class itself is \`final\` so it cannot be overridden.
    5. **Do not leak \`this\` during construction.**
    
    ### The this-escape Anti-pattern
    
    A **this-escape** occurs when an object makes its \`this\` reference available to another thread before its constructor has finished.
    
    > [!WARNING]
    > Common culprits include starting a thread inside a constructor or registering an event listener inside a constructor. The escaping thread might see the object in an inconsistent, partially constructed state.
    
    ### String Immutability and Intern Pool
    
    \`java.lang.String\` is the quintessential immutable class. Because it is immutable, it can be safely shared across threads. This immutability also enables the **String Intern Pool**, where the JVM stores a single copy of identical string literals to save memory.
            `,
            code: [
              {
                lang: 'java',
                title: 'The this-escape Bug and Fix',
                code: `import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class ThisEscapeDemo {
    interface EventSource {
        void registerListener(Consumer<String> listener);
        void fire(String event);
    }

    static class SimpleEventSource implements EventSource {
        private final List<Consumer<String>> listeners = new ArrayList<>();

        @Override
        public void registerListener(Consumer<String> listener) {
            listeners.add(listener);
        }

        @Override
        public void fire(String event) {
            listeners.forEach(listener -> listener.accept(event));
        }
    }

    static class UnsafeEscape {
        private int value;

        UnsafeEscape(EventSource source) {
            source.registerListener(event -> System.out.println("unsafe value=" + this.value));
            this.value = 42;
        }
    }

    static class SafePublication {
        private final int value;

        private SafePublication() {
            this.value = 42;
        }

        static SafePublication createAndRegister(EventSource source) {
            SafePublication instance = new SafePublication();
            source.registerListener(event -> System.out.println("safe value=" + instance.value));
            return instance;
        }
    }

    public static void main(String[] args) {
        SimpleEventSource source = new SimpleEventSource();
        new UnsafeEscape(source);
        SafePublication.createAndRegister(source);
        source.fire("created");
    }
}`
              },
              {
                lang: 'java',
                title: 'Creating an Immutable Object',
                code: `import java.util.Date;

public final class ImmutablePerson {
    private final String name;
    private final Date birthDate; // Date is mutable!

    public ImmutablePerson(String name, Date birthDate) {
        this.name = name;
        this.birthDate = new Date(birthDate.getTime());
    }

    public String getName() {
        return name;
    }

    public Date getBirthDate() {
        return new Date(birthDate.getTime());
    }
}`
              }
            ],
            flashcards: [
              { q: 'What does safe publication mean?', a: 'Making an object reference visible to other threads such that they are guaranteed to see the object in its fully initialized state.' },
              { q: 'How does the JVM treat final fields regarding visibility?', a: 'The JMM guarantees that once a constructor finishes, any thread that sees the object will see the initialized values of its final fields.' },
              { q: 'What is a "this-escape"?', a: 'It occurs when a constructor exposes the "this" reference to another thread before the constructor has fully completed execution.' },
              { q: 'Why is starting a Thread inside a constructor dangerous?', a: 'It can cause a this-escape. The new thread might start executing and accessing the object\'s fields before the constructor finishes initializing them.' },
              { q: 'What is the recommended fix for a this-escape caused by an event listener in a constructor?', a: 'Make the constructor private and use a public static factory method to first instantiate the object, and then register the listener.' },
              { q: 'Why do you need defensive copies for mutable fields in an immutable object?', a: 'Because if you return a direct reference to a mutable field (like a Date or an array), the caller can modify the internal state of your ostensibly immutable object.' },
              { q: 'Why must an immutable class be declared final?', a: 'To prevent subclasses from overriding methods and returning different values or exposing internal state, which would break the immutability contract.' },
              { q: 'How does String immutability benefit memory usage?', a: 'It enables the String Intern Pool. Because Strings cannot change, the JVM can safely cache and reuse identical string literals across the entire application.' },
              { q: 'Name four ways to safely publish an object.', a: '1. Store in a volatile field. 2. Store in an AtomicReference. 3. Initialize as a final field in the constructor. 4. Use a concurrent collection (like ConcurrentHashMap).' }
            ]
          }
        ]
      },

    {
      id: '1.4',
      title: 'JIT Compilation & Performance',
      hours: 3,
      notes: `
# JIT Compilation & Performance — From Zero to Senior Level

## What Is JIT and Why Does It Exist?

When you write Java, \`javac\` compiles your code to **bytecode** — a compact, platform-neutral instruction set. The JVM then has a choice: interpret bytecode (slow but instant) or compile it to native machine code (fast but takes time).

**The problem with ahead-of-time (AOT) compilation** (like C or Go):
- Must compile everything before running — slow startup
- Can't adapt to runtime behaviour
- Optimises based on code structure alone

**The JIT (Just-In-Time) compiler's insight:**
- Start running immediately (via interpreter)
- While running, **profile** which code is actually hot (called frequently)
- **Compile only the hot code** to native — spend compilation effort where it matters
- Use **runtime profile data** to make better optimisation decisions than AOT ever could

This is why a warmed-up Java server often outperforms equivalent C++ code — the JIT knows your actual data distributions, call patterns, and branch outcomes at runtime.

---

## Tiered Compilation: The Five Levels

The JVM uses **five compilation tiers**, and methods move through them as they get hotter:

\`\`\`
Level 0: Interpreter
  - Executes bytecode instruction by instruction
  - Collects method invocation counts and branch-taken statistics
  - ~10-100x slower than compiled code

Level 1: C1 (Client compiler) — no profiling
  - Fast compile, simple optimisations
  - For methods called very frequently but profiling not needed
  - Typically short-lived

Level 2: C1 — limited profiling
  - C1 compile + some profiling instrumentation
  - Balances compile time vs profile data quality

Level 3: C1 — full profiling
  - Full profiling counters inserted
  - The "holding area" before C2 takes over
  - Most methods spend time here collecting data for C2

Level 4: C2 (Server compiler) — heavily optimised
  - Slow compile, but maximum native code quality
  - Uses all the profiling data collected at lower tiers
  - Only for the "hot" methods (top ~5% by execution count)
  - This is where Java gets its peak performance
\`\`\`

\`-XX:+PrintCompilation\` prints each compilation event:
\`\`\`
    113    1       3  java.lang.String::hashCode (55 bytes)
    ^       ^      ^  ^
    time   id    tier  method
\`\`\`

The default compilation thresholds (can tune with \`-XX:CompileThreshold\`):
- Level 3 → Level 4: ~10,000 invocations OR ~10,000 back-edges (loop iterations)

---

## The Key JIT Optimisations

### 1. Method Inlining (The Most Important One)

When a method is called, the JIT replaces the call site with the method's body — eliminating the call overhead and, more importantly, **enabling further optimisations** by giving the compiler visibility into more code at once.

\`\`\`java
// Your code:
int result = add(a, b);
int add(int x, int y) { return x + y; }

// After JIT inlining — no method call overhead:
int result = a + b;  // now further optimisations can work on the combined code
\`\`\`

The JIT inlines aggressively by default (up to \`-XX:MaxInlineSize=35\` bytes, \`-XX:FreqInlineSize=325\` bytes for hot methods). Large methods can't be inlined — keep hot methods small.

> [!WARNING]
> If you mark a class \`final\` or a method \`private\`/\`final\`, you're telling the JIT "there's only one implementation" — enabling better inlining of virtual calls. Not necessary to obsess over, but worth knowing.

### 2. Escape Analysis — No Heap Allocation Needed

The JIT analyses whether an object can "escape" its creating method (be stored in a field, returned, or passed to another thread). If not, the object can be:

- **Scalar replaced**: decomposed into individual fields stored in CPU registers — zero heap allocation, zero GC pressure
- **Stack allocated**: placed on the stack frame (conceptually) — no GC involvement
- **Lock elided**: synchronized blocks on non-escaping objects have their locks removed

\`\`\`java
void processPoint(int x, int y) {
    Point p = new Point(x, y);  // p doesn't escape this method
    return p.x * p.x + p.y * p.y;
    // JIT may scalar-replace p: no Point object ever created on the heap!
    // Equivalent to: return x*x + y*y
}
\`\`\`

Disable with \`-XX:-DoEscapeAnalysis\` to see the performance difference.

### 3. Loop Optimisations

**Loop unrolling:** Executes loop body multiple times per iteration to reduce branch overhead:
\`\`\`java
// Original:
for (int i = 0; i < 8; i++) sum += arr[i];

// Unrolled (JIT may do this automatically):
sum += arr[0]; sum += arr[1]; sum += arr[2]; sum += arr[3];
sum += arr[4]; sum += arr[5]; sum += arr[6]; sum += arr[7];
\`\`\`

**Vectorisation (SIMD):** The JIT can use SIMD CPU instructions to process multiple array elements in parallel (e.g. add 4 ints in one CPU instruction). This is why \`Arrays.sum()\` can be faster than a manual loop on JDK 17+.

**Bounds check elimination:** For loops with predictable bounds, the JIT removes per-iteration array bounds checks.

### 4. Devirtualisation and Polymorphic Inline Caches

Virtual method calls (\`interface.method()\`) are slower than direct calls because the JVM must look up which implementation to call. JIT tracks:

- **Monomorphic**: always the same class → compile as direct call (fast as non-virtual)
- **Bimorphic**: two classes → compile as if/else of two direct calls
- **Megamorphic**: many classes → use a dispatch table (inline cache)

This is why interfaces at hot call sites with too many implementations can be a performance concern. The JIT **deoptimises** back to interpreter if its assumptions turn out wrong (e.g. it assumed monomorphic but a new subclass shows up).

### 5. Dead Code Elimination

\`\`\`java
boolean DEBUG = false;
if (DEBUG) { expensiveLogging(); }  // JIT removes this entirely
\`\`\`

The JIT also removes unreachable code paths, simplifies constant expressions, and propagates constants through the code.

---

## Deoptimisation: Speculative Optimisation Safety Net

JIT makes **speculative** optimisations based on observed behaviour:
- "This call site is always \`ArrayList\` — I'll devirtualise it"
- "This branch is always false — I'll remove it"

If assumptions become invalid at runtime, the JIT **deoptimises** — discards the compiled version and returns to the interpreter (or a lower compilation tier). Deoptimisation is rare but has overhead.

\`-XX:+PrintDeoptimization\` shows when it happens.

---

## How to Measure Performance Correctly

### The Wrong Way (What Most People Do)

\`\`\`java
long start = System.nanoTime();
for (int i = 0; i < 1_000_000; i++) result = myMethod(i);
long time = System.nanoTime() - start;
System.out.println(time / 1_000_000 + " ns/op");  // WRONG
\`\`\`

Problems:
1. **No warmup** — first iterations are interpreted (much slower), skewing results
2. **Dead code elimination** — JIT sees \`result\` is never used → eliminates \`myMethod()\` entirely → you're measuring nothing
3. **Single JVM fork** — JIT state from other code affects results
4. **No statistical analysis** — one measurement is meaningless

### The Right Way: JMH (Java Microbenchmark Harness)

\`\`\`java
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Warmup(iterations = 5, time = 1)    // 5 warmup iterations discarded
@Measurement(iterations = 10, time = 1) // 10 measurement iterations
@Fork(3)                              // run in 3 separate JVM processes
@State(Scope.Benchmark)
public class MyBenchmark {
    @Param({"100", "1000", "10000"})  // test multiple input sizes
    int size;

    @Benchmark
    public int measureMyMethod(Blackhole bh) {
        int result = myMethod(size);
        bh.consume(result);   // prevent dead-code elimination
        return result;
    }
}
\`\`\`

JMH handles: warmup, fork isolation, dead-code prevention via Blackhole, statistical output (mean, confidence interval, percentiles).

---

## Production Profiling (After Warmup)

For production performance issues, use **async-profiler** or **Java Flight Recorder (JFR)**:

\`\`\`bash
# async-profiler: CPU flame graph (shows where time is actually spent)
./profiler.sh -d 30 -f flamegraph.html <pid>

# JFR (built into JDK 11+, production safe, <1% overhead)
jcmd <pid> JFR.start duration=60s filename=recording.jfr
jcmd <pid> JFR.stop
# Open recording.jfr in JDK Mission Control (JMC)
\`\`\`

**Flame graphs** show call stacks over time — widest frames are where time is spent. Look for:
- Wide frames = hot code = optimisation targets
- Unexpected frames (GC, locking) = systemic issues

---

## GraalVM Native Image: AOT for Java

**GraalVM Native Image** compiles your entire Java application to a standalone native binary — ahead of time, no JVM needed at runtime.

| | Traditional JVM | Native Image |
|---|---|---|
| Startup | Seconds (warm-up) | Milliseconds |
| Peak throughput | Very high (JIT optimised) | Lower (no JIT) |
| Memory footprint | High (JVM overhead) | Very low |
| Build time | Fast | Slow (minutes) |
| Reflection | Works automatically | Needs config file |
| Dynamic classloading | Works | Not supported |
| Best for | Long-running services | Serverless, CLI tools, containers |

Spring Boot 3 + GraalVM Native Image is increasingly used for **serverless functions** (AWS Lambda, Google Cloud Run) where cold start time matters.

> [!EU]
> The rigour question: *"How did you measure that your code was actually slow? How do you know your optimisation helped?"* Answer: JMH for micro-benchmarks (with warmup, multiple forks, Blackhole), async-profiler flame graphs for production CPU hotspots, JFR for system-level view. Saying "I ran it a few times and it felt faster" is the wrong answer for a German engineering team.
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
      ],
      sections: [
        {
          title: 'Why Interpretation is Slow & How JIT Helps',
          notes: `
### Interpreting Bytecode

The JVM can run bytecode immediately by interpreting it. The interpreter reads one bytecode instruction, decodes it, executes the corresponding VM routine, then repeats. This is excellent for startup because no compilation delay is paid up front.

The cost is that every bytecode instruction has dispatch overhead. The interpreter cannot use CPU registers as aggressively as native code, cannot schedule instructions deeply for the current processor, and repeatedly pays for generic bytecode semantics. A tight Java loop interpreted instruction-by-instruction is doing useful work plus a lot of VM bookkeeping.

### What JIT Changes

The Just-In-Time compiler watches running code and compiles hot paths into native machine code. The compiled version can use native registers, CPU instructions, branch prediction, inlining, escape analysis, and layout choices informed by real runtime profiles.

\`\`\`
time ───────────────────────────────────────────────────────────────>

cold start        interpret          warm JVM          JIT compiled       peak
    |                |                   |                  |              |
    v                v                   v                  v              v
load classes -> bytecode dispatch -> counters hot -> native code -> optimized steady state
startup fast       slow per op       profile data      fast per op       best throughput
\`\`\`

> [!TIP]
> Java performance is often a story of phases. The first request after startup and the millionth request on a warmed service are not measuring the same machine.

### JIT vs AOT

Ahead-of-time compilation produces native code before execution. It can start quickly because compilation already happened, but it cannot observe production runtime behavior before choosing optimizations. JIT pays compilation cost during execution but can optimize the exact hot methods, receiver types, branch behavior, and allocation patterns it observes.

| Approach | Startup | Peak perf | Portability | Example |
|----------|---------|-----------|-------------|---------|
| Bytecode interpretation | Very fast | Low | Excellent; bytecode runs on any JVM | Early JVM startup, cold code |
| JIT compilation | Moderate warm-up | Very high | Excellent at bytecode level; native code generated per machine | HotSpot C1/C2, Graal JIT |
| Traditional AOT | Fast runtime startup after build | Good, but less adaptive | Binary is OS/CPU-specific | C, Go, Rust binary |
| GraalVM Native Image | Millisecond startup | Often lower than warmed JVM | Binary is OS/CPU-specific | Serverless Java function |

### Warm-Up

Warm-up is the period where code moves from interpreted execution to profiled C1 code and then to optimized C2 or Graal code. During warm-up, class loading, bytecode verification, profiling counters, tier transitions, and compilation all affect latency.

This is why benchmarking a cold JVM is usually meaningless for long-running services. Cold timing measures startup, class loading, and interpretation. It does not measure the steady-state throughput the service will deliver after warm-up.

> [!WARNING]
> A single \`System.nanoTime()\` loop around one call is not a Java benchmark. The JIT may not have compiled the code yet, or it may optimize the whole measurement away.

### JMH Is the Correct Tool

JMH exists because benchmarking JVM code is surprisingly hostile. It handles warm-up, multiple forks, dead-code prevention, parameterization, compiler barriers, and statistical reporting. If a microbenchmark matters enough to influence an engineering decision, it matters enough to use JMH.

> [!SUCCESS]
> Strong interview answer: use JMH for microbenchmarks, JFR or async-profiler for real application profiling, and always separate cold-start questions from steady-state throughput questions.

### A Practical Mental Model

For CLI tools and serverless functions, startup dominates. For long-running APIs, peak steady-state throughput and tail latency after warm-up dominate. For batch jobs, throughput and allocation rate often matter more than first-operation latency. The best runtime strategy depends on which phase users actually experience.

> [!EU]
> A common interview challenge is: "Our Java code is slow on the first request. Is Java slow?" A precise answer distinguishes class loading and JIT warm-up from steady-state performance, then proposes warm-up traffic, CDS/AppCDS, native image, or architectural changes depending on the product requirement.
`,
          code: [
            {
              lang: 'java',
              title: 'Cold vs Warm Timing Demo',
              code: `public class ColdWarmTimingDemo {
    static long work(int n) {
        long acc = 0;
        for (int i = 1; i <= n; i++) {
            acc += (long) i * 31;
            acc ^= (acc << 7);
        }
        return acc;
    }

    static long timeBatch(int calls, int size) {
        long sink = 0;
        long start = System.nanoTime();
        for (int i = 0; i < calls; i++) {
            sink += work(size + (i & 7));
        }
        long elapsed = System.nanoTime() - start;
        if (sink == 42) {
            System.out.println("impossible");
        }
        return elapsed;
    }

    public static void main(String[] args) {
        long cold = timeBatch(1_000, 2_000);

        for (int i = 0; i < 20; i++) {
            timeBatch(1_000, 2_000);
        }

        long warm = timeBatch(1_000, 2_000);
        System.out.printf("Cold batch: %.3f ms%n", cold / 1_000_000.0);
        System.out.printf("Warm batch: %.3f ms%n", warm / 1_000_000.0);
        System.out.println("Run with -XX:+PrintCompilation to see compilation activity.");
    }
}`
            },
            {
              lang: 'java',
              title: 'Naive Benchmark Pitfall',
              code: `public class NaiveBenchmarkPitfall {
    static int compute(int x) {
        int y = x;
        y = y * 31 + 17;
        y ^= y >>> 3;
        return y;
    }

    static long wrongBenchmark() {
        long start = System.nanoTime();
        for (int i = 0; i < 100_000_000; i++) {
            compute(i);
        }
        return System.nanoTime() - start;
    }

    static long lessWrongBenchmark() {
        int sink = 0;
        long start = System.nanoTime();
        for (int i = 0; i < 100_000_000; i++) {
            sink ^= compute(i);
        }
        long elapsed = System.nanoTime() - start;
        System.out.println("sink=" + sink);
        return elapsed;
    }

    public static void main(String[] args) {
        System.out.printf("Wrong benchmark: %.3f ms%n", wrongBenchmark() / 1_000_000.0);
        System.out.printf("Less wrong benchmark: %.3f ms%n", lessWrongBenchmark() / 1_000_000.0);
        System.out.println("Still use JMH for real decisions: warmup, forks, Blackhole, stats.");
    }
}`
            }
          ],
          flashcards: [
            { q: 'Why is bytecode interpretation slower than compiled native code?', a: 'Each bytecode instruction pays decode/dispatch overhead and runs through generic VM machinery instead of optimized CPU-specific instructions and registers.' },
            { q: 'What does the JIT compiler compile?', a: 'Hot methods and hot loop paths observed at runtime, not every method in the program immediately.' },
            { q: 'Why can JIT beat static AOT for long-running services?', a: 'It uses runtime profile data such as receiver types, branch probabilities, and allocation behavior to optimize actual hot paths.' },
            { q: 'What is JVM warm-up?', a: 'The period where code is interpreted, profiled, compiled by lower tiers, and eventually optimized into high-quality native code.' },
            { q: 'Why is cold JVM benchmarking misleading?', a: 'It includes class loading, verification, interpretation, and compilation transitions rather than steady-state optimized execution.' },
            { q: 'When is AOT or native image attractive?', a: 'When startup time and memory footprint matter more than warmed peak throughput, such as serverless and CLI tools.' },
            { q: 'What does JMH protect against?', a: 'Missing warm-up, dead-code elimination, JVM state pollution, insufficient forks, and poor statistical measurement.' },
            { q: 'What is a benchmark fork in JMH?', a: 'A separate JVM process used to isolate measurements from prior JVM state and compilation history.' },
            { q: 'What is the difference between startup and peak performance?', a: 'Startup is time to begin useful work; peak performance is optimized steady-state throughput after warm-up.' },
            { q: 'Which tool should you use for a Java microbenchmark?', a: 'JMH, the Java Microbenchmark Harness.' }
          ]
        },
        {
          title: 'Tiered Compilation: C1 & C2',
          notes: `
### The Five Tiers

HotSpot uses tiered compilation so it does not spend expensive compiler time on code that may never matter. The interpreter starts execution immediately. C1 compiles quickly and can add profiling. C2 compiles more slowly but produces aggressive optimized code for methods that prove important.

| Tier | Name | Trigger | Compile time | Code quality |
|------|------|---------|--------------|--------------|
| 0 | Interpreter | First execution and cold code | None | Lowest, but instant startup |
| 1 | C1 simple | Method gets warm; profiling not needed | Very fast | Basic native code |
| 2 | C1 limited profile | More profiling useful | Fast | Basic code plus limited counters |
| 3 | C1 full profile | Hot enough to collect rich data | Fast to moderate | Good code and profile data |
| 4 | C2 optimized | Very hot method or loop | Slowest | Highest HotSpot peak quality |

### C1 Compiler

C1 is the client compiler. It is optimized for compilation speed. It performs basic optimizations, emits native code quickly, and can insert profiling counters that C2 later consumes. C1 is why warm Java applications improve quickly instead of waiting for every hot method to reach C2.

### C2 Compiler

C2 is the server compiler. It performs aggressive optimizations such as inlining, escape analysis, devirtualization, loop transformations, and global code motion. It is slower to compile, so the JVM reserves it for the hottest methods and loops.

### Promotion Between Tiers

The JVM tracks method invocation counters and loop back-edge counters. When counters cross policy thresholds, the method may be queued for compilation. \`-XX:CompileThreshold\` influences when compilation begins, though tiered policy has additional heuristics beyond one simple number.

\`\`\`
method invoked
     |
     v
is method hot?
     | no
     v
interpret at tier 0
     |
     +-----------------------------+
                                   |
yes                                |
 |                                 |
 v                                 |
compile with C1? ---- no ----------+
 | yes
 v
tier 1/2/3 native code + profiling
 |
 v
hot enough for C2 or hot loop?
 | no
 v
keep C1 code
 |
yes
 |
 v
C2 compile tier 4
 |
 v
assumption violated? -- yes --> deoptimise -> interpreter/C1 -> reprofile
 |
no
 |
 v
run optimized native code
\`\`\`

### OSR

On-Stack Replacement lets the JVM replace an actively running interpreted loop with compiled code. Without OSR, a long-running loop might remain interpreted until the method returns and is called again. With OSR, a hot loop can jump into compiled code while it is already on the stack.

> [!TIP]
> OSR explains why \`-XX:+PrintCompilation\` sometimes shows entries with a percent sign. They are loop compilations entered while a method is already running.

### Deoptimisation

JIT optimizations are speculative. If profiling says a call site always receives \`ArrayList\`, C2 may compile a direct call. If a new implementation appears later, the assumption can fail. The JVM then deoptimizes: it maps native state back to interpreter state, resumes safely, and may recompile with broader assumptions.

Common deoptimization triggers include class loading that invalidates hierarchy assumptions, call sites becoming megamorphic, uncommon branches suddenly becoming common, and debugging or instrumentation changing execution conditions.

> [!WARNING]
> Deoptimization is a correctness feature, not a bug. It lets the JVM optimize aggressively while preserving Java's dynamic loading and polymorphism semantics.

> [!SUCCESS]
> Senior-level explanation: tiered compilation is a budget allocator. It spends cheap compiler time early to get speed and profile data, then spends expensive C2 time only where runtime evidence says it will pay off.
`,
          code: [
            {
              lang: 'java',
              title: 'Hot Method Tier Promotion',
              code: `public class TierPromotionDemo {
    static int score(String value) {
        int result = 0;
        for (int i = 0; i < value.length(); i++) {
            result = result * 31 + value.charAt(i);
        }
        return result;
    }

    public static void main(String[] args) {
        long sink = 0;
        for (int round = 0; round < 200_000; round++) {
            sink += score("customer-" + (round & 255));
        }
        System.out.println("sink=" + sink);
        System.out.println("Run with: -XX:+PrintCompilation -XX:+TieredCompilation");
    }
}`
            },
            {
              lang: 'java',
              title: 'OSR Long-Running Loop Demo',
              code: `public class OsrLoopDemo {
    public static void main(String[] args) {
        long sum = 0;
        long start = System.nanoTime();

        for (int i = 0; i < 600_000_000; i++) {
            sum += (i * 17L) ^ (i >>> 3);
            if (i == 10_000_000) {
                System.out.println("Loop is still running; OSR may compile it before method return.");
            }
        }

        long elapsed = System.nanoTime() - start;
        System.out.println("sum=" + sum);
        System.out.printf("elapsed %.3f ms%n", elapsed / 1_000_000.0);
        System.out.println("Run with -XX:+PrintCompilation and look for % OSR compilations.");
    }
}`
            }
          ],
          flashcards: [
            { q: 'What is tier 0 in HotSpot tiered compilation?', a: 'The bytecode interpreter.' },
            { q: 'What are tiers 1 through 3?', a: 'C1 compiled code at different profiling levels, from simple native code to fully profiled C1 code.' },
            { q: 'What is tier 4?', a: 'C2 optimized server-compiler code.' },
            { q: 'Why does the JVM use C1 before C2?', a: 'C1 compiles quickly and gathers profile data, while C2 is slower but produces better optimized code.' },
            { q: 'What counters make code hot?', a: 'Method invocation counters and loop back-edge counters.' },
            { q: 'What is OSR?', a: 'On-Stack Replacement: switching a currently running interpreted loop to compiled code before the method returns.' },
            { q: 'What does -XX:CompileThreshold influence?', a: 'How hot code generally must become before compilation is considered, though tiered policy has more heuristics.' },
            { q: 'What is deoptimisation?', a: 'Discarding compiled code and returning to a safer tier when a speculative JIT assumption becomes invalid.' },
            { q: 'How can class loading trigger deoptimization?', a: 'A newly loaded subclass can invalidate assumptions about a call site or class hierarchy.' },
            { q: 'What does a megamorphic call site do to optimization?', a: 'It makes devirtualization and inlining harder because many receiver types appear at the same call site.' }
          ]
        },
        {
          title: 'Key JIT Optimisations',
          notes: `
### Method Inlining

Inlining replaces a method call with the callee body. It removes call overhead, but the bigger win is that it exposes more code to later optimizations. Once a getter, helper, or strategy method is inline, constants can fold, allocations can disappear, and virtual calls can become direct.

\`\`\`java
// before
int tax = calculateTax(order.total());

// after conceptual inlining
int tax = (int) (order.totalCents * 0.18);
\`\`\`

HotSpot uses size thresholds such as \`-XX:MaxInlineSize\` for small methods and larger thresholds for very hot methods. Large hot methods can block optimization because they are too expensive or risky to inline.

### Escape Analysis

Escape analysis asks whether an object can be observed outside the current method or thread. If it cannot escape, C2 may avoid heap allocation. Scalar replacement decomposes the object into fields held in registers or stack slots. Lock elision removes synchronization when the locked object is proven thread-local.

### Loop Optimisations

Loops are where CPU time often lives. The JIT can unroll loops to reduce branch overhead, hoist invariant work out of loops, remove bounds checks when index ranges are proven safe, and sometimes vectorize operations into SIMD instructions.

### Dead Code Elimination and Constant Folding

If a value is computed but never used, the JIT can remove it. If an expression depends only on constants, it can be folded. This is good for production code and dangerous for naive benchmarks because the measured work can vanish.

### Devirtualisation

The JVM profiles receiver types at call sites:

- **Monomorphic**: one receiver type. Best case; direct call and inline likely.
- **Bimorphic**: two receiver types. Often optimized with type checks and two direct paths.
- **Megamorphic**: many receiver types. Harder to inline; dispatch remains more generic.

### Intrinsics

Intrinsics are special JVM implementations for important methods. Instead of compiling Java bytecode literally, the JVM emits optimized CPU-specific code. Examples include \`String.equals\`, \`System.arraycopy\`, \`Arrays.copyOf\`, \`Math.sqrt\`, some VarHandle/Unsafe operations, and cryptographic primitives on supported CPUs.

| Optimisation | What it does | When it kicks in | How to verify |
|--------------|--------------|------------------|---------------|
| Inlining | Copies callee body into caller | Hot call site and method small/hot enough | \`-XX:+PrintInlining\`, JITWatch |
| Escape analysis | Proves object does not escape | C2 optimization of hot code | Compare with \`-XX:-DoEscapeAnalysis\`, allocation profiler |
| Scalar replacement | Replaces object with fields | After successful escape analysis | JFR allocation events, GC allocation rate |
| Lock elision | Removes locks on non-escaping objects | Synchronization proven thread-local | JITWatch, perf difference with EA disabled |
| Loop unrolling | Reduces loop branch overhead | Hot loops with predictable bounds | Assembly/JITWatch, benchmark carefully |
| Bounds-check elimination | Removes repeated array bounds checks | Index range proven safe | JITWatch, assembly, perf counters |
| Dead-code elimination | Removes unused work | Value has no observable effect | JMH Blackhole prevents accidental removal |
| Constant folding | Precomputes constant expressions | Inputs are compile-time or profiled constants | JIT logs/JITWatch |
| Devirtualisation | Converts virtual call to direct call | Monomorphic or bimorphic profile | \`-XX:+PrintInlining\`, JITWatch |
| Intrinsics | Uses JVM/CPU special implementation | Recognized JDK method on supported platform | \`-XX:+PrintIntrinsics\`, assembly |

> [!TIP]
> Inlining is often the first domino. Many impressive JIT optimizations only become possible after call boundaries disappear.

> [!WARNING]
> Do not contort clean code purely for imagined JIT wins. Measure first; modern HotSpot is very good at optimizing ordinary, simple Java.

> [!SUCCESS]
> A useful rule: small cohesive methods are usually JIT-friendly because they inline well, and they are also human-friendly because they are easier to understand.
`,
          code: [
            {
              lang: 'java',
              title: 'Inlining Before and After Concept',
              code: `public class InliningConceptDemo {
    static int addTax(int cents) {
        return cents + tax(cents);
    }

    static int tax(int cents) {
        return cents / 10;
    }

    static int conceptualAfterInlining(int cents) {
        return cents + cents / 10;
    }

    public static void main(String[] args) {
        long a = 0;
        long b = 0;
        for (int i = 0; i < 10_000_000; i++) {
            a += addTax(i);
            b += conceptualAfterInlining(i);
        }
        System.out.println("same result: " + (a == b));
        System.out.println("Run with -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining");
    }
}`
            },
            {
              lang: 'java',
              title: 'Escape Analysis Before and After Concept',
              code: `public class EscapeAnalysisConceptDemo {
    record Point(int x, int y) {}

    static int distanceSquared(int x, int y) {
        Point p = new Point(x, y);
        return p.x() * p.x() + p.y() * p.y();
    }

    static int conceptualAfterScalarReplacement(int x, int y) {
        return x * x + y * y;
    }

    public static void main(String[] args) {
        long a = 0;
        long b = 0;
        for (int i = 0; i < 20_000_000; i++) {
            a += distanceSquared(i & 1023, (i + 1) & 1023);
            b += conceptualAfterScalarReplacement(i & 1023, (i + 1) & 1023);
        }
        System.out.println("same result: " + (a == b));
        System.out.println("Compare allocation behavior with and without -XX:-DoEscapeAnalysis.");
    }
}`
            }
          ],
          flashcards: [
            { q: 'Why is method inlining so important?', a: 'It removes call overhead and exposes the combined code to further optimizations such as escape analysis and constant folding.' },
            { q: 'What does -XX:MaxInlineSize control?', a: 'The bytecode-size threshold for ordinary small-method inlining decisions.' },
            { q: 'What is escape analysis?', a: 'A JIT analysis that determines whether an object can be observed outside its method or thread.' },
            { q: 'What is scalar replacement?', a: 'Replacing an object allocation with its individual fields, often held in registers, so no heap object is created.' },
            { q: 'What is lock elision?', a: 'Removing synchronization when the JIT proves the locked object cannot be shared across threads.' },
            { q: 'What is dead-code elimination?', a: 'Removing computations that have no observable effect.' },
            { q: 'What is devirtualisation?', a: 'Turning a virtual/interface call into a direct call based on observed receiver types.' },
            { q: 'What is a monomorphic call site?', a: 'A call site that has observed one receiver type, making direct call and inlining likely.' },
            { q: 'What is a JVM intrinsic?', a: 'A special optimized JVM implementation for a known method, often using CPU-specific instructions.' },
            { q: 'How do you verify inlining decisions?', a: 'Use -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining or inspect with JITWatch.' }
          ]
        },
        {
          title: 'Profiling, Measuring & GraalVM',
          notes: `
### PrintCompilation

\`-XX:+PrintCompilation\` prints methods as the JVM compiles them. A typical line includes a timestamp, compilation id, tier, method name, bytecode size, and sometimes markers for OSR, made-not-entrant, or made-zombie code.

\`\`\`
  113   42       3       java.lang.String::hashCode (60 bytes)
  time  id       tier    method                         size
\`\`\`

Tier \`3\` means C1 with full profiling; tier \`4\` means C2 optimized code. A percent sign usually indicates OSR compilation for a hot loop.

### JFR for Production Profiling

Java Flight Recorder is built into modern JDKs and is safe enough for production when configured sensibly. It records allocation, CPU, thread, lock, GC, exception, and execution-sample events. Open recordings in JDK Mission Control to correlate symptoms rather than guess.

### async-profiler

async-profiler produces CPU, allocation, lock, and wall-clock flame graphs with low overhead. Flame graphs show stack width by sample count. Wide frames are where time or allocation pressure is concentrated.

### JITWatch

JITWatch consumes JIT logs and visualizes compilation decisions. It is especially useful for understanding why a method did or did not inline, whether bytecode shape is blocking optimization, and how source maps to bytecode and assembly.

### Useful JIT Flags

| Flag | Purpose | Example |
|------|---------|---------|
| \`-XX:+PrintCompilation\` | Show compilation events | \`java -XX:+PrintCompilation App\` |
| \`-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining\` | Show inlining decisions | \`java -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining App\` |
| \`-XX:+PrintIntrinsics\` | List JVM intrinsics | \`java -XX:+UnlockDiagnosticVMOptions -XX:+PrintIntrinsics -version\` |
| \`-XX:+TieredCompilation\` | Enable tiered compilation | \`-XX:+TieredCompilation\` |
| \`-XX:-TieredCompilation\` | Disable tiered compilation for experiments | \`-XX:-TieredCompilation\` |
| \`-XX:CICompilerCount\` | Set compiler thread count | \`-XX:CICompilerCount=4\` |
| \`-XX:CompileThreshold\` | Influence compilation threshold | \`-XX:CompileThreshold=10000\` |
| \`-XX:-DoEscapeAnalysis\` | Disable escape analysis for comparison | \`-XX:-DoEscapeAnalysis\` |
| \`-XX:ReservedCodeCacheSize\` | Size the native code cache | \`-XX:ReservedCodeCacheSize=256m\` |
| \`-XX:+LogCompilation\` | Emit XML compilation log for tools | \`java -XX:+UnlockDiagnosticVMOptions -XX:+LogCompilation App\` |

### GraalVM Native Image and Graal JIT

GraalVM has two different stories. Native Image is AOT: it builds a standalone binary with millisecond startup and low memory, but no runtime JIT warm-up and less dynamic behavior. Graal JIT is a JVM compiler that can run in JVM mode on GraalVM and optimize at runtime like a JIT.

Native Image works best when startup and footprint dominate. A warmed HotSpot or Graal JIT JVM often wins for long-running throughput because runtime profiles keep improving hot code.

> [!WARNING]
> Native Image uses a closed-world assumption. Reflection, proxies, resources, serialization, and dynamic class loading need build-time configuration or framework AOT support.

### JMH Warm-Up Effect

The benchmark below is a real JMH benchmark. It uses warm-up iterations that are not measured, measurement iterations that are reported, multiple forks, and a \`Blackhole\` so the JIT cannot erase the work.

> [!SUCCESS]
> Production profiling answers "where is the application spending time?" JMH answers "is this small code change faster under controlled conditions?" They solve different problems.

> [!EU]
> A rigorous performance report includes the tool, JVM version, flags, hardware, warm-up, input sizes, confidence/error values, and a before/after comparison. Without those, it is a story, not evidence.
`,
          code: [
            {
              lang: 'java',
              title: 'PrintCompilation Target Program',
              code: `public class PrintCompilationTarget {
    static long parseAndMix(String text) {
        long result = 1125899906842597L;
        for (int i = 0; i < text.length(); i++) {
            result = 31 * result + text.charAt(i);
        }
        return result;
    }

    public static void main(String[] args) {
        long sink = 0;
        for (int i = 0; i < 500_000; i++) {
            sink ^= parseAndMix("order-" + (i & 1023));
        }
        System.out.println("sink=" + sink);
        System.out.println("Run with: -XX:+PrintCompilation");
    }
}`
            },
            {
              lang: 'java',
              title: 'Real JMH Benchmark Showing Warm-Up Effect',
              code: `import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Fork;
import org.openjdk.jmh.annotations.Measurement;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.Warmup;
import org.openjdk.jmh.infra.Blackhole;

import java.util.concurrent.TimeUnit;

@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@State(Scope.Thread)
@Warmup(iterations = 5, time = 1, timeUnit = TimeUnit.SECONDS)
@Measurement(iterations = 8, time = 1, timeUnit = TimeUnit.SECONDS)
@Fork(2)
public class WarmupEffectBenchmark {
    private int value = 1;

    private static int hotFunction(int x) {
        int y = x;
        y = y * 31 + 17;
        y ^= y >>> 7;
        y *= 0x45d9f3b;
        return y;
    }

    @Benchmark
    public void measuredAfterWarmup(Blackhole blackhole) {
        value = hotFunction(value);
        blackhole.consume(value);
    }
}`
            }
          ],
          flashcards: [
            { q: 'What does -XX:+PrintCompilation show?', a: 'JVM compilation events including compile id, tier, method, bytecode size, and status markers.' },
            { q: 'What does tier 4 mean in PrintCompilation output?', a: 'C2 optimized compiled code.' },
            { q: 'What is JFR best used for?', a: 'Low-overhead production profiling across CPU, allocation, locks, GC, threads, exceptions, and latency events.' },
            { q: 'What does async-profiler produce?', a: 'Low-overhead flame graphs for CPU, allocation, lock, or wall-clock profiling.' },
            { q: 'What is JITWatch used for?', a: 'Visualizing JIT compilation logs, inlining decisions, bytecode, and assembly relationships.' },
            { q: 'What does -XX:CICompilerCount tune?', a: 'The number of compiler threads available for JIT compilation.' },
            { q: 'What is the code cache?', a: 'Native memory where the JVM stores generated compiled machine code.' },
            { q: 'How is GraalVM Native Image different from Graal JIT?', a: 'Native Image is ahead-of-time compilation to a standalone binary; Graal JIT optimizes code at runtime inside a JVM.' },
            { q: 'Why does Native Image start quickly?', a: 'Most analysis and compilation happen at build time, so runtime avoids JVM warm-up and dynamic JIT compilation.' },
            { q: 'Why can Native Image have lower peak throughput?', a: 'It lacks runtime profile-guided JIT optimization and must obey closed-world build-time assumptions.' }
          ]
        }
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
# Collections & Equals/HashCode Contracts — From Zero to Senior Level

## Why Collections Matter

In almost every Java interview and production system, you'll use collections constantly. The difference between a junior and a senior engineer is not just knowing which collection to use — it's understanding **why** each one works the way it does, what can go wrong, and how to pick the right one for the situation.

---

## The Collections Family Tree

\`\`\`
java.util.Collection
├── List (ordered, allows duplicates)
│   ├── ArrayList      (resizable array — fast random access, slow insert in middle)
│   ├── LinkedList     (doubly-linked — fast insert/delete at ends, slow random access)
│   └── ArrayDeque     (preferred deque/stack over LinkedList in most cases)
│
├── Set (no duplicates)
│   ├── HashSet        (backed by HashMap — O(1) add/contains, no ordering)
│   ├── LinkedHashSet  (insertion order preserved)
│   └── TreeSet        (sorted — O(log n), needs Comparable or Comparator)
│
└── Queue / Deque
    ├── ArrayDeque     (fast stack/queue, NOT thread-safe)
    ├── PriorityQueue  (min-heap — O(log n) offer/poll, O(1) peek)
    └── LinkedList     (also implements Deque)

java.util.Map (key-value, separate hierarchy)
├── HashMap            (O(1) avg, no ordering, 1 null key allowed)
├── LinkedHashMap      (insertion or access order)
├── TreeMap            (sorted by key — O(log n))
├── Hashtable          (legacy, synchronized, avoid)
└── ConcurrentHashMap  (thread-safe, O(1), no null keys/values)
\`\`\`

---

## ArrayList vs LinkedList: The Most Misunderstood Choice

Most developers use \`LinkedList\` thinking "inserting in the middle is O(1)". But:

\`\`\`
ArrayList internal structure:
[elem0][elem1][elem2][elem3][elem4][ ][ ][ ]  ← contiguous array
  idx0   idx1   idx2   idx3   idx4
\`\`\`
\`\`\`
LinkedList internal structure:
[prev|elem0|next] ↔ [prev|elem1|next] ↔ [prev|elem2|next]
                                          ← scattered in heap
\`\`\`

| Operation | ArrayList | LinkedList |
|-----------|-----------|------------|
| \`get(i)\` | O(1) — index into array | O(n) — traverse from head |
| \`add(end)\` | O(1) amortised | O(1) |
| \`add(middle)\` | O(n) — shift elements | O(n) — find position first! |
| \`remove(middle)\` | O(n) — shift elements | O(n) — find position first |
| Memory | Compact (CPU cache friendly) | High overhead (node objects, pointers) |
| Iteration | Very fast (cache line prefetching) | Slow (random memory access) |

**The verdict:** Use \`ArrayList\` almost always. \`LinkedList\` is only better when you iterate with an \`Iterator\` and call \`iterator.remove()\` frequently, and even then \`ArrayDeque\` is usually better for queue/stack use cases.

> [!TIP]
> If you know the approximate size upfront, use \`new ArrayList<>(expectedSize)\` to avoid repeated resizing. \`ArrayList\` doubles its capacity each resize (amortised O(1) add), but each resize copies the whole array.

---

## HashMap Internals: Deep Dive

HashMap is the most important collection to understand deeply. Every interview asks about it.

### The Data Structure

A \`HashMap\` is an **array of buckets**. Each bucket can hold multiple entries (when keys hash to the same bucket — a "collision").

\`\`\`
HashMap internal array (capacity = 16 by default):
index: [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7] ...
        null null null  ↓   null null null  ↓
                      Entry              Entry → Entry → Entry
                      k="cat"            k="dog"  k="fox"  k="emu"
                      v=1                v=2      v=3      v=4
                     (no collision)      (3 collisions in bucket 7)
\`\`\`

### Step-by-Step: What Happens on \`map.put("cat", 1)\`?

1. Call \`"cat".hashCode()\` → e.g. \`98262\`
2. Apply spread function: \`hash = hashCode ^ (hashCode >>> 16)\` (spreads high bits to reduce clustering)
3. Compute bucket index: \`index = (capacity - 1) & hash\` → e.g. \`3\`
4. Check bucket 3:
   - Empty → create new \`Entry(key="cat", value=1, hash=..., next=null)\`, place it
   - Not empty → walk the chain, check \`hash == entry.hash && key.equals(entry.key)\`
     - Match found → update value (put overwrites)
     - No match → append to chain (collision)

### Step-by-Step: What Happens on \`map.get("cat")\`?

1. Hash "cat" → same spread → same bucket index (3)
2. Walk bucket 3's chain, compare hash first (fast int compare), then \`.equals()\`
3. Return value, or \`null\` if not found

### Treeification: From O(n) to O(log n) Worst Case

Before Java 8: bucket chains were linked lists. With many collisions (e.g. all keys hash to the same bucket), get/put degrades to O(n) — a DoS attack vector!

Java 8 fix: when a bucket chain exceeds **8 entries** AND total capacity ≥ **64**, the chain is converted to a **Red-Black Tree**. Get/put worst case becomes O(log n). When elements are removed and the tree shrinks below **6**, it converts back to a linked list.

### Load Factor and Resizing

- **Capacity**: number of buckets (default 16, always a power of 2)
- **Load factor**: threshold ratio = entries / capacity (default 0.75)
- When \`size > capacity × 0.75\` → **resize**: new array of double capacity, rehash all entries

\`\`\`
After 12 entries (16 × 0.75 = 12) → resize to 32 buckets → rehash all 12 entries
After 24 entries (32 × 0.75 = 24) → resize to 64 → rehash all 24
\`\`\`

Resizing is O(n) — expensive! Pre-size maps when you know the approximate count:
\`\`\`java
// To hold 100 entries without resizing: capacity = 100/0.75 + 1 = 134, round up to 256
Map<String, Value> map = new HashMap<>(256);
// Or use the Google Guava helper:
Map<String, Value> map = Maps.newHashMapWithExpectedSize(100);
\`\`\`

---

## The equals/hashCode Contract — The Most Important Rule in Java

This is the #1 source of subtle bugs with collections.

### The Rules (Must Memorise)

**Rule 1 (the critical one):** If \`a.equals(b)\` is \`true\`, then \`a.hashCode() == b.hashCode()\` MUST be true.

**Rule 2 (performance, not correctness):** If \`a.equals(b)\` is \`false\`, \`a.hashCode()\` SHOULD differ from \`b.hashCode()\` (but doesn't have to — just causes more collisions).

**Rule 3:** \`equals\` must be:
- Reflexive: \`x.equals(x)\` → true
- Symmetric: \`x.equals(y)\` ↔ \`y.equals(x)\`
- Transitive: if \`x.equals(y)\` and \`y.equals(z)\` then \`x.equals(z)\`
- Consistent: same result on repeated calls (assuming no state change)
- \`x.equals(null)\` → always false

### What Breaks When You Violate the Contract

**Mistake 1: Override equals but not hashCode**
\`\`\`java
class Person {
    String name;
    @Override public boolean equals(Object o) {
        return o instanceof Person p && p.name.equals(name);
    }
    // ← NO hashCode override!
}

Set<Person> set = new HashSet<>();
set.add(new Person("Alice"));
set.contains(new Person("Alice")); // FALSE! Different hashCode → wrong bucket → not found
\`\`\`

**Mistake 2: Mutable key — mutate it after putting in the map**
\`\`\`java
List<String> key = new ArrayList<>(List.of("a", "b"));
Map<List<String>, Integer> map = new HashMap<>();
map.put(key, 42);

key.add("c");  // ← mutate the key!
// hashCode changed → the entry is now in the WRONG bucket
map.get(key);  // → null (can't find it)
map.get(List.of("a", "b")); // → null (hash doesn't match the new position either)
// The entry is LOST — a memory leak in the map
\`\`\`

**The fix:** Always use **immutable objects** as map keys: \`String\`, \`Integer\`, \`Long\`, \`UUID\`, \`record\` types, enums.

### How to Implement equals/hashCode Correctly

\`\`\`java
// Option 1: Java record (auto-generates from all components — best for DTOs/keys)
record Point(int x, int y) {}  // equals, hashCode, toString all correct

// Option 2: Manual implementation (when record isn't appropriate)
class OrderId {
    private final String value;
    OrderId(String value) { this.value = Objects.requireNonNull(value); }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof OrderId other)) return false;
        return value.equals(other.value);
    }

    @Override public int hashCode() {
        return Objects.hash(value);  // or: value.hashCode()
    }
}

// Option 3: Lombok (code generation)
@EqualsAndHashCode  // generates correct equals + hashCode from all fields
class Product { String sku; String name; }
\`\`\`

---

## TreeMap and Sorted Collections

\`TreeMap\` keeps keys in sorted order (natural ordering via \`Comparable\`, or a \`Comparator\` provided at construction). Internally a **Red-Black Tree** — self-balancing BST guaranteeing O(log n) for all operations.

\`\`\`java
TreeMap<String, Integer> scores = new TreeMap<>();
scores.put("Charlie", 85);
scores.put("Alice", 92);
scores.put("Bob", 78);
// Iterates in alphabetical order: Alice, Bob, Charlie

// Rich navigation API:
scores.firstKey();              // "Alice"
scores.lastKey();               // "Charlie"
scores.headMap("Bob");          // {Alice=92} (keys < "Bob")
scores.tailMap("Bob");          // {Bob=78, Charlie=85} (keys >= "Bob")
scores.floorKey("Ba");          // "Alice" (greatest key ≤ "Ba")
scores.subMap("Alice", "Bob");  // {Alice=92} (Alice inclusive, Bob exclusive)
\`\`\`

**TreeMap vs HashMap:** TreeMap is O(log n) for all ops vs HashMap's O(1) average. Use TreeMap when you need sorted order or range queries. Use HashMap when you just need fast lookup by key.

---

## Fail-Fast vs Fail-Safe Iterators

**Fail-fast** (ArrayList, HashMap, etc.): throws \`ConcurrentModificationException\` if the collection is structurally modified while iterating. Uses a \`modCount\` counter — each structural change increments it, iterator checks on each \`next()\`.

\`\`\`java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));
for (String s : list) {
    if (s.equals("b")) list.remove(s);  // ← ConcurrentModificationException!
}

// Correct ways to remove while iterating:
// 1. Iterator.remove()
Iterator<String> it = list.iterator();
while (it.hasNext()) { if (it.next().equals("b")) it.remove(); }  // safe

// 2. removeIf (Java 8+) — cleanest
list.removeIf(s -> s.equals("b"));

// 3. Collect to remove, then removeAll
List<String> toRemove = list.stream().filter(s -> s.equals("b")).toList();
list.removeAll(toRemove);
\`\`\`

**Fail-safe** (CopyOnWriteArrayList, ConcurrentHashMap): iterates over a snapshot, never throws. Modifications during iteration are invisible to the current iterator. Higher memory cost.

---

## LinkedHashMap: LRU Cache in 5 Lines

\`LinkedHashMap\` maintains insertion order (or access order) via a doubly-linked list threaded through the entries. With access-order mode and overriding \`removeEldestEntry\`, you get a built-in LRU cache:

\`\`\`java
// LRU cache: evicts least-recently-accessed entry when size exceeds limit
int MAX_SIZE = 100;
Map<String, String> lruCache = new LinkedHashMap<>(MAX_SIZE, 0.75f, true /* access order */) {
    @Override protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
        return size() > MAX_SIZE;  // evict when over the limit
    }
};
// get() and put() both count as "access" and move the entry to the end
// The eldest (least recently used) is always at the front, auto-evicted
\`\`\`

This is a classic interview coding question. Understanding that \`LinkedHashMap\` with \`accessOrder=true\` gives you access-order tracking for free is the key insight.

> [!EU]
> "Implement an LRU cache" is asked at virtually every European backend interview (Booking.com, Adyen, Zalando, Spotify). Know both approaches: (1) \`LinkedHashMap\` override — 5 lines, simple but not thread-safe; (2) manual \`HashMap\` + doubly-linked list — more code but shows you understand the internals. For thread safety: \`Collections.synchronizedMap(lru)\` or use Caffeine cache library.
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
# Concurrency: Threads, Executors & Locks — From Zero to Senior Level

## Why Concurrency Is Hard (The Foundation)

Concurrency lets your program do multiple things at once. But shared mutable state + multiple threads = subtle bugs that appear randomly, only in production, only under load.

The three main hazards:
1. **Race condition** — outcome depends on thread scheduling (non-deterministic)
2. **Deadlock** — two threads wait for each other forever
3. **Livelock** — threads keep reacting to each other but make no progress

> [!TIP]
> The safest concurrency design: **don't share mutable state**. Use immutable objects (records, final fields), thread confinement (one thread owns the data), or message passing (queues). Only use locking when you genuinely need shared mutable state.

---

## Threads: The Basics

A **thread** is an independent unit of execution within a process. All threads in a JVM process share the same heap (objects) but each has its own stack (local variables, call frames).

\`\`\`java
// Raw thread — avoid in app code (use thread pools instead)
Thread t = new Thread(() -> {
    System.out.println("Running in: " + Thread.currentThread().getName());
});
t.setDaemon(true);   // daemon threads don't prevent JVM shutdown
t.start();           // start() creates the OS thread; run() just calls the method
t.join();            // wait for t to finish
\`\`\`

**Thread states:**
\`\`\`
NEW → RUNNABLE ⇄ BLOCKED (waiting for monitor lock)
              ⇄ WAITING (Object.wait(), Thread.join(), LockSupport.park())
              ⇄ TIMED_WAITING (sleep(), wait(timeout))
              → TERMINATED
\`\`\`

---

## Thread Pools: Never Use \`new Thread()\` in Production

Creating a thread is expensive (OS-level operation, ~1MB stack allocation). For every task, creating and destroying a thread wastes CPU and memory.

**Thread pools** maintain a set of reusable threads. Tasks go into a queue; idle threads pick them up.

### ThreadPoolExecutor — The Foundation

All Executors factory methods return a \`ThreadPoolExecutor\` underneath. Understanding its parameters is critical:

\`\`\`java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    4,                          // corePoolSize: always-alive threads
    8,                          // maximumPoolSize: max threads when queue is full
    60, TimeUnit.SECONDS,       // keepAliveTime: idle extra threads die after this
    new ArrayBlockingQueue<>(100),  // workQueue: tasks wait here (BOUNDED!)
    new ThreadPoolExecutor.CallerRunsPolicy()  // rejectionPolicy: caller runs task if full
);
\`\`\`

**How it works when tasks arrive:**
1. Fewer than \`corePoolSize\` threads → create a new thread (even if idle threads exist)
2. Reached \`corePoolSize\` → put task in queue
3. Queue is full AND fewer than \`maxPoolSize\` threads → create a new thread
4. Queue full AND at max threads → **RejectionPolicy** kicks in

**The dangerous Executors factory methods:**
\`\`\`java
Executors.newFixedThreadPool(8);    // UNBOUNDED queue → OOM under sustained load
Executors.newCachedThreadPool();    // UNBOUNDED thread count → can spawn thousands
Executors.newSingleThreadExecutor(); // UNBOUNDED queue → tasks pile up forever
\`\`\`

**The safe way:** always use \`ThreadPoolExecutor\` directly with a bounded queue and explicit rejection policy.

### Thread Pool Sizing Rules of Thumb

**CPU-bound tasks** (math, compression, no I/O):
\`\`\`
pool size ≈ number of CPU cores
(more threads = more context switching = slower)
\`\`\`

**I/O-bound tasks** (database, HTTP calls, file I/O):
\`\`\`
pool size ≈ cores × (1 + wait_time / compute_time)
e.g. if tasks spend 90% waiting: cores × (1 + 0.9/0.1) = cores × 10
(threads waiting on I/O don't use CPU, so more threads = more throughput)
\`\`\`

**Modern answer:** use **Virtual Threads** (Java 21+) for I/O-bound work — pool sizing becomes irrelevant.

---

## CompletableFuture: Async Pipelines

\`CompletableFuture\` is the modern way to write non-blocking async code in Java.

\`\`\`java
// Sequential (blocking — bad):
String result1 = fetchUser(id);   // waits here
String result2 = fetchOrders(id); // waits here
return result1 + result2;         // 200ms + 200ms = 400ms

// Parallel (non-blocking — good):
CompletableFuture<String> cf1 = CompletableFuture.supplyAsync(() -> fetchUser(id));
CompletableFuture<String> cf2 = CompletableFuture.supplyAsync(() -> fetchOrders(id));
return CompletableFuture.allOf(cf1, cf2)
    .thenApply(v -> cf1.join() + cf2.join()); // 200ms total (parallel)
\`\`\`

**The key operators:**
\`\`\`java
cf.thenApply(result -> transform(result))      // sync transform (like map)
cf.thenCompose(result -> anotherCF(result))   // chain another CF (like flatMap)
cf.thenAccept(result -> consume(result))       // terminal consumer
cf.exceptionally(ex -> defaultValue)          // error recovery
cf.thenCombine(cf2, (r1, r2) -> r1 + r2)     // combine two CFs
CompletableFuture.allOf(cf1, cf2, cf3)        // wait for ALL to complete
CompletableFuture.anyOf(cf1, cf2, cf3)        // complete when ANY completes
\`\`\`

> [!WARNING]
> Without specifying an executor, \`thenApply\`/\`thenCompose\` run on the **ForkJoinPool.commonPool()** (shared, fixed size = cores - 1). Blocking I/O in that pool starves other tasks. Always pass a dedicated executor for I/O: \`thenApplyAsync(fn, ioPool)\`.

---

## Locks: synchronized vs ReentrantLock vs StampedLock

### synchronized — Simple, Correct, Limited

\`\`\`java
class Counter {
    private int count = 0;
    synchronized void increment() { count++; }  // acquires 'this' monitor
    synchronized int get() { return count; }
}

// Block form (preferred — limits scope):
synchronized (lockObject) {
    // critical section
}
\`\`\`

**Limitations:** no tryLock, no timeout, can't interrupt a waiting thread, only one condition (wait/notify).

### ReentrantLock — Full Control

\`\`\`java
ReentrantLock lock = new ReentrantLock();

// Must release in finally — or you deadlock on exception!
lock.lock();
try {
    // critical section
} finally {
    lock.unlock();
}

// Try to acquire without blocking:
if (lock.tryLock(100, TimeUnit.MILLISECONDS)) {
    try { /* critical section */ }
    finally { lock.unlock(); }
} else {
    // couldn't get lock in 100ms — do something else
}

// Multiple conditions (producer-consumer):
Condition notFull = lock.newCondition();
Condition notEmpty = lock.newCondition();
// producer: notFull.await(); ... notEmpty.signal();
// consumer: notEmpty.await(); ... notFull.signal();
\`\`\`

### ReadWriteLock — Optimise Read-Heavy Scenarios

\`\`\`java
ReadWriteLock rwLock = new ReentrantReadWriteLock();
Lock readLock = rwLock.readLock();
Lock writeLock = rwLock.writeLock();

// Multiple readers can hold readLock simultaneously
// writeLock is exclusive (blocks all readers AND writers)

// Good for: caches, config, lookups — many reads, rare writes
readLock.lock();
try { return cache.get(key); }
finally { readLock.unlock(); }
\`\`\`

### StampedLock — Optimistic Reads (Fastest)

\`\`\`java
StampedLock sl = new StampedLock();

// Optimistic read (no lock taken — may observe inconsistent state):
long stamp = sl.tryOptimisticRead();
double x = this.x, y = this.y;  // read fields
if (!sl.validate(stamp)) {       // was there a write while we were reading?
    stamp = sl.readLock();       // no — fall back to real read lock
    try { x = this.x; y = this.y; }
    finally { sl.unlockRead(stamp); }
}
\`\`\`

Optimistic reads have zero overhead when there's no concurrent write — perfect for high-read scenarios.

---

## Atomics and Lock-Free Programming

\`java.util.concurrent.atomic\` provides lock-free thread-safe operations using **CAS (Compare-And-Swap)** — a single CPU instruction that atomically checks and updates a value.

\`\`\`java
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();          // atomic i++
counter.compareAndSet(5, 10);       // if value==5, set to 10; returns true/false
counter.getAndUpdate(x -> x * 2);  // atomic lambda update

// LongAdder is better than AtomicLong for counters under high contention:
LongAdder adder = new LongAdder();
adder.increment();     // distributes across cells — less CAS contention
adder.sum();           // sum all cells — slightly stale but fast

// AtomicReference for any object:
AtomicReference<String> ref = new AtomicReference<>("initial");
ref.compareAndSet("initial", "updated");
\`\`\`

**When to use which:**
- \`AtomicInteger/Long\` — single counter or CAS logic (check-then-act)
- \`LongAdder\` — pure incrementing counter with many writers (10-100x faster than AtomicLong under contention)
- \`AtomicReference\` — atomic object swap / CAS on any object

---

## Deadlock: Detection and Prevention

**Deadlock** occurs when two (or more) threads each hold a lock the other needs:

\`\`\`
Thread A holds lock1, waiting for lock2
Thread B holds lock2, waiting for lock1
→ Both blocked forever
\`\`\`

**The four Coffman conditions** (all four must hold for deadlock):
1. **Mutual exclusion** — resources can't be shared
2. **Hold and wait** — thread holds one lock while waiting for another
3. **No preemption** — locks can't be forcibly taken away
4. **Circular wait** — A waits for B waits for C waits for A

**Prevention strategies:**

**1. Always acquire locks in the same global order:**
\`\`\`java
// All threads always acquire lock1 before lock2 — no circular wait possible
synchronized (lock1) { synchronized (lock2) { /* ... */ } }
\`\`\`

**2. Use tryLock with timeout:**
\`\`\`java
if (lock1.tryLock(100, MILLISECONDS)) {
    if (lock2.tryLock(100, MILLISECONDS)) {
        try { /* do work */ } finally { lock2.unlock(); lock1.unlock(); }
    } else {
        lock1.unlock();  // give up, retry or abort
    }
}
\`\`\`

**3. Avoid nested locks entirely** — restructure so each thread only holds one lock at a time.

**Detect in production:** \`jstack <pid>\` shows thread dumps — look for "waiting to lock" cycles.

---

## Synchronizers: CountDownLatch, Semaphore, CyclicBarrier

\`\`\`java
// CountDownLatch: wait for N events to happen (one-shot)
CountDownLatch ready = new CountDownLatch(3);  // 3 services must start
// each service calls: ready.countDown()
ready.await();  // main thread waits until count reaches 0

// Semaphore: rate limiting / resource pool (N permits)
Semaphore throttle = new Semaphore(10);  // max 10 concurrent
throttle.acquire();
try { callExternalApi(); }
finally { throttle.release(); }

// CyclicBarrier: all threads wait at a point then proceed together (reusable)
CyclicBarrier barrier = new CyclicBarrier(3, () -> System.out.println("All ready!"));
// each thread: barrier.await() — blocks until all 3 have arrived, then all continue
\`\`\`

> [!EU]
> A common whiteboard task at European interviews: "Implement a thread-safe bounded blocking queue." The expected answer uses \`ReentrantLock\` with two \`Condition\` objects (\`notFull\`, \`notEmpty\`), or simply wraps \`ArrayBlockingQueue\`. Explain that \`BlockingQueue.put()\` blocks when full and \`take()\` blocks when empty — it's already the correct solution. Then mention virtual threads (Java 21) as the modern alternative that makes pool sizing and blocking less important.
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
# Streams, Lambdas & Functional Java — From Zero to Senior Level

## What Problem Do Streams Solve?

Before Java 8, processing a list meant imperative loops:
\`\`\`java
// Find names of employees in ENG dept earning > 80000, sorted:
List<String> result = new ArrayList<>();
for (Employee e : employees) {
    if ("ENG".equals(e.dept()) && e.salary() > 80000) {
        result.add(e.name());
    }
}
Collections.sort(result);
\`\`\`

With streams:
\`\`\`java
List<String> result = employees.stream()
    .filter(e -> "ENG".equals(e.dept()) && e.salary() > 80000)
    .map(Employee::name)
    .sorted()
    .toList();
\`\`\`

Streams express **what** you want, not **how** to loop. They're:
- **Declarative** — describe the transformation, not the iteration
- **Composable** — chain operations into pipelines
- **Lazy** — no work happens until a terminal operation triggers it
- **Potentially parallel** — \`.parallel()\` distributes work across ForkJoinPool

---

## The Stream Pipeline

Every stream pipeline has three parts:

\`\`\`
Source → [Intermediate ops...] → Terminal op
  ↓              ↓                    ↓
creates        lazy (build          eager (triggers
the stream     the pipeline)        execution)
\`\`\`

**Sources:**
\`\`\`java
list.stream()                          // from Collection
Arrays.stream(array)                   // from array
Stream.of("a", "b", "c")              // from values
Stream.iterate(0, n -> n + 1)         // infinite: 0, 1, 2, 3...
Stream.generate(Math::random)          // infinite: random doubles
IntStream.range(0, 10)                 // 0 to 9 (primitive stream)
IntStream.rangeClosed(1, 10)           // 1 to 10
Files.lines(Path.of("data.txt"))       // lines from file (lazy!)
\`\`\`

**Intermediate operations (lazy — return a new stream):**
\`\`\`java
.filter(pred)          // keep elements matching predicate
.map(fn)               // transform each element (1-to-1)
.flatMap(fn)           // transform and flatten (1-to-N) — e.g. List<List<T>> → flat stream
.distinct()            // remove duplicates (uses equals/hashCode)
.sorted()              // natural order; or .sorted(comparator)
.limit(n)              // take first N elements
.skip(n)               // skip first N elements
.peek(consumer)        // debug: see elements without consuming the stream
.mapToInt/Long/Double  // convert to primitive stream (no boxing overhead)
\`\`\`

**Terminal operations (eager — trigger execution, consume the stream):**
\`\`\`java
.collect(collector)    // gather into a collection/map/string
.toList()              // Java 16+: collect to unmodifiable List
.forEach(consumer)     // iterate (no return value)
.count()               // count elements
.findFirst()           // first element → Optional
.findAny()             // any element (faster in parallel) → Optional
.anyMatch(pred)        // true if any element matches
.allMatch(pred)        // true if all elements match
.noneMatch(pred)       // true if no elements match
.min(comparator)       // Optional<T> minimum
.max(comparator)       // Optional<T> maximum
.reduce(identity, op)  // fold: accumulate into single value
\`\`\`

> [!WARNING]
> A stream can only be consumed ONCE. After a terminal operation, the stream is closed. Using it again throws \`IllegalStateException\`. If you need to iterate the same data twice, get a new stream each time.

---

## Laziness: Why It Matters

Intermediate operations don't execute until a terminal op is called. This enables **short-circuit evaluation**:

\`\`\`java
// Finding the first match in a list of 1 million employees:
employees.stream()
    .filter(e -> e.salary() > 100000)
    .map(Employee::name)
    .findFirst();   // ← stops after first match found, doesn't process the rest
\`\`\`

Without streams, you'd need to manually break out of loops. The pipeline only processes as many elements as needed.

---

## Collectors: The Most Powerful Terminal Operation

\`Collectors\` produces rich results from streams. Know these by heart:

\`\`\`java
import static java.util.stream.Collectors.*;

// Group by a field → Map<Key, List<Value>>
Map<String, List<Employee>> byDept = employees.stream()
    .collect(groupingBy(Employee::dept));

// Group + downstream collector (average salary per dept)
Map<String, Double> avgSalary = employees.stream()
    .collect(groupingBy(Employee::dept, averagingInt(Employee::salary)));

// Group + count per group
Map<String, Long> countByDept = employees.stream()
    .collect(groupingBy(Employee::dept, counting()));

// Multi-level grouping (dept → manager → employees)
Map<String, Map<String, List<Employee>>> nested = employees.stream()
    .collect(groupingBy(Employee::dept, groupingBy(Employee::manager)));

// Partition into two groups (true/false)
Map<Boolean, List<Employee>> seniorJunior = employees.stream()
    .collect(partitioningBy(e -> e.salary() >= 100000));

// Join strings
String names = employees.stream()
    .map(Employee::name)
    .collect(joining(", ", "[", "]"));  // [Alice, Bob, Charlie]

// Convert to map (watch for duplicate key exception!)
Map<String, Integer> nameSalary = employees.stream()
    .collect(toMap(Employee::name, Employee::salary,
                   (existing, dupe) -> existing)); // merge function for duplicates

// Summarising statistics (count, sum, min, max, avg in one pass)
IntSummaryStatistics stats = employees.stream()
    .collect(summarizingInt(Employee::salary));
System.out.println("Max: " + stats.getMax() + ", Avg: " + stats.getAverage());
\`\`\`

---

## flatMap: One-to-Many Transformations

\`flatMap\` transforms each element into a stream, then flattens all streams into one:

\`\`\`java
// Each order has multiple items — get all items across all orders:
List<Item> allItems = orders.stream()
    .flatMap(order -> order.items().stream())  // Order → Stream<Item>
    .toList();

// Split sentences into words:
List<String> words = List.of("hello world", "foo bar").stream()
    .flatMap(sentence -> Arrays.stream(sentence.split(" ")))
    .toList();  // [hello, world, foo, bar]

// Generate pairs:
List<String> pairs = Stream.of("A", "B", "C").stream()
    .flatMap(a -> Stream.of("1","2").map(b -> a + b))
    .toList();  // [A1, A2, B1, B2, C1, C2]
\`\`\`

---

## Optional: Null-Safe Value Handling

\`Optional<T>\` is a container that either holds a value or is empty. It forces you to think about the absent case.

\`\`\`java
// Creating:
Optional<String> opt = Optional.of("value");       // throws if null
Optional<String> maybe = Optional.ofNullable(str); // empty if null
Optional<String> empty = Optional.empty();

// Using correctly:
String result = opt
    .filter(s -> s.length() > 3)
    .map(String::toUpperCase)
    .orElse("default");            // return "default" if empty

opt.orElseGet(() -> computeDefault());  // lazy — only called if empty
opt.orElseThrow(() -> new RuntimeException("missing")); // throw if empty
opt.ifPresent(s -> System.out.println(s));  // run only if present
opt.ifPresentOrElse(s -> use(s), () -> handleAbsent()); // Java 9+

// Chaining Optionals that return Optional (flatMap, NOT map):
Optional<String> city = findUser(id)
    .flatMap(user -> findAddress(user))   // user → Optional<Address>
    .map(addr -> addr.city());            // Address → String
\`\`\`

> [!WARNING]
> Never call \`Optional.get()\` without checking \`isPresent()\` first — defeats the whole point. Never use Optional as a method parameter or field (use overloading or null instead). Optional is a **return type** for methods that might not produce a result.

---

## Parallel Streams: When to Use (and Not Use)

\`\`\`java
// Enable parallel processing:
list.parallelStream().filter(...).map(...).collect(toList());
// or: stream().parallel()
\`\`\`

Parallel streams split the work across \`ForkJoinPool.commonPool()\` (fixed at cores - 1 threads).

**Parallel helps when ALL are true:**
- Large data (usually >10,000 elements to overcome overhead)
- CPU-bound work (not I/O — I/O blocks the shared pool)
- Splittable source (ArrayList splits easily; LinkedList doesn't)
- No shared mutable state
- Order doesn't matter (or you use \`forEachOrdered\`)

**Parallel hurts for:**
- Small collections (overhead > benefit)
- I/O operations (blocks the shared pool, starves other tasks)
- Sequential/stateful operations (\`distinct\`, \`sorted\` need coordination)
- Operations with locks (contention defeats parallelism)

\`\`\`java
// Dangerous: shared mutable state in parallel stream
List<String> results = new ArrayList<>();  // NOT thread-safe!
list.parallelStream().forEach(results::add);  // race condition!

// Safe: collect to thread-safe result
List<String> results = list.parallelStream().collect(toList());
\`\`\`

> [!EU]
> Live coding: *"Group employees by department and find the highest-paid in each."* Answer:
> \`\`\`java
> Map<String, Optional<Employee>> topByDept = employees.stream()
>     .collect(groupingBy(Employee::dept, maxBy(Comparator.comparingInt(Employee::salary))));
> \`\`\`
> Then discuss: "I'd only use \`.parallel()\` here if the list were very large and I'd profiled it. The common pool has limited threads and I/O in the stream would block it."
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
# Virtual Threads & Structured Concurrency — From Zero to Senior Level

## The Problem: Why Traditional Threads Don't Scale

Imagine a web server handling 10,000 simultaneous requests. Each request:
1. Receives HTTP request (fast)
2. Queries the database (slow — 50ms wait)
3. Calls an external API (slow — 100ms wait)
4. Returns response (fast)

With **platform threads** (one-per-request model):
- Each OS thread costs ~1MB of stack + kernel scheduling overhead
- 10,000 threads = 10GB of RAM just for stacks
- OS scheduler can't efficiently manage 10,000 threads
- **Result: you can only handle ~1,000–2,000 concurrent requests practically**

The solution the industry adopted: **reactive/async programming** (WebFlux, CompletableFuture callbacks, RxJava). Instead of blocking threads, use callbacks — when I/O completes, continue processing.

**But reactive has a massive cost:**
\`\`\`java
// Readable blocking code (can't scale):
User user = db.findUser(id);             // blocks here
Order order = api.fetchOrder(user);      // blocks here
return new Response(user, order);

// Reactive equivalent (scales, but painful):
return db.findUser(id)
    .flatMap(user -> api.fetchOrder(user)
        .map(order -> new Response(user, order))
        .onErrorResume(e -> Mono.error(new ServiceException(e))))
    .subscribeOn(Schedulers.boundedElastic())
    .doOnError(log::error);
\`\`\`

Stack traces become useless, debugging is hard, every library must be reactive-aware.

---

## Virtual Threads: The Solution (Java 21, JEP 444)

Virtual threads are **JVM-managed threads** that are NOT backed 1:1 by OS threads. Instead:

\`\`\`
Your application creates MILLIONS of virtual threads:
VT1  VT2  VT3  VT4  ... VT1,000,000

The JVM multiplexes them onto a SMALL pool of platform threads (carriers):
PT1  PT2  PT3  PT4  (≈ number of CPU cores, e.g. 8)

Each platform thread is backed by ONE OS thread:
OS1  OS2  OS3  OS4  OS5  OS6  OS7  OS8
\`\`\`

**The magic: when a virtual thread blocks on I/O, it UNMOUNTS from its carrier**

\`\`\`
VT1 calls database query (blocking I/O):
  1. VT1's stack is saved to HEAP (cheap — just memory copy)
  2. VT1 is unmounted from PT1 (the carrier thread is free!)
  3. PT1 immediately picks up VT2 and runs it
  4. Database responds 50ms later
  5. VT1 is rescheduled onto any free carrier (PT3, say)
  6. VT1 resumes exactly where it left off
\`\`\`

This means 1 platform thread can handle thousands of virtual threads that are mostly waiting on I/O. You get the scalability of reactive with the readability of blocking code.

---

## Creating Virtual Threads

\`\`\`java
// Option 1: Direct creation (for single tasks)
Thread.startVirtualThread(() -> handleRequest(req));

// Option 2: Builder API (control name, daemon status)
Thread vt = Thread.ofVirtual()
    .name("request-handler-", 0)  // auto-numbered
    .start(() -> handleRequest(req));

// Option 3: Executor (most common in frameworks)
try (ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Request req : requests) {
        exec.submit(() -> handleRequest(req));  // one VT per task
    }
}  // try-with-resources: waits for all tasks to complete
\`\`\`

**Spring Boot 3.2+ enables virtual threads with one line:**
\`\`\`yaml
spring:
  threads:
    virtual:
      enabled: true
\`\`\`
Every HTTP request then runs on a virtual thread. Zero code changes needed.

---

## Virtual Threads vs Platform Threads: Full Comparison

| Aspect | Platform Thread | Virtual Thread |
|--------|----------------|----------------|
| Creation | Expensive (~1ms, OS call) | Cheap (~1μs, JVM heap alloc) |
| Stack size | Fixed ~1MB (OS) | Grows/shrinks dynamically (heap) |
| Max practical count | ~10,000 per JVM | Millions per JVM |
| Blocking on I/O | Blocks OS thread | Unmounts, OS thread freed |
| CPU-bound work | Good | Same — no benefit |
| ThreadLocal | Safe | Works, but memory risk at scale |
| Scheduling | OS preemptive | JVM cooperative (FIFO ForkJoinPool) |
| Stack traces | Clean | Clean (same as blocking code) |
| Debugging | Normal | Normal (same tools) |

---

## Pinning: The Critical Gotcha

A virtual thread **cannot unmount** in two situations:
1. Inside a \`synchronized\` block/method that blocks (calls I/O, sleep, etc.)
2. During a native (JNI) method call

When pinned, the virtual thread stays on its carrier platform thread, blocking it — just like an old platform thread. If all carriers are pinned, your server stalls.

\`\`\`java
// PINNING HAZARD: synchronized + blocking I/O
synchronized (dbLock) {
    result = db.query(sql);  // ← VT is PINNED here, carrier blocked for 50ms
}

// FIX: replace synchronized with ReentrantLock
ReentrantLock dbLock = new ReentrantLock();
dbLock.lock();
try {
    result = db.query(sql);  // ← VT unmounts here, carrier is FREE
} finally {
    dbLock.unlock();
}
\`\`\`

**Diagnosing pinning:**
\`\`\`
-Djdk.tracePinnedThreads=full
\`\`\`
Logs a stack trace whenever a virtual thread is pinned. Fix each pinning site before going to production.

> [!TIP]
> JDK 24 (2025) largely eliminates synchronized pinning at the JVM level. But until you upgrade, and for libraries that use \`synchronized\` internally (many JDBC drivers, some Kafka clients), pinning is still a real concern to monitor.

---

## Structured Concurrency (Java 21+ Preview, JEP 453)

When you run multiple concurrent tasks, errors and cancellations become messy:
\`\`\`java
// Unstructured concurrency (old way) — leaks and races:
Future<User> userFuture = exec.submit(() -> fetchUser(id));
Future<Order> orderFuture = exec.submit(() -> fetchOrder(id));
User user = userFuture.get();    // if this throws, orderFuture still runs!
Order order = orderFuture.get(); // timeout, memory leak, zombie threads
\`\`\`

**Structured concurrency** ties task lifetimes to a scope block — like structured programming ties control flow to blocks:

\`\`\`java
// ShutdownOnFailure: if any subtask fails, cancel siblings
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User>  userTask  = scope.fork(() -> fetchUser(id));
    Subtask<Order> orderTask = scope.fork(() -> fetchOrder(id));

    scope.join()           // wait for both to complete OR any to fail
         .throwIfFailed(); // rethrow first exception

    // Both succeeded:
    return new Response(userTask.get(), orderTask.get());
}
// scope closes: all subtasks guaranteed done, resources cleaned up

// ShutdownOnSuccess: return first result, cancel the rest (fastest-wins):
try (var scope = new StructuredTaskScope.ShutdownOnSuccess<String>()) {
    scope.fork(() -> fetchFromPrimary());
    scope.fork(() -> fetchFromReplica());
    scope.join();
    return scope.result();  // whichever returned first
}
\`\`\`

Benefits:
- No leaked threads — scope close guarantees all subtasks done
- Clear cancellation — scope cancels all subtasks if any fails
- Clean stack traces — subtask failures attributed to the parent scope
- Readable — looks like sequential code, is concurrent

---

## Scoped Values: ThreadLocal Replacement for Virtual Threads

With millions of virtual threads, \`ThreadLocal\` has a problem: if each VT stores a large object, you get millions of copies on the heap.

**Scoped Values** (JDK 20+ preview, JEP 446) are an immutable, inheritable alternative:
\`\`\`java
// Declare:
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

// Bind for a scope:
ScopedValue.where(CURRENT_USER, authenticatedUser)
           .run(() -> processRequest());  // user available within this scope

// Read anywhere in the call tree:
User user = CURRENT_USER.get();
\`\`\`

Unlike ThreadLocal: immutable (no accidental mutation), inheritable by child scopes, automatically cleaned up when scope exits, no remove() needed.

---

## When to Use Virtual Threads (and When Not To)

**USE virtual threads for:**
- I/O-bound work: HTTP calls, database queries, file I/O
- Thread-per-request servers (Spring MVC, Servlet-based)
- Any code that blocks and waits

**DON'T use virtual threads for:**
- CPU-bound work (pure computation, no I/O) — no benefit, just overhead
- Code that holds \`synchronized\` locks across blocking calls (until fixed)
- Work that uses ThreadLocal heavily (use Scoped Values instead)

> [!EU]
> The 2024–2025 flagship Java topic. Expect: *"What are virtual threads and how do they differ from platform threads?"* Strong answer: VTs are JVM-scheduled, unmount on blocking I/O (freeing the carrier), enabling millions of thread-per-task units with blocking code. Contrast: platform threads are OS-scheduled, 1MB stack, ~1ms creation, max ~10k. Then cover pinning (synchronized + I/O = blocked carrier, fix with ReentrantLock) and structured concurrency (scope ties task lifetimes, prevents leaks). Finally pivot: "Spring Boot 3.2 enables VTs with one config line — our team moved from WebFlux to plain @RestController and code readability improved dramatically with the same throughput."
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
# Records, Sealed Types & Pattern Matching — From Zero to Senior Level

## The Problem: Verbose, Error-Prone Data Classes

Before Java 16, a simple data class required enormous boilerplate:
\`\`\`java
public final class Point {
    private final int x;
    private final int y;
    public Point(int x, int y) { this.x = x; this.y = y; }
    public int x() { return x; }
    public int y() { return y; }
    @Override public boolean equals(Object o) {
        if (!(o instanceof Point)) return false;
        Point p = (Point) o;
        return x == p.x && y == p.y;
    }
    @Override public int hashCode() { return Objects.hash(x, y); }
    @Override public String toString() { return "Point[x=" + x + ", y=" + y + "]"; }
}
\`\`\`

With **records** (Java 16):
\`\`\`java
record Point(int x, int y) {}  // ALL of the above, in one line
\`\`\`

---

## Records: Deep Dive

A record is an immutable, transparent data carrier. The compiler auto-generates:
- Private \`final\` fields for each component
- A **canonical constructor** with all components as parameters
- Public **accessor methods** (named after components — \`x()\`, not \`getX()\`)
- \`equals\` — compares all components
- \`hashCode\` — based on all components
- \`toString\` — \`Point[x=1, y=2]\` format

\`\`\`java
record Employee(String name, String dept, int salary) {}

Employee e = new Employee("Alice", "ENG", 95000);
e.name();    // "Alice" (accessor — no 'get' prefix)
e.dept();    // "ENG"
e.salary();  // 95000

// equals/hashCode work correctly:
new Employee("Alice", "ENG", 95000).equals(e);  // true
Set<Employee> set = new HashSet<>();
set.add(e);
set.contains(new Employee("Alice", "ENG", 95000));  // true
\`\`\`

### Customising Records

\`\`\`java
record Money(long amount, String currency) {

    // Compact constructor: runs before the auto-generated one (for validation)
    Money {
        if (amount < 0) throw new IllegalArgumentException("negative amount");
        currency = currency.toUpperCase();  // can normalise in compact constructor
    }

    // Custom constructor (delegates to canonical):
    Money(long amount) {
        this(amount, "EUR");
    }

    // Additional methods are fine:
    Money add(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalStateException("currency mismatch");
        return new Money(amount + other.amount, currency);
    }

    // Static factory:
    static Money euros(long cents) { return new Money(cents, "EUR"); }
}
\`\`\`

### What Records CANNOT Do

\`\`\`java
// Records cannot:
// 1. Extend another class (implicitly extend Record)
// 2. Have mutable (non-final) fields
// 3. Declare instance fields outside the record header
// 4. Have an abstract modifier

// Records CAN:
// 1. Implement interfaces
// 2. Have static fields and methods
// 3. Have custom constructors (must delegate to canonical)
// 4. Override accessor methods (e.g. to add defensive copying)
// 5. Be generic: record Pair<A, B>(A first, B second) {}
\`\`\`

### Records as Map Keys and in Sets

Because records auto-generate correct \`equals\`/\`hashCode\` from all components, they're perfect immutable map keys:

\`\`\`java
record CacheKey(String userId, String resource) {}
Map<CacheKey, Data> cache = new HashMap<>();
cache.put(new CacheKey("u1", "orders"), data);
cache.get(new CacheKey("u1", "orders"));  // works perfectly — equal keys
\`\`\`

---

## Sealed Classes and Interfaces: Closed Hierarchies

A **sealed type** restricts which classes/interfaces can extend or implement it:

\`\`\`java
// Only Circle, Square, Rectangle can implement Shape
sealed interface Shape permits Circle, Square, Rectangle {}

// Each permitted subtype must be one of:
// - final (can't be extended further)
// - sealed (further restricted)
// - non-sealed (open to anyone — escape hatch)
record Circle(double radius) implements Shape {}          // implicit final (records)
record Square(double side) implements Shape {}
non-sealed class Rectangle implements Shape {            // open — anyone can extend
    final double width, height;
    Rectangle(double w, double h) { width = w; height = h; }
}
\`\`\`

**Why sealed types matter:** the compiler knows the **complete set** of subtypes at compile time. This enables **exhaustiveness checking** in switch expressions.

### Modelling Domain Results with Sealed Types

This is the killer use case — a type-safe \`Result\` type (success OR failure):

\`\`\`java
sealed interface Result<T> permits Success, Failure {
    record Success<T>(T value) implements Result<T> {}
    record Failure<T>(String error, Throwable cause) implements Result<T> {}
}

// Usage:
Result<Order> result = orderService.placeOrder(request);
String message = switch (result) {
    case Result.Success<Order>(Order o)  -> "Order " + o.id() + " placed";
    case Result.Failure<Order>(String e, Throwable t) -> "Failed: " + e;
    // NO default needed — compiler knows all cases are covered
};
\`\`\`

---

## Pattern Matching: Evolution from instanceof to switch

### instanceof Pattern (Java 16)
\`\`\`java
// Old way:
if (obj instanceof String) {
    String s = (String) obj;  // redundant cast
    doSomething(s);
}

// New way (Java 16+):
if (obj instanceof String s) {  // binding variable 's' in scope
    doSomething(s);             // no cast needed
}

// With guard (Java 21+):
if (obj instanceof String s && s.length() > 5) {
    System.out.println("Long string: " + s);
}
\`\`\`

### Switch Patterns (Java 21, JEP 441)

\`\`\`java
// Old switch: only works on int, String, enum
// New switch: works on ANY type with pattern matching

static String describe(Object obj) {
    return switch (obj) {
        case Integer i when i < 0 -> "negative int: " + i;     // guarded pattern
        case Integer i            -> "positive int: " + i;
        case String s when s.isEmpty() -> "empty string";
        case String s             -> "string of length " + s.length();
        case null                 -> "null";                    // explicit null handling
        default                   -> "something else: " + obj;
    };
}

// Area calculator with sealed type (NO default needed):
static double area(Shape s) {
    return switch (s) {
        case Circle(double r)          -> Math.PI * r * r;
        case Square(double side)       -> side * side;
        case Rectangle r               -> r.width * r.height;  // bind whole record
        // Exhaustive — compiler verified. Adding a new Shape subtype
        // causes a COMPILE ERROR here until you add the case. Safe refactoring!
    };
}
\`\`\`

### Record Deconstruction Patterns (Java 21)
\`\`\`java
record Point(int x, int y) {}
record Line(Point start, Point end) {}

Object obj = new Line(new Point(0, 0), new Point(3, 4));

// Nested deconstruction:
if (obj instanceof Line(Point(int x1, int y1), Point(int x2, int y2))) {
    double length = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    System.out.println("Length: " + length);
}
\`\`\`

---

## Text Blocks (Java 15+)

Multi-line string literals with automatic indentation stripping:

\`\`\`java
// Old way:
String json = "{\\n" +
    "  \\"name\\": \\"Alice\\",\\n" +
    "  \\"age\\": 30\\n" +
    "}";

// Text block:
String json = """
    {
      "name": "Alice",
      "age": 30
    }
    """;  // trailing """ determines indentation to strip
\`\`\`

Perfect for SQL queries, JSON templates, HTML, multi-line strings. The indentation of the closing \`"""\` controls how much whitespace is stripped from each line.

---

## Enhanced Switch Expressions (Java 14+)

\`\`\`java
// Old switch (statement, fall-through bugs, verbose):
int days;
switch (month) {
    case JANUARY: case MARCH: case MAY:
        days = 31;
        break;  // ← forget break → bug!
    ...
}

// New switch expression (no fall-through, returns value):
int days = switch (month) {
    case JANUARY, MARCH, MAY, JULY, AUGUST, OCTOBER, DECEMBER -> 31;
    case APRIL, JUNE, SEPTEMBER, NOVEMBER -> 30;
    case FEBRUARY -> year % 4 == 0 ? 29 : 28;
    // Exhaustive over enum — compiler checked
};
\`\`\`

> [!EU]
> Model your domain with **records + sealed interfaces + switch patterns** to show you write modern, type-safe Java. A common senior question: "Show me how you'd model an HTTP response that's either a success with data or an error with a code and message." The \`sealed interface Result<T> permits Success<T>, Failure\` pattern with exhaustive switch is the modern Java answer — it's compile-time safe (no unchecked casts), no Visitor boilerplate, and the compiler enforces completeness.
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
# IoC, Dependency Injection & Bean Lifecycle — From Zero to Senior Level

## The Problem: Tight Coupling

Imagine a checkout service that needs to charge a credit card:

\`\`\`java
// ❌ Tightly coupled — hard to test, hard to change
class CheckoutService {
    private StripeGateway gateway = new StripeGateway(); // hardcoded!

    void checkout(Order order) {
        gateway.charge(order.total());
    }
}
\`\`\`

Problems:
- To test, you must hit Stripe's real API (slow, costs money, flaky)
- Changing from Stripe to Adyen requires modifying CheckoutService
- Can't test different scenarios (payment fails, timeout, etc.)

**Inversion of Control (IoC)** flips this: instead of CheckoutService creating its dependency, something *outside* creates and *provides* it.

\`\`\`java
// ✅ Loosely coupled — testable, flexible
class CheckoutService {
    private final PaymentGateway gateway; // interface, not impl

    CheckoutService(PaymentGateway gateway) { // INJECTED
        this.gateway = gateway;
    }
}
// In production: inject StripeGateway
// In tests: inject MockGateway
\`\`\`

**Dependency Injection (DI)** is the technique. **Spring's IoC container** (ApplicationContext) is the automated DI framework — it creates all your beans, resolves their dependencies, and wires everything together.

---

## How Spring's ApplicationContext Works

When your Spring Boot app starts:

1. \`@SpringBootApplication\` triggers component scanning
2. Spring scans your packages for \`@Component\`, \`@Service\`, \`@Repository\`, \`@Controller\`, \`@RestController\`, \`@Configuration\`
3. For each found class, Spring creates a **bean** (by default, a singleton)
4. Spring analyzes each bean's constructor/setters/fields to find dependencies
5. Spring resolves the dependency graph (topological sort)
6. Spring creates beans in dependency order and injects them
7. \`@PostConstruct\` methods run
8. Application is ready to serve requests

\`\`\`
@SpringBootApplication
       ↓
ApplicationContext created
       ↓
Component scan: finds @Service, @Repository, @RestController...
       ↓
Build dependency graph:
  CheckoutService needs PaymentGateway
  PaymentGateway is StripeGateway (only implementation)
  StripeGateway needs StripeConfig
  StripeConfig needs application.yml values
       ↓
Create in order: StripeConfig → StripeGateway → CheckoutService
       ↓
@PostConstruct methods run (e.g. cache warm-up)
       ↓
Ready
\`\`\`

---

## Three Ways to Define Beans

### 1. @Component and specialisations (most common)
\`\`\`java
@Component          // generic bean
@Service            // business logic layer (same as @Component, semantic)
@Repository         // data access layer (+ exception translation)
@RestController     // HTTP handler (= @Controller + @ResponseBody)
\`\`\`

### 2. @Bean in @Configuration class (for third-party classes you don't own)
\`\`\`java
@Configuration
public class AppConfig {
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(WRITE_DATES_AS_TIMESTAMPS);
    }

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
            .connectTimeout(Duration.ofSeconds(5))
            .readTimeout(Duration.ofSeconds(30))
            .build();
    }
}
\`\`\`

### 3. @Import, @ImportResource for XML/legacy configs (rare in new code)

---

## Injection Styles: Which to Use and Why

### Constructor Injection (✅ Always Prefer)
\`\`\`java
@Service
public class OrderService {
    private final PaymentGateway gateway;
    private final OrderRepository repo;
    private final EventPublisher events;

    // Spring auto-wires if there's only one constructor (no @Autowired needed)
    public OrderService(PaymentGateway gateway, OrderRepository repo, EventPublisher events) {
        this.gateway = gateway;
        this.repo = repo;
        this.events = events;
    }
}
\`\`\`

**Why constructor injection wins:**
- Fields are \`final\` — object is immutable once created
- Dependencies are explicit — you can see what the class needs just by reading its constructor
- Fails at startup if a dependency is missing — no surprise NullPointerExceptions later
- Works without Spring — test with \`new OrderService(mockGateway, mockRepo, mockEvents)\`
- No reflection magic — just regular Java

**With Lombok (cleanest):**
\`\`\`java
@Service
@RequiredArgsConstructor  // generates constructor for all 'final' fields
public class OrderService {
    private final PaymentGateway gateway;
    private final OrderRepository repo;
    private final EventPublisher events;
}
\`\`\`

### Setter Injection (for optional dependencies)
\`\`\`java
@Service
public class NotificationService {
    private EmailSender emailSender;  // optional

    @Autowired(required = false)
    public void setEmailSender(EmailSender emailSender) {
        this.emailSender = emailSender;
    }
}
\`\`\`

Use when the dependency is optional or when you need to allow reconfiguration after construction.

### Field Injection (❌ Avoid)
\`\`\`java
@Service
public class BadService {
    @Autowired
    private PaymentGateway gateway;  // ← DON'T DO THIS
}
\`\`\`

Why it's bad:
- Can't be \`final\` — object is mutable
- Dependencies hidden — can't tell what this class needs without reading all fields
- Can't test without Spring container (need \`@ExtendWith(SpringExtension.class)\` or reflection hacks)
- NullPointerException if used before injection completes
- Circular dependencies silently "work" (via proxy) and hide design problems

---

## Bean Scopes

| Scope | Instances | Created when | Destroyed when |
|-------|-----------|--------------|----------------|
| **singleton** (default) | 1 per container | Container starts | Container closes |
| **prototype** | New each time | Every \`getBean()\` / injection | Caller's responsibility |
| **request** (web) | 1 per HTTP request | Request starts | Request ends |
| **session** (web) | 1 per HTTP session | Session created | Session invalidated |
| **application** (web) | 1 per ServletContext | App starts | App stops |

\`\`\`java
@Component
@Scope("prototype")   // or Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
public class ReportBuilder {
    // new instance for each injection point
}
\`\`\`

### The Singleton-Prototype Injection Trap

\`\`\`java
@Service  // singleton
public class ReportService {
    @Autowired
    private ReportBuilder builder;  // prototype — injected ONCE at startup

    void generateReport() {
        // BUG: always uses the SAME builder instance (captured at startup)
        // despite prototype scope
        builder.build();
    }
}
\`\`\`

Fix with \`ObjectProvider\` (Spring's way to get fresh instances):
\`\`\`java
@Service
public class ReportService {
    private final ObjectProvider<ReportBuilder> builderProvider;

    public ReportService(ObjectProvider<ReportBuilder> builderProvider) {
        this.builderProvider = builderProvider;
    }

    void generateReport() {
        ReportBuilder builder = builderProvider.getObject(); // fresh instance each time
        builder.build();
    }
}
\`\`\`

---

## Bean Lifecycle Hooks

\`\`\`
Constructor called
       ↓
Dependencies injected (fields, setters)
       ↓
@PostConstruct method runs  ← your init code here (can use injected deps)
       ↓
Bean is in use (serving requests)
       ↓
Container shutdown triggered
       ↓
@PreDestroy method runs  ← cleanup: close connections, flush buffers
       ↓
Bean destroyed
\`\`\`

\`\`\`java
@Component
public class ConnectionPool {
    private final DataSource ds;
    private List<Connection> pool;

    public ConnectionPool(DataSource ds) { this.ds = ds; }

    @PostConstruct
    void init() {
        // Constructor finished, ds is injected — safe to use it now
        pool = new ArrayList<>();
        for (int i = 0; i < 10; i++) pool.add(ds.getConnection());
        log.info("Pool initialised with {} connections", pool.size());
    }

    @PreDestroy
    void shutdown() {
        pool.forEach(Connection::close);
        log.info("Pool closed");
    }
}
\`\`\`

---

## Circular Dependencies and How to Detect Them

\`\`\`
ServiceA needs ServiceB
ServiceB needs ServiceA
→ Spring can't create either one first!
\`\`\`

Constructor injection: **fails fast at startup** with \`BeanCurrentlyInCreationException\`. This is the correct behavior — it surfaces a design problem.

Field/setter injection: Spring works around it with proxy magic — the circular dependency "works" but you now have a design smell silently hidden.

**How to fix circular dependencies:**
1. Extract the shared logic into a third service (best fix — usually the design is wrong)
2. Use an event (\`ApplicationEventPublisher\`) instead of direct dependency
3. Make one dependency \`@Lazy\` — defers creation until first use (last resort)

> [!EU]
> The two most-asked Spring IoC questions: (1) *"Constructor vs field injection — which and why?"* Answer: constructor — immutable fields, explicit dependencies, testable without container, fails fast. (2) *"Singleton bean with mutable state — what's the risk?"* → shared across all HTTP request threads simultaneously → race conditions. Keep Spring beans **stateless**: no instance fields that hold per-request data. Use \`@RequestScope\` or method parameters for per-request state.
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
# Spring Boot Auto-Configuration — From Zero to Senior Level

## The Problem Boot Solves

Before Spring Boot, setting up a Spring web application required:
- \`web.xml\` for the servlet container
- \`applicationContext.xml\` or Java config for Spring beans
- Manually declaring a \`DispatcherServlet\`, \`ViewResolver\`, \`DataSource\`, \`TransactionManager\`...
- Manually managing compatible library versions (Jackson 2.x vs 1.x, Hibernate 5 vs 6...)

A simple CRUD app needed 200+ lines of configuration before writing business logic.

Spring Boot's answer: **auto-configuration** — sensible defaults based on what's on the classpath, with easy override when you need something different.

---

## How Auto-Configuration Works (Deep Dive)

### Step 1: @SpringBootApplication

\`\`\`java
@SpringBootApplication
public class MyApp {
    public static void main(String[] args) { SpringApplication.run(MyApp.class, args); }
}
\`\`\`

\`@SpringBootApplication\` is a composite of three annotations:
\`\`\`java
@SpringBootConfiguration   // = @Configuration: this class defines beans
@EnableAutoConfiguration   // ← the magic
@ComponentScan             // scan this package and sub-packages for @Component etc.
\`\`\`

### Step 2: @EnableAutoConfiguration loads candidates

\`@EnableAutoConfiguration\` triggers \`AutoConfigurationImportSelector\`, which reads:
\`\`\`
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
\`\`\`
(before Boot 2.7: \`META-INF/spring.factories\`)

This file lists ~150 auto-configuration classes like:
\`\`\`
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration
org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
\`\`\`

### Step 3: @Conditional gates each auto-config

Each auto-configuration class is annotated with conditions. Spring evaluates them and only applies the config if ALL conditions pass:

\`\`\`java
// Simplified DataSourceAutoConfiguration:
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })  // jdbc on classpath?
@ConditionalOnMissingBean(DataSource.class)                             // user didn't define one?
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnProperty(name="spring.datasource.url")
    public DataSource dataSource(DataSourceProperties props) {
        return props.initializeDataSourceBuilder().build();
    }
}
\`\`\`

**The key conditions to memorise:**

| Condition | Meaning |
|-----------|---------|
| \`@ConditionalOnClass(Foo.class)\` | \`Foo\` must be on the classpath |
| \`@ConditionalOnMissingClass\` | class must NOT be present |
| \`@ConditionalOnBean(Foo.class)\` | a \`Foo\` bean must already exist |
| \`@ConditionalOnMissingBean\` | no bean of this type defined → Boot creates one |
| \`@ConditionalOnProperty("x.y")\` | property must be set (and optionally = value) |
| \`@ConditionalOnWebApplication\` | running as a web app |
| \`@ConditionalOnExpression("...")\` | SpEL expression evaluates to true |

### The Golden Rule: Define Your Own Bean → Boot Backs Off

\`@ConditionalOnMissingBean\` is what makes Boot's defaults easy to override:

\`\`\`java
// Boot's default ObjectMapper (simplified):
@Bean
@ConditionalOnMissingBean(ObjectMapper.class)  // ← only if YOU haven't defined one
public ObjectMapper jacksonObjectMapper() {
    return new ObjectMapper();
}

// YOU override it by defining your own:
@Configuration
public class JacksonConfig {
    @Bean
    public ObjectMapper objectMapper() {      // your bean exists → Boot's backs off
        return new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .setSerializationInclusion(NON_NULL);
    }
}
\`\`\`

---

## Diagnosing Auto-Configuration

### The Condition Evaluation Report
Run with \`--debug\` flag or set \`logging.level.org.springframework.boot.autoconfigure=DEBUG\`:

\`\`\`
CONDITIONS EVALUATION REPORT
============================

Positive matches:
-----------------
   DataSourceAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'DataSource', 'EmbeddedDatabaseType' (OnClassCondition)
      - @ConditionalOnMissingBean (types: javax.sql.DataSource) did not find any beans (OnBeanCondition)

Negative matches:
-----------------
   MongoDataAutoConfiguration:
      - @ConditionalOnClass did not find required class 'com.mongodb.client.MongoClient' (OnClassCondition)
\`\`\`

This is invaluable for "why isn't my bean created?" or "why is this bean created when I don't want it?"

### Actuator: /actuator/conditions endpoint
In a running app, \`GET /actuator/conditions\` shows the same report live.

---

## Configuration Properties: Type-Safe Config

Instead of \`@Value("\${app.timeout}")\`, bind entire config sections to POJOs:

\`\`\`java
@ConfigurationProperties(prefix = "app.payment")
@Validated
public record PaymentProperties(
    @NotBlank String apiKey,
    @NotNull @Min(1) Integer timeoutSeconds,
    @NotBlank String baseUrl,
    boolean sandboxMode
) {}
\`\`\`

\`\`\`yaml
# application.yml
app:
  payment:
    api-key: sk_live_xxx        # kebab-case auto-maps to camelCase
    timeout-seconds: 30
    base-url: https://api.stripe.com
    sandbox-mode: false
\`\`\`

\`\`\`java
@Service
@RequiredArgsConstructor
public class PaymentService {
    private final PaymentProperties config;

    void charge() {
        if (config.sandboxMode()) { /* use test endpoint */ }
        // config.timeoutSeconds(), config.baseUrl(), etc.
    }
}
\`\`\`

Benefits over \`@Value\`:
- Type conversion (String → Integer, Duration, List, Map)
- Validation with Bean Validation annotations (\`@NotNull\`, \`@Min\`)
- IDE autocompletion in \`application.yml\`
- Grouped — all payment config in one place
- Testable — just construct the record in tests

---

## Profiles: Environment-Specific Configuration

\`\`\`yaml
# application.yml (base — all environments)
spring:
  datasource:
    url: jdbc:h2:mem:testdb     # fallback for local dev

app:
  feature-x: false

---
# application-local.yml (override for local dev)
spring:
  datasource:
    url: jdbc:h2:mem:localdb
logging:
  level:
    com.myapp: DEBUG

---
# application-prod.yml (override for production)
spring:
  datasource:
    url: jdbc:postgresql://prod-db:5432/myapp
    username: \${DB_USER}          # from environment variable
    password: \${DB_PASSWORD}      # from environment variable — NEVER hardcode
app:
  feature-x: true
\`\`\`

Activate a profile:
\`\`\`bash
SPRING_PROFILES_ACTIVE=prod java -jar app.jar
# or
java -jar app.jar --spring.profiles.active=prod
\`\`\`

Profile-specific beans:
\`\`\`java
@Service
@Profile("prod")          // only created when 'prod' profile is active
public class RealEmailService implements EmailService { ... }

@Service
@Profile("!prod")         // all profiles EXCEPT prod
public class LoggingEmailService implements EmailService { ... }
\`\`\`

---

## Starters: Curated Dependency Bundles

\`spring-boot-starter-web\` pulls in:
- Spring MVC (DispatcherServlet, etc.)
- Embedded Tomcat (no need to deploy a WAR)
- Jackson (JSON serialization)
- Spring Boot auto-configuration for all of the above

Versions are managed by \`spring-boot-starter-parent\` BOM — no version conflicts.

Common starters:

| Starter | What it gives you |
|---------|-------------------|
| \`spring-boot-starter-web\` | Spring MVC + Tomcat + Jackson |
| \`spring-boot-starter-data-jpa\` | Hibernate + Spring Data JPA + HikariCP |
| \`spring-boot-starter-security\` | Spring Security filter chain |
| \`spring-boot-starter-actuator\` | /health, /metrics, /info endpoints |
| \`spring-boot-starter-test\` | JUnit 5, Mockito, AssertJ, MockMvc |
| \`spring-boot-starter-validation\` | Bean Validation (Hibernate Validator) |

---

## Actuator: Production Observability

\`\`\`yaml
# application.yml — expose only safe endpoints over web
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics  # NEVER expose env, heapdump, shutdown
  endpoint:
    health:
      show-details: when-authorized     # hide internals from unauthenticated users
\`\`\`

Key endpoints:
- \`/actuator/health\` — UP/DOWN + component health (DB, disk, external services)
- \`/actuator/metrics\` — micrometer metrics (request counts, latencies, JVM stats)
- \`/actuator/info\` — build info, git commit
- \`/actuator/conditions\` — which auto-configs applied (dev only)
- \`/actuator/beans\` — all beans in the context (dev only)

> [!DANGER]
> Never expose \`/actuator/env\` (leaks all config including passwords), \`/actuator/heapdump\` (entire heap = all data in memory), or \`/actuator/shutdown\` publicly. Secure actuator behind authentication and only expose \`health\` + \`info\` to the web. Everything else on internal management port only (\`management.server.port=8081\`).

> [!EU]
> Expect: *"Walk me through what happens when a Spring Boot app starts."* Strong answer: \`main()\` → \`SpringApplication.run()\` → creates ApplicationContext → component scan → \`@EnableAutoConfiguration\` loads candidates → conditionals evaluated → matching beans created → \`@PostConstruct\` runs → embedded Tomcat starts → app ready. Then: "How would you override Boot's default Jackson config?" → define your own \`ObjectMapper\` bean — \`@ConditionalOnMissingBean\` makes Boot back off.
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
# Transactions, AOP & @Transactional — From Zero to Senior Level

## What Is a Transaction?

A **database transaction** is a group of operations that execute as a single unit. Either ALL succeed (commit) or ALL fail (rollback). No partial state.

Classic example — transferring €100 from Alice to Bob:
\`\`\`sql
BEGIN;
UPDATE account SET balance = balance - 100 WHERE id = 'alice';
UPDATE account SET balance = balance + 100 WHERE id = 'bob';
COMMIT;   -- both updates visible atomically
-- If anything fails between BEGIN and COMMIT → ROLLBACK → neither update happens
\`\`\`

Without a transaction: if the process crashes after debiting Alice but before crediting Bob, €100 disappears. With a transaction: the rollback restores Alice's balance.

---

## AOP: How Spring Applies @Transactional

Spring's transactions use **AOP (Aspect-Oriented Programming)**. AOP lets you add cross-cutting behaviour (logging, security, transactions) to methods without modifying their code.

### The Proxy Mechanism

When Spring sees \`@Transactional\` on a bean, it doesn't modify your class. Instead it wraps it in a **proxy object**:

\`\`\`
Client code          Proxy (Spring-generated)        Your actual bean
    │                        │                              │
    │  orderService.place()  │                              │
    ├───────────────────────►│                              │
    │                        │  BEGIN TRANSACTION           │
    │                        │  target.place()              │
    │                        ├─────────────────────────────►│
    │                        │                              │  business logic
    │                        │◄─────────────────────────────┤
    │                        │  COMMIT (or ROLLBACK)        │
    │◄───────────────────────┤                              │
\`\`\`

Spring generates the proxy in two ways:
- **JDK Dynamic Proxy**: if your bean implements an interface → proxy implements the same interface
- **CGLIB**: if no interface → proxy subclasses your class (byte-code generation)

This proxy mechanism has critical consequences — it explains ALL @Transactional gotchas.

---

## The #1 Gotcha: Self-Invocation Bypasses the Proxy

\`\`\`java
@Service
public class OrderService {

    @Transactional
    public void placeOrder(Order order) {
        saveOrder(order);
        chargePayment(order);   // ← calls chargePayment DIRECTLY on 'this'
    }

    @Transactional(propagation = REQUIRES_NEW)  // ← IGNORED!
    public void chargePayment(Order order) {
        // This DOES NOT run in a new transaction
        // because the call bypassed the proxy!
        paymentGateway.charge(order.total());
    }
}
\`\`\`

When \`placeOrder\` calls \`chargePayment\` via \`this.chargePayment()\`, it goes directly to the real object — bypassing the proxy entirely. The \`@Transactional\` on \`chargePayment\` is never seen.

**Fixes:**

**Fix 1: Extract to a separate bean (best — fixes the design too)**
\`\`\`java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final PaymentService paymentService;  // separate bean = goes through proxy

    @Transactional
    public void placeOrder(Order order) {
        saveOrder(order);
        paymentService.chargePayment(order);  // ← through proxy → works!
    }
}
\`\`\`

**Fix 2: Self-inject via ApplicationContext (hack — use only if refactoring is hard)**
\`\`\`java
@Service
public class OrderService {
    @Autowired
    private OrderService self;  // Spring injects the PROXY, not 'this'

    public void placeOrder(Order order) {
        self.chargePayment(order);  // goes through the proxy
    }
}
\`\`\`

---

## @Transactional Rules Every Senior Must Know

### Rule 1: Only public methods work
\`\`\`java
@Transactional
private void doSomething() { ... }   // ❌ IGNORED — proxy can't override private

@Transactional
public void doSomething() { ... }    // ✅ works
\`\`\`
CGLIB proxies can't override private/final methods. Spring simply ignores \`@Transactional\` on them with no warning.

### Rule 2: Rollback behaviour — checked vs unchecked

\`\`\`java
// Default behaviour:
@Transactional
public void save(Entity e) throws IOException {
    repo.save(e);
    riskyOp();  // throws IOException (checked) → COMMITS! (surprise!)
    riskyOp2(); // throws RuntimeException (unchecked) → ROLLBACK ✓
}

// Fix: explicitly declare what to rollback for
@Transactional(rollbackFor = Exception.class)  // rollback for ANY exception
public void save(Entity e) throws IOException { ... }

@Transactional(noRollbackFor = OptimisticLockException.class)  // commit even if this
public void save(Entity e) { ... }
\`\`\`

### Rule 3: Keep transactions SHORT

Every second a transaction is open, it holds:
- A database connection (from a limited pool — HikariCP default 10)
- Row locks (for writes) — blocking other transactions
- Potentially a whole table lock

\`\`\`java
// ❌ DANGEROUS: external HTTP call inside a transaction
@Transactional
public void processOrder(Order order) {
    repo.save(order);           // holds connection...
    emailService.send(order);   // HTTP call — can take seconds!
    // DB connection held for seconds → pool exhausted under load → timeouts
}

// ✅ CORRECT: do I/O outside the transaction
public void processOrder(Order order) {
    doInTransaction(order);         // short transaction: just DB work
    emailService.send(order);       // I/O after transaction commits
}

@Transactional
private void doInTransaction(Order order) {
    repo.save(order);               // transaction commits here
}
\`\`\`

---

## Transaction Propagation: What Happens When Transactional Methods Call Each Other

\`\`\`java
@Transactional(propagation = Propagation.REQUIRED)     // default
// If caller has a tx → join it. If not → create a new one.
// Most common — use for normal business operations.

@Transactional(propagation = Propagation.REQUIRES_NEW)
// ALWAYS create a new independent tx. Suspend caller's tx.
// Use for: audit logging that must persist even if outer tx rolls back.
// e.g. log "attempted to place order" even if order creation fails

@Transactional(propagation = Propagation.NESTED)
// Savepoint within the current tx. Can rollback to the savepoint.
// Outer tx can still commit. Database must support savepoints.

@Transactional(propagation = Propagation.MANDATORY)
// Must be called within an existing tx — throws if no tx active.
// Use for internal methods that must only be called from @Transactional code.

@Transactional(propagation = Propagation.NEVER)
// Must NOT be called within a tx — throws if a tx is active.

@Transactional(propagation = Propagation.NOT_SUPPORTED)
// Suspend current tx if any, run without tx.
\`\`\`

**Real-world REQUIRES_NEW example:**
\`\`\`java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final AuditService auditService;

    @Transactional  // REQUIRED
    public void placeOrder(Order order) {
        try {
            repo.save(order);
            paymentGateway.charge(order);
        } catch (Exception e) {
            // outer transaction WILL roll back
            // but we still want the audit log to persist!
            auditService.logFailure(order, e);  // runs in its own tx
            throw e;
        }
    }
}

@Service
public class AuditService {
    @Transactional(propagation = REQUIRES_NEW)  // independent tx
    public void logFailure(Order order, Exception e) {
        auditRepo.save(new AuditEntry(order.id(), "FAILED", e.getMessage()));
        // this commits even when placeOrder rolls back
    }
}
\`\`\`

---

## AOP Beyond Transactions: @Aspect

Spring AOP lets you write cross-cutting concerns once and apply them everywhere:

\`\`\`java
@Aspect
@Component
public class PerformanceMonitor {

    // Pointcut: match any public method in the service package
    @Around("execution(public * com.myapp.service.*.*(..))")
    public Object measureTime(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        String method = pjp.getSignature().toShortString();
        try {
            Object result = pjp.proceed();  // call the actual method
            long ms = System.currentTimeMillis() - start;
            if (ms > 500) log.warn("SLOW: {} took {}ms", method, ms);
            return result;
        } catch (Throwable t) {
            log.error("FAILED: {} after {}ms", method, System.currentTimeMillis() - start);
            throw t;
        }
    }
}

// Advice types:
// @Before    — runs before the method
// @After     — runs after (always, like finally)
// @AfterReturning — runs after successful return
// @AfterThrowing  — runs if exception thrown
// @Around    — wraps the method (most powerful — you control proceed())
\`\`\`

Common AOP use cases: logging, metrics, security checks, rate limiting, caching, retry logic.

> [!EU]
> The killer question: *"Why didn't my @Transactional work?"* Walk through the diagnostic checklist: (1) self-invocation? → no proxy involved; (2) method public? → private/final is ignored; (3) checked exception? → default only rolls back unchecked; (4) correct proxy type? → interface vs CGLIB. Showing this structured diagnosis is exactly what a senior engineer does. Then add: "And I always keep transactions short — no HTTP calls inside a @Transactional method."
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
# Spring Data JPA in Practice — From Zero to Senior Level

## What Is JPA and Why Use It?

Writing SQL by hand is tedious and error-prone. **JPA (Java Persistence API)** is a specification for mapping Java objects to database tables — no SQL needed for basic operations.

**Hibernate** is the most popular JPA implementation. **Spring Data JPA** sits on top of Hibernate and eliminates even more boilerplate.

\`\`\`
Your Java code
      ↓
Spring Data JPA (repository interfaces)
      ↓
JPA (EntityManager API)
      ↓
Hibernate (generates and runs SQL)
      ↓
JDBC (sends SQL to database)
      ↓
Database (PostgreSQL, MySQL, H2...)
\`\`\`

---

## Entity Mapping: Java Class → Database Table

\`\`\`java
@Entity
@Table(name = "orders")       // maps to 'orders' table (default: class name)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // auto-increment
    private Long id;

    @Column(name = "total_cents", nullable = false)
    private int totalCents;

    @Column(unique = true)
    private String referenceCode;

    @Enumerated(EnumType.STRING)   // store "PENDING" not "0"
    private OrderStatus status;

    @CreationTimestamp             // Hibernate sets on insert
    private LocalDateTime createdAt;

    @UpdateTimestamp               // Hibernate sets on update
    private LocalDateTime updatedAt;

    // Relationship: one order has many items
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<OrderItem> items = new ArrayList<>();

    // Relationship: many orders belong to one customer
    @ManyToOne(fetch = FetchType.LAZY)   // LAZY = don't load customer until accessed
    @JoinColumn(name = "customer_id")
    private Customer customer;
}
\`\`\`

### Key JPA Annotations
| Annotation | Purpose |
|-----------|---------|
| \`@Entity\` | marks class as JPA-managed |
| \`@Table(name)\` | override table name |
| \`@Id\` | primary key field |
| \`@GeneratedValue\` | auto-generate PK (IDENTITY, SEQUENCE, AUTO) |
| \`@Column\` | column mapping, nullability, uniqueness |
| \`@OneToMany\`, \`@ManyToOne\` | relationship mapping |
| \`@Enumerated(STRING)\` | store enum as string (not ordinal!) |
| \`@Transient\` | field not persisted to DB |
| \`@Embedded\`, \`@Embeddable\` | embed value object as columns |

---

## Spring Data Repositories

Declare an interface — Spring generates the implementation:

\`\`\`java
// Repository hierarchy (choose the right level):
Repository<T, ID>              // root interface — no methods
CrudRepository<T, ID>          // save, findById, findAll, delete, count
PagingAndSortingRepository     // + findAll(Pageable), findAll(Sort)
JpaRepository<T, ID>           // + flush, saveAndFlush, deleteInBatch, getOne

// Your repo:
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // 1. DERIVED QUERIES — Spring parses the method name into SQL
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByCustomerIdAndStatusOrderByCreatedAtDesc(Long customerId, OrderStatus status);
    Optional<Order> findByReferenceCode(String ref);
    boolean existsByReferenceCode(String ref);
    long countByStatus(OrderStatus status);
    void deleteByStatusAndCreatedAtBefore(OrderStatus status, LocalDateTime cutoff);

    // 2. @Query — JPQL for complex queries
    @Query("SELECT o FROM Order o WHERE o.totalCents > :min AND o.status = :status")
    List<Order> findHighValueOrders(@Param("min") int minCents, @Param("status") OrderStatus status);

    // 3. Native SQL when JPQL can't express it
    @Query(value = "SELECT * FROM orders WHERE total_cents > ? AND status = ?",
           nativeQuery = true)
    List<Order> findHighValueNative(int minCents, String status);

    // 4. Modifying queries (UPDATE/DELETE)
    @Modifying
    @Transactional
    @Query("UPDATE Order o SET o.status = :newStatus WHERE o.id IN :ids")
    int bulkUpdateStatus(@Param("ids") List<Long> ids, @Param("newStatus") OrderStatus newStatus);
}
\`\`\`

### Derived Query Keywords
\`\`\`
findBy / getBy / readBy / queryBy / countBy / existsBy / deleteBy

Comparisons:   Equals, Not, LessThan, GreaterThan, Between, Like, In, NotIn
Logical:       And, Or
Null checks:   IsNull, IsNotNull
Bool:          IsTrue, IsFalse
String:        StartingWith, EndingWith, Containing, IgnoreCase
Sorting:       OrderBy + Asc/Desc
\`\`\`

---

## The N+1 Problem — The #1 JPA Performance Bug

This is virtually guaranteed to appear in every interview.

\`\`\`java
// Service code that looks innocent:
List<Author> authors = authorRepo.findAll();  // Query 1: SELECT * FROM author
for (Author a : authors) {
    System.out.println(a.getBooks().size());  // Query 2,3,4...N: SELECT * FROM book WHERE author_id=?
}
// If there are 100 authors: 1 + 100 = 101 queries!
// If there are 1000 authors: 1001 queries!
\`\`\`

**Why does this happen?** Collections default to \`FetchType.LAZY\`. Hibernate loads them on first access, one by one.

### Fix 1: JOIN FETCH (best for most cases)
\`\`\`java
@Query("SELECT a FROM Author a JOIN FETCH a.books WHERE a.active = true")
List<Author> findActiveAuthorsWithBooks();
// Generates: SELECT a.*, b.* FROM author a JOIN book b ON b.author_id = a.id WHERE a.active = true
// 1 query total
\`\`\`

### Fix 2: @EntityGraph (annotation-based, less SQL knowledge needed)
\`\`\`java
@EntityGraph(attributePaths = {"books", "books.reviews"})  // eager-load these associations
List<Author> findByActive(boolean active);
// Spring generates the JOIN FETCH automatically
\`\`\`

### Fix 3: Batch Fetching (global setting, works for nested loads)
\`\`\`yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 20   # load books in batches of 20
\`\`\`
Instead of N queries, Hibernate generates: \`SELECT * FROM book WHERE author_id IN (1,2,3,...,20)\`

### Detecting N+1 in Development
\`\`\`yaml
spring:
  jpa:
    show-sql: true          # prints all SQL (noisy, dev only)
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE  # shows bind parameters
\`\`\`

Or use **datasource-proxy** / **p6spy** to count queries per request:
\`\`\`
Request /api/orders → 47 SQL queries executed   ← N+1 detected!
Request /api/orders → 2 SQL queries executed    ← fixed!
\`\`\`

---

## LAZY vs EAGER Fetching

\`\`\`java
@ManyToOne(fetch = FetchType.EAGER)   // default for @ManyToOne, @OneToOne
@ManyToOne(fetch = FetchType.LAZY)    // ✅ recommended

@OneToMany(fetch = FetchType.LAZY)    // default for @OneToMany, @ManyToMany ✅
@OneToMany(fetch = FetchType.EAGER)   // ❌ dangerous
\`\`\`

**The rule:** make EVERYTHING lazy, fetch explicitly where needed.

EAGER means: every time you load an \`Order\`, it ALWAYS also loads the \`Customer\`, even if you only need the order's total. With 10 associations marked EAGER, one \`findById\` generates 10 joins.

### LazyInitializationException — The Classic Pitfall

\`\`\`java
// Controller (outside the transaction):
@GetMapping("/orders/{id}")
OrderDto getOrder(@PathVariable Long id) {
    Order order = orderService.findById(id);  // transaction ends here
    return new OrderDto(
        order.getId(),
        order.getItems().size()   // ← LazyInitializationException!
        // Hibernate session closed, can't load items lazily
    );
}
\`\`\`

**Wrong fix:** \`spring.jpa.open-in-view=true\` (default true in Boot!) — keeps the DB connection open for the entire HTTP request including the view layer. This is a huge anti-pattern: DB connections held open while rendering HTML/JSON.

**Right fix:** fetch everything you need inside the \`@Transactional\` service method, and map to a DTO before returning:
\`\`\`java
@Service
public class OrderService {
    @Transactional(readOnly = true)   // read-only: performance hint to Hibernate
    public OrderDto getOrder(Long id) {
        Order order = repo.findByIdWithItems(id)  // JOIN FETCH items inside transaction
            .orElseThrow(() -> new NotFoundException(id));
        return toDto(order);   // map to DTO while session is still open
        // transaction ends, session closes — but DTO has no lazy associations
    }
}
\`\`\`

---

## Pagination

\`\`\`java
@GetMapping("/orders")
Page<OrderDto> getOrders(@RequestParam int page, @RequestParam int size) {
    Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
    Page<Order> orderPage = repo.findByStatus(PENDING, pageable);

    return orderPage.map(this::toDto);  // Page.map() preserves pagination metadata
}
// Returns: { content: [...], totalElements: 450, totalPages: 45, number: 0, size: 10 }
\`\`\`

> [!WARNING]
> Avoid \`findAll()\` on large tables — it loads everything into memory. Always use \`Pageable\` or stream the results.

---

## Optimistic vs Pessimistic Locking

**Optimistic locking** (no DB locks, conflict detected on commit):
\`\`\`java
@Entity
public class Product {
    @Version           // Hibernate manages this column
    private int version;
    private int stock;
}

// Thread A reads product (version=5, stock=10)
// Thread B reads product (version=5, stock=10)
// Thread A updates: stock=9, version becomes 6 → OK
// Thread B updates: WHERE version=5 → no rows matched! → OptimisticLockException
// Thread B must retry
\`\`\`
Use for: low-contention scenarios (most web apps). No DB locks held between read and write.

**Pessimistic locking** (holds a DB row lock):
\`\`\`java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT p FROM Product p WHERE p.id = :id")
Optional<Product> findByIdForUpdate(@Param("id") Long id);
// Generates: SELECT * FROM product WHERE id=? FOR UPDATE
// Other transactions block until this transaction commits
\`\`\`
Use for: high-contention (inventory updates, financial transfers). Guaranteed no conflicts but reduces concurrency.

> [!EU]
> The near-certain questions: *"What is N+1 and how do you fix it?"* (JOIN FETCH / @EntityGraph / batch size — show you always check the SQL log); *"Why LAZY over EAGER?"* (avoid surprise joins, fetch explicitly where needed); *"What causes LazyInitializationException?"* (lazy load after session closed, fix by mapping to DTO inside @Transactional, not open-session-in-view). These three topics catch more candidates than any other Spring question.
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
