/* DE CADEAUBON VAN RTG -- besluit C14 van de eigenaar (28 september 2026).

   HET BESLUIT. RTG gaat een eigen cadeaubon verkopen die te besteden is bij RTG
   EN bij de zaken op het platform. Dat is een andere bon dan die van een zaak
   (kern/pay/tegoed-zaak.js, klasse GIFT: alleen bij die ene zaak) en een andere
   dan tegoed voor een ander (kern/pay/tegoed-bon.js): hier geeft RTG zelf waarde
   uit die bij DERDEN inwisselbaar is tegen de nominale waarde.

   EN DAT IS ELEKTRONISCH GELD. Een beperkt netwerk is een bon die alleen bij de
   uitgever te besteden is; zodra de zaken op het platform meedoen, geeft RTG
   e-geld uit (TOKEN.md, WAARDE.md par. 1). Dat valt niet weg te schrijven, en het
   staat daarom hier niet als instelling maar als SCHAKELAAR DIE DE POSITIE IS --
   dezelfde vorm als de terugstortstand (kern/bankregie/vergunning.js) en de beurs
   (kern/rugdekking/beurs.js):

     gesloten (standaard) -> RTG verkoopt deze bon niet. Niet "even niet": hij
                             hoort niet bij wat RTG vandaag is.
     open                 -> RTG neemt de positie in van uitgever van
                             elektronisch geld, en het vermogen RTG_CADEAUBON
                             wordt een rail die een e-geldvergunning over de
                             EIGEN rails vraagt (kern/bevoegdheid/
                             lijst-afhankelijk.js). Zonder die vergunning weigert
                             de bevoegdheidsvraag alsnog, met de reden.

   Wat mag, zegt kern/bevoegdheid en niet deze laag: die weegt de schakelaar EN de
   vergunning, en een bon die niemand mag uitgeven is geen bon.

   WAT HIER STAAT EN WAT NIET. Hier: de schakelaar, en de verplichting die de
   bankpositie leest -- het geld van een verkochte, nog niet bestede bon staat op
   de bank maar is niet verdiend (besluit C4). Er is vandaag geen enkele bon
   verkocht, dus die verplichting is nul, en dat is GEMETEN en niet aangenomen:
   hij telt het register. Niet hier: verkopen, inwisselen bij een zaak en
   afrekenen met die zaak. Die komen pas als RTG de vergunning of vrijstelling
   heeft; een uitgifte bouwen die in geen enkele stand mag draaien, is een half
   aangezette geldlaag, en die is gevaarlijker dan een afwezige. */
'use strict';

const NAAM = 'rtgCadeaubon';
const STANDEN = Object.freeze(['gesloten', 'open']);

module.exports = ({ db, save, nu }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/cadeaubon', bezit: { [NAAM]: 'kaart' } });
  const klok = typeof nu === 'function' ? nu : () => new Date().toISOString();

  /* Zonder vastgelegde stand: GESLOTEN. Een ontbrekende stand mag nooit als
     "open" lezen; zo wordt een positie ongemerkt ingenomen. */
  const stand = () => (STANDEN.includes(eigen.kijk(NAAM).stand) ? eigen.kijk(NAAM).stand : 'gesloten');

  function standZet({ stand: s, wie }) {
    const st = String(s || '');
    if (!STANDEN.includes(st)) return { status: 400, error: 'De stand is ' + STANDEN.join(' of ') + '.' };
    if (!wie) return { status: 403, error: 'Deze schakelaar IS de juridische positie van RTG, dus hij gaat op naam om.' };
    const k = eigen.bak(NAAM);
    if (k.stand === st) return { ok: true, ongewijzigd: true, stand: st };
    k.stand = st; k.standDoor = String(wie).slice(0, 80); k.standAt = klok();
    save();
    return { ok: true, stand: st, door: k.standDoor,
      uitleg: st === 'open'
        ? 'De cadeaubon staat open. RTG neemt daarmee de positie in van uitgever van elektronisch geld; zonder ' +
          'e-geldvergunning of vrijstelling weigert de uitgifte nog steeds, met de reden.'
        : 'De cadeaubon staat dicht. RTG geeft geen waarde uit die bij zaken te besteden is.' };
  }

  /* De verplichting: de som van de verkochte en nog niet bestede bonnen. Het
     register is leeg zolang er geen uitgifte is, en dan is het antwoord nul MET de
     reden -- geen nul omdat niemand keek. */
  function verplichting() {
    const bonnen = Array.isArray(eigen.kijk(NAAM).bonnen) ? eigen.kijk(NAAM).bonnen : [];
    const centen = bonnen.filter(b => b && b.open).reduce((s, b) => s + (Number.isInteger(b.centen) ? b.centen : 0), 0);
    return { centen, graad: 'gemeten', bonnen: bonnen.length,
      reden: bonnen.length ? null
        : 'RTG heeft geen eigen cadeaubon verkocht: de bon die ook bij zaken te besteden is, is elektronisch geld (C14), ' +
          'en er is geen uitgifte zolang RTG daarvoor geen vergunning of vrijstelling heeft.' };
  }

  const beeld = () => ({ stand: stand(), standDoor: eigen.kijk(NAAM).standDoor || null, standAt: eigen.kijk(NAAM).standAt || null,
    verplichting: verplichting(), nietGebouwd: ['verkopen', 'inwisselen bij een zaak', 'afrekenen met die zaak'],
    waaromNiet: 'Een uitgifte die in geen enkele stand mag draaien bouwen we niet vooruit; die komt met de vergunning.' });

  return { cadeaubonStand: stand, cadeaubonStandZet: standZet, cadeaubonVerplichting: verplichting, cadeaubonBeeld: beeld };
};
