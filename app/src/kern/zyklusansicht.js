/* Zyklus: Ansichtsmodell fuer Blatt, Karte und die Zeile auf der Startseite
   (F6e-1). Vorher standen Vorschau, Sperre, Karte und Zeile nur in
   index.html (showCycleInput, felieZyklusPhaseMarkieren,
   populateZyklusCard, home-cycle-line); App und Webapp nutzen jetzt dies.

   Texte 1:1 aus der Webapp, neu nur Z-3 (Untertitel) und Z-4 (Hinweis bei
   kuenftigem Datum), Marcel 30.09. (docs/f6e-zyklus-ist-soll.md). Fett in
   **...**, Anzeige ueber felieTextTeile. Rein: kein Zustand, kein Speicher;
   gerechnet wird mit cycleCompute am uebergebenen Zeitpunkt. */
import { FELIE_ZYKLUS_STANDARD, cycleCompute, cycleDaysBetween, cycleMidnight, felieZyklusHeute } from './zyklus.js';
import { felieLebensphase } from './koerper.js';

function frieren(o) {
  Object.values(o).forEach(function (v) { if (v && typeof v === 'object') frieren(v); });
  return Object.freeze(o);
}

export const FELIE_ZYKLUS_TEXTE = frieren({
  kicker: 'Dein Zyklus',
  titel: 'Zyklus eingeben',
  unterzeile: 'So kann ich deine ungefähre Phase in unseren Gesprächen berücksichtigen.',
  lebensphase: 'Andere Lebensphase',
  lebensphaseUnter: 'Schwangerschaft, Wechseljahre, unregelmäßig',
  welche: 'Welche Lebensphase?',
  trennerOder: 'oder manuell eingeben',
  trennerUnd: 'und zusätzlich',
  datum: 'Erster Tag der letzten Periode',
  laenge: 'Durchschnittliche Zykluslänge',
  tage: function (n) { return n + ' Tage'; },
  abbrechen: 'Abbrechen',
  speichern: 'Speichern',
  gespeichert: 'Gespeichert',
  gesperrt: function (phase) { return 'Bei ' + phase + ' rechne ich keinen Zyklus mit.'; },
  optional: 'Optional: Trag deinen letzten Periodenstart ein, dann zähle ich weiter mit.',
  vorschau: {
    leer: 'Trag den Tag ein, an dem deine Periode zuletzt begonnen hat — oder wähle oben eine Lebensphase.',
    ohneZyklus: 'Für diese Phase rechne ich keinen Zyklus mit.',
    ohneDatum: 'Noch kein Periodenstart eingetragen — du kannst ihn jederzeit nachtragen.',
    veraltetBitte: 'Trag bitte den Tag ein, an dem deine Periode **zuletzt** begonnen hat. Bis dahin zeige ich dir keine Phase an.'
  },
  zukunft: 'Dieses Datum liegt in der Zukunft. Trag bitte den ersten Tag deiner letzten Periode ein.',
  karte: {
    titel: 'Zyklus',
    leer: 'Kein Zyklus eingetragen',
    leerUnter: 'Tippe hier um deinen Zyklus einzutragen',
    bearbeiten: 'bearbeiten',
    balken: ['Menstruation', 'Follikel', 'Luteal'],
    naechste: 'Nächste Periode'
  },
  info: {
    titel: 'Zyklusphase',
    zeilen: [
      '**Die Phase ist geschätzt** — aus dem Abstand deiner letzten Periodenstarts, nicht gemessen.',
      '**Sie ist eine grobe Orientierung**, keine Aussage über Hormone. Wie es dir heute geht, weißt nur du.'
    ],
    verstanden: 'Verstanden'
  },
  zeileLeer: 'Zyklus eintragen'
});

/* Was das Blatt beim Oeffnen zeigt: das Gespeicherte, sonst leer und 28
   Tage. Leer statt einer Vorbelegung: wer nur die Laenge aendern wollte,
   schrieb sonst einen Periodenstart fest, den sie nie angegeben hat. Die
   Lebensphase haengt an unknownType, nicht an unknown (mitlaufender Zyklus). */
export function felieZyklusVorbelegung(cd) {
  return {
    lastPeriod: (cd && cd.lastPeriod) || '',
    selectedLen: (cd && cd.selectedLen) || FELIE_ZYKLUS_STANDARD,
    phaseVal: (cd && cd.unknownType) || null
  };
}

/* Schwangerschaft und "Keine Periode" sperren Datum und Laenge (sichtbar,
   abgeblendet); jede andere Lebensphase macht den Zyklus zur Zusatzangabe. */
export function felieZyklusSperre(phaseVal) {
  var T = FELIE_ZYKLUS_TEXTE, p = phaseVal ? felieLebensphase(phaseVal) : null;
  var gesperrt = !!p && p.zyklus === false;
  return {
    gesperrt: gesperrt,
    hinweis: !p ? '' : gesperrt ? T.gesperrt(p.phase) : T.optional,
    trenner: p && !gesperrt ? T.trennerUnd : T.trennerOder
  };
}

/* Heute und vor einem Jahr als 'YYYY-MM-DD' in Ortszeit (Z-2 A). Am
   29. Februar ist die untere Grenze der 28. */
export function felieZyklusDatumGrenzen(jetztMs) {
  var jetzt = jetztMs == null ? Date.now() : jetztMs;
  var d = new Date(jetzt), monat = d.getMonth();
  d.setFullYear(d.getFullYear() - 1);
  if (d.getMonth() !== monat) d.setDate(0);
  return { min: felieZyklusHeute(d.getTime()), max: felieZyklusHeute(jetzt) };
}

/* Die Vorschau im Blatt: was beim Speichern herauskaeme. art: leer,
   ohneZyklus, ohneDatum, zukunft, veraltet, ueberfaellig, normal.
   hervorgehoben: der Fall verlangt eine Handlung (Lime-Ton). Ein Datum,
   das sich nicht lesen laesst, zaehlt wie keins (so liefert es auch der
   Browser). */
export function felieZyklusVorschau(eingabe, jetztMs) {
  var T = FELIE_ZYKLUS_TEXTE, e = eingabe || {};
  var p = e.phaseVal ? felieLebensphase(e.phaseVal) : null;
  var datum = cycleMidnight(e.lastPeriod) ? e.lastPeriod : '';
  var ref = new Date(jetztMs == null ? Date.now() : jetztMs);
  function ergebnis(art, zeilen) { return { art: art, hervorgehoben: art === 'veraltet' || art === 'zukunft', zeilen: zeilen }; }
  if (!datum || (p && p.zyklus === false)) {
    if (!p) return ergebnis('leer', [{ symbol: 'help', text: T.vorschau.leer }]);
    var ohne = p.zyklus === false;
    return ergebnis(ohne ? 'ohneZyklus' : 'ohneDatum', [{ symbol: 'help', text: '**' + p.phase + '**' },
      { symbol: null, text: ohne ? T.vorschau.ohneZyklus : T.vorschau.ohneDatum }]);
  }
  /* Z-4 A: vorher blieb die Vorschau hier still auf dem alten Stand. */
  if (cycleDaysBetween(datum, ref) < 0) return ergebnis('zukunft', [{ symbol: 'help', text: T.zukunft }]);
  var c = cycleCompute(datum, e.selectedLen, ref);
  if (!c) return null;
  if (c.stale) {
    return ergebnis('veraltet', [
      { symbol: 'help', text: 'Der **' + c.letzterStartStr + '** liegt ' + c.daysSince + ' Tage zurück — mehr als ein Zyklus von ~' + c.selectedLen + ' Tagen.' },
      { symbol: null, text: T.vorschau.veraltetBitte }]);
  }
  var kopf = { symbol: 'cycle', text: '**Tag ' + c.cycleDay + '** deines Zyklus · ' + c.phase + (p ? ' · ' + p.phase : '') };
  if (c.ueberfaellig != null) return ergebnis('ueberfaellig', [kopf, { symbol: 'bloom', text: c.nextStr + ' — **' + c.daysLeftStr + '**' }]);
  return ergebnis('normal', [kopf, { symbol: 'bloom', text: 'Nächste Periode: **' + c.nextStr + '** (' + c.daysLeftStr + ')' }]);
}

/* Die Karte aus einem gerechneten Zustand (cycleRefresh), null ohne
   Eintrag. Im Kulanzfenster ohne "von ~L" (sonst "Tag 30 von ~28"); bei
   veraltetem Start ist eine Lebensphase die bessere Ueberschrift. */
export function felieZyklusKarte(cd) {
  if (!cd) return null;
  if (cd.unknown || cd.stale) {
    return {
      titel: cd.stale && cd.lebensphase ? cd.lebensphase : cd.phase,
      pille: null, balken: 0, deckkraft: 0.25, naechsteWert: '—',
      naechsteUnter: cd.stale ? (cd.nextStr || 'Kein neuer Start bestätigt') : 'Kein Zyklus-Tracking'
    };
  }
  var spaet = cd.ueberfaellig != null;
  var teile = [cd.phase];
  if (cd.lebensphase) teile.push(cd.lebensphase);
  if (spaet) teile.push('Periode überfällig');
  return {
    titel: spaet ? 'Tag ' + cd.cycleDay : 'Tag ' + cd.cycleDay + ' von ~' + cd.selectedLen,
    pille: teile.join(' · '), balken: cd.fillPct || 0, deckkraft: spaet ? 0.6 : 1,
    naechsteWert: cd.daysLeftStr, naechsteUnter: cd.nextStr
  };
}

/* Die Zeile im Kopf der Startseite (Z-1 C, Z-5): wie home-cycle-line der
   Webapp "<Phase> · Tag N"; ohne Zyklus steht in phase die Lebensphase. */
export function felieZyklusZeile(cd) {
  if (!cd) return FELIE_ZYKLUS_TEXTE.zeileLeer;
  return cd.phase + (cd.cycleDay ? ' · Tag ' + cd.cycleDay : '');
}

var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/* Das gewaehlte Datum in der Zeile ueber dem Kalender (F6e-2): "20.
   September 2026". Ohne Intl (gleich auf Hermes und in Node). */
export function felieZyklusDatumText(iso) {
  var d = cycleMidnight(iso);
  return d ? d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear() : '';
}
