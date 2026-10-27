import React, { useMemo, useState } from 'react';
import { Contacts, ExternalLink, Mail, Plus, Search, Trash } from '../lib/icons';
import { Contact, useContacts } from '../lib/contacts';
import { companyDomain, findContacts, FoundContact } from '../lib/integrations';
import { TrackerStore } from '../lib/useTracker';
import { fullName, Profile } from '../lib/profile';
import { Dialog } from './Dialog';
import { CopyButton } from './CopyButton';

const DEPARTMENTS = [['', 'Anyone'], ['hr', 'HR and recruiting'], ['management', 'Management'], ['it', 'Engineering and IT'], ['design', 'Design'], ['executive', 'Executives']] as const;

const MESSAGES = [
  { id: 'intro', label: 'Email: introduce yourself', subject: 'Interested in the {role} role at {company}', body: `Hi {first},

I'm {me}, a {headline}. I just applied for the {role} role at {company} and wanted to reach out directly.

{pitch}

Would you be open to a short call? I'd love to hear what the team is focused on.

Thanks,
{me}` },
  { id: 'linkedin', label: 'LinkedIn: connection note', subject: '', body: `Hi {first}, I'm {me}, a {headline}. I've applied for the {role} role at {company} and would love to connect and learn more about the team.` },
  { id: 'follow', label: 'Email: follow up after applying', subject: 'Following up on my {role} application', body: `Hi {first},

I applied for the {role} role at {company} recently and wanted to follow up. I'm still very interested, and happy to share more about my work.

Thanks for your time,
{me}` },
];

function fillMessage(text: string, c: Contact, p: Profile | null, role: string): string {
  const latest = p?.work[0];
  const pitch = latest?.bullets.split('\n').map((b) => b.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)[0];
  const values: Record<string, string> = {
    first: c.name.split(' ')[0] || 'there', me: p ? fullName(p) : '', headline: (p?.headline || latest?.title || '').toLowerCase(),
    role: role || 'open', company: c.company || 'your company', pitch: pitch ? `Most recently I ${pitch.charAt(0).toLowerCase()}${pitch.slice(1).replace(/\.$/, '')}.` : '',
  };
  return text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] || `[${k}]`).replace(/\n{3,}/g, '\n\n');
}

export const ContactsView: React.FC<{ tracker: TrackerStore; profile: Profile | null; notify: (m: string, kind?: 'error' | 'info') => void; onOpenPreferences: () => void; hasHunterKey: boolean }> = ({ tracker, profile, notify, onOpenPreferences, hasHunterKey }) => {
  const { contacts, save, remove } = useContacts();
  const [appKey, setAppKey] = useState('');
  const [domain, setDomain] = useState('');
  const [department, setDepartment] = useState('hr');
  const [results, setResults] = useState<FoundContact[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<Contact | null>(null);
  const [adding, setAdding] = useState(false);
  const app = appKey ? tracker.byKey.get(appKey) : undefined;

  const chooseApp = (key: string) => { setAppKey(key); const a = tracker.byKey.get(key); setDomain(companyDomain(a?.application_url) || ''); setResults(null); };
  const search = async () => {
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) { setError('Enter the company\'s web domain, like acme.com.'); return; }
    setBusy(true); setError(null);
    try { setResults(await findContacts(d, department)); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't search right now."); }
    finally { setBusy(false); }
  };
  const keep = async (f: FoundContact) => {
    const problem = await save({ name: f.name, position: f.position, email: f.email, linkedin: f.linkedin, company: app?.company_name ?? domain, app_key: appKey || null, source: 'hunter' });
    notify(problem ?? `${f.name} saved to your contacts.`, problem ? 'error' : 'info');
  };
  const saved = useMemo(() => new Set(contacts.map((c) => c.email).filter(Boolean)), [contacts]);

  return (
    <div className="section">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div><h2>Contacts</h2><p className="text-sm">Find recruiters and hiring managers, save them with the application, and draft a message.</p></div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" /> Add a contact</button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3>Find people at a company</h3>
        {!hasHunterKey && <p className="banner" style={{ marginTop: 8 }}>Finding contacts uses your own Hunter account (it has a free plan). <button type="button" className="link" onClick={onOpenPreferences}>Add your Hunter API key</button></p>}
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="wide"><label className="label" htmlFor="ct-app">For application</label>
            <select id="ct-app" className="select" value={appKey} onChange={(e) => chooseApp(e.target.value)}>
              <option value="">None</option>
              {tracker.apps.map((a) => <option key={a.key} value={a.key}>{a.company_name} · {a.title}</option>)}
            </select></div>
          <div><label className="label" htmlFor="ct-domain">Company domain</label><input id="ct-domain" className="input" value={domain} placeholder="acme.com" onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} /></div>
          <div><label className="label" htmlFor="ct-dept">Department</label>
            <select id="ct-dept" className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>{DEPARTMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        <button type="button" className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => void search()} disabled={busy || !hasHunterKey}><Search size={14} aria-hidden="true" /> {busy ? 'Searching…' : 'Find contacts'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {results && (results.length === 0
          ? <p className="text-sm" style={{ marginTop: 12 }}>No public contacts found for that domain.</p>
          : <ul className="stack" style={{ listStyle: 'none', marginTop: 12 }}>{results.map((r) => (
              <li key={r.email} className="task-row">
                <div className="grow" style={{ minWidth: 0 }}><div className="font-medium break">{r.name}</div><div className="text-xs muted break">{r.position || r.department || 'Role not listed'} · {r.email}</div></div>
                {r.linkedin && <a className="btn btn-ghost btn-sm btn-icon" href={r.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${r.name} on LinkedIn`}><ExternalLink size={14} aria-hidden="true" /></a>}
                {saved.has(r.email) ? <span className="badge badge-success">Saved</span> : <button type="button" className="btn btn-outline btn-sm" onClick={() => void keep(r)}>Save</button>}
              </li>))}</ul>)}
        <p className="hint">Searches go from this browser to Hunter with your key; Jobly's server never sees them.</p>
      </div>

      <div className="stack">
        <h3>Saved contacts</h3>
        {contacts.length === 0 ? <p className="text-sm">No contacts yet.</p> : (
          <ul className="stack" style={{ listStyle: 'none' }}>{contacts.map((c) => {
            const a = c.app_key ? tracker.byKey.get(c.app_key) : undefined;
            return (
              <li key={c.id} className="task-row">
                <Contacts size={16} aria-hidden="true" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="font-medium break">{c.name}{c.contacted_at && <span className="badge badge-success" style={{ marginLeft: 8 }}>Contacted</span>}</div>
                  <div className="text-xs muted break">{[c.position, c.company, a ? `for ${a.title}` : ''].filter(Boolean).join(' · ')}</div>
                </div>
                {c.email && <CopyButton value={c.email} label={`${c.name}'s email`} />}
                {c.linkedin && <a className="btn btn-ghost btn-sm btn-icon" href={c.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${c.name} on LinkedIn`}><ExternalLink size={14} aria-hidden="true" /></a>}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setDrafting(c)}><Mail size={14} aria-hidden="true" /> Draft message</button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => void remove(c.id)} aria-label={`Remove ${c.name}`}><Trash size={14} aria-hidden="true" /></button>
              </li>
            );
          })}</ul>
        )}
      </div>

      {drafting && <OutreachDialog contact={drafting} role={drafting.app_key ? tracker.byKey.get(drafting.app_key)?.title ?? '' : ''} profile={profile}
        onContacted={async () => { const p = await save({ ...drafting, contacted_at: new Date().toISOString() }); if (p) notify(p); setDrafting(null); }} onClose={() => setDrafting(null)} />}
      {adding && <AddContactDialog tracker={tracker} onSave={async (c) => { const p = await save({ ...c, source: 'manual' }); if (p) return p; setAdding(false); return null; }} onClose={() => setAdding(false)} />}
    </div>
  );
};

const OutreachDialog: React.FC<{ contact: Contact; role: string; profile: Profile | null; onContacted: () => void; onClose: () => void }> = ({ contact, role, profile, onContacted, onClose }) => {
  const [kind, setKind] = useState(MESSAGES[0].id);
  const tpl = MESSAGES.find((m) => m.id === kind)!;
  const [text, setText] = useState(() => fillMessage(tpl.body, contact, profile, role));
  const subject = fillMessage(tpl.subject, contact, profile, role);
  const change = (id: string) => { setKind(id); setText(fillMessage(MESSAGES.find((m) => m.id === id)!.body, contact, profile, role)); };
  const tooLong = kind === 'linkedin' && text.length > 300;
  return (
    <Dialog wide title={`Message to ${contact.name}`} onClose={onClose}
      footer={<><span className="grow" /><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button><button type="button" className="btn btn-sm" onClick={onContacted}>Mark as contacted</button></>}>
      <div className="stack">
        <div><label className="label" htmlFor="om-kind">Message</label>
          <select id="om-kind" className="select" value={kind} onChange={(e) => change(e.target.value)}>{MESSAGES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
        {subject && <div className="row"><span className="text-sm grow"><span className="font-medium">Subject:</span> {subject}</span><CopyButton value={subject} label="subject" /></div>}
        <div><label className="label" htmlFor="om-text">Text</label><textarea id="om-text" className="textarea letter" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
          {kind === 'linkedin' && <p className="hint" style={tooLong ? { color: 'var(--warning)' } : undefined}>{text.length}/300 characters (LinkedIn's limit for a connection note)</p>}</div>
        <div className="row wrap">
          <CopyButton value={text} label="message" text />
          {contact.email && kind !== 'linkedin' && <span className="text-sm muted">Send to <span className="font-medium">{contact.email}</span> from your email.</span>}
        </div>
      </div>
    </Dialog>
  );
};

const AddContactDialog: React.FC<{ tracker: TrackerStore; onSave: (c: Partial<Contact>) => Promise<string | null>; onClose: () => void }> = ({ tracker, onSave, onClose }) => {
  const [c, setC] = useState<Partial<Contact>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Contact>) => setC((x) => ({ ...x, ...patch }));
  return (
    <Dialog title="Add a contact" onClose={onClose}
      footer={<><span className="grow" /><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sm" onClick={async () => setError(await onSave(c))}>Save contact</button></>}>
      <div className="form-grid">
        <div><label className="label" htmlFor="ac-name">Name</label><input id="ac-name" className="input" value={c.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><label className="label" htmlFor="ac-pos">Position</label><input id="ac-pos" className="input" value={c.position ?? ''} onChange={(e) => set({ position: e.target.value })} /></div>
        <div><label className="label" htmlFor="ac-email">Email</label><input id="ac-email" type="email" className="input" value={c.email ?? ''} onChange={(e) => set({ email: e.target.value })} /></div>
        <div><label className="label" htmlFor="ac-li">LinkedIn</label><input id="ac-li" className="input" value={c.linkedin ?? ''} onChange={(e) => set({ linkedin: e.target.value })} /></div>
        <div className="wide"><label className="label" htmlFor="ac-app">Application</label>
          <select id="ac-app" className="select" value={c.app_key ?? ''} onChange={(e) => { const a = tracker.byKey.get(e.target.value); set({ app_key: e.target.value || null, company: a?.company_name ?? c.company }); }}>
            <option value="">None</option>{tracker.apps.map((a) => <option key={a.key} value={a.key}>{a.company_name} · {a.title}</option>)}
          </select></div>
        <div className="wide"><label className="label" htmlFor="ac-co">Company</label><input id="ac-co" className="input" value={c.company ?? ''} onChange={(e) => set({ company: e.target.value })} /></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Dialog>
  );
};
