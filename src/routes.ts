export type PortalRouteView =
  | 'landing' | 'environment-gate' | 'environment-route' | 'invitation-gate'
  | 'owner-preview' | 'guest' | 'onboarding' | 'onboarding-terms'
  | 'restriction' | 'store-locked' | 'onboarding-submitted'
  | 'regular-gate' | 'regular-home' | 'about' | 'no-nos' | 'faqs'
  | 'terms' | 'privacy' | 'info-sec' | 'three-s' | 'contact';

export const ROUTE_BASE = '/celestial';

const ROUTES: Record<PortalRouteView, string> = {
  landing: '/celestial/access',
  'environment-gate': '/celestial/environment',
  'environment-route': '/celestial/environment/route',
  'invitation-gate': '/celestial/beta/invitation',
  'owner-preview': '/celestial/owner',
  guest: '/celestial/guest',
  onboarding: '/celestial/onboarding',
  'onboarding-terms': '/celestial/onboarding/terms',
  restriction: '/celestial/onboarding/restricted',
  'store-locked': '/celestial/store/locked',
  'onboarding-submitted': '/celestial/onboarding/submitted',
  'regular-gate': '/celestial/client/access',
  'regular-home': '/celestial/client',
  about: '/celestial/about',
  'no-nos': '/celestial/no-nos',
  faqs: '/celestial/faqs',
  terms: '/celestial/terms',
  privacy: '/celestial/privacy',
  'info-sec': '/celestial/info-sec',
  'three-s': '/celestial/three-s',
  contact: '/celestial/contact'
};

const NORMALIZED_ROUTES = new Map(
  Object.entries(ROUTES).map(([view, path]) => [path, view as PortalRouteView])
);

export function pathForPortalView(view: PortalRouteView): string {
  return ROUTES[view] ?? ROUTES.landing;
}

export function portalViewForPath(pathname: string): PortalRouteView | null {
  const normalized = pathname.replace(/\\/+$/, '') || '/';
  if (normalized === '/celestial' || normalized === '/celestial/') return 'landing';
  return NORMALIZED_ROUTES.get(normalized) ?? null;
}

export function isStorePath(pathname: string): boolean {
  return pathname.replace(/\\/+$/, '') === '/celestial/store';
}
