/* Modell-Anbindung (Welle F, F2a): Anfrage an den Worker nach Vertrag 1,
   Pruefung der Antwort und die Auswertung eines Gespraechs.

   Bis F2a in index.html. Der Wortlaut folgt unveraendert; geaendert ist
   nur, was an der Webapp hing:
   - das Netz: der Kern kennt kein fetch. Er bekommt einen Netz-Port
     hineingereicht (felieNetzVerbinden), anfragen(url, optionen, ms) ->
     Promise auf eine Antwort mit ok, status und json(). Webapp:
     src/webapp/netz-fetch.js (schlaegt felieFetch beim Aufruf nach),
     App: mobile/netz/netz-fetch.js. Hier - und nur hier - wird der Kern
     asynchron (Plan 2.1).
   - die Umgebung (felieModellVerbinden), beim Aufruf nachgeschlagen:
       personalitaet()       -> Stufen; ohne: PERSONALITY_DEFAULTS
       ritualFrisch()        -> Flag fuer den Worker
       homeKontext()         -> Kontext der Startseite (Modus willkommen)
       kennenlernenKontext() -> Uebergabe aus dem Kennenlernen (Modus chat)
     Startseite (D-20) und Kennenlernen bleiben bis F5 in der Webapp, die
     Persoenlichkeit laden bis F6.
   felie_grenze bleibt in der Antwort; einen Zustand bekommt es, wenn eine
   Oberflaeche es liest (AL-99, F2b).

   Tests: tests/felie-f2-modell.test.cjs (Ansatzstelle felieFetch ueber den
   Webapp-Port), tests/felie-f2-netz-vertrag.test.mjs (beide Netz-Ports). */

import { felieKontextDaten } from './kontext.js';
import { getSavedChats } from './gespraeche.js';
import { felieSichererVerlauf, felieExtraktionsDaten } from './archiv.js';
import { felieFakten, felieEpisoden, felieNotizVorschau } from './gedaechtnis.js';
import { felieAuswertungNeu, felieAuswertungProtokoll, felieAuswertungZaehlen, felieZusammenfassungPruefen } from './abschluss.js';
import { felieExtraktionsBestand } from './bruecke.js';
import { felieNotizSchluessel } from './text.js';

let netz = null;
let umgebung = null;

/* Beide Verbindungen wie die uebrigen Ports: die Tests rufen sie je
   frischer Laufzeit (felieKernZuruecksetzen setzt sie auf null), Webapp
   und App einmal beim Start. */
export function felieNetzVerbinden(p) {
  netz = p || null;
}

export function felieModellVerbinden(u) {
  umgebung = u || null;
}

function felieNetzPort() {
  if (!netz) throw new Error('felie-Kern: kein Netz-Port verbunden');
  return netz;
}

function aus(name, sonst) {
  return umgebung && typeof umgebung[name] === 'function' ? umgebung[name]() : sonst;
}

/* Voreinstellung der Persoenlichkeit (bis F2a in index.html). Die Webapp
   laedt und speichert die Stufen weiter selbst (loadPersonality, F6). */
export var PERSONALITY_DEFAULTS = { waerme: 3, direktheit: 4, ausfuehrlichkeit: 3, koerperbezug: 4, ton: 3, humor: false };

/* Antworten koennen der eigentlichen Antwort einen Denk-Block voranstellen
   — content[0] ist dann kein Text mehr, sondern
   { type: 'thinking', thinking: '...' }. Diese Funktion sucht den ERSTEN
   Block vom Typ 'text', unabhaengig von seiner Position. Sie bleibt auch
   bei abgeschaltetem Reasoning stehen: sie kostet nichts und faengt einen
   Ruecksetzer der Modellkonfiguration ab. */
export function felieReplyText(data) {
  if (!data || data.error || !Array.isArray(data.content)) return '';
  return data.content.filter(function(b) { return b && b.type === 'text' && typeof b.text === 'string'; })
    .map(function(b) { return b.text; }).join('\n');
}

export function felieDatenBlock(kind, value) {
  return '<felie_daten typ="' + kind + '">\n' + JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    + '\n</felie_daten>';
}

/* ══ Modellzugang ══════════════════════════════════════════════════════
   Eine Quelle fuer Endpunkt, Modell und Variante. Der Zugang lag vorher
   als eigener <script>-Block im <head> und umhuellte felieFetch von
   aussen: der Endpunkt stand dadurch doppelt in der Datei (einmal
   hartkodiert im Aufruf, einmal als Konstante mit Routenwaechter), und
   der Block loeschte ein thinking-Feld, das gar nicht mehr gesendet wird.
   Beides faellt weg, wenn der Aufruf selbst die Konstante benutzt.
     Die Variante waehlt das Modell serverseitig in der Tabelle des
   Workers; der Modellname im Rumpf ist die Gegenprobe dazu. */
export var FELIE_MODELL = {
  /* Eigene Domain statt der Worker-Kennung (AL-81, 22.09.2026). Der Client
     weiss damit nicht mehr, wer den Dienst betreibt — und ein Anbieter-
     wechsel ist eine DNS-Aenderung statt eines App-Releases. Das zaehlt
     konkret: haengt an Klaerung 1 die Antwort, dass die Durchleitung ueber
     Cloudflare den Deutschland-Satz nicht traegt, zieht hier nichts um. */
  endpunkt: 'https://api.felie.app',
  name:     'Qwen/Qwen3.8-27B',
  variante: 'qwen-27b',
  anbieter: 'ionos'
};
/* Vertrag mit dem Worker (E-T5, seit C2): die App sendet vertrag: 1 und
   erwartet felie_vertrag: 1 in jeder Antwort. Ausgabebudget, Sampling und
   Antwortformat setzt der Worker je Modus (C-4, C-6) - hier steht nichts
   mehr davon. maxAusgabe bleibt nur als Gegenprobe fuer stop_reason. */
export var FELIE_VERTRAG = 1;
export var FELIE_ANFRAGE = { maxAusgabe: 4096, maxZeichen: 240000, timeout: 65000 };

/* Die Antwort muss belegen, WELCHES Modell geantwortet hat. Ohne diese
   Pruefung wuerde ein stillschweigendes Zurueckfallen des Workers auf ein
   anderes Modell nicht auffallen — und genau das soll ein Vergleichstest
   ausschliessen. Reasoning muss aus bleiben, sonst sind die Antworten
   nicht mit der Referenz vergleichbar.
     Frueher hing daran zusaetzlich ein fest eingeblendetes Kopfband
   ("Qwen3.8 · IONOS · Vergleichstest"). Das war fuer den internen
   Modellvergleich gedacht, ist als Nutzerinnen-Ansicht aber fehl am
   Platz und deshalb entfernt — die Pruefung selbst (Wurf bei Abweichung)
   bleibt unveraendert bestehen. */
export function felieModellPruefen(data) {
  var meta = data && data.felie_test;
  if (!data || data.model !== FELIE_MODELL.name || !meta
      || meta.provider !== FELIE_MODELL.anbieter || meta.variant !== FELIE_MODELL.variante
      || (meta.reasoning_tokens != null && meta.reasoning_tokens > 0))
    throw new Error('Modell oder Reasoning entspricht nicht dieser Testfassung');
  /* Der Worker baut den Prompt (seit C1 immer) und muss sagen, welche
     Fassung. Fehlt die Angabe, hat er den Vertrag nicht verarbeitet und
     irgendetwas anderes geantwortet — das ist ein Fehler und kein
     Schoenheitsfehler, weil sonst unbemerkt ohne die Sicherheits- und
     Evidenzregeln geantwortet wuerde. */
  if (!data.felie_prompt_version)
    throw new Error('Antwort ohne Promptfassung: der Worker hat den Systemprompt nicht gebaut');
  /* Vertrag 1 (E-T5): antwortet der Worker mit einer anderen Fassung, sind
     App und Worker auseinander - dann ist nichts an der Antwort verlaesslich. */
  if (data.felie_vertrag !== FELIE_VERTRAG)
    throw new Error('Der Worker spricht Vertrag ' + data.felie_vertrag + ', die App Vertrag ' + FELIE_VERTRAG);
}

/* Der Systemprompt entsteht im Worker (E-T4, seit C1 / 24.09.2026): die
   App sendet den Vertrag — Modus, Persoenlichkeitsstufen, Flags — und den
   felie_daten-Kontext in der ersten Nachricht, nie Prompt-Text. Bis C1
   stand hier daneben der aeltere Weg, der ein fertiges system-Array
   schickte; die Bausteine dazu liegen jetzt in worker/src/prompt/bausteine.js. */
export function felieRequest(mode, messages, opts) {
  opts = opts || {};
  var msgs = (messages || []).map(function(m) { return { role: m.role, content: m.content }; });
  if (opts.context !== false) {
    var ctx = opts.context || (mode === 'willkommen' ? aus('homeKontext', {}) : felieKontextDaten());
    if (mode === 'chat') { var klKontext = aus('kennenlernenKontext', null); if (klKontext) ctx.kennenlernen = klKontext; }
    var prefix = { type: 'text', text: felieDatenBlock('kontext', ctx) };
    if (msgs.length && msgs[0].role === 'user') {
      msgs[0].content = [prefix].concat(typeof msgs[0].content === 'string'
        ? [{ type: 'text', text: msgs[0].content }] : msgs[0].content);
    } else msgs.unshift({ role: 'user', content: [prefix] });
  }
  /* Vertrag 1 (E-T5, C2). Nur Zahlen, Booleans und Schluessel aus bekannten
     Listen. Kein Feld, dessen Inhalt als Text in den Systemprompt fliesst —
     sonst laege die Sicherheitsgrenze wieder hier. Personenbezogenes reist
     unveraendert im felie_daten-Block in msgs[0].
       Bis C2 gingen model, max_tokens, temperature und top_p mit, dazu ein
     Flag abschluss, das nie gesetzt wurde (AL-74): alles Sache des Workers
     (C-4, C-5). Die Variante bleibt - sie ist der Schluessel in die
     Modelltabelle des Workers, keine Modell-ID. */
  var p = aus('personalitaet', null) || PERSONALITY_DEFAULTS;
  var body = { vertrag: FELIE_VERTRAG, felie_variant: FELIE_MODELL.variante, mode: mode,
    personality: { waerme: p.waerme, direktheit: p.direktheit,
      ausfuehrlichkeit: p.ausfuehrlichkeit, koerperbezug: p.koerperbezug,
      ton: p.ton, humor: !!p.humor },
    flags: { bekannt: felieKenntNutzerin(), ritualFrisch: !!aus('ritualFrisch', false) },
    messages: msgs };
  var serialized = JSON.stringify(body);
  if (serialized.length > FELIE_ANFRAGE.maxZeichen) {
    var limit = new Error('Kontextgrenze');
    limit.felieHinweis = 'Dieses Gespräch ist für eine weitere Antwort zu umfangreich. Speichere es und beginne ein neues Gespräch; deine gespeicherten Erinnerungen bleiben verfügbar.';
    return Promise.reject(limit);
  }
  var port;
  try { port = felieNetzPort(); } catch (e) { return Promise.reject(e); }
  return port.anfragen(FELIE_MODELL.endpunkt, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: serialized
  }, opts.timeout || FELIE_ANFRAGE.timeout).then(function(r) {
    if (!r.ok) throw new Error('felie HTTP ' + r.status);
    return r.json();
  }).then(function(data) {
    felieModellPruefen(data);
    /* AL-74 / C-5: der Worker sagt mit felie_grenze, ob dieses Gespraech
       das letzte im Freikontingent ist. Bis F2 stand hier
       window._felieGrenze = ..., gelesen wurde es nirgends (AL-99). Das
       Signal bleibt in data; einen Zustand bekommt es, wenn eine
       Oberflaeche es liest (F2b, Ablauf AL-66/AL-67 in F4). */
    if (data.error || !felieReplyText(data).trim()) throw new Error('Keine vollständige felie-Antwort');
    if (opts.json && data.stop_reason === 'max_tokens') throw new Error('JSON wurde abgeschnitten');
    return data;
  });
}

export function felieJSON(data) {
  if (!data || data.error || data.stop_reason === 'max_tokens') throw new Error('Unvollständiges JSON');
  var raw = felieReplyText(data).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  var value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON-Objekt erwartet');
  return value;
}

export async function felieNotizErzeugen(history, vorhanden, mode) {
  var source = felieExtraktionsDaten(history);
  if (!source.some(function(m) { return m.rolle === 'user'; })) throw new Error('Kein archivfähiges Gespräch');
  var out = { thema: 'Unser Gespräch', zusammenfassung: null, notizen: [], fakten: [], faeden: [],
    feldQuelle: {}, version: 5, notizenStatus: 'vollstaendig' };
  /* Seitengroesse der Auswertung. Gemessen am 17.09. beim Speichern eines
     normalen Gespraechs: 17,1 s + 18,9 s = 36 s fuer ZWEI Runden,
     gleichmaessig lang. Die Zeit steckt also in der Zahl der Runden, nicht
     in ihrer Laenge — und jede Runde schickt das ganze Gespraech plus rund
     13.600 Zeichen Systemprompt erneut.

     Das Tokenlimit ist dabei nicht der Hebel: der Client fordert bereits
     4096 an, und der Worker deckelt bei ebenfalls 4096. Mehr Ausgabe waere
     auch keine Beschleunigung, weil Token nacheinander erzeugt werden.
     Der Hebel ist, wie viele Eintraege EINE Runde liefern darf.

     Von 6 auf 12: ein ergiebiges Gespraech ist damit meist in einer Runde
     fertig, rund 18 statt 36 Sekunden. Reisst die Antwort doch ab, halbiert
     der Fehlerpfad weiter unten die Seite (12 → 6 → 3) und versucht es
     erneut — das kostet dann die Runde, die wir sparen wollten, bleibt aber
     die Ausnahme. */
  var groesse = 12, fehlerOhneFortschritt = 0, runden = 0, nachgefasst = 0;
  /* Auswertungsprotokoll (AL-11): nur Zahlen und Gruende, im Kern
     (src/kern/abschluss.js). */
  var protokoll = felieAuswertungNeu();
  var bekannt = (vorhanden || []).reduce(function(liste, n) {
    return liste.concat([n.ursprungstext, n.text].filter(Boolean));
  }, []);
  /* Bis hierher kannte die Extraktion nur, was sie im SELBEN Lauf schon
     vorgeschlagen hatte — der Aufruf laeuft mit context:false, also ohne
     Gedaechtnis. Eine im Kennenlernen erfasste Schwangerschaft war fuer
     dieses Modell schlicht nicht vorhanden, und sobald das Gespraech sie
     streifte, kam sie als "neuer" Fakt zurueck. Das betraf jeden
     dauerhaften Fakt, nicht nur die Lebensphase.
       Deshalb kommt das Gemerkte hier als Ausgangsbestand mit. Nur die
   Texte, keine Kennungen und keine Belege: die Extraktion soll damit
   vergleichen, nicht darauf verweisen. */
  var gemerkt = { fakten: [], faeden: [] };
  try {
    gemerkt.fakten = felieFakten().map(function(f) { return f.text; });
    gemerkt.faeden = felieEpisoden({ nurAktuell: true }).map(function(e) { return e.text; });
  } catch (e) {}
  var bestand = [];
  try { bestand = felieExtraktionsBestand(); } catch (e) {}
  function unvollstaendig() {
    out.notizenStatus = 'unvollstaendig';
    out.hinweis = 'Die Notizen sind noch nicht vollständig. Du kannst sie im Archiv ergänzen; bereits erfasste Einträge bleiben erhalten.';
  }
  while (true) {
    var page;
    try {
      page = await felieRequest(mode || 'zusammenfassung', [{ role: 'user', content: felieDatenBlock('gespraech', {
        gespraech: source,
        /* Der Bestand mit Kennung: erst damit kann die Extraktion sagen,
           WELCHEN Eintrag ein Vorschlag meint. bereits_erfasst geht
           waehrend der Uebergangszeit weiter mit, damit ein noch nicht
           ausgelieferter Worker mit dem alten Auftrag nicht ohne
           Dublettenhinweis dasteht; mit Paket S2 faellt es weg. */
        bestand: bestand,
        bereits_erfasst: {
          notizen: bekannt.concat(out.notizen.map(function(n) { return n.text; })),
          fakten: gemerkt.fakten.concat(out.fakten.map(function(n) { return n.text; })),
          faeden: gemerkt.faeden.concat(out.faeden.map(function(n) { return n.text; }))
        },
        antwortpaket: { maximalNeueEintraege: groesse, hinweis: 'Nur die Größe dieser Antwort ist begrenzt. weitere_notizen=true, solange noch wichtige neue Informationen fehlen. Keine bereits erfassten Inhalte wiederholen.' },
        formathinweis: fehlerOhneFortschritt ? 'Prüfe text, Nutzer-ID und Originalauszug. Formuliere fehlende Notizen mit passenden Belegen. Keine ausdrückliche Selbsterkenntnis erforderlich.' : null
      }) }], { context: false, json: true });
      page = felieZusammenfassungPruefen(felieJSON(page), source, bestand);
    } catch (e) {
      if (++fehlerOhneFortschritt < 2) { groesse = Math.max(1, Math.floor(groesse / 2)); continue; }
      /* AL-100 (Marcel, 25.09.): die Zusammenfassung zaehlt als Ergebnis.
         Bis F2b ging ein Gespraech mit Zusammenfassung, aber ohne Notiz,
         Angabe oder Faden beim Scheitern der naechsten Runde in den
         Notlauf - und die Zusammenfassung war verloren. */
      if (!out.notizen.length && !out.fakten.length && !out.faeden.length && !out.zusammenfassung) throw e;
      unvollstaendig(); break;
    }
    if (out.thema === 'Unser Gespräch' && page.thema) out.thema = page.thema;
    var zuwachs = 0;
    /* AL-100: eine neue Zusammenfassung ist Fortschritt wie ein neuer
       Eintrag (zaehlt fuer die Pruefung ohne Fortschritt, nicht fuers
       Protokoll: felieAuswertungZaehlen bekommt nur die Eintraege). */
    var neueZusammenfassung = false;
    if (!out.zusammenfassung && page.zusammenfassung) { out.zusammenfassung = page.zusammenfassung; neueZusammenfassung = true; }
    ['notizen', 'fakten', 'faeden'].forEach(function(k) {
      page[k].forEach(function(n) {
        if (k === 'notizen' && bekannt.some(function(t) { return felieNotizSchluessel(t) === felieNotizSchluessel(n.text); })) return;
        /* Ein Vorschlag mit Bezug auf einen vorhandenen Eintrag darf
           nicht an der Textgleichheit haengenbleiben: eine Bestaetigung
           wiederholt die Angabe absichtlich woertlich. */
        if (!n.zielId && out[k].some(function(e) { return felieNotizSchluessel(e.text) === felieNotizSchluessel(n.text); })) return;
        if (n.zielId && out[k].some(function(e) { return e.zielId === n.zielId && e.bezug === n.bezug; })) return;
        if (k === 'notizen') n.id = 'notiz:' + out.notizen.length;
        out[k].push(n); zuwachs++;
      });
    });
    felieAuswertungZaehlen(protokoll, page, zuwachs);
    /* Jede Runde ist ein vollstaendiger Modellaufruf mit dem ganzen
       Gespraech und rund 4.000 Token Systemprompt, und das Gespraech
       erscheint erst nach der letzten unter „Deine letzten Gespraeche".
       Bis hierher loeste JEDER verworfene Vorschlag eine weitere Runde
       aus — und seit M3 gibt es viel mehr Gruende zu verwerfen
       (unbekannte zielId, veraltete ausgangsRevision, fehlender
       zeitbezug, falsche Kategorie). Aus einer Runde wurden leicht vier.
         Beim Nachfassen wegen Verworfenem wird deshalb hoechstens EINMAL
       nachgehakt. Sagt das Modell selbst, dass noch etwas fehlt
       (weitere_notizen), wird weitergefragt wie bisher. */
    runden++;
    var nachfassen = page.verworfen > 0 && nachgefasst < 1;
    if (nachfassen) nachgefasst++;
    var brauchtWeiter = page.weitere_notizen || nachfassen ||
      (!out.notizen.length && !out.zusammenfassung && !bekannt.length
        && mode !== 'profil' && !page.listenformat);
    if (!brauchtWeiter) break;
    if (runden >= 6) { unvollstaendig(); break; }
    if (!zuwachs && !neueZusammenfassung) {
      if (++fehlerOhneFortschritt >= 2) { unvollstaendig(); break; }
    } else fehlerOhneFortschritt = 0;
  }
  /* Ein Gespraech ohne Notiz, aber mit Angaben oder Themen, ist nicht
     fertig ausgewertet — es ist eines, bei dem die Zusammenfassung
     gefehlt hat. Vorher wurde das als 'vollstaendig' verbucht: die
     Archivkarte sah abgeschlossen aus und war leer, und die Nutzerin
     bekam nicht einmal den Knopf zum Ergaenzen. Der Auftrag an das
     Modell (felieMerkPromptTeil im Worker) verlangt die Notiz ausdruecklich; das
     hier ist das Netz darunter. */
  /* Nicht fertig ist ein Gespraech, aus dem etwas gewonnen wurde, dem
     aber die Zusammenfassung fuers Archiv fehlt. Ob Notizen dabei sind,
     entscheidet nicht darueber: wenn alles Gesagte zu Angaben geworden
     ist, ist keine Notiz das richtige Ergebnis (E04). */
  /* Erweitert am 22.09.: die Bedingung verlangte, dass UEBERHAUPT etwas
     gewonnen wurde. Ein Gespraech, aus dem gar nichts wurde, galt damit
     als fertig ausgewertet — die Archivkarte sah abgeschlossen aus, und
     weil notizen ein (leeres) Array und der Status 'vollstaendig' war,
     erschien nicht einmal der Knopf 'Notizen ergaenzen'. Genau dieser
     Fall trat auf, wenn das Modell den bezug wegliess (siehe oben).
       'profil' ist ausgenommen: die Extraktion aus dem Kennenlernen
     liefert nie eine Zusammenfassung, dort ist ihr Fehlen kein Mangel. */
  if (mode !== 'profil' && !out.zusammenfassung && !out.notizen.length) unvollstaendig();
  out.runden = runden;
  /* Das Kennenlernen fuehrt kein Protokoll: sein Archiveintrag entsteht
     anders, und es bleibt unberuehrt. */
  if (mode !== 'profil') out.auswertung = felieAuswertungProtokoll(protokoll, runden);
  felieNotizVorschau(out);
  return out;
}

/* Kennt felie diese Nutzerin schon? Gemessen am Bestand, nicht an der
   laufenden Sitzung — jede der drei Spuren allein reicht:
     - gefuehrte Gespraeche (archiveContext liefert sie ohnehin mit)
     - gemerkte Fakten aus der Merknotiz
     - ihre eigene Selbstbeschreibung aus dem Kennenlernen
   Die Schwellen sind bewusst niedrig. Ein zweites Gespraech ist bereits
   eine Vorgeschichte, und "sie zu frueh als bekannt behandeln" ist der
   deutlich kleinere Fehler: felie fragt dann eben trotzdem nach. Der
   umgekehrte Fehler klingt, als haette sie alles vergessen. */
export function felieKenntNutzerin() {
  return getSavedChats().some(function(c) { return felieSichererVerlauf(c.messages).some(function(m) { return m.role === 'user'; }); })
    || felieFakten().length > 0;
}
