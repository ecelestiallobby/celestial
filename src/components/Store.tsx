import React, { useState, useEffect } from 'react';
import { CATALOG } from '../catalog';
import { CelestialState } from '../types';

interface StoreProps {
  state: CelestialState;
  setState: React.Dispatch<React.SetStateAction<CelestialState>>;
  onReturnToLobby: () => void;
  onPurchaseWindowExpired: () => void;
  onOpenPortalPage: (page: 'about' | 'three-s' | 'no-nos' | 'faqs' | 'terms' | 'privacy' | 'info-sec' | 'contact') => void;
  onReset: () => void;
}

export const Store: React.FC<StoreProps> = ({
  state,
  setState,
  onReturnToLobby,
  onPurchaseWindowExpired,
  onOpenPortalPage,
  onReset
}) => {
  const [flowNotice, setFlowNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);


  // Calculations
  const stardustSubtotal = CATALOG.stardust.reduce((acc, item) => {
    return acc + item.price * (state.cart[item.id] || 0);
  }, 0);

  const totalItemsCount = Object.values(state.cart).reduce((a, b) => a + b, 0);

  const addonsSubtotal = CATALOG.addons.reduce((acc, addon) => {
    return acc + addon.price * (state.addons[addon.id] || 0);
  }, 0);

  const itemsTotal = stardustSubtotal + addonsSubtotal;
  const handlingCost = 0;
  const handlingName = 'Standard Processing';
  const grandTotal = Math.max(0, itemsTotal + handlingCost - state.discount);

  // One-hour purchasing-intent deadline; separate from the payment timer below.
  useEffect(() => {
    const checkPurchaseWindow = () => {
      try {
        const raw = localStorage.getItem('CL_GUEST_ONBOARDING_V1');
        if (!raw) return;
        const record = JSON.parse(raw);
        if (typeof record.purchaseWindowStartedAt !== 'number' || record.purchaseWindowOrderPlacedAt || record.status === 'restricted') return;
        if (Date.now() - record.purchaseWindowStartedAt >= 60 * 60 * 1000) {
          const now = Date.now();
          localStorage.setItem('CL_GUEST_ONBOARDING_V1', JSON.stringify({ ...record, status: 'restricted', restrictionUntil: now + 24 * 60 * 60 * 1000, restrictionReason: 'The one-hour purchasing window expired before an order was placed.', termsAccepted: false }));
          onPurchaseWindowExpired();
        }
      } catch { /* best effort in this browser demo */ }
    };
    checkPurchaseWindow();
    const timer = window.setInterval(checkPurchaseWindow, 1000);
    return () => window.clearInterval(timer);
  }, [onPurchaseWindowExpired]);

  const navigateTo = (step: number) => {
    if (step > state.currentStep + 1) { setFlowNotice('Please complete the current step before moving ahead.'); return; }
    if (step >= 4 && totalItemsCount === 0) { setFlowNotice('Add at least one ITEM before continuing.'); if (state.currentStep > 2) setState(prev => ({ ...prev, currentStep: 2 })); return; }
    setFlowNotice(''); setState(prev => ({ ...prev, currentStep: step })); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStoreReset = () => {
    onReset();
    setFlowNotice('');
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    setState(prev => {
      const current = prev.cart[itemId] || 0;
      const updated = Math.max(0, current + change);
      const newCart = { ...prev.cart };
      if (updated === 0) {
        delete newCart[itemId];
      } else {
        newCart[itemId] = updated;
      }
      return { ...prev, cart: newCart };
    });
  };

  const updateAddonQuantity = (addonId: string, change: number) => {
    setState(prev => {
      const current = prev.addons[addonId] || 0;
      const updated = Math.max(0, current + change);
      return {
        ...prev,
        addons: { ...prev.addons, [addonId]: updated }
      };
    });
  };

  const placeOrder = () => {
    if (totalItemsCount < 1) {
      setFlowNotice('Your cart is empty. Add at least one ITEM first.');
      setState(prev => ({ ...prev, currentStep: 2 }));
      return;
    }
    if (!state.deliveryDetails.name.trim() || !state.deliveryDetails.phone.trim() || !state.deliveryDetails.address.trim()) {
      setFlowNotice('Complete the required delivery preview details before opening the next demo screen.');
      return;
    }
    if (state.deliveryDetails.method !== 'Standard Rider Delivery') {
      setFlowNotice('Please select the permitted standard delivery method.');
      return;
    }
    setFlowNotice('DEMO ONLY — NO REAL ORDER WILL BE CREATED OR PROCESSED. This opens a payment-screen preview only.');
    setState(prev => ({ ...prev, currentStep: 7 }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitPayment = () => {
    setFlowNotice('DEMO ONLY — PAYMENT SUBMISSION IS DISABLED. No payment proof is collected, stored, transmitted, or processed.');
  };

  const totalCartCount = Object.values(state.cart).reduce((a, b) => a + b, 0);

  return (
    <div className="store-shell portal-shell min-h-screen flex flex-col justify-between animate-fadeIn" data-page="store">
      {/* Shared CELESTIAL LOBBY header, matching portal Screens 1–5 */}
      <header className="portal-header store-header">
        <div className="portal-header-inner">
          <button type="button" className="portal-brand store-brand" aria-label="CELESTIAL LOBBY home" onClick={onReturnToLobby}>
            <span className="brand-name">CELESTIAL LOBBY</span>
          </button>
          <button type="button" className="lobby-menu-trigger" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
            <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
          </button>
        </div>
        {menuOpen && <>
          <button type="button" className="lobby-menu-backdrop" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />
          <nav className="lobby-menu-drawer" aria-label="Main navigation">
            <button onClick={() => { onReturnToLobby(); setMenuOpen(false); }}>HOME</button>
            <button onClick={() => { onOpenPortalPage('about'); setMenuOpen(false); }}>ABOUT US</button>
            <button onClick={() => { onOpenPortalPage('three-s'); setMenuOpen(false); }}>3-S</button>
            <button onClick={() => { onOpenPortalPage('no-nos'); setMenuOpen(false); }}>NO-NOS</button>
            <button onClick={() => { onOpenPortalPage('faqs'); setMenuOpen(false); }}>FAQS</button>
            <button onClick={() => navigateTo(1)}>STORE</button>
            <button onClick={() => navigateTo(8)}>TRACK</button>
          </nav>
        </>}
      </header>

      {/* Store workflow, contained within the shared portal page layout */}
      <main className="store-main max-w-4xl w-full mx-auto p-4 flex-grow relative">
        <section className="store-workflow-tools" aria-label="Store controls">
          <div className="store-workflow-heading">
            <span className="store-kicker">STORE JOURNEY</span>
            <strong>Step {state.currentStep} of 8 · {([
              'Home','Lineup','Cart','Extras','Service','Checkout','Payment','Status'
            ][state.currentStep - 1] || 'Home')}</strong>
          </div>
          <div className="store-progress-dots" aria-label={`Step ${state.currentStep} of 8`}>
            {['Home','Lineup','Cart','Extras','Service','Checkout','Payment','Status'].map((label, index) => (
              <span key={label} aria-label={`${label}${state.currentStep === index + 1 ? ', current step' : ''}`} className={state.currentStep === index + 1 ? 'is-current' : state.currentStep > index + 1 ? 'is-complete' : ''} />
            ))}
          </div>
          <div className="store-quick-actions">
            <button type="button" className="store-quick-button" onClick={handleStoreReset}>
              <i className="fa-solid fa-rotate-left"></i><span>Reset selections</span>
            </button>
            <button type="button" className="store-quick-button" onClick={() => navigateTo(3)}>
              <i className="fa-solid fa-bag-shopping"></i><span>Cart · {totalCartCount}</span>
            </button>
          </div>
        </section>
        {flowNotice && <div role="alert" className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">{flowNotice}</div>}
        {/* VIEW 1: STORE HOMEPAGE */}
        {state.currentStep === 1 && (
          <section className="space-y-6 animate-fadeIn">
            {/* Hero Banner */}
            <div className="relative glass-card rounded-2xl p-8 text-center overflow-hidden border border-purple-500/20">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>

              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-b from-purple-800 to-slate-950 flex items-center justify-center border-2 border-amber-400/60 shadow-xl shadow-purple-900/50">
                <i className="fa-solid fa-orbit text-4xl text-amber-300 star-sparkle"></i>
              </div>

              <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-amber-100 tracking-wider uppercase mb-2">
                Celestial Lobby
              </h2>
              <p className="text-xs md:text-sm text-purple-200 uppercase tracking-widest font-semibold mb-6">
                Enter the Orbit. Choose your Fantasy...
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => navigateTo(2)}
                  className="btn-gold px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-meteor"></i> Explore STARDUST ITEMS
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => navigateTo(2)}
                className="glass-card glass-card-interactive p-6 rounded-2xl cursor-pointer flex flex-col justify-between relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition"></div>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="text-[10px] tracking-widest uppercase text-purple-400 font-bold block mb-1">
                      Primary Realms
                    </span>
                    <h3 className="text-2xl font-bold text-amber-300">STARDUST</h3>
                    <p className="text-xs text-gray-300 mt-1">(Available ITEMS)</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition">
                    <i className="fa-solid fa-globe text-xl"></i>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-purple-200 font-medium">
                  <span>Browse the current demo catalog</span>
                  <span className="text-amber-400 group-hover:translate-x-1 transition flex items-center gap-1 font-semibold">
                    Browse <i className="fa-solid fa-arrow-right"></i>
                  </span>
                </div>
              </div>

              <div
                onClick={() => navigateTo(4)}
                className="glass-card glass-card-interactive p-6 rounded-2xl cursor-pointer flex flex-col justify-between relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition"></div>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="text-[10px] tracking-widest uppercase text-purple-400 font-bold block mb-1">
                      Enhancements
                    </span>
                    <h3 className="text-2xl font-bold text-amber-300">EXTRAS &amp; ADD-ONS</h3>
                    <p className="text-xs text-gray-300 mt-1">Optional enhancements</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition">
                    <i className="fa-solid fa-gem text-xl"></i>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-purple-200 font-medium">
                  <span>Optional extras and add-ons</span>
                  <span className="text-amber-400 group-hover:translate-x-1 transition flex items-center gap-1 font-semibold">
                    View Add-ons <i className="fa-solid fa-arrow-right"></i>
                  </span>
                </div>
              </div>
            </div>

            {/* Celestial Services Box */}
            <div
              onClick={() => navigateTo(5)}
              className="glass-card glass-card-interactive p-6 rounded-2xl cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-950 border border-purple-400/30 flex items-center justify-center text-amber-300 shadow-inner">
                  <i className="fa-solid fa-cube text-2xl"></i>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white uppercase tracking-wider">Celestial Services</h4>
                  <p className="text-xs text-purple-300">Standard processing under the No Rush Orders policy</p>
                </div>
              </div>
              <div className="text-amber-300 text-sm font-semibold flex items-center gap-2">
                <span>Configure</span>
                <i className="fa-solid fa-chevron-right"></i>
              </div>
            </div>

            <div className="text-center pt-4">
              <p className="text-[11px] text-purple-400/70 tracking-widest uppercase font-semibold">
                FANTASY • EUPHORIA • PLEASURE
              </p>
            </div>
          </section>
        )}

        {/* VIEW 2: CATEGORY PAGE (STARDUST) */}
        {state.currentStep === 2 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => navigateTo(1)}
                  className="text-xs text-purple-300 hover:text-amber-300 mb-1 flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left"></i> Back to Homepage
                </button>
                <h2 className="text-2xl font-bold text-amber-300 tracking-wide uppercase">STARDUST</h2>
                <p className="text-xs text-purple-200">OUR SERVER LINEUP &mdash; Choose your realm.</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-purple-300 block">Current Cart</span>
                <span className="text-sm font-bold text-amber-400">₱{stardustSubtotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {CATALOG.stardust.map(item => {
                const qty = state.cart[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="glass-card p-4 rounded-xl flex flex-col justify-between border border-purple-500/20 hover:border-amber-400/40 transition"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-indigo-950/80 border border-purple-400/30 flex items-center justify-center text-amber-300 mb-3">
                        <i className={`fa-solid ${item.icon} text-base`}></i>
                      </div>
                      <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      <p className="text-xs text-purple-300 mb-1">{item.units}</p>
                      <p className="text-sm font-bold text-amber-400">₱{item.price.toLocaleString()}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-purple-900/30 flex items-center justify-between">
                      {qty > 0 ? (
                        <div className="flex items-center space-x-2 bg-slate-950/60 p-1 rounded-lg border border-purple-500/30 w-full justify-between">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="w-6 h-6 rounded bg-indigo-900/60 text-purple-200 text-xs flex items-center justify-center font-bold font-mono hover:bg-indigo-800 transition cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-white px-1">{qty}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="w-6 h-6 rounded bg-indigo-900/60 text-purple-200 text-xs flex items-center justify-center font-bold font-mono hover:bg-indigo-800 transition cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="w-full py-1.5 px-3 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-amber-300 border border-purple-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-[10px]"></i> Add to Cart
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-4 flex justify-between items-center border-t border-purple-900/30">
              <button
                onClick={() => navigateTo(1)}
                className="px-4 py-2.5 rounded-xl glass-card text-xs text-purple-300 hover:text-white cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => navigateTo(3)}
                className="btn-gold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer font-bold"
              >
                Review Selection ({totalItemsCount}) <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </section>
        )}

        {/* VIEW 3: SELECTION PAGE (CART REVIEW) */}
        {state.currentStep === 3 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => navigateTo(2)}
                  className="text-xs text-purple-300 hover:text-amber-300 mb-1 flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left"></i> Add More Items
                </button>
                <h2 className="text-2xl font-bold text-amber-300 tracking-wide uppercase">Your Selection</h2>
                <p className="text-xs text-purple-200">Adjust quantities for your selected ITEMS.</p>
              </div>
            </div>

            {/* Cart Items Container */}
            <div className="space-y-3">
              {CATALOG.stardust.filter(item => (state.cart[item.id] || 0) > 0).length === 0 ? (
                <div className="glass-card p-8 rounded-xl text-center space-y-3 border border-purple-500/20">
                  <div className="w-12 h-12 mx-auto rounded-full bg-purple-950/60 text-purple-400 flex items-center justify-center text-xl">
                    <i className="fa-solid fa-cart-shopping"></i>
                  </div>
                  <p className="text-xs text-purple-300">Your realm selection is empty.</p>
                  <button
                    onClick={() => navigateTo(2)}
                    className="btn-gold px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    Explore Lineup
                  </button>
                </div>
              ) : (
                CATALOG.stardust
                  .filter(item => (state.cart[item.id] || 0) > 0)
                  .map(item => {
                    const qty = state.cart[item.id];
                    return (
                      <div
                        key={item.id}
                        className="glass-card p-4 rounded-xl flex items-center justify-between border border-purple-500/20"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-purple-400/30 flex items-center justify-center text-amber-300">
                            <i className={`fa-solid ${item.icon}`}></i>
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-xs">{item.name}</h4>
                            <p className="text-[10px] text-purple-300">{item.units}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2 bg-slate-950/60 p-1 rounded-lg border border-purple-500/30">
                            <button
                              onClick={() => updateCartQuantity(item.id, -1)}
                              className="w-6 h-6 rounded bg-indigo-900/60 text-purple-200 text-xs flex items-center justify-center font-bold font-mono hover:bg-indigo-800 transition cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-white px-1">{qty}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, 1)}
                              className="w-6 h-6 rounded bg-indigo-900/60 text-purple-200 text-xs flex items-center justify-center font-bold font-mono hover:bg-indigo-800 transition cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs font-bold text-amber-300 w-16 text-right">
                            ₱{(item.price * qty).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Subtotal Box */}
            <div className="glass-card p-4 rounded-xl flex items-center justify-between border border-amber-400/20">
              <span className="text-sm text-purple-200 font-semibold">Subtotal (ITEMS)</span>
              <span className="text-xl font-extrabold text-amber-300">₱{stardustSubtotal.toLocaleString()}</span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigateTo(4)}
                className="w-full btn-gold py-3.5 rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                Next: Add-Ons <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </section>
        )}

        {/* VIEW 4: EXTRAS PAGE (ADD-ONS) */}
        {state.currentStep === 4 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => navigateTo(3)}
                  className="text-xs text-purple-300 hover:text-amber-300 mb-1 flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left"></i> Back to Selection
                </button>
                <h2 className="text-2xl font-bold text-amber-300 tracking-wide uppercase">Add-Ons</h2>
                <p className="text-xs text-purple-200">Choose optional extras and add-ons for your order.</p>
              </div>
            </div>

            <div className="space-y-3">
              {CATALOG.addons.map(addon => {
                const qty = state.addons[addon.id] || 0;
                return (
                  <div
                    key={addon.id}
                    className="glass-card p-4 rounded-xl flex items-center justify-between border border-purple-500/20"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-amber-400/30 flex items-center justify-center text-amber-300">
                        <i className={`fa-solid ${addon.icon} text-lg`}></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs">{addon.name}</h4>
                        <p className="text-xs font-bold text-amber-300 mt-0.5">₱{addon.price.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 bg-slate-950/60 p-1 rounded-lg border border-purple-500/30">
                      <button
                        onClick={() => updateAddonQuantity(addon.id, -1)}
                        className="w-7 h-7 rounded bg-indigo-900/60 text-purple-200 text-xs flex items-center justify-center font-bold font-mono hover:bg-indigo-800 transition cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-white px-2">{qty}</span>
                      <button
                        onClick={() => updateAddonQuantity(addon.id, 1)}
                        className="w-7 h-7 rounded bg-indigo-900/60 text-purple-200 text-xs flex items-center justify-center font-bold font-mono hover:bg-indigo-800 transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Combined Subtotal Box */}
            <div className="glass-card p-4 rounded-xl flex items-center justify-between border border-purple-400/20">
              <div>
                <span className="text-xs text-purple-300 block">Subtotal (Items + Add-ons)</span>
                <span className="text-[10px] text-gray-400">Before handling &amp; promo codes</span>
              </div>
              <span className="text-xl font-extrabold text-amber-300">₱{itemsTotal.toLocaleString()}</span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigateTo(5)}
                className="w-full btn-gold py-3.5 rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                Next: Special Handling <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </section>
        )}

        {/* VIEW 5: SPECIAL HANDLING & PROMOTIONS */}
        {state.currentStep === 5 && (
          <section className="space-y-6 animate-fadeIn">
            <div>
              <button
                onClick={() => navigateTo(4)}
                className="text-xs text-purple-300 hover:text-amber-300 mb-1 flex items-center gap-1 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left"></i> Back to Add-Ons
              </button>
              <h2 className="text-2xl font-bold text-amber-300 tracking-wide uppercase">
                Special Handling &amp; Promotions
              </h2>
              <p className="text-xs text-purple-200">Choose your preferred service level and apply discounts.</p>
            </div>

            {/* Standard Processing */}
            <div className="glass-card p-4 rounded-xl border border-amber-400/40 bg-purple-950/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center border border-amber-400/30">
                  <i className="fa-solid fa-hourglass-half"></i>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Standard Processing</h4>
                  <p className="text-[11px] text-purple-300">
                    Orders follow the regular verification and preparation queue. Rush handling is not available.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-amber-300 text-sm">Included</span>
                <div className="w-5 h-5 rounded-full border border-amber-400 flex items-center justify-center text-amber-300 bg-amber-400/20">
                  <i className="fa-solid fa-check text-xs"></i>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-amber-400/20 space-y-2"><h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Account Benefits</h3><p className="text-xs text-purple-200">Special checkout benefits must be attached to an eligible client account and approved under the applicable rules. Public discount codes are not accepted in this demo.</p></div>

            {/* Active Service Note Alert */}
            <div className="glass-card p-3 rounded-xl border border-indigo-500/30 flex items-start space-x-3 bg-indigo-950/30">
              <i className="fa-solid fa-circle-info text-amber-300 text-base mt-0.5"></i>
              <p className="text-[11px] text-purple-200 leading-relaxed">
                Standard processing is selected. Orders are handled in the regular verification and preparation queue; expedited or rush processing is not offered under the No Rush Orders policy.
              </p>
            </div>

            {/* Subtotal Box */}
            <div className="glass-card p-4 rounded-xl flex items-center justify-between border border-amber-400/20">
              <span className="text-xs text-purple-200 font-semibold">Updated Subtotal</span>
              <span className="text-xl font-extrabold text-amber-300">₱{grandTotal.toLocaleString()}</span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigateTo(6)}
                className="w-full btn-gold py-3.5 rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                Next: Checkout <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </section>
        )}

        {/* VIEW 6: CHECKOUT FORM */}
        {state.currentStep === 6 && (
          <section className="space-y-6 animate-fadeIn">
            <div>
              <button
                onClick={() => navigateTo(5)}
                className="text-xs text-purple-300 hover:text-amber-300 mb-1 flex items-center gap-1 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left"></i> Back to Handling
              </button>
              <h2 className="text-2xl font-bold text-amber-300 tracking-wide uppercase">Checkout</h2>
              <p className="text-xs text-purple-200">Confirm delivery details &amp; delivery method.</p>
            </div>

            {/* Order Summary Card */}
            <div className="glass-card p-4 rounded-xl space-y-2 border border-purple-500/30">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider border-b border-purple-900/40 pb-2">
                Order Summary
              </h3>
              <div className="flex justify-between text-xs text-purple-200">
                <span>Items ({totalItemsCount})</span>
                <span className="font-semibold text-white">₱{itemsTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-purple-200">
                <span>{handlingName}</span>
                <span className="font-semibold text-white">₱{handlingCost.toLocaleString()}</span>
              </div>
              {state.discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Discount Promo ({state.promoCode})</span>
                  <span>-₱{state.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-amber-300 border-t border-purple-900/40 pt-2">
                <span>Total</span>
                <span>₱{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Delivery Info Inputs */}
            <div className="glass-card p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Delivery Information
              </h3>

              <div>
                <label className="text-[11px] text-purple-300 block mb-1">Full Name</label>
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-3 top-3 text-purple-400 text-xs"></i>
                  <input
                    type="text"
                    value={state.deliveryDetails.name}
                    onChange={(e) =>
                      setState(prev => ({
                        ...prev,
                        deliveryDetails: { ...prev.deliveryDetails, name: e.target.value }
                      }))
                    }
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full bg-slate-950/80 border border-purple-500/30 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-purple-300 block mb-1">Contact Number</label>
                <div className="relative">
                  <i className="fa-solid fa-phone absolute left-3 top-3 text-purple-400 text-xs"></i>
                  <input
                    type="text"
                    value={state.deliveryDetails.phone}
                    onChange={(e) =>
                      setState(prev => ({
                        ...prev,
                        deliveryDetails: { ...prev.deliveryDetails, phone: e.target.value }
                      }))
                    }
                    placeholder="e.g. 0917 123 4567"
                    className="w-full bg-slate-950/80 border border-purple-500/30 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-purple-300 block mb-1">Delivery Address / Destination</label>
                <div className="relative">
                  <i className="fa-solid fa-location-dot absolute left-3 top-3 text-purple-400 text-xs"></i>
                  <input
                    type="text"
                    value={state.deliveryDetails.address}
                    onChange={(e) =>
                      setState(prev => ({
                        ...prev,
                        deliveryDetails: { ...prev.deliveryDetails, address: e.target.value }
                      }))
                    }
                    placeholder="e.g. Unit 4B Orbit Tower, Neo District"
                    className="w-full bg-slate-950/80 border border-purple-500/30 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl space-y-3"><h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Fulfillment Method</h3><div className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-white"><b>Standard Rider Delivery</b><p className="mt-1 text-[10px] text-purple-200">Designated delivery arrangement. No meetups or rush fulfillment.</p></div></div>

            <div className="pt-2">
              <button
                onClick={placeOrder}
                className="w-full btn-gold py-3.5 rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                Place Order <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </section>
        )}

        {/* VIEW 7: CONFIRMATION & PAYMENT */}
        {state.currentStep === 7 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="glass-card p-6 rounded-2xl text-center border border-amber-400/30">
              <div className="w-24 h-24 mx-auto rounded-full border border-amber-400/40 flex items-center justify-center bg-indigo-950/50 text-amber-200 text-2xl">DEMO</div>
              <div className="mt-4 space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-semibold">Checkout Preview · Not Submitted</div>
                <p className="text-xs text-purple-200 font-mono tracking-wider pt-1">No order number has been generated.</p>
                <p className="text-[11px] text-purple-300">This is a visual preview only. No payment deadline or payment request is active.</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Payment Preview</h3>
              <p className="text-xs text-purple-200">Estimated cart total: ₱{grandTotal.toLocaleString()}</p>
              <p className="text-xs text-amber-200">DEMO ONLY — PAYMENT PROOF COLLECTION IS DISABLED. Do not enter sender details or upload receipts.</p>
              <p className="text-[10px] text-purple-300">The payment screen is a visual preview only. No order has been created and no payment is due through this prototype.</p>
            </div>

            <div><button onClick={submitPayment} className="w-full btn-gold py-3.5 rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer font-bold">Payment Submission Disabled <i className="fa-solid fa-lock"></i></button></div>
          </section>
        )}

        {/* VIEW 8: ORDER STATUS & TRACKING */}
        {state.currentStep === 8 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="glass-card p-6 rounded-2xl text-center border border-amber-400/30"><div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/40 flex items-center justify-center text-2xl"><i className={state.activeOrder.status === 'payment_expired' ? 'fa-solid fa-hourglass-end' : 'fa-solid fa-clipboard-check'}></i></div><h2 className="text-xl font-bold text-white mb-1">{state.activeOrder.status === 'payment_expired' ? 'Payment Window Expired' : 'Order Received'}</h2><p className="text-xs text-purple-300 font-mono">Order {state.activeOrder.orderId || 'Demo order'}</p><p className="mt-3 text-xs text-amber-200">DEMO ONLY — NO REAL ORDER WAS CREATED. This screen is a legacy preview state and does not represent a submitted order or payment.</p></div>
            <div className="glass-card p-5 rounded-2xl space-y-4"><div className="flex items-center justify-between border-b border-purple-900/40 pb-3"><h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Order Status</h3><span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-200">{state.activeOrder.status === 'payment_submitted' ? 'UNDER REVIEW' : state.activeOrder.status === 'payment_expired' ? 'EXPIRED' : 'PAYMENT PENDING'}</span></div>
              <div className="space-y-4"><div><b className="text-xs text-white">Order Submitted</b><p className="text-[10px] text-purple-300">{state.activeOrder.submittedTime || 'Recorded in this browser session'}</p></div><div><b className="text-xs text-white">Payment Proof</b><p className="text-[10px] text-purple-300">{state.activeOrder.status === 'payment_submitted' ? 'Submitted ' + (state.activeOrder.paymentTime || '') + ' · Awaiting authorized review' : state.activeOrder.status === 'payment_expired' ? 'Not submitted before the deadline' : 'Awaiting client submission'}</p></div><div><b className="text-xs text-white">Verification</b><p className="text-[10px] text-purple-300">No live payment-verification service is connected to this GitHub Pages demo.</p></div><div><b className="text-xs text-white">Fulfillment</b><p className="text-[10px] text-purple-300">Processing and delivery updates appear only when an authorized operator records them.</p></div></div>
              <div className="border-t border-purple-900/40 pt-3 flex justify-between text-xs"><span className="text-purple-200">Order Total</span><b className="text-amber-300">₱{(state.activeOrder.totalPaid ?? grandTotal).toLocaleString()}</b></div></div>
            <div className="pt-2 text-center"><button onClick={() => navigateTo(1)} className="text-xs text-purple-300 hover:text-amber-300 underline cursor-pointer">Return to Store Homepage</button></div>
          </section>
        )}
      </main>

      <div className="demo-disclaimer store-disclaimer">
        DEMO ONLY — NO REAL ORDER WILL BE CREATED OR PROCESSED. No payment proof is collected or transmitted. Browser-local preview only; not secure for real customer data.
      </div>
      {/* Shared legal footer, matching portal Screens 1–5 */}
      <footer className="portal-footer store-footer" aria-label="Legal links">
        <button type="button" className="portal-footer-link" onClick={() => onOpenPortalPage('terms')}>TERMS</button>
        <i aria-hidden="true">·</i>
        <button type="button" className="portal-footer-link" onClick={() => onOpenPortalPage('privacy')}>PRIVACY</button>
        <i aria-hidden="true">·</i>
        <button type="button" className="portal-footer-link" onClick={() => onOpenPortalPage('info-sec')}>INFO SEC</button>
      </footer>

    </div>
  );
};
