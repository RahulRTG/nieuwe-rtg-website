/* RTG Care: een herstel- of verblijfpakket betalen, aan TWEE zaken.

   WAAROM. /api/care/pakket/betaal zette pakket en behandeling op paid zonder
   dat er geld bewoog. Een pakket is een behandeling bij de zorgaanbieder plus
   nachten in een hotel, voor een prijs onder de losse som.

   BESLUIT VAN DE EIGENAAR, 19 oktober 2026 (optie c): de pakketprijs wordt naar
   verhouding van de LOSSE prijzen over beide zaken verdeeld; beide leveren
   evenredig in en RTG legt niets bij. In centen; de zorgaanbieder krijgt zijn
   deel naar beneden afgerond en DE AFRONDING VALT BIJ HET HOTEL, zodat de som
   exact de pakketprijs is. De verdeling wordt bij de eerste betaalpoging op de
   pakketboeking vastgelegd, met de losse prijzen en de verhouding, zodat een
   herhaling dezelfde bedragen gebruikt en het later te reconstrueren is.

   TWEE BOEKINGEN, NIET ATOMAIR. Elk via RTG Pay (pay.betaalZaak) met een eigen
   sleutel: `carepakket:<ref>:zorg` en `:hotel`. Het pakket is pas betaald als
   beide gelukt zijn. Slaagt de eerste en weigert de tweede, dan staat het pakket
   eerlijk op "deels-betaald" en rondt een herhaling het af: dezelfde sleutels,
   dus niets dubbel (test/carepakket.test.js). */
'use strict';

const BESLUIT = 'naar verhouding van de losse prijzen; afronding bij het hotel (besluit eigenaar, 19 oktober 2026)';

module.exports = (ctx) => {
  const { opslag: C, nu, save, notify, aanbiederVan, behandelingVan } = ctx;

  function verdeel(pb, pakket, nachtprijs) {
    const a = aanbiederVan(pakket.aanbiederId);
    const b = behandelingVan(a, pakket.behandelingId);
    const losseZorgCenten = Math.round(Number(b ? b.prijs : 0) * 100);
    const losseHotelCenten = Math.round(Number(pb.nachten) * Number(nachtprijs) * 100);
    const totaalCenten = Math.round(Number(pb.prijs) * 100);
    const som = losseZorgCenten + losseHotelCenten;
    if (!(som > 0) || !(totaalCenten > 0)) return null;
    const zorgCenten = Math.floor(totaalCenten * losseZorgCenten / som);
    return { besluit: BESLUIT, losseZorgCenten, losseHotelCenten, verhouding: losseZorgCenten + ':' + losseHotelCenten,
      totaalCenten, zorgCenten, hotelCenten: totaalCenten - zorgCenten, afronding: 'hotel',
      zorgCode: a && a.supplierCode, hotelCode: pakket.hotelCode, at: nu() };
  }

  async function carePakketBetaal(sess, refIn, verdien, { pakketVan, nachtprijsVan }) {
    const pb = C.kijk('carePakketBoekingen').find(x => x.ref === String(refIn || '') && x.key === sess.key);
    if (!pb) return { status: 404, error: 'Pakketboeking niet gevonden.' };
    if (pb.paid) return { status: 409, error: 'Al betaald.' };
    if (!pb.verdeling && Date.now() - Date.parse(pb.at) > 30 * 60000) return { status: 410, error: 'Deze boeking is verlopen. Boek opnieuw.' };
    if (typeof ctx.betaalZaak !== 'function') return { status: 503, error: 'RTG Pay is niet aangesloten; er is niets afgeschreven.' };
    const p = pakketVan(pb.pakketId);
    if (!pb.verdeling) {
      const v = p && verdeel(pb, p, nachtprijsVan(pb.hotelCode));
      if (!v || !v.zorgCode || !v.hotelCode) return { status: 409, error: 'Dit pakket kan nog geen betaling ontvangen. Er is niets afgeschreven.' };
      pb.verdeling = v;
      save();
    }
    const v = pb.verdeling;
    const oms = 'Pakket ' + pb.naam;
    const deel = (wie, code, centen) => ctx.betaalZaak({ codenaam: pb.codenaam, supplierCode: code, centen, soort: 'zorg',
      oms: oms + (wie === 'zorg' ? ' (behandeling)' : ' (verblijf)'), ref: pb.ref, idem: 'carepakket:' + pb.ref + ':' + wie });
    const zorg = await deel('zorg', v.zorgCode, v.zorgCenten);
    if (zorg.error) return zorg;
    pb.betalingen = Object.assign({}, pb.betalingen, { zorg: { boeking: zorg.boeking || null, centen: v.zorgCenten } });
    const hotel = v.hotelCenten > 0 ? await deel('hotel', v.hotelCode, v.hotelCenten) : { ok: true, betaaldCenten: 0 };
    if (hotel.error) {
      if (!pb.paid) { pb.status = 'deels-betaald'; save(); }
      return { status: hotel.status || 402, error: 'Het pakket is deels betaald: de behandeling is voldaan, het verblijf nog niet. ' +
        hotel.error + ' Probeer het opnieuw; er wordt niets dubbel betaald.', deels: true };
    }
    if (pb.paid) return { ok: true, herhaald: true, pakket: pb }; // een gelijktijdige tik was eerst
    pb.betalingen.hotel = { boeking: hotel.boeking || null, centen: v.hotelCenten };
    const bk = C.kijk('careBoekingen').find(x => x.ref === pb.careRef && x.key === sess.key);
    if (bk && !bk.paid) { bk.paid = true; bk.paidAt = nu(); bk.status = 'geboekt'; }
    pb.paid = true; pb.paidAt = nu(); pb.status = 'geboekt';
    save();
    if (typeof verdien === 'function') { try { verdien(sess.key, pb.prijs, pb.naam); } catch (e) {} }
    notify(sess.key, { icon: 'oogst', title: 'Pakket geboekt: ' + pb.naam, body: pb.nachten + ' nachten bij ' + pb.hotelNaam + ' + behandeling op ' + pb.datum + ' om ' + pb.tijd + '.', scope: 'care' });
    return { ok: true, pakket: pb };
  }

  return { carePakketBetaal, verdeel };
};
