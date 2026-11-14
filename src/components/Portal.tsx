import React, { useEffect, useRef, useState } from 'react';
import { pathForPortalView, portalViewForPath } from '../routes';
import hoenoPosterBase64 from '../assets/hoeno-3s.webp.b64?raw';
import { ONBOARDING_STEPS } from '../catalog';
import { ActiveOrder, DeliveryDetails, DemoAccessCredentials } from '../types';
import { OrderTimeline } from './OrderTimeline';
import { OwnerMasterControl } from './OwnerMasterControl';

interface PortalProps {
  initialView?: PortalView;
  onOwnerSessionChange?: (active: boolean) => void;
  onEnterStore: () => void;
  activeOrder: ActiveOrder;
  deliveryDetails?: DeliveryDetails;
  onUpdateStatus?: (newStatus: ActiveOrder['status']) => void;
  onOpenOwnerNotepad?: () => void;
  onOpenOwnerTools?: () => void;
}

type PortalView = 'landing' | 'environment-gate' | 'environment-route' | 'invitation-gate' | 'owner-preview' | 'army-home' | 'guest' | 'onboarding' | 'onboarding-terms' | 'restriction' | 'store-locked' | 'onboarding-submitted' | 'regular-gate' | 'regular-home' | 'about' | 'no-nos' | 'faqs' | 'terms' | 'privacy' | 'info-sec' | 'three-s' | 'contact';

type OnboardingRecord = { status: 'in-progress' | 'restricted' | 'completed'; step: number; startedAt: number; restrictionUntil: number | null; restrictionReason: string; termsAccepted: boolean; helpUsed: boolean; completedSteps?: number[]; purchaseWindowStartedAt?: number | null; purchaseWindowOrderPlacedAt?: number | null; };
const ONBOARDING_STORAGE_KEY = 'CL_GUEST_ONBOARDING_V1';
const ONBOARDING_TIMEOUT_MS = 30 * 60 * 1000;
const RESTRICTION_MS = 24 * 60 * 60 * 1000;
const OWNER_SESSION_KEY = 'CL_OWNER_BROWSER_SESSION_V1';
const ACCESS_SESSION_KEY = 'CL_GATEWAY_SESSION_V1';
const ACCESS_FAILURE_KEY = 'CL_GATEWAY_FAILURES_V1';
const ACCESS_LOCK_MS = 60 * 60 * 1000;
const DEMO_CREDENTIALS: Record<string, { apg: string; role: 'client' | 'emp01' | 'emp02' | 'owner' }> = {
  'CLI-01': { apg: 'CLNT2026', role: 'client' },
  'EMP-01': { apg: 'CLNT2026', role: 'emp01' },
  'EMP-02': { apg: 'CLNT2026', role: 'emp02' },
  'OWN-01': { apg: 'OWNR2026', role: 'owner' }
};
type GatewaySession = { accessId: string; role: 'client' | 'emp01' | 'emp02' | 'owner'; startedAt: number };
const OWNER_SESSION_MS = 24 * 60 * 60 * 1000;
const OWNER_PATTERN_KEY = 'CL_OWNER_PATTERN_HASH_V1';
const OWNER_PIN_KEY = 'CL_OWNER_PIN_HASH_V1';
const OWNER_GOOGLE_AUTH_ENDPOINT = ''; // Configure only after deploying the private Google Apps Script verifier.
const INVITATION_STORAGE_KEY = 'CL_BETA_INVITATIONS_V1';
const INVITATION_ATTEMPTS_KEY = 'CL_INVITATION_ATTEMPTS_V1';
type InvitationSlot = { slot: number; invitationCode: string; accessId: string };
type EnvironmentKey = 'owner' | 'army-owner' | 'army-member' | 'regular-client';
type EnvironmentRegistryEntry = { environment: EnvironmentKey; prefix: string };
const ENVIRONMENT_LABELS: Record<EnvironmentKey, string> = { owner: 'CELESTIAL LOBBY OWNER', 'army-owner': 'CELESTIAL ARMY OWNER', 'army-member': 'CELESTIAL ARMY MEMBER', 'regular-client': 'REGULAR CLIENT' };
const readOwnerSession = (): number => { try { const expiresAt = Number(localStorage.getItem(OWNER_SESSION_KEY) || 0); return expiresAt > Date.now() ? expiresAt : 0; } catch { return 0; } };
const readOnboardingRecord = (): OnboardingRecord | null => { try { const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY); if (!raw) return null; const parsed = JSON.parse(raw) as OnboardingRecord; const legacyCompleted = parsed.status === 'completed' ? Array.from({ length: 8 }, (_, index) => index) : Array.from({ length: Math.max(0, Math.min(8, parsed.step || 0)) }, (_, index) => index); return { ...parsed, completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : legacyCompleted, purchaseWindowStartedAt: parsed.purchaseWindowStartedAt ?? null, purchaseWindowOrderPlacedAt: parsed.purchaseWindowOrderPlacedAt ?? null }; } catch { return null; } };
type GuestPage = 'celestial-overview' | 'celestial-sectors' | 'lower-orbit' | 'central-orbit' | 'outer-orbit' | 'draconian-overview' | 'andromeda' | 'founders';

export const Portal: React.FC<PortalProps> = ({
  initialView = 'landing',
  onEnterStore,
  onOwnerSessionChange,
  activeOrder,
  deliveryDetails,
  onUpdateStatus,
  onOpenOwnerNotepad,
  onOpenOwnerTools
}) => {
  const initialRouteView = typeof window !== 'undefined' ? portalViewForPath(window.location.pathname) : null;
  const [view, setViewState] = useState<PortalView>(initialRouteView ?? initialView);
  const viewRef = useRef<PortalView>(initialRouteView ?? initialView);
  const setView = (next: React.SetStateAction<PortalView>) => {
    const resolved = typeof next === 'function' ? (next as (current: PortalView) => PortalView)(viewRef.current) : next;
    viewRef.current = resolved;
    setViewState(resolved);
    const nextPath = pathForPortalView(resolved);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ celestialRoute: true }, '', nextPath);
    }
  };

  useEffect(() => {
    const handleRoutePop = () => {
      // The dedicated onboarding guard owns Back navigation while a session is active.
      if (viewRef.current === 'onboarding' || viewRef.current === 'onboarding-terms') return;
      const routeView = portalViewForPath(window.location.pathname);
      const nextView = routeView ?? 'landing';
      viewRef.current = nextView;
      setViewState(nextView);
      if (!routeView) window.history.replaceState({ celestialRoute: true }, '', pathForPortalView('landing'));
      setMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', handleRoutePop);
    return () => window.removeEventListener('popstate', handleRoutePop);
  }, []);
  const [ownerSessionUntil, setOwnerSessionUntil] = useState<number>(() => readOwnerSession());
  const [gatewaySession, setGatewaySession] = useState<GatewaySession | null>(() => { try { const raw = sessionStorage.getItem(ACCESS_SESSION_KEY); return raw ? JSON.parse(raw) as GatewaySession : null; } catch { return null; } });
  const [gatewayLockUntil, setGatewayLockUntil] = useState<number>(() => { try { const raw = JSON.parse(localStorage.getItem(ACCESS_FAILURE_KEY) || '{}'); return Number(raw.lockUntil || 0); } catch { return 0; } });
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryOrderNumber, setRecoveryOrderNumber] = useState('');
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoverySender, setRecoverySender] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryOrderFound, setRecoveryOrderFound] = useState(false);
  const [employeeRecoveryId, setEmployeeRecoveryId] = useState('');
  const [employeeRecoveryAnswer, setEmployeeRecoveryAnswer] = useState('');
  const [employeeRecoveryVerified, setEmployeeRecoveryVerified] = useState(false);
  const [employeeRecoveryMessage, setEmployeeRecoveryMessage] = useState('');
  const [employeeNewApg, setEmployeeNewApg] = useState('');
  const [activeArmyPanel, setActiveArmyPanel] = useState<'emp01' | 'emp02' | null>(null);

  useEffect(() => {
    if (!ownerSessionUntil) return;
    const delay = ownerSessionUntil - Date.now();
    if (delay <= 0) {
      setOwnerSessionUntil(0);
      onOwnerSessionChange?.(false);
      if (view === 'owner-preview') setView('landing');
      return;
    }
    const timer = window.setTimeout(() => {
      try { localStorage.removeItem(OWNER_SESSION_KEY); } catch { /* best effort */ }
      setOwnerSessionUntil(0);
      onOwnerSessionChange?.(false);
      if (viewRef.current === 'owner-preview') setView('landing');
    }, delay);
    return () => window.clearTimeout(timer);
  }, [ownerSessionUntil, view, onOwnerSessionChange]);

  useEffect(() => {
    if (view === 'owner-preview' && ownerSessionUntil <= Date.now()) {
      setView('landing');
      return;
    }
    if (view === 'army-home' && gatewaySession?.role !== 'emp01' && gatewaySession?.role !== 'emp02' && ownerSessionUntil <= Date.now()) { setActiveArmyPanel(null); setView('landing'); return; }
    if (view === 'regular-home' && gatewaySession?.role !== 'client' && ownerSessionUntil <= Date.now()) { setView('landing'); return; }
    let hasClientSession = false;
    try { hasClientSession = sessionStorage.getItem('CL_ACTIVE_CLIENT_SESSION_V1') === '1'; } catch { /* storage unavailable */ }
    if (view === 'regular-home' && ownerSessionUntil <= Date.now() && !hasClientSession) {
      // A direct client-dashboard URL is not a substitute for a verified client session.
      setView('regular-gate');
    }
  }, [view, ownerSessionUntil, gatewaySession]);
  const [ownerTriggerTaps, setOwnerTriggerTaps] = useState(0);
  const [showOwnerAccessField, setShowOwnerAccessField] = useState(false);
  const [ownerAccessId, setOwnerAccessId] = useState('');
  const [ownerAccessPhrase, setOwnerAccessPhrase] = useState('');
  const [ownerActivationPhrase, setOwnerActivationPhrase] = useState('');
  const [ownerActivationPassed, setOwnerActivationPassed] = useState(false);
  const [ownerSignInMethod, setOwnerSignInMethod] = useState<'password' | 'pattern' | 'pin' | 'google' | 'voice'>('pattern');
  const [ownerPattern, setOwnerPattern] = useState<number[]>([]);
  const [ownerPatternConfirm, setOwnerPatternConfirm] = useState<number[]>([]);
  const [ownerPatternSetupStep, setOwnerPatternSetupStep] = useState<0 | 1 | 2>(0);
  const [ownerPin, setOwnerPin] = useState('');
  const [ownerPinConfirm, setOwnerPinConfirm] = useState('');
  const [ownerPinSetupStep, setOwnerPinSetupStep] = useState<0 | 1 | 2>(0);
  const [ownerGoogleMessage, setOwnerGoogleMessage] = useState('');
  const [ownerAccessMessage, setOwnerAccessMessage] = useState('');
  const [voiceAccessListening, setVoiceAccessListening] = useState(false);
  const [ownerVoicePhrase, setOwnerVoicePhrase] = useState('');
  const [ownerNotepad, setOwnerNotepad] = useState(() => { try { return localStorage.getItem('CL_OWNER_NOTEPAD_V1') || ''; } catch { return ''; } });
  const [showFloatingNotepad, setShowFloatingNotepad] = useState(false);
  const [showOwnerTools, setShowOwnerTools] = useState(false);
  const [guestPage, setGuestPage] = useState<GuestPage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [environmentMenuOpen, setEnvironmentMenuOpen] = useState(false);
  const [activeEnvironment, setActiveEnvironment] = useState<'guest' | 'regular'>(() => initialView === 'regular-home' || initialView === 'regular-gate' ? 'regular' : 'guest');
  const navigateEnvironmentHome = () => { if (ownerSessionUntil > Date.now()) { setView('owner-preview'); } else if (activeEnvironment === 'regular') { setView('regular-home'); } else { setGuestPage(null); setView('guest'); } window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const [threeSOpen, setThreeSOpen] = useState({ security: false, secrecy: false, safety: false });
  const allThreeSOpen = threeSOpen.security && threeSOpen.secrecy && threeSOpen.safety;
  const setAllThreeS = (open: boolean) => setThreeSOpen({ security: open, secrecy: open, safety: open });
  const [onboardStep, setOnboardStep] = useState(0);
  const [purchaseIntent, setPurchaseIntent] = useState<'now' | 'later'>('now');
  const [onboardingRecord, setOnboardingRecord] = useState<OnboardingRecord | null>(() => readOnboardingRecord());
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showRestrictionHelp, setShowRestrictionHelp] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState('Your onboarding session was interrupted or declined.');

  // Archive navigation is intentionally separate from the Store and management dashboards.
  const [regularCelestialsOpen, setRegularCelestialsOpen] = useState(false);
  const [regularFoundersOpen, setRegularFoundersOpen] = useState(false);

  // Gate inputs & status
  const [accessIdInput, setAccessIdInput] = useState('');
  const [apgInput, setApgInput] = useState('');
  const [gateMessage, setGateMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [environmentAccessCode, setEnvironmentAccessCode] = useState('');
  const [routedEnvironment, setRoutedEnvironment] = useState<EnvironmentKey | null>(null);
  const [environmentRouteMessage, setEnvironmentRouteMessage] = useState('');
  const [invitationInput, setInvitationInput] = useState('');
  const [invitationAttempts, setInvitationAttempts] = useState(() => { try { return Number(localStorage.getItem(INVITATION_ATTEMPTS_KEY) || 0); } catch { return 0; } });
  const [invitationSlots, setInvitationSlots] = useState<InvitationSlot[]>(() => { try { const saved = JSON.parse(localStorage.getItem(INVITATION_STORAGE_KEY) || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; } });
  const [invitationMessage, setInvitationMessage] = useState('');
  const OWNER_PREFIX_STORAGE_KEY = 'CL_ENVIRONMENT_PREFIX_REGISTRY_V1';
  const [ownerEnvironmentPrefix, setOwnerEnvironmentPrefix] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_PREFIX_STORAGE_KEY) || '[]') as Array<{ environment: string; prefix: string }>;
      return saved.find(entry => entry.environment === 'owner')?.prefix || '';
    } catch { return ''; }
  });
  const [ownerPrefixMessage, setOwnerPrefixMessage] = useState('');
  const [accountEnvironment, setAccountEnvironment] = useState<'celestial-army' | 'regular-client' | 'beta-tester' | 'guest-visitor'>('regular-client');
  const [accountAction, setAccountAction] = useState<'generate' | 'reset-code' | 'regenerate'>('generate');
  const [accountIdLookup, setAccountIdLookup] = useState('');
  const [accountCodeReset, setAccountCodeReset] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [ownerAccounts, setOwnerAccounts] = useState<Array<{ accessId: string; accessCode: string; environment: string; status: 'Active' | 'Suspended' | 'Revoked' | 'Expired'; createdAt: number }>>(() => { try { const value = JSON.parse(localStorage.getItem('CL_OWNER_ACCOUNT_REGISTRY_V1') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } });
  const [referenceNotes, setReferenceNotes] = useState(() => { try { return localStorage.getItem('CL_OWNER_REFERENCE_CENTER_V1') || ''; } catch { return ''; } });


  // Gateway credentials are deliberately hardcoded only for this controlled browser demo.
  // They must move to trusted server-side validation before production.

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
    try { sessionStorage.removeItem('CL_ONBOARDING_ACTIVE_SESSION'); } catch { /* best effort */ } persistOnboarding(record); setRestrictionReason(reason); setShowExitWarning(false); setShowRestrictionHelp(false); setGuestPage(null); setView('guest'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startOnboarding = () => {
    const saved = readOnboardingRecord();
    if (saved?.status === 'restricted' && saved.restrictionUntil && Date.now() < saved.restrictionUntil) { setOnboardingRecord(saved); setRestrictionReason(saved.restrictionReason); setView('restriction'); return; }
    const step = saved && saved.status !== 'completed' ? Math.max(0, Math.min(7, saved.step)) : 0;
    const record: OnboardingRecord = saved && saved.status !== 'completed' ? { ...saved, status: 'in-progress', startedAt: Date.now(), restrictionUntil: null, purchaseWindowStartedAt: null, purchaseWindowOrderPlacedAt: null } : { status: 'in-progress', step: 0, startedAt: Date.now(), restrictionUntil: null, restrictionReason: '', termsAccepted: false, helpUsed: false, completedSteps: [], purchaseWindowStartedAt: null, purchaseWindowOrderPlacedAt: null };
    persistOnboarding(record); try { sessionStorage.setItem('CL_ONBOARDING_ACTIVE_SESSION', '1'); } catch { /* best effort */ } setOnboardStep(step); setPurchaseIntent('now'); setShowExitWarning(false); setView('onboarding'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Modal lifecycle: Escape dismisses the Owner prompt or cancels the leave-warning.
  // The shared CSS backdrop is driven by the mounted aria-modal element, so it clears with the modal.
  useEffect(() => {
    if (!showOwnerAccessField && !showExitWarning) return;
    const handleModalEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showOwnerAccessField) {
        setShowOwnerAccessField(false);
        setOwnerAccessPhrase('');
        setOwnerAccessMessage('');
      }
      if (showExitWarning) setShowExitWarning(false);
    };
    window.addEventListener('keydown', handleModalEscape);
    return () => window.removeEventListener('keydown', handleModalEscape);
  }, [showOwnerAccessField, showExitWarning]);

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
    if (saved && saved.status !== 'restricted' && saved.purchaseWindowStartedAt && !saved.purchaseWindowOrderPlacedAt && Date.now() - saved.purchaseWindowStartedAt >= 60 * 60 * 1000) {
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
    const checkPurchaseDeadline = () => {
      const saved = readOnboardingRecord();
      if (saved && saved.status !== 'restricted' && saved.purchaseWindowStartedAt && !saved.purchaseWindowOrderPlacedAt && Date.now() - saved.purchaseWindowStartedAt >= 60 * 60 * 1000) {
        applyOnboardingRestriction('The one-hour purchasing window expired before an order was placed.');
      }
    };
    const timer = window.setInterval(checkPurchaseDeadline, 1000);
    checkPurchaseDeadline();
    return () => window.clearInterval(timer);
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

  const activateOwnerTrigger = () => {
    if (ownerSessionUntil > Date.now()) {
      setView('owner-preview');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setOwnerAccessId('');
    setOwnerAccessPhrase('');
    setOwnerSignInMethod('pattern');
    setOwnerPattern([]);
    setOwnerPatternConfirm([]);
    setOwnerPatternSetupStep(localStorage.getItem(OWNER_PATTERN_KEY) ? 2 : 0);
    // Five-tap Owner trigger opens the sign-in choices directly.
    // The five methods are alternatives; no extra activation phrase is required.
    setOwnerActivationPhrase('');
    setOwnerActivationPassed(true);
    setOwnerAccessMessage('');
    setShowOwnerAccessField(true);
  };

  const hashOwnerCredential = async (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleOwnerPatternSubmit = async () => {
    if (ownerPattern.length < 4) { setOwnerAccessMessage('Connect at least four dots to create a pattern.'); return; }
    if (ownerPatternSetupStep === 0) {
      setOwnerPatternConfirm([]);
      setOwnerPatternSetupStep(1);
      setOwnerAccessMessage('Pattern recorded. Draw the same pattern again to confirm.');
      return;
    }
    if (ownerPatternSetupStep === 1) {
      if (ownerPattern.join('-') !== ownerPatternConfirm.join('-')) { setOwnerAccessMessage('The patterns do not match. Start again.'); setOwnerPattern([]); setOwnerPatternConfirm([]); setOwnerPatternSetupStep(0); return; }
      try { localStorage.setItem(OWNER_PATTERN_KEY, await hashOwnerCredential(ownerPattern.join('-'))); } catch { setOwnerAccessMessage('This browser could not save the pattern.'); return; }
      setOwnerPatternSetupStep(2);
      setOwnerPattern([]);
      setOwnerPatternConfirm([]);
      setOwnerAccessMessage('Pattern created for this browser. Draw it once more to sign in.');
      return;
    }
    try {
      const saved = localStorage.getItem(OWNER_PATTERN_KEY);
      if (saved && saved === await hashOwnerCredential(ownerPattern.join('-'))) { setShowOwnerAccessField(false); setOwnerPattern([]); setOwnerPatternConfirm([]); enterOwnerOverride(); }
      else setOwnerAccessMessage('Pattern not recognized. Try again.');
    } catch { setOwnerAccessMessage('Pattern verification is unavailable in this browser.'); }
  };

  const handleOwnerPinSubmit = async () => {
    if (!/^\\d{6}$/.test(ownerPin)) { setOwnerAccessMessage('Enter exactly six digits.'); return; }
    if (ownerPinSetupStep === 0) { setOwnerPinSetupStep(1); setOwnerAccessMessage('PIN entered. Re-enter the same six digits to confirm.'); return; }
    if (ownerPinSetupStep === 1) {
      if (ownerPin !== ownerPinConfirm) { setOwnerAccessMessage('The PIN entries do not match. Start again.'); setOwnerPin(''); setOwnerPinConfirm(''); setOwnerPinSetupStep(0); return; }
      try { localStorage.setItem(OWNER_PIN_KEY, await hashOwnerCredential(ownerPin)); } catch { setOwnerAccessMessage('This browser could not save the PIN.'); return; }
      setOwnerPinSetupStep(2); setOwnerPin(''); setOwnerPinConfirm(''); setOwnerAccessMessage('Six-digit PIN created for this browser. Enter it again to sign in.'); return;
    }
    try {
      const saved = localStorage.getItem(OWNER_PIN_KEY);
      if (saved && saved === await hashOwnerCredential(ownerPin)) { setShowOwnerAccessField(false); setOwnerPin(''); setOwnerPinConfirm(''); enterOwnerOverride(); }
      else setOwnerAccessMessage('PIN not recognized. Try again.');
    } catch { setOwnerAccessMessage('PIN verification is unavailable in this browser.'); }
  };

  const handleOwnerGoogleSignIn = () => {
    if (!OWNER_GOOGLE_AUTH_ENDPOINT) {
      setOwnerGoogleMessage('Google Sign-In is approved, but the private Apps Script verifier has not been deployed and connected yet. No Google account has been authenticated.');
      return;
    }
    setOwnerGoogleMessage('Google verification endpoint is configured. Complete the Google identity flow to continue.');
  };

  const handleOwnerActivationSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ownerActivationPhrase !== 'HIDDEN ACTIVATION PHRASE # CELESTIAL ARMY') {
      setOwnerAccessMessage('Activation phrase not recognized. The Owner sign-in methods remain locked.');
      return;
    }
    setOwnerActivationPassed(true);
    setOwnerActivationPhrase('');
    setOwnerAccessMessage('Activation accepted. Complete Owner authentication to continue.');
  };

  const startVoiceOwnerAccess = () => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setOwnerAccessMessage('Voice recognition is not supported in this browser. Please use the Access ID and password fields instead.');
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-PH';
    recognition.continuous = false;
    recognition.interimResults = false;
    setVoiceAccessListening(true);
    setOwnerAccessMessage('Listening… Please say your Owner Access phrase clearly.');
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (transcript === 'AVISALA ESHMA') {
        setOwnerAccessMessage('Voice phrase recognized. Opening Owner Preview…');
        setVoiceAccessListening(false);
        recognition.stop();
        setShowOwnerAccessField(false);
        setOwnerAccessId('');
        setOwnerAccessPhrase('');
        enterOwnerOverride();
      } else {
        setVoiceAccessListening(false);
        setOwnerAccessMessage('Voice phrase was not recognized exactly. Please try again or use your Access ID and password.');
      }
    };
    recognition.onerror = (event: any) => {
      setVoiceAccessListening(false);
      setOwnerAccessMessage(event.error === 'not-allowed'
        ? 'Microphone permission was denied. Allow microphone access or use your Access ID and password.'
        : 'Voice recognition could not complete. Please try again or use your Access ID and password.');
    };
    recognition.onend = () => setVoiceAccessListening(false);
    try {
      recognition.start();
    } catch {
      setVoiceAccessListening(false);
      setOwnerAccessMessage('Voice recognition could not start. Please try again or use your Access ID and password.');
    }
  };

  const handleOwnerVoicePhraseSubmit = () => {
    const normalizedPhrase = ownerVoicePhrase.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalizedPhrase !== 'AVISALAESHMA') {
      setOwnerAccessMessage('Passphrase not recognized. Enter AVISALA ESHMA exactly, or use the microphone.');
      return;
    }
    setOwnerAccessMessage('Passphrase accepted. Opening Owner Preview…');
    setVoiceAccessListening(false);
    setShowOwnerAccessField(false);
    setOwnerAccessId('');
    setOwnerAccessPhrase('');
    setOwnerVoicePhrase('');
    enterOwnerOverride();
  };

  const handleOwnerAccessSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ownerAccessId.trim() !== 'CL-OWNER-001' || ownerAccessPhrase !== 'V7!Orion#92Lx@Q4') {
      setOwnerAccessMessage('Access ID or password not recognized. Please try again.');
      return;
    }
    setShowOwnerAccessField(false);
    setOwnerAccessId('');
    setOwnerAccessPhrase('');
    enterOwnerOverride();
  };

  const handleOwnerNotepadChange = (value: string) => {
    setOwnerNotepad(value);
    try { localStorage.setItem('CL_OWNER_NOTEPAD_V1', value); } catch { /* best effort */ }
  };

  const enterOwnerOverride = () => {
    const expiresAt = Date.now() + OWNER_SESSION_MS;
    try { localStorage.setItem(OWNER_SESSION_KEY, String(expiresAt)); } catch { /* browser storage may be unavailable */ }
    setOwnerSessionUntil(expiresAt);
    onOwnerSessionChange?.(true);
    setView('owner-preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exitOwnerOverride = () => {
    try { localStorage.removeItem(OWNER_SESSION_KEY); } catch { /* best effort */ }
    setOwnerSessionUntil(0);
    onOwnerSessionChange?.(false);
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const returnToOwnerPreview = () => {
    setShowExitWarning(false);
    setShowOwnerTools(false);
    setView('owner-preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetOnboardingForOwner = () => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      sessionStorage.removeItem('CL_ONBOARDING_ACTIVE_SESSION');
    } catch { /* best effort in this browser demo */ }
    setOnboardingRecord(null);
    setOnboardStep(0);
    setPurchaseIntent('now');
    setShowExitWarning(false);
    setShowRestrictionHelp(false);
    setRestrictionReason('Your onboarding session was interrupted or declined.');
    setGuestPage(null);
    setView('guest');
    setShowOwnerTools(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  useEffect(() => {
    if (!ownerSessionUntil) return;
    const remaining = ownerSessionUntil - Date.now();
    if (remaining <= 0) {
      try { localStorage.removeItem(OWNER_SESSION_KEY); } catch { /* best effort */ }
      setOwnerSessionUntil(0);
      onOwnerSessionChange?.(false);
      if (view === 'owner-preview') setView('landing');
      return;
    }
    const timer = window.setTimeout(() => {
      try { localStorage.removeItem(OWNER_SESSION_KEY); } catch { /* best effort */ }
      setOwnerSessionUntil(0);
      onOwnerSessionChange?.(false);
      setView(current => current === 'owner-preview' ? 'landing' : current);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [ownerSessionUntil, view]);

  const handleGuestStoreAccess = () => { const saved = readOnboardingRecord(); if (saved?.status === 'completed' && saved.termsAccepted) { onEnterStore(); return; } setView('store-locked'); };
  const handleTermsAcceptance = () => { const saved = readOnboardingRecord(); if (!saved) return; try { sessionStorage.removeItem('CL_ONBOARDING_ACTIVE_SESSION'); } catch { /* best effort */ } persistOnboarding({ ...saved, status: 'completed', termsAccepted: true, completedSteps: Array.from({ length: 8 }, (_, index) => index), restrictionUntil: null }); setTermsAccepted(true); onEnterStore(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleEnvironmentRouting = () => {
    const code = environmentAccessCode.trim().toUpperCase().replace(/\s+/g, '');
    if (code.length < 3) { setEnvironmentRouteMessage('Enter your complete Access Code.'); return; }
    let registry: EnvironmentRegistryEntry[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_PREFIX_STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) registry = saved.filter((entry): entry is EnvironmentRegistryEntry => entry && typeof entry.environment === 'string' && typeof entry.prefix === 'string' && /^[A-Z0-9]{2,3}$/.test(entry.prefix.toUpperCase()));
    } catch { setEnvironmentRouteMessage('The environment registry could not be read in this browser.'); return; }
    const matches = registry.filter(entry => code.startsWith(entry.prefix.toUpperCase())).sort((a,b) => b.prefix.length-a.prefix.length);
    if (!matches.length) { setRoutedEnvironment(null); setEnvironmentRouteMessage('This Access Code does not match a registered environment prefix. Check the code or contact the Owner.'); return; }
    if (matches.length > 1 && matches[0].prefix.length === matches[1].prefix.length) { setRoutedEnvironment(null); setEnvironmentRouteMessage('The environment registry contains an ambiguous prefix. Contact the Owner.'); return; }
    if (code.length <= matches[0].prefix.length) { setEnvironmentRouteMessage('Enter the complete Access Code, including the characters after its environment prefix.'); return; }
    const destination = matches[0].environment;
    if (!['owner', 'army-owner', 'army-member', 'regular-client'].includes(destination)) { setEnvironmentRouteMessage('This prefix is registered to an unsupported environment. Contact the Owner.'); return; }
    setRoutedEnvironment(destination);
    setEnvironmentRouteMessage('Environment identified. The prefix selects a destination only; it does not authenticate your identity or grant access.');
    setView('environment-route');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveInvitationSlots = (slots: InvitationSlot[]) => { setInvitationSlots(slots); try { localStorage.setItem(INVITATION_STORAGE_KEY, JSON.stringify(slots)); } catch { setInvitationMessage('Browser storage is unavailable. Codes could not be saved.'); } };

  const generateInvitationBatch = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const makeCode = () => { let code = 'CL-'; for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]; return code; };
    const existing = new Set(invitationSlots.map(slot => slot.invitationCode));
    const batch: InvitationSlot[] = Array.from({ length: 20 }, (_, index) => { let code = makeCode(); while (existing.has(code)) code = makeCode(); existing.add(code); return { slot: index + 1, invitationCode: code, accessId: '' }; });
    saveInvitationSlots(batch);
    setInvitationMessage('A new set of 20 unique invitation codes has been generated for this browser. Assign each code to its beta user Access ID.');
  };
  const updateInvitationAccessId = (slotNumber: number, accessId: string) => saveInvitationSlots(invitationSlots.map(slot => slot.slot === slotNumber ? { ...slot, accessId: accessId.trim().toUpperCase() } : slot));
  const saveOwnerEnvironmentPrefix = () => {
    const prefix = ownerEnvironmentPrefix.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,3}$/.test(prefix)) {
      setOwnerPrefixMessage('Use exactly 2 or 3 letters and/or digits for the Owner prefix.');
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_PREFIX_STORAGE_KEY) || '[]') as Array<{ environment: string; prefix: string }>;
      const others = saved.filter(entry => entry.environment !== 'owner');
      if (others.some(entry => entry.prefix.toUpperCase() === prefix)) {
        setOwnerPrefixMessage('That prefix is already assigned to another environment.');
        return;
      }
      localStorage.setItem(OWNER_PREFIX_STORAGE_KEY, JSON.stringify([...others, { environment: 'owner', prefix }]));
      setOwnerEnvironmentPrefix(prefix);
      setOwnerPrefixMessage('Owner prefix saved in this browser registry. Screen 1 can now identify this destination; full credential verification remains a separate sign-in step.');
    } catch {
      setOwnerPrefixMessage('Browser storage is unavailable. The Owner prefix could not be saved.');
    }
  };
  const handleVerifyInvitation = () => {
    if (invitationAttempts >= 3) { setInvitationMessage('This browser demo is locked after three unsuccessful attempts.'); return; }
    const match = invitationSlots.find(slot => slot.invitationCode === invitationInput.trim().toUpperCase());
    if (match) {
      if (!match.accessId) { setInvitationMessage('This invitation has not yet been assigned to a beta user. Please contact the Owner.'); return; }
      try { sessionStorage.setItem('CL_ACTIVE_INVITATION_V1', match.invitationCode); } catch { /* best effort */ }
      setInvitationMessage('Invitation verified. Continue to your beta sign-in.'); setGateMessage(null); setView('regular-gate'); return;
    }
    const next = invitationAttempts + 1; setInvitationAttempts(next);
    try { localStorage.setItem(INVITATION_ATTEMPTS_KEY, String(next)); } catch { /* best effort */ }
    setInvitationMessage(next >= 3 ? 'Access permanently locked in this browser demo after three unsuccessful attempts.' : `Invitation code not recognized. ${3-next} attempt${3-next===1?'':'s'} remaining.`);
  };

  const handleVerifyAccess = () => {
    const a = accessIdInput.trim().toUpperCase();
    const p = apgInput.trim().toUpperCase();
    const now = Date.now();
    let failureState: { count: number; lockUntil: number } = { count: 0, lockUntil: 0 };
    try { failureState = JSON.parse(localStorage.getItem(ACCESS_FAILURE_KEY) || '{"count":0,"lockUntil":0}'); } catch { /* use clean demo state */ }
    if (Number(failureState.lockUntil || 0) > now) {
      setGatewayLockUntil(Number(failureState.lockUntil));
      setGateMessage({ text: `ACCESS LOCKED. Try again after ${new Date(failureState.lockUntil).toLocaleTimeString()}.`, success: false });
      return;
    }
    if (Number(failureState.lockUntil || 0) && Number(failureState.lockUntil) <= now) {
      failureState = { count: 0, lockUntil: 0 };
      try { localStorage.removeItem(ACCESS_FAILURE_KEY); } catch { /* best effort */ }
    }
    const account = DEMO_CREDENTIALS[a];
    let savedApgOverrides: Record<string, string> = {};
    try { savedApgOverrides = JSON.parse(localStorage.getItem('CL_EMPLOYEE_Access Code_OVERRIDES_V1') || '{}'); } catch { /* demo defaults */ }
    const expectedApg = account ? (savedApgOverrides[a] || account.apg) : '';
    if (!account || expectedApg !== p) {
      const count = Number(failureState.count || 0) + 1;
      const lockUntil = count >= 3 ? now + ACCESS_LOCK_MS : 0;
      try { localStorage.setItem(ACCESS_FAILURE_KEY, JSON.stringify({ count, lockUntil })); } catch { /* best effort */ }
      setGatewayLockUntil(lockUntil);
      setGateMessage({ text: lockUntil ? 'THREE UNSUCCESSFUL ATTEMPTS. ACCESS LOCKED FOR ONE HOUR.' : `ACCESS NOT RECOGNIZED. ${3-count} ATTEMPT${3-count === 1 ? '' : 'S'} REMAINING.`, success: false });
      return;
    }
    try {
      localStorage.removeItem(ACCESS_FAILURE_KEY);
      const session: GatewaySession = { accessId: a, role: account.role, startedAt: now };
      sessionStorage.setItem(ACCESS_SESSION_KEY, JSON.stringify(session));
      setGatewaySession(session);
    } catch { /* best effort in this browser demo */ }
    setGatewayLockUntil(0);
    setGateMessage({ text: 'ACCESS VERIFIED. OPENING YOUR ENVIRONMENT…', success: true });
    setRecoveryOpen(false);
    setActiveArmyPanel(null);
    if (account.role === 'client') {
      try { sessionStorage.setItem('CL_ACTIVE_CLIENT_SESSION_V1', '1'); } catch { /* best effort */ }
      setActiveEnvironment('regular'); setActiveHomePanel('tracker'); setView('regular-home');
    } else if (account.role === 'emp01' || account.role === 'emp02') {
      setView('army-home');
    } else {
      const expiresAt = now + OWNER_SESSION_MS;
      try { localStorage.setItem(OWNER_SESSION_KEY, String(expiresAt)); } catch { /* best effort */ }
      setOwnerSessionUntil(expiresAt); onOwnerSessionChange?.(true); setView('owner-preview');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const lockSwitchAccess = () => {
    try { sessionStorage.removeItem(ACCESS_SESSION_KEY); sessionStorage.removeItem('CL_ACTIVE_CLIENT_SESSION_V1'); sessionStorage.removeItem('CL_ACTIVE_INVITATION_V1'); } catch { /* best effort */ }
    setGatewaySession(null); setOwnerSessionUntil(0); setActiveEnvironment('guest'); setGuestPage(null); setActiveArmyPanel(null);
    try { localStorage.removeItem(OWNER_SESSION_KEY); } catch { /* best effort */ }
    onOwnerSessionChange?.(false); setGateMessage(null); setRecoveryOpen(false); setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const DEMO_RECOVERY_ORDER = { orderId: 'DEMO-CL-2026-001', startTime: new Date('2026-11-12T00:00:00+08:00').getTime(), totalPaid: 1250, paymentSender: 'NOVA' };
  const handleRecoveryOrderLookup = () => {
    const number = recoveryOrderNumber.trim().toUpperCase();
    if (!number) { setRecoveryMessage('ENTER YOUR ORDER NUMBER.'); setRecoveryOrderFound(false); return; }
    const records = [activeOrder, DEMO_RECOVERY_ORDER].filter(order => Boolean(order?.orderId));
    const foundRecord = records.find(order => {
      const orderDate = Number(order.startTime || 0);
      const age = Date.now() - orderDate;
      return orderDate > 0 && age >= 0 && age <= 90 * 24 * 60 * 60 * 1000 && String(order.orderId).toUpperCase() === number;
    });
    setRecoveryOrderFound(Boolean(foundRecord));
    setRecoveryMessage(foundRecord ? 'ORDER NUMBER FOUND. Continue with the exact amount paid and first four letters of the payment sender.' : 'ORDER NUMBER NOT FOUND. Please check your entry and try again.');
  };

  const handleRecoveryVerification = () => {
    const number = recoveryOrderNumber.trim().toUpperCase();
    const order = number === DEMO_RECOVERY_ORDER.orderId ? DEMO_RECOVERY_ORDER : activeOrder;
    const amount = Number(recoveryAmount);
    const sender = String(order?.paymentSender || '').trim().slice(0, 4).toUpperCase();
    if (recoveryOrderFound && amount === Number(order?.totalPaid) && recoverySender.trim().slice(0, 4).toUpperCase() === sender && sender.length === 4) {
      setRecoveryMessage('DEMO VERIFICATION MATCHED. This confirms the sample record only. Contact celestiallobby@gmail.com for real account recovery.');
    } else {
      setRecoveryMessage('DETAILS COULD NOT BE VERIFIED. Check the information or contact celestiallobby@gmail.com.');
    }
  };

  const EMPLOYEE_RECOVERY = {
    'EMP-01': { question: 'What is the demo recovery word assigned to EMP-01?', answer: 'ORION' },
    'EMP-02': { question: 'What is the demo recovery word assigned to EMP-02?', answer: 'LYRA' }
  } as const;
  const handleEmployeeRecoveryVerify = () => {
    const id = employeeRecoveryId.trim().toUpperCase() as keyof typeof EMPLOYEE_RECOVERY;
    const record = EMPLOYEE_RECOVERY[id];
    if (!record || employeeRecoveryAnswer.trim().toUpperCase() !== record.answer) {
      setEmployeeRecoveryVerified(false);
      setEmployeeRecoveryMessage('RECOVERY LOCKED. No credentials were revealed. Contact celestiallobby@gmail.com for Owner verification.');
      return;
    }
    setEmployeeRecoveryVerified(true);
    setEmployeeRecoveryMessage(`IDENTITY CHECK PASSED IN DEMO. Confirmed Access ID: ${id}. Set a new demo Access Code below.`);
  };
  const handleEmployeeApgReset = () => {
    const id = employeeRecoveryId.trim().toUpperCase();
    const code = employeeNewApg.trim().toUpperCase();
    if (!employeeRecoveryVerified || !['EMP-01', 'EMP-02'].includes(id) || !/^[A-Z0-9]{8}$/.test(code)) {
      setEmployeeRecoveryMessage('ENTER A NEW 8-CHARACTER LETTER/NUMBER ACCESS CODE.');
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem('CL_EMPLOYEE_Access Code_OVERRIDES_V1') || '{}') as Record<string, string>;
      saved[id] = code;
      localStorage.setItem('CL_EMPLOYEE_Access Code_OVERRIDES_V1', JSON.stringify(saved));
      setEmployeeRecoveryMessage(`DEMO ACCESS CODE RESET FOR ${id}. Use the confirmed Access ID and your new code. Owner oversight is still required for real access restoration.`);
      setEmployeeRecoveryVerified(false);
      setEmployeeRecoveryAnswer('');
      setEmployeeNewApg('');
    } catch {
      setEmployeeRecoveryMessage('THIS BROWSER COULD NOT SAVE THE DEMO RESET. Contact celestiallobby@gmail.com.');
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
    <div className={`portal-shell min-h-screen flex flex-col justify-between ${(['regular-gate', 'invitation-gate', 'environment-gate', 'environment-route'].includes(view)) ? 'client-access-gate' : ''}`} data-page={view}>      {view !== 'landing' && view !== 'regular-gate' && view !== 'invitation-gate' && view !== 'environment-gate' && view !== 'environment-route' && (
        <header className="portal-header"><div className="portal-header-inner">
          <button type="button" className="portal-brand cursor-pointer" aria-label="CELESTIAL LOBBY home" onClick={navigateEnvironmentHome}><span className="brand-name">CELESTIAL LOBBY</span></button>
          <button type="button" className="lobby-menu-trigger" aria-label={menuOpen ? "Close site navigation" : "Open site navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
        </div>
        {menuOpen && <><button type="button" className="lobby-menu-backdrop" aria-label="Close site navigation" onClick={() => setMenuOpen(false)} /><nav className="lobby-menu-drawer" aria-label="Site and Owner navigation">
          <details className="owner-drawer-section" open><summary>Site Navigation</summary>
            <button type="button" onClick={() => { navigateEnvironmentHome(); setMenuOpen(false); }}>Home</button>
            <button type="button" onClick={() => { handleChromeNavigation('about'); setMenuOpen(false); }}>About</button>
            <button type="button" onClick={() => { handleChromeNavigation('faqs'); setMenuOpen(false); }}>FAQs</button>
            <button type="button" onClick={() => { setMenuOpen(false); onEnterStore(); }}>Store</button>
            <button type="button" onClick={() => { setActiveHomePanel('tracker'); handleChromeNavigation('regular-home'); setMenuOpen(false); }}>Order Tracker</button>
          </details>
          {ownerSessionUntil > Date.now() && <details className="owner-drawer-section"><summary>Owner Controls</summary>
            <button type="button" onClick={() => { onOpenOwnerNotepad?.(); setMenuOpen(false); }}>Owner Notepad</button>
            <button type="button" onClick={() => { document.getElementById('owner-beta-invitations')?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false); }}>Beta Invitation Codes</button>
            <button type="button" onClick={() => { onOpenOwnerTools?.(); setMenuOpen(false); }}>Override Controls</button>
            <button type="button" className="owner-drawer-exit" onClick={() => { exitOwnerOverride(); setMenuOpen(false); }}>Exit Owner Session</button>
          </details>}
        </nav></>}
      </header>
      )}
      {ownerSessionUntil > Date.now() && !['landing', 'regular-gate', 'invitation-gate', 'environment-gate', 'environment-route', 'onboarding', 'onboarding-terms'].includes(view) && (
        <nav className="owner-environment-switcher" aria-label="Owner environment preview switcher">
          <button type="button" className={view === 'owner-preview' ? 'is-active' : ''} onClick={() => { setView('owner-preview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Owner</button>
          <button type="button" className={view === 'guest' ? 'is-active' : ''} onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Guest</button>
          <button type="button" className={view === 'regular-home' ? 'is-active' : ''} onClick={() => { setActiveEnvironment('regular'); setView('regular-home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Member</button>
          <button type="button" className={view === 'army-home' ? 'is-active' : ''} onClick={() => { setActiveArmyPanel('emp01'); setView('army-home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Army</button>
          {view !== 'owner-preview' && <button type="button" className="owner-preview-exit" onClick={() => { setView('owner-preview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Exit Preview</button>}
        </nav>
      )}
      {/* Main Views Container */}
      <main className="portal-main flex-grow">
        {/* OWNER OVERRIDE / BROWSER-LOCAL PREVIEW */}
        {view === 'owner-preview' && ownerSessionUntil > Date.now() && (
          <section className="guest-content-page animate-fadeIn owner-homepage">
            <div className="portal-topline owner-home-topline">
              <button className="text-back" onClick={lockSwitchAccess}>← Lock / Switch Access</button>
              <span>OWNER COMMAND · PRIVATE WORKSPACE</span>
            </div>
            <p className="eyebrow">AUTHORIZED BROWSER SESSION</p>
            <h2 className="section-title">Welcome, Commander.</h2>
            <p className="section-copy">Owner Preview is active in this browser. This workspace is reserved for previewing and testing the portal experience.</p>
            <div className="owner-session-status">
              <span><i aria-hidden="true" className="fa-solid fa-shield-check"></i> OWNER SESSION: ACTIVE</span>
              <small>LOCAL DEMO SESSION</small>
            </div>
            <nav className="owner-command-bar" aria-label="Owner command bar">
              <button type="button" aria-label="Environment" title="Environment" onClick={() => { const target = document.getElementById('owner-preview-workspace'); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i className="fa-solid fa-globe" aria-hidden="true"></i></button>
              <button type="button" aria-label="Operations" title="Operations" onClick={() => { const target = document.getElementById('owner-master-operations'); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i></button>
              <button type="button" aria-label="Accounts and Access" title="Accounts &amp; Access" onClick={() => { const target = document.getElementById('owner-account-management'); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i className="fa-solid fa-users" aria-hidden="true"></i></button>
              <button type="button" aria-label="Content Studio" title="Content Studio" onClick={() => { const target = document.getElementById('owner-master-content'); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i className="fa-solid fa-file-pen" aria-hidden="true"></i></button>
              <button type="button" aria-label="Vault" title="Vault" onClick={() => { const target = document.getElementById('owner-master-vault'); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i className="fa-solid fa-folder-closed" aria-hidden="true"></i></button>
              <button type="button" aria-label="Store" title="Store" onClick={onEnterStore}><i className="fa-solid fa-store" aria-hidden="true"></i></button>
              <button type="button" aria-label="System" title="System" onClick={() => { const target = document.getElementById('owner-master-system'); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i className="fa-solid fa-gear" aria-hidden="true"></i></button>
            </nav>
            <section id="owner-destinations" className="owner-destination-stage" aria-label="Owner destinations">
              <button type="button" className="owner-destination-tile owner-tile-celestials" onClick={() => { setActiveEnvironment('guest'); setGuestPage('celestial-overview'); setView('guest'); }}>
                <span className="owner-tile-icon"><i className="fa-solid fa-star" aria-hidden="true"></i></span><b>CELESTIALS</b><small>Explore the celestial realms</small>
              </button>
              <button type="button" className="owner-destination-tile owner-tile-founders" onClick={() => { setActiveEnvironment('guest'); setGuestPage('founders'); setView('guest'); }}>
                <span className="owner-tile-icon"><i className="fa-solid fa-crown" aria-hidden="true"></i></span><b>FOUNDERS</b><small>The founding circle</small>
              </button>
              <button type="button" className="owner-destination-tile owner-tile-draconians" onClick={() => { const target = document.getElementById('owner-master-content'); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                <span className="owner-tile-icon"><i className="fa-solid fa-dragon" aria-hidden="true"></i></span><b>DRACONIANS</b><small>Open Content Studio</small>
              </button>
              <button type="button" className="owner-destination-tile owner-tile-store" onClick={onEnterStore}>
                <i className="fa-solid fa-store" aria-hidden="true"></i><b>STORE</b>
              </button>
            </section>
            <button type="button" className="owner-onboarding-strip" onClick={startOnboarding}>
              <span><i className="fa-solid fa-compass" aria-hidden="true"></i> ONBOARDING SESSION</span><i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
            <OwnerMasterControl activeOrder={activeOrder} onUpdateStatus={onUpdateStatus} />
            <details id="owner-account-management" className="portal-panel p-4 mt-4 owner-module-panel">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3"><span className="text-amber-300 font-bold tracking-widest text-xs">ACCOUNT MANAGEMENT · UNIVERSAL ACCOUNT GENERATOR</span><span className="text-purple-200 text-xs">EXPAND / COLLAPSE</span></summary>
              <button type="button" className="secondary-action mt-3" onClick={() => setView('info-sec')}>OPEN ACCESS &amp; SECURITY</button>
              <h3 className="section-title mt-3">Generate environment-restricted credentials</h3>
              <p className="section-copy">Select the account environment first. Each generated record is tagged to that environment. This browser-only demonstration does not create secure or centrally valid credentials.</p>
              <label className="block mt-3 text-xs text-purple-200">ACCOUNT ENVIRONMENT
                <select className="mt-1 w-full rounded-lg border border-purple-400/30 bg-slate-900 p-3 text-sm text-white" value={accountEnvironment} onChange={event => setAccountEnvironment(event.target.value as typeof accountEnvironment)}>
                  <option value="celestial-army">Celestial Army</option><option value="regular-client">Regular Client / Member</option><option value="beta-tester">Beta Tester (external tester)</option><option value="guest-visitor">Guest / Visitor</option>
                </select>
              </label>
              <label className="block mt-3 text-xs text-purple-200">CREDENTIAL OPERATION
                <select className="mt-1 w-full rounded-lg border border-purple-400/30 bg-slate-900 p-3 text-sm text-white" value={accountAction} onChange={event => setAccountAction(event.target.value as typeof accountAction)}>
                  <option value="generate">Generate new Access ID + Access Code</option><option value="reset-code">Reset Access Code</option><option value="regenerate">Regenerate Access ID + Access Code</option>
                </select>
              </label>
              {accountAction !== 'generate' && <label className="block mt-3 text-xs text-purple-200">EXISTING ACCESS ID<input className="mt-1 w-full rounded-lg border border-purple-400/30 bg-slate-900 p-3 text-sm text-white" value={accountIdLookup} onChange={event => setAccountIdLookup(event.target.value.toUpperCase())} placeholder="Enter Access ID" /></label>}
              {accountAction === 'reset-code' && <label className="block mt-3 text-xs text-purple-200">NEW ACCESS CODE (OPTIONAL)<input className="mt-1 w-full rounded-lg border border-purple-400/30 bg-slate-900 p-3 text-sm text-white uppercase" maxLength={8} value={accountCodeReset} onChange={event => setAccountCodeReset(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))} placeholder="Leave blank to generate one" /></label>}
              <button type="button" className="primary-action mt-3" onClick={() => {
                const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                const makeCode = () => Array.from({length:8}, () => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length]).join('');
                const prefixes = { 'celestial-army':'ARMY', 'regular-client':'CL', 'beta-tester':'BETA', 'guest-visitor':'GUEST' } as const;
                const labels = { 'celestial-army':'Celestial Army', 'regular-client':'Regular Client / Member', 'beta-tester':'Beta Tester', 'guest-visitor':'Guest / Visitor' } as const;
                const persist = (next: typeof ownerAccounts) => { setOwnerAccounts(next); try { localStorage.setItem('CL_OWNER_ACCOUNT_REGISTRY_V1', JSON.stringify(next)); } catch { setAccountMessage('Could not save this browser demo registry.'); } };
                if (accountAction === 'generate') {
                  const accessId = prefixes[accountEnvironment] + '-' + Date.now().toString(36).toUpperCase().slice(-6);
                  const record = { accessId, accessCode: makeCode(), environment: labels[accountEnvironment], status: 'Active' as const, createdAt: Date.now() };
                  persist([...ownerAccounts, record]); setAccountMessage('Generated demo credentials: ' + accessId + ' / ' + record.accessCode + '. Environment: ' + record.environment + '.');
                } else {
                  const index = ownerAccounts.findIndex(item => item.accessId === accountIdLookup.trim().toUpperCase());
                  if (index < 0) { setAccountMessage('Access ID not found in this browser registry.'); return; }
                  if (ownerAccounts[index].environment !== labels[accountEnvironment]) { setAccountMessage('Environment mismatch. Select the account\'s assigned environment.'); return; }
                  const next = [...ownerAccounts];
                  if (accountAction === 'reset-code') { if (accountCodeReset && !/^[A-Z0-9]{8}$/.test(accountCodeReset)) { setAccountMessage('Access Code must contain exactly 8 letters and/or numbers.'); return; } next[index] = { ...next[index], accessCode: accountCodeReset || makeCode() }; setAccountMessage('Access Code reset for ' + next[index].accessId + ': ' + next[index].accessCode); }
                  else { const old = next[index]; next[index] = { ...old, accessId: prefixes[accountEnvironment] + '-' + Date.now().toString(36).toUpperCase().slice(-6), accessCode: makeCode() }; setAccountMessage('Credentials regenerated. New Access ID: ' + next[index].accessId + ' / Access Code: ' + next[index].accessCode); }
                  persist(next);
                }
                setAccountIdLookup(''); setAccountCodeReset('');
              }}> {accountAction === 'generate' ? 'GENERATE CREDENTIALS' : accountAction === 'reset-code' ? 'RESET ACCESS CODE' : 'REGENERATE CREDENTIALS'} </button>
              {accountMessage && <p className="form-message mt-3 break-words" role="status">{accountMessage}</p>}
              <div className="mt-4 rounded-lg border border-purple-400/20 p-3">
                <b className="text-xs tracking-widest text-amber-200">ACCOUNT REGISTRY</b>
                {ownerAccounts.length === 0 ? <p className="small-caveat mt-2">No accounts generated in this browser yet.</p> : ownerAccounts.map(account => <div key={account.accessId} className="mt-2 border-b border-purple-400/10 pb-2 text-xs"><div className="flex justify-between gap-2"><b>{account.accessId}</b><span>{account.status}</span></div><p className="text-purple-200">{account.environment}</p><div className="mt-2 flex flex-wrap gap-2">{(['Active','Suspended','Revoked','Expired'] as const).map(status => <button key={status} type="button" className="text-[10px] rounded border border-purple-300/20 px-2 py-1" onClick={() => { const next = ownerAccounts.map(item => item.accessId === account.accessId ? { ...item, status } : item); setOwnerAccounts(next); try { localStorage.setItem('CL_OWNER_ACCOUNT_REGISTRY_V1', JSON.stringify(next)); } catch { /* local demo */ } }}>{status}</button>)}</div></div>)}
              </div>
              <div className="mt-4 border-t border-purple-400/20 pt-3">
                <b className="text-xs tracking-widest text-amber-200">ENVIRONMENT PREFIXES</b>
                <p className="small-caveat mt-1">Existing saved prefix configuration is preserved. Prefixes are informational in this demo and do not authenticate accounts.</p>
                <label className="block mt-2 text-xs text-purple-200">OWNER PREFIX<input className="mt-1 w-full rounded-lg border border-purple-400/30 bg-slate-900 p-2 text-sm text-white uppercase" maxLength={3} value={ownerEnvironmentPrefix} onChange={event => { setOwnerEnvironmentPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)); setOwnerPrefixMessage(''); }} /></label>
                <button type="button" className="secondary-action mt-2" onClick={saveOwnerEnvironmentPrefix}>SAVE OWNER PREFIX</button>
                {ownerPrefixMessage && <p className="form-message mt-2">{ownerPrefixMessage}</p>}
              </div>
              <p className="small-caveat mt-3">DEMO ONLY · Data stays in this browser. Production account issuance, reset, suspension and revocation require trusted backend validation and an audit log.</p>
            </details>

            <details id="owner-preview-workspace" className="portal-panel p-4 mt-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3"><span className="text-amber-300 font-bold tracking-widest text-xs">PREVIEW WORKSPACE</span><span className="text-purple-200 text-xs">EXPAND / COLLAPSE</span></summary>
              <h3 className="section-title mt-3">Environment simulation</h3>
              <p className="section-copy">Inspect implemented pages and navigation. Preview activity is not a live business record.</p>
              <div className="flex flex-wrap gap-2 mt-4"><button className="primary-action" onClick={() => { setActiveEnvironment('guest'); setView('guest'); setGuestPage(null); }}>Open Guest Environment</button><button className="secondary-action" onClick={() => { setActiveEnvironment('regular'); setView('regular-home'); }}>Regular Client Preview</button><button className="text-back" onClick={lockSwitchAccess}>Lock / Switch Access</button></div>
            </details>

            <details id="owner-reference-center" className="portal-panel p-4 mt-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3"><span className="text-amber-300 font-bold tracking-widest text-xs">OWNER REFERENCE CENTER</span><span className="text-purple-200 text-xs">EXPAND / COLLAPSE</span></summary>
              <h3 className="section-title mt-3">Operational references</h3>
              <div className="mt-3 rounded-lg border border-purple-400/20 p-3 text-xs space-y-2"><p><b>ACCESS ID:</b> Identifies an individual member or employee.</p><p><b>ACCESS CODE:</b> Exactly 8 alphanumeric characters.</p><p><b>ENVIRONMENTS:</b> Celestial Army, Regular Client / Member, Beta Tester (external), Guest / Visitor.</p><p><b>BETA TESTERS:</b> External testers, not members, clients, or employees.</p><p><b>SECURITY:</b> Browser-local demo credentials are not secure authentication.</p><p><b>ACCOUNT STATUS:</b> Active, Suspended, Revoked, Expired.</p></div>
              <label className="block mt-3 text-xs text-purple-200">OWNER NOTES<textarea className="w-full mt-1 rounded-lg border border-purple-400/30 bg-slate-950/70 p-3 text-sm text-slate-100 min-h-28" rows={5} value={referenceNotes} onChange={event => { setReferenceNotes(event.target.value); try { localStorage.setItem('CL_OWNER_REFERENCE_CENTER_V1', event.target.value); } catch { /* best effort */ } }} placeholder="Operational procedures, navigation references, and reminders..." /></label>
              <p className="small-caveat mt-2">Saved locally in this browser. Do not store passwords, payment details, or customer data here.</p>
            </details>

            <details id="owner-preview-panel" className="portal-panel p-4 mt-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3"><span className="text-amber-300 font-bold tracking-widest text-xs">OWNER PREVIEW</span><span className="text-purple-200 text-xs">EXPAND / COLLAPSE</span></summary>
              <p className="section-copy mt-3">Preview the portal as a visitor or regular client without changing the account environment.</p>
              <div className="grid grid-cols-2 gap-2 mt-3"><button className="primary-action" onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); }}>Guest Preview</button><button className="secondary-action" onClick={() => { setActiveEnvironment('regular'); setView('regular-home'); }}>Regular Client Preview</button></div>
            </details>
            <p className="text-xs text-amber-200/80 mt-4">LOCAL BROWSER ACCESS ONLY · Not server-verified authentication. Anyone with access to this browser profile can open this preview.</p>
          </section>
        )}

        {/* SCREEN 1 · ACCESS GATE */}
        {view === 'landing' && (
          <section className="min-h-[100svh] flex flex-col items-center justify-center px-5 py-10 text-center animate-fadeIn">
            <button
              type="button"
              aria-label="CELESTIAL LOBBY emblem. Tap five times for Owner access."
              onClick={() => { const next = ownerTriggerTaps + 1; setOwnerTriggerTaps(next >= 5 ? 0 : next); if (next >= 5) activateOwnerTrigger(); }}
              className="mb-7 flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/70 bg-slate-900/80 shadow-[0_0_45px_rgba(59,130,246,0.22)]"
            >
              <span className="text-5xl text-amber-200" aria-hidden="true">✦</span>
            </button>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.38em] text-amber-200">CELESTIAL LOBBY</p>
            <h1 className="mb-3 text-3xl font-semibold tracking-[0.16em] text-white sm:text-4xl">ACCESS GATE</h1>
            <div className="mb-6 h-px w-24 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
            <p className="mb-7 max-w-sm text-sm leading-6 text-slate-300">Enter your assigned credentials to access your environment.</p>

            <form className="gate-panel w-full max-w-sm space-y-4 text-left" onSubmit={(event) => { event.preventDefault(); handleVerifyAccess(); }}>
              <label htmlFor="gate-access-id" className="block">
                <span className="mb-2 block text-[10px] font-bold tracking-[0.2em] text-amber-200">ACCESS ID</span>
                <input
                  id="gate-access-id"
                  type="text"
                  value={accessIdInput}
                  onChange={(event) => setAccessIdInput(event.target.value.toUpperCase())}
                  placeholder="Enter your Access ID"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>
              <label htmlFor="gate-apg-code" className="block">
                <span className="mb-2 block text-[10px] font-bold tracking-[0.2em] text-amber-200">ACCESS CODE</span>
                <input
                  id="gate-apg-code"
                  type="password"
                  value={apgInput}
                  onChange={(event) => setApgInput(event.target.value.toUpperCase())}
                  placeholder="Enter your Access Code"
                  autoComplete="off"
                  required
                />
              </label>
              <button type="submit" className="primary-action min-h-14 w-full tracking-[0.16em]">VERIFY ACCESS</button>
              {gateMessage && <p className={`form-message ${gateMessage.success ? 'text-emerald-300' : 'text-amber-200'}`} role="status">{gateMessage.text}</p>}
              {Object.prototype.hasOwnProperty.call(DEMO_CREDENTIALS, accessIdInput.trim().toUpperCase()) && <button type="button" className="text-link w-full" onClick={() => { const demo = DEMO_CREDENTIALS[accessIdInput.trim().toUpperCase()]; setApgInput(demo.apg); setGateMessage({ text: 'DEMO QUICK-FILL populated the matching test credential.', success: true }); }}>DEMO QUICK-FILL · FILL TEST CODE</button>}
              <button type="button" className="text-link w-full" onClick={() => { setRecoveryOpen(v => !v); setRecoveryMessage(''); setRecoveryOrderFound(false); setEmployeeRecoveryMessage(''); }}>FORGOT YOUR ACCESS?</button>
              {recoveryOpen && <div className="portal-panel p-3 space-y-3" role="region" aria-label="Access recovery"><div className="border-b border-purple-400/20 pb-3"><b className="text-amber-200 text-xs tracking-widest">CLIENT ACCESS RECOVERY</b><p className="text-xs text-slate-300 mt-2">Enter your order number. The demo checks the available browser record and one clearly labelled sample record from the last 90 days. No receipt copy is required.</p><label className="block text-xs mt-2">ORDER NUMBER<input className="mt-1 w-full" value={recoveryOrderNumber} onChange={e => { setRecoveryOrderNumber(e.target.value); setRecoveryOrderFound(false); }} placeholder="Enter order number" /></label><button type="button" className="secondary-action w-full mt-2" onClick={handleRecoveryOrderLookup}>LOOK UP ORDER</button>{recoveryOrderFound && <><label className="block text-xs mt-2">EXACT AMOUNT PAID<input className="mt-1 w-full" inputMode="decimal" value={recoveryAmount} onChange={e => setRecoveryAmount(e.target.value)} placeholder="0.00" /></label><label className="block text-xs mt-2">FIRST FOUR LETTERS OF PAYMENT SENDER<input className="mt-1 w-full" value={recoverySender} onChange={e => setRecoverySender(e.target.value.toUpperCase().slice(0,4))} maxLength={4} placeholder="ABCD" /></label><button type="button" className="primary-action w-full mt-2" onClick={handleRecoveryVerification}>VERIFY DETAILS</button></>}{recoveryMessage && <p className="form-message mt-2" role="status">{recoveryMessage}</p>}<p className="small-caveat mt-2">DEMO SAMPLE ORDER: DEMO-CL-2026-001 · Amount: ₱1,250 · Sender: NOVA. Sample data only, not a customer order.</p></div><div className="pt-2"><b className="text-amber-200 text-xs tracking-widest">EMPLOYEE ACCESS RECOVERY</b><p className="text-xs text-slate-300 mt-2">Enter your Employee ID and answer its assigned demo security question. Three failed gateway sign-ins still trigger the standard one-hour lockout.</p><label className="block text-xs mt-2">EMPLOYEE ID<input className="mt-1 w-full" value={employeeRecoveryId} onChange={e => { setEmployeeRecoveryId(e.target.value.toUpperCase()); setEmployeeRecoveryVerified(false); setEmployeeRecoveryMessage(''); }} placeholder="EMP-01 or EMP-02" /></label>{(employeeRecoveryId.trim().toUpperCase() === 'EMP-01' || employeeRecoveryId.trim().toUpperCase() === 'EMP-02') && <><p className="text-xs text-purple-200 mt-2">{EMPLOYEE_RECOVERY[employeeRecoveryId.trim().toUpperCase() as keyof typeof EMPLOYEE_RECOVERY].question}</p><label className="block text-xs mt-2">SECURITY ANSWER<input className="mt-1 w-full" value={employeeRecoveryAnswer} onChange={e => setEmployeeRecoveryAnswer(e.target.value)} placeholder="Enter assigned answer" /></label></>}<button type="button" className="secondary-action w-full mt-2" onClick={handleEmployeeRecoveryVerify}>VERIFY EMPLOYEE</button>{employeeRecoveryVerified && <><p className="text-xs text-slate-300">New Access Code must contain exactly 8 letters and/or numbers.</p><label className="block text-xs mt-2">NEW ACCESS CODE<input className="mt-1 w-full" type="password" maxLength={8} value={employeeNewApg} onChange={e => setEmployeeNewApg(e.target.value.toUpperCase())} placeholder="8 characters" /></label><button type="button" className="primary-action w-full mt-2" onClick={handleEmployeeApgReset}>RESET DEMO ACCESS CODE</button></>}{employeeRecoveryMessage && <p className="form-message mt-2" role="status">{employeeRecoveryMessage}</p>}<p className="small-caveat mt-2">DEMO ONLY · Questions and reset values are stored in this browser. A real employee recovery requires manual Owner verification. Support: celestiallobby@gmail.com</p></div></div>}
              {gatewayLockUntil > Date.now() && <p className="small-caveat text-rose-300">LOCKED UNTIL {new Date(gatewayLockUntil).toLocaleTimeString()}</p>}
            </form>

            <div className="mt-5 w-full max-w-sm">
              <button
                type="button"
                className="secondary-action min-h-14 w-full tracking-[0.12em]"
                onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                JOIN US / ENTER AS VISITOR
              </button>
            </div>

            <p className="mt-7 max-w-sm text-[10px] leading-5 tracking-[0.08em] text-slate-500">DEMO ONLY — NOT SECURE FOR REAL CUSTOMER DATA</p>

            {showOwnerAccessField && (
              <div className="portal-modal portal-panel mt-6 w-full max-w-sm p-4 text-left" role="dialog" aria-modal="true" aria-label="Owner access">
                <div className="flex items-center justify-between gap-3">
                  <small className="font-bold tracking-widest text-amber-300">RESTRICTED OWNER ACCESS</small>
                  <button
                    type="button"
                    className="secondary-action min-h-9 px-3"
                    aria-label="Close Owner Access"
                    onClick={() => { setShowOwnerAccessField(false); setOwnerAccessId(''); setOwnerAccessPhrase(''); setOwnerActivationPhrase(''); setOwnerActivationPassed(false); setOwnerAccessMessage(''); }}
                  >
                    CLOSE / EXIT
                  </button>
                </div>
                {ownerSessionUntil > Date.now() ? (
                  <>
                    <p className="section-copy mt-2">Your Owner session is remembered on this browser.</p>
                    <button className="primary-action mt-3" onClick={activateOwnerTrigger}>Resume Owner Preview</button>
                  </>
                ) : (
                  <form className="gate-panel mt-3 p-0" onSubmit={handleOwnerAccessSubmit}>
                    <div className="grid grid-cols-2 gap-2 mb-3" role="group" aria-label="Owner sign-in methods">
                      <button type="button" className={ownerSignInMethod === 'pattern' ? 'primary-action' : 'secondary-action'} onClick={() => { setOwnerSignInMethod('pattern'); setOwnerPattern([]); setOwnerPatternConfirm([]); setOwnerPatternSetupStep(localStorage.getItem(OWNER_PATTERN_KEY) ? 2 : 0); setOwnerAccessMessage(''); }}>Pattern Unlock</button>
                      <button type="button" className={ownerSignInMethod === 'password' ? 'primary-action' : 'secondary-action'} onClick={() => { setOwnerSignInMethod('password'); setOwnerAccessMessage(''); }}>Access ID + Password</button>
                    </div>
                    {ownerSignInMethod === 'password' && <>
                    <label htmlFor="owner-access-id">OWNER ACCESS ID
                      <input id="owner-access-id" type="text" autoComplete="username" required value={ownerAccessId} onChange={(event) => setOwnerAccessId(event.target.value)} placeholder="Enter Owner Access ID" />
                    </label>
                    <label htmlFor="owner-access-phrase" className="mt-3 block">OWNER PASSWORD
                      <input id="owner-access-phrase" type="password" autoComplete="current-password" required value={ownerAccessPhrase} onChange={(event) => setOwnerAccessPhrase(event.target.value)} placeholder="Enter Owner password" />
                    </label>
                    {ownerAccessMessage && <p className="form-message text-amber-200" role="status">{ownerAccessMessage}</p>}
                    <button className="primary-action" type="submit">Sign in to Owner Dashboard</button>
                    <p className="small-caveat mt-2">DEMO ONLY — credentials are checked in browser code and are not secure production authentication.</p>
                    </>}
                    {ownerSignInMethod === 'pattern' && <div className="space-y-3">
                      <p className="section-copy">{ownerPatternSetupStep === 0 ? 'Create a pattern by connecting at least four dots.' : ownerPatternSetupStep === 1 ? 'Confirm your new pattern.' : 'Draw your saved Owner pattern.'}</p>
                      <div className="owner-pattern-grid grid grid-cols-3 gap-3 max-w-[230px] mx-auto py-3" aria-label="3 by 3 pattern grid">
                        {Array.from({ length: 9 }, (_, index) => <button key={index} type="button" aria-label={`Pattern dot ${index + 1}`} onClick={() => { const target = ownerPatternSetupStep === 1 ? setOwnerPatternConfirm : setOwnerPattern; target((previous) => previous.includes(index) ? previous : [...previous, index]); }} className={`aspect-square rounded-full border-2 ${ownerPattern.includes(index) || ownerPatternConfirm.includes(index) ? 'border-amber-200 bg-amber-300/30' : 'border-slate-400 bg-slate-900'}`}><span className="text-xs">{ownerPattern.includes(index) || ownerPatternConfirm.includes(index) ? '●' : '·'}</span></button>)}
                      </div>
                      <p className="text-center text-xs text-slate-300">{(ownerPatternSetupStep === 1 ? ownerPatternConfirm : ownerPattern).length} dots selected</p>
                      <button type="button" className="primary-action" onClick={handleOwnerPatternSubmit}>{ownerPatternSetupStep === 0 ? 'Continue Pattern Setup' : ownerPatternSetupStep === 1 ? 'Confirm Pattern' : 'Unlock with Pattern'}</button>
                      <button type="button" className="secondary-action w-full" onClick={() => { setOwnerPattern([]); setOwnerPatternConfirm([]); setOwnerAccessMessage('Pattern cleared.'); }}>Clear Pattern</button>
                    </div>}
                    {ownerSignInMethod === 'pin' && <div className="space-y-3">
                      <p className="section-copy">{ownerPinSetupStep === 0 ? 'Create a six-digit Owner PIN.' : ownerPinSetupStep === 1 ? 'Confirm your six-digit PIN.' : 'Enter your saved six-digit PIN.'}</p>
                      <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={ownerPin} onChange={(event) => setOwnerPin(event.target.value.replace(/\\D/g, '').slice(0, 6))} placeholder="6-digit PIN" aria-label="Owner six-digit PIN" />
                      {ownerPinSetupStep === 1 && <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={ownerPinConfirm} onChange={(event) => setOwnerPinConfirm(event.target.value.replace(/\\D/g, '').slice(0, 6))} placeholder="Confirm PIN" aria-label="Confirm Owner PIN" />}
                      <button type="button" className="primary-action" onClick={handleOwnerPinSubmit}>{ownerPinSetupStep === 0 ? 'Continue PIN Setup' : ownerPinSetupStep === 1 ? 'Confirm PIN' : 'Unlock with PIN'}</button>
                    </div>}
                    {ownerSignInMethod === 'voice' && <div className="space-y-3">
                      <p className="section-copy">Use the microphone to say your Owner passphrase, or type it below if microphone access is unavailable.</p>
                      <button type="button" className="primary-action w-full" onClick={startVoiceOwnerAccess} disabled={voiceAccessListening}>
                        {voiceAccessListening ? '● Listening… Speak now' : '🎙 Activate Microphone'}
                      </button>
                      <label htmlFor="owner-voice-phrase" className="block">TYPE OWNER PASSPHRASE
                        <input id="owner-voice-phrase" type="text" autoComplete="off" value={ownerVoicePhrase} onChange={(event) => setOwnerVoicePhrase(event.target.value)} placeholder="AVISALA ESHMA" />
                      </label>
                      <button type="button" className="secondary-action w-full" onClick={handleOwnerVoicePhraseSubmit}>Submit Typed Passphrase</button>
                      {ownerAccessMessage && <p className="form-message text-amber-200" role="status">{ownerAccessMessage}</p>}
                      <p className="small-caveat">DEMO ONLY — this passphrase is checked in browser code and is not secure production authentication.</p>
                    </div>}
                    {ownerSignInMethod === 'google' && <div className="space-y-3">
                      <p className="section-copy">Sign in with one of the Owner-approved Google accounts. Account eligibility will be checked privately by Google Apps Script.</p>
                      <button type="button" className="primary-action" onClick={handleOwnerGoogleSignIn}>Continue with Google</button>
                      {ownerGoogleMessage && <p className="form-message text-amber-200" role="status">{ownerGoogleMessage}</p>}
                      <p className="small-caveat">Google identity verification is not active until the private verifier URL and OAuth client configuration are connected.</p>
                    </div>}
                  </form>
                )}
              </div>
            )}
          </section>
        )}

        {view === 'army-home' && gatewaySession && (gatewaySession.role === 'emp01' || gatewaySession.role === 'emp02') && <section className="guest-content-page animate-fadeIn"><div className="portal-topline"><button className="text-back" onClick={lockSwitchAccess}>← Lock / Switch Access</button><span>CELESTIAL ARMIES</span></div><p className="eyebrow">AUTHORIZED DEMO WORKSPACE</p><h2 className="section-title">Celestial Armies Homepage</h2><p className="section-copy">Signed in as {gatewaySession.accessId}. Both employee panels are visible; only your assigned panel is enabled and selectable.</p><div className="grid gap-3 mt-5"><button className="portal-panel p-4 text-left" disabled={gatewaySession.role !== 'emp01'} onClick={() => setActiveArmyPanel('emp01')} style={{ opacity: gatewaySession.role === 'emp01' ? 1 : 0.45, cursor: gatewaySession.role === 'emp01' ? 'pointer' : 'not-allowed' }}><b className="text-amber-200">EMP-01 PANEL</b><p className="text-xs text-slate-300 mt-1">{gatewaySession.role === 'emp01' ? 'Enabled for this session.' : 'Unavailable for this account.'}</p></button><button className="portal-panel p-4 text-left" disabled={gatewaySession.role !== 'emp02'} onClick={() => setActiveArmyPanel('emp02')} style={{ opacity: gatewaySession.role === 'emp02' ? 1 : 0.45, cursor: gatewaySession.role === 'emp02' ? 'pointer' : 'not-allowed' }}><b className="text-amber-200">EMP-02 PANEL</b><p className="text-xs text-slate-300 mt-1">{gatewaySession.role === 'emp02' ? 'Enabled for this session.' : 'Unavailable for this account.'}</p></button></div>{activeArmyPanel && <div className="portal-panel p-4 mt-4 space-y-4"><div className="flex items-center justify-between"><div><small className="text-[10px] tracking-widest text-amber-300">ACTIVE WORKSPACE</small><b className="block text-amber-200">{activeArmyPanel.toUpperCase()} DASHBOARD</b></div><button className="text-link" onClick={() => setActiveArmyPanel(null)}>CLOSE</button></div><p className="text-xs text-slate-300">Your assigned employee workspace is active. This dashboard shows the available module layout for this role.</p><div className="grid grid-cols-3 gap-2"><div className="rounded-lg border border-purple-400/20 bg-slate-950/50 p-3"><b className="block text-xl text-white">0</b><small className="text-[9px] text-purple-200">MY TASKS</small></div><div className="rounded-lg border border-purple-400/20 bg-slate-950/50 p-3"><b className="block text-xl text-white">0</b><small className="text-[9px] text-purple-200">PENDING</small></div><div className="rounded-lg border border-purple-400/20 bg-slate-950/50 p-3"><b className="block text-xl text-white">0</b><small className="text-[9px] text-purple-200">COMPLETED</small></div></div><div className="grid gap-3"><section className="rounded-lg border border-purple-400/20 p-3"><b className="text-xs text-amber-200">MY WORK QUEUE</b><p className="text-xs text-slate-300 mt-1">No assigned tasks are available in this demo workspace.</p></section><section className="rounded-lg border border-purple-400/20 p-3"><b className="text-xs text-amber-200">WORK RECORDS</b><p className="text-xs text-slate-300 mt-1">No employee records have been created or shared in this browser preview.</p></section><section className="rounded-lg border border-purple-400/20 p-3"><b className="text-xs text-amber-200">TEAM NOTICES</b><p className="text-xs text-slate-300 mt-1">There are no active team notices in this demo.</p></section></div><p className="small-caveat">DEMO ONLY · Read-only interface preview. Shared task data, staff records, and management actions require the future trusted backend.</p></div>}<p className="small-caveat mt-4">DEMO ONLY · Role permissions are browser-local and are not secure server authorization.</p></section>}

        {/* GUEST ENVIRONMENT */}
        {view === 'guest' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              {guestPage !== null && <button className="text-back" onClick={() => setGuestPage(null)}>← Guest Environment</button>}
              <span>GUEST ENVIRONMENT</span>
            </div>

            {guestPage === null && (
              <div className="guest-content-page">
                <p className="eyebrow">A GATEWAY BEYOND THE KNOWN</p>
                <h2 className="section-title">Choose the archive that calls to you.</h2>
                <p className="section-copy">Some realms reveal themselves to the curious. Others wait for those willing to ascend. Your journey begins with a choice.</p>

                {onboardingRecord && onboardingRecord.status !== 'completed' && (
                  <div className="portal-panel p-4 mt-5 border border-amber-400/40">
                    <small className="text-amber-300 font-bold tracking-widest">YOUR JOURNEY IS WAITING</small>
                    <p className="section-copy mt-2">Your onboarding progress is saved in this browser.</p>
                    {onboardingRecord.status === 'restricted' && onboardingRecord.restrictionUntil && Date.now() < onboardingRecord.restrictionUntil && <p className="text-xs text-amber-200 mt-2">Viewing-only restriction is active. You may explore the public archives while Store access and onboarding continuation remain unavailable.</p>}
                    <button className="primary-action full mt-3" onClick={startOnboarding}>Continue Your Journey</button>
                  </div>
                )}
                {onboardingRecord?.status === 'completed' && onboardingRecord.termsAccepted && (
                  <div className="portal-panel p-4 mt-5 border border-amber-400/40">
                    <small className="text-amber-300 font-bold tracking-widest">ASCENSION RECORDED</small>
                    <p className="section-copy mt-2">Your eight-step introduction is complete in this browser demo.</p>
                    <p className="text-xs text-emerald-300 mt-2">{(onboardingRecord.completedSteps ?? []).length} of 8 stages completed.</p>
                    <button className="primary-action full mt-3" onClick={handleGuestStoreAccess}>Enter the Store</button>
                  </div>
                )}

                <div className="destination-grid mt-6">
                  <article className="destination-card">
                    <span className="dest-icon">✧</span>
                    <span className="dest-desc">Across the orbital realms, every source of Stardust carries a different promise. Discover what awakens when you draw closer.</span>
                    <button type="button" className="dest-action lobby-card-action" onClick={() => setGuestPage('celestial-overview')}>CELESTIAL</button>
                  </article>
                  <article className="destination-card">
                    <span className="dest-icon">♛</span>
                    <span className="dest-desc">Behind every realm is an origin. Step into the archive of those who began the story.</span>
                    <button type="button" className="dest-action lobby-card-action" onClick={() => setGuestPage('founders')}>FOUNDER</button>
                  </article>
                </div>

                <div className="portal-panel mt-5">
                  <div className="expand-head"><span><small>THE FIRST THRESHOLD</small></span></div>
                  <div className="expand-body pt-0">
                    Before the next passage opens, learn the ways of this environment and decide when you are ready to proceed.
                    <br /><br />
                    <button className="primary-action" onClick={startOnboarding}>{onboardingRecord && onboardingRecord.status !== 'completed' ? 'Continue Your Journey' : 'ONBOARD NOW'}</button>
                  </div>
                </div>
              </div>
            )}

            {guestPage === 'celestial-overview' && (
              <div className="guest-content-page">
                <p className="eyebrow">THE CELESTIAL ARCHIVE</p>
                <h2 className="section-title">The Celestials</h2>
                <p className="section-copy">Across the dimensional network, the Celestials endure through Stardust—the essence that sustains their existence, their gifts, and the powers woven into their being. Yet no two realms shape that essence alike. What one realm restores, another may transform.</p>
                <div className="portal-panel p-4 mt-5">
                  <small className="text-amber-300 font-bold tracking-widest">THE ESSENCE OF EXISTENCE</small>
                  <p className="expand-body mt-2">Without Stardust, a Celestial may lose strength, skills, magic, and the abilities that define them. Their essence may fade until nothing remains. The origin of that Stardust matters: each realm bears its own nature.</p>
                  <p className="text-sm text-purple-200 mt-3 italic">And when a being draws near to a realm and synchronizes with its dwellers, a different kind of awakening may begin.</p>
                </div>
                <h3 className="section-title mt-6">Two paths beyond the threshold</h3>
                <div className="destination-grid">
                  <button className="destination-card" onClick={() => setGuestPage('celestial-sectors')}>
                    <span className="dest-icon">☄</span><span className="dest-title">Celestial Sectors</span>
                    <span className="dest-desc">Follow the orbital paths. Discover the dwellers, their essence, and the ascensions held within each realm.</span>
                    <span className="dest-action">Explore the sectors <b>↗</b></span>
                  </button>
                  <button className="destination-card" onClick={() => setGuestPage('draconian-overview')}>
                    <span className="dest-icon">♜</span><span className="dest-title">Draconian Archive</span>
                    <span className="dest-desc">Beyond the recognized territories lies a domain of private influence, ancient bloodlines, and sovereign privilege.</span>
                    <span className="dest-action">Approach the restricted archive <b>↗</b></span>
                  </button>
                </div>
              </div>
            )}

            {guestPage === 'celestial-sectors' && (
              <div className="guest-content-page">
                <p className="eyebrow">CELESTIAL ARCHIVE · ORBITAL INDEX</p>
                <h2 className="section-title">Where will you ascend?</h2>
                <p className="section-copy">Every passage leads to a different nature. Choose the orbit that draws you closer; beyond it, another realm is waiting.</p>
                <div className="portal-panel mt-4">
                  <button className="expand-head" onClick={() => setGuestPage('lower-orbit')}><span><small>LOWER ORBIT SECTOR</small><b>Cloud9 · Mars</b></span><span>↗</span></button>
                  <div className="expand-body pt-0">A gentler threshold, where restoration and momentum take their first form.</div>
                </div>
                <div className="portal-panel mt-3">
                  <button className="expand-head" onClick={() => setGuestPage('central-orbit')}><span><small>CENTRAL ORBIT SECTOR</small><b>Venus · Saturn</b></span><span>↗</span></button>
                  <div className="expand-body pt-0">Where refinement, synergy, and the shaping of greater builds begin to reveal themselves.</div>
                </div>
                <div className="portal-panel mt-3">
                  <button className="expand-head" onClick={() => setGuestPage('outer-orbit')}><span><small>OUTER ORBIT SECTOR</small><b>Nibiru · Nemik</b></span><span>↗</span></button>
                  <div className="expand-body pt-0">Beyond familiar limits, where endurance is tested and the unknown draws near.</div>
                </div>
              </div>
            )}

            {guestPage === 'lower-orbit' && (
              <div className="guest-content-page">
                <p className="eyebrow">LOWER ORBIT SECTOR</p><h2 className="section-title">The first awakening.</h2>
                <p className="section-copy">Some arrive seeking restoration. Others come to feel their energy return. Here, the first ascent is only the beginning.</p>
                <div className="portal-panel mt-4 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">☁️ CLOUD9 · NEW SPAWN'S AREA</small>                  <h3 className="text-lg font-bold text-amber-100 mt-2">Aelunari — The Dreamborn</h3>
                  <p className="expand-body mt-2">The Aelunari inhabit Cloud9, a tranquil pocket-realm suspended above the dimensional network. Their bodies naturally regenerate Stardust energy, making their server the preferred recovery zone for newly onboarded players and veteran players needing a quick reboost.</p>
                  <p className="text-xs text-purple-200 mt-3">Trait: Low-Latency • Recovery • Respawn<br/>Difficulty: Easy<br/>Recommended: Beginners<br/>System: Rest. Recharge. Respawn.</p>
                  <p className="text-sm italic text-amber-100 mt-3">Let your strength return. Feel the weight of the world fall away, and remember what it is to rise.</p>
                </div>
                <div className="portal-panel mt-3 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">🔴 MARS · MID-GAME RUSH</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Kaelthari — The Redborn</h3>
                  <p className="expand-body mt-2">The Kaelthari evolved beneath the crimson skies of Mars, where every encounter is built around speed, intensity, and rapid energy cycling. Their server is famous for Rush Instances—short, high-output sessions designed for players who want to rapidly refill their adrenaline meter before returning to the main queue.</p>
                  <p className="text-xs text-purple-200 mt-3">Trait: Speed • Rush • High Output<br/>Difficulty: Easy<br/>Recommended: Regular Players<br/>System: Queue fast. Burn bright. Breed faster.</p>
                  <p className="text-sm italic text-amber-100 mt-3">When stillness no longer satisfies, answer the call of the crimson rush.</p>
                </div>
              </div>
            )}

            {guestPage === 'central-orbit' && (
              <div className="guest-content-page">
                <p className="eyebrow">CENTRAL ORBIT SECTOR</p><h2 className="section-title">Refinement has its price.</h2>
                <p className="section-copy">Here, presence becomes influence. Synergy deepens, and every enhancement brings you closer to the build you were meant to command.</p>
                <div className="portal-panel mt-4 p-4">                  <small className="text-amber-300 font-bold tracking-widest">🟣 VENUS · INCUBUS' FAVORITE</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Vaelith — The Velvetborn</h3>
                  <p className="expand-body mt-2">Venusian species renowned throughout the Galactic Federation for their exceptional Charm, Synergy, and Focus stats. Their server operates like a permanent high-tier guild instance, where experienced players pursue increasingly difficult encounters and rare leaderboard achievements.</p>
                  <p className="text-xs text-purple-200 mt-3">Trait: Charm • Synergy • Elite Progression<br/>Difficulty: Mid-High<br/>Recommended: Advanced Players<br/>System: Velvet Aura. Elite Guild.</p>
                  <p className="text-sm italic text-amber-100 mt-3">Some entrances are remembered. Others leave an impression that refuses to fade.</p>
                </div>
                <div className="portal-panel mt-3 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">🪐 SATURN · THE EMPRESS BUILD</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Seraphrin — The Ringborn</h3>
                  <p className="expand-body mt-2">The Seraphrin dwell within Saturn's colossal ring system, constructing their civilization around ancient Empress Cores—legendary artifacts capable of dramatically enhancing player builds. Unlocking their server grants access to advanced Build Augmentation.</p>
                  <p className="text-xs text-purple-200 mt-3">Trait: Build Enhancement • Augmentation • Raid Preparation<br/>Difficulty: High-Advance<br/>Recommended: B ranks<br/>System: Solid built. Hard Core. Endulgement.</p>
                  <p className="text-sm italic text-amber-100 mt-3">A stronger form is not simply found. It is forged, refined, and claimed.</p>
                </div>
              </div>
            )}

            {guestPage === 'outer-orbit' && (
              <div className="guest-content-page">
                <p className="eyebrow">OUTER ORBIT SECTOR</p><h2 className="section-title">Beyond the familiar.</h2>
                <p className="section-copy">The farther you travel, the less the old rules can promise you. Only those willing to face the unknown discover what waits beyond the edge.</p>
                <div className="portal-panel mt-4 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">🌑 NIBIRU · CELESTIAL INVERTED REALM</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Nhyxari — The Starborn</h3>
                  <p className="expand-body mt-2">The Nhyxari are ancient entities who migrated through the void long before conventional star maps existed. Players who synchronize successfully with a Nhyxari can unlock powerful Vitality Buffs and temporary resistance to dimensional fatigue.</p>
                  <p className="text-xs text-purple-200 mt-3">Traits: Vitality • Endurance • Raid Boss<br/>Difficulty: Boss<br/>Recommended: A Rank<br/>System: Void Migration | Dense Cores | Dark Fantasy</p>
                  <p className="text-sm italic text-amber-100 mt-3">The void does not call everyone. Those who answer may return changed.</p>
                </div>
                <div className="portal-panel mt-3 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">⚫ NEMIK · THE ABYSSMAL ZONE</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Xyrem — The Abyssals</h3>
                  <p className="expand-body mt-2">Nobody knows where the Xyrem originated. Only fearless high-level players enter willingly. Those who survive gain access to some of the most unusual Endurance, Focus, and Limit-Break mechanics in the network.</p>
                  <p className="text-xs text-purple-200 mt-3">Traits: Abyss • Endurance • Limit Break<br/>Difficulty: ☠️ ABYSS<br/>Recommended: S rank<br/>System: Unstable Rift. Zero Rules. Overwhelming Playstyle.</p>
                  <p className="text-sm italic text-amber-100 mt-3">At the edge of every limit lies a question: how far are you willing to go?</p>
                </div>
              </div>
            )}

            {guestPage === 'draconian-overview' && (
              <div className="guest-content-page">
                <p className="eyebrow">RESTRICTED ARCHIVE · ANDROMEDA GALAXY</p>
                <h2 className="section-title">The Draconians</h2>
                <p className="section-copy">Some worlds invite exploration. Others are entered quietly, through circles where influence is inherited and access is never assumed. Beyond the recognized territories lies a private domain of prestige, sovereign bloodlines, and power held close.</p>
                <div className="portal-panel p-4 mt-5">
                  <small className="text-amber-300 font-bold tracking-widest">A PRIVATE DOMAIN</small>
                  <p className="expand-body mt-2">The Draconian territories are a separate archive from the Celestial orbital realms. Here, discretion carries weight, lineage opens doors, and every invitation implies a world few are permitted to see.</p>
                </div>
                <button className="destination-card w-full mt-4 text-left" onClick={() => setGuestPage('andromeda')}>
                  <span className="dest-icon">♛</span><span className="dest-title">Restricted Sector of Andromeda Galaxy</span>
                  <span className="dest-desc">Approach the houses of the Draconian Empire and discover the bloodlines whose names command a room before they enter it.</span>
                  <span className="dest-action">Request passage <b>↗</b></span>
                </button>
              </div>
            )}

            {guestPage === 'andromeda' && (
              <div className="guest-content-page">
                <p className="eyebrow">DRACONIAN ARCHIVE · RESTRICTED TERRITORY</p>
                <h2 className="section-title">Restricted Sector of Andromeda Galaxy</h2>
                <p className="section-copy">Beyond the public map, the old houses remain. Their power is not announced; it is understood. Enter their territory and discover what separates influence from sovereignty.</p>
                <div className="portal-panel mt-4 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">🌍 HIGHYRTS · THE DRAGONBORN</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Vhaerion — Reptalian Valkyries</h3>
                  <p className="expand-body mt-2">The Vhaerion belong to the bureaucratic houses of the Draconian Empire. They specialize in Bonding Protocols, allowing compatible players to maintain unusually high energy and synergy during extended sessions.</p>
                  <p className="text-xs text-purple-200 mt-3">Server Trait: Rapid • Elated • Ecstatic<br/>Difficulty: SS<br/>Recommended: S rank players<br/>System: Neverland Euphoria</p>
                  <p className="text-sm italic text-amber-100 mt-3">An alliance can be an advantage. A bond, in the right hands, can become an empire.</p>
                </div>
                <div className="portal-panel mt-3 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">GOD-TIER DRACONIANS</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Zhaevoryn</h3>
                  <p className="expand-body mt-2">The ruling bloodlines of the Draconian Empire. They possess extraordinary energy density, and their ancient Sovereign Protocols are considered among the most powerful unpatched abilities in the Galactic Federation.</p>
                  <p className="text-xs text-purple-200 mt-3">Server Trait: Supremacy • Sovereignty<br/>Difficulty: SSS<br/>Recommended: SS Rank players<br/>System: Ibiza Rave Ragnarok</p>
                  <p className="text-sm italic text-amber-100 mt-3">There is wealth, there is influence, and then there is the authority to define the rules.</p>
                </div>
                <p className="text-xs text-purple-300 mt-4">The exact hierarchy and placement of these Draconian groups can be refined when the remaining official lore is supplied.</p>
              </div>
            )}

            {guestPage === 'founders' && (
              <div className="guest-content-page">
                <p className="eyebrow">ORIGINS · FOUNDERS ARCHIVE</p>
                <h2 className="section-title">Those who began the story.</h2>
                <p className="section-copy">Every world has an origin. Every legacy begins with those who dared to imagine what did not yet exist. Enter the archive and meet the people behind the first chapter of CELESTIAL LOBBY.</p>
                <div className="destination-grid mt-5">
                  {[
                    { name: 'Erson', role: 'Founder', symbol: '✦' },
                    { name: 'Spencer', role: 'Founder', symbol: '✧' },
                    { name: 'Eunice', role: 'Founder', symbol: '♛' },
                    { name: 'Hono', role: 'Founder', symbol: '◇' }
                  ].map((founder) => (
                    <div className="portal-panel p-4" key={founder.name}>
                      <div className="text-3xl text-amber-200">{founder.symbol}</div>
                      <h3 className="text-lg font-bold text-amber-100 mt-2">{founder.name}</h3>
                      <p className="text-xs text-purple-200 mt-1">{founder.role}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-purple-300 mt-4">Founder biographies and individual profile details will be added when their official introductions are supplied.</p>
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
        {view === 'restriction' && <section className="animate-fadeIn"><div className="portal-topline"><span>GUEST ENVIRONMENT</span><span>VIEWING-ONLY STATUS</span></div><div className="portal-panel p-5 mt-4 space-y-3"><h2 className="section-title">Your Journey Is Temporarily Paused</h2><p className="section-copy">{restrictionReason}</p><p className="text-sm text-purple-100">A 24-hour viewing-only restriction is active. You may browse permitted public Guest Environment information, but cannot enter the Store or continue onboarding until the restriction expires.</p>{onboardingRecord?.restrictionUntil && <p className="text-xs text-amber-200">Restriction ends: {new Date(onboardingRecord.restrictionUntil).toLocaleString()}</p>}{onboardingRecord?.helpUsed ? <p className="small-caveat">Your one-time Help explanation has already been used in this browser demo.</p> : <button className="secondary-action w-full" onClick={() => { const saved = readOnboardingRecord(); if (saved && !saved.helpUsed) { persistOnboarding({ ...saved, helpUsed: true }); setShowRestrictionHelp(true); } }}>Why can't I continue? — One-time Help</button>}{showRestrictionHelp && <div className="rounded-xl border border-purple-500/30 p-3 text-xs leading-relaxed text-purple-100"><strong className="text-amber-200">Why this restriction exists</strong><p className="mt-2">The onboarding process is designed to help customers become informed buyers who understand CELESTIAL LOBBY's procedures, conditions and service guidelines before proceeding. Your previous interruption or decision was recorded as the reason for this temporary pause.</p></div>}<button className="primary-action full" onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); }}>Return to Guest Environment</button></div></section>}

        {/* STORE ACCESS GATE */}
        {view === 'store-locked' && <section className="animate-fadeIn"><div className="portal-topline"><button className="text-back" onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); }}>← Guest Environment</button><span>STORE ACCESS</span></div><div className="portal-panel p-5 mt-4"><h2 className="section-title">Guest Store Access Not Yet Available</h2><p className="section-copy">Complete the onboarding journey and accept the CELESTIAL LOBBY Terms and Policies before entering the Guest Store.</p><button className="primary-action full" onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); }}>Return to Guest Environment</button></div></section>}

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
                <p>2. No Access ID or Access Code has been generated or saved.</p>
                <p>3. No Regular Client Dashboard account has been created or approved.</p>
                <p>4. Account eligibility, restrictions, and access permissions will be configured later by the owner.</p>
                <p>5. You can return to the Guest Environment to explore its public information.</p>
              </div>
              <button className="primary-action full mt-5" onClick={() => { setGuestPage(null); setView('guest'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Return to Guest Environment
              </button>
              <p className="small-caveat text-center">Store and client-account permissions are not being granted by this confirmation.</p>
            </div>
          </section>
        )}

        {/* SCREEN 1 · ENVIRONMENT PREFIX ROUTING */}
        {view === 'environment-gate' && (
          <section className="animate-fadeIn client-access-screen"><div className="portal-panel gate-panel client-access-card">
            <div className="client-access-heading"><span className="eyebrow">CELESTIAL LOBBY · ACCESS GATE</span><h2 className="section-title">ENVIRONMENT VERIFICATION</h2><p className="section-copy">Enter your complete Access Code. Its registered prefix identifies the environment you are trying to reach.</p></div>
            <div className="client-access-fields"><label>ACCESS CODE<input value={environmentAccessCode} onChange={event => { setEnvironmentAccessCode(event.target.value.toUpperCase()); setEnvironmentRouteMessage(''); }} placeholder="Enter your Access Code" autoComplete="off" spellCheck={false} /></label></div>
            <button type="button" className="primary-action full client-access-verify" onClick={handleEnvironmentRouting}>IDENTIFY ENVIRONMENT</button>
            {environmentRouteMessage && <p className="form-message" role="alert">{environmentRouteMessage}</p>}
            <p className="small-caveat client-access-note">No Access ID is requested on this screen. A matching prefix only selects the destination. Your individual credentials must still be verified at the next sign-in stage.</p>
            <div className="client-access-guest"><button type="button" className="text-link" onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); }}>JOIN IN / ACCESS</button><span>Continue directly to the Guest Environment.</span></div>
            <button type="button" className="text-link mt-3" onClick={() => { setInvitationInput(''); setInvitationMessage(''); setView('invitation-gate'); }}>BETA INVITATION VERIFICATION</button>
            <p className="small-caveat">DEMO ONLY · Prefix registry is stored in this browser and is not secure authentication.</p>
          </div></section>
        )}

        {/* ROUTED DESTINATION · PREFIX IS NOT AUTHENTICATION */}
        {view === 'environment-route' && routedEnvironment && (
          <section className="animate-fadeIn client-access-screen"><div className="portal-panel gate-panel client-access-card">
            <div className="client-access-heading"><span className="eyebrow">DESTINATION IDENTIFIED</span><h2 className="section-title">{ENVIRONMENT_LABELS[routedEnvironment]}</h2><p className="section-copy">Your Access Code prefix points to this environment.</p></div>
            <div className="portal-panel p-4 mt-4"><b className="text-amber-200">NEXT: INDIVIDUAL SIGN-IN</b><p className="expand-body mt-2">The next stage must verify your Access ID and the credential assigned to this environment. Prefix recognition alone does not grant access.</p></div>
            <p className="form-message mt-3" role="status">{environmentRouteMessage}</p>
            <p className="small-caveat">{routedEnvironment === 'owner' ? 'Owner sign-in is not connected yet. The browser-only Owner Preview is not a secure substitute.' : 'This environment has been identified, but its individual sign-in flow has not been connected yet.'}</p>
            <button type="button" className="secondary-action full mt-4" onClick={() => { setEnvironmentAccessCode(''); setEnvironmentRouteMessage(''); setRoutedEnvironment(null); setView('environment-gate'); }}>BACK TO ACCESS GATE</button>
            <button type="button" className="text-link mt-3" onClick={() => setView('landing')}>RETURN TO LOBBY</button>
          </div></section>
        )}

        {/* SCREEN 1 · BETA INVITATION VERIFICATION (SEPARATE FROM ROUTING) */}
        {view === 'invitation-gate' && (
          <section className="animate-fadeIn client-access-screen"><div className="portal-panel gate-panel client-access-card">
            <div className="client-access-heading"><span className="eyebrow">CELESTIAL LOBBY · BETA ACCESS</span><h2 className="section-title">INVITATION VERIFICATION</h2><p className="section-copy">Enter the invitation code assigned to your beta account.</p></div>
            <div className="client-access-fields"><label>INVITATION CODE<input value={invitationInput} onChange={event => setInvitationInput(event.target.value.toUpperCase())} placeholder="Enter your invitation code" autoComplete="off" spellCheck={false} disabled={invitationAttempts >= 3} /></label></div>
            <button type="button" className="primary-action full client-access-verify" onClick={handleVerifyInvitation} disabled={invitationAttempts >= 3}>SUBMIT</button>
            {invitationMessage && <p className="form-message" role="alert">{invitationMessage}</p>}
            <p className="small-caveat client-access-note">{invitationAttempts >= 3 ? 'This browser has been locked after three unsuccessful attempts.' : `${3-invitationAttempts} attempts available.`} Invitation verification is separate from your Access ID and Access Code or Access Code.</p>
            <div className="client-access-guest"><button type="button" className="text-link" onClick={() => { setActiveEnvironment('guest'); setGuestPage(null); setView('guest'); }}>Join In / Access</button><span>Continue directly to the Guest Environment.</span></div>
            <p className="small-caveat">DEMO ONLY · Browser-local validation · Not secure for real customer data.</p>
          </div></section>
        )}

        {/* SCREEN 2 · SIGN-IN */}
        {view === 'regular-gate' && (
          <section className="animate-fadeIn client-access-screen">
            <div className="portal-panel gate-panel client-access-card">
              <div className="client-access-heading">
                <span className="eyebrow">CELESTIAL LOBBY</span>
                <h2 className="section-title">ENTRANCE TO THE LOBBY</h2>
                <p className="section-copy">Enter your access credentials to continue.</p>
              </div>

              <div className="client-access-fields">
                <label className="sr-only" htmlFor="regular-client-access-id">Access ID</label>
                <input
                  id="regular-client-access-id"
                  value={accessIdInput}
                  onChange={(e) => setAccessIdInput(e.target.value)}
                  placeholder="Enter your Access ID"
                  aria-label="Access ID"
                  autoComplete="off"
                  spellCheck="false"
                />

                <label className="sr-only" htmlFor="regular-client-agp-code">Access Code</label>
                <input
                  id="regular-client-agp-code"
                  value={apgInput}
                  onChange={(e) => setApgInput(e.target.value)}                  placeholder="Enter your Access Code"
                  aria-label="Access Code"
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>

              <button className="primary-action full client-access-verify" onClick={handleVerifyAccess}>
                ENTER
              </button>

              {gateMessage && (
                <p
                  className="form-message font-medium"
                  style={{ color: gateMessage.success ? '#a8d8b0' : '#e8b6a3' }}
                >
                  {gateMessage.text}
                </p>
              )}
              <div className="client-access-divider">
                <span>OR</span>
              </div>

              <div className="client-access-guest">
                <p>New to CELESTIAL LOBBY?</p>
                <button
                  type="button"
                  className="secondary-action full"
                  onClick={() => {
                    setActiveEnvironment('guest');
                    setGuestPage(null);
                    setView('guest');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  GUEST ENTRANCE
                </button>
                <span>Explore the Guest Environment without a client account.</span>
              </div>

            </div>
          </section>
        )}

        {/* REGULAR HOME (DASHBOARD) */}
        {view === 'regular-home' && (gatewaySession?.role === 'client' || ownerSessionUntil > Date.now()) && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back flex items-center gap-1" onClick={() => gatewaySession?.role === 'client' ? lockSwitchAccess() : setView('landing')}>
                {gatewaySession?.role === 'client' ? '← Lock / Switch Access' : '← Lobby'}
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
              <button className="text-back" onClick={() => gatewaySession?.role === 'client' ? lockSwitchAccess() : setView('landing')}>
                {gatewaySession?.role === 'client' ? 'Lock / Switch Access' : 'Return to Lobby'}
              </button>
            </div>
          </section>
        )}
        {/* SHARED HEADER NAVIGATION PAGES */}
        {view === 'about' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline"><button className="text-back" onClick={navigateEnvironmentHome}>← Home</button><span>CELESTIAL LOBBY</span></div>
            <p className="eyebrow">OUR STORY</p><h2 className="section-title">About Us</h2>
            <p className="section-copy">CELESTIAL LOBBY is a private client environment designed to guide visitors through its archives, onboarding journey, and storefront experience.</p>
            <div className="portal-panel p-4 mt-4"><p className="expand-body">Explore the Celestials, meet the Founders, and learn about the standards that shape the experience. This portal is currently a demonstration; operational features are introduced only when implemented and tested.</p></div>
          </section>
        )}
        {view === 'no-nos' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline"><button className="text-back" onClick={navigateEnvironmentHome}>← Home</button><span>IMPORTANT REMINDERS</span></div>
            <p className="eyebrow">FIVE NON-NEGOTIABLES</p><h2 className="section-title">The No-Nos</h2>
            <div className="destination-grid mt-4">
              {['NO COD','NO MEET UPS','NO REFUNDS','NO RUSH ORDERS','NO SPAMMING'].map(item => <div className="portal-panel p-4" key={item}><b className="text-amber-200 tracking-wider">{item}</b></div>)}
            </div>
            <p className="small-caveat mt-4">Please review the full Store Policies and Service Guidelines before proceeding with an order.</p>
          </section>
        )}
        {view === 'faqs' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline"><button className="text-back" onClick={navigateEnvironmentHome}>← Home</button><span>HELP ARCHIVE</span></div>
            <p className="eyebrow">FIND YOUR ANSWER</p><h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-copy">Choose a topic to review the guidance currently available in this demo.</p>
            <div className="destination-grid mt-4">
              {['About Us','Orders & Processing','Products & Availability','Pricing & Payments','Packaging','Delivery & Fulfillment','Customer Support'].map(item => <div className="portal-panel p-4" key={item}><b className="text-amber-200">{item}</b><p className="expand-body mt-2">Detailed answers for this category are being prepared for publication.</p></div>)}
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
            <div className="portal-topline">              <button className="text-back" onClick={() => setView('landing')}>← Homepage</button>
              <span>CELESTIAL LOBBY</span>
            </div>
            <h2 className="section-title">Data and Privacy</h2>
            <p className="section-copy">Information about data handling, privacy practices, and client information will be provided on this page.</p>
            <div className="portal-panel p-4"><p className="expand-body">Data and Privacy content is pending publication.</p></div>
          </section>
        )}


        {view === 'three-s' && (
          <section className="guest-content-page animate-fadeIn three-s-page" aria-labelledby="three-s-title">
            <div className="portal-topline">
              <button className="text-back" onClick={() => setView('landing')}>← Homepage</button>
              <span>OUR STANDARDS</span>
            </div>

            <div className="three-s-intro">              <p className="eyebrow">CELESTIAL LOBBY · CLIENT COMMITMENT</p>
              <h2 id="three-s-title" className="section-title">The 3S Framework</h2>
              <p className="three-s-lead">Three principles. One standard of care.</p>
              <p className="section-copy">Security, Secrecy and Safety guide how we approach information, account access and order handling across the Celestial Lobby experience.</p>
            </div>

            <figure className="three-s-feature">
              <img
                src={`data:image/webp;base64,${hoenoPosterBase64.trim()}`}
                alt="Hoeno founder portrait with the words Secretive. Secured. Safe."
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                <span>HOENO · FOUNDER</span>
                <strong>SECRETIVE. SECURED. SAFE.</strong>
              </figcaption>
            </figure>

            <div className="three-s-pillar-grid" aria-label="The three operational pillars">
              <div className="portal-panel three-s-pillar"><span aria-hidden="true">◈</span><b>SECURITY</b><small>Identity & access</small></div>
              <div className="portal-panel three-s-pillar"><span aria-hidden="true">◉</span><b>SECRECY</b><small>Privacy & discretion</small></div>
              <div className="portal-panel three-s-pillar"><span aria-hidden="true">⬡</span><b>SAFETY</b><small>Handling integrity</small></div>
            </div>

            <div className="three-s-section-heading">
              <div><h3>Explore the standards</h3><p>Open each pillar to read its commitments.</p></div>
              <button type="button" className="text-link whitespace-nowrap" onClick={() => setAllThreeS(!allThreeSOpen)}>{allThreeSOpen ? 'Hide all details' : 'Expand all'}</button>
            </div>

            <div className="three-s-accordions">
              <section className="portal-panel three-s-accordion">
                <button type="button" className="expand-head w-full" aria-expanded={threeSOpen.security} aria-controls="three-s-security" onClick={() => setThreeSOpen(v => ({ ...v, security: !v.security }))}>
                  <span><small>01 · SYSTEM & IDENTITY PROTECTION</small><b>SECURITY</b><em>Protecting accounts, identifiers and access.</em></span>
                  <span className="three-s-toggle" aria-hidden="true">{threeSOpen.security ? '−' : '+'}</span>
                </button>
                {threeSOpen.security && <div id="three-s-security" className="expand-body">
                  <p className="mb-3">We design access and information-handling practices to reduce unnecessary exposure and help protect client interactions.</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><b>Unique Identification:</b> Assigned client identifiers can reduce the need to display personal details in routine operational workflows.</li>
                    <li><b>Role-Based Access:</b> Access is intended to be limited according to each team member's responsibilities and authorization.</li>
                    <li><b>Communication Protection:</b> We will use the protections supported by the platform and designated communication services. End-to-end encryption will only be claimed for channels where it is actually enabled and verified.</li>
                  </ul>
                </div>}
              </section>

              <section className="portal-panel three-s-accordion">
                <button type="button" className="expand-head w-full" aria-expanded={threeSOpen.secrecy} aria-controls="three-s-secrecy" onClick={() => setThreeSOpen(v => ({ ...v, secrecy: !v.secrecy }))}>
                  <span><small>02 · DISCRETION & INFORMATION PRIVACY</small><b>SECRECY</b><em>Minimizing collection and limiting exposure.</em></span>
                  <span className="three-s-toggle" aria-hidden="true">{threeSOpen.secrecy ? '−' : '+'}</span>
                </button>
                {threeSOpen.secrecy && <div id="three-s-secrecy" className="expand-body">
                  <p className="mb-3">Our direction is to collect as little identifying information as the service can reasonably operate without. No system should ask for details merely because a field is available.</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><b>Data Minimization:</b> We will avoid requesting unnecessary personal details. Before a client submits information, the interface should explain what is requested and why.</li>
                    <li><b>Need-to-Know:</b> Operational information should only be visible to people who need it to perform an authorized task.</li>
                    <li><b>Metadata Protection:</b> Metadata and attachment sanitization are planned controls for a later implementation phase; they are not represented as active protections yet.</li>
                    <li><b>Retention & Deletion:</b> A written retention schedule and deletion process—including backup expiry—must be established and tested before we promise automatic deletion.</li>
                    <li><b>Limited Backups:</b> Any retained backup information must be minimized, protected with strong encryption and access controls, and governed by a documented restoration and expiry process.</li>
                  </ul>
                  <p className="small-caveat mt-3">Absolute anonymity and a zero digital footprint cannot be guaranteed. Networks, devices, hosting providers and payment or delivery services may create records outside the portal's control.</p>
                </div>}
              </section>

              <section className="portal-panel three-s-accordion">
                <button type="button" className="expand-head w-full" aria-expanded={threeSOpen.safety} aria-controls="three-s-safety" onClick={() => setThreeSOpen(v => ({ ...v, safety: !v.safety }))}>
                  <span><small>03 · FULFILLMENT & HANDLING INTEGRITY</small><b>SAFETY</b><em>Verification, packaging and careful handoff.</em></span>
                  <span className="three-s-toggle" aria-hidden="true">{threeSOpen.safety ? '−' : '+'}</span>
                </button>
                {threeSOpen.safety && <div id="three-s-safety" className="expand-body">
                  <p className="mb-3">We follow practical checks intended to reduce handling mistakes and protect order integrity throughout fulfillment.</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><b>Verification Standards:</b> Items are checked for structural integrity and relevant weight or specification accuracy before packaging.</li>
                    <li><b>Discreet Packaging:</b> Unbranded, tamper-evident packaging will be used where available and appropriate.</li>
                    <li><b>Verified Handoff:</b> Delivery handoffs follow defined verification steps appropriate to the fulfillment method.</li>
                  </ul>
                  <p className="small-caveat mt-3">Verification procedures reduce risk; they cannot make handling errors or delivery issues impossible.</p>
                </div>}
              </section>
            </div>

            <div className="portal-panel three-s-guarantee">
              <p className="eyebrow">THE STANDARD WE WORK TOWARD</p>
              <h3>The 3S Commitment</h3>
              <div className="three-s-guarantee-row"><b>Security</b><span>Thoughtful identity, account and access safeguards.</span></div>
              <div className="three-s-guarantee-row"><b>Secrecy</b><span>Minimal collection, limited access and responsible data lifecycle controls.</span></div>
              <div className="three-s-guarantee-row"><b>Safety</b><span>Consistent verification and careful fulfillment practices.</span></div>
            </div>

            <p className="small-caveat three-s-disclaimer">This page explains our operating principles and planned safeguards. A feature is not considered active until it has been implemented and tested. We do not promise absolute anonymity, guaranteed deletion, or zero handling errors.</p>
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

      {view !== 'landing' && view !== 'regular-gate' && view !== 'invitation-gate' && (
      <>
      {/* Footer */}
      <footer className="portal-footer" aria-label="Site navigation and legal links">
        <div className="portal-footer-navigation"><button type="button" className="portal-footer-link" onClick={navigateEnvironmentHome}>HOME</button><i aria-hidden="true">·</i><button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('about')}>ABOUT</button><i aria-hidden="true">·</i><button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('faqs')}>FAQS</button><i aria-hidden="true">·</i><button type="button" className="portal-footer-link" onClick={onEnterStore}>STORE</button><i aria-hidden="true">·</i><button type="button" className="portal-footer-link" onClick={() => { setActiveHomePanel('tracker'); handleChromeNavigation('regular-home'); }}>ORDER TRACKER</button></div>
        <div className="portal-footer-navigation"><button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('terms')}>TERMS</button><i aria-hidden="true">·</i><button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('privacy')}>PRIVACY</button><i aria-hidden="true">·</i><button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('info-sec')}>INFO SEC</button></div>
      </footer>
      </>
      )}
      <div className={`demo-disclaimer ${view === 'onboarding' || view === 'onboarding-terms' || (view === 'regular-gate' || view === 'invitation-gate') ? 'hidden' : ''}`}>
        
      </div>

    </div>
  );
};