export interface Env {
  BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  EVENT_INGEST_SECRET: string;
  WEB_APP_URL: string;
  OWNER_TELEGRAM_IDS?: string;
  SESSIONS: KVNamespace;
}

type TelegramUser = { id: number; first_name?: string; username?: string };
type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
};
type TelegramCallback = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};
type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallback };
type Button = { text: string; callback_data?: string; web_app?: { url: string } };
type Keyboard = Button[][];

const BOT_API = "https://api.telegram.org";

async function telegram<T>(env: Env, method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BOT_API}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { ok: boolean; result: T; description?: string };
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API error: ${response.status}`);
  return result.result;
}

async function sendMessage(env: Env, chatId: number, text: string, replyMarkup?: { inline_keyboard: Keyboard }) {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    disable_web_page_preview: true,
  });
}

async function editMessage(env: Env, chatId: number, messageId: number, text: string, replyMarkup?: { inline_keyboard: Keyboard }) {
  return telegram(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    disable_web_page_preview: true,
  });
}

async function answerCallback(env: Env, callbackId: string, text?: string) {
  return telegram(env, "answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
}

function portalButton(env: Env): Button {
  return { text: "✦ Launch Portal", web_app: { url: env.WEB_APP_URL } };
}

function mainMenu(env: Env, userId: number): Keyboard {
  const rows: Keyboard = [
    [{ text: "Welcome Center", callback_data: "menu:welcome" }, { text: "Guest Environment", callback_data: "menu:guest" }],
    [{ text: "Client Center", callback_data: "menu:client" }, { text: "Celestial Support", callback_data: "menu:support" }],
    [{ text: "Account Security", callback_data: "menu:security" }, { text: "Employee Access", callback_data: "menu:employee" }],
    [portalButton(env)],
  ];
  if ((env.OWNER_TELEGRAM_IDS || "").split(",").map(x => x.trim()).includes(String(userId))) {
    rows.splice(3, 0, [{ text: "Owner Command Center", callback_data: "menu:owner" }]);
  }
  return rows;
}

function menuText(key: string): { text: string; keyboard: Keyboard } {
  const menus: Record<string, { text: string; keyboard: Keyboard }> = {
    welcome: {
      text: "WELCOME CENTER\n\nChoose your journey. I can guide you through the lobby, explain the portal, or help you find the right section.",
      keyboard: [[{ text: "I'm new here", callback_data: "welcome:new" }, { text: "I'm returning", callback_data: "welcome:return" }], [{ text: "Main Menu", callback_data: "menu:home" }]],
    },
    guest: {
      text: "GUEST ENVIRONMENT\n\nExplore the public areas before entering the client journey.",
      keyboard: [[{ text: "Celestials", callback_data: "guest:celestials" }, { text: "Founders", callback_data: "guest:founders" }], [{ text: "Onboarding Session", callback_data: "guest:onboarding" }], [{ text: "Main Menu", callback_data: "menu:home" }]],
    },
    client: {
      text: "CLIENT CENTER\n\nChoose an account or Store topic. Account-specific records are not connected to this demo bot yet.",
      keyboard: [[{ text: "Account Access", callback_data: "client:access" }, { text: "Membership", callback_data: "client:membership" }], [{ text: "Store & Catalog", callback_data: "client:store" }, { text: "Orders & Tracking", callback_data: "client:orders" }], [portalButton({ WEB_APP_URL: "https://ecelestiallobby.github.io/celestial/access" } as Env)], [{ text: "Main Menu", callback_data: "menu:home" }]],
    },
    support: {
      text: "CELESTIAL SUPPORT\n\nSelect a topic to see the available guidance.",
      keyboard: [[{ text: "Policies & 3S", callback_data: "support:policies" }, { text: "Orders & Processing", callback_data: "support:orders" }], [{ text: "Pricing & Payments", callback_data: "support:payments" }, { text: "Delivery", callback_data: "support:delivery" }], [{ text: "Complaints & Review", callback_data: "support:review" }], [{ text: "Main Menu", callback_data: "menu:home" }]],
    },
    security: {
      text: "ACCOUNT SECURITY\n\nChoose the situation that best describes what happened.",
      keyboard: [[{ text: "Login Lockout", callback_data: "security:lockout" }, { text: "Onboarding Restriction", callback_data: "security:onboarding" }], [{ text: "Suspended / Disabled", callback_data: "security:suspended" }, { text: "Account Recovery", callback_data: "security:recovery" }], [{ text: "Main Menu", callback_data: "menu:home" }]],
    },
    employee: {
      text: "EMPLOYEE ACCESS\n\nEmployee dashboards are available through the portal. This bot does not request or store employee access codes.",
      keyboard: [[portalButton({ WEB_APP_URL: "https://ecelestiallobby.github.io/celestial/access" } as Env)], [{ text: "Access help", callback_data: "security:recovery" }, { text: "Main Menu", callback_data: "menu:home" }]],
    },
    owner: {
      text: "OWNER COMMAND CENTER\n\nOwner tools are reserved for approved Telegram accounts. The command interface is being prepared; no account, order, or policy changes can be made from this preview yet.",
      keyboard: [[{ text: "Open Owner Workspace", callback_data: "owner:portal" }], [{ text: "Main Menu", callback_data: "menu:home" }]],
    },
  };
  return menus[key] || menus.welcome;
}

function detail(data: string): { text: string; keyboard: Keyboard } {
  const pages: Record<string, { text: string; keyboard: Keyboard }> = {
    "welcome:new": { text: "WELCOME, NEW VISITOR\n\nStart in the Guest Environment. You can explore Celestials and Founders, then review the Onboarding Session before deciding whether to continue.", keyboard: [[{ text: "Guest Environment", callback_data: "menu:guest" }, { text: "Open Portal", callback_data: "portal" }], [{ text: "Main Menu", callback_data: "menu:home" }]] },
    "welcome:return": { text: "WELCOME BACK\n\nYou can reopen the portal or choose a topic here. Your Telegram menu state can be resumed when you return.", keyboard: [[{ text: "Open Portal", callback_data: "portal" }, { text: "Support", callback_data: "menu:support" }], [{ text: "Main Menu", callback_data: "menu:home" }]] },
    "guest:celestials": { text: "CELESTIALS\n\nExplore the Celestials section in the Guest Environment.", keyboard: [[{ text: "Open Guest Environment", callback_data: "portal:guest" }], [{ text: "Back", callback_data: "menu:guest" }]] },
    "guest:founders": { text: "FOUNDERS\n\nVisit the Founders section in the Guest Environment.", keyboard: [[{ text: "Open Guest Environment", callback_data: "portal:guest" }], [{ text: "Back", callback_data: "menu:guest" }]] },
    "guest:onboarding": { text: "ONBOARDING SESSION\n\nRead the instructions and requirements before starting. Leaving or interrupting an active onboarding session triggers a 24-hour viewing-only restriction in the current portal demo.", keyboard: [[{ text: "Open Onboarding", callback_data: "portal:onboarding" }], [{ text: "Restriction Help", callback_data: "menu:security" }, { text: "Back", callback_data: "menu:guest" }]] },
    "client:access": { text: "ACCOUNT ACCESS\n\nUse your assigned Access ID and AGP Code in the portal. Never send your code to this bot or to another person.", keyboard: [[{ text: "Open Access Gate", callback_data: "portal" }], [{ text: "Recovery Help", callback_data: "security:recovery" }, { text: "Back", callback_data: "menu:client" }]] },
    "client:membership": { text: "MEMBERSHIP\n\nMembership and account-specific eligibility must be checked in the portal. This preview bot cannot inspect a live membership record.", keyboard: [[{ text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:client" }]] },
    "client:store": { text: "STORE & CATALOG\n\nThe portal contains the Store preview and catalog. Checkout is a preview only in this demo. Do not send payment details or payment screenshots to this bot.", keyboard: [[{ text: "Open Store Portal", callback_data: "portal" }], [{ text: "Pricing & Payments", callback_data: "support:payments" }, { text: "Back", callback_data: "menu:client" }]] },
    "client:orders": { text: "ORDERS & TRACKING\n\nLive order lookup is not connected to this bot. Use the portal's available tracker for demo information. Do not treat demo records as real orders.", keyboard: [[{ text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:client" }]] },
    "support:policies": { text: "POLICIES & 3S\n\nThe five non-negotiables are: No COD, No Meet Ups, No Refunds, No Rush Orders, and No Spamming. The 3S framework is Security, Secrecy, and Safety. Review the official policy pages in the portal for the complete terms.", keyboard: [[{ text: "Open Policies", callback_data: "portal:faqs" }], [{ text: "Back", callback_data: "menu:support" }]] },
    "support:orders": { text: "ORDERS & PROCESSING\n\nPublished process guidance includes an estimated 1–2 hours for confirmation and up to 1 hour for preparation. These are estimates, not guarantees. This demo bot cannot verify a live order.", keyboard: [[{ text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:support" }]] },
    "support:payments": { text: "PRICING & PAYMENTS\n\nUse only the payment instructions shown through the official CELESTIAL LOBBY process. Never send card details, passwords, or payment screenshots to this bot. The current website checkout is preview-only.", keyboard: [[{ text: "Open Store Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:support" }]] },
    "support:delivery": { text: "DELIVERY & FULFILLMENT\n\nLocation assessment is estimated at 1–5 hours; overall processing may take 4–5 hours or more depending on the workflow. These are estimates and not a delivery-time promise.", keyboard: [[{ text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:support" }]] },
    "support:review": { text: "COMPLAINTS & REVIEW\n\nThis preview can explain policies but cannot approve exceptions or change an Owner decision. A future review-request workflow will route eligible cases for Owner review. No review request has been submitted from this menu.", keyboard: [[{ text: "Read Policies", callback_data: "support:policies" }], [{ text: "Back", callback_data: "menu:support" }]] },
    "security:lockout": { text: "LOGIN LOCKOUT\n\nThe current portal demo locks access for 1 hour after 3 invalid attempts. Wait for the lockout to expire, then retry carefully. Account recovery guidance is available if you cannot access your credentials. This browser-local demo cannot verify or lift a real account lock.", keyboard: [[{ text: "Recovery Help", callback_data: "security:recovery" }, { text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:security" }]] },
    "security:onboarding": { text: "ONBOARDING RESTRICTION\n\nIn the current portal rules, leaving, declining, closing, or interrupting an active onboarding session terminates that session and applies a 24-hour viewing-only restriction. Store access and onboarding continuation are blocked during that period. The last completed step is preserved where browser storage allows.", keyboard: [[{ text: "Open Guest View", callback_data: "portal:guest" }, { text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:security" }]] },
    "security:suspended": { text: "SUSPENDED OR DISABLED\n\nThe bot needs a verified account status and reason before it can explain a specific suspension. This demo cannot inspect or reverse account status. Use the official account review route when it becomes available; the bot cannot promise an exception.", keyboard: [[{ text: "Account Recovery", callback_data: "security:recovery" }], [{ text: "Back", callback_data: "menu:security" }]] },
    "security:recovery": { text: "ACCOUNT RECOVERY\n\nUse the recovery option in the portal and follow its account-specific verification steps. Never send your AGP Code, passwords, payment details, or identity documents in this chat.", keyboard: [[{ text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:security" }]] },
    "owner:portal": { text: "OWNER WORKSPACE\n\nOpen the portal to access the current Owner preview. Owner actions remain browser-demo controls and are not securely authenticated by this bot yet.", keyboard: [[{ text: "Open Portal", callback_data: "portal" }], [{ text: "Back", callback_data: "menu:owner" }]] },
  };
  return pages[data] || { text: "Choose a topic from the menu below.", keyboard: [[{ text: "Main Menu", callback_data: "menu:home" }]] };
}

async function saveUser(env: Env, user: TelegramUser, lastMenu?: string) {
  const key = `user:${user.id}`;
  const previous = await env.SESSIONS.get(key, "json") as Record<string, unknown> | null;
  await env.SESSIONS.put(key, JSON.stringify({
    telegramId: user.id,
    username: user.username || null,
    firstName: user.first_name || null,
    firstSeenAt: previous?.firstSeenAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    visits: Number(previous?.visits || 0) + 1,
    lastMenu: lastMenu || previous?.lastMenu || "home",
  }));
  return previous;
}

async function handleMessage(env: Env, message: TelegramMessage) {
  if (message.chat.type !== "private" || !message.from) return;
  const previous = await saveUser(env, message.from);
  const text = (message.text || "").trim();
  if (text.startsWith("/start")) {
    const greeting = previous
      ? `Welcome back${message.from.first_name ? `, ${message.from.first_name}` : ""}. Your CELESTIAL LOBBY menu is ready.`
      : `Welcome to CELESTIAL LOBBY${message.from.first_name ? `, ${message.from.first_name}` : ""}. This bot is your guide to the lobby, portal, and support topics.`;
    const lastMenu = typeof previous?.lastMenu === "string" ? previous.lastMenu : "home";
    const canResume = ["welcome", "guest", "client", "support", "security", "employee", "owner"].includes(lastMenu);
    const keyboard = previous && canResume
      ? [[{ text: "Resume Last Section", callback_data: `resume:${lastMenu}` }], [{ text: "Main Menu", callback_data: "menu:home" }]]
      : mainMenu(env, message.from.id);
    await sendMessage(env, message.chat.id, `${greeting}\n\nChoose a destination below. You can return to this menu at any time with /menu.`, { inline_keyboard: keyboard });
    return;
  }
  if (/^\/(menu|help)(@\w+)?$/i.test(text)) {
    await sendMessage(env, message.chat.id, "CELESTIAL LOBBY · MAIN MENU\n\nChoose a destination.", { inline_keyboard: mainMenu(env, message.from.id) });
    return;
  }
  if (text.startsWith("/guest")) return sendMessage(env, message.chat.id, menuText("guest").text, { inline_keyboard: menuText("guest").keyboard });
  if (text.startsWith("/support")) return sendMessage(env, message.chat.id, menuText("support").text, { inline_keyboard: menuText("support").keyboard });
  if (text.startsWith("/security")) return sendMessage(env, message.chat.id, menuText("security").text, { inline_keyboard: menuText("security").keyboard });
  await sendMessage(env, message.chat.id, "I can guide you using the buttons below. Choose a topic rather than sending passwords, payment details, or private documents.", { inline_keyboard: mainMenu(env, message.from.id) });
}

async function handleCallback(env: Env, callback: TelegramCallback) {
  await answerCallback(env, callback.id);
  const message = callback.message;
  if (!message || message.chat.type !== "private") return;
  const data = callback.data || "";
  const ownerIds = (env.OWNER_TELEGRAM_IDS || "").split(",").map(x => x.trim()).filter(Boolean);
  const isOwner = ownerIds.includes(String(callback.from.id));
  const requestedMenu = data.startsWith("menu:") ? data.slice(5) : data.startsWith("resume:") ? data.slice(7) : data.split(":")[0];
  const validMenus = ["welcome", "guest", "client", "support", "security", "employee", "owner"];
  await saveUser(env, callback.from, validMenus.includes(requestedMenu) ? requestedMenu : undefined);

  // Never rely on a hidden button as authorization. Validate every Owner callback server-side.
  if ((requestedMenu === "owner" || data.startsWith("owner:")) && !isOwner) {
    await editMessage(env, message.chat.id, message.message_id, "This section is restricted to an approved Owner Telegram account.", {
      inline_keyboard: [[{ text: "Main Menu", callback_data: "menu:home" }]],
    });
    return;
  }

  if (data.startsWith("resume:")) {
    const menu = menuText(data.slice(7));
    await editMessage(env, message.chat.id, message.message_id, menu.text, { inline_keyboard: menu.keyboard });
    return;
  }
  if (data === "menu:home") {
    await editMessage(env, message.chat.id, message.message_id, "CELESTIAL LOBBY · MAIN MENU\n\nChoose a destination.", { inline_keyboard: mainMenu(env, callback.from.id) });
    return;
  }
  if (data.startsWith("menu:")) {
    const key = data.slice(5);
    const menu = menuText(key);
    await editMessage(env, message.chat.id, message.message_id, menu.text, { inline_keyboard: menu.keyboard });
    return;
  }
  if (data === "portal" || data === "portal:guest" || data === "portal:onboarding" || data === "portal:faqs") {
    const suffix = data === "portal:guest" ? "/guest" : data === "portal:onboarding" ? "/guest" : data === "portal:faqs" ? "/faqs" : "";
    await editMessage(env, message.chat.id, message.message_id, "Open the CELESTIAL LOBBY portal inside Telegram. The website remains a demo environment.", { inline_keyboard: [[{ text: "✦ Launch Portal", web_app: { url: `${env.WEB_APP_URL.replace(/\/$/, "")}${suffix}` } }], [{ text: "Main Menu", callback_data: "menu:home" }]] });
    return;
  }
  const page = detail(data);
  await editMessage(env, message.chat.id, message.message_id, page.text, { inline_keyboard: page.keyboard });
}

async function notifyRestriction(env: Env, payload: Record<string, unknown>) {
  const telegramUserId = Number(payload.telegramUserId);
  const type = String(payload.type || "");
  const reason = String(payload.reason || "").slice(0, 500);
  const until = typeof payload.until === "string" ? payload.until.slice(0, 80) : "";
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0 || !reason || !["lockout", "onboarding", "suspension", "kicked_out"].includes(type)) {
    return new Response("Invalid notification payload", { status: 400 });
  }
  const labels: Record<string, string> = {
    lockout: "LOGIN LOCKOUT",
    onboarding: "ONBOARDING RESTRICTION",
    suspension: "ACCOUNT SUSPENSION",
    kicked_out: "ACCESS TERMINATED",
  };
  const duration = until ? `\n\nRestriction expiry / review time: ${until}` : "";
  const nextSteps = type === "lockout"
    ? "Wait until the lockout expires, then retry. Use account recovery if you still cannot access your account."
    : type === "onboarding"
      ? "The current portal rule applies a 24-hour viewing-only restriction after an interrupted or declined onboarding session. You may use Guest Environment while Store access and onboarding continuation are blocked."
      : type === "suspension"
        ? "Review the stated reason and use the official review route when available. The bot cannot promise an exception or reverse an Owner decision."
        : "Your current access session has ended. You can return to Guest Environment or use the account recovery route if you believe this happened in error.";
  await sendMessage(env, telegramUserId, `CELESTIAL LOBBY · ${labels[type]}\n\nReason: ${reason}${duration}\n\nAvailable next steps:\n${nextSteps}`, {
    inline_keyboard: [[{ text: "Account Security", callback_data: "menu:security" }, { text: "Support", callback_data: "menu:support" }], [{ text: "Open Portal", web_app: { url: env.WEB_APP_URL } }]],
  });
  return new Response("Notification sent", { status: 200 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "celestial-lobby-telegram-bot", mode: "webhook", configured: Boolean(env.BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.WEB_APP_URL) });
    }
    if (request.method === "POST" && url.pathname === "/events/restriction") {
      if (!env.EVENT_INGEST_SECRET || request.headers.get("authorization") !== `Bearer ${env.EVENT_INGEST_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const payload = await request.json() as Record<string, unknown>;
        return await notifyRestriction(env, payload);
      } catch {
        return new Response("Could not process restriction event", { status: 400 });
      }
    }
    if (request.method !== "POST" || url.pathname !== "/webhook") return new Response("Not found", { status: 404 });
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const update = await request.json() as TelegramUpdate;
      if (update.message) await handleMessage(env, update.message);
      if (update.callback_query) await handleCallback(env, update.callback_query);
      return new Response("OK");
    } catch (error) {
      console.error("Telegram update failed", error);
      return new Response("Update failed", { status: 500 });
    }
  },
};
