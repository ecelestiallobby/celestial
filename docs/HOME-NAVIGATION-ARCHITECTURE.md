# CELESTIAL LOBBY — HOME Navigation Architecture

Status: Active specification  
Scope: HOME shared navigation, Owner-first environment planning  
Last updated: 2026-11-13

## Current implementation correction

The existing application rendered multiple navigation controllers in Owner mode:
- The general environment hamburger in `src/components/Portal.tsx`.
- A second Owner hamburger in `src/components/Portal.tsx`.
- A floating Owner menu controller in `src/App.tsx`.

The current update suppresses the two legacy Portal hamburger controls while the App-level Owner navigation controller is present. Owner mode therefore presents one hamburger controller instead of three. The Owner drawer has also been made more translucent and aligned closer to the mobile header safe area.

This is an incremental cleanup, not the final shared-navigation rebuild.

## Shared mobile navigation decisions

- Mobile-first design.
- A single hamburger navigation controller per active environment.
- Navigation opens as a sliding panel with a translucent/glass-like background.
- The intended maximum reveal/drag extent is approximately one-fourth of the screen. The exact measurement axis and final panel dimensions must be validated in the visual prototype before enforcing a hard CSS limit.
- Major topics with subtopics use a plus sign. Tapping the plus expands the subtopics; the plus changes to a minus while expanded.
- No conventional dropdown arrows.
- Menu contents and destinations are environment- and permission-dependent.
- Onboarding navigation restrictions remain in force.

## Footer decisions

- Footer links: TERMS, PRIVACY, INFO SEC.
- SITEMAP remains optional pending the complete website structure.
- In the closed-menu state, the footer appears below the homepage content.
- In the open-menu state, the same legal links appear at the bottom of the hamburger panel.
- Footer links are small, understated text hyperlinks, not cards or large buttons.
- Avoid duplicate footer sections.

## Environment planning order

The Owner Environment is the mother workspace and will be designed first. It is the reference environment for the overall navigation hierarchy and provides authorized access to environment previews and management destinations.

After the Owner structure is established, derive separate authorized navigation contents for:
1. Guest Environment
2. Regular Client Environment
3. Celestial Army Environment
4. Sales Team Environment
5. Admin Environment

A shared navigation component must not imply shared permissions. Each environment must only expose destinations its current role is authorized to access.

## Visual review still required

The current CSS correction removes the duplicate Owner hamburger controls. The user will inspect the live site and provide screenshots or observations. Use that feedback to refine the Owner navigation and diagnose any remaining duplicated tools.

Do not invent or finalize Owner menu entries before the Owner Environment hierarchy is reviewed with the user.

## Implementation boundary

The current GitHub Pages project remains a browser-local demo. Do not represent local demo authentication, local storage, or client-side role checks as production-secure access control.
