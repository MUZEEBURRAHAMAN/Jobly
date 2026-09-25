import React, { useState } from 'react';
import { Check, Bell, Sliders, Globe, Layers, Save } from 'lucide-react';
import { Preferences } from '../types';

interface PreferencesViewProps {
  preferences: Preferences;
  onSave: (prefs: Preferences) => Promise<void>;
}

export const PreferencesView: React.FC<PreferencesViewProps> = ({ preferences, onSave }) => {
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableRoles = [
    { id: 'product_design', label: 'PRODUCT DESIGN', desc: 'UI/UX, Product Design, Design Systems, UX Research' },
    { id: 'frontend_engineering', label: 'FRONTEND ENGINEERING', desc: 'React, TypeScript, Web Platform, Next.js, Client' },
    { id: 'product_management', label: 'PRODUCT MANAGEMENT', desc: 'Product Manager, Technical PM, Lead PM' },
    { id: 'ai_ml', label: 'AI & MACHINE LEARNING', desc: 'ML Engineer, AI Researcher, Applied Scientist, LLMs' },
    { id: 'fullstack_engineering', label: 'FULLSTACK ENGINEERING', desc: 'Fullstack, Software Engineer, Web Services' },
  ];

  const availableSeniorities = [
    { id: 'intern', label: 'INTERN' },
    { id: 'junior', label: '0–2Y (JUNIOR)' },
    { id: 'mid', label: '2–5Y (MID)' },
    { id: 'senior', label: '5–8Y (SENIOR)' },
    { id: 'lead', label: '8+Y (LEAD/STAFF)' },
  ];

  const toggleRole = (roleId: string) => {
    const roles = prefs.roles.includes(roleId)
      ? prefs.roles.filter((r) => r !== roleId)
      : [...prefs.roles, roleId];
    setPrefs({ ...prefs, roles });
  };

  const toggleSeniority = (senId: string) => {
    const seniorities = prefs.seniorities.includes(senId)
      ? prefs.seniorities.filter((s) => s !== senId)
      : [...prefs.seniorities, senId];
    setPrefs({ ...prefs, seniorities });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(prefs);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {/* Target Roles */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Layers size={13} color="var(--accent)" />
          <span className="eyebrow">TARGET ROLES</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          Jobly monitors and matches postings falling into these disciplines:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {availableRoles.map((role) => {
            const isChecked = prefs.roles.includes(role.id);
            return (
              <div
                key={role.id}
                onClick={() => toggleRole(role.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: isChecked ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all var(--t-fast) var(--ease)',
                }}
              >
                <div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}>
                    {role.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {role.desc}
                  </div>
                </div>

                <div style={{
                  width: 16,
                  height: 16,
                  border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  background: isChecked ? 'var(--accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isChecked && <Check size={11} color="#ffffff" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Seniority & Experience */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Sliders size={13} color="var(--accent)" />
          <span className="eyebrow">EXPERIENCE & SENIORITY</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {availableSeniorities.map((sen) => {
            const isChecked = prefs.seniorities.includes(sen.id);
            return (
              <button
                type="button"
                key={sen.id}
                onClick={() => toggleSeniority(sen.id)}
                className={`filter-pill ${isChecked ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '5px 10px' }}
              >
                {sen.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Remote Only Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={15} color="var(--green)" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.03em' }}>
              REMOTE ONLY
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Filter out physical on-site roles automatically
            </div>
          </div>
        </div>

        <input
          type="checkbox"
          checked={prefs.remote_only}
          onChange={(e) => setPrefs({ ...prefs, remote_only: e.target.checked })}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
      </div>

      {/* Keywords Filter */}
      <div>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>MUST-INCLUDE KEYWORDS</span>
        <input
          type="text"
          className="input-text"
          placeholder="e.g. Next.js, PyTorch, Figma (comma separated)"
          value={prefs.custom_keywords}
          onChange={(e) => setPrefs({ ...prefs, custom_keywords: e.target.value })}
        />
      </div>

      {/* Negative Filter */}
      <div>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>EXCLUDED KEYWORDS</span>
        <input
          type="text"
          className="input-text"
          placeholder="e.g. contract, unpaid, sales, crypto"
          value={prefs.excluded_keywords}
          onChange={(e) => setPrefs({ ...prefs, excluded_keywords: e.target.value })}
        />
      </div>

      {/* Desktop Push Notifications */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={15} color="var(--accent)" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.03em' }}>
              DESKTOP ALERTS
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Grouped push notifications when matches are found
            </div>
          </div>
        </div>

        <input
          type="checkbox"
          checked={prefs.notify_enabled}
          onChange={(e) => setPrefs({ ...prefs, notify_enabled: e.target.checked })}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
      </div>

      {/* Submit Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary"
          style={{ flex: 1, height: 38 }}
        >
          <Save size={13} />
          <span>{saving ? 'SAVING RULES...' : 'SAVE TARGET PREFERENCES'}</span>
        </button>

        {savedSuccess && (
          <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
            ✓ SAVED!
          </span>
        )}
      </div>
    </form>
  );
};
