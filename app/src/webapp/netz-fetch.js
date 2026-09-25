/* Netz-Port der Webapp (Welle F, F2a).

   Der Kern fragt den Worker nur ueber diesen Port an (src/kern/modell.js):
     anfragen(url, optionen, ms) -> Promise auf eine Antwort (ok, status, json())
   Die Webapp reicht felieFetch aus index.html hinein - fetch mit
   Zeitgrenze. Nachgeschlagen wird erst beim Aufruf: ein Test, der
   felieFetch ersetzt (felie-prompt-vertrag, tools/ab/json.cjs, die
   Netz-Attrappe), trifft damit weiter den Weg, den der Kern benutzt - wie
   beim Speicher-Port mit localStorage.

   ziel ist im Browser das window, in den Tests die Laufzeit. */

export function felieFetchPort(ziel) {
  return {
    anfragen: function (url, optionen, ms) { return ziel.felieFetch(url, optionen, ms); }
  };
}
