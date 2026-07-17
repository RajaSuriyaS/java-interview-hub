/* ============================================================
   Graded coding challenges — keyed by module id.
   SERVER-SIDE ONLY. This file is never served to the browser, so hidden
   test expected-outputs and reference solutions stay private; the server
   ships only the prompt, starter code, and SAMPLE test cases to clients,
   and grades submissions server-side via the code runner.

   Shape:
     { id, title, difficulty, lang, prompt(markdown), starter(code),
       solution(reference, server-only), tests: [{name, stdin, expected, sample?}] }
   Programs read from STDIN and print the answer to STDOUT; grading compares
   normalized stdout (trailing whitespace/newlines ignored) to `expected`.
   ============================================================ */

export const CHALLENGES = {
  "0.11": [
    {
      id: "unique-sorted", title: "Unique & Sorted", difficulty: "easy", lang: "java",
      prompt: `First line: **n**. Second line: **n** integers. Print the **distinct** values in **ascending** order, space-separated on one line.

Example: \`3 1 2 3 1\` → \`1 2 3\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print distinct values sorted ascending, space-separated
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        TreeSet<Integer> set = new TreeSet<>();
        for (int i = 0; i < n; i++) set.add(sc.nextInt());
        StringBuilder sb = new StringBuilder();
        for (int v : set) { if (sb.length() > 0) sb.append(' '); sb.append(v); }
        System.out.println(sb);
    }
}`,
      tests: [
        { name: "dupes", stdin: "5\n3 1 2 3 1\n", expected: "1 2 3", sample: true },
        { name: "sorted out", stdin: "4\n9 7 8 7\n", expected: "7 8 9" },
        { name: "single", stdin: "1\n42\n", expected: "42" },
      ],
    },
    {
      id: "most-frequent", title: "Most Frequent Value", difficulty: "medium", lang: "java",
      prompt: `First line: **n**. Second line: **n** integers. Print the value that appears **most often**. If there is a tie, print the **smallest** such value.

Example: \`1 2 2 3 3 3\` → \`3\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print the most frequent value (ties -> smallest)
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        Map<Integer,Integer> freq = new TreeMap<>();
        for (int i = 0; i < n; i++) { int x = sc.nextInt(); freq.merge(x, 1, Integer::sum); }
        int best = 0, bestCount = -1;
        for (Map.Entry<Integer,Integer> e : freq.entrySet())
            if (e.getValue() > bestCount) { bestCount = e.getValue(); best = e.getKey(); }
        System.out.println(best);
    }
}`,
      tests: [
        { name: "clear", stdin: "6\n1 2 2 3 3 3\n", expected: "3", sample: true },
        { name: "tie smallest", stdin: "4\n2 2 1 1\n", expected: "1" },
        { name: "single", stdin: "1\n5\n", expected: "5" },
      ],
    },
  ],
  "2.2": [
    {
      id: "sum-squares-even", title: "Sum of Squares of Evens", difficulty: "medium", lang: "java",
      prompt: `First line: an integer **n**. Second line: **n** space-separated integers.

Print the **sum of the squares of the even** values. A \`Stream\` pipeline is a clean way to do it.

Example:
\`\`\`
4
1 2 3 4
\`\`\`
→ \`20\`  (2² + 4²)`,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        // TODO: print the sum of squares of the even values
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        long sum = Arrays.stream(nums).filter(x -> x % 2 == 0)
                         .mapToLong(x -> (long) x * x).sum();
        System.out.println(sum);
    }
}`,
      tests: [
        { name: "basic", stdin: "4\n1 2 3 4\n", expected: "20", sample: true },
        { name: "no evens", stdin: "3\n1 3 5\n", expected: "0" },
        { name: "negatives", stdin: "3\n-2 -4 5\n", expected: "20" },
        { name: "all even", stdin: "2\n10 2\n", expected: "104" },
      ],
    },
    {
      id: "sum-first-squares", title: "Sum of First N Squares", difficulty: "easy", lang: "java",
      prompt: `Read **n** and print \`1² + 2² + ... + n²\`. An \`IntStream\` makes this a one-liner.

Example: \`3\` → \`14\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print the sum of squares from 1 to n
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long sum = IntStream.rangeClosed(1, n).mapToLong(i -> (long) i * i).sum();
        System.out.println(sum);
    }
}`,
      tests: [
        { name: "three", stdin: "3\n", expected: "14", sample: true },
        { name: "one", stdin: "1\n", expected: "1" },
        { name: "ten", stdin: "10\n", expected: "385" },
      ],
    },
  ],
  "13.1": [
    {
      id: "reverse-string", title: "Reverse a String", difficulty: "easy", lang: "java",
      prompt: `Read a single line of text from standard input and print it **reversed**.

Example: \`hello\` → \`olleh\``,
      starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        // TODO: print s reversed
    }
}`,
      solution: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        System.out.println(new StringBuilder(s).reverse());
    }
}`,
      tests: [
        { name: "basic", stdin: "hello\n", expected: "olleh", sample: true },
        { name: "palindrome", stdin: "racecar\n", expected: "racecar" },
        { name: "spaces", stdin: "a b c\n", expected: "c b a" },
        { name: "single", stdin: "Z\n", expected: "Z" },
      ],
    },
    {
      id: "count-vowels", title: "Count the Vowels", difficulty: "easy", lang: "java",
      prompt: `Read one line of text and print how many **vowels** (a, e, i, o, u — either case) it contains.

Example: \`Education\` → \`5\``,
      starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        // TODO: count vowels (case-insensitive) and print the count
    }
}`,
      solution: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        int c = 0;
        for (char ch : s.toLowerCase().toCharArray())
            if ("aeiou".indexOf(ch) >= 0) c++;
        System.out.println(c);
    }
}`,
      tests: [
        { name: "mixed case", stdin: "Education\n", expected: "5", sample: true },
        { name: "none", stdin: "rhythm\n", expected: "0" },
        { name: "all vowels", stdin: "AEIOU\n", expected: "5" },
        { name: "sentence", stdin: "the quick brown fox\n", expected: "5" },
      ],
    },
    {
      id: "anagram-check", title: "Anagram Check", difficulty: "easy", lang: "java",
      prompt: `Read two lines. Print \`Yes\` if the second is an **anagram** of the first (same letters, same counts), else \`No\`.

Example: \`listen\` / \`silent\` → \`Yes\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String a = sc.hasNextLine() ? sc.nextLine() : "";
        String b = sc.hasNextLine() ? sc.nextLine() : "";
        // TODO: print Yes if b is an anagram of a, else No
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String a = sc.hasNextLine() ? sc.nextLine() : "";
        String b = sc.hasNextLine() ? sc.nextLine() : "";
        char[] x = a.toCharArray(), y = b.toCharArray();
        Arrays.sort(x); Arrays.sort(y);
        System.out.println(Arrays.equals(x, y) ? "Yes" : "No");
    }
}`,
      tests: [
        { name: "anagram", stdin: "listen\nsilent\n", expected: "Yes", sample: true },
        { name: "not", stdin: "abc\nabd\n", expected: "No" },
        { name: "same", stdin: "aabb\nbbaa\n", expected: "Yes" },
        { name: "length", stdin: "abc\nab\n", expected: "No" },
      ],
    },
    {
      id: "count-words", title: "Count Words", difficulty: "easy", lang: "java",
      prompt: `Read one line and print how many **words** it has (words are separated by whitespace). An empty line has \`0\` words.`,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        // TODO: print the number of whitespace-separated words
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        s = s.trim();
        System.out.println(s.isEmpty() ? 0 : s.split("\\\\s+").length);
    }
}`,
      tests: [
        { name: "four", stdin: "the quick brown fox\n", expected: "4", sample: true },
        { name: "extra spaces", stdin: "  hello   world  \n", expected: "2" },
        { name: "empty", stdin: "\n", expected: "0" },
        { name: "one", stdin: "solo\n", expected: "1" },
      ],
    },
    {
      id: "longest-unique-substring", title: "Longest Substring Without Repeating Characters", difficulty: "medium", lang: "java",
      prompt: `Read one line of text and print the **length of the longest substring** that contains no repeating characters.

Example: \`abcabcbb\` → \`3\` (the substring \`abc\`). A sliding window does this in one pass.`,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        // TODO: print the length of the longest substring with no repeated characters
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        Set<Character> win = new HashSet<>();
        int l = 0, best = 0;
        for (int r = 0; r < s.length(); r++) {
            while (win.contains(s.charAt(r))) win.remove(s.charAt(l++));
            win.add(s.charAt(r));
            best = Math.max(best, r - l + 1);
        }
        System.out.println(best);
    }
}`,
      tests: [
        { name: "classic", stdin: "abcabcbb\n", expected: "3", sample: true },
        { name: "all same", stdin: "bbbbb\n", expected: "1" },
        { name: "pwwkew", stdin: "pwwkew\n", expected: "3" },
        { name: "all unique", stdin: "abcdef\n", expected: "6" },
        { name: "dvdf", stdin: "dvdf\n", expected: "3" },
        { name: "empty", stdin: "\n", expected: "0" },
      ],
    },
    {
      id: "palindrome-permutation", title: "Palindrome Permutation", difficulty: "medium", lang: "java",
      prompt: `Read one line and print \`true\` if its characters can be **rearranged into a palindrome**, else \`false\`.

A string can form a palindrome exactly when **at most one** character has an odd count.

Example: \`bdybayda\` → \`true\` (rearranges to \`abdyydba\`); \`hello\` → \`false\`.`,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        // TODO: print true if s can be rearranged into a palindrome, else false
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        Map<Character,Integer> c = new HashMap<>();
        for (char ch : s.toCharArray()) c.merge(ch, 1, Integer::sum);
        long odd = c.values().stream().filter(v -> v % 2 == 1).count();
        System.out.println(odd <= 1);
    }
}`,
      tests: [
        { name: "even counts", stdin: "bdybayda\n", expected: "true", sample: true },
        { name: "one odd", stdin: "bdybaydak\n", expected: "true" },
        { name: "not", stdin: "hello\n", expected: "false" },
        { name: "aab", stdin: "aab\n", expected: "true" },
        { name: "code", stdin: "code\n", expected: "false" },
        { name: "single", stdin: "x\n", expected: "true" },
      ],
    },
  ],
  "13.2": [
    {
      id: "sum-even", title: "Sum of Even Numbers", difficulty: "easy", lang: "java",
      prompt: `First line: an integer **n**. Second line: **n** space-separated integers.

Print the **sum of the even** values.

Example:
\`\`\`
5
1 2 3 4 6
\`\`\`
→ \`12\``,
      starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: read n integers, print the sum of the even ones
    }
}`,
      solution: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long sum = 0;
        for (int i = 0; i < n; i++) {
            int x = sc.nextInt();
            if (x % 2 == 0) sum += x;
        }
        System.out.println(sum);
    }
}`,
      tests: [
        { name: "mixed", stdin: "5\n1 2 3 4 6\n", expected: "12", sample: true },
        { name: "no evens", stdin: "3\n1 3 5\n", expected: "0" },
        { name: "negatives", stdin: "4\n-2 -3 4 5\n", expected: "2" },
        { name: "all even", stdin: "3\n2 4 6\n", expected: "12" },
      ],
    },
    {
      id: "second-largest", title: "Second Largest", difficulty: "medium", lang: "java",
      prompt: `First line: an integer **n**. Second line: **n** space-separated integers.

Print the **second largest distinct** value (inputs always contain at least two distinct values).

Example:
\`\`\`
5
3 1 4 1 5
\`\`\`
→ \`4\``,
      starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print the second largest DISTINCT value
    }
}`,
      solution: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        TreeSet<Integer> set = new TreeSet<>();
        for (int i = 0; i < n; i++) set.add(sc.nextInt());
        Iterator<Integer> it = set.descendingIterator();
        it.next();
        System.out.println(it.next());
    }
}`,
      tests: [
        { name: "with dupes", stdin: "5\n3 1 4 1 5\n", expected: "4", sample: true },
        { name: "top dupes", stdin: "4\n10 10 9 8\n", expected: "9" },
        { name: "negatives", stdin: "3\n-1 -2 -3\n", expected: "-2" },
        { name: "two values", stdin: "2\n7 3\n", expected: "3" },
      ],
    },
    {
      id: "max-subarray", title: "Maximum Subarray Sum (Kadane's)", difficulty: "medium", lang: "java",
      prompt: `First line: **n**. Second line: **n** integers. Print the largest sum of any **contiguous** subarray (at least one element).

Example: \`-2 1 -3 4 -1 2 1 -5 4\` → \`6\`  (the subarray \`4 -1 2 1\`)`,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = sc.nextInt();
        // TODO: print the maximum contiguous subarray sum
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long best = Long.MIN_VALUE, cur = 0;
        for (int i = 0; i < n; i++) {
            int x = sc.nextInt();
            cur = Math.max(x, cur + x);
            best = Math.max(best, cur);
        }
        System.out.println(best);
    }
}`,
      tests: [
        { name: "mixed", stdin: "9\n-2 1 -3 4 -1 2 1 -5 4\n", expected: "6", sample: true },
        { name: "all neg", stdin: "3\n-5 -2 -8\n", expected: "-2" },
        { name: "all pos", stdin: "4\n1 2 3 4\n", expected: "10" },
        { name: "single", stdin: "1\n7\n", expected: "7" },
      ],
    },
    {
      id: "count-distinct", title: "Count Distinct Values", difficulty: "easy", lang: "java",
      prompt: `First line: **n**. Second line: **n** integers. Print how many **distinct** values there are.`,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print the count of distinct values
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        Set<Integer> set = new HashSet<>();
        for (int i = 0; i < n; i++) set.add(sc.nextInt());
        System.out.println(set.size());
    }
}`,
      tests: [
        { name: "dupes", stdin: "5\n1 2 2 3 3\n", expected: "3", sample: true },
        { name: "all same", stdin: "4\n7 7 7 7\n", expected: "1" },
        { name: "all distinct", stdin: "3\n5 6 7\n", expected: "3" },
      ],
    },
  ],
  "13.3": [
    {
      id: "fizzbuzz", title: "FizzBuzz", difficulty: "easy", lang: "java",
      prompt: `Read an integer **n**. Print the numbers \`1\` to \`n\`, one per line — but for multiples of 3 print \`Fizz\`, multiples of 5 print \`Buzz\`, and multiples of both print \`FizzBuzz\`.

Example: n = \`5\` →
\`\`\`
1
2
Fizz
4
Buzz
\`\`\``,
      starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print FizzBuzz from 1 to n, one value per line
    }
}`,
      solution: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) sb.append("FizzBuzz");
            else if (i % 3 == 0) sb.append("Fizz");
            else if (i % 5 == 0) sb.append("Buzz");
            else sb.append(i);
            sb.append('\\n');
        }
        System.out.print(sb);
    }
}`,
      tests: [
        { name: "n=5", stdin: "5\n", expected: "1\n2\nFizz\n4\nBuzz", sample: true },
        { name: "n=15", stdin: "15\n", expected: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz" },
        { name: "n=1", stdin: "1\n", expected: "1" },
        { name: "n=3", stdin: "3\n", expected: "1\n2\nFizz" },
      ],
    },
    {
      id: "prime-check", title: "Prime Check", difficulty: "easy", lang: "java",
      prompt: `Read an integer and print \`Yes\` if it is **prime**, otherwise \`No\`.

Example: \`7\` → \`Yes\`, \`9\` → \`No\``,
      starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int x = sc.nextInt();
        // TODO: print "Yes" if x is prime, else "No"
    }
}`,
      solution: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int x = sc.nextInt();
        boolean prime = x > 1;
        for (int i = 2; (long) i * i <= x; i++)
            if (x % i == 0) { prime = false; break; }
        System.out.println(prime ? "Yes" : "No");
    }
}`,
      tests: [
        { name: "prime", stdin: "7\n", expected: "Yes", sample: true },
        { name: "not prime", stdin: "9\n", expected: "No" },
        { name: "one", stdin: "1\n", expected: "No" },
        { name: "two", stdin: "2\n", expected: "Yes" },
        { name: "large", stdin: "97\n", expected: "Yes" },
      ],
    },
    {
      id: "gcd", title: "Greatest Common Divisor", difficulty: "easy", lang: "java",
      prompt: `Read two positive integers and print their **GCD** (greatest common divisor).

Example: \`12 18\` → \`6\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt(), b = sc.nextInt();
        // TODO: print gcd(a, b)
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        long a = sc.nextLong(), b = sc.nextLong();
        while (b != 0) { long t = a % b; a = b; b = t; }
        System.out.println(a);
    }
}`,
      tests: [
        { name: "basic", stdin: "12 18\n", expected: "6", sample: true },
        { name: "coprime", stdin: "17 5\n", expected: "1" },
        { name: "multiple", stdin: "100 25\n", expected: "25" },
      ],
    },
    {
      id: "factorial", title: "Factorial", difficulty: "easy", lang: "java",
      prompt: `Read an integer **n** (0 ≤ n ≤ 20) and print **n!** (n factorial). \`0! = 1\`.

Example: \`5\` → \`120\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print n! (use long)
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long f = 1;
        for (int i = 2; i <= n; i++) f *= i;
        System.out.println(f);
    }
}`,
      tests: [
        { name: "five", stdin: "5\n", expected: "120", sample: true },
        { name: "zero", stdin: "0\n", expected: "1" },
        { name: "ten", stdin: "10\n", expected: "3628800" },
        { name: "twenty", stdin: "20\n", expected: "2432902008176640000" },
      ],
    },
    {
      id: "sum-digits", title: "Sum of Digits", difficulty: "easy", lang: "java",
      prompt: `Read a non-negative integer and print the **sum of its digits**.

Example: \`1234\` → \`10\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        long x = sc.nextLong();
        // TODO: print the sum of the digits of x
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        long x = sc.nextLong();
        int sum = 0;
        while (x > 0) { sum += x % 10; x /= 10; }
        System.out.println(sum);
    }
}`,
      tests: [
        { name: "basic", stdin: "1234\n", expected: "10", sample: true },
        { name: "zero", stdin: "0\n", expected: "0" },
        { name: "nines", stdin: "9999\n", expected: "36" },
      ],
    },
  ],
  "13.4": [
    {
      id: "fib-nth", title: "Nth Fibonacci", difficulty: "easy", lang: "java",
      prompt: `Read **n** and print the nth Fibonacci number, where \`F(0)=0\`, \`F(1)=1\`.

Example: \`10\` → \`55\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print F(n) where F(0)=0, F(1)=1
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long a = 0, b = 1;
        for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }
        System.out.println(a);
    }
}`,
      tests: [
        { name: "ten", stdin: "10\n", expected: "55", sample: true },
        { name: "zero", stdin: "0\n", expected: "0" },
        { name: "one", stdin: "1\n", expected: "1" },
        { name: "twenty", stdin: "20\n", expected: "6765" },
      ],
    },
    {
      id: "power", title: "Integer Power", difficulty: "medium", lang: "java",
      prompt: `Read two integers **a** and **b** (b ≥ 0) and print **a raised to the power b**. Try it with recursion.

Example: \`2 10\` → \`1024\``,
      starter: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        long a = sc.nextLong();
        int b = sc.nextInt();
        // TODO: print a^b
    }
}`,
      solution: `import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        long a = sc.nextLong();
        int b = sc.nextInt();
        long r = 1;
        for (int i = 0; i < b; i++) r *= a;
        System.out.println(r);
    }
}`,
      tests: [
        { name: "basic", stdin: "2 10\n", expected: "1024", sample: true },
        { name: "zero exp", stdin: "5 0\n", expected: "1" },
        { name: "cube", stdin: "5 3\n", expected: "125" },
        { name: "one", stdin: "7 1\n", expected: "7" },
      ],
    },
  ],
};
