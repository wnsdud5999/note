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
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  limit,
  startAfter,
  writeBatch
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
const adminCommitsRefreshBtn = document.getElementById('adminCommitsRefreshBtn');
const adminCommitsMoreBtn = document.getElementById('adminCommitsMoreBtn');
const adminCommitsPage = document.getElementById('adminCommitsPage');
const adminDeletesRefreshBtn = document.getElementById('adminDeletesRefreshBtn');
const adminDeletesMoreBtn = document.getElementById('adminDeletesMoreBtn');
const adminDeletesPage = document.getElementById('adminDeletesPage');
const adminPasswordModal = document.getElementById('adminPasswordModal');
const adminPasswordModalInput = document.getElementById('adminPasswordModalInput');
const adminPasswordConfirmBtn = document.getElementById('adminPasswordConfirmBtn');
const adminPasswordCancelBtn = document.getElementById('adminPasswordCancelBtn');
const detailModal = document.getElementById('detailModal');
const detailModalTitle = document.getElementById('detailModalTitle');
const detailModalContent = document.getElementById('detailModalContent');
const detailModalDownloadBtn = document.getElementById('detailModalDownloadBtn');
const detailModalCloseBtn = document.getElementById('detailModalCloseBtn');

let notes = [];
let selectedNoteId = null;
let unsubNotes = null;
let unsubCommits = null;
let isAdmin = false;
let adminCommitsAll = [];
let adminDeletesAll = [];
let adminCommitsCursor = null;
let adminDeletesCursor = null;
let adminCommitsHasMore = true;
let adminDeletesHasMore = true;

const ADMIN_IDS = ADMIN_EMAILS.map((email) => email.split('@')[0].toLowerCase());
const ADMIN_PAGE_SIZE = 10;
let detailDownloadName = 'detail.txt';

function getUser() {
  return auth.currentUser;
}

function setStatus(text, isError = false) {
  appStatus.textContent = text;
  appStatus.style.color = isError ? '#f87171' : '#c5c5d2';
}

function toKoreanErrorMessage(err) {
  const raw = err?.message || '';
  const lower = raw.toLowerCase();
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return '권한 오류입니다. Firestore Rules와 관리자 이메일 설정을 확인해주세요.';
  }
  if (lower.includes('network')) {
    return '네트워크 오류입니다. 잠시 후 다시 시도해주세요.';
  }
  if (lower.includes('index')) {
    return '인덱스 설정이 필요합니다. Firebase Console에서 인덱스를 생성해주세요.';
  }
  return raw || '알 수 없는 오류가 발생했습니다.';
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
      openDetailModal(
        'Commit 상세',
        `사용자: ${item.actorEmail || item.ownerUid || 'unknown'}\n날짜: ${ts}\n제목: ${item.titleSnapshot || '(없음)'}\n메시지: ${item.message || 'Updated note'}\n\n내용:\n${item.contentSnapshot || '(내용 없음)'}`,
        `commit-${(item.ts && item.ts.getTime()) || Date.now()}.txt`
      );
    });
    adminCommitList.appendChild(li);
  });
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = '표시할 커밋이 없습니다.';
    adminCommitList.appendChild(li);
  }

  adminCommitsPage.textContent = `${items.length}개${adminCommitsHasMore ? ' +' : ''}`;
  adminCommitsMoreBtn.disabled = !adminCommitsHasMore;
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
      openDetailModal(
        'Delete 상세',
        `사용자: ${item.actorEmail || item.actorUid || 'unknown'}\n날짜: ${ts}\n삭제된 노트: ${item.noteTitle || 'Untitled note'}\n노트 ID: ${item.noteId || 'n/a'}\n\n삭제 당시 내용:\n${item.deletedContent || '(내용 없음)'}`,
        `delete-${(item.deletedAt && item.deletedAt.getTime()) || Date.now()}.txt`
      );
    });
    adminDeleteList.appendChild(li);
  });
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = '표시할 삭제 기록이 없습니다.';
    adminDeleteList.appendChild(li);
  }

  adminDeletesPage.textContent = `${items.length}개${adminDeletesHasMore ? ' +' : ''}`;
  adminDeletesMoreBtn.disabled = !adminDeletesHasMore;
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
    await tryWriteAdminCommit({
      noteId: noteRef.id,
      ownerUid: user.uid,
      actorEmail: user.email || null,
      author: 'system',
      message: 'Initial note created',
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

  await tryWriteAdminCommit({
    noteId: noteRef.id,
    ownerUid: user.uid,
    actorEmail: user.email || null,
    author,
    message: `Created note "${title}"`,
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

    const noteRef = doc(db, 'notes', selectedNoteId);
    const noteCommitRef = doc(collection(db, 'notes', selectedNoteId, 'commits'));
    const batch = writeBatch(db);

    batch.update(noteRef, {
      title: noteTitleInput.value.trim() || 'Untitled note',
      content: editor.value,
      updatedAt: serverTimestamp(),
      updatedBy: author
    });

    batch.set(noteCommitRef, {
      author,
      message,
      ts: serverTimestamp(),
      ownerUid: getUser()?.uid || null,
      actorEmail: getUser()?.email || null,
      titleSnapshot: noteTitleInput.value.trim() || 'Untitled note',
      contentSnapshot: editor.value
    });

    await batch.commit();
    await tryWriteAdminCommit({
      noteId: selectedNoteId,
      ownerUid: getUser()?.uid || null,
      actorEmail: getUser()?.email || null,
      author,
      message,
      titleSnapshot: noteTitleInput.value.trim() || 'Untitled note',
      contentSnapshot: editor.value
    });

    messageInput.value = '';
    setStatus('Committed! Everyone will see this note update.');
  } catch (err) {
    setStatus(toKoreanErrorMessage(err), true);
  } finally {
    commitBtn.disabled = false;
  }
}

async function tryWriteAdminCommit(entry) {
  try {
    await addDoc(collection(db, 'admin_commits'), {
      noteId: entry.noteId || null,
      ownerUid: entry.ownerUid || null,
      actorEmail: entry.actorEmail || null,
      author: entry.author || 'anonymous',
      message: entry.message || 'Updated note',
      titleSnapshot: entry.titleSnapshot || null,
      contentSnapshot: entry.contentSnapshot || '',
      ts: serverTimestamp()
    });
  } catch (_err) {
    // Do not block normal users when admin_commits rules are missing/misconfigured.
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
  adminCommitsAll = [];
  adminDeletesAll = [];
  adminCommitsCursor = null;
  adminDeletesCursor = null;
  adminCommitsHasMore = true;
  adminDeletesHasMore = true;
  renderAdminCommits(adminCommitsAll);
  renderAdminDeletes(adminDeletesAll);
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
      setStatus(toKoreanErrorMessage(err), true);
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
      setStatus(toKoreanErrorMessage(err), true);
    }
  );
}

function startAdminListeners() {
  if (!isAdmin) {
    hideAdminPanel();
    return;
  }

  showAdminPanel();
  loadMoreAdminCommits(true);
  loadMoreAdminDeletes(true);
}

async function loadMoreAdminCommits(reset = false) {
  if (reset) {
    adminCommitsAll = [];
    adminCommitsCursor = null;
    adminCommitsHasMore = true;
  }
  if (!adminCommitsHasMore) return;

  try {
    const base = [collection(db, 'admin_commits'), orderBy('ts', 'desc'), limit(ADMIN_PAGE_SIZE)];
    const q = adminCommitsCursor ? query(...base, startAfter(adminCommitsCursor)) : query(...base);
    const snapshot = await getDocs(q);
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
    adminCommitsAll = reset ? items : adminCommitsAll.concat(items);
    adminCommitsCursor = snapshot.docs[snapshot.docs.length - 1] || adminCommitsCursor;
    adminCommitsHasMore = snapshot.docs.length === ADMIN_PAGE_SIZE;
    renderAdminCommits(adminCommitsAll);
  } catch (err) {
    setStatus(toKoreanErrorMessage(err), true);
  }
}

async function loadMoreAdminDeletes(reset = false) {
  if (reset) {
    adminDeletesAll = [];
    adminDeletesCursor = null;
    adminDeletesHasMore = true;
  }
  if (!adminDeletesHasMore) return;

  try {
    const base = [collection(db, 'audit_logs'), orderBy('deletedAt', 'desc'), limit(ADMIN_PAGE_SIZE)];
    const q = adminDeletesCursor ? query(...base, startAfter(adminDeletesCursor)) : query(...base);
    const snapshot = await getDocs(q);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const snap of snapshot.docs) {
      const data = snap.data();
      const dt = data.deletedAt?.toDate?.();
      if (dt && dt.getTime() < cutoff) {
        try {
          await deleteDoc(snap.ref);
        } catch (_err) {}
      }
    }
    const items = snapshot.docs
      .map((snap) => snap.data())
      .map((data) => ({
        actorUid: data.actorUid || null,
        actorEmail: data.actorEmail || null,
        noteId: data.noteId || null,
        noteTitle: data.noteTitle || 'Untitled note',
        deletedContent: data.deletedContent || '',
        deletedAt: data.deletedAt?.toDate?.() ?? null
      }))
      .filter((item) => !item.deletedAt || item.deletedAt.getTime() >= cutoff);

    adminDeletesAll = reset ? items : adminDeletesAll.concat(items);
    adminDeletesCursor = snapshot.docs[snapshot.docs.length - 1] || adminDeletesCursor;
    adminDeletesHasMore = snapshot.docs.length === ADMIN_PAGE_SIZE;
    renderAdminDeletes(adminDeletesAll);
  } catch (err) {
    setStatus(toKoreanErrorMessage(err), true);
  }
}

function openAdminPasswordModal() {
  return new Promise((resolve) => {
    adminPasswordModal.classList.remove('hidden');
    adminPasswordModalInput.value = '';
    adminPasswordModalInput.focus();

    const cleanup = () => {
      adminPasswordConfirmBtn.removeEventListener('click', onConfirm);
      adminPasswordCancelBtn.removeEventListener('click', onCancel);
      adminPasswordModal.classList.add('hidden');
    };

    const onConfirm = () => {
      const value = adminPasswordModalInput.value;
      cleanup();
      resolve(value || null);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    adminPasswordConfirmBtn.addEventListener('click', onConfirm);
    adminPasswordCancelBtn.addEventListener('click', onCancel);
  });
}

function openDetailModal(title, content, filename) {
  detailModalTitle.textContent = title;
  detailModalContent.value = content;
  detailDownloadName = filename || 'detail.txt';
  detailModal.classList.remove('hidden');
}

function closeDetailModal() {
  detailModal.classList.add('hidden');
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

    const password = isAdminLogin ? await openAdminPasswordModal() : idPart;
    if (isAdminLogin && !password) {
      loginStatus.textContent = '관리자 비밀번호를 입력해주세요.';
      loginStatus.style.color = '#f87171';
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    emailInput.value = '';
  } catch (err) {
    loginStatus.textContent = `로그인 실패: ${toKoreanErrorMessage(err)}`;
    loginStatus.style.color = '#f87171';
  }
});

adminCommitsRefreshBtn.addEventListener('click', () => {
  loadMoreAdminCommits(true);
});
adminCommitsMoreBtn.addEventListener('click', () => {
  loadMoreAdminCommits(false);
});
adminDeletesRefreshBtn.addEventListener('click', () => {
  loadMoreAdminDeletes(true);
});
adminDeletesMoreBtn.addEventListener('click', () => {
  loadMoreAdminDeletes(false);
});

detailModalCloseBtn.addEventListener('click', closeDetailModal);
detailModalDownloadBtn.addEventListener('click', () => {
  const blob = new Blob([detailModalContent.value || ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = detailDownloadName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

newNoteBtn.addEventListener('click', async () => {
  try {
    await createNote();
  } catch (err) {
    setStatus(toKoreanErrorMessage(err), true);
  }
});

commitBtn.addEventListener('click', commitCurrentNote);
deleteNoteBtn.addEventListener('click', async () => {
  try {
    await deleteCurrentNote();
  } catch (err) {
    setStatus(toKoreanErrorMessage(err), true);
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
    loginStatus.textContent = `설정 오류: ${toKoreanErrorMessage(err)}`;
    loginStatus.style.color = '#f87171';
  }
});
