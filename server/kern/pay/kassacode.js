/* RTG Pay: DE KASSACODE ALS CAPABILITY -- contactloos afrekenen bij de partner.

   DIT IS EEN VERHUIZING EN GEEN NIEUW DING, en dat verschil bepaalt het hele
   bestand. De kassacode bestaat al jaren (./kassa.js): een lid geeft een code af
   met een maximum, de kassa vult het bedrag in en int hem. Dat is in alles al een
   capability -- gebonden, begrensd, eenmalig, kort houdbaar -- behalve in naam.
   Wat hier verandert is de DRAGER, niet de handeling:

     was:  de QR bevat 'rtg:kas:A1B2C3' -- de code zelf, leesbaar. Wie hem
           fotografeert kan hem overtypen aan elke andere RTG-kassa.
     nu:   de QR bevat een ondertekende verwijzing van vijf minuten. De code
           zelf blijft op de server, en de kassa ziet eerst een KAART: wie
           er betaalt en tot welk bedrag, voordat er iets gebeurt.

   Het innen zelf blijft `kasInt` -- inclusief de eenmaligheid, het maximum, het
   bijladen en de betaaldienstkosten. Er is geen tweede plek waar een kassacode
   wordt verzilverd, en die komt er ook niet (LAT.md regel 4).

   DE EERSTE CAPABILITY DIE EEN ZAAK AANVAARDT. Alle andere gaan tussen leden;
   deze niet, en daar hangt meer aan dan een rol in een lijst: de kassa heeft geen
   ledensessie, dus hij komt binnen langs zijn eigen poort (supplierAuth) en zijn
   eigen loket. De rol staat daarom op drie plekken die het eens moeten zijn --
   hier, in kern/link/intenties.js en in server/routes/link.js -- en
   test/linkkassa.test.js zakt zodra er een van de drie afwijkt.

   DE RICHTING, EN WAAROM DIE VEILIG IS. Hier geeft de UITGEVER geld uit: het lid
   maakt de code op zijn eigen toestel, kiest zelf het maximum, en dat is de
   bevestiging die LINK.md par. 3.2 vraagt. De kassa kan er nooit meer mee dan dat
   maximum, nooit twee keer, en na vijf minuten niets. Wat een sticker aan de muur
   nooit mag (par. 3.3), mag dit wel: hij komt van een mens die hem op dat moment
   ophoudt. */
'use strict';

const euro = (centen) => '€ ' + (Math.round(Number(centen)) / 100).toFixed(2).replace('.', ',');

module.exports = ({ pay, schoon }) => ({
  id: 'geld.kassa',
  wat: 'Afrekenen aan de kassa',
  uitgever: ['lid'],
  aanvaarder: ['supplier'],
  /* Exact zolang als de code eronder leeft, en dat getal komt uit RTG Pay zelf.
     Een eigen vijf minuten hier zou de dag na de eerste wijziging uit de pas
     lopen -- met een kaart die nog netjes toont wat allang niet meer kan. */
  ttlMs: pay.KASCODE_MS,
  eenmalig: true,

  /* Uitgeven maakt de echte kassacode aan. De opdracht draagt hem, en daarmee is
     de capability gebonden aan die ene code: een verse code hoort bij een vers
     token en niet bij het oude. */
  lees(invoer, uitgever) {
    if (!uitgever.codenaam) return { status: 403, error: 'Deze sessie kan niet afrekenen.' };
    const r = pay.kasCode({ codenaam: uitgever.codenaam, maxCenten: invoer && invoer.maxCenten });
    if (r.error) return r;
    return { code: r.code, maxCenten: r.maxCenten };
  },

  /* Wat alleen het lid zelf terugkrijgt. De code staat met opzet NIET op de
     kaart: die is voor wie scant, en een code van zes tekens op het scherm van
     de kassa is een code die de kassa kan bewaren. Het lid heeft hem wel nodig
     -- bij een kassa zonder camera leest hij hem gewoon voor. */
  voorUitgever: (o) => ({ code: o.code, maxCenten: o.maxCenten }),

  // leeft de code eronder nog? (een verse code van hetzelfde lid verdringt hem)
  nog: (o) => !!pay.kasStand(o.code),

  beschrijf: (o) => ({
    wat: 'Afrekenen',
    velden: [{ naam: 'Maximaal', waarde: euro(o.maxCenten) }],
    gegevens: ['je codenaam', 'het bedrag dat de kassa invult']
  }),

  /* Wat de KASSA invult: het werkelijke bedrag, binnen het maximum. Alleen de
     vorm wordt hier gekeurd -- of het bedrag past, weet `kasInt` (met het nette
     "boven het maximum van deze code"), en die blijft de enige die dat bepaalt. */
  neem(invoer) {
    const centen = Math.round(Number(invoer && invoer.centen));
    if (!Number.isFinite(centen) || centen <= 0) return { status: 400, error: 'Vul het bedrag in.' };
    return { centen, oms: schoon(invoer && invoer.oms, 80) || 'Kassa' };
  },

  doe({ opdracht, invoer, aanvaarder, idem }) {
    return pay.kasInt({ supplierCode: aanvaarder.code, code: opdracht.code,
      centen: invoer.centen, oms: invoer.oms, idem });
  }
});
