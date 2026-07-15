/* ============================================================
   Java Interview Hub — curated interview questions
   Keyed by module id. Rendered click-to-reveal at the bottom of
   each module Study Guide ("Likely interview questions").
   57 modules · 360 questions. Edit freely.
   ============================================================ */
const INTERVIEW_QUESTIONS = {
  "0.1": [
    {
      "q": "What is the difference between the JDK, the JRE and the JVM?",
      "a": "The JVM (Java Virtual Machine) is the engine that actually executes Java bytecode; there is a different JVM implementation per operating system, which is what makes Java portable. The JRE (Java Runtime Environment) is the JVM plus the standard class libraries needed to RUN a Java application. The JDK (Java Development Kit) is the JRE plus the development tools you need to BUILD applications -- the compiler javac, the jar tool, javadoc, the debugger and so on. To write Java you install a JDK; to only run a finished app you historically needed just a JRE (modern distributions usually ship a full JDK)."
    },
    {
      "q": "What does 'write once, run anywhere' mean and how does Java achieve it?",
      "a": "You compile your source once into platform-neutral bytecode (.class files), and that same bytecode runs on any machine that has a JVM, without recompiling. Java achieves it by inserting the JVM as a layer between your program and the OS: javac targets the abstract JVM instruction set instead of a specific CPU, and each OS ships its own JVM that translates that bytecode into native instructions at run time. The bytecode is the same everywhere; only the JVM underneath differs."
    },
    {
      "q": "Walk through what happens from a .java file to a running program.",
      "a": "You write source in a .java file. The compiler javac checks it and produces one .class file per class, containing bytecode. You launch it with `java YourClass`; the JVM starts, its class loader loads the needed .class files, the bytecode verifier checks them for safety, and then the JVM executes your program starting at the main method -- interpreting the bytecode and, for hot code, JIT-compiling it to native machine code for speed."
    },
    {
      "q": "Explain the signature `public static void main(String[] args)` piece by piece.",
      "a": "It is the entry point the JVM calls to start your program. public means the JVM can call it from outside the class; static means it runs without first creating an object of the class; void means it returns nothing; main is the fixed name the JVM looks for; String[] args is the array of command-line arguments passed to the program. If this exact shape is missing, `java` fails with an error that it cannot find or launch main."
    },
    {
      "q": "Why must a public class's file name match the class name?",
      "a": "The Java compiler requires that a public top-level class live in a file of the same name (Order in Order.java), so tools and the class loader can locate a class predictably from its name. If they do not match, javac reports an error. Non-public top-level classes do not have this restriction, which is why small demo files sometimes use a package-private class to avoid the filename constraint."
    },
    {
      "q": "What is bytecode, and how is it different from machine code?",
      "a": "Bytecode is the intermediate instruction set that javac produces -- compact, platform-independent instructions for the abstract JVM, stored in .class files. Machine code is the concrete instruction set of a specific physical CPU. Bytecode is not run directly by the CPU; the JVM interprets it and JIT-compiles the hot parts into real machine code at run time. You can inspect bytecode with `javap -c YourClass`."
    },
    {
      "q": "At a beginner level, what is the difference between the stack and the heap?",
      "a": "The stack holds each method call's frame -- its local variables and the bookkeeping to return -- and unwinds automatically as methods return. The heap is the shared region where objects created with `new` live; variables on the stack hold references (pointers) to those heap objects. Primitives and references sit on the stack; the actual objects sit on the heap and are cleaned up later by the garbage collector. (The deep mechanics come later in the JVM Internals phase.)"
    },
    {
      "q": "Which Java versions matter, and what is an LTS release?",
      "a": "LTS (Long-Term Support) releases get extended support and are what companies standardize on: 8, 11, 17 and 21 are the widely-used LTS versions. Non-LTS releases come every six months and are shorter-lived. For interviews, know that 8 introduced lambdas/streams, and 17 and 21 added records, sealed types, pattern matching and virtual threads. Targeting an LTS is the safe default for production."
    }
  ],
  "0.2": [
    {
      "q": "Java is often described as 'pass-by-value' even for objects. Explain what that actually means and a bug it commonly causes.",
      "a": "Java always copies the value of the argument; for reference types the value being copied is the reference (the pointer), not the object. So a method can mutate the object's fields and the caller sees it, but reassigning the parameter inside the method does not change which object the caller's variable points to. The classic bug is a 'swap(a, b)' method that swaps the local references and has no effect on the caller's variables."
    },
    {
      "q": "Why can comparing two Integer objects with == sometimes return true and sometimes false?",
      "a": "Integer caches boxed values from -128 to 127 (the IntegerCache), so == on two autoboxed values in that range compares the same cached reference and returns true. Outside that range each autoboxing creates a new object, so == returns false even when the numeric values are equal. The lesson is to always use .equals() or unbox to int before comparing, and to never rely on identity for boxed numbers."
    },
    {
      "q": "When would you choose BigDecimal over double, and what is the one mistake people make constructing it?",
      "a": "Use BigDecimal whenever exact decimal arithmetic matters — money, billing, tax, anything user-facing where 0.1 + 0.2 must equal 0.3. The common mistake is new BigDecimal(0.1), which captures the inexact binary double; you must use new BigDecimal(\"0.1\") or BigDecimal.valueOf(0.1) to get the exact decimal. Also set an explicit scale and RoundingMode on divide(), or it throws ArithmeticException on non-terminating results."
    },
    {
      "q": "What is integer overflow in Java, why is it silent, and how do you guard against it in production?",
      "a": "Java integer arithmetic wraps around modulo 2^32 (or 2^64) with no exception, so Integer.MAX_VALUE + 1 silently becomes Integer.MIN_VALUE. It is silent because the JLS defines two's-complement wraparound rather than a trap. In code that handles untrusted sizes, durations, or financial sums, use Math.addExact / multiplyExact (which throw on overflow) or widen to long, and watch for the midpoint bug (low+high)/2 in binary search."
    },
    {
      "q": "Explain the difference between the stack and the heap and how it relates to garbage collection and escape analysis.",
      "a": "Local primitives and object references live on the per-thread stack and are reclaimed instantly when the frame pops; the objects they point to live on the shared heap and are reclaimed only by the garbage collector once unreachable. This is why an object 'going out of scope' is not immediately freed — it is just eligible for GC. Modern JITs can use escape analysis to scalar-replace or stack-allocate objects that never escape a method, avoiding heap allocation entirely."
    },
    {
      "q": "Why is char a numeric type in Java, and what breaks when you treat a String as a sequence of chars for non-Latin text?",
      "a": "char is an unsigned 16-bit UTF-16 code unit, so it participates in arithmetic and 'A' + 1 yields 66. The trap is that characters outside the Basic Multilingual Plane (emoji, many CJK extensions) are encoded as surrogate pairs spanning two chars, so str.length() and charAt() count code units, not code points. For correct counting or iteration use codePointCount, codePoints(), or String methods that are code-point aware."
    }
  ],
  "0.3": [
    {
      "q": "Compare a traditional switch statement with a switch expression (Java 14+). When would you reach for the new form?",
      "a": "The old switch is a statement with fall-through by default, requires break, and cannot produce a value directly, which makes accidental fall-through a classic bug source. The arrow switch expression (case X -> ...) has no fall-through, can yield a value to assign, and the compiler enforces exhaustiveness when switching over an enum or sealed type. Reach for the expression form whenever you are mapping an input to a value, because it is both safer and more concise."
    },
    {
      "q": "What is the difference between break, labeled break, and continue, and when is a labeled break actually justified?",
      "a": "break exits the innermost loop or switch, continue skips to the next iteration of the innermost loop, and a labeled break/continue targets a named outer loop. A labeled break is justified for cleanly exiting nested loops once a condition is met — for example, found a match in a 2D grid — without a found flag or refactoring into a method. In practice extracting the loop into a method and returning is often cleaner and is what I'd prefer in shared code."
    },
    {
      "q": "Why can an enhanced for-each loop throw ConcurrentModificationException, and how do you remove elements correctly?",
      "a": "for-each desugars to an Iterator, and most collections track a modCount; structurally modifying the collection (add/remove) directly while iterating makes the iterator's expected count diverge, so the next call throws ConcurrentModificationException fail-fast. To remove during iteration, use the explicit Iterator.remove(), or Collection.removeIf(predicate) which handles it internally. Note this is a best-effort safety check, not a thread-safety guarantee."
    },
    {
      "q": "Explain switch pattern matching (Java 21) and how it changes the way you'd write type-dispatch code.",
      "a": "Java 21 lets case labels match on type patterns and even deconstruct records, with optional guards via 'when', so you can dispatch on the runtime shape of an object in one exhaustive switch. Over a sealed hierarchy the compiler verifies all permitted subtypes are handled, eliminating the default branch and catching gaps at compile time. This replaces long instanceof-and-cast chains and is the idiomatic way to do closed-set polymorphism without scattering behavior across subclasses."
    },
    {
      "q": "What pitfalls come from comparing floating-point or wrapper values in loop conditions and switch?",
      "a": "Floating-point loop counters accumulate rounding error, so 'for (double d = 0; d != 1.0; d += 0.1)' may never terminate — always count with an int or compare with a tolerance. switch on a boxed Integer auto-unboxes and throws NullPointerException if the value is null, which a bare null check before the switch would have caught. These are the kinds of edge cases that pass unit tests with round numbers but fail in production data."
    },
    {
      "q": "Why does fall-through exist in switch at all, and how do you exploit it deliberately versus accidentally?",
      "a": "Fall-through lets multiple case labels share a body, which is useful for grouping — for instance MONDAY, TUESDAY, ... all falling into a 'weekday' branch. The danger is accidental fall-through from a forgotten break, which silently executes the next case; static analyzers and -Xlint flag it. The Java 14 arrow form removes fall-through entirely and supports comma-separated labels (case MONDAY, TUESDAY ->), giving the grouping benefit without the footgun."
    },
    {
      "q": "What is the difference between an array's length and a String's length in Java?",
      "a": "An array exposes its size as a public final field, `arr.length` (no parentheses), fixed at creation time. A String exposes its size as a method, `s.length()` (with parentheses). Mixing them up -- writing arr.length() or s.length -- is a common beginner compile error. Also note arrays are fixed-size: you cannot grow arr.length; you allocate a new, larger array (or use ArrayList) instead."
    },
    {
      "q": "How do you correctly compare the contents of two arrays, and why doesn't == work?",
      "a": "Use Arrays.equals(a, b) for one-dimensional arrays (or Arrays.deepEquals for nested arrays). The == operator and the default Object.equals compare references -- whether the two variables point to the SAME array object -- not their contents, so two different arrays with identical elements are '!=' and equals() returns false. Arrays.equals walks the elements and compares them pairwise, which is what you almost always want."
    }
  ],
  "0.4": [
    {
      "q": "Walk through the exact order of initialization when 'new SubClass()' runs, including static and instance initializers.",
      "a": "On first use the class is loaded and its static fields and static initializer blocks run once, parent before child. Then for each instantiation: the constructor implicitly calls super() first, then the instance field initializers and instance initializer blocks run top-to-bottom, then the rest of the constructor body. So a parent constructor can observe a child field that has not yet been initialized — a real trap when a parent constructor calls an overridden method."
    },
    {
      "q": "Why is it dangerous to call an overridable method from a constructor?",
      "a": "Because the subclass constructor body has not run yet when the superclass constructor executes, so an overridden method invoked from the superclass constructor sees the subclass's fields still at their defaults (null/0). This leads to subtle NPEs or half-initialized state. The safe options are to make such methods final or private, or to use a factory/builder so the object is fully constructed before any behavior runs."
    },
    {
      "q": "When would you make a class immutable, and what does it take to do it correctly?",
      "a": "Immutability is the default I reach for when objects are shared across threads or used as map keys, because immutable objects are inherently thread-safe and have stable hashCodes. To do it right: make the class final (or use a sealed/record), all fields private final, no setters, and defensively copy any mutable inputs in the constructor and any mutable return values in getters. Records (Java 16) give you most of this for free but still need defensive copies for mutable components."
    },
    {
      "q": "What problem do static factory methods solve that constructors cannot, and what's the trade-off?",
      "a": "Static factories can have descriptive names (Optional.of vs Optional.empty), can return a cached or subtype instance instead of always allocating, and can hide the implementation type behind an interface — none of which a constructor can do. Examples are Integer.valueOf, List.of, and Optional.of. The trade-off is that a class with only private constructors and static factories cannot be subclassed, and the factory methods are harder to discover than 'new' in IDE autocomplete."
    },
    {
      "q": "Explain what a record is, what it generates, and where a record is the wrong choice.",
      "a": "A record (Java 16) is a transparent carrier for immutable data: from the header it generates final fields, a canonical constructor, accessors, and value-based equals/hashCode/toString. It is ideal for DTOs, value objects, and multiple return values. It is the wrong choice when you need mutability, want to hide or transform internal representation, need inheritance (records are implicitly final and extend Record), or when equality should be identity-based rather than component-based."
    },
    {
      "q": "What is the difference between shallow and deep copying, and how does it interact with a copy constructor?",
      "a": "A shallow copy duplicates the top-level object but shares references to nested mutable objects, so mutating a nested list affects both copies; a deep copy recursively clones the nested objects so they are fully independent. A copy constructor must deep-copy any mutable fields (lists, dates, arrays) or it silently produces aliasing bugs. In practice I prefer copy constructors or static 'copyOf' factories over Cloneable, since clone() is broken by design (no constructor call, shallow by default, awkward checked exception)."
    }
  ],
  "0.5": [
    {
      "q": "Compare composition and inheritance. Why is 'favor composition over inheritance' such a strong rule?",
      "a": "Inheritance creates a tight, compile-time 'is-a' coupling where the subclass depends on the superclass's implementation details, so a superclass change can silently break subclasses (the fragile base class problem). Composition delegates to a contained object via 'has-a', which is more flexible, swappable at runtime, and keeps encapsulation intact. The rule exists because deep inheritance hierarchies become rigid and hard to evolve; inheritance is appropriate only for genuine, stable is-a relationships, and even then often behind an interface."
    },
    {
      "q": "Explain method overriding versus overloading, including how the rules differ at compile time versus runtime.",
      "a": "Overloading is same name, different parameter lists, resolved by the compiler at compile time based on the static types of the arguments. Overriding is a subclass providing a new implementation of an inherited method with the same signature, dispatched at runtime based on the object's actual type (dynamic dispatch via the vtable). A classic gotcha: choosing among overloads uses static types, so passing a List reference that actually holds an ArrayList still binds to the List overload."
    },
    {
      "q": "What are covariant return types, and what rules constrain an overriding method's signature, exceptions, and visibility?",
      "a": "An override may return a subtype of the original return type (covariant returns), which is why a clone() override can return the concrete type. The override cannot reduce visibility (a public method can't become protected), cannot throw broader or new checked exceptions than the parent declared, and must keep the same parameter list or it becomes an overload instead. @Override is worth using because it makes the compiler catch a signature mismatch that would otherwise silently create an overload."
    },
    {
      "q": "Since Java 8 interfaces can have default methods. Why were they added, and how is the diamond conflict resolved?",
      "a": "Default methods were added to let interfaces evolve without breaking existing implementors — that's how Collection got stream() and forEach() without breaking every implementation. If a class inherits conflicting default methods from two interfaces (the diamond problem), the compiler forces you to override and disambiguate explicitly, calling InterfaceName.super.method() to pick one. Class methods always win over interface defaults, and a more specific subinterface's default wins over its parent's."
    },
    {
      "q": "When should you use an abstract class versus an interface in a modern (Java 8+) codebase?",
      "a": "Use an interface to define a capability or contract that unrelated types can implement, especially since you can supply default methods and a type can implement many interfaces. Use an abstract class when you need shared mutable state, constructors, or non-public members across a closely related family, since a class can extend only one. With default methods the gap narrowed, but interfaces still can't hold instance state, so 'shared state and partial implementation' remains the deciding factor for abstract classes."
    },
    {
      "q": "What is the Liskov Substitution Principle, and give a concrete way code violates it.",
      "a": "LSP says a subtype must be usable anywhere its supertype is expected without breaking the program's correctness — overrides shouldn't strengthen preconditions or weaken postconditions. The textbook violation is Square extends Rectangle: setting width independently of height breaks invariants callers of Rectangle rely on. Another common one is an override that throws UnsupportedOperationException (e.g., an immutable List's add), which technically satisfies the type but violates the behavioral contract callers expect."
    }
  ],
  "0.6": [
    {
      "q": "Encapsulation is more than private fields. What does proper encapsulation actually protect, and how do getters leak it?",
      "a": "Encapsulation protects class invariants by ensuring all state changes go through controlled paths, so the object can never be observed in an invalid state. A getter that returns a reference to an internal mutable collection or array leaks that protection — the caller can mutate it directly and bypass validation. The fix is to return an unmodifiable view (Collections.unmodifiableList), a defensive copy, or an immutable type, depending on the cost and copy semantics you need."
    },
    {
      "q": "Why are Java enums the recommended way to implement a singleton, and what else makes enums more than named constants?",
      "a": "An enum singleton is serialization-safe and reflection-safe for free — the JVM guarantees a single instance per constant even across deserialization, which a hand-rolled singleton must carefully defend against. Beyond constants, enums can have fields, constructors, and methods, and each constant can override behavior (constant-specific method bodies), making them ideal for strategy/state tables. They also work cleanly in switch and EnumMap/EnumSet, which are extremely fast array-backed implementations."
    },
    {
      "q": "Explain the difference between abstraction and encapsulation, since interviewers often conflate them.",
      "a": "Abstraction is about the design view — exposing a simple, intention-revealing interface and hiding the complexity of how a job is done (e.g., a Repository interface hiding SQL). Encapsulation is the implementation mechanism — bundling state with the methods that operate on it and restricting direct access to that state. Abstraction is 'what to expose'; encapsulation is 'how to protect what you hid'. You use encapsulation (access modifiers) to enforce the boundaries that abstraction defines."
    },
    {
      "q": "Why should you prefer EnumMap and EnumSet over HashMap and HashSet when keys are enums?",
      "a": "EnumSet is internally a bit vector and EnumMap is backed by a plain array indexed by the enum's ordinal, so both are dramatically faster and more memory-efficient than the hash-based versions and need no hashing or boxing. They also iterate in natural (declaration) order, which is often what you want. The only caveat is that they're tied to a single enum type and are not thread-safe, so wrap them if shared across threads."
    },
    {
      "q": "What is constant-specific behavior in an enum, and when would you use it instead of a switch?",
      "a": "Each enum constant can supply its own method implementation by overriding an abstract method in the enum, so the behavior travels with the constant rather than living in a switch elsewhere. The classic example is an Operation enum where PLUS, MINUS, etc. each implement apply(). It's preferable to a switch because adding a new constant forces you to implement the behavior (the compiler enforces it), whereas a switch can silently fall through to a wrong default when a new constant is added."
    },
    {
      "q": "How do access modifiers (private, package-private, protected, public) shape API design, and what's the danger of protected?",
      "a": "The discipline is to default to the most restrictive modifier and widen only when needed, because every public or protected member becomes a contract you must support. package-private is underused but excellent for collaborating classes that shouldn't expose internals to the world. protected is the subtle one: it's part of the inheritance contract, so a protected field becomes a commitment to every future subclass author and ties your hands when refactoring — prefer protected methods over protected fields."
    }
  ],
  "0.7": [
    {
      "q": "Explain the String pool (string interning) and when intern() actually helps versus hurts.",
      "a": "String literals are interned into a pool so identical literals share one instance, which is why \"a\" == \"a\" is true but new String(\"a\") == \"a\" is false. intern() lets you canonicalize runtime-built strings into the pool, which can save memory when you have massive numbers of duplicate strings (e.g., parsed tokens). But interning has CPU cost and historically lived in PermGen/now the heap-resident pool; over-interning long-lived unique strings just bloats the pool, so it's a targeted optimization, not a default."
    },
    {
      "q": "Why is repeated String concatenation in a loop a performance problem, and what does the compiler do for non-loop concatenation?",
      "a": "Strings are immutable, so each + in a loop allocates a brand-new String and copies all prior characters, giving O(n^2) work and heavy GC pressure. Use StringBuilder (or StringBuffer if you truly need synchronization) to accumulate in a single resizable buffer. For simple non-loop concatenation the compiler already optimizes it — historically into StringBuilder, and since Java 9 via invokedynamic and StringConcatFactory — so manually using StringBuilder for a one-line concat is premature and less readable."
    },
    {
      "q": "Why must String be immutable, and what would break if it weren't?",
      "a": "Immutability is what makes String safe to share freely, cache via the pool, and use as a HashMap key with a stable hashCode. If Strings were mutable, a value used as a map key or in a security check (a file path or class name) could be changed after validation — a serious time-of-check-to-time-of-use vulnerability — and the pool's sharing would let one holder corrupt another's data. Immutability also makes Strings inherently thread-safe with no synchronization."
    },
    {
      "q": "Compare equals(), ==, equalsIgnoreCase(), and compareTo() for Strings, and what's the locale gotcha?",
      "a": "== compares references (true only for the same object, e.g., two literals), equals() compares content code-unit by code-unit, equalsIgnoreCase() folds ASCII-ish case, and compareTo() gives lexicographic ordering by UTF-16 value for sorting. The gotcha is case and ordering are not locale-correct: toUpperCase()/toLowerCase() and natural ordering can be wrong for non-English locales (the Turkish dotless-i is the famous example), so use Locale-aware methods or a Collator for human-facing comparison and sorting."
    },
    {
      "q": "What's the difference between StringBuilder and StringBuffer, and when does capacity tuning matter?",
      "a": "They have identical APIs, but StringBuffer's methods are synchronized and StringBuilder's are not, so StringBuilder is the default choice for single-threaded use (almost always) and StringBuffer only when one builder is genuinely shared across threads — which is rare and usually better solved another way. Both grow by reallocating and copying when capacity is exceeded; presizing with new StringBuilder(expectedSize) avoids repeated array copies when you're appending a large, known volume of text in a hot path."
    },
    {
      "q": "Why can holding a substring or splitting large strings cause memory issues, and how do you avoid related leaks?",
      "a": "In old JDKs (pre-7u6) substring() shared the parent's backing char array, so keeping a tiny substring pinned a huge string in memory; modern substring copies, so that specific leak is gone but copying has its own cost. The current pitfall is splitting or interning huge inputs at scale, which inflates the heap and string pool. For very large text, prefer streaming/CharSequence views, process in chunks, and avoid interning attacker-controlled strings, which can exhaust the pool."
    }
  ],
  "0.8": [
    {
      "q": "Explain checked versus unchecked exceptions and the modern argument for preferring unchecked in many designs.",
      "a": "Checked exceptions (subclasses of Exception, not RuntimeException) must be declared or handled and are meant for recoverable conditions; unchecked (RuntimeException) signal programming errors or unrecoverable states and need no declaration. Many modern frameworks (Spring) favor unchecked exceptions because checked exceptions force boilerplate, leak across abstraction layers, and don't compose with lambdas/streams (functional interfaces don't declare them). The trade-off is checked exceptions document recoverable failures at compile time, which is genuinely valuable for true business-recoverable cases like IO."
    },
    {
      "q": "Walk through how try-with-resources works and why it's strictly better than finally-based cleanup.",
      "a": "try-with-resources auto-closes any AutoCloseable declared in its header, in reverse order of acquisition, generating the close() calls for you. It's better than a finally block because manual finally cleanup is verbose and, critically, an exception thrown by close() in a finally can suppress the original exception from the try body — try-with-resources instead attaches close() failures as suppressed exceptions (getSuppressed()), so you never lose the root cause. It also correctly handles multiple resources without nested finallys."
    },
    {
      "q": "What does it mean to 'swallow' an exception, and what are the correct patterns for translation and chaining?",
      "a": "Swallowing means catching an exception and doing nothing (or just logging and continuing) so the failure is silently lost — a leading cause of undebuggable production issues. The right patterns are: handle it meaningfully, rethrow, or translate it to a higher-level exception while preserving the cause via the chaining constructor (new ServiceException(\"...\", cause)) so the stack trace survives. Never catch Throwable/Exception broadly to hide problems, and never catch and lose the cause."
    },
    {
      "q": "How should you design a custom exception hierarchy, and what belongs in the exception itself?",
      "a": "Create a small hierarchy rooted at a domain base exception (often unchecked) so callers can catch broadly or specifically, and reserve distinct types for conditions callers will actually branch on. The exception should carry structured context — an error code, the offending id, enough state to act on — not just a string message, so logs and API responses can be machine-readable. Avoid an explosion of one-off exception classes; prefer a few well-typed exceptions carrying fields over dozens of nearly identical types."
    },
    {
      "q": "What are the performance and correctness costs of exceptions, and why shouldn't you use them for control flow?",
      "a": "Constructing an exception captures a full stack trace (fillInStackTrace), which is the expensive part, so throwing exceptions on a hot path for normal outcomes is a real performance hit and obscures actual errors. Using exceptions for control flow (e.g., catching to break a loop) is both slow and unreadable; return an Optional, a result type, or a sentinel for expected 'not found' cases. If you must signal a frequent expected condition via exception, you can override fillInStackTrace to skip the trace."
    },
    {
      "q": "What is a suppressed exception and when do you encounter one in practice?",
      "a": "A suppressed exception is a secondary exception attached to a primary one rather than masking it, accessible via Throwable.getSuppressed(). The common source is try-with-resources: if the try body throws and then a resource's close() also throws, the close() exception is suppressed so the original is propagated. Knowing this matters in production debugging, because the real root cause is the primary exception and the suppressed array often shows cleanup failures that would otherwise look like the cause."
    }
  ],
  "0.9": [
    {
      "q": "Explain PECS (Producer Extends, Consumer Super) with a concrete example of choosing the right wildcard.",
      "a": "Use <? extends T> when a structure produces T values you only read (you can get a T out but can't add, since the exact subtype is unknown), and <? super T> when it consumes T values you write into (you can add a T but reads come back as Object). Collections.copy(dest, src) is the canonical example: src is <? extends T> (producer) and dest is <? super T> (consumer). Getting this right maximizes API flexibility — callers can pass List<Integer> where List<? extends Number> is expected."
    },
    {
      "q": "What is type erasure, what does it cost you at runtime, and how do you work around it?",
      "a": "Generics are a compile-time-only feature: the compiler erases type parameters to their bounds (or Object) and inserts casts, so at runtime List<String> and List<Integer> are the same class. Consequences are you can't do new T[], can't use instanceof List<String>, can't catch a generic exception type, and overloads that differ only by type parameter clash. The workarounds are passing a Class<T> token (Class.cast / Array.newInstance) or capturing the type with a super-type token (the TypeReference pattern Jackson uses)."
    },
    {
      "q": "Why can't you assign a List<String> to a List<Object>, even though String is an Object?",
      "a": "Generics are invariant precisely to preserve type safety: if List<String> were a List<Object>, you could add an Integer through the Object-typed reference and then read a String back, causing a ClassCastException — the exact problem generics exist to prevent. Arrays, by contrast, are covariant (Object[] can hold a String[]) and therefore unsafe, throwing ArrayStoreException at runtime. When you need flexibility across subtypes you use a bounded wildcard rather than relying on subtyping of the parameterized type."
    },
    {
      "q": "Compare a bounded type parameter <T extends Number> with a wildcard <? extends Number>. When do you need each?",
      "a": "Use a named type parameter <T extends Number> when you need to refer to the type elsewhere in the signature — relating arguments to each other or to the return type (e.g., <T extends Comparable<T>> T max(List<T>)). Use a wildcard when the method doesn't need to name the type and just operates on 'some unknown subtype', which keeps the signature simpler. A rule of thumb: if a type variable appears only once and you don't need its name, a wildcard is the cleaner choice."
    },
    {
      "q": "Why does Java warn about generic varargs (heap pollution), and what does @SafeVarargs actually assert?",
      "a": "A varargs parameter is implemented as an array, but you can't have an array of a parameterized type, so the compiler creates an array of the erased type and you can get heap pollution — a reference of one parameterized type pointing at data of another, surfacing as a ClassCastException later. @SafeVarargs is the author's promise that the method only reads from the varargs array and never stores into it or exposes it, so the warning is safe to suppress. Misapplying it to a method that does store into the array reintroduces the unsafety."
    },
    {
      "q": "What is a recursive generic bound like <T extends Comparable<T>>, and where does it show up?",
      "a": "It's a self-referential bound expressing 'T must be comparable to its own type', which is how Collections.max and sorting APIs guarantee elements can be ordered against each other rather than against arbitrary objects. The same pattern powers the self-typed builder idiom (<T extends Builder<T>>) so fluent methods return the concrete subtype. It looks circular but is a standard way to make generic APIs both type-safe and ergonomic; the cost is the declaration gets verbose and intimidating to readers."
    }
  ],
  "0.10": [
    {
      "q": "What does Big-O notation actually describe?",
      "a": "It describes how the cost of an algorithm -- usually time, sometimes memory -- GROWS as the input size n grows, ignoring constant factors and lower-order terms. It answers 'if I make the input much bigger, how much more work is done?' rather than 'how many milliseconds does it take'. That makes it hardware-independent: O(n) means the work grows in proportion to n, O(n^2) means it grows with the square of n, regardless of the machine."
    },
    {
      "q": "Why do we drop constants and lower-order terms, so O(2n + 5) becomes O(n)?",
      "a": "Big-O captures the growth trend at large n, where the dominant term swamps everything else and constant multipliers do not change the shape of the curve. For big n, 2n + 5 grows essentially like n, so we call it O(n). Constants and small terms matter for real wall-clock tuning, but for comparing how algorithms SCALE they are noise, so we drop them to focus on the order of growth."
    },
    {
      "q": "Which is faster for large n: O(n) or O(n^2), and why?",
      "a": "O(n) is far faster at scale. If you make the input 1000x bigger, an O(n) algorithm does about 1000x the work, while an O(n^2) algorithm does about 1,000,000x the work. So a nested-loop O(n^2) solution that looks fine on 100 items can be unusable on a million, and switching to an O(n) approach (often by using the right data structure, like a HashSet) beats any amount of micro-optimizing the slow one."
    },
    {
      "q": "How do you find the Big-O of a piece of code by reading it?",
      "a": "Use three rules: sequential blocks add and you keep only the biggest term; nested loops multiply their counts (a loop of n inside a loop of n is n*n = O(n^2)); and a process that halves the remaining work each step is O(log n). A single loop from 0 to n is O(n). So a loop after another loop is still O(n), but a loop inside a loop is O(n^2). Then simplify by dropping constants."
    },
    {
      "q": "What is the difference between time complexity and space complexity?",
      "a": "Time complexity measures how the number of operations grows with n; space complexity measures how much EXTRA memory the algorithm needs as a function of n (not counting the input itself). They can trade off: the duplicate-detection trick that uses a HashSet turns an O(n^2)-time, O(1)-space nested scan into an O(n)-time solution that costs O(n) extra space. Interviewers often ask you to state both."
    },
    {
      "q": "Why do we usually quote the worst case, and what are best/average cases?",
      "a": "Best, average and worst case describe the cost on the luckiest, typical, and unluckiest inputs. We usually quote the worst case because it is the guarantee -- it bounds how bad things can get regardless of input, which matters for reliability and tail latency. Average case is useful too: for example HashMap.get is O(1) on average but O(n) in a pathological worst case (many collisions), which is why the average and worst can differ and both are worth knowing."
    },
    {
      "q": "Why is building a String in a loop with + considered O(n^2)?",
      "a": "Strings are immutable, so each `s = s + x` inside a loop creates a whole new String by copying all the characters accumulated so far. Copying a growing prefix on every one of n iterations sums to on the order of n^2 character copies. Using a StringBuilder appends into a mutable buffer that grows amortized O(1) per append, making the whole loop O(n). This is a classic example of how data-structure choice changes the complexity class."
    },
    {
      "q": "Give an example where choosing the right data structure changes the Big-O.",
      "a": "Checking membership: `ArrayList.contains` scans the list, so doing it inside a loop is O(n^2); switching to a `HashSet`, whose contains is O(1) average, makes the same task O(n). Likewise, searching an unsorted array is O(n) but binary search on a SORTED array is O(log n). The algorithm's complexity often comes down to which structure you store the data in, not how tightly you write the loop."
    }
  ],
  "0.11": [
    {
      "q": "Compare ArrayList and LinkedList honestly. Why is LinkedList almost never the right choice in practice?",
      "a": "ArrayList is a contiguous array: O(1) random access and cache-friendly iteration, with amortized O(1) appends and O(n) middle inserts/removes due to shifting. LinkedList offers O(1) insert/remove only if you already hold the node, but indexing is O(n) and every element is a separately allocated node, killing cache locality and inflating memory. In real workloads ArrayList's locality usually wins even for inserts, so LinkedList is rarely justified — its main legitimate use is as a Deque/queue, where ArrayDeque is typically still faster."
    },
    {
      "q": "Walk through how HashMap works internally, including resizing and the treeification introduced in Java 8.",
      "a": "A HashMap holds an array of buckets; the key's hashCode is spread (to mix high bits) and masked to an index, and collisions chain in that bucket. When size exceeds capacity times the load factor (default 0.75), it resizes to double capacity and rehashes. Since Java 8, a bucket with many collisions (8+) and sufficient table size converts its linked list to a red-black tree, improving worst-case lookup from O(n) to O(log n) — a mitigation against hash-collision DoS — and untreeifies on shrink."
    },
    {
      "q": "What exactly is the contract between equals() and hashCode(), and what breaks when you violate it?",
      "a": "Equal objects must have equal hash codes (the reverse need not hold), and both must be consistent over the object's lifetime. If you override equals() but not hashCode(), two 'equal' objects can land in different buckets, so a HashMap lookup or HashSet contains() fails to find an entry that's logically present. The other classic bug is using a mutable field in equals/hashCode and then mutating a key already in a map — the entry becomes unreachable because it's hashed under its old code."
    },
    {
      "q": "When would you choose a TreeMap or LinkedHashMap over a plain HashMap?",
      "a": "Use HashMap as the default for O(1) average access with no ordering guarantees. Use LinkedHashMap when you need predictable iteration order — insertion order, or access order for building an LRU cache via removeEldestEntry. Use TreeMap when you need sorted keys or range queries (the NavigableMap operations: floorKey, ceilingKey, subMap, headMap), accepting O(log n) operations and a Comparable key or supplied Comparator. The choice is driven entirely by the ordering and navigation guarantees you need versus raw speed."
    },
    {
      "q": "Why is ConcurrentModificationException best-effort, and how do concurrent collections differ from synchronized wrappers?",
      "a": "CME comes from a fail-fast modCount check meant to catch single-thread bugs, but it's documented as best-effort, so you can't rely on it to detect every concurrent misuse. Collections.synchronizedMap wraps every method in a lock, giving coarse mutual exclusion but you still must externally synchronize iteration and it serializes all access. ConcurrentHashMap instead allows concurrent reads and fine-grained (bucket/bin-level) updates with weakly-consistent iterators that never throw CME, which is why it scales far better under contention."
    },
    {
      "q": "Compare ArrayDeque, Stack, and the various queue choices. What should you actually use for a stack or queue today?",
      "a": "Use ArrayDeque for both stacks and queues: it's array-backed, faster than LinkedList, and unlike the legacy Stack class (which extends Vector and is synchronized and slow) it isn't burdened by Vector's design. Prefer the Deque methods (push/pop/offer/poll) which return/insert without throwing on empty, over add/remove which throw. For producer-consumer concurrency reach for BlockingQueue implementations (ArrayBlockingQueue, LinkedBlockingQueue), and for priority ordering use PriorityQueue, remembering it isn't thread-safe and iteration order isn't sorted."
    },
    {
      "q": "How does a HashMap find a value in O(1) on average instead of scanning every entry?",
      "a": "It runs the key through hashCode() to get a number, then maps that number to a bucket index (roughly hash modulo capacity, implemented as hash & (capacity - 1)). It goes straight to that one bucket and only checks the few keys living there, comparing with equals(). Because it jumps directly to a bucket instead of scanning all n entries, average lookup is O(1). It degrades toward O(n) only if most keys pile into the same bucket."
    },
    {
      "q": "What is a hash collision and how does Java's HashMap resolve it?",
      "a": "A collision is when two different keys map to the same bucket index. HashMap resolves it with separate chaining: each bucket holds a small list of entries, and get/put walk that list using equals() to find the exact key. If a single bucket's chain grows long (8+ entries) and the table is large enough, HashMap treeifies that bucket into a red-black tree so its worst case is O(log n) instead of O(n). Open addressing is an alternative collision strategy that some other hash tables use."
    },
    {
      "q": "What is the load factor, and what happens when a HashMap exceeds it?",
      "a": "The load factor (default 0.75) is the fullness threshold: when the number of entries exceeds capacity * loadFactor, the HashMap resizes -- it doubles the bucket array and rehashes every entry into the new, larger array. Keeping the table under ~75% full keeps chains short so lookups stay near O(1). Resizing is expensive but happens rarely, so its cost is amortized across many inserts; 0.75 is the standard time/space compromise."
    },
    {
      "q": "Why must equal objects have equal hash codes, and what breaks if they don't?",
      "a": "The contract is: if a.equals(b) then a.hashCode() == b.hashCode(). A HashMap first uses the hash code to pick a bucket, then equals() within it. If two equal keys produce different hash codes, they can land in different buckets, so after putting with one you may fail to get with the other -- the map appears to 'lose' the entry. That is why whenever you override equals() you must also override hashCode(), and why you must never mutate a field used in hashCode() after using the object as a key."
    }
  ],
  "0.12": [
    {
      "q": "What is Optional actually for, and what are the anti-patterns interviewers want you to avoid?",
      "a": "Optional is a deliberate API signal that a return value may be absent, pushing callers to handle the empty case instead of risking an NPE — it's best used as a method return type. The anti-patterns are: using it as a field or method parameter (adds overhead and another null state, since Optional itself can be null), calling get() without checking (just a disguised NPE), and using Optional for collections (return an empty list instead). Prefer map/flatMap/orElseGet/ifPresent over isPresent()+get(), and use orElseGet over orElse when the default is expensive to build."
    },
    {
      "q": "Why was java.time introduced to replace Date and Calendar, and what are its key design wins?",
      "a": "The old Date/Calendar API was mutable (hence not thread-safe), 0-indexed months, and conflated instants with human dates, causing endless bugs. java.time is immutable and thread-safe, separates concepts cleanly — Instant (a point on the timeline, UTC), LocalDate/LocalDateTime (no zone), ZonedDateTime (zone-aware), Duration vs Period (machine vs calendar time) — and has fluent, null-safe operations. In production you store and compute in Instant/UTC and convert to a ZonedDateTime only at display boundaries to avoid DST and offset bugs."
    },
    {
      "q": "Distinguish the four method reference forms and when each applies.",
      "a": "There are four: static (Integer::parseInt), bound to a specific instance (System.out::println, captures that object), unbound on an arbitrary instance of a type (String::toLowerCase, where the first lambda parameter becomes the receiver), and constructor (ArrayList::new). The subtle one is unbound versus bound: String::length applies length() to whichever String is passed in, whereas someList::add always targets that one list. Method references are just sugar for lambdas, so use them when they read more clearly and fall back to a lambda when arguments need reordering or extra logic."
    },
    {
      "q": "Why is using the wrong temporal type (e.g., LocalDateTime for a timestamp) a production hazard?",
      "a": "LocalDateTime has no timezone or offset, so it's ambiguous on the absolute timeline — store an event with it and you can't tell what real instant it happened across servers in different zones, and DST transitions make some local times nonexistent or doubled. For an actual moment in time use Instant (or store epoch millis/timestamptz), and only use LocalDate/LocalDateTime for genuinely zoneless concepts like a birthday or a store's opening time. Mixing these up causes off-by-hours bugs that only appear around DST boundaries or for users in other regions."
    },
    {
      "q": "Compare Duration and Period, and why does adding a Duration of '24 hours' differ from adding '1 day'?",
      "a": "Duration is time-based (seconds and nanos) and Period is date-based (years, months, days). Across a daylight-saving transition they diverge: adding a Period of 1 day to a ZonedDateTime keeps the same wall-clock time the next day (which may be 23 or 25 real hours), while adding a Duration of 24 hours advances exactly 24 hours of elapsed time, landing on a different wall-clock time. Choosing the wrong one produces scheduling bugs that surface only twice a year, which is exactly why interviewers probe it."
    },
    {
      "q": "Why is the old SimpleDateFormat dangerous, and what replaced it?",
      "a": "SimpleDateFormat is mutable and not thread-safe, yet developers routinely cached one in a static field and shared it across threads, producing intermittent parse corruption and wrong dates under load — a notorious heisenbug. The java.time replacement, DateTimeFormatter, is immutable and thread-safe, so a single instance can be shared as a constant safely. It also has predefined ISO formatters and a clearer pattern/builder API, removing both the concurrency hazard and much of the old format-string ambiguity."
    }
  ],
  "0.13": [
    {
      "q": "Compare the old java.io streams with NIO.2 (java.nio.file). When do you still reach for streams?",
      "a": "java.io is a blocking, stream-oriented API (InputStream/Reader and their buffered wrappers) that's fine for straightforward sequential reading and writing. NIO.2 (Java 7) adds the Path/Files API with far richer operations: atomic moves, symbolic links, file attributes, directory walking, and clearer exceptions, and it's the modern default for filesystem work. You still use streams for the actual byte/char transfer and for arbitrary sources (sockets, in-memory), but you'd use Files.newInputStream/Files.lines and Path rather than raw FileInputStream and File."
    },
    {
      "q": "Why is buffering critical for I/O performance, and what does a BufferedReader actually save you?",
      "a": "Unbuffered reads issue a system call per small read, and syscalls are expensive relative to memory copies, so reading a file byte-by-byte through a raw FileInputStream is orders of magnitude slower. A BufferedReader/BufferedInputStream reads a large block into an in-memory buffer once and serves your small reads from it, amortizing the syscall cost. The pitfall is forgetting to wrap (or wrapping in the wrong order), and forgetting that buffered output must be flushed/closed or the tail of your data never reaches disk."
    },
    {
      "q": "What's the difference between Files.lines(), Files.readAllLines(), and Files.readString() for reading a file?",
      "a": "readAllLines and readString load the entire file into memory, which is simple but dangerous for large files (OOM risk), so they're fine only when you know the file is small. Files.lines() returns a lazy Stream<String> that reads on demand, so it scales to huge files — but it's backed by an open file handle, so you must use it in try-with-resources or the descriptor leaks. The general rule is stream large or unbounded inputs and only slurp small, known-size files."
    },
    {
      "q": "How do you walk a directory tree safely, and what are the pitfalls of Files.walk versus Files.walkFileTree?",
      "a": "Files.walk returns a lazy Stream<Path> and is concise, but it holds open directory handles (use try-with-resources), can throw partway through on an unreadable entry, and by default does not follow symlinks (FOLLOW_LINKS risks infinite cycles). Files.walkFileTree with a FileVisitor is more verbose but gives fine-grained control: you can handle visit failures per-file, prune subtrees with SKIP_SUBTREE, and post-visit directories — which is exactly what you need to implement a correct recursive delete (delete children before the directory)."
    },
    {
      "q": "Why should you prefer Path.resolve and avoid string concatenation for file paths, and what's the security angle?",
      "a": "Building paths by string concatenation hardcodes separators (breaking cross-platform) and is error-prone, whereas Path.resolve and the Paths/Path API handle separators and normalization correctly. The security angle is path traversal: if you join user input naively, a value like '../../etc/passwd' escapes your intended directory. The defense is to resolve against a known base, call normalize(), and then verify the result still startsWith the base directory before touching the file."
    },
    {
      "q": "What does StandardCopyOption.ATOMIC_MOVE give you, and why does it matter for safe file writes?",
      "a": "ATOMIC_MOVE asks the filesystem to perform a rename as a single indivisible operation, so observers never see a partially written file — it either sees the old file or the complete new one. The standard safe-write pattern is to write to a temporary file, fsync it, then atomically move it over the target, which guarantees readers never observe a half-written or truncated file even if the process crashes mid-write. The caveat is atomicity is only guaranteed within the same filesystem; a cross-filesystem move can't be atomic and throws or degrades to copy-then-delete."
    }
  ],
  "1.1": [
    {
      "q": "Walk me through the difference between class loading, linking, and initialization, and why the JVM separates them.",
      "a": "Loading reads the bytecode and creates a Class object on the heap; linking then verifies the bytecode, prepares static fields to their default values, and resolves symbolic references to direct pointers; initialization finally runs static initializers and static field assignments in source order. The separation lets the JVM defer expensive work and run initialization lazily and exactly once, on first active use, under a class-level lock. A practical consequence is that a class can be loaded and linked long before it is initialized, which is why static side effects don't fire until you actually touch the class."
    },
    {
      "q": "What is the parent-delegation model and what concrete problems does it prevent?",
      "a": "Before a class loader tries to define a class itself, it delegates upward to its parent, so the bootstrap loader gets first refusal. This prevents user code from shadowing core JDK classes (you can't sneak in your own java.lang.String) and avoids loading the same core class twice under different loaders. The gotcha is that two classes with the identical name loaded by different loaders are distinct types, so a cast between them throws ClassCastException even though the bytecode is identical."
    },
    {
      "q": "Why does PermGen's removal in Java 8 matter, and what changed operationally with Metaspace?",
      "a": "PermGen was a fixed-size region inside the Java heap that held class metadata, and exhausting it caused OutOfMemoryError: PermGen space, a classic failure in app servers that redeployed often and leaked class loaders. Metaspace moved this metadata to native memory that grows on demand, eliminating the most common PermGen OOM. The trade-off is that an unbounded leak now consumes native RAM instead, so in production you still cap it with -XX:MaxMetaspaceSize to fail fast rather than swallow the whole machine."
    },
    {
      "q": "Which runtime data areas are per-thread versus shared, and why does that distinction matter?",
      "a": "The heap and Metaspace are shared across all threads, while each thread gets its own JVM stack, PC register, and native stack. That is precisely why heap data needs synchronization and the memory model, but local variables and the call stack are inherently thread-safe and never escape a thread unless you publish them. It also explains thread cost: each platform thread reserves stack memory (often ~1 MB by -Xss), so tens of thousands of threads exhaust native memory long before the heap does."
    },
    {
      "q": "Why does deep recursion throw StackOverflowError rather than OutOfMemoryError?",
      "a": "Each method call pushes a frame onto the fixed-size per-thread JVM stack sized by -Xss, and exceeding that bound is a stack overflow, a distinct condition from running out of heap. OutOfMemoryError signals the shared heap or Metaspace is exhausted, which is a process-wide problem. The practical implication is that you fix StackOverflowError by reducing recursion depth or converting to iteration, not by raising -Xmx."
    },
    {
      "q": "When and why would you deliberately break parent delegation with a custom or child-first class loader?",
      "a": "Servlet containers like Tomcat use child-first loading so each deployed web app can bundle its own version of a library without the container's version winning, giving per-application isolation and hot redeploy. Plugin systems and OSGi do the same to support conflicting dependency versions in one JVM. The danger is class loader leaks: if a redeploy leaves a stray reference into the old loader, none of its classes can be unloaded and Metaspace grows until OOM."
    }
  ],
  "1.2": [
    {
      "q": "Compare G1 and ZGC: when would you choose one over the other in production?",
      "a": "G1 is a region-based, generational collector that targets a balance of throughput and predictable pauses, typically tens of milliseconds, and is the sensible default for most server workloads up to moderately large heaps. ZGC is a concurrent, mostly pause-free collector that keeps pauses under a millisecond even on multi-hundred-gigabyte heaps by doing relocation concurrently with load barriers. You pick ZGC when tail latency is the dominant requirement and you can spend extra CPU and memory headroom; you stay on G1 when throughput matters more and your pause budget is comfortable."
    },
    {
      "q": "Explain how a write barrier and card tables or remembered sets make young GC efficient.",
      "a": "To collect the young generation without scanning the whole heap, the GC must know which old-generation objects point into young, and it learns this by intercepting reference stores with a write barrier that marks the relevant card or updates a remembered set. At young GC time it scans only those dirty cards plus the GC roots instead of the entire old generation, which is what makes minor collections cheap. The cost is a small per-store overhead on every reference assignment, a deliberate trade of steady-state throughput for fast young collections."
    },
    {
      "q": "What is a humongous object in G1, and why can it cause trouble?",
      "a": "G1 treats any object larger than half a region as humongous and allocates it directly into contiguous old-region space rather than the young generation. These objects bypass the normal young-collection path, can fragment the heap, and historically were only reclaimed during slower collection phases, so a flood of large arrays or buffers can trigger premature full GCs. The fix is usually to size regions appropriately with -XX:G1HeapRegionSize or to avoid allocating very large transient arrays."
    },
    {
      "q": "Why is setting -Xms equal to -Xmx common in production, and what is the trade-off?",
      "a": "Pinning the initial and maximum heap to the same value avoids runtime heap resizing, which causes GC pauses and unpredictable latency as the JVM commits and uncommits memory. It also fails fast at startup if the box can't provide the memory, rather than degrading later under load. The trade-off is that the process reserves its full heap immediately, so it is a poor fit for bin-packed or memory-elastic environments where you want the JVM to give memory back."
    },
    {
      "q": "How do you distinguish a real memory leak from healthy-but-large heap usage when diagnosing OOM?",
      "a": "A leak shows a sawtooth where the post-full-GC baseline keeps creeping up over time, meaning live data grows without bound, whereas a merely large heap returns to a stable floor after each full GC. You confirm by capturing a heap dump and running dominator-tree analysis in a tool like MAT to find which root retains the growing set, commonly a static collection, an unbounded cache, or ThreadLocals in a pooled thread. The classic leak signatures are listeners never deregistered, caches without eviction, and class loaders pinned by a stray reference."
    },
    {
      "q": "Why do soft references make poor cache backing, and what should you use instead?",
      "a": "SoftReferences are only cleared when the heap is under pressure, so they effectively let the cache grow until the GC is already struggling, producing latency spikes and erratic eviction timing that you don't control. They also defeat sizing and hit-rate reasoning because the JVM, not your policy, decides what stays. A bounded cache with an explicit eviction policy, such as Caffeine with a size or time limit, gives predictable memory and far better behavior under load."
    }
  ],
  "1.3": [
    {
      "q": "Explain happens-before and why it, rather than wall-clock ordering, is what makes concurrent code correct.",
      "a": "Happens-before is a partial order the JMM guarantees: if action A happens-before action B, then A's effects are visible to B, and the compiler and CPU may reorder freely as long as they preserve this order within each thread and across the established edges. Without an explicit happens-before edge between a write in one thread and a read in another, there is no guarantee the read sees the write, regardless of which executed first in real time. So correctness comes from establishing edges via volatile, locks, thread start/join, or final fields, not from timing."
    },
    {
      "q": "What exactly does volatile guarantee, and what concurrency bug does it fail to fix?",
      "a": "Volatile guarantees visibility and ordering: a read always sees the latest write, and it establishes a happens-before edge that also publishes everything written before the volatile store. What it does not provide is atomicity of compound operations, so volatile count++ is still a lost-update race because read-modify-write is three steps. For counters you need an atomic or a lock; volatile is correct only for single-writer flags or safe publication of an immutable reference."
    },
    {
      "q": "What is false sharing, how do you detect it, and how do you fix it?",
      "a": "False sharing happens when two threads update independent variables that sit on the same CPU cache line, so each write invalidates the other core's cache copy and forces costly coherence traffic even though there's no logical contention. You suspect it when a scalable algorithm fails to scale and profiling shows cache-miss or coherence stalls on hot per-thread counters. Fixes include padding fields to a full cache line, using @Contended (with the unlock flag), or switching to per-thread accumulation like LongAdder, which is itself designed to avoid this."
    },
    {
      "q": "What is constructor escape, and why can it break the immutability of an otherwise final-field class?",
      "a": "Constructor escape is publishing a reference to an object before its constructor finishes, for example registering this with a listener or starting a thread that captures this inside the constructor. The danger is that another thread can observe the object with its final fields not yet guaranteed visible, breaking the JMM's special final-field safe-publication guarantee that normally requires the constructor to complete without the reference escaping. The rule is never let this escape during construction; use a static factory plus post-construction registration instead."
    },
    {
      "q": "Name the safe-publication mechanisms and explain why simply assigning to a plain field isn't one.",
      "a": "Safe publication means another thread is guaranteed to see a fully constructed object, achievable by storing the reference into a volatile field or AtomicReference, into a final field of a properly constructed object, into a field guarded by a lock, or via a thread-safe collection that does this internally. A plain non-volatile assignment provides no happens-before edge, so a reader can see the reference but stale or partially constructed field values due to reordering. This is the root cause of the broken double-checked locking idiom that omits volatile."
    },
    {
      "q": "What special rule does the JMM give final fields, and how does it make immutable objects safe to share without synchronization?",
      "a": "The JMM guarantees that if an object's constructor completes without this escaping, any thread that obtains the reference through a normal data race will still see the correctly initialized values of its final fields. This is why a truly immutable object, with all fields final and no leaked this, can be handed across threads safely with no volatile or lock at all. Records exploit this directly: their components are final, so they are inherently safe to publish and share, which is why they shine in concurrent code."
    }
  ],
  "1.4": [
    {
      "q": "Why does HotSpot use tiered compilation with both C1 and C2 instead of jumping straight to the best compiler?",
      "a": "C1 compiles quickly and adds lightweight profiling, so hot methods get reasonable native code fast while the JVM gathers branch and type profiles; C2 then uses those profiles to produce aggressively optimized code for the truly hot methods. Going straight to C2 would mean either slow startup, because C2 is expensive, or worse final code, because it would lack runtime profiles. Tiering gives both fast warmup and high peak throughput, at the cost of recompiling methods as they heat up."
    },
    {
      "q": "What is deoptimization, why does the JVM need it, and what triggers it?",
      "a": "Deoptimization is the JVM discarding compiled code and falling back to the interpreter or a lower tier when an optimistic assumption is invalidated, then recompiling with the new reality. It is necessary because C2 makes speculative bets, such as a call site being monomorphic or a branch never taken, to produce fast code. Triggers include loading a new subclass that makes a speculative inline wrong, a rarely-taken branch finally being hit, or class hierarchy changes, and a method that repeatedly deoptimizes can thrash and underperform."
    },
    {
      "q": "Explain escape analysis and the optimizations it unlocks, like scalar replacement and lock elision.",
      "a": "Escape analysis proves whether an object can be seen outside the method or thread that created it; if it can't escape, the JVM can avoid heap allocation entirely. Scalar replacement breaks such an object into its individual fields held in registers or on the stack, eliminating the allocation and GC pressure, and lock elision removes synchronization on an object that provably never escapes to another thread. The catch is that it is fragile: storing the object in a field, returning it, or passing it somewhere it might escape disables these wins."
    },
    {
      "q": "What is a megamorphic call site and how does it hurt JIT optimization?",
      "a": "A virtual call site is monomorphic if it always hits one concrete type, bimorphic for two, and megamorphic once it sees many; the JIT can inline and devirtualize the first two cheaply but gives up on a megamorphic site and emits a slower vtable lookup. This matters because inlining is the gateway optimization that enables most others, so a megamorphic hot path loses inlining, escape analysis, and constant folding across the call. In practice, overly generic dispatch over many implementations on a hot path can quietly cost a lot of performance."
    },
    {
      "q": "Why is JMH necessary, and what specific measurement errors does it prevent that a nanoTime loop cannot?",
      "a": "A hand-rolled timing loop measures cold interpreted code, lets the JIT eliminate computations whose results are unused as dead code, and conflates warmup with steady state, producing numbers that are wrong by orders of magnitude. JMH runs proper warmup iterations, runs each benchmark in forked JVMs to avoid profile pollution between benchmarks, and uses Blackhole and the return value convention to stop dead-code elimination from deleting your work. It also helps control loop unrolling and constant folding, so you measure the operation you intended rather than an artifact."
    },
    {
      "q": "When is GraalVM Native Image the right choice over the JVM, and what do you give up?",
      "a": "Native Image compiles ahead of time to a standalone binary with near-instant startup and low baseline memory, which is ideal for serverless functions, CLIs, and scale-to-zero workloads where warmup tax dominates. The trade-offs are lower peak throughput, because there is no runtime profiling-driven JIT, and a closed-world assumption that requires configuration for reflection, dynamic proxies, and resource loading. For a long-running, throughput-critical service the JVM with C2 usually wins outright, so the decision hinges on startup-sensitivity versus steady-state throughput."
    }
  ],
  "2.1": [
    {
      "q": "Walk through how HashMap stores and finds an entry, and why a bad hashCode degrades it to O(n).",
      "a": "HashMap computes the key's hashCode, spreads the bits to reduce clustering, and maps it to a bucket index; lookup then scans that bucket comparing keys with equals. If many keys collide into one bucket, that bucket becomes a long chain and operations degrade toward O(n) because you're doing linear search. Java 8 mitigates pathological collisions by converting a bucket to a balanced tree once it exceeds a threshold, giving O(log n) per bucket, but this only helps if keys are at least Comparable; the real fix is a well-distributed hashCode."
    },
    {
      "q": "Why must hashCode be consistent with equals, and what breaks if you override one but not the other?",
      "a": "The contract requires that equal objects have equal hash codes; if you override equals to compare by fields but leave the identity hashCode, two logically equal objects land in different buckets and the map fails to find what you inserted. Conversely overriding only hashCode without equals means lookups fall back to identity equality and still miss. The production symptom is a put followed by a get returning null, or duplicate entries in a HashSet, which is why you always override both together, typically via Objects.hash and Objects.equals."
    },
    {
      "q": "What goes wrong if you mutate an object after using it as a HashMap key or HashSet element?",
      "a": "The map places the entry in the bucket determined by the key's hash at insertion time, so mutating a field that participates in hashCode moves the object's logical bucket while it physically stays put. After that, contains and get compute the new hash, look in the wrong bucket, and report the element missing even though it's still in the map, effectively leaking it. The rule is to use immutable keys or at least never mutate key fields while the object is in a hash structure; records make excellent keys precisely because they're immutable."
    },
    {
      "q": "Why is implementing compareTo as a.value - b.value a bug, and what should you do instead?",
      "a": "Subtraction overflows for large or negative int values, so a comparison like a.value - b.value can return a positive number when a is actually smaller, silently corrupting sort order and breaking TreeMap and TreeSet invariants. The correct approach is Integer.compare(a.value, b.value), or for multiple fields Comparator.comparingInt(...).thenComparing(...). The same overflow trap is why you never hand-roll subtraction comparators; the built-in compare methods and Comparator combinators are safe and clearer."
    },
    {
      "q": "When should you reach for a concurrent or copy-on-write collection instead of synchronizing a plain one?",
      "a": "Collections.synchronizedMap wraps every method in one lock, which serializes all access and still requires manual external synchronization for compound actions and iteration, whereas ConcurrentHashMap uses fine-grained locking and lock-free reads to scale under contention and offers atomic compute and merge operations. CopyOnWriteArrayList suits read-mostly collections like listener lists where writes are rare, since each write copies the whole array. The trade-off is that copy-on-write is terrible for write-heavy workloads, and ConcurrentHashMap's iterators are weakly consistent rather than snapshot-consistent."
    },
    {
      "q": "Why prefer ArrayDeque over Stack and LinkedList, and List.of over Collections.unmodifiableList?",
      "a": "Stack extends Vector and synchronizes every operation for no benefit in single-threaded code, while LinkedList suffers cache-unfriendly pointer chasing and per-node object overhead; ArrayDeque is a contiguous, unsynchronized ring buffer that is faster for both stack and queue use. For immutability, List.of returns a genuinely immutable list that also rejects nulls, whereas Collections.unmodifiableList returns a read-only view over a backing list, so if someone holds the backing list they can still mutate it underneath you. Prefer the truly immutable factory when you want a real guarantee."
    }
  ],
  "2.2": [
    {
      "q": "Explain stream laziness and short-circuiting, and why it changes how much work actually runs.",
      "a": "Intermediate operations like map and filter build a pipeline but do nothing until a terminal operation pulls elements through, and elements are processed one at a time rather than stage-by-stage over the whole collection. This enables short-circuiting: findFirst, anyMatch, or limit can stop early, so a filter-then-findFirst over a huge source may touch only a few elements. The practical upshot is that ordering operations for early termination, and avoiding side effects, matters because stages only execute on demand."
    },
    {
      "q": "When is map insufficient and you need flatMap? Give a concrete shape.",
      "a": "Use flatMap when each element maps to multiple elements or to a stream, and you want one flat stream rather than a stream of streams. For example, a list of orders where each order has a list of line items: orders.stream().flatMap(o -> o.items().stream()) yields a single stream of all items, whereas map would give Stream<List<Item>>. flatMap also models Optional chaining, where flatMap unwraps nested Optionals that map would leave as Optional<Optional<T>>."
    },
    {
      "q": "Why is mutating external state inside a stream operation wrong, especially for parallel streams?",
      "a": "Stream operations are meant to be stateless and side-effect-free; writing to a shared external collection or variable breaks that contract and, in parallel, causes data races and lost updates because lambdas run on multiple threads without synchronization. Even sequentially it defeats the declarative model and can misbehave with reordering or short-circuiting. The correct approach is to express the result as a collector, such as collect(Collectors.toList()) or groupingBy, which the framework parallelizes safely."
    },
    {
      "q": "What pool do parallel streams use, and when does parallelStream actually hurt rather than help?",
      "a": "Parallel streams run on the shared ForkJoinPool.commonPool, so a long or blocking parallel stream can starve every other parallel stream in the JVM, and the fixed pool size ignores your real workload. Parallelism helps only with large datasets, cheap-to-split sources like arrays and ArrayList, and CPU-bound stateless operations; it hurts with small inputs, where overhead dominates, with LinkedList or IO-bound work, or when the per-element cost is tiny. As a rule, default to sequential and only parallelize after measuring a clear win."
    },
    {
      "q": "What happens when two elements collide on a key in Collectors.toMap, and how do you handle it?",
      "a": "The two-argument toMap throws IllegalStateException on a duplicate key, which is a common surprise when the key isn't actually unique in the data. You supply a third merge-function argument to resolve collisions, for example (a, b) -> a to keep the first or to combine values, and a fourth argument to pick the map implementation. For grouping rather than overwriting, groupingBy is usually the right tool because it naturally collects all colliding values per key."
    },
    {
      "q": "Why does ArrayList parallelize better than LinkedList, and what role does the Spliterator play?",
      "a": "Parallel streams split work via a Spliterator, and an ArrayList's array-backed Spliterator can cleanly halve its index range with known size, producing balanced, cache-friendly chunks. A LinkedList can only be traversed by following pointers, so it can't split evenly or cheaply and gives poor, unbalanced parallelism plus cache misses. This is why the source data structure, not just the operation, determines whether going parallel pays off, and why arrays and ArrayList are the friendliest sources."
    },
    {
      "q": "Name the core java.util.function interfaces and their single abstract method signatures.",
      "a": "Supplier<T> has T get() -- no input, produces a value. Consumer<T> has void accept(T) -- takes a value, returns nothing (side effect). Function<T,R> has R apply(T) -- transforms T into R. Predicate<T> has boolean test(T) -- a boolean-valued Function. UnaryOperator<T> is Function<T,T> and BinaryOperator<T> is BiFunction<T,T,T>, both narrowing input and output to the same type. The Bi- variants (BiFunction, BiConsumer, BiPredicate) take two arguments. A lambda or method reference is simply an instance of whichever of these the target type is."
    },
    {
      "q": "Why do primitive specializations like IntFunction, ToIntFunction and IntPredicate exist?",
      "a": "To avoid autoboxing. Function<Integer,Integer> boxes every int into an Integer object on the way in and out, which allocates and hurts cache locality in hot loops. IntUnaryOperator, ToIntFunction<T>, IntPredicate, IntSupplier and friends operate on primitive int/long/double directly, so streams like IntStream.map or mapToInt stay unboxed end to end. Interviewers like this because it shows you understand the cost model behind the tidy generic API, and why IntStream exists alongside Stream<Integer>."
    },
    {
      "q": "What is the difference between Runnable and Callable, and when do you pick each?",
      "a": "Runnable.run() takes no argument, returns void, and cannot throw checked exceptions -- it is fire-and-forget, used by Thread and ExecutorService.execute. Callable<V>.call() returns a value V and is allowed to throw checked exceptions -- you submit it to an ExecutorService and get back a Future<V> whose get() returns the result or rethrows the task's exception wrapped in ExecutionException. Pick Callable when the task computes a result you need to collect or when it can fail in a checked way; pick Runnable for pure side-effect work."
    },
    {
      "q": "Comparable vs Comparator -- what is the distinction and when do you reach for each?",
      "a": "Comparable<T> defines a type's single natural ordering via int compareTo(T), baked into the class itself (String alphabetical, Integer numeric); it is what TreeSet, Collections.sort with no comparator, and sorted() use by default. Comparator<T> is an external, separate object defining int compare(a,b), so you can have many orderings for the same type and order types you don't own or can't modify. Use Comparable for the one obvious ordering; use Comparator when you need alternative or multi-key orderings, e.g. Comparator.comparing(Employee::dept).thenComparing(Employee::salary)."
    },
    {
      "q": "How do you build a multi-key sort with Comparator, and how do you handle nulls and reversing?",
      "a": "Compose factory methods: Comparator.comparing(Employee::getDept).thenComparing(Employee::getSalary) sorts by department then salary. Add .reversed() to flip the whole ordering, or reverse one key with Comparator.comparing(Employee::getSalary, Comparator.reverseOrder()). Use comparingInt/comparingDouble to avoid boxing on primitive keys. For nullable fields wrap with Comparator.nullsFirst(...) or nullsLast(...) so nulls sort predictably instead of throwing NullPointerException. All of these return a Comparator you can pass straight to list.sort(...), stream.sorted(...), or min/max."
    },
    {
      "q": "How do Function.andThen/compose and Predicate.and/or/negate let you build behavior from small pieces?",
      "a": "These default methods return a new composed instance without mutating the originals. f.andThen(g) applies f then g (g(f(x))), while f.compose(g) applies g first (f(g(x))). Predicate exposes p.and(q), p.or(q) and p.negate() with short-circuit semantics, so you can assemble a filter like isActive.and(isSenior.or(isManager)) from named, testable predicates. Consumer.andThen(c2) chains side effects in order. This is function composition in Java: it keeps each piece small and reusable and reads declaratively at the call site."
    }
  ],
  "2.3": [
    {
      "q": "Compare synchronized and ReentrantLock: what does the explicit lock give you, and what's the cost?",
      "a": "synchronized is simpler and auto-releases on scope exit even during exceptions, but it only supports one implicit condition, blocks uninterruptibly, and offers no try-or-timeout. ReentrantLock adds tryLock with timeout, interruptible acquisition, optional fairness, and multiple Condition objects, which you need for things like bounded buffers with separate not-full and not-empty waits. The cost is that you must release it in a finally block yourself, and forgetting that finally is a classic source of permanently stuck threads."
    },
    {
      "q": "Why is double-checked locking subtly broken without volatile, and how does the JMM fix it?",
      "a": "The lazy-init idiom checks the field, locks only if null, then checks again, but without volatile a second thread can see a non-null reference whose constructor writes haven't been published, due to reordering of the allocation and field stores. Marking the field volatile establishes the happens-before edge so any thread that reads the non-null reference also sees the fully constructed object. In practice people sidestep the whole issue with a static holder class, which uses the JVM's guaranteed-once class-initialization lock for free."
    },
    {
      "q": "Explain CAS and the ABA problem, and how LongAdder differs from AtomicLong under contention.",
      "a": "Compare-and-swap atomically updates a value only if it still equals an expected snapshot, enabling lock-free retry loops; the ABA problem is when a value changes from A to B and back to A, so CAS succeeds even though state was disturbed, addressed with a versioned AtomicStampedReference. AtomicLong is fine at low contention but a single hot CAS location causes cache-line ping-pong under heavy multi-thread updates. LongAdder spreads writes across multiple cells to reduce contention and sums them on read, so it's faster for high-write counters where you read totals infrequently."
    },
    {
      "q": "Why must you restore the interrupt flag after catching InterruptedException, and what is interruption actually?",
      "a": "Interruption is cooperative: it sets a flag and, for blocking calls, throws InterruptedException which clears the flag, so swallowing the exception silently destroys the only signal that someone asked the thread to stop. Restoring it with Thread.currentThread().interrupt() lets higher-level code, like a thread pool's shutdown logic, observe the request and terminate cleanly. The anti-pattern of catching and ignoring it produces tasks that can't be cancelled and pools that won't shut down."
    },
    {
      "q": "Why is sizing a ThreadPoolExecutor non-trivial, and how do the queue and rejection policy interact?",
      "a": "ThreadPoolExecutor only grows beyond the core size after the queue is full, so an unbounded queue means the pool never adds threads and tasks pile up in memory, while a tiny core with a bounded queue rejects work under bursts. You size core threads for CPU-bound work near the core count and higher for I/O-bound work, choose a bounded queue to apply backpressure, and pick a rejection policy such as CallerRuns to throttle producers. Getting this wrong causes either OOM from queue buildup or dropped work from premature rejection."
    },
    {
      "q": "When is CompletableFuture's default executor a trap, and how do thenApply and thenApplyAsync differ?",
      "a": "Async stages without an explicit executor run on the ForkJoinPool.commonPool, which is sized for CPU-bound work and shared JVM-wide, so blocking I/O there starves unrelated parallel streams and other tasks. thenApply may run in the thread that completed the previous stage, including the caller, whereas thenApplyAsync hands the work to an executor; the non-async form can surprise you by running on a thread you didn't expect. The fix for blocking work is always to pass a dedicated executor to the Async variants."
    }
  ],
  "2.4": [
    {
      "q": "Explain thread pinning with virtual threads: what causes it and how do you fix it?",
      "a": "A virtual thread normally unmounts from its carrier platform thread when it blocks, freeing the carrier to run other virtual threads, but pinning is when it can't unmount and holds the carrier hostage while blocked. The main causes are blocking inside a synchronized block or method, and native or foreign calls, because the JVM can't safely unwind those across a yield. The fix is to replace synchronized with ReentrantLock around blocking sections, and you diagnose it with -Djdk.tracePinnedThreads or JFR; recent JDKs reduce synchronized pinning but the lock-based pattern is still safest."
    },
    {
      "q": "Why should you not pool virtual threads, and how does the cost model differ from platform threads?",
      "a": "Virtual threads are cheap to create and managed by the JVM, so the whole point is to spawn one per task and let it block freely; pooling them reintroduces the contention and lifecycle management that pools exist to amortize for expensive platform threads. Use a new-virtual-thread-per-task executor rather than a fixed pool. The mental shift is that you no longer ration threads to protect the OS; instead you protect downstream resources like databases with semaphores or connection-pool limits, not by capping thread count."
    },
    {
      "q": "If virtual threads make blocking cheap, why might database or downstream calls still need limiting?",
      "a": "Virtual threads remove the thread-count bottleneck but not the real resource limits behind them; if a million virtual threads each grab a connection, you'll exhaust the database's connection limit or overwhelm a downstream service. So you keep a bounded connection pool like HikariCP sized to what the database can handle, and possibly a Semaphore to cap concurrency to a fragile dependency. The thread is no longer the scarce resource, but the external system still is, and backpressure must live there."
    },
    {
      "q": "What problem does structured concurrency solve that raw executors and futures don't?",
      "a": "With plain executors, subtasks can outlive their parent, leak when the parent fails, and require manual cancellation and result joining, so error handling and lifetime are ad hoc. StructuredTaskScope ties subtask lifetime to a lexical scope: forking children, joining them, and guaranteeing that none escape the scope, with failure of one able to cancel siblings automatically. This makes cancellation propagation, timeouts, and error aggregation reliable, mirroring how structured control flow tamed goto for sequential code."
    },
    {
      "q": "Compare ShutdownOnFailure and ShutdownOnSuccess and when each fits.",
      "a": "ShutdownOnFailure runs all subtasks and cancels the rest the moment any one fails, which is the fan-out-and-need-all pattern, like calling several services whose results you all require. ShutdownOnSuccess cancels the rest as soon as any subtask succeeds, the race or hedging pattern where you query redundant sources and take the first good answer. You pick based on whether you need every result or just the first successful one, and both guarantee the scope won't return until children are done or cancelled."
    },
    {
      "q": "Do virtual threads replace reactive frameworks like WebFlux, and what are the limits?",
      "a": "For the common case of I/O-bound request handling, virtual threads let you write simple blocking, debuggable, stack-trace-friendly code that scales to massive concurrency, removing much of the original motivation for reactive style. What they don't give you is reactive's backpressure semantics, fine-grained streaming operators, and non-blocking composition, which still matter for streaming data and explicit flow control. They also don't speed up CPU-bound work, and migrating value depends on whether your stack's blocking points actually unmount rather than pin."
    }
  ],
  "2.5": [
    {
      "q": "How do sealed types and switch combine to give compile-time exhaustiveness, and why is that valuable?",
      "a": "A sealed interface declares a closed set of permitted implementations, so the compiler knows every possible subtype; a switch over that type that covers all permitted cases needs no default and is checked to be exhaustive. The value is that adding a new permitted subtype turns every non-exhaustive switch into a compile error, pointing you at exactly the code that must handle the new case, instead of a silent runtime fall-through. This is how records plus sealed types model algebraic data types with safe pattern matching."
    },
    {
      "q": "Explain the difference between final, sealed, and non-sealed in a permitted hierarchy.",
      "a": "A sealed type restricts which classes may extend or implement it via its permits clause, and each permitted subtype must itself choose one of three modifiers. final closes the subtype to further extension, sealed continues the closed hierarchy with its own permitted list, and non-sealed deliberately reopens that branch to arbitrary subclassing again. This lets you keep part of a hierarchy locked for exhaustiveness while intentionally leaving one branch extensible."
    },
    {
      "q": "What do record patterns add over a plain instanceof pattern, and when did they land?",
      "a": "Pattern matching for instanceof binds the tested type to a variable, eliminating the cast; record patterns, standardized in Java 21, go further by deconstructing a record directly into its components in one step. So instead of testing for a Point and then calling accessors, you can write case Point(int x, int y) and bind x and y immediately, and these patterns nest for composed records like Line(Point start, Point end). Combined with sealed types in a switch, this gives concise, exhaustive structural matching."
    },
    {
      "q": "What is a compact constructor in a record, and what is the main thing you can't do in it?",
      "a": "A compact constructor omits the parameter list and the field assignments, letting you validate or normalize the incoming component values before the implicit assignment runs at the end. You typically throw on invalid input or canonicalize values, such as trimming a string or defensively copying a list. The key restriction is that you do not assign to the fields yourself, the compiler does that after your code; and you must remember records are shallowly immutable, so a mutable component like a List should be defensively copied to stay safe."
    },
    {
      "q": "When should you choose sealed types over ordinary open inheritance?",
      "a": "Reach for sealed types when you have a fixed, known set of variants you want to reason about exhaustively, like the node kinds of an AST, the states of a state machine, or a closed result type of success and failure. The closed hierarchy buys you exhaustiveness checking and documents the complete set in one place, which open inheritance can't. You stay with open inheritance when extensibility by unknown third parties is a feature, such as a plugin SPI, since sealing would forbid exactly that."
    },
    {
      "q": "Why is a guarded pattern useful in switch, and how does it differ from a regular case?",
      "a": "A guarded pattern adds a boolean condition with when to a type or record pattern, so the case matches only when both the shape and the predicate hold, letting you split one type into multiple behaviors without nested ifs. For example case Integer i when i > 0 versus a fallthrough case Integer i handles positive and other integers distinctly. The subtlety is ordering and exhaustiveness: because a guard can fail at runtime, the compiler still requires an unguarded or default case to cover the same type, or it won't consider the switch exhaustive."
    }
  ],
  "2.6": [
    {
      "q": "How do you decide what to cover with unit tests vs integration tests vs end-to-end tests?",
      "a": "I follow the pyramid by cost and feedback speed: business logic and edge cases live in fast unit tests; the seams I can't prove with mocks — SQL correctness, wiring, serialization, security config — get integration tests with real dependencies via Testcontainers; and only a handful of critical user journeys get end-to-end coverage because those tests are slow and flaky-prone. The guiding question is 'what failure would this test catch that a cheaper test could not?' — if a unit test can catch it, it doesn't belong higher up the pyramid."
    },
    {
      "q": "When would you use a mock versus a spy versus a fake, and what's the danger of over-mocking?",
      "a": "A mock verifies interactions (was the email sent once?), a spy wraps a real object when I need mostly-real behaviour with one method overridden, and a fake is a lightweight working implementation (in-memory repository) better suited to state-based tests. Over-mocking couples tests to implementation details — every refactor breaks green tests that assert internal call sequences rather than outcomes — so I mock at architectural boundaries I own (ports, gateways) and never mock value objects or types I don't own."
    },
    {
      "q": "Why does doReturn/when sometimes work where when/thenReturn fails in Mockito?",
      "a": "when(spy.method()).thenReturn(x) actually invokes the real method on a spy during stubbing — which can throw or have side effects — because the real call happens before Mockito intercepts it. doReturn(x).when(spy).method() sets the stub without calling through, so it's required for spies and for stubbing methods that would fail when invoked. On plain mocks both work, but the doReturn family is also the only option for void methods."
    },
    {
      "q": "Your Spring Boot build got slow because tests keep restarting the application context. What's happening and how do you fix it?",
      "a": "Spring caches the ApplicationContext across test classes keyed by its configuration; anything that changes the key — @MockBean of different types, different @ActiveProfiles or properties, @DirtiesContext — forces a fresh context boot. The fix is standardising: a small set of shared test configurations (ideally one base class per slice), moving mocks into common test config, and treating @DirtiesContext as a last resort. Going from twenty context variants to two can cut minutes off a build."
    },
    {
      "q": "Why use Testcontainers instead of H2 for repository tests?",
      "a": "H2 is a different database pretending to be yours: dialect differences (window functions, JSON, locking semantics, ON CONFLICT), different transaction/isolation behaviour, and different query plans mean tests can pass on H2 and fail on Postgres — or worse, the reverse. Testcontainers runs the real engine in Docker so the SQL, migrations, and constraints are tested for real; with the singleton-container pattern and reuse, the startup cost is paid once per JVM rather than per class."
    },
    {
      "q": "A test passes locally but fails intermittently in CI. Walk me through your flaky-test debugging checklist.",
      "a": "The usual suspects in order: time (hardcoded sleeps or clock assumptions — replace with Awaitility or an injectable Clock), asynchrony (asserting before a queue/async task completes), test order and shared state (a static or DB row leaking between tests — run with random order to expose it), concurrency in the code under test, and environment differences (ports, locales, container resources). I make the failure reproducible first — rerun with the same seed/order — because 'retry until green' just hides a real race."
    },
    {
      "q": "What does @Transactional on a test actually do, and when is the automatic rollback misleading?",
      "a": "Spring wraps each test in a transaction and rolls it back afterwards, which keeps the DB clean without truncation. It's misleading in two ways: code that runs in a separate transaction (REQUIRES_NEW, async workers, or another service instance) won't see the test's uncommitted data, and the rollback can hide problems that only appear at commit time — deferred constraints, flush-order issues, triggers. For those, I commit for real and clean up explicitly, or test through the API against a Testcontainer."
    }
  ],
  "2.7": [
    {
      "q": "What is the difference between a static nested class and an inner (non-static) class?",
      "a": "A static nested class is associated with the outer class, not an instance, so it can be created standalone as new Outer.Nested() and cannot access the outer instance's non-static fields. An inner class is tied to an enclosing instance: it holds an implicit reference (Outer.this) so it can read the outer object's state, and you can only create it via outerInstance.new Inner(). That hidden reference is also a memory-leak risk -- an inner-class instance keeps its outer object alive, which is why long-lived listeners or handlers should be static nested classes (or use a WeakReference). Prefer static nested unless you genuinely need the enclosing instance."
    },
    {
      "q": "What does `this` refer to inside an anonymous class versus inside a lambda, and when can't a lambda replace an anonymous class?",
      "a": "In an anonymous class, `this` refers to the anonymous instance itself; to reach the enclosing object you write Outer.this. In a lambda, `this` refers to the enclosing instance -- a lambda introduces no new scope for `this` or for variable shadowing. A lambda can only replace an anonymous class that implements a single-abstract-method (functional) interface with no state. You still need an anonymous class when the type is an abstract class, when it implements more than one method, when you need instance fields or a constructor, or when you need `this` to mean the handler object (common with self-removing listeners)."
    },
    {
      "q": "Why must an annotation have RUNTIME retention to be readable by reflection, and what are the three retention policies?",
      "a": "RetentionPolicy.SOURCE annotations (like @Override) are discarded by the compiler and exist only for tools/linters. CLASS (the default) keeps them in the .class file but the JVM does not load them, so reflection cannot see them. RUNTIME keeps them in the class file AND makes the JVM load them, so element.getAnnotation(X.class) or isAnnotationPresent works. Any framework that inspects annotations at run time -- Spring, JUnit, Jackson, Bean Validation -- requires its annotations to be @Retention(RUNTIME); if you write a custom annotation and forget it, your reflection code silently finds nothing."
    },
    {
      "q": "What does setAccessible(true) do, what does it bypass, and why can it fail on modern JDKs?",
      "a": "It suppresses Java's access checks so reflection can read or invoke private, protected or package-private members -- how frameworks populate private fields or call private methods. It bypasses normal encapsulation, so it should be used sparingly and never on untrusted input. On Java 9+ with the module system it can throw InaccessibleObjectException when the target package is not `open` to your module (strong encapsulation of the JDK internals). It also has a real performance cost versus direct access and defeats the compiler's ability to reason about the code, so hot paths should cache Method/Field handles or avoid reflection entirely (e.g. MethodHandles/LambdaMetafactory)."
    },
    {
      "q": "What is serialVersionUID and what happens when it does not match on deserialization?",
      "a": "serialVersionUID is a version stamp for a Serializable class. When you serialize, the current UID is written into the byte stream; when you deserialize, the JVM compares the stream's UID with the loaded class's UID and throws InvalidClassException if they differ. If you don't declare one explicitly, the compiler generates it from the class's structure, so almost any change (adding a field, changing a modifier) silently changes the UID and breaks old data. Declaring a fixed `private static final long serialVersionUID` gives you control: keep it stable across compatible changes and bump it only when you intend to break compatibility. transient and static fields are never part of the serialized state."
    },
    {
      "q": "Why is deserializing untrusted data dangerous, and how do you defend against it?",
      "a": "Java deserialization reconstructs arbitrary object graphs and runs code in readObject/readResolve and in the class's own logic during reconstruction. An attacker who controls the byte stream can craft a 'gadget chain' out of classes already on the classpath to achieve remote code execution, DoS, or resource exhaustion -- without ever calling your code directly. Defenses: never deserialize data from an untrusted source; if you must, install an ObjectInputFilter (an allow-list of expected classes and limits on depth/array size); prefer data formats that don't instantiate arbitrary types, such as JSON or protobuf with an explicit schema. Modern systems generally avoid native Java serialization for anything crossing a trust boundary."
    },
    {
      "q": "When would you use Externalizable or writeReplace/readResolve instead of default serialization?",
      "a": "Externalizable gives you full manual control of the wire format via writeExternal/readExternal -- useful for compactness or speed, but you write every field yourself and it needs a public no-arg constructor. writeReplace lets an object substitute a different object (often a compact 'serialization proxy') into the stream, and readResolve lets a class replace the freshly deserialized object with a canonical one -- essential for singletons and enums so deserialization does not silently create a second instance and break `==` identity. The serialization-proxy pattern (a small static nested class with writeReplace + readResolve) is the robust way to keep invariants and immutability across deserialization."
    }
  ],
  "2.8": [
    {
      "q": "Which Java releases are the Long-Term-Support (LTS) versions, and why does it matter?",
      "a": "The LTS releases are Java 8, 11, 17, 21 and 25. They receive extended support (security patches and updates for years), so companies standardize production systems on them rather than on the six-month feature releases in between. When someone says 'we're on Java 17' they almost always mean an LTS; interviewers expect you to target an LTS by default and to know that 8, 11, 17, 21, 25 are the checkpoints."
    },
    {
      "q": "What is the Java release cadence since Java 9?",
      "a": "Since Java 9 (2017), a new feature release ships every six months (March and September), with an LTS roughly every two years. That is why version numbers climb fast -- Java 21 in 2023, 25 in 2025. Non-LTS releases are short-lived stepping stones where features incubate; LTS releases consolidate the stable ones for long-term production use."
    },
    {
      "q": "Which version is considered the 'game changer', and what did it introduce?",
      "a": "Java 8 (2014). It introduced lambda expressions, the Stream API, functional interfaces, Optional, method references, default methods on interfaces, and the modern Date/Time API (java.time). It brought functional-style programming to Java and remained the most widely deployed version for years, which is why so much existing code and so many interview questions center on it."
    },
    {
      "q": "What was the single biggest release before Java 8, and what did it add?",
      "a": "Java 5 (2004, codename 'Tiger'). It added generics, annotations, enums, the enhanced for-each loop, autoboxing/unboxing, varargs, static imports, and the java.util.concurrent utilities. Most of the type-safety and language features developers now take for granted arrived in Java 5."
    },
    {
      "q": "What is a 'preview' (or 'incubator') feature, and why do features like records or virtual threads appear across several versions?",
      "a": "A preview feature ships fully implemented but behind the --enable-preview flag so the community can try it and give feedback before it becomes permanent; an incubator module is the same idea for new APIs. Because the language team iterates before committing forever, a feature is often previewed for one or more releases and then made 'final'. For example records were previewed in 14, final in 16; virtual threads were previewed in 19/20 and final in 21."
    },
    {
      "q": "Name a headline feature introduced in Java 7, 9, 11, 17 and 21 respectively.",
      "a": "Java 7: try-with-resources (and the diamond operator, NIO.2, Fork/Join). Java 9: the module system (JPMS) and JShell. Java 11 (LTS): the standardized HTTP Client API and new String methods. Java 17 (LTS): sealed classes (final) and strong encapsulation. Java 21 (LTS): virtual threads (final), pattern matching for switch (final), record patterns and sequenced collections."
    },
    {
      "q": "When did records, sealed classes, and virtual threads become final?",
      "a": "Records were previewed in Java 14 and became final in Java 16. Sealed classes were previewed in 15 and became final in Java 17. Virtual threads (Project Loom) were previewed in 19 and 20 and became final in Java 21. Knowing the 'final in' version matters because you can only rely on the feature without --enable-preview from that release onward."
    },
    {
      "q": "What did the Module System (JPMS) in Java 9 aim to solve?",
      "a": "It introduced modules (module-info.java) that explicitly declare what packages they export and what other modules they require, giving strong encapsulation and a reliable dependency graph. The goals were to break up the monolithic JDK (so runtimes can be smaller via jlink), replace the fragile classpath with a verified module path, and hide internal JDK APIs. It is powerful but adoption in application code has been modest; most teams still ship on the classpath."
    }
  ],
  "3.1": [
    {
      "q": "Walk me through constructor vs setter vs field injection and which you'd use in production.",
      "a": "Constructor injection is the default choice: it makes dependencies explicit, allows final fields for immutability and thread-safety, fails fast at startup on missing or circular dependencies, and lets you instantiate the class with plain new in tests without a Spring context. Setter injection is reserved for genuinely optional or reconfigurable dependencies. Field injection (@Autowired on a field) is discouraged in production because it hides dependencies, can't produce final fields, encourages too many collaborators, and forces reflection or a running context to test."
    },
    {
      "q": "Explain the Spring bean lifecycle from instantiation to destruction, and where AOP proxies appear.",
      "a": "Spring instantiates the bean (constructor), populates properties and @Autowired dependencies, fires *Aware callbacks, then BeanPostProcessor.postProcessBeforeInitialization, then init callbacks (@PostConstruct, then InitializingBean.afterPropertiesSet, then a custom init-method), then BeanPostProcessor.postProcessAfterInitialization. AOP proxies for @Transactional, @Async, and @Cacheable are created in that final after-initialization step, which is exactly why a self-call bypasses them. On shutdown the container runs @PreDestroy, DisposableBean.destroy, then any destroy-method, in reverse creation order."
    },
    {
      "q": "What's the difference between @Component, @Service, @Repository, and @Controller? Does the framework treat them differently?",
      "a": "All four are stereotype specializations of @Component and are equally picked up by component scanning, so functionally they mostly just document intent. The real exception is @Repository: it enables persistence exception translation, converting vendor-specific SQLExceptions into Spring's unchecked DataAccessException hierarchy via a PersistenceExceptionTranslationPostProcessor. @Controller/@RestController are recognized by Spring MVC's handler mapping. Using the precise stereotype also lets AOP pointcuts and tooling target layers cleanly."
    },
    {
      "q": "You @Autowire a prototype-scoped bean into a singleton service. Why does each call return the same instance, and how do you fix it?",
      "a": "A singleton is wired once at creation, so the prototype is resolved exactly once and that single instance is captured for the lifetime of the singleton, defeating the prototype scope. The clean fix is to inject ObjectProvider<MyProtoBean> (or jakarta Provider) and call getObject() per use, which asks the container for a fresh instance each time. Alternatives are method injection via @Lookup, or a scoped proxy; injecting ApplicationContext and calling getBean works but reintroduces the service-locator smell."
    },
    {
      "q": "How does Spring resolve a dependency when multiple beans implement the same interface, and what are @Primary, @Qualifier, and parameter-name matching doing?",
      "a": "Injection is by type first; if more than one candidate matches, Spring narrows by @Primary (a single default winner), then by @Qualifier name, and finally falls back to matching the injection point's field or parameter name against the bean name. If it still can't disambiguate it throws NoUniqueBeanDefinitionException at startup. In Spring Boot 3 you can also define custom qualifier annotations or inject a List<T>/Map<String,T> to receive all implementations, which is handy for strategy patterns."
    },
    {
      "q": "Why is @PostConstruct preferred over doing initialization work in the constructor, and what can go wrong if you don't?",
      "a": "At constructor time only constructor-injected dependencies are available; field- and setter-injected collaborators are still null, and any proxying the container will apply hasn't happened yet. @PostConstruct runs after the bean is fully wired, so cache warming, validation, or registration that depends on collaborators is safe there. Doing such work in the constructor risks NullPointerExceptions, calling through a not-yet-proxied reference (so @Transactional/@Async won't apply), and makes construction slow and side-effectful, which hurts testability."
    },
    {
      "q": "How does Spring handle circular dependencies, and why is a constructor cycle a design smell rather than something to patch with @Lazy?",
      "a": "Spring can resolve a setter/field-injection cycle using its three-level singleton cache that exposes early bean references, but a pure constructor-injection cycle can't be satisfied and the context fails to start with BeanCurrentlyInCreationException. You can break it with @Lazy, setter injection, or an ObjectProvider, but those just hide that two beans are mutually responsible for each other. The senior move is to refactor: extract the shared logic into a third collaborator or publish an event, because a cycle usually signals a missing abstraction or a layering violation."
    }
  ],
  "3.2": [
    {
      "q": "Explain end to end how Spring Boot auto-configuration decides which beans to create.",
      "a": "@SpringBootApplication pulls in @EnableAutoConfiguration, which uses AutoConfigurationImportSelector to read candidate configuration classes from META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports (the spring.factories mechanism was replaced by this file in Boot 2.7/3.x). Each candidate is gated by @Conditional annotations evaluated against the classpath, existing beans, and properties, so only applicable ones contribute beans. Because auto-config beans use @ConditionalOnMissingBean, any bean you define yourself wins, which is the 'sensible defaults you can always override' contract."
    },
    {
      "q": "What's the difference between @ConditionalOnClass, @ConditionalOnMissingBean, and @ConditionalOnProperty, and why does ordering of evaluation matter?",
      "a": "@ConditionalOnClass triggers config only when a type is on the classpath (e.g. configure JPA only if Hibernate is present), @ConditionalOnMissingBean backs off if the user already defined that bean, and @ConditionalOnProperty toggles config on a property value. Ordering matters because user configuration and earlier auto-configs are processed before later ones via @AutoConfigureBefore/After and @AutoConfigureOrder, so a bean must already exist for a downstream @ConditionalOnMissingBean to back off correctly. Getting that ordering wrong is the classic cause of an auto-config silently winning over a user bean."
    },
    {
      "q": "How would you debug why an expected auto-configured bean is missing or an unexpected one is present?",
      "a": "Run with --debug (or set debug=true) to print the Condition Evaluation Report, which lists Positive matches, Negative matches with the exact failed condition, and Exclusions. That tells you, for instance, that DataSourceAutoConfiguration backed off because no JDBC driver was found or because a user DataSource already exists. You can also hit the actuator /conditions endpoint at runtime, and exclude offenders via spring.autoconfigure.exclude or the exclude attribute of @SpringBootApplication."
    },
    {
      "q": "Why are Actuator endpoints not all exposed by default, and how do you secure them in production?",
      "a": "In Boot 3, only /health (and /info) are exposed over HTTP by default; everything else must be opted in via management.endpoints.web.exposure.include, because endpoints like /env, /heapdump, /threaddump, and /loggers leak sensitive data or allow runtime mutation. In production you typically expose a curated subset, put them behind authentication/authorization (Spring Security), and often move them to a separate management port or network so they're not reachable from the public internet. Sensitive values in /env and /configprops should be sanitized, which Actuator does by default for keys matching password/secret/token patterns."
    },
    {
      "q": "How do liveness and readiness probes differ, and how does Actuator support them in Kubernetes?",
      "a": "Liveness answers 'is the app broken and needs a restart' while readiness answers 'can the app currently accept traffic'; conflating them causes pointless restarts during transient dependency outages. Actuator exposes /health/liveness and /health/readiness as health groups backed by the application's LivenessState and ReadinessState, auto-enabled when it detects Kubernetes. A failing readiness probe takes the pod out of the load balancer without killing it, and Boot also flips readiness to OUT_OF_SERVICE during graceful shutdown so in-flight requests drain before the container stops."
    },
    {
      "q": "How do you add a custom health indicator and custom metrics, and what's the role of Micrometer?",
      "a": "Implement HealthIndicator (or extend AbstractHealthIndicator) and return Health.up()/down() with details; Spring auto-registers it as a contributor under /health. Micrometer is the vendor-neutral metrics facade Actuator uses, so you inject MeterRegistry and create Counter, Timer, or Gauge instances, or annotate methods with @Timed/@Counted. Because Micrometer abstracts the backend, the same instrumentation ships to Prometheus, Datadog, or CloudWatch just by swapping the registry dependency; you generally expose /actuator/prometheus for scraping rather than pushing."
    },
    {
      "q": "What is a custom Spring Boot starter and an auto-configuration module, and when would you build one?",
      "a": "A starter is a thin, dependency-only artifact that pulls in a library plus a companion autoconfigure module containing @AutoConfiguration classes listed in the AutoConfiguration.imports file. You build them to share cross-cutting infrastructure (a tracing client, a tenant resolver, an internal HTTP client) across many services so teams get it by adding one dependency. Good practice is to gate everything on @ConditionalOnClass/@ConditionalOnProperty, back off with @ConditionalOnMissingBean, expose typed @ConfigurationProperties, and ship metadata so IDEs autocomplete the properties."
    }
  ],
  "3.3": [
    {
      "q": "What is the DispatcherServlet and what role does it play in Spring MVC?",
      "a": "The DispatcherServlet is Spring MVC's front controller: a single servlet that receives every incoming HTTP request and orchestrates handling. It consults handler mappings to find the controller method for the URL, invokes it (resolving arguments like @PathVariable, @RequestParam, @RequestBody), then uses an HttpMessageConverter (Jackson for JSON) to serialize the return value into the response. Centralizing routing in one servlet is the front-controller pattern and is why cross-cutting concerns (security filters, exception handling, content negotiation) can be applied in one place."
    },
    {
      "q": "What is the difference between @Controller and @RestController?",
      "a": "@Controller is the classic MVC stereotype whose methods usually return a view name to be rendered (with @ResponseBody needed on methods that return data directly). @RestController is a convenience annotation that combines @Controller and @ResponseBody, so every handler method's return value is written straight to the response body (serialized to JSON by default) rather than resolved as a view. You use @RestController for REST APIs and @Controller when serving server-rendered HTML."
    },
    {
      "q": "Why expose DTOs from controllers instead of returning JPA entities directly?",
      "a": "Returning entities couples your API contract to your database schema, leaks internal fields, and invites serialization problems -- serializing a lazily-loaded association can trigger extra queries or a LazyInitializationException outside the persistence context, and bidirectional relationships can cause infinite recursion. A DTO (often a record) is a deliberate, stable representation shaped for the client: you choose exactly which fields to expose, you decouple API evolution from schema changes, and you avoid accidentally exposing sensitive columns."
    },
    {
      "q": "Which HTTP status codes should a well-behaved CRUD endpoint return?",
      "a": "201 Created (with a Location header pointing to the new resource) for a successful POST that creates; 200 OK for a successful GET or an update returning a body; 204 No Content for a successful update/delete with no body; 400 Bad Request for validation/parse failures; 404 Not Found when the resource does not exist; 409 Conflict for a state conflict such as a duplicate key or optimistic-lock failure; 401/403 for authentication/authorization failures. ResponseEntity lets you set the status, headers, and body explicitly."
    },
    {
      "q": "How does @Valid work, and what happens when validation fails on a @RequestBody?",
      "a": "Putting @Valid on a @RequestBody parameter tells Spring to run Jakarta Bean Validation (constraints like @NotBlank, @Size, @Email) on the deserialized object before the controller body runs. If any constraint fails, Spring throws MethodArgumentNotValidException before your method executes; by default that yields a 400. You typically handle it in a @RestControllerAdvice to return a clean list of field errors. For validating @PathVariable/@RequestParam constraints you add @Validated to the controller class."
    },
    {
      "q": "What is @ControllerAdvice / @RestControllerAdvice used for?",
      "a": "It defines global, cross-controller behavior -- most commonly centralized exception handling. A class annotated @RestControllerAdvice with @ExceptionHandler methods catches exceptions thrown by any controller and maps them to consistent HTTP responses (e.g. a domain NotFoundException -> 404, MethodArgumentNotValidException -> 400 with field errors). This keeps error handling out of individual controllers and gives the whole API one uniform error format instead of ad-hoc try/catch everywhere."
    },
    {
      "q": "What is ProblemDetail / RFC 7807 and why use it?",
      "a": "RFC 7807 defines a standard JSON shape for HTTP error responses -- media type application/problem+json with fields like type, title, status, detail, and instance. Spring 6 provides the ProblemDetail class to build these. Using it means every error your API returns has a predictable, machine-readable structure instead of a bespoke format per endpoint, which makes clients easier to write and errors easier to document and monitor."
    },
    {
      "q": "In one line each, what is the difference between authentication and authorization, and where does Spring Security sit?",
      "a": "Authentication answers 'who are you?' (verifying identity -- credentials, a JWT, an OAuth2 token); authorization answers 'what are you allowed to do?' (checking permissions/roles on a request). Spring Security is a chain of servlet filters that runs BEFORE the DispatcherServlet, so it can authenticate and authorize (or reject) a request before it ever reaches your controller. The full treatment -- filter chain internals, JWT lifecycle, OAuth2/OIDC, RBAC/ABAC -- is in Module 11.3."
    }
  ],
  "3.4": [
    {
      "q": "How does Spring Data JPA turn an interface like findByEmailAndStatus into a working query, and what are the limits of derived queries?",
      "a": "At startup Spring Data creates a dynamic proxy for each repository interface; a query-method backend parses the method name into a tree (property paths, And/Or, OrderBy, etc.) and builds a JPA Criteria/JPQL query, while CRUD methods delegate to SimpleJpaRepository. Derived queries are great for simple lookups but get unreadable and fragile with many conditions, can't express joins or projections cleanly, and silently break if you rename a field. Past a couple of predicates, switch to @Query (JPQL or native) or the Criteria/Specification API for complex dynamic filters."
    },
    {
      "q": "Explain the N+1 select problem in JPA, how you'd detect it, and how a fetch join fixes it.",
      "a": "N+1 happens when you load N parent entities and then trigger one extra query per parent to load a lazy association, turning a list render into N+1 round trips that crush throughput. You detect it by enabling SQL logging or statistics (hibernate.generate_statistics) and seeing a burst of identical secondary queries, or with tools like datasource-proxy. The fix is to fetch the association in one query with JOIN FETCH (or an @EntityGraph), or to batch-load lazies with hibernate.default_batch_fetch_size so the children load in a few IN queries instead of N."
    },
    {
      "q": "What causes LazyInitializationException and what's the right way to avoid it versus the anti-patterns?",
      "a": "It's thrown when you access a lazy association after the persistence context/session that loaded the entity has closed, typically when serializing an entity in the web layer after the @Transactional service method returned. The right fixes are to fetch what the view needs inside the transaction via JOIN FETCH or an @EntityGraph, or to map to a DTO/projection so you never expose lazy proxies. Anti-patterns are Open Session In View (it works but keeps the session open across the whole request, hiding N+1 and holding connections longer) and EAGER-everything (which causes runaway joins and cartesian products)."
    },
    {
      "q": "When would you choose a JOIN FETCH versus an @EntityGraph versus a DTO projection?",
      "a": "JOIN FETCH in JPQL is explicit and precise but couples the fetch plan to that specific query and can't be reused. @EntityGraph declaratively layers a fetch plan onto an existing method (including derived queries) and is reusable across calls, which is cleaner when the same entity is fetched many ways. DTO/interface projections (select new com.x.Dto(...) or interface-based) are best when you only need a few columns, because they avoid loading full entity graphs and the persistence context, sidestep lazy issues entirely, and reduce memory and serialization cost on read-heavy endpoints."
    },
    {
      "q": "How does pagination interact with fetch joins on collections, and what's the in-memory pagination warning Hibernate emits?",
      "a": "When you JOIN FETCH a to-many collection and also apply a Pageable, the SQL produces one row per child, so the database can't safely apply LIMIT/OFFSET to distinct parents; Hibernate logs 'firstResult/maxResults specified with collection fetch; applying in memory' and pulls the whole result set into memory to paginate, which can OOM on large data. The fix is a two-step approach: page the parent IDs first (no collection fetch), then fetch the collections for that page of IDs with an IN query, or use @EntityGraph/batch fetching. To-one fetches don't have this problem."
    },
    {
      "q": "What does saveAll/save actually do, and why might calling save() in a loop be slow without batch configuration?",
      "a": "save() on a new entity calls persist; on a detached/existing one it calls merge, which issues an extra SELECT to load current state before updating. In a loop without JDBC batching, each persist/update is a separate round trip and Hibernate may also flush eagerly, so inserts don't get batched. To make bulk writes fast you set hibernate.jdbc.batch_size, order inserts/updates (order_inserts, order_updates), use a sequence/identity strategy that doesn't defeat batching (IDENTITY disables JDBC batch inserts), and periodically flush()/clear() to keep the persistence context small."
    },
    {
      "q": "Compare optimistic and pessimistic locking in JPA and when you'd reach for each.",
      "a": "Optimistic locking adds a @Version column; on update Hibernate checks the version and throws OptimisticLockException if another transaction changed the row, so it assumes conflicts are rare and avoids holding locks, making it ideal for low-contention, high-read workloads and stateless web apps. Pessimistic locking takes an actual DB row lock (SELECT ... FOR UPDATE via @Lock(PESSIMISTIC_WRITE)), serializing access and preventing concurrent writes, which suits short, high-contention critical sections like decrementing inventory. The trade-off is throughput and deadlock risk versus retry handling: optimistic needs a retry strategy on conflict, pessimistic needs careful lock ordering and timeouts."
    }
  ],
  "3.5": [
    {
      "q": "Explain exactly how @Transactional works under the hood and why a self-invocation silently does nothing.",
      "a": "By default Spring implements @Transactional with a proxy (CGLIB or JDK dynamic) that wraps the bean; the proxy opens/commits/rolls back the transaction around the call before delegating to your code. When one method in the bean calls another @Transactional method via this.otherMethod(), the call goes directly to the target instance and never passes through the proxy, so the second method's transaction settings are ignored entirely. Fixes: move the inner method to a separate bean, self-inject the proxy, use AopContext.currentProxy(), or switch to AspectJ load-time weaving which doesn't rely on proxies."
    },
    {
      "q": "By default @Transactional rolls back on which exceptions, and what's the production trap?",
      "a": "Spring only rolls back automatically on unchecked exceptions (RuntimeException and Error); a checked exception thrown out of a @Transactional method commits the transaction by default. This bites teams who throw checked domain or IOException-style exceptions expecting a rollback and end up persisting partial work. Control it explicitly with rollbackFor = SomeChecked.class or noRollbackFor; many shops standardize on unchecked exceptions for this reason. Also note: catching an exception inside the method swallows the rollback signal entirely."
    },
    {
      "q": "Compare propagation REQUIRED and REQUIRES_NEW, and give a concrete case where REQUIRES_NEW is the right call.",
      "a": "REQUIRED (the default) joins an existing transaction if one is active, otherwise starts a new one, so the whole call graph commits or rolls back together. REQUIRES_NEW suspends any current transaction and runs in a brand-new independent one that commits or rolls back on its own. The classic use is audit logging or recording a failed-attempt record that must persist even if the surrounding business transaction rolls back. Beware: REQUIRES_NEW grabs a second physical connection from the pool, so misuse under load can exhaust the pool and even deadlock against the suspended transaction's locks."
    },
    {
      "q": "What is the 'rollback-only' marker and the UnexpectedRollbackException, and how does an inner transaction cause it?",
      "a": "When a transaction must roll back, Spring marks the transaction 'rollback-only' rather than rolling back immediately. If an inner REQUIRED method throws and is caught by an outer method that then tries to commit, the shared transaction was already marked rollback-only, so the commit attempt fails with UnexpectedRollbackException. The lesson is that with REQUIRED propagation a caught exception in a participating method still doomed the whole transaction; if you truly need the inner work to fail independently you must use REQUIRES_NEW (or NESTED with savepoints) so the rollback is isolated."
    },
    {
      "q": "How do isolation levels and timeout/readOnly attributes of @Transactional translate to the database, and what do they actually buy you?",
      "a": "isolation maps to the underlying JDBC connection's isolation level (READ_COMMITTED, REPEATABLE_READ, etc.) for that transaction, and DEFAULT just uses the database's default. timeout bounds how long the transaction may run before being rolled back, protecting against runaway locks. readOnly = true is a hint: it lets Hibernate skip dirty-checking/flush and lets some drivers/replicas optimize, but it does not guarantee the DB rejects writes, so don't treat it as a security control. These are powerful for tuning long-running reports versus hot write paths."
    },
    {
      "q": "What's the difference between Spring AOP proxies and full AspectJ weaving, and what are the practical limits of proxy-based AOP?",
      "a": "Spring AOP is proxy-based and only intercepts external calls to public (for CGLIB, non-final/non-static) methods on Spring-managed beans; it can't advise private methods, final classes, or self-invocations. Full AspectJ weaves advice into the bytecode at compile or load time, so it can advise any method including private and self-calls and works on non-Spring objects. Most applications stay with Spring AOP because it's simpler and dependency-free, accepting the self-invocation and visibility limitations, and reach for AspectJ only when those limits genuinely block a requirement like domain-object instrumentation."
    },
    {
      "q": "Why is mixing @Transactional with calls to external systems (sending email, publishing to a queue) dangerous, and how do you do it correctly?",
      "a": "Holding a database transaction open while making a remote call lengthens lock duration and pins a connection, and worse, the external side effect can't be rolled back if the transaction later fails, producing dual-write inconsistency (email sent for an order that didn't commit). The clean pattern is to defer the side effect until after commit using @TransactionalEventListener(phase = AFTER_COMMIT) or the outbox pattern, where you write an event row in the same transaction and a separate process publishes it. This keeps transactions short and makes external effects consistent with the committed state."
    }
  ],
  "4.1": [
    {
      "q": "Explain the difference between INNER, LEFT, RIGHT, and FULL OUTER JOIN, and when an unmatched-row requirement forces an outer join.",
      "a": "INNER JOIN returns only rows with a match on both sides; LEFT OUTER keeps all left rows and NULL-fills the right when there's no match (and RIGHT is the mirror); FULL OUTER keeps unmatched rows from both. You need an outer join whenever the absence of a match is meaningful, e.g. 'list all customers and their orders including customers with zero orders'. A classic bug is putting a condition on the outer (right) table in the WHERE clause, which silently turns a LEFT JOIN back into an INNER JOIN; such predicates must go in the ON clause to preserve the unmatched rows."
    },
    {
      "q": "What's the difference between WHERE and HAVING, and how does that relate to the logical order of query evaluation?",
      "a": "WHERE filters individual rows before grouping; HAVING filters groups after GROUP BY and aggregation, so HAVING can reference aggregate functions like COUNT(*) > 5 while WHERE cannot. This follows the logical processing order: FROM/JOIN, then WHERE, then GROUP BY, then HAVING, then SELECT (where aliases are assigned), then ORDER BY, then LIMIT. That order also explains why you usually can't use a SELECT alias in WHERE but can in ORDER BY, and why pushing a filter into WHERE instead of HAVING is faster since it shrinks the set before grouping."
    },
    {
      "q": "How do GROUP BY and aggregate functions handle NULLs, and what surprises people about COUNT?",
      "a": "Aggregate functions ignore NULLs: SUM, AVG, MIN, MAX, and COUNT(column) skip NULL values, so AVG is over non-null rows only, which can differ from what you expect if you assumed NULL meant zero. COUNT(*) counts all rows including those with NULLs, whereas COUNT(column) counts only non-null values of that column, and COUNT(DISTINCT column) further deduplicates. GROUP BY treats all NULLs as a single group. These distinctions cause real reporting bugs, e.g. AVG(amount) understating totals when missing amounts should have counted as zero."
    },
    {
      "q": "When would you use a correlated subquery versus a JOIN or a window function, and what's the performance concern?",
      "a": "A correlated subquery references the outer row and conceptually runs once per outer row, which is intuitive for 'rows where X is the max for its group' but can be slow if the optimizer can't rewrite it. A JOIN (often to a derived/grouped table) is usually faster for set-based filtering, and window functions like ROW_NUMBER()/RANK() OVER (PARTITION BY ...) express top-N-per-group elegantly without a self-join. The practical guidance: prefer set-based JOINs or window functions for large data, and check the execution plan, because a naive correlated subquery can degrade to O(n*m)."
    },
    {
      "q": "Explain window functions and how they differ from GROUP BY, with a concrete example.",
      "a": "GROUP BY collapses rows into one per group, losing row-level detail, whereas a window function computes an aggregate or ranking 'over' a partition while keeping every row. For example, SELECT name, salary, AVG(salary) OVER (PARTITION BY dept) lets each employee row also show their department average, and ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) ranks within department for top-N queries. This is far cleaner and usually faster than self-joining a grouped subquery, and is the standard tool for running totals (SUM OVER ... ORDER BY) and deduplication."
    },
    {
      "q": "What's the difference between UNION and UNION ALL, and why does it matter for performance?",
      "a": "UNION combines two result sets and removes duplicate rows, which forces the database to sort or hash the entire combined set to deduplicate; UNION ALL simply concatenates and keeps duplicates. If you know the sets are disjoint or duplicates are acceptable, always use UNION ALL because it skips the expensive dedup step and can stream results. Using UNION out of habit when UNION ALL would do is a common, easily fixed performance leak on large result sets."
    },
    {
      "q": "How do CTEs and self-joins help, and when is a recursive CTE the right tool?",
      "a": "A common table expression (WITH ...) names a subquery to improve readability and let you reference it multiple times, and a self-join joins a table to itself to relate rows within it, like matching employees to their managers in the same table. A recursive CTE is the right tool for hierarchical or graph traversal such as an org chart, bill-of-materials, or category tree, walking parent-child relationships to arbitrary depth. Be aware that in some databases CTEs were historically an optimization fence (materialized), so on hot paths verify the plan rather than assuming the optimizer inlines them."
    }
  ],
  "4.2": [
    {
      "q": "How does a B-tree index work, and why does it speed up equality and range queries but not leading-wildcard LIKE?",
      "a": "A B-tree keeps keys sorted in a balanced multi-level tree, so the engine descends from root to leaf in O(log n) and can then walk leaf nodes in order, which serves equality lookups, range scans (BETWEEN, >, <), and ORDER BY on the indexed column efficiently. A predicate like LIKE 'abc%' can use the index because the prefix anchors the search, but LIKE '%abc' can't because there's no leading prefix to navigate to, forcing a full scan. Similarly, wrapping the column in a function (WHERE LOWER(email) = ...) disables the index unless you build a matching functional/expression index."
    },
    {
      "q": "What is index selectivity and cardinality, and why might the optimizer ignore an index you created?",
      "a": "Selectivity is the fraction of distinct values a predicate narrows to; high-cardinality columns (many distinct values, like email) are selective and benefit greatly from indexing, while low-cardinality columns (like a boolean or status with two values) often don't, because the index points to a large share of the table. When a query would return a big fraction of rows, the optimizer rationally prefers a sequential scan since random index lookups plus row fetches cost more than reading pages sequentially. Stale statistics can also make it misjudge selectivity, so ANALYZE/refresh stats before concluding the index is useless."
    },
    {
      "q": "Explain composite index column ordering and the leftmost-prefix rule.",
      "a": "A composite index on (a, b, c) is sorted by a, then b, then c, so it can satisfy queries filtering on a, on a+b, or on a+b+c, but not on b alone or c alone, because there's no leading prefix to seek on. Therefore put the most selective and most frequently filtered (especially equality) columns first, and place range-predicate columns last since a range stops further columns from being used for seeking. Designing the column order to match your actual query predicates and sort order is the single highest-leverage indexing decision."
    },
    {
      "q": "What is a covering index / index-only scan, and when is it a big win?",
      "a": "A covering index contains every column a query needs (in the key or via INCLUDE columns), so the engine answers entirely from the index without visiting the table heap, avoiding the extra random I/O of the lookup back to the row. It's a big win for hot read queries that select a few columns and filter/sort on indexed ones, turning two I/O steps into one. The trade-off is a wider index that costs more storage and slows writes, so you reserve covering indexes for genuinely hot read paths rather than adding them everywhere."
    },
    {
      "q": "How do you read an execution plan, and what specific things do you look for when a query is slow?",
      "a": "Use EXPLAIN (and EXPLAIN ANALYZE to get real timings and row counts) and read it as a tree of operations with estimated vs actual rows and cost. Red flags include a Seq Scan on a large table where you expected an index, a big gap between estimated and actual rows (stale stats or bad correlation), nested-loop joins over large inputs that should be hash/merge joins, and expensive Sort/Hash spilling to disk. You then act: add or fix an index, refresh statistics, rewrite the predicate to be sargable, or restructure the join, and re-measure rather than guessing."
    },
    {
      "q": "What's the cost of over-indexing, and how do you decide which indexes to keep?",
      "a": "Every index must be maintained on INSERT/UPDATE/DELETE, so each one slows writes, consumes storage and buffer-cache memory, and adds work to the optimizer; redundant indexes (e.g. (a) when (a,b) already exists) are pure overhead. You decide by looking at real workload: drop unused indexes (most databases expose index-usage stats), consolidate overlapping ones, and add indexes driven by slow-query logs and execution plans rather than speculatively. The goal is the smallest set that covers the actual hot read predicates while keeping write amplification acceptable."
    },
    {
      "q": "Why can pagination with large OFFSET get slow, and what's keyset (seek) pagination?",
      "a": "OFFSET makes the database generate and discard all preceding rows, so OFFSET 100000 scans and throws away 100k rows every page, getting progressively slower deep into the result set. Keyset (seek) pagination instead remembers the last row's sort key and queries WHERE (sort_col, id) > (last_value, last_id) ORDER BY ... LIMIT n, which uses an index to jump straight to the next page in roughly constant time. The trade-offs are no random page jumps and a required stable, unique sort key, but for infinite-scroll and large tables it vastly outperforms OFFSET."
    }
  ],
  "4.3": [
    {
      "q": "Walk through the ACID properties with a concrete example of what each one prevents.",
      "a": "Atomicity makes a transaction all-or-nothing: a transfer that debits one account but fails before crediting the other rolls back entirely, so money never vanishes. Consistency means a committed transaction moves the database from one valid state to another, respecting constraints and triggers. Isolation means concurrent transactions don't observe each other's uncommitted intermediate state as if they ran serially, depending on the level. Durability guarantees that once committed, the change survives a crash, typically via write-ahead logging and fsync, so a power failure after commit doesn't lose the transaction."
    },
    {
      "q": "Define dirty read, non-repeatable read, and phantom read, and map each to the isolation level that prevents it.",
      "a": "A dirty read sees another transaction's uncommitted changes, prevented at READ COMMITTED and above. A non-repeatable read is when re-reading the same row returns different committed values because another transaction updated and committed in between, prevented at REPEATABLE READ. A phantom read is when re-running a range query returns new rows that another transaction inserted and committed, prevented at SERIALIZABLE (or in some engines via REPEATABLE READ with gap/next-key locks). Higher isolation removes more anomalies but reduces concurrency, which is the core trade-off."
    },
    {
      "q": "How do the four standard isolation levels trade off correctness against concurrency, and which is typically the default?",
      "a": "READ UNCOMMITTED allows dirty reads and is rarely used; READ COMMITTED prevents dirty reads but allows non-repeatable and phantom reads; REPEATABLE READ also prevents non-repeatable reads; SERIALIZABLE prevents all three anomalies by making transactions appear to run one at a time. Higher levels mean more locking or more validation/aborts and thus lower throughput and more contention. Most databases default to READ COMMITTED (PostgreSQL, Oracle, SQL Server), while MySQL/InnoDB defaults to REPEATABLE READ, so portable code shouldn't assume a level."
    },
    {
      "q": "Explain MVCC and how snapshot-based isolation differs from pure lock-based isolation.",
      "a": "Multi-Version Concurrency Control keeps multiple versions of a row so readers see a consistent snapshot as of their transaction/statement start without blocking writers, and writers don't block readers, which is why 'readers don't block writers' holds in Postgres and InnoDB. This contrasts with pure two-phase locking where reads take shared locks that block writes. The catch is write-write conflicts still need handling: under snapshot isolation you can get serialization anomalies (write skew) that REPEATABLE READ won't catch, which is why Postgres offers SERIALIZABLE Snapshot Isolation that detects and aborts such conflicts."
    },
    {
      "q": "What is a deadlock, how do databases handle it, and how do you minimize deadlocks in application code?",
      "a": "A deadlock occurs when two transactions each hold a lock the other needs, forming a cycle; the database's deadlock detector picks a victim and aborts it with a deadlock error, expecting the application to retry. To minimize them, acquire locks in a consistent global order across all code paths, keep transactions short and narrow, use the lowest isolation level that's correct, and avoid user-think-time inside a transaction. For the inevitable residual cases, wrap the transaction in a bounded retry with backoff, since deadlocks are a normal, transient condition rather than a bug to eliminate entirely."
    },
    {
      "q": "Compare optimistic and pessimistic concurrency control at the database level and how lost updates happen.",
      "a": "A lost update happens when two transactions read the same row, both modify it, and the second write overwrites the first without seeing it, e.g. two users editing the same record. Pessimistic control prevents it by locking the row at read time (SELECT ... FOR UPDATE), serializing the writers at the cost of held locks and reduced concurrency. Optimistic control lets both read freely and detects the conflict at commit via a version/timestamp check, aborting the loser to retry, which scales better under low contention. The choice hinges on conflict probability: pessimistic for hot contended rows, optimistic for mostly-independent updates."
    },
    {
      "q": "What does it actually mean to set a transaction's isolation level, and why might the level you ask for behave differently across databases?",
      "a": "Setting the isolation level configures the visibility/locking rules the engine applies for that transaction, but the SQL standard defines levels by which anomalies they must prevent, not by implementation, so engines satisfy them differently. For instance, Oracle and Postgres implement REPEATABLE READ via snapshots and don't take read locks, while older MySQL/InnoDB uses next-key locking; some engines silently provide stronger guarantees than requested. The practical implication is to test concurrency behavior on your actual database, never assume SERIALIZABLE is free, and remember a lower-than-needed level can introduce subtle anomalies like write skew that only appear under load."
    }
  ],
  "4.4": [
    {
      "q": "How do you actually size a HikariCP pool, and why does a bigger pool usually make latency worse?",
      "a": "Start from the database's capacity, not the app's request rate: total connections across all app instances must stay well under the DB's max_connections, and the throughput-optimal size is small — roughly cores*2 plus effective spindles — because the DB can only truly run that many queries in parallel. A pool of 100 just means 90 queries queue inside Postgres fighting for cores, locks, and cache, adding context-switching and tail latency while throughput flatlines or drops. The senior move is to treat the pool as a concurrency limiter that protects the DB, size minIdle == maxPoolSize to avoid churn, and scale read load with replicas rather than a fatter pool."
    },
    {
      "q": "Requests are timing out waiting for a connection from the pool. How do you tell pool exhaustion from a slow database, and find the cause?",
      "a": "Pool exhaustion shows as connectionTimeout exceptions and a pending-threads metric climbing while active connections sit at max; a slow DB shows as long query times with the pool not necessarily maxed. The most common root cause is a connection held across a slow external call — a thread borrows a connection, then makes an HTTP/RPC call, pinning the connection for the whole round trip and starving everyone else. Other causes are leaks (use leakDetectionThreshold to log stacks of connections held too long), missing transaction boundaries, and N+1 query storms; the fix is to never hold a connection across non-DB I/O and to keep transactions short."
    },
    {
      "q": "Async read replicas introduce replication lag. How do you handle read-your-writes so a user doesn't see stale data after their own update?",
      "a": "The hazard is routing a read to a lagging replica right after a write to the primary, so the user's own change appears to have vanished. Standard fixes: route reads from the same request/session that just wrote to the primary for a short window (sticky-to-primary after write), or pass a write LSN/version forward and only read from a replica that has caught up to it. Coarser options are reading critical paths always from the primary and only offloading clearly tolerant reads (analytics, search, lists) to replicas — the real skill is classifying each read by its staleness tolerance rather than blindly sending everything to replicas."
    },
    {
      "q": "Sync vs async replication — what's the trade-off, and what's the availability trap with naive synchronous replication?",
      "a": "Async replication acks the write as soon as the primary commits, giving low write latency but a non-zero RPO (committed data can be lost on primary failure before it ships). Synchronous replication waits for a replica to confirm, giving zero data loss but higher write latency and a dangerous failure mode: if the one synchronous replica goes down, naive configs block all writes, so you've coupled your write availability to the weakest replica. The production answer is quorum/semi-sync with multiple candidates (e.g. wait for any one of N), so a single replica outage degrades rather than halts writes."
    },
    {
      "q": "You're sharding a table. How do you choose the shard key, and why is getting it wrong so painful?",
      "a": "A good shard key spreads load evenly (high cardinality, no hotspots), matches your dominant access pattern so most queries hit a single shard, and is stable so a row doesn't have to migrate. Choosing a low-cardinality or monotonically increasing key (like a timestamp or sequential id) creates hot shards and write hotspots; choosing one that doesn't align with queries forces scatter-gather across all shards. It's painful because the key is baked into routing and physical placement — changing it later means a full data migration and re-routing, so this is a one-way door you must model carefully before committing."
    },
    {
      "q": "Why is hash(key) % N routing fragile, and how does consistent hashing fix it?",
      "a": "With modulo-N routing, changing the shard count N remaps almost every key to a different shard, forcing a massive data reshuffle and cache invalidation just to add one node. Consistent hashing places shards and keys on a ring so adding/removing a node only moves the keys in that node's arc — roughly 1/N of the data — instead of nearly all of it. Virtual nodes (multiple ring positions per physical shard) smooth out uneven distribution and make rebalancing finer-grained, which is why production sharding and distributed caches use it."
    },
    {
      "q": "What should you exhaust before sharding, and what do you genuinely lose once you shard?",
      "a": "Sharding is the last resort: first exhaust vertical scaling, indexing and query tuning, read replicas for read load, caching, and table partitioning, which buys most of the operational benefits (pruning, retention, maintenance) without the distributed-systems tax. Once you shard you lose cross-shard JOINs and single-node transactions — queries spanning shards become scatter-gather with application-side aggregation, and atomicity across shards now needs sagas or 2PC. You also lose easy global uniqueness and foreign keys, so sharding is justified only when a single primary genuinely can't absorb the write throughput or data volume, not merely for read scaling."
    }
  ],
  "4.5": [
    {
      "q": "What is the difference between a Statement and a PreparedStatement, and why does it matter?",
      "a": "A Statement sends raw SQL as a string, so building queries by concatenating user input opens you to SQL injection (e.g. an input of ' OR '1'='1 rewrites the query). A PreparedStatement is precompiled with ? placeholders that you bind via setString/setInt etc.; the driver sends the parameters separately from the SQL, so injected text is treated as data, never as SQL -- it is the primary defense against SQL injection. PreparedStatement is also faster when the same query runs many times because the database can reuse the parsed/planned statement. Always prefer PreparedStatement for any query involving variables."
    },
    {
      "q": "Walk through the core JDBC flow for running a query.",
      "a": "Obtain a Connection (from a DataSource/pool in real apps, or DriverManager in demos); create a PreparedStatement with your SQL; bind parameters; call executeQuery() for a SELECT (returns a ResultSet) or executeUpdate() for INSERT/UPDATE/DELETE (returns the affected-row count); iterate the ResultSet with while(rs.next()) reading columns by name or index; and close everything. Using try-with-resources on the Connection, Statement and ResultSet guarantees they are closed even on exception, which prevents connection leaks."
    },
    {
      "q": "How do you run several statements as one atomic transaction in JDBC?",
      "a": "Turn off autocommit with connection.setAutoCommit(false), execute the statements, then call connection.commit() on success or connection.rollback() in a catch block on failure (and restore autocommit / close in finally or via try-with-resources). By default JDBC is in autocommit mode, committing after every statement; disabling it lets you group multiple changes so they all succeed or all roll back together -- essential for correctness when, say, debiting one account and crediting another."
    },
    {
      "q": "What is JDBC batch processing and when do you use it?",
      "a": "Batching groups many statements and sends them to the database in one (or few) round-trips using addBatch() then executeBatch(), instead of executing each individually. It is far faster for bulk inserts/updates because it amortizes network latency and lets the driver/DB optimize the writes; the win grows with row count. You typically also run a batch inside a single transaction (autocommit off) and flush in chunks (e.g. every 1000 rows) to bound memory."
    },
    {
      "q": "Why do ORMs like Hibernate exist if JDBC already works?",
      "a": "Raw JDBC forces you to write boilerplate for every query: open/close resources, bind parameters, and hand-map each ResultSet row into objects, all while handling checked SQLExceptions -- tedious and error-prone at scale, and it leaks SQL throughout the code. ORMs automate the object-to-table mapping, generate SQL, manage the connection/transaction and a first-level cache, and provide lazy loading and dirty checking, so you work with objects instead of ResultSets. JDBC still runs underneath every ORM, and remains the right choice when you need maximum control or performance (Spring's JdbcTemplate is a thin, convenient wrapper over it)."
    },
    {
      "q": "In production, why use a DataSource/connection pool instead of DriverManager.getConnection?",
      "a": "Opening a physical database connection is expensive (TCP + auth + session setup), so doing it per request via DriverManager kills throughput and can exhaust the database's connection limit. A pooled DataSource (e.g. HikariCP) keeps a set of live connections and hands them out and returns them on close(), so 'getting a connection' is cheap and the total count is bounded and tunable. DriverManager is fine for demos and one-off scripts; real services always use a pooled DataSource."
    },
    {
      "q": "Explain the persistence context and dirty checking. How does Hibernate issue an UPDATE without you calling save()?",
      "a": "The persistence context (the EntityManager's first-level cache, transaction-scoped in Spring) tracks every managed entity and a snapshot of its loaded state. On flush — typically at transaction commit or before a query — Hibernate compares each managed entity to its snapshot and auto-generates UPDATEs for any that changed; that's dirty checking, and it's why mutating a managed entity inside a transaction persists with no explicit save call. The pitfalls are that a large persistence context makes flush slow (it snapshots and diffs everything) and that detached entities aren't tracked, so changes to them are silently lost until you merge."
    },
    {
      "q": "What causes LazyInitializationException, and why is fixing it with EAGER fetch or Open-Session-In-View the wrong answer?",
      "a": "It happens when you touch a lazy association after the persistence context that loaded the entity has closed — typically rendering a DTO/view outside the transaction — so there's no session left to run the SELECT. Switching the association to EAGER pollutes every query with joins you don't need (and can trigger cartesian explosions), while Open-Session-In-View keeps the session open through the web layer, hiding the problem but holding DB connections during view rendering and spraying lazy N+1 queries from the controller. The correct fix is to fetch exactly what the use case needs inside the transaction via JOIN FETCH, an @EntityGraph, or better a DTO projection, so the data is materialized before the session closes."
    },
    {
      "q": "Walk me through diagnosing and fixing an N+1 query problem in a real service.",
      "a": "N+1 is one query for a list of parents followed by one lazy query per parent for an association — easy to miss in code but obvious in the SQL log or as a latency spike that scales with row count. Detect it by enabling SQL logging (or asserting query counts in a test with something like datasource-proxy), then fix per situation: JOIN FETCH or @EntityGraph when you need the full entities, @BatchSize or subselect fetching to collapse the N selects into a few IN-list queries, and a DTO projection when you only need a few fields. The trade-offs: JOIN FETCH on multiple collections causes MultipleBagFetchException or a cartesian blowup, and JOIN FETCH with pagination silently paginates in memory — so DTO projections are usually the cleanest answer."
    },
    {
      "q": "Why does GenerationType.IDENTITY defeat JDBC batch inserts, and what do you use instead?",
      "a": "IDENTITY relies on a DB auto-increment column whose value is only known after the row is inserted, so Hibernate must execute each INSERT immediately to retrieve the generated id — it cannot defer and batch them, killing throughput on bulk inserts. SEQUENCE (with a pooled/hi-lo allocator) lets Hibernate fetch a block of ids up front, so it can queue many INSERTs and flush them as a JDBC batch. To actually get batching you must set hibernate.jdbc.batch_size, enable order_inserts/order_updates, use SEQUENCE, and on Postgres enable reWriteBatchedInserts at the JDBC layer to pipeline them — and for very large loads flush()+clear() periodically to bound the persistence context."
    },
    {
      "q": "When does the Hibernate second-level cache actually help, when does it hurt, and what breaks it?",
      "a": "The L2 cache stores entity state across sessions keyed by id, so it shines for read-mostly reference data accessed by primary key and lets you skip the DB on cache hits. It hurts for write-heavy or rarely-reread entities (cache maintenance and invalidation overhead with low hit rates) and in clustered apps where you need a distributed/invalidating provider or stale data appears across nodes. The big correctness trap is bulk HQL UPDATE/DELETE: those run as direct SQL and bypass the L2 cache, leaving stale entries, so you must evict the affected regions — and choosing the wrong concurrency strategy (e.g. NONSTRICT_READ_WRITE for data needing strong consistency) opens stale-read windows."
    },
    {
      "q": "What's the owning side of an association, what does mappedBy do, and what goes wrong without it?",
      "a": "The owning side is the one whose foreign key column actually drives the persisted relationship; Hibernate only looks at the owning side when deciding what FK to write. mappedBy names the field on the owning side and marks the other side as the inverse (read-only mapping), so the two sides describe one relationship instead of two. Omitting mappedBy on a bidirectional @OneToMany makes Hibernate treat each side independently and manage the relationship through a redundant join table plus extra UPDATE statements — so you always set the owning side (typically the @ManyToOne) for the change to persist, and keep both in-memory sides in sync with helper methods."
    },
    {
      "q": "How do you implement equals/hashCode and @Version correctly for an entity, and why do the naive versions bite you?",
      "a": "Don't base hashCode on a database-generated id, because a transient entity has a null id before persist and a different one after, so it changes hash buckets mid-Set and breaks collection membership; either use a business/natural key or a UUID assigned at construction, and make equals consistent with it. @Version adds optimistic locking: Hibernate stamps a version column and increments it on update, throwing OptimisticLockException if two transactions race on the same row, which you handle by retrying or surfacing a conflict to the user. The trade-off is that optimistic locking detects conflicts late (at commit) rather than preventing them, so it suits low-contention writes; high-contention rows may need a pessimistic lock instead."
    }
  ],
  "5.1": [
    {
      "q": "When would you scale vertically instead of horizontally, and what makes horizontal scaling harder?",
      "a": "Scale vertically first when the bottleneck is a single component that resists partitioning (a relational primary, an in-memory cache) and you're below the hardware ceiling; it needs no code changes. Horizontal scaling is harder because it demands a stateless tier (no in-memory sessions, locks, or local file state), a load balancer, and shared backing stores, and it surfaces distributed concerns like cache coherence and replication lag. In practice the limit of vertical scaling is the database, so you eventually combine both: scale the app tier out, and scale the data tier with replicas and sharding."
    },
    {
      "q": "A user adds an item to their cart, refreshes, and the cart is empty. What's the likely cause and the fix?",
      "a": "The app is stateful: session/cart data lives in one instance's heap, and the load balancer routed the refresh to a different instance behind the same DNS name. The cheap patch is sticky sessions (IP hash / cookie affinity), but that pins users to nodes and breaks rolling deploys and even rebalancing. The real fix is externalizing state to a shared store (Redis, the database) or a signed token, making every instance interchangeable so any node can serve any request."
    },
    {
      "q": "How do CAP and its practical cousin PACELC actually drive a design decision?",
      "a": "Since partitions are inevitable, CAP forces a choice during a partition: a CP store rejects/blocks to avoid stale or divergent data (etcd, ZooKeeper, HBase) while an AP store stays available and serves possibly stale data (Cassandra, DynamoDB). PACELC adds the steady-state trade-off: Else, when there's no partition, you still choose Latency vs Consistency, which is why many AP systems offer tunable quorums. The decision is per-data-class, not per-system: account balances want CP, while a product catalog or feed tolerates AP/eventual consistency."
    },
    {
      "q": "Why prefer Least Connections over Round Robin, and when do sticky sessions hurt you?",
      "a": "Round Robin assumes uniform request cost; with long-lived or heterogeneous requests it overloads slow backends while idle ones sit empty, so Least Connections (or latency-aware EWMA) balances real load better. Sticky sessions concentrate a heavy user on one node, defeat even distribution, and prevent draining a node cleanly during deploys. They also create correctness cliffs: if the sticky node dies, those users lose state, which is why externalizing state and dropping stickiness is the more robust path."
    },
    {
      "q": "You add read replicas and a user reports they don't see their own write. What's happening and how do you fix it?",
      "a": "This is the read-your-writes anomaly caused by asynchronous replication lag: the write committed on the primary but the read hit a replica that's milliseconds-to-seconds behind. Fixes include routing a user's reads to the primary for a short window after their write (sticky-to-primary), reading from the primary inside the same logical operation, or using replica lag-aware routing that only serves replicas caught up past the write's LSN/GTID. Reporting and non-critical reads can still hit replicas freely."
    },
    {
      "q": "What makes a bad shard key, and why is resharding so painful?",
      "a": "A bad shard key is low-cardinality or monotonically increasing (auto-increment IDs, timestamps): all new writes funnel to one shard, creating a hot spot, while other shards sit idle. It also breaks down if common queries don't include the key, forcing scatter-gather across every shard. Resharding hurts because moving a key's data invalidates routing for in-flight reads/writes and breaks consistent-hash assumptions; the production mitigation is to over-provision logical shards up front (e.g., 1024 virtual shards mapped onto fewer physical nodes) so rebalancing moves whole virtual shards without rehashing keys."
    }
  ],
  "5.2": [
    {
      "q": "Compare cache-aside, read-through, write-through, and write-behind. Which is the safe default and why?",
      "a": "Cache-aside puts the app in control — read cache, on miss load from DB and populate — and is the safe, common default because the cache failing just degrades to DB hits rather than breaking writes. Read/write-through delegate DB access to the cache layer (simpler call sites but the cache becomes a hard dependency), and write-behind acks the write to cache then flushes to the DB asynchronously, which absorbs write bursts but risks data loss if the cache dies before the flush. On writes the senior rule is to delete the key rather than update it, because updating races with concurrent reads and can leave a stale value cached longer than the DB truth."
    },
    {
      "q": "Define cache stampede, penetration, and avalanche, and give the mitigation for each — they're different problems.",
      "a": "Stampede (a.k.a. breakdown / dogpile): a hot key expires and thousands of concurrent requests all miss and hammer the DB at once — mitigate with a mutex/single-flight so one request rebuilds while others wait, plus probabilistic early recomputation. Penetration: requests for keys that don't exist in cache or DB bypass the cache entirely on every call — mitigate by caching the negative result (a short-TTL null marker) and/or a Bloom filter to reject known-absent keys. Avalanche: a huge number of keys expire simultaneously (e.g. all set to the same TTL, or the whole cache restarts), flooding the DB — mitigate by jittering TTLs and warming/protecting the origin with request coalescing."
    },
    {
      "q": "What's the dual-write problem between a cache and the database, and what's the correct write ordering?",
      "a": "Writing to both the DB and the cache is two non-atomic operations, so a crash or race between them leaves them inconsistent — the textbook failure is updating the cache then having the DB write fail, leaving a value cached that was never persisted. The safer pattern is write the DB first, then delete (not update) the cache key, so a failure after the DB write just yields a cache miss that reloads truth. Even this has a race window, so for strong needs use a versioned/generation key or event-driven invalidation via CDC/outbox, where the cache is invalidated off the committed DB change log rather than by the application doing a best-effort second write."
    },
    {
      "q": "A user updates their profile and must see the change immediately, but you use cache-aside with TTL. What's the risk and the fix?",
      "a": "With cache-aside the user can re-read before invalidation propagates and see their old profile — a read-after-write inconsistency, made worse if a stale read repopulates the cache right after you deleted the key. Fix it by invalidating (deleting) the key on write so the next read reloads from DB, and for the immediate-consistency requirement, read the writer's own session from the source of truth for a short window or write-through their own cache entry. The subtle trap is a near/in-process cache layer: deleting the Redis key doesn't evict copies sitting in each app instance's local cache, so those need their own TTL or a pub/sub invalidation broadcast."
    },
    {
      "q": "What is a hot key, what damage does it do, and how do you mitigate it in Redis Cluster?",
      "a": "A hot key is a single key getting a disproportionate share of traffic (a celebrity user, a flash-sale item), which pins all that load onto the one shard owning it and saturates a single node while the rest of the cluster idles. Mitigations: replicate the value across multiple keys/shards (key suffixing) and pick one at read time to spread load, add a short-TTL local/near cache in front of Redis so most reads never reach it, and use read replicas for the hot shard. The point is that a hot key breaks the horizontal-scaling assumption, so you fan the traffic out across nodes or absorb it locally rather than scaling the cluster."
    },
    {
      "q": "Walk me through Redlock and its criticisms. When would you actually use it?",
      "a": "Redlock acquires a lock on a majority of independent Redis masters with a TTL, intended to give distributed mutual exclusion without a single point of failure. The well-known critique (Kleppmann) is that it relies on bounded clocks and assumes a process won't pause: a GC pause or network delay can let the lock expire and be granted to another holder while the first still believes it holds it, so two clients act at once — and Redis isn't a consistency-grounded system for this. The pragmatic stance: Redlock is fine for efficiency (avoiding duplicated work) where occasional double-execution is merely wasteful, but for correctness-critical mutual exclusion you need a fencing token validated by the protected resource, or a consensus store like ZooKeeper/etcd."
    },
    {
      "q": "How do CDN cache headers work end to end — max-age vs s-maxage, stale-while-revalidate — and why are content-hashed filenames the best invalidation strategy?",
      "a": "Cache-Control max-age governs browser caching while s-maxage overrides it for shared/CDN caches, letting you cache aggressively at the edge but conservatively in the browser; stale-while-revalidate serves a slightly stale response instantly while refreshing in the background, and stale-if-error serves stale content when the origin is down, both protecting tail latency and availability. The cleanest invalidation is content-hashed filenames (app.a1b2c3.js): the URL changes when the bytes change, so you can cache immutably forever and never purge — a new deploy simply references new URLs. This sidesteps the slow, eventually-consistent nature of CDN purges; the classic security incident is caching an authenticated/personalized response at a shared edge (e.g. via Vary: Cookie misuse) and serving one user's data to another."
    }
  ],
  "5.3": [
    {
      "q": "Which HTTP methods are idempotent and which are safe, and where do teams get PATCH and DELETE wrong?",
      "a": "Safe methods (GET, HEAD, OPTIONS) have no side effects; idempotent methods (GET, HEAD, PUT, DELETE, plus the safe ones) yield the same server state when repeated. POST is neither. The PATCH gotcha is that it's only idempotent if it expresses an absolute desired state (set quantity to 5), not a relative delta (increment by 1), which double-applies on retry. DELETE is idempotent in effect even though the second call returns 404 — that's fine, the resource is still gone."
    },
    {
      "q": "Walk through implementing an idempotency key for POST /payments, including the concurrency edge case.",
      "a": "The client generates one UUID per intent and sends it as Idempotency-Key, reusing it across retries; the server persists key -> result with a TTL (24-48h) so a retry returns the original response instead of charging again. The subtle bug is concurrent in-flight retries: two requests with the same key arrive before the first completes. You guard this by inserting the key with a unique constraint and an in-progress state before doing work — the second insert fails or blocks, so it waits for and returns the first result rather than processing in parallel. You must also key the stored result to the request fingerprint to reject a reused key with a different payload (HTTP 422)."
    },
    {
      "q": "When would you choose gRPC over REST, and what does gRPC cost you?",
      "a": "gRPC shines for internal service-to-service calls: Protobuf gives a strict contract and compact binary framing, HTTP/2 multiplexing reduces latency, and it natively supports streaming and bidirectional calls. The costs are real: it's awkward from browsers (needs grpc-web/a proxy), it's not human-readable so debugging needs tooling, and HTTP/2 plus client-side load balancing complicates L7 proxies and observability. The common pattern is gRPC east-west between services and REST/JSON north-south at the public edge."
    },
    {
      "q": "Your delivery is at-least-once and a consumer triggers a non-idempotent side effect. How do you make the endpoint safe?",
      "a": "At-least-once means duplicates are guaranteed on retries, so the receiver must dedupe rather than assume single delivery. Carry a stable business/event ID and record processed IDs (a dedup table or a unique constraint on the effect itself), so a replay becomes a no-op. Where possible make the operation naturally idempotent — upserts keyed by the event ID, or PUT-style absolute state — and wrap the side effect and the dedup record in one transaction (or the outbox/inbox pattern) so you never apply the effect without recording it."
    },
    {
      "q": "What status codes distinguish 'we rejected your input' situations, and why does it matter operationally?",
      "a": "400 is malformed/syntactically invalid input; 401 is unauthenticated (no/invalid credentials, return WWW-Authenticate); 403 is authenticated but not authorized; 404 hides existence; 409 is a conflict like an optimistic-lock/version clash or duplicate key; 422 is well-formed but violates a business rule; 429 is rate-limited (return Retry-After). It matters because clients branch on these: 401 triggers token refresh and retry, 403 should not retry, 409 means refetch-and-merge, and 429/503 with Retry-After drives backoff — collapsing everything into 400/500 makes clients retry the wrong things."
    },
    {
      "q": "How do you evolve an API without breaking clients, and what counts as a breaking change?",
      "a": "Breaking changes are removing or renaming fields, tightening types, making optional fields required, changing URL structure, or altering the error envelope; safe changes are additive — new optional request fields, new response fields, new endpoints. Favor backward-compatible evolution under one version (tolerant readers, sensible defaults) and reserve a new major version (URL /v2 or media-type versioning) for unavoidable breaks. Run versions in parallel with a deprecation window (6-12 months) signaled via Deprecation/Sunset headers, and never silently change semantics within a version."
    }
  ],
  "5.4": [
    {
      "q": "Design a URL shortener. What's your ID-generation strategy and why?",
      "a": "The core choice is base62-encoding a unique ID. Hashing the URL risks collisions and leaks that two users shortened the same link; a single auto-increment counter is a bottleneck and enumerable. My default: pre-allocated ID ranges handed to each app instance from a coordination store (or a snowflake-style generator), base62-encoded, giving 7 characters for ~3.5 trillion URLs with no per-request coordination. I'd mention 301-vs-302 explicitly: 302 keeps redirects hitting our servers so we can count clicks; 301 is cached by browsers and loses analytics."
    },
    {
      "q": "Token bucket vs sliding window for a distributed rate limiter — how do you choose, and how do you make it atomic across instances?",
      "a": "Token bucket allows controlled bursts (bucket capacity) with a steady refill rate — right for API quotas; a sliding-window counter smooths the boundary-burst problem of fixed windows at minimal memory — right for strict rates. Distributed enforcement lands in Redis, and the read-modify-write must be atomic, so the whole check-and-decrement runs as a Lua script (or Redis functions); otherwise two gateways racing on the same key both admit the request. I'd also say what happens when Redis is down: fail open with local fallback buckets for availability, fail closed for cost-sensitive endpoints."
    },
    {
      "q": "In a news feed, explain fan-out-on-write vs fan-out-on-read and how you handle the celebrity problem.",
      "a": "Fan-out-on-write pushes a new post into every follower's cached timeline at post time — reads are cheap, writes explode with follower count. Fan-out-on-read composes the timeline at request time — writes are cheap, reads expensive. A celebrity with 100M followers makes pure write-fan-out unaffordable, so the standard answer is hybrid: fan out normally for regular users, but for accounts above a follower threshold, skip fan-out and merge their recent posts in at read time. That sentence — 'hybrid, threshold on follower count' — is what interviewers are listening for."
    },
    {
      "q": "How do you guarantee message ordering and delivery states in a chat system?",
      "a": "Global ordering is unnecessary — per-conversation ordering is the requirement. I'd assign each message a server-side monotonically-increasing sequence per conversation (not client timestamps, which skew), have clients render by sequence and detect gaps to trigger backfill. Delivery states are event transitions: sent (server persisted), delivered (recipient device acked), read (recipient viewed) — each an ack message flowing back through the connection service. Offline users get messages queued and a push notification; on reconnect the client syncs from its last known sequence."
    },
    {
      "q": "Your notification service must not send duplicate pushes even when providers time out. How?",
      "a": "Timeouts are ambiguous — the provider may have sent it — so exactly-once delivery to a phone is impossible; the goal is exactly-once-effect. Each logical notification gets a stable idempotency key (say, userId + eventId + channel); before dispatch the worker records the attempt, and the provider call includes the key where supported (APNs collapse-id, email provider idempotency keys). Retries with backoff go to the same key, and a dedup store suppresses re-sends after confirmed success. Failures past the retry budget land in a DLQ for inspection rather than being dropped."
    },
    {
      "q": "Design a distributed job scheduler — how do you ensure a job fires exactly once when you run multiple scheduler nodes?",
      "a": "You can't get exactly-once firing plus perfect availability, so I aim for at-least-once triggering with idempotent execution. Two workable shapes: DB-backed polling where nodes claim due jobs with SELECT ... FOR UPDATE SKIP LOCKED (the claim is the mutual exclusion), or partitioning the job space so each scheduler owns a shard, with leader election only for rebalancing. Every execution writes a run record keyed by jobId+scheduledTime, so a duplicate trigger becomes a no-op. I'd close with misfire policy: on recovery, decide per-job whether to fire-immediately, skip, or coalesce missed runs."
    },
    {
      "q": "An interviewer says 'your design melts at 10x traffic' — what's your general framework for answering?",
      "a": "First find the actual bottleneck rather than guessing: which component saturates first at 10x — DB writes, a hot cache key, fan-out amplification, connection counts? Then apply the matching pattern: read-heavy -> cache + replicas; write bursts -> queue and absorb; hot key/user -> shard or special-case it; fan-out explosion -> move from write-time to read-time work (or hybrid); state on app servers -> make them stateless and scale horizontally. Naming the bottleneck out loud before proposing a fix is precisely the senior behaviour the question is testing."
    }
  ],
  "6.1": [
    {
      "q": "A team wants to split a young product into microservices. What pushback and guidance would you give?",
      "a": "For a small team and an unproven domain, microservices usually impose distributed-systems tax — network failures, eventual consistency, distributed tracing, and per-service CI/CD — without the payoff, so I'd recommend a well-modularized monolith with clear bounded contexts first. The legitimate triggers are organizational (Conway's Law: many teams needing independent release cadence) and technical (components with very different scaling or availability profiles). Get the module boundaries right in the monolith, then extract along those seams with the strangler-fig approach rather than a big-bang rewrite."
    },
    {
      "q": "Explain circuit breaker states and the specific failure it prevents.",
      "a": "It prevents cascading failure: when a downstream is slow/down, callers pile up threads waiting on timeouts until the caller itself exhausts its pool and falls over, taking its own callers with it. CLOSED passes calls through while counting failures over a sliding window; OPEN fast-fails without a network call once a failure-rate threshold trips; after a cooldown it goes HALF-OPEN and lets a few probes through, closing on success or reopening on failure. The breaker must be paired with sane timeouts (the original cause), bulkheads, and a fallback for graceful degradation — a breaker with infinite timeouts still hangs."
    },
    {
      "q": "How do you handle a request that needs data from five services without killing tail latency?",
      "a": "Synchronous fan-out chains multiply latency and failure probability, so aggregate behind an API gateway or a BFF and issue the calls in parallel rather than sequentially, with per-call timeouts and breakers. Better still, avoid the fan-out at request time: precompute a read model (CQRS) updated asynchronously from each service's events so the read is a single local lookup. Where you must call live, degrade gracefully — return partial responses with the non-critical services' data omitted rather than failing the whole request when one slow dependency times out."
    },
    {
      "q": "Each microservice owns its data, but a feature needs a join across three services. How do you design it?",
      "a": "You don't do cross-service joins or reach into another service's database — that recreates the monolith's coupling without its transaction guarantees. Either compose at the edge (call each service and join in a BFF, accepting latency) or, for hot read paths, build a denormalized read model/materialized view populated asynchronously from the services' events, accepting eventual consistency. Choose ownership deliberately: the data lives with the service that's the source of truth, and everyone else gets a replicated, read-optimized projection."
    },
    {
      "q": "What's the difference between liveness and readiness checks in a service mesh / orchestrator, and why conflate them at your peril?",
      "a": "Readiness answers 'can I serve traffic right now' — failing it pulls the instance out of the load-balancer pool without killing it (used during warmup, lost DB connection, or shedding load). Liveness answers 'is the process wedged' — failing it restarts the container. Conflating them is dangerous: if your liveness probe checks a downstream dependency, an outage in that dependency makes every replica fail liveness and get killed in a restart storm, turning a partial degradation into a total outage. Liveness should test only the process; dependency health belongs in readiness."
    },
    {
      "q": "How do you migrate a monolith to microservices with the strangler-fig pattern, and which piece do you extract first?",
      "a": "Put a routing layer (API gateway/reverse proxy) in front of the monolith so it can selectively divert specific routes to new services while the monolith keeps serving the rest, then peel off one capability at a time until the monolith is decommissioned. Extract a high-change or high-scale, loosely-coupled component first to get value early and prove the seam. The hard part is data: the new service needs its own store, so you often run a transition period with change-data-capture or dual writes to keep the old and new data in sync until the cutover is complete."
    }
  ],
  "6.2": [
    {
      "q": "How are Kafka partitions related to ordering and parallelism, and what's the trap when you raise partition count?",
      "a": "Ordering is guaranteed only within a partition, and records with the same key hash to the same partition, so per-key ordering holds while global ordering does not. Parallelism is capped by partition count: each partition is consumed by at most one consumer in a group, so consumers beyond the partition count sit idle. The trap is increasing partitions later: hash(key) % partitions changes, so a given key starts landing in a different partition, breaking the per-key ordering you relied on — size partitions up front for peak parallelism."
    },
    {
      "q": "A consumer group rebalance is causing duplicate processing and pauses. What's going on and how do you reduce the pain?",
      "a": "When a consumer joins/leaves or times out, the group coordinator reassigns partitions; with the classic eager protocol every consumer stops the world and revokes all partitions, and any records processed but not yet committed get reprocessed by the new owner (at-least-once). Reduce it by committing offsets promptly after processing, tuning max.poll.interval.ms / session.timeout.ms so slow batches don't get the consumer evicted mid-work, and adopting cooperative-sticky assignment so only moved partitions pause. Pairing this with idempotent processing makes the unavoidable duplicates harmless."
    },
    {
      "q": "What does acks=all plus enable.idempotence actually guarantee on the producer, and what doesn't it cover?",
      "a": "acks=all makes the leader wait for all in-sync replicas before acknowledging, so an acknowledged write survives a broker failure (combined with min.insync.replicas to avoid acking when too few replicas are in sync). enable.idempotence adds a producer ID and per-partition sequence numbers so broker-side retries don't create duplicates, giving exactly-once delivery from producer to broker. It does not cover the consumer side or the produce-after-process flow — for end-to-end exactly-once across read-process-write you need Kafka transactions (transactional.id, read_committed) or, more commonly, at-least-once plus an idempotent consumer."
    },
    {
      "q": "Compare at-least-once with exactly-once in Kafka for a payment-charging consumer. Which do you pick?",
      "a": "At-least-once commits the offset only after successful processing, so a crash between processing and commit replays the record — simple and high-throughput but duplicates are possible. Exactly-once via transactions ties the consume, the produce, and the offset commit into one atomic unit with read_committed downstream, eliminating duplicates at the cost of throughput and operational complexity, and it only holds within Kafka (a charge to an external payment gateway isn't transactional with Kafka). For real payments I'd use at-least-once plus an idempotency key on the charge so replays are no-ops, which is simpler and also protects the external system."
    },
    {
      "q": "One poison message keeps failing and your consumer is stuck. How do you keep the partition moving?",
      "a": "Because a partition is an ordered log consumed in order, refusing to advance past a permanently-failing record blocks every later record on that partition (head-of-line blocking). Distinguish retryable from non-retryable errors: retry transient failures with backoff (Spring Kafka retry/non-blocking retry topics), but route permanently-failing records to a dead-letter topic, acknowledge, and continue. A separate process or human handles the DLT — alert, inspect, fix, optionally replay — so one bad message never halts the stream."
    },
    {
      "q": "How does Kafka's retention enable replay, and what are the production caveats?",
      "a": "Kafka is a durable, append-only log retained by time or size (or compacted by key), so a consumer group can reset its offsets (--to-earliest, by timestamp, or to a specific offset) and reprocess history — useful for backfilling a new service, rebuilding a read model, or recovering from a consumer bug. The caveats: replay re-emits all side effects, so downstream must be idempotent or you'll double-charge/double-email; resetting offsets affects the whole group, so coordinate; and retention must actually be long enough — if it expired, the data is gone, and compacted topics only keep the latest value per key."
    }
  ],
  "6.3": [
    {
      "q": "Why use a saga instead of two-phase commit across microservices?",
      "a": "2PC needs a coordinator holding locks across all participants until commit; it's blocking (a slow or crashed participant stalls everyone), it hurts availability, and most modern datastores and message brokers don't support XA well. A saga replaces one distributed ACID transaction with a sequence of local transactions, each committing independently and publishing an event, with compensating transactions to undo earlier steps on failure. The trade-off is giving up isolation and atomicity for availability and scalability — the system is only eventually consistent, and intermediate states are visible."
    },
    {
      "q": "Choreography vs orchestration sagas: how do you choose?",
      "a": "Choreography is event-driven with no central brain — each service reacts to events and emits its own — giving loose coupling but scattering the workflow across services, which makes the end-to-end flow hard to see, test, and reason about as steps grow (and risks cyclic event dependencies). Orchestration puts one coordinator that explicitly drives each step and handles failures, giving clear visibility and centralized compensation logic at the cost of more coupling and a component that must itself be resilient and stateful. Rule of thumb: choreography for simple 2-3 step flows, orchestration for complex, long-running, multi-step processes."
    },
    {
      "q": "Why is compensation not the same as a rollback, and what makes a good compensating action?",
      "a": "A rollback discards uncommitted work; compensation runs after a local transaction already committed and its effects became visible, so it's a new business action that semantically undoes the prior one (refund a charge, release a reservation). That means there's a window of inconsistency, other actors may have observed or acted on the intermediate state, and some actions are simply uncompensatable (a sent email, a shipped package). Good compensations are idempotent and commutative-safe, and you often design forward — reserve-then-confirm or use pending states — so the visible intermediate state is benign."
    },
    {
      "q": "You save an order to the DB and publish OrderCreated to Kafka. How do you avoid the dual-write problem?",
      "a": "Writing to two systems isn't atomic: if the DB commits and the publish fails you have an order with no event; if you publish first and then crash you have an event with no order. The transactional outbox fixes this — write the event into an outbox table in the same DB transaction as the business data, then a separate relay (a poller or Debezium reading the WAL via CDC) publishes outbox rows to Kafka and marks them sent. The relay is at-least-once, so consumers must dedupe, but you can never get a published event without a committed transaction or vice versa."
    },
    {
      "q": "How do you make a saga safe against the duplicate and out-of-order messages that messaging inevitably produces?",
      "a": "Because the underlying transport is at-least-once, every saga step and every compensation must be idempotent — guard each with the saga ID plus step ID so a redelivered command is a no-op rather than a second charge. Persist saga state (often via an inbox table or a state machine) so you can tell which steps already ran and resume after a crash exactly where you left off. For ordering, don't assume arrival order — carry correlation IDs and design steps to tolerate retries and late messages rather than relying on the broker for strict cross-step ordering."
    },
    {
      "q": "What happens when a compensating transaction itself fails, and how do you design for it?",
      "a": "Compensation failure is the genuinely hard case — you can't just give up, because the system is left half-completed and inconsistent. The standard approach is to make compensations retryable with backoff and idempotency so transient failures self-heal, persist the saga's progress so a recovering orchestrator knows what still needs undoing, and escalate to a dead-letter/manual-intervention queue with alerting when retries are exhausted. You also minimize the blast radius by ordering steps so the hardest-to-compensate actions run last and the easily-reversible ones run first (semantic lock / pivot-step design)."
    }
  ],
  "6.4": [
    {
      "q": "When would you choose RabbitMQ over Kafka, and when is that the wrong call?",
      "a": "Reach for RabbitMQ when you need rich per-message routing, competing-consumer work distribution, low-latency RPC, or per-message acks and priorities — classic task-queue and command workloads. Choose Kafka when you need a durable replayable log, high-throughput event streaming, ordered partitioned retention, or multiple independent consumer groups re-reading history. The wrong call is treating RabbitMQ as an event store: by default a message is gone once acked, there's no offset to rewind to, and reprocessing means you must have persisted it yourself."
    },
    {
      "q": "Walk me through publisher confirms and consumer acks. What actually guarantees a message isn't lost end to end?",
      "a": "On the producer side you need publisher confirms (channel in confirm mode) plus durable exchanges/queues and persistent messages, so the broker only acks once the message is safely written; without confirms a publish that the broker never received looks successful. On the consumer side use manual acks and ack only after the work commits, so a crash mid-processing redelivers rather than loses. The pitfall is autoack (ack-on-deliver), which drops in-flight messages on consumer crash, and forgetting that persistent-but-unconfirmed publishes can still be lost in a broker fsync window."
    },
    {
      "q": "How do dead-letter exchanges work, and how do you build retry-with-backoff without a poison-message loop?",
      "a": "A queue with x-dead-letter-exchange routes messages there when they're rejected/nacked with requeue=false, TTL-expire, or hit a length limit. The classic retry pattern is a delay queue with a per-message or per-queue TTL and no consumer, whose DLX points back at the work queue, so expiry re-delivers after the backoff. The trap is infinite redelivery: if you requeue=true on a permanently bad message it loops forever, so you must track an x-death/attempt count in headers and route to a parking/DLQ after N tries for human inspection."
    },
    {
      "q": "What does prefetch (QoS) control, and how does it interact with throughput and fairness?",
      "a": "basic.qos prefetch caps the number of unacked messages the broker pushes to a consumer before it must ack. Too low (e.g. 1) starves throughput on fast networks because the consumer waits round-trips between messages; too high lets one greedy consumer hoard the queue and defeats fair dispatch, and inflates memory/redelivery on crash. The senior answer is to size prefetch to roughly the in-flight work a consumer can handle within the round-trip — small for slow, heavy tasks; larger for fast, cheap ones — and measure rather than guess."
    },
    {
      "q": "How do you reason about message ordering in RabbitMQ, and where does it break?",
      "a": "A single queue with a single consumer preserves publish order, but the moment you add competing consumers, prefetch, or requeue-on-failure, ordering is lost because a redelivered message can land behind newer ones. There's no partition-key concept like Kafka, so if you need per-entity ordering you must route all messages for that key to one queue and consume single-threaded, which sacrifices parallelism. Most teams design for idempotent, order-independent handlers instead of fighting the broker for global ordering."
    },
    {
      "q": "Quorum queues vs classic mirrored queues — what changed and why does it matter for production?",
      "a": "Classic mirrored queues replicated via a leader/mirror scheme that was prone to split-brain, slow sync, and message loss during partitions, and they're now deprecated. Quorum queues use a Raft consensus log for replication, giving predictable failover, no message loss on a confirmed write with a majority, and clearer behavior under network partitions. The trade-off is higher per-message overhead and memory, and they don't support some classic features (e.g. message priorities historically), so you pick quorum for durability-critical queues and accept the cost."
    },
    {
      "q": "Your queue depth is climbing and the broker's memory alarm fires, blocking publishers. Walk me through diagnosis and mitigation.",
      "a": "Rising depth means consumption can't keep up with production: check consumer count, prefetch, and per-message processing time, and whether consumers are crashing/redelivering or blocked on a slow downstream. RabbitMQ's memory/disk high-watermark applies flow control and pauses publishers to protect itself, so the immediate lever is to scale out competing consumers, raise prefetch if it's starving them, and offload large payloads to object storage (publish a pointer). Long term, add lazy queues to page to disk, set queue length limits with a DLX so backlog can't grow unbounded, and alarm on queue depth and consumer-utilisation before the watermark triggers."
    }
  ],
  "7.1": [
    {
      "q": "Why does ordering of Dockerfile instructions matter, and how do you exploit layer caching for a Java build?",
      "a": "Each instruction is a cached layer keyed by its content and the previous layers; a change invalidates that layer and everything after it. So you copy and resolve dependencies before copying source — for Maven, COPY pom.xml then mvn dependency:go-offline, then COPY src — so editing code only busts the cheap source/compile layers while the expensive dependency layer stays cached. Putting COPY . . too early is the classic mistake: any file change re-downloads all dependencies, making every build slow."
    },
    {
      "q": "What does a multi-stage build buy you for a Spring Boot service beyond a smaller image?",
      "a": "The build stage uses a full JDK plus Maven/Gradle to compile, while the final stage starts from a slim JRE and COPY --from=builder pulls only the artifact — so the runtime image is far smaller and, crucially, contains no compiler, build tools, or source code, shrinking the attack surface. For Spring Boot you go further with jarmode=layertools (or Buildpacks) to split the fat jar into dependency, loader, snapshot, and application layers, so rebuilds only re-copy the tiny application layer and the heavy dependency layer stays cached in the registry and on nodes."
    },
    {
      "q": "Your container is PID 1 and doesn't shut down cleanly on a Kubernetes rolling update. What's wrong?",
      "a": "If you use the shell form of ENTRYPOINT/CMD, the process runs as a child of /bin/sh which is PID 1, and SIGTERM goes to the shell, not your JVM, so graceful shutdown never fires and the pod is SIGKILLed after the grace period. Use the exec form (ENTRYPOINT [\"java\", ...]) so the JVM is PID 1 and receives signals directly, letting Spring run its shutdown hooks to drain in-flight requests. If you genuinely need a wrapper, add an init like tini to forward signals and reap zombies."
    },
    {
      "q": "Why must you set JVM heap relative to the container memory limit, and what's the failure if you don't?",
      "a": "A container memory limit is enforced by the kernel cgroup; if the JVM's heap plus non-heap (metaspace, thread stacks, direct buffers, code cache) exceeds it, the kernel OOM-kills the process and Kubernetes restarts it — often misdiagnosed as a memory leak. Modern JVMs honor cgroup limits via UseContainerSupport and you set MaxRAMPercentage (e.g. 75%) so heap leaves headroom for non-heap, rather than hardcoding -Xmx and forgetting off-heap usage. Set the container limit and the JVM sizing together, and remember a memory limit overage is a kill while a CPU limit overage is mere throttling."
    },
    {
      "q": "Why run as non-root and what other hardening do you apply to a production image?",
      "a": "By default containers run as root (UID 0); a compromised app then has root inside the container, easing container escape and host access, so you create and switch to a non-root user (USER appuser) — many cluster policies require it. Beyond that: pin a specific minimal base image (distroless/Alpine/JRE-only) rather than latest, run with a read-only root filesystem and drop Linux capabilities, scan images for CVEs in CI, and never bake secrets into layers since they persist in image history even if later deleted."
    },
    {
      "q": "When should you use a named volume vs a bind mount, and why are containers themselves a bad place to keep data?",
      "a": "A container's writable layer is ephemeral — removing the container destroys it — so any data that must survive (databases, uploads) goes on a volume. Named volumes are managed by Docker and are the portable production choice for stateful services; bind mounts map a specific host path and are great for live-reloading source in dev but couple you to host layout and permissions, making them poor for production. The general principle is to keep containers stateless and immutable and push all durable state to volumes or external services."
    }
  ],
  "7.2": [
    {
      "q": "Why do you target a Service or Deployment instead of Pods directly, and how do they relate?",
      "a": "Pods are ephemeral and get a new IP whenever they're rescheduled, so addressing them directly is fragile. A Deployment manages a ReplicaSet that keeps N identical pods running and handles rolling updates and rollbacks declaratively, so you operate at that level rather than hand-managing pods. A Service gives a stable virtual IP and DNS name and load-balances across the pods matching its label selector, so callers depend on the Service while pods churn underneath — Service for stable networking, Deployment for lifecycle."
    },
    {
      "q": "Explain liveness vs readiness probes and the outage that results from misconfiguring liveness.",
      "a": "Readiness gates traffic: failing it removes the pod from Service endpoints (used during warmup or transient overload) without killing it. Liveness gates the process: failing it makes kubelet restart the container, recovering deadlocks. The dangerous mistake is putting dependency checks (DB, downstream service) in the liveness probe — when that dependency blips, every replica fails liveness simultaneously and Kubernetes restarts them all in a crash loop, converting a recoverable degradation into a full outage. Liveness checks only the process; dependency health belongs in readiness, with a generous initialDelaySeconds/startupProbe for slow JVM boot."
    },
    {
      "q": "How do resource requests and limits affect scheduling and runtime, and what's the difference between hitting the CPU vs memory limit?",
      "a": "Requests are what the scheduler reserves — a pod only lands on a node with enough unrequested capacity, and requests also set the QoS class — while limits cap actual consumption at runtime. Exceeding the CPU limit only throttles the process (it runs slower), but exceeding the memory limit triggers an OOMKill and restart, because memory is incompressible. Set both: no requests means pods crowd onto overloaded nodes; no limits means one runaway pod starves its neighbors. A common pitfall is setting CPU limits too tight and silently throttling latency-sensitive services."
    },
    {
      "q": "A pod is stuck Pending or keeps CrashLoopBackOff-ing. How do you diagnose each?",
      "a": "Pending almost always means the scheduler can't place it: kubectl describe pod shows events like Insufficient cpu/memory (requests too high for any node), unsatisfiable node affinity/taints, or a PVC that won't bind — fix the requests, tolerations, or storage. CrashLoopBackOff means the container starts and exits repeatedly: check kubectl logs (and --previous for the last crash) and the exit code — 137 is OOMKill (raise the memory limit or fix the leak), a non-zero app exit points to bad config/missing secret, and failing liveness too early points to an under-sized initialDelay. The describe events and logs are the two first stops."
    },
    {
      "q": "How does a RollingUpdate work with maxSurge and maxUnavailable, and how do you guarantee zero-downtime?",
      "a": "Kubernetes replaces pods incrementally: maxSurge allows extra pods above the desired count and maxUnavailable allows some below it during the roll, so traffic shifts from old to new without dropping below capacity. Zero downtime additionally requires correct readiness probes (so the Service only sends traffic to pods that are actually ready) and graceful shutdown — the app must catch SIGTERM, stop accepting new requests, and drain in-flight ones within terminationGracePeriodSeconds, often with a preStop sleep so endpoint removal propagates before the process exits. A PodDisruptionBudget protects minimum availability during node drains."
    },
    {
      "q": "What does an HPA need to function, and why can it fail to scale or thrash?",
      "a": "HPA computes utilization as actual/requested, so without CPU/memory requests set it has no denominator and won't scale, and it needs the Metrics Server (or a custom/external metrics adapter) feeding it data. It can fail to scale if requests are mis-sized (utilization never crosses the target) or if the bottleneck isn't CPU — bursty queue-driven workloads often need custom metrics via KEDA instead. Thrashing comes from aggressive thresholds; the built-in stabilization windows (fast scale-up, slow scale-down) damp it, and you combine HPA with a PDB so scale-down or node events don't drop you below a safe replica count."
    }
  ],
  "7.3": [
    {
      "q": "What problem does Helm solve that plain kubectl and YAML don't?",
      "a": "Managing dev/staging/prod with raw manifests means near-duplicate YAML per environment, where a single label or image-tag change must be edited in many files and drift creeps in. Helm templates the manifests with Go templating, supplies defaults in values.yaml, and lets each environment override only what differs via a values file or --set. On top of templating it adds release lifecycle management — versioned revisions, atomic upgrades, one-command rollback, and packaging/sharing of charts (e.g. bitnami's postgres) — which plain kubectl apply lacks."
    },
    {
      "q": "Why is `helm upgrade --install` the standard in CI/CD, and how does rollback work?",
      "a": "helm install fails if the release exists and helm upgrade fails if it doesn't, so pipelines use helm upgrade --install, which is idempotent — it installs on first run and upgrades thereafter, making re-runs safe. Each upgrade is recorded as a numbered revision (stored as Secrets in the namespace), so helm rollback <release> reverts to the prior revision and helm rollback <release> 3 to a specific one without re-rendering from source. Adding --atomic rolls back automatically if the upgrade fails, and --wait blocks until resources are healthy so failures are caught in the pipeline."
    },
    {
      "q": "How would you run a database migration safely as part of a Helm release?",
      "a": "Use a Helm hook: annotate a Job with helm.sh/hook: pre-upgrade so the migration runs before the new Deployment rolls out, with helm.sh/hook-weight to order multiple hooks and helm.sh/hook-delete-policy: hook-succeeded to clean up finished Jobs. Because it's pre-upgrade, a failed migration aborts the release and the old version keeps serving, avoiding a deploy on top of a broken schema. The migration must be backward-compatible (expand-then-contract) so the still-running old pods tolerate the new schema during the rollout window."
    },
    {
      "q": "What's the difference between `helm template`, `--dry-run`, and `helm lint`, and how do nindent/toYaml prevent bugs?",
      "a": "helm lint checks chart structure and obvious errors; helm template renders manifests locally with no cluster contact (good for diffing and piping to a client-side validator); helm upgrade --dry-run renders and runs server-side validation against the live API and current release state, catching issues lint/template miss. YAML is whitespace-sensitive, so helpers like {{- toYaml .Values.resources | nindent 12 }} serialize a values block and re-indent it correctly under its parent key — getting indentation wrong silently produces a structurally different (often invalid) manifest, which is the most common Helm templating bug."
    },
    {
      "q": "How should you manage secrets and per-environment config across Helm charts?",
      "a": "Don't commit plaintext secrets in values files — base64 in a Kubernetes Secret is encoding, not encryption. Layer values (defaults in values.yaml, overrides in values-prod.yaml, last-mile via --set for things like image.tag), and source real secrets externally: Sealed Secrets or SOPS for encrypted-in-git, or the External Secrets Operator / a CSI driver pulling from Vault or a cloud secret manager at deploy time. This keeps the chart environment-agnostic while secrets stay out of source control and the rendered output."
    },
    {
      "q": "How do subcharts and chart dependencies behave, and what surprises teams about values scoping and upgrades?",
      "a": "Dependencies declared in Chart.yaml (under charts/) are deployed as part of the parent release, and you configure a subchart by nesting its values under the subchart's name in the parent's values.yaml, with global values shared across all charts. The surprises: subchart defaults can be overridden unexpectedly, helm upgrade won't manage resources a CRD-installing subchart created out of band, and stateful subcharts (a bundled database) are dangerous in production because an upgrade or uninstall can disrupt or delete persistent data — for stateful dependencies most teams deploy them as separate, independently-lifecycled releases."
    }
  ],
  "7.4": [
    {
      "q": "Distinguish continuous integration, continuous delivery, and continuous deployment, and when you'd pick each.",
      "a": "CI is automated build-and-test on every push so integration bugs surface immediately. Continuous Delivery extends that so every green build yields a deployable artifact and reaching production is a manual one-click gate — chosen when change approval, compliance, or coordinated releases require a human. Continuous Deployment removes that gate, shipping every green build straight to production — viable only with a trusted test suite, strong observability, and feature flags to decouple deploy from release. Enterprises usually run Continuous Delivery; high-velocity SaaS teams often run Continuous Deployment."
    },
    {
      "q": "What's the difference between GitOps pull-based and traditional push-based deployment, and why does pull win for security?",
      "a": "Push-based CI runs kubectl/helm from the pipeline against the cluster, so the CI runner holds cluster credentials and cluster state can silently drift from the repo. Pull-based GitOps (ArgoCD/Flux) puts an in-cluster agent that watches a git config repo and reconciles the cluster to match it, so the deploy direction is reversed — nothing outside needs cluster creds, and credentials stay inside the cluster. That shrinks the attack surface (a compromised CI runner can't touch prod directly) and gives continuous drift detection with optional auto-correction."
    },
    {
      "q": "How do you do rollbacks under GitOps versus an imperative pipeline?",
      "a": "In GitOps the cluster is a reflection of git, so a rollback is a git revert of the offending commit (typically the image-tag/config change); the agent detects the new desired state and reconciles the cluster back, leaving a full audit trail in git history. That's more reliable than re-running an imperative pipeline against a possibly-drifted cluster. The caveat is that reverting the manifest doesn't undo data/schema migrations — those need their own backward-compatible, separately-reversible strategy, since rolling the app back onto a migrated database can break it."
    },
    {
      "q": "How should images be tagged through a CI/CD pipeline, and what's wrong with deploying `:latest`?",
      "a": "Tag images with an immutable identifier — the git SHA (or a semver release) — so a deployment maps to exactly one commit, builds are reproducible, and GitOps can pin a precise tag in the manifest. Deploying :latest is mutable and non-deterministic: two nodes can pull different content for the same tag, rollbacks are ambiguous, and with imagePullPolicy nuances pods may not even pull the new image. Use latest only as a convenience alias; deploy the SHA/version tag and reference its digest where you need a hard guarantee."
    },
    {
      "q": "How do you handle secrets in a GitHub Actions pipeline, and what's the fork/PR pitfall?",
      "a": "Store secrets in GitHub Actions secrets (repo- or environment-scoped), reference them as ${{ secrets.X }} where they're masked in logs, and gate sensitive jobs behind a protected environment that requires manual approval. The pitfall is pull requests from forks: by default they don't receive secrets (so untrusted code can't exfiltrate them), and using pull_request_target to grant access checks out the base repo's trusted workflow but the PR's untrusted code — a known privilege-escalation footgun. For real infrastructure prefer short-lived OIDC-federated credentials over long-lived stored secrets."
    },
    {
      "q": "Beyond a basic build, what makes a CI pipeline fast and trustworthy, and how do you keep deploys safe?",
      "a": "Speed comes from caching the dependency layer (Maven/Gradle cache, Docker layer cache like type=gha) and parallelizing/sharding tests so feedback stays under a few minutes. Trust comes from running the full suite — unit, integration against ephemeral service containers, and contract tests — plus image vulnerability scanning, and failing fast. Safety at deploy time means progressive delivery: deploy to staging with smoke tests, roll out with readiness gates and --wait, and use canary or blue-green with automated rollback (and feature flags) so a bad release affects a slice of traffic before being promoted or reverted."
    }
  ],
  "7.5": [
    {
      "q": "A pod is stuck in CrashLoopBackOff. Walk me through your debugging in order.",
      "a": "Start with kubectl describe pod to read events and the last restart reason, then kubectl logs --previous to see the crash output from the prior container instance (current logs are often empty because it just restarted). CrashLoopBackOff means the container starts then exits non-zero repeatedly, so it's usually a bad config/secret, a failing dependency at startup, a too-aggressive liveness probe killing a slow boot, or an OOMKill — check describe for the exit code and reason (137 = OOMKilled). The fix depends on the cause: correct the env/secret, give startupProbe headroom so liveness doesn't kill a slow JVM, or raise the memory limit."
    },
    {
      "q": "A pod is in ImagePullBackOff. What are the likely causes and how do you confirm each?",
      "a": "ImagePullBackOff means the kubelet can't pull the image; kubectl describe pod shows the exact pull error in events. The usual causes are a wrong image name/tag (typo or a tag that was never pushed), a private registry without a valid imagePullSecret, registry auth/rate limits, or the node architecture not matching the image. Confirm by checking the tag exists in the registry, that the imagePullSecret is referenced and valid, and that you used an immutable sha- tag rather than a mutable one that drifted — this is also why latest is dangerous in production."
    },
    {
      "q": "order-service can't reach inventory-service: connections time out. How do you debug service-to-service DNS and connectivity?",
      "a": "Resolve the name from inside a pod (kubectl exec then nslookup inventory-service.namespace.svc.cluster.local) to separate DNS failure from connection failure. DNS failures point at CoreDNS being down, a wrong namespace in the FQDN, or a misnamed Service; connection failures with good DNS point at the Service selector not matching pod labels (so Endpoints is empty — check kubectl get endpoints), the wrong targetPort, or a NetworkPolicy denying east-west traffic. The senior tell is checking Endpoints first: an empty endpoint list means the Service exists but matches no ready pods, which also implicates failing readiness probes."
    },
    {
      "q": "How does a rolling update actually work, and how do you do a safe rollback when a release is bad?",
      "a": "A Deployment rollout creates a new ReplicaSet and shifts pods over governed by maxSurge and maxUnavailable, only routing traffic to pods that pass readiness probes, so a broken new version that never goes Ready won't take down capacity — the rollout just stalls. To recover, kubectl rollout undo reverts to the previous ReplicaSet (Kubernetes keeps revision history), which is fast because the old pod spec and image are retained. The pitfalls are missing readiness probes (Kubernetes sends traffic to not-yet-ready pods), non-backward-compatible DB migrations that break the old version during overlap, and in GitOps you rollback by reverting the Git commit, not by imperatively editing the cluster."
    },
    {
      "q": "Liveness vs readiness vs startup probes — how do you configure them for a Spring Boot service, and what's the classic mistake?",
      "a": "Readiness gates traffic (fail it and the pod is pulled from the Service but not restarted), liveness restarts a wedged container, and startup protects a slow boot so liveness doesn't fire prematurely. The classic mistake is making liveness a deep health check that pings the database or downstream services: when that dependency blips, every pod fails liveness and Kubernetes restarts them all at once, turning a transient dependency issue into a full self-inflicted outage. Keep liveness shallow (process is alive), put dependency checks in readiness, and use a startupProbe with generous failureThreshold for JVM warm-up."
    },
    {
      "q": "What are requests vs limits, and how do CPU and memory limits behave differently under pressure?",
      "a": "Requests drive scheduling and guarantee a floor; limits cap usage. CPU is compressible, so exceeding the CPU limit throttles the container (slower, not killed) — over-tight CPU limits cause mysterious latency, and on the JVM they also distort the auto-detected processor count. Memory is incompressible, so exceeding the memory limit gets the container OOMKilled (exit 137); for the JVM you set heap relative to the limit with MaxRAMPercentage and leave ~25% headroom for non-heap, otherwise the container is killed even though the Java heap looks healthy. Set requests from observed usage and keep limits realistic, since requests also determine the pod's QoS class and eviction order under node pressure."
    },
    {
      "q": "HPA isn't scaling your request-serving tier even though latency is bad. What's going on and what should you scale on?",
      "a": "CPU-based HPA is a poor proxy for a latency-bound, I/O-waiting service — pods can be slow while CPU sits at 40%, so the HPA never triggers. Better signals are request-rate or concurrency / queue depth via custom or external metrics (e.g. Prometheus adapter), which track the actual saturation. Also check that the metrics-server/adapter is healthy (HPA can't scale on metrics it can't read), that requests are set so utilisation math is meaningful, and that you're not hitting maxReplicas or a cluster-autoscaler delay where there's simply no node to schedule new pods onto — the cold-start lag is itself a design concern."
    }
  ],
  "8.1": [
    {
      "q": "Walk me through the core BPMN symbols and what a 'token' actually is.",
      "a": "Circles are events (thin border start, double border intermediate, thick border end), rounded rectangles are tasks, diamonds are gateways, and arrows are sequence flows. Execution is modelled as a token that the engine moves along sequence flows: a start event produces a token, tasks consume and re-emit it, and the process instance completes only when all tokens reach end events. Thinking in tokens is what makes parallel gateways and joins intuitive, because a join must wait until a token has arrived on every incoming flow before it produces one outgoing token."
    },
    {
      "q": "Explain the three gateway types and the classic deadlock pitfall.",
      "a": "Exclusive (XOR) picks exactly one outgoing path by evaluating conditions in order, parallel (AND) splits one token into one per outgoing flow and its matching join waits for all of them, and inclusive (OR) activates every branch whose condition is true and joins on exactly those. The classic pitfall is mixing a parallel or inclusive split with the wrong join: if you split with AND but join with XOR you leak tokens and never complete, and an inclusive join that can't predict which branches were taken can stall. Keep splits and joins symmetric, and prefer XOR plus explicit conditions over inclusive gateways because inclusive merge semantics are hard to reason about under failure."
    },
    {
      "q": "What's the difference between a service task, user task, and receive task, and when does each create a wait state?",
      "a": "A service task is automated work (a delegate, expression, or external worker) and normally runs synchronously without persisting a wait. A user task creates a durable wait state in the engine database for a human to claim and complete via a task list, and a receive task waits for an incoming correlated message. The key production insight is that wait states (user tasks, receive tasks, timers, and async-before flags) are the points where the engine commits a transaction and saves state to the DB, so that's where the process survives a restart and where you should place safe points around risky external calls."
    },
    {
      "q": "What problem does a workflow engine solve that you couldn't cleanly do with plain application code and a state column?",
      "a": "It gives you durable, restart-surviving state for long-running processes, built-in timers and escalations, human task inboxes, automatic audit history, and a visual model the business can read and even change. A hand-rolled status-column state machine forces you to write your own persistence, retry, timer scheduling, and visibility, and it tends to scatter orchestration logic across services. The trade-off is operational and cognitive overhead: an extra engine and schema, BPMN as a new artifact to version, and the temptation to push real business logic into delegates where it's hard to unit test, so reserve it for genuinely long-lived or human-in-the-loop flows."
    },
    {
      "q": "How do you handle errors and compensation in BPMN rather than just letting a task throw?",
      "a": "Use BPMN error events: a delegate throws a BpmnError that's caught by an error boundary event on the task or an error event subprocess, which routes the token down a handled path instead of leaving the job in a failed/incident state. For undoing already-completed steps you model compensation: mark tasks with compensation handlers and trigger them with a compensation throw event, which is the BPMN way to express a saga's rollback (release inventory, refund payment). Distinguish technical failures, which should retry via the engine's job retry mechanism and surface as incidents, from business errors, which should be explicit error events in the model."
    },
    {
      "q": "How do timers, message correlation, and multi-instance markers work, and where do they bite in production?",
      "a": "Timer events (date, duration, or cycle) let you model SLAs and escalations as a boundary timer that interrupts or runs alongside a task; messages are correlated to a waiting instance by a business key or a correlation variable, so a mismatched key silently fails to wake the process. Multi-instance markers turn a task or subprocess into a for-each over a collection, sequential or parallel, which is how you fan out per line item. The production gotchas are timezone and clock issues with timers, dangling instances when correlation keys don't match, and unbounded parallel multi-instance over large collections flooding the job executor, so cap concurrency and validate correlation keys."
    }
  ],
  "8.2": [
    {
      "q": "Contrast Camunda 7 and Camunda 8 architecturally and explain when you'd pick each.",
      "a": "Camunda 7 embeds the engine inside your Spring Boot process and shares your relational database via ACT_* tables, so delegates are ordinary Spring beans running in your application transaction. Camunda 8 is a separate Zeebe cluster with its own event-sourced log (no shared RDBMS), reached over gRPC, where work is done by external job workers that are independent services with no Spring injection into the engine. Pick 7 for an existing Spring monolith on Postgres where transactional simplicity and team familiarity matter; pick 8 for greenfield, cloud-native, horizontally-scaled workloads (hundreds of thousands of instances a day) where you accept the operational cost of running a cluster."
    },
    {
      "q": "In Camunda 7, what are the main engine services and how do you start and inspect a process?",
      "a": "RuntimeService starts and signals instances and reads/writes variables, RepositoryService deploys and queries BPMN definitions, TaskService is the human task inbox (query, claim, complete), HistoryService exposes the audit log of finished instances, and ManagementService handles jobs, timers, and failed-job retries. You start with runtimeService.startProcessInstanceByKey(key, businessKey, variables) and find where a live instance sits via getActiveActivityIds, falling back to HistoryService once it has completed. Using a meaningful business key (like the order id) is what lets you correlate messages and query an instance later without storing the engine's internal id everywhere."
    },
    {
      "q": "How does a Camunda 7 JavaDelegate transaction interact with the engine, and what's the async-before flag for?",
      "a": "By default the engine runs synchronously from one wait state to the next inside a single transaction, so your JavaDelegate executes in that same transaction and a thrown exception rolls back to the last commit, re-raising the token at that safe point as an incident after retries are exhausted. That means a non-idempotent side effect like charging a card can be re-executed on rollback. Setting asyncBefore (or asyncAfter) on a task tells the engine to commit and hand the work to the job executor, creating a transaction boundary so the risky step runs in its own transaction with independent retries; this is the standard fix for the dual-write and re-execution problem."
    },
    {
      "q": "How do delegates differ from Camunda 8 job workers, and what changes about your mental model?",
      "a": "A Camunda 7 delegate is push-based and in-process: the engine calls your bean synchronously within its transaction. A Camunda 8 job worker is pull-based and out-of-process: it long-polls Zeebe for jobs of a given type over gRPC, does the work, then sends a complete or fail command, with no shared transaction with the broker. So in 8 you design for at-least-once delivery and idempotency, handle backpressure and retries explicitly via fail commands and retry counts, and lose Spring transactional coupling, which is liberating for polyglot/scaled systems but means you can no longer lean on a single ACID transaction spanning engine and business data."
    },
    {
      "q": "How should process variables be used and what are the anti-patterns?",
      "a": "Variables are persisted per instance in the engine DB and drive gateway conditions via expression language; set them at start, in delegates via execution.setVariable, or on task completion, and use local variables to scope data to a subprocess or multi-instance iteration. The anti-patterns are storing large blobs or whole entities as variables (it bloats the history tables and serialization, and complicates schema evolution) and using variables as a general-purpose cache. The senior move is to store identifiers and small flags as variables and keep the real payload in your own tables, looking it up by id, which also keeps PII out of the engine's audit history."
    },
    {
      "q": "What are the operational and history-level concerns when running Camunda 7 in production?",
      "a": "history-level (none, activity, audit, full) trades audit detail against write volume and table growth: full captures every variable update and is great for debugging but the ACT_HI_* tables explode, so you must configure history time-to-live and run the history cleanup job. You also tune the job executor pool for async tasks and timers, monitor incidents (failed jobs that exhausted retries) as first-class alerts, and plan process versioning carefully since in-flight instances keep running on their original definition version unless you migrate them. Schema auto-update is fine in dev but in prod you manage the ACT_* schema with your migration tool alongside the engine version upgrade."
    }
  ],
  "9.1": [
    {
      "q": "A Java service is pegging CPU in production. Walk me through diagnosing it on the box with command-line tools.",
      "a": "Start with top (or top -H -p <pid> to see per-thread CPU) and note the hottest native thread ids, converting them to hex. Take a thread dump with jstack <pid> or kill -3, find the thread whose nid matches that hex id, and read its stack to see the hot loop. Correlate with jstat -gc <pid> 1000 to rule out GC thrashing (a climbing FGC count means full GCs are burning the CPU, pointing at heap pressure or a leak rather than application code). The discipline is mapping an OS-level hot thread back to a specific Java stack frame instead of guessing."
    },
    {
      "q": "Explain load average versus CPU utilization and why the distinction matters.",
      "a": "Load average is the exponentially-weighted count of processes that are runnable or in uninterruptible sleep (often disk or I/O wait) over 1, 5, and 15 minutes, whereas CPU utilization is the percentage of time cores are actually executing. You compare load to core count: a load of 4 on 4 cores is saturated, on 8 cores it's fine. The key insight is that high load with low CPU usually means I/O wait or lock contention, not compute, so you'd reach for iostat and thread dumps rather than profiling CPU; conversely high CPU with modest load points at a few hot threads."
    },
    {
      "q": "What is a file descriptor, and how does the 'too many open files' error happen and get fixed?",
      "a": "A file descriptor is a small integer the kernel hands out for every open file, socket, and pipe a process holds, and each process has a soft and hard limit (ulimit -n). A Java service that leaks connections or never closes streams (missing try-with-resources, an unbounded HTTP connection pool) keeps accumulating descriptors until open() fails with 'Too many open files,' which surfaces as failed DB connections or dropped sockets. Diagnose with lsof -p <pid> or ls /proc/<pid>/fd | wc -l, raise the limit in limits.conf or the systemd unit's LimitNOFILE, but treat a steadily climbing count as a leak to fix, not just a ceiling to raise."
    },
    {
      "q": "What's the difference between kill -15 and kill -9 for a Spring Boot app, and why prefer one?",
      "a": "kill -15 sends SIGTERM, which the JVM catches so shutdown hooks run: Spring Boot stops accepting new requests, drains in-flight ones if graceful shutdown is enabled, and closes DB connections and flushes buffers cleanly. kill -9 is SIGKILL, which the kernel applies immediately with no chance for the JVM to react, risking half-finished transactions, leaked connections, and unflushed writes. Always try -15 first with a timeout, then escalate to -9 only if it hangs; in systemd this maps to SuccessExitStatus=143 and a TimeoutStopSec so the supervisor stops the app gracefully on its own."
    },
    {
      "q": "Why is structured pipeline analysis better than grep alone, and show a couple of one-liners you'd actually use.",
      "a": "Raw grep finds lines but doesn't summarize, so for triage you compose tools: grep 'Exception' app.log | grep -oP '\\w+Exception' | sort | uniq -c | sort -rn ranks which exception types dominate, and grep -c ERROR scoped to the current hour gives an error rate. set -o pipefail in scripts ensures a failing stage in a pipe doesn't get masked by a successful tail. The senior framing is treating logs as a data stream you aggregate (counts, top-N, time-window) rather than eyeballing, which turns 'something's wrong' into 'NullPointerException is 80% of errors and started at 14:32.'"
    },
    {
      "q": "How do you run a Spring Boot app as a managed service and read its logs without a custom PID script?",
      "a": "Use a systemd unit with ExecStart launching the jar, Restart=on-failure with RestartSec, User= for a non-root account, SuccessExitStatus=143 so a SIGTERM exit isn't treated as a crash, and TimeoutStopSec to bound graceful shutdown. systemd then supervises restarts and you read logs via journalctl -u myapp --since '1 hour ago' instead of tailing a file. This is more robust than a hand-rolled start/stop script with a PID file because systemd handles restart backoff, log capture, dependency ordering (After=network.target), and resource limits like LimitNOFILE in one place."
    }
  ],
  "9.2": [
    {
      "q": "Walk through everything that happens at the network level when a client calls an HTTPS API for the first time.",
      "a": "First DNS resolves the hostname to an IP (cache, then recursive lookup), then a TCP three-way handshake (SYN, SYN-ACK, ACK) establishes the connection to port 443, then the TLS handshake exchanges supported ciphers, the server's certificate, validates it against trusted CAs, and both sides derive a shared symmetric session key via ECDHE. Only then is the encrypted HTTP request sent and the response returned. The cost is one to a few round trips before any payload moves, often 100-300ms, which is exactly why connection reuse (keep-alive) and TLS session resumption matter so much for throughput."
    },
    {
      "q": "Compare HTTP/1.1, HTTP/2, and HTTP/3 and where head-of-line blocking lives in each.",
      "a": "HTTP/1.1 reuses a TCP connection via keep-alive but serializes requests on it, so a slow response blocks the ones behind it (application-layer head-of-line blocking), worked around by opening multiple connections. HTTP/2 multiplexes many concurrent streams over one connection with header compression, removing application-layer blocking, but because it's still over TCP a single lost packet stalls all streams (transport-layer head-of-line blocking). HTTP/3 runs over QUIC on UDP with independent streams and built-in TLS 1.3, so packet loss only stalls the affected stream and connection setup is faster, which is why it shines on lossy mobile networks."
    },
    {
      "q": "Why must you always set timeouts on HTTP clients in Java, and which timeouts matter?",
      "a": "Several clients (notably a default RestTemplate) have no timeout, so a slow upstream blocks the calling thread indefinitely; with a fixed Tomcat thread pool, one slow dependency can exhaust all worker threads and your whole service stops responding, a classic cascading failure. You need a connect timeout (a couple of seconds to establish the TCP/TLS connection) and a read/response timeout (a few to tens of seconds for the body), and ideally a pool-acquisition timeout. Pair these with a circuit breaker so repeated timeouts trip open and shed load instead of queueing, and with bounded retries plus an idempotency key so retries are safe."
    },
    {
      "q": "How does TLS certificate validation work, and what's the difference between DV, OV, and EV plus how Let's Encrypt fits in?",
      "a": "During the handshake the server presents a certificate chain; the client verifies each signature up to a root it already trusts, checks the hostname against the certificate's subject/SAN, and checks validity dates and revocation. DV certificates only prove control of the domain (fast, free, automatable), OV adds verified organization identity, and EV adds the strictest vetting. Let's Encrypt issues DV certs automatically over the ACME protocol, which is why reverse proxies like Caddy can obtain and auto-renew them with zero config; the security comes from the chain of trust and hostname check, not the certificate 'class.'"
    },
    {
      "q": "Explain the difference between an L4 and L7 load balancer and what each can and can't do.",
      "a": "An L4 load balancer routes by IP and port at the transport layer, so it's fast and protocol-agnostic but blind to HTTP, meaning it can't route by path, header, or cookie. An L7 load balancer terminates and understands HTTP, so it can route /api/v2 to a new cluster, do sticky sessions by user, rewrite headers, and perform TLS termination so backends speak plain HTTP. The trade-off is that L7 sees and can decrypt traffic (more capability, more responsibility and overhead); a service mesh pushes this further with per-pod sidecars doing mTLS, retries, circuit breaking, and tracing."
    },
    {
      "q": "How would you design safe retries for an HTTP call, and which status codes and headers guide that?",
      "a": "Only retry idempotent operations or operations you've made idempotent with an Idempotency-Key, and retry on transient signals: connection/read timeouts, connection refused, and 5xx like 502/503/504, but not on 4xx like 400/401/404 which won't change on retry. Honor Retry-After on 429 and 503 rather than hammering, use exponential backoff with jitter to avoid synchronized retry storms, and cap total attempts. Combine with a circuit breaker so you stop retrying a clearly-down dependency, and remember that a POST that times out may have actually succeeded, which is exactly why the idempotency key is what makes the retry correct."
    }
  ],
  "9.3": [
    {
      "q": "What are the three pillars of observability and how do you use them together during an incident?",
      "a": "Logs answer what happened (timestamped, contextual events with stack traces), metrics answer how much and how often (numeric time-series like error rate and latency percentiles that drive dashboards and alerts), and traces answer where the time went (one request's path across services). In practice a metric alert fires on an error-rate spike, you pivot to logs filtered by the same time window and request id to read the actual exception, then open the trace to see which downstream span was slow or failed. None alone is enough: metrics tell you something broke, logs tell you what, traces tell you where."
    },
    {
      "q": "What is a correlation/request id and how do MDC and trace context make logs actually searchable?",
      "a": "A correlation id is a unique value generated or accepted at the edge (often an X-Request-Id header or the trace id) and attached to every log line for that request. SLF4J's MDC is a per-thread key-value map; you put requestId and userId once in a filter and every log statement from that thread automatically includes them, so you can retrieve all log lines for one request across every layer by filtering on the id. The discipline points are clearing the MDC in a finally block to avoid leaking context across pooled threads, and propagating the id over outbound calls so the chain stays correlated through downstream services."
    },
    {
      "q": "Explain the difference between a Counter, a Gauge, and a Timer, and why histogram-based percentiles beat averages.",
      "a": "A Counter only increases and is for cumulative events (requests, errors), where Prometheus derives a rate; a Gauge goes up and down for a current value (active connections, heap used, queue depth); a Timer records both count and duration and produces histogram buckets so you can compute p50/p95/p99 latency. Averages hide tail latency, the few slow requests that actually hurt users, so you alert on p99 and SLOs, not the mean. The senior nuance is computing percentiles with histogram_quantile over the buckets, and knowing you can't average pre-aggregated percentiles across instances, which is why bucket-based aggregation is the correct approach."
    },
    {
      "q": "What is metric cardinality and why is it the thing that takes down your monitoring stack?",
      "a": "Cardinality is the number of distinct time-series, which is the product of a metric's label values; each unique combination of label values is its own series stored in memory. Putting unbounded values like user id, request id, full URL with path params, or raw error messages into labels causes a cardinality explosion that blows up Prometheus memory and query cost and can crash it. The rule is labels must be low-cardinality and bounded (status code, route template, region, instance), while high-cardinality identifiers belong in logs or trace attributes, not metric labels. This is the single most common self-inflicted observability outage."
    },
    {
      "q": "How does distributed tracing work, and what's a trace versus a span versus context propagation?",
      "a": "A trace is one end-to-end request identified by a trace id; a span is a single unit of work within it (a service call, a DB query) with its own span id, start/end time, parent reference, and attributes. Context propagation passes the trace id and current span id across process boundaries, typically via the W3C traceparent header, so each service creates child spans that stitch into one tree. Reading the tree, you see exactly which span dominated latency or errored. The practical concerns are sampling (you can't trace everything at scale, so use head or tail sampling) and making sure every hop, including async/queue boundaries, propagates the context or the trace breaks."
    },
    {
      "q": "How do you connect logs, metrics, and traces so an on-call engineer can pivot between them quickly?",
      "a": "The glue is shared identifiers and consistent labels: stamp the trace id into every log line via MDC so a log links to its trace, and tag metrics, logs, and traces with the same service and route labels so a dashboard can jump to the relevant logs for a time slice. A modern Grafana stack (Loki for logs, Prometheus for metrics, Tempo for traces) supports exemplars and trace-to-logs links, so you click a latency spike, jump to the exemplar trace, then to the logs for that exact request. The payoff is mean-time-to-resolution: the value isn't collecting all three pillars, it's being able to pivot between them on a common key."
    }
  ],
  "10.1": [
    {
      "q": "Tell me about a time you owned a production incident from detection to resolution.",
      "a": "Use STAR and keep it to about 90 seconds: set the situation briefly (what broke, blast radius, who was affected), state the task as your responsibility, then spend most of the time on your specific actions. The panel rewards a clear diagnostic narrative (how you isolated root cause using logs/metrics/traces, not guesswork), evidence of calm prioritization (stop the bleeding first, root cause second), and communication (status updates, looping in stakeholders). Close with a quantified result and, crucially, the follow-up: the alert, test, or runbook you added so it can't recur, which signals ownership beyond the firefight rather than heroics."
    },
    {
      "q": "Describe a time you disagreed with a technical decision and how it played out.",
      "a": "Frame it as 'disagree and commit': show you argued the case with data and trade-offs rather than ego, proposed a concrete alternative, and then fully committed once the team decided, even if it wasn't your way. Strong answers describe writing a short brief or doing a spike to make the discussion objective, listening to the other side's constraints (timeline, risk), and finding a middle path where possible. The signals the panel wants are that you can influence without authority, separate being right from needing to win, and stay a constructive teammate afterward, so make the result include how the relationship and the project both came out fine."
    },
    {
      "q": "Tell me about a significant technical mistake you made and what you learned.",
      "a": "Pick a real, non-trivial failure and don't minimize it; the panel is testing self-awareness and growth, not a clean record. Own your specific decision plainly ('I deployed without validating X'), explain how you detected it, how you contained the impact, and then the durable change you made: a process, a check, a habit, or a test. Avoid the red flags: blaming others, hiding behind 'we,' choosing a fake-humble failure ('I work too hard'), or claiming nothing really went wrong. Bonus credit if you can show you later applied the lesson and it prevented a repeat, which turns a mistake into demonstrated learning."
    },
    {
      "q": "Give me an example of leading or driving something without formal authority.",
      "a": "Choose a story where you created momentum through influence: you spotted a problem outside your remit, built a case, recruited allies, and shipped an outcome. Emphasize the mechanics of influence (a proposal others could critique, a small proof of value, addressing objections, giving credit) rather than just 'I convinced everyone.' Use 'I' for your specific contributions and reserve 'we' for genuinely shared work, because vague collective language reads as not actually having led. The reward signal is initiative plus the ability to align people, so let the result show both the technical win and that others adopted or continued the approach."
    },
    {
      "q": "Tell me about a time you had to deliver under a tight deadline with incomplete information.",
      "a": "Show structured decision-making under ambiguity: what you knew, what you assumed and why, how you de-risked with reversible choices (feature flag, phased rollout, a thin slice first), and how you communicated the trade-offs to stakeholders. Panels reward prioritization (cut scope deliberately rather than ship everything badly) and judgment about which uncertainties were worth resolving versus accepting. End with the result and an honest note on what you'd revisit, which signals you optimize for outcomes under constraints rather than either freezing or recklessly charging ahead."
    },
    {
      "q": "How should you prepare your behavioral stories so you can handle a whole round without running dry?",
      "a": "Prepare five or six strong, real stories and tag each with the multiple competencies it covers (ownership, conflict, ambiguity, influence, failure) so one incident can answer several prompts; mapping one story per question makes you rigid and you'll run out. Rehearse each aloud to land in the 90-120 second window, leading with a crisp situation/task and spending the bulk on your specific actions and a quantified result. Keep a deeper technical detail in reserve for the inevitable 'tell me more,' and tailor the result line to numbers you can actually defend, because EU panels often probe follow-ups and inconsistencies surface fast."
    }
  ],
  "10.2": [
    {
      "q": "Design a system for us, say a URL shortener. How do you open the interview?",
      "a": "Don't start drawing boxes; spend the first few minutes on requirements and scale. Clarify functional needs (shorten, redirect, custom aliases, analytics, expiry) and non-functional ones (read:write ratio, RPS, latency target, availability, consistency, retention), then do a quick back-of-envelope estimate to size storage and throughput. State your assumptions out loud. The panel is evaluating whether you optimize for the actual problem; a candidate who jumps to a design without bounding the problem signals they'll over- or under-engineer in real work, whereas 'let me confirm scale and read/write pattern first' immediately reads as senior."
    },
    {
      "q": "How do you structure the whole design conversation so the interviewer can follow your reasoning?",
      "a": "Use an explicit skeleton and narrate the transitions: requirements and assumptions, rough capacity estimates, a high-level data model and API, then a deep dive into bottlenecks, scaling, and failure modes. Drive it as a dialogue, checking in ('does this match what you had in mind?') and managing time so you reach the interesting trade-offs instead of polishing the data model. The signal panels reward is communication and prioritization under time pressure, not exhaustively covering everything; a clear narrative arc with you steering toward the hard parts beats a brilliant but unstructured brain-dump."
    },
    {
      "q": "When you propose a technology, how should you justify it so it lands as senior-level?",
      "a": "Always frame it as a comparison plus the cost you're accepting: 'I'd use X over Y because [requirement], and the trade-off I take on is Z.' For example, Kafka over RabbitMQ for high throughput and replay, accepting more operational complexity; or Redis over Postgres for a hot counter, accepting that you can lose a second of data on restart, and you'd flip that decision if the data were financial. The interviewer is testing whether you understand why, not which buzzword you know, so naming the downside you're tolerating and tying the choice back to a stated requirement is what distinguishes real judgment from pattern-matching."
    },
    {
      "q": "Apply the CAP theorem to a design decision out loud. How do you talk about consistency trade-offs?",
      "a": "Because network partitions will happen, frame the real choice as CP versus AP for the specific data in question, not all three. For inventory or payments you lean CP, refusing or serializing writes rather than serving stale data because correctness beats availability; for a social feed or shopping cart you lean AP, accepting eventual consistency to stay available. The strong move is to scope it per data flow rather than declaring the whole system one or the other, and to connect the choice to the consistency requirement you clarified earlier, showing you reason about trade-offs from requirements rather than reciting definitions."
    },
    {
      "q": "How do you handle the deep-dive when the interviewer pushes on a bottleneck or failure mode?",
      "a": "Welcome it: name where the hot path is and what breaks first under load, then talk through the standard levers (caching the hot subset, read replicas, sharding by a sensible key, async processing, backpressure) and explicitly which you'd reach for and when, rather than all at once. Reason about failure: what happens if the cache, a replica, or a dependency dies, and how you degrade gracefully. The panel rewards depth and honesty over a flawless story, so it's fine to say 'here's the risk and how I'd mitigate it,' and to acknowledge an unknown and reason toward an answer instead of bluffing."
    },
    {
      "q": "How do you adapt your communication when you realize you've misread the question or are running low on time?",
      "a": "Treat it as a real working session: if you sense you've gone down the wrong path, say so explicitly, summarize where you are, and re-confirm priorities with the interviewer instead of silently course-correcting. If time is short, call it and propose where to spend the remaining minutes ('I'll skip the analytics pipeline and go deep on the write path, which is the risky part'). Panels read this self-awareness and steering as exactly the collaboration they want from a senior engineer; the worst signal is plowing ahead unaware, so visible, calm re-prioritization is itself a strong positive."
    }
  ],
  "11.1": [
    {
      "q": "Why split a backend into a multi-module Maven build instead of one module, and what's the typical layout?",
      "a": "Multiple modules let you enforce dependency direction at compile time, build in parallel and incrementally, test each piece in isolation, and keep a clean seam for later extraction into a service. A common layered layout is common (shared DTOs/utils), domain (entities and pure domain logic, no framework), infrastructure (JPA repos, external clients), application (use cases orchestrating domain and infra), web (controllers and security), and an app module with the Spring Boot main class and resources. The point is the domain can't import the web layer because the Maven graph forbids it, so architectural rules become buildable constraints rather than wiki conventions."
    },
    {
      "q": "Explain dependencyManagement versus dependencies in a parent POM and why it matters.",
      "a": "dependencyManagement only declares versions and scope centrally; it doesn't put anything on any module's classpath, so children opt in by declaring the dependency without a version and inherit the managed one. Plain dependencies in the parent are forced onto every child whether they need them or not, which pollutes classpaths and blurs each module's real dependencies. The senior practice is to manage almost everything in dependencyManagement so each module explicitly lists what it uses, reserving parent dependencies for genuinely universal things like test libraries; this keeps modules honest about their actual coupling and avoids accidental transitive reliance."
    },
    {
      "q": "What is a Maven BOM and how does importing the Spring Boot BOM help?",
      "a": "A BOM is a pom-packaged artifact containing only dependencyManagement that declares a tested, mutually-compatible set of versions; you import it with scope=import and type=pom so you get its version declarations without dragging in transitive dependencies. Importing spring-boot-dependencies means you never specify versions for starters, Jackson, Hibernate, and the rest, the BOM pins them, and a single Spring Boot version bump moves dozens of dependencies together to a combination that was actually tested. This eliminates the classic dependency-hell of mismatched library versions and makes upgrades a one-line change with predictable blast radius."
    },
    {
      "q": "How do you actually enforce module boundaries so they don't erode over time?",
      "a": "Layer three mechanisms. First, the Maven module graph itself: if web only depends on application, it physically cannot import infrastructure classes without adding the dependency, which would be an obvious code-review smell. Second, maven-enforcer with banned-dependency rules fails CI if someone declares an illegal direct dependency. Third, ArchUnit tests assert at the package level that, for instance, no domain class imports org.springframework and controllers don't touch repositories, catching violations that sneak in transitively. Relying on discipline alone fails; combining structural prevention with automated tests in the build is what keeps the architecture intact as the team grows."
    },
    {
      "q": "How does a clean multi-module layout make a future move to microservices easier or harder?",
      "a": "If modules already have sharp boundaries and dependencies point inward (web to application to domain, infrastructure to domain), a module is close to a deployable unit: extracting it mostly means giving it its own runtime, replacing in-process calls across the seam with remote ones, and splitting the data it owns. The hard part isn't the code structure but the shared database and synchronous coupling, so the real benefit of the monolith-first approach is letting you discover the right boundaries cheaply before paying the distributed-systems tax. A muddy monolith with circular module deps, by contrast, makes extraction a rewrite."
    },
    {
      "q": "Should the domain module depend on Spring, and why do people insist it shouldn't?",
      "a": "The goal is to keep core domain logic free of framework annotations so it's plain Java that's fast to unit-test without a Spring context and portable if the framework changes; you push @Service, @Repository, and @Transactional into the application/infrastructure layers. The trade-off is some boilerplate and explicit wiring instead of letting annotations do everything, and pragmatically many teams allow a little framework leakage to avoid over-engineering a small codebase. The defensible senior position is to protect the genuinely valuable domain rules from framework coupling while not turning purity into dogma for trivial CRUD, and to enforce whatever line you choose with an ArchUnit test."
    }
  ],
  "11.2": [
    {
      "q": "Walk me through deploying a Spring Boot app to a single VPS with Docker Compose and Caddy. What runs where?",
      "a": "Caddy sits at the edge terminating TLS on 80/443 and reverse-proxies /api to the Spring Boot container on 8080 while serving the static UI directly, the app talks to a Postgres container over a private Docker network, and volumes persist the database and Caddy's certificates. docker-compose.yml declares the stack with restart: unless-stopped, an .env file (chmod 600, gitignored) supplies secrets, and deploys are a docker compose up -d --pull always with a new image tag. It's deliberately simple and cheap, suitable for small teams or side projects; the honest trade-off is a single point of failure and no horizontal scale, which you'd revisit before it carries serious production load."
    },
    {
      "q": "Why pick Caddy over Nginx here, and what do you give up?",
      "a": "Caddy's standout feature is automatic HTTPS: it obtains and renews Let's Encrypt certificates over ACME with essentially zero config, so there's no certbot, no renewal cron, no cert paths, and it enables HTTP/2 and HTTP/3 by default, with a Caddyfile that's a fraction of the equivalent Nginx config. What you give up is Nginx's larger ecosystem, deeper documentation for unusual edge cases, more battle-tested behavior at extreme scale, and a wider set of available modules. For a VPS-scale deployment the zero-ops TLS and simplicity clearly win; at very high scale or with exotic routing needs Nginx's maturity may matter more."
    },
    {
      "q": "How do Docker Compose healthcheck and depends_on together prevent the database startup race?",
      "a": "Plain depends_on only waits for the db container to start, not for Postgres to accept connections, so the app boots while the database is still initializing, fails its first connection, and crashes. Adding a healthcheck (pg_isready) to the db service makes Compose mark it healthy only once it truly accepts connections, and depends_on with condition: service_healthy holds the app back until then. This removes the race so the app connects on the first try. The senior caveat is that the app should still be resilient to the database disappearing later, since healthcheck only guards startup ordering, not mid-life failures."
    },
    {
      "q": "How are secrets handled with the .env pattern, and where does it fall short?",
      "a": "Compose auto-reads a .env file and substitutes variables into the compose file, so the VPS holds a gitignored .env with chmod 600 containing DB credentials, JWT secret, and OAuth client secrets. The limitation is that it's plaintext on disk, so a host compromise exposes everything at once, there's no rotation, audit, or encryption, and it's easy to accidentally bake secrets into an image or log them. For small projects .env plus restrictive permissions plus disk encryption is acceptable, but for anything serious you move to Docker/Swarm secrets, Kubernetes Secrets, or a real secret manager like Vault that injects credentials at runtime with rotation and access auditing."
    },
    {
      "q": "How do you get a safe, near-zero-downtime deploy and rollback on a single-box Compose setup?",
      "a": "Build immutable images tagged by version or git SHA (not just latest) and push to a registry, then on the VPS run docker compose up -d --pull always for the app, relying on the healthcheck and restart policy so traffic only flows once the new container is healthy. Wrap it in a deploy script that, after bringing the new version up, polls /actuator/health and rolls back to the previous tag if it doesn't report UP, and run database migrations as a deliberate, backward-compatible step before the app rollout. True zero-downtime needs two app instances and the proxy draining the old one; the realistic VPS version is a fast healthcheck-gated swap with an automated rollback path."
    },
    {
      "q": "What production hardening would you add to the reverse proxy beyond just routing?",
      "a": "Add security headers (HSTS with includeSubDomains, X-Content-Type-Options nosniff, X-Frame-Options DENY, a tight Content-Security-Policy, a sane Referrer-Policy), enable gzip/zstd compression, and turn on structured access logging for observability. Use proxy health checks so Caddy only routes to a healthy backend, terminate TLS at the edge while the internal hop stays on the private network, and add rate limiting (via a plugin) on sensitive paths to blunt abuse. For SPA routes, try_files falling back to index.html keeps client-side routing working. The framing is that the proxy is your first line of defense and your edge observability point, not merely a router."
    }
  ],
  "11.3": [
    {
      "q": "Walk me through the Spring Security filter chain and where authentication actually happens.",
      "a": "Spring Security is a chain of servlet filters in front of your controllers: an early filter restores any SecurityContext, authentication filters (form login's UsernamePasswordAuthenticationFilter or the BearerTokenAuthenticationFilter for JWTs, or a custom filter you add before them) attempt to authenticate and populate the SecurityContextHolder, ExceptionTranslationFilter converts authentication/authorization failures into 401/403, and the authorization filter enforces URL rules at the end. So authentication is established by a filter that puts an Authentication into the context, and everything downstream, including @PreAuthorize, reads from that context. Knowing the order matters because a custom JWT filter must run before the authorization check and you place it relative to UsernamePasswordAuthenticationFilter."
    },
    {
      "q": "Compare JWT-based stateless auth with server-side sessions and the trade-offs of each.",
      "a": "A session keeps state server-side (or in a shared store like Redis) with the client holding only an opaque cookie, so you can revoke instantly and store rich state, at the cost of needing that shared store to scale horizontally. A JWT is self-contained and signed, so the server validates it without a lookup, which scales statelessly and works well across services, but you can't easily revoke a token before it expires and any claims are baked in until then. The standard mitigation is short-lived access tokens plus longer-lived refresh tokens and a server-side denylist for emergencies, and never putting sensitive or fast-changing data in the JWT since it's only signed, not encrypted, and readable by anyone."
    },
    {
      "q": "Explain the Google OAuth2 / OpenID Connect login flow in a Spring Boot app and why it's a redirect dance.",
      "a": "It's the Authorization Code flow: the user hits /oauth2/authorization/google, Spring redirects to Google, the user consents, and Google redirects back to /login/oauth2/code/google with a one-time code; Spring then exchanges that code for tokens in a back-channel server-to-server call, fetches the user's profile, and your OAuth2UserService looks up or provisions the user before you mint your own session or JWT. The redirect plus code exchange exists so the access token never travels through the browser URL and the client secret stays server-side. The senior points are validating the OIDC id_token and state parameter (CSRF protection), and mapping the external identity to a stable internal user id."
    },
    {
      "q": "How do you enforce per-user data isolation in a multi-tenant app so one user can't read another's data?",
      "a": "Never trust an id from the request as authoritative for ownership; derive the current user/tenant from the authenticated SecurityContext and scope every query by it, e.g. findByIdAndUserId rather than findById, so an attacker changing a path id (an IDOR) gets nothing. Centralize this so individual queries can't forget it, and for defense in depth enforce it at the database with Postgres row-level security tied to a session variable, so even a buggy query can't leak across tenants. A subtle but important detail is returning 404 rather than 403 for resources the user doesn't own, so you don't leak the existence of other tenants' records."
    },
    {
      "q": "Why disable CSRF for a stateless JWT REST API but not for a cookie/session web app?",
      "a": "CSRF attacks rely on the browser automatically attaching ambient credentials, namely cookies, to a forged cross-site request. A stateless API that authenticates via an Authorization: Bearer header isn't vulnerable because the browser won't add that header automatically, so CSRF protection is unnecessary overhead and is conventionally disabled along with setting SessionCreationPolicy.STATELESS. A session-cookie web app absolutely needs CSRF tokens because the session cookie is sent automatically. The nuance is that if you store the JWT in a cookie instead of a header, you reintroduce CSRF exposure and must add SameSite cookie attributes and CSRF tokens back, so the decision follows where the credential lives."
    },
    {
      "q": "When do you use method-level security with @PreAuthorize versus URL-based rules, and what are the gotchas?",
      "a": "URL-based authorizeHttpRequests rules are coarse and great for broad gates (permit /actuator/health, require ADMIN for /api/admin/**), while @PreAuthorize/@PostAuthorize (needing @EnableMethodSecurity) express fine-grained, data-aware rules close to the logic, like '#userId == authentication.principal.userId or hasRole(ADMIN).' The gotchas: method security is proxy-based so it doesn't fire on self-invocation within the same bean; @PostAuthorize runs after the method, so it must not have already caused a side effect on data the user shouldn't touch; and SpEL ownership checks are easy to get subtly wrong. Use URL rules for broad strokes and method security for ownership and role checks tied to specific operations, and back both with tests."
    }
  ],
  "12.1": [
    {
      "q": "Walk me through implementing a thread-safe Singleton, and why is the GoF Singleton often called an anti-pattern?",
      "a": "I'd reach for the enum singleton or the lazy-holder idiom rather than hand-rolling double-checked locking, because the holder gets laziness and thread-safety free via the JVM's class-init guarantee and enum is additionally immune to reflection and serialization attacks. The anti-pattern critique is really about the static getInstance() global access point: it is hidden global mutable state that couples callers invisibly, leaks between tests, and resists mocking. The clean modern answer is to let a DI container own the single instance (Spring's default singleton scope) so you keep one-instance economy but inject it, preserving testability."
    },
    {
      "q": "Compare Factory Method, Abstract Factory, and Builder — when would you pick each?",
      "a": "Factory Method varies one product via inheritance (subclasses override a creation step), Abstract Factory varies a whole family of related products via composition with a consistency guarantee, and Builder isn't about polymorphic choice at all — it's staged construction of one complex, often immutable object with many optional fields. So: pick Factory Method when a base class can't know the concrete subtype but subclasses can; Abstract Factory when products must match (a MySQL dialect with a MySQL pager); Builder when you'd otherwise have a telescoping constructor. In practice DI subsumes most factory needs, leaving Builder as the one you still hand-write frequently."
    },
    {
      "q": "In a Spring application, how often do you actually write GoF creational patterns by hand, and why?",
      "a": "Rarely, because the container is the factory and the singleton manager: @Component gives you managed-singleton scope, @Bean methods are factory methods, @Profile/@Conditional plus @Qualifier select families like an abstract factory, and @Scope('prototype') gives fresh instances. You still write an explicit factory when you must build objects from runtime data the container can't know in advance — that's where ObjectProvider<T> or a small FactoryBean earns its place. The senior point is knowing the patterns so you can recognize what the container does for you and spot the gap it doesn't cover."
    },
    {
      "q": "You see a Builder on a two-field DTO. What's your reaction, and when is a Builder genuinely warranted?",
      "a": "That's over-engineering — for two required fields a constructor or static factory reads more clearly and a builder just adds ceremony and a window for a half-built object. Builder earns its keep when there are many parameters with several optional, you want immutability, and you want cross-field validation to run once in build() before publishing. If mandatory fields matter, I'd note that Lombok's @Builder makes everything look optional, so I'd use a required constructor arg or a step builder where the compiler enforces order and required steps."
    },
    {
      "q": "Someone asks you to 'implement clone()' for an object with a mutable list field. How do you respond?",
      "a": "I'd lead by saying I'd avoid Cloneable and prefer a copy constructor or a static copyOf factory, because Cloneable is a marker with no clone method, Object.clone is protected/native, it bypasses constructors and complicates final fields, and it defaults to shallow copy. The crux is shallow vs deep: a shallow copy shares the list reference so mutating the copy corrupts the original, so I'd deep-copy the mutable field (new ArrayList<>(other.list)). I'd still demonstrate I can write clone() correctly by cloning each mutable field, but frame the copy constructor as the cleaner default."
    },
    {
      "q": "When is Prototype the right choice, and how does Spring's @Scope('prototype') relate to it?",
      "a": "Prototype fits when constructing an object is expensive and you have a configured exemplar to copy, or you maintain a registry of pre-built prototypes — for cheap or immutable objects just use new, since deep-copying large graphs can cost more than rebuilding. Spring's prototype scope is a different mechanism: it creates a brand-new bean instance per lookup, it does not clone an exemplar, so it scratches the same 'I need fresh instances' itch without GoF copying. Conflating the two is a common slip; the distinction is clone-an-instance versus construct-a-new-one."
    },
    {
      "q": "You're choosing between an object pool and just allocating fresh objects. How do you decide?",
      "a": "I'd pool only genuinely expensive-to-create resources — DB connections, threads, large buffers — where the creation cost dominates, and accept the real costs: borrow/return discipline, leak risk, validation of stale entries, sizing, and contention. For ordinary short-lived objects like DTOs, pooling is usually a net loss on modern JVMs because TLAB allocation is fast and generational GC handles young garbage cheaply, so a pool just adds complexity and contention. Concretely I'd use HikariCP for connections and an ExecutorService for threads rather than building my own pool."
    }
  ],
  "12.2": [
    {
      "q": "Adapter, Decorator, and Proxy all wrap an object. How do you tell them apart, and why does the distinction matter?",
      "a": "All three share the wrapping structure; the difference is intent. Adapter changes the interface so two incompatible types collaborate (X wraps Y), Decorator keeps the same interface and adds behavior (X wraps X), and Proxy keeps the same interface but controls access — lazy loading, security, remoting, caching. The structural tell is what gets wrapped relative to what gets exposed, and the practical payoff is communication: in a design review saying 'that's really a Proxy, not a Decorator' tells the team whether the wrapper is meant to augment behavior the client wants or to transparently gate access."
    },
    {
      "q": "Explain concretely how Spring AOP and @Transactional use dynamic proxies, including the limitations.",
      "a": "Spring wraps the bean in a proxy and routes calls through it: for @Transactional the proxy begins a transaction, invokes the real method, then commits or rolls back around it — the same interception mechanism powers @Cacheable, @Async, and @Retryable. It uses a JDK dynamic proxy (Proxy.newProxyInstance routing to an InvocationHandler) when the bean implements an interface, otherwise a CGLIB subclass proxy. Limitations to call out: CGLIB can't proxy final classes or methods, only public methods get advice, and self-invocation (this.b()) bypasses the proxy entirely — the number-one '@Transactional doesn't work' bug."
    },
    {
      "q": "Why are java.io streams the textbook Decorator example, and what should you watch out for when stacking them?",
      "a": "Each filter stream both is-a InputStream and has-a InputStream — BufferedInputStream, DataInputStream, GZIPInputStream each add behavior and delegate the rest, so you compose features at runtime like new DataInputStream(new BufferedInputStream(new FileInputStream(...))). The gotchas are that order changes semantics (compress-then-encrypt differs from encrypt-then-compress), object identity sees the outermost wrapper rather than the wrapped core, and a deep stack obscures which layer did what when debugging. An abstract base decorator that delegates everything by default keeps concrete decorators from re-implementing the whole wide interface."
    },
    {
      "q": "When would you choose a Facade over an Adapter, and what's the smell to avoid?",
      "a": "Facade gives one simplified, unified entry point over many subsystem classes for convenience and decoupling — like an OrderFacade orchestrating inventory, payment, shipping, and notification — whereas Adapter converts a single interface into another for compatibility. A facade is additive, not restrictive: it offers an easier path for the common case without forbidding direct subsystem use. The smell is the god-facade that grows into a fifty-method dumping ground and re-couples everything it was meant to decouple; I keep facades thin and use-case oriented, split by bounded context. JdbcTemplate and a @Service over repositories are everyday facades."
    },
    {
      "q": "Bridge and Strategy have nearly identical UML. When is it actually a Bridge, and what problem does Bridge prevent?",
      "a": "Bridge is for two independent axes of variation that should evolve separately — Shape x Renderer, message x transport, JDBC API x vendor driver — so you make one axis the abstraction and the other the implementor and compose them, avoiding the combinatorial class explosion of VectorCircle/RasterCircle/VectorSquare. Strategy swaps one interchangeable algorithm behind an interface; the structure is the same delegation but the intent is a single pluggable behavior, not a structural separation of two hierarchies. The tell is catching yourself naming classes AdjectiveNoun for every pairing of two adjectives — that's a Bridge. SLF4J is literally called a bridge for exactly this reason."
    },
    {
      "q": "How does the JDK's Integer cache relate to Flyweight, and what bug does it cause?",
      "a": "Integer.valueOf returns shared, cached, immutable instances for -128..127 (the IntegerCache), which is exactly Flyweight — shared intrinsic state across many uses — and the String literal pool is the same idea. The bug is comparing boxed Integers with ==: it's true for small values because they're shared flyweights but silently false above 127 where new objects are created, so you always compare wrappers with .equals() or unbox to primitives. It's a favorite interview gotcha precisely because it's a side effect of a Flyweight optimization rather than something most people think about as a pattern."
    },
    {
      "q": "Composite gives you a transparency-vs-safety choice. Explain the trade-off and when Composite is the wrong tool.",
      "a": "Transparent Composite puts add/remove on the shared Component interface so leaves and composites are truly uniform, but leaves must implement child methods (usually throwing); safe Composite puts them only on Composite, preventing add() on a leaf but forcing clients to downcast to add children. GoF leans transparent; I pick per use case. Composite is wrong when the structure isn't genuinely a part-whole tree, or when leaf and container behavior diverge so much that a forced common interface lies — and deep trees can blow the stack, so naive recursion may need an iterative traversal. java.awt.Container and DOM Node are the canonical trees."
    }
  ],
  "12.3": [
    {
      "q": "Why do senior interviewers say 'a lambda is a Strategy,' and when should a strategy still be a real class?",
      "a": "A single-method functional interface — Comparator, Function, Predicate, Runnable — is exactly a strategy object, so passing a lambda is selecting a strategy; Java 8 made the pattern boilerplate-free, which is why most modern Strategy usage no longer needs explicit ConcreteStrategy classes, and a Map<key, lambda> can replace a growing switch. It should stay a real class or interface when the strategy has multiple methods (so it isn't a functional interface), holds non-trivial state, deserves a meaningful name, needs its own injected dependencies, or must be unit-tested as a type — a PaymentGateway with charge/refund/status stays an interface."
    },
    {
      "q": "Observer is everywhere. What's the number-one bug, and how do you prevent it?",
      "a": "The lapsed-listener memory leak: a long-lived subject (a static bus or singleton) holds strong references to observers that never unregister — typically short-lived ones like a request-scoped object or UI panel — so they can never be garbage-collected. I prevent it by returning an unsubscribe handle (an AutoCloseable) at registration, calling removeListener on close, or holding observers via weak references. Two related hazards: a slow or throwing observer can block or break notifications to the rest, so I isolate errors per-observer in the notify loop, and re-entrant subscription changes call for a snapshot or CopyOnWriteArrayList."
    },
    {
      "q": "Template Method vs Strategy — what's the core difference, and how do you get the Template Method effect without inheritance?",
      "a": "Template Method fixes the algorithm skeleton in a base class and lets subclasses override specific steps — inheritance, bound at compile time, varying some steps of a fixed flow; Strategy injects the whole algorithm as an object via composition, bound at runtime. The Hollywood Principle captures it: the base class calls down into subclass steps ('don't call us, we'll call you'). You get the effect without inheritance by passing the variant steps as lambdas to a method that owns the fixed skeleton — a functional template — which avoids the fragile-base-class coupling. Spring's JdbcTemplate actually blends both: Template Method for the resource skeleton, RowMapper as a Strategy callback."
    },
    {
      "q": "Walk me through Chain of Responsibility in a Servlet filter chain or Spring Security. What goes wrong in practice?",
      "a": "Each Filter does pre-work, then calls chain.doFilter() to pass control to the next link or the servlet, then can do post-work on the way back up; short-circuiting means simply not calling doFilter and writing the response (an auth filter returning 401). Spring Security's FilterChainProxy is literally an ordered list of such filters. What goes wrong is ordering — authentication must run before authorization, decompression before parsing, rate-limit before expensive work — and misordering creates security holes or wasted work. The other classic bugs are forgetting to call chain.next() so the request is silently dropped, or calling it twice and double-processing."
    },
    {
      "q": "State and Strategy share identical UML. How do you distinguish them, and when is the State pattern over-engineering?",
      "a": "The litmus test is who picks the next object: in State the concrete objects transition to one another over the entity's lifetime (state A decides 'now we're in state B') and states know about each other, whereas in Strategy the client or DI selects an independent behavior that's usually set once and the strategies don't know about each other. State shines when behavior varies across a finite set of statuses with illegal-transition rules and a switch(status) is spreading across many methods — and a Java enum with abstract methods is the cleanest implementation for simple machines. It's over-engineering for two-ish states or trivial transitions, where a boolean or simple switch is clearer."
    },
    {
      "q": "When does Command earn its complexity, and why is implementing reliable undo harder than just doing the inverse operation?",
      "a": "Command earns it when you need undo/redo, queueing, scheduling, retry, logging/replay, or to decouple invoker from receiver — and Runnable/Callable submitted to an ExecutorService is exactly Command, with the executor as invoker. It's ceremony when a plain method call or lambda suffices and you'll never queue or undo it. Reliable undo is hard because the inverse can be lossy: un-deleting loses metadata, un-setting loses the prior value, so undo() must capture enough before-state — effectively a Memento snapshot — rather than just running the reverse op. Logging the command stream is also the seed of event sourcing."
    },
    {
      "q": "Visitor lets you add operations to a type hierarchy, but it has a famous trade-off. Explain it and how Java 21 changes the calculus.",
      "a": "Visitor moves operations into visitor classes and uses double dispatch (element.accept(visitor) then visitor.visitConcrete(this)) so you can add operations like print/evaluate/typecheck over a stable hierarchy without touching the element classes. The trade-off is the Expression Problem: adding operations is easy but adding a new element type is hard because every visitor must gain a method — the opposite of the usual OO bias toward easy subtype addition. Java 21's sealed hierarchies plus pattern-matching switch give exhaustive, compile-checked dispatch over a closed set of types, expressing the same per-type operation more directly and often removing the need for the accept/visit ceremony entirely."
    }
  ],
  "12.4": [
    {
      "q": "Java 8 lambdas didn't add patterns — they made several disappear. Which ones, and what's the heuristic for lambda vs named class?",
      "a": "Single-method patterns collapse into a lambda: Strategy (Comparator/Predicate), Command (Runnable/Consumer submitted to an executor), Factory (Supplier or a constructor reference like ArrayList::new), and the variant step of Template Method as a higher-order function; Decorator becomes function composition via andThen. The heuristic is to reach for a lambda when the behavior is small, local, stateless, and single-method, and keep a named class when it has state, deserves a name, has multiple methods (so it isn't a functional interface), needs its own injected dependencies, or must be mocked and tested as a type. Watch the pitfalls — capturing this can leak the enclosing object, and checked exceptions don't fit the standard functional interfaces."
    },
    {
      "q": "How would you narrate the patterns inside Spring's everyday machinery — AOP, the *Template classes, Spring Data — without just name-dropping?",
      "a": "I'd tie each feature to its pattern in passing: @Transactional is a Proxy adding Decorator-style cross-cutting behavior (JDK proxy if there's an interface, CGLIB subclass otherwise); JdbcTemplate and RestTemplate are Template Method providing the fixed acquire-execute-translate-release skeleton with Strategy callbacks like RowMapper; Spring Data repositories are the Repository pattern realized as a runtime-generated proxy implementation. BeanFactory itself is an Abstract Factory plus Service Locator over the bean graph. The point of naming them is communication in design reviews, not GoF trivia — I'd always lead with the problem the feature solves and only attach the label as shorthand."
    },
    {
      "q": "Lay out the Repository / Service / DTO layering and justify each boundary. When would you collapse layers?",
      "a": "Repository presents a collection-like interface (save/findById) hiding the persistence mechanism so the service treats storage like an in-memory collection and stays swappable and testable; the Service Layer owns use-cases, orchestration, and transaction boundaries — @Transactional lives here, not on the controller or repository; DTOs at the API boundary decouple the contract from the schema, prevent leaking sensitive fields like password hashes, and avoid lazy-init exceptions from serializing JPA entities. I'd collapse layers for a tiny CRUD service — controller calling repository directly, no DTO when the contract equals the schema — because five layers on a 200-line app is cargo-cult ceremony. The smell on the other side is a service that's pure pass-through to the repo."
    },
    {
      "q": "What is the anemic domain model, and is it always a problem?",
      "a": "Anemic means entities are bags of getters and setters with no behavior while all logic lives in service classes — procedural code in OO clothing — so behavior that belongs with the data is scattered, encapsulation is lost, and anyone can put the object in an illegal state like setBalance(-100). It's a smell, not a crime: for simple CRUD with a transaction-script style it's perfectly fine and simpler. The fix where rich invariants exist is to move behavior onto the entity — account.withdraw(amount) validates and mutates in one place — and reserve services for orchestration across aggregates. I'd only call it out where genuine domain rules are being scattered."
    },
    {
      "q": "Explain the concurrency hazards in Executors.newFixedThreadPool, CompletableFuture's default executor, and ThreadLocal with a pool.",
      "a": "newFixedThreadPool uses an unbounded LinkedBlockingQueue, so a fast producer is a slow-motion OOM — I'd construct ThreadPoolExecutor directly with a bounded queue and an explicit RejectedExecutionHandler. CompletableFuture's async stages default to the common ForkJoinPool, so running blocking IO there starves CPU-bound work app-wide; I pass an explicit Executor for blocking stages or use virtual threads. ThreadLocal plus a pool is a correctness bug because pooled threads are reused, so a value set during request A bleeds into request B unless you remove() in a finally — on JDK 21 ScopedValue is the safer structured alternative, and for IO-bound work I'd prefer a virtual-thread-per-task executor rather than pooling."
    },
    {
      "q": "Give me a concrete heuristic for recognizing when a pattern is over-engineering, with examples.",
      "a": "Patterns are responses to forces — present, nameable pain — so if I can't say what varies or couples today, I'm decorating, not designing. Speculative generality is the classic trap: a strategy interface or abstract factory for a second variant that doesn't exist yet (YAGNI), countered by the Rule of Three — stay concrete until the second or third real variation reveals the true axis of change. Symptoms of pattern fever include a factory for a single implementation, DTOs copying entities 1:1, an event bus for two in-process calls, and CQRS on a plain CRUD app where it just buys eventual-consistency tax. Start simple and add structure when pain actually appears."
    },
    {
      "q": "How do you structure a strong answer to an open-ended 'how would you design X' design question?",
      "a": "I use a four-beat structure: name the force (what varies or couples here), state the choice (the pattern, lightly named, and its realization as a lambda, enum, or class), state the trade-off (what it costs versus buys and why that's justified by a present need), and name the alternative plus the trigger to switch (if it became multi-method or needed runtime swapping I'd move to X). I prefer the lightest tool first — a lambda before a class, an enum before a hierarchy, a Map before a Strategy interface — and patterns the platform already provides like Comparator, BlockingQueue, or @Transactional. The red flags interviewers listen for are name-dropping with no force and absolutism like 'Singletons are always bad'; nuance and trade-off awareness signal seniority far more than reciting the catalog."
    }
  ],
  "13.1": [
    {
      "q": "How do you reverse a string in Java, and which approach is best?",
      "a": "Idiomatic and fastest is new StringBuilder(s).reverse().toString(). For an interview showing you understand the mechanics, use a char array with two pointers swapping ends inward: O(n) time, O(n) space for the array, O(1) extra beyond it. Recursion is elegant but risks StackOverflow on very long strings and uses O(n) stack. Strings are immutable so you always build a new one; there is no true in-place reverse of a String."
    },
    {
      "q": "What does String.compareTo return, and how does it order strings?",
      "a": "compareTo does a lexicographic (dictionary) comparison character by character using Unicode values. It returns a negative int if this string sorts before the argument, zero if equal, and positive if after. If one is a prefix of the other, the shorter sorts first and the return value is the length difference. This is the natural ordering used by Collections.sort, TreeSet, and TreeMap; a Comparator lets you define a different ordering (e.g. by length, or case-insensitive)."
    },
    {
      "q": "Why should you never compare strings with == , and when is it a subtle trap?",
      "a": "== compares references (are these the same object), not contents. String literals are interned into a shared pool, so \"a\"==\"a\" happens to be true, which lures beginners into thinking == compares text. But new String(\"a\") == \"a\" is false, and any runtime-built string (concatenation, input, StringBuilder.toString()) is a distinct object, so == fails. Always use equals() for content, or equalsIgnoreCase() to ignore case."
    },
    {
      "q": "How do you check if two strings are anagrams efficiently?",
      "a": "The O(n) approach counts characters: for lowercase letters use an int[26], increment for the first string and decrement for the second, then verify every count is zero (also check equal lengths first). For a full Unicode alphabet use a HashMap<Character,Integer>. Sorting both strings and comparing is simpler to write but O(n log n). The counting approach is the interview-preferred answer."
    },
    {
      "q": "How do you find the first non-repeating character in a string?",
      "a": "Use a LinkedHashMap<Character,Integer> to count occurrences while preserving insertion order, then return the first key whose count is 1 -- O(n) with one pass to count and one to scan. For a fixed alphabet an int[256] frequency array plus a second pass over the original string works and avoids the map overhead. The key insight is that you need to preserve original order, which a plain HashMap does not."
    }
  ],
  "13.2": [
    {
      "q": "How do you solve Two Sum in O(n), and what is the idea?",
      "a": "Iterate once with a HashMap from value to index. For each element x, check whether target - x is already in the map; if so you have the pair, otherwise store x. This trades O(n) extra space for O(n) time versus the O(n^2) brute-force double loop. The two-pointer method is O(n log n) because it requires sorting, and sorting loses the original indices unless you track them."
    },
    {
      "q": "Explain Kadane's algorithm for maximum subarray sum.",
      "a": "Walk the array keeping a running sum 'current': at each element, current = max(element, current + element) -- i.e. either extend the previous subarray or start fresh at this element -- and track the best value seen. It is O(n) time, O(1) space. The insight is that a negative running prefix can never help a future subarray, so you reset. Brute force checking every subarray is O(n^2)."
    },
    {
      "q": "How do you find the missing number in an array of 1..n, and why prefer XOR?",
      "a": "Two O(n) tricks: (1) expected sum n(n+1)/2 minus the actual sum gives the missing value -- simple but the sum can overflow int for large n (use long). (2) XOR all indices 1..n and all array values together; pairs cancel and the leftover is the missing number -- no overflow risk and O(1) space. XOR is the safer answer when n is large."
    },
    {
      "q": "How do you move all zeroes to the end of an array while keeping order?",
      "a": "Use a two-pointer write index: scan with a read pointer, and whenever you see a non-zero, write it at the write index and advance write; after the scan, fill the remaining positions from write to the end with zeroes. This is O(n) time, O(1) space, and stable (preserves the relative order of non-zero elements). A swap-based variant avoids the final fill."
    },
    {
      "q": "How do you find the second largest element in one pass?",
      "a": "Track two variables, largest and secondLargest, initialised to negative infinity. For each element: if it is greater than largest, shift largest into secondLargest and update largest; else if it is greater than secondLargest and not equal to largest, update secondLargest. O(n) time, O(1) space, and it handles duplicates of the maximum correctly. Sorting works but is O(n log n)."
    }
  ],
  "13.3": [
    {
      "q": "How do you check if a number is prime efficiently?",
      "a": "Test divisibility only up to sqrt(n): if no divisor exists below the square root, none exists above it. Further, after handling 2 and 3, test only numbers of the form 6k +- 1. That makes a single check O(sqrt(n)). If you need all primes up to N, the Sieve of Eratosthenes computes them in about O(N log log N), which is far better than checking each number individually."
    },
    {
      "q": "Why does factorial overflow, and how do you compute large factorials?",
      "a": "A long overflows past 20! (21! exceeds Long.MAX_VALUE and silently wraps to a wrong, often negative, value). For arbitrarily large factorials use java.math.BigInteger, which grows as needed. The interview point is recognising the silent overflow and reaching for BigInteger, not just writing the recursion."
    },
    {
      "q": "Compare the ways to compute Fibonacci and their complexity.",
      "a": "Naive recursion recomputes overlapping subproblems and is O(2^n) -- exponential and unusable beyond ~40. Memoization (top-down) caches results for O(n) time, O(n) space. Bottom-up iteration is O(n) time and can be O(1) space by keeping only the last two values -- the preferred answer. (A matrix-power method reaches O(log n) but is rarely needed.)"
    },
    {
      "q": "How do you compute a^b in O(log n) time?",
      "a": "Exponentiation by squaring: if the exponent is even, a^b = (a^(b/2))^2; if odd, a^b = a * a^(b-1). Each step halves the exponent, so it runs in O(log b) multiplications instead of the naive O(b) loop. It can be written recursively or iteratively by scanning the exponent's bits. This is essential for modular exponentiation in cryptography."
    },
    {
      "q": "Why compute LCM as (a / gcd) * b rather than (a * b) / gcd?",
      "a": "Both are mathematically equal, but a * b can overflow before you divide, whereas dividing a by the gcd first keeps the intermediate value small, then multiplying by b is less likely to overflow. The gcd itself comes from the Euclidean algorithm gcd(a,b) = gcd(b, a % b), which is O(log(min(a,b)))."
    }
  ],
  "13.4": [
    {
      "q": "What are the essential parts of a correct recursive function?",
      "a": "A base case that stops the recursion (and returns a known answer for the smallest input), and a recursive case that reduces the problem toward the base case and combines the sub-result. Missing or wrong base cases cause infinite recursion and StackOverflowError. Each call adds a frame to the call stack, so deep recursion has O(depth) space cost -- which is why an iterative version is sometimes preferred."
    },
    {
      "q": "Explain the recursive idea behind Tower of Hanoi and its move count.",
      "a": "To move n disks from source to target using an auxiliary peg: recursively move the top n-1 disks to the auxiliary peg, move the largest disk to the target, then recursively move the n-1 disks from auxiliary onto the target. The recurrence T(n) = 2*T(n-1) + 1 solves to 2^n - 1 moves, which is the minimum possible."
    },
    {
      "q": "What is backtracking, and how does pruning make problems like N-Queens feasible?",
      "a": "Backtracking builds a solution incrementally and abandons a partial candidate ('backtracks') as soon as it cannot possibly lead to a valid full solution. In N-Queens you place one queen per row and, before placing, check that no earlier queen shares the column or a diagonal (two queens attack diagonally when |row1-row2| == |col1-col2|); pruning invalid placements early prunes huge branches of the search tree, turning an intractable brute force into something that solves n=8 instantly."
    },
    {
      "q": "How do you generate all subsets (the power set) of a set?",
      "a": "Two classic ways: (1) recursive include/exclude -- for each element, branch into 'take it' and 'skip it', producing 2^n subsets; (2) bitmask iteration -- loop mask from 0 to 2^n - 1 and include element i whenever bit i of mask is set. Both are O(2^n) because there are 2^n subsets; the bitmask version is iterative and avoids recursion."
    },
    {
      "q": "In Combination Sum, how do you avoid producing duplicate combinations?",
      "a": "Pass a start index into the recursion so each call only considers elements from the current position onward, never revisiting earlier elements -- this ensures combinations are generated in non-decreasing index order and duplicates like [2,3] and [3,2] are not both produced. When elements may be reused you recurse with the same index; when each may be used once you advance to index+1. Sorting first also lets you break early once the running sum exceeds the target."
    }
  ],
  "14.1": [
    {
      "q": "What is the difference between Heap and Stack memory?",
      "a": "The heap is a single shared region where all objects and arrays live; it is managed by the garbage collector and is where GC pauses happen. The stack is per-thread: each thread has its own stack of frames holding local variables, operand values, and return addresses, freed automatically when a method returns (LIFO). Primitives and object references sit on the stack, but the objects they point to live on the heap. Stack overflow (deep recursion) throws StackOverflowError; exhausting the heap throws OutOfMemoryError: Java heap space."
    },
    {
      "q": "How does the JVM memory model work?",
      "a": "At runtime the JVM divides memory into the heap (shared: young + old generations), per-thread stacks, the Program Counter register, native method stacks, and native-memory areas like Metaspace and the code cache. Separately, the Java Memory Model (JMM, JLS Ch. 17) defines the concurrency rules: the happens-before relationship that governs when one thread's writes become visible to another. volatile, synchronized, final-field semantics, and Thread.start/join all establish happens-before edges; without them the JVM and CPU are free to reorder and cache reads/writes, causing visibility bugs."
    },
    {
      "q": "Explain the Class Loading lifecycle.",
      "a": "Three phases: Loading (a classloader reads the bytecode and creates the Class object), Linking, and Initialization. Linking splits into Verification (bytecode is type-safe and well-formed), Preparation (static fields allocated and set to default zero values), and Resolution (symbolic references resolved to direct references, may be lazy). Initialization runs static initializers and static-field assignments in <clinit>, triggered on first active use and guaranteed to run exactly once per class in a thread-safe way."
    },
    {
      "q": "What are Bootstrap, Platform, and Application ClassLoaders?",
      "a": "They form a delegation hierarchy: a loader first asks its parent before loading a class itself (parent-first / delegation model). The Bootstrap loader (written in native code, null in Java) loads core JDK classes like java.lang.*. The Platform loader (called Extension loader before Java 9) loads platform modules. The Application (System) loader loads classes from the application classpath. Delegation prevents core classes from being spoofed and ensures a single definition of each core type."
    },
    {
      "q": "How does Garbage Collection work internally?",
      "a": "GC reclaims objects that are no longer reachable from GC roots (thread stacks, static fields, JNI references). Modern collectors are generational, built on the weak generational hypothesis: most objects die young. New objects are allocated in the young generation's Eden; a minor GC copies survivors between survivor spaces and ages them, and objects that survive enough cycles are promoted (tenured) to the old generation. Collection uses mark-sweep(-compact) or copying algorithms, often with a Stop-The-World pause to walk the object graph, though concurrent collectors do most marking while the app runs."
    },
    {
      "q": "G1 GC vs ZGC vs Serial GC?",
      "a": "The core trade-off is pause time vs throughput vs footprint. Serial is simplest with the least overhead but is single-threaded STW and pauses scale with heap size — good for small heaps/containers. G1 (default since Java 9) divides the heap into regions and balances a configurable pause target (e.g. 200ms) against throughput on large heaps. ZGC (and Shenandoah) are concurrent, do compaction with load/colored-pointer barriers, and target sub-millisecond pauses roughly independent of heap size (multi-terabyte heaps) at some throughput/CPU cost."
    },
    {
      "q": "What triggers a Full GC?",
      "a": "A Full GC collects the entire heap (young + old + often Metaspace) and is usually the most expensive pause. Common triggers: the old generation filling up (promotion failure or an allocation that cannot be satisfied), Metaspace exhaustion, an explicit System.gc() call, and in G1 a concurrent-cycle failure that degrades to a full collection. Heap fragmentation and undersized heaps make them frequent. Frequent or long Full GCs are a red flag for leaks or misconfigured sizing."
    },
    {
      "q": "How do you identify memory leaks in production?",
      "a": "Watch the trend: after each Full GC the used old-gen baseline keeps climbing instead of returning to a steady level — that sawtooth-with-rising-floor pattern signals a leak. Enable GC logging and monitor heap-usage-after-GC via JMX/Micrometer/Prometheus. Capture a heap dump (jmap or -XX:+HeapDumpOnOutOfMemoryError) and analyze dominator trees in Eclipse MAT to find which objects retain the most memory and their GC-root reference chains. Classic culprits: unbounded caches/collections, ThreadLocals never removed, and unclosed resources or listeners."
    },
    {
      "q": "What is a Heap Dump and when would you analyze it?",
      "a": "A heap dump is a snapshot of every object on the heap at a point in time — classes, fields, references, and retained sizes — typically written as an .hprof file. You analyze it to diagnose memory leaks and OutOfMemoryErrors: what is consuming memory and, via the dominator tree and reference chains, what is keeping it alive. Capture it with jmap -dump, jcmd GC.heap_dump, or automatically with -XX:+HeapDumpOnOutOfMemoryError, then open it in Eclipse MAT or VisualVM. It is a heavyweight, stop-the-world operation, so take it deliberately."
    },
    {
      "q": "How does the JIT Compiler improve performance?",
      "a": "The JVM starts by interpreting bytecode, and the JIT compiles frequently executed (hot) methods and loops to native machine code at runtime. HotSpot uses tiered compilation: C1 (client) compiles quickly with light optimization, then C2 (server) recompiles the hottest code with aggressive optimizations. Because it profiles the actual running workload, the JIT applies speculative optimizations — inlining, loop unrolling, dead-code elimination, escape analysis — that a static compiler cannot, and it deoptimizes back to the interpreter if a speculative assumption (e.g. a monomorphic call site) is later violated."
    },
    {
      "q": "What is Escape Analysis?",
      "a": "Escape analysis is a JIT optimization that determines whether an object's lifetime escapes the method or thread that created it. If an object does not escape, the JIT can allocate it on the stack (or eliminate it entirely via scalar replacement, keeping its fields in registers) instead of the heap, and can remove synchronization on it (lock elision). This reduces heap allocation and GC pressure. It is enabled by default (-XX:+DoEscapeAnalysis); note it is not a guarantee — it depends on the JIT actually compiling and proving non-escape."
    },
    {
      "q": "What is Metaspace and how is it different from PermGen?",
      "a": "Metaspace stores class metadata — class structures, method bytecode, constant pool. PermGen (the permanent generation) served this role until it was removed in Java 8 and replaced by Metaspace. The key difference: PermGen lived inside the heap with a fixed max size (-XX:MaxPermSize), so class-heavy apps hit OutOfMemoryError: PermGen space; Metaspace lives in native (off-heap) memory and grows dynamically by default. You can still cap it with -XX:MaxMetaspaceSize, and leaks (e.g. classloader leaks) surface as OutOfMemoryError: Metaspace."
    },
    {
      "q": "How do you troubleshoot OutOfMemoryError?",
      "a": "First read the message — it names the cause: Java heap space (heap too small or a leak), Metaspace (classloader leak), GC overhead limit exceeded (GC running constantly for little gain), unable to create new native thread, or Direct buffer memory. Always run with -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=... so you get a dump at the moment of failure, then analyze it in Eclipse MAT (dominator tree, leak suspects). Confirm whether it is a genuine leak (rising post-GC baseline) versus undersized heap (raise -Xmx) or a load spike. Check GC logs for the pattern before OOM."
    },
    {
      "q": "How do you troubleshoot high CPU usage in JVM applications?",
      "a": "Identify the hot OS thread first: top -H -p <pid> (Linux) shows per-thread CPU; convert the offending thread ID to hex and match its nid=0x... in a jstack thread dump to find the exact Java stack. Take several thread dumps a few seconds apart to see what is consistently running. Distinguish application hot paths (tight loops, inefficient algorithms, regex, serialization) from GC: if GC threads dominate, it is a memory/GC problem, so check GC logs. For precise hotspots use a sampling profiler like async-profiler (flame graphs) or JFR."
    },
    {
      "q": "What tools do you use for JVM performance analysis?",
      "a": "Command-line JDK tools: jstack (thread dumps / deadlocks), jmap (heap dumps, histograms), jstat (live GC/heap stats), and jcmd (the modern Swiss-army entry point for dumps, JFR control, and diagnostics). For low-overhead production profiling, Java Flight Recorder (JFR) analyzed in JDK Mission Control, and async-profiler for CPU/allocation flame graphs. GUI/monitoring: VisualVM for live inspection, and Eclipse MAT for offline heap-dump analysis. In production these are backed by APMs (Datadog, New Relic) and Micrometer/Prometheus/Grafana dashboards over JMX metrics."
    }
  ],
  "14.2": [
    {
      "q": "How does @Transactional work internally?",
      "a": "Spring AOP creates a proxy around the bean. When an external caller invokes an annotated method, the proxy's TransactionInterceptor runs first: it asks a PlatformTransactionManager to start or join a transaction, binds the Connection/EntityManager to the current thread, then invokes the real method. On normal return it commits; on a rollback-triggering exception it rolls back. The boundary is entirely in the surrounding proxy, not the method body."
    },
    {
      "q": "How does Spring use proxies for transaction management?",
      "a": "At startup a BeanPostProcessor wraps each transactional bean in a proxy: a JDK dynamic proxy if the bean implements an interface, otherwise a CGLIB subclass proxy. Callers get the proxy, not the raw bean, so every external call passes through the TransactionInterceptor that opens/commits/rolls back around the target method. Only calls crossing the proxy boundary are advised."
    },
    {
      "q": "What is the self-invocation problem?",
      "a": "When a method calls another @Transactional method on this (the same instance), the call goes straight to the target object and never touches the proxy, so the transaction advice does not run. E.g. methodA() calling this.methodB() ignores methodB's @Transactional and any REQUIRES_NEW. Fixes: move the method to another bean, self-inject the proxy, or use AopContext.currentProxy()."
    },
    {
      "q": "Why does @Transactional sometimes not work?",
      "a": "Common causes: self-invocation (an internal this.method() call bypasses the proxy); the method is not public; the class is not a Spring bean; a checked exception was thrown but rollback defaults only cover unchecked exceptions; the exception was caught and swallowed; wrong propagation; or a data path that never binds to the managed connection."
    },
    {
      "q": "What is transaction synchronization?",
      "a": "Spring keeps per-thread state in TransactionSynchronizationManager, binding resources like the JDBC Connection or JPA EntityManager to the thread so repositories reuse the same connection within a transaction. You can register TransactionSynchronization callbacks (beforeCommit, afterCommit, afterCompletion) to run logic tied to the transaction lifecycle, e.g. publishing an event only after a successful commit."
    },
    {
      "q": "How do you debug transaction issues?",
      "a": "Enable DEBUG/TRACE logging for org.springframework.transaction and the ORM/JDBC transaction manager to see begins, joins, commits, and rollbacks. Verify the method is actually proxied (not self-invoked, public, non-final), that rollbackFor covers the exception, and the propagation. Check TransactionSynchronizationManager.isActualTransactionActive(), watch for pool exhaustion, and confirm autocommit is off."
    },
    {
      "q": "What is the difference between REQUIRED and REQUIRES_NEW?",
      "a": "REQUIRED (default) joins the caller's active transaction or starts one if none exists, so inner and outer share one physical transaction and commit/rollback together. REQUIRES_NEW always suspends the current transaction and starts a brand-new independent one on its own connection, committing or rolling back on its own without affecting the outer."
    },
    {
      "q": "Explain all transaction propagation types.",
      "a": "Seven: REQUIRED (join or start, default); REQUIRES_NEW (suspend current, always start a new independent tx); NESTED (nested tx via a JDBC savepoint, inner can roll back to savepoint); SUPPORTS (join if a tx exists, else non-transactional); NOT_SUPPORTED (suspend any tx, run non-transactionally); MANDATORY (must have an existing tx, else throw); NEVER (must have no tx, else throw)."
    },
    {
      "q": "What happens during nested transactions?",
      "a": "With Propagation.NESTED, Spring sets a JDBC savepoint at the start of the inner method rather than opening a separate physical transaction. If the inner fails it rolls back only to that savepoint, leaving the outer transaction intact to continue and commit as one unit. It requires a savepoint-capable JDBC driver and is not supported by plain JPA. This differs from REQUIRES_NEW, which uses a fully separate transaction and connection."
    },
    {
      "q": "What is transaction isolation?",
      "a": "Isolation defines how much one in-flight transaction is shielded from the effects of other concurrent transactions — the 'I' in ACID. Higher isolation prevents more read anomalies (dirty, non-repeatable, phantom reads) but takes stronger/longer locks or more MVCC overhead, reducing concurrency. It is a trade-off between consistency and throughput."
    },
    {
      "q": "Explain all isolation levels.",
      "a": "Four standard levels: READ_UNCOMMITTED (sees uncommitted changes; allows dirty, non-repeatable, phantom); READ_COMMITTED (only committed data; prevents dirty, allows non-repeatable and phantom); REPEATABLE_READ (same row reread returns same value; prevents dirty and non-repeatable, may allow phantoms); SERIALIZABLE (as if run one at a time; prevents all three, highest cost)."
    },
    {
      "q": "What causes dirty reads?",
      "a": "A dirty read happens when one transaction reads a row another transaction modified but has not yet committed. If that other transaction later rolls back, the first acted on data that never truly existed. Dirty reads are only possible at READ_UNCOMMITTED; READ_COMMITTED and above prevent them by exposing only committed data."
    },
    {
      "q": "What causes phantom reads?",
      "a": "A phantom read occurs when a transaction reruns a range query and gets a different set of rows because another transaction inserted or deleted matching rows and committed in between. It differs from a non-repeatable read, which is about an existing row's value changing rather than the row set. Phantoms are prevented by SERIALIZABLE via range/predicate locks, and by MySQL InnoDB's next-key locks at REPEATABLE_READ."
    },
    {
      "q": "What exceptions trigger transaction rollback?",
      "a": "By default Spring rolls back only on unchecked exceptions — RuntimeException and Error — and commits normally on checked exceptions. So a checked IOException will commit unless configured otherwise. Use @Transactional(rollbackFor = Exception.class) to roll back on checked exceptions, or noRollbackFor to exclude specific unchecked ones. Catching and swallowing the exception signals no rollback."
    },
    {
      "q": "Why should API calls be avoided inside transactions?",
      "a": "An external HTTP/RPC call inside a transaction holds the DB connection and any row locks for the entire call. A slow or hung endpoint keeps the connection checked out and locks held, which under load exhausts the connection pool and causes lock contention or deadlocks. Best practice: do the remote call outside the transaction boundary, keep transactions short, or use an afterCommit callback for post-commit side effects."
    }
  ],
  "14.3": [
    {
      "q": "What problem does the Factory Pattern solve?",
      "a": "It decouples object creation from the code that uses the object. Instead of calling `new ConcreteType()` directly, a client asks a factory method for an object of a common interface/supertype, so the concrete class can vary without changing callers. This centralizes construction logic, hides complex instantiation, and lets you swap implementations or add new subtypes with minimal ripple. It embodies the `program to an interface` principle and the Open/Closed Principle."
    },
    {
      "q": "Factory Pattern vs Abstract Factory Pattern?",
      "a": "A Factory Method produces one product via a single overridable method. An Abstract Factory is a factory of factories: it exposes multiple related creation methods and produces whole families of related objects meant to be used together (e.g. a `GUIFactory` making a matching `Button` and `Checkbox` for Windows vs Mac). Rule of thumb: Factory Method = one product, Abstract Factory = a family of products kept consistent, usually implemented with a set of Factory Methods."
    },
    {
      "q": "When should you use the Builder Pattern?",
      "a": "When an object has many constructor parameters (especially optional ones) and telescoping constructors become unreadable, or when construction happens in steps. The Builder gives a fluent, named-parameter-like API (`new Pizza.Builder().size(12).cheese(true).build()`), avoiding ambiguous long argument lists and letting you validate invariants in `build()`. It is also useful when the same construction process must yield different representations."
    },
    {
      "q": "Why is Builder preferred for immutable objects?",
      "a": "An immutable object cannot expose setters, so all state must be supplied before construction completes. The Builder collects the values incrementally and passes them to a private constructor in a single call, letting the final object have only `final` fields and no mutators. It also allows validation and defaulting in `build()` before the immutable instance exists, and avoids exposing a half-initialized object, which is safer than a no-arg constructor plus setters."
    },
    {
      "q": "How do you implement a thread-safe Singleton?",
      "a": "Several safe idioms: eager `static final` (classloader guarantees safety but created eagerly); double-checked locking with a `volatile` field and a null check inside and outside a `synchronized` block (`volatile` prevents seeing a partially constructed object); the lazy-holder / Bill Pugh idiom using a private static nested holder class the JVM initializes lazily and thread-safely; and the enum singleton, which per Effective Java is the best approach — concise, thread-safe, and serialization/reflection-attack safe."
    },
    {
      "q": "What are the drawbacks of Singleton?",
      "a": "It introduces global mutable state, which makes reasoning harder and causes hidden coupling between unrelated components. Dependencies become implicit (code calls `Singleton.getInstance()` internally instead of receiving collaborators), hiding the true dependency graph. That makes unit testing and mocking difficult because you cannot easily substitute the instance, and shared mutable state can create concurrency bugs. It is often considered an anti-pattern; DI-managed single instances are usually preferable."
    },
    {
      "q": "Explain the Strategy Pattern with a real-world example.",
      "a": "Strategy defines a family of interchangeable algorithms behind a common interface and lets the client pick one at runtime, replacing conditional branching with polymorphism. Real-world example: a payment service depends on a `PaymentStrategy` interface with `CreditCard`, `PayPal`, and `UPI` implementations; the checkout selects the concrete strategy at runtime. Another classic is a sort accepting different `Comparator` strategies, or a route planner switching between fastest/shortest/no-tolls algorithms."
    },
    {
      "q": "When would you use the Observer Pattern?",
      "a": "When one object (the subject) must notify many dependents automatically when its state changes, without being tightly coupled to who they are. Use it for publish/subscribe scenarios: UI listeners reacting to model changes, event notifications, or keeping multiple views consistent with one data source. It enables one-to-many broadcast and lets observers be added/removed dynamically, at the cost of non-obvious update ordering and potential memory leaks if listeners are not deregistered."
    },
    {
      "q": "How is Observer used in event-driven systems?",
      "a": "Event-driven systems generalize Observer: producers publish events and subscribers register interest, decoupling emitter from handlers. In Java this shows up as `PropertyChangeListener`, Spring's `ApplicationEvent`/`@EventListener`, GUI event listeners, and reactive streams (`Publisher`/`Subscriber` in Reactive Streams). At larger scale the same idea underlies message brokers and event buses (Kafka topics, pub/sub), where the broker delivers events to many independent consumers asynchronously."
    },
    {
      "q": "How is the Template Method Pattern different from Strategy?",
      "a": "Template Method uses inheritance: a base class defines the skeleton of an algorithm in a `final` method and defers specific steps to overridable (often `abstract`) hook methods in subclasses — the flow is fixed at compile time. Strategy uses composition: the whole algorithm is an object plugged in at runtime and swapped freely. Template Method varies steps of one algorithm via subclassing (`is-a`); Strategy swaps entire algorithms via delegation (`has-a`). `JdbcTemplate` is Template Method; a `Comparator` is Strategy."
    },
    {
      "q": "Adapter Pattern vs Decorator Pattern?",
      "a": "Both wrap an object, but with different intent. An Adapter converts one interface into another so incompatible types can work together — it changes the interface without adding behavior (e.g. wrapping a legacy API, or `InputStreamReader` bridging bytes to chars). A Decorator keeps the same interface but adds responsibilities dynamically by wrapping, and decorators can be stacked (e.g. `BufferedInputStream` wrapping a `FileInputStream`). Summary: Adapter changes the interface, Decorator enhances behavior while preserving the interface."
    },
    {
      "q": "What problem does the Proxy Pattern solve?",
      "a": "A Proxy provides a surrogate with the same interface as a real object to control access to it, inserting logic before/after delegating. Common variants: virtual proxy for lazy/expensive initialization, protection proxy for access control, remote proxy for a stub to a remote object, and smart proxy for cross-cutting concerns like caching, logging, or reference counting. It lets you add these concerns transparently without changing the real subject or its clients — the basis of Spring AOP and `@Transactional`."
    },
    {
      "q": "What is Dependency Injection and which pattern does it use?",
      "a": "Dependency Injection is a form of Inversion of Control (IoC): instead of an object constructing or looking up its collaborators, they are supplied from outside (via constructor, setter, or field). It implements the Dependency Inversion Principle — high-level code depends on abstractions and a container/assembler wires concrete implementations in. It relates to the Strategy idea (inject interchangeable implementations behind an interface) and is the inversion of the Service Locator pattern, where code pulls dependencies rather than having them pushed. The result is looser coupling and far easier testing/mocking."
    },
    {
      "q": "Which design patterns are commonly used in Spring Framework?",
      "a": "Many: Singleton (default bean scope), Factory (`BeanFactory`/`ApplicationContext` and `FactoryBean`), Proxy (AOP and `@Transactional`/`@Async` via JDK or CGLIB proxies), Template Method (`JdbcTemplate`, `RestTemplate`, `TransactionTemplate`), Observer (`ApplicationEvent` and `@EventListener`), Adapter (`HandlerAdapter` in Spring MVC), plus Decorator and Strategy."
    },
    {
      "q": "Which design patterns are most commonly used in Microservices?",
      "a": "Architectural patterns dominate: API Gateway (single entry point, routing, aggregation), Circuit Breaker and Bulkhead (fault isolation/resilience), Saga (distributed transactions via choreography or orchestration), CQRS (often with Event Sourcing), Service Registry/Discovery, Sidecar/Ambassador (offload cross-cutting concerns), and Strangler Fig (incrementally replace a monolith). Database-per-service and classic GoF patterns (Factory, Strategy, Proxy) still apply within each service."
    }
  ],
  "14.4": [
    {
      "q": "What is the difference between == and equals()?",
      "a": "`==` compares references for objects (same instance?) and raw values for primitives. `equals()` compares logical equality; the default `Object.equals()` just uses `==`, so it is only meaningful once a class overrides it (String, wrappers, collections do). Two distinct `new String(\"a\")` are `equals()` but not `==`."
    },
    {
      "q": "Why must you override hashCode() when you override equals()?",
      "a": "The contract requires equal objects to have equal hash codes. Hash collections pick a bucket by `hashCode()` then compare with `equals()` inside it; if you override only `equals()`, two logically-equal keys can hit different buckets, so `get`/`contains` fails to find a present entry. Unequal objects sharing a hash is legal (just a collision)."
    },
    {
      "q": "What is the difference between an abstract class and an interface (Java 8+)?",
      "a": "A class extends one abstract class but implements many interfaces. Abstract classes hold state, constructors, and any access modifier; interfaces hold constants plus `default`/`static`/`private` methods and no instance state. Use an abstract class for an is-a hierarchy with shared state, an interface for a capability contract; `default` methods let interfaces evolve without breaking implementers."
    },
    {
      "q": "What are checked vs unchecked exceptions?",
      "a": "Checked exceptions extend `Exception` (not `RuntimeException`) and must be declared or caught — compiler-enforced, for recoverable conditions like `IOException`. Unchecked extend `RuntimeException`, are not enforced, and model programming bugs like `NullPointerException`. `Error` is also unchecked and signals unrecoverable JVM problems you should not catch."
    },
    {
      "q": "What do final, finally, and finalize each mean?",
      "a": "Unrelated despite similar names. `final` is a modifier: a variable can't be reassigned, a method can't be overridden, a class can't be subclassed. `finally` is a block after try/catch that always runs for cleanup. `finalize()` was a GC callback on `Object`; it is deprecated and unreliable — use try-with-resources or `Cleaner`."
    },
    {
      "q": "Why are Strings immutable in Java?",
      "a": "Contents never change — any mutation returns a new object. This enables the String pool (safe literal sharing), makes strings safe/cacheable as `HashMap` keys, makes them inherently thread-safe, and improves security (validated filenames/URLs can't be altered afterward). The cost is object churn, which `StringBuilder` addresses."
    },
    {
      "q": "What is the String pool and what does intern() do?",
      "a": "The String pool (in the heap since Java 7) holds one canonical instance per distinct literal, so every `\"abc\"` shares one object and can be `==`-compared. Runtime-built strings (concatenation, `new String`) aren't pooled. `str.intern()` returns the canonical pooled instance, adding it if absent — useful for deduping runtime strings at the cost of pool lookups."
    },
    {
      "q": "String vs StringBuilder vs StringBuffer?",
      "a": "`String` is immutable, so repeated concatenation spawns many temporaries. `StringBuilder` is a mutable growable buffer — efficient but not thread-safe. `StringBuffer` is the older `synchronized`, thread-safe but slower equivalent. Default to `StringBuilder`; use `StringBuffer` only for a builder genuinely shared across threads."
    },
    {
      "q": "HashMap vs Hashtable vs ConcurrentHashMap?",
      "a": "`HashMap` is unsynchronized, allows one `null` key and `null` values — the single-threaded default. `Hashtable` is legacy, fully `synchronized` (whole-map lock), no nulls, effectively obsolete. `ConcurrentHashMap` is thread-safe with fine-grained locking/CAS for high concurrency, no nulls, and weakly-consistent iterators. Prefer it over `Hashtable` when you need thread safety."
    },
    {
      "q": "How does HashMap work internally (buckets, collisions, treeify, load factor)?",
      "a": "An array of buckets indexed by `(n-1) & hash`, where the key's `hashCode()` is spread to mix high bits. Colliding keys form a linked list; a bucket exceeding 8 entries (table >= 64) treeifies into a red-black tree (O(n) -> O(log n) worst case). Load factor 0.75 triggers a resize doubling capacity when `size > capacity*loadFactor`, keeping ops O(1) on average."
    },
    {
      "q": "ArrayList vs LinkedList?",
      "a": "`ArrayList` is a resizable array: O(1) indexed access, cache-friendly, but O(n) middle insert/remove due to shifting. `LinkedList` is a doubly-linked list: O(1) insert/remove at a known node/ends but O(n) indexed access, poor cache locality, per-node overhead. `ArrayList` wins for most workloads; `LinkedList` is mainly a `Deque`/queue."
    },
    {
      "q": "HashSet vs TreeSet vs LinkedHashSet?",
      "a": "All are `Set`s (no duplicates) differing in ordering. `HashSet` (backed by `HashMap`) is O(1) with no order. `LinkedHashSet` preserves insertion order via a linked list at slight memory cost. `TreeSet` (red-black tree / `NavigableSet`) keeps elements sorted by natural order or a `Comparator`, O(log n), with range queries like `ceiling`/`headSet`."
    },
    {
      "q": "What is the difference between fail-fast and fail-safe iterators?",
      "a": "Fail-fast iterators (`ArrayList`, `HashMap`) track `modCount` and throw `ConcurrentModificationException` on structural modification during iteration outside the iterator — a best-effort bug detector, not a guarantee. Fail-safe/weakly-consistent iterators (`ConcurrentHashMap`, `CopyOnWriteArrayList`) work over a snapshot or tolerate concurrent changes without throwing, but may miss the latest updates."
    },
    {
      "q": "How does ConcurrentHashMap achieve thread safety without locking the whole map?",
      "a": "In Java 8+ it locks the individual bucket (first node of a bin), not the whole map or old segments. Reads are lock-free via `volatile` semantics; empty-bucket inserts use CAS; only a non-empty bucket is `synchronized`-locked, so writes to different buckets don't contend. Resizing is cooperative — threads help transfer bins — so it scales far better than `Hashtable`."
    },
    {
      "q": "What is type erasure?",
      "a": "Generics are compile-time only: the compiler checks types then erases parameters, replacing `T` with its bound (or `Object`) and inserting casts. So `List<String>` and `List<Integer>` share one runtime class, and you can't do `new T()`, `instanceof List<String>`, or `new T[]`. It preserved backward compatibility at the cost of no reified generic type info at runtime."
    },
    {
      "q": "Explain PECS (Producer Extends, Consumer Super).",
      "a": "PECS guides wildcard choice. Use `? extends T` when a structure only produces/reads `T` (read as `T`, can't add) — a source `List<? extends Number>`. Use `? super T` when it only consumes `T` (add `T`, reads come back as `Object`) — a sink `List<? super Integer>`. `Collections.copy(dest, src)` is canonical: `dest` is `? super T`, `src` is `? extends T`."
    },
    {
      "q": "What is Optional and how should it be used?",
      "a": "`Optional<T>` explicitly models \"a value or nothing\", replacing `null` returns so absence is visible in the type and the caller must handle it (`map`, `orElse`, `orElseThrow`, `ifPresent`). Use it as a return type; avoid it for fields, parameters, or collection elements, and never `get()` without checking `isPresent()`. It cuts NPEs but adds a small allocation, so not for hot loops."
    },
    {
      "q": "What are records and sealed classes?",
      "a": "A `record` (Java 16) is a concise immutable data carrier — declaring components generates the canonical constructor, final fields, accessors, and `equals`/`hashCode`/`toString`. A `sealed` class/interface (Java 17) restricts implementers via a `permits` clause, closing the hierarchy. Together they enable exhaustive `switch` pattern matching over a fixed set of shapes — algebraic-data-type modeling in Java."
    }
  ],
  "14.5": [
    {
      "q": "What is the difference between a process and a thread?",
      "a": "A process is an independent program with its own isolated memory managed by the OS; threads live inside a process and share its heap and static data but have their own stack, program counter, and locals. Shared memory makes thread communication cheap but requires synchronization; processes are isolated and use IPC. Thread context switches are cheaper than process switches."
    },
    {
      "q": "What is the Java Memory Model and what does happens-before mean?",
      "a": "The JMM defines when a write by one thread becomes visible to a read by another and what reorderings are allowed. happens-before is its ordering relation: if A happens-before B, A's effects are visible and ordered before B. It is established by program order, monitor release/acquire (synchronized), volatile read/write, Thread.start()/join(), and constructs like Future and CountDownLatch. Without such an edge, writes may never be seen."
    },
    {
      "q": "What does the volatile keyword guarantee (and not guarantee)?",
      "a": "volatile guarantees visibility (writes are flushed and reads see the latest value) and ordering (no reordering across the access, establishing happens-before). It does NOT guarantee atomicity of compound operations: i++ is read-modify-write and stays a race even when volatile. Use it for a simple flag or single-writer status; use synchronized or an Atomic class for atomic updates."
    },
    {
      "q": "What is a race condition and how do you prevent it?",
      "a": "A race condition is when correctness depends on thread timing/interleaving over shared mutable state, typically a non-atomic check-then-act or read-modify-write. Prevent it by removing sharing (confinement, thread-locals), making state immutable, or guarding all access with the same lock or atomic/CAS operation. Every access, reads included, must use the same coordination mechanism."
    },
    {
      "q": "Runnable vs Callable?",
      "a": "Runnable.run() returns void and cannot throw checked exceptions; Callable.call() returns a value V and may throw checked exceptions. You submit a Callable to an ExecutorService and get a Future for the result or thrown exception; Runnable is for tasks with no result. Callable was added in Java 5 to support results and error propagation."
    },
    {
      "q": "synchronized vs ReentrantLock?",
      "a": "Both are reentrant mutual-exclusion locks with the same memory semantics, but ReentrantLock is more flexible: tryLock() with timeout, interruptible locking, optional fairness, and multiple Conditions per lock. synchronized is simpler and auto-releases on exit/exception with no finally needed. Prefer synchronized by default; use ReentrantLock for try/timeout/interruptible acquisition or fairness, always unlocking in a finally."
    },
    {
      "q": "What is a deadlock and how do you avoid it?",
      "a": "Deadlock is when two or more threads each hold a lock the other needs and none can proceed; it requires all four Coffman conditions: mutual exclusion, hold-and-wait, no preemption, and circular wait. The standard fix is a global lock-ordering so all threads acquire locks in the same order, breaking circular wait. Also use tryLock() with timeout and back off, minimize lock scope, and avoid calling foreign code while holding a lock."
    },
    {
      "q": "What is the difference between wait()/notify() and a Condition?",
      "a": "Both let a thread wait for a state change and be signalled with the same guard-in-a-loop discipline. wait()/notify()/notifyAll() are Object methods tied to that object's intrinsic monitor, so a synchronized block has one wait-set. A Condition comes from a ReentrantLock via newCondition(), and you can create several per lock (e.g. notFull and notEmpty) to signal only relevant waiters with await()/signal()/signalAll(). Conditions give finer-grained, more efficient signalling."
    },
    {
      "q": "What are atomic classes and CAS (compare-and-swap)?",
      "a": "Atomic classes (AtomicInteger, AtomicLong, AtomicReference, ...) provide lock-free, thread-safe single-variable updates built on CAS: a hardware instruction that atomically sets a location to a new value only if it holds the expected old value, otherwise it fails and retries in a loop. This gives non-blocking updates that scale better than locks under contention for simple state, though CAS can suffer the ABA problem (addressed by AtomicStampedReference)."
    },
    {
      "q": "What is the difference between optimistic and pessimistic locking?",
      "a": "Pessimistic locking assumes conflicts are likely, so it takes an exclusive lock up front (a mutex or SELECT ... FOR UPDATE) and blocks others for the whole operation. Optimistic locking assumes conflicts are rare, takes no lock, and validates at commit via a version/timestamp column (or CAS in memory), retrying or failing if the data changed. Optimistic scales better under low contention and avoids blocking; pessimistic is safer when contention or retry cost is high."
    },
    {
      "q": "Why use an ExecutorService instead of creating threads directly?",
      "a": "Threads are expensive OS resources; one-per-task doesn't scale and gives no back-pressure, so a burst can exhaust memory. An ExecutorService decouples submission from execution: it reuses a bounded pool, queues excess work, and lets you configure sizing, rejection policy, and lifecycle (shutdown()). You also get Futures, scheduling, and clean cancellation instead of managing raw Thread objects."
    },
    {
      "q": "How do you size a thread pool?",
      "a": "Size by workload type. For CPU-bound work use roughly the number of cores (often cores + 1), since more runnable threads than cores just add context-switching overhead. For I/O-bound work threads mostly block, so you need many more; Little's law / Goetz's formula gives threads = cores * targetUtilization * (1 + waitTime/computeTime). Always bound the pool and queue and measure under realistic load."
    },
    {
      "q": "What is the difference between submit() and execute()?",
      "a": "execute(Runnable) is from Executor, returns void, and an uncaught exception goes to the thread's UncaughtExceptionHandler. submit() is from ExecutorService, accepts a Runnable or Callable, and returns a Future; a task's exception is captured in the Future and only surfaces on Future.get() (wrapped in ExecutionException). The gotcha: exceptions from submit()ed tasks are silently swallowed unless you inspect the Future."
    },
    {
      "q": "What is CompletableFuture and why is it better than Future?",
      "a": "CompletableFuture (Java 8) is a Future you can complete manually and, crucially, compose. A plain Future only offers blocking get() and isDone() — no callbacks or chaining. CompletableFuture adds a fluent async API: thenApply/thenCompose to chain, thenCombine/allOf/anyOf to fan-in, exceptionally/handle for error recovery, and per-stage executor control. This enables non-blocking pipelines instead of tying up threads on get()."
    },
    {
      "q": "What are virtual threads (Project Loom) and when do they help?",
      "a": "Virtual threads (finalized in Java 21) are lightweight JVM-managed threads scheduled onto a small pool of OS carrier threads. When one blocks on I/O it unmounts from its carrier so the carrier runs other virtual threads, making blocking cheap — you can have millions. They shine for high-concurrency I/O-bound/blocking workloads (request-per-thread servers), letting simple blocking code scale. They do NOT speed up CPU-bound work, which is still bounded by cores."
    },
    {
      "q": "What is thread pinning with virtual threads?",
      "a": "Pinning is when a virtual thread cannot unmount from its carrier while blocked, so the carrier OS thread stays occupied and you lose scalability. In early releases it happened when blocking inside a synchronized block/method or during a native/foreign call. The fix is to replace synchronized around blocking operations with a ReentrantLock so the virtual thread can unmount. Java 24 / JEP 491 largely eliminated synchronized pinning, but avoiding long blocking under synchronized stays good practice on earlier versions."
    }
  ],
  "14.6": [
    {
      "q": "When should you use microservices instead of a monolith (and when not)?",
      "a": "Microservices pay off when you need independent deployability, independent scaling of hot components, and team autonomy across many teams — the org boundary usually justifies the split more than the tech does. They cost you distributed-systems complexity: network failures, eventual consistency, distributed tracing, and operational overhead. For a small team or unproven product, start with a well-modularized monolith and extract services only when a clear scaling or team-ownership pain appears. Splitting too early is the classic mistake — you pay all the cost before you have the problem microservices solve."
    },
    {
      "q": "How do microservices communicate (sync vs async)?",
      "a": "Synchronous is request/response over HTTP/REST or gRPC: simple and immediate but creates temporal coupling — the caller blocks and both services must be up, so failures cascade. Asynchronous is messaging/events over a broker like Kafka or RabbitMQ: loose coupling, buffering, and resilience, at the cost of eventual consistency and harder debugging. Use sync for queries needing an immediate answer, async for commands/notifications and work that can be processed later. Many designs mix both."
    },
    {
      "q": "What is an API Gateway and what does it do?",
      "a": "A single entry point between clients and services (Spring Cloud Gateway, Kong, AWS API Gateway) that handles cross-cutting concerns so services don't each reimplement them: routing, auth, rate limiting, TLS termination, request aggregation, and protocol translation. It decouples clients from the internal service topology so you can move services without breaking callers. Keep it thin — avoid making it a bottleneck or putting business logic in it."
    },
    {
      "q": "What is service discovery?",
      "a": "In a dynamic environment instances come and go with changing IPs, so service discovery lets a service find healthy instances of another by logical name. Client-side discovery has the caller query a registry (Eureka, Consul) and load-balance itself; server-side discovery puts a load balancer/router in front that resolves the name (Kubernetes Services work this way). Instances register on startup and send heartbeats; unhealthy ones are evicted so traffic only routes to live nodes."
    },
    {
      "q": "What is a circuit breaker and why use it?",
      "a": "It wraps a remote call and trips open when the failure rate crosses a threshold, so calls fail fast instead of piling up on a struggling dependency. Three states: CLOSED (calls flow, failures counted), OPEN (calls short-circuit, often returning a fallback), and HALF_OPEN (after a cooldown a few trial calls test recovery). This prevents cascading failures and gives the downstream service room to recover. Standard library on the JVM is Resilience4j (Hystrix is the legacy option)."
    },
    {
      "q": "Timeouts, retries, and the retry-storm problem?",
      "a": "Always set aggressive timeouts — an unbounded call ties up a thread and propagates a hang upstream. Retries help with transient blips but only for idempotent operations; naive fixed-interval retries cause a retry storm where many synced clients hammer a recovering service and knock it back down. Fixes: exponential backoff with jitter, a capped retry count, and a retry budget / circuit breaker to stop retrying when the dependency is clearly down. Never retry non-idempotent writes without an idempotency key."
    },
    {
      "q": "What is the bulkhead pattern?",
      "a": "Named after a ship's watertight compartments, it isolates resources so a failure in one area can't sink the whole service. You give each downstream dependency its own thread pool or connection-pool/semaphore limit, so if dependency A hangs it only exhausts A's pool — calls to B still succeed. Without it, one slow dependency can consume every thread in a shared pool and take the whole service down. It pairs naturally with circuit breakers and timeouts."
    },
    {
      "q": "How do you handle distributed tracing and correlation IDs?",
      "a": "A correlation/trace ID is generated at the edge (gateway) and propagated through every hop via HTTP headers — the W3C traceparent header is the standard (older stacks used X-B3-). Each service logs it and creates spans, so you can stitch one request's path across services in Jaeger, Zipkin, or Tempo. On the JVM, OpenTelemetry auto-instrumentation plus MDC log correlation is the common setup. The trace ID answers where a request spent time and where it failed."
    },
    {
      "q": "What is the database-per-service pattern and why?",
      "a": "Each service owns its own database and no other service touches it directly — access goes only through the owning service's API. This enforces loose coupling and lets each service pick the right store and evolve its schema independently. The tradeoff is losing cross-service joins and ACID transactions, so cross-service queries need API composition or CQRS and writes need Sagas. A shared database is the anti-pattern — it silently couples services at the schema level."
    },
    {
      "q": "What is eventual consistency?",
      "a": "Rather than every copy being consistent the instant a write commits (strong consistency), eventual consistency guarantees that if no new updates arrive, all copies converge to the same value after a propagation delay. It's the price of availability and partition tolerance, so a read right after a write may return stale data. You design around it with idempotent updates, versioning for conflict resolution, and UX that tolerates brief staleness. Most microservice systems are eventually consistent across service boundaries."
    },
    {
      "q": "Explain the Saga pattern (orchestration vs choreography).",
      "a": "A Saga replaces a distributed ACID transaction with a sequence of local transactions, one per service, each publishing an event that triggers the next; on failure you run compensating transactions to undo prior steps. Choreography has no coordinator — services react to each other's events (decoupled but hard to follow). Orchestration has a central orchestrator directing each service and tracking state (easier to reason about and monitor, but you must build and own it). Sagas give atomicity-like semantics without cross-service locking, at the cost of eventual consistency."
    },
    {
      "q": "What is the transactional outbox pattern and what problem does it solve?",
      "a": "It solves the dual-write problem: you can't atomically update your DB and publish to a broker, so a crash between the two leaves them inconsistent. In the same local transaction you write the business row and an event row into an outbox table — one atomic commit. A relay process (polling, or Change Data Capture via Debezium) then publishes those rows and marks them sent. This gives at-least-once event delivery consistent with the data change, which is why consumers must be idempotent."
    },
    {
      "q": "What is idempotency and why does it matter in distributed systems?",
      "a": "An operation is idempotent if doing it multiple times has the same effect as doing it once. It matters because networks give at-least-once delivery and retries: a client may resend after a timeout even though the first request succeeded, so without idempotency you get double charges or duplicate orders. Implement it with a client-supplied idempotency key the server dedupes on, or design naturally idempotent operations (set balance = X, not add). GET/PUT/DELETE are idempotent by HTTP semantics; POST is not, which is why payment APIs require an Idempotency-Key header."
    },
    {
      "q": "Explain the CAP theorem (and PACELC).",
      "a": "CAP says that when a network partition (P) occurs, a distributed system can guarantee at most one of Consistency and Availability — choose CP (block/reject to stay consistent) or AP (keep serving, risk stale data). It only forces the choice during a partition; \"pick 2 of 3\" is the common misreading. PACELC extends it: Else, with no partition, you still trade Latency vs Consistency (sync replication is more consistent but slower). So systems are described as PC/EL (Dynamo-style) or PC/EC (strongly consistent both ways)."
    },
    {
      "q": "What caching strategies do you know (cache-aside, write-through, write-behind) and how do you handle invalidation?",
      "a": "Cache-aside (lazy): app checks cache, on a miss reads the DB and populates it — simple default, but first request always misses and data can go stale. Write-through: writes go to cache and DB synchronously, always fresh but slower writes. Write-behind: writes hit the cache and flush to DB asynchronously — fast but risks data loss if the cache dies first. Invalidation: TTL as a safety net, evict/update the key on write, and mitigate cache-stampede (many simultaneous misses) with locking, request coalescing, or staggered TTLs."
    },
    {
      "q": "How would you design a rate limiter / what algorithms exist (token bucket, leaky bucket, sliding window)?",
      "a": "Token bucket: tokens refill at a fixed rate up to a capacity, each request consumes one, and a full bucket allows short bursts — the most common choice. Leaky bucket: requests queue and drain at a constant rate, smoothing bursts but adding latency. Fixed-window counter: cheap but allows a 2x burst at the boundary. Sliding-window log/counter fixes that boundary spike at higher memory cost. For a distributed limiter keep counters in Redis (atomic INCR with expiry or a Lua script) so all nodes share one limit, and return HTTP 429 with Retry-After when exceeded."
    }
  ],
  "4.6": [
    {
      "q": "What problem does Elasticsearch solve that a relational database does not?",
      "a": "Full-text search at scale. A B-tree index and SQL LIKE '%term%' cannot use the index for infix matches, do relevance ranking, handle typos/stemming/synonyms, or search across huge text corpora quickly. Elasticsearch builds an INVERTED INDEX (term -> list of documents containing it) so a query jumps straight to matching docs and ranks them by relevance (BM25). It is a distributed search & analytics engine (built on Lucene), used for full-text search, log/observability analytics, and autocomplete -- not as a system of record."
    },
    {
      "q": "Explain the inverted index and how a search returns ranked results.",
      "a": "At index time each document's text is analyzed (tokenized, lowercased, stemmed) into terms, and for each term ES stores a postings list of the doc ids containing it. A query is analyzed the same way; ES intersects/unions the postings lists of the query terms to find candidates, then scores each by relevance using BM25 (term frequency, inverse document frequency, field length). This is why lookups are fast regardless of corpus size and why results come back ranked."
    },
    {
      "q": "How are documents distributed across a cluster, and why can't you change the primary shard count later?",
      "a": "An index is split into a fixed number of PRIMARY shards; a document is routed to a shard by hash(_routing, default _id) % number_of_primary_shards. Because that modulo depends on the shard count, changing it would send existing documents to different shards, so ES fixes primaries at index creation (you must reindex to change it). REPLICA shards are copies of primaries for high availability and extra read throughput, and those you CAN change on the fly."
    },
    {
      "q": "What is Elasticsearch's consistency model?",
      "a": "Near-real-time. A newly indexed document is not searchable until a 'refresh' makes it visible (default every 1 second), and durability comes from the translog plus periodic 'flush' to Lucene segments. Within a shard, primaries replicate to replicas synchronously before acking a write. So ES favors availability and search throughput over strict read-your-writes immediacy -- fine for search/logs, not for use cases needing transactional consistency."
    },
    {
      "q": "How do you size shards, and what goes wrong with too many small shards?",
      "a": "Rule of thumb: keep each shard in the tens of GB (often 10-50 GB) and aim for a manageable total shard count per node, because every shard carries JVM heap and cluster-state overhead. Oversharding (thousands of tiny shards) bloats the cluster state, wastes heap, and slows searches and recovery; undersized shard counts limit parallelism and make rebalancing expensive. For time-series/logs, use time-based indices + Index Lifecycle Management (hot-warm-cold-delete) to roll over by size/age."
    },
    {
      "q": "Query vs filter context, and match vs term -- what is the difference?",
      "a": "Query context computes a relevance _score (use for full-text 'how well does this match'); filter context is a yes/no match that is cacheable and does not score (use for exact constraints like status = active or a date range) and is faster. `match` is a full-text query that analyzes the input (so 'Running Shoes' matches 'run shoe'); `term` is an exact, non-analyzed match against a keyword field. A common mistake is using `term` on an analyzed text field and getting no hits."
    }
  ],
  "7.6": [
    {
      "q": "What is Infrastructure as Code and why use Terraform over clicking in a console?",
      "a": "IaC means defining your infrastructure in version-controlled declarative files instead of manual console clicks, so it is reproducible, reviewable (pull requests), and auditable. Terraform is a cloud-agnostic IaC tool: you declare the desired end state in HCL and Terraform figures out the API calls to reach it, across many providers (AWS/Azure/GCP/k8s/etc.) via one workflow. Benefits over ClickOps: no drift, no snowflake environments, peer review, easy teardown/recreate, and self-documenting infrastructure."
    },
    {
      "q": "What is the Terraform state file, why does it matter, and how do you manage it for a team?",
      "a": "State maps your configuration to the real-world resources Terraform created (ids, metadata), so it knows what exists and what to change on the next apply. It is critical and sensitive (can contain secrets), so local state is dangerous for teams: concurrent applies corrupt it and it is not shared. Use a REMOTE BACKEND with locking -- e.g. S3 for storage plus a DynamoDB lock table, or Terraform Cloud -- so state is shared, versioned, and locked during apply to prevent concurrent modification. Never commit state to git."
    },
    {
      "q": "Explain the plan/apply workflow and what 'drift' is.",
      "a": "`terraform init` sets up providers/backend; `terraform plan` is a dry run that diffs desired config against state (and refreshes real infra) and shows what will be added/changed/destroyed; `terraform apply` executes that plan; `terraform destroy` tears it down. Drift is when the real infrastructure diverges from state because someone changed it out-of-band (a console click); the next plan detects it and proposes to reconcile back to the declared config. In CI you run plan on a PR and apply on merge, with approval."
    },
    {
      "q": "How do you structure Terraform for a multi-team, multi-environment organization?",
      "a": "Split state to limit blast radius: separate state per environment (dev/stage/prod) and per component/team (networking, data, app), so one apply can only affect a small surface. Encapsulate reusable infra in versioned MODULES (pinned by version) consumed from a registry. Use remote state with locking, a CI/CD pipeline (plan on PR with policy checks, apply on merge with approval, OIDC instead of long-lived creds), and policy-as-code (OPA/Sentinel) to enforce guardrails. Keep secrets out of state -- pull from Vault/SSM and mark variables sensitive."
    },
    {
      "q": "count vs for_each, and implicit vs explicit dependencies?",
      "a": "`count` creates N copies indexed by number -- simple but removing a middle element renumbers and can destroy/recreate later ones; `for_each` creates instances keyed by a stable map/set key, so additions/removals only touch that key (preferred for sets of distinct resources). Dependencies are usually IMPLICIT: referencing one resource's attribute in another (aws_subnet.x.id) makes Terraform order them automatically. Use explicit `depends_on` only when there is a hidden dependency Terraform cannot infer from references."
    }
  ]
};
