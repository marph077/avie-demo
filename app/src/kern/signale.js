/* Signale - seit Welle D, Paket D2b, ein Kern-Modul.

   Schreiben, Frische, Verwendbarkeit, Verlauf, Baender, Aggregat, die
   abgeleitete Sicht (felieBaueAltSicht) und die Spiegel-Bausteine. Bis
   D2b standen sie in index.html; die Sicht window.manualBodyData mit
   ihrem Cache bleibt dort. Geprueft vor dem Umzug: felie-signale (D2a).

   Geaendert ist nur ein Zugriff: den Zeitpunkt der letzten Koerperdaten
   meldet felieUebernehmeAltObjekt ueber die Umgebung
   (felieKoerperAktualisiert) statt ueber window._bodyUpdatedAt.

   Seit D2c (AL-71b) heisst die Messquelle 'messung' statt 'oura' (der
   Hersteller steht in geraet), der Messtag messTag, die Formatierung
   felieSchlafFmt statt ouraFmtSleep, die Grenzen FELIE_BAENDER.messung.
   Alte Daten mit 'oura' werden nicht umgeschrieben (Entscheidung 23.09.)
   und gelten danach nicht mehr als verwendbar.

   Der urspruengliche Wortlaut folgt sonst unveraendert. */

import { felieBereinigen, felieRevision, felieStore } from './store.js';
import { CYCLE_PHASES, cycleMidnight, felieKoerperAktualisiert, felieZyklusAttribut } from './zyklus.js';

export const FELIE_FRISCHE_MS   = 24 * 60 * 60 * 1000;   /* 24 h, generell */

/* Abbildung der Altfelder aus manualBodyData auf Signalschluessel.
   'nurWearable' markiert Werte, die nicht mehr manuell erfasst werden
   und ausschliesslich aus einer Geraeteanbindung stammen. */
export const FELIE_FELD_MAP = {
  energyScore: { key: 'energie',    einheit: 'score100' },
  sleepMins:   { key: 'schlaf',     einheit: 'minuten' },
  stressScore: { key: 'anspannung', einheit: 'score100' },
  hrv:         { key: 'hrv',        einheit: 'ms',      nurWearable: true },
  rhr:         { key: 'rhr',        einheit: 'bpm',     nurWearable: true },
  recovery:    { key: 'recovery',   einheit: 'score100', nurWearable: true },
  deep:        { key: 'deep',       einheit: 'minuten', nurWearable: true },
  rem:         { key: 'rem',        einheit: 'minuten', nurWearable: true },
  temp:        { key: 'temp',       einheit: 'delta',   nurWearable: true },
  wachphasen:  { key: 'wachphasen', einheit: 'anzahl' }
};

/* Alles, was kein Signal ist, geht unveraendert durch — Quellenkennung,
   Geraet, Verlaufs- und Vergleichszeilen.
     Frueher stand hier eine POSITIVLISTE. Die war unvollstaendig: das
   Oura-Ergebnis enthaelt trend7, ouraHistory und ouraHistory30, die
   darauf fehlten und beim Rundlauf durch den Store lautlos verloren
   gingen. mb.trend7 liefert an vier Promptstellen die Durchschnitts- und
   Vergleichszahlen — ohne sie fand felie "keine Zahlen", obwohl der
   Abruf erfolgreich war.
     Eine Positivliste ist hier der falsche Ansatz: sie muss bei jedem
   neuen Feld nachgezogen werden und scheitert still. Umgekehrt gilt
   jetzt: nur Signalfelder und Abgeleitetes werden herausgefiltert, der
   Rest geht durch. */
export const FELIE_ABGELEITET = ['updatedAt', 'tsEnergy', 'tsSleep', 'tsStress'];

export function felieIstBeiwerk(feld) {
  if (feld === 'signalMeta' || feld === 'signalTs') return false;
  if (feld === 'sleepStr') return false;          /* kommt aus dem Signal selbst */
  if (FELIE_FELD_MAP[feld]) return false;         /* ist ein Signal */
  if (FELIE_ABGELEITET.indexOf(feld) >= 0) return false;
  if (feld.indexOf('quelle_') === 0) return false;
  return true;
}

/* ── Schreiben ─────────────────────────────────────────────────────── */

export function felieSchreibeSignal(key, wert, quelle, meta, ts) {
  if (wert === null || wert === undefined || wert === '') return null;
  if (quelle === 'demo' || (meta && meta.demo)) return null;
  var e = {
    key:    key,
    wert:   wert,
    ts:     ts || Date.now(),
    quelle: quelle || 'selbst',
    meta:   meta || null
  };
  felieStore().signale.push(e);
  felieRevision(true);
  return e;
}

/* Nimmt ein Objekt in der alten manualBodyData-Form auf und verteilt es
   auf Signaleintraege. Kein Ersetzen: was nicht im Objekt steht, bleibt
   im Store stehen. Genau dadurch ueberlebt eine Selbstauskunft das
   Verbinden eines Wearables. */
export function felieUebernehmeAltObjekt(obj, quelleHint) {
  if (!obj || typeof obj !== 'object') return;
  var quelle = quelleHint || obj.source || 'selbst';
  if (quelle === 'demo') return;
  /* Demo und Screenshot behalten ihre echte Herkunft. */

  var ts = obj.updatedAt || Date.now();

  Object.keys(FELIE_FELD_MAP).forEach(function(feld) {
    if (!(feld in obj)) return;
    var wert = obj[feld];
    if (wert === null || wert === undefined || wert === '') return;
    var def = FELIE_FELD_MAP[feld];
    /* Einzelstempel aus dem Altbestand respektieren, falls vorhanden */
    var feldTs = (obj.signalTs && obj.signalTs[feld]) || obj[{ energyScore: 'tsEnergy', sleepMins: 'tsSleep', stressScore: 'tsStress' }[feld]] || ts;
    var meta = Object.assign({}, obj.signalMeta && obj.signalMeta[feld] || {}, { geraet: obj.geraet || null });
    // Gerätewerte gehören zum Messtag, nicht zum Zeitpunkt des Abrufs.
    if (quelle === 'messung' && !(obj.signalTs && obj.signalTs[feld])) {
      var messtag = cycleMidnight(obj.messTag);
      if (!messtag || messtag > cycleMidnight(new Date())) return;
      feldTs = messtag.getTime();
      meta.datumsquelle = 'Messtag aus Oura';
      meta.importiertAm = ts;
    }
    if (def.key === 'schlaf' && obj.sleepStr) meta.str = obj.sleepStr;
    /* Doppelschreibung desselben Werts mit demselben Stempel vermeiden */
    var vorhanden = felieStore().signale.some(function(s) {
      return s.key === def.key && s.quelle === quelle && s.ts === feldTs && s.wert === wert;
    });
    if (!vorhanden) felieSchreibeSignal(def.key, wert, quelle, meta, feldTs);
  });

  /* Beiwerk sammeln, damit vorhandene Anzeigen und Promptbloecke
     weiterlaufen. Alles ausser Signalen und Abgeleitetem. */
  Object.keys(obj).forEach(function(f) {
    if (!felieIstBeiwerk(f)) return;
    if (obj[f] === null || obj[f] === undefined) return;
    felieStore().zusatz[f] = obj[f];
  });
  felieStore().zusatz.updatedAt = ts;
  felieKoerperAktualisiert(ts);
  felieRevision(true);
  felieBereinigen();
}

/* ── Lesen: Frische ────────────────────────────────────────────────── */

/* Schlaf haengt an einer konkreten Nacht, nicht an einem rollierenden
   Fenster. Ein Wert von gestern 22 Uhr liegt heute 9 Uhr innerhalb von
   24 h, aber die Nacht liegt dazwischen. Deshalb: Schlaf gilt nur am
   Kalendertag der Eingabe als aktuell. */
export function felieIstFrisch(e, jetzt) {
  jetzt = jetzt || Date.now();
  if (!Number.isFinite(e.ts) || e.ts > jetzt) return false;
  if (e.key === 'schlaf') {
    var a = new Date(e.ts); a.setHours(0, 0, 0, 0);
    var b = new Date(jetzt); b.setHours(0, 0, 0, 0);
    return a.getTime() === b.getTime();
  }
  return (jetzt - e.ts) <= FELIE_FRISCHE_MS;
}

/* Aktueller Wert eines Signals. Selbstauskunft hat immer Vorrang:
   liegt eine frische Selbstangabe vor, gewinnt sie — unabhaengig
   davon, ob der Geraetewert neuer ist. Ein Messwert ueberschreibt
   nie, was die Nutzerin fuehlt. */
export function felieAktuell(key, opts) {
  opts = opts || {};
  var jetzt = opts.jetzt || Date.now();
  var kandidaten = felieStore().signale.filter(function(e) {
    return e.key === key && felieSignalVerwendbar(e) && felieIstFrisch(e, jetzt);
  });
  if (!kandidaten.length) return null;

  function neuester(liste) {
    return liste.reduce(function(a, b) { return b.ts >= a.ts ? b : a; });
  }
  if (opts.quelle) {
    var q = kandidaten.filter(function(e) { return e.quelle === opts.quelle || (opts.quelle === 'messung' && e.quelle === 'screenshot'); });
    return q.length ? neuester(q) : null;
  }
  var selbst = kandidaten.filter(function(e) { return e.quelle === 'selbst'; });
  if (selbst.length) return neuester(selbst);
  return neuester(kandidaten);
}

/* ── Lesen: Verlauf und Aggregate ─────────────────────────────────── */

/* Rohverlauf mit angehaengten Zyklusattributen. Die Attribute werden
   hier berechnet, nicht gespeichert — dadurch stimmen sie auch nach
   einer Korrektur des Periodenstarts. */
export function felieVerlauf(key, opts) {
  opts = opts || {};
  var liste = felieStore().signale.filter(function(e) {
    if (!felieSignalVerwendbar(e)) return false;
    if (key && e.key !== key) return false;
    if (opts.quelle && e.quelle !== opts.quelle) return false;
    if (opts.vonTs && e.ts < opts.vonTs) return false;
    if (opts.bisTs && e.ts > opts.bisTs) return false;
    return true;
  }).map(function(e) {
    var z = felieZyklusAttribut(e.ts);
    return {
      key: e.key, wert: e.wert, ts: e.ts, quelle: e.quelle, meta: e.meta,
      zyklusIndex: z ? z.zyklusIndex : null,
      zyklusTag:   z ? z.zyklusTag   : null,
      phase:       z ? z.phase       : null
    };
  });
  if (opts.phase)      liste = liste.filter(function(e) { return e.phase === opts.phase; });
  if (opts.zyklusIndex != null) liste = liste.filter(function(e) { return e.zyklusIndex === opts.zyklusIndex; });
  return liste.sort(function(a, b) { return a.ts - b.ts; });
}

/* Baender statt Zahlen. Notwendig, weil die Skalen nicht vergleichbar
   sind: Energie ist 1–5 hochgerechnet auf 0–100 und nutzt die ganze
   Breite, Oura-Readiness liegt real fast immer zwischen 60 und 90.
   Ein direkter Zahlenvergleich erzeugt Dauerabweichung, die keine ist. */
/* Die Selbstauskunft ist NICHT kontinuierlich: sie kommt aus fuenf Stufen,
   die als Stufe x 20 gespeichert werden (20/40/60/80/100). Die Grenzen
   muessen deshalb an diesem Raster liegen, nicht an gedachten Prozenten —
   sonst landet Stufe 2, die in der App "Niedrig" heisst, im Band "mittel"
   und felie widerspricht der eigenen Beschriftung.
     Stufe 1–2 → niedrig   Stufe 3 → mittel   Stufe 4–5 → hoch
   Die Oura-Grenzen sind dagegen an der realen Verteilung ausgerichtet:
   Readiness liegt fast immer zwischen 60 und 90. Beide Zahlenpaare sind
   Schaetzungen und gehoeren an echten Daten nachjustiert. */
export const FELIE_BAENDER = {
  energie:         { selbst: [50, 70], messung: [70, 85] },
  anspannung:      { selbst: [50, 70], messung: [40, 60] },
  /* Sechs Stufen: kaum geschlafen 17, oft wach 33, unruhig 50, okay 67,
     ruhig 83, erholsam 100. Die Grenzen liegen so, dass "unruhig" noch
     zum niedrigen Band gehoert und "okay" das mittlere allein bildet. */
  schlafqualitaet: { selbst: [60, 80] },
  /* Dauer in Minuten — nur noch Geraetewert. */
  schlaf:          { messung: [360, 420] }
};

/* Welcher Messwert gehoert zu welcher Selbstauskunft? Bei Schlaf sind es
   zwei verschiedene Dinge: sie berichtet Qualitaet, das Geraet misst
   Dauer. Genau deshalb ist die Abweichung dort interessant. */
export const FELIE_MESSPARTNER = { schlafqualitaet: 'schlaf', energie: 'energie', anspannung: 'anspannung' };

export function felieBand(key, wert, quelle) {
  var def = FELIE_BAENDER[key];
  if (!def || wert == null) return null;
  /* Fehlt die Grenze fuer diese Seite, gilt die vorhandene (AL-92): Dauer
     ist Dauer, egal wer sie angibt. Vorher fiel Schlafdauer mit einer
     Selbstquelle auf undefined und warf - fillHomeData brach ab, sobald
     ein bestaetigter Screenshot-Schlafwert ohne eigene Angabe vorlag. */
  var g = def[quelle === 'selbst' ? 'selbst' : 'messung'] || def.selbst || def.messung;
  if (wert < g[0]) return 'niedrig';
  if (wert < g[1]) return 'mittel';
  return 'hoch';
}



/* Polaritaet: bei Energie und Schlaf ist mehr besser, bei Anspannung ist
   mehr schlechter. Ohne diese Unterscheidung kippt die Divergenzrichtung
   — hohe selbstberichtete Anspannung bei entspanntem Messwert waere
   sonst als "fuehlt sich besser an" gelesen worden. */
export const FELIE_POLARITAET = { energie: 1, schlaf: 1, schlafqualitaet: 1, anspannung: -1 };

/* Median statt Mittelwert: die Selbstauskunft ist ordinal (1–5),
   da ist der Mittelwert methodisch falsch. Zusaetzlich die Richtung
   innerhalb des Fensters, denn "fiel von mittel auf niedrig" ist
   brauchbar, "2,8" ist es nicht. */
export function felieAggregat(key, opts) {
  var liste = felieVerlauf(key, opts).filter(function(e) { return typeof e.wert === 'number'; });
  if (!liste.length) return { n: 0 };
  var werte = liste.map(function(e) { return e.wert; }).slice().sort(function(a, b) { return a - b; });
  var m = werte.length % 2 ? werte[(werte.length - 1) / 2]
                           : (werte[werte.length / 2 - 1] + werte[werte.length / 2]) / 2;
  var quelle = liste[0].quelle;
  var richtung = null;
  if (liste.length >= 3) {
    var h = Math.floor(liste.length / 2);
    var ersteH = liste.slice(0, h).map(function(e) { return e.wert; });
    var letzteH = liste.slice(-h).map(function(e) { return e.wert; });
    function avg(a) { return a.reduce(function(x, y) { return x + y; }, 0) / a.length; }
    var delta = avg(letzteH) - avg(ersteH);
    var schwelle = (key === 'schlaf') ? 30 : 8;
    richtung = delta > schwelle ? 'steigend' : (delta < -schwelle ? 'fallend' : 'stabil');
  }
  return {
    n: liste.length,
    median: m,
    band: felieBand(key, m, quelle),
    richtung: richtung,
    min: werte[0],
    max: werte[werte.length - 1],
    letzterTs: liste[liste.length - 1].ts
  };
}

/* Phasensicht: berechnet, nicht gespeichert. Musteraussagen sind erst
   ab zwei vergleichbaren Zyklen mit je mindestens zwei Eintraegen
   belastbar — darunter arbeitet nicht die Datenlage, sondern der
   Barnum-Effekt. 'belastbar' sagt dem Aufrufer, welche Tonlage
   zulaessig ist. */
export function felieMuster(key, phase) {
  var alle = felieVerlauf(key, { phase: phase, quelle: 'selbst' });
  var proZyklus = {};
  alle.forEach(function(e) {
    if (e.zyklusIndex == null) return;
    (proZyklus[e.zyklusIndex] = proZyklus[e.zyklusIndex] || []).push(e);
  });
  var aktuell = felieZyklusAttribut(Date.now());
  var vergangen = Object.keys(proZyklus).filter(function(i) {
    return (!aktuell || parseInt(i, 10) !== aktuell.zyklusIndex) && proZyklus[i].length >= 2;
  });
  return {
    phase: phase,
    zyklen: vergangen.length,
    eintraege: alle.length,
    belastbar: vergangen.length >= 2,
    aggregat: felieAggregat(key, { phase: phase, quelle: 'selbst' })
  };
}

/* Baut die alte Objektform aus frischen Signalen. Gibt null zurueck,
   wenn nichts Frisches vorliegt — die vorhandenen Lesestellen pruefen
   alle auf 'mb &&' beziehungsweise '!mb' und verhalten sich dann
   korrekt wie bei leerer Datenlage. */
export function felieBaueAltSicht() {
  var jetzt = Date.now();
  var out = {}, hatWert = false;

  Object.keys(FELIE_FELD_MAP).forEach(function(feld) {
    var def = FELIE_FELD_MAP[feld];
    var e = felieAktuell(def.key, { jetzt: jetzt });
    if (!e) return;
    if ((def.key === 'energie' || def.key === 'anspannung') && e.quelle !== 'selbst') return;
    out[feld] = e.wert;
    hatWert = true;
    if (def.key === 'schlaf') {
      out.sleepStr = (e.meta && e.meta.str)
        || (typeof felieSchlafFmt === 'function' ? felieSchlafFmt(e.wert) : e.wert + ' min');
    }
    /* Einzelstempel fuer bodyFieldFromToday() bereitstellen */
    if (def.key === 'energie')    out.tsEnergy = e.ts;
    if (def.key === 'schlaf')     out.tsSleep  = e.ts;
    if (def.key === 'anspannung') out.tsStress = e.ts;
    /* Herkunft pro Signal, damit die Anzeige Gefuehl und Messung
       auseinanderhalten kann */
    out['quelle_' + def.key] = e.quelle;
  });

  if (!hatWert) return null;

  var z = felieStore().zusatz || {};
  Object.keys(z).forEach(function(f) {
    if (f === 'updatedAt') return;
    if (out[f] === undefined) out[f] = z[f];
  });
  out.updatedAt = z.updatedAt || null;
  return out;
}

/* ══════════════════════════════════════════════════════════════════════
   SPIEGEL-BAUSTEINE — Schritt 5 und 6
   ──────────────────────────────────────────────────────────────────────
   Bearbeiten, Loeschen und Kenntnisstand. Der Spiegel ist lesend, mit
   einer Ausnahme: die Nutzerin muss eine eigene Angabe korrigieren
   koennen. Das ist Bearbeiten am Eintrag, keine Eingabemaske.
   ══════════════════════════════════════════════════════════════════════ */

/* Ueberschreibt die heutige Selbstauskunft zu einem Signal. Alte
   Eintraege desselben Tages werden entfernt, damit im Verlauf nicht
   drei Korrekturversuche als drei Angaben stehen. Messwerte bleiben
   unberuehrt — die gehoeren dem Geraet, nicht der Korrektur. */
export function felieSignalKorrigieren(key, wert, meta) {
  var s = felieStore();
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  s.signale = s.signale.filter(function (e) {
    if (e.key !== key || e.quelle !== 'selbst') return true;
    var d = new Date(e.ts); d.setHours(0, 0, 0, 0);
    return d.getTime() !== heute.getTime();
  });
  felieRevision(true);
  if (wert != null) felieSchreibeSignal(key, wert, 'selbst', meta || null);
  return true;
}

/* Loescht die heutige Selbstauskunft zu einem Signal, ohne Ersatz. */
export function felieSignalLoeschen(key) {
  return felieSignalKorrigieren(key, null, null);
}

/* Was weiss felie ueber diese Phase schon? Grundlage fuer den
   Kenntnisstand: ehrlich, ohne Fortschrittsbalken, der auf hundert
   Prozent zeigen will. Nennt statt einer Quote den konkreten Stand. */
export function felieKenntnisstand() {
  var phasen = (typeof CYCLE_PHASES !== 'undefined' && CYCLE_PHASES)
    ? CYCLE_PHASES.map(function (p) { return p.phase; }) : [];
  var aktuell = null;
  try { aktuell = felieZyklusAttribut(Date.now()); } catch (e) {}

  var out = phasen.map(function (ph) {
    /* Ueber alle drei Signale zusammen: wie viele vergangene Zyklen
       haben in dieser Phase mindestens zwei Eintraege? */
    var best = { zyklen: 0, eintraege: 0, belastbar: false };
    ['energie', 'schlafqualitaet', 'anspannung'].forEach(function (k) {
      var m;
      try { m = felieMuster(k, ph); } catch (e) { return; }
      if (!m) return;
      if (m.zyklen > best.zyklen) best.zyklen = m.zyklen;
      best.eintraege += m.eintraege;
      if (m.belastbar) best.belastbar = true;
    });
    return {
      phase: ph,
      zyklen: best.zyklen,
      eintraege: best.eintraege,
      belastbar: best.belastbar,
      aktuell: !!(aktuell && aktuell.phase === ph)
    };
  });

  var gekannt = out.filter(function (p) { return p.belastbar; }).length;
  return {
    phasen: out,
    gekannt: gekannt,
    gesamt: phasen.length,
    /* Stufe statt Prozent: eine Beziehungsphase, kein Fuellstand. */
    stufe: gekannt === 0 ? 'lerne dich kennen'
         : (gekannt < phasen.length ? 'kenne dich in Teilen' : 'kenne deinen Rhythmus'),
    hatZyklus: !!aktuell
  };
}

export function felieSchlafFmt(mins) {
  var h = Math.floor(mins / 60), m = mins % 60;
  return h + 'h ' + (m < 10 ? '0' + m : m) + 'm';
}

export function felieSignalVerwendbar(e) {
  if (!e || e.quelle === 'demo' || (e.meta && e.meta.demo)) return false;
  if (e.quelle === 'selbst') return true;
  if (e.quelle === 'screenshot') return !!(e.meta && e.meta.bestaetigt === true);
  // Die bisherige Oura-Anbindung war eine Demo ohne Anmeldung der Nutzerin.
  // Ein Messtag allein bestätigt weder die Person noch die Herkunft.
  return e.quelle === 'messung' && !!(e.meta && e.meta.kontoVerifiziert === true);
}
