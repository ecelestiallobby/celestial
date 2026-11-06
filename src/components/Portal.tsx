import React, { useState } from 'react';
import { ONBOARDING_STEPS } from '../catalog';
import { ActiveOrder, DeliveryDetails, DemoAccessCredentials } from '../types';
import { OrderTimeline } from './OrderTimeline';

interface PortalProps {
  onEnterStore: () => void;
  activeOrder: ActiveOrder;
  deliveryDetails?: DeliveryDetails;
  onUpdateStatus?: (newStatus: ActiveOrder['status']) => void;
}

type PortalView = 'landing' | 'guest' | 'onboarding' | 'regular-gate' | 'regular-home';

export const Portal: React.FC<PortalProps> = ({
  onEnterStore,
  activeOrder,
  deliveryDetails,
  onUpdateStatus
}) => {
  const [view, setView] = useState<PortalView>('landing');
  const [onboardStep, setOnboardStep] = useState(0);
  const [purchaseIntent, setPurchaseIntent] = useState<'now' | 'later'>('now');

  // Accordion / panel states
  const [guestCelestialsOpen, setGuestCelestialsOpen] = useState(false);
  const [guestFoundersOpen, setGuestFoundersOpen] = useState(false);
  const [regularCelestialsOpen, setRegularCelestialsOpen] = useState(false);
  const [regularFoundersOpen, setRegularFoundersOpen] = useState(false);

  // Gate inputs & status
  const [accessIdInput, setAccessIdInput] = useState('');
  const [apgInput, setApgInput] = useState('');
  const [gateMessage, setGateMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Credentials dialog
  const [showCredsModal, setShowCredsModal] = useState<DemoAccessCredentials | null>(null);

  // Tracker & History in Regular Home
  const [activeHomePanel, setActiveHomePanel] = useState<'none' | 'tracker' | 'history'>('tracker');
  const [trackerQuery, setTrackerQuery] = useState(activeOrder?.orderId || '');
  const [trackerResult, setTrackerResult] = useState<{ found: boolean; message: string } | null>(
    activeOrder?.orderId ? { found: true, message: `Active order ${activeOrder.orderId} verified in celestial ledger.` } : null
  );

  const startOnboarding = () => {
    setOnboardStep(0);
    setPurchaseIntent('now');
    setView('onboarding');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createDemoCredentials = (): DemoAccessCredentials => {
    let creds: DemoAccessCredentials | null = null;
    try {
      const saved = localStorage.getItem('CL_DEMO_ACCESS');
      if (saved) creds = JSON.parse(saved);
    } catch {
      // ignore
    }

    if (!creds) {
      const rand = (n: number) => Math.random().toString(36).slice(2, 2 + n).toUpperCase();
      creds = {
        accessId: 'CL-' + rand(4) + '-' + rand(4),
        apg: 'APG-' + rand(6)
      };
      localStorage.setItem('CL_DEMO_ACCESS', JSON.stringify(creds));
    }
    return creds;
  };

  const handleOnboardContinue = () => {
    if (onboardStep === 7) {
      if (purchaseIntent === 'later') {
        setView('landing');
        return;
      }
      const creds = createDemoCredentials();
      setShowCredsModal(creds);
      return;
    }
    setOnboardStep(prev => Math.min(7, prev + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOnboardBack = () => {
    setOnboardStep(prev => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        text: 'No matching demo credentials found. Complete New Client onboarding in this browser first to generate access keys.',
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
        <div className="portal-brand cursor-pointer" onClick={() => setView('landing')}>
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

            <div className="mt-5 flex justify-center">
              <button
                className="primary-action"
                onClick={() => {
                  setActiveHomePanel('tracker');
                  setView('regular-gate');
                  setGateMessage(null);
                }}
              >
                Track Order <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        {/* GUEST VIEW */}
        {view === 'guest' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back flex items-center gap-1" onClick={() => setView('landing')}>
                ← Lobby
              </button>
              <span>PUBLIC ENVIRONMENT</span>
            </div>
            <h2 className="section-title">Guest Environment</h2>
            <p className="section-copy">Explore the people and begin the introduction to the Celestial Lobby experience.</p>

            <div className="portal-panel mt-6">
              <button className="expand-head" onClick={() => setGuestCelestialsOpen(!guestCelestialsOpen)}>
                <span>
                  <small>ARCHIVE</small>
                  <b>Celestials</b>
                </span>
                <span>{guestCelestialsOpen ? '－' : '＋'}</span>
              </button>
              {guestCelestialsOpen && (
                <div className="expand-body border-t border-purple-500/10 pt-3">
                  The Celestial Archive is reserved for the story and realm details supplied by the owner. Its full archive will be added when the official lore is provided.
                </div>
              )}
            </div>

            <div className="portal-panel">
              <button className="expand-head" onClick={() => setGuestFoundersOpen(!guestFoundersOpen)}>
                <span>
                  <small>ARCHIVE</small>
                  <b>Founders</b>
                </span>
                <span>{guestFoundersOpen ? '－' : '＋'}</span>
              </button>
              {guestFoundersOpen && (
                <div className="expand-body border-t border-purple-500/10 pt-3">
                  The Founders Archive will contain four founder profiles. The biographies are intentionally left for the owner&apos;s source material.
                </div>
              )}
            </div>

            <div className="portal-panel">
              <div className="expand-head">
                <span>
                  <small>INTRODUCTION</small>
                  <b>Onboarding Session</b>
                </span>
                <span>→</span>
              </div>
              <div className="expand-body pt-0">
                Begin the guided eight-step introduction to the Celestial Lobby, including its 3S standards, ten non-negotiables, process flow, store overview and purchasing information.
                <br /><br />
                <button className="primary-action" onClick={startOnboarding}>
                  Begin Onboarding
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ONBOARDING VIEW */}
        {view === 'onboarding' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back flex items-center gap-1" onClick={() => setView('landing')}>
                ← Lobby
              </button>
              <span>NEW CLIENT JOURNEY</span>
            </div>

            <div className="onboard-progress">
              <div style={{ width: `${(onboardStep + 1) * 12.5}%` }}></div>
            </div>
            <div className="step-meta">STEP {onboardStep + 1} OF 8</div>

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
                    <span>I will think about it first</span>
                  </label>
                  <p className="small-caveat mt-2">You can leave without placing an order.</p>
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
                {onboardStep === 7 ? 'Continue to Store' : 'Continue'}
              </button>
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
            <p className="section-copy">Enter your system-generated identifiers to continue.</p>

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
              {(() => {
                try {
                  const saved = localStorage.getItem('CL_DEMO_ACCESS');
                  if (saved) {
                    const parsed: DemoAccessCredentials = JSON.parse(saved);
                    return (
                      <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-lg text-xs text-purple-300">
                        <span className="text-[10px] uppercase text-amber-300 font-bold block mb-1">
                          Saved in this browser:
                        </span>
                        <div className="font-mono text-white text-[11px]">
                          Access ID: {parsed.accessId} · APG: {parsed.apg}
                        </div>
                        <button
                          className="mt-2 text-[10px] text-amber-300 underline font-semibold"
                          onClick={() => {
                            setAccessIdInput(parsed.accessId);
                            setApgInput(parsed.apg);
                          }}
                        >
                          Auto-fill credentials
                        </button>
                      </div>
                    );
                  }
                } catch {
                  // ignore
                }
                return null;
              })()}
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
      </main>

      {/* Footer */}
      <footer className="portal-footer">
        <span>TERMS &amp; CONDITIONS</span>
        <i>|</i>
        <span>DATA PRIVACY</span>
        <i>|</i>
        <span>INFORMATION SECURITY</span>
      </footer>
      <div className="demo-disclaimer">
        DEMO ONLY · Browser-local storage · Not secure for real customer data or live transactions.
      </div>

      {/* Generated Credentials Modal */}
      {showCredsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card max-w-sm w-full p-6 rounded-2xl border border-amber-400/50 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center text-xl">
                ✦
              </div>
              <h3 className="text-lg font-bold text-amber-300 uppercase">Ascension Process Complete</h3>
              <p className="text-xs text-purple-200 mt-1">
                Your browser demo access credentials have been initialized:
              </p>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-purple-500/30 space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-purple-400">ACCESS ID:</span>
                <span className="text-amber-300 font-bold">{showCredsModal.accessId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400">APG CODE:</span>
                <span className="text-amber-300 font-bold">{showCredsModal.apg}</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed text-center">
              Saved automatically to this browser. You can now access the Client Dashboard or enter the Store directly.
            </p>

            <button
              className="w-full btn-gold py-3 rounded-xl text-xs uppercase tracking-wider font-bold"
              onClick={() => {
                setShowCredsModal(null);
                onEnterStore();
              }}
            >
              Enter Orbit Store ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
