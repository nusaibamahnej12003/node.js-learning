const express = require("express");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3002;
const DATA_FILE = path.join(__dirname, "data", "store.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const fields = {
  tutors: ["name", "email", "phone", "subject", "hourlyRate"],
  students: ["name", "email", "phone", "grade", "parentName"],
  lessons: [
    "tutorId",
    "studentId",
    "subject",
    "date",
    "time",
    "duration",
    "status",
    "attendance",
    "progressNotes",
  ],
  payments: ["studentId", "lessonId", "amount", "date", "status", "method"],
};

function readStore() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year < 100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateRecord(collection, input, store) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Send a JSON object.");
  }

  const unknownFields = Object.keys(input).filter((key) => !fields[collection].includes(key));
  if (unknownFields.length) {
    throw badRequest(`Unknown field: ${unknownFields.join(", ")}`);
  }

  const record = {};
  for (const field of fields[collection]) {
    const value = input[field];
    record[field] = typeof value === "string" ? value.trim() : value;
  }

  const required = {
    tutors: ["name", "email", "subject"],
    students: ["name", "email"],
    lessons: ["tutorId", "studentId", "subject", "date", "time"],
    payments: ["studentId", "amount", "date", "status", "method"],
  }[collection];

  for (const field of required) {
    if (record[field] === undefined || record[field] === "") {
      throw badRequest(`${field} is required.`);
    }
  }

  if (
    (collection === "tutors" || collection === "students") &&
    record.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)
  ) {
    throw badRequest("Enter a valid email address.");
  }

  if (collection === "tutors") {
    record.hourlyRate = Number(record.hourlyRate || 0);
    if (!Number.isFinite(record.hourlyRate) || record.hourlyRate < 0) {
      throw badRequest("Hourly rate must be a non-negative number.");
    }
  }

  if (collection === "lessons") {
    if (!store.tutors.some((tutor) => tutor.id === record.tutorId)) {
      throw badRequest("Choose an existing tutor.");
    }
    if (!store.students.some((student) => student.id === record.studentId)) {
      throw badRequest("Choose an existing student.");
    }
    if (!isValidDate(record.date)) {
      throw badRequest("Enter a valid lesson date.");
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(record.time)) {
      throw badRequest("Enter a valid lesson time.");
    }
    record.duration = Number(record.duration || 60);
    if (!Number.isInteger(record.duration) || record.duration < 1 || record.duration > 480) {
      throw badRequest("Duration must be between 1 and 480 minutes.");
    }
    if (!["scheduled", "completed", "cancelled"].includes(record.status)) {
      throw badRequest("Choose a valid lesson status.");
    }
    if (!["not-recorded", "present", "absent"].includes(record.attendance)) {
      throw badRequest("Choose a valid attendance status.");
    }
  }

  if (collection === "payments") {
    if (!store.students.some((student) => student.id === record.studentId)) {
      throw badRequest("Choose an existing student.");
    }
    record.amount = Number(record.amount);
    if (!Number.isFinite(record.amount) || record.amount < 0) {
      throw badRequest("Amount must be a non-negative number.");
    }
    if (!isValidDate(record.date)) {
      throw badRequest("Enter a valid payment date.");
    }
    if (!["paid", "pending"].includes(record.status)) {
      throw badRequest("Choose a valid payment status.");
    }
    if (!["cash", "card", "bank transfer"].includes(record.method)) {
      throw badRequest("Choose a valid payment method.");
    }
    if (record.lessonId) {
      const lesson = store.lessons.find((item) => item.id === record.lessonId);
      if (!lesson || lesson.studentId !== record.studentId) {
        throw badRequest("Choose a lesson belonging to the selected student.");
      }
    } else {
      record.lessonId = "";
    }
  }

  return record;
}

app.use(express.json({ limit: "100kb" }));
app.use(express.static(PUBLIC_DIR));

app.get("/api/:collection", (req, res, next) => {
  try {
    const store = readStore();
    const collection = req.params.collection;
    if (!fields[collection]) {
      return res.status(404).json({ error: "Collection not found." });
    }
    return res.json(store[collection]);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/:collection", (req, res, next) => {
  try {
    const store = readStore();
    const collection = req.params.collection;
    if (!fields[collection]) {
      return res.status(404).json({ error: "Collection not found." });
    }
    const record = {
      id: randomUUID(),
      ...validateRecord(collection, req.body, store),
      createdAt: new Date().toISOString(),
    };
    store[collection].unshift(record);
    writeStore(store);
    return res.status(201).json(record);
  } catch (error) {
    return next(error);
  }
});

app.put("/api/:collection/:id", (req, res, next) => {
  try {
    const store = readStore();
    const collection = req.params.collection;
    if (!fields[collection]) {
      return res.status(404).json({ error: "Collection not found." });
    }
    const index = store[collection].findIndex((record) => record.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Record not found." });
    }
    const current = store[collection][index];
    const currentFields = Object.fromEntries(
      fields[collection].map((field) => [field, current[field]]),
    );
    const updated = {
      ...current,
      ...validateRecord(collection, { ...currentFields, ...req.body }, store),
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    store[collection][index] = updated;
    writeStore(store);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/:collection/:id", (req, res, next) => {
  try {
    const store = readStore();
    const collection = req.params.collection;
    if (!fields[collection]) {
      return res.status(404).json({ error: "Collection not found." });
    }
    const index = store[collection].findIndex((record) => record.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Record not found." });
    }

    const id = req.params.id;
    const hasReferences =
      (collection === "tutors" && store.lessons.some((lesson) => lesson.tutorId === id)) ||
      (collection === "students" &&
        (store.lessons.some((lesson) => lesson.studentId === id) ||
          store.payments.some((payment) => payment.studentId === id))) ||
      (collection === "lessons" && store.payments.some((payment) => payment.lessonId === id));
    if (hasReferences) {
      return res.status(409).json({
        error: "This record is linked to other records. Remove those links before deleting it.",
      });
    }

    store[collection].splice(index, 1);
    writeStore(store);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  const status = error.status || (error.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) {
    console.error(error);
  }
  return res.status(status).json({
    error: status === 400 && error.type === "entity.parse.failed" ? "Invalid JSON request body." : error.message,
  });
});

app.listen(PORT, () => {
  console.log(`Tutor management app is running at http://localhost:${PORT}`);
});
