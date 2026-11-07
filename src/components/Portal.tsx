import React, { useEffect, useState } from 'react';
import { ONBOARDING_STEPS } from '../catalog';
import { ActiveOrder, DeliveryDetails, DemoAccessCredentials } from '../types';
import { OrderTimeline } from './OrderTimeline';

interface PortalProps {
  initialView?: 'landing' | 'guest' | 'terms' | 'privacy' | 'info-sec' | 'contact';
  onEnterStore: () => void;
  activeOrder: ActiveOrder;
  deliveryDetails?: DeliveryDetails;
  onUpdateStatus?: (newStatus: ActiveOrder['status']) => void;
}

type PortalView = 'landing' | 'guest' | 'onboarding' | 'onboarding-terms' | 'restriction' | 'store-locked' | 'onboarding-submitted' | 'regular-gate' | 'regular-home' | 'terms' | 'privacy' | 'info-sec' | 'contact';

type OnboardingRecord = { status: 'in-progress' | 'restricted' | 'completed'; step: number; startedAt: number; restrictionUntil: number | null; restrictionReason: string; termsAccepted: boolean; helpUsed: boolean; completedSteps?: number[]; purchaseWindowStartedAt?: number | null; purchaseWindowOrderPlacedAt?: number | null; };
const ONBOARDING_STORAGE_KEY = 'CL_GUEST_ONBOARDING_V1';
const ONBOARDING_TIMEOUT_MS = 30 * 60 * 1000;
const RESTRICTION_MS = 24 * 60 * 60 * 1000;
const readOnboardingRecord = (): OnboardingRecord | null => { try { const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY); if (!raw) return null; const parsed = JSON.parse(raw) as OnboardingRecord; const legacyCompleted = parsed.status === 'completed' ? Array.from({ length: 8 }, (_, index) => index) : Array.from({ length: Math.max(0, Math.min(8, parsed.step || 0)) }, (_, index) => index); return { ...parsed, completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : legacyCompleted, purchaseWindowStartedAt: parsed.purchaseWindowStartedAt ?? null, purchaseWindowOrderPlacedAt: parsed.purchaseWindowOrderPlacedAt ?? null }; } catch { return null; } };
type GuestPage = 'home' | '3s' | 'no-nos' | 'faqs' | 'track-order';

export const Portal: React.FC<PortalProps> = ({
  initialView = 'landing',
  onEnterStore,
  activeOrder,
  deliveryDetails,
  onUpdateStatus
}) => {
  const [view, setView] = useState<PortalView>(initialView);
  const [guestPage, setGuestPage] = useState<GuestPage>('home');
  const [onboardStep, setOnboardStep] = useState(0);
  const [purchaseIntent, setPurchaseIntent] = useState<'now' | 'later'>('now');
  const [onboardingRecord, setOnboardingRecord] = useState<OnboardingRecord | null>(() => readOnboardingRecord());
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showRestrictionHelp, setShowRestrictionHelp] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState('Your onboarding session was interrupted or declined.');

  // Accordion / panel states
  const [guestCelestialsOpen, setGuestCelestialsOpen] = useState(false);
  const [guestFoundersOpen, setGuestFoundersOpen] = useState(false);
  const [regularCelestialsOpen, setRegularCelestialsOpen] = useState(false);
  const [regularFoundersOpen, setRegularFoundersOpen] = useState(false);

  // Gate inputs & status
  const [accessIdInput, setAccessIdInput] = useState('');
  const [apgInput, setApgInput] = useState('');
  const [gateMessage, setGateMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Remove credentials created by the previous onboarding demo. Account issuance is not enabled yet.
  useEffect(() => {
    localStorage.removeItem('CL_DEMO_ACCESS');
  }, []);

  // Tracker & History in Regular Home
  const [activeHomePanel, setActiveHomePanel] = useState<'none' | 'tracker' | 'history'>('tracker');
  const [trackerQuery, setTrackerQuery] = useState(activeOrder?.orderId || '');
  const [trackerResult, setTrackerResult] = useState<{ found: boolean; message: string } | null>(
    activeOrder?.orderId ? { found: true, message: `Active order ${activeOrder.orderId} verified in celestial ledger.` } : null
  );

  const persistOnboarding = (record: OnboardingRecord | null) => { setOnboardingRecord(record); try { if (record) localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(record)); else localStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch { /* best effort in this browser demo */ } };

  const applyOnboardingRestriction = (reason: string) => {
    const previous = readOnboardingRecord() || onboardingRecord;
    const record: OnboardingRecord = { status: 'restricted', step: previous?.step ?? onboardStep, startedAt: previous?.startedAt ?? Date.now(), restrictionUntil: Date.now() + RESTRICTION_MS, restrictionReason: reason, termsAccepted: false, helpUsed: previous?.helpUsed ?? false, completedSteps: previous?.completedSteps ?? [], purchaseWindowStartedAt: previous?.purchaseWindowStartedAt ?? null, purchaseWindowOrderPlacedAt: previous?.purchaseWindowOrderPlacedAt ?? null };
    try { sessionStorage.removeItem('CL_ONBOARDING_ACTIVE_SESSION'); } catch { /* best effort */ } persistOnboarding(record); setRestrictionReason(reason); setShowExitWarning(false); setShowRestrictionHelp(false); setGuestPage('home'); setView('guest'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startOnboarding = () => {
    const saved = readOnboardingRecord();
    if (saved?.status === 'restricted' && saved.restrictionUntil && Date.now() < saved.restrictionUntil) { setOnboardingRecord(saved); setRestrictionReason(saved.restrictionReason); setView('restriction'); return; }
    const step = saved && saved.status !== 'completed' ? Math.max(0, Math.min(7, saved.step)) : 0;
    const record: OnboardingRecord = saved && saved.status !== 'completed' ? { ...saved, status: 'in-progress', startedAt: Date.now(), restrictionUntil: null, purchaseWindowStartedAt: null, purchaseWindowOrderPlacedAt: null } : { status: 'in-progress', step: 0, startedAt: Date.now(), restrictionUntil: null, restrictionReason: '', termsAccepted: false, helpUsed: false, completedSteps: [], purchaseWindowStartedAt: null, purchaseWindowOrderPlacedAt: null };
    persistOnboarding(record); try { sessionStorage.setItem('CL_ONBOARDING_ACTIVE_SESSION', '1'); } catch { /* best effort */ } setOnboardStep(step); setPurchaseIntent('now'); setShowExitWarning(false); setView('onboarding'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const requestOnboardingExit = () => setShowExitWarning(true);
  const confirmOnboardingExit = () => applyOnboardingRestriction('You chose to leave or navigate away while onboarding was active.');
  const isOnboardingActive = view === 'onboarding' || view === 'onboarding-terms';
  const handleChromeNavigation = (destination: PortalView) => {
    if (isOnboardingActive) {
      requestOnboardingExit();
      return;
    }
    setView(destination);
  };

  useEffect(() => {
    const saved = readOnboardingRecord();
    if (saved?.status === 'completed' && saved.purchaseWindowStartedAt && !saved.purchaseWindowOrderPlacedAt && Date.now() - saved.purchaseWindowStartedAt >= 60 * 60 * 1000) {
      applyOnboardingRestriction('The one-hour purchasing window expired before an order was placed.');
      return;
    }
    let activeSession = false;
    try { activeSession = sessionStorage.getItem('CL_ONBOARDING_ACTIVE_SESSION') === '1'; } catch { /* unavailable */ }
    if (saved?.status === 'in-progress' && !activeSession) {
      const interrupted: OnboardingRecord = { ...saved, status: 'restricted', restrictionUntil: Date.now() + RESTRICTION_MS, restrictionReason: 'The previous browser session ended unexpectedly during onboarding.', termsAccepted: false };
      persistOnboarding(interrupted);
      setRestrictionReason(interrupted.restrictionReason);
    }
  }, []);

  useEffect(() => {
    if (view !== 'onboarding' && view !== 'onboarding-terms') return;
    const checkTimeout = () => { const saved = readOnboardingRecord(); if (saved?.status === 'in-progress' && Date.now() - saved.startedAt >= ONBOARDING_TIMEOUT_MS) applyOnboardingRestriction('The 30-minute onboarding time limit expired.'); };
    checkTimeout(); const timer = window.setInterval(checkTimeout, 1000);
    const handleBeforeUnload = () => { const saved = readOnboardingRecord(); if (saved?.status === 'in-progress') { const restricted: OnboardingRecord = { ...saved, status: 'restricted', restrictionUntil: Date.now() + RESTRICTION_MS, restrictionReason: 'The browser or app was closed or interrupted during onboarding.', termsAccepted: false }; try { localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(restricted)); } catch { /* best effort */ } } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { window.clearInterval(timer); window.removeEventListener('beforeunload', handleBeforeUnload); };
  }, [view]);

  useEffect(() => { if (view !== 'onboarding' && view !== 'onboarding-terms') return; const handlePopState = () => { window.history.pushState({ onboardingGuard: true }, ''); requestOnboardingExit(); }; window.history.pushState({ onboardingGuard: true }, ''); window.addEventListener('popstate', handlePopState); return () => window.removeEventListener('popstate', handlePopState); }, [view]);

  const handleOnboardContinue = () => {
    if (onboardStep === 7) {
      if (purchaseIntent === 'later') { applyOnboardingRestriction('You chose not to proceed with purchasing intent at this time.'); return; }
      const saved = readOnboardingRecord(); if (saved) persistOnboarding({ ...saved, status: 'in-progress', step: 7, completedSteps: Array.from(new Set([...(saved.completedSteps ?? []), 7])), purchaseWindowStartedAt: saved.purchaseWindowStartedAt ?? Date.now(), purchaseWindowOrderPlacedAt: null, restrictionUntil: null, restrictionReason: '' });
      setView('onboarding-terms'); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
    }
    const nextStep = Math.min(7, onboardStep + 1); setOnboardStep(nextStep); const saved = readOnboardingRecord(); if (saved) persistOnboarding({ ...saved, step: nextStep, completedSteps: Array.from(new Set([...(saved.completedSteps ?? []), onboardStep])) }); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOnboardBack = () => { const previousStep = Math.max(0, onboardStep - 1); setOnboardStep(previousStep); const saved = readOnboardingRecord(); if (saved) persistOnboarding({ ...saved, step: previousStep }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleGuestStoreAccess = () => { const saved = readOnboardingRecord(); if (saved?.status === 'completed' && saved.termsAccepted) { onEnterStore(); return; } setView('store-locked'); };
  const handleTermsAcceptance = () => { const saved = readOnboardingRecord(); if (!saved) return; try { sessionStorage.removeItem('CL_ONBOARDING_ACTIVE_SESSION'); } catch { /* best effort */ } persistOnboarding({ ...saved, status: 'completed', termsAccepted: true, completedSteps: Array.from({ length: 8 }, (_, index) => index), restrictionUntil: null }); setTermsAccepted(true); onEnterStore(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleVerifyAccess = () => {
    const a = accessIdInput.trim().toUpperCase();
    const p = apgInput.trim().toUpperCase();
    let creds: DemoAccessCredentials | null = null;

    try {
      const saved = localStorage.getItem('CL_DEMO_ACCESS');
      if (saved) creds = JSON.parse(saved);
    } catch {
      // ignore
    }

    if (creds && a === creds.accessId && p === creds.apg) {
      setGateMessage({
        text: 'Access verified for this browser demo. Warping to Client Dashboard...',
        success: true
      });
      setTimeout(() => {
        setGateMessage(null);
        setView('regular-home');
        setActiveHomePanel('tracker');
        setTrackerQuery(activeOrder?.orderId || '');
        setTrackerResult(activeOrder?.orderId ? { found: true, message: `Active order ${activeOrder.orderId} verified in celestial ledger.` } : null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 700);
    } else {
      setGateMessage({
        text: 'No active client credentials are being issued yet. Completing onboarding does not create an account or grant dashboard access.',
        success: false
      });
    }
  };

  const handleLookupOrder = () => {
    const val = trackerQuery.trim();
    if (!val) {
      setTrackerResult({ found: false, message: 'Please enter an Order ID.' });
      return;
    }
    if (activeOrder && val.toUpperCase() === activeOrder.orderId.toUpperCase()) {
      setTrackerResult({
        found: true,
        message: `Order ${activeOrder.orderId} verified in celestial ledger. Current status: ${activeOrder.status.replace(/_/g, ' ')}.`
      });
    } else {
      setTrackerResult({
        found: false,
        message: 'NO MATCHING ORDER FOUND. Check the Order ID or contact Customer Assistance.'
      });
    }
  };

  return (
    <div className="portal-shell min-h-screen flex flex-col justify-between">
      {/* Top Header */}
      <header className="portal-header">
        <div className="portal-brand cursor-pointer" role="button" tabIndex={0} onClick={() => handleChromeNavigation('landing')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleChromeNavigation('landing'); }}>
          <div className="brand-orbit">✦</div>
          <div>
            <div className="brand-name">CELESTIAL LOBBY</div>
            <div className="brand-sub">A private client environment</div>
          </div>
        </div>
        <div className="demo-chip">DEMO ENVIRONMENT</div>
      </header>

      {/* Main Views Container */}
      <main className="portal-main flex-grow">
        {/* LANDING VIEW */}
        {view === 'landing' && (
          <section className="animate-fadeIn">
            <div className="destination-grid">
              <button className="destination-card" onClick={() => setView('guest')}>
                <span className="dest-icon">◈</span>
                <span className="dest-title">Guest Environment</span>
                <span className="dest-desc">Explore Celestial Lobby, standards, policies and FAQs.</span>
                <span className="dest-action">Explore <b>↗</b></span>
              </button>

              <button className="destination-card" onClick={() => { setView('regular-gate'); setGateMessage(null); }}>
                <span className="dest-icon">⌑</span>
                <span className="dest-title">Regular Client</span>
                <span className="dest-desc">Enter with your Access ID and APG code.</span>
                <span className="dest-action">Access portal <b>↗</b></span>
              </button>
            </div>

          </section>
        )}

        {/* GUEST ENVIRONMENT */}
        {view === 'guest' && (
          <section className="animate-fadeIn">
            <nav className="guest-nav" aria-label="Guest Environment navigation">
              <button className={guestPage === 'home' ? 'active' : ''} onClick={() => setGuestPage('home')}>Home</button>
              <button className={guestPage === '3s' ? 'active' : ''} onClick={() => setGuestPage('3s')}>3S</button>
              <button className={guestPage === 'no-nos' ? 'active' : ''} onClick={() => setGuestPage('no-nos')}>No-Nos</button>
              <button className={guestPage === 'faqs' ? 'active' : ''} onClick={() => setGuestPage('faqs')}>FAQs</button>
              <button onClick={handleGuestStoreAccess}>STORE</button>
              <button className={guestPage === 'track-order' ? 'active' : ''} onClick={() => {
                setGuestPage('track-order');
                setTrackerQuery('');
                setTrackerResult(null);
              }}>Track Order</button>
            </nav>

            {guestPage === 'home' && (
              <>
                <div className="portal-topline">
                  <button className="text-back" onClick={() => setView('landing')}>← Back</button>
                  <span>PUBLIC ENVIRONMENT</span>
                </div>
                <h2 className="section-title">Guest Environment</h2>
                <p className="section-copy">Explore the Celestial Lobby and begin your introduction.</p>
                {onboardingRecord && onboardingRecord.status !== 'completed' && (
                  <div className="portal-panel p-4 mt-4 border border-amber-400/40"><small className="text-amber-300 font-bold tracking-widest">YOUR JOURNEY IS WAITING</small><p className="section-copy mt-2">You have an unfinished onboarding process. Your progress is saved on this browser.</p>{onboardingRecord.status === 'restricted' && onboardingRecord.restrictionUntil && Date.now() < onboardingRecord.restrictionUntil && <p className="text-xs text-amber-200 mt-2">Viewing-only restriction is active. Your journey can resume when the 24-hour period expires.</p>}<button className="primary-action full mt-3" onClick={startOnboarding}>Continue Your Journey</button></div>
                )}
                {onboardingRecord?.status === 'completed' && onboardingRecord.termsAccepted && <div className="portal-panel p-4 mt-4 border border-amber-400/40"><small className="text-amber-300 font-bold tracking-widest">ONBOARDING COMPLETED</small><p className="section-copy mt-2">Your Terms and Policies acknowledgement is recorded in this browser demo.</p><p className="text-xs text-emerald-300 mt-2">{(onboardingRecord.completedSteps ?? []).length} of 8 onboarding steps completed.</p><button className="primary-action full mt-3" onClick={handleGuestStoreAccess}>Enter Guest Store</button></div>}

                <div className="portal-panel mt-6">
                  <button className="expand-head" aria-expanded={guestCelestialsOpen} onClick={() => setGuestCelestialsOpen(!guestCelestialsOpen)}>
                    <span><small>ARCHIVE</small><b>Celestials</b></span>
                    <span>{guestCelestialsOpen ? '－' : '＋'}</span>
                  </button>
                  {guestCelestialsOpen && (
                    <div className="expand-body border-t border-purple-500/10 pt-3">
                      The Celestials archive will be expanded with the official content supplied for this section.
                    </div>
                  )}
                </div>

                <div className="portal-panel">
                  <button className="expand-head" aria-expanded={guestFoundersOpen} onClick={() => setGuestFoundersOpen(!guestFoundersOpen)}>
                    <span><small>ARCHIVE</small><b>Founders</b></span>
                    <span>{guestFoundersOpen ? '－' : '＋'}</span>
                  </button>
                  {guestFoundersOpen && (
                    <div className="expand-body border-t border-purple-500/10 pt-3">
                      The Founders archive will be expanded with the official founder profiles supplied for this section.
                    </div>
                  )}
                </div>

                <div className="portal-panel">
                  <div className="expand-head">
                    <span><small>INTRODUCTION</small><b>Onboarding Session</b></span>
                    <span>→</span>
                  </div>
                  <div className="expand-body pt-0">
                    Start the guided eight-step introduction to the Celestial Lobby.
                    <br /><br />
                    <button className="primary-action" onClick={startOnboarding}>{onboardingRecord && onboardingRecord.status !== 'completed' ? 'Continue Your Journey' : 'Begin Your Journey'}</button>
                  </div>
                </div>
              </>
            )}

            {guestPage === '3s' && (
              <div className="guest-content-page">
                <div className="portal-topline">
                  <button className="text-back" onClick={() => setGuestPage('home')}>← Home</button>
                  <span>GUEST ENVIRONMENT</span>
                </div>
                <h2 className="section-title">3S</h2>
                <p className="section-copy">The 3S page is ready. Its detailed content can be added in the next instruction.</p>
                <div className="portal-panel p-4">
                  <p className="expand-body">3S information will appear here.</p>
                </div>
              </div>
            )}

            {guestPage === 'no-nos' && (
              <div className="guest-content-page">
                <div className="portal-topline">
                  <button className="text-back" onClick={() => setGuestPage('home')}>← Home</button>
                  <span>GUEST ENVIRONMENT</span>
                </div>
                <h2 className="section-title">Non-Negotiables</h2>
                <p className="section-copy">The No-Nos page is ready. Its detailed content can be added in the next instruction.</p>
                <div className="portal-panel p-4">
                  <p className="expand-body">Non-negotiable information will appear here.</p>
                </div>
              </div>
            )}

            {guestPage === 'faqs' && (
              <div className="guest-content-page">
                <div className="portal-topline">
                  <button className="text-back" onClick={() => setGuestPage('home')}>← Home</button>
                  <span>GUEST ENVIRONMENT</span>
                </div>
                <h2 className="section-title">FAQs</h2>
                <p className="section-copy">Frequently asked questions will be organized on this page. Categories and answers can be added in the next instruction.</p>
                <div className="portal-panel p-4">
                  <p className="expand-body">FAQ content will appear here.</p>
                </div>
              </div>
            )}

            {guestPage === 'track-order' && (
              <div className="guest-content-page">
                <div className="portal-topline">
                  <button className="text-back" onClick={() => setGuestPage('home')}>← Home</button>
                  <span>ORDER SERVICES</span>
                </div>
                <h2 className="section-title">Track Order</h2>
                <p className="section-copy">Enter your Order ID to check its current status.</p>
                <div className="portal-panel gate-panel mt-4">
                  <label>
                    ORDER ID
                    <input
                      value={trackerQuery}
                      onChange={(e) => setTrackerQuery(e.target.value)}
                      placeholder="Enter your Order ID"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </label>
                  <button className="primary-action full" onClick={handleLookupOrder}>Track Order</button>
                  {trackerResult && (
                    <p className="form-message font-medium" style={{ color: trackerResult.found ? '#a8d8b0' : '#e8b6a3' }}>
                      {trackerResult.message}
                    </p>
                  )}
                  {trackerResult?.found && activeOrder && (
                    <div className="mt-4 pt-4 border-t border-purple-500/20">
                      <OrderTimeline
                        order={activeOrder}
                        deliveryDetails={deliveryDetails}
                        onUpdateStatus={onUpdateStatus}
                        onEnterStore={handleGuestStoreAccess}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ONBOARDING VIEW */}
        {view === 'onboarding' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back flex items-center gap-1" onClick={requestOnboardingExit}>
                ← Leave Onboarding
              </button>
              <span>NEW CLIENT JOURNEY</span>
            </div>

            <div className="onboard-progress">
              <div style={{ width: `${(onboardStep + 1) * 12.5}%` }}></div>
            </div>
            <div className="step-meta">STEP {onboardStep + 1} OF 8 · {(onboardingRecord?.completedSteps ?? []).length} COMPLETED</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 mb-5" aria-label="Onboarding step completion">
              {ONBOARDING_STEPS.map((step, index) => {
                const completed = (onboardingRecord?.completedSteps ?? []).includes(index);
                const current = index === onboardStep;
                return <div key={step.title} className={`rounded-lg border px-2 py-2 text-[10px] leading-snug ${completed ? 'border-emerald-400/40 bg-emerald-950/30 text-emerald-200' : current ? 'border-amber-400/50 bg-amber-950/20 text-amber-200' : 'border-purple-500/20 bg-slate-950/30 text-purple-300'}`}><span className="block font-bold">{completed ? '✓ COMPLETED' : current ? '● CURRENT' : '○ UPCOMING'}</span><span className="block mt-1">{index + 1}. {step.title}</span></div>;
              })}
            </div>

            <h2 className="section-title">{ONBOARDING_STEPS[onboardStep].title}</h2>
            <div className="onboard-copy">{ONBOARDING_STEPS[onboardStep].copy}</div>

            <div className="onboard-extra">
              {ONBOARDING_STEPS[onboardStep].extra}
              {onboardStep === 7 && (
                <div className="mt-4 pt-3 border-t border-purple-400/20 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-amber-200">
                    <input
                      type="radio"
                      name="purchase-intent"
                      value="now"
                      checked={purchaseIntent === 'now'}
                      onChange={() => setPurchaseIntent('now')}
                      className="accent-amber-400"
                    />
                    <span>I am ready to explore the store</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-purple-300">
                    <input
                      type="radio"
                      name="purchase-intent"
                      value="later"
                      checked={purchaseIntent === 'later'}
                      onChange={() => setPurchaseIntent('later')}
                      className="accent-amber-400"
                    />
                    <span>I am not ready to purchase right now</span>
                  </label>
                  <p className="small-caveat mt-2">Choosing not to proceed exits to the Guest Environment homepage and activates the 24-hour viewing-only restriction.</p>
                </div>
              )}
            </div>

            <div className="onboard-actions">
              <button
                className="secondary-action"
                onClick={handleOnboardBack}
                disabled={onboardStep === 0}
              >
                Back
              </button>
              <button
                className="primary-action"
                onClick={handleOnboardContinue}
              >
                {onboardStep === 7 ? (purchaseIntent === 'later' ? 'Exit Home' : 'Continue to Store') : 'Continue'}
              </button>
            </div>
            {showExitWarning && <div className="portal-panel p-4 mt-5 border border-amber-400/40" role="alertdialog" aria-modal="true" aria-labelledby="leave-onboarding-title"><h3 id="leave-onboarding-title" className="text-amber-200 font-bold">YOUR JOURNEY IS STILL IN PROGRESS</h3><p className="text-sm text-purple-100 mt-2">Leaving now will end this onboarding session and activate a 24-hour viewing-only restriction. Your current step will be saved where browser storage allows.</p><div className="flex flex-col sm:flex-row gap-2 mt-4"><button className="primary-action flex-1" onClick={() => setShowExitWarning(false)}>Continue Onboarding</button><button className="secondary-action flex-1" onClick={confirmOnboardingExit}>Leave Onboarding</button></div></div>}
          </section>
        )}

        {/* ONBOARDING TERMS ACCEPTANCE GATE */}
        {view === 'onboarding-terms' && <section className="animate-fadeIn"><div className="portal-topline"><span>NEW CLIENT JOURNEY</span><span>FINAL REVIEW</span></div><div className="portal-panel p-5 mt-4 space-y-3"><h2 className="section-title">Congratulations on completing onboarding</h2><p className="section-copy">Before entering the Guest Store, review the CELESTIAL LOBBY Terms and Policies.</p><div className="rounded-xl border border-purple-500/20 bg-slate-950/50 p-4 text-xs leading-relaxed text-purple-100 space-y-2"><p><strong className="text-amber-300">Please review these subjects:</strong></p><p>• Pricing and item information</p><p>• Accepted payment methods</p><p>• Ordering methods and processes</p><p>• Applicable policies, restrictions and service guidelines</p><p className="text-purple-300">The complete official policy wording must be published and confirmed by the owner before this demo is used for real transactions.</p></div><label className="flex items-start gap-3 text-sm text-purple-100 leading-relaxed"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 accent-amber-400" /><span>I have read and understand the CELESTIAL LOBBY Terms and Policies, including pricing, payment methods, ordering processes, restrictions and service guidelines.</span></label><button className="primary-action full" disabled={!termsAccepted} onClick={handleTermsAcceptance} style={{ opacity: termsAccepted ? 1 : 0.45, cursor: termsAccepted ? 'pointer' : 'not-allowed' }}>Continue to Store</button><button className="secondary-action w-full mt-2" onClick={() => applyOnboardingRestriction('You declined the final Terms and Policies agreement.')}>I Do Not Agree — Leave</button>{showExitWarning && <div className="rounded-xl border border-amber-400/40 p-3 mt-3 text-sm" role="alertdialog" aria-modal="true"><strong className="text-amber-200">YOUR JOURNEY IS STILL IN PROGRESS</strong><p className="mt-2 text-purple-100">Leaving now activates the 24-hour viewing-only restriction.</p><div className="flex flex-col sm:flex-row gap-2 mt-3"><button className="primary-action flex-1" onClick={() => setShowExitWarning(false)}>Stay and Review</button><button className="secondary-action flex-1" onClick={confirmOnboardingExit}>Leave</button></div></div>}</div></section>}

        {/* 24-HOUR VIEWING-ONLY RESTRICTION */}
        {view === 'restriction' && <section className="animate-fadeIn"><div className="portal-topline"><span>GUEST ENVIRONMENT</span><span>VIEWING-ONLY STATUS</span></div><div className="portal-panel p-5 mt-4 space-y-3"><h2 className="section-title">Your Journey Is Temporarily Paused</h2><p className="section-copy">{restrictionReason}</p><p className="text-sm text-purple-100">A 24-hour viewing-only restriction is active. You may browse permitted public Guest Environment information, but cannot enter the Store or continue onboarding until the restriction expires.</p>{onboardingRecord?.restrictionUntil && <p className="text-xs text-amber-200">Restriction ends: {new Date(onboardingRecord.restrictionUntil).toLocaleString()}</p>}{onboardingRecord?.helpUsed ? <p className="small-caveat">Your one-time Help explanation has already been used in this browser demo.</p> : <button className="secondary-action w-full" onClick={() => { const saved = readOnboardingRecord(); if (saved && !saved.helpUsed) { persistOnboarding({ ...saved, helpUsed: true }); setShowRestrictionHelp(true); } }}>Why can't I continue? — One-time Help</button>}{showRestrictionHelp && <div className="rounded-xl border border-purple-500/30 p-3 text-xs leading-relaxed text-purple-100"><strong className="text-amber-200">Why this restriction exists</strong><p className="mt-2">The onboarding process is designed to help customers become informed buyers who understand CELESTIAL LOBBY's procedures, conditions and service guidelines before proceeding. Your previous interruption or decision was recorded as the reason for this temporary pause.</p></div>}<button className="primary-action full" onClick={() => { setGuestPage('home'); setView('guest'); }}>Return to Guest Homepage</button></div></section>}

        {/* STORE ACCESS GATE */}
        {view === 'store-locked' && <section className="animate-fadeIn"><div className="portal-topline"><button className="text-back" onClick={() => { setGuestPage('home'); setView('guest'); }}>← Guest Homepage</button><span>STORE ACCESS</span></div><div className="portal-panel p-5 mt-4"><h2 className="section-title">Guest Store Access Not Yet Available</h2><p className="section-copy">Complete the onboarding journey and accept the CELESTIAL LOBBY Terms and Policies before entering the Guest Store.</p><button className="primary-action full" onClick={() => { setGuestPage('home'); setView('guest'); }}>Return to Guest Homepage</button></div></section>}

        {/* ONBOARDING SUBMISSION CONFIRMATION */}
        {view === 'onboarding-submitted' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <span>NEW CLIENT JOURNEY</span>
              <span>SUBMISSION STATUS</span>
            </div>
            <div className="portal-panel p-5 md:p-6 mt-4">
              <div className="text-center space-y-3">
                <div className="text-3xl text-amber-300">✦</div>
                <h2 className="section-title">ONBOARDING SUBMISSION RECEIVED</h2>
                <p className="section-copy mx-auto">Your onboarding responses have been completed in this browser demo. This is not an account approval or account activation.</p>
              </div>
              <div className="mt-5 rounded-xl border border-purple-500/20 bg-slate-950/50 p-4 space-y-2 text-xs leading-relaxed text-purple-100">
                <p><strong className="text-amber-300">What happens now?</strong></p>
                <p>1. Your onboarding flow is complete.</p>
                <p>2. No Access ID or APG code has been generated or saved.</p>
                <p>3. No Regular Client Dashboard account has been created or approved.</p>
                <p>4. Account eligibility, restrictions, and access permissions will be configured later by the owner.</p>
                <p>5. You can return to the Guest Environment to explore its public information.</p>
              </div>
              <button className="primary-action full mt-5" onClick={() => { setGuestPage('home'); setView('guest'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Return to Guest Environment
              </button>
              <p className="small-caveat text-center">Store and client-account permissions are not being granted by this confirmation.</p>
            </div>
          </section>
        )}

        {/* REGULAR GATE VIEW */}
        {view === 'regular-gate' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back flex items-center gap-1" onClick={() => setView('landing')}>
                ← Lobby
              </button>
              <span>CLIENT ACCESS GATE</span>
            </div>

            <h2 className="section-title">Regular Client</h2>
            <p className="section-copy">Client account access is not enabled yet. Access IDs and APG codes will only be issued after the account restrictions and eligibility rules are finalized.</p>

            <div className="portal-panel gate-panel mt-4">
              <label>
                ACCESS ID
                <input
                  value={accessIdInput}
                  onChange={(e) => setAccessIdInput(e.target.value)}
                  placeholder="e.g. CL-XXXX-XXXX"
                  autoComplete="off"
                  spellCheck="false"
                />
              </label>

              <label>
                APG CODE
                <input
                  value={apgInput}
                  onChange={(e) => setApgInput(e.target.value)}
                  placeholder="e.g. APG-XXXXXX"
                  autoComplete="off"
                  spellCheck="false"
                />
              </label>

              <button className="primary-action full" onClick={handleVerifyAccess}>
                Verify &amp; Enter
              </button>

              {gateMessage && (
                <p
                  className="form-message font-medium"
                  style={{ color: gateMessage.success ? '#a8d8b0' : '#e8b6a3' }}
                >
                  {gateMessage.text}
                </p>
              )}

              <p className="small-caveat mt-3">
                Demo note: this gate compares values saved in this browser. It is not secure authentication.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button className="text-link text-left" onClick={startOnboarding}>
                New here? Begin New Client onboarding
              </button>
              <p className="small-caveat">New client onboarding currently creates no account credentials. Account access will be introduced after the owner defines the eligibility and restriction rules.</p>
            </div>
          </section>
        )}

        {/* REGULAR HOME (DASHBOARD) */}
        {view === 'regular-home' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back flex items-center gap-1" onClick={() => setView('landing')}>
                ← Lobby
              </button>
              <span>REGULAR CLIENT ENVIRONMENT</span>
            </div>

            <h2 className="section-title">Client Dashboard</h2>

            <div className="archive-grid">
              <button className="archive-tile" onClick={() => setRegularCelestialsOpen(!regularCelestialsOpen)}>
                <span>✦ <b>Celestials</b></span>
                <small>Archive {regularCelestialsOpen ? '▲' : '▼'}</small>
              </button>
              <button className="archive-tile" onClick={() => setRegularFoundersOpen(!regularFoundersOpen)}>
                <span>✧ <b>Founders</b></span>
                <small>Archive {regularFoundersOpen ? '▲' : '▼'}</small>
              </button>
            </div>

            {regularCelestialsOpen && (
              <div className="expand-body portal-panel p-4 my-2">
                Celestial Archive content will be added from the official lore supplied by the owner.
              </div>
            )}
            {regularFoundersOpen && (
              <div className="expand-body portal-panel p-4 my-2">
                Four Founder profiles are planned. Source biographies are pending.
              </div>
            )}

            <div className="function-grid">
              <button onClick={onEnterStore}>
                <span>◈</span>
                <b>Store</b>
                <small>Browse &amp; order</small>
              </button>
              <button onClick={() => {
                setActiveHomePanel(activeHomePanel === 'tracker' ? 'none' : 'tracker');
                setTrackerResult(null);
                setTrackerQuery(activeOrder?.orderId || '');
              }}>
                <span>⌁</span>
                <b>Order Tracker</b>
                <small>Find an order</small>
              </button>
              <button onClick={() => setActiveHomePanel(activeHomePanel === 'history' ? 'none' : 'history')}>
                <span>▤</span>
                <b>Order History</b>
                <small>Saved on device</small>
              </button>
            </div>

            <div className="service-strip">
              <span>Quotation</span>
              <span>Canvass</span>
              <span>Personalize</span>
              <span>Promotions</span>
            </div>

            {/* Visual Tracking Spotlight in Regular Home Dashboard */}
            {activeOrder && activeOrder.orderId && activeHomePanel === 'none' && (
              <div className="my-5 animate-fadeIn">
                <OrderTimeline
                  order={activeOrder}
                  deliveryDetails={deliveryDetails}
                  onUpdateStatus={onUpdateStatus}
                  onEnterStore={onEnterStore}
                />
              </div>
            )}

            {/* ORDER TRACKER PANEL */}
            {activeHomePanel === 'tracker' && (
              <div className="portal-panel p-4 md:p-5 my-4 animate-fadeIn space-y-4">
                <div className="expand-head p-0 pb-3 border-b border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-300 text-lg">⌁</span>
                    <b>Order Tracker</b>
                  </div>
                  <button
                    className="text-xs text-purple-400 hover:text-amber-300 p-1 cursor-pointer"
                    onClick={() => setActiveHomePanel('none')}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-amber-300 block uppercase font-bold tracking-wider">
                    ORDER ID
                    <div className="flex gap-2 mt-1.5">
                      <input
                        value={trackerQuery}
                        onChange={(e) => setTrackerQuery(e.target.value)}
                        placeholder="e.g. #CL20261104-001"
                        className="flex-grow p-2.5 bg-[#090d19] border border-purple-500/40 rounded-lg text-white font-mono text-xs focus:border-amber-400 outline-none"
                      />
                      {activeOrder?.orderId && trackerQuery !== activeOrder.orderId && (
                        <button
                          type="button"
                          onClick={() => {
                            setTrackerQuery(activeOrder.orderId);
                            setTrackerResult({
                              found: true,
                              message: `Active order ${activeOrder.orderId} loaded.`
                            });
                          }}
                          className="px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-amber-300 rounded-lg text-xs hover:bg-purple-800/50 whitespace-nowrap cursor-pointer"
                        >
                          Use Active ID
                        </button>
                      )}
                    </div>
                  </label>

                  <button className="primary-action full cursor-pointer" onClick={handleLookupOrder}>
                    Track Order
                  </button>

                  {trackerResult && (
                    <div
                      className={`p-3 rounded-lg text-xs leading-relaxed ${
                        trackerResult.found
                          ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-200'
                          : 'bg-red-950/40 border border-red-500/30 text-red-200'
                      }`}
                    >
                      {trackerResult.message}
                    </div>
                  )}

                  {/* Render Visual Tracking Timeline for Active Order */}
                  {trackerResult?.found && activeOrder && (
                    <div className="mt-4 pt-4 border-t border-purple-500/20 animate-fadeIn">
                      <OrderTimeline
                        order={activeOrder}
                        deliveryDetails={deliveryDetails}
                        onUpdateStatus={onUpdateStatus}
                        onEnterStore={onEnterStore}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ORDER HISTORY PANEL */}
            {activeHomePanel === 'history' && (
              <div className="portal-panel p-4 md:p-5 my-4 animate-fadeIn space-y-4">
                <div className="expand-head p-0 pb-3 border-b border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-300 text-lg">▤</span>
                    <b>Order History</b>
                  </div>
                  <button
                    className="text-xs text-purple-400 hover:text-amber-300 p-1 cursor-pointer"
                    onClick={() => setActiveHomePanel('none')}
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs leading-relaxed text-purple-200">
                  {activeOrder && activeOrder.orderId ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-purple-950/40 rounded-lg border border-purple-500/30 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-amber-300 font-bold">{activeOrder.orderId}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-semibold uppercase">
                              {activeOrder.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-300 mt-0.5">
                            {activeOrder.submittedTime ? `Submitted: ${activeOrder.submittedTime}` : 'Active session demo record'}
                          </p>
                        </div>
                        <button
                          className="text-xs text-amber-300 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                          onClick={onEnterStore}
                        >
                          View in Store ↗
                        </button>
                      </div>

                      {/* Visual Timeline embedded in History */}
                      <OrderTimeline
                        order={activeOrder}
                        deliveryDetails={deliveryDetails}
                        onUpdateStatus={onUpdateStatus}
                        onEnterStore={onEnterStore}
                      />
                    </div>
                  ) : (
                    <div className="text-gray-400 py-4 text-center">No local demo orders found.</div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4">
              <button className="text-back" onClick={() => setView('landing')}>
                Sign out to Lobby
              </button>
            </div>
          </section>
        )}
        {/* HOMEPAGE FOOTNOTE PAGES */}
        {view === 'terms' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back" onClick={() => setView('landing')}>← Homepage</button>
              <span>CELESTIAL LOBBY</span>
            </div>
            <h2 className="section-title">Terms and Conditions</h2>
            <p className="section-copy">The official Terms and Conditions page. Its governing terms and full content will be published here.</p>
            <div className="portal-panel p-4"><p className="expand-body">Terms and Conditions content is pending publication.</p></div>
          </section>
        )}

        {view === 'privacy' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back" onClick={() => setView('landing')}>← Homepage</button>
              <span>CELESTIAL LOBBY</span>
            </div>
            <h2 className="section-title">Data and Privacy</h2>
            <p className="section-copy">Information about data handling, privacy practices, and client information will be provided on this page.</p>
            <div className="portal-panel p-4"><p className="expand-body">Data and Privacy content is pending publication.</p></div>
          </section>
        )}

        {view === 'info-sec' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back" onClick={() => setView('landing')}>← Homepage</button>
              <span>CELESTIAL LOBBY</span>
            </div>
            <h2 className="section-title">Info Sec</h2>
            <p className="section-copy">Information Security guidance and relevant security notices will be published on this page.</p>
            <div className="portal-panel p-4"><p className="expand-body">Information Security content is pending publication.</p></div>
          </section>
        )}

        {view === 'contact' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back" onClick={() => setView('landing')}>← Homepage</button>
              <span>CELESTIAL LOBBY</span>
            </div>
            <h2 className="section-title">Contact Us</h2>
            <p className="section-copy">Official contact channels and customer assistance information will be listed here.</p>
            <div className="portal-panel p-4"><p className="expand-body">Contact details are pending publication.</p></div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="portal-footer" aria-label="Legal and contact links">
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('terms')}>Terms and Conditions</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('privacy')}>Data and Privacy</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('info-sec')}>Info Sec</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('contact')}>Contact Us</button>
      </footer>
      <div className={`demo-disclaimer ${view === 'onboarding' || view === 'onboarding-terms' ? 'hidden' : ''}`}>
        DEMO ONLY · Browser-local storage · Not secure for real customer data or live transactions.
      </div>

    </div>
  );
};
