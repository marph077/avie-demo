/* Konto-Port (Welle F, F3) - wie Speicher und Netz.

   Die App verbindet ihn mit der Supabase-Sitzung:
     token() -> Promise auf das Zugangs-Token (Access-Token) oder null,
                wenn niemand angemeldet ist; erneuert es bei Bedarf.
   Der Kern haengt das Token an jede Anfrage an den Worker
   (Authorization: Bearer, felieRequest in modell.js); der Rumpf bleibt
   Vertrag 1. Der Worker prueft das Token selbst (worker/src/ports/konto.js).

   Ohne verbundenen Port - die Webapp bis F9 (Marcel F3-1 A) - ist jede
   Anfrage Zeichen fuer Zeichen wie bisher und geht synchron ab.

   Tests: tests/felie-f3-konto-kern.test.cjs; die Paywall nach dem ersten
   Anmelden tests/felie-f5-vorarbeit-kern.test.cjs. */

import { felieSpeicherLesen, felieSpeicherSchreiben } from './speicher.js';

let port = null;

export function felieKontoVerbinden(p) {
  port = p && typeof p.token === 'function' ? p : null;
}

export function felieKontoVerbunden() {
  return !!port;
}

/* Das Token oder null; ein Fehler (Sitzung nicht erneuerbar) kommt als
   Ablehnung an - dann geht keine Anfrage raus. */
export function felieKontoToken() {
  if (!port) return Promise.resolve(null);
  var p = port;
  return Promise.resolve().then(function () { return p.token(); });
}

/* ── Paywall nach dem ersten Anmelden (F5-3 A, Marcel 28.09.) ─────
   Einmal, direkt nach dem ersten Anmelden - Transparenz: sie soll wissen,
   dass felie kostet; ohne Hinweis auf ein Gratiskontingent. Einmal JE
   KONTO: der Merker liegt im Bestand des Kontos (in der App ein Bestand
   je Konto, Datenbindung A). Er steht bewusst weder in der Sicherung
   noch in der Loeschliste (FELIE_LS_KEYS): "Nutzerdaten loeschen" zeigt
   die Paywall nicht erneut. Mit aktivem Abo nie. */
export const FELIE_ERSTE_PAYWALL_KEY = 'felie_erste_paywall';

export function felieErstePaywallFaellig(aboAktiv) {
  if (aboAktiv) return false;
  try { return !felieSpeicherLesen(FELIE_ERSTE_PAYWALL_KEY); } catch (e) { return false; }
}

export function felieErstePaywallGezeigt() {
  try { felieSpeicherSchreiben(FELIE_ERSTE_PAYWALL_KEY, String(Date.now())); return true; } catch (e) { return false; }
}
