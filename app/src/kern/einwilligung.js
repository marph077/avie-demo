/* Einwilligungen und Sperre vor dem Senden (F6d-1, Marcel 30.09.).

   Das Profil (felie_profile = { userName, klAnswers, consent }) liest und
   schreibt der Kern ueber einen Profil-Anschluss (felieProfilVerbinden) -
   die Webapp haelt Name, Alter und Einwilligungen in eigenen Variablen und
   schliesst sie so an. Ohne Anschluss (App, Tests) gilt der Speicher-Port:
   gelesen wird bei jedem Zugriff, geschrieben sofort (bis F6d in
   mobile/profil/app-profil.js).

   Nachweis (Art. 7 Abs. 1 DSGVO, Marcel 28.09.): consent.nachweis[welche] =
   { erteilt, am, fassung }; die Fassung (Freigabe-Kennung plus Pruefsumme
   des Wortlauts) liefert die Plattform, die den Text zeigt. Beim Widerruf
   bleiben Fassung und Zeitpunkt der Einwilligung stehen (erteiltAm).

   D-1 A: nach dem Widerruf der Datenverarbeitung antwortet felie nicht
   mehr - felieRequest fragt nicht an (felieDatenverarbeitungErlaubt), der
   Fehler traegt den festen Satz (felieHinweis). Alles auf dem Geraet
   bleibt. D-2 A: nur die Datenverarbeitung ist widerrufbar; der Hinweis
   "keine Aerztin" und "18+ / Nutzungsbedingungen" sind Bestaetigungen
   (Kanzlei-Frage AL-116). Gemessen vor F6d: kein Sendeweg kannte die
   Einwilligung (Befund 2). */
import { felieSpeicherLesen, felieSpeicherSchreiben } from './speicher.js';

export var FELIE_EINWILLIGUNGEN = ['alter18', 'medizinHinweis', 'datenschutz'];

/* Freigegeben 30.09. (docs/freigabe.md, F6d). */
export var FELIE_EINSTELLUNGEN_TEXTE = {
  titel: 'Einstellungen', unterzeile: 'Konto, Einwilligungen und Hilfe',
  einwilligungenTitel: 'Deine Einwilligungen',
  einwilligung: {
    datenschutz: 'Verarbeitung deiner Angaben zu Körper, Zyklus und Wohlbefinden',
    medizinHinweis: 'Hinweis: felie ist keine Ärztin',
    alter18: 'Mindestens 18 und Nutzungsbedingungen'
  },
  erteiltAm: 'erteilt am ', bestaetigtAm: 'bestätigt am ', widerrufenAm: 'widerrufen am ',
  widerrufen: 'Widerrufen', wiederEinwilligen: 'Wieder einwilligen', einwilligen: 'Einwilligen',
  widerrufTitel: 'Einwilligung widerrufen?',
  widerrufText: 'Dann kann ich dir nicht mehr antworten: deine Nachrichten gehen nicht mehr an den KI-Dienst. Dein Gedächtnis, deine Gespräche und deine Angaben bleiben auf diesem Gerät. Du kannst jederzeit wieder einwilligen.',
  abbrechen: 'Abbrechen',
  ohneEinwilligung: 'Ohne deine Einwilligung kann ich dir nicht antworten. In den Einstellungen kannst du wieder einwilligen.',
  persoenlichkeitEintrag: 'felies Persönlichkeit',
  persoenlichkeitEinleitung: 'Stell ein, wie sich felie anfühlen soll. Du kannst das jederzeit ändern. Ich richte mich ab sofort danach.',
  allesLoeschen: 'Alle Daten löschen', allesLoeschenTitel: 'Alle Daten löschen?',
  nameFehler: 'Bitte trage deinen Vornamen ein, oder lass das Feld leer.',
  alterFehler: 'Bitte gib dein Alter als ganze Zahl zwischen 18 und 120 ein.'
};

var SCHLUESSEL = 'felie_profile';
var anschluss = null;

export function felieProfilVerbinden(p) { anschluss = p || null; }

function form(p) {
  p = p && typeof p === 'object' ? p : {};
  return { userName: typeof p.userName === 'string' ? p.userName : '',
    klAnswers: p.klAnswers && typeof p.klAnswers === 'object' ? p.klAnswers : {},
    consent: p.consent && typeof p.consent === 'object' ? p.consent : {} };
}

export function felieProfil() {
  if (anschluss) return form(anschluss.lesen());
  var p = null;
  try { p = JSON.parse(felieSpeicherLesen(SCHLUESSEL) || 'null'); } catch (e) { p = null; }
  return form(p);
}

/* Das ganze Profil zurueckschreiben (nach felieProfil() und einer Aenderung). */
export function felieProfilSichern(p) {
  p = form(p === undefined ? felieProfil() : p);
  if (anschluss) { try { return anschluss.schreiben(p) !== false; } catch (e) { return false; } }
  try { felieSpeicherSchreiben(SCHLUESSEL, JSON.stringify(p)); return true; } catch (e) { return false; }
}

/* Profil-Port des Kennenlernens: { userName } bzw. { alter: { exakt, am } | null }. */
export function felieProfilSetzen(patch) {
  var p = felieProfil();
  if ('userName' in patch) p.userName = patch.userName || '';
  if ('alter' in patch) {
    delete p.klAnswers.alter; delete p.klAnswers.alterExact; delete p.klAnswers.alterErfasstAm;
    if (patch.alter) { p.klAnswers.alterExact = patch.alter.exakt; p.klAnswers.alterErfasstAm = patch.alter.am; }
  }
  return felieProfilSichern(p);
}

function bekannt(welche) {
  if (FELIE_EINWILLIGUNGEN.indexOf(welche) < 0) throw new Error('Unbekannte Einwilligung: ' + welche);
}

export function felieEinwilligungSetzen(welche, wert, fassung) {
  bekannt(welche);
  var p = felieProfil();
  var am = Date.now();
  p.consent[welche] = !!wert;
  p.consent.ts = am;
  var n = p.consent.nachweis && typeof p.consent.nachweis === 'object' ? p.consent.nachweis : {};
  n[welche] = { erteilt: !!wert, am: am, fassung: fassung == null ? null : String(fassung) };
  p.consent.nachweis = n;
  return felieProfilSichern(p);
}

/* Erteilt, und zwar fuer den Wortlaut, der heute dasteht. */
export function felieEinwilligungAktuell(welche, fassung) {
  var c = felieProfil().consent;
  var n = c.nachweis && c.nachweis[welche];
  return c[welche] === true && !!n && n.erteilt === true && n.fassung === fassung;
}

/* D-2 A: nur die Datenverarbeitung; liefert, ob widerrufen wurde. */
export function felieEinwilligungWiderrufen(welche) {
  if (welche !== 'datenschutz') return false;
  var p = felieProfil();
  if (p.consent.datenschutz !== true) return false;
  var n = p.consent.nachweis && typeof p.consent.nachweis === 'object' ? p.consent.nachweis : {};
  var alt = n.datenschutz || {};
  n.datenschutz = { erteilt: false, am: Date.now(), fassung: alt.fassung == null ? null : alt.fassung, erteiltAm: alt.am == null ? (p.consent.ts || null) : alt.am };
  p.consent.nachweis = n;
  p.consent.datenschutz = false;
  return felieProfilSichern(p);
}

export function felieDatenverarbeitungErlaubt() {
  var c;
  try { c = felieProfil().consent; } catch (e) { return false; }
  var n = c.nachweis && c.nachweis.datenschutz;
  return c.datenschutz === true && !(n && n.erteilt === false);
}

export function felieOhneEinwilligung() {
  var e = new Error('Keine Einwilligung in die Datenverarbeitung');
  e.felieOhneEinwilligung = true;
  e.felieHinweis = FELIE_EINSTELLUNGEN_TEXTE.ohneEinwilligung;
  return e;
}

function datum(ms) {
  return ms ? new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

/* Die Karte "Deine Einwilligungen": Datenverarbeitung zuerst (T1). */
export function felieEinwilligungUebersicht() {
  var T = FELIE_EINSTELLUNGEN_TEXTE;
  var c = felieProfil().consent;
  var n = c.nachweis && typeof c.nachweis === 'object' ? c.nachweis : {};
  return ['datenschutz', 'medizinHinweis', 'alter18'].map(function (w) {
    var x = n[w] || {};
    var am = x.am || c.ts || null;
    var zustand = w === 'datenschutz'
      ? (x.erteilt === false && c.datenschutz !== true ? 'widerrufen' : c.datenschutz === true ? 'erteilt' : 'offen')
      : (c[w] === true ? 'bestaetigt' : 'offen');
    var vor = zustand === 'erteilt' ? T.erteiltAm : zustand === 'bestaetigt' ? T.bestaetigtAm : zustand === 'widerrufen' ? T.widerrufenAm : '';
    return { welche: w, titel: T.einwilligung[w], zustand: zustand, zeile: vor && am ? vor + datum(am) : '', widerrufbar: zustand === 'erteilt' };
  });
}
