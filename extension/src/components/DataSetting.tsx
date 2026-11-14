import React, { useRef } from 'react';
import { Download, Upload } from '../lib/icons';
import { exportBackup, exportCsv, importFile } from '../lib/backup';
import { TrackerStore } from '../lib/useTracker';

/**
 * Settings › Your data: back up everything Jobly keeps on this device, restore a backup, bring in applications from a
 * spreadsheet, and export them again. (These lived on the Tracker page, which is switched off for now.)
 */
export const DataSetting: React.FC<{ store: TrackerStore; notify: (message: string, kind?: 'error' | 'info') => void }> = ({ store, notify }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await importFile(file);
      if (result.kind === 'backup') { notify(`Backup restored: ${result.apps} applications and the rest of your Jobly data.`, 'info'); return; }
      if (!result.apps.length) { notify('No rows with a company and a role were found in that file.'); return; }
      const { problem, added } = await store.addMany(result.apps);
      notify(problem ?? `Imported ${added} application${added === 1 ? '' : 's'}. Find them under Saved.`, problem ? 'error' : 'info');
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <fieldset className="card stack settings-card">
      <legend className="label">Your data</legend>
      <p className="text-sm">Everything Jobly keeps is on this device. A backup is one file with your preferences, saved and applied jobs, profiles and contacts. It never includes your Hunter key.</p>
      <div className="row wrap">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void exportBackup()}><Download size={14} aria-hidden="true" /> Download a backup</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} aria-hidden="true" /> Restore or import</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportCsv(store.apps)} disabled={!store.apps.length}><Download size={14} aria-hidden="true" /> Export applications (CSV)</button>
        <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden aria-label="Restore a Jobly backup or import a CSV" onChange={(e) => void onImport(e.target.files?.[0])} />
      </div>
      <p className="hint">Restore takes a Jobly backup file. Import takes a CSV with Company and Role columns, as Google Sheets, Excel or Notion export it.</p>
    </fieldset>
  );
};
