/* Speicher-Port der Webapp (Welle D, D1b; Schnittstelle nach D-4).

   Reicht localStorage und das storage-Ereignis an den Kern weiter. Diese
   Datei gehoert NUR zur Webapp; Expo bringt spaeter einen eigenen Port
   mit denselben Schluesseln und demselben Format (expo-sqlite/kv-store).

   ziel ist im Browser das window, in den Tests die Laufzeit. Gelesen wird
   ziel.localStorage und ziel.addEventListener erst beim Aufruf, nicht beim
   Erzeugen: ein Test, der setItem oder addEventListener nachtraeglich
   ersetzt, trifft damit weiterhin den Weg, den der Kern benutzt.

   Fehler gehen unveraendert durch (Kontingent voll, Speicher gesperrt).
   Der Kern faengt sie dort, wo index.html sie schon immer gefangen hat. */

export function felieLocalStoragePort(ziel) {
  return {
    lesen: function (schluessel) { return ziel.localStorage.getItem(schluessel); },
    schreiben: function (schluessel, wert) { ziel.localStorage.setItem(schluessel, wert); },
    loeschen: function (schluessel) { ziel.localStorage.removeItem(schluessel); },
    /* Das storage-Ereignis feuert nur fuer ANDERE Fenster derselben
       Herkunft, nie fuer den eigenen Tab. Ein Ereignis ohne Schluessel
       (localStorage.clear() anderswo) wurde schon vorher uebergangen. */
    beobachten: function (rueckruf) {
      if (typeof ziel.addEventListener !== 'function') return false;
      ziel.addEventListener('storage', function (e) {
        if (!e || !e.key) return;
        rueckruf(e.key);
      });
      return true;
    }
  };
}
