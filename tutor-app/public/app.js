const state = {
  tutors: [],
  students: [],
  lessons: [],
  payments: [],
  view: "dashboard",
  editing: null,
  search: "",
};

const definitions = {
  tutors: {
    title: "tutor",
    fields: [
      { name: "name", label: "Full name", required: true, placeholder: "e.g. Maya Chen" },
      { name: "email", label: "Email address", type: "email", required: true, placeholder: "maya@example.com" },
      { name: "phone", label: "Phone number", placeholder: "+1 (555) 000-0000" },
      { name: "subject", label: "Subject", required: true, placeholder: "e.g. Mathematics" },
      { name: "hourlyRate", label: "Hourly rate", type: "number", min: 0, step: "0.01", placeholder: "45" },
    ],
  },
  students: {
    title: "student",
    fields: [
      { name: "name", label: "Student name", required: true, placeholder: "e.g. Alex Morgan" },
      { name: "email", label: "Email address", type: "email", required: true, placeholder: "alex@example.com" },
      { name: "phone", label: "Phone number", placeholder: "+1 (555) 000-0000" },
      { name: "grade", label: "Grade / level", placeholder: "e.g. Grade 8" },
      { name: "parentName", label: "Parent / guardian", placeholder: "Guardian name" },
    ],
  },
  lessons: {
    title: "lesson",
    fields: [
      { name: "studentId", label: "Student", type: "select", source: "students", required: true },
      { name: "tutorId", label: "Tutor", type: "select", source: "tutors", required: true },
      { name: "subject", label: "Subject", required: true, placeholder: "e.g. Algebra" },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "time", label: "Start time", type: "time", required: true },
      { name: "duration", label: "Duration (minutes)", type: "number", min: 1, max: 480, step: 1, default: 60 },
      { name: "status", label: "Lesson status", type: "select", default: "scheduled", options: [["scheduled", "Scheduled"], ["completed", "Completed"], ["cancelled", "Cancelled"]] },
      { name: "attendance", label: "Attendance", type: "select", default: "not-recorded", options: [["not-recorded", "Not recorded"], ["present", "Present"], ["absent", "Absent"]] },
      { name: "progressNotes", label: "Progress notes", type: "textarea", placeholder: "Topics covered, wins, and next steps...", full: true },
    ],
  },
  payments: {
    title: "payment",
    fields: [
      { name: "studentId", label: "Student", type: "select", source: "students", required: true },
      { name: "lessonId", label: "Related lesson (optional)", type: "select", source: "studentLessons" },
      { name: "amount", label: "Amount", type: "number", min: 0, step: "0.01", required: true, placeholder: "60" },
      { name: "date", label: "Payment date", type: "date", required: true },
      { name: "status", label: "Payment status", type: "select", default: "paid", options: [["paid", "Paid"], ["pending", "Pending"]] },
      { name: "method", label: "Payment method", type: "select", default: "cash", options: [["cash", "Cash"], ["card", "Card"], ["bank transfer", "Bank transfer"]] },
    ],
  },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
const moneyFormatter = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
let toastTimer;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

async function refreshData() {
  const [tutors, students, lessons, payments] = await Promise.all(
    ["tutors", "students", "lessons", "payments"].map((collection) => request(`/api/${collection}`)),
  );
  Object.assign(state, { tutors, students, lessons, payments });
  render();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
}

function displayDate(date) {
  if (!date) return "—";
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormatter.format(parsed);
}

function formatTime(time = "") {
  if (!time) return "—";
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function person(collection, id) {
  return state[collection].find((record) => record.id === id);
}

function matchesSearch(values) {
  if (!state.search) return true;
  const query = state.search.toLowerCase();
  return values.some((value) => String(value || "").toLowerCase().includes(query));
}

function setView(view) {
  state.view = view;
  $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  $("#breadcrumb-current").textContent = view === "dashboard" ? "Overview" : view[0].toUpperCase() + view.slice(1);
  render();
}

function renderDashboard() {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  $("#today-label").textContent = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(today).toUpperCase();
  $("#stat-students").textContent = state.students.length;
  $("#stat-tutors").textContent = state.tutors.length;
  const upcoming = state.lessons
    .filter((lesson) => lesson.status === "scheduled" && new Date(`${lesson.date}T${lesson.time || "00:00"}`) >= todayDate)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  $("#stat-lessons").textContent = upcoming.length;
  $("#stat-revenue").textContent = moneyFormatter.format(state.payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + Number(payment.amount), 0));

  const lessonMarkup = upcoming.slice(0, 5).map((lesson) => {
    const student = person("students", lesson.studentId);
    const tutor = person("tutors", lesson.tutorId);
    const date = new Date(`${lesson.date}T00:00:00`);
    return `<article class="lesson-item"><div class="date-tile"><span>${new Intl.DateTimeFormat("en", { month: "short" }).format(date)}</span><strong>${date.getDate()}</strong></div><div class="lesson-copy"><strong>${escapeHtml(lesson.subject)}</strong><span>${escapeHtml(student?.name || "Student")} with ${escapeHtml(tutor?.name || "Tutor")}</span></div><span class="lesson-time">${escapeHtml(formatTime(lesson.time))}</span></article>`;
  }).join("");
  $("#dashboard-lessons").innerHTML = lessonMarkup
    ? `<div class="lesson-list">${lessonMarkup}</div>`
    : `<div class="empty-state"><strong>No upcoming lessons yet</strong>Add a student and tutor, then schedule a class.</div>`;

  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const recorded = state.lessons.filter((lesson) =>
    lesson.date.startsWith(currentMonth) &&
    (lesson.attendance === "present" || lesson.attendance === "absent"),
  );
  const rate = recorded.length ? Math.round((recorded.filter((lesson) => lesson.attendance === "present").length / recorded.length) * 100) : null;
  $("#attendance-rate").textContent = rate === null ? "—" : `${rate}%`;
  $("#attendance-bar").style.width = rate === null ? "0%" : `${rate}%`;
}

function personCell(record, secondary = "") {
  return `<div class="person-cell"><span class="avatar avatar-purple">${escapeHtml(initials(record.name))}</span><span><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(secondary)}</small></span></div>`;
}

function statusPill(status) {
  return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(status.replaceAll("-", " "))}</span>`;
}

function tableMarkup(headers, rows, emptyMessage) {
  if (!rows.length) return `<div class="empty-state"><strong>${escapeHtml(emptyMessage)}</strong>Records you add will show up here.</div>`;
  return `<div class="table-scroll"><table class="data-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}<th></th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function actions(collection, record) {
  return `<td><div class="row-actions"><button class="row-action" data-edit="${collection}" data-id="${record.id}" aria-label="Edit record">✎</button><button class="row-action" data-delete="${collection}" data-id="${record.id}" aria-label="Delete record">×</button></div></td>`;
}

function renderTutors() {
  const records = state.tutors.filter((tutor) => matchesSearch([tutor.name, tutor.email, tutor.phone, tutor.subject]));
  const rows = records.map((tutor) => `<tr><td>${personCell(tutor, tutor.email)}</td><td><span class="subject-chip">${escapeHtml(tutor.subject)}</span></td><td>${escapeHtml(tutor.phone || "—")}</td><td>${moneyFormatter.format(Number(tutor.hourlyRate || 0))}/hr</td>${actions("tutors", tutor)}</tr>`);
  $("#tutors-table").innerHTML = tableMarkup(["Tutor", "Subject", "Phone", "Rate"], rows, "No tutors added yet");
}

function renderStudents() {
  const records = state.students.filter((student) => matchesSearch([student.name, student.email, student.phone, student.grade, student.parentName]));
  const rows = records.map((student) => `<tr><td>${personCell(student, student.email)}</td><td>${escapeHtml(student.grade || "—")}</td><td>${escapeHtml(student.parentName || "—")}</td><td>${escapeHtml(student.phone || "—")}</td>${actions("students", student)}</tr>`);
  $("#students-table").innerHTML = tableMarkup(["Student", "Grade / level", "Parent / guardian", "Phone"], rows, "No students added yet");
}

function renderLessons() {
  const filter = $("#lesson-filter").value;
  const records = state.lessons
    .filter((lesson) => filter === "all" || lesson.status === filter)
    .filter((lesson) => {
      const tutor = person("tutors", lesson.tutorId);
      const student = person("students", lesson.studentId);
      return matchesSearch([lesson.subject, tutor?.name, student?.name, lesson.date, lesson.status, lesson.progressNotes]);
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  $("#lessons-subtitle").textContent = `${records.length} ${records.length === 1 ? "lesson" : "lessons"} in your schedule`;
  const rows = records.map((lesson) => {
    const student = person("students", lesson.studentId);
    const tutor = person("tutors", lesson.tutorId);
    return `<tr><td>${personCell(student || { name: "Unknown student" }, lesson.subject)}</td><td>${escapeHtml(tutor?.name || "Unknown tutor")}</td><td>${escapeHtml(displayDate(lesson.date))}<br /><small>${escapeHtml(formatTime(lesson.time))}</small></td><td>${escapeHtml(`${lesson.duration || 60} min`)}</td><td>${statusPill(lesson.attendance)}</td><td>${statusPill(lesson.status)}</td>${actions("lessons", lesson)}</tr>`;
  });
  $("#lessons-table").innerHTML = tableMarkup(["Student / subject", "Tutor", "Date & time", "Duration", "Attendance", "Status"], rows, "No lessons scheduled yet");
}

function renderPayments() {
  const records = state.payments.filter((payment) => {
    const student = person("students", payment.studentId);
    const lesson = person("lessons", payment.lessonId);
    return matchesSearch([student?.name, payment.date, payment.status, payment.method, lesson?.subject, payment.amount]);
  }).sort((a, b) => b.date.localeCompare(a.date));
  const rows = records.map((payment) => {
    const student = person("students", payment.studentId);
    const lesson = person("lessons", payment.lessonId);
    return `<tr><td>${personCell(student || { name: "Unknown student" }, lesson?.subject || "Tuition")}</td><td>${escapeHtml(displayDate(payment.date))}</td><td>${escapeHtml(payment.method)}</td><td>${moneyFormatter.format(Number(payment.amount))}</td><td>${statusPill(payment.status)}</td>${actions("payments", payment)}</tr>`;
  });
  $("#payments-table").innerHTML = tableMarkup(["Student / lesson", "Date", "Method", "Amount", "Status"], rows, "No payments recorded yet");
}

function render() {
  renderDashboard();
  renderLessons();
  renderStudents();
  renderTutors();
  renderPayments();
}

function addField(field, record) {
  const wrapper = document.createElement("div");
  wrapper.className = `form-field${field.full ? " full-width" : ""}`;
  const label = document.createElement("label");
  label.htmlFor = `field-${field.name}`;
  label.textContent = field.label;
  wrapper.append(label);

  let input;
  if (field.type === "select") {
    input = document.createElement("select");
    const choices = field.options || (field.source === "studentLessons"
      ? state.lessons.filter((lesson) => lesson.studentId === $("#field-studentId")?.value).map((lesson) => [lesson.id, `${lesson.subject} · ${displayDate(lesson.date)}`])
      : state[field.source].map((item) => [item.id, item.name]));
    const option = document.createElement("option");
    option.value = "";
    option.textContent = field.required ? "Choose..." : "None";
    input.append(option);
    for (const [value, text] of choices) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      input.append(option);
    }
  } else {
    input = document.createElement(field.type === "textarea" ? "textarea" : "input");
    if (field.type !== "textarea") input.type = field.type || "text";
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.step !== undefined) input.step = field.step;
  }
  input.id = `field-${field.name}`;
  input.name = field.name;
  input.required = Boolean(field.required);
  input.value = record[field.name] ?? field.default ?? "";
  wrapper.append(input);
  $("#form-fields").append(wrapper);
}

function updateLessonChoices() {
  const lessonSelect = $("#field-lessonId");
  if (!lessonSelect) return;
  const studentId = $("#field-studentId").value;
  const previous = lessonSelect.value;
  lessonSelect.replaceChildren(new Option("None", ""));
  state.lessons.filter((lesson) => lesson.studentId === studentId).forEach((lesson) => {
    lessonSelect.add(new Option(`${lesson.subject} · ${displayDate(lesson.date)}`, lesson.id));
  });
  lessonSelect.value = previous;
}

function openForm(collection, record = null) {
  if ((collection === "lessons" && (!state.tutors.length || !state.students.length)) ||
      (collection === "payments" && !state.students.length)) {
    showToast(collection === "lessons" ? "Add a tutor and student before scheduling a lesson." : "Add a student before recording a payment.", true);
    return;
  }
  state.editing = record ? { collection, id: record.id } : null;
  $("#record-form").dataset.collection = collection;
  $("#modal-title").textContent = `${record ? "Edit" : "Add"} ${definitions[collection].title}`;
  $("#save-button").textContent = record ? "Save changes" : `Save ${definitions[collection].title}`;
  $("#form-error").textContent = "";
  $("#form-fields").replaceChildren();
  for (const field of definitions[collection].fields) addField(field, record || {});
  if (collection === "payments") {
    $("#field-studentId").addEventListener("change", updateLessonChoices);
    updateLessonChoices();
  }
  $("#modal-backdrop").hidden = false;
  $("#form-fields").querySelector("input, select, textarea")?.focus();
}

function closeForm() {
  $("#modal-backdrop").hidden = true;
  $("#record-form").reset();
  state.editing = null;
}

function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

async function deleteRecord(collection, id) {
  const record = state[collection].find((item) => item.id === id);
  if (!record || !window.confirm(`Delete this ${definitions[collection].title}? This cannot be undone.`)) return;
  try {
    await request(`/api/${collection}/${id}`, { method: "DELETE" });
    await refreshData();
    showToast(`${definitions[collection].title[0].toUpperCase()}${definitions[collection].title.slice(1)} deleted.`);
  } catch (error) {
    showToast(error.message, true);
  }
}

$$(".nav-link").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
$$("[data-view]").filter((button) => !button.classList.contains("nav-link")).forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
$$("[data-action]").forEach((button) => button.addEventListener("click", () => openForm(`${button.dataset.action.replace("new-", "")}s`)));
$$(".close-modal").forEach((button) => button.addEventListener("click", closeForm));
$("#modal-backdrop").addEventListener("click", (event) => {
  if (event.target === $("#modal-backdrop")) closeForm();
});
$("#lesson-filter").addEventListener("change", renderLessons);
$("#global-search").addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  render();
});
document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const record = state[editButton.dataset.edit].find((item) => item.id === editButton.dataset.id);
    if (record) openForm(editButton.dataset.edit, record);
  }
  if (deleteButton) deleteRecord(deleteButton.dataset.delete, deleteButton.dataset.id);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#modal-backdrop").hidden) closeForm();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#global-search").focus();
  }
});

$("#record-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  const target = state.editing;
  const collection = target?.collection || event.currentTarget.dataset.collection;
  const url = target ? `/api/${collection}/${target.id}` : `/api/${collection}`;
  try {
    await request(url, { method: target ? "PUT" : "POST", body: JSON.stringify(payload) });
    closeForm();
    await refreshData();
    showToast(`${definitions[collection].title[0].toUpperCase()}${definitions[collection].title.slice(1)} ${target ? "updated" : "added"}.`);
  } catch (error) {
    $("#form-error").textContent = error.message;
  }
});

refreshData().catch((error) => {
  showToast(`Could not load your records: ${error.message}`, true);
});
