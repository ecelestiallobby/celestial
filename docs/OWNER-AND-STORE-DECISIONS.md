# CELESTIAL LOBBY — Owner and Store Decisions

Status: **Working specification / not yet activated**
Last updated: 2026-11-13
Scope: Owner Dashboard, Ascend With Us Registry, Sentinel protection, Store agreement, purchase-session timer, payment verification, and customer behaviour escalation.

> This document records decisions made so far. Items marked **PENDING OWNER SPECIFICATION** must remain configurable or inactive until the Owner supplies the missing details. Recording a rule here does not mean it has been implemented or activated.

## 1. Project constraints

- Development must follow a **zero-cost / no-cost expenditure** approach.
- Current website hosting remains GitHub Pages.
- Google Apps Script and Google Sheets are the planned interim operational integration.
- No paid database, paid backend, paid hosting, or additional paid subscription is to be introduced as part of this plan.
- Stay within the free usage quotas and technical limits of the selected services.
- Do not describe browser-local storage or client-side role checks as production-secure.
- Make changes in small, reviewable steps. Inspect the current source, make one logical change, review the diff, test, and verify deployment before moving to the next implementation step.

## 2. Owner Dashboard redesign

The Owner Dashboard is the mother homepage and central authorized workspace.

### Homepage layout
- Replace the long stack of panels with a compact, icon-based command center.
- Keep the Owner homepage within one viewport where practical; one topic opens one workspace.
- Group related functions and consolidate duplicate destinations.
- Use small icon buttons for functional destinations. Do not create a separate icon for every minor action.
- Retain the dark, sophisticated CELESTIAL LOBBY visual direction and mobile-first layout.
- Provide responsive behaviour for phone, tablet, and desktop, including mobile safe areas.

### Three permanent destination panels
The Owner homepage must include access to:
1. **CELESTIALS**
2. **FOUNDERS**
3. **ASCEND WITH US**

These are destination/content panels, not individual registry-record shortcuts. Owner access to these destinations must not discard the Owner session.

### Proposed functional groups
These are the current planning groupings and may be refined during visual review:
- **Orders:** Orders; Daily Summary; Order Activity (combine overlapping activity/history functions where appropriate).
- **Access & Security:** Access Manager; Environment IDs/prefix settings as a subsection where possible.
- **Workspace:** Environments/previews; Owner Notes; session status as a compact indicator rather than necessarily a full destination.

### Reusable workspace windows
Build a reusable Owner workspace window component before moving existing functions:
- Minimize: hide the window and return to the dashboard while retaining a minimized task/tab.
- Maximize: fill the available viewport.
- Restore: return a maximized window to its normal floating size.
- Close: close the window without deleting its data. Reopening the destination opens it again.
- Only one workspace may be maximized at a time.
- Minimized workspaces appear as small task icons/tabs along the bottom edge.
- On phones, windows use the available viewport and respect safe areas. On larger screens, they may appear as centered floating windows.
- The Owner Dashboard remains the background workspace.

### Existing functions to preserve while reorganizing
Do not discard existing data or functionality when consolidating the current Owner panels, including current/active order information, today's orders, session status, preview workspace, invitation/access management, environment prefix registry, and Owner notepad. Review the actual source before moving or replacing any of these.

## 3. Ascend With Us — Owner Registry

The registry tracks **order conversion into client access credentials**. It does not track a person's onboarding progress, stages, or whether someone is still onboarding.

### Workflow
1. An order enters the registry and is identified by its order number.
2. The order remains in an awaiting-conversion state until it is converted.
3. When conversion occurs, the customer is assigned an Access ID and Access PC.
4. The order number remains linked to the assigned credentials and conversion record.

### Consolidated registry fields
- Order Number
- Conversion Status
- Access ID
- Access PC
- Registration Date
- Conversion Date

Do not list each person/order as a separate Owner Dashboard icon. The Owner opens one consolidated registry, then searches and inspects individual records within it.

### Integration plan
Ascend With Us activity → consolidated Onboarding/Conversion Registry → Google Sheets via Google Apps Script → future CELESTIAL LOBBY server/central database.

Google Sheets is the planned interim operational record source. Access PCs are credentials: do not place them in ordinary spreadsheet cells in plaintext. The eventual implementation must use access-controlled handling and avoid exposing credentials to unauthorized viewers. Do not claim that secure credential storage, Owner-only reveal, audit logging, or synchronization is already implemented.

## 4. Sentinel Protection Layer

Security restrictions are environment-specific.

- **Guest Homepage:** Sentinel restrictions paused.
- **Regular Client Homepage:** Sentinel restrictions paused.
- **Owner Homepage:** Sentinel restrictions paused after successful Owner access.
- **Storefront:** strict Sentinel protection active.
- **Store checkout:** strict Sentinel protection active.

Homepages must remain usable without disruptive selection/copy restrictions, automatic text correction, or false-positive security triggers. Store-specific restrictions must not interfere with ordinary homepage navigation or text entry.

Browser-side measures can discourage casual copying and conceal sensitive information, but cannot guarantee detection of every inspection, screenshot, recording, or extraction. Anything delivered to a browser can ultimately be inspected. Actual authorization and credential validity must be enforced by the trusted backend integration, not by hiding HTML, CSS, or JavaScript.

A suspicious Store event may trigger a protective response such as concealing sensitive fields and locking the current Store session. Do not permanently destroy a credential solely because a user presses a developer-tools shortcut; false positives are possible. Any credential revocation policy requires explicit Owner rules and backend enforcement.

## 5. Store entrance — Binding User Agreement

Every time a customer opens the Store, display the Binding User Agreement and the required non-negotiable policy reminders before the customer proceeds.

### First set: the five 3S No-Nos
These five rules must be hardcoded into the Store experience and visibly displayed, not hidden behind an expandable section:

1. **NO COD**
2. **NO MEET UPS**
3. **NO REFUNDS**
4. **NO RUSH ORDERS**
5. **NO SPAMMING**

### Second set: five behavioural non-negotiables
The Owner has confirmed that the agreement must also include a second set of five non-negotiable rules concerning customer behaviour.

**PENDING OWNER SPECIFICATION:** Exact wording of these five behavioural rules has not yet been supplied in the current specification. Do not invent or activate their wording. Reserve a clearly identified section for the five rules.

The customer must affirm that they have read and understood the Binding User Agreement before entering/starting a Store purchase session. Record the acknowledgement and timestamp with the applicable policy version when the backend is available. The agreement is to appear on each Store opening as instructed; do not assume a one-time lifetime acknowledgement replaces the recurring Store reminder.

## 6. One-hour Store purchase-session timer

### Start and visibility
- The purchase-session allowance is **one hour (60 minutes)**.
- Start the timer when the customer acknowledges the Store agreement and begins the purchase session.
- Show the timer visibly in the Store and keep it visible when the customer navigates to the customer homepage or another permitted environment/page during that active purchase session.
- Navigation away from the Store must not reset or hide the active countdown.
- Returning to the Store resumes the same session and remaining time.
- A customer with an existing order may access the Store again and begin a separate purchase cycle. An existing order being fulfilled does not, by itself, prevent another purchase.

### What the hour covers
The one-hour allowance covers the customer's purchase activity, including placing/submitting the order and submitting payment, and the payment-verification stage. Payment submission is not payment verification.

- Submitting an order does **not** stop the timer.
- Submitting payment or payment proof does **not** stop the timer.
- The timer stops only when payment is verified.
- The user has explicitly said the one-hour allowance includes payment verification.

**PENDING OWNER SPECIFICATION:** The Owner mentioned that the timer may also be paused, but has not yet defined the exact pause condition. Do not invent a pause trigger. Until clarified, do not add an automatic pause condition. The established stop condition remains successful payment verification.

### Timer authority
The visible browser countdown is only a display. The authoritative start time, deadline, and verified-payment stop event must be recorded and validated by Google Apps Script or another approved trusted backend integration. Refreshing, navigating, or changing the device clock must not create a fresh hour.

## 7. Order submission and payment verification

Keep order submission separate from payment verification.

1. Customer submits an order within the one-hour session.
2. The system records the order and its order number.
3. Customer submits payment/payment proof.
4. The timer continues while payment remains unverified.
5. The Verification Team receives a notification that an order was received and its payment status needs to be checked against the designated bank account.
6. The notification must clearly distinguish payment submitted from payment verified.
7. When the Verification Team confirms payment, record the verification event and stop the active purchase-session timer.

The Verification Team notification should identify the order number, order-submission time, payment-submission state, and pending verification state, with a route to the appropriate verification workspace when implemented. Do not state or imply that funds have been received merely because an order or proof was submitted.

If the timer expires after an order has already been submitted, preserve the submitted order and its verification record. Do not erase an order because a shopping session expired.

**PENDING OWNER SPECIFICATION:** The exact operational disposition of an already-submitted order whose payment remains unverified at the one-hour deadline has not been fully defined. Preserve the record and flag the state for the Owner's later decision; do not silently cancel or delete it.

## 8. Expired purchase session and selection recovery

If the one-hour session expires before an order is submitted:
- Clear the cart.
- Remove/disable promotional codes.
- Disable promotional deals and offers.
- Clear customizations and personalizations.
- Disable bundled offers and bulk-order selections.
- Do not automatically offer the cleared selections again.
- Restore eligible selections, offers, retention offers, or customizations only when the customer supplies an authorized recovery code.

The expiry action applies to the unsubmitted purchase selections. It must not delete a submitted order or its payment-verification history.

The exact recovery-code issuance, validity, and authorization rules remain subject to Owner configuration before activation.

## 9. Five-lifeline customer behaviour escalation

The Owner has specified a five-occurrence escalation framework for repeated qualifying customer behaviour associated with entering/acknowledging the Store and then not proceeding with a purchase, including leaving/navigating away and repeating the same behaviour.

The intended escalation is:
1. First occurrence: record the first strike.
2. Second occurrence: warning.
3. Third occurrence: stern warning.
4. Fourth occurrence: final warning.
5. Fifth occurrence: escalate for Owner decision. Possible decisions include ban, restriction, or removal of access.

The Owner retains final authority over access decisions. Do not automatically permanently ban or remove a customer at the fifth occurrence without the configured Owner decision.

**PENDING OWNER SPECIFICATION:**
- Exact event definition for a qualifying occurrence/abandoned Store visit.
- How repeated visits are grouped into one occurrence versus separate occurrences.
- Any reset/expiry period for lifelines, if one is intended.
- Exact wording and presentation of each warning.
- Whether the first occurrence is only logged or also shown to the customer as a notice.

Ordinary browsing, harmless navigation within the Store, or a legitimate submitted order must not be counted as misconduct by assumption. Cart/session expiry and behavioural strikes are separate mechanisms. A timer expiring does not automatically create a behavioural strike unless the Owner explicitly defines it as a qualifying event.

## 10. Required separation of records and mechanisms

Keep these independent:
- Policy acknowledgement record.
- Store purchase-session timer.
- Order record.
- Payment submission record.
- Payment verification record.
- Cart/promotional selection state.
- Behavioural lifeline/strike record.
- Owner access decision.

An existing order must not consume or block a new purchase session. A new Store purchase session must have its own timer. An order's payment-verification process must remain attached to its order, not be mistaken for the customer's current cart.

## 11. Pending items register

The following must be completed by the Owner before the corresponding rules are activated:
- Exact text of the five behavioural non-negotiables.
- Exact timer pause condition, if any.
- Treatment of submitted but unverified orders at the one-hour deadline beyond preserving the order and verification record.
- Recovery-code authorization and issuance rules.
- Exact qualifying event and reset rules for the five-lifeline system.
- Exact wording of the five escalation notices.
- Final visual design and mobile layout review for the Owner Dashboard and Store agreement.

## 12. Implementation status

This document is a decision/specification record only. It does not activate any Store restrictions, countdowns, strikes, credential revocation, Google Sheets sync, or new Owner Dashboard UI.

Implementation should proceed in small logical changes:
1. Review current source and existing Store/order flow.
2. Finalize missing policy details with the Owner.
3. Implement one logical unit at a time.
4. Review the exact commit diff.
5. Run the project build/lint and relevant functional tests.
6. Verify the GitHub Pages deployment before proceeding.

No paid services are authorized by this specification.
