# Shared Firebase Notes (GitHub Pages compatible)

This website is static (works on GitHub Pages) and uses Firebase for:
- password login,
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

## 2) In Firebase: enable login and create shared user

1. Open **Authentication → Sign-in method** and enable **Email/Password**.
2. Open **Authentication → Users** and create one user:
   - Email: `sharedemail@email.com` (or your own)
   - Password: `wnsdud5999@` (or your own)

## 3) In Firebase: create Firestore database

1. Open **Firestore Database** and create database in production mode.
2. Open **Rules** and paste this:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notes/{noteId} {
      allow read, write: if request.auth != null;

      match /commits/{commitId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

## 4) Edit `main.js`

Replace these values:
- all `REPLACE_ME` entries in `firebaseConfig`
- `SHARED_EMAIL`

Important:
- The entered password on the site must match the shared Firebase user password.

## 5) Deploy on GitHub Pages

1. Push this repo to GitHub.
2. Open **Settings → Pages**.
3. Deploy from branch root.
4. Open your Pages URL.

---

## What to do on the website

- Enter shared password.
- Click **+ New note** to create notes.
- Edit note title + text.
- Click **Commit changes**.
- See recent commits for the selected note.
- Click **Delete note** if needed.

---

## Troubleshooting

- **Login failed (`auth/api-key-not-valid`)**: your `firebaseConfig` still has wrong or placeholder values.
- **Login failed (`auth/invalid-credential`)**: `SHARED_EMAIL`, password, or project is mismatched.
- **No notes visible / write errors**: Firestore rules were not applied.
