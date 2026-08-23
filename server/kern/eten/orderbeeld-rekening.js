/* Projectie van de bestaande horecarekening naar de gedeelde RTG Eten-order. */
'use strict';
const b = require('./orderbeeld-basis');
const capaciteit = require('./capaciteit');
const klok = require('../../lib/klok');

module.exports = function projecteerRekening({ zaakcode, zaak, rekening, horecaDoos, nuMs = klok.nu() }) {
  const rek = rekening, regels = rek.regels || [], t = b.totalen(rek);
  const productie = b.productieVan(regels);
  const assen = { acceptatie:b.acceptatieVan(rek, regels), productie,
    fulfillment:b.fulfillmentVan(rek, productie), betaling:b.betalingVan(rek, t),
    incident:b.incidentVan(rek, regels) };
  const fase = b.hoofdfase(assen), tekst = b.FASE_TEKST[fase] || b.FASE_TEKST.ontvangen;
  const minutenKeuken = b.resterendeMinuten(horecaDoos || {}, regels, zaak && zaak.menu);
  const extra = capaciteit.bereken(horecaDoos || {}).extraMinuten;
  const rit = rek.kanaal === 'bezorging' ? Number(rek.bezorg && rek.bezorg.zone && rek.bezorg.zone.minuten) || 0 : 0;
  const etaMinuten = ['geleverd','opgehaald'].includes(assen.fulfillment) ? 0
    : assen.fulfillment === 'onderweg' && rek.fulfillment && Number.isFinite(Number(rek.fulfillment.etaMinuten))
      ? Number(rek.fulfillment.etaMinuten) : minutenKeuken + extra + rit;
  const klant = (rek.deelnemers || [])[0];
  return {
    id:'eten:' + zaakcode + ':' + rek.id, bron:'horecarekening', rekeningId:rek.id,
    zaak:{ code:zaakcode, naam:zaak ? zaak.name : zaakcode },
    klant:{ codenaam:(klant && klant.handle) || rek.gastId || rek.naam || 'Gast' },
    locatie:rek.kanaal === 'bezorging' ? { adres:rek.bezorg && rek.bezorg.adres,
      postcode:rek.bezorg && rek.bezorg.postcode, zone:rek.bezorg && rek.bezorg.zone } : null,
    kanaal:rek.kanaal, code:rek.afhaal && rek.afhaal.code || null, aangemaaktAt:rek.geopendAt || rek.at,
    gewenstAt:(rek.bezorg && rek.bezorg.tijd) || (rek.afhaal && rek.afhaal.tijd) || null,
    producten:regels.filter(r => !r.bezorgkosten).map(r => ({
      id:r.id, itemId:r.itemId || null, naam:r.naam, aantal:r.aantal, centen:r.centen,
      prijsversie:r.prijsversie || (rek.prijsversie && rek.prijsversie.id) || null,
      opties:Array.isArray(r.opties) ? r.opties : [], ingredienten:Array.isArray(r.ingredienten) ? r.ingredienten : [],
      allergenen:Array.isArray(r.allergenen) ? r.allergenen : [], allergie:r.allergie || null,
      notitie:r.notitie || null, station:r.station || 'keuken', stand:r.stand,
      besteldAt:r.at, startAt:r.startAt || null, klaarAt:r.klaarAt || null, uitAt:r.uitAt || null
    })),
    prijs:{ versie:rek.prijsversie || null, ...t }, betaling:{ status:assen.betaling, voorkeur:rek.betaalVoorkeur || null },
    fulfillment:{ status:assen.fulfillment, bezorg:rek.bezorg || null, afhaal:rek.afhaal || null,
      bezorger:rek.fulfillment && rek.fulfillment.bezorger || null },
    statussen:assen, fase, status:{ sleutel:fase, label:tekst[0], uitleg:tekst[1],
      voortgang:{ ontvangen:12, bevestigd:25, keuken:48, 'bijna-klaar':66, klaar:78, onderweg:90, geleverd:100, geannuleerd:100 }[fase] || 12 },
    eta:{ minuten:etaMinuten, verwachtAt:verwachtAt(nuMs, etaMinuten),
      keukenMinuten:minutenKeuken, ritMinuten:rit,
      uitleg:etaMinuten ? minutenKeuken + ' min keuken' + (rit ? ' + ' + rit + ' min rit' : '') + (extra ? ' + ' + extra + ' min capaciteitsmarge' : '') : 'Afgerond' },
    tijdlijn:b.tijdlijnVan(rek, assen, fase), allergieControle:regels.some(r => r.bevestiging === 'wacht'),
    wijzigingen:(rek.audit || []).slice(-60),
    acties:{ opnieuw:true, probleem:fase !== 'geannuleerd', beoordelen:fase === 'geleverd', factuur:t.betaald > 0 },
    _rekening:rek
  };
};

function verwachtAt(nuMs, minuten) {
  const datum = klok.datum();
  datum.setTime(nuMs + minuten * 60000);
  return datum.toISOString();
}
