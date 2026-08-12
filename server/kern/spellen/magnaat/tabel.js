/* Magnaat: DE ACTIETABEL SAMENSTELLEN -- in welke volgorde, en waarom die telt.

   Afgesplitst van ./economie.js, en het is een echte naad. Dat bestand gaat
   over de KLOK en de partij; dit is een BOUWSTAP die met elke fase meegroeit --
   contracten, veilingen, aandelen, loondienst, uitstappen zijn er allemaal aan
   toegevoegd. Twee dingen met zo'n verschillend tempo horen niet in een
   bestand, en de 10 kB-grens in scripts/check.js is precies de rem daarop.

   DE VOLGORDE IS GEEN NETHEID MAAR EEN REPARATIE. Twee onderdelen krijgen de
   COMPLETE tabel mee -- de AI-manager (./beheer.js) en de AI-concurrenten
   (./concurrent-zet.js) -- want ze doen niets wat een speler niet ook kan, ze
   roepen dezelfde acties aan. Wie ze bouwt voordat de tabel af is, geeft ze een
   halve tabel: dan kan een manager een actie noemen die hij niet kan aanroepen,
   en dat gaat STIL mis. Het is hier eerder gebeurd; zie de uitleg in
   ./lagen.js. Daarom staan ze onderaan en niet daar.

   WAT VRIJ IS EN WAT NIET wordt hier ook vastgelegd, en dat is de mechaniek
   waar Long Play op staat of valt (GAMEHALL.md 12.3). `VRIJE_ACTIES` is de
   lijst die ./economie.js gebruikt om te bepalen of de beurt doorgaat, en
   ./index.js draagt hem als `buitenBeurt` naar de platformlaag. Een actie die
   in het ene lijstje staat en niet in het andere is een actie die je wel mag
   doen maar niet mag doen -- test/spelmagnaat.test.js telt ze na. */
'use strict';
const { kaart } = require('./kaart');
const G = require('./governance');

module.exports = ({ K, mijnVestiging, vrijKavel, rond, L }) => {
  /* WAT EEN SPELER DOET staat in ./acties.js; de lagen schuiven hun acties erbij. */
  const basis = require('./acties')({ K, mijnVestiging, vrijKavel, rond });
  const ACTIES = Object.assign({}, basis.ACTIES, L.ACTIES);
  const VRIJE_ACTIES = basis.VRIJE_ACTIES.concat(L.VRIJE_ACTIES);
  const beheer = L.maakBeheer(ACTIES);
  /* UITSTAPPEN (fase C). Hij staat HIER en niet in ./lagen.js omdat hij de
     PARTIJ raakt en niet een laag: wie uitstapt telt niet meer mee voor de
     winst en wordt overgeslagen in de beurtvolgorde (./verloop.js). Vrij, want
     wie ermee ophoudt komt per definitie niet meer op zijn beurt terug. */
  ACTIES.uitstappen = (potje, h, zet) => L.uitstap.uitstappen(potje, h,
    zet && zet.naar ? String(zet.naar) : null);
  VRIJE_ACTIES.push('uitstappen');
  /* STEMMEN OVER WAT DE FOUNDATION BOUWT (fase C, ./governance.js). Vrij, en
     dat volgt uit de laag zelf: een stemming met een beurt eraan vast is een
     deadline, en dat is de kunstmatige urgentie die CLAUDE.md verbiedt. */
  ACTIES['foundation-stem'] = (potje, h, zet) => G.stem(potje, h,
    zet.project === undefined ? null : zet.project, zet.zone);
  VRIJE_ACTIES.push('foundation-stem');
  /* LOONDIENST (VERHAAL.md stap 1) krijgt om dezelfde reden als de manager de
     complete tabel: een werknemer verandert niets rechtstreeks maar roept de
     gewone `beleid`-actie aan namens zijn werkgever. */
  const dienen = L.maakDienst(ACTIES);
  Object.assign(ACTIES, dienen.ACTIES);
  VRIJE_ACTIES.push(...dienen.VRIJE_ACTIES);
  /* PROMOTIE (VERHAAL.md hoofdstuk 2). Vrij, en om dezelfde reden als de rest
     van de loondienst: een gesprek over je toekomst hoort niet op een beurt te
     wachten. Hij staat NA de dienstacties omdat hij ze nodig heeft. */
  const promotie = require('./promotie')({ ACTIES });
  Object.assign(ACTIES, promotie.ACTIES);
  VRIJE_ACTIES.push(...promotie.VRIJE_ACTIES);
  /* DE DIENST ZELF (VERHAAL.md par. 0f, ./rush.js). Vrij, en hier is dat geen
     gemak maar de wet: een dienst die op je beurt moet wachten kan in een
     partij van zes een week duren, en dan is de avond al voorbij. Hij staat NA
     de dienstacties omdat hij een lopend dienstverband nodig heeft. */
  const rush = require('./rush-acties')();
  Object.assign(ACTIES, rush.ACTIES);
  VRIJE_ACTIES.push(...rush.VRIJE_ACTIES);
  const aiZet = require('./concurrent-zet')({ ACTIES, kaart });

  return { ACTIES, VRIJE_ACTIES, beheer, dienen, aiZet, promotie, rush };
};
