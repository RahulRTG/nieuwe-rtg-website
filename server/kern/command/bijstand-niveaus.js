/* DE VIER NIVEAUS VAN EEN BIJSTANDSSESSIE, en wat elk niveau werkelijk mag.

   Dit is de tabel waar de hele laag op rust, en hij staat apart zodat er één
   plek is waar "wat mag support" te lezen valt zonder door de levensloop heen
   te moeten. Wie hier iets toevoegt, verruimt wat een leverancier bij een klant
   mag -- en dat hoort een besluit te zijn dat je in één bestand kunt nalezen.

   DRIE DINGEN GELDEN OP ELK NIVEAU, OOK OP `nood`:

   1. DE KLANT NODIGT UIT. Er is geen enkele stand waarin RTG zichzelf toegang
      geeft. Dat is geen instelling maar de vorm: alleen de klantkant kent een
      route die een sessie aanmaakt.
   2. DE SESSIE VERLOOPT VANZELF. Alles heeft een `tot`; er is niets dat blijft
      staan, dus er valt ook niets te vergeten in te trekken. Dezelfde regel als
      in ./toegang.js, en om dezelfde reden.
   3. INHOUD IS DICHT. Structuur, tellingen en toestanden mogen; de gegevens van
      de klant zelf niet. Openen kan alleen met een apart, gemotiveerd verzoek
      dat de klant ziet en goedkeurt -- en dat staat dan in het verslag.

   WAAROM `nood` GEEN UITZONDERING OP REGEL 1 IS. De verleiding is een stand
   waarin RTG bij een ernstig incident zelf naar binnen kan. Die stand komt er
   niet. Wat `nood` wél doet is de goedkeuring VOORAF geven in plaats van per
   handeling -- omdat een klant die om half drie 's nachts belt niet naast het
   scherm gaat zitten om vinkjes te zetten. Dat is zijn besluit, het duurt een
   half uur, en elke handeling staat onmiddellijk in het spoor en in het
   journaal. De goedkeuring is dus niet weg; hij is één keer gegeven, met een
   reden, voor een venster met een einde. */
'use strict';

const NIVEAUS = {
  kijken: {
    naam: 'Kijken',
    wat: 'Meekijken in de diagnose. Er kan niets worden voorgesteld en niets worden uitgevoerd.',
    mag: ['diagnose'], maxMinuten: 60, vooraf: false
  },
  meedenken: {
    naam: 'Meedenken',
    wat: 'Mag handelingen VOORSTELLEN. Uitvoeren doet u zelf, of u geeft er los toestemming voor.',
    mag: ['diagnose', 'voorstellen'], maxMinuten: 120, vooraf: false
  },
  herstellen: {
    naam: 'Herstellen',
    wat: 'Mag een handeling uitvoeren nadat u die handeling heeft goedgekeurd. Per handeling.',
    mag: ['diagnose', 'voorstellen', 'uitvoeren'], maxMinuten: 60, vooraf: false
  },
  nood: {
    naam: 'Nood',
    wat: 'Mag handelen zonder per handeling te wachten. U geeft die toestemming nu, met een reden, ' +
      'voor een half uur; elke handeling verschijnt onmiddellijk in het spoor.',
    mag: ['diagnose', 'voorstellen', 'uitvoeren'], maxMinuten: 30, vooraf: true,
    vraagtReden: true
  }
};

const NAMEN = Object.keys(NIVEAUS);

/* De duur wordt door de KLANT gevraagd en door het niveau begrensd. Geen
   standaard die stilzwijgend het maximum pakt: wie niets zegt krijgt het
   kortste dat nuttig is, want een sessie die langer openstaat dan nodig is een
   sessie die iemand vergeet. */
function duurVan(niveau, gevraagd) {
  const n = NIVEAUS[niveau];
  if (!n) return null;
  const standaard = Math.min(30, n.maxMinuten);
  const g = (gevraagd == null || gevraagd === '') ? standaard : Number(gevraagd);
  const m = Number.isFinite(g) ? g : standaard;
  return Math.max(5, Math.min(m, n.maxMinuten));
}

const mag = (niveau, wat) => !!(NIVEAUS[niveau] && NIVEAUS[niveau].mag.includes(wat));

/* Wat een klant te zien krijgt voordat hij kiest. Niet de interne tabel maar
   een lijst waar hij een besluit op kan nemen: wat mag deze persoon, hoe lang,
   en wat blijft er hoe dan ook dicht. */
function keuzelijst() {
  return NAMEN.map(id => ({ id, naam: NIVEAUS[id].naam, wat: NIVEAUS[id].wat,
    maxMinuten: NIVEAUS[id].maxMinuten, voorafAkkoord: !!NIVEAUS[id].vooraf,
    vraagtReden: !!NIVEAUS[id].vraagtReden }));
}

module.exports = { NIVEAUS, NAMEN, duurVan, mag, keuzelijst };
