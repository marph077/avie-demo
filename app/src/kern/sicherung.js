/* Backup (Sicherung) der Daten (F7a): erstellen, pruefen, einspielen.

   Ein Format fuer Webapp und spaeter die App (F7c, zurueckgestellt):
   { app: 'felie', version: 1, exportedAt, store: { schluessel: wert } } mit
   den Rohwerten aller FELIE_LS_KEYS - dasselbe wie bisher felieBackupData
   der Webapp, damit jedes vorhandene Backup einspielbar bleibt (auch die
   alten mit app 'avie' und avie_-Schluesseln, und ohne version).

   Einspielen (E-D2: ersetzt; F-16: prueft, ueberspringt Unlesbares und
   nennt es; Befund L4, gemessen 01.10.):
   - nur Bereiche der Sicherung (FELIE_SICHERUNG_FORM) - keine Merker wie
     felie_erste_paywall, keine Kennung wie felie_session_id;
   - jeder Wert muss die Form haben, die sein Leser erwartet;
   - was im Backup fehlt, ist danach weg; ein unlesbarer Teil laesst den
     heutigen Wert dieses Teils unangetastet (selbst entschieden, F7a);
   - ist nichts lesbar oder die Version neuer als diese Fassung, aendert
     sich nichts ("kein gueltiges felie-Backup"; T4 entfaellt);
   - in einer Transaktion; danach haelt der Arbeitsspeicher den
     eingespielten Stand, laufende Arbeit gilt nicht mehr (Epoche).
   Wortlaute freigegeben 01.10. (F7-T1, T2, T3). */
import { FELIE_LS_KEYS, FELIE_LS_KEYS_ALTLAST, felieSpeicherLesen, felieSpeicherLoeschen, felieSpeicherSchreiben,
  felieSpeicherTransaktion } from './speicher.js';
import { felieArbeitsspeicherLeeren } from './store.js';
import { felieKoerperZuruecksetzen } from './zyklus.js';
import { felieKoerperLaden } from './koerper.js';
import { felieDatenEpocheErhoehen } from './abschluss.js';

export const FELIE_SICHERUNG_VERSION = 1;

function frieren(o) {
  Object.values(o).forEach(function (v) { if (v && typeof v === 'object') frieren(v); });
  return Object.freeze(o);
}

export const FELIE_SICHERUNG_TEXTE = frieren({
  eingespielt: 'Backup eingespielt. Die App wird jetzt neu geladen.',
  uebersprungen: 'Backup eingespielt. Diese Teile konnte ich nicht lesen und habe sie übersprungen: {bereiche}. Die App wird jetzt neu geladen.',
  keine: 'Das ist kein gültiges felie-Backup.',
  bereiche: {
    angaben: 'deine Angaben', gespraeche: 'deine Gespräche', gedaechtnis: 'dein Gedächtnis',
    zyklus: 'dein Zyklus', persoenlichkeit: 'meine Persönlichkeit'
  }
});

/* Je Schluessel der Sicherung: die Form, die sein Leser erwartet, und der
   Bereich, unter dem ein unlesbarer Wert genannt wird (null: ein Merker
   ohne Inhalt, still uebersprungen). Jeder Schluessel aus FELIE_LS_KEYS
   steht hier (Pruefung F7a S8). */
export const FELIE_SICHERUNG_FORM = frieren({
  felie_profile: ['objekt', 'angaben'],
  felie_onboarding_v1: ['objekt', 'angaben'],
  felie_saved_chats: ['liste', 'gespraeche'],
  felie_archiv_wartend: ['beides', 'gespraeche'],
  felie_abschluss_wartend: ['liste', 'gespraeche'],
  felie_store_v1: ['store', 'gedaechtnis'],
  felie_dataset_v2: ['objekt', 'gedaechtnis'],
  felie_neue_snippets: ['objekt', 'gedaechtnis'],
  felie_body_data: ['objekt', 'zyklus'],
  felie_personality: ['objekt', 'persoenlichkeit'],
  felie_guide_home: ['merker', null],
  felie_backup_hint_off: ['merker', null]
});
var BEREICHE = ['angaben', 'gespraeche', 'gedaechtnis', 'zyklus', 'persoenlichkeit'];

function lesbar(form, wert) {
  if (typeof wert !== 'string') return false;
  if (form === 'merker') return wert.length <= 40;
  var o;
  try { o = JSON.parse(wert); } catch (e) { return false; }
  if (!o || typeof o !== 'object') return false;
  if (form === 'liste') return Array.isArray(o);
  if (form === 'beides') return true;
  if (Array.isArray(o)) return false;
  if (form === 'store') return ['signale', 'fakten', 'episoden'].every(function (k) { return o[k] == null || Array.isArray(o[k]); });
  return true;
}

export function felieSicherungErstellen(jetztMs) {
  var store = {};
  FELIE_LS_KEYS.forEach(function (k) {
    var v = null;
    try { v = felieSpeicherLesen(k); } catch (e) {}
    if (v != null) store[k] = v;
  });
  return { app: 'felie', version: FELIE_SICHERUNG_VERSION, exportedAt: new Date(jetztMs || Date.now()).toISOString(), store: store };
}

/* { ok: false } oder { ok: true, werte, behalten, uebersprungen } -
   uebersprungen sind Bereiche in fester Reihenfolge. */
export function felieSicherungPruefen(text) {
  var d;
  try { d = JSON.parse(text); } catch (e) { return { ok: false }; }
  if (!d || typeof d !== 'object' || (d.app !== 'felie' && d.app !== 'avie')) return { ok: false };
  if (!d.store || typeof d.store !== 'object' || Array.isArray(d.store)) return { ok: false };
  if (d.version != null && !(typeof d.version === 'number' && d.version >= 0 && d.version <= FELIE_SICHERUNG_VERSION)) return { ok: false };
  var werte = {}, behalten = [], weg = {};
  Object.keys(d.store).forEach(function (k) {
    var key = k.indexOf('avie_') === 0 ? 'felie_' + k.slice(5) : k;
    var form = FELIE_SICHERUNG_FORM[key];
    if (!form) return;
    if (lesbar(form[0], d.store[k])) { werte[key] = d.store[k]; return; }
    behalten.push(key);
    if (form[1]) weg[form[1]] = true;
  });
  if (!Object.keys(werte).length) return { ok: false };
  return { ok: true, werte: werte, behalten: behalten, uebersprungen: BEREICHE.filter(function (b) { return weg[b]; }) };
}

export function felieSicherungEinspielen(geprueft) {
  if (!geprueft || !geprueft.ok) return false;
  felieSpeicherTransaktion(function () {
    FELIE_LS_KEYS.concat(FELIE_LS_KEYS_ALTLAST).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(geprueft.werte, k)) felieSpeicherSchreiben(k, geprueft.werte[k]);
      else if (geprueft.behalten.indexOf(k) < 0) felieSpeicherLoeschen(k);
    });
  });
  try { felieDatenEpocheErhoehen(); } catch (e) {}
  try { felieArbeitsspeicherLeeren(); } catch (e) {}
  try { felieKoerperZuruecksetzen(); } catch (e) {}
  try { felieKoerperLaden(); } catch (e) {}
  return true;
}

export function felieSicherungMeldung(geprueft) {
  if (!geprueft || !geprueft.ok) return FELIE_SICHERUNG_TEXTE.keine;
  var namen = geprueft.uebersprungen.map(function (b) { return FELIE_SICHERUNG_TEXTE.bereiche[b]; });
  if (!namen.length) return FELIE_SICHERUNG_TEXTE.eingespielt;
  var liste = namen.length === 1 ? namen[0] : namen.slice(0, -1).join(', ') + ' und ' + namen[namen.length - 1];
  return FELIE_SICHERUNG_TEXTE.uebersprungen.replace('{bereiche}', liste);
}
