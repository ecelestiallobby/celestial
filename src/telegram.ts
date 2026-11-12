type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  offEvent?: (eventType: string, eventHandler: () => void) => void;
  viewportHeight?: number;
  viewportStableHeight?: number;
  isExpanded?: boolean;
  initData?: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Presentation-only Telegram Mini App initialization. initData is not trusted for auth. */
export function initializeTelegramWebApp(): void {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;

  try {
    webApp.ready();
    webApp.expand();
    webApp.setHeaderColor?.("#080b17");
    webApp.setBackgroundColor?.("#080b17");
    const updateViewport = () => {
      const height = webApp.viewportStableHeight || webApp.viewportHeight;
      if (height) document.documentElement.style.setProperty("--telegram-viewport-height", `${height}px`);
    };
    updateViewport();
    webApp.onEvent?.("viewportChanged", updateViewport);
  } catch (error) {
    console.warn("Telegram Mini App initialization was skipped.", error);
  }
}
