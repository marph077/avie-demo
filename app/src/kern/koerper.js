/* Koerperdaten - seit Welle D, Paket D7b (AL-93, F-4), ein Kern-Modul.

   Speichern und Laden der Koerperdaten (felie_body_data plus Store), die
   Lebensphasen (Daten und Regeln) und das Eintragen aus dem Zyklus-Sheet.
   Bis D7b standen sie in index.html (saveBodyData, loadBodyData,
   FELIE_LEBENSPHASEN, felieLebensphase, klV2ZyklusLebensphase,
   klV2ZyklusVoreinstellen und der Speichern-Handler in showCycleInput).
   Geprueft vor dem Umzug: tests/felie-d7-koerper.test.cjs (D7a).

   Der Zustand selbst (Zyklus, Zeitpunkt der letzten Koerperdaten) steht in
   zyklus.js: die Rechnung dort liest ihn, und dieses Modul braucht die
   Rechnung - so bleibt der Kern ohne Ringimport. Zugriff nur ueber
   felieZyklusLesen/felieZyklusSetzen und felieKoerperZeit/
   felieKoerperZeitSetzen; die Webapp hat kein window.cycleData mehr.

   Geaendert ist nur die Verdrahtung: window.cycleData ->
   Zugriffsfunktionen, localStorage -> Speicher-Port, saveBodyData ->
   felieKoerperSpeichern, klV2Hat -> der Lebensschritt aus a. Kommentare
   und Regeln unveraendert. */

import { felieSpeicherLesen, felieSpeicherSchreiben } from './speicher.js';
import { felieStoreLaden, felieStoreSpeichern } from './store.js';
import { cycleCompute, cycleRefresh, felieKoerperZeit, felieKoerperZeitSetzen,
  felieZyklusLesen, felieZyklusPlanZuruecksetzen, felieZyklusSetzen } from './zyklus.js';
import { felieUebernehmeAltObjekt } from './signale.js';

export const FELIE_KOERPER_KEY = 'felie_body_data';

/* Nutzertexte: eingefroren (D7-4), Pruefsumme je Eintrag in
   tests/felie-d7-koerper.test.cjs. Aendern nur mit Freigabe, danach die
   Summen dort erneuern - wie KL_SCHRITTE (AL-73). */
function tiefFrieren(o) {
  Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') tiefFrieren(o[k]); });
  return Object.freeze(o);
}

/* ── Speichern und Laden ──────────────────────────────────────────── */

/* Frueher wurde hier ein ZWEITER Verlauf gefuehrt: felie_body_history,
   ein Datensatz pro Kalendertag mit einem einzigen src-Feld fuer den
   ganzen Tag. Damit konnte er Selbstauskunft und Messung nicht
   auseinanderhalten. Der Store kann das, also ist der Parallelspeicher
   entfallen — eine Quelle der Wahrheit statt zwei. (Die leere
   bodyHistoryPush, die nur noch hier gerufen wurde, ist mit D7b weg.)

   Es ist "Koerperdaten sichern", nicht "Zyklus sichern" (D7-2): neun
   Stellen in der Webapp rufen es, darunter Signale und manuelle Werte,
   und der Store wird bewusst jedes Mal mitgeschrieben. Seit D7b geht
   felie_body_data ueber den Speicher-Port; in einem Speichervorgang wird
   der Schluessel damit mit zurueckgerollt (D-9). */
export function felieKoerperSpeichern() {
  /* Der Store ist ab jetzt die Quelle der Wahrheit. Der alte Schluessel
     bleibt nur fuer den Zyklus und als Migrationspfad bestehen. */
  try { felieStoreSpeichern(); } catch (e) {}
  try {
    felieSpeicherSchreiben(FELIE_KOERPER_KEY, JSON.stringify({
      cycleData: felieZyklusLesen() || null,
      updatedAt: felieKoerperZeit() || null
    }));
  } catch(e) {}
}

export function felieKoerperLaden() {
  /* Reihenfolge ist wichtig: erst der Zyklus, damit die Zyklusattribute
     der Signale sofort abgeleitet werden koennen, dann der Store.
     AL-98: felie_body_data wird fuer sich gelesen. Stand das Lesen mit im
     selben try, fiel bei einem unlesbaren Wert auch felieStoreLaden() weg,
     und das naechste Speichern schrieb einen leeren Store ueber das
     Gedaechtnis. Ein unlesbarer Zyklus kostet den Zyklus, nie mehr. */
  var d = null;
  try { d = JSON.parse(felieSpeicherLesen(FELIE_KOERPER_KEY) || 'null'); } catch (e) { d = null; }
  try {
    if (d) {
      if (d.cycleData) { felieZyklusSetzen(d.cycleData); try { cycleRefresh(); } catch (e) {} }
      if (d.updatedAt) felieKoerperZeitSetzen(d.updatedAt);
    }
    var geladen = false;
    try { geladen = felieStoreLaden(); } catch (e) {}
    /* Migration: Altbestand nur uebernehmen, wenn noch kein Store da ist.
       In der Webapp lief das ueber den Setter von window.manualBodyData;
       der ruft fuer ein Objekt genau felieUebernehmeAltObjekt. */
    if (!geladen && d && d.manualBodyData) felieUebernehmeAltObjekt(d.manualBodyData);
  } catch(e) {}
}

/* ── Lebensphasen ─────────────────────────────────────────────────── */

/* Lebensphasen an EINER Stelle. Die Liste stand frueher nur im
   Sheet-Renderer, die Hormonbeschriftung nur in einer zweiten Tabelle
   daneben — das Onboarding kann jetzt dieselbe Phase voreinstellen, und
   zwei Listen waeren die Stelle gewesen, an der Label und Beschriftung
   spaeter auseinanderlaufen.
     'stillzeit' ist neu: die Koerperfrage im Kennenlernen bietet sie an,
   das Zyklus-Sheet kannte sie nicht — eine uebernommene Angabe haette
   sonst keinen passenden Eintrag gehabt.

   zyklus: darf neben dieser Lebensphase ein Periodenstart mitlaufen?
   Bei Stillzeit, Wechseljahren, Postmenopause und einem unregelmaessigen
   Zyklus kommen Blutungen weiter vor — oft selten und unregelmaessig,
   und genau deshalb ist das Mitschreiben dort wertvoll. Vorher schloss
   die Wahl einer Lebensphase die Eingabe komplett aus; wer in den
   Wechseljahren ihre Periode festhalten wollte, musste sich zwischen
   beidem entscheiden.
     Schwangerschaft und "Keine Periode aktuell" bleiben ausgenommen: dort
   gibt es per Definition keinen Start einzutragen, und ein Feld dafuer
   waere eine Einladung zu einer erfundenen Angabe. */
/* Die Hormonangabe je Lebensphase ist am 21.09.2026 entfallen (AL-51). Die
   Tabelle trug je Phase eine Behauptung ueber ihren Hormonstatus - hCG und
   Progesteron hoch, Prolaktin hoch, Oestrogen dauerhaft niedrig -, die auf
   der Zykluskarte in einem eigenen Feld erschien. Damit behauptete die App
   einen Hormonstatus, abgeleitet aus einer Auswahl in einem Dropdown, im
   Layout eines Messwerts. Die Phase selbst bleibt: die ist ihre eigene
   Angabe. */
export const FELIE_LEBENSPHASEN = tiefFrieren([
  { val: 'schwangerschaft', label: 'Schwangerschaft',              sub: 'Hormone verändern sich stark',
    phase: 'Schwangerschaft',        zyklus: false },
  { val: 'stillzeit',       label: 'Stillzeit',                    sub: 'Zyklus setzt oft noch aus',
    phase: 'Stillzeit',              zyklus: true },
  { val: 'wechseljahre',    label: 'Wechseljahre / Perimenopause', sub: 'Östrogen und Progesteron sinken',
    phase: 'Wechseljahre',           zyklus: true },
  { val: 'postmenopause',   label: 'Postmenopause',                sub: 'Nach den Wechseljahren',
    phase: 'Postmenopause',          zyklus: true },
  { val: 'unregelmaessig',  label: 'Unregelmäßiger Zyklus',        sub: 'Keine klare Periode',
    phase: 'Unregelmäßiger Zyklus',  zyklus: true },
  { val: 'keine-periode',   label: 'Keine Periode aktuell',        sub: 'Z.B. durch Pille, Stress oder anderes',
    phase: 'Keine Periode',          zyklus: false }
]);

export function felieLebensphase(val) {
  return FELIE_LEBENSPHASEN.find(function(p) { return p.val === val; }) || null;
}

/* ── Lebensphase aus dem Kennenlernen ─────────────────────────────── */

/* Welche Lebensphase folgt aus dem Kennenlernen?
   ────────────────────────────────────────────────────────────────────
   Bewusst NUR die drei eindeutigen Angaben. Nicht uebernommen werden:
   - 'hormonelle Verhuetung': viele haben darunter eine Abbruchblutung und
     fuehren ihren Zyklus normal weiter. Daraus "keine Periode" zu machen,
     waere eine Unterstellung.
   - 'natuerlicher Zyklus' und die Frage "wo stehst du gerade": daraus
     liesse sich nur ein erfundenes Startdatum ableiten. Die Angabe bleibt
     Fakt im Gedaechtnis; die Karte bleibt leer, bis sie einen Tag eintraegt.
   Reihenfolge ist Rangfolge: Schwangerschaft schlaegt Stillzeit schlaegt
   Wechseljahre, falls mehrere angetippt wurden. */
/* Seit D7b liest die Regel den Lebensschritt aus a selbst. In index.html
   fragte sie klV2Hat('leben', 'schwanger'), also klZustand().committed -
   und das ist genau das a, das der einzige Aufrufer uebergibt
   (klV2SichernIntern: klV2ZyklusVoreinstellen(s.committed)). */
export function klV2ZyklusLebensphase(a) {
  if (!a) return null;
  var koerper = a.koerper && !a.koerper.skipped ? (a.koerper.selected || []) : [];
  var leben = a.leben && !a.leben.skipped ? (a.leben.selected || []) : [];
  var gewaehlt = leben.indexOf('schwanger') >= 0 ? koerper.concat(['Schwangerschaft']) : koerper;
  var karte = [['Schwangerschaft', 'schwangerschaft'], ['Stillzeit', 'stillzeit'],
               ['Perimenopause / Wechseljahre', 'wechseljahre']];
  var treffer = karte.find(function(p) { return gewaehlt.indexOf(p[0]) >= 0; });
  return treffer ? treffer[1] : null;
}

/* Die Angabe stand bisher nur als Fakt im Gedaechtnis. Im Dashboard traf
   die Nutzerin trotzdem auf die gesperrte Zykluskarte und musste ihre
   Schwangerschaft ein zweites Mal angeben — das liest sich, als haette
   felie nicht zugehoert.
     quelle: 'kennenlernen' markiert die Voreinstellung als aenderbar.
   Sobald sie im Sheet selbst etwas waehlt, steht dort 'selbst', und ein
   erneuter Durchlauf fasst den Eintrag nicht mehr an. */
export function klV2ZyklusVoreinstellen(a) {
  var val = klV2ZyklusLebensphase(a);
  if (!val) return false;
  var cd = felieZyklusLesen();
  if (cd && cd.quelle !== 'kennenlernen') return false;
  if (cd && cd.unknownType === val) return false;
  var p = felieLebensphase(val);
  if (!p) return false;
  felieZyklusSetzen({
    phase: p.phase,
    /* Ein frueherer Periodenstart bleibt erhalten: er ordnet die bereits
       vorhandenen Eintraege weiter zu. phaseAb markiert, ab wann die
       Lebensphase gilt. */
    lastPeriod:  cd && cd.lastPeriod  || null,
    selectedLen: cd && cd.selectedLen || null,
    phaseAb: Date.now(),
    cycleDay: null, daysLeft: null,
    unknown: true, unknownType: val, lebensphase: p.phase, quelle: 'kennenlernen'
  });
  try { felieKoerperSpeichern(); } catch (e) {}
  return true;
}

/* ── Zyklus-Sheet: Eintragen ──────────────────────────────────────── */

/* Der neue Zustand aus einer Eingabe im Zyklus-Sheet, oder null, wenn es
   nichts einzutragen gibt. Rein: liest nur die Eingabe und den bisherigen
   Zustand. neuerStart sagt, ob ein Periodenstart eingetragen wurde.
     Nur die Rohwerte merken — alles Abgeleitete rechnet cycleCompute()
   bei jeder Anzeige neu, damit der Zyklustag nicht einfriert. */
export function felieZyklusEintrag(eingabe, vorher) {
  eingabe = eingabe || {};
  var lastPeriodVal = eingabe.lastPeriod;
  var p = eingabe.phaseVal ? felieLebensphase(eingabe.phaseVal) : null;
  /* Drei Faelle statt zwei sich ausschliessender Wege:
     nur Zyklus, nur Lebensphase, oder beides zusammen. Letzteres ist
     der eigentliche Punkt — in Stillzeit, Wechseljahren, Postmenopause
     und bei unregelmaessigem Zyklus kommen Blutungen weiter vor, und
     gerade dort lohnt das Mitschreiben. */
  var mitZyklus = !!lastPeriodVal && !(p && p.zyklus === false);
  var c = mitZyklus ? cycleCompute(lastPeriodVal, eingabe.selectedLen) : null;
  if (!c && !p) return null;
  vorher = vorher || {};
  if (c) {
    /* unknown bleibt false: der Zyklus IST berechenbar. Die Lebensphase
       steht daneben, nicht an seiner Stelle — alles Nachgelagerte
       (Karte, Kontext, Zuordnung von Eintraegen) haengt an unknown und
       darf durch die Zusatzangabe nicht abgeschaltet werden. */
    return { zustand: Object.assign(c, p
      ? { unknownType: p.val, lebensphase: p.phase, phaseAb: vorher.phaseAb || Date.now(), quelle: 'selbst' }
      : { unknownType: null, lebensphase: null, quelle: 'selbst' }), neuerStart: true };
  }
  return { zustand: {
    phase: p.phase,
    /* Ein frueherer Periodenstart bleibt stehen: er ordnet vorhandene
       Eintraege weiter zu. phaseAb markiert, ab wann die Phase gilt. */
    lastPeriod:  vorher.lastPeriod  || null,
    selectedLen: vorher.selectedLen || null,
    phaseAb: Date.now(),
    cycleDay: null, daysLeft: null,
    unknown: true, unknownType: p.val, lebensphase: p.phase, quelle: 'selbst'
  }, neuerStart: false };
}

/* Traegt ein, was das Sheet gespeichert haben will: Zustand setzen,
   Erinnerungsplan bei einem neuen Start zuruecksetzen, sofort sichern.
   Gibt den neuen Zustand zurueck oder null (dann ist nichts passiert). */
export function felieZyklusEintragen(eingabe) {
  var e = felieZyklusEintrag(eingabe, felieZyklusLesen());
  if (!e) return null;
  felieZyklusSetzen(e.zustand);
  /* Ein neuer Periodenstart setzt den Erinnerungsplan zurueck. */
  if (e.neuerStart) { try { felieZyklusPlanZuruecksetzen(); } catch (err) {} }
  /* Sofort schreiben. Der Rest der Verarbeitung haengt an einem
     Zeitgeber von 1,2 Sekunden, der nur die Bestaetigung am Knopf
     stehen laesst — wer die App in diesem Fenster schliesst oder
     neu laedt, verlor bisher die gerade gemachte Eingabe. */
  try { felieKoerperSpeichern(); } catch (err) {}
  return e.zustand;
}
