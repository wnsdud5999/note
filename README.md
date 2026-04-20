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
    function signedIn() { return request.auth != null; }
    function isAdmin() {
      return signedIn()
        && request.auth.token.email != null
        && request.auth.token.email in ['admin@f1959.com'];
    }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }

    match /notes/{noteId} {
      allow create: if signedIn() && request.resource.data.ownerUid == request.auth.uid;
      allow read, update, delete: if isAdmin() || isOwner(resource.data.ownerUid);

      match /commits/{commitId} {
        allow create: if signedIn()
          && request.resource.data.ownerUid == request.auth.uid
          && (
            isAdmin()
            || (
              exists(/databases/$(database)/documents/notes/$(noteId))
              && isOwner(get(/databases/$(database)/documents/notes/$(noteId)).data.ownerUid)
            )
          );
        allow read: if isAdmin()
          || (
            exists(/databases/$(database)/documents/notes/$(noteId))
            && isOwner(get(/databases/$(database)/documents/notes/$(noteId)).data.ownerUid)
          );
        allow update, delete: if false;
      }
    }

    match /audit_logs/{logId} {
      allow create: if signedIn();
      allow read: if isAdmin();
      allow update: if false;
      allow delete: if isAdmin();
    }

    match /admin_commits/{commitLogId} {
      allow create: if signedIn();
      allow read: if isAdmin();
      allow update: if false;
      allow delete: if isAdmin();
    }
  }
}
```

## 4) `main.js` settings

Important:
- This repo is now pre-filled with your provided Firebase config for project `note-2a6f8`.
- Login is ID-based with fixed domain `f1959.com`:
  - If user types `example`, app signs in as `example@f1959.com`.
  - Password is also `example` (same as ID before `@`).
  - If user types full email with `@`, password is still the left side before `@`.
- Admin login is dual-step:
  - First screen shows only one ID input.
  - If login attempt ID/email matches an admin account in `ADMIN_EMAILS`, a password modal appears.
  - Admin password is the real Firebase Auth password for that admin account.
- Admin account is email-based (no npm/local script needed):
  - Edit `ADMIN_EMAILS` in `main.js` (default: `admin@f1959.com`).
  - That email gets admin dashboard access.
- Notes are isolated by account (`ownerUid`), so one account cannot read another account's notes.

## 5) Deploy on GitHub Pages

1. Push this repo to GitHub.
2. Open **Settings → Pages**.
3. Deploy from branch root.
4. Open your Pages URL.

## Admin account setup (see all users + delete history)

1. Create/login the admin user in Firebase Authentication (example: `admin@f1959.com`).
2. In `main.js`, set that same email in `ADMIN_EMAILS`.
3. In Firestore Rules, make sure `isAdmin()` email list includes the same email.
4. That admin user will see:
   - **All user commits** (`admin_commits` feed)
   - **Delete history** from `audit_logs`
   - Click each history row to see full detail (user/date/content snapshot)
   - In detail modal, click **TXT 다운로드** to save long content as a text file
   - **최근 10개 기본 로드 + 더보기/새로고침** (수동 조회 모드)
   - Audit logs older than 30 days are auto-cleaned by admin session
5. Normal users will not see admin panel and cannot read `audit_logs`.
6. If admin dashboard is empty:
   - Make sure Firestore Rules were published with your admin email in `isAdmin()`.
   - Existing delete history appears only after someone actually deletes notes.

Quick checklist:
- Firebase Auth has user `admin@f1959.com` with a strong password.
- `main.js` contains `const ADMIN_EMAILS = ['admin@f1959.com'];`
- Firestore Rules `isAdmin()` also contains `admin@f1959.com`.
- Logout/login again after changes.

---

## What to do on the website

- Enter your account ID only (example: `abc` means `abc@f1959.com`).
  - Password is automatic and equals your ID (`abc`).
- If you enter admin ID/email, enter admin password in the popup.
- Click **+ New note** to create notes.
- Edit note title + text.
- Click **Copy all** to copy all text in the current note body.
- Click **Commit changes**.
- See recent commits for the selected note.
- Click **Delete note** if needed.

---

## Troubleshooting

- **Login failed (`auth/api-key-not-valid`)**: your `firebaseConfig` still has wrong or placeholder values.
- **Login failed (`auth/invalid-credential`)**: wrong email/password or user account not created.
- **No notes visible / write errors**: Firestore rules were not applied.
- **The query requires an index**: fixed in current code by removing the composite-index query pattern.
- **Admin dashboard not visible**: check `ADMIN_EMAILS` in `main.js` and `isAdmin()` email list in Firestore rules, then logout/login.
- **Admin can login but sees permission errors / no data**: Firestore Rules `isAdmin()` email mismatch or rules not published yet.
- **Delete is visible but All user commits is empty**: make sure `admin_commits` rules block is added and published.
- **일반 유저가 노트 생성 시 권한 오류**: 최신 코드에서는 `admin_commits` 실패가 노트 생성을 막지 않도록 처리되어야 합니다. 최신 버전으로 배포했는지 확인하세요.
- **Delete history does not auto-clean after 30 days**: update Firestore Rules so admin can delete `audit_logs` entries.
- **관리자 화면 글자가 영어/에러가 애매함**: 최신 코드에서는 주요 오류 메시지를 한국어로 변환해 보여줍니다.
