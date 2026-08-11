/* Hospitality Guest OS (deelmodule): BESTELLEN BUITEN DE ZAAK -- bezorging en
   afhalen.

   DE NAAD IS HIER EEN ANDERE, EN DAT IS HET INTERESSANTE. Aan tafel bewijst de
   QR dat je er BENT: wie de sticker op tafel 12 scant, zit aan tafel 12, en of
   hij lid is doet er niet toe. Bij bezorging bestaat dat bewijs niet. Er is geen
   tafel, en er moet iemand bereikbaar zijn als de bezorger voor een dichte deur
   staat. Daarom is hier de LEDENSESSIE de poort, en niet een token.

   Dat verschil is precies waarom de gastlaag niet een generieke "bestelmotor"
   is geworden met een tafel als toevallige parameter. Wat generiek is: de
   rekening, de idempotentie, de audit, het beleid, de tijdlijn. Wat per kanaal
   verschilt: hoe je bewijst dat deze bestelling van jou is. Die twee horen
   gescheiden, en hier staat de tweede helft van dat bewijs.

   EEN LID HEEFT ER HOOGUIT EEN OPEN PER ZAAK EN PER KANAAL. Anders staan er
   twee bezorgbestellingen bij dezelfde pizzeria en betaalt de ene de andere --
   dezelfde regel als "een tafel heeft hooguit een open rekening", om dezelfde
   reden. */
'use strict';

const KANALEN_BUITEN = ['bezorging', 'afhaal'];

module.exports = ({ save, schoon, crypto, horeca, naad }) => {
  /* "Is deze rekening van mij" staat in kern/gast/naad.js en niet vier keer
     los: het is dezelfde vraag bij bezorgen, afhalen en de foodcourt, en een
     van de vier die anders gaat kijken is een lek dat niets meldt. */
  const { isVan } = naad;
  const { H, nu, id } = horeca;

  /* De lopende bestelling van dit lid bij deze zaak op dit kanaal, of een
     nieuwe. `handle` is de codenaam -- nooit de echte naam en nooit de
     ledensleutel (CLAUDE.md, privacy by design). */
  function lopende(zaakcode, kanaal, handle, { open = true } = {}) {
    if (!KANALEN_BUITEN.includes(kanaal)) return { status: 400, error: 'Dit kanaal bestaat hier niet.', code: 'kanaal' };
    const h = H(zaakcode);
    const bestaand = Object.values(h.rekeningen).find(r =>
      r.status === 'open' && r.kanaal === kanaal && isVan(r, handle));
    if (bestaand) return { rekening: bestaand, deelnemer: (bestaand.deelnemers || [])[0] || null, nieuw: false };
    if (!open) return { rekening: null, deelnemer: null, nieuw: false };

    const deelnemer = { nr: 1, handle, lid: true, leeftijd: null, leeftijdGeverifieerd: false, hash: null, at: nu() };
    const r = { id: id(5), kanaal, tafel: null, naam: null, gasten: 1,
      status: 'open', regels: [], kortingen: [], betalingen: [], fooiCenten: 0,
      gastId: handle, kamer: null, deelnemers: [deelnemer], audit: [],
      geopendAt: nu(), door: handle, at: nu(), viaGast: true };
    h.rekeningen[r.id] = r;
    save();
    return { rekening: r, deelnemer, nieuw: true };
  }

  /* Het bezorgadres en het tijdslot hangen aan de REKENING en niet aan een
     losse bezorgtabel: de bezorger, de keuken en de gast kijken dan naar
     hetzelfde. Het adres staat er als tekst voor de bezorger; er wordt geen
     tweede adresboek van gemaakt. */
  function zetBezorging(rek, { adres, postcode, lat, lng, zone, kostenCenten, datum, tijd, opmerking }) {
    rek.bezorg = {
      adres: schoon(adres, 120) || null,
      postcode: schoon(postcode, 10) || null,
      lat: lat == null ? null : Number(lat), lng: lng == null ? null : Number(lng),
      zone: zone || null, kostenCenten: kostenCenten || 0,
      datum: schoon(datum, 10) || null, tijd: schoon(tijd, 5) || null,
      opmerking: schoon(opmerking, 160) || null,
      stand: 'aangenomen', at: nu()
    };
    return rek.bezorg;
  }

  /* Afhalen krijgt een venster en een code. De code is er zodat de balie de
     juiste tas meegeeft zonder een naam te hoeven roepen -- dat is ook precies
     waarom hij kort en uitspreekbaar moet zijn en niet een hex-sleutel. */
  function zetAfhaal(rek, { datum, tijd, opmerking }) {
    if (!rek.afhaal) {
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // zonder I en O: die lijken op 1 en 0
      const cijfers = crypto.randomBytes(2).readUInt16BE(0) % 100;
      const letter = letters[crypto.randomBytes(1)[0] % letters.length];
      rek.afhaal = { code: letter + String(cijfers).padStart(2, '0') };
    }
    rek.afhaal.datum = schoon(datum, 10) || null;
    rek.afhaal.tijd = schoon(tijd, 5) || null;
    rek.afhaal.opmerking = schoon(opmerking, 160) || null;
    rek.afhaal.stand = rek.afhaal.stand || 'aangenomen';
    rek.afhaal.at = nu();
    return rek.afhaal;
  }

  /* De bezorgkosten staan als REGEL op de rekening en niet als een apart veld.
     Zo tellen ze mee in het totaal, in de splitsing en in de betaling zonder
     dat een van die drie er apart rekening mee hoeft te houden -- en de gast
     ziet waar het bedrag vandaan komt in plaats van een verschil onderaan. */
  function zetBezorgkosten(rek, centenBedrag, zonenaam) {
    const bestaande = (rek.regels || []).find(r => r.bezorgkosten);
    if (!centenBedrag) {
      if (bestaande) rek.regels = rek.regels.filter(r => !r.bezorgkosten);
      return null;
    }
    if (bestaande) { bestaande.centen = centenBedrag; bestaande.lijstprijs = centenBedrag; return bestaande; }
    const regel = { id: id(3), naam: 'Bezorging' + (zonenaam ? ' · ' + zonenaam : ''), aantal: 1,
      centen: centenBedrag, lijstprijs: centenBedrag, happy: null, groep: 'Bezorging',
      gang: 9, station: null, notitie: null, allergie: null, gastNr: null,
      stand: 'uitgegeven', bezorgkosten: true, at: nu(), door: 'systeem' };
    rek.regels.push(regel);
    return regel;
  }

  /* Wat de gast van zijn lopende en recente bestellingen ziet, over alle zaken
     heen. Bewust alleen de eigen: de sleutel is de codenaam en de lus loopt
     over de zaken, dus hier hoort geen zaakcode-parameter die je kunt raden. */
  function mijne(db, handle, { limiet = 20 } = {}) {
    const uit = [];
    for (const [zaakcode, doos] of Object.entries(db.data.horeca || {})) {
      for (const r of Object.values(doos.rekeningen || {})) {
        if (!isVan(r, handle) || !KANALEN_BUITEN.includes(r.kanaal)) continue;
        uit.push({ zaakcode, rekeningId: r.id, kanaal: r.kanaal, status: r.status,
          regels: (r.regels || []).length, geopendAt: r.geopendAt,
          bezorg: r.bezorg || null, afhaal: r.afhaal || null,
          /* Hoort deze bestelling bij een foodcourt-mandje? Zonder dit veld kan
             een scherm dat beide lijsten toont ze niet uit elkaar houden, en
             stond dezelfde bestelling er twee keer in -- een keer los en een
             keer als deel van het mandje. In een echte browser gezien. */
          mandjeId: r.mandjeId || null,
          totalen: horeca.totaal(r), openstaand: horeca.openstaand(r) });
      }
    }
    return uit.sort((a, b) => String(b.geopendAt).localeCompare(String(a.geopendAt))).slice(0, limiet);
  }

  return { KANALEN_BUITEN, lopende, zetBezorging, zetAfhaal, zetBezorgkosten, mijne };
};
