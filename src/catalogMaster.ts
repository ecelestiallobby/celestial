/**
 * CELESTIAL LOBBY — Master Catalog Data
 * DEMO ONLY. Browser/site prototype data; not a live ordering or payment service.
 * Prices are Philippine pesos (PHP).
 *
 * This file is additive: the existing Store flow and checkout components are unchanged.
 * Product availability, legal classification, age restrictions, shipping declarations,
 * and operational eligibility must be reviewed before any production use.
 */

export type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  pricePhp: number | null;
  quantity?: string;
  description?: string;
  defaultFor?: string[];
  includedFreebies?: string[];
};

export const MASTER_CATALOG = {
  stardust: [
    { id: 'cloud9', name: 'CLOUD9', category: 'STARDUST', quantity: '5u', pricePhp: 700 },
    { id: 'mars', name: 'MARS', category: 'STARDUST', quantity: '10u', pricePhp: 1200 },
    { id: 'venus', name: 'VENUS', category: 'STARDUST', quantity: '15u', pricePhp: 1700 },
    { id: 'saturn', name: 'SATURN', category: 'STARDUST', quantity: '20u', pricePhp: 2150 },
    { id: 'nibiru', name: 'NIBIRU', category: 'STARDUST', quantity: '25u', pricePhp: 2600 },
    { id: 'nemik', name: 'NEMIK', category: 'STARDUST', quantity: '30u', pricePhp: 3100 },
    { id: 'vaelithar', name: 'VAELITHAR', category: 'STARDUST', quantity: '40u', pricePhp: 3500 }
  ] satisfies CatalogEntry[],

  dracoBulks: [
    {
      id: 'vhaerion-05',
      name: 'VHAERION 0.5',
      category: 'DRACO BULKS',
      quantity: '60u',
      pricePhp: 4450,
      includedFreebies: ['Lu Be', '5 Dagom']
    },
    {
      id: 'zhaevoryn-10',
      name: 'ZHAEVORYN 1.0',
      category: 'DRACO BULKS',
      quantity: '110u',
      pricePhp: 6950,
      includedFreebies: ['Lu Be', '10 Dagom']
    }
  ] satisfies CatalogEntry[],

  extrasAndAddons: [
    { id: 'lu-be', name: 'Lu Be', category: 'EXTRAS & ADD-ONS', quantity: '200ml', pricePhp: 150 },
    { id: 'dagom', name: 'Dagom', category: 'EXTRAS & ADD-ONS', quantity: '1 pc', pricePhp: 50 },
    { id: 'mxmn', name: 'Mxmn', category: 'EXTRAS & ADD-ONS', quantity: '1 Tb', pricePhp: 70 }
  ] satisfies CatalogEntry[],

  services: [
    { id: 'priority', name: 'Priority', category: 'SPECIAL SERVICES', pricePhp: 150, description: 'Priority daytime queue option, subject to availability and applicable service terms.' },
    { id: 'gorush30', name: 'GoRush30', category: 'SPECIAL SERVICES', pricePhp: 500, description: 'Requested after-hours expedited service window of 30 minutes, subject to availability.' },
    { id: 'gorush60', name: 'GoRush60', category: 'SPECIAL SERVICES', pricePhp: 350, description: 'Requested after-hours expedited service window of 60 minutes, subject to availability.' },
    { id: 'gorush90', name: 'GoRush90', category: 'SPECIAL SERVICES', pricePhp: 200, description: 'Requested after-hours expedited service window of 90 minutes, subject to availability.' },
    { id: 'splitting', name: 'Splitting', category: 'SPECIAL SERVICES', pricePhp: 100, description: 'Manual separation into individually labeled, appropriately packaged units where lawful and suitable.' },
    { id: 'relocation', name: 'Relocation', category: 'SPECIAL SERVICES', pricePhp: 100, description: 'Delivery destination change requested and confirmed before dispatch; applicable fare is additional.' },
    { id: 'packaging-service', name: 'Packaging', category: 'SPECIAL SERVICES', pricePhp: null, description: 'Custom protective packaging priced at material cost plus 30%.' },
    { id: 'staging', name: 'Staging', category: 'SPECIAL SERVICES', pricePhp: 100, description: 'Order preparation scheduled for an agreed future fulfillment window.' },
    { id: 'delay', name: 'Delay', category: 'SPECIAL SERVICES', pricePhp: 100, description: 'Additional waiting-time charge where disclosed and applicable under the service terms.' }
  ] satisfies CatalogEntry[],

  deliveryAndPackagingOptions: [
    { id: 'standard-packaging', name: 'Standard Packaging', category: 'DELIVERY & PACKAGING', pricePhp: 0, defaultFor: ['STARDUST'] },
    { id: 'standard-delivery', name: 'Standard Delivery', category: 'DELIVERY & PACKAGING', pricePhp: 0 },
    { id: 'billed-delivery-fee', name: 'Billed Delivery Fee', category: 'DELIVERY & PACKAGING', pricePhp: 200 }
  ] satisfies CatalogEntry[],

  packagingTiers: [
    {
      id: 'pkg-std',
      name: 'Standard Packaging',
      category: 'PACKAGING TIERS',
      pricePhp: 0,
      description: 'PKG-STD. Standard protective packaging. Automatically included by default with Stardust.'
    },
    {
      id: 'pkg-med',
      name: 'Medical / Wellness Kit Packaging',
      category: 'PACKAGING TIERS',
      pricePhp: 200,
      description: 'PKG-MED. Rigid organizer presentation with protective cushioning and a tamper-evident closure. Packaging must not misrepresent the contents.'
    },
    {
      id: 'pkg-max',
      name: 'Premium Household Packaging',
      category: 'PACKAGING TIERS',
      pricePhp: 380,
      description: 'PKG-MAX. Premium protective presentation using a suitable outer box and cushioning. Shipping contents and declarations must remain accurate.'
    }
  ] satisfies CatalogEntry[],

  additionalFees: [
    { id: 'customization-fee', name: 'Customization Fee', category: 'ADDITIONAL FEES', pricePhp: 150, description: 'Additional charge for an approved customized request.' },
    { id: 'violation-charge', name: 'Violation Charge', category: 'ADDITIONAL FEES & PENALTIES', pricePhp: 100, description: 'Per documented violation of applicable store articles and provisions.' }
  ] satisfies CatalogEntry[]
} as const;

export const MASTER_CATALOG_SUMMARY = {
  stardust: MASTER_CATALOG.stardust.length,
  dracoBulks: MASTER_CATALOG.dracoBulks.length,
  extrasAndAddons: MASTER_CATALOG.extrasAndAddons.length,
  services: MASTER_CATALOG.services.length,
  deliveryAndPackagingOptions: MASTER_CATALOG.deliveryAndPackagingOptions.length,
  packagingTiers: MASTER_CATALOG.packagingTiers.length,
  additionalFees: MASTER_CATALOG.additionalFees.length,
  totalIncludingPackagingTiers: 29
} as const;
