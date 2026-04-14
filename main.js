import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import {
  getFirestore,
  collection,
  collectionGroup,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

// 1) Paste your Firebase Web app config here.
const firebaseConfig = {
  apiKey: 'AIzaSyDbRIKSvB5OVK9Td8AklSLmayGwh9Geys0',
  authDomain: 'note-2a6f8.firebaseapp.com',
  projectId: 'note-2a6f8',
  storageBucket: 'note-2a6f8.firebasestorage.app',
  messagingSenderId: '556359673920',
  appId: '1:556359673920:web:0e56743418cb667d6797a5'
};
const EMAIL_DOMAIN = 'f1959.com';
const ADMIN_EMAILS = ['admin@f1959.com'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginCard = document.getElementById('loginCard');
const appCard = document.getElementById('appCard');
const emailInput = document.getElementById('emailInput');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');

const noteList = document.getElementById('noteList');
const noteTitleInput = document.getElementById('noteTitleInput');
const copyAllBtn = document.getElementById('copyAllBtn');
const editor = document.getElementById('editor');
const authorInput = document.getElementById('authorInput');
const messageInput = document.getElementById('messageInput');
const commitBtn = document.getElementById('commitBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const logoutBtn = document.getElementById('logoutBtn');
const appStatus = document.getElementById('appStatus');
const commitList = document.getElementById('commitList');
const newNoteBtn = document.getElementById('newNoteBtn');
const adminPanel = document.getElementById('adminPanel');
const adminCommitList = document.getElementById('adminCommitList');
const adminDeleteList = document.getElementById('adminDeleteList');

let notes = [];
let selectedNoteId = null;
let unsubNotes = null;
let unsubCommits = null;
let unsubAdminCommits = null;
let unsubAdminDeletes = null;
let isAdmin = false;

const ADMIN_IDS = ADMIN_EMAILS.map((email) => email.split('@')[0].toLowerCase());

function getUser() {
  return auth.currentUser;
}

function setStatus(text, isError = false) {
  appStatus.textContent = text;
  appStatus.style.color = isError ? '#f87171' : '#c5c5d2';
}

function showApp() {
  loginCard.classList.add('hidden');
  appCard.classList.remove('hidden');
}

function showLogin() {
  appCard.classList.add('hidden');
  loginCard.classList.remove('hidden');
}

function clearRealtime() {
  if (unsubNotes) {
    unsubNotes();
    unsubNotes = null;
  }
  if (unsubCommits) {
    unsubCommits();
    unsubCommits = null;
  }
  if (unsubAdminCommits) {
    unsubAdminCommits();
    unsubAdminCommits = null;
  }
  if (unsubAdminDeletes) {
    unsubAdminDeletes();
    unsubAdminDeletes = null;
  }
}

function renderNotes() {
  noteList.innerHTML = '';

  notes.forEach((note) => {
    const li = document.createElement('li');
    li.className = note.id === selectedNoteId ? 'active' : '';

    const updatedAtText = note.updatedAt
      ? new Date(note.updatedAt).toLocaleString()
      : 'just now';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `<strong>${note.title || 'Untitled note'}</strong><small>${updatedAtText}</small>`;

    li.appendChild(titleWrap);
    li.addEventListener('click', () => {
      selectNote(note.id);
    });

    noteList.appendChild(li);
  });
}

function byUpdatedDesc(a, b) {
  const aTime = a.updatedAt ? a.updatedAt.getTime() : 0;
  const bTime = b.updatedAt ? b.updatedAt.getTime() : 0;
  return bTime - aTime;
}

function byTimeDesc(a, b, key) {
  const aTime = a[key] ? a[key].getTime() : 0;
  const bTime = b[key] ? b[key].getTime() : 0;
  return bTime - aTime;
}

function renderCommits(items = []) {
  commitList.innerHTML = '';

  items.forEach((item) => {
    const li = document.createElement('li');
    const ts = item.ts ? new Date(item.ts).toLocaleString() : 'just now';
    li.textContent = `[${ts}] ${item.author || 'anonymous'}: ${item.message || 'Updated note'}`;
    commitList.appendChild(li);
  });
}

function renderAdminCommits(items = []) {
  adminCommitList.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    const ts = item.ts ? new Date(item.ts).toLocaleString() : 'just now';
    li.textContent = `[${ts}] ${item.actorEmail || item.ownerUid || 'unknown'} | ${item.author || 'anonymous'}: ${item.message || 'Updated note'}`;
    li.style.cursor = 'pointer';
    li.title = '클릭해서 상세 보기';
    li.addEventListener('click', () => {
      window.alert(
        `사용자: ${item.actorEmail || item.ownerUid || 'unknown'}\n날짜: ${ts}\n제목: ${item.titleSnapshot || '(없음)'}\n메시지: ${item.message || 'Updated note'}\n\n내용:\n${item.contentSnapshot || '(내용 없음)'}`
      );
    });
    adminCommitList.appendChild(li);
  });
}

function renderAdminDeletes(items = []) {
  adminDeleteList.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    const ts = item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'just now';
    li.textContent = `[${ts}] ${item.actorEmail || item.actorUid || 'unknown'} deleted "${item.noteTitle || 'Untitled note'}"`;
    li.style.cursor = 'pointer';
    li.title = '클릭해서 상세 보기';
    li.addEventListener('click', () => {
      window.alert(
        `사용자: ${item.actorEmail || item.actorUid || 'unknown'}\n날짜: ${ts}\n삭제된 노트: ${item.noteTitle || 'Untitled note'}\n노트 ID: ${item.noteId || 'n/a'}\n\n삭제 당시 내용:\n${item.deletedContent || '(내용 없음)'}`
      );
    });
    adminDeleteList.appendChild(li);
  });
}

function getSelectedNote() {
  return notes.find((n) => n.id === selectedNoteId) || null;
}

function clearEditorPanels() {
  noteTitleInput.value = '';
  editor.value = '';
  renderCommits([]);
}

function selectNote(noteId) {
  selectedNoteId = noteId;
  const selected = getSelectedNote();

  noteTitleInput.value = selected?.title || '';
  editor.value = selected?.content || '';

  renderNotes();
  startCommitListener();
}

async function ensureInitialData() {
  const user = getUser();
  if (!user) return;

  const notesQuery = query(collection(db, 'notes'), where('ownerUid', '==', user.uid));
  const notesSnap = await getDocs(notesQuery);
  const hasAnyNote = !notesSnap.empty;

  if (!hasAnyNote) {
    const noteRef = doc(collection(db, 'notes'));

    await setDoc(noteRef, {
      title: 'Welcome note',
      content: 'Welcome!\n\nCreate notes, edit title/content, and commit changes.',
      updatedAt: serverTimestamp(),
      updatedBy: 'system',
      ownerUid: user.uid
    });

    await addDoc(collection(db, 'notes', noteRef.id, 'commits'), {
      author: 'system',
      message: 'Initial note created',
      ts: serverTimestamp(),
      ownerUid: user.uid,
      actorEmail: user.email || null,
      titleSnapshot: 'Welcome note',
      contentSnapshot: 'Welcome!\n\nCreate notes, edit title/content, and commit changes.'
    });
  }
}

async function createNote() {
  const rawTitle = window.prompt('New note title:', 'New note');
  if (!rawTitle) return;

  const title = rawTitle.trim() || 'Untitled note';
  const author = authorInput.value.trim() || 'anonymous';
  const user = getUser();
  if (!user) return;
  const noteRef = doc(collection(db, 'notes'));

  await setDoc(noteRef, {
    title,
    content: '',
    updatedAt: serverTimestamp(),
    updatedBy: author,
    ownerUid: user.uid
  });

  await addDoc(collection(db, 'notes', noteRef.id, 'commits'), {
    author,
    message: `Created note "${title}"`,
    ts: serverTimestamp(),
    ownerUid: user.uid,
    actorEmail: user.email || null,
    titleSnapshot: title,
    contentSnapshot: ''
  });

  setStatus('New note created.');
  selectedNoteId = noteRef.id;
}

async function commitCurrentNote() {
  if (!selectedNoteId) {
    setStatus('Select a note first.', true);
    return;
  }

  commitBtn.disabled = true;
  setStatus('Committing note...');

  try {
    const author = authorInput.value.trim() || 'anonymous';
    const message = messageInput.value.trim() || 'Updated note';

    await updateDoc(doc(db, 'notes', selectedNoteId), {
      title: noteTitleInput.value.trim() || 'Untitled note',
      content: editor.value,
      updatedAt: serverTimestamp(),
      updatedBy: author
    });

    await addDoc(collection(db, 'notes', selectedNoteId, 'commits'), {
      author,
      message,
      ts: serverTimestamp(),
      ownerUid: getUser()?.uid || null,
      actorEmail: getUser()?.email || null,
      titleSnapshot: noteTitleInput.value.trim() || 'Untitled note',
      contentSnapshot: editor.value
    });

    messageInput.value = '';
    setStatus('Committed! Everyone will see this note update.');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    commitBtn.disabled = false;
  }
}

async function deleteCurrentNote() {
  if (!selectedNoteId) {
    setStatus('Select a note first.', true);
    return;
  }

  const selected = getSelectedNote();
  const ok = window.confirm(`Delete note "${selected?.title || 'Untitled note'}"?`);
  if (!ok) return;

  await addDoc(collection(db, 'audit_logs'), {
    type: 'note_deleted',
    noteId: selectedNoteId,
    noteTitle: selected?.title || 'Untitled note',
    actorUid: getUser()?.uid || null,
    actorEmail: getUser()?.email || null,
    deletedContent: selected?.content || '',
    deletedAt: serverTimestamp()
  });

  await deleteDoc(doc(db, 'notes', selectedNoteId));
  selectedNoteId = null;
  clearEditorPanels();
  setStatus('Note deleted.');
}

function showAdminPanel() {
  adminPanel.classList.remove('hidden');
}

function hideAdminPanel() {
  adminPanel.classList.add('hidden');
  renderAdminCommits([]);
  renderAdminDeletes([]);
}

function startNotesListener() {
  const user = getUser();
  if (!user) return;

  const notesQuery = query(collection(db, 'notes'), where('ownerUid', '==', user.uid));

  unsubNotes = onSnapshot(
    notesQuery,
    (snapshot) => {
      notes = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          title: data.title || 'Untitled note',
          content: data.content || '',
          updatedAt: data.updatedAt?.toDate?.() ?? null,
          updatedBy: data.updatedBy || null
        };
      });
      notes.sort(byUpdatedDesc);

      if (!notes.length) {
        selectedNoteId = null;
        clearEditorPanels();
        renderNotes();
        return;
      }

      if (!selectedNoteId || !notes.some((n) => n.id === selectedNoteId)) {
        selectedNoteId = notes[0].id;
      }

      const selected = getSelectedNote();
      noteTitleInput.value = selected?.title || '';
      editor.value = selected?.content || '';

      renderNotes();
      startCommitListener();
    },
    (err) => {
      setStatus(err.message, true);
    }
  );
}

function startCommitListener() {
  if (unsubCommits) {
    unsubCommits();
    unsubCommits = null;
  }

  if (!selectedNoteId) {
    renderCommits([]);
    return;
  }

  const commitsQuery = query(
    collection(db, 'notes', selectedNoteId, 'commits'),
    orderBy('ts', 'desc')
  );

  unsubCommits = onSnapshot(
    commitsQuery,
    (snapshot) => {
      const items = snapshot.docs.slice(0, 20).map((snap) => {
        const data = snap.data();
        return {
          author: data.author || 'anonymous',
          message: data.message || 'Updated note',
          ts: data.ts?.toDate?.() ?? null
        };
      });

      renderCommits(items);
    },
    (err) => {
      setStatus(err.message, true);
    }
  );
}

function startAdminListeners() {
  if (!isAdmin) {
    hideAdminPanel();
    return;
  }

  showAdminPanel();

  const allCommitsQuery = query(collectionGroup(db, 'commits'), limit(200));
  unsubAdminCommits = onSnapshot(
    allCommitsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          ownerUid: data.ownerUid || null,
          actorEmail: data.actorEmail || null,
          author: data.author || 'anonymous',
          message: data.message || 'Updated note',
          titleSnapshot: data.titleSnapshot || null,
          contentSnapshot: data.contentSnapshot || null,
          ts: data.ts?.toDate?.() ?? null
        };
      });
      items.sort((a, b) => byTimeDesc(a, b, 'ts'));
      renderAdminCommits(items);
    },
    (err) => {
      setStatus(err.message, true);
    }
  );

  const deletesQuery = query(collection(db, 'audit_logs'), orderBy('deletedAt', 'desc'), limit(200));
  unsubAdminDeletes = onSnapshot(
    deletesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          actorUid: data.actorUid || null,
          actorEmail: data.actorEmail || null,
          noteId: data.noteId || null,
          noteTitle: data.noteTitle || 'Untitled note',
          deletedContent: data.deletedContent || '',
          deletedAt: data.deletedAt?.toDate?.() ?? null
        };
      });
      renderAdminDeletes(items);
    },
    (err) => {
      setStatus(err.message, true);
    }
  );
}

loginBtn.addEventListener('click', async () => {
  loginStatus.textContent = '';

  try {
    const idValue = emailInput.value.trim().toLowerCase();
    if (!idValue) {
      loginStatus.textContent = 'Please enter ID.';
      loginStatus.style.color = '#f87171';
      return;
    }

    const email = idValue.includes('@') ? idValue : `${idValue}@${EMAIL_DOMAIN}`;
    const idPart = idValue.includes('@') ? idValue.split('@')[0] : idValue;
    const isAdminLogin = ADMIN_IDS.includes(idPart) || ADMIN_EMAILS.includes(email);

    const password = isAdminLogin
      ? window.prompt('관리자 비밀번호를 입력해주세요.')
      : idPart;
    if (isAdminLogin && !password) {
      loginStatus.textContent = '관리자 비밀번호를 입력해주세요.';
      loginStatus.style.color = '#f87171';
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    emailInput.value = '';
  } catch (err) {
    loginStatus.textContent = `Login failed: ${err.message}`;
    loginStatus.style.color = '#f87171';
  }
});

newNoteBtn.addEventListener('click', async () => {
  try {
    await createNote();
  } catch (err) {
    setStatus(err.message, true);
  }
});

commitBtn.addEventListener('click', commitCurrentNote);
deleteNoteBtn.addEventListener('click', async () => {
  try {
    await deleteCurrentNote();
  } catch (err) {
    setStatus(err.message, true);
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

copyAllBtn.addEventListener('click', async () => {
  try {
    if (!editor.value) {
      setStatus('복사할 내용이 없습니다.', true);
      return;
    }
    await navigator.clipboard.writeText(editor.value);
    setStatus('내용 전체를 복사했습니다.');
  } catch (_err) {
    setStatus('복사에 실패했습니다. 브라우저 권한을 확인해주세요.', true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    clearRealtime();
    isAdmin = false;
    hideAdminPanel();
    showLogin();
    return;
  }

  try {
    isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
    await ensureInitialData();

    if (!unsubNotes) {
      startNotesListener();
    }
    startAdminListeners();

    showApp();
    setStatus('Connected.');
  } catch (err) {
    showLogin();
    loginStatus.textContent = `Setup error: ${err.message}`;
    loginStatus.style.color = '#f87171';
  }
});
