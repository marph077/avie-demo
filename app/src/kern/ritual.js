/* Selbstreflexion: Ansichtsmodell fuer den Ablauf, den Knopf mit Marker und
   die Ritualkarte auf der Startseite (F6f-1). Vorher nur in index.html
   (felieRitualStarten, felieRitualSpiegelSatz, felieRitualEchoSetzen,
   felieSelbstreflexionAlter, felieRitualMarkerNoetig, fillHomeData); App
   und Webapp nutzen jetzt dies.

   Texte 1:1 aus der Webapp, neu nur S-4 (Zyklus-Schritt) und S-5
   (Spiegelsatz), Marcel 30.09./01.10. (docs/f6f-spiegel-ist-soll.md 5).
   Fett in **...**, Anzeige ueber felieTextTeile. Kein Modellaufruf: eine
   Bestaetigung ohne Deutung braucht kein Modell. Der Inhalt geht ueber die
   Signale in den Kontext (felieKontextDaten), nicht in die Blasen. */
import { felieAktuell, felieBand, felieSignalKorrigieren, felieSignalVerwendbar, felieTagesbeginn } from './signale.js';
import { FELIE_FRAGEN, felieStimmungLabel, felieStimmungListe, felieStufenWort } from './selbstauskunft.js';
import { felieZyklusAttribut, felieZyklusFrageFaellig, felieZyklusStatus } from './zyklus.js';
import { felieKoerperSpeichern } from './koerper.js';
import { felieStore } from './store.js';
import { felieGedaechtnisNeuAnzahl } from './gedaechtnisansicht.js';

function frieren(o) {
  Object.values(o).forEach(function (v) { if (v && typeof v === 'object') frieren(v); });
  return Object.freeze(o);
}

/* Drei Fragen bleiben drei. Anspannung ist aus dem Ritual heraus: die
   Stimmung deckt "gestresst" mit ab, ohne Trauer, Motivation und
   Neutralitaet auszuschliessen. */
export const FELIE_RITUAL_SIGNALE = frieren(['stimmung', 'schlafqualitaet', 'energie']);

export const FELIE_SIGNAL_META = frieren({
  stimmung:        { label: 'Stimmung', ico: 'i-bloom' },
  schlafqualitaet: { label: 'Nacht',    ico: 'i-moon' },
  energie:         { label: 'Energie',  ico: 'i-bolt' },
  anspannung:      { label: 'Anspannung', ico: 'i-wind' }
});

export const FELIE_RITUAL_TEXTE = frieren({
  knopf: 'Selbstreflexion',
  markerUnter: 'noch keine Angaben von heute',
  kicker: 'Ein Moment für dich',
  titel: 'Wie geht es dir gerade?',
  danke: 'Danke',
  zaehler: function (n, m) { return 'Frage ' + n + ' von ' + m; },
  ende: function (m) { return m + ' von ' + m; },
  weiter: 'Weiter',
  zurueck: 'Zurück',
  fertig: 'Fertig',
  zyklus: {
    frage: 'Magst du mir sagen, wann deine letzte Periode angefangen hat?',
    sub: 'So kann ich deine ungefähre Phase in unseren Gesprächen berücksichtigen.',
    knopf: 'Zyklus eintragen',
    frageUeberfaellig: 'Hat deine Periode inzwischen angefangen?',
    subUeberfaellig: 'Magst du den Beginn deiner letzten Periode aktualisieren? Dann stimmt deine Zyklusphase wieder.',
    knopfUeberfaellig: 'Periode eintragen'
  },
  leer: 'Alles gut. Auch ohne Angaben bin ich da — erzähl mir einfach, wie es dir geht.',
  gemerkt: 'Das habe ich mir gemerkt. Wenn du magst, sprechen wir darüber.',
  /* Jede nennt das Wort "Selbstreflexion": ohne es stuende der Satz
     zwischen zwei anderen Blasen, und der Bezug waere offen. */
  echos: [
    'Deine Selbstreflexion habe ich mitgenommen — ich beziehe sie mit ein.',
    'Danke für deine Selbstreflexion — die nehme ich mit ins Gespräch.',
    'Deine Selbstreflexion ist bei mir angekommen. Ich hab’s im Hinterkopf.'
  ],
  loeschen: 'Angabe löschen',
  speichern: 'Speichern'
});

/* Der Zyklus wird nur erfragt, wenn er fehlt oder ueberfaellig ist. */
export function felieRitualSchritte() {
  var faellig = false;
  try { faellig = felieZyklusFrageFaellig(); } catch (e) {}
  return FELIE_RITUAL_SIGNALE.concat(faellig ? ['zyklus'] : []);
}

/* Ihre juengste eigene Angabe von heute - der Tag beginnt um 04:00 Uhr
   (F6f N-4). Aelteres ist "geleert": es bleibt gespeichert und geht ueber
   felieAktuell (24 h) weiter in den Kontext fuer felie, erscheint aber nicht
   mehr als heute (Karte, Spiegel, Vorbelegung, Marker). */
export function felieAngabeHeute(key, jetztMs) {
  var jetzt = jetztMs == null ? Date.now() : jetztMs, beginn = felieTagesbeginn(jetzt), best = null;
  try {
    felieStore().signale.forEach(function (e) {
      if (!e || e.key !== key || e.quelle !== 'selbst' || !felieSignalVerwendbar(e)) return;
      var t = Number(e.ts);
      if (t >= beginn && t <= jetzt && (!best || t >= Number(best.ts))) best = e;
    });
  } catch (err) { return null; }
  return best;
}

/* Ein Schritt. Frage: Frage, Unterzeile, Chips, Grenze und Vorbelegung -
   F6f-1 (Befund 2): vorbelegt wird nur, was sie HEUTE angegeben hat. Vorher
   kam die Antwort von gestern Abend (24 h) vorbelegt, und "Weiter" schrieb
   sie still als heutige; ueberspringen ging nur durch Abwaehlen. Zyklus:
   Frage, Unterzeile und Knopf je nach Stand (S-4). */
export function felieRitualSchritt(key, jetztMs) {
  var T = FELIE_RITUAL_TEXTE;
  if (key === 'zyklus') {
    var st = 'fehlt';
    try { st = felieZyklusStatus(); } catch (e) {}
    var ue = st === 'ueberfaellig';
    return { art: 'zyklus', key: 'zyklus', ueberfaellig: ue, frage: ue ? T.zyklus.frageUeberfaellig : T.zyklus.frage,
      sub: ue ? T.zyklus.subUeberfaellig : T.zyklus.sub, knopf: ue ? T.zyklus.knopfUeberfaellig : T.zyklus.knopf };
  }
  var def = FELIE_FRAGEN[key];
  if (!def) return null;
  var jetzt = jetztMs == null ? Date.now() : jetztMs;
  var e = felieAngabeHeute(key, jetzt);
  var vorbelegt = e ? (def.mehrfach ? felieStimmungListe(e.wert) : [e.wert]) : [];
  return { art: 'frage', key: key, frage: def.frage, sub: def.sub || null, chips: def.chips.slice(), grenze: def.mehrfach || 1, vorbelegt: vorbelegt };
}

/* Ein Tipp auf einen Chip: waehlt oder waehlt ab; an der Grenze weicht die
   aelteste Nennung, statt den Tipp stumm zu verschlucken. */
export function felieRitualAuswahl(auswahl, wert, grenze) {
  var a = (auswahl || []).slice(), i = a.indexOf(wert);
  if (i >= 0) { a.splice(i, 1); return a; }
  if (a.length >= (grenze || 1)) a.shift();
  a.push(wert);
  return a;
}

/* "Weiter" mit Auswahl: die Antwort ersetzt die heutige und ist sofort
   gesichert - F6f-1 (Befund 7): vorher erst beim Schliessen, ein Beenden
   der App mitten im Ablauf verlor sie. Leere Auswahl: ueberspringen. */
export function felieRitualAntworten(key, auswahl) {
  var def = FELIE_FRAGEN[key];
  if (!def || !auswahl || !auswahl.length) return false;
  felieSignalKorrigieren(key, def.mehrfach ? auswahl.slice() : auswahl[0], null);
  try { felieKoerperSpeichern(); } catch (e) {}
  return true;
}

/* Der Abschluss: ohne Angabe der feste Satz, sonst was die Selbstreflexion
   ergeben hat - die Phase ungefaehr (S-5), dann die Woerter, die sie
   gewaehlt hat. Kein "3 von 3 erfasst". */
export function felieRitualAbschluss(erfasst, jetztMs) {
  var T = FELIE_RITUAL_TEXTE;
  if (!erfasst) return T.leer;
  var jetzt = jetztMs == null ? Date.now() : jetztMs, teile = [];
  try {
    var z = felieZyklusAttribut(jetzt);
    if (z && z.phase) teile.push('Du bist ungefähr in der **' + z.phase + '**, Tag ' + z.zyklusTag + '.');
  } catch (e) {}
  FELIE_RITUAL_SIGNALE.forEach(function (k) {
    var e = felieAngabeHeute(k, jetzt);
    if (!e) return;
    var w = k === 'stimmung' ? felieStimmungLabel(e.wert) : felieStufenWort(k, e.wert);
    if (w) teile.push(FELIE_SIGNAL_META[k].label + ': **' + w + '**.');
  });
  teile.push(T.gemerkt);
  return teile.join(' ');
}

/* Die Quittung auf der Startseite: einer von drei Saetzen. */
export function felieRitualEcho(zufall) {
  var e = FELIE_RITUAL_TEXTE.echos;
  var r = (typeof zufall === 'function' ? zufall : Math.random)();
  return e[Math.min(e.length - 1, Math.max(0, Math.floor(r * e.length)))];
}

/* Millisekunden seit der juengsten selbst erfassten Ritual-Angabe, null:
   noch nie. Bewusst nicht ueber felieAktuell (eigenes Frischefenster). */
export function felieSelbstreflexionAlter(jetztMs) {
  var neuster = 0;
  try {
    felieStore().signale.forEach(function (e) {
      if (!e || e.quelle !== 'selbst' || FELIE_RITUAL_SIGNALE.indexOf(e.key) < 0) return;
      var t = Number(e.ts);
      if (t > neuster) neuster = t;
    });
  } catch (err) { return null; }
  return neuster ? (jetztMs == null ? Date.now() : jetztMs) - neuster : null;
}

/* Der Marker (C1e, F-17 nicht abstellbar): seit Tagesbeginn 04:00 keine
   eigene Ritual-Angabe (seit F6f N-4; vorher: aelter als 24 Stunden);
   Geraetewerte zaehlen nicht. Vorrang des Gedaechtnisses mit derselben
   Quelle wie Puls und Zaehler (F6f-0, Befund 5) - genau eine Aufforderung
   (D1). Nichts wird gespeichert. */
export function felieRitualMarkerNoetig(jetztMs) {
  try { if (felieGedaechtnisNeuAnzahl() > 0) return false; } catch (e) {}
  return !FELIE_RITUAL_SIGNALE.some(function (k) { return !!felieAngabeHeute(k, jetztMs); });
}

/* Die Ritualkarte: Nacht und Energie als Stufe (1-3 Punkte), die Stimmung
   als ihre Woerter (kategorial, keine Punkte); ohne Stimmung die
   Anspannung (invertiert: wenig Anspannung, drei Punkte); ohne eigene
   Angabe zur Nacht der Messwert. Eigene Angaben nur von heute (ab 04:00,
   F6f N-4). heute: es gibt eine eigene Angabe. */
function punkte(key, e) {
  var b = felieBand(key, e.wert, e.quelle === 'messung' ? 'messung' : 'selbst');
  if (!b) return 0;
  var rang = { niedrig: 1, mittel: 2, hoch: 3 }[b];
  return key === 'anspannung' ? 4 - rang : rang;
}
export function felieRitualKarte(jetztMs) {
  var jetzt = jetztMs == null ? Date.now() : jetztMs;
  function holen(key, quelle) {
    if (!quelle) return felieAngabeHeute(key, jetzt);
    try { return felieAktuell(key, { quelle: quelle, jetzt: jetzt }); } catch (e) { return null; }
  }
  var eS = holen('schlafqualitaet'), eE = holen('energie'), eM = holen('stimmung');
  var nacht = { key: 'schlafqualitaet', label: FELIE_SIGNAL_META.schlafqualitaet.label, punkte: 0, stimmung: null };
  /* Nur ihre eigene Angabe (F8a, Befund H6): gemessener Schlaf als Punkte
     waere eine Einordnung (AL-84) - der Messwert steht benannt im Spiegel. */
  if (eS) nacht.punkte = punkte('schlafqualitaet', eS);
  var energie = { key: 'energie', label: FELIE_SIGNAL_META.energie.label, punkte: eE ? punkte('energie', eE) : 0, stimmung: null };
  var dritte = { key: 'stimmung', label: FELIE_SIGNAL_META.stimmung.label, punkte: 0, stimmung: null };
  if (eM) dritte.stimmung = felieStimmungListe(eM.wert);
  else {
    var eA = holen('anspannung');
    if (eA) dritte = { key: 'anspannung', label: FELIE_SIGNAL_META.anspannung.label, punkte: punkte('anspannung', eA), stimmung: null };
  }
  return { heute: !!(eS || eE || eM), spalten: [nacht, energie, dritte] };
}
