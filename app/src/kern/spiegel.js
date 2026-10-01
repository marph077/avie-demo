/* Spiegel: Ansichtsmodell fuer "Was ich heute weiß", "Muster" und das
   Bearbeiten einer Angabe (F6f-1). Vorher nur in index.html
   (renderSpiegelHeute, renderSpiegelMuster, felieWertBearbeiten,
   felieAlterText); App und Webapp nutzen jetzt dies.

   E-U4 / C1h: der Spiegel zeigt nur, was ohne Wartezeit etwas sagt -
   benennen ja, einordnen nein. "Körperdaten einordnen" ist entfallen
   (S-2). Kopf "Selbstreflexion" / "Wie du dich gerade fühlst" (Marcel
   01.10., ersetzt S-3 "Wie es dir zuletzt ging"); uebrige Texte 1:1 Webapp
   (Marcel 30.09., docs/f6f-spiegel-ist-soll.md 5). */
import { FELIE_MESSPARTNER, felieAktuell, felieBand, felieSchlafFmt, felieSignalKorrigieren } from './signale.js';
import { FELIE_FRAGEN, felieStimmungLabel, felieStimmungListe, felieStufenWort } from './selbstauskunft.js';
import { felieKombiMuster } from './kontext.js';
import { felieKoerperSpeichern } from './koerper.js';
import { FELIE_SIGNAL_META, felieAngabeHeute } from './ritual.js';

export const FELIE_SPIEGEL_TEXTE = Object.freeze({
  titel: 'Selbstreflexion',
  unterzeile: 'Wie du dich gerade fühlst',
  heute: 'Was ich heute weiß',
  muster: 'Muster',
  musterTitel: 'Was bei dir zusammenhängt',
  musterWenig: 'Für ein Muster brauche ich ein paar Reflexionen mehr von dir. Ab etwa sechs sehe ich, was bei dir zusammenhängt.',
  musterKeins: 'Bisher zeigt sich noch kein deutlicher Zusammenhang. Das ist eine ehrliche Antwort und kein Fehler — ich melde mich, wenn sich etwas abzeichnet.',
  nochNichts: 'noch nichts',
  deineAngabe: 'deine Angabe',
  vomWearable: 'vom Wearable',
  wearable: 'Wearable',
  schliessen: 'Schließen'
});

/* Im Spiegel: die drei aus dem Ritual, dazu Anspannung, falls es dazu
   etwas gibt (nur noch Altdaten). */
export const FELIE_SPIEGEL_SIGNALE = Object.freeze(['stimmung', 'schlafqualitaet', 'energie', 'anspannung']);

/* "heute" / "gestern" / "vor N Tagen", nach Kalendertagen in Ortszeit. */
export function felieAlterText(ts, jetztMs) {
  var jetzt = new Date(jetztMs == null ? Date.now() : jetztMs); jetzt.setHours(0, 0, 0, 0);
  var d = new Date(ts); d.setHours(0, 0, 0, 0);
  var tage = Math.round((jetzt - d) / 86400000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  return 'vor ' + tage + ' Tagen';
}

function messText(mkey, key, e) {
  if (mkey === 'schlaf') return (e.meta && e.meta.str) || felieSchlafFmt(e.wert) || (e.wert + ' min');
  return felieStufenWort(key, e.wert) || String(e.wert);
}

/* Eine Zeile je Signal: das Wort, das sie heute gewaehlt hat (nie eine
   Zahl), Herkunft und Alter; ohne eigene Angabe der Messwert. Seit F6f N-4
   nur Angaben von heute (ab 04:00): Aelteres ist geleert, nicht geloescht
   - vorher stand die letzte aeltere mit Alter da. abweichung: der Messwert, wenn sein Band ein anderes ist
   (nie bei der Stimmung). Anspannung nur, wenn es dazu etwas gibt. */
export function felieSpiegelHeute(jetztMs) {
  var T = FELIE_SPIEGEL_TEXTE, jetzt = jetztMs == null ? Date.now() : jetztMs, raus = [];
  FELIE_SPIEGEL_SIGNALE.forEach(function (key) {
    var meta = FELIE_SIGNAL_META[key], mkey = FELIE_MESSPARTNER[key] || key, selbst = null, mess = null;
    selbst = felieAngabeHeute(key, jetzt);
    try { mess = felieAktuell(mkey, { quelle: 'messung', jetzt: jetzt }); } catch (e) {}
    if (key === 'anspannung' && !selbst && !mess) return;
    var z = { key: key, label: meta.label, ico: meta.ico, wert: null, herkunft: null, alter: null, abweichung: null };
    if (selbst) {
      z.wert = key === 'stimmung' ? felieStimmungLabel(selbst.wert) : felieStufenWort(key, selbst.wert);
      z.herkunft = T.deineAngabe;
      z.alter = felieAlterText(selbst.ts, jetzt);
    } else if (mess) {
      z.wert = messText(mkey, key, mess);
      z.herkunft = T.vomWearable;
      z.alter = felieAlterText(mess.ts, jetzt);
    }
    if (selbst && mess && key !== 'stimmung') {
      var bs = felieBand(key, selbst.wert, 'selbst'), bg = felieBand(mkey, mess.wert, 'messung');
      if (bs && bg && bs !== bg) z.abweichung = messText(mkey, key, mess);
    }
    raus.push(z);
  });
  return raus;
}

/* Muster: die Saetze der Kombinationsmuster, sonst ein ehrlicher Satz -
   unter sechs Tagen "zu wenige", danach "noch kein deutlicher". */
export function felieSpiegelMuster(km) {
  var T = FELIE_SPIEGEL_TEXTE;
  if (!km) { try { km = felieKombiMuster(); } catch (e) { km = { muster: [], tage: 0 }; } }
  var saetze = (km.muster || []).map(function (m) { return m.text; });
  return { saetze: saetze, hinweis: saetze.length ? null : (km.tage < 6 ? T.musterWenig : T.musterKeins) };
}

/* Die Auswahl unter einer Zeile des Spiegels (App, F6f N-4): dieselben
   Chips wie in der Selbstreflexion, vorbelegt mit der Angabe von heute.
   Kein "Speichern", kein "Angabe löschen": jeder Tipp speichert
   (felieSpiegelWaehlen), abwaehlen entfernt die heutige Angabe. */
export function felieSpiegelAuswahl(key, jetztMs) {
  var def = FELIE_FRAGEN[key];
  if (!def || !FELIE_SIGNAL_META[key]) return null;
  var e = felieAngabeHeute(key, jetztMs);
  return { key: key, label: FELIE_SIGNAL_META[key].label, frage: def.frage, sub: def.sub || null, chips: def.chips.slice(),
    grenze: def.mehrfach || 1, vorbelegt: e ? (def.mehrfach ? felieStimmungListe(e.wert) : [e.wert]) : [] };
}

/* Ein Tipp in der Auswahl: die heutige Angabe wird die neue Auswahl - leer
   heisst: heute keine Angabe (der Verlauf davor bleibt). Sofort gesichert. */
export function felieSpiegelWaehlen(key, auswahl) {
  var def = FELIE_FRAGEN[key];
  if (!def) return false;
  var a = auswahl || [];
  felieSignalKorrigieren(key, a.length ? (def.mehrfach ? a.slice() : a[0]) : null, null);
  try { felieKoerperSpeichern(); } catch (e) {}
  return true;
}

/* Webapp (felieWertBearbeiten, N-4 C): eine Angabe bearbeiten (Tipp auf eine Zeile): dieselben Chips wie in der
   Selbstreflexion; vorbelegt mit der Angabe, die angezeigt wird (24 h),
   "Angabe löschen" nur mit Angabe. */
export function felieWertBearbeitenStand(key, jetztMs) {
  var def = FELIE_FRAGEN[key];
  if (!def || !FELIE_SIGNAL_META[key]) return null;
  var e = null;
  try { e = felieAktuell(key, { quelle: 'selbst', jetzt: jetztMs == null ? Date.now() : jetztMs }); } catch (err) {}
  return { key: key, kicker: FELIE_SIGNAL_META[key].label, frage: def.frage, sub: def.sub || null, chips: def.chips.slice(),
    grenze: def.mehrfach || 1, vorbelegt: e ? (def.mehrfach ? felieStimmungListe(e.wert) : [e.wert]) : [], loeschbar: !!e };
}
