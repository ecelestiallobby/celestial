import React, { useState, useEffect, useRef } from 'react';
import { CATALOG } from '../catalog';
import { CelestialState } from '../types';

interface StoreProps {
  state: CelestialState;
  setState: React.Dispatch<React.SetStateAction<CelestialState>>;
  onReturnToLobby: () => void;
  onPurchaseWindowExpired: () => void;
  onOpenPortalPage: (page: 'terms' | 'privacy' | 'info-sec' | 'contact') => void;
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
  const [promoInput, setPromoInput] = useState(state.promoCode || '');
  const [promoMsg, setPromoMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [liveTrackAlert, setLiveTrackAlert] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Timer logic for View 7
  useEffect(() => {
    if (state.currentStep === 7 && state.activeOrder.startTime) {
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - (state.activeOrder.startTime || Date.now())) / 1000);
        const left = Math.max(0, 3600 - elapsed);
        setRemainingSeconds(left);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [state.currentStep, state.activeOrder.startTime]);

  const navigateTo = (step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
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

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (code === 'ORBIT10' || code === 'CELESTIAL') {
      setState(prev => ({ ...prev, promoCode: code, discount: 200 }));
      setPromoMsg({
        text: 'Code applied! ₱200 discount added to your total.',
        type: 'success'
      });
    } else if (code === '') {
      setState(prev => ({ ...prev, promoCode: '', discount: 0 }));
      setPromoMsg({ text: 'Promo code removed.', type: 'info' });
    } else {
      setPromoMsg({ text: 'Invalid promo code. Try ORBIT10 or CELESTIAL.', type: 'error' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        setState(prev => ({
          ...prev,
          activeOrder: {
            ...prev.activeOrder,
            paymentScreenshot: result
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const placeOrder = () => {
    try {
      const raw = localStorage.getItem('CL_GUEST_ONBOARDING_V1');
      if (raw) {
        const record = JSON.parse(raw);
        if (typeof record.purchaseWindowStartedAt === 'number' && !record.purchaseWindowOrderPlacedAt) {
          if (Date.now() - record.purchaseWindowStartedAt >= 60 * 60 * 1000) {
            const nowMs = Date.now();
            localStorage.setItem('CL_GUEST_ONBOARDING_V1', JSON.stringify({ ...record, status: 'restricted', restrictionUntil: nowMs + 24 * 60 * 60 * 1000, restrictionReason: 'The one-hour purchasing window expired before an order was placed.', termsAccepted: false }));
            onPurchaseWindowExpired();
            return;
          }
          localStorage.setItem('CL_GUEST_ONBOARDING_V1', JSON.stringify({ ...record, purchaseWindowOrderPlacedAt: Date.now() }));
        }
      }
    } catch { /* best effort in this browser demo */ }
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' • ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    setState(prev => ({
      ...prev,
      activeOrder: {
        ...prev.activeOrder,
        startTime: prev.activeOrder.startTime || Date.now(),
        submittedTime: prev.activeOrder.submittedTime || timeStr,
        status: 'submitted',
        totalPaid: grandTotal
      },
      currentStep: 7
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitPayment = () => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' • ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    setState(prev => ({
      ...prev,
      activeOrder: {
        ...prev.activeOrder,
        paymentTime: timeStr,
        status: 'payment_submitted',
        totalPaid: grandTotal
      },
      currentStep: 8
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalCartCount = Object.values(state.cart).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen flex flex-col justify-between pb-16 md:pb-0 animate-fadeIn">
      {/* Demo notice banner */}
      <div className="mx-auto max-w-4xl px-4 pt-3 w-full">
        <div className="rounded-lg border border-amber-400/30 bg-amber-950/30 p-3 text-[10px] leading-relaxed text-amber-100 flex items-start gap-2">
          <i className="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5 text-xs"></i>
          <span>
            <strong>DEMO ONLY</strong> — This store uses browser LocalStorage. Access codes, order records, uploaded payment images and payment status are not protected by server-side authentication. Do not enter real customer or payment information. No live payment verification or fulfillment is connected.
          </span>
        </div>
      </div>

      {/* TOP HEADER / NAV BAR — shared Celestial Lobby visual identity */}
      <header className="store-header portal-header sticky top-0 z-40 w-full glass-card border-b border-purple-500/20 px-4 py-3 mt-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigateTo(1)}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-900 to-indigo-900 flex items-center justify-center border border-amber-400/50 shadow-lg shadow-purple-900/40">
              <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div>
              <h1 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 tracking-wider text-base uppercase">
                Celestial Lobby
              </h1>
              <p className="text-[10px] text-purple-300 tracking-widest uppercase font-semibold">
                Orbit Store Ecosystem
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onReset}
              title="Reset Demo Data"
              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/50 transition cursor-pointer flex items-center"
            >
              <i className="fa-solid fa-rotate-left mr-1"></i> Reset
            </button>
            <div className="relative cursor-pointer" onClick={() => navigateTo(3)}>
              <div className="w-9 h-9 rounded-full bg-indigo-950/80 border border-purple-500/40 flex items-center justify-center text-amber-300">
                <i className="fa-solid fa-shopping-bag"></i>
              </div>
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-slate-950">
                {totalCartCount}
              </span>
            </div>
          </div>
        </div>

        {/* 8-Step Navigation Tracker */}
        <div className="max-w-4xl mx-auto mt-3 pt-2 border-t border-purple-900/40 overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between min-w-[650px] px-2 text-xs">
            {[
              { num: 1, label: 'Home' },
              { num: 2, label: 'Lineup' },
              { num: 3, label: 'Cart' },
              { num: 4, label: 'Extras' },
              { num: 5, label: 'Service' },
              { num: 6, label: 'Checkout' },
              { num: 7, label: 'Payment' },
              { num: 8, label: 'Status' }
            ].map((step, idx) => {
              const isCurrent = state.currentStep === step.num;
              const isPast = state.currentStep > step.num;
              return (
                <React.Fragment key={step.num}>
                  {idx > 0 && <i className="fa-solid fa-chevron-right text-[8px] text-gray-600"></i>}
                  <button
                    onClick={() => navigateTo(step.num)}
                    className={`step-btn flex items-center gap-1 transition cursor-pointer ${
                      isCurrent
                        ? 'text-amber-300 font-bold'
                        : isPast
                        ? 'text-emerald-400 font-semibold'
                        : 'text-gray-400 hover:text-amber-200'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                        isCurrent
                          ? 'border-amber-400 bg-amber-400/20'
                          : isPast
                          ? 'border-emerald-400 bg-emerald-400/20'
                          : 'border-gray-600'
                      }`}
                    >
                      {step.num}
                    </span>
                    <span>{step.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-4xl w-full mx-auto p-4 flex-grow relative">
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
                  <i className="fa-solid fa-meteor"></i> Explore Server Lineup
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
                    <p className="text-xs text-gray-300 mt-1">(Server Lineup)</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition">
                    <i className="fa-solid fa-globe text-xl"></i>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-purple-200 font-medium">
                  <span>9 Servers Available</span>
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
                    <h3 className="text-2xl font-bold text-amber-300">DRACO BULK</h3>
                    <p className="text-xs text-gray-300 mt-1">(Add-ons &amp; Extras)</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition">
                    <i className="fa-solid fa-gem text-xl"></i>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-purple-200 font-medium">
                  <span>Lubricants &amp; Accessories</span>
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
                  <p className="text-xs text-purple-300">Priority Express Delivery &amp; Special Handling</p>
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
                <p className="text-xs text-purple-200">Adjust quantities for your selected servers.</p>
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
              <span className="text-sm text-purple-200 font-semibold">Subtotal (Servers)</span>
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
                <p className="text-xs text-purple-200">Enhance your experience with Draco Bulk essentials.</p>
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

            {/* Promo Code Input */}
            <div className="glass-card p-4 rounded-xl space-y-2">
              <label className="text-xs font-semibold text-purple-200 block">Promo Code</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g., ORBIT10)"
                  className="flex-grow bg-slate-950/80 border border-purple-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 uppercase font-mono"
                />
                <button
                  onClick={applyPromo}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoMsg && (
                <div
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    promoMsg.type === 'success'
                      ? 'text-emerald-400'
                      : promoMsg.type === 'error'
                      ? 'text-red-400'
                      : 'text-purple-300'
                  }`}
                >
                  {promoMsg.type === 'success' && <i className="fa-solid fa-check mr-1"></i>}
                  {promoMsg.type === 'error' && <i className="fa-solid fa-xmark mr-1"></i>}
                  {promoMsg.text}
                </div>
              )}
            </div>

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

            {/* Delivery Method Selection */}
            <div className="glass-card p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Delivery Method</h3>
              <div className="space-y-2 text-xs">
                {['Standard Rider Delivery', 'Pickup', 'Drop-off'].map(method => (
                  <label
                    key={method}
                    onClick={() =>
                      setState(prev => ({
                        ...prev,
                        deliveryDetails: { ...prev.deliveryDetails, method }
                      }))
                    }
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                      state.deliveryDetails.method === method
                        ? 'border-amber-400 bg-purple-950/40'
                        : 'border-purple-500/30 bg-slate-950/40 hover:border-amber-400/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="delivery_method"
                        checked={state.deliveryDetails.method === method}
                        onChange={() => {}}
                        className="accent-amber-400"
                      />
                      <span className={state.deliveryDetails.method === method ? 'text-white font-medium' : 'text-purple-200'}>
                        {method}
                      </span>
                    </div>
                    <span className={state.deliveryDetails.method === method ? 'text-amber-300 font-bold' : 'text-gray-400'}>
                      {method === 'Standard Rider Delivery' ? '₱0' : 'Free'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

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
            {/* Countdown Timer Header */}
            <div className="glass-card p-6 rounded-2xl text-center relative overflow-hidden border border-amber-400/30">
              <div className="w-32 h-32 mx-auto rounded-full border-4 border-amber-400/40 flex flex-col items-center justify-center relative bg-indigo-950/50 shadow-inner">
                <span className="text-3xl font-extrabold text-white tracking-widest font-mono">
                  {formatTimer(remainingSeconds)}
                </span>
                <span className="text-[10px] text-amber-300 font-semibold uppercase mt-0.5">
                  Pay within 1 hour
                </span>
              </div>
              <div className="mt-4 space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  <i className="fa-solid fa-circle-check"></i> Order Confirmed!
                </div>
                <p className="text-xs text-purple-200 font-mono tracking-wider pt-1">
                  Order {state.activeOrder.orderId}
                </p>
                <p className="text-[11px] text-purple-300">
                  Please submit your payment details before the timer expires.
                </p>
              </div>
            </div>

            {/* Payment Information Form */}
            <div className="glass-card p-5 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider border-b border-purple-900/40 pb-2">
                Payment Information
              </h3>
              <div className="flex justify-between items-center text-xs">
                <span className="text-purple-300">Amount Sent</span>
                <span className="text-lg font-bold text-amber-300">₱{grandTotal.toLocaleString()}</span>
              </div>
              <div>
                <label className="text-[11px] text-purple-300 block mb-1">Sender (First 3 Letters of Account)</label>
                <input
                  type="text"
                  maxLength={3}
                  value={state.activeOrder.paymentSender}
                  onChange={(e) =>
                    setState(prev => ({
                      ...prev,
                      activeOrder: { ...prev.activeOrder, paymentSender: e.target.value.toUpperCase() }
                    }))
                  }
                  className="w-full bg-slate-950/80 border border-purple-500/30 rounded-lg px-3 py-2 text-xs text-white uppercase tracking-widest focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              {/* Screenshot Upload Box */}
              <div className="space-y-2">
                <label className="text-[11px] text-purple-300 block">Upload Payment Screenshot</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-500/30 hover:border-amber-400/60 rounded-xl p-6 text-center cursor-pointer bg-slate-950/40 transition"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {state.activeOrder.paymentScreenshot ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={state.activeOrder.paymentScreenshot}
                        alt="Screenshot preview"
                        className="max-h-36 rounded-lg border border-amber-400/40 mb-2 object-contain"
                      />
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <i className="fa-solid fa-check"></i> Image Loaded (Click to replace)
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-purple-900/40 flex items-center justify-center text-amber-300">
                        <i className="fa-solid fa-camera text-xl"></i>
                      </div>
                      <p className="text-xs text-purple-200 font-semibold">Upload Payment Screenshot</p>
                      <p className="text-[10px] text-gray-400">(PNG, JPG, up to 5MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={submitPayment}
                className="w-full btn-gold py-3.5 rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                Submit Payment <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </section>
        )}

        {/* VIEW 8: ORDER RECEIPT & TRACKING */}
        {state.currentStep === 8 && (
          <section className="space-y-6 animate-fadeIn">
            {/* Thank You Banner */}
            <div className="glass-card p-6 rounded-2xl text-center border border-emerald-500/30 relative">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 flex items-center justify-center text-2xl shadow-lg">
                <i className="fa-solid fa-check"></i>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Thank you for your order!</h2>
              <p className="text-xs text-purple-300 font-mono tracking-wider">
                Order {state.activeOrder.orderId}
              </p>
              <div className="mt-4 pt-4 border-t border-purple-900/40 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] text-purple-400 uppercase tracking-wider block">Total Paid</span>
                  <span className="text-xl font-extrabold text-amber-300">
                    ₱{(state.activeOrder.totalPaid || grandTotal).toLocaleString()}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                  Payment Verified
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-card p-6 rounded-2xl space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Order Status</h3>
                <div className="w-8 h-8 rounded-full bg-purple-900/40 border border-amber-400/40 flex items-center justify-center text-amber-300 text-xs">
                  <i className="fa-solid fa-feather"></i>
                </div>
              </div>

              <div className="space-y-6 relative pl-6 border-l-2 border-purple-900/60 ml-2">
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-bold shadow-md">
                    <i className="fa-solid fa-check text-[10px]"></i>
                  </div>
                  <h4 className="text-xs font-bold text-white">Order Submitted</h4>
                  <p className="text-[10px] text-purple-300">
                    {state.activeOrder.submittedTime || 'Nov 4, 2026 • 04:32 AM'}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-bold shadow-md">
                    <i className="fa-solid fa-check text-[10px]"></i>
                  </div>
                  <h4 className="text-xs font-bold text-white">Payment Submitted</h4>
                  <p className="text-[10px] text-purple-300">
                    {state.activeOrder.paymentTime || 'Nov 4, 2026 • 04:33 AM'}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-slate-900 border-2 border-purple-500 text-purple-400 flex items-center justify-center text-xs">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></div>
                  </div>
                  <h4 className="text-xs font-bold text-amber-300">Processing</h4>
                  <p className="text-[10px] text-purple-300">Allocating realm resources...</p>
                </div>

                <div className="relative opacity-50">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-slate-900 border border-gray-600 text-gray-500 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-circle text-[6px]"></i>
                  </div>
                  <h4 className="text-xs font-semibold text-gray-300">Out for Delivery</h4>
                </div>

                <div className="relative opacity-50">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-slate-900 border border-gray-600 text-gray-500 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-circle text-[6px]"></i>
                  </div>
                  <h4 className="text-xs font-semibold text-gray-300">Delivered</h4>
                </div>
              </div>

              {/* Estimated Arrival Banner */}
              <div className="glass-card p-4 rounded-xl flex items-center justify-between border border-amber-400/30 bg-gradient-to-r from-purple-950/40 to-slate-950">
                <div className="flex items-center space-x-3">
                  <i className="fa-solid fa-truck-fast text-2xl text-amber-300"></i>
                  <div>
                    <span className="text-[10px] text-purple-300 uppercase tracking-wider block">Estimated Arrival</span>
                    <span className="text-sm font-bold text-white">~ 45 &ndash; 60 mins</span>
                  </div>
                </div>
              </div>

              {/* Delivery Info Footer */}
              <div className="flex items-center justify-between pt-2 text-xs border-t border-purple-900/40">
                <div className="flex items-center space-x-2 text-purple-200">
                  <i className="fa-solid fa-compass text-amber-300"></i>
                  <span className="truncate max-w-[200px]">
                    {state.deliveryDetails.name || 'Juan Dela Cruz'} • {state.deliveryDetails.phone || '0917 123 4567'}
                  </span>
                </div>
                <button
                  onClick={() => setLiveTrackAlert(true)}
                  className="btn-gold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  Track Live <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>

            {liveTrackAlert && (
              <div className="glass-card p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-xs text-emerald-200 flex justify-between items-center animate-fadeIn">
                <span>Live tracking active: Dispatcher is en route!</span>
                <button
                  onClick={() => setLiveTrackAlert(false)}
                  className="text-emerald-400 hover:text-white ml-2 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="pt-2 text-center">
              <button
                onClick={() => navigateTo(1)}
                className="text-xs text-purple-300 hover:text-amber-300 underline cursor-pointer"
              >
                Return to Store Homepage
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Shared legal and contact footer */}
      <footer className="portal-footer store-footer" aria-label="Legal and contact links">
        <button type="button" className="portal-footer-link" onClick={() => onOpenPortalPage('terms')}>Terms and Conditions</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => onOpenPortalPage('privacy')}>Data and Privacy</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => onOpenPortalPage('info-sec')}>Info Sec</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => onOpenPortalPage('contact')}>Contact Us</button>
      </footer>
      <div className="demo-disclaimer store-disclaimer">DEMO ONLY · Browser-local storage · Not secure for real customer data or live transactions.</div>

      {/* MOBILE PERSISTENT BOTTOM TAB BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-purple-500/30 py-2 px-4 flex justify-around items-center text-[10px]">
        <button
          onClick={() => navigateTo(1)}
          className={`flex flex-col items-center cursor-pointer ${state.currentStep === 1 ? 'text-amber-300 font-bold' : 'text-purple-300 hover:text-amber-300'}`}
        >
          <i className="fa-solid fa-house text-base mb-0.5"></i>
          <span>Home</span>
        </button>
        <button
          onClick={() => navigateTo(2)}
          className={`flex flex-col items-center cursor-pointer ${state.currentStep === 2 ? 'text-amber-300 font-bold' : 'text-purple-300 hover:text-amber-300'}`}
        >
          <i className="fa-solid fa-layer-group text-base mb-0.5"></i>
          <span>Lineup</span>
        </button>
        <button
          onClick={() => navigateTo(3)}
          className={`flex flex-col items-center cursor-pointer relative ${state.currentStep === 3 ? 'text-amber-300 font-bold' : 'text-purple-300 hover:text-amber-300'}`}
        >
          <i className="fa-solid fa-shopping-bag text-base mb-0.5"></i>
          <span>Cart</span>
          {totalCartCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-amber-400 text-slate-950 text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {totalCartCount}
            </span>
          )}
        </button>
        <button
          onClick={() => navigateTo(8)}
          className={`flex flex-col items-center cursor-pointer ${state.currentStep === 8 ? 'text-amber-300 font-bold' : 'text-purple-300 hover:text-amber-300'}`}
        >
          <i className="fa-solid fa-receipt text-base mb-0.5"></i>
          <span>Status</span>
        </button>
      </nav>

      {/* Floating Return to Lobby Button */}
      <div className="store-lobby-return">
        <button onClick={onReturnToLobby}>
          ← Return to Lobby
        </button>
      </div>
    </div>
  );
};
