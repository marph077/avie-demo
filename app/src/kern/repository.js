/* Gedaechtnis-Repository (M2a) - seit Welle D, Paket D1a, ein Kern-Modul.

   Bis D1a stand dieser Block woertlich in index.html. Er war schon damals
   bewusst abgeschlossen gebaut: keine DOM-Zugriffe, kein localStorage,
   kein Netzwerk. Er nimmt einen Datensatz und einen Befehl entgegen und
   gibt einen neuen Datensatz zurueck. Verschoben wurde er deshalb ohne
   inhaltliche Aenderung; geaendert sind nur zwei Dinge:

   1. Die Nahtstellen felieRepoJetzt und felieRepoZufall lesen keine
      window-Haken mehr, sondern Modulzustand (felieRepoUhrSetzen,
      felieRepoZufallSetzen). Der Kern kennt kein window.
   2. Jede Funktion ist exportiert. Die Webapp-Bruecke haengt sie unter
      demselben Namen ans window; der Rest von index.html ruft sie wie
      bisher.

   Der urspruengliche Kopfkommentar folgt unveraendert. */

import { felieNotizSchluessel } from './text.js';

/* ══ Gedächtnis-Repository — M2a ═══════════════════════════════════════
   Fachvertrag memory-v2-draft-2 (reports/2026-09-17-m0/DATENVERTRAG.md).

   Dieser Block ist bewusst abgeschlossen: keine DOM-Zugriffe, kein
   localStorage, kein Netzwerk, keine Abhaengigkeit auf den uebrigen
   Code der Datei. Er nimmt einen Datensatz und einen Befehl entgegen
   und gibt einen neuen Datensatz zurueck. Damit laesst er sich fuer den
   nativen Umbau woertlich herausloesen; der Speicheradapter (M2c) und
   die Anbindung der heutigen Einstiegspunkte (M2b) sind eigene Pakete.

   Stand M2a: die Operationen und die Quellen-/Loeschlogik. NICHT
   angeschlossen — felieFaktSetzen und die uebrigen Schreibwege laufen
   unveraendert weiter. Die Projektionen der fuenf Kontextzwecke
   gehoeren zu M4; hier stehen nur die Auswahlfunktionen, die die
   Operationen selbst brauchen.

   Zwei Nahtstellen sind absichtlich austauschbar: felieRepoJetzt und
   felieRepoZufall. Tests setzen sie, damit Zeit und IDs bestimmbar
   sind. Im Betrieb bleiben sie, wie sie hier stehen. */

/* ── Nahtstellen ──────────────────────────────────────────────────── */

let uhr = null;
let zufall = null;

/* Tests setzen hier eine feste Uhr und eine feste ID-Folge; null stellt
   den Betrieb wieder her. Bis D1a lagen beide Haken auf window
   (window._felieRepoJetzt, window._felieRepoZufall). */
export function felieRepoUhrSetzen(fn) { uhr = typeof fn === 'function' ? fn : null; }
export function felieRepoZufallSetzen(fn) { zufall = typeof fn === 'function' ? fn : null; }

export function felieRepoJetzt() {
  if (uhr) return uhr();
  return new Date().toISOString();
}

/* IDs sind opak. Kein Name, kein Erinnerungstext und kein Hash eines
   niedrig-entropischen persoenlichen Wertes darf hineingeraten — genau
   das ist der Fehler der heutigen Fakt-IDs (kategorie + ':' + Text). */
export function felieRepoZufall() {
  if (zufall) return zufall();
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export function felieRepoId(art) { return art + '-' + felieRepoZufall(); }

/* ── Datensatz ────────────────────────────────────────────────────── */

export function felieRepoLeer(ownerId) {
  return {
    meta: { schemaVersion: 2, contractVersion: 'memory-v2-draft-2', ownerId: ownerId || 'lokal',
      datasetRevision: 0, contextEpoch: 0, activeGenerationId: 'gen-1' },
    profileBase: { displayName: { value: null, evidenceIds: [] },
      age: { value: null, recordedAt: null, evidenceIds: [] },
      legacyAgeBand: { value: null, recordedAt: null, evidenceIds: [] } },
    referents: [{ id: 'ref-self', kind: 'self', createdAt: null }],
    entries: [], revisions: [], evidence: [], conversations: [], messages: [],
    summarySegments: [], changeNotices: [], conflicts: [], exclusions: [],
    mutationReceipts: [], importRecords: []
  };
}

export function felieRepoKlon(d) { return JSON.parse(JSON.stringify(d)); }
export function felieRepoFind(liste, id) {
  var l = liste || [];
  for (var i = 0; i < l.length; i++) if (l[i] && l[i].id === id) return l[i];
  return null;
}
export function felieRepoKopf(d, entryId) {
  var e = felieRepoFind(d.entries, entryId);
  return e && e.headRevisionId ? felieRepoFind(d.revisions, e.headRevisionId) : null;
}

/* ── Quellen ──────────────────────────────────────────────────────── */

/* Ein Beleg ist durch seine Fundstelle bestimmt, nicht durch die ID,
   die ein Aufrufer mitschickt. Zweimal dieselbe Stelle ist EIN Beleg —
   sonst liesse sich eine Bestaetigung durch blosses Wiederholen der
   Auswertung erzeugen (I09, Pruefall F11). */
export function felieRepoQuelleSchluessel(ev) {
  var l = ev && ev.locator;
  if (!l) return null;
  if (l.kind === 'message') return 'm|' + l.messageId + '|' + l.range.start + '|' + l.range.end;
  if (l.kind === 'onboarding') return 'o|' + l.sourceEventId + '|' + l.fieldKey;
  return 'd|' + l.sourceEventId + '|' + (l.fieldKey || '') + '|' + (l.confirmedRevisionId || '');
}

/* Nimmt Belege auf und liefert die Abbildung der mitgeschickten IDs auf
   die tatsaechlich gueltigen. Ein bereits bekannter Beleg behaelt seine
   urspruengliche Erfassungszeit. */
export function felieRepoQuellenAufnehmen(d, liste) {
  var map = {};
  (liste || []).forEach(function (ev) {
    var schluessel = felieRepoQuelleSchluessel(ev);
    var vorhanden = null;
    for (var i = 0; i < d.evidence.length; i++)
      if (felieRepoQuelleSchluessel(d.evidence[i]) === schluessel) { vorhanden = d.evidence[i]; break; }
    if (vorhanden) { map[ev.id] = vorhanden.id; return; }
    var neu = { id: ev.id || felieRepoId('ev'), recordedAt: ev.recordedAt || felieRepoJetzt(),
      assertion: ev.assertion || 'explicit', locator: ev.locator };
    d.evidence.push(neu);
    map[ev.id] = neu.id;
  });
  return map;
}

export function felieRepoBereichTrifft(sperre, beleg) {
  if (!sperre || !beleg) return true;
  return !(beleg.end <= sperre.start || beleg.start >= sperre.end);
}

/* Gesperrt wird ausschliesslich ueber Exclusion. Kein zweites Kennzeichen
   an der Evidence, am Eintrag oder an der Nachricht (I17). */
export function felieRepoQuelleGesperrt(d, evidenceId) {
  var ev = felieRepoFind(d.evidence, evidenceId);
  if (!ev) return true;
  return (d.exclusions || []).some(function (x) {
    var t = x.target;
    if (!t) return false;
    if (t.kind === 'evidence') return t.evidenceId === evidenceId;
    if (t.kind === 'message') return ev.locator.kind === 'message'
      && ev.locator.messageId === t.messageId
      && felieRepoBereichTrifft(t.range, ev.locator.range);
    return false;
  });
}

export function felieRepoQuellenSperren(d, rev, grund) {
  var gesehen = {};
  (rev.supportSets || []).forEach(function (set) {
    set.forEach(function (id) {
      if (gesehen[id]) return;
      gesehen[id] = true;
      var schon = (d.exclusions || []).some(function (x) {
        return x.target && x.target.kind === 'evidence' && x.target.evidenceId === id; });
      if (!schon) d.exclusions.push({ id: felieRepoId('exc'),
        target: { kind: 'evidence', evidenceId: id }, purpose: 'allModelUse', reason: grund });
    });
  });
}

/* Die aeussere Liste ist ODER, jede innere UND. Eine einzige Restquelle
   erhaelt niemals den unbelegten Rest eines Satzes (I16). */
export function felieRepoSetVollstaendig(d, set) {
  return Array.isArray(set) && set.length > 0 && set.every(function (id) {
    return !felieRepoQuelleGesperrt(d, id); });
}

export function felieRepoBelegzustand(d, rev) {
  if ((rev.supportSets || []).some(function (s) { return felieRepoSetVollstaendig(d, s); })) return 'supported';
  if (rev.evidence === 'ambiguous') return 'ambiguous';
  return 'unsupported';
}

/* Versand an das Modell, Lesen, Umformulieren, Migration und
   KI-Wiederholung aktualisieren die Bestaetigungszeit nicht. Sie ergibt
   sich ausschliesslich aus den verbleibenden gueltigen Belegen. */
export function felieRepoBestaetigung(d, rev) {
  var ids = [];
  (rev.supportSets || []).forEach(function (s) {
    if (felieRepoSetVollstaendig(d, s)) s.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
  });
  var zeiten = ids.map(function (id) {
    var e = felieRepoFind(d.evidence, id); return e && e.recordedAt; }).filter(Boolean).sort();
  return { at: zeiten.length ? zeiten[zeiten.length - 1] : null, evidenceIds: ids };
}

/* ── Neubewertung nach jeder Mutation ─────────────────────────────── */

/* Der einzige Ort, an dem Beleglage, Kopfzeiger und abgeleitete Texte
   nachgezogen werden. Alles, was eine Operation kaputtmachen koennte,
   wird hier einheitlich beurteilt — nicht in jedem Befehl einzeln. */
export function felieRepoNeubewerten(d) {
  d.revisions.forEach(function (rev) {
    rev.evidence = felieRepoBelegzustand(d, rev);
    rev.confirmation = felieRepoBestaetigung(d, rev);
    if (rev.evidence === 'unsupported' && rev.status !== 'invalidated') {
      rev.text = null;
      rev.status = 'withdrawn';
      rev.historicalUse = 'blocked';
    }
  });

  /* Ein gelöschter Kopf wird niemals durch die letzte vorhandene
     Revision ersetzt (I08, Pruefall F15). */
  d.entries.forEach(function (e) {
    var kopf = e.headRevisionId ? felieRepoFind(d.revisions, e.headRevisionId) : null;
    if (!kopf || kopf.status !== 'current' || kopf.text === null) e.headRevisionId = null;
  });

  /* Ein Hinweis ohne tragfaehigen Nachher-Stand hat keinen Inhalt mehr.
     Vorher-Texte sind Ableitungen und duerfen nicht liegenbleiben. */
  d.changeNotices = d.changeNotices.filter(function (n) {
    var nach = felieRepoFind(d.revisions, n.afterRevisionId);
    return !!(nach && nach.text !== null);
  });

  d.summarySegments.forEach(function (seg) {
    var dep = seg.dependencies || { supportSets: [], revisionIds: [], messageIds: [] };
    var getragen = (dep.supportSets || []).some(function (s) { return felieRepoSetVollstaendig(d, s); });
    var quellenDa = (dep.messageIds || []).every(function (mid) { return !!felieRepoFind(d.messages, mid); });
    var revisionenOk = (dep.revisionIds || []).every(function (rid) {
      var r = felieRepoFind(d.revisions, rid);
      return !!(r && r.text !== null && r.status !== 'invalidated'); });
    if (!getragen || !quellenDa || !revisionenOk) { seg.status = 'blocked'; seg.text = null; }
  });

  d.conflicts.forEach(function (c) {
    var offeneKandidaten = (c.candidateRevisionIds || []).some(function (rid) {
      var r = felieRepoFind(d.revisions, rid);
      return !!(r && r.status === 'candidate'); });
    if (!offeneKandidaten && c.status === 'open') c.status = 'resolved';
  });
}

/* ── Befehlsprüfung ───────────────────────────────────────────────── */

export function felieRepoWerfen(code, meldung) {
  var e = new Error(meldung || code);
  e.felieRepoFehler = code;
  throw e;
}

/* Als Funktion, nicht als Konstante: die bestehenden Regressionen laden
   nur eine feste Liste von Variablendeklarationen in ihren Kontext. Eine
   neue Konstante waere dort undefiniert und das Repository stillschweigend
   kaputt. */
export function felieRepoIstWertaenderung(kind) {
  return kind === 'transition' || kind === 'correct' || kind === 'manualUpdate' || kind === 'reword';
}

export function felieRepoBefehlPruefen(d, b) {
  if (!b || typeof b !== 'object') return 'befehl_fehlt';
  if (b.ownerId !== d.meta.ownerId) return 'fremder_owner';
  if (!b.operationId) return 'operationId_fehlt';
  if (b.expectedDatasetRevision !== d.meta.datasetRevision) return 'datensatz_veraltet';
  if (felieRepoIstWertaenderung(b.kind) || b.kind === 'confirm') {
    var e = felieRepoFind(d.entries, b.entryId);
    if (!e) return 'eintrag_fehlt';
    /* Eine Auswertung, die auf einem ueberholten Stand beruht, darf eine
       zwischenzeitliche Korrektur nicht stillschweigend ueberschreiben
       (Pruefall F35). */
    if (b.expectedHeadRevisionId !== e.headRevisionId) return 'kopf_veraltet';
  }
  return null;
}

/* Ueber IDs, Arten und Struktur — nicht ueber den Text. Ein Fingerabdruck
   des Textes bliebe als Tombstone liegen und waere bei kurzen Angaben
   erratbar; die Textlaenge genuegt als strukturelle Unterscheidung. */
export function felieRepoFingerabdruck(b) {
  var k = b.candidate || null;
  var teile = [b.kind, b.entryId || '', b.conversationId || '', b.expectedHeadRevisionId || '',
    (b.evidence || []).map(felieRepoQuelleSchluessel).sort().join(','),
    (b.noticeIds || []).slice().sort().join(','),
    (b.supportSets || []).map(function (s) { return s.slice().sort().join('+'); }).sort().join(','),
    k ? [k.changeReason || '', k.retention || '', (k.text || '').length,
      (k.supportSets || []).map(function (s) { return s.slice().sort().join('+'); }).sort().join(',')].join('~') : '',
    b.coverage ? [b.coverage.verdict, b.coverage.coveredByEntryId || '',
      (b.coverage.examinedEntryIds || []).slice().sort().join(',')].join('~') : ''];
  var s = teile.join('|'), h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 'fp:' + h.toString(36);
}

/* ── Revision bauen ───────────────────────────────────────────────── */

export function felieRepoSetsAbbilden(sets, map) {
  return (sets || []).map(function (s) {
    return s.map(function (id) { return map && map[id] ? map[id] : id; });
  });
}

export function felieRepoRevisionBauen(kandidat, feste, map) {
  var k = kandidat || {};
  return {
    id: feste.id, entryId: feste.entryId, number: feste.number,
    text: typeof k.text === 'string' ? k.text : null,
    recordedAt: feste.recordedAt,
    validFrom: k.validFrom || null, validTo: k.validTo || null, expiresAt: k.expiresAt || null,
    retention: k.retention || 'volatileDefault',
    status: feste.status,
    evidence: k.evidence === 'ambiguous' ? 'ambiguous' : 'supported',
    historicalUse: k.historicalUse === 'blocked' ? 'blocked' : 'allowed',
    confirmation: { at: null, evidenceIds: [] },
    supportSets: felieRepoSetsAbbilden(k.supportSets, map),
    replacesRevisionId: feste.replacesRevisionId || null,
    changeReason: feste.changeReason
  };
}

/* ── Operationen ──────────────────────────────────────────────────── */

/* Ohne Deckungsentscheidung entsteht kein Eintrag. Text- oder
   Kategorievergleich ist Kandidatensucher, nie das Urteil (I18). */
export function felieRepoCreate(d, b) {
  if (!b.coverage) felieRepoWerfen('deckung_fehlt');
  if (b.coverage.verdict === 'covered')
    felieRepoWerfen('gedeckt', 'Vollständig gedeckt von ' + b.coverage.coveredByEntryId + ': als confirm ausführen');
  if (b.coverage.verdict === 'unclear')
    felieRepoWerfen('deckung_unklar', 'Zuordnung unklar: openConflict statt create');
  if (!b.entry || !b.entry.semanticRef) felieRepoWerfen('sachbezug_fehlt');
  var jetzt = felieRepoJetzt();
  var map = felieRepoQuellenAufnehmen(d, b.evidence || []);
  var entryId = b.entry.id || felieRepoId('ent');
  var revId = felieRepoId('rev');
  d.entries.push({ id: entryId, kind: b.entry.kind || 'personal', semanticRef: b.entry.semanticRef,
    category: b.entry.category || 'allgemein', profileVisible: !!b.entry.profileVisible,
    headRevisionId: revId, nextRevisionNumber: 2, createdAt: jetzt });
  d.revisions.push(felieRepoRevisionBauen(b.candidate,
    { id: revId, entryId: entryId, number: 1, status: 'current', changeReason: 'created', recordedAt: jetzt }, map));
  d.changeNotices.push({ id: felieRepoId('chg'), entryId: entryId, beforeRevisionId: null,
    afterRevisionId: revId, reason: 'new', seenAt: null, createdAt: jetzt });
  return { entryIds: [entryId] };
}

export function felieRepoConfirm(d, b) {
  var kopf = felieRepoKopf(d, b.entryId);
  if (!kopf) felieRepoWerfen('kein_kopf');
  /* Eine ausdrueckliche Bestaetigung darf die Frist eines aktuellen
     Themas neu setzen („Noch aktuell?" — „Ja"). Der Wert aendert sich
     dabei nicht, also entsteht keine Revision und kein Aenderungshinweis;
     nur die Gueltigkeit reicht weiter. */
  if (b.expiresAt !== undefined) kopf.expiresAt = b.expiresAt;
  var map = felieRepoQuellenAufnehmen(d, b.evidence || []);
  var neue = felieRepoSetsAbbilden(b.supportSets, map);
  neue.forEach(function (set) {
    var schluessel = set.slice().sort().join(',');
    var schon = kopf.supportSets.some(function (s) { return s.slice().sort().join(',') === schluessel; });
    if (!schon) kopf.supportSets.push(set.slice());
  });
  return { entryIds: [b.entryId] };
}

export function felieRepoWertaenderung(d, b) {
  var entry = felieRepoFind(d.entries, b.entryId);
  var kopf = felieRepoKopf(d, b.entryId);
  if (!kopf) felieRepoWerfen('kein_kopf');
  var jetzt = felieRepoJetzt();
  var map = felieRepoQuellenAufnehmen(d, b.evidence || []);
  var grund = b.kind === 'correct' ? 'correction' : b.kind;
  var neuId = felieRepoId('rev');
  var neu = felieRepoRevisionBauen(b.candidate, { id: neuId, entryId: entry.id,
    number: entry.nextRevisionNumber, status: 'current', changeReason: grund,
    recordedAt: jetzt, replacesRevisionId: kopf.id }, map);

  if (b.kind === 'reword') {
    /* Reine Darstellungsaenderung: Quellen, Gueltigkeit und Bestaetigung
       bleiben, wie sie waren. Keine neue unabhaengige Quelle. */
    neu.supportSets = kopf.supportSets.map(function (s) { return s.slice(); });
    neu.validFrom = kopf.validFrom; neu.validTo = kopf.validTo;
    neu.expiresAt = kopf.expiresAt; neu.retention = kopf.retention;
  }

  entry.nextRevisionNumber += 1;
  entry.headRevisionId = neuId;
  d.revisions.push(neu);

  if (b.kind === 'correct') {
    /* Als falsch berichtigt heisst: war nie wahr. Die Ursprungsstellen
       duerfen die Behauptung auch nicht erneut tragen. */
    kopf.status = 'invalidated';
    kopf.historicalUse = 'blocked';
    felieRepoQuellenSperren(d, kopf, 'corrected');
  } else {
    kopf.status = 'superseded';
    /* Zeitlich nicht eingeordnete manuelle Aenderung behauptet keine
       falsche Vergangenheit, aber auch keine zutreffende. */
    kopf.historicalUse = (b.kind === 'manualUpdate') ? 'blocked' : 'allowed';
  }

  if (b.kind !== 'reword')
    d.changeNotices.push({ id: felieRepoId('chg'), entryId: entry.id, beforeRevisionId: kopf.id,
      afterRevisionId: neuId, reason: b.kind === 'correct' ? 'corrected' : 'updated',
      seenAt: null, createdAt: jetzt });

  return { entryIds: [entry.id] };
}

export function felieRepoOpenConflict(d, b) {
  var jetzt = felieRepoJetzt();
  var map = felieRepoQuellenAufnehmen(d, b.evidence || []);
  var ids = [];
  (b.candidates || []).forEach(function (k) {
    var rev = felieRepoRevisionBauen(k, { id: k.id || felieRepoId('rev'), entryId: k.entryId,
      number: 0, status: 'candidate', changeReason: k.changeReason || 'created', recordedAt: jetzt }, map);
    rev.historicalUse = 'blocked';
    d.revisions.push(rev);
    ids.push(rev.id);
  });
  var c = b.conflict || {};
  d.conflicts.push({ id: c.id || felieRepoId('cfl'), entryIds: c.entryIds || [],
    candidateRevisionIds: ids, sourceEvidenceIds: Object.keys(map).map(function (k) { return map[k]; }),
    status: 'open', createdAt: jetzt });
  return { entryIds: c.entryIds || [] };
}

export function felieRepoResolveConflict(d, b) {
  var c = felieRepoFind(d.conflicts, b.conflictId);
  if (!c) felieRepoWerfen('konflikt_fehlt');
  (c.candidateRevisionIds || []).forEach(function (rid) {
    var r = felieRepoFind(d.revisions, rid);
    if (r && r.status === 'candidate') { r.status = 'withdrawn'; r.text = null; }
  });
  c.status = 'resolved';
  return { entryIds: c.entryIds || [] };
}

/* „Aus dem Gedaechtnis entfernen": Inhalte und texttragende Ableitungen
   verschwinden, der sichtbare Originalverlauf bleibt. Die Ursprungsstellen
   werden fuer die automatische Nutzung gesperrt, damit dieselbe Angabe
   nicht beim naechsten Lauf erneut entsteht. */
export function felieRepoForget(d, b) {
  var entry = felieRepoFind(d.entries, b.entryId);
  if (!entry) felieRepoWerfen('eintrag_fehlt');
  /* Der Inhalt geht. Was bleibt, ist ein Grabstein: ein Schluessel, an
     dem dieselbe Aussage spaeter wiedererkannt wird, ohne dass ihr Text
     weiter gehalten wird. Ohne ihn koennte eine erneute Auswertung
     desselben Gespraechs die geloeschte Angabe woertlich neu anlegen —
     eine Loeschung, die nur bis zum naechsten Durchlauf haelt, ist
     keine (E15, Pruefall F14). */
  entry.forgottenKeys = entry.forgottenKeys || [];
  d.revisions.forEach(function (r) {
    if (r.entryId !== entry.id) return;
    if (r.text) {
      var k = felieNotizSchluessel(r.text);
      if (k && entry.forgottenKeys.indexOf(k) < 0) entry.forgottenKeys.push(k);
    }
    felieRepoQuellenSperren(d, r, 'forgotten');
    r.text = null; r.status = 'withdrawn'; r.historicalUse = 'blocked';
  });
  entry.headRevisionId = null;
  d.changeNotices = d.changeNotices.filter(function (n) { return n.entryId !== entry.id; });
  return { entryIds: [entry.id] };
}

/* „Gespraech loeschen": Nachrichten, Zusammenfassung und die daran
   gebundenen Belege gehen. Strukturierte Onboarding- und Direktquellen
   bleiben — sie sind eigene Eingabeereignisse, keine Gespraechsinhalte
   (E18). Was danach unbelegt ist, faellt in der Neubewertung weg. */
export function felieRepoDeleteConversation(d, b) {
  var cid = b.conversationId;
  var nachrichten = d.messages.filter(function (m) { return m.conversationId === cid; })
    .map(function (m) { return m.id; });
  d.messages = d.messages.filter(function (m) { return m.conversationId !== cid; });
  d.summarySegments = d.summarySegments.filter(function (s) { return s.conversationId !== cid; });
  d.conversations = d.conversations.filter(function (c) { return c.id !== cid; });
  d.evidence = d.evidence.filter(function (ev) {
    return !(ev.locator.kind === 'message' && nachrichten.indexOf(ev.locator.messageId) >= 0); });
  d.exclusions = d.exclusions.filter(function (x) {
    if (x.target.kind === 'message') return nachrichten.indexOf(x.target.messageId) < 0;
    return !!felieRepoFind(d.evidence, x.target.evidenceId); });
  return { entryIds: [] };
}

/* Kenntnisnahme aendert nichts an Wahrheit oder Bestaetigung. Sie
   entfernt aber den Vorher-Text einer berichtigten Fassung: er wurde
   allein fuer diesen Hinweis noch gehalten (Pruefall F48). */
export function felieRepoMarkSeen(d, b) {
  var jetzt = felieRepoJetzt();
  (b.noticeIds || []).forEach(function (id) {
    var n = felieRepoFind(d.changeNotices, id);
    if (!n || n.seenAt) return;
    n.seenAt = jetzt;
    if (n.reason === 'corrected' && n.beforeRevisionId) {
      var vor = felieRepoFind(d.revisions, n.beforeRevisionId);
      if (vor && vor.status === 'invalidated') vor.text = null;
    }
  });
  return { entryIds: [], kontextBeruehrt: false };
}

export function felieRepoAusfuehren(d, b) {
  if (b.kind === 'create') return felieRepoCreate(d, b);
  if (b.kind === 'confirm') return felieRepoConfirm(d, b);
  if (felieRepoIstWertaenderung(b.kind)) return felieRepoWertaenderung(d, b);
  if (b.kind === 'openConflict') return felieRepoOpenConflict(d, b);
  if (b.kind === 'resolveConflict') return felieRepoResolveConflict(d, b);
  if (b.kind === 'forgetEntry') return felieRepoForget(d, b);
  if (b.kind === 'deleteConversation') return felieRepoDeleteConversation(d, b);
  if (b.kind === 'markSeen') return felieRepoMarkSeen(d, b);
  felieRepoWerfen('unbekannter_befehl', b.kind);
}

/* ── Einziger Schreibzugang ───────────────────────────────────────── */

/* Arbeitet auf einer Kopie und gibt sie erst bei Erfolg heraus. Ein
   abgelehnter oder fehlgeschlagener Befehl laesst den uebergebenen
   Datensatz unberuehrt — es gibt keinen halben Erfolg (I10). Die
   echte Speichertransaktion kommt mit M2c; diese Ebene stellt sicher,
   dass es fachlich nichts Halbes zu speichern gibt. */
export function felieRepoAnwenden(datensatz, befehl) {
  if (!befehl || typeof befehl !== 'object')
    return { ok: false, fehler: 'befehl_fehlt', datensatz: datensatz, receipt: null };
  if (befehl.ownerId !== datensatz.meta.ownerId)
    return { ok: false, fehler: 'fremder_owner', datensatz: datensatz, receipt: null };
  if (!befehl.operationId)
    return { ok: false, fehler: 'operationId_fehlt', datensatz: datensatz, receipt: null };

  /* Die Wiederholungspruefung steht VOR der Revisionspruefung. Ein Retry
     traegt zwangslaeufig den Stand von vor dem ersten Versuch; wuerde er
     zuerst als veraltet abgewiesen, waere Idempotenz nicht erreichbar —
     der Aufrufer koennte nach einem Verbindungsabbruch nie sicher
     feststellen, ob sein Vorgang gewirkt hat. */
  var abdruck = felieRepoFingerabdruck(befehl);
  var frueher = null;
  for (var i = 0; i < datensatz.mutationReceipts.length; i++)
    if (datensatz.mutationReceipts[i].operationId === befehl.operationId) { frueher = datensatz.mutationReceipts[i]; break; }
  if (frueher) {
    /* Derselbe Vorgang zaehlt einmal. Dieselbe Kennung mit anderem
       Inhalt ist kein Retry, sondern ein Fehler des Aufrufers. */
    if (frueher.payloadFingerprint !== abdruck)
      return { ok: false, fehler: 'wiederholung_mit_anderem_inhalt', datensatz: datensatz, receipt: null };
    return { ok: true, fehler: null, datensatz: datensatz, receipt: frueher, wiederholt: true };
  }

  var fehler = felieRepoBefehlPruefen(datensatz, befehl);
  if (fehler) return { ok: false, fehler: fehler, datensatz: datensatz, receipt: null };

  var d = felieRepoKlon(datensatz), ergebnis;
  try { ergebnis = felieRepoAusfuehren(d, befehl); }
  catch (e) {
    return { ok: false, fehler: (e && e.felieRepoFehler) || 'abgelehnt',
      meldung: e && e.message, datensatz: datensatz, receipt: null };
  }

  felieRepoNeubewerten(d);
  d.meta.datasetRevision = datensatz.meta.datasetRevision + 1;
  if (ergebnis.kontextBeruehrt !== false) d.meta.contextEpoch = datensatz.meta.contextEpoch + 1;
  var receipt = { operationId: befehl.operationId, commandKind: befehl.kind,
    payloadFingerprint: abdruck, resultEntryIds: ergebnis.entryIds || [],
    committedRevision: d.meta.datasetRevision, createdAt: felieRepoJetzt() };
  d.mutationReceipts.push(receipt);
  return { ok: true, fehler: null, datensatz: d, receipt: receipt };
}

/* ── Auswahl ──────────────────────────────────────────────────────── */

export function felieRepoStrittig(d) {
  var raus = {};
  (d.conflicts || []).forEach(function (c) {
    if (c.status !== 'open') return;
    (c.entryIds || []).forEach(function (id) { raus[id] = true; });
  });
  return raus;
}

/* Was sicher als aktuell gilt: ein Kopf, vollstaendig belegt, nicht
   strittig. Eine Ansicht, kein zweiter Speicher — Profil und Gedaechtnis
   lesen dieselbe Liste und koennen deshalb nicht auseinanderlaufen. */
export function felieRepoAktuell(d, opts) {
  opts = opts || {};
  var strittig = felieRepoStrittig(d);
  var jetzt = opts.jetzt || felieRepoJetzt();
  var raus = [];
  d.entries.forEach(function (e) {
    if (strittig[e.id]) return;
    var k = e.headRevisionId ? felieRepoFind(d.revisions, e.headRevisionId) : null;
    if (!k || k.status !== 'current' || k.text === null) return;
    if (k.evidence === 'unsupported') return;
    /* Eine Angabe mit unklarer Herkunft ist sichtbar und bearbeitbar,
       aber keine belegte Gewissheit: die Oberflaeche zeigt sie als
       „Bitte pruefen", der Modellkontext laesst sie weg (I04, I14). */
    var unklar = k.evidence === 'ambiguous';
    if (unklar && !opts.einschliesslichUnklar) return;
    if (!opts.ohneFristpruefung && k.expiresAt && k.expiresAt <= jetzt) return;
    if (opts.kategorie && e.category !== opts.kategorie) return;
    if (opts.nurProfil && !e.profileVisible) return;
    raus.push({ entryId: e.id, revisionId: k.id, text: k.text, kategorie: e.category,
      art: e.kind, profileVisible: e.profileVisible, bestaetigtAm: k.confirmation.at,
      retention: k.retention, gueltigAb: k.validFrom, laeuftAbAm: k.expiresAt, unklar: unklar });
  });
  return raus;
}

/* Einheitliche Snippets: eine Liste, ein Eintrag je Sachverhalt. Die
   Nutzerin sieht keine Unterscheidung zwischen Fakt und Notiz (E03),
   und dieselbe Angabe kann gar nicht zweimal erscheinen (E04). */
export function felieRepoSichtbar(d, opts) { return felieRepoAktuell(d, opts); }

/* Zaehler und Listen stammen aus derselben gefilterten Projektion —
   „Alle" kann nicht anders zaehlen als das Register (I13). */
export function felieRepoZaehler(d) {
  var alle = felieRepoAktuell(d);
  var nach = {};
  alle.forEach(function (s) { nach[s.kategorie] = (nach[s.kategorie] || 0) + 1; });
  return { alle: alle.length, kategorien: nach,
    profil: alle.filter(function (s) { return s.profileVisible; }).length,
    neu: felieRepoNeuHinweise(d).length };
}

export function felieRepoNeuHinweise(d) {
  return (d.changeNotices || []).filter(function (n) { return !n.seenAt; }).map(function (n) {
    var vor = n.beforeRevisionId ? felieRepoFind(d.revisions, n.beforeRevisionId) : null;
    var nach = felieRepoFind(d.revisions, n.afterRevisionId);
    return { id: n.id, entryId: n.entryId, art: n.reason,
      vorherRevisionId: n.beforeRevisionId || null,
      vorher: vor && vor.text !== null ? vor.text : null,
      nachher: nach ? nach.text : null, ungueltig: !!(vor && vor.status === 'invalidated') };
  });
}

/* Historisch zutreffende Fassungen fuer einen ausdruecklichen Rueckblick.
   Berichtigtes und zeitlich nicht eingeordnetes bleibt draussen. */
export function felieRepoHistorisch(d, entryId) {
  return d.revisions.filter(function (r) {
    return r.entryId === entryId && r.status === 'superseded'
      && r.historicalUse === 'allowed' && r.evidence === 'supported' && r.text !== null;
  }).sort(function (a, b) { return a.number - b.number; });
}
