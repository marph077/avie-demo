/* Bruecke Altbestand <-> Repository (M2b) - seit Welle D, Paket D1c, ein
   Kern-Modul. Dazu der Nachzug der Neu-Hinweise nach einem Vorgang und die
   Standardfrist offener Themen.

   Bis D1c stand der Brueckenblock woertlich in index.html. Geaendert sind
   nur drei Dinge:

   1. Der Zustand eines laufenden Vorgangs (window._felieRepoAktiv,
      _felieBrueckeStore, _felieBrueckeChats, _felieRepoBeruehrt) ist
      Modulzustand. Die Webapp liest den aktiven Datensatz ueber
      felieRepoAktiv() und leert ihn ueber felieRepoAktivLeeren().
   2. felieBrueckeSchreiben oeffnet einen Speichervorgang nicht mehr ueber
      den globalen Namen felieDatenAendern, sondern ueber den verbundenen
      Vorgangs-Port (felieVorgangVerbinden). Der Vorgang selbst bleibt bis
      D1d in der Webapp.
   3. felieHinweisVonIhr und felieNeuHinweiseNachziehen stehen hier und
      nicht in neu-hinweise.js: sie brauchen die Bruecke, und so bleibt
      der Import einseitig (neu-hinweise.js kennt die Bruecke nicht).

   Der urspruengliche Wortlaut folgt unveraendert. */

import { felieNotizSchluessel } from './text.js';
import { felieRepoAktuell, felieRepoAnwenden, felieRepoBelegzustand, felieRepoFind, felieRepoId, felieRepoJetzt, felieRepoKlon, felieRepoKopf, felieRepoLeer, felieRepoNeuHinweise, felieRepoNeubewerten } from './repository.js';
import { felieDatensatzMerken, felieDatensatzStand, felieDatensatzTeile, felieStore } from './store.js';
import { felieNeueSnippets, felieNeueSnippetsSchreiben } from './neu-hinweise.js';
import { getSavedChats } from './gespraeche.js';

let repoAktiv = null;
let brueckeStore = null;
let brueckeChats = null;
let repoBeruehrt = false;
let vorgang = null;

/* Vorgangs-Port: eine Funktion, die einen Aenderungsrueckruf in einem
   Speichervorgang ausfuehrt und true oder false liefert - in der Webapp
   felieDatenAendern. Die Bruecke oeffnet damit selbst einen Vorgang, wenn
   noch keiner laeuft (felieBrueckeSchreiben). */
export function felieVorgangVerbinden(fn) {
  vorgang = typeof fn === 'function' ? fn : null;
}

function felieVorgangPort() {
  if (!vorgang) throw new Error('felie-Kern: kein Vorgang verbunden');
  return vorgang;
}

/* Frist eines neuen offenen Themas, wenn keine mitgegeben wurde. Dieselbe
   Zahl, die felieMerkUebernehmen seit jeher als Rueckfall benutzt. */
export const FELIE_FADEN_TAGE = 7;

/* ══ Brücke: Altbestand ↔ Repository — M2b ═════════════════════════════
   Die heutige Ablage kennt zwei flache Listen (fakten, episoden) und
   keine Revisionen, Quellen oder Sperren. Das Repository kennt genau
   das. Diese Bruecke uebersetzt in beide Richtungen:

     felieBrueckeSaat       Altbestand  →  Datensatz
     felieBrueckeProjektion Datensatz   →  fakten/episoden fuer die alte Oberflaeche

   Damit kann die vorhandene Oberflaeche unveraendert weiterlesen,
   waehrend die Entscheidungen durch das Repository laufen. Die Bruecke
   ist ausdruecklich ein Uebergang: M6 ersetzt die Saat durch die
   geprueste, wiederholbare Migration und entfernt die Rueckprojektion.

   Was hier NICHT passiert: kein Modellaufruf, kein Raten. Ein Alteintrag,
   dessen Herkunft sich nicht eindeutig aufloesen laesst, wird als
   'ambiguous' gefuehrt — sichtbar, bearbeitbar, aber nicht als belegte
   Gewissheit (I14). Er wird weder geloescht noch zu einer Bestaetigung
   erfunden. */

/* Bewusst eine Funktion und keine Konstante: die bestehenden
   Regressionen laden nur eine feste Liste von Variablendeklarationen in
   ihren Ausfuehrungskontext. Eine neue Konstante waere dort nicht
   definiert und die Bruecke stillschweigend kaputt — genau die Art
   Fehler, die eine gruene Suite verschweigen wuerde. */
export function felieBrueckeOwner() { return 'lokal'; }

/* ── Zeit: die Altablage rechnet in Millisekunden, der Vertrag in ISO ─ */

/* Ein offenes Thema OHNE Frist gibt es nicht: "voruebergehend" ohne
   Ende ist ein Widerspruch, und in der Anzeige wird daraus "Frist
   abgelaufen" — gerechnet gegen den 1.1.1970. Genau so sah es am
   18.09. aus: ein Thema aus dem gerade gefuehrten Gespraech stand als
   abgelaufen da, mit "Noch aktuell?" daneben (rest_tage: -20714).

   felieBrueckeZeit(undefined) liefert null, und null wandert
   unveraendert in expiresAt. Welcher Aufrufer die Frist verloren hat,
   liess sich nachtraeglich nicht mehr feststellen — deshalb wird sie
   hier abgefangen, wo alle Wege zusammenlaufen:

     - beim Anlegen faellt ein fehlender Wert auf die Standardfrist,
     - beim Aendern bleibt die bisherige Frist stehen.

   Eine Frist zu erben ist immer richtiger, als eine zu erfinden; und
   eine Standardfrist ist immer richtiger, als das Thema im Jahr 1970
   ablaufen zu lassen. */
export function felieFristOderStandard(ms) {
  return Number.isFinite(ms) ? ms : Date.now() + FELIE_FADEN_TAGE * 86400000;
}

export function felieFristBehalten(ms, bisher) {
  if (Number.isFinite(ms)) return felieBrueckeZeit(ms);
  return bisher || felieBrueckeZeit(felieFristOderStandard(ms));
}

export function felieBrueckeZeit(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
export function felieBrueckeMs(iso) {
  var t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
}

/* ── Saat: Altbestand einlesen ────────────────────────────────────── */

export function felieBrueckeGespraechId(c) { return String(c.id || c.timestamp); }

export function felieBrueckeGespraecheSaen(d, chats) {
  (chats || []).forEach(function (c) {
    if (!c) return;
    var cid = felieBrueckeGespraechId(c);
    d.conversations.push({ id: cid, kind: c.onboardingId ? 'onboardingArchive' : 'chat',
      createdAt: felieBrueckeZeit(c.timestamp), updatedAt: null, extractionState: 'complete' });
    (c.messages || []).forEach(function (m, i) {
      if (!m || typeof m.content !== 'string') return;
      d.messages.push({ id: cid + '-m' + i, conversationId: cid,
        role: m.role === 'user' ? 'user' : 'assistant', content: m.content,
        occurredAt: null, ordinal: i, originalMessageId: null, authoredInputEvidenceId: null });
    });
    /* Bestehende Sperren gehen nie durch die Uebersetzung verloren. */
    (c.kontextNachrichtenAuslassen || []).forEach(function (i) {
      if (!c.messages || !c.messages[i]) return;
      d.exclusions.push({ id: felieRepoId('exc'),
        target: { kind: 'message', messageId: cid + '-m' + i, range: null },
        purpose: 'allModelUse', reason: 'forgotten' });
    });
  });
}

/* Loest die alten Belege gegen den gespeicherten Verlauf auf. Eine
   Fundstelle zaehlt nur, wenn sie eindeutig ist: ein Gespraech, eine
   Nutzernachricht, der Belegtext tatsaechlich darin enthalten. Sonst
   null — und der Eintrag wird 'ambiguous' (Pruefall F45, I14). */
export function felieBrueckeAltbelege(d, e, chats) {
  var ids = Array.isArray(e.gespraechIds) ? e.gespraechIds : null;
  if (e.herkunftUnklar) return null;

  if (e.quelle === 'selbst')
    return [felieBrueckeQuelleAnlegen(d, { kind: 'direct', sourceEventId: 'import:' + e.id,
      fieldKey: null, authoredValue: null, confirmedRevisionId: null }, e)];

  if (e.quelle === 'kennenlernen')
    return [felieBrueckeQuelleAnlegen(d, { kind: 'onboarding', sourceEventId: 'import:' + e.id,
      fieldKey: String(e.id).indexOf('aufnahme:') === 0 ? String(e.id).split(':')[2] || 'kennenlernen' : 'kennenlernen',
      authoredValue: null, displayConversationIds: (ids || []).map(String) }, e)];

  if (!ids || ids.length !== 1) return null;
  if (!Array.isArray(e.belege) || !e.belege.length) return null;
  var cid = String(ids[0]);
  var chat = (chats || []).filter(function (c) { return felieBrueckeGespraechId(c) === cid; })[0];
  if (!chat) return null;

  var set = [];
  for (var i = 0; i < e.belege.length; i++) {
    var b = e.belege[i];
    var m = chat.messages && chat.messages[b.nachricht];
    if (!m || m.role !== 'user' || typeof m.content !== 'string' || !b.beleg) return null;
    var pos = m.content.indexOf(b.beleg);
    if (pos < 0) return null;
    set.push(felieBrueckeQuelleAnlegen(d, { kind: 'message', messageId: cid + '-m' + b.nachricht,
      sourceEventId: 'import:' + e.id + ':' + b.nachricht,
      range: { start: pos, end: pos + b.beleg.length }, contextMessageIds: [] }, e));
  }
  return set;
}

/* Die Erfassungszeit des Belegs ist die urspruengliche Bestaetigungszeit
   des Alteintrags. Eine Migration erfindet keine frische Bestaetigung. */
export function felieBrueckeQuelleAnlegen(d, locator, e) {
  var ev = { id: felieRepoId('ev'),
    recordedAt: felieBrueckeZeit(e.bestaetigtAm || e.zuletztAm || e.erfasstAm),
    assertion: 'explicit', locator: locator };
  d.evidence.push(ev);
  return ev.id;
}

/* Kurze Marke ueber den Inhalt, damit die Revisionskennung auch dann
   wandert, wenn zwei Aenderungen in dieselbe Millisekunde fallen.

   Ein Texthash waere als dauerhafter Loeschmarker verboten — er liesse
   geloeschten Inhalt erraten. Hier ist er keiner: die Marke entsteht bei
   jedem Saeen neu, wird nirgends gespeichert und geht nur zusammen mit
   dem Text selbst an das Modell. Sie verraet also nichts, was nicht
   ohnehin danebensteht. */
export function felieBrueckeInhaltsmarke(text) {
  var t = typeof text === 'string' ? text : '', h = 5381;
  for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function felieBrueckeEintragSaen(d, e, art, chats) {
  if (!e || typeof e.text !== 'string') return;
  /* Selbst bearbeitet (AL-86, seit D1c): die Bearbeitung ist die Quelle,
     nicht das alte Zitat. Die Bearbeitung sperrt die Ursprungsnachricht;
     auf das Zitat gestuetzt, zog die Sperre den Eintrag beim naechsten
     Neubewerten zurueck, und er verschwand. Mit Datensatz stuetzt ihn die
     direkte Quelle der Bearbeitung - genau die wird hier aus dem
     Bearbeitet-Zeichen der Altform wiederhergestellt. */
  var selbstBearbeitet = e.bearbeitetVon === 'selbst';
  var set = selbstBearbeitet
    ? [felieBrueckeQuelleAnlegen(d, { kind: 'direct', sourceEventId: 'import:' + e.id + ':bearbeitet',
        fieldKey: null, authoredValue: e.text, confirmedRevisionId: null },
        { bestaetigtAm: e.bearbeitetAm || e.bestaetigtAm || e.zuletztAm, erfasstAm: e.erfasstAm })]
    : felieBrueckeAltbelege(d, e, chats);
  /* Die Alt-ID bleibt die Identitaet des Eintrags, solange die Altablage
     die Persistenz ist. Sie steht im Merker der neuen Snippets, in den
     DOM-Knoten der Gedaechtnisansicht und in offenen Bearbeitungsfeldern;
     wuerde die Bruecke bei jedem Speichervorgang neu nummerieren, waeren
     alle diese Verweise nach der ersten Aenderung tot.
       Das heisst: die transiente Uebersetzung traegt vorerst die alten,
     textfuehrenden IDs weiter. Sie durch opake zu ersetzen ist genau die
     Aufgabe der Migration in M6 — dort einmal, mit Abbildung und
     Nachweis, statt hier bei jedem Schreibvorgang neu. */
  var entryId = String(e.id);
  /* Die Revisionskennung wird aus dem Eintrag abgeleitet statt gewuerfelt.
     Der Grund ist die Extraktion: sie bekommt diese Kennung mitgeschickt
     und gibt sie als ausgangsRevision zurueck. Bei einer gewuerfelten
     Kennung waere jede Rueckgabe sofort „veraltet", weil die Bruecke
     zwischendurch neu gesaet hat. Abgeleitet heisst: aendert sich der
     Inhalt oder die Bestaetigungszeit, aendert sich die Kennung — und
     genau dann ist eine Auswertung tatsaechlich ueberholt. */
  var revId = 'rev:' + entryId + ':' + (e.bestaetigtAm || e.erfasstAm || 0)
    + ':' + felieBrueckeInhaltsmarke(e.text);
  var erfasst = felieBrueckeZeit(e.erfasstAm);

  d.entries.push({ id: entryId, kind: art,
    /* Ohne geprueften Sachbezug bleibt der Eintrag frei. Einen
       strukturierten Bezug zu erfinden waere geraten — die Zuordnung
       gehoert zur Migration in M6, nicht in die Uebergangsbruecke. */
    semanticRef: { type: 'free', subjectId: 'ref-self', scopeId: null },
    category: art === 'topic' ? 'allgemein' : (e.kategorie || 'allgemein'),
    /* profileVisible ist die Ansichtszuordnung, nicht die Beleglage: in
       der Altform entscheidet genau sie, ob ein Eintrag unter „Ueber
       dich" oder unter „Aus unseren Gespraechen" steht. Sie bleibt bei
       einer Bearbeitung unberuehrt — eine Textkorrektur darf eine Karte
       nicht in einen anderen Bereich schieben (UI-ABLAEUFE 2). */
    profileVisible: art !== 'topic' && (e.quelle === 'selbst' || e.quelle === 'kennenlernen'),
    headRevisionId: revId, nextRevisionNumber: 2,
    createdAt: erfasst });

  d.revisions.push({ id: revId, entryId: entryId, number: 1, text: e.text,
    /* recordedAt traegt die letzte bekannte Bestaetigungszeit, nicht die
       Ersterfassung: sonst wuerde ein Alteintrag mit unklarer Herkunft,
       der keine belegte confirmation bekommt, in der Rueckprojektion
       ploetzlich aelter aussehen und frueher verfallen. */
    recordedAt: felieBrueckeZeit(e.bestaetigtAm || e.zuletztAm || e.erfasstAm) || erfasst,
    validFrom: null, validTo: null,
    expiresAt: art === 'topic' ? felieBrueckeZeit(e.faelligBis) : null,
    retention: art === 'topic' ? 'explicitDeadline' : (e.klasse === 'stabil' ? 'stable' : 'volatileDefault'),
    status: 'current', evidence: set ? 'supported' : 'ambiguous',
    historicalUse: 'allowed',
    confirmation: { at: null, evidenceIds: [] },
    supportSets: set ? [set] : [],
    /* manualUpdate traegt das Bearbeitet-Zeichen durch die naechste
       Projektion; mit 'import' ginge es dort verloren. */
    replacesRevisionId: null, changeReason: selbstBearbeitet ? 'manualUpdate' : 'import' });

  d.importRecords.push({ sourceDatasetId: 'felie_store_v1', sourceRecordKey: art + '#' + e.id,
    targetIds: [entryId], disposition: set ? 'migrated' : 'review' });

  /* Ein Gespraechslink ohne aufloesbares Zitat ist kein Beleg — er
     legitimiert keinen Satz und geht deshalb NICHT in die Support-Sets.
     Er ist aber die einzige Herkunftsangabe, die der Altbestand hat, und
     die Nutzerin erwartet beim Loeschen des Gespraechs, dass ein daraus
     stammender Eintrag mitgeht (E09). Deshalb haelt die Bruecke ihn als
     ausdrueckliche Loeschabhaengigkeit fest, getrennt von der Beleglage. */
  /* Ein selbst bearbeiteter Eintrag behaelt seine Gespraechszuordnung als
     Herkunftsangabe - wie mit Datensatz (felieBrueckeAltlinksNachziehen).
     Er traegt sich selbst und geht mit dem Gespraech nicht unter (E18). */
  if (!set || (selbstBearbeitet && (e.gespraechIds || []).length))
    (d.legacyHerkunft = d.legacyHerkunft || []).push({ entryId: entryId,
      belege: Array.isArray(e.belege) ? e.belege : [],
      conversationIds: (e.gespraechIds || []).map(String),
      unklarFest: e.herkunftUnklar === true });

  /* Der Zaehler „3× erwaehnt" bleibt als Anzeige erhalten; die
     Befoerderung zum Fakt entfaellt (E19). Er wird nicht mitgeschleppt,
     sondern aus der Zahl unabhaengiger Stuetzungen gelesen — eine
     eigenstaendige Bestaetigung IST eine erneute Erwaehnung. */
  if (art === 'topic' && (e.erwaehnungen || 1) > 1)
    d.revisions[d.revisions.length - 1].supportSets =
      felieBrueckeZaehlerNachbilden(d, set, e.erwaehnungen);
}

export function felieBrueckeZaehlerNachbilden(d, set, anzahl) {
  if (!set) return [];
  var raus = [set];
  for (var i = 1; i < anzahl; i++) raus.push(set);
  return raus;
}

/* Der dauerhafte Datensatz (M6) steht seit D1b in store.js; hier nur
   seine Uebernahme in eine frische Saat. */

/* Setzt den bestehenden Gedaechtnisteil in eine frische Saat ein. Kopiert
   wird dabei: der gehaltene Stand darf von einem laufenden Vorgang nicht
   veraendert werden, solange dieser nicht abgeschlossen ist. */
export function felieDatensatzUebernehmen(d) {
  var k = felieDatensatzStand();
  if (!k) return false;
  var kopie = felieRepoKlon(k);
  d.meta = kopie.meta;
  d.meta.ownerId = felieBrueckeOwner();
  d.profileBase = kopie.profileBase;
  d.referents = kopie.referents;
  felieDatensatzTeile().forEach(function (t) { d[t] = kopie[t] || []; });
  return true;
}

/* Solange die Altform daneben besteht, wird eine Gespraechszuordnung
   weiterhin dort gesetzt (felieErinnerungVerknuepfen schreibt in die
   flache Liste). Ohne diese Angleichung erreichte sie den dauerhaften
   Datensatz nicht mehr, und ein daraus stammender Eintrag ueberlebte das
   Loeschen seines Gespraechs (E09, v6-Regression). Die Zuordnung wird
   vereinigt, nie entfernt: was der Datensatz beim Loeschen aufgegeben
   hat, steht in der Altliste ohnehin nicht mehr. */
export function felieBrueckeAltlinksNachziehen(d, store) {
  var alle = ((store && store.fakten) || []).concat((store && store.episoden) || []);
  alle.forEach(function (f) {
    var ids = (f.gespraechIds || []).map(String);
    if (!ids.length) return;
    var eintrag = felieRepoFind(d.entries, String(f.id));
    if (!eintrag) return;
    var link = (d.legacyHerkunft || []).filter(function (l) { return l.entryId === eintrag.id; })[0];
    if (!link) {
      link = { entryId: eintrag.id, belege: Array.isArray(f.belege) ? f.belege : [],
        conversationIds: [], unklarFest: f.herkunftUnklar === true };
      (d.legacyHerkunft = d.legacyHerkunft || []).push(link);
    }
    ids.forEach(function (id) {
      if (link.conversationIds.indexOf(id) < 0) link.conversationIds.push(id); });
  });
}

export function felieBrueckeSaat(store, chats) {
  var d = felieRepoLeer(felieBrueckeOwner());
  felieBrueckeGespraecheSaen(d, chats);
  /* Liegt ein dauerhafter Stand vor, ist ER die Wahrheit ueber das
     Gedaechtnis — nicht die beiden flachen Altlisten. Sonst wuerde jeder
     Vorgang die Revisionen wieder auf eine einzige einebnen. */
  if (felieDatensatzUebernehmen(d)) {
    felieBrueckeAltlinksNachziehen(d, store);
    felieRepoNeubewerten(d);
    return d;
  }
  ((store && store.fakten) || []).forEach(function (f) { felieBrueckeEintragSaen(d, f, 'personal', chats); });
  ((store && store.episoden) || []).forEach(function (e) { felieBrueckeEintragSaen(d, e, 'topic', chats); });
  felieRepoNeubewerten(d);
  return d;
}

/* ── Projektion: zurück in die Form, die die Oberfläche liest ─────── */

/* Die Altform kennt nur ein Feld fuer Herkunft UND Anzeigeort. Der
   Anzeigeort steht im Vertrag als profileVisible und bleibt bei einer
   Bearbeitung stehen; die Belegart entscheidet nur noch, welche der
   beiden Selbstauskunftsformen gemeint ist. */
export function felieBrueckeQuelleLesen(d, entry, rev) {
  if (!entry.profileVisible) return 'gespraech';
  var arten = {};
  (rev.supportSets || []).forEach(function (s) {
    s.forEach(function (id) {
      var ev = felieRepoFind(d.evidence, id);
      if (ev) arten[ev.locator.kind] = true;
    });
  });
  if (arten.direct) return 'selbst';
  if (arten.onboarding) return 'kennenlernen';
  return 'selbst';
}

export function felieBrueckeAltbelegeLesen(d, rev) {
  var raus = [];
  (rev.supportSets || []).forEach(function (s) {
    s.forEach(function (id) {
      var ev = felieRepoFind(d.evidence, id);
      if (!ev || ev.locator.kind !== 'message') return;
      var m = felieRepoFind(d.messages, ev.locator.messageId);
      if (!m) return;
      var index = m.ordinal;
      var text = m.content.slice(ev.locator.range.start, ev.locator.range.end);
      if (raus.some(function (b) { return b.nachricht === index && b.beleg === text; })) return;
      var eintrag = { nachricht: index, beleg: text };
      var frage = (ev.locator.contextMessageIds || [])[0];
      if (frage) {
        var fm = felieRepoFind(d.messages, frage);
        if (fm) eintrag.frage = fm.ordinal;
      }
      raus.push(eintrag);
    });
  });
  return raus;
}

export function felieBrueckeGespraecheLesen(d, rev) {
  var raus = [];
  (rev.supportSets || []).forEach(function (s) {
    s.forEach(function (id) {
      var ev = felieRepoFind(d.evidence, id);
      if (!ev) return;
      var cid = null;
      if (ev.locator.kind === 'message') {
        var m = felieRepoFind(d.messages, ev.locator.messageId);
        cid = m && m.conversationId;
      } else if (ev.locator.kind === 'onboarding') {
        cid = (ev.locator.displayConversationIds || [])[0] || null;
      }
      if (cid == null) return;
      var zahl = Number(cid);
      var wert = Number.isFinite(zahl) && String(zahl) === String(cid) ? zahl : cid;
      if (raus.indexOf(wert) < 0) raus.push(wert);
    });
  });
  return raus;
}

/* Liefert genau die beiden Listen, die felieStore() heute haelt. Die
   Oberflaeche, felieFakten(), felieEpisoden() und die bestehenden
   Regressionen bleiben dadurch unveraendert lesbar. */
/* ── Schreibzugang: ein Vorgang, ein Commit ───────────────────────────
   Die Bruecke ist bewusst zustandslos je Speichervorgang: sie saet aus
   dem Altstand, wendet die Befehle an und projiziert zurueck. Es gibt
   keinen zweiten dauerhaften Speicher neben felie_store_v1.

   Der Grund ist die Umstellung selbst. Solange nicht alle Schreibwege
   umgelegt sind, wuerde ein dauerhafter Repositoriumsstand neben der
   Altablage auseinanderlaufen, sobald ein noch nicht umgestellter
   Schreiber die Altlisten anfasst. Zustandslos kann das nicht passieren:
   was die Altablage traegt, ist in jedem Vorgang die Ausgangslage.

   Was die Altform nicht ausdruecken kann — abgeloeste Fassungen und ihre
   Historie — lebt deshalb nur innerhalb eines Vorgangs. Das ist kein
   Verlust gegenueber heute: die Altform kennt gar keine Historie. Der
   dauerhafte Datensatz kommt mit M2c, die geprueffte Migration mit M6. */

export function felieBrueckeStart(s, chats) {
  repoAktiv = felieBrueckeSaat(s, chats);
  brueckeStore = s;
  brueckeChats = chats;
  repoBeruehrt = false;
  return repoAktiv;
}

/* Nach jedem Befehl zurueckprojizieren. Vorhandener Code liest den
   gerade geschriebenen Eintrag direkt aus store.fakten wieder heraus —
   ein Muster, das an vielen Stellen steht. Wuerde die Projektion erst
   am Ende des Speichervorgangs laufen, waere jede dieser Stellen
   stillschweigend kaputt. */
export function felieBrueckeNachziehen() {
  var s = brueckeStore;
  if (!s) return;
  var p = felieBrueckeProjektion(repoAktiv);
  s.fakten = p.fakten;
  s.episoden = p.episoden;
}

export function felieBrueckeBefehl(teil) {
  var d = repoAktiv;
  if (!d) throw new Error('Brücke: kein aktiver Datensatz');
  var befehl = { ownerId: d.meta.ownerId, operationId: felieRepoId('op'),
    expectedDatasetRevision: d.meta.datasetRevision };
  for (var k in teil) if (Object.prototype.hasOwnProperty.call(teil, k)) befehl[k] = teil[k];
  var r = felieRepoAnwenden(d, befehl);
  if (!r.ok) {
    var e = new Error('Brücke abgelehnt: ' + r.fehler + (r.meldung ? ' — ' + r.meldung : ''));
    e.repoFehler = r.fehler;
    throw e;
  }
  repoAktiv = r.datensatz;
  repoBeruehrt = true;
  felieBrueckeNachziehen();
  return r;
}

/* Baut die Belege eines Altaufrufs in Vertragsquellen um. Kann eine
   Fundstelle nicht eindeutig aufgeloest werden, entsteht KEINE Quelle —
   der Eintrag wird dann ausdruecklich unklar statt scheinbar belegt. */
export function felieBrueckeQuellenAus(d, f, gespraechId) {
  /* Ein Aufrufer, der eine historische Zeit mitgibt, meint sie auch:
     eine Nachmigration darf aus einer alten Aussage keine frische
     Bestaetigung machen. */
  var jetzt = f.bestaetigtAm != null || f.erfasstAm != null
    ? felieBrueckeZeit(f.bestaetigtAm != null ? f.bestaetigtAm : f.erfasstAm)
    : felieRepoJetzt();
  if (f.quelle === 'selbst')
    return [{ id: felieRepoId('ev'), recordedAt: jetzt, assertion: 'explicit',
      locator: { kind: 'direct', sourceEventId: felieRepoId('src'), fieldKey: null,
        authoredValue: f.text, confirmedRevisionId: null } }];
  if (f.quelle === 'kennenlernen') {
    var feld = String(f.id || '').indexOf('aufnahme:') === 0
      ? (String(f.id).split(':')[2] || 'kennenlernen') : 'kennenlernen';
    return [{ id: felieRepoId('ev'), recordedAt: jetzt, assertion: 'explicit',
      locator: { kind: 'onboarding', sourceEventId: felieRepoId('src'), fieldKey: feld,
        authoredValue: f.text, displayConversationIds: gespraechId == null ? [] : [String(gespraechId)] } }];
  }
  if (!Array.isArray(f.belege) || !f.belege.length) return [];

  /* Kennt der Aufrufer das Gespraech nicht, wird es aus den Belegen
     bestimmt — aber nur, wenn die Zuordnung eindeutig ist. Passen die
     Zitate auf mehrere Gespraeche, entsteht keine Quelle: eine gleiche
     Zeichenfolge beweist nicht dieselbe Aussage. Dieselbe Regel wendet
     die Altform in felieErinnerungAusChat an. */
  var kandidaten = gespraechId != null ? [String(gespraechId)]
    : d.conversations.map(function (c) { return c.id; });
  var treffer = [];
  kandidaten.forEach(function (cid) {
    var quellen = [];
    for (var i = 0; i < f.belege.length; i++) {
      var b = f.belege[i];
      var m = felieRepoFind(d.messages, cid + '-m' + b.nachricht);
      if (!m || m.role !== 'user' || !b.beleg) return;
      var pos = m.content.indexOf(b.beleg);
      if (pos < 0) return;
      /* Eine gebundene Bestaetigung traegt die Frage mit, auf die sie
         sich bezieht — im Vertrag ist das contextMessageIds. Entfaellt
         die Frage, entfaellt die Stuetzung. */
      var gebunden = Number.isInteger(b.frage) ? [cid + '-m' + b.frage] : [];
      quellen.push({ id: felieRepoId('ev'), recordedAt: jetzt,
        assertion: gebunden.length ? 'boundConfirmation' : 'explicit',
        locator: { kind: 'message', messageId: m.id, sourceEventId: felieRepoId('src'),
          range: { start: pos, end: pos + b.beleg.length }, contextMessageIds: gebunden } });
    }
    treffer.push(quellen);
  });
  return treffer.length === 1 ? treffer[0] : [];
}

/* Sucht den Eintrag, den ein Altaufruf meint. Zwei Wege, beide ohne
   Raten: die mitgegebene Alt-ID, oder wortgleicher Inhalt. Gleicher
   Wortlaut ist vollstaendige Deckung — unabhaengig von der Kategorie,
   denn ein gemeinsames Kategorielabel rechtfertigt kein Ueberschreiben
   und ein Kategoriewechsel verhindert keine Aktualisierung (E06). */
export function felieBrueckeZiel(d, art, f) {
  if (f.id) {
    var ueberId = felieBrueckeEintragZuAltId(d, art, f.id);
    if (ueberId) return ueberId;
  }
  var schluessel = felieNotizSchluessel(f.text);
  for (var i = 0; i < d.entries.length; i++) {
    var e = d.entries[i];
    if (e.kind !== art) continue;
    var kopf = felieRepoKopf(d, e.id);
    if (kopf && kopf.text && felieNotizSchluessel(kopf.text) === schluessel) return e;
  }
  return null;
}

/* Sucht einen Eintrag, bei dem GENAU DIESER Wortlaut schon einmal galt
   und abgeloest wurde. Vor dem dauerhaften Datensatz gab es das nicht zu
   finden: frueher Fassungen lebten nur innerhalb eines Vorgangs. Dass
   F35 trotzdem bestand, lag an den textabgeleiteten Alt-IDs — dieselbe
   Formulierung ergab dieselbe Kennung. Das war ein Zufall, kein Schutz,
   und mit opaken Kennungen waere er ersatzlos weg. */
export function felieBrueckeUeberholt(d, art, f) {
  var schluessel = felieNotizSchluessel(f.text);
  for (var i = 0; i < d.entries.length; i++) {
    var e = d.entries[i];
    if (e.kind !== art) continue;
    /* Geloescht heisst geloescht — auch wenn derselbe Satz aus derselben
       Quelle noch einmal gewonnen wird. */
    if ((e.forgottenKeys || []).indexOf(schluessel) >= 0) return { entry: e, revision: null };
    var kopf = felieRepoKopf(d, e.id);
    if (kopf && kopf.text && felieNotizSchluessel(kopf.text) === schluessel) return null;
    var treffer = d.revisions.filter(function (r) {
      return r.entryId === e.id && r.status !== 'current' && r.text
        && felieNotizSchluessel(r.text) === schluessel; })[0];
    if (treffer) return { entry: e, revision: treffer };
  }
  return null;
}

export function felieBrueckeAnlegen(art, f, gespraechId) {
  var d = repoAktiv;
  var quellen = felieBrueckeQuellenAus(d, f, gespraechId);
  var sets = quellen.length ? [quellen.map(function (q) { return q.id; })] : [];
  var ziel = felieBrueckeZiel(d, art, f);
  var kopf = ziel ? felieRepoKopf(d, ziel.id) : null;

  if (!ziel) {
    /* Derselbe Wortlaut galt hier schon einmal und wurde abgeloest. Eine
       erneute Auswertung auf dieser alten Grundlage darf die spaetere
       Fassung nicht ueberschreiben und auch keinen zweiten,
       widersprechenden Eintrag anlegen (E17, I08, Pruefall F35). Der
       aktuelle Wert bleibt unberuehrt; zurueckgegeben wird der Eintrag,
       um den es geht — eine Kennung auf nichts waere der Fehler aus
       Pruefall F49. */
    var ueberholt = felieBrueckeUeberholt(d, art, f);
    if (ueberholt) return ueberholt.entry.id;
  }

  if (ziel && kopf) {
    var gleich = felieNotizSchluessel(kopf.text || '') === felieNotizSchluessel(f.text);
    if (gleich) {
      /* Vollstaendig gedeckt: eine Bestaetigung, kein zweites Snippet.
         Ist der Beleg derselbe wie beim ersten Mal, aendert sich auch
         die Bestaetigungszeit nicht — das entscheidet das Repository. */
      var teil = { kind: 'confirm', entryId: ziel.id, expectedHeadRevisionId: kopf.id,
        evidence: quellen, supportSets: sets };
      if (art === 'topic' && f.faelligBis != null) teil.expiresAt = felieBrueckeZeit(f.faelligBis);
      felieBrueckeBefehl(teil);
      return ziel.id;
    }
    /* Anderer Wortlaut bei bekanntem Ziel: die Nutzerin oder ein
       strukturiertes Formular bestaetigt ausdruecklich den neuen Inhalt.
       Ohne zeitliche Einordnung wird die vorige Fassung nicht als
       damaliger Stand erzaehlt. */
    /* Bis zum 21.09.2026 stand hier "f.ersetzt ? 'transition' : 'manualUpdate'"
       (AL-07). Kein Aufrufer hat je ein Feld ersetzt gesetzt, der Zweig lief
       also immer auf manualUpdate. Ein transition - die vorige Fassung wird
       als damaliger Stand erzaehlt - entsteht an der dafuer vorgesehenen
       Stelle weiter unten, wo die zeitliche Einordnung tatsaechlich vorliegt.
       Die Verzweigung hier war ein Rest von davor. */
    felieBrueckeBefehl({ kind: 'manualUpdate', entryId: ziel.id,
      expectedHeadRevisionId: kopf.id,
      candidate: { text: f.text, supportSets: sets,
        evidence: quellen.length ? 'supported' : 'ambiguous',
        retention: art === 'topic' ? 'explicitDeadline' : (f.klasse === 'stabil' ? 'stable' : 'volatileDefault'),
        expiresAt: art === 'topic' ? felieFristBehalten(f.faelligBis, kopf && kopf.expiresAt) : null },
      evidence: quellen });
    return ziel.id;
  }

  var r = felieBrueckeBefehl({ kind: 'create',
    entry: { id: f.id ? String(f.id) : felieRepoId('ent'), kind: art,
      semanticRef: { type: 'free', subjectId: 'ref-self', scopeId: null },
      category: art === 'topic' ? 'allgemein' : (f.kategorie || 'allgemein'),
      profileVisible: art !== 'topic' && (f.quelle === 'selbst' || f.quelle === 'kennenlernen') },
    candidate: { text: f.text, supportSets: sets,
      evidence: quellen.length ? 'supported' : 'ambiguous',
      retention: art === 'topic' ? 'explicitDeadline' : (f.klasse === 'stabil' ? 'stable' : 'volatileDefault'),
      expiresAt: art === 'topic' ? felieBrueckeZeit(felieFristOderStandard(f.faelligBis)) : null },
    evidence: quellen,
    /* Kein Ziel gefunden heisst: kein vorhandener Eintrag deckt diesen
       Inhalt wortgleich. Eine anders formulierte Dublette laesst sich
       hier nicht erkennen — diese Entscheidung braucht die Ziel-ID aus
       der Extraktion und gehoert nach M3. */
    coverage: { examinedEntryIds: d.entries.map(function (e) { return e.id; }),
      verdict: 'independent', coveredByEntryId: null, decidedBy: 'extraction' } });
  var neuId = r.receipt.resultEntryIds[0];
  var dd = repoAktiv;
  if (f.erfasstAm != null) {
    var neuerEintrag = felieRepoFind(dd.entries, neuId);
    if (neuerEintrag) neuerEintrag.createdAt = felieBrueckeZeit(f.erfasstAm);
  }
  dd.importRecords.push({ sourceDatasetId: 'laufend',
    sourceRecordKey: art + '#' + neuId, targetIds: [neuId],
    disposition: quellen.length ? 'migrated' : 'review' });
  /* Liessen sich die Belege nicht aufloesen — etwa weil das Gespraech
     noch gar nicht gespeichert ist —, duerfen sie nicht verlorengehen.
     Die Bruecke haelt sie fest und projiziert sie zurueck; ist das
     Gespraech spaeter da, entsteht beim naechsten Saeen eine echte
     Quelle daraus. Bis dahin bleibt der Eintrag ausdruecklich unklar. */
  if (!quellen.length)
    (dd.legacyHerkunft = dd.legacyHerkunft || []).push({ entryId: neuId,
      belege: Array.isArray(f.belege) ? f.belege : [],
      conversationIds: gespraechId == null ? [] : [String(gespraechId)] });
  /* createdAt und die Herkunftsreste stehen erst nach dem Befehl fest —
     also noch einmal nachziehen, damit ein Aufrufer, der den Eintrag
     gleich wieder aus store.fakten liest, den fertigen Stand sieht. */
  felieBrueckeNachziehen();
  return neuId;
}

/* Wendet einen geprueften Vorschlag nach seinem Bezug an.

   widerspruch wird hier ausdruecklich NICHT angewendet. Das Repository
   koennte einen Konflikt festhalten, aber die Bruecke ist je
   Speichervorgang zustandslos — er waere beim naechsten Saeen weg. Ein
   Widerspruch gehoert deshalb der Nutzerin vorgelegt, nicht still
   verbucht; er kommt als Klaerung in die Vorschlagsliste. Der dauerhaft
   gespeicherte Konflikt folgt, wenn der Vertragsdatensatz die Persistenz
   ist (M6). */
export function felieBrueckeVorschlag(art, v, gespraechId) {
  if (!v || !v.text) return null;
  if (v.bezug === 'widerspruch') return null;
  var d = repoAktiv;
  if (!d) return felieBrueckeSchreiben(art, v, gespraechId);

  if (v.bezug === 'bestaetigung' || v.bezug === 'aktualisierung') {
    var eintrag = felieRepoFind(d.entries, v.zielId);
    var kopf = eintrag ? felieRepoKopf(d, eintrag.id) : null;
    if (!kopf) return null;
    var quellen = felieBrueckeQuellenAus(d, v, gespraechId);
    var sets = quellen.length ? [quellen.map(function (q) { return q.id; })] : [];
    if (v.bezug === 'bestaetigung') {
      felieBrueckeBefehl({ kind: 'confirm', entryId: eintrag.id, expectedHeadRevisionId: kopf.id,
        evidence: quellen, supportSets: sets });
      return eintrag.id;
    }
    felieBrueckeBefehl({ kind: 'transition', entryId: eintrag.id, expectedHeadRevisionId: kopf.id,
      candidate: { text: v.text, supportSets: sets,
        evidence: quellen.length ? 'supported' : 'ambiguous',
        retention: art === 'topic' ? 'explicitDeadline' : (v.klasse === 'stabil' ? 'stable' : 'volatileDefault'),
        expiresAt: art === 'topic' ? felieFristBehalten(v.faelligBis, kopf && kopf.expiresAt) : null },
      evidence: quellen });
    return eintrag.id;
  }
  return felieBrueckeAnlegen(art, v, gespraechId);
}

/* Oeffnet nur dann selbst einen Speichervorgang, wenn noch keiner laeuft:
   felieMerkUebernehmen und klV2Sichern rufen mehrfach hintereinander auf
   und sollen einen einzigen Commit ergeben. */
export function felieBrueckeSchreiben(art, f, gespraechId) {
  if (!f || !f.text) return null;
  if (repoAktiv) return felieBrueckeAnlegen(art, f, gespraechId);
  var id = null;
  var ok = felieVorgangPort()(function () {
    id = felieBrueckeAnlegen(art, f, gespraechId);
  });
  return ok ? id : null;
}

/* Der Bestand, wie ihn die Extraktion sieht: Kennung, aktuelle Revision,
   Text, Art und Kategorie. Keine Belege und keine Historie — das Modell
   soll zuordnen, nicht Quellen bewerten. Die Kennungen sind opak und
   tragen keinen Inhalt; es geht nichts Persoenliches zusaetzlich mit,
   was nicht ohnehin als Text mitginge. */
export function felieExtraktionsBestand() {
  var s = felieStore();
  var chats = [];
  try { chats = getSavedChats(); } catch (e) {}
  var d = felieBrueckeSaat(s, chats);
  return felieRepoAktuell(d, { einschliesslichUnklar: true }).map(function (x) {
    return { id: x.entryId, revision: x.revisionId,
      art: x.art === 'topic' ? 'thema' : 'angabe',
      text: x.text, kategorie: x.kategorie };
  });
}

/* Findet den Eintrag zu einer Alt-ID über das Importprotokoll. */
export function felieBrueckeEintragZuAltId(d, art, altId) {
  var schluessel = art + '#' + altId;
  for (var i = 0; i < d.importRecords.length; i++)
    if (d.importRecords[i].sourceRecordKey === schluessel) {
      var e = felieRepoFind(d.entries, d.importRecords[i].targetIds[0]);
      if (e) return e;
    }
  return null;
}

/* Schreibt die Sperren des Datensatzes in die Altform zurueck. Eine
   Sperre auf einer Quelle ist dort eine Sperre auf der Nachricht —
   feiner kann die Altablage es nicht. */
/* Die Sperre traegt jetzt die STELLE mit, an der die berichtigte Aussage
   stand — nicht mehr nur die Nachrichtennummer. Eine Nachricht, die
   mehrere Aussagen enthaelt, wird dadurch nicht mehr als Ganzes
   unbrauchbar: gesperrt ist der Bereich, nicht der Satz drumherum
   (E15, Pruefaelle F06, F14). Deckt der Bereich die ganze Nachricht,
   bleibt zusaetzlich die alte Nachrichtensperre stehen — daran haengen
   Anzeige und Archiv unveraendert weiter. */
export function felieBrueckeSperrenZurueck(d, chats) {
  (d.exclusions || []).forEach(function (x) {
    var mid = null, bereich = null;
    if (x.target.kind === 'message') mid = x.target.messageId;
    else {
      var ev = felieRepoFind(d.evidence, x.target.evidenceId);
      if (ev && ev.locator.kind === 'message') { mid = ev.locator.messageId; bereich = ev.locator.range; }
    }
    if (!mid) return;
    var m = felieRepoFind(d.messages, mid);
    if (!m) return;
    var chat = (chats || []).filter(function (c) {
      return felieBrueckeGespraechId(c) === m.conversationId; })[0];
    if (!chat) return;

    var ganz = !bereich || (bereich.start <= 0 && bereich.end >= (m.content || '').length);
    if (ganz) {
      chat.kontextNachrichtenAuslassen = chat.kontextNachrichtenAuslassen || [];
      if (chat.kontextNachrichtenAuslassen.indexOf(m.ordinal) < 0)
        chat.kontextNachrichtenAuslassen.push(m.ordinal);
      return;
    }
    chat.kontextStellenAuslassen = chat.kontextStellenAuslassen || [];
    var schon = chat.kontextStellenAuslassen.some(function (st) {
      return st.nachricht === m.ordinal && st.start === bereich.start && st.end === bereich.end; });
    if (!schon) chat.kontextStellenAuslassen.push({ nachricht: m.ordinal,
      start: bereich.start, end: bereich.end });
  });
}

/* Der Text einer Nachricht ohne die gesperrten Stellen. Gibt null
   zurueck, wenn nichts Tragfaehiges uebrig bleibt. */
export function felieStelleBereinigt(chat, index, text) {
  if ((chat.kontextNachrichtenAuslassen || []).indexOf(index) >= 0) return null;
  var stellen = (chat.kontextStellenAuslassen || []).filter(function (st) {
    return st.nachricht === index; });
  if (!stellen.length) return text;
  var raus = String(text || '');
  stellen.slice().sort(function (a, b) { return b.start - a.start; }).forEach(function (st) {
    raus = raus.slice(0, st.start) + raus.slice(st.end);
  });
  raus = raus.replace(/\s{2,}/g, ' ').trim();
  return raus.length > 3 ? raus : null;
}

/* Entfernt Alteintraege, deren einzige Herkunftsangabe dieses Gespraech
   war. Bleibt ein weiterer Link, bleibt der Eintrag — und bleibt
   ausdruecklich unklar (I14). */
/* Lassen sich die Zitate eines Alteintrags auf genau ein Gespraech
   zuruecklegen? Dieselbe Eindeutigkeitsregel wie in der Altform. */
export function felieBrueckeEindeutig(d, belege, ausser) {
  if (!Array.isArray(belege) || !belege.length) return false;
  var treffer = 0;
  d.conversations.forEach(function (c) {
    if (ausser && c.id === ausser) return;
    for (var i = 0; i < belege.length; i++) {
      var m = felieRepoFind(d.messages, c.id + '-m' + belege[i].nachricht);
      if (!m || m.role !== 'user' || !belege[i].beleg) return;
      if (m.content.indexOf(belege[i].beleg) < 0) return;
    }
    treffer++;
  });
  return treffer === 1;
}

export function felieBrueckeAltlinksLoeschen(cid) {
  var d = repoAktiv;
  var links = (d && d.legacyHerkunft) || [];
  links.forEach(function (l) {
    /* Eine einmal verlorene Zuordnung bleibt verloren: das Loeschen
       eines von mehreren passenden Gespraechen darf das letzte
       verbliebene nicht nachtraeglich zur bewiesenen Quelle machen
       (E10, I14). Deshalb wird die Unklarheit hier festgeschrieben. */
    if (!l.conversationIds.length && !l.unklarFest
        && !felieBrueckeEindeutig(d, l.belege)) l.unklarFest = true;
    if (l.conversationIds.indexOf(cid) < 0) return;
    l.conversationIds = l.conversationIds.filter(function (x) { return x !== cid; });
    if (l.conversationIds.length) return;
    var eintrag = felieRepoFind(repoAktiv.entries, l.entryId);
    if (!eintrag || !eintrag.headRevisionId) return;
    /* Der Altlink ist die Herkunftsangabe des Altbestands, kein Beleg.
       Hat der Eintrag inzwischen eine eigene Stuetzung — etwa weil die
       Nutzerin ihn von Hand bestaetigt oder geaendert hat —, dann traegt
       er sich selbst und geht mit dem Gespraech NICHT unter (E18,
       Pruefall F30). Vor dem dauerhaften Datensatz konnte das nicht
       auffallen: die Stuetzung entstand je Vorgang neu. */
    var kopf = felieRepoFind(repoAktiv.revisions, eintrag.headRevisionId);
    if (kopf && felieRepoBelegzustand(repoAktiv, kopf) === 'supported') return;
    felieBrueckeBefehl({ kind: 'forgetEntry', entryId: l.entryId,
      expectedHeadRevisionId: eintrag.headRevisionId });
  });
}

export function felieBrueckeAbschluss(s, chats) {
  brueckeStore = null;
  brueckeChats = null;
  if (!repoBeruehrt) return false;
  felieBrueckeSperrenZurueck(repoAktiv, chats);
  try { felieNeuHinweiseNachziehen(repoAktiv); } catch (e) {}
  /* Erst hier, nach allen Befehlen: was ein abgebrochener Vorgang
     angerichtet haette, wird nie gemerkt. */
  felieDatensatzMerken(repoAktiv);
  return true;
}

export function felieBrueckeProjektion(d) {
  var fakten = [], episoden = [];
  felieRepoAktuell(d, { einschliesslichUnklar: true, ohneFristpruefung: true }).forEach(function (s) {
    var entry = felieRepoFind(d.entries, s.entryId);
    var rev = felieRepoFind(d.revisions, s.revisionId);
    var belege = felieBrueckeAltbelegeLesen(d, rev);
    var gespraeche = felieBrueckeGespraecheLesen(d, rev);
    /* Was der Vertrag (noch) nicht traegt, geht trotzdem nicht verloren:
       nicht aufloesbare Zitate und Gespraechslinks werden unveraendert
       zurueckgereicht. Sind sie spaeter aufloesbar, entsteht beim
       naechsten Saeen eine echte Quelle daraus. */
    var rest = (d.legacyHerkunft || []).filter(function (x) { return x.entryId === entry.id; })[0];
    if (!belege.length || !gespraeche.length) {
      if (rest) {
        if (!belege.length) belege = rest.belege || [];
        if (!gespraeche.length) gespraeche = (rest.conversationIds || []).map(function (cid) {
          var z = Number(cid);
          return Number.isFinite(z) && String(z) === cid ? z : cid; });
      }
    }
    /* herkunftUnklar heisst in der Altform: diesem Eintrag laesst sich
       kein Gespraech mehr zuordnen. Eine noch nicht aufloesbare Quelle
       ist etwas anderes — solange Zitate oder ein Gespraechslink
       vorliegen, kann die Altform ihre Zuordnung selbst leisten. */
    /* Nicht attribuierbar heisst: gar keine Herkunftsangabe mehr, oder
       eine Zuordnung, die durch eine Loeschung verlorengegangen ist.
       Ein frisch angelegter Eintrag, dessen Gespraech noch gar nicht
       gespeichert ist, ist keins von beidem. */
    var ohneHerkunft = s.unklar
      && ((rest && rest.unklarFest)
        || (!gespraeche.length && d.conversations.length > 0
            && !felieBrueckeEindeutig(d, belege)));
    var erfasst = felieBrueckeMs(entry.createdAt) || felieBrueckeMs(rev.recordedAt);
    var bestaetigt = felieBrueckeMs(rev.confirmation.at) || felieBrueckeMs(rev.recordedAt) || erfasst;

    if (entry.kind === 'topic') {
      var ep = { id: entry.id, text: rev.text, status: 'offen',
        erfasstAm: erfasst, zuletztAm: bestaetigt,
        faelligBis: felieBrueckeMs(rev.expiresAt),
        erwaehnungen: Math.max(1, (rev.supportSets || []).length),
        belege: belege };
      if (gespraeche.length) ep.gespraechIds = gespraeche;
      if (ohneHerkunft) ep.herkunftUnklar = true;
      /* Seit D1c auch fuer Themen (AL-90): ohne das Zeichen galt ein selbst
         bearbeitetes Thema beim Umschreiben einer Archivnotiz als
         abgeleitet und wurde ausgemustert, und die Saat (AL-86) konnte die
         Bearbeitung nicht wiedererkennen. */
      if (rev.changeReason === 'manualUpdate' || rev.changeReason === 'correction') {
        ep.bearbeitetAm = felieBrueckeMs(rev.recordedAt);
        ep.bearbeitetVon = 'selbst';
      }
      episoden.push(ep);
    } else {
      var f = { id: entry.id, text: rev.text, kategorie: entry.category,
        klasse: rev.retention === 'stable' ? 'stabil' : 'volatil',
        erfasstAm: erfasst, bestaetigtAm: bestaetigt,
        quelle: felieBrueckeQuelleLesen(d, entry, rev), belege: belege };
      if (gespraeche.length) f.gespraechIds = gespraeche;
      if (ohneHerkunft) f.herkunftUnklar = true;
      /* bearbeitetAm ist in der Altform das Zeichen dafuer, dass die
         Nutzerin selbst Hand angelegt hat. Im Vertrag steht dieselbe
         Tatsache als Aenderungsgrund. */
      if (rev.changeReason === 'manualUpdate' || rev.changeReason === 'correction') {
        f.bearbeitetAm = felieBrueckeMs(rev.recordedAt);
        f.bearbeitetVon = 'selbst';
      }
      fakten.push(f);
    }
  });
  return { fakten: fakten, episoden: episoden };
}

/* Vorher/Nachher einer Aktualisierung.

   Der Vorher-Text ist eine Ableitung, keine zweite Wahrheit: er wird
   allein fuer diesen einen Hinweis gehalten. Deshalb faellt er mit der
   Kenntnisnahme weg, und ein Hinweis verschwindet ganz, sobald sein
   Eintrag nicht mehr tragfaehig ist — etwa weil die Quelle geloescht
   wurde. Ein geloeschter Inhalt darf nicht im Aenderungshinweis
   weiterleben (Pruefaelle F28, F30, F44). */
/* Hat die Nutzerin diese Aenderung selbst gemacht? Dann braucht sie
   keinen Hinweis darauf: sie hat den Satz gerade getippt. Der Hinweis
   ist dafuer da, dass sie sieht, was FELIE aus einem Gespraech geaendert
   hat — ihr den eigenen alten Satz durchgestrichen zurueckzuspielen,
   kommentiert ihr Tun (entschieden am 17.09.).

   Erkannt wird das an der Belegart: eine Bearbeitung im Gedaechtnis
   traegt eine direkte Quelle mit authoredValue, eine Ableitung aus einem
   Gespraech nicht. */
export function felieHinweisVonIhr(d, entryId) {
  var eintrag = felieRepoFind(d.entries, entryId);
  var kopf = eintrag && eintrag.headRevisionId
    ? felieRepoFind(d.revisions, eintrag.headRevisionId) : null;
  if (!kopf) return false;
  var selbst = false;
  (kopf.supportSets || []).forEach(function (set) {
    (set || []).forEach(function (id) {
      var ev = felieRepoFind(d.evidence, id);
      if (ev && ev.locator && ev.locator.kind === 'direct'
        && ev.locator.authoredValue != null) selbst = true;
    });
  });
  return selbst;
}

export function felieNeuHinweiseNachziehen(d) {
  var stand = felieNeueSnippets();
  /* Zur Kenntnis genommene Hinweise tragen keinen Vorher-Text mehr und
     haben damit nichts mehr zu zeigen. Sie fallen zuerst weg — sonst
     wuerde eine spaetere Aenderung derselben Angabe in einen leeren
     Hinweis hineinlaufen und ihr eigenes Vorher verlieren. */
  var hinweise = stand.hinweise.filter(function (x) { return x.vorher != null; });

  felieRepoNeuHinweise(d).forEach(function (h) {
    if (h.art === 'new' || h.nachher == null) return;
    if (felieHinweisVonIhr(d, h.entryId)) return;
    var da = hinweise.filter(function (x) { return x.id === h.entryId; })[0];
    /* Mehrere ungelesene Aenderungen derselben Angabe ergeben EINEN
       Hinweis: vom ersten noch zulaessigen Vorherstand bis zum
       neuesten Nachherstand. Keine Kette, keine doppelte Zaehlung. */
    if (da) { da.nachher = h.nachher; da.art = h.art; return; }
    /* Woraus der Vorher-Text stammt, wird mitgeschrieben. Der Datensatz
       wird je Vorgang neu gesaet, kennt die frueheren Revisionen also
       spaeter nicht mehr — ohne diese Notiz koennte niemand mehr sagen,
       welches Gespraech den alten Wortlaut getragen hat. */
    var vorRev = h.vorherRevisionId ? felieRepoFind(d.revisions, h.vorherRevisionId) : null;
    hinweise.push({ id: h.entryId, vorher: h.vorher, nachher: h.nachher, art: h.art,
      quellen: vorRev ? felieBrueckeGespraecheLesen(d, vorRev) : [] });
  });

  /* Wird das Gespraech geloescht, aus dem der alte Wortlaut stammt, faellt
     er mit. Die Angabe selbst kann eigenstaendig bestaetigt weiterleben
     (E18) — ihr frueherer Wortlaut aber ist eine Ableitung aus genau
     diesem Gespraech und darf es nicht ueberdauern (Pruefall F44). */
  var lebend = {};
  (d.conversations || []).forEach(function (c) { lebend[String(c.id)] = true; });
  hinweise.forEach(function (x) {
    var q = x.quellen || [];
    if (!q.length) return;
    if (q.some(function (id) { return lebend[String(id)]; })) return;
    delete x.vorher; x.quellen = [];
  });

  var tragfaehig = {};
  felieRepoAktuell(d, { einschliesslichUnklar: true, ohneFristpruefung: true })
    .forEach(function (x) { tragfaehig[x.entryId] = x.text; });
  hinweise = hinweise.filter(function (x) { return tragfaehig[x.id] != null; });
  hinweise.forEach(function (x) { x.nachher = tragfaehig[x.id]; });
  hinweise = hinweise.filter(function (x) { return x.vorher != null; });

  stand.hinweise = hinweise;
  if (hinweise.length) stand.gesehen = false;
  return felieNeueSnippetsSchreiben(stand);
}

/* ── Zugriff von aussen (seit D1c) ────────────────────────────────────
   Aenderungsfunktionen der Webapp lesen waehrend eines Vorgangs den
   aktiven Datensatz; felieDatenAendern leert ihn am Ende und im
   Fehlerfall. */
export function felieRepoAktiv() {
  return repoAktiv;
}

export function felieRepoAktivLeeren() {
  repoAktiv = null;
}

/* Frischer Modulzustand fuer eine neue Laufzeit (felieKernZuruecksetzen),
   auch der Vorgangs-Port. */
export function felieBrueckeZuruecksetzen() {
  repoAktiv = null;
  brueckeStore = null;
  brueckeChats = null;
  repoBeruehrt = false;
  vorgang = null;
}
