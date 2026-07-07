// Sample seed data for exams and polls. Plain JS, no TypeScript.

export const seedExams = [
  {
    id: "gen-knowledge",
    title: "General Knowledge",
    description: "A quick 5-question quiz covering a bit of everything.",
    minutes: 5,
    questions: [
      {
        id: "q1",
        text: "What is the capital of Japan?",
        options: ["Seoul", "Tokyo", "Beijing", "Bangkok"],
        answer: 1,
      },
      {
        id: "q2",
        text: "Which planet is known as the Red Planet?",
        options: ["Venus", "Jupiter", "Mars", "Saturn"],
        answer: 2,
      },
      {
        id: "q3",
        text: "How many continents are there on Earth?",
        options: ["5", "6", "7", "8"],
        answer: 2,
      },
      {
        id: "q4",
        text: "Who wrote 'Romeo and Juliet'?",
        options: ["Charles Dickens", "Mark Twain", "Jane Austen", "William Shakespeare"],
        answer: 3,
      },
      {
        id: "q5",
        text: "What is the largest ocean on Earth?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        answer: 3,
      },
    ],
  },
  {
    id: "web-basics",
    title: "Web Development Basics",
    description: "Test your fundamentals of HTML, CSS and JavaScript.",
    minutes: 7,
    questions: [
      {
        id: "q1",
        text: "What does HTML stand for?",
        options: [
          "Hyper Trainer Marking Language",
          "HyperText Markup Language",
          "HyperText Markdown Language",
          "Hyperlinks and Text Markup Language",
        ],
        answer: 1,
      },
      {
        id: "q2",
        text: "Which property changes text color in CSS?",
        options: ["font-color", "text-style", "color", "foreground"],
        answer: 2,
      },
      {
        id: "q3",
        text: "Which keyword declares a block-scoped variable in JS?",
        options: ["var", "let", "function", "define"],
        answer: 1,
      },
      {
        id: "q4",
        text: "What symbol is used for IDs in CSS selectors?",
        options: [".", "#", "*", "@"],
        answer: 1,
      },
    ],
  },
];

export const seedPolls = [
  {
    id: "fav-language",
    question: "What is your favorite programming language?",
    options: [
      { id: "js", label: "JavaScript", votes: 42 },
      { id: "py", label: "Python", votes: 51 },
      { id: "go", label: "Go", votes: 18 },
      { id: "rs", label: "Rust", votes: 27 },
    ],
  },
  {
    id: "work-style",
    question: "Where do you work best?",
    options: [
      { id: "home", label: "Remote / Home", votes: 64 },
      { id: "office", label: "In the office", votes: 22 },
      { id: "hybrid", label: "Hybrid", votes: 48 },
      { id: "cafe", label: "Cafés & co-working", votes: 14 },
    ],
  },
];
