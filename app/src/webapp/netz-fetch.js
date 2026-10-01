/* Netz-Port der Webapp (Welle F, F2a).

   Der Kern fragt den Worker nur ueber diesen Port an (src/kern/modell.js):
     anfragen(url, optionen, ms) -> Promise auf eine Antwort (ok, status, json())
     strom(url, optionen, ms, beiZeile) -> dasselbe, liest den Zeilenstrom der
       Auswertung (B-9a)
   Die Webapp reicht felieFetch aus index.html hinein - fetch mit
   Zeitgrenze. Nachgeschlagen wird erst beim Aufruf: ein Test, der
   felieFetch ersetzt (felie-prompt-vertrag, tools/ab/json.cjs, die
   Netz-Attrappe), trifft damit weiter den Weg, den der Kern benutzt - wie
   beim Speicher-Port mit localStorage.

   ziel ist im Browser das window, in den Tests die Laufzeit. */

/* B-9a (Marcel 29.09.): den Zeilenstrom der Auswertung lesen. Jede Zeile
   ausser ende/fehler geht an beiZeile; am Ende eine Antwort (ok, status,
   json()). Ohne Strom (anderer Inhaltstyp, kein lesbarer Rumpf) kommt die
   Antwort unveraendert zurueck. Nach ms bricht das Lesen ab (AbortError).
   Gleich in src/webapp/netz-fetch.js und mobile/netz/netz-fetch.js;
   beide erfuellen tests/felie-f2-netz-vertrag.test.mjs (N7-N11). */
function stromLesen(r, beiZeile, u, ms, abbrechen) {
  var typ = r && r.headers && typeof r.headers.get === 'function' ? (r.headers.get('Content-Type') || '') : '';
  if (!r || !/application\/x-ndjson/i.test(typ)) {
    if (abbrechen) abbrechen.fertig();
    return r;
  }
  var ende = null, fehler = null, abgelaufen = false;
  function zeile(z) {
    if (!z.trim()) return;
    var o; try { o = JSON.parse(z); } catch (e) { return; }
    if (o && o.t === 'ende') ende = o.antwort;
    else if (o && o.t === 'fehler') fehler = o;
    else { try { beiZeile(o); } catch (e) {} }
  }
  function ergebnis() {
    if (ende) return { ok: true, status: 200, json: function () { return Promise.resolve(ende); } };
    var st = fehler && fehler.status ? fehler.status : 502;
    var inhalt = fehler ? fehler.antwort : { error: 'Die Antwort kam nicht vollständig an.' };
    return { ok: false, status: st, json: function () { return Promise.resolve(inhalt); } };
  }
  /* Ohne lesbaren Rumpf oder TextDecoder: den Zeilenstrom als Ganzes lesen
     - richtiges Ergebnis, nur ohne Stuecke unterwegs (keine fruehe Blase). */
  if (!r.body || typeof r.body.getReader !== 'function' || typeof u.TextDecoder !== 'function') {
    return r.text().then(function (t) {
      if (abbrechen) abbrechen.fertig();
      String(t || '').split('\n').forEach(zeile);
      return ergebnis();
    }, function (e) { if (abbrechen) abbrechen.fertig(); throw e; });
  }
  var leser = r.body.getReader(), dec = new u.TextDecoder(), puffer = '';
  var t = u.setTimeout(function () { abgelaufen = true; try { leser.cancel(); } catch (e) {} if (abbrechen) abbrechen.jetzt(); }, ms || 30000);
  function schluss() {
    u.clearTimeout(t);
    if (abbrechen) abbrechen.fertig();
    if (abgelaufen) { var a = new Error('Zeitgrenze der Anfrage'); a.name = 'AbortError'; throw a; }
    return ergebnis();
  }
  function weiter() {
    return leser.read().then(function (x) {
      if (abgelaufen) return schluss();
      if (x.done) { puffer += dec.decode(); if (puffer) zeile(puffer); puffer = ''; return schluss(); }
      puffer += dec.decode(x.value, { stream: true });
      var i;
      while ((i = puffer.indexOf('\n')) >= 0) { zeile(puffer.slice(0, i)); puffer = puffer.slice(i + 1); }
      return weiter();
    }, function (e) { if (abgelaufen) return schluss(); u.clearTimeout(t); if (abbrechen) abbrechen.fertig(); throw e; });
  }
  return weiter();
}

export function felieFetchPort(ziel) {
  var umgebung = function () {
    return { setTimeout: ziel.setTimeout || globalThis.setTimeout, clearTimeout: ziel.clearTimeout || globalThis.clearTimeout,
      TextDecoder: ziel.TextDecoder || globalThis.TextDecoder };
  };
  return {
    anfragen: function (url, optionen, ms) { return ziel.felieFetch(url, optionen, ms); },
    /* felieFetch haelt seine Zeitgrenze nur bis zu den Kopfzeilen; fuer den
       Strom gilt sie bis zum Ende (eigener Zeitgeber in stromLesen). */
    strom: function (url, optionen, ms, beiZeile) {
      return ziel.felieFetch(url, optionen, ms).then(function (r) { return stromLesen(r, beiZeile, umgebung(), ms); });
    }
  };
}
