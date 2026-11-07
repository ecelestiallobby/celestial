import React, { useState, useEffect, useRef } from 'react';
import { Portal } from './components/Portal';
import { Store } from './components/Store';
import { CelestialState } from './types';

const STORAGE_KEY = 'CELESTIAL_LOBBY_STATE_v1';
const OWNER_SESSION_KEY = 'CL_OWNER_BROWSER_SESSION_V1';
const OWNER_NOTEPAD_KEY = 'CL_OWNER_NOTEPAD_V1';
const OWNER_FEEDBACK_KEY = 'CL_OWNER_FEEDBACK_V1';

const DEFAULT_STATE: CelestialState = {
  currentStep: 1,
  cart: {
    cloud9: 1,
    mars: 1
  },
  addons: {
    lubricant: 0,
    accessory: 0
  },
  specialHandling: 'standard',
  promoCode: '',
  discount: 0,
  deliveryDetails: {
    name: 'Juan Dela Cruz',
    phone: '0917 123 4567',
    address: 'Neo District Orbit Tower',
    method: 'Standard Rider Delivery'
  },
  activeOrder: {
    orderId: '#CL20261104-001',
    startTime: null,
    paymentSender: 'FTA',
    paymentScreenshot: null,
    status: 'submitted'
  }
};

export const App: React.FC = () => {
  const [mode, setMode] = useState<'portal' | 'store'>('portal');
  const [portalStartView, setPortalStartView] = useState<'landing' | 'owner-preview' | 'guest' | 'terms' | 'privacy' | 'info-sec' | 'contact'>('landing');
  const [portalInstanceKey, setPortalInstanceKey] = useState(0);
  const [ownerActive, setOwnerActive] = useState(() => { try { return Number(localStorage.getItem(OWNER_SESSION_KEY) || 0) > Date.now(); } catch { return false; } });
  const [ownerPanel, setOwnerPanel] = useState<'none' | 'notepad' | 'tools'>('none');
  const [ownerNotes, setOwnerNotes] = useState(() => { try { return localStorage.getItem(OWNER_NOTEPAD_KEY) || ''; } catch { return ''; } });
  const [feedbackPage, setFeedbackPage] = useState(''); const [feedbackElement, setFeedbackElement] = useState(''); const [feedbackIssue, setFeedbackIssue] = useState(''); const [feedbackChange, setFeedbackChange] = useState('');
  const [feedbackItems, setFeedbackItems] = useState<Array<{id:string;date:string;page:string;element:string;issue:string;change:string}>>(() => { try { return JSON.parse(localStorage.getItem(OWNER_FEEDBACK_KEY) || '[]'); } catch { return []; } });
  const [referenceImageName, setReferenceImageName] = useState(''); const [referenceImageUrl, setReferenceImageUrl] = useState(''); const imageInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<CelestialState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_STATE, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
    return DEFAULT_STATE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }, [state]);

  useEffect(() => { try { localStorage.setItem(OWNER_NOTEPAD_KEY, ownerNotes); } catch { /* best effort */ } }, [ownerNotes]);
  useEffect(() => { try { localStorage.setItem(OWNER_FEEDBACK_KEY, JSON.stringify(feedbackItems)); } catch { /* best effort */ } }, [feedbackItems]);
  useEffect(() => { if (!ownerActive) return; const expiresAt = Number(localStorage.getItem(OWNER_SESSION_KEY) || 0); const delay = expiresAt - Date.now(); if (delay <= 0) { setOwnerActive(false); return; } const timer = window.setTimeout(() => { localStorage.removeItem(OWNER_SESSION_KEY); setOwnerActive(false); setOwnerPanel('none'); }, delay); return () => window.clearTimeout(timer); }, [ownerActive]);
  useEffect(() => () => { if (referenceImageUrl) URL.revokeObjectURL(referenceImageUrl); }, [referenceImageUrl]);

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('CL_DEMO_ACCESS');
    setState(DEFAULT_STATE);
    setMode('portal');
  };

  return (
    <div className="min-h-screen text-slate-100 bg-[#05040a]">
      {mode === 'portal' ? (
        <Portal
          key={portalInstanceKey}
          initialView={portalStartView}
          activeOrder={state.activeOrder}
          deliveryDetails={state.deliveryDetails}
          onUpdateStatus={(newStatus) => {
            setState(prev => ({
              ...prev,
              activeOrder: {
                ...prev.activeOrder,
                status: newStatus
              }
            }));
          }}
          onOwnerSessionChange={setOwnerActive}
          onEnterStore={() => {
            setMode('store');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
        <Store
          state={state}
          setState={setState}
          onPurchaseWindowExpired={() => {
            setPortalStartView('guest');
            setMode('portal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onReturnToLobby={() => {
            setPortalStartView('landing');
            setMode('portal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenPortalPage={(page) => {
            setPortalStartView(page);
            setMode('portal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onReset={handleReset}
        />
      )}

      {ownerActive && <>
        {ownerPanel==='notepad' && <section className="fixed bottom-24 left-3 z-[200] w-[min(23rem,calc(100vw-1.5rem))] max-h-[72vh] overflow-y-auto rounded-2xl border border-purple-300/40 bg-slate-950/95 p-4 text-slate-100 shadow-2xl">
          <div className="flex justify-between"><strong className="text-amber-300 text-xs">OWNER NOTEPAD &amp; FEEDBACK</strong><button onClick={()=>setOwnerPanel('none')}>×</button></div>
          <label className="mt-2 block text-xs">Working notes</label><textarea rows={4} className="mt-1 w-full rounded-lg bg-slate-900 border border-purple-400/30 p-2 text-sm" value={ownerNotes} onChange={e=>setOwnerNotes(e.target.value)} placeholder="Development notes and reminders..." />
          <p className="text-[10px] text-purple-200/70">Saved in this browser only. Never enter passwords or sensitive customer data.</p>
          <div className="my-3 border-t border-purple-500/30"/><strong className="text-amber-300 text-xs">PAGE FEEDBACK</strong>
          <label className="mt-2 block text-xs">Page or route</label><input className="w-full rounded bg-slate-900 border border-purple-400/30 p-2 text-xs" value={feedbackPage} onChange={e=>setFeedbackPage(e.target.value)} placeholder="e.g. Guest Environment"/>
          <label className="mt-2 block text-xs">Affected element</label><input className="w-full rounded bg-slate-900 border border-purple-400/30 p-2 text-xs" value={feedbackElement} onChange={e=>setFeedbackElement(e.target.value)} placeholder="e.g. Notepad button"/>
          <label className="mt-2 block text-xs">What is wrong?</label><textarea rows={2} className="w-full rounded bg-slate-900 border border-purple-400/30 p-2 text-xs" value={feedbackIssue} onChange={e=>setFeedbackIssue(e.target.value)} />
          <label className="mt-2 block text-xs">What should change?</label><textarea rows={2} className="w-full rounded bg-slate-900 border border-purple-400/30 p-2 text-xs" value={feedbackChange} onChange={e=>setFeedbackChange(e.target.value)} />
          <div className="mt-2 rounded border border-dashed border-purple-400/30 p-2"><input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(referenceImageUrl)URL.revokeObjectURL(referenceImageUrl);setReferenceImageName(f.name);setReferenceImageUrl(URL.createObjectURL(f));}}/><button className="text-xs text-amber-200 underline" onClick={()=>imageInputRef.current?.click()}>Choose temporary screenshot</button>{referenceImageName&&<><p className="text-[10px] mt-1">{referenceImageName} · not saved</p><img src={referenceImageUrl} alt="Temporary screenshot" className="mt-1 max-h-28 rounded object-contain"/><button className="text-[10px] text-red-300 underline" onClick={()=>{URL.revokeObjectURL(referenceImageUrl);setReferenceImageUrl('');setReferenceImageName('');if(imageInputRef.current)imageInputRef.current.value='';}}>Discard image</button></>}<p className="text-[10px] text-purple-200/70">Image preview is temporary; only your written description is saved.</p></div>
          <button disabled={!feedbackPage.trim()||!feedbackIssue.trim()} className="primary-action mt-3 w-full disabled:opacity-40" onClick={()=>{const item={id:String(Date.now()),date:new Date().toISOString(),page:feedbackPage.trim(),element:feedbackElement.trim(),issue:feedbackIssue.trim(),change:feedbackChange.trim()};setFeedbackItems(v=>[item,...v]);setFeedbackPage('');setFeedbackElement('');setFeedbackIssue('');setFeedbackChange('');if(referenceImageUrl)URL.revokeObjectURL(referenceImageUrl);setReferenceImageUrl('');setReferenceImageName('');if(imageInputRef.current)imageInputRef.current.value='';}}>Save text feedback</button>
          <div className="mt-3 flex justify-between text-xs"><span>Saved feedback: {feedbackItems.length}</span><button className="text-amber-200 underline" onClick={()=>{const blob=new Blob([JSON.stringify({notes:ownerNotes,feedback:feedbackItems},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='celestial-owner-feedback.json';a.click();URL.revokeObjectURL(u);}}>Export JSON</button></div>
          {feedbackItems.map(x=><div key={x.id} className="mt-2 rounded border border-purple-400/20 p-2 text-[10px]"><b className="text-amber-200">{x.page}{x.element?' · '+x.element:''}</b><p>{x.issue}</p>{x.change&&<p className="text-emerald-200">Requested: {x.change}</p>}<button className="text-red-300 underline" onClick={()=>setFeedbackItems(v=>v.filter(y=>y.id!==x.id))}>Delete</button></div>)}
        </section>}
        {ownerPanel==='tools' && <section className="fixed bottom-24 right-3 z-[200] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-amber-300/40 bg-slate-950/95 p-4 text-slate-100 shadow-2xl"><div className="flex justify-between"><b className="text-amber-300 text-xs">OWNER OVERRIDE</b><button onClick={()=>setOwnerPanel('none')}>×</button></div><div className="mt-3 grid gap-2"><button className="secondary-action" onClick={()=>{setPortalStartView('owner-preview');setPortalInstanceKey(k=>k+1);setMode('portal');setOwnerPanel('none');window.scrollTo(0,0);}}>Return to Owner Preview</button><button className="secondary-action" onClick={()=>{setPortalStartView('guest');setPortalInstanceKey(k=>k+1);setMode('portal');setOwnerPanel('none');window.scrollTo(0,0);}}>Exit to Guest Homepage</button><button className="primary-action" onClick={()=>{localStorage.removeItem('CL_GUEST_ONBOARDING_V1');sessionStorage.removeItem('CL_ONBOARDING_ACTIVE_SESSION');setPortalStartView('guest');setPortalInstanceKey(k=>k+1);setMode('portal');setOwnerPanel('none');window.scrollTo(0,0);}}>Reset Onboarding Progress</button></div><p className="mt-2 text-[10px] text-amber-100/70">Resets this browser's demo progress only; no server or real business records are changed.</p></section>}
        <div className="fixed bottom-4 right-3 z-[201] flex flex-col items-end gap-2"><button className="rounded-full border border-purple-300/50 bg-slate-950/95 px-4 py-2.5 text-xs font-bold text-purple-100 shadow-xl" onClick={()=>setOwnerPanel(v=>v==='notepad'?'none':'notepad')}>✎ Owner Notepad</button><button className="rounded-full border border-amber-300/60 bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-xl" onClick={()=>setOwnerPanel(v=>v==='tools'?'none':'tools')}>✦ Owner Override</button></div>
      </>}
    </div>
  );
};

export default App;
