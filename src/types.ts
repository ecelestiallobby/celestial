export interface StardustItem {
  id: string;
  name: string;
  units: string;
  price: number;
  icon: string;
}

export interface AddonItem {
  id: string;
  name: string;
  price: number;
  icon: string;
}

export interface DeliveryDetails {
  name: string;
  phone: string;
  address: string;
  method: string;
}

export interface ActiveOrder {
  orderId: string;
  startTime: number | null;
  paymentSender: string;
  paymentScreenshot: string | null;
  status: 'submitted' | 'payment_submitted' | 'confirmed' | 'processing' | 'in_transit' | 'out_for_delivery' | 'delivered';
  submittedTime?: string;
  paymentTime?: string;
  totalPaid?: number;
}

export interface CelestialState {
  currentStep: number;
  cart: Record<string, number>;
  addons: Record<string, number>;
  specialHandling: 'standard';
  promoCode: string;
  discount: number;
  deliveryDetails: DeliveryDetails;
  activeOrder: ActiveOrder;
}

export interface DemoAccessCredentials {
  accessId: string;
  apg: string;
}
