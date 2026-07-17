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
  '13.1': [
    {
      id: 'reverse-string',
      title: 'Reverse a String',
      difficulty: 'easy',
      lang: 'java',
      prompt: 'Read a single line of text from standard input and print it **reversed**.\n\nExample: `hello` → `olleh`',
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
        { name: 'basic',      stdin: 'hello\n',    expected: 'olleh', sample: true },
        { name: 'palindrome', stdin: 'racecar\n',  expected: 'racecar' },
        { name: 'spaces',     stdin: 'a b c\n',    expected: 'c b a' },
        { name: 'single',     stdin: 'Z\n',        expected: 'Z' },
      ],
    },
    {
      id: 'count-vowels',
      title: 'Count the Vowels',
      difficulty: 'easy',
      lang: 'java',
      prompt: 'Read one line of text and print how many **vowels** (a, e, i, o, u — either case) it contains.\n\nExample: `Education` → `5`',
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
        { name: 'mixed case', stdin: 'Education\n', expected: '5', sample: true },
        { name: 'none',       stdin: 'rhythm\n',    expected: '0' },
        { name: 'all vowels', stdin: 'AEIOU\n',     expected: '5' },
        { name: 'sentence',   stdin: 'the quick brown fox\n', expected: '5' },
      ],
    },
  ],

  '13.2': [
    {
      id: 'sum-even',
      title: 'Sum of Even Numbers',
      difficulty: 'easy',
      lang: 'java',
      prompt: 'First line: an integer **n**. Second line: **n** space-separated integers.\n\nPrint the **sum of the even** values.\n\nExample:\n```\n5\n1 2 3 4 6\n```\n→ `12`',
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
        { name: 'mixed',    stdin: '5\n1 2 3 4 6\n', expected: '12', sample: true },
        { name: 'no evens', stdin: '3\n1 3 5\n',     expected: '0' },
        { name: 'negatives',stdin: '4\n-2 -3 4 5\n', expected: '2' },
        { name: 'all even', stdin: '3\n2 4 6\n',     expected: '12' },
      ],
    },
    {
      id: 'second-largest',
      title: 'Second Largest',
      difficulty: 'medium',
      lang: 'java',
      prompt: 'First line: an integer **n**. Second line: **n** space-separated integers.\n\nPrint the **second largest distinct** value (inputs always contain at least two distinct values).\n\nExample:\n```\n5\n3 1 4 1 5\n```\n→ `4`',
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
        { name: 'with dupes', stdin: '5\n3 1 4 1 5\n', expected: '4', sample: true },
        { name: 'top dupes',  stdin: '4\n10 10 9 8\n', expected: '9' },
        { name: 'negatives',  stdin: '3\n-1 -2 -3\n',  expected: '-2' },
        { name: 'two values', stdin: '2\n7 3\n',       expected: '3' },
      ],
    },
  ],

  '13.3': [
    {
      id: 'fizzbuzz',
      title: 'FizzBuzz',
      difficulty: 'easy',
      lang: 'java',
      prompt: 'Read an integer **n**. Print the numbers `1` to `n`, one per line — but for multiples of 3 print `Fizz`, multiples of 5 print `Buzz`, and multiples of both print `FizzBuzz`.\n\nExample: n = `5` →\n```\n1\n2\nFizz\n4\nBuzz\n```',
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
        { name: 'n=5',  stdin: '5\n',  expected: '1\n2\nFizz\n4\nBuzz', sample: true },
        { name: 'n=15', stdin: '15\n', expected: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz' },
        { name: 'n=1',  stdin: '1\n',  expected: '1' },
        { name: 'n=3',  stdin: '3\n',  expected: '1\n2\nFizz' },
      ],
    },
    {
      id: 'prime-check',
      title: 'Prime Check',
      difficulty: 'easy',
      lang: 'java',
      prompt: 'Read an integer and print `Yes` if it is **prime**, otherwise `No`.\n\nExample: `7` → `Yes`, `9` → `No`',
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
        { name: 'prime',    stdin: '7\n',  expected: 'Yes', sample: true },
        { name: 'not prime',stdin: '9\n',  expected: 'No' },
        { name: 'one',      stdin: '1\n',  expected: 'No' },
        { name: 'two',      stdin: '2\n',  expected: 'Yes' },
        { name: 'large',    stdin: '97\n', expected: 'Yes' },
      ],
    },
  ],

  '2.2': [
    {
      id: 'sum-squares-even',
      title: 'Sum of Squares of Evens',
      difficulty: 'medium',
      lang: 'java',
      prompt: 'First line: an integer **n**. Second line: **n** space-separated integers.\n\nPrint the **sum of the squares of the even** values. A `Stream` pipeline is a clean way to do it.\n\nExample:\n```\n4\n1 2 3 4\n```\n→ `20`  (2² + 4²)',
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
        { name: 'basic',    stdin: '4\n1 2 3 4\n',  expected: '20', sample: true },
        { name: 'no evens', stdin: '3\n1 3 5\n',     expected: '0' },
        { name: 'negatives',stdin: '3\n-2 -4 5\n',   expected: '20' },
        { name: 'all even', stdin: '2\n10 2\n',      expected: '104' },
      ],
    },
  ],
};
