import { StardustItem, AddonItem } from './types';

export const CATALOG: {
  stardust: StardustItem[];
  addons: AddonItem[];
} = {
  stardust: [
    { id: 'cloud9', name: 'Cloud9', units: '5u', price: 700, icon: 'fa-cloud-bolt' },
    { id: 'mars', name: 'Mars', units: '10u', price: 1200, icon: 'fa-planet-ring' },
    { id: 'venus', name: 'Venus', units: '15u', price: 1700, icon: 'fa-sun' },
    { id: 'saturn', name: 'Saturn', units: '20u', price: 2150, icon: 'fa-globe-americas' },
    { id: 'nibiru', name: 'Nibiru', units: '25u', price: 2600, icon: 'fa-atom' },
    { id: 'nemik', name: 'Nemik', units: '30u', price: 3100, icon: 'fa-moon' },
    { id: 'vaelithar', name: 'Vaelithar', units: '40u', price: 3500, icon: 'fa-shield-halved' },
    { id: 'half_g', name: '0.5 / Half G', units: '60u', price: 4450, icon: 'fa-compact-disc' },
    { id: 'one_g', name: '1.0 / One G', units: '110u', price: 6950, icon: 'fa-circle-dot' }
  ],
  addons: [
    { id: 'lubricant', name: 'Lubricant (Small)', price: 150, icon: 'fa-flask' },
    { id: 'accessory', name: 'Accessory (Extra)', price: 50, icon: 'fa-gem' }
  ]
};

export const ONBOARDING_STEPS = [
  {
    title: 'About Us',
    copy: 'Celestial Lobby is a compact client environment built around clear information, transparent processes and a considered customer experience. This introduction explains how the environment is intended to work.',
    extra: 'The complete business story and location details will be published after the owner confirms the final copy.'
  },
  {
    title: 'Understanding the 3S',
    copy: 'Our 3S standards are Security, Secrecy and Safety. They describe the principles intended to guide access, privacy-conscious handling and order quality.',
    extra: 'Security: appropriate access controls. Secrecy: information limited to authorized purposes. Safety: documented checks and careful fulfillment. This static demo does not provide encryption or guaranteed privacy.'
  },
  {
    title: 'The 10 Non-Negotiables',
    copy: 'Please review the ten client standards before continuing.',
    extra: '1. No COD · 2. No Meet Ups · 3. No Refunds* · 4. No Rush Orders · 5. No Spamming · 6. No Rudeness · 7. No Nosy Probes · 8. No Nuisance · 9. No Threats · 10. No Bogus Transactions. *Final policy wording must preserve rights required by law.'
  },
  {
    title: 'Simplified Process Flow',
    copy: 'The intended customer journey is designed to make each stage clear.',
    extra: 'Browse available items → review selections and add-ons → review disclosed charges → submit order details → submit payment proof → wait for manual verification and confirmation → fulfillment and status updates.'
  },
  {
    title: 'Store Overview',
    copy: 'The store uses a restrained celestial-stardust presentation rather than an oversized catalogue.',
    extra: 'The original store flow is retained behind client access. Current availability and prices shown there are prototype content and must be confirmed before any real use.'
  },
  {
    title: 'Understanding the Calculation',
    copy: 'Review how the estimated total is formed before you place an order.',
    extra: 'Core items + add-ons + disclosed additional services + applicable delivery or handling charges − eligible discounts = estimated total. No hidden charge should be added after commitment.'
  },
  {
    title: 'Final Acknowledgment',
    copy: 'Confirm that you have reviewed the introduction, standards, process and demo limitations.',
    extra: 'By continuing, you acknowledge this is a prototype. The access code generated here is stored only in this browser and is not a secure account credential.'
  },
  {
    title: 'Purchasing Intent',
    copy: 'Are you ready to explore the store, or would you prefer to consider your budget first?',
    extra: 'Choose “Continue to Store” to enter the prototype, or leave onboarding and return to the Lobby.'
  }
];
