/* Der Speichervorgang - seit Welle D, Paket D1d, ein Kern-Modul (D-7).

   Bis D1d stand er als felieDatenAendern in index.html. Dort bleibt eine
   duenne Huelle mit demselben Namen und demselben Rueckgabewert; sie gibt
   die Anteile der Webapp als Haken mit (Kennenlernen-Zustand, Abgleich
   des laufenden Chats, Sitzungszaehler, Autosave) und zeigt die Meldungen.
   Der Kern meldet nur, WARUM ein Vorgang nicht durchging.

   Geaendert gegenueber index.html:

   1. Das Zurueckrollen des Speichers macht der Port (transaktion, D-4) mit
      Mitschrift (D-9): zurueckgesetzt wird jeder Schluessel, der im
      Vorgang ueber den Port geschrieben wurde - nicht mehr eine feste
      Liste von fuenf. In Expo leistet dasselbe withTransactionSync. Regel:
      innerhalb eines Vorgangs wird nur ueber den Port geschrieben.
   2. Der Arbeitsspeicher (Store, Datensatz, aktiver Datensatz) wird wie
      bisher hier zurueckgesetzt; der Kennenlernen-Zustand ueber den Haken
      zuruecksetzen.

   Reihenfolge und Wortlaut folgen sonst unveraendert dem Original. */

import { FELIE_STORE_KEY, felieSpeicherHorchen, felieSpeicherFremdAenderung, felieSpeicherStandMerken,
  felieSpeicherSchreiben, felieSpeicherTransaktion } from './speicher.js';
import { felieStore, felieStoreLaden, felieStoreSetzen, felieRevision, felieDatensatzStand,
  felieDatensatzVerworfen, felieDatensatzSetzen, felieDatensatzSpeichern } from './store.js';
import { getSavedChats } from './gespraeche.js';
import { felieBrueckeStart, felieBrueckeAbschluss, felieRepoAktivLeeren } from './bruecke.js';

/* aenderung(store, chats) veraendert Store und Gespraechsliste; sie wirft,
   wenn der Vorgang nicht passt. umgebung (alle Felder freiwillig):

     sichern()             -> Sicherung der Umgebung (Webapp: _klState)
     zuruecksetzen(s)      stellt sie im Fehlerfall wieder her
     vorSpeichern()        nach der Aenderung, vor dem Schreiben
     schreiben()           schreibt eigene Schluessel - nur ueber den Port
     nachSpeichern(chats)  nach dem Schreiben, noch im Vorgang

   Ergebnis: { ok: true } oder { ok: false, grund: 'fremd' | 'fehler',
   fehler }. */

/* Laeuft gerade ein Vorgang? Dann die Gespraechsliste, auf der er
   arbeitet. */
let laufend = null;

export function felieVorgang(aenderung, umgebung) {
  /* Ein Vorgang im Vorgang tritt bei (D-10, AL-91). Seine Aenderung
     gehoert zum aeusseren: gespeichert und zurueckgerollt wird einmal,
     vom aeusseren. Wirft sie, geht der Fehler an den aeusseren weiter und
     laesst ihn scheitern - eine Meldung, nicht zwei. Vorher oeffnete der
     innere einen eigenen Vorgang, speicherte, leerte den aktiven
     Datensatz, und der aeussere scheiterte daran („Noch aktuell?" → „Ja"
     ging nie). Dieselbe Regel hat felieBrueckeSchreiben seit M2b. */
  if (laufend) {
    aenderung(felieStore(), laufend.chats);
    return { ok: true };
  }
  var u = umgebung || {};
  felieSpeicherHorchen();
  /* Transaktionsgrenze: ALLES, was dieser Vorgang schreibt, wird vorher
     gesichert und im Fehlerfall gemeinsam zurueckgesetzt. Bis zum 18.09.
     fehlten der Vertragsdatensatz (felie_dataset_v2) und seine
     Arbeitsspeicherkopie. Schlug das Speichern NACH
     felieDatensatzSpeichern() fehl, meldete die App korrekt den
     Fehlschlag und zeigte den alten Text — im Datensatz stand aber schon
     die abgelehnte Aenderung, und die naechste erfolgreiche Aenderung
     holte sie zurueck in die Oberflaeche (Supervisor-Abnahme, A1). */
  var before = JSON.stringify(felieStore());
  var sicherung = u.sichern ? u.sichern() : null;
  var datensatzVorher = felieDatensatzStand() ? JSON.stringify(felieDatensatzStand()) : null;
  var datensatzVerworfenVorher = felieDatensatzVerworfen();
  try {
    return felieSpeicherTransaktion(function () {
      /* Hat ein anderer Tab seit dem Laden geschrieben, gewann bisher
         stillschweigend der letzte Schreiber — die Arbeit des anderen Tabs
         war weg. Jetzt bricht der Vorgang ab, der Stand wird neu geladen
         und die Nutzerin sieht, was passiert ist. */
      var fremd = felieSpeicherFremdAenderung();
      if (fremd.length) {
        felieStoreLaden();
        felieSpeicherStandMerken();
        felieRevision(true);
        return { ok: false, grund: 'fremd', schluessel: fremd };
      }
      var chats = getSavedChats();
      laufend = { chats: chats };
      /* Ein Vorgang, ein Datensatz: alle umgestellten Schreibwege wenden
         ihre Befehle auf denselben Stand an und werden gemeinsam
         uebernommen oder gemeinsam verworfen. */
      felieBrueckeStart(felieStore(), chats);
      aenderung(felieStore(), chats);
      felieBrueckeAbschluss(felieStore(), chats);
      if (u.vorSpeichern) u.vorSpeichern();
      felieSpeicherSchreiben(FELIE_STORE_KEY, JSON.stringify(felieStore()));
      felieDatensatzSpeichern();
      felieSpeicherSchreiben('felie_saved_chats', JSON.stringify(chats));
      if (u.schreiben) u.schreiben();
      felieRevision(true);
      if (u.nachSpeichern) u.nachSpeichern(chats);
      felieSpeicherStandMerken();
      felieRepoAktivLeeren();
      laufend = null;
      return { ok: true };
    });
  } catch (e) {
    laufend = null;
    felieRepoAktivLeeren();
    felieStoreSetzen(JSON.parse(before));
    felieDatensatzSetzen(datensatzVorher ? JSON.parse(datensatzVorher) : null, datensatzVerworfenVorher);
    if (u.zuruecksetzen) u.zuruecksetzen(sicherung);
    /* Den Speicher hat die Transaktion schon zurueckgesetzt. */
    felieSpeicherStandMerken();
    felieRevision(true);
    return { ok: false, grund: 'fehler', fehler: e };
  }
}

/* Frischer Modulzustand fuer eine neue Laufzeit (felieKernZuruecksetzen). */
export function felieVorgangZuruecksetzen() {
  laufend = null;
}
