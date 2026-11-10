import React, { useEffect, useState } from 'react';
import hoenoPosterBase64 from '../assets/hoeno-3s.webp.b64?raw';
import { ONBOARDING_STEPS } from '../catalog';
import { ActiveOrder, DeliveryDetails, DemoAccessCredentials } from '../types';
import { OrderTimeline } from './OrderTimeline';

interface PortalProps {
  initialView?: 'landing' | 'owner-preview' | 'guest' | 'regular-home' | 'regular-gate' | 'terms' | 'privacy' | 'info-sec' | 'three-s' | 'contact';
  onOwnerSessionChange?: (active: boolean) => void;
  onEnterStore: () => void;
  activeOrder: ActiveOrder;
  deliveryDetails?: DeliveryDetails;
  onUpdateStatus?: (newStatus: ActiveOrder['status']) => void;
}

type PortalView = 'landing' | 'environment-gate' | 'environment-route' | 'invitation-gate' | 'owner-preview' | 'guest' | 'onboarding' | 'onboarding-terms' | 'restriction' | 'store-locked' | 'onboarding-submitted' | 'regular-gate' | 'regular-home' | 'about' | 'no-nos' | 'faqs' | 'terms' | 'privacy' | 'info-sec' | 'three-s' | 'contact';

type OnboardingRecord = { status: 'in-progress' | 'restricted' | 'completed'; step: number; startedAt: number; restrictionUntil: number | null; restrictionReason: string; termsAccepted: boolean; helpUsed: boolean; completedSteps?: number[]; purchaseWindowStartedAt?: number | null; purchaseWindowOrderPlacedAt?: number | null; };
const ONBOARDING_STORAGE_KEY = 'CL_GUEST_ONBOARDING_V1';
const ONBOARDING_TIMEOUT_MS = 30 * 60 * 1000;
const RESTRICTION_MS = 24 * 60 * 60 * 1000;
const OWNER_SESSION_KEY = 'CL_OWNER_BROWSER_SESSION_V1';
const OWNER_SESSION_MS = 24 * 60 * 60 * 1000;
const INVITATION_STORAGE_KEY = 'CL_BETA_INVITATIONS_V1';
const INVITATION_ATTEMPTS_KEY = 'CL_INVITATION_ATTEMPTS_V1';
type InvitationSlot = { slot: number; invitationCode: string; accessId: string };
type EnvironmentKey = 'owner' | 'army-owner' | 'army-member' | 'regular-client';
type EnvironmentRegistryEntry = { environment: EnvironmentKey; prefix: string };
const ENVIRONMENT_LABELS: Record<EnvironmentKey, string> = { owner: 'CELESTIAL LOBBY OWNER', 'army-owner': 'CELESTIAL ARMY OWNER', 'army-member': 'CELESTIAL ARMY MEMBER', 'regular-client': 'REGULAR CLIENT' };
const readOwnerSession = (): number => { try { const expiresAt = Number(localStorage.getItem(OWNER_SESSION_KEY) || 0); return expiresAt > Date.now() ? expiresAt : 0; } catch { return 0; } };
const readOnboardingRecord = (): OnboardingRecord | null => { try { const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY); if (!raw) return null; const parsed = JSON.parse(raw) as OnboardingRecord; const legacyCompleted = parsed.status === 'completed' ? Array.from({ length: 8 }, (_, index) => index) : Array.from({ length: Math.max(0, Math.min(8, parsed.step || 0)) }, (_, index) => index); return { ...parsed, completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : legacyCompleted, purchaseWindowStartedAt: parsed.purchaseWindowStartedAt ?? null, purchaseWindowOrderPlacedAt: parsed.purchaseWindowOrderPlacedAt ?? null }; } catch { return null; } };
type GuestPage = 'home' | 'celestial-overview' | 'celestial-sectors' | 'lower-orbit' | 'central-orbit' | 'outer-orbit' | 'draconian-overview' | 'andromeda' | 'founders';

export const Portal: React.FC<PortalProps> = ({
  initialView = 'landing',
  onEnterStore,
  onOwnerSessionChange,
  activeOrder,
  deliveryDetails,
  onUpdateStatus
}) => {
  const [view, setView] = useState<PortalView>(initialView);
  const [ownerSessionUntil, setOwnerSessionUntil] = useState<number>(() => readOwnerSession());
  const [ownerTriggerTaps, setOwnerTriggerTaps] = useState(0);
  const [showOwnerAccessField, setShowOwnerAccessField] = useState(false);
  const [ownerAccessPhrase, setOwnerAccessPhrase] = useState('');
  const [ownerAccessMessage, setOwnerAccessMessage] = useState('');
  const [ownerNotepad, setOwnerNotepad] = useState(() => { try { return localStorage.getItem('CL_OWNER_NOTEPAD_V1') || ''; } catch { return ''; } });
  const [showFloatingNotepad, setShowFloatingNotepad] = useState(false);
  const [showOwnerTools, setShowOwnerTools] = useState(false);
  const [guestPage, setGuestPage] = useState<GuestPage>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeEnvironment, setActiveEnvironment] = useState<'guest' | 'regular'>(() => initialView === 'regular-home' || initialView === 'regular-gate' ? 'regular' : 'guest');
  const navigateEnvironmentHome = () => { if (activeEnvironment === 'regular') { setView('regular-home'); } else { setGuestPage('home'); setView('guest'); } window.scrollTo({ top: 0, behavior: 'smooth' }); };
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
    setOwnerAccessPhrase('');
    setOwnerAccessMessage('');
    setShowOwnerAccessField(true);
  };

  const [voiceAccessListening, setVoiceAccessListening] = useState(false);

  const startVoiceOwnerAccess = () => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setOwnerAccessMessage('Voice recognition is not supported in this browser. Please use the password field instead.');
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
      const expected = 'AVISALA ESHMA';
      if (transcript === expected) {
        setOwnerAccessMessage('Voice phrase recognized. Opening Owner Preview…');
        setVoiceAccessListening(false);
        recognition.stop();
        enterOwnerOverride();
      } else {
        setVoiceAccessListening(false);
        setOwnerAccessMessage('Voice phrase was not recognized exactly. Please try again or enter the password manually.');
      }
    };
    recognition.onerror = (event: any) => {
      setVoiceAccessListening(false);
      setOwnerAccessMessage(event.error === 'not-allowed'
        ? 'Microphone permission was denied. Allow microphone access or enter the password manually.'
        : 'Voice recognition could not complete. Please try again or enter the password manually.');
    };
    recognition.onend = () => setVoiceAccessListening(false);
    try {
      recognition.start();
    } catch {
      setVoiceAccessListening(false);
      setOwnerAccessMessage('Voice recognition could not start. Please try again or enter the password manually.');
    }
  };

  const handleOwnerAccessSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ownerAccessPhrase.trim().toUpperCase().replace(/\s+/g, ' ') !== 'AVISALA ESHMA') {
      setOwnerAccessMessage('Access phrase not recognized. Please try again.');
      return;
    }
    setShowOwnerAccessField(false);
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
    setGuestPage('home');
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
    let creds: DemoAccessCredentials | null = null;

    try {
      const saved = localStorage.getItem('CL_DEMO_ACCESS');
      if (saved) creds = JSON.parse(saved);
    } catch {
      // ignore
    }

    let activeInvitation = '';
    try { activeInvitation = sessionStorage.getItem('CL_ACTIVE_INVITATION_V1') || ''; } catch { /* best effort */ }
    const assignedInvitation = invitationSlots.find(slot => slot.invitationCode === activeInvitation);
    if (assignedInvitation && assignedInvitation.accessId === a && creds && a === creds.accessId && p === creds.apg) {
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
    <div className={`portal-shell min-h-screen flex flex-col justify-between ${(['regular-gate', 'invitation-gate', 'environment-gate', 'environment-route'].includes(view)) ? 'client-access-gate' : ''}`} data-page={view}>
      {view !== 'landing' && view !== 'regular-gate' && view !== 'invitation-gate' && view !== 'environment-gate' && view !== 'environment-route' && (
      <>
      {/* Top Header */}
      <header className="portal-header">
        <div className="portal-brand cursor-pointer" role="button" tabIndex={0} aria-label="CELESTIAL LOBBY home" onClick={navigateEnvironmentHome} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigateEnvironmentHome(); } }}>
          <div className="brand-name">CELESTIAL LOBBY</div>
        </div>
        <button type="button" className="lobby-menu-trigger" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><span aria-hidden="true">☰</span></button>
        {menuOpen && <><button type="button" className="lobby-menu-backdrop" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} /><nav className="lobby-menu-drawer" aria-label="Main navigation">
          <button onClick={() => { navigateEnvironmentHome(); setMenuOpen(false); }}>HOME</button>
          <button onClick={() => { handleChromeNavigation('about'); setMenuOpen(false); }}>ABOUT US</button>
          <button onClick={() => { handleChromeNavigation('three-s'); setMenuOpen(false); }}>3-S</button>
          <button onClick={() => { handleChromeNavigation('no-nos'); setMenuOpen(false); }}>NO-NOS</button>
          <button onClick={() => { handleChromeNavigation('faqs'); setMenuOpen(false); }}>FAQS</button>
          <button onClick={() => { onEnterStore(); setMenuOpen(false); }}>STORE</button>
          <button onClick={() => { setActiveHomePanel('tracker'); setView('regular-home'); setMenuOpen(false); }}>TRACK</button>
        </nav></>}
      </header>
      </>
      )}

      {/* Main Views Container */}
      <main className="portal-main flex-grow">
        {/* OWNER OVERRIDE / BROWSER-LOCAL PREVIEW */}
        {view === 'owner-preview' && (
          <section className="guest-content-page animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back" onClick={() => setView('landing')}>← Lobby</button>
              <span>OWNER OVERRIDE · PRIVATE PREVIEW</span>
            </div>
            <p className="eyebrow">AUTHORIZED BROWSER SESSION</p>
            <h2 className="section-title">Welcome, Commander.</h2>
            <p className="section-copy">Owner Preview is active in this browser. This workspace is reserved for previewing and testing the portal experience.</p>
            <div className="portal-panel p-4 mt-5">
              <small className="text-amber-300 font-bold tracking-widest">SESSION STATUS</small>
              <p className="expand-body mt-2">This browser remembers Owner access until:</p>
              <p className="text-sm text-amber-200 font-semibold mt-2">{ownerSessionUntil ? new Date(ownerSessionUntil).toLocaleString() : 'No active session'}</p>
              <p className="text-xs text-purple-200 mt-3">Access is stored locally in this browser for up to 24 hours. Another browser or device will not have this saved session. A network change will not automatically trigger re-login in this local-only setup.</p>
            </div>
            <div className="portal-panel p-4 mt-4">
              <small className="text-amber-300 font-bold tracking-widest">PREVIEW WORKSPACE</small>
              <h3 className="section-title mt-2">Simulation environment</h3>
              <p className="section-copy">Inspect the pages and navigation currently implemented in this website. Business dashboards and live management controls are not yet connected. Preview-only changes must not be treated as live business records.</p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button className="primary-action" onClick={() => { setActiveEnvironment('guest'); setView('guest'); setGuestPage('home'); }}>Open Guest Environment</button>
                <button className="secondary-action" onClick={() => { setActiveEnvironment('regular'); setView('regular-home'); }}>Regular Client Preview</button>
                <button className="text-back" onClick={exitOwnerOverride}>Exit Owner Override</button>
              </div>
            </div>
            <div className="portal-panel p-4 mt-4">
              <small className="text-amber-300 font-bold tracking-widest">BETA INVITATION CODE MANAGER</small>
              <h3 className="section-title mt-2">Screen 1 · 20 individual invitations</h3>
              <p className="section-copy">Generate a separate batch of 20 invitation codes. Assign each slot to the matching beta user's Access ID. These invitation codes are not the user's Access Code or AGP Code.</p>
              <button type="button" className="primary-action mt-3" onClick={generateInvitationBatch}>Generate 20 Invitation Codes</button>
              {invitationMessage && <p className="form-message mt-3" role="status">{invitationMessage}</p>}
              {invitationSlots.length > 0 && <div className="mt-4 space-y-2">{invitationSlots.map(slot => <div key={slot.slot} className="rounded-lg border border-purple-400/20 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-2"><b className="text-amber-200 text-xs">BETA USER {String(slot.slot).padStart(2,'0')}</b><code className="text-xs text-emerald-200">{slot.invitationCode}</code></div><label className="block mt-2 text-[10px] text-purple-200">ASSIGNED ACCESS ID<input className="mt-1 w-full rounded-lg border border-purple-400/30 bg-slate-900 p-2 text-sm text-white" value={slot.accessId} onChange={event => updateInvitationAccessId(slot.slot,event.target.value)} placeholder="Assign this beta user's Access ID" /></label></div>)}</div>}
              <p className="small-caveat mt-3">DEMO ONLY. Codes and assignments are stored in this browser's local storage. They are not centrally issued, secure, or available on another device. Generating a new batch replaces the previous local batch.</p>
            </div>
            <div className="portal-panel p-4 mt-4">
              <small className="text-amber-300 font-bold tracking-widest">ENVIRONMENT PREFIX REGISTRY</small>
              <h3 className="section-title mt-2">Owner environment · First entry</h3>
              <p className="section-copy">Set the 2- or 3-character prefix that identifies Owner environment access codes at Screen 1. This prefix identifies the destination only. It does not authenticate an Owner or create a working access code.</p>
              <label className="block mt-3 text-xs text-purple-200" htmlFor="owner-environment-prefix">OWNER PREFIX
                <input id="owner-environment-prefix" className="mt-1 w-full rounded-lg border border-purple-400/30 bg-slate-900 p-3 text-sm text-white uppercase" maxLength={3} value={ownerEnvironmentPrefix} onChange={event => { setOwnerEnvironmentPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,3)); setOwnerPrefixMessage(''); }} placeholder="Enter 2 or 3 characters" autoComplete="off" />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="primary-action" onClick={saveOwnerEnvironmentPrefix}>Save Owner Prefix</button>
                <span className="text-xs text-amber-200">{ownerEnvironmentPrefix ? `Current prefix: ${ownerEnvironmentPrefix}` : 'No Owner prefix assigned yet'}</span>
              </div>
              {ownerPrefixMessage && <p className="form-message mt-3" role="status">{ownerPrefixMessage}</p>}
              <p className="small-caveat mt-3">DEMO ONLY · Saved in this browser. Prefixes for Celestial Army, Sales, Admin, and other environments will be added later. The production version must validate the complete code on a trusted backend, not by prefix alone.</p>
            </div>
            <div className="portal-panel p-4 mt-4">
              <small className="text-amber-300 font-bold tracking-widest">OWNER NOTEPAD</small>
              <h3 className="section-title mt-2">Private working notes</h3>
              <p className="section-copy">Notes are saved in this browser only. Do not enter passwords, payment details, customer data, or other sensitive information.</p>
              <textarea className="w-full mt-3 rounded-lg border border-purple-400/30 bg-slate-950/70 p-3 text-sm text-slate-100 min-h-40" rows={7} value={ownerNotepad} onChange={(event) => handleOwnerNotepadChange(event.target.value)} placeholder="Write development notes, page corrections, test ideas, and reminders..." aria-label="Owner notepad" />
              <p className="small-caveat">Saved locally in this browser profile. Clearing browser data may erase these notes.</p>
            </div>
            <p className="text-xs text-amber-200/80 mt-4">LOCAL BROWSER ACCESS ONLY · Not server-verified authentication. Anyone with access to this browser profile can open this preview.</p>
          </section>
        )}

        {/* SCREEN 1 · MAIN ENTRANCE / SENTINEL / SECURITY GUARDIAN */}
        {view === 'landing' && (
          <section className="min-h-[calc(100svh-2rem)] flex flex-col items-center justify-center px-5 py-10 text-center animate-fadeIn">
            <button type="button" aria-label="Sentinel emblem. Tap five times for hidden Owner access." onClick={() => { const next = ownerTriggerTaps + 1; setOwnerTriggerTaps(next >= 5 ? 0 : next); if (next >= 5) { setShowOwnerAccessField(true); setOwnerAccessMessage(''); } }} className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/70 bg-slate-900/80 shadow-[0_0_45px_rgba(59,130,246,0.22)]">
              <span className="text-5xl text-amber-200" aria-hidden="true">✦</span>
            </button>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.38em] text-amber-200">CELESTIAL LOBBY · ACCESS CONTROL</p>
            <h1 className="mb-3 text-3xl font-semibold tracking-[0.16em] text-white sm:text-4xl">MAIN ENTRANCE</h1>
            <div className="mb-6 h-px w-24 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-sky-200">SENTINEL · SECURITY GUARDIAN</p>
            <p className="mt-8 max-w-sm text-sm leading-7 text-slate-300">Sentinel is the entry guardian. Choose Client / Team Access to identify your authorized environment, or continue through the guest option on the access gate.</p>
            <button type="button" className="primary-action mt-8 min-h-14 w-full max-w-sm tracking-[0.18em]" onClick={() => { setEnvironmentAccessCode(''); setEnvironmentRouteMessage(''); setRoutedEnvironment(null); setView('environment-gate'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              CLIENT / TEAM ACCESS <span aria-hidden="true">↗</span>
            </button>
            <p className="mt-8 text-[10px] uppercase tracking-[0.25em] text-slate-500">CELESTIAL LOBBY · PRIVATE ACCESS</p>
            {showOwnerAccessField && (
              <div className="portal-panel mt-6 w-full max-w-sm p-4 text-left" role="region" aria-label="Owner access">
                <small className="font-bold tracking-widest text-amber-300">RESTRICTED OWNER ACCESS</small>
                {ownerSessionUntil > Date.now() ? (
                  <>
                    <p className="section-copy mt-2">Your Owner session is remembered on this browser.</p>
                    <button className="primary-action mt-3" onClick={activateOwnerTrigger}>Resume Owner Preview</button>
                  </>
                ) : (
                  <form className="gate-panel mt-3 p-0" onSubmit={handleOwnerAccessSubmit}>
                    <label htmlFor="owner-access-phrase">ENTER OWNER ACCESS PHRASE
                      <input id="owner-access-phrase" type="password" autoComplete="off" required value={ownerAccessPhrase} onChange={(event) => setOwnerAccessPhrase(event.target.value)} placeholder="Enter access phrase" />
                    </label>
                    {ownerAccessMessage && <p className="form-message text-rose-300" role="alert">{ownerAccessMessage}</p>}
                    <button className="primary-action" type="submit">Continue to Owner Preview</button>
                    <button className="secondary-action mt-2 w-full" type="button" onClick={startVoiceOwnerAccess} disabled={voiceAccessListening}>
                      {voiceAccessListening ? 'Listening for Owner phrase…' : 'Use Voice Command'}
                    </button>
                    <p className="small-caveat mt-2">Browser-local demo access only. Not secure authentication.</p>
                  </form>
                )}
              </div>
            )}
          </section>
        )}



        {/* GUEST ENVIRONMENT */}
        {view === 'guest' && (
          <section className="animate-fadeIn">
            <div className="portal-topline">
              <button className="text-back" onClick={() => guestPage === 'home' ? setView('landing') : setGuestPage('home')}>
                {guestPage === 'home' ? '← Back' : '← Previous'}
              </button>
              <span>GUEST ENVIRONMENT · ARCHIVES</span>
            </div>

            {guestPage === 'home' && (
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
                  <small className="text-amber-300 font-bold tracking-widest">☁️ CLOUD9 · NEW SPAWN'S AREA</small>
                  <h3 className="text-lg font-bold text-amber-100 mt-2">Aelunari — The Dreamborn</h3>
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
                <div className="portal-panel mt-4 p-4">
                  <small className="text-amber-300 font-bold tracking-widest">🟣 VENUS · INCUBUS' FAVORITE</small>
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
        {view === 'restriction' && <section className="animate-fadeIn"><div className="portal-topline"><span>GUEST ENVIRONMENT</span><span>VIEWING-ONLY STATUS</span></div><div className="portal-panel p-5 mt-4 space-y-3"><h2 className="section-title">Your Journey Is Temporarily Paused</h2><p className="section-copy">{restrictionReason}</p><p className="text-sm text-purple-100">A 24-hour viewing-only restriction is active. You may browse permitted public Guest Environment information, but cannot enter the Store or continue onboarding until the restriction expires.</p>{onboardingRecord?.restrictionUntil && <p className="text-xs text-amber-200">Restriction ends: {new Date(onboardingRecord.restrictionUntil).toLocaleString()}</p>}{onboardingRecord?.helpUsed ? <p className="small-caveat">Your one-time Help explanation has already been used in this browser demo.</p> : <button className="secondary-action w-full" onClick={() => { const saved = readOnboardingRecord(); if (saved && !saved.helpUsed) { persistOnboarding({ ...saved, helpUsed: true }); setShowRestrictionHelp(true); } }}>Why can't I continue? — One-time Help</button>}{showRestrictionHelp && <div className="rounded-xl border border-purple-500/30 p-3 text-xs leading-relaxed text-purple-100"><strong className="text-amber-200">Why this restriction exists</strong><p className="mt-2">The onboarding process is designed to help customers become informed buyers who understand CELESTIAL LOBBY's procedures, conditions and service guidelines before proceeding. Your previous interruption or decision was recorded as the reason for this temporary pause.</p></div>}<button className="primary-action full" onClick={() => { setActiveEnvironment('guest'); setGuestPage('home'); setView('guest'); }}>Return to Guest Homepage</button></div></section>}

        {/* STORE ACCESS GATE */}
        {view === 'store-locked' && <section className="animate-fadeIn"><div className="portal-topline"><button className="text-back" onClick={() => { setActiveEnvironment('guest'); setGuestPage('home'); setView('guest'); }}>← Guest Homepage</button><span>STORE ACCESS</span></div><div className="portal-panel p-5 mt-4"><h2 className="section-title">Guest Store Access Not Yet Available</h2><p className="section-copy">Complete the onboarding journey and accept the CELESTIAL LOBBY Terms and Policies before entering the Guest Store.</p><button className="primary-action full" onClick={() => { setActiveEnvironment('guest'); setGuestPage('home'); setView('guest'); }}>Return to Guest Homepage</button></div></section>}

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
                <p>2. No Access ID or AGP code has been generated or saved.</p>
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

        {/* SCREEN 1 · ENVIRONMENT PREFIX ROUTING */}
        {view === 'environment-gate' && (
          <section className="animate-fadeIn client-access-screen"><div className="portal-panel gate-panel client-access-card">
            <div className="client-access-heading"><span className="eyebrow">CELESTIAL LOBBY · ACCESS GATE</span><h2 className="section-title">ENVIRONMENT VERIFICATION</h2><p className="section-copy">Enter your complete Access Code. Its registered prefix identifies the environment you are trying to reach.</p></div>
            <div className="client-access-fields"><label>ACCESS CODE<input value={environmentAccessCode} onChange={event => { setEnvironmentAccessCode(event.target.value.toUpperCase()); setEnvironmentRouteMessage(''); }} placeholder="Enter your Access Code" autoComplete="off" spellCheck={false} /></label></div>
            <button type="button" className="primary-action full client-access-verify" onClick={handleEnvironmentRouting}>IDENTIFY ENVIRONMENT</button>
            {environmentRouteMessage && <p className="form-message" role="alert">{environmentRouteMessage}</p>}
            <p className="small-caveat client-access-note">No Access ID is requested on this screen. A matching prefix only selects the destination. Your individual credentials must still be verified at the next sign-in stage.</p>
            <div className="client-access-guest"><button type="button" className="text-link" onClick={() => { setActiveEnvironment('guest'); setGuestPage('home'); setView('guest'); }}>JOIN IN / ACCESS</button><span>Continue directly to the Guest Environment.</span></div>
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
            <p className="small-caveat client-access-note">{invitationAttempts >= 3 ? 'This browser has been locked after three unsuccessful attempts.' : `${3-invitationAttempts} attempts available.`} Invitation verification is separate from your Access ID and Access Code or AGP Code.</p>
            <div className="client-access-guest"><button type="button" className="text-link" onClick={() => { setActiveEnvironment('guest'); setGuestPage('home'); setView('guest'); }}>Join In / Access</button><span>Continue directly to the Guest Environment.</span></div>
            <p className="small-caveat">DEMO ONLY · Browser-local validation · Not secure for real customer data.</p>
          </div></section>
        )}

        {/* SCREEN 2 · SIGN-IN */}
        {view === 'regular-gate' && (
          <section className="animate-fadeIn client-access-screen">
            <div className="portal-panel gate-panel client-access-card">
              <div className="client-access-heading">
                <span className="eyebrow">CELESTIAL LOBBY</span>
                <h2 className="section-title">REGULAR CLIENTS</h2>
                <p className="section-copy">Enter your access credentials to continue.</p>
              </div>

              <div className="client-access-fields">
                <label>
                  ACCESS ID
                  <input
                    value={accessIdInput}
                    onChange={(e) => setAccessIdInput(e.target.value)}
                    placeholder="Enter your Access ID"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </label>

                <label>
                  AGP CODE
                  <input
                    value={apgInput}
                    onChange={(e) => setApgInput(e.target.value)}
                    placeholder="Enter your AGP Code"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </label>
              </div>

              <button className="primary-action full client-access-verify" onClick={handleVerifyAccess}>
                VERIFY &amp; ENTER
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
                    setGuestPage('home');
                    setView('guest');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  JOIN AS GUEST
                </button>
                <span>Explore the Guest Environment without a client account.</span>
              </div>

              <p className="small-caveat client-access-note">
                Demo only. Credentials are checked against data saved in this browser and are not secure authentication.
              </p>
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
            <div className="portal-topline">
              <button className="text-back" onClick={() => setView('landing')}>← Homepage</button>
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

            <div className="three-s-intro">
              <p className="eyebrow">CELESTIAL LOBBY · CLIENT COMMITMENT</p>
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

      {ownerSessionUntil > Date.now() && view !== 'regular-gate' && view !== 'invitation-gate' && view !== 'onboarding' && view !== 'onboarding-terms' && (
        <nav className="owner-preview-dock" aria-label="Persistent Owner Preview controls">
          <span className="owner-preview-dock-label">OWNER PREVIEW</span>
          <button type="button" onClick={() => { setView('owner-preview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Owner Workspace</button>
          <button type="button" onClick={() => { setActiveEnvironment('guest'); setGuestPage('home'); setView('guest'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Guest View</button>
          <button type="button" onClick={() => { setActiveEnvironment('regular'); setView('regular-home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Regular Client Preview</button>
          <button type="button" className="owner-preview-exit" onClick={exitOwnerOverride}>Exit Override</button>
        </nav>
      )}

      {view !== 'landing' && view !== 'regular-gate' && view !== 'invitation-gate' && (
      <>
      {/* Footer */}
      <footer className="portal-footer" aria-label="Shared environment navigation and legal links">
        <button type="button" className="portal-footer-link" onClick={navigateEnvironmentHome}>Home</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('terms')}>Terms</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('privacy')}>Privacy</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('three-s')}>3S Framework</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('info-sec')}>Info Sec</button>
        <i aria-hidden="true">|</i>
        <button type="button" className="portal-footer-link" onClick={() => handleChromeNavigation('contact')}>Contact Us</button>
      </footer>
      </>
      )}
      <div className={`demo-disclaimer ${view === 'onboarding' || view === 'onboarding-terms' || (view === 'regular-gate' || view === 'invitation-gate') ? 'hidden' : ''}`}>
        
      </div>

    </div>
  );
};
