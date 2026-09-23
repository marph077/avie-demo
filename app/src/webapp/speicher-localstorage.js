/* Speicher-Port der Webapp (Welle D, D1b; Schnittstelle nach D-4).

   Reicht localStorage und das storage-Ereignis an den Kern weiter. Diese
   Datei gehoert NUR zur Webapp; Expo bringt spaeter einen eigenen Port
   mit denselben Schluesseln und demselben Format (expo-sqlite/kv-store).

   ziel ist im Browser das window, in den Tests die Laufzeit. Gelesen wird
   ziel.localStorage und ziel.addEventListener erst beim Aufruf, nicht beim
   Erzeugen: ein Test, der setItem oder addEventListener nachtraeglich
   ersetzt, trifft damit weiterhin den Weg, den der Kern benutzt.

   Fehler gehen unveraendert durch (Kontingent voll, Speicher gesperrt).
   Der Kern faengt sie dort, wo index.html sie schon immer gefangen hat.

   transaktion (seit D1d, D-9 Mitschrift): vor dem ersten Schreiben oder
   Loeschen eines Schluessels im Vorgang wird sein alter Wert gemerkt.
   Wirft fn, wird jeder gemerkte Schluessel zurueckgesetzt - jeder fuer
   sich, ein Fehler dabei haelt die anderen nicht auf - und der Fehler geht
   weiter. localStorage ist nicht absturzsicher: stirbt der Tab mitten im
   Vorgang, bleibt der halbe Stand. Expo ist dort mit withTransactionSync
   besser. Eine transaktion in einer transaktion laeuft in der aeusseren. */

export function felieLocalStoragePort(ziel) {
  var mitschrift = null;
  function merken(schluessel) {
    if (mitschrift && !Object.prototype.hasOwnProperty.call(mitschrift, schluessel))
      mitschrift[schluessel] = ziel.localStorage.getItem(schluessel);
  }
  return {
    lesen: function (schluessel) { return ziel.localStorage.getItem(schluessel); },
    schreiben: function (schluessel, wert) { merken(schluessel); ziel.localStorage.setItem(schluessel, wert); },
    loeschen: function (schluessel) { merken(schluessel); ziel.localStorage.removeItem(schluessel); },
    transaktion: function (fn) {
      if (mitschrift) return fn();
      mitschrift = {};
      try {
        var ergebnis = fn();
        mitschrift = null;
        return ergebnis;
      } catch (e) {
        var alt = mitschrift;
        mitschrift = null;
        Object.keys(alt).forEach(function (schluessel) {
          try {
            if (alt[schluessel] === null) ziel.localStorage.removeItem(schluessel);
            else ziel.localStorage.setItem(schluessel, alt[schluessel]);
          } catch (wiederherstellen) {}
        });
        throw e;
      }
    },
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
