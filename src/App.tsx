import React, { useState, useEffect } from 'react';
import { Portal } from './components/Portal';
import { Store } from './components/Store';
import { CelestialState } from './types';

const STORAGE_KEY = 'CELESTIAL_LOBBY_STATE_v1';

const DEFAULT_STATE: CelestialState = {
  currentStep: 1,
  cart: {
    cloud9: 1,
    mars: 1
  },
  addons: {
    lubricant: 0,
    accessory: 0
  },
  specialHandling: 'standard',
  promoCode: '',
  discount: 0,
  deliveryDetails: {
    name: 'Juan Dela Cruz',
    phone: '0917 123 4567',
    address: 'Neo District Orbit Tower',
    method: 'Standard Rider Delivery'
  },
  activeOrder: {
    orderId: '#CL20261104-001',
    startTime: null,
    paymentSender: 'FTA',
    paymentScreenshot: null,
    status: 'submitted'
  }
};

export const App: React.FC = () => {
  const [mode, setMode] = useState<'portal' | 'store'>('portal');

  const [state, setState] = useState<CelestialState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_STATE, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
    return DEFAULT_STATE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }, [state]);

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('CL_DEMO_ACCESS');
    setState(DEFAULT_STATE);
    setMode('portal');
  };

  return (
    <div className="min-h-screen text-slate-100 bg-[#05040a]">
      {mode === 'portal' ? (
        <Portal
          activeOrder={state.activeOrder}
          deliveryDetails={state.deliveryDetails}
          onUpdateStatus={(newStatus) => {
            setState(prev => ({
              ...prev,
              activeOrder: {
                ...prev.activeOrder,
                status: newStatus
              }
            }));
          }}
          onEnterStore={() => {
            setMode('store');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
        <Store
          state={state}
          setState={setState}
          onReturnToLobby={() => {
            setMode('portal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onReset={handleReset}
        />
      )}
    </div>
  );
};

export default App;
