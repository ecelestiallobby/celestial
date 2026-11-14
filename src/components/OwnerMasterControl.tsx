import React, { useEffect, useMemo, useState } from 'react';
import type { ActiveOrder } from '../types';

type PlatformState = 'live' | 'maintenance' | 'lockdown';
type PipelineStage = 'submitted' | 'packaging' | 'weight-verified' | 'dispatched';
type BetaEntry = { slot: number; code: string; accessId: string; status: 'Unassigned' | 'Active' | 'Revoked' };
type Dweller = { name: string; status: 'Available' | 'Dormant' | 'Hidden'; lore: string };
const KEYS = {
  platform: 'CL_OWNER_PLATFORM_STATE_V1',
  visibility: 'CL_OWNER_VISIBILITY_V1',
  beta: 'CL_OWNER_BETA_KEYS_V1',
  gate: 'CL_OWNER_GATE_THRESHOLDS_V1',
  lore: 'CL_OWNER_DWELLER_CMS_V1',
  notes: 'CL_OWNER_VAULT_NOTES_V1'
};
const defaultDwellers: Dweller[] = [
  'Aelunari','Kaelthari','Vaelith','Seraphim','Nhyxari','Xyrem','Veyrath','The Dragornborns'
].map(name => ({ name, status: 'Available', lore: '' }));
const readJson = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const stages: { id: PipelineStage; label: string; status: ActiveOrder['status'] }[] = [
  { id: 'submitted', label: 'Submitted', status: 'submitted' },
  { id: 'packaging', label: 'In Packaging', status: 'processing' },
  { id: 'weight-verified', label: 'Weight Verified', status: 'processing' },
  { id: 'dispatched', label: 'Dispatched', status: 'in_transit' }
];
const sopItems = ['8×9 bag', 'Inner box', 'Wrapping', 'Decoy item', 'Digital scale weight check'];
const visibilityTargets = [
  { id: 'header', label: 'Header & navigation', selector: '.portal-header' },
  { id: 'footer', label: 'Footer', selector: '.portal-footer' },
  { id: 'links', label: 'Navigation links', selector: '.portal-footer-navigation a, .portal-header a' },
  { id: 'sections', label: 'Content sections', selector: '.guest-content-page section, .portal-main > section' }
];

export const OwnerMasterControl: React.FC<{
  activeOrder: ActiveOrder;
  onUpdateStatus?: (status: ActiveOrder['status']) => void;
}> = ({ activeOrder, onUpdateStatus }) => {
  const [platform, setPlatform] = useState<PlatformState>(() => readJson(KEYS.platform, 'live'));
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => readJson(KEYS.visibility, {}));
  const [previewTier, setPreviewTier] = useState<'Owner' | 'Guest' | 'Member' | 'Army'>('Owner');
  const [editMode, setEditMode] = useState(false);
  const [stage, setStage] = useState<PipelineStage>(() => activeOrder.status === 'in_transit' || activeOrder.status === 'out_for_delivery' || activeOrder.status === 'delivered' ? 'dispatched' : activeOrder.status === 'processing' ? 'packaging' : 'submitted');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [beta, setBeta] = useState<BetaEntry[]>(() => readJson(KEYS.beta, []));
  const [betaSearch, setBetaSearch] = useState('');
  const [gate, setGate] = useState(() => readJson(KEYS.gate, { warningAttempts: 2, lockoutMinutes: 60 }));
  const [dwellers, setDwellers] = useState<Dweller[]>(() => readJson(KEYS.lore, defaultDwellers));
  const [banner, setBanner] = useState('');
  const [bannerTier, setBannerTier] = useState('Guest');
  const [notes, setNotes] = useState(() => { try { return localStorage.getItem(KEYS.notes) || ''; } catch { return ''; } });
  const [quickCopy, setQuickCopy] = useState('CELESTIAL LOBBY · OWNER OPERATIONS');
  const [notice, setNotice] = useState('');

  useEffect(() => { try { localStorage.setItem(KEYS.platform, JSON.stringify(platform)); } catch { /* local demo */ } }, [platform]);
  useEffect(() => { try { localStorage.setItem(KEYS.visibility, JSON.stringify(visibility)); } catch { /* local demo */ } }, [visibility]);
  useEffect(() => { try { localStorage.setItem(KEYS.beta, JSON.stringify(beta)); } catch { /* local demo */ } }, [beta]);
  useEffect(() => { try { localStorage.setItem(KEYS.gate, JSON.stringify(gate)); } catch { /* local demo */ } }, [gate]);
  useEffect(() => { try { localStorage.setItem(KEYS.lore, JSON.stringify(dwellers)); } catch { /* local demo */ } }, [dwellers]);
  useEffect(() => { try { localStorage.setItem(KEYS.notes, notes); } catch { /* local demo */ } }, [notes]);
  useEffect(() => {
    document.body.dataset.clPlatformState = platform;
    // Keep the browser-local platform preview active while switching environments.
  }, [platform]);
  useEffect(() => {
    visibilityTargets.forEach(target => {
      document.querySelectorAll<HTMLElement>(target.selector).forEach(element => {
        element.dataset.ownerHidden = visibility[previewTier + ':' + target.id] ? 'true' : 'false';
      });
    });
  }, [visibility, previewTier]);

  const filteredBeta = useMemo(() => beta.filter(entry => !betaSearch || entry.code.toLowerCase().includes(betaSearch.toLowerCase()) || entry.accessId.toLowerCase().includes(betaSearch.toLowerCase())), [beta, betaSearch]);
  const generateBetaBatch = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const makeCode = () => Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    const existing = new Set(beta.map(entry => entry.code));
    const next = Array.from({ length: 20 }, (_, index) => {
      let code = makeCode();
      while (existing.has(code)) code = makeCode();
      existing.add(code);
      return { slot: index + 1, code, accessId: '', status: 'Unassigned' as const };
    });
    setBeta(next);
    setNotice('20 unique invitation codes generated in this browser. These are invitation keys, not individual Access Codes.');
  };
  const updateBeta = (slot: number, patch: Partial<BetaEntry>) => setBeta(current => current.map(entry => entry.slot === slot ? { ...entry, ...patch } : entry));
  const updateStage = (next: PipelineStage) => {
    setStage(next);
    const mapped = stages.find(item => item.id === next);
    if (mapped && activeOrder.orderId) onUpdateStatus?.(mapped.status);
  };
  const toggleVisibility = (id: string) => { const key = previewTier + ':' + id; setVisibility(current => ({ ...current, [key]: !current[key] })); };
  const endLocalSessions = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('CL_GATEWAY_SESSION_V1');
      localStorage.removeItem('CL_ACTIVE_CLIENT_SESSION_V1');
      localStorage.removeItem('CL_ACTIVE_INVITATION_V1');
      localStorage.removeItem('CL_OWNER_BROWSER_SESSION_V1');
      window.location.reload();
    } catch {
      setNotice('The browser blocked session cleanup. Please close this browser session manually.');
    }
  };

  return <div className="owner-master-control">
    <div className="owner-master-heading">
      <div><span className="owner-master-kicker">OWNER AUTHORITY LAYER</span><h3>MASTER CONTROL PLANE</h3></div>
      <span className="owner-master-local">BROWSER DEMO</span>
    </div>
    <p className="owner-master-warning">Controls in this build affect this browser only. Global lockdown, cross-device updates, account revocation and synchronized sessions require the shared Cloudflare backend.</p>

    <details className="owner-master-module" open>
      <summary>01 · GLOBAL COMMAND STRIP <span>{platform.toUpperCase()}</span></summary>
      <div className="owner-master-body">
        <label>LIVE VIEW SIMULATOR</label>
        <div className="owner-tier-switch">{(['Owner','Guest','Member','Army'] as const).map(tier => <button type="button" key={tier} className={previewTier === tier ? 'active' : ''} onClick={() => setPreviewTier(tier)}>{tier}</button>)}</div>
        <label className="mt-3">PLATFORM STATE</label>
        <div className="owner-platform-switch">
          {(['live','maintenance','lockdown'] as const).map(value => <button type="button" key={value} className={platform === value ? 'active' : ''} onClick={() => setPlatform(value)}>{value === 'live' ? 'Live' : value === 'maintenance' ? 'Maintenance' : 'Lockdown'}</button>)}
        </div>
        {platform !== 'live' && <p className="owner-master-alert">{platform === 'maintenance' ? 'Maintenance preview is active in this browser.' : 'Lockdown preview is active in this browser.'} Public visitors on other devices are not affected.</p>}
        <div className="owner-master-row"><div><b>EDIT UI / VISIBILITY MODE</b><small>Toggle selected interface areas in the current browser preview.</small></div><button type="button" className={editMode ? 'active' : ''} onClick={() => setEditMode(value => !value)}>{editMode ? 'EDIT MODE ON' : 'EDIT MODE OFF'}</button></div>
        {editMode && <div className="owner-visibility-list">{visibilityTargets.map(target => <label key={target.id}><span>{target.label}</span><input type="checkbox" checked={!!visibility[target.id]} onChange={() => toggleVisibility(target.id)} /> <small>{visibility[target.id] ? 'Hidden' : 'Visible'}</small></label>)}</div>}
        <label className="mt-3">TIER-TARGETED ANNOUNCEMENT</label>
        <div className="owner-inline-fields"><select value={bannerTier} onChange={event => setBannerTier(event.target.value)}><option>Guest</option><option>Member</option><option>Army</option></select><input value={banner} onChange={event => setBanner(event.target.value)} placeholder="Announcement text" /></div>
        <p className="owner-master-hint">Preview target: {previewTier}. Announcement targeting is stored as a draft here; publishing requires a shared content service.</p>
      </div>
    </details>

    <details className="owner-master-module" open>
      <summary>02 · LIVE OPERATIONS &amp; ORDER PIPELINE <span>{activeOrder.orderId ? '1 ORDER' : 'NO ORDER'}</span></summary>
      <div className="owner-master-body">
        {activeOrder.orderId ? <><div className="owner-order-card"><b>{activeOrder.orderId}</b><span>{String(activeOrder.status).replace(/_/g, ' ').toUpperCase()}</span></div>
          <div className="owner-pipeline">{stages.map((item, index) => <button type="button" key={item.id} className={stage === item.id ? 'active' : ''} onClick={() => updateStage(item.id)}><small>0{index + 1}</small>{item.label}</button>)}</div>
          <label className="mt-3">PACKAGING SOP CHECKLIST</label>
          {sopItems.map(item => <label className="owner-sop-item" key={item}><input type="checkbox" checked={!!checklist[item]} onChange={event => setChecklist(current => ({ ...current, [item]: event.target.checked }))} /><span>{item}</span></label>)}
          <p className="owner-master-hint">Status updates use the existing Order Tracker status field. “In Packaging” and “Weight Verified” both map to the current processing status until the shared order model gains dedicated stages.</p>
        </> : <p className="owner-master-hint">No order is currently present in the shared demo record. The pipeline will appear when an order exists.</p>}
      </div>
    </details>

    <details className="owner-master-module">
      <summary>03 · ACCESS GATE &amp; BETA KEY COMMAND <span>{beta.length} KEYS</span></summary>
      <div className="owner-master-body">
        <p className="owner-master-hint">Beta invitation keys are separate from each tester’s individual Access ID and 8-character alphanumeric Access Code. Beta testers are external testers.</p>
        <button type="button" className="owner-master-action" onClick={() => setQuickCopy('Welcome to the CELESTIAL LOBBY beta. Your invitation key is separate from your individual Access ID and Access Code. Use the credentials issued to you for the Beta Tester environment.')}>PREPARE BETA WELCOME MESSAGE</button>
        <p className="owner-master-hint">The welcome message is loaded into Quick-Copy in the Session Vault below.</p>
        <button type="button" className="owner-master-action" onClick={generateBetaBatch}>GENERATE 20 INVITATION KEYS</button>
        <input className="owner-master-search" value={betaSearch} onChange={event => setBetaSearch(event.target.value)} placeholder="Search invitation code or Access ID" />
        <div className="owner-beta-table">{filteredBeta.map(entry => <div className="owner-beta-row" key={entry.slot}>
          <div><b>BETA {String(entry.slot).padStart(2,'0')}</b><code>{entry.code}</code><small>{entry.status}</small></div>
          <div><input value={entry.accessId} onChange={event => updateBeta(entry.slot, { accessId: event.target.value.toUpperCase(), status: event.target.value.trim() ? 'Active' : 'Unassigned' })} placeholder="Assigned Access ID" /><button type="button" onClick={() => updateBeta(entry.slot, { status: entry.status === 'Revoked' ? 'Active' : 'Revoked' })}>{entry.status === 'Revoked' ? 'RESTORE' : 'KILL ACCESS'}</button></div>
        </div>)}</div>
        <label className="mt-3">GATE THRESHOLDS · LOCAL SETTINGS</label>
        <div className="owner-inline-fields"><label>Warning attempts<input type="number" min="1" max="10" value={gate.warningAttempts} onChange={event => setGate((current: typeof gate) => ({ ...current, warningAttempts: Math.max(1, Math.min(10, Number(event.target.value))) }))} /></label><label>Lockout minutes<input type="number" min="1" max="1440" value={gate.lockoutMinutes} onChange={event => setGate((current: typeof gate) => ({ ...current, lockoutMinutes: Math.max(1, Math.min(1440, Number(event.target.value))) }))} /></label></div>
        <p className="owner-master-hint">Threshold values are saved for the future gate integration. Existing hardcoded demo login behavior is unchanged.</p>
      </div>
    </details>

    <details className="owner-master-module">
      <summary>04 · DYNAMIC CONTENT &amp; LORE CMS <span>{dwellers.length} DWELLERS</span></summary>
      <div className="owner-master-body">
        {dwellers.map((dweller, index) => <div className="owner-lore-row" key={dweller.name}>
          <b>{dweller.name}</b><select value={dweller.status} onChange={event => setDwellers(current => current.map((item, i) => i === index ? { ...item, status: event.target.value as Dweller['status'] } : item))}><option>Available</option><option>Dormant</option><option>Hidden</option></select>
          <textarea value={dweller.lore} onChange={event => setDwellers(current => current.map((item, i) => i === index ? { ...item, lore: event.target.value } : item))} placeholder="Edit dweller lore..." rows={2} />
        </div>)}
        <p className="owner-master-hint">Lore edits and availability states are saved locally. They are not yet published to guest/member/army content across devices.</p>
      </div>
    </details>

    <details className="owner-master-module">
      <summary>05 · SYSTEM &amp; SESSION VAULT <span>PRIVATE</span></summary>
      <div className="owner-master-body">
        <label>OWNER NOTES &amp; SOP REFERENCES<textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Private operational notes, SOP reminders, testing checklist..." /></label>
        <label className="mt-3">QUICK-COPY SNIPPET<textarea rows={2} value={quickCopy} onChange={event => setQuickCopy(event.target.value)} /></label>
        <button type="button" className="owner-master-action" onClick={() => { if (!navigator.clipboard) { setNotice('Clipboard access was unavailable.'); return; } void navigator.clipboard.writeText(quickCopy).then(() => setNotice('Snippet copied.')).catch(() => setNotice('Clipboard access was unavailable.')); }}>COPY SNIPPET</button>
        <button type="button" className="owner-master-danger" onClick={endLocalSessions}>END ALL BROWSER-LOCAL SESSIONS</button>
        <p className="owner-master-hint">Owner pattern/PIN/password controls remain in the existing Restricted Owner Access screen. Session termination here clears only this browser’s local session records.</p>
        {notice && <p className="owner-master-notice" role="status">{notice}</p>}
      </div>
    </details>
  </div>;
};
