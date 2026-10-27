import { useCallback, useEffect, useRef, useState } from 'react';
import { onKeysChanged, readKey, writeKey } from './userData';
import { safeHttpUrl } from './url';

/** Saved hiring contacts (recruiters, hiring managers), on this device only. */
export interface Contact {
  id: string;
  name: string;
  position: string;
  email: string;
  linkedin: string;
  company: string;
  app_key: string | null;
  source: 'hunter' | 'manual';
  notes: string;
  contacted_at: string | null;
  created_at: string;
}

export const CONTACTS_KEY = 'contacts';
export const MAX_CONTACTS = 500;
const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

export function cleanContact(c: Partial<Contact>): Contact | null {
  const name = clip(c.name, 120), email = clip(c.email, 200);
  if (!name && !email) return null;
  return {
    id: clip(c.id, 80) || crypto.randomUUID(), name: name || email, position: clip(c.position, 160), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    linkedin: c.linkedin ? safeHttpUrl(/^https?:/i.test(c.linkedin) ? c.linkedin : `https://${c.linkedin}`) ?? '' : '', company: clip(c.company, 120),
    app_key: c.app_key ? clip(c.app_key, 600) : null, source: c.source === 'hunter' ? 'hunter' : 'manual', notes: clip(c.notes, 2000),
    contacted_at: c.contacted_at && !Number.isNaN(Date.parse(c.contacted_at)) ? c.contacted_at : null, created_at: c.created_at ?? new Date().toISOString(),
  };
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const ref = useRef(contacts); ref.current = contacts;
  useEffect(() => {
    let alive = true;
    const load = async () => { const v = await readKey<Contact[]>(CONTACTS_KEY); if (alive) setContacts(Array.isArray(v) ? v : []); };
    void load();
    const off = onKeysChanged([CONTACTS_KEY], () => void load());
    return () => { alive = false; off(); };
  }, []);
  const commit = useCallback(async (next: Contact[]) => {
    const prev = ref.current; setContacts(next);
    if (await writeKey(CONTACTS_KEY, next.slice(0, MAX_CONTACTS))) return null;
    setContacts(prev); return "Couldn't save. Your browser storage may be full.";
  }, []);
  const save = useCallback(async (c: Partial<Contact>) => {
    const clean = cleanContact(c);
    if (!clean) return 'A contact needs a name or an email.';
    const list = ref.current;
    const dup = list.find((x) => x.id === clean.id || (clean.email && x.email === clean.email));
    if (!dup && list.length >= MAX_CONTACTS) return `You can keep up to ${MAX_CONTACTS} contacts.`;
    return commit(dup ? list.map((x) => (x === dup ? { ...clean, id: dup.id, created_at: dup.created_at } : x)) : [clean, ...list]);
  }, [commit]);
  const remove = useCallback((id: string) => commit(ref.current.filter((c) => c.id !== id)), [commit]);
  return { contacts, save, remove };
}
