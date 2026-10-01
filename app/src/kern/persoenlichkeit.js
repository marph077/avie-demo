/* Persoenlichkeit (F6d-1, Marcel 30.09.): fuenf Stufen 1-5 und Humor, wie
   die Regler der Webapp (showPersonality). Gespeichert unter
   felie_personality ueber den Speicher-Port - in der App im Bestand des
   Kontos, in der Webapp in localStorage (dort liest die Webapp ihn weiter
   selbst ueber loadPersonality; der Kern nimmt ihn, wenn die Plattform keine
   eigene liefert, s. felieRequest).

   Nur Zahlen 1-5 und ein Wahrheitswert: der Worker prueft dasselbe
   (worker/src/prompt/vertrag.js), hier kommt schon nichts anderes an. Bis
   F6d stand die Voreinstellung in modell.js. */
import { felieSpeicherLesen, felieSpeicherSchreiben } from './speicher.js';

export var PERSONALITY_DEFAULTS = { waerme: 3, direktheit: 4, ausfuehrlichkeit: 3, koerperbezug: 4, ton: 3, humor: false };
var STUFEN = ['waerme', 'direktheit', 'ausfuehrlichkeit', 'koerperbezug', 'ton'];

/* Texte der Regler, 1:1 aus showPersonality der Webapp (freigegeben mit F6d,
   Marcel 30.09.); die Einleitung (D-5) steht in FELIE_EINSTELLUNGEN_TEXTE. */
export var FELIE_PERSOENLICHKEIT_TEXTE = Object.freeze({
  titel: 'felies Persönlichkeit', unterzeile: 'So verhält sich felie dir gegenüber',
  regler: Object.freeze([
    Object.freeze({ key: 'waerme', label: 'Wärme', links: 'sachlich', rechts: 'warm' }),
    Object.freeze({ key: 'direktheit', label: 'Direktheit', links: 'behutsam', rechts: 'direkt' }),
    Object.freeze({ key: 'ausfuehrlichkeit', label: 'Ausführlichkeit', links: 'kurz', rechts: 'ausführlich' }),
    Object.freeze({ key: 'koerperbezug', label: 'Körperdaten-Bezug', links: 'dezent', rechts: 'ausführlich' }),
    Object.freeze({ key: 'ton', label: 'Ton', links: 'ruhig', rechts: 'ermutigend' })]),
  humor: 'Humor', humorUnterzeile: 'leichter Humor, wenn es passt', an: 'An', aus: 'Aus',
  speichern: 'Persönlichkeit speichern', zuruecksetzen: 'Auf Standard zurücksetzen'
});
var SCHLUESSEL = 'felie_personality';

function bereinigt(p) {
  p = p && typeof p === 'object' ? p : {};
  var raus = {};
  STUFEN.forEach(function (k) {
    var v = typeof p[k] === 'string' && /^[1-5]$/.test(p[k]) ? Number(p[k]) : p[k];
    raus[k] = Number.isInteger(v) && v >= 1 && v <= 5 ? v : PERSONALITY_DEFAULTS[k];
  });
  raus.humor = p.humor === true;
  return raus;
}

export function feliePersoenlichkeit() {
  var p = null;
  try { p = JSON.parse(felieSpeicherLesen(SCHLUESSEL) || 'null'); } catch (e) { p = null; }
  return bereinigt(p);
}

export function feliePersoenlichkeitSpeichern(p) {
  try { felieSpeicherSchreiben(SCHLUESSEL, JSON.stringify(bereinigt(p))); return true; } catch (e) { return false; }
}

export function feliePersoenlichkeitZuruecksetzen() {
  return feliePersoenlichkeitSpeichern(PERSONALITY_DEFAULTS);
}
