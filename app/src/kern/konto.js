/* Konto-Port (Welle F, F3) - wie Speicher und Netz.

   Die App verbindet ihn mit der Supabase-Sitzung:
     token() -> Promise auf das Zugangs-Token (Access-Token) oder null,
                wenn niemand angemeldet ist; erneuert es bei Bedarf.
   Der Kern haengt das Token an jede Anfrage an den Worker
   (Authorization: Bearer, felieRequest in modell.js); der Rumpf bleibt
   Vertrag 1. Der Worker prueft das Token selbst (worker/src/ports/konto.js).

   Ohne verbundenen Port - die Webapp bis F9 (Marcel F3-1 A) - ist jede
   Anfrage Zeichen fuer Zeichen wie bisher und geht synchron ab.

   Tests: tests/felie-f3-konto-kern.test.cjs. */

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
