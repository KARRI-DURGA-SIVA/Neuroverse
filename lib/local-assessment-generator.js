const { randomInt } = require("crypto");

const QUESTION_COUNTS = { beginner: 5, intermediate: 5, advanced: 6, expert: 4 };

const CODE_BANKS = {
  Python: {
    beginner: [
      ["Write a function that returns the sum of two numbers a and b.", "return a + b", "def add(a, b):\n    # your code here\n    pass"],
      ["Write a function that returns the largest value in a list named values.", "max(values)", "def largest(values):\n    # your code here\n    pass"],
      ["Write a function that counts the items in a list named values.", "len(values)", "def count_items(values):\n    # your code here\n    pass"],
    ],
    intermediate: [
      ["Write a function that returns True if a string is a palindrome, ignoring case.", "s.lower() == s.lower()[::-1]", "def is_palindrome(s):\n    # your code here\n    pass"],
      ["Write a function that returns a list of even numbers from values using a list comprehension.", "[x for x in values if x % 2 == 0]", "def even_values(values):\n    # your code here\n    pass"],
      ["Write a function that returns word frequencies for a string named text.", "Counter(text.split())", "def word_counts(text):\n    # your code here\n    pass"],
    ],
    advanced: [
      ["Write a function that returns the nth Fibonacci number using memoization.", "memo[n] = fib(n - 1, memo) + fib(n - 2, memo)", "def fib(n, memo=None):\n    # your code here\n    pass"],
      ["Write a generator that yields each item from nested lists in a list named groups.", "yield item", "def flatten(groups):\n    # your code here\n    pass"],
      ["Write a decorator that measures and prints a function's execution time.", "def wrapper(*args, **kwargs)", "def timed(function):\n    # your code here\n    pass"],
    ],
    expert: [
      ["Write a function that processes a large stream of records without loading the whole stream into memory.", "yield", "def stream_records(records):\n    # your code here\n    pass"],
      ["Write a thread-safe cache with an eviction policy for repeated expensive calls.", "Lock", "class SafeCache:\n    # your code here\n    pass"],
      ["Write a function that retries a failing operation with exponential backoff and a maximum attempt count.", "backoff", "def retry(operation, attempts):\n    # your code here\n    pass"],
    ],
  },
  JavaScript: {
    beginner: [
      ["Write a function that returns the sum of two numbers a and b.", "return a + b", "function add(a, b) {\n  // your code here\n}"],
      ["Write a function that returns the length of an array named values.", "values.length", "function count(values) {\n  // your code here\n}"],
      ["Write a function that returns the first item in an array named values.", "values[0]", "function first(values) {\n  // your code here\n}"],
    ],
    intermediate: [
      ["Write a function that returns only even numbers from values using filter.", "values.filter((value) => value % 2 === 0)", "function evenValues(values) {\n  // your code here\n}"],
      ["Write a function that converts an array of names to uppercase using map.", "names.map((name) => name.toUpperCase())", "function upperNames(names) {\n  // your code here\n}"],
      ["Write an async function that fetches JSON from a URL and returns the parsed body.", "await response.json()", "async function load(url) {\n  // your code here\n}"],
    ],
    advanced: [
      ["Write a function that debounces calls using setTimeout and clearTimeout.", "clearTimeout(timeout)", "function debounce(callback, delay) {\n  // your code here\n}"],
      ["Write a function that groups objects by their category property.", "reduce((groups, item)", "function groupByCategory(items) {\n  // your code here\n}"],
      ["Write a promise pool that limits concurrent tasks to a number named limit.", "Promise.all", "async function runPool(tasks, limit) {\n  // your code here\n}"],
    ],
    expert: [
      ["Write a function that safely coordinates cancellation across multiple async tasks.", "AbortController", "async function cancelableTasks(tasks) {\n  // your code here\n}"],
      ["Write a stream processor that applies backpressure while handling async input.", "await", "async function processStream(source) {\n  // your code here\n}"],
      ["Write a cache that avoids duplicate concurrent requests for the same key.", "Promise", "function requestCache(fetcher) {\n  // your code here\n}"],
    ],
  },
  SQL: {
    beginner: [
      ["Write a query that selects all rows from users where active is true.", "SELECT * FROM users WHERE active = TRUE", "-- write your query here"],
      ["Write a query that returns the name column from a table called courses.", "SELECT name FROM courses", "-- write your query here"],
      ["Write a query that sorts products by price from highest to lowest.", "ORDER BY price DESC", "-- write your query here"],
    ],
    intermediate: [
      ["Write a query that counts users in each country.", "GROUP BY country", "-- write your query here"],
      ["Write a query that joins orders to users on user_id and returns both IDs.", "JOIN users ON orders.user_id = users.id", "-- write your query here"],
      ["Write a query that returns products with a price greater than the average price.", "AVG(price)", "-- write your query here"],
    ],
    advanced: [
      ["Write a query using a window function to rank orders by amount for each customer.", "RANK() OVER (PARTITION BY customer_id ORDER BY amount DESC)", "-- write your query here"],
      ["Write a query using a CTE named monthly_sales to aggregate sales by month.", "WITH monthly_sales AS", "-- write your query here"],
      ["Write a query that uses a recursive CTE to walk a parent-child category tree.", "WITH RECURSIVE", "-- write your query here"],
    ],
    expert: [
      ["Write a query that finds gaps in a time series for every customer.", "LAG", "-- write your query here"],
      ["Write a query that safely deduplicates records while keeping the newest version.", "ROW_NUMBER", "-- write your query here"],
      ["Write a query that calculates a rolling metric without leaking data from future rows.", "ROWS BETWEEN", "-- write your query here"],
    ],
  },
};

const MCQ_BANKS = {
  English: {
    beginner: [
      ["Choose the correct sentence:", ["She go to school.", "She goes to school.", "She going to school.", "She gone to school."], "She goes to school."],
      ["Choose the correct plural:", ["childs", "childes", "children", "childrens"], "children"],
      ["Choose the correct article: ___ apple a day.", ["A", "An", "The", "No article"], "An"],
    ],
    intermediate: [
      ["Identify the correct past perfect sentence:", ["I have eaten before I left.", "I had eaten before I left.", "I eat before I left.", "I am eating before I left."], "I had eaten before I left."],
      ["Choose the correct conditional:", ["If it rains, we will stay home.", "If it rains, we stayed home.", "If it rain, we stays home.", "If it raining, we stay home."], "If it rains, we will stay home."],
      ["Choose the correct reported speech:", ["She said she is tired.", "She said she was tired.", "She say she tired.", "She said she be tired."], "She said she was tired."],
    ],
    advanced: [
      ["Choose the sentence with correct subjunctive mood:", ["If I was rich, I would travel.", "If I were rich, I would travel.", "If I am rich, I would travel.", "If I will be rich, I would travel."], "If I were rich, I would travel."],
      ["Choose the correctly punctuated sentence:", ["However we continued.", "However, we continued.", "However we, continued.", "However; we continued."], "However, we continued."],
      ["Which word best completes: The evidence was ___ to the case.", ["credible", "credibly", "credibility", "credence"], "credible"],
    ],
    expert: [
      ["Choose the clearest sentence for a formal argument:", ["Despite the risks, the proposal is defensible.", "Despite of the risks, the proposal defensible.", "The proposal, despite risks, defend.", "Despite risks the proposal are defensible."], "Despite the risks, the proposal is defensible."],
      ["Choose the sentence with the most precise meaning:", ["The results may indicate a relationship.", "The results definitely prove everything.", "The results are maybe surely related.", "The results indicate all relationships."], "The results may indicate a relationship."],
      ["Choose the best revision for clarity:", ["After reviewing the report, the team changed its plan.", "After reviewing the report, the plan was changed by the team.", "The team, the report reviewing, changed.", "Reviewing after report the team plan changed."], "After reviewing the report, the team changed its plan."],
    ],
  },
};

function pickDifferent(items, count) {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

function genericMcq(skill, difficulty) {
  return [
    [`Which approach best demonstrates ${difficulty} ${skill} practice?`, ["Memorizing without practice", "Applying concepts to a realistic task", "Avoiding feedback", "Using one method for every problem"], "Applying concepts to a realistic task"],
    [`What is the most useful next step when improving ${difficulty} ${skill}?`, ["Set a measurable goal and review results", "Skip fundamentals", "Avoid examples", "Ignore mistakes"], "Set a measurable goal and review results"],
    [`Which habit usually improves ${difficulty} ${skill} most reliably?`, ["Consistent deliberate practice", "Changing topics every minute", "Never testing yourself", "Only reading titles"], "Consistent deliberate practice"],
    [`When a ${difficulty} ${skill} solution fails, what should you do first?`, ["Inspect the evidence and reproduce the issue", "Delete the work immediately", "Guess without checking", "Ignore the result"], "Inspect the evidence and reproduce the issue"],
    [`Which choice best checks whether a ${difficulty} ${skill} solution is robust?`, ["Test normal and edge-case inputs", "Test only the easiest example", "Avoid measuring results", "Change several things at once"], "Test normal and edge-case inputs"],
    [`What makes feedback about ${difficulty} ${skill} most useful?`, ["Specific observations tied to a clear goal", "A vague opinion with no example", "Feedback after the goal changes", "Only praise with no next step"], "Specific observations tied to a clear goal"],
  ];
}

function genericCode(skill, difficulty) {
  return [
    [`Write a ${difficulty}-level function or procedure that solves a practical ${skill} task.`, "return result", "// write your solution here"],
    [`Implement a ${difficulty}-level ${skill} solution that validates its input and returns a useful result.`, "validate input", "// write your solution here"],
    [`Write a ${difficulty}-level ${skill} solution that handles the important edge case described in the prompt.`, "edge case", "// write your solution here"],
    [`Design a ${difficulty}-level ${skill} solution that remains readable when another developer maintains it.`, "clear", "// write your solution here"],
    [`Implement a ${difficulty}-level ${skill} operation and explain how it behaves for empty input.`, "empty", "// write your solution here"],
    [`Write a ${difficulty}-level ${skill} solution that avoids unnecessary repeated work.`, "efficient", "// write your solution here"],
  ];
}

function selectQuestions(pool, count) {
  const uniquePool = pool.filter((item, index, items) => items.findIndex((candidate) => candidate[0] === item[0]) === index);
  const shuffled = pickDifferent(uniquePool, uniquePool.length);
  return Array.from({ length: count }, (_, index) => {
    const item = shuffled[index % shuffled.length];
    if (index < shuffled.length) return item;
    return [
      `${item[0]} Consider a different example or edge case for this attempt (variant ${index + 1}).`,
      item[1],
      item[2],
    ];
  });
}

function generateLocalAssessmentQuestions(skill) {
  const questions = [];
  for (const difficulty of Object.keys(QUESTION_COUNTS)) {
    const isMixed = skill.test_type === "mixed";
    const variants = isMixed
      ? null
      : (skill.test_type === "code" ? CODE_BANKS[skill.name] : MCQ_BANKS[skill.name])?.[difficulty];
    const fallback = skill.test_type === "code" ? genericCode(skill.name, difficulty) : genericMcq(skill.name, difficulty);
    const codePool = [
      ...(CODE_BANKS[skill.name]?.[difficulty] || []),
      ...genericCode(skill.name, difficulty),
    ];
    const mcqPool = [
      ...(MCQ_BANKS[skill.name]?.[difficulty] || []),
      ...genericMcq(skill.name, difficulty),
    ];
    const selected = isMixed
      ? [
          ...selectQuestions(codePool, Math.ceil(QUESTION_COUNTS[difficulty] / 2)).map((item) => ({ item, isCode: true })),
          ...selectQuestions(mcqPool, Math.floor(QUESTION_COUNTS[difficulty] / 2)).map((item) => ({ item, isCode: false })),
        ]
      : selectQuestions(
          variants ? [...variants, ...fallback] : fallback,
          QUESTION_COUNTS[difficulty]
        )
          .map((item) => ({ item, isCode: skill.test_type === "code" }));
    for (const selectedQuestion of selected) {
      const item = selectedQuestion.item;
      const isCode = selectedQuestion.isCode;
      questions.push({
        question_type: isCode ? "code" : "mcq",
        difficulty,
        question_text: item[0],
        options: isCode ? null : item[1],
        correct_answer: isCode ? item[1] : item[2],
        starter_code: isCode ? item[2] : null,
        points: difficulty === "expert" ? 25 : difficulty === "advanced" ? 20 : difficulty === "intermediate" ? 15 : 10,
      });
    }
  }
  return questions;
}

module.exports = { generateLocalAssessmentQuestions };
