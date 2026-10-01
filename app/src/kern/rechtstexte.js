/* Rechtstexte der App (F5c-1, Marcel 28.09.): eine Quelle im Repo.

   Datenschutzerklaerung, Impressum und Nutzungsbedingungen als Daten -
   Titel, Fassung, Stand, Abschnitte aus Bloecken (Absatz, Liste, Tabelle;
   im Text **fett** und Zeilenumbrueche) -, plattformneutral. Die App zeigt
   sie als eigene Bildschirme (keine Weblinks); aus derselben Quelle
   entsteht die Webseite fuer den Store-Eintrag (felieRechtstextHtml; Apple
   verlangt dort eine Datenschutz-URL und fuer das Abo Nutzungsbedingungen).
   Jede Seite nennt die Webadresse der wortgleichen Fassung
   (FELIE_RECHTSTEXT_WEB; Apple 5.1.1(i)).

   Inhalt: Teil II der Kanzleivorlage v1.1
   (docs/felie-rechtstexte-v1-1-kanzleivorlage-2026-09-28.md), erzeugt von
   tools/rechtstexte-erzeugen.cjs in den Block unten; bis Welle G
   sichtbar als "Entwurf". Wortgleichheit mit der Vorlage und der Webseite
   prueft tests/felie-f5c-rechtstexte.test.cjs. Die Webapp behaelt ihre
   eigenen Texte.

   Gate: mobile/scripts/release-pruefen.js laesst den Release-Bau
   scheitern, solange eine Fassung "entwurf" ist. */
/* ERZEUGT-ANFANG von tools/rechtstexte-erzeugen.cjs aus
   docs/felie-rechtstexte-v1-1-kanzleivorlage-2026-09-28.md (Teil II).
   Nicht von Hand aendern: Vorlage aendern und neu erzeugen. */
var RECHTSTEXTE_DATEN = {
  "datenschutz": {
    "titel": "Datenschutzerklärung",
    "fassung": "1.1",
    "stand": "28.09.2026",
    "entwurf": true,
    "abschnitte": [
      {
        "titel": "1. Verantwortlicher",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Lumavis GmbH, Nordring 9a, 60388 Frankfurt am Main, Deutschland\nVertreten durch die Geschäftsführung: Luisa Hoyer, Marcel Phillip Hoyer\nE-Mail: info@lumavis-gmbh.de · Telefon: +49 6109 7068525 · www.lumavis-gmbh.de"
          }
        ]
      },
      {
        "titel": "2. Datenschutzbeauftragte",
        "bloecke": [
          {
            "art": "absatz",
            "text": "[Name / Kanzlei der externen Datenschutzbeauftragten], erreichbar unter [E-Mail]."
          }
        ]
      },
      {
        "titel": "3. Das Wichtigste vorab",
        "bloecke": [
          {
            "art": "liste",
            "punkte": [
              "Was felie über dich weiß – dein Gedächtnis, deine Gespräche, deine Angaben –, liegt **auf deinem Gerät**. Wir haben darauf keinen Zugriff.",
              "Damit felie antworten kann, gehen deine Nachricht und der dafür nötige Ausschnitt deines Gedächtnisses **bei jeder Nachricht** verschlüsselt an unseren KI-Dienstleister IONOS in Deutschland. Dort entsteht die Antwort; gespeichert wird nichts.",
              "Bei uns liegen nur dein Konto (E-Mail-Adresse, Konto-Kennung), dein Abo-Status und der Stand deines kostenlosen Umfangs.",
              "Wir verkaufen keine Daten und werten nichts für Werbung aus. Es gibt kein Tracking."
            ]
          }
        ]
      },
      {
        "titel": "4. Welche Daten verarbeitet werden",
        "bloecke": [
          {
            "art": "absatz",
            "text": "**a) Deine Angaben und Nachrichten.** Name oder wie du genannt werden möchtest, Alter, Lebenssituation, was dich beschäftigt, deine Nachrichten an felie, Selbstreflexionen zu Stimmung, Schlaf und Energie, Angaben zu Zyklus, Lebensphase und Körper."
          },
          {
            "art": "absatz",
            "text": "**b) Kontodaten.** E-Mail-Adresse und Konto-Kennung. Meldest du dich mit Apple oder Google an, erhalten wir von dort eine Kennung und eine E-Mail-Adresse; bei „Mit Apple anmelden“ kann das eine Weiterleitungsadresse sein."
          },
          {
            "art": "absatz",
            "text": "**c) Abo- und Nutzungsdaten.** Ob dein Abonnement aktiv ist, Kaufdaten des Stores und – solange du ohne Abo nutzt – ein Zähler, wie viel vom kostenlosen Umfang verbraucht ist. Keine Gesprächsinhalte."
          },
          {
            "art": "absatz",
            "text": "**d) Werte aus Apple Health / Health Connect** [nur, wenn zum Start enthalten]. Nur wenn du es einschaltest und im Betriebssystem erlaubst, liest felie ausgewählte Werte auf deinem Gerät."
          },
          {
            "art": "absatz",
            "text": "**Gesundheitsdaten.** Ein Teil deiner Angaben und Nachrichten sind Gesundheitsdaten (Art. 9 DSGVO). Wir verarbeiten sie nur mit deiner ausdrücklichen Einwilligung (Punkt 6)."
          }
        ]
      },
      {
        "titel": "5. Wo deine Daten liegen",
        "bloecke": [
          {
            "art": "absatz",
            "text": "**Auf deinem Gerät:** Gedächtnis, Gespräche, Notizen, Angaben. Sie bleiben dort, bis du sie in der App löschst oder die App entfernst. Das Speichern auf deinem Gerät ist für die App technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).\n[Sachstand F7: Sicherung und Gerätewechsel – Weg und Ort hier beschreiben]"
          },
          {
            "art": "absatz",
            "text": "**Unterwegs für die Antwort:** Deine Nachricht und der nötige Kontext gehen verschlüsselt über unseren Vermittlungsdienst bei Cloudflare an IONOS. IONOS erzeugt die Antwort in Rechenzentren in Deutschland; die Inhalte werden weder protokolliert noch gespeichert noch zum Training verwendet. Auch Cloudflare leitet sie nur durch."
          },
          {
            "art": "absatz",
            "text": "**Bei uns:** Konto, Abo-Status, Stand des kostenlosen Umfangs (Punkt 4 b und c)."
          }
        ]
      },
      {
        "titel": "6. Rechtsgrundlagen",
        "bloecke": [
          {
            "art": "tabelle",
            "kopf": [
              "Verarbeitung",
              "Grundlage"
            ],
            "zeilen": [
              [
                "Konto, Anmeldung, Anmelde- und Sicherheitsmails, Abo bereitstellen",
                "Art. 6 Abs. 1 lit. b DSGVO"
              ],
              [
                "Zähler des kostenlosen Umfangs",
                "Art. 6 Abs. 1 lit. b, ergänzend lit. f (Missbrauchsschutz)"
              ],
              [
                "Deine Angaben und Nachrichten, soweit Gesundheitsdaten, einschließlich der Übermittlung an IONOS für die Antwort",
                "Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO (ausdrückliche Einwilligung)"
              ],
              [
                "Werte aus Apple Health / Health Connect",
                "Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a, eigene Einwilligung, zusätzlich deine Freigabe im Betriebssystem"
              ]
            ]
          },
          {
            "art": "absatz",
            "text": "Du kannst jede Einwilligung jederzeit in den Einstellungen mit Wirkung für die Zukunft widerrufen. Ohne die Einwilligung für deine Nachrichten kann felie nicht antworten; dein Gedächtnis auf dem Gerät bleibt davon unberührt."
          }
        ]
      },
      {
        "titel": "7. Empfänger",
        "bloecke": [
          {
            "art": "liste",
            "punkte": [
              "**IONOS SE** (Montabaur, Deutschland) – erzeugt felies Antworten. Verarbeitung ausschließlich in Rechenzentren in Deutschland; Inhalte werden nicht protokolliert, nicht eingesehen, nicht für Training verwendet; keine Unterauftragsverarbeiter. Auftragsverarbeitung nach Art. 28 DSGVO.",
              "**Cloudflare, Inc.** (USA) – betreibt den Vermittlungsdienst zwischen App und IONOS und speichert Konto-Kennung und Zählerstand in der EU. Gesprächsinhalte werden durchgeleitet, nicht gespeichert. Auftragsverarbeitung.",
              "**Supabase Pte. Ltd.** (Singapur) – verwaltet deine Anmeldung; E-Mail-Adresse und Konto-Kennung werden in Frankfurt am Main gespeichert. Auftragsverarbeitung.",
              "**Sinch Mailjet** [Gesellschaft laut Vertrag] – versendet Anmeldecodes und Sicherheitsmitteilungen; Rechenzentren in Deutschland und Belgien. Auftragsverarbeitung.",
              "**RevenueCat, Inc.** (USA) – verwaltet dein Abonnement; erhält nur eine pseudonyme Konto-Kennung und Kaufdaten, nie deine E-Mail-Adresse oder Inhalte. Auftragsverarbeitung.",
              "**Apple Distribution International Ltd.** (Irland) bzw. **Google** – wickeln Kauf, Verlängerung, Widerruf und Erstattung deines Abonnements sowie ggf. die Anmeldung mit Apple oder Google als eigenständige Verantwortliche ab; es gelten deren Datenschutzhinweise."
            ]
          }
        ]
      },
      {
        "titel": "8. Übermittlung in Drittländer",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Deine Gesprächsinhalte werden ausschließlich in Deutschland verarbeitet; bei Cloudflare werden sie nur durchgeleitet. Für Cloudflare (USA) stützen wir Übermittlungen auf das EU-US Data Privacy Framework und zusätzlich auf EU-Standardvertragsklauseln. Für Supabase (Singapur) und RevenueCat (USA) gelten EU-Standardvertragsklauseln. Eine Kopie der Klauseln erhältst du auf Anfrage."
          }
        ]
      },
      {
        "titel": "9. Speicherdauer",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Daten auf deinem Gerät: bis du sie löschst oder die App entfernst. Konto, Abo-Zuordnung und Zählerstand: solange dein Konto besteht; mit der Kontolöschung werden sie gelöscht. Deine Gesprächsinhalte werden bei IONOS und Cloudflare nicht aufbewahrt. Kaufbelege bewahrt der jeweilige Store nach seinen Pflichten auf."
          }
        ]
      },
      {
        "titel": "10. Deine Rechte",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21), Widerruf einer Einwilligung (Art. 7 Abs. 3). Das meiste, was felie über dich weiß, siehst du vollständig im Bereich **Gedächtnis**, kannst es dort ändern, löschen und exportieren. Eine Auskunft von uns umfasst, was bei uns liegt. Anfragen an info@lumavis-gmbh.de oder an unsere Datenschutzbeauftragte; wir antworten innerhalb eines Monats."
          },
          {
            "art": "absatz",
            "text": "Du kannst dich bei einer Aufsichtsbehörde beschweren, etwa beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit oder bei der Behörde an deinem Wohnort."
          }
        ]
      },
      {
        "titel": "11. Konto löschen",
        "bloecke": [
          {
            "art": "absatz",
            "text": "In der App unter Einstellungen, oder ohne App über https://felie.app/konto-loeschen. Gelöscht werden Konto, Anmeldedaten, Abo-Zuordnung und Zählerstand. Die Daten auf deinem Gerät entfernst du mit „Alle Daten löschen“ in der App oder indem du die App löschst. Ein laufendes Abonnement kündigst du in deinem Apple-Account bzw. bei Google Play; die Kontolöschung beendet es nicht."
          }
        ]
      },
      {
        "titel": "12. felie ist eine KI",
        "bloecke": [
          {
            "art": "absatz",
            "text": "felies Antworten erzeugt ein Sprachmodell, kein Mensch. Das steht dauerhaft unter dem Eingabefeld. Es gibt keine automatisierte Entscheidung über dich im Sinne von Art. 22 DSGVO."
          }
        ]
      },
      {
        "titel": "13. Keine medizinische Beratung",
        "bloecke": [
          {
            "art": "absatz",
            "text": "felie ist kein Medizinprodukt, stellt keine Diagnosen, bewertet keine Befunde und ersetzt keine ärztliche oder psychotherapeutische Beratung. In einer akuten Notlage wähle die 112; die TelefonSeelsorge erreichst du rund um die Uhr unter 0800 111 0 111 (Deutschland) bzw. 142 (Österreich)."
          }
        ]
      },
      {
        "titel": "14. Mindestalter",
        "bloecke": [
          {
            "art": "absatz",
            "text": "felie richtet sich an Erwachsene ab 18 Jahren. Wir verarbeiten wissentlich keine Daten von Minderjährigen."
          }
        ]
      },
      {
        "titel": "15. Änderungen",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Wir passen diese Erklärung an, wenn sich die Verarbeitung ändert, und informieren dich in der App über wesentliche Änderungen."
          }
        ]
      }
    ]
  },
  "impressum": {
    "titel": "Impressum",
    "fassung": "1.1",
    "stand": "28.09.2026",
    "entwurf": true,
    "abschnitte": [
      {
        "titel": null,
        "bloecke": [
          {
            "art": "absatz",
            "text": "**Angaben gemäß § 5 DDG**"
          },
          {
            "art": "absatz",
            "text": "Lumavis GmbH\nNordring 9a\n60388 Frankfurt am Main\nDeutschland"
          },
          {
            "art": "absatz",
            "text": "**Vertreten durch** die Geschäftsführung: Luisa Hoyer, Marcel Phillip Hoyer"
          },
          {
            "art": "absatz",
            "text": "**Kontakt** Telefon: +49 6109 7068525 · E-Mail: info@lumavis-gmbh.de · Web: www.lumavis-gmbh.de"
          },
          {
            "art": "absatz",
            "text": "**Registereintrag** Amtsgericht Frankfurt am Main, HRB 137981"
          },
          {
            "art": "absatz",
            "text": "**Umsatzsteuer-Identifikationsnummer** gemäß § 27a UStG: DE454373981"
          },
          {
            "art": "absatz",
            "text": "**Verbraucherstreitbeilegung** Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."
          }
        ]
      }
    ]
  },
  "nutzungsbedingungen": {
    "titel": "Nutzungsbedingungen",
    "fassung": "1.1",
    "stand": "28.09.2026",
    "entwurf": true,
    "abschnitte": [
      {
        "titel": "§ 1 Geltung und Vertragspartnerin",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Diese Nutzungsbedingungen gelten für die App „felie“ der Lumavis GmbH, Nordring 9a, 60388 Frankfurt am Main, Amtsgericht Frankfurt am Main HRB 137981, vertreten durch Luisa Hoyer und Marcel Phillip Hoyer („wir“). Mit dem Anlegen eines Kontos kommt zwischen dir und uns ein Nutzungsvertrag zustande. Den Kauf eines Abonnements regelt § 8."
          }
        ]
      },
      {
        "titel": "§ 2 Was felie ist",
        "bloecke": [
          {
            "art": "absatz",
            "text": "felie ist eine digitale Begleiterin zur Selbstreflexion rund um Wohlbefinden, Alltag, Körperwahrnehmung und Gefühle. felie ist eine KI: Die Antworten erzeugt ein Sprachmodell. Sie können unzutreffend oder unpassend sein; verlass dich bei wichtigen Entscheidungen nicht allein darauf. Einen Anspruch auf bestimmte Antworten oder Ergebnisse gibt es nicht."
          }
        ]
      },
      {
        "titel": "§ 3 Keine medizinische Leistung",
        "bloecke": [
          {
            "art": "absatz",
            "text": "felie ist kein Medizinprodukt und bietet keine medizinische, psychotherapeutische oder heilkundliche Beratung, Diagnose oder Behandlung. felie bewertet keine Befunde oder Messwerte und gibt keine Behandlungs- oder Dosierungsempfehlungen. In einer Notlage wende dich an ärztliche Hilfe oder den Notruf 112."
          }
        ]
      },
      {
        "titel": "§ 4 Konto und Mindestalter",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Die Nutzung setzt ein Konto und ein Mindestalter von 18 Jahren voraus. Das Konto ist persönlich und nicht übertragbar."
          }
        ]
      },
      {
        "titel": "§ 5 Deine Daten liegen bei dir",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Was felie über dich weiß, wird auf deinem Gerät gespeichert. Wir können es nicht wiederherstellen, wenn es dort verloren geht. [Sachstand F7: Sicherung, Gerätewechsel, Export/Import – ein Import ersetzt den vorhandenen Bestand]. Dein Gedächtnis, deine Angaben und dein Archiv bleiben dir auch ohne Abonnement zugänglich."
          }
        ]
      },
      {
        "titel": "§ 6 Was du nicht tust",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Du nutzt felie nicht missbräuchlich, gibst keine rechtswidrigen Inhalte ein und verletzt keine Rechte Dritter. Du umgehst keine technischen Schutzmaßnahmen und nicht den kostenlosen Umfang und nutzt die App nicht automatisiert."
          }
        ]
      },
      {
        "titel": "§ 7 Kostenloser Umfang und Abonnement",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Du kannst felie ohne Abonnement in begrenztem Umfang kennenlernen. Der kostenlose Umfang gilt einmal je Konto und erneuert sich nicht. Wie viele Nachrichten er umfasst, hängt von der Länge der Nachrichten und Antworten ab und lässt sich deshalb nicht als feste Zahl angeben. Ist er erreicht, beendet felie das laufende Gespräch und die App zeigt dir das an. Weiter sprechen kannst du mit einem Abonnement."
          },
          {
            "art": "absatz",
            "text": "Das Monatsabo kostet 7,99 € im Monat (Preis laut Store, inkl. MwSt.) und verlängert sich automatisch um einen Monat, wenn du es nicht mindestens 24 Stunden vor Ablauf kündigst. Eine kostenlose Testphase gibt es nicht."
          }
        ]
      },
      {
        "titel": "§ 8 Kauf über die App-Stores",
        "bloecke": [
          {
            "art": "absatz",
            "text": "(1) Abonnements erwirbst du ausschließlich über den App Store von Apple bzw. über Google Play. Vertragspartner des Kaufs ist in der EU die Apple Distribution International Ltd. (Irland) bzw. die Google Commerce Limited (Irland).\n(2) Abschluss, Zahlung, Rechnung, Verlängerung, Kündigung, Widerruf und Erstattung richten sich nach den Bedingungen des jeweiligen Stores und laufen ausschließlich dort, bei Apple über die Einstellungen deines Apple-Accounts. Ein gesetzliches Widerrufsrecht besteht gegenüber dem Store; die Belehrung stellt dieser bereit.\n(3) Deine gesetzlichen Rechte uns gegenüber, insbesondere nach §§ 327 ff. BGB, bleiben unberührt."
          }
        ]
      },
      {
        "titel": "§ 9 Verfügbarkeit",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Wir bemühen uns um eine möglichst unterbrechungsfreie Verfügbarkeit, schulden sie aber nicht. Wartung, Störungen und Weiterentwicklung können zu vorübergehenden Einschränkungen führen. Deine gesetzlichen Rechte bleiben unberührt."
          }
        ]
      },
      {
        "titel": "§ 10 Haftung",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz. Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht, begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Im Übrigen ist die Haftung ausgeschlossen."
          }
        ]
      },
      {
        "titel": "§ 11 Laufzeit und Beendigung",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Der Nutzungsvertrag läuft unbefristet. Du kannst ihn jederzeit beenden, indem du dein Konto löschst (in der App unter Einstellungen oder über https://felie.app/konto-loeschen). Ein Abonnement endet damit nicht automatisch; kündige es im Store. Wir können den Nutzungsvertrag mit einer Frist von vier Wochen kündigen, aus wichtigem Grund fristlos."
          }
        ]
      },
      {
        "titel": "§ 12 Änderungen",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Wir ändern diese Bedingungen nur aus triftigem Grund und ohne dich unangemessen zu benachteiligen, und informieren dich vorher in der App."
          }
        ]
      },
      {
        "titel": "§ 13 Anwendbares Recht, Gerichtsstand",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Als Verbraucherin behältst du den Schutz der zwingenden Bestimmungen des Rechts des Staates, in dem du deinen gewöhnlichen Aufenthalt hast. Bist du Kauffrau/Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand Frankfurt am Main. Ist eine Bestimmung unwirksam, bleiben die übrigen wirksam."
          }
        ]
      },
      {
        "titel": "§ 14 Zusätzliche Bestimmungen für Apple-Geräte",
        "bloecke": [
          {
            "art": "absatz",
            "text": "Für die Nutzung auf Apple-Geräten gilt: Diese Bedingungen bestehen zwischen dir und uns, nicht mit Apple. Wir – nicht Apple – sind für die App, ihre Pflege und ihren Support verantwortlich und für Ansprüche im Zusammenhang mit der App, einschließlich Produkthaftung, gesetzlicher und behördlicher Anforderungen, Verbraucherschutz sowie Rechten Dritter am geistigen Eigentum. Entspricht die App nicht einer gesetzlichen Gewährleistung, kannst du Apple benachrichtigen; Apple erstattet dann ggf. den Kaufpreis, weitere Gewährleistungspflichten hat Apple nicht. Du versicherst, dass du dich nicht in einem Land unter US-Embargo befindest und nicht auf einer US-Sperrliste stehst. Apple und seine Tochtergesellschaften sind Drittbegünstigte dieser Bedingungen und können sie dir gegenüber durchsetzen. Kontakt für Fragen und Beschwerden: Lumavis GmbH, Anschrift wie oben, info@lumavis-gmbh.de."
          }
        ]
      }
    ]
  }
};
/* ERZEUGT-ENDE */

function tiefFrieren(o) {
  Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') tiefFrieren(o[k]); });
  return Object.freeze(o);
}

export const FELIE_RECHTSTEXT_ARTEN = Object.freeze(['datenschutz', 'impressum', 'nutzungsbedingungen']);

export const FELIE_RECHTSTEXTE = tiefFrieren(JSON.parse(JSON.stringify(RECHTSTEXTE_DATEN)));

/* Wo die wortgleiche Fassung im Web steht (Kanzleivorlage Teil III Nr. 13). */
export const FELIE_RECHTSTEXT_WEB = Object.freeze({
  datenschutz: 'https://felie.app/datenschutz',
  impressum: 'https://felie.app/impressum',
  nutzungsbedingungen: 'https://felie.app/nutzungsbedingungen'
});

export function felieRechtstext(art) {
  return Object.prototype.hasOwnProperty.call(FELIE_RECHTSTEXTE, art) ? FELIE_RECHTSTEXTE[art] : null;
}

/* Die Zeile unter dem Titel: "Entwurf · Fassung 1.1 · Stand 28.09.2026". */
export function felieRechtstextKennung(art, texte) {
  var r = (texte || FELIE_RECHTSTEXTE)[art];
  if (!r) return '';
  return (r.entwurf ? 'Entwurf · ' : '') + 'Fassung ' + r.fassung + ' · Stand ' + r.stand;
}

/* Welche Fassungen noch Entwurf sind (Release-Gate). */
export function felieRechtstexteImEntwurf(texte) {
  var t = texte || FELIE_RECHTSTEXTE;
  return FELIE_RECHTSTEXT_ARTEN.filter(function (art) { return !t[art] || t[art].entwurf !== false; });
}

function maskieren(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Fettung nach dem Maskieren, Zeilenumbruch als <br>. */
function inline(s) {
  return maskieren(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function block(b) {
  if (b.art === 'liste') return '<ul>' + b.punkte.map(function (p) { return '<li>' + inline(p) + '</li>'; }).join('') + '</ul>';
  if (b.art === 'tabelle') return '<table><thead><tr>' + b.kopf.map(function (k) { return '<th>' + inline(k) + '</th>'; }).join('')
    + '</tr></thead><tbody>' + b.zeilen.map(function (z) { return '<tr>' + z.map(function (k) { return '<td>' + inline(k) + '</td>'; }).join('') + '</tr>'; }).join('')
    + '</tbody></table>';
  return '<p>' + inline(b.text) + '</p>';
}

/* Die Webseite fuer den Store-Eintrag: dieselben Abschnitte, Wort fuer Wort. */
export function felieRechtstextHtml(art) {
  var r = felieRechtstext(art);
  if (!r) return '';
  return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + maskieren(r.titel) + ' – felie</title></head><body>'
    + '<h1>' + maskieren(r.titel) + '</h1><p>' + maskieren(felieRechtstextKennung(art)) + '</p>'
    + r.abschnitte.map(function (a) {
      return (a.titel ? '<h2>' + maskieren(a.titel) + '</h2>' : '') + a.bloecke.map(block).join('');
    }).join('')
    + '</body></html>';
}
