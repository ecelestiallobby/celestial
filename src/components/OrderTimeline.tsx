import React, { useState } from 'react';
import { ActiveOrder, DeliveryDetails } from '../types';

interface OrderTimelineProps {
  order: ActiveOrder;
  deliveryDetails?: DeliveryDetails;
  onUpdateStatus?: (newStatus: ActiveOrder['status']) => void;
  onEnterStore?: () => void;
}

export type TimelineStatusKey = 'confirmed' | 'processing' | 'in_transit' | 'delivered';

interface TimelineStep {
  key: TimelineStatusKey;
  label: string;
  description: string;
  icon: string;
  defaultTime: string;
  subtext: string;
}

export const OrderTimeline: React.FC<OrderTimelineProps> = ({
  order,
  deliveryDetails,
  onUpdateStatus,
  onEnterStore
}) => {
  const [copied, setCopied] = useState(false);

  // Map order.status into step index: 0 = Confirmed, 1 = Processing, 2 = In Transit, 3 = Delivered
  const getStepIndex = (status: ActiveOrder['status']): number => {
    switch (status) {
      case 'submitted':
      case 'payment_submitted':
      case 'confirmed':
        return 0;
      case 'processing':
        return 1;
      case 'in_transit':
      case 'out_for_delivery':
        return 2;
      case 'delivered':
        return 3;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(order.status);

  const steps: TimelineStep[] = [
    {
      key: 'confirmed',
      label: 'Confirmed',
      description: 'Order registered & payment verified in realm ledger',
      icon: 'fa-check',
      defaultTime: order.paymentTime || order.submittedTime || 'Nov 5, 2026 • 04:32 AM',
      subtext: 'Credentials authenticated'
    },
    {
      key: 'processing',
      label: 'Processing',
      description: 'Stardust server allocations assigned & packaged',
      icon: 'fa-cube',
      defaultTime: 'Est. +15 mins from confirmation',
      subtext: 'Allocating realm resources'
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      description: 'Dispatched through secure celestial delivery route',
      icon: 'fa-truck-fast',
      defaultTime: 'Est. 30-45 mins arrival window',
      subtext: 'Courier en route'
    },
    {
      key: 'delivered',
      label: 'Delivered',
      description: 'Package received & transfer sealed safely at destination',
      icon: 'fa-circle-check',
      defaultTime: 'Completed at destination',
      subtext: 'Transmission complete'
    }
  ];

  const handleCopyOrderId = () => {
    if (order.orderId) {
      navigator.clipboard.writeText(order.orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Status badge details
  const getStatusBadge = () => {
    if (currentIndex === 3) {
      return {
        text: 'DELIVERED',
        bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
        dot: 'bg-emerald-400'
      };
    }
    if (currentIndex === 2) {
      return {
        text: 'IN TRANSIT',
        bg: 'bg-blue-950/80 text-blue-300 border-blue-500/50',
        dot: 'bg-blue-400 animate-pulse'
      };
    }
    if (currentIndex === 1) {
      return {
        text: 'PROCESSING',
        bg: 'bg-purple-950/80 text-purple-300 border-purple-500/50',
        dot: 'bg-purple-400 animate-ping'
      };
    }
    return {
      text: 'CONFIRMED',
      bg: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
      dot: 'bg-amber-400'
    };
  };

  const badge = getStatusBadge();

  return (
    <div className="glass-card rounded-2xl p-5 md:p-6 border border-purple-500/30 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-500/20 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-purple-300 font-bold">
              Active Order Tracking
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
              {badge.text}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-lg md:text-xl font-bold font-mono text-white tracking-wide">
              {order.orderId}
            </h3>
            <button
              onClick={handleCopyOrderId}
              className="text-xs text-purple-400 hover:text-amber-300 transition px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 flex items-center gap-1 cursor-pointer"
              title="Copy Order ID"
            >
              <i className={`fa-regular ${copied ? 'fa-circle-check text-emerald-400' : 'fa-copy'}`}></i>
              <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {onEnterStore && (
          <button
            onClick={onEnterStore}
            className="text-xs text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            Open in Store ↗
          </button>
        )}
      </div>

      {/* Visual Timeline Stepper */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
            Fulfillment Journey
          </span>
          <span className="text-[11px] text-purple-300">
            Stage {currentIndex + 1} of 4
          </span>
        </div>

        {/* Desktop / Tablet Horizontal Stepper */}
        <div className="hidden sm:block relative pt-2 pb-4">
          {/* Background Connecting Bar */}
          <div className="absolute top-6 left-6 right-6 h-1 bg-slate-900 border border-purple-500/20 rounded-full z-0">
            {/* Active Filled Progress Bar */}
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-sm shadow-amber-400/50"
              style={{ width: `${(currentIndex / 3) * 100}%` }}
            ></div>
          </div>

          <div className="relative z-10 grid grid-cols-4 gap-2">
            {steps.map((step, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const isUpcoming = idx > currentIndex;

              return (
                <div key={step.key} className="flex flex-col items-center text-center">
                  {/* Step Node Circle */}
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                      isPast
                        ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                        : isCurrent
                        ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 ring-4 ring-amber-400/30 shadow-lg shadow-amber-400/40 scale-110 font-bold'
                        : 'bg-slate-950 border-2 border-purple-500/30 text-purple-400 opacity-60'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -inset-1 rounded-full border border-amber-300 animate-ping opacity-50"></span>
                    )}
                    <i className={`fa-solid ${isPast ? 'fa-check' : step.icon} text-sm`}></i>
                  </div>

                  {/* Step Label & Meta */}
                  <div className="mt-3 space-y-0.5">
                    <span
                      className={`block text-xs font-bold uppercase tracking-wider ${
                        isCurrent
                          ? 'text-amber-300'
                          : isPast
                          ? 'text-white'
                          : 'text-purple-300/60'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="block text-[10px] text-purple-200 line-clamp-1">
                      {step.subtext}
                    </span>
                    <span className="block text-[9px] text-purple-400/80 font-mono mt-0.5">
                      {isCurrent ? 'Current' : isPast ? 'Done' : 'Upcoming'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Vertical Stepper */}
        <div className="block sm:hidden space-y-4 pl-2 relative border-l-2 border-purple-500/20 ml-4 py-1">
          {steps.map((step, idx) => {
            const isPast = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isUpcoming = idx > currentIndex;

            return (
              <div key={step.key} className="relative pl-6">
                {/* Node icon anchored on vertical line */}
                <div
                  className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isPast
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : isCurrent
                      ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/25 scale-105 font-bold'
                      : 'bg-slate-900 border border-purple-500/40 text-purple-400 opacity-50'
                  }`}
                >
                  <i className={`fa-solid ${isPast ? 'fa-check' : step.icon} text-xs`}></i>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isCurrent ? 'text-amber-300' : isPast ? 'text-white' : 'text-purple-300/60'
                      }`}
                    >
                      {step.label}
                    </h4>
                    {isCurrent && (
                      <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded text-[9px] font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-200 mt-0.5">{step.description}</p>
                  <span className="text-[10px] text-purple-400 font-mono block mt-0.5">
                    {step.defaultTime}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Stage Detail Banner */}
      <div className="p-3.5 rounded-xl border border-amber-400/30 bg-gradient-to-r from-purple-950/60 to-slate-950/80 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-sm mt-0.5 flex-shrink-0">
          <i className={`fa-solid ${steps[currentIndex]?.icon || 'fa-hourglass-half'}`}></i>
        </div>
        <div className="text-xs space-y-1">
          <div className="text-white font-bold flex items-center gap-2">
            <span>Status: {steps[currentIndex]?.label}</span>
            <span className="text-[10px] text-purple-300 font-normal">
              ({steps[currentIndex]?.subtext})
            </span>
          </div>
          <p className="text-purple-200 text-[11px] leading-relaxed">
            {steps[currentIndex]?.description}
          </p>
        </div>
      </div>

      {/* Order Context Details Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-purple-500/20 space-y-1">
          <span className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold block">
            Recipient
          </span>
          <p className="text-white font-medium truncate">
            {deliveryDetails?.name || 'Authorized Client'}
          </p>
          <p className="text-[11px] text-purple-300 truncate">
            {deliveryDetails?.phone || 'Encrypted Channel'}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-purple-500/20 space-y-1">
          <span className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold block">
            Destination / Method
          </span>
          <p className="text-white font-medium truncate">
            {deliveryDetails?.address || 'Designated Coordinates'}
          </p>
          <p className="text-[11px] text-purple-300 truncate">
            {deliveryDetails?.method || 'Standard Rider Delivery'}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-purple-500/20 space-y-1">
          <span className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold block">
            Estimated Arrival
          </span>
          <p className="text-amber-300 font-bold">
            {currentIndex === 3 ? 'Delivered safely' : '~ 30 – 45 mins'}
          </p>
          <p className="text-[10px] text-purple-300">
            {currentIndex === 3 ? 'Archived order' : 'Real-time telemetry'}
          </p>
        </div>
      </div>

      {/* Interactive Status Simulator Controls */}
      {onUpdateStatus && (
        <div className="pt-2 border-t border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
              Simulate Status Progression (Demo Mode)
            </span>
            <span className="text-[10px] text-amber-300 font-medium">Click to update status</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { status: 'confirmed' as const, label: '1. Confirmed', icon: 'fa-check' },
              { status: 'processing' as const, label: '2. Processing', icon: 'fa-cube' },
              { status: 'in_transit' as const, label: '3. In Transit', icon: 'fa-truck-fast' },
              { status: 'delivered' as const, label: '4. Delivered', icon: 'fa-circle-check' }
            ].map(item => {
              const isActive = order.status === item.status || (item.status === 'confirmed' && (order.status === 'submitted' || order.status === 'payment_submitted')) || (item.status === 'in_transit' && order.status === 'out_for_delivery');
              return (
                <button
                  key={item.status}
                  onClick={() => onUpdateStatus(item.status)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                      : 'bg-purple-950/40 text-purple-200 border border-purple-500/30 hover:border-amber-400/50 hover:bg-purple-900/50'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} text-[10px]`}></i>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
