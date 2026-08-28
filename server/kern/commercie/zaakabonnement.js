/* WELK ABONNEMENT HEEFT DEZE ZAAK?

   HET GAT. kern/commercie/capaciteiten.js beschrijft per trede wat een klant mag
   -- kassa, personeel, Werk OS, governance. Zes van die acht capabilities werden
   NERGENS afgedwongen, en de reden bleek niet luiheid maar een ontbrekend
   gegeven: een zaak draagt helemaal geen abonnement. De partnerpoort kijkt naar
   de pas van de AANVRAGER op het moment van aanvragen, en daarna weet niemand
   meer waar die zaak op zit.

   Zo is een productprofiel een folder: het staat er, en niets houdt zich eraan.
   Precies de fout die dit hele traject heeft opgeruimd -- een belofte zonder
   beller.

   DIT BESTAND LEGT DE ONTBREKENDE SCHAKEL. Een zaak krijgt een trede, en dan
   pas kan `mag(zaak, 'can_use_pos')` iets betekenen.

   DE MOEILIJKE VRAAG: WAT DOET EEN ZAAK ZONDER ABONNEMENT?

   Er zijn er honderden, want ze bestonden voordat de ladder er was. Ze weigeren
   zou elke bestaande partner morgen buitensluiten; ze stilzwijgend alles geven
   maakt de handhaving zinloos. Dus: een zaak zonder vastgelegd abonnement valt
   terug op `business`, met `herkomst: 'voor-de-ladder'` erbij. Twee redenen dat
   dit de juiste terugval is:

   1. Ze zijn destijds toegelaten onder de regel "een partnerplek vraagt een
      Business Pass". Die trede is dus wat ze feitelijk hadden.
   2. Het is de RUIMSTE zakelijke trede, dus de terugval kan nooit iets
      afpakken van wie het al had. Een migratie die rechten intrekt, is een
      storing met een nette naam.

   EN DE TERUGVAL IS TELBAAR. `zonderAbonnement()` geeft precies wie er op die
   terugval draait. Een terugval die je niet kunt tellen, is een gat dat er over
   een jaar nog steeds is en dat niemand meer ziet -- dezelfde reden dat
   `toewijzing: 'terugval'` in de kantoorregels als dekkingsgat telt.

   WAT DIT NIET IS: een tweede rechtenmodel. CONCERN.md is daar duidelijk over --
   toegang verlenen gebeurt waar de rol woont. Deze laag zegt niet WIE iets mag
   maar WAT HET ABONNEMENT BEVAT. Een manager met alle rollen kan geen kassa
   draaien als het abonnement van de zaak die niet bevat, en een medewerker met
   het duurste abonnement is nog steeds geen manager. Twee vragen, twee
   antwoorden, allebei gesteld. */
'use strict';

const klok = require('../../lib/klok');
const caps = require('./capaciteiten');
const ladder = require('../pasladder');

/* De trede waarop een zaak van voor de ladder draait. Zie de kop: het is wat ze
   feitelijk hadden, en het is de ruimste zakelijke trede zodat de terugval nooit
   iets afpakt. */
const TERUGVAL = 'business';

function maakZaakabonnement({ db, save, nu }) {
  const tijd = nu || klok.nu;

  const eigen = require('../eigencollectie')({ db, domein: 'kern/commercie/zaakabonnement', bezit: { zaakAbonnement: 'kaart' } });
  function alles() { return eigen.bak('zaakAbonnement'); }
  const sleutel = code => String(code || '').toUpperCase();

  /* Het abonnement van een zaak. Geeft ALTIJD een antwoord, met `herkomst`
     erbij -- 'vastgelegd' of 'voor-de-ladder'. Dat veld is het verschil tussen
     een terugval die je kunt tellen en een terugval die verdwijnt. */
  function van(code) {
    const c = sleutel(code);
    const r = alles()[c];
    if (r && ladder.trede(r.pas))
      return { code: c, pas: r.pas, herkomst: 'vastgelegd', sinds: r.sinds, door: r.door || null,
        contractId: r.contractId || null };
    return { code: c, pas: TERUGVAL, herkomst: 'voor-de-ladder', sinds: null, door: null, contractId: null };
  }

  /* Vastleggen. Alleen een BESCHIKBARE trede met `can_be_partner`: een zaak op
     de consumentenpas zetten zou een abonnement zijn dat de partnerpoort zelf
     niet zou hebben doorgelaten. */
  function zet(code, pas, door, contractId) {
    const c = sleutel(code);
    const t = ladder.trede(pas);
    if (!c) return { status: 400, error: 'Welke zaak?' };
    if (!t || !t.beschikbaar) return { status: 400, error: 'Deze trede bestaat niet of is niet beschikbaar.' };
    if (!caps.mag(pas, 'can_be_partner'))
      return { status: 400, error: t.naam + ' is geen zakelijk abonnement; een zaak hoort op ' +
        caps.tredenMet('can_be_partner').map(x => (ladder.trede(x) || {}).naam || x).join(' of ') + '.' };
    alles()[c] = { pas, sinds: tijd(), door: String(door || '').slice(0, 60) || null,
      contractId: contractId || null };
    save();
    return { status: 200, ok: true, ...van(c) };
  }

  /* De vraag die de code stelt. Neemt de zaakCODE en niet de zaak zelf: dan kan
     geen enkele aanroeper per ongeluk een tier meegeven die hij ergens anders
     vandaan heeft. */
  function mag(code, cap) { return caps.mag(van(code).pas, cap); }

  /* Wie draait er op de terugval? Dit is het getal dat de migratie zichtbaar
     houdt. `zaakCodes` komt van de aanroeper omdat deze laag de
     leverancierstabel niet hoort te kennen. */
  function zonderAbonnement(zaakCodes) {
    const bekend = alles();
    const uit = (zaakCodes || []).map(sleutel).filter(c => !bekend[c]);
    return { aantal: uit.length, codes: uit.slice(0, 200), terugval: TERUGVAL };
  }

  function lijst() {
    return Object.entries(alles()).map(([code, r]) => ({ code, ...van(code), sinds: r.sinds }));
  }

  return { van, zet, mag, zonderAbonnement, lijst, TERUGVAL };
}

module.exports = { maakZaakabonnement, TERUGVAL };
