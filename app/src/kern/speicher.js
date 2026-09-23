/* Speicher-Port, Speicherschluessel und Fremdaenderung - seit Welle D,
   Paket D1b, ein Kern-Modul (Schnittstelle nach Entscheidung D-4).

   Der Kern kennt kein localStorage. Er bekommt einen Port hineingereicht:

     lesen(schluessel)          -> Zeichenkette oder null
     schreiben(schluessel, wert)
     loeschen(schluessel)
     beobachten(rueckruf)       -> optional; meldet Schluessel, die eine
                                   andere Instanz geschrieben hat
     transaktion(fn)            -> optional (seit D1d); fuehrt fn aus und
                                   setzt im Fehlerfall alles zurueck, was
                                   fn ueber den Port geschrieben hat, dann
                                   wirft es weiter. Liefert fns Ergebnis

   Alle drei Grundoperationen sind synchron und reichen Fehler unveraendert
   weiter: die Aufrufer im Kern fangen sie genau dort, wo sie sie schon in
   index.html gefangen haben. transaktion(fn) nutzt seit D1d der
   Speichervorgang (vorgang.js).

   Webapp: src/webapp/speicher-localstorage.js. Expo spaeter: eine eigene
   kleine Tabelle auf SQLiteDatabase (expo-sqlite, openDatabaseSync) mit
   denselben Schluesseln und demselben Format, transaktion ueber
   withTransactionSync. expo-sqlite/kv-store taugt dafuer nicht: es
   bietet keine Transaktion an (D-4, korrigiert in D1d).

   Der urspruengliche Wortlaut der verschobenen Teile folgt unveraendert;
   geaendert sind nur die Zugriffe auf window (jetzt Modulzustand) und
   auf localStorage (jetzt der Port). */

let port = null;
let horcht = false;
let fremd = {};

/* Verbindet den Port. Ein neuer Port hat noch niemanden angemeldet und
   noch nichts Fremdes gesehen - deshalb beginnen beide Merker neu. Die
   Tests rufen es je frischer Laufzeit, die Webapp-Bruecke einmal. */
export function felieSpeicherVerbinden(p) {
  port = p || null;
  horcht = false;
  fremd = {};
}

function felieSpeicherPort() {
  if (!port) throw new Error('felie-Kern: kein Speicher-Port verbunden');
  return port;
}

export function felieSpeicherLesen(schluessel) { return felieSpeicherPort().lesen(schluessel); }
export function felieSpeicherSchreiben(schluessel, wert) { felieSpeicherPort().schreiben(schluessel, wert); }
export function felieSpeicherLoeschen(schluessel) { felieSpeicherPort().loeschen(schluessel); }

/* Ein Port ohne transaktion fuehrt fn einfach aus: dann gibt es kein
   Zurueckrollen des Speichers. Die Webapp und Expo bringen eine mit. */
export function felieSpeicherTransaktion(fn) {
  var p = felieSpeicherPort();
  return typeof p.transaktion === 'function' ? p.transaktion(fn) : fn();
}

export const FELIE_STORE_KEY    = 'felie_store_v1';

/* ── Alle localStorage-Schluessel an EINER Stelle ─────────────────────
   Vorher hielten felieBackupData() und doResetUserData() je eine eigene
   handgepflegte Liste. Die liefen auseinander: felie_store_v1 fehlte im
   Backup (behoben) und fehlte zusaetzlich im Loeschpfad — dort bis jetzt.
   Folge: "Nutzerdaten loeschen" und "Einwilligung widerrufen" entfernten
   Profil und Gespraeche, liessen aber Signale, Fakten und Episoden
   stehen. Nach einem neuen Onboarding standen deshalb Eintraege aus
   frueheren Sitzungen im Gedaechtnis, die wie fest eingebaute
   Beispieldaten wirken.
   Beide Funktionen lesen jetzt diese Liste. Wer einen Schluessel
   hinzufuegt, traegt ihn genau hier ein. */
export const FELIE_DATENSATZ_KEY = 'felie_dataset_v2';

export const FELIE_LS_KEYS = [
  'felie_profile', 'felie_saved_chats', 'felie_body_data', FELIE_STORE_KEY,
  /* Der dauerhafte Gedaechtnisteil des Vertragsdatensatzes (M6). Er
     gehoert in die Sicherung: ohne ihn waere eine zurueckgespielte
     Sicherung um alle Revisionen, Belege und Sperren aermer, und die
     Altlisten allein wuerden beim naechsten Vorgang wieder zu einer
     einzigen Fassung je Angabe eingeebnet. */
  FELIE_DATENSATZ_KEY,
  'felie_personality',
  'felie_guide_archiv', 'felie_guide_dashboard', 'felie_guide_profil',
  'felie_guide_gedaechtnis', 'felie_guide_home',
  'felie_backup_hint_off',
  /* Merkzettel: welche Eintraege stammen aus dem zuletzt gespeicherten
     Gespraech und hat die Nutzerin sie schon gesehen. Gehoert in die
     Liste, weil ein liegengebliebener Merker nach dem Loeschen einen
     Puls fuer Eintraege zeigen wuerde, die es nicht mehr gibt. */
  'felie_neue_snippets',
  /* Ein Gespraech, das beim Archivieren gescheitert ist und auf den
     naechsten Versuch wartet (M24). Gehoert in die Liste, weil es sonst
     ein Zuruecksetzen ueberlebt und danach ein geloeschtes Gespraech
     wieder im Archiv auftauchen wuerde. */
  'felie_archiv_wartend',
  /* Abschlussauftraege je Gespraech (A2, 18.09.): Verlauf, Auswertung
     und Gedaechtnisuebernahme mit fester ID. Loest felie_archiv_wartend
     ab; ein dort noch liegendes Gespraech wird beim ersten Zugriff
     uebernommen. In dieser Liste aus demselben Grund wie der Vorgaenger. */
  'felie_abschluss_wartend',
  /* Markierung der Selbstreflexion nach dem Onboarding. Gehoert in diese
     Liste, weil sie sonst ein Zuruecksetzen ueberlebt und die frisch
     geleerte App die Markierung nicht mehr zeigt. */
  'felie_onboarding_v1'
];

/* Nur loeschen, nicht sichern:
   - felie_body_history: stillgelegter Parallelspeicher.
   - felie_store_migrated: Merker der avie_-Umbenennung. Bleibt er liegen,
     laeuft die Migration nach einem Loeschen nicht erneut — sie soll auf
     einem geleerten Speicher aber wieder greifen duerfen.
   - felie_session_id: pseudonyme Kennung, die am Feedback haengt. Sie
     gehoert bei einem vollstaendigen Loeschen weg. Bewusst NICHT ins
     Backup: eine auf ein anderes Geraet zurueckgeholte Kennung wuerde
     zwei Nutzungen zu einer verschmelzen. */
export const FELIE_LS_KEYS_ALTLAST = ['felie_body_history', 'felie_store_migrated', 'felie_session_id', 'felie_checkins', 'felie_body_reminder_date', 'felie_wearable'];

/* ── Speicheradapter M2c (Auszug) ─────────────────────────────────────
   Aktiv ist die Altablage: mehrere Schluessel, wie bisher. Neu daran ist
   nur eine Pruefung - ob seit dem Laden ein anderer Tab geschrieben hat.
   Bisher gewann stillschweigend der letzte Schreiber, und die Arbeit des
   anderen Tabs war weg. (Die IndexedDB-Ablage aus M2c wandert nicht mit,
   siehe AL-10.) */

export function felieSpeicherSchluessel() {
  return [FELIE_STORE_KEY, FELIE_DATENSATZ_KEY, 'felie_saved_chats',
    'felie_onboarding_v1', 'felie_neue_snippets'];
}

/* ── Fremdänderung erkennen (aktiv) ───────────────────────────────── */

/* Fremd heisst: aus einem ANDEREN Fenster. Genau dafuer gibt es das
   storage-Ereignis — es feuert nie fuer den eigenen Tab. Ein Vergleich
   der rohen Werte taugt dafuer nicht: die App schreibt dieselben
   Schluessel auch ausserhalb eines Speichervorgangs (felieStoreSpeichern,
   saveChat, klV2Sichern), und jeder dieser Wege saehe wie eine
   Fremdaenderung aus. Ein Fehlalarm waere schlimmer als die Luecke: er
   wuerde eine gerade getippte Aenderung verwerfen. */
export function felieSpeicherFremdMerker() {
  return fremd;
}

export function felieSpeicherHorchen() {
  if (horcht) return false;
  /* Das storage-Ereignis ist Sache der Umgebung: der Port meldet nur den
     Schluessel. Ein Port ohne beobachten (Expo, eine Instanz) meldet nie. */
  if (!port || typeof port.beobachten !== 'function') return false;
  var angemeldet = port.beobachten(function (schluessel) {
    if (!schluessel) return;
    if (felieSpeicherSchluessel().indexOf(schluessel) < 0) return;
    felieSpeicherFremdMerker()[schluessel] = true;
  });
  if (!angemeldet) return false;
  horcht = true;
  return true;
}

/* Liefert die Schluessel, die ein anderes Fenster veraendert hat, und
   vergisst sie danach — der Aufrufer hat sie behandelt. */
export function felieSpeicherFremdAenderung() {
  var merker = felieSpeicherFremdMerker();
  var raus = Object.keys(merker);
  fremd = {};
  return raus;
}

/* Beibehalten fuer Aufrufer, die den Stand nach einem Schreibvorgang
   quittieren wollen; der Merker wird dabei geleert. */
export function felieSpeicherStandMerken() {
  fremd = {};
  return true;
}
