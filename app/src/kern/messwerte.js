/* Messwerte aus Apple Health (F8a; Marcel 01.10.: H-1 A bis H-5 A,
   docs/f8-healthkit-ist-soll.md).

   - Ein Port der App liefert Tageswerte: tage() -> [{ tag: 'JJJJ-MM-TT',
     schlaf, tief, rem (Minuten), hrv (ms), ruhepuls (Schlaege/Min.) }].
     Die Webapp verbindet keinen (dort gibt es kein Apple Health).
   - Nur im Arbeitsspeicher (H-5 A): nichts davon geht in den Store, in
     felie.db oder in eine Sicherung - Apple Health ist der Speicher, die
     App liest bei jedem Start frisch (App Review 5.1.3(ii)).
   - Nur Schlaf, Tief- und REM-Schlaf, HRV, Ruhepuls (H-1 A; keine
     Temperatur, keine Menstruation - MDCG 2019-11); die letzten 30 Tage;
     Unlesbares und Zukunft fallen weg. Ein Fehler im Port kostet nur die
     Messwerte.
   - Als Signale (quelle 'messung', meta.herkunft 'apple_health') fuer
     felieAktuell, felieVerlauf und den Kontext; nur sie sind als Messwert
     verwendbar (H2). Keine Hersteller- oder Geraetenamen (H3, AL-71b).
   - felieSpiegelMessung: die eigene Zeile im Spiegel (C1h) - benannt, nie
     eingeordnet (AL-84). Wortlaute F8-T6 (freigabe.md, wartend). */
export const FELIE_MESS_FELDER = Object.freeze(['schlaf', 'tief', 'rem', 'hrv', 'ruhepuls']);

/* Feld des Ports -> Schluessel der Signale im Kern (signale.js). */
var SIGNAL = { schlaf: 'schlaf', tief: 'deep', rem: 'rem', hrv: 'hrv', ruhepuls: 'rhr' };
var TAG_MS = 86400000;
var FENSTER_TAGE = 30;

export const FELIE_MESS_TEXTE = Object.freeze({
  herkunft: 'aus Apple Health',
  datumsquelle: 'Messtag aus Apple Health',
  labels: Object.freeze({ schlaf: 'Schlaf', tief: 'Tiefschlaf', rem: 'REM-Schlaf', hrv: 'HRV', ruhepuls: 'Ruhepuls' })
});

var port = null;
export function felieMesswerteVerbinden(p) { port = p || null; }

/* M-1 (Messung 01.10.: der eingefrorene Prompt ordnete Messwerte in 3 von
   9 Antworten ein): ob Messwerte und Vergleiche ins Gespraech gehen, ist
   ein eigener Schalter. Marcel 02.10. M-1 B: Standard an, schon vor
   Prompt v4 (T3/T4 ohne "ich bewerte sie nicht"). Der Spiegel zeigt sie
   unabhaengig davon. Ohne Argument nur lesen. felieKernZuruecksetzen
   stellt den Standard wieder her. */
var fuerModell = true;
export function felieMesswerteFuerModell(an) {
  if (an !== undefined) fuerModell = an === true;
  return fuerModell;
}

function tagBeginn(text) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
  if (!m) return null;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d.getTime();
}
function heuteBeginn(jetzt) { var d = new Date(jetzt); d.setHours(0, 0, 0, 0); return d.getTime(); }

/* Die Tage aus dem Port, geprueft: je Tag nur die erlaubten Felder mit
   einer endlichen Zahl ueber 0; aelter als 30 Tage oder in der Zukunft
   faellt weg; aufsteigend, ein Eintrag je Tag (der letzte gilt). */
export function felieMesswerteTage(jetztMs) {
  var jetzt = jetztMs == null ? Date.now() : jetztMs;
  var roh = [];
  try { roh = port && typeof port.tage === 'function' ? port.tage() : []; } catch (e) { roh = []; }
  if (!Array.isArray(roh)) return [];
  var heute = heuteBeginn(jetzt), je = {};
  roh.forEach(function (t) {
    if (!t || typeof t !== 'object') return;
    var beginn = tagBeginn(t.tag);
    if (beginn == null || beginn > heute || heute - beginn > (FENSTER_TAGE - 1) * TAG_MS + 3600000) return;
    var raus = { tag: t.tag }, n = 0;
    FELIE_MESS_FELDER.forEach(function (f) {
      var w = t[f];
      if (typeof w === 'number' && isFinite(w) && w > 0) { raus[f] = w; n++; }
    });
    if (n) je[t.tag] = raus;
  });
  return Object.keys(je).sort().map(function (k) { return je[k]; });
}

/* Messtag als Zeitpunkt: 07:00 des Tages (die Nacht endet am Morgen),
   nie spaeter als jetzt. */
function messZeit(tag, jetzt) { return Math.min(tagBeginn(tag) + 7 * 3600000, jetzt); }

export function felieMessSignale(jetztMs) {
  var jetzt = jetztMs == null ? Date.now() : jetztMs, raus = [];
  felieMesswerteTage(jetzt).forEach(function (t) {
    FELIE_MESS_FELDER.forEach(function (f) {
      if (t[f] == null) return;
      raus.push({ key: SIGNAL[f], wert: t[f], ts: messZeit(t.tag, jetzt), quelle: 'messung',
        meta: { herkunft: 'apple_health', datumsquelle: FELIE_MESS_TEXTE.datumsquelle } });
    });
  });
  return raus;
}

/* "5 Std. 40 Min." - fuer den Spiegel und, lesbar, fuer das Modell. */
export function felieMessDauerText(min) { return dauer(min); }
function dauer(min) {
  var m = Math.round(min), h = Math.floor(m / 60), r = m % 60;
  if (!h) return r + ' Min.';
  return h + ' Std.' + (r ? ' ' + r + ' Min.' : '');
}
function messText(f, w) {
  if (f === 'hrv') return Math.round(w) + ' ms';
  if (f === 'ruhepuls') return Math.round(w) + ' Schläge/Min.';
  return dauer(w);
}
/* Der Messtag "heute" wie in der Selbstreflexion: der Tag beginnt um 04:00
   (FELIE_TAG_BEGINN_STUNDE, signale.js - der Import waere ein Ring, M14
   prueft die Gleichheit). Vor 04:00 gilt noch die Nacht auf gestern. */
var TAG_BEGINN_STUNDE = 4;
function messHeute(jetzt) {
  var d = new Date(jetzt);
  if (d.getHours() < TAG_BEGINN_STUNDE) d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Schnitt eines Feldes ueber die 7 Tage vor heute - dieselbe Regel wie die
   Vergleiche fuer das Modell (felieGeraeteVergleiche, kontext.js; dort vor
   dem letzten Messtag, mit Werten von heute dasselbe): mindestens 3 Naechte
   mit dem Wert, sonst null. */
function schnittDavor(liste, ende, f) {
  var davor = liste.filter(function (x) { var b = tagBeginn(x.tag); return b < ende && ende - b <= 7 * TAG_MS && x[f] != null; });
  if (davor.length < 3) return null;
  return davor.reduce(function (summe, x) { return summe + x[f]; }, 0) / davor.length;
}

/* Der eigene Abschnitt im Spiegel (C1h; Marcel 02.10.: eigene Karte
   "Apple Health", je Wert eine Zeile mit dem 7-Tage-Schnitt). Wie die
   Selbstreflexion nur Werte von heute: ohne Wert von heute ist text null
   (die App zeigt "–"), der Schnitt der 7 Tage davor bleibt. Ein Feld ohne
   beides faellt weg; ohne ein einziges Feld null. Benannt, nicht
   eingeordnet (Nennung, f8-healthkit-ist-soll.md 7). */
export function felieSpiegelMessung(jetztMs) {
  var jetzt = jetztMs == null ? Date.now() : jetztMs;
  var liste = felieMesswerteTage(jetzt);
  if (!liste.length) return null;
  var heute = messHeute(jetzt), ende = tagBeginn(heute);
  var t = liste.filter(function (x) { return x.tag === heute; })[0] || null;
  var werte = FELIE_MESS_FELDER.map(function (f) {
    var text = t && t[f] != null ? messText(f, t[f]) : null;
    var schnitt = schnittDavor(liste, ende, f);
    if (text == null && schnitt == null) return null;
    var w = { key: f, label: FELIE_MESS_TEXTE.labels[f], text: text };
    if (schnitt != null) w.schnitt = messText(f, schnitt);
    return w;
  }).filter(function (w) { return w; });
  return werte.length ? { herkunft: FELIE_MESS_TEXTE.herkunft, werte: werte } : null;
}

/* Fuer die Vergleiche im Kontext (kontext.js): die Tage in der Form der
   bisherigen Tagesliste (day, sleepMins, hrv, rhr, deep, rem). */
export function felieMessTagesliste(jetztMs) {
  return felieMesswerteTage(jetztMs).map(function (t) {
    return { day: t.tag, sleepMins: t.schlaf, hrv: t.hrv, rhr: t.ruhepuls, deep: t.tief, rem: t.rem };
  });
}
