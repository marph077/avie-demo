/* Zyklus - seit Welle D, Paket D2b, ein Kern-Modul.

   Die Zyklusrechnung (cycleCompute und Hilfen), die Zyklusattribute fuer
   Eintraege und der Erinnerungsplan. Bis D2b standen sie in index.html.
   Geaendert ist nur der Zugriff auf window.cycleData: bis D7b ging er
   ueber eine verbundene Umgebung (felieKoerperVerbinden, D-11), seit D7b
   (AL-93) liegt der Zustand hier im Modul. Speichern, Laden, Lebensphasen
   und das Eintragen aus dem Sheet stehen in koerper.js.

   Der urspruengliche Wortlaut folgt unveraendert. */

import { felieRevision, felieStore, felieStoreSpeichern } from './store.js';

/* Zustand der Koerperdaten (seit D7b, AL-93). Bis D7b lag er in der
   Webapp (window.cycleData, window._bodyUpdatedAt) und der Kern las ihn
   ueber einen verbundenen Rueckruf (felieKoerperVerbinden, D-11). Er
   steht hier und nicht in koerper.js, weil die Rechnung in diesem Modul
   ihn liest und koerper.js die Rechnung braucht - so bleibt der Kern ohne
   Ringimport.
     Geschrieben wird der Zyklus vom Zyklus-Sheet (felieZyklusEintragen),
   vom Kennenlernen (klV2ZyklusVoreinstellen) und beim Laden
   (felieKoerperLaden); der Zeitpunkt von felieUebernehmeAltObjekt, den
   manuellen Werten und beim Laden. Anfangs gibt es keinen Zyklus
   (undefined, wie vorher window.cycleData). */
let zyklus;
let koerperZeit;

export function felieZyklusLesen() { return zyklus; }
export function felieZyklusSetzen(cd) { zyklus = cd; }
export function felieKoerperZeit() { return koerperZeit; }
export function felieKoerperZeitSetzen(ts) { koerperZeit = ts; }
export function felieKoerperZuruecksetzen() { zyklus = undefined; koerperZeit = undefined; }

/* ── Zyklusattribute: abgeleitet, nie eingefroren ──────────────────── */

/* Liefert { zyklusIndex, zyklusTag, phase } fuer einen Zeitpunkt oder
   null, wenn kein Zyklusstart vorliegt. Negative Indizes sind erlaubt:
   Eintraege VOR dem bekannten Start werden rueckwaerts einsortiert,
   damit ein spaeter nachgetragenes Datum die Historie nicht verwirft. */
/* Ab wann gilt ein Zyklus als ueberfaellig, und ab wann hoert felie auf,
   eine Phase zu behaupten? Zyklen schwanken natuerlich um mehrere Tage,
   deshalb wird nicht am Tag nach der erwarteten Periode gefragt. */
export const FELIE_ZYKLUS_KULANZ    = 3;   /* Tage ueber der Laenge: ab hier fragen */
/* Gueltiger Bereich der Zykluslaenge, zugleich die Grenzen des Reglers im
   Sheet. Dieselben Zahlen prueft felieZyklusAttribut(): waeren Regler und
   Pruefung getrennt, liesse sich ein Wert einstellen, mit dem die
   Zuordnung anschliessend stillschweigend nichts mehr anfangen kann. */
export const FELIE_ZYKLUS_MIN       = 15;
export const FELIE_ZYKLUS_MAX       = 60;
export const FELIE_ZYKLUS_STANDARD  = 28;
export const FELIE_ZYKLUS_UNBEKANNT = 7;   /* Tage ueber der Laenge: ab hier keine Phase */

export function felieZyklusAttribut(ts) {
  var cd = felieZyklusLesen();
  /* Bei einer Lebensphase bleibt lastPeriod erhalten, damit die Historie
     weiter zuordenbar ist — deshalb hier KEIN Abbruch bei cd.unknown. */
  if (!cd || !cd.lastPeriod) return null;
  var lp = (typeof cycleMidnight === 'function') ? cycleMidnight(cd.lastPeriod) : null;
  if (!lp) return null;
  var L = parseInt(cd.selectedLen, 10) || 28;

  var d = new Date(ts); d.setHours(0, 0, 0, 0);
  var tage = Math.round((d.getTime() - lp.getTime()) / 86400000);

  /* Ohne diese Grenze rechnete das Modell einfach weiter: 34 Tage nach dem
     letzten bekannten Start meldete felie "Zyklus 2, Tag 6, Follikelphase"
     — als haette eine neue Periode begonnen, von der niemand weiss. Das
     war unbemerkt falsch und verschob auch die rueckwirkende Zuordnung
     aller Eintraege in diesem Zeitraum. Jenseits der Grenze gibt es
     schlicht keine Phase. Die Kombinationsmuster brauchen sie nicht. */
  if (!Number.isInteger(L) || L < FELIE_ZYKLUS_MIN || L > FELIE_ZYKLUS_MAX || tage >= L + FELIE_ZYKLUS_UNBEKANNT) return null;
  /* Beginnt eine Lebensphase, gilt sie ab ihrem Startzeitpunkt. Aeltere
     Eintraege behalten ihre Zuordnung — sonst waere der aufgebaute
     Phasen-Kenntnisstand nicht eingefroren, sondern weg. */
  if (cd.phaseAb) {
    var ab = new Date(cd.phaseAb); ab.setHours(0, 0, 0, 0);
    if (d.getTime() >= ab.getTime()) return null;
  }

  /* Modulo, das auch fuer negative Tage sauber laeuft.
     Im Kulanzfenster (tage zwischen L und L+FELIE_ZYKLUS_UNBEKANNT) darf
     das Modulo NICHT greifen: es wuerde aus Tag 30 eines verspaeteten
     Zyklus den "Tag 3 von Zyklus 2" machen und damit eine Periode
     behaupten, die niemand bestaetigt hat. Dort laeuft derselbe Zyklus
     einfach weiter. */
  var imKulanzfenster = tage >= L;
  var restTag = imKulanzfenster ? tage : ((tage % L) + L) % L;
  var index   = imKulanzfenster ? 0 : Math.floor(tage / L);
  var zyklusTag = restTag + 1;

  var phase = null;
  if (typeof CYCLE_PHASES !== 'undefined' && CYCLE_PHASES) {
    phase = CYCLE_PHASES[CYCLE_PHASES.length - 1].phase;
    for (var i = 0; i < CYCLE_PHASES.length; i++) {
      if (zyklusTag <= CYCLE_PHASES[i].max) { phase = CYCLE_PHASES[i].phase; break; }
    }
  }
  return { zyklusIndex: index, zyklusTag: zyklusTag, phase: phase };
}

/* Wo steht der Zyklus? 'fehlt' — nie erfasst. 'unbekannt' — bewusst als
   nicht bekannt markiert (Schwangerschaft, Wechseljahre, unregelmaessig),
   danach wird nicht mehr gefragt. 'ueberfaellig' — die erwartete Periode
   ist ueber der Kulanz. 'ok' — nichts zu tun. */
export function felieZyklusStatus() {
  var cd = felieZyklusLesen();
  if (!cd || (!cd.lastPeriod && !cd.unknown)) return 'fehlt';
  if (cd.unknown) return 'unbekannt';
  var lp = (typeof cycleMidnight === 'function') ? cycleMidnight(cd.lastPeriod) : null;
  if (!lp) return 'fehlt';
  var L = parseInt(cd.selectedLen, 10) || 28;
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var tage = Math.round((heute.getTime() - lp.getTime()) / 86400000);
  /* >= statt >: die erste Erinnerung liegt bei genau +3 Tagen. Mit
     strikt groesser haette der Status sie blockiert. */
  return tage >= L + FELIE_ZYKLUS_KULANZ ? 'ueberfaellig' : 'ok';
}

/* Endlicher Erinnerungsplan statt Dauerschleife: drei Nachfragen, dann
   Ruhe. Die Zahlen sind Tage ueber der erwarteten Periode. Zwei zeitnahe
   Nachfragen, eine letzte nach etwa einem Monat — danach nie wieder von
   selbst. Wer eintragen will, kommt jederzeit ueber das Dashboard.
     Der Grund fuer das Ende: eine ausgebliebene Periode kann eine
   Schwangerschaft, einen Kinderwunsch oder eine Fehlgeburt bedeuten.
   Eine App, die alle vier Tage danach fragt, ist im schlechtesten Fall
   grausam. */
export const FELIE_ZYKLUS_ERINNERUNGEN = [3, 4, 28];

/* Tage ueber der erwarteten Periode, oder null wenn es keinen Zyklus gibt. */
export function felieZyklusUeberfaelligTage() {
  var cd = felieZyklusLesen();
  if (!cd || cd.unknown || !cd.lastPeriod) return null;
  var lp = (typeof cycleMidnight === 'function') ? cycleMidnight(cd.lastPeriod) : null;
  if (!lp) return null;
  var L = parseInt(cd.selectedLen, 10) || 28;
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  return Math.round((heute.getTime() - lp.getTime()) / 86400000) - L;
}

export function felieZyklusFrageFaellig() {
  var st = felieZyklusStatus();
  if (st === 'unbekannt' || st === 'ok') return false;
  var zaehler = (felieStore().zusatz || {}).zyklusGefragt || 0;
  /* Fehlt der Zyklus ganz, gilt derselbe Deckel: dreimal anbieten,
     danach ist es ihre Entscheidung. */
  if (zaehler >= FELIE_ZYKLUS_ERINNERUNGEN.length) return false;
  if (st === 'fehlt') return true;
  var ueber = felieZyklusUeberfaelligTage();
  if (ueber == null) return false;
  return ueber >= FELIE_ZYKLUS_ERINNERUNGEN[zaehler];
}

export function felieZyklusFrageNotiert() {
  var z = felieStore().zusatz;
  z.zyklusGefragt = (z.zyklusGefragt || 0) + 1;
  z.zyklusGefragtAm = Date.now();
  felieRevision(true);
  try { felieStoreSpeichern(); } catch (e) {}
}

/* Nach einem neuen Periodenstart beginnt der Plan von vorn. */
export function felieZyklusPlanZuruecksetzen() {
  felieStore().zusatz.zyklusGefragt = 0;
  felieRevision(true);
  try { felieStoreSpeichern(); } catch (e) {}
}

export function cycleDayPart(cd, pre, post) {
  if (!cd || cd.unknown || cd.stale || cd.cycleDay == null) return '';
  /* Im Kulanzfenster liegt der Zyklustag ueber der Laenge. "Tag 31 von 28"
     liest sich wie ein Rechenfehler, deshalb faellt der Bezugswert dort weg. */
  var spaet = cd.ueberfaellig != null;
  return (pre || '') + 'Tag ' + cd.cycleDay +
         (cd.selectedLen && !spaet ? ' von ' + cd.selectedLen : '') + (post || '');
}

export function cycleMidnight(v) {
  if (v instanceof Date) {
    if (!Number.isFinite(v.getTime())) return null;
    var copy = new Date(v.getTime()); copy.setHours(0, 0, 0, 0); return copy;
  }
  var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

export function cycleDaysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((cycleMidnight(b) - cycleMidnight(a)) / 86400000);
}

export const CYCLE_PHASES = [
  { max: 5,  phase: 'Menstruation',   val: '↓ Östrogen + Progesteron', sub: 'Beide Hormone niedrig' },
  { max: 16, phase: 'Follikelphase',  val: '↑ Östrogen steigt',        sub: 'Energie & Antrieb nehmen zu' },
  { max: 99, phase: 'Lutealphase',    val: '↑ Progesteron',            sub: '↓ Östrogen sinkt' }
];

/* Rechnet den aktuellen Stand aus lastPeriod und Länge. Gibt null zurück,
   wenn kein Startdatum vorliegt (unbekannter Zyklus). */
export function cycleCompute(lastPeriod, len, refDate) {
  var lp = cycleMidnight(lastPeriod), ref = cycleMidnight(refDate || new Date());
  var L = Number(len || 28);
  if (!lp || !ref || !Number.isInteger(L) || L < FELIE_ZYKLUS_MIN || L > FELIE_ZYKLUS_MAX) return null;
  var daysSince = cycleDaysBetween(lp, ref);
  if (daysSince < 0) return null;
  /* Ein neuer Zyklus braucht einen bestaetigten Start: niemals endlos Modulo.
     ABER: Zyklen schwanken um mehrere Tage. Frueher stand hier
     "stale = daysSince >= L", also fiel die Phase am Tag NACH der
     erwarteten Periode weg — bei woechentlicher Nutzung traf die Nutzerin
     dadurch fast immer auf "Aktuelle Phase unbekannt", obwohl sie ihren
     Zyklus gerade erst eingetragen hatte. Die Kulanz war als
     FELIE_ZYKLUS_UNBEKANNT bereits definiert, wurde aber nirgends
     verwendet. Innerhalb des Fensters laeuft der Zyklustag weiter und die
     Verspaetung wird benannt, statt die Zuordnung wortlos zu verwerfen. */
  var ueber = daysSince - L;                       /* Tage ueber der erwarteten Periode */
  var stale = ueber >= FELIE_ZYKLUS_UNBEKANNT;
  var spaet = !stale && ueber >= 0;
  var day = daysSince + 1;
  var ph = CYCLE_PHASES.find(function(p) { return day <= p.max; }) || CYCLE_PHASES[2];
  var next = new Date(lp.getTime()); next.setDate(lp.getDate() + L);
  var lpStr = lp.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return { lastPeriod: lp.getFullYear() + '-' + ('0' + (lp.getMonth()+1)).slice(-2) + '-' + ('0' + lp.getDate()).slice(-2),
    selectedLen: L, daysSince: daysSince, cycleDay: stale ? null : day, daysLeft: stale ? null : L - daysSince,
    phase: stale ? 'Aktuelle Phase unbekannt' : ph.phase, stale: stale,
    /* null ausserhalb des Kulanzfensters, sonst Zahl >= 0. Die Anzeige
       unterscheidet daran, ob sie "ueberfaellig" texten darf. */
    ueberfaellig: spaet ? ueber : null,
    letzterStartStr: lpStr,
    /* Im Kulanzfenster steht der Balken voll, statt ueber 100 Prozent
       hinauszuwachsen — er zeigt dann "Zyklus rechnerisch abgelaufen". */
    fillPct: stale ? 0 : Math.min(100, Math.round(day / L * 100)),
    nextStr: stale ? ('Zuletzt eingetragen: ' + lpStr)
      : spaet ? ('Erwartet war ' + next.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }))
      : next.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }),
    daysLeftStr: stale ? 'Unbekannt'
      : spaet ? (ueber === 0 ? 'heute erwartet' : 'seit ' + ueber + (ueber === 1 ? ' Tag' : ' Tagen') + ' überfällig')
      /* Ohne "geschätzt" (Entscheidung 21.09.): die Tilde sagt bereits
         ungefaehr, und die Zahl beruht auf ihrer eigenen Angabe. */
      : 'in ~' + (L - daysSince) + ' Tagen' };
}

/* Frischt den Zyklus-Zustand aus den gespeicherten Rohwerten auf.
   Ein unbekannter Zyklus (kein lastPeriod) bleibt unverändert. */
export function cycleRefresh() {
  var cd = felieZyklusLesen();
  if (!cd || cd.unknown || !cd.lastPeriod) return cd;
  var fresh = cycleCompute(cd.lastPeriod, cd.selectedLen);
  if (!fresh) fresh = { stale: true, ueberfaellig: null, cycleDay: null, daysLeft: null, phase: 'Aktuelle Phase unbekannt',
    fillPct: 0, nextStr: '', daysLeftStr: 'Unbekannt' };
  Object.keys(fresh).forEach(function(k) { cd[k] = fresh[k]; });
  return cd;
}
