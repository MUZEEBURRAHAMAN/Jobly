import React, { useMemo, useState } from 'react';
import { Contacts, ExternalLink, Mail, Plus, Search, Trash } from '../lib/icons';
import { Contact, Relation, RELATIONS, useContacts } from '../lib/contacts';
import { searchLinks, Who, whoOptions } from '../lib/peopleSearch';
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
  { id: 'referral', label: 'Ask for a referral', subject: 'Could you refer me for the {role} role at {company}?', body: `Hi {first},

I'm {me}, a {headline}. I'm applying for the {role} role at {company}, and I'd be grateful if you'd consider referring me.

{pitch}

Happy to send my resume and a short note you can forward. No worries at all if it isn't a fit.

Thanks,
{me}` },
  { id: 'reference', label: 'Ask to be a reference', subject: 'Would you be a reference for me?', body: `Hi {first},

I'm applying for the {role} role at {company}, and I'd love to list you as a reference. You know my work well, and a few words from you would mean a lot.

If you're happy to, I'll send you the job description and a reminder of what we worked on together.

Thank you,
{me}` },
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
  // The people finder: company and role, who to look for, and a quick form for someone found
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [who, setWho] = useState<Who>('recruiters');
  const [found, setFound] = useState<{ name: string; position: string; link: string; relation: Relation }>({ name: '', position: '', link: '', relation: 'recruiter' });
  const [filter, setFilter] = useState<Relation | 'all'>('all');
  const options = whoOptions(role, profile);
  const current = options.find((o) => o.id === who) ?? options[0];
  const links = searchLinks(company, role, current);
  const pickWho = (id: Who) => { setWho(id); setFound((f) => ({ ...f, relation: id === 'recruiters' ? 'recruiter' : id === 'hiring' ? 'hiring_manager' : id === 'team' ? 'team' : 'referral' })); };
  const saveFound = async () => {
    const problem = await save({ name: found.name, position: found.position, linkedin: found.link, company: company.trim(), app_key: appKey || null, relation: found.relation, source: 'manual' });
    if (problem) { notify(problem); return; }
    notify(`${found.name} saved to your people.`, 'info');
    setFound((f) => ({ ...f, name: '', position: '', link: '' }));
  };
  const shown = filter === 'all' ? contacts : contacts.filter((c) => c.relation === filter);

  const chooseApp = (key: string) => {
    setAppKey(key); const a = tracker.byKey.get(key); setDomain(companyDomain(a?.application_url) || ''); setResults(null);
    if (a) { setCompany(a.company_name); setRole(a.title); }
  };
  const search = async () => {
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) { setError('Enter the company\'s web domain, like acme.com.'); return; }
    setBusy(true); setError(null);
    try { setResults(await findContacts(d, department)); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't search right now."); }
    finally { setBusy(false); }
  };
  const keep = async (f: FoundContact) => {
    const problem = await save({ name: f.name, position: f.position, email: f.email, linkedin: f.linkedin, company: app?.company_name ?? (company || domain), app_key: appKey || null, source: 'hunter',
      relation: /recruit|talent|people|hr\b/i.test(f.position) ? 'recruiter' : 'other' });
    notify(problem ?? `${f.name} saved to your contacts.`, problem ? 'error' : 'info');
  };
  const saved = useMemo(() => new Set(contacts.map((c) => c.email).filter(Boolean)), [contacts]);

  return (
    <div className="section">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div><h2>People</h2><p className="text-sm">Find recruiters, hiring managers and people on the team, ask for a referral, and keep your references in one place.</p></div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" /> Add a person</button>
      </div>

      <section className="card people-finder" aria-labelledby="pf-title">
        <h3 id="pf-title">Find people at a company</h3>
        <p className="text-sm muted">Jobly opens the search on each site in a new tab. It doesn't read those sites or collect anything; you look, and save who you choose.</p>
        <div className="form-grid finder-grid">
          <div className="wide"><label className="label" htmlFor="pf-app">Job</label>
            <select id="pf-app" className="select" value={appKey} onChange={(e) => chooseApp(e.target.value)}>
              <option value="">Type the company and role below</option>
              {tracker.apps.map((a) => <option key={a.key} value={a.key}>{a.company_name} · {a.title}</option>)}
            </select></div>
          <div><label className="label" htmlFor="pf-company">Company</label><input id="pf-company" className="input" value={company} placeholder="e.g. Acme" onChange={(e) => setCompany(e.target.value)} /></div>
          <div><label className="label" htmlFor="pf-role">Role</label><input id="pf-role" className="input" value={role} placeholder="e.g. Product Designer" onChange={(e) => setRole(e.target.value)} /></div>
        </div>
        <div className="row wrap" role="radiogroup" aria-label="Who to look for">
          {options.map((o) => <button key={o.id} type="button" role="radio" aria-checked={current.id === o.id} className="chip" onClick={() => pickWho(o.id)}>{o.label}</button>)}
        </div>
        <p className="hint">{current.hint}</p>
        {links.length === 0 ? <p className="text-sm muted">Type a company to see where to look.</p> : (
          <div className="row wrap people-links">
            {links.map((l) => <a key={l.site} className="btn btn-outline btn-sm" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`Search ${l.site} for ${current.label.toLowerCase()} at ${company}`}>{l.site} <ExternalLink size={13} aria-hidden="true" /></a>)}
          </div>
        )}
        <div className="sub-card people-add">
          <p className="font-medium text-sm">Found someone? Save them here</p>
          <div className="form-grid">
            <div><label className="label" htmlFor="pf-name">Name</label><input id="pf-name" className="input" value={found.name} onChange={(e) => setFound({ ...found, name: e.target.value })} /></div>
            <div><label className="label" htmlFor="pf-pos">Position</label><input id="pf-pos" className="input" value={found.position} onChange={(e) => setFound({ ...found, position: e.target.value })} placeholder="e.g. Design Manager" /></div>
            <div><label className="label" htmlFor="pf-link">Profile link</label><input id="pf-link" className="input" value={found.link} onChange={(e) => setFound({ ...found, link: e.target.value })} placeholder="linkedin.com/in/…, behance.net/…" /></div>
            <div><label className="label" htmlFor="pf-rel">They are</label>
              <select id="pf-rel" className="select" value={found.relation} onChange={(e) => setFound({ ...found, relation: e.target.value as Relation })}>{RELATIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
          </div>
          <button type="button" className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => void saveFound()} disabled={!found.name.trim()}><Plus size={14} aria-hidden="true" /> Save person</button>
        </div>
      </section>

      <div className="card" style={{ padding: 16 }}>
        <h3>Find work emails with Hunter (optional)</h3>
        {!hasHunterKey && <p className="banner" style={{ marginTop: 8 }}>Finding contacts uses your own Hunter account (it has a free plan). <button type="button" className="link" onClick={onOpenPreferences}>Add your Hunter API key</button></p>}
        <div className="form-grid finder-grid" style={{ marginTop: 12 }}>
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
        <p className="hint">Searches go from this browser to Hunter with your key; Jobly never sees them.</p>
      </div>

      <div className="stack">
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <h3>Saved people</h3>
          {contacts.length > 0 && (
            <div className="row wrap" role="group" aria-label="Show">
              {[{ id: 'all' as const, label: 'All' }, ...RELATIONS.filter((r) => contacts.some((c) => c.relation === r.id))].map((r) => (
                <button key={r.id} type="button" className="chip" aria-pressed={filter === r.id} onClick={() => setFilter(r.id)}>{r.label} <span className="count">{r.id === 'all' ? contacts.length : contacts.filter((c) => c.relation === r.id).length}</span></button>
              ))}
            </div>
          )}
        </div>
        {contacts.length === 0 ? <p className="text-sm">No one saved yet. Find people above, or add someone you know, like a former manager who could be a reference.</p> : (
          <ul className="card-grid">{shown.map((c) => {
            const a = c.app_key ? tracker.byKey.get(c.app_key) : undefined;
            return (
              <li key={c.id} className="task-row">
                <Contacts size={16} aria-hidden="true" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="font-medium break">{c.name}{c.relation !== 'other' && <span className="badge badge-outline" style={{ marginLeft: 8 }}>{RELATIONS.find((r) => r.id === c.relation)?.label}</span>}{c.contacted_at && <span className="badge badge-success" style={{ marginLeft: 8 }}>Contacted</span>}</div>
                  <div className="text-xs muted break">{[c.position, c.company, a ? `for ${a.title}` : ''].filter(Boolean).join(' · ')}</div>
                </div>
                {c.email && <CopyButton value={c.email} label={`${c.name}'s email`} />}
                {c.linkedin && <a className="btn btn-ghost btn-sm btn-icon" href={c.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${c.name}'s profile`}><ExternalLink size={14} aria-hidden="true" /></a>}
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
    <Dialog title="Add a person" onClose={onClose}
      footer={<><span className="grow" /><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sm" onClick={async () => setError(await onSave(c))}>Save person</button></>}>
      <div className="form-grid">
        <div><label className="label" htmlFor="ac-name">Name</label><input id="ac-name" className="input" value={c.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><label className="label" htmlFor="ac-pos">Position</label><input id="ac-pos" className="input" value={c.position ?? ''} onChange={(e) => set({ position: e.target.value })} /></div>
        <div><label className="label" htmlFor="ac-email">Email</label><input id="ac-email" type="email" className="input" value={c.email ?? ''} onChange={(e) => set({ email: e.target.value })} /></div>
        <div><label className="label" htmlFor="ac-rel">They are</label>
          <select id="ac-rel" className="select" value={c.relation ?? 'other'} onChange={(e) => set({ relation: e.target.value as Relation })}>{RELATIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
        <div><label className="label" htmlFor="ac-li">Profile link</label><input id="ac-li" className="input" value={c.linkedin ?? ''} onChange={(e) => set({ linkedin: e.target.value })} /></div>
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
