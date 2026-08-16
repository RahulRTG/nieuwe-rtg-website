/* RTG Bestanden (deelbestand): de Ontsmetter aan de deur van de kluis.

   Het scan-net in server.js loopt door elke verzoek-body, maar het kijkt alleen
   naar data-URL's met een BEELD- of PDF-type (DATA_URL_RE in kern/antivirus).
   Dat is een verdedigbare keuze voor De Salon en de snaps -- daar komt niets
   anders binnen -- maar RTG Bestanden is juist de plek waar ALLES binnenkomt:
   zip, exe, doc, wat het lid ook bewaart. Precies de types die malware dragen
   kwamen er dus ongescand in, en werden daarna gedeeld met maximaal 25 anderen.

   Vandaar een poort bij de kluis zelf, en niet een verbreding van het globale
   net: dat zou elke data-URL in elk verzoek laten decoderen, en dat is een prijs
   die het hele platform betaalt voor een probleem van een module.

   Twee plekken maken van bytes een bestand, en die halen allebei deze poort
   langs -- vandaar een eigen bestand in plaats van twee keer dezelfde regel:
   - ./bestanden.js        een gewone upload;
   - ./bestanden-delen.js  een nieuwe versie (dat is een vers bestand).

   De derde weg, ./bestanden-stukken.js, heeft GEEN eigen kopie: die schrijft
   niet zelf maar loopt aan het eind door die twee heen. Ik had er eerst wel een
   scan bij gezet; de mutatie bleek niet te bijten, en dat was terecht. Wat daar
   moet blijven gelden is dat die weg nooit om upload()/versieNieuw() heen gaat
   schrijven -- test/upload-poort.test.js bewaakt dat van buitenaf.

   Geeft null terug als het mag, of een foutobject dat de aanroeper doorgeeft. */
module.exports = function maakBestandenPoort({ antivirus }) {
  async function scanOk(key, dataUrl) {
    if (antivirus && typeof antivirus.keurDataUrl === 'function') {
      try {
        const veilig = await antivirus.keurDataUrl(dataUrl, { bron: 'bestanden', door: key });
        return veilig && veilig.ok ? null : { status: 422, error: 'Dit bestand is geweigerd door de beveiliging (mogelijke malware).' };
      } catch (e) {
        if (e && e.code === 'RTG_UPLOAD_GEWEIGERD') return { status: 422, error: e.message };
        return { status: 503, error: 'De veiligheidsscan is tijdelijk niet beschikbaar. Het bestand is niet opgeslagen.' };
      }
    }
    if (!antivirus || typeof antivirus.veiligeFoto !== 'function') return null;
    const veilig = antivirus.veiligeFoto(dataUrl, { bron: 'bestanden', door: key });
    return veilig.ok ? null
      : { status: 422, error: veilig.error || 'Dit bestand is geweigerd door de beveiliging (mogelijke malware).' };
  }
  return { scanOk };
};
