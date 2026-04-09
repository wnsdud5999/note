# Shared Firebase Notes (GitHub Pages compatible)

This website is static (works on GitHub Pages) and uses Firebase for:
- per-account email/password login,
- multiple notes (create/edit title/content/delete),
- per-note commit history,
- realtime updates.

No backend server is needed.

---

## Easy setup (step by step)

## 1) In Firebase: create project + web app

1. Open Firebase Console and create a project.
2. Add a **Web app**.
3. Copy the web config values (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

## 2) In Firebase: enable login and create user accounts

1. Open **Authentication → Sign-in method** and enable **Email/Password**.
2. Open **Authentication → Users** and create each user account you want.
   - Example:
     - Account 1: `user1@email.com`
     - Account 2: `user2@email.com`

Each account will only see its own notes.

## 3) In Firebase: create Firestore database

1. Open **Firestore Database** and create database in production mode.
2. Open **Rules** and paste this:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notes/{noteId} {
      allow create: if request.auth != null
        && request.resource.data.ownerUid == request.auth.uid;
      allow read, update, delete: if request.auth != null
        && resource.data.ownerUid == request.auth.uid;

      match /commits/{commitId} {
        allow create: if request.auth != null
          && request.resource.data.ownerUid == request.auth.uid
          && get(/databases/$(database)/documents/notes/$(noteId)).data.ownerUid == request.auth.uid;
        allow read, update, delete: if request.auth != null
          && resource.data.ownerUid == request.auth.uid
          && get(/databases/$(database)/documents/notes/$(noteId)).data.ownerUid == request.auth.uid;
      }
    }
  }
}
```

## 4) `main.js` settings

Important:
- This repo is now pre-filled with your provided Firebase config for project `note-2a6f8`.
- Login is ID-based with fixed domain `f1959.com`:
  - If user types `example`, app signs in as `example@f1959.com`.
  - If user types full email with `@`, app uses it directly.
- Notes are isolated by account (`ownerUid`), so one account cannot read another account's notes.

## 5) Deploy on GitHub Pages

1. Push this repo to GitHub.
2. Open **Settings → Pages**.
3. Deploy from branch root.
4. Open your Pages URL.

---

## What to do on the website

- Enter your account ID + password (example: `abc` means `abc@f1959.com`).
- Click **+ New note** to create notes.
- Edit note title + text.
- Click **Commit changes**.
- See recent commits for the selected note.
- Click **Delete note** if needed.

---

## Troubleshooting

- **Login failed (`auth/api-key-not-valid`)**: your `firebaseConfig` still has wrong or placeholder values.
- **Login failed (`auth/invalid-credential`)**: wrong email/password or user account not created.
- **No notes visible / write errors**: Firestore rules were not applied.
