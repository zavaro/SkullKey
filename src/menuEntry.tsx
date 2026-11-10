import { FaSkull } from "react-icons/fa";
import { registerSteamMenu } from "./steamMenu";

// The SkullKey entry in Steam's main menu can be turned off; the Quick Access
// panel stays available either way (same option as Steamcord #86).
const ENABLED_KEY = "SKULLKEY_MENU_ENTRY";
let unregister: (() => void) | undefined;

const SkullMenuIcon = FaSkull as any;
const register = () => registerSteamMenu({ id: "skullkey", label: "SkullKey", route: "/skullkey", icon: <SkullMenuIcon />, order: 20 });

// SkullKey uses Decky's legacy API; patchMenu receives it at plugin start.
type LegacyApi = { callPluginMethod: (name: string, args: object) => Promise<{ success: boolean; result: any }> };
let api: LegacyApi | undefined;
const loadBackend = async (): Promise<"on" | "off" | null> => {
  if (!api) throw new Error("no backend");
  const r = await api.callPluginMethod("get_menu_entry", {});
  if (!r.success) throw new Error("backend error");
  return r.result;
};
const saveBackend = async (on: boolean) => { await api?.callPluginMethod("set_menu_entry", { on }); };

export function menuEntryEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) !== "0"; } catch { return true; }
}

const apply = (on: boolean) => {
  if (on && !unregister) unregister = register();
  else if (!on && unregister) { unregister(); unregister = undefined; }
};

const storeLocal = (on: boolean) => {
  try { localStorage.setItem(ENABLED_KEY, on ? "1" : "0"); } catch {}
};

export function setMenuEntryEnabled(on: boolean) {
  storeLocal(on);
  // The backend copy is what counts at the next start (Steamcord #86):
  // Steam's localStorage can come back with an older value after a restart.
  saveBackend(on).catch(() => {});
  apply(on);
}

let started = 0;

export function patchMenu(serverApi?: LegacyApi): () => void {
  const run = ++started;
  api = serverApi ?? api;
  loadBackend()
    .then((menu) => {
      if (run !== started) return;
      if (menu === "on" || menu === "off") {
        storeLocal(menu === "on");
        apply(menu === "on");
      } else {
        // First start with this version: keep the local choice and save it.
        const on = menuEntryEnabled();
        saveBackend(on).catch(() => {});
        apply(on);
      }
    })
    .catch(() => { if (run === started) apply(menuEntryEnabled()); });
  return () => { started++; unregister?.(); unregister = undefined; };
}
