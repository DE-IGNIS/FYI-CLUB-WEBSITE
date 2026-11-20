import React, { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../../lib/firebaseClient';
import { getTeamPhotoUrl, mapPublishedTeamMember } from '../../data/team';
import type { TeamMember } from '../../types';

type Access = 'checking' | 'signed-out' | 'denied' | 'allowed';
type AdminRecord = { id: string; email?: string; role?: 'owner' | 'reviewer' };
type Submission = {
  id: string;
  memberId?: string;
  email?: string;
  name?: string;
  position?: string;
  department?: string;
  team?: string;
  displayGroup?: string;
  specialty?: string;
  quote?: string;
  handle?: string;
  socialLinks?: { linkedin?: string };
  photoDriveId?: string;
  photoUrl?: string;
  status?: 'pending' | 'approved' | 'rejected';
  submittedAt?: string;
  reviewedAt?: { toDate?: () => Date };
};
type AuditEntry = { id: string; action?: string; actorEmail?: string; actorUid?: string; targetName?: string; targetId?: string; durationSeconds?: number; occurredAt?: { toDate?: () => Date }; before?: unknown; after?: unknown };

const panel = 'border-2 border-[#111111] bg-white p-5 sm:p-6 shadow-[5px_5px_0_#111111]';
const label = 'block text-[10px] font-bold uppercase tracking-wider text-[#6E6C65]';

function dateText(value?: string | { toDate?: () => Date }) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value.toDate?.();
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—';
}

function cleanUrl(value?: string) {
  if (!value) return '';
  const input = value.trim();
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

export const AdminPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<Access>('checking');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [adminRecords, setAdminRecords] = useState<AdminRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'owner' | 'reviewer'>('reviewer');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const sessionStartedAt = React.useRef<number | null>(null);
  const photoMigrations = React.useRef(new Set<string>());

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    if (!currentUser) {
      setAccess('signed-out');
      setIsOwner(false);
      return;
    }
    setAccess('checking');
    try {
      const emailKey = currentUser.email?.trim().toLowerCase();
      if (!emailKey) throw new Error('Google account has no email address.');
      const adminRecord = await getDoc(doc(db, 'adminUsers', emailKey));
      const isAdmin = adminRecord.exists() && ['owner', 'reviewer'].includes(adminRecord.data().role);
      setIsOwner(adminRecord.exists() && adminRecord.data().role === 'owner');
      if (isAdmin) {
        const isPasswordAccount = currentUser.providerData.some((provider) => provider.providerId === 'password');
        if (isPasswordAccount && !currentUser.emailVerified) {
          await sendEmailVerification(currentUser);
          setMessage('Verify your email using the link we just sent. Then return here and sign in again.');
          await signOut(auth);
          return;
        }
        setAccess('allowed');
        sessionStartedAt.current = Date.now();
        void addDoc(collection(db, 'auditLogs'), {
          action: 'admin_signed_in', actorUid: currentUser.uid, actorEmail: currentUser.email || '',
          occurredAt: serverTimestamp(),
        }).catch(() => setMessage('Signed in, but the session start could not be added to the audit log.'));
      } else {
        setAccess('denied');
        setMessage('This email is not registered in the admin allowlist. Ask an owner to add it, then sign in again.');
        await signOut(auth);
      }
    } catch {
      setAccess('denied');
    }
  }), []);

  useEffect(() => {
    if (access !== 'allowed') return;
    const stopSubmissions = onSnapshot(collection(db, 'teamSubmissions'), (snapshot) => {
      setSubmissions(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as Submission))
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')));
    }, () => setMessage('Could not load submissions. Check Firestore rules and admin setup.'));
    const stopLogs = onSnapshot(query(collection(db, 'auditLogs'), orderBy('occurredAt', 'desc')), (snapshot) => {
      setAuditLogs(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as AuditEntry)));
    }, () => setMessage('Could not load the audit history.'));
    const stopMembers = onSnapshot(query(collection(db, 'teamMembers'), where('isPublished', '==', true)), (snapshot) => {
      setTeamMembers(snapshot.docs
        .map((entry) => mapPublishedTeamMember(entry.id, entry.data()))
        .filter((member): member is TeamMember => member !== null)
        .sort((a, b) => a.name.localeCompare(b.name)));
    }, () => setMessage('Could not load published team members. Check Firestore rules.'));
    let stopAdmins: () => void = () => {};
    if (isOwner) {
      stopAdmins = onSnapshot(collection(db, 'adminUsers'), (snapshot) => {
        setAdminRecords(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as AdminRecord))
          .filter((entry) => Boolean(entry.email))
          .sort((a, b) => (a.email || '').localeCompare(b.email || '')));
      }, () => setMessage('Could not load the admin allowlist.'));
    }
    return () => { stopSubmissions(); stopLogs(); stopMembers(); stopAdmins(); };
  }, [access, isOwner]);

  useEffect(() => {
    if (access !== 'allowed' || !submissions.length || !teamMembers.length) return;
    const publishedById = new Map(teamMembers.map((member) => [member.id, member]));
    const updates = submissions.flatMap((submission) => {
      if (submission.status !== 'approved' || !submission.memberId || !submission.photoDriveId) return [];
      const published = publishedById.get(submission.memberId);
      const photoUrl = getTeamPhotoUrl(submission.photoUrl, submission.photoDriveId);
      if (!published || published.photoUrl || !photoUrl || photoMigrations.current.has(submission.memberId)) return [];
      photoMigrations.current.add(submission.memberId);
      return [{ memberId: submission.memberId, photoUrl }];
    });
    if (!updates.length) return;

    const batch = writeBatch(db);
    updates.forEach(({ memberId, photoUrl }) => {
      batch.update(doc(db, 'teamMembers', memberId), { photoUrl });
    });
    void batch.commit().catch(() => {
      updates.forEach(({ memberId }) => photoMigrations.current.delete(memberId));
      setMessage('Could not update photos for previously approved profiles. Check Firestore rules and Drive sharing.');
    });
  }, [access, submissions, teamMembers]);

  const pending = useMemo(() => submissions.filter((item) => item.status === 'pending'), [submissions]);

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim().toLowerCase(), loginPassword);
      setLoginPassword('');
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
        ? 'Email or password is incorrect.'
        : 'Email/password sign in failed. Check the address and try again.');
    }
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, loginEmail.trim().toLowerCase());
      setMessage('If an account exists for that email, Firebase has sent a password reset link. Check your inbox and spam folder.');
      setForgotPassword(false);
    } catch {
      setMessage('Could not send the reset email. Check the address and Firebase email templates/settings.');
    }
  };

  const handleSignOut = async () => {
    if (user && sessionStartedAt.current) {
      const durationSeconds = Math.max(0, Math.floor((Date.now() - sessionStartedAt.current) / 1000));
      try {
        await addDoc(collection(db, 'auditLogs'), {
          action: 'admin_signed_out', actorUid: user.uid, actorEmail: user.email || '',
          durationSeconds, occurredAt: serverTimestamp(),
        });
      } catch {
        setMessage('Sign-out session could not be recorded in the audit log.');
      }
    }
    sessionStartedAt.current = null;
    await signOut(auth);
  };

  const addAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !isOwner) return;
    const email = newAdminEmail.trim().toLowerCase();
    if (!/^[^\s@]+@vitbhopal\.ac\.in$/i.test(email)) {
      setMessage('Enter a valid VIT Bhopal account address.');
      return;
    }
    if (email === user.email?.toLowerCase() && newAdminRole !== 'owner') {
      setMessage('The current owner cannot change their own role.');
      return;
    }
    setBusyId(`admin:${email}`);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'adminUsers', email), {
        email, role: newAdminRole, createdAt: serverTimestamp(),
        createdByUid: user.uid, createdByEmail: user.email || '',
      });
      batch.set(doc(collection(db, 'auditLogs')), {
        action: 'admin_user_added', actorUid: user.uid, actorEmail: user.email || '',
        targetId: email, targetName: email, after: { role: newAdminRole }, occurredAt: serverTimestamp(),
      });
      await batch.commit();
      setNewAdminEmail('');
      setMessage(`${email} added as ${newAdminRole}. They can sign in with that Google account.`);
    } catch {
      setMessage('Could not add this account. Check your owner role and Firestore rules.');
    } finally {
      setBusyId(null);
    }
  };

  const removeAdmin = async (record: AdminRecord) => {
    if (!user || !isOwner || !record.email || record.email.toLowerCase() === user.email?.toLowerCase()) return;
    setBusyId(`remove:${record.id}`);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'adminUsers', record.id));
      batch.set(doc(collection(db, 'auditLogs')), {
        action: 'admin_user_removed', actorUid: user.uid, actorEmail: user.email || '',
        targetId: record.email, targetName: record.email, before: { role: record.role || 'reviewer' },
        occurredAt: serverTimestamp(),
      });
      await batch.commit();
      setMessage(`${record.email} removed from the allowlist.`);
    } catch {
      setMessage('Could not remove this account.');
    } finally {
      setBusyId(null);
    }
  };

  const review = async (submission: Submission, decision: 'approved' | 'rejected') => {
    if (!user) return;
    setBusyId(submission.id);
    setMessage('');
    try {
      const batch = writeBatch(db);
      const submissionRef = doc(db, 'teamSubmissions', submission.id);
      batch.update(submissionRef, { status: decision, reviewedAt: serverTimestamp(), reviewedBy: user.uid });
      if (decision === 'approved') {
        if (!submission.memberId || !submission.name || !submission.position || !submission.department) {
          throw new Error('This request is missing required profile fields.');
        }
        const publicProfile = {
          name: submission.name,
          position: submission.position,
          department: submission.department,
          team: submission.team || '',
          displayGroup: submission.displayGroup || submission.department,
          specialty: submission.specialty || '',
          quote: submission.quote || '',
          handle: submission.handle || '',
          socialLinks: {
            linkedin: cleanUrl(submission.socialLinks?.linkedin),
          },
          photoUrl: getTeamPhotoUrl(submission.photoUrl, submission.photoDriveId) || '',
          isPublished: true,
          updatedAt: serverTimestamp(),
        };
        batch.set(doc(db, 'teamMembers', submission.memberId), publicProfile, { merge: true });
      }
      batch.set(doc(collection(db, 'auditLogs')), {
        action: decision === 'approved' ? 'profile_approved' : 'profile_rejected',
        actorUid: user.uid,
        actorEmail: user.email || '',
        targetId: submission.id,
        targetName: submission.name || '',
        before: { status: 'pending' },
        after: { status: decision, published: decision === 'approved' },
        occurredAt: serverTimestamp(),
      });
      await batch.commit();
      setMessage(decision === 'approved' ? `${submission.name} approved and published.` : `${submission.name} rejected.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review failed. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F6F3EB] text-[#111111] px-4 py-8 sm:px-8 sm:py-10 font-mono">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#111111] pb-5 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#FF4800] font-bold">FYI / PRIVATE CONSOLE</p>
            <h1 className="text-3xl sm:text-4xl font-black uppercase mt-1">Team approvals</h1>
            <p className="mt-2 text-xs text-[#6E6C65]">Private review queue · approved profile photos appear on the public website</p>
          </div>
          {user && <button onClick={() => void handleSignOut()} className="border-2 border-[#111111] bg-white px-4 py-2 text-xs font-bold uppercase">Sign out</button>}
        </header>

        {access === 'checking' && <p role="status">Checking administrator access…</p>}
        {access === 'signed-out' && <section className={panel}>
          <div className="mx-auto max-w-md">
            <p className="text-center text-xs uppercase tracking-widest text-[#FF4800] font-bold">FYI CLUB · PRIVATE ADMIN</p>
            <h2 className="mt-2 text-center text-2xl font-black uppercase">{forgotPassword ? 'Reset password' : 'Sign in'}</h2>
            <p className="my-4 text-center text-sm text-[#6E6C65]">Admin access is limited to VIT Bhopal emails added by an owner.</p>
            {forgotPassword ? <form onSubmit={(event) => void handlePasswordReset(event)} className="space-y-3">
              <label className={label} htmlFor="admin-email-reset">VIT Bhopal email</label>
              <input id="admin-email-reset" type="email" required autoComplete="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="Enter your VIT Bhopal email" className="w-full border-2 border-[#111111] px-3 py-3 text-sm" />
              <button className="w-full bg-[#111111] px-4 py-3 text-xs font-bold uppercase text-white">Send reset link</button>
              <button type="button" onClick={() => setForgotPassword(false)} className="w-full py-2 text-xs font-bold uppercase underline">Back to sign in</button>
            </form> : <>
              <form onSubmit={(event) => void handleEmailSignIn(event)} className="space-y-3">
                <div><label className={label} htmlFor="admin-email">Email</label><input id="admin-email" type="email" required autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="Enter your VIT Bhopal email" className="mt-1 w-full border-2 border-[#111111] px-3 py-3 text-sm" /></div>
                <div><label className={label} htmlFor="admin-password">Password</label><input id="admin-password" type="password" required autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-1 w-full border-2 border-[#111111] px-3 py-3 text-sm" /></div>
                <div className="text-right"><button type="button" onClick={() => setForgotPassword(true)} className="text-xs font-bold underline">Forgot password?</button></div>
                <button className="w-full bg-[#111111] px-4 py-3 text-xs font-bold uppercase text-white">Sign in with email</button>
              </form>
              <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase text-[#6E6C65]"><span className="h-px flex-1 bg-[#111111]/20" />or<span className="h-px flex-1 bg-[#111111]/20" /></div>
          <button onClick={() => void signInWithPopup(auth, googleProvider).catch(() => setMessage('Google sign in failed. Check that Google sign-in is enabled in Firebase Authentication.'))} className="w-full border-2 border-[#111111] bg-white px-5 py-3 text-xs font-bold uppercase">Continue with Google</button>
              <p className="mt-4 text-center text-[10px] leading-relaxed text-[#6E6C65]">No public sign-up. An owner must add your VIT email first. Email/password accounts must verify their email before entering.</p>
            </>}
          </div>
        </section>}
        {access === 'denied' && <section className={panel}>
          <h2 className="font-black uppercase text-xl">Access denied</h2>
          <p className="mt-2 text-sm">This Google account is not registered in the Firebase <code>adminUsers</code> allowlist.</p>
          <button onClick={() => void signOut(auth)} className="mt-4 underline">Sign out</button>
        </section>}
        {message && <p role="status" className="my-5 border-l-4 border-[#FF4800] bg-white px-4 py-3 text-sm font-bold">{message}</p>}

        {access === 'allowed' && <>
          {isOwner && <section className={`${panel} mb-7`}>
            <p className="text-xs uppercase tracking-widest text-[#FF4800] font-bold">Owner controls</p>
            <h2 className="mt-1 text-2xl font-black uppercase">Admin allowlist</h2>
            <p className="my-3 text-xs text-[#6E6C65]">Only owners can add or remove accounts. Allowed accounts must use their VIT Bhopal Google email.</p>
            <form onSubmit={(event) => void addAdmin(event)} className="grid sm:grid-cols-[1fr_180px_auto] gap-2">
              <input aria-label="VIT Bhopal email" type="email" required value={newAdminEmail} onChange={(event) => setNewAdminEmail(event.target.value)} placeholder="Enter VIT Bhopal email" className="min-w-0 border-2 border-[#111111] px-3 py-2 text-sm" />
              <select aria-label="Admin role" value={newAdminRole} onChange={(event) => setNewAdminRole(event.target.value as 'owner' | 'reviewer')} className="border-2 border-[#111111] px-3 py-2 text-sm">
                <option value="reviewer">Reviewer</option><option value="owner">Owner</option>
              </select>
              <button disabled={busyId?.startsWith('admin:')} className="border-2 border-[#111111] bg-[#111111] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50">Add account</button>
            </form>
            <div className="mt-4 divide-y divide-[#111111]/20 border-y border-[#111111]/20">
              {adminRecords.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{record.email} <strong className="ml-2 text-[10px] uppercase text-[#FF4800]">{record.role}</strong></span>
                {record.email?.toLowerCase() !== user?.email?.toLowerCase() && <button disabled={busyId === `remove:${record.id}`} onClick={() => void removeAdmin(record)} className="text-xs font-bold uppercase underline disabled:opacity-50">Remove</button>}
              </div>)}
              {!adminRecords.length && <p className="py-3 text-xs">No allowlisted accounts found. Run initial admin setup first.</p>}
            </div>
          </section>}
          <section className="grid grid-cols-2 gap-3 mb-6">
            <div className={panel}><span className={label}>Waiting for review</span><strong className="mt-2 block text-3xl">{pending.length}</strong></div>
            <div className={panel}><span className={label}>All submissions</span><strong className="mt-2 block text-3xl">{submissions.length}</strong></div>
          </section>
          <section className={`${panel} mb-8`}>
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#111111]/20 pb-3 mb-4">
              <div><p className="text-xs uppercase tracking-widest text-[#FF4800] font-bold">Public roster</p><h2 className="text-2xl font-black uppercase">Team members <span className="text-base">({teamMembers.length})</span></h2></div>
              <p className="text-xs">Loaded from <code>teamMembers</code></p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {teamMembers.map((member) => <article key={member.id} className="flex items-center gap-3 border border-[#111111]/20 p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-[#111111] bg-[#F6F3EB] flex items-center justify-center font-bold">
                  <span>{member.initials}</span>
                  {member.photoUrl && <img src={member.photoUrl} alt={member.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                </div>
                <div className="min-w-0"><strong className="block truncate uppercase">{member.name}</strong><p className="text-xs">{member.position} · {member.department}</p><p className="text-[10px] uppercase text-[#6E6C65]">Published</p></div>
              </article>)}
              {!teamMembers.length && <p className="text-sm">No published team members found.</p>}
            </div>
          </section>
          <div className="flex flex-wrap justify-between items-end gap-3 border-b-2 border-[#111111] pb-3 mb-5">
            <div><p className="text-xs uppercase tracking-widest text-[#FF4800] font-bold">Form submissions</p><h2 className="text-2xl font-black uppercase">Review queue</h2></div>
            <button onClick={() => setShowHistory((value) => !value)} className="text-xs font-bold uppercase underline">{showHistory ? 'Hide history' : 'Show reviewed profiles'}</button>
          </div>
          <div className="space-y-5">
            {(showHistory ? submissions : pending).map((item) => <article key={item.id} className={panel}>
              <div className="flex flex-wrap justify-between gap-3 border-b border-[#111111]/20 pb-3 mb-4">
                <div><h3 className="text-xl font-black uppercase">{item.name || 'Unnamed submission'}</h3><p className="text-xs mt-1">{item.department || item.team || 'No team'} · {item.position || 'No position'}</p></div>
                <span className={`text-xs font-bold uppercase ${item.status === 'pending' ? 'text-[#FF4800]' : 'text-[#6E6C65]'}`}>{item.status || 'unknown'}</span>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className={label}>Verified email · private</dt><dd className="break-all">{item.email || '—'}</dd></div>
                <div><dt className={label}>Submitted</dt><dd>{dateText(item.submittedAt)}</dd></div>
                <div><dt className={label}>Public handle</dt><dd>{item.handle || '—'}</dd></div>
                <div><dt className={label}>Specialty</dt><dd>{item.specialty || '—'}</dd></div>
                <div><dt className={label}>LinkedIn profile</dt><dd>{item.socialLinks?.linkedin
                  ? <a className="underline break-all" href={cleanUrl(item.socialLinks.linkedin)} target="_blank" rel="noopener noreferrer">Open LinkedIn profile</a>
                  : '—'}</dd></div>
                {item.quote && <div className="sm:col-span-2"><dt className={label}>Quote</dt><dd>{item.quote}</dd></div>}
              </dl>
              {item.photoDriveId && <a className="inline-block mt-4 text-sm underline" href={`https://drive.google.com/file/d/${encodeURIComponent(item.photoDriveId)}/view`} target="_blank" rel="noreferrer">Review submitted photo in Drive ↗</a>}
              {item.status === 'pending' && <div className="flex flex-wrap gap-3 mt-6">
                <button disabled={busyId === item.id} onClick={() => void review(item, 'approved')} className="bg-[#111111] text-white px-4 py-2 text-xs font-bold uppercase disabled:opacity-50">Approve &amp; publish</button>
                <button disabled={busyId === item.id} onClick={() => void review(item, 'rejected')} className="border-2 border-[#111111] px-4 py-2 text-xs font-bold uppercase disabled:opacity-50">Reject</button>
              </div>}
            </article>)}
            {(showHistory ? submissions : pending).length === 0 && <p className={panel}>{showHistory ? 'No submissions yet.' : 'No profiles are waiting for review.'}</p>}
          </div>

          <section className="mt-12">
            <div className="flex flex-wrap justify-between items-end gap-3 border-b-2 border-[#111111] pb-3 mb-4">
              <div><p className="text-xs uppercase tracking-widest text-[#FF4800] font-bold">Recorded website actions</p><h2 className="text-2xl font-black uppercase">Audit log</h2></div>
              <p className="text-xs">Most recent first</p>
            </div>
            <div className="space-y-3">
              {auditLogs.map((entry) => <article key={entry.id} className="border border-[#111111] bg-white p-4 text-xs">
                <div className="flex flex-wrap justify-between gap-2"><strong className="uppercase">{(entry.action || 'event').replace(/_/g, ' ')}</strong><time>{dateText(entry.occurredAt)}</time></div>
                <p className="mt-2">Actor: {entry.actorEmail || entry.actorUid || '—'} · Target: {entry.targetName || entry.targetId || '—'}</p>
                  {typeof entry.durationSeconds === 'number' && <p className="mt-1">Signed-in duration: {Math.floor(entry.durationSeconds / 60)}m {entry.durationSeconds % 60}s · recorded at sign-out</p>}
                  {Boolean(entry.before || entry.after) && <details className="mt-2"><summary className="cursor-pointer font-bold">View recorded change</summary><pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></details>}
              </article>)}
              {!auditLogs.length && <p className="border border-[#111111] bg-white p-4">No admin actions recorded yet.</p>}
            </div>
          </section>
        </>}
      </div>
    </main>
  );
};
