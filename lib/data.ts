export type Course = {
  id: string;
  code: string;
  title: string;
  short: string;
  mentor: string;
  room: string;
  schedule: string;
  progress: number;
  color: "berry" | "violet" | "lime" | "sky";
  nextTopic: string;
};

export type StudyTask = {
  id: number;
  title: string;
  course: string;
  due: string;
  tone: "urgent" | "normal";
  done: boolean;
};

export const courses: Course[] = [
  {
    id: "oop",
    code: "IF101",
    title: "Object-Oriented Programming",
    short: "OOP",
    mentor: "Dr. Aris Kusuma",
    room: "D301",
    schedule: "Wed · 08:00",
    progress: 72,
    color: "berry",
    nextTopic: "Inheritance & polymorphism",
  },
  {
    id: "algo",
    code: "IF104",
    title: "Algorithms & Programming",
    short: "Algorithms",
    mentor: "Prof. Dian Pratiwi",
    room: "Lab 02",
    schedule: "Wed · 10:00",
    progress: 58,
    color: "violet",
    nextTopic: "Graph traversal",
  },
  {
    id: "ux",
    code: "IF118",
    title: "Human–Computer Interaction",
    short: "HCI",
    mentor: "Nadya Putri, M.Ds.",
    room: "B204",
    schedule: "Thu · 09:40",
    progress: 84,
    color: "lime",
    nextTopic: "Usability testing",
  },
  {
    id: "db",
    code: "IF120",
    title: "Database Systems",
    short: "Database",
    mentor: "Raka Mahendra, M.Kom.",
    room: "C112",
    schedule: "Fri · 13:00",
    progress: 65,
    color: "sky",
    nextTopic: "Normalization",
  },
];

export const schedule = [
  { time: "08:00", end: "09:40", title: "Object-Oriented Programming", meta: "D301", color: "berry", live: true },
  { time: "10:00", end: "11:40", title: "Algorithms & Programming", meta: "Lab 02", color: "violet", live: false },
  { time: "13:00", end: "14:40", title: "Civic Education", meta: "C202", color: "lime", live: false },
] as const;

export const initialTasks: StudyTask[] = [
  { id: 1, title: "Finish Java unit tests", course: "IF101", due: "Today", tone: "urgent", done: false },
  { id: 2, title: "Review graph traversal", course: "IF104", due: "Tomorrow", tone: "normal", done: false },
  { id: 3, title: "Upload usability notes", course: "IF118", due: "Fri", tone: "normal", done: true },
];

export const resources = [
  { id: 1, name: "Inheritance & Polymorphism", course: "IF101", type: "PPTX", size: "12.4 MB", updated: "Today", color: "berry" },
  { id: 2, name: "Graph Traversal Cheat Sheet", course: "IF104", type: "PDF", size: "3.1 MB", updated: "Yesterday", color: "violet" },
  { id: 3, name: "Usability Test Template", course: "IF118", type: "DOCX", size: "840 KB", updated: "Sep 28", color: "lime" },
  { id: 4, name: "Normalization Practice Set", course: "IF120", type: "PDF", size: "2.7 MB", updated: "Sep 26", color: "sky" },
];
