# Tutor management app

A small Express app for managing tutors, students, lessons, attendance, progress notes, and payments. Records are stored locally in `data/store.json`.

## Run it

From the project root:

```powershell
npm run start:tutor
```

Open [http://localhost:3002](http://localhost:3002). Set the `PORT` environment variable to use a different port.

The app starts with empty records. Add tutors and students before scheduling a lesson; add a student before recording a payment. Records that are referenced by lessons or payments cannot be deleted until those references are removed.

This JSON-file storage is intended for local learning and small demos, not concurrent or multi-user production deployments.
