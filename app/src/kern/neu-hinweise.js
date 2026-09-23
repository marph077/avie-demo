/* Neu aus dem letzten Gespraech - seit Welle D, Paket D1b, ein
   Kern-Modul. Gelesen und geschrieben wird ueber den Speicher-Port.

   felieHinweisVonIhr und felieNeuHinweiseNachziehen stehen seit D1c in
   bruecke.js: sie brauchen die Bruecke, und dieses Modul soll sie nicht
   kennen.

   Der urspruengliche Wortlaut folgt unveraendert; geaendert sind nur die
   Zugriffe auf localStorage. */

import { felieSpeicherLesen, felieSpeicherSchreiben, felieSpeicherLoeschen } from './speicher.js';

/* ── Neu aus dem letzten Gespraech ────────────────────────────────────
   Seit das Gespraech beim Schliessen ohne Rueckfrage uebernommen wird,
   sieht die Nutzerin nicht mehr, WAS felie sich gemerkt hat. Diese Liste
   traegt die Kennungen des letzten Schwungs, damit der Startbildschirm
   darauf hinweisen und das Gedaechtnis sie hervorheben kann.
     Bewusst ein eigener Speicherschluessel und kein Feld an den
   Eintraegen selbst: die Markierung ist eine Ansichtssache und soll
   weder in Backups als Inhalt auftauchen noch von der Bereinigung
   angefasst werden. Fehlende Eintraege (geloescht) stoeren nicht — es
   wird nur nach Kennung verglichen. */
export const FELIE_NEU_KEY = 'felie_neue_snippets';

export function felieNeueSnippets() {
  try {
    var o = JSON.parse(felieSpeicherLesen(FELIE_NEU_KEY) || 'null');
    if (o && Array.isArray(o.ids)) return { ids: o.ids, gesehen: o.gesehen === true,
      hinweise: Array.isArray(o.hinweise) ? o.hinweise : [] };
  } catch (e) {}
  return { ids: [], gesehen: true, hinweise: [] };
}

export function felieNeueSnippetsSchreiben(stand) {
  try {
    if (!stand.ids.length && !stand.hinweise.length) felieSpeicherLoeschen(FELIE_NEU_KEY);
    else felieSpeicherSchreiben(FELIE_NEU_KEY, JSON.stringify(stand));
  } catch (e) {}
  return stand;
}

/* Der Hinweis zu einer Angabe, solange er ungelesen ist. */
export function felieNeuHinweis(id) {
  var stand = felieNeueSnippets();
  if (stand.gesehen) return null;
  return stand.hinweise.filter(function (x) { return x.id === id; })[0] || null;
}

export function felieNeueSnippetsSetzen(ids) {
  var liste = (ids || []).filter(Boolean);
  var vorhandene = felieNeueSnippets().hinweise;
  try {
    if (!liste.length && !vorhandene.length) felieSpeicherLoeschen(FELIE_NEU_KEY);
    /* gesehen:false ist der Ausloeser fuer den Puls. Ein neuer Schwung
       ersetzt den alten vollstaendig: hervorgehoben wird immer nur das
       ZULETZT gespeicherte Gespraech, sonst waechst die Liste mit jedem
       Gespraech und "neu" verliert seine Bedeutung. */
    else felieSpeicherSchreiben(FELIE_NEU_KEY,
      JSON.stringify({ ids: liste, gesehen: false, hinweise: vorhandene }));
  } catch (e) {}
  return liste.length;
}

export function felieNeueSnippetsGesehen() {
  var n = felieNeueSnippets();
  if ((!n.ids.length && !n.hinweise.length) || n.gesehen) return false;
  /* Nach der Kenntnisnahme faellt der Vorher-Text weg: er wurde allein
     fuer diesen Hinweis gehalten. Das aktuelle Snippet bleibt. */
  n.gesehen = true;
  n.hinweise = n.hinweise.map(function (x) {
    return { id: x.id, nachher: x.nachher, art: x.art }; });
  felieNeueSnippetsSchreiben(n);
  return true;
}
