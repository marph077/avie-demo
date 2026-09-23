/* Abschlussauftrag - seit Welle D, Paket D4b, ein Kern-Modul.

   Ein Gespraech kommt sicher ins Archiv und ins Gedaechtnis (A2): der
   Auftrag mit fester ID, seine Liste, die Datenepoche, das Nachholen, der
   Abschluss nach der Auswertung (felieAbschlussVollziehen) und die
   Pruefung der Auswertung (felieVorschlaegePruefen,
   felieZusammenfassungPruefen). Bis D4b standen diese Funktionen in
   index.html. Geprueft vor dem Umzug: felie-d4-abschluss (D4a).

   Geaendert sind nur die Zugriffe:
   - der Zustand (window._felieDatenEpoche, _felieAbschlussWartend,
     _felieAbschlussLaufend) ist Modulzustand (D-17); die Webapp liest
     ihn ueber felieAbschlussLaeuft;
   - localStorage ueber den Speicher-Port;
   - die Sicherung (felieAutosave) ueber die verbundene Umgebung
     (felieAbschlussVerbinden); das Archiv (saveChat) steht seit D5b
     selbst hier (D-21);
   - das letzte Gespraech ueber felieGedaechtnisLetzterChatSetzen (AL-94).

   In der Webapp bleiben die Auswertung mit dem Modell
   (generateChatSummary, felieNotizErzeugen) und die Oberflaeche von
   gespraechAbschliessen.

   Der urspruengliche Wortlaut folgt unveraendert. */

import { felieNotizSchluessel, felieNotizText } from './text.js';
import { felieSpeicherLesen, felieSpeicherLoeschen, felieSpeicherSchreiben } from './speicher.js';
import { getSavedChats } from './gespraeche.js';
import { felieGedaechtnisLetzterChatSetzen, felieMerkUebernehmenFuer, felieMerkVorschlaege, felieNotizPruefen, felieNotizVorschau } from './gedaechtnis.js';
import { felieNeueSnippetsSetzen } from './neu-hinweise.js';
import { felieArchivFeldQuelle, felieSichererVerlauf } from './archiv.js';
import { bodySnapshotText } from './kontext.js';

/* Zustand des Abschlussauftrags (seit D4b im Kern, D-17; vorher
   window._felieDatenEpoche, _felieAbschlussWartend, _felieAbschlussLaufend).
   epoche zaehlt die Datenresets dieser Sitzung; wartend ist die
   Auftragsliste im Arbeitsspeicher (null: noch nicht geladen); laufend
   haelt die Auftraege, deren Auswertung in dieser Sitzung noch laeuft. */
let epoche = 0;
let wartend = null;
let laufend = {};

/* Laeuft die Auswertung dieses Auftrags in dieser Sitzung noch? Die
   Startseiten-Karte liest das fuer ihren Text. */
export function felieAbschlussLaeuft(id) {
  return !!laufend[id];
}

/* Fuer die Tests: frischer Zustand je Laufzeit (felieKernZuruecksetzen).
   Die Webapp ruft es nie; ein Datenreset erhoeht die Epoche. */
export function felieAbschlussZuruecksetzen() {
  epoche = 0;
  wartend = null;
  laufend = {};
}

/* Umgebung (seit D4b). Die Sicherung auf dem Geraet (felieAutosave,
   Capacitor) gehoert der Webapp; sichern() stoesst sie an. Unverbunden
   wird nicht gesichert. Das Schreiben ins Archiv (saveChat) war bis D5b
   ebenfalls ein Rueckruf und steht seitdem unten in diesem Modul (D-21). */
let umgebung = null;

export function felieAbschlussVerbinden(u) {
  umgebung = u || null;
}

export function felieAbschlussSichern() {
  if (umgebung && typeof umgebung.sichern === 'function') umgebung.sichern();
}

/* Gespraeche, deren Abschluss noch nicht im Archiv liegt (M30): laufende
   Auswertung oder ein liegengebliebener Auftrag. Sie erscheinen sofort
   als Karte — die Nutzerin sieht ihr Gespraech, bevor felie fertig
   gelesen hat. Ohne chatId, denn sobald der Eintrag im Archiv liegt,
   zeigt die normale Liste ihn. */
export function felieGespraecheInArbeit() {
  var liste = [];
  try { liste = felieAbschlussListe().filter(function (a) { return a.chatId == null; }); } catch (e) { return []; }
  return liste.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
}

/* Prueft die Vorschlagsliste des neuen Extraktionsauftrags. Die Ausgabe
   eines Modells ist ein Vorschlag, keine Schreibanweisung: alles, was
   nicht vollstaendig aufloest, wird herabgestuft oder verworfen — nie
   halbfertig uebernommen.

   Die Rueckgabe behaelt die Form, die Archiv und Notizkarte lesen
   (notizen/fakten/faeden). Neu ist, dass jeder Eintrag seinen Bezug zum
   Bestand mitbringt. */
export function felieVorschlaegePruefen(o, source, bestand) {
  var out = { thema: felieNotizText(o.thema).slice(0, 60) || 'Unser Gespräch',
    zusammenfassung: null,
    notizen: [], erkenntnis: '', felie_lernt: '', fakten: [], faeden: [], feldQuelle: {}, version: 6,
    weitere_notizen: o.weitere_notizen === true, listenformat: true, verworfen: 0,
    geprueft: 0, verworfenJeGrund: {} };
  var kat = ['familie', 'arbeit', 'gesundheit', 'beziehung', 'wohnen', 'allgemein'];
  var index = {};
  (bestand || []).forEach(function (b) { if (b && b.id) index[b.id] = b; });

  (Array.isArray(o.vorschlaege) ? o.vorschlaege : []).forEach(function (v) {
    out.geprueft++;
    if (!v || typeof v !== 'object') { felieVerwerfen(out, 'form'); return; }
    var art = ['zusammenfassung', 'notiz', 'angabe', 'thema'].indexOf(v.art) >= 0 ? v.art : null;
    if (!art) { felieVerwerfen(out, 'form'); return; }

    var n = felieNotizPruefen(v, source,
      art === 'zusammenfassung' ? 600 : art === 'notiz' ? 240 : 90);
    if (!n) { felieVerwerfen(out, 'beleg'); return; }

    /* Die Zusammenfassung gehoert dem Archiv. Sie ist kein
       Gedaechtniseintrag und wird deshalb weder gezaehlt noch mit dem
       Bestand abgeglichen: sie behauptet nichts Neues, sie erzaehlt
       (E08). Kommt mehr als eine, gilt die erste. */
    if (art === 'zusammenfassung') {
      if (!out.zusammenfassung)
        out.zusammenfassung = { text: n.text, belege: n.belege,
          nachweis: { quelle: 'zusammenfassung', text: n.text, belege: n.belege } };
      return;
    }

    /* Fehlender bezug verwirft nicht mehr. Gemessen am 22.09.: dasselbe
       Gespraech, zweimal ausgewertet, einmal mit und einmal ohne das Feld
       — das Modell laesst es bei temperature 0.7 gelegentlich weg, und
       vorher fiel dann JEDER Eintrag weg, die Zusammenfassung
       eingeschlossen (sie stand vor ihrer eigenen Ausnahme oben).
         Die Voreinstellung ist nicht geraten: ohne zielId KANN ein
       Vorschlag nur 'neu' sein, denn bestaetigung, aktualisierung und
       widerspruch benennen alle einen vorhandenen Eintrag. Mit zielId,
       aber ohne bezug, ist die Absicht offen — das ist genau der Fall,
       fuer den 'widerspruch' da ist (lieber zur Klaerung als geraten).
       Dubletten faengt weiterhin felieMerkAbgleich ab. */
    var bezug;
    if (['neu', 'bestaetigung', 'aktualisierung', 'widerspruch'].indexOf(v.bezug) >= 0) bezug = v.bezug;
    else if (v.bezug == null) bezug = v.zielId ? 'widerspruch' : 'neu';
    else { felieVerwerfen(out, 'bezug'); return; }   /* gesetzt, aber unbekannt: etwa 'loeschen' — den gibt es nicht */

    var ziel = null;
    if (bezug !== 'neu') {
      /* Eine Ziel-ID, die es nicht gibt, ist kein Grund, auf
         Textaehnlichkeit auszuweichen — der Vorschlag faellt weg. */
      ziel = v.zielId ? index[v.zielId] : null;
      if (!ziel) { felieVerwerfen(out, 'ziel'); return; }
      /* Veraltete Ausgangsrevision: der Vorschlag beruht auf einem
         Stand, den die Nutzerin inzwischen geaendert hat. Keine stille
         Uebernahme, sondern zur Klaerung. */
      if (v.ausgangsRevision !== ziel.revision) bezug = 'widerspruch';
    }
    /* Eine Veraenderung zu behaupten heisst, eine Vergangenheit zu
       behaupten. Ohne erkennbare zeitliche Einordnung wird daraus eine
       Klaerung statt einer Ueberschreibung. */
    if (bezug === 'aktualisierung' && !(typeof v.zeitbezug === 'string' && v.zeitbezug.trim()))
      bezug = 'widerspruch';

    var gemeinsam = { text: n.text, belege: n.belege, bezug: bezug,
      zielId: ziel ? ziel.id : null, ausgangsRevision: ziel ? ziel.revision : null,
      zeitbezug: typeof v.zeitbezug === 'string' ? v.zeitbezug.slice(0, 60) : null };

    if (art === 'notiz') {
      /* 'art' haelt fest, unter welchem Vertrag diese Notiz entstanden
         ist. Eine Notiz nach neuem Vertrag traegt EINEN Sachverhalt, und
         die Entdopplung darf ihr deshalb glauben, dass zusaetzlicher
         Inhalt darin auch zusaetzlicher Inhalt ist. Eine Altnotiz ohne
         dieses Feld ist eine Zusammenfassung und wird anders behandelt. */
      out.notizen.push({ id: 'notiz:' + out.notizen.length, art: 'notiz',
        thema: felieNotizText(v.thema).slice(0, 60) || out.thema,
        text: n.text, merken: true, bezug: bezug, zielId: gemeinsam.zielId,
        nachweis: { quelle: 'zusammenfassung', text: n.text, belege: n.belege } });
      return;
    }
    if (art === 'angabe') {
      if (kat.indexOf(v.kategorie) < 0 || ['stabil', 'volatil'].indexOf(v.klasse) < 0) { felieVerwerfen(out, 'kategorie'); return; }
      var f = {};
      for (var k in gemeinsam) f[k] = gemeinsam[k];
      f.kategorie = v.kategorie; f.klasse = v.klasse; f.belegt = true;
      out.fakten.push(f);
      return;
    }
    var t = {};
    for (var k2 in gemeinsam) t[k2] = gemeinsam[k2];
    t.tage = 7; t.belegt = true;
    out.faeden.push(t);
  });

  felieNotizVorschau(out);
  return out;
}

export function felieZusammenfassungPruefen(o, source, bestand) {
  /* Neues Format erkannt: eine Liste von Vorschlaegen mit Bezug. Der
     alte Weg bleibt lesbar, solange ein Worker mit dem alten Auftrag
     antwortet — dort ist jeder Eintrag zwangslaeufig „neu". */
  if (o && Array.isArray(o.vorschlaege)) return felieVorschlaegePruefen(o, source, bestand);
  var out = { thema: felieNotizText(o.thema).slice(0, 60) || 'Unser Gespräch',
    notizen: [], erkenntnis: '', felie_lernt: '', fakten: [], faeden: [], feldQuelle: {}, version: 5,
    weitere_notizen: o.weitere_notizen === true, listenformat: Array.isArray(o.notizen), verworfen: 0,
    geprueft: 0, verworfenJeGrund: {} };
  if (out.listenformat && typeof o.weitere_notizen !== 'boolean') felieVerwerfen(out, 'form');
  function notiz(item, thema, merken) {
    if (item != null) out.geprueft++;
    var n = felieNotizPruefen(item, source, 240);
    if (!n) { if (item != null) felieVerwerfen(out, 'beleg'); return; }
    var existing = out.notizen.find(function(e) { return felieNotizSchluessel(e.text) === felieNotizSchluessel(n.text); });
    if (existing) { if (merken) existing.merken = true; return; }
    out.notizen.push({ id: 'notiz:' + out.notizen.length, thema: felieNotizText(thema).slice(0, 60) || out.thema,
      text: n.text, merken: merken, nachweis: { quelle: 'zusammenfassung', text: n.text, belege: n.belege } });
  }
  if (Array.isArray(o.notizen)) {
    o.notizen.forEach(function(n) { notiz(n, n && n.thema, true); });
  } else {
    // Antworten im bisherigen Schema bleiben lesbar, neue Prompts verwenden die Liste.
    notiz(o.erkenntnis, 'Aus unserem Gespräch', false);
    notiz(o.felie_lernt, 'felie merkt sich', true);
  }
  var kat = ['familie', 'arbeit', 'gesundheit', 'beziehung', 'wohnen', 'allgemein'];
  (Array.isArray(o.fakten) ? o.fakten : []).forEach(function(f) {
    out.geprueft++;
    var n = felieNotizPruefen(f, source, 90);
    if (!n || kat.indexOf(f.kategorie) < 0 || ['stabil', 'volatil'].indexOf(f.klasse) < 0) { felieVerwerfen(out, n ? 'kategorie' : 'beleg'); return; }
    if (out.fakten.some(function(e) { return felieNotizSchluessel(e.text) === felieNotizSchluessel(n.text); })) return;
    out.fakten.push({ text: n.text, belege: n.belege, kategorie: f.kategorie, klasse: f.klasse, belegt: true });
  });
  (Array.isArray(o.faeden) ? o.faeden : []).forEach(function(f) {
    out.geprueft++;
    var n = felieNotizPruefen(f, source, 90);
    if (!n) { felieVerwerfen(out, 'beleg'); return; }
    if (out.faeden.some(function(e) { return felieNotizSchluessel(e.text) === felieNotizSchluessel(n.text); })) return;
    out.faeden.push({ text: n.text, belege: n.belege, tage: 7, belegt: true });
  });
  felieNotizVorschau(out);
  return out;
}

/* ══════════════════════════════════════════════════════════════════════
   ABSCHLUSSAUFTRAG — ein Gespraech kommt sicher ins Archiv (A2, 18.09.)
   ──────────────────────────────────────────────────────────────────────
   Ein gescheitertes Archivieren war bis M24 vollstaendig stumm; M24 hob
   EIN Gespraech auf und holte es nach. Die Supervisor-Abnahme vom 18.09.
   fand drei Luecken: ein Gespraechswechsel waehrend der Auswertung warf
   das Ergebnis weg; scheiterten zwei Archivierungen, ueberschrieb die
   zweite die erste; und der Auftrag wurde VOR der Gedaechtnisuebernahme
   geloescht, ihr Fehler verschluckt.

   Jetzt ist jeder Abschluss ein Auftrag mit fester ID, der den
   Originalverlauf VOR der Modell-Auswertung sichert und drei Schritte
   durchlaeuft:

     auswertung   Verlauf gesichert, Notiz wird erzeugt
     archiv       Notiz liegt vor, Gespraech muss ins Archiv
     gedaechtnis  Gespraech liegt im Archiv (chatId), Snippets fehlen

   Ein Schritt, der gelingt, wird am Auftrag festgehalten; ein Schritt,
   der scheitert, laesst den Auftrag liegen — der naechste Aufbau der
   Startseite versucht es erneut, mit demselben Gespraech, ohne Dublette:
   der Archiveintrag traegt die Auftrags-ID.

   Ungueltig wird ein Auftrag nur durch einen Datenreset. Der erhoeht die
   Datenepoche; ein Auftrag aus einer frueheren Epoche wird verworfen, auch
   wenn sein Ergebnis erst spaeter eintrifft und der Reload ausblieb.

   Fuer Expo: dieselbe Auftragsliste gehoert in den dauerhaften Speicher
   (SQLite, Transaktion), Hintergrundwechsel und Prozessende lassen sie
   bestehen. Der Web-Stand hier ist die Referenz fuer den Ablauf, nicht
   fuer die Speicherform. */
/* Als Funktion, nicht als Konstante: die Pruefumgebung laedt nur eine feste
   Liste oberster Deklarationen (tests/helpers/felie-runtime.cjs). */
export function felieAbschlussKey() { return 'felie_abschluss_wartend'; }

export function felieDatenEpoche() { return epoche; }

/* Ein Datenreset macht alles ungueltig, was noch unterwegs ist. */
export function felieDatenEpocheErhoehen() {
  epoche = felieDatenEpoche() + 1;
  wartend = [];
  laufend = {};
}

export function felieAbschlussListe() {
  if (Array.isArray(wartend)) return wartend;
  var liste = [];
  try {
    var roh = JSON.parse(felieSpeicherLesen(felieAbschlussKey()) || '[]');
    if (Array.isArray(roh)) liste = roh.filter(felieAbschlussGueltig);
  } catch (e) {}
  /* Migration von M24: ein einzelnes aufgehobenes Gespraech wird zum
     Auftrag im Schritt 'archiv'. */
  try {
    var altRoh = JSON.parse(felieSpeicherLesen('felie_archiv_wartend') || 'null');
    if (altRoh && altRoh.summary && Array.isArray(altRoh.messages) && altRoh.messages.length) {
      liste.push({ id: 'ab-alt-' + (altRoh.ts || Date.now()), epoche: felieDatenEpoche(), ts: altRoh.ts || Date.now(),
        status: 'archiv', messages: altRoh.messages, summary: altRoh.summary, chatId: null });
    }
    felieSpeicherLoeschen('felie_archiv_wartend');
  } catch (e) {}
  wartend = liste;
  return liste;
}

export function felieAbschlussGueltig(a) {
  return !!(a && typeof a === 'object' && a.id && Array.isArray(a.messages) && a.messages.length
    && (a.status === 'auswertung' || a.status === 'archiv' || a.status === 'gedaechtnis'));
}

/* Nur ein Versuch: scheitert das Schreiben an vollem Speicher, traegt der
   Arbeitsspeicher die Liste wenigstens bis zum naechsten Versuch in
   dieser Sitzung. Dublette droht deshalb nicht — der Archiveintrag
   traegt die Auftrags-ID. */
export function felieAbschlussSpeichern() {
  var liste = felieAbschlussListe();
  try {
    if (!liste.length) felieSpeicherLoeschen(felieAbschlussKey());
    else felieSpeicherSchreiben(felieAbschlussKey(), JSON.stringify(liste));
  } catch (e) {}
}

export function felieAbschlussAnlegen(messages) {
  var liste = felieAbschlussListe();
  var ts = Date.now();
  var auftrag = { id: 'ab-' + ts + '-' + Math.random().toString(36).slice(2, 8), epoche: felieDatenEpoche(), ts: ts,
    status: 'auswertung', messages: messages.map(function(m) { return Object.assign({}, m); }), summary: null, chatId: null };
  liste.push(auftrag);
  laufend[auftrag.id] = true;
  felieAbschlussSpeichern();
  return auftrag;
}

export function felieAbschlussAktualisieren(auftrag, patch) {
  Object.keys(patch).forEach(function(k) { auftrag[k] = patch[k]; });
  var liste = felieAbschlussListe();
  if (!liste.some(function(a) { return a.id === auftrag.id; })) liste.push(auftrag);
  felieAbschlussSpeichern();
}

export function felieAbschlussEntfernen(id) {
  var liste = felieAbschlussListe();
  for (var i = liste.length - 1; i >= 0; i--) if (liste[i].id === id) liste.splice(i, 1);
  delete laufend[id];
  felieAbschlussSpeichern();
}

/* Die Notiz, wenn die Auswertung ausfaellt: das Gespraech wird trotzdem
   archiviert und traegt notizenStatus 'unvollstaendig' — die Archivkarte
   zeigt das an und bietet dort das erneute Erzeugen. */
export function felieAbschlussNotlaufNotiz() {
  return { thema: 'Unser Gespräch', notizen: [], notizenStatus: 'unvollstaendig', erkenntnis: '', felie_lernt: '', fakten: [], faeden: [], version: 5 };
}

/* Fuehrt einen Auftrag so weit wie moeglich. true, wenn er abgeschlossen
   und entfernt ist; false, wenn er liegen bleibt und spaeter erneut
   versucht wird. Wiederholbar: jeder Schritt prueft zuerst, ob er schon
   erledigt ist. */
export function felieAbschlussAusfuehren(auftrag) {
  if (auftrag.epoche !== felieDatenEpoche()) { felieAbschlussEntfernen(auftrag.id); return false; }
  if (auftrag.status === 'auswertung') {
    /* Hier kommt nur ein Auftrag an, dessen Auswertung nicht mehr laeuft
       — die App wurde waehrenddessen beendet. Der Verlauf ist da; er
       wird ohne Notiz archiviert, die Karte bietet das Nacherzeugen. */
    felieAbschlussAktualisieren(auftrag, { summary: felieAbschlussNotlaufNotiz(), status: 'archiv' });
  }
  if (auftrag.status === 'archiv') {
    var vorhanden = getSavedChats().filter(function(c) { return c.auftragId === auftrag.id; })[0];
    var chatId = vorhanden ? (vorhanden.id || vorhanden.timestamp) : null;
    if (chatId == null) {
      try { chatId = saveChat(auftrag.summary, auftrag.messages, auftrag.id); } catch (e) { chatId = null; }
    }
    if (chatId == null) return false;
    felieAbschlussAktualisieren(auftrag, { chatId: chatId, status: 'gedaechtnis' });
  }
  if (auftrag.status === 'gedaechtnis') {
    /* Merken nur, wenn das Gespraech auch wirklich im Archiv liegt. Sonst
       stuenden Fakten ohne den Beleg da, auf den sie sich berufen. */
    var ergebnis;
    try { ergebnis = felieMerkUebernehmenFuer(auftrag.chatId, felieMerkVorschlaege(auftrag.summary)); }
    catch (e) { ergebnis = { ok: false, ids: [] }; }
    if (!ergebnis.ok) return false;
    felieGedaechtnisLetzterChatSetzen(auftrag.chatId);
    felieNeueSnippetsSetzen(ergebnis.ids);
    felieAbschlussEntfernen(auftrag.id);
    return true;
  }
  return false;
}

/* true, wenn mindestens ein liegengebliebenes Gespraech jetzt vollstaendig
   erledigt ist. Auftraege, deren Auswertung in dieser Sitzung noch
   laeuft, werden nicht angefasst. */
export function felieArchivNachholen() {
  var offen = felieAbschlussListe().slice().filter(function(a) { return !laufend[a.id]; });
  var erledigt = false;
  offen.sort(function(a, b) { return (a.ts || 0) - (b.ts || 0); }).forEach(function(a) {
    try { if (felieAbschlussAusfuehren(a)) erledigt = true; } catch (e) {}
  });
  if (erledigt) { try { felieAbschlussSichern(); } catch (e) {} }
  return erledigt;
}

/* Vertraeglichkeit mit M24: das aelteste wartende Gespraech in der alten
   Form, oder null. */
export function felieArchivWartend() {
  var liste = felieAbschlussListe().filter(function(a) { return a.status !== 'auswertung' || !laufend[a.id]; });
  if (!liste.length) return null;
  var a = liste.slice().sort(function(x, y) { return (x.ts || 0) - (y.ts || 0); })[0];
  return { summary: a.summary || felieAbschlussNotlaufNotiz(), messages: a.messages, ts: a.ts, auftragId: a.id, status: a.status };
}

/* Der Abschluss nach der Auswertung (seit Welle D / D4b, D-18). Bis D4b
   stand diese Abfolge in gespraechAbschliessen in index.html; dort bleibt
   nur, was die Nutzerin sieht (Meldung, Startseite, Archiv-Ansicht,
   Loader). Wortlaut der Schritte unveraendert.
   Rueckgabe: verworfen (Ergebnis aus einer frueheren Datenepoche),
   archiviert (das Gespraech liegt im Archiv), fertig (auch das
   Gedaechtnis ist uebernommen, der Auftrag entfernt). */
export function felieAbschlussVollziehen(summary, messages, auftrag) {
  if (!auftrag) {
    auftrag = felieAbschlussAnlegen(messages);
  }
  delete laufend[auftrag.id];
  /* Ergebnis aus einer frueheren Datenepoche: die Nutzerin hat inzwischen
     alles geloescht. Nichts davon darf wieder auftauchen (B4). */
  if (auftrag.epoche !== felieDatenEpoche()) {
    felieAbschlussEntfernen(auftrag.id);
    return { verworfen: true, archiviert: false, fertig: false };
  }
  felieAbschlussAktualisieren(auftrag, { summary: summary, status: 'archiv' });

  var fertig = false;
  try { fertig = felieAbschlussAusfuehren(auftrag); } catch (e) { fertig = false; }
  var archiviert = auftrag.chatId != null;
  if (archiviert) { try { felieAbschlussSichern(); } catch (e) {} }
  if (!archiviert) felieGedaechtnisLetzterChatSetzen(null);
  if (archiviert && !fertig) {
    /* Archiv ja, Gedaechtnis nein: der Auftrag bleibt im Schritt
       'gedaechtnis' liegen und wird beim naechsten Aufbau der Startseite
       nachgeholt. Bis dahin keine Snippets — sie haetten keinen Beleg. */
    felieNeueSnippetsSetzen([]);
  }
  return { verworfen: false, archiviert: archiviert, fertig: fertig };
}

/* ── Auswertungsprotokoll je Archiveintrag (AL-11, seit D4c) ────────────
   Material fuer E1 (Modellbewertung). Nur Zahlen und Gruende, keine
   Texte (D-15): Texte verworfener Vorschlaege waeren Schluesse ueber die
   Nutzerin, die sie nie sieht, und uebernommene Texte blieben nach dem
   Loeschen einer Erinnerung im Protokoll stehen.

   Das Feld auswertung am Archiveintrag entsteht in drei Schritten:
     1. die Pruefung zaehlt je Seite, was sie gesehen und warum sie etwas
        verworfen hat (geprueft, verworfenJeGrund);
     2. die Auswertung (felieNotizErzeugen in der Webapp) sammelt die
        Seiten mit felieAuswertungZaehlen und schliesst mit
        felieAuswertungProtokoll ab; saveChat legt das Ergebnis am
        Archiveintrag ab;
     3. die Uebernahme ins Gedaechtnis (felieMerkUebernehmenFuer) traegt im
        selben Vorgang ein, was gleich, bekannt, uebernommen und vom
        Datensatz abgelehnt wurde.

   Gruende der Pruefung:
     form       kein Objekt, unbekannte Art, fehlendes weitere_notizen
     beleg      Text oder Beleg haelt der Pruefung nicht stand
     bezug      Bezug gesetzt, aber unbekannt
     ziel       Ziel-ID gibt es im Bestand nicht
     kategorie  Kategorie oder Klasse einer Angabe unbekannt */
export const FELIE_VERWURF_GRUENDE = ['form', 'beleg', 'bezug', 'ziel', 'kategorie'];

function felieVerwerfen(out, grund) {
  out.verworfen++;
  out.verworfenJeGrund[grund] = (out.verworfenJeGrund[grund] || 0) + 1;
}

/* Eine gepruefte Seite ins laufende Protokoll der Auswertung. uebernommen
   ist, was die Seite dem Ergebnis tatsaechlich hinzugefuegt hat; der Rest
   des Gueltigen war doppelt (schon in einer frueheren Runde oder als
   vorhandene Notiz). */
export function felieAuswertungZaehlen(protokoll, seite, hinzugefuegt) {
  protokoll.geprueft += seite.geprueft || 0;
  Object.keys(seite.verworfenJeGrund || {}).forEach(function (g) {
    protokoll.verworfen[g] = (protokoll.verworfen[g] || 0) + seite.verworfenJeGrund[g];
  });
  var gueltig = (seite.notizen || []).length + (seite.fakten || []).length + (seite.faeden || []).length;
  protokoll.doppelt += Math.max(0, gueltig - (hinzugefuegt || 0));
  return protokoll;
}

export function felieAuswertungNeu() {
  return { geprueft: 0, verworfen: {}, doppelt: 0 };
}

/* Das Protokoll, wie es am Archiveintrag steht. Alle Gruende mit ihrer
   Zahl, auch 0 - dann hat jeder Eintrag dieselbe Form. */
export function felieAuswertungProtokoll(protokoll, runden) {
  var verworfen = {};
  FELIE_VERWURF_GRUENDE.forEach(function (g) { verworfen[g] = protokoll.verworfen[g] || 0; });
  return { version: 1, runden: runden, geprueft: protokoll.geprueft, verworfen: verworfen, doppelt: protokoll.doppelt };
}

/* ── Ins Archiv schreiben (seit Welle D / D5b, D-21) ──────────────────
   Bis D5b stand saveChat in index.html und wurde ueber den Rueckruf
   archivieren gerufen. Geaendert sind nur zwei Zugriffe: localStorage
   ueber den Speicher-Port, das letzte Gespraech ueber
   felieGedaechtnisLetzterChatSetzen. */
export function saveChat(summary, messages, auftragId) {
  try {
    /* Zweite Sicherung: selbst wenn ein Aufrufer den Verlauf ungefiltert
       uebergibt, wird hier kein Befund geschrieben. */
    messages = felieSichererVerlauf(messages);
    if (!messages.some(function(m) { return m.role === 'user'; })) return null;
    var chats = getSavedChats();
    var ts = Math.max(Date.now(), chats.reduce(function(max, c) { return Math.max(max, Number(c.id || c.timestamp) || 0); }, 0) + 1);
    var feldQuelle = {};
    ['erkenntnis', 'felie_lernt'].forEach(function(k) {
      var q = felieArchivFeldQuelle(summary[k], summary.feldQuelle && summary.feldQuelle[k], messages);
      if (q) feldQuelle[k] = q;
    });
    felieGedaechtnisLetzterChatSetzen(ts);
    chats.push({
      id: ts,
      version: 5,
      /* Die Zusammenfassung gehoert dem Gespraech, nicht dem Gedaechtnis
         (E08). Sie steht deshalb als eigenes Feld hier und taucht in der
         Gedaechtnisliste nirgends auf. */
      zusammenfassung: summary.zusammenfassung ? {
        text: summary.zusammenfassung.text,
        nachweis: felieArchivFeldQuelle(summary.zusammenfassung.text,
          summary.zusammenfassung.nachweis, messages) } : undefined,
      notizen: Array.isArray(summary.notizen) ? summary.notizen.map(function(n) {
        return { id: n.id, art: n.art, thema: n.thema, text: n.text, merken: n.merken !== false,
          nachweis: felieArchivFeldQuelle(n.text, n.nachweis, messages) };
      }) : undefined,
      notizenStatus: summary.notizenStatus || 'vollstaendig',
      feldQuelle: feldQuelle,
      thema: summary.thema,
      erkenntnis: summary.erkenntnis,
      felie_lernt: summary.felie_lernt,
      koerper: bodySnapshotText(),
      messages: messages.map(function(m) { return Object.assign({}, m); }),
      timestamp: ts,
      /* Der Abschlussauftrag, aus dem dieser Eintrag stammt (A2). Damit
         erkennt eine Wiederholung, dass das Gespraech schon im Archiv
         liegt — auch wenn der Auftrag selbst nicht mehr aktualisiert
         werden konnte. */
      auftragId: auftragId || undefined,
      /* Das Auswertungsprotokoll (AL-11): nur Zahlen und Gruende. */
      auswertung: summary.auswertung || undefined
    });
    // Keine stillschweigende Löschung früherer Gespräche wegen einer Mengenregel.
    felieSpeicherSchreiben('felie_saved_chats', JSON.stringify(chats));
    return ts;
  } catch(e) {}
  return null;
}
