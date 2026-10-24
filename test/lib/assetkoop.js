/* Een gekocht asset-ticket langs de ENIGE weg die er is (eigenaarsbesluit 19
   oktober 2026, server/kern/assets/aanvraag.js): het lid vraagt aan, een mens
   van RTG op naam keurt, het lid betaalt met een bevestigde betaling. Voor
   toetsen die een ticket nodig hebben om iets anders te bewijzen; de weg zelf
   wordt bewezen in test/assets.test.js. Vraagt een server met
   RTG_SIMULATIEBANK=1 en een demosessie, waarvan de sleutel de pas is. */
'use strict';
const crypto = require('crypto');
const bank = require('../../server/betaal/synthetisch')({ crypto, env: {}, echteRail: null });
const sha = v => crypto.createHash('sha256').update(String(v)).digest('hex');

/* Een betaalpoging-sleutel waarvoor de simulatiebank deze afloop kiest. De
   betaling heet BW- + sha(actor|idem) (kern/betaalwaarheid/index.js), en de
   sleutel is uniek per aanvraag, zoals de RTGId van het scherm. */
function poging(pas, aanvraagId, afloop) {
  for (let i = 0; i < 5000; i++) {
    const sleutel = aanvraagId + '-' + i;
    const id = 'BW-' + sha('asset:' + pas + '|asset-koop:' + aanvraagId + ':' + sleutel).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === afloop) return sleutel;
  }
  throw new Error('geen sleutel voor ' + afloop);
}

/* Wat de simulatiebank met de herroeping van dit ticket doet. Volgt uit de
   betaling (de poging hierboven) en het ticket, zoals kern/betaalwaarheid/terug.js
   en server/betaal/synthetisch-naslag.js het rekenen: een toets kiest zo een
   ticket waarvan de terugbetaling blijft lopen, in plaats van op de spreiding te gokken. */
function terugAfloop(pas, aanvraagId, ticketId) {
  const betaling = 'BW-' + sha('asset:' + pas + '|asset-koop:' + aanvraagId + ':' + poging(pas, aanvraagId, 'betaald')).slice(0, 20).toUpperCase();
  const sleutel = 'terug:' + betaling + ':' + sha('idem:' + sha('herroep-' + ticketId)).slice(0, 24);
  return bank.scenarioVan({ idempotentieSleutel: 'terug|' + sleutel });
}

let volg = 0;
async function gekocht(api, { token, pas, opNaam, body }) {
  const a = await api('asset/koop', Object.assign({ idem: 'koop-' + process.pid + '-' + (++volg) }, body), token);
  if (a.status !== 200) return a;
  const id = a.body.aanvraag.id;
  const b = await api('office/asset/aanvraag/beslis', { id, besluit: 'goedgekeurd' }, opNaam);
  if (b.status !== 200) throw new Error('het kantoor keurde niet (' + b.status + ')');
  const p = await api('asset/aanvraag/betaal', { id, idem: poging(pas, id, 'betaald') }, token);
  if (p.status !== 200) throw new Error('de betaling gaf ' + p.status + ': ' + JSON.stringify(p.body));
  return { status: 200, body: { aanvraag: p.body.aanvraag, ticketIds: p.body.aanvraag.ticketIds, totaal: p.body.aanvraag.totaal } };
}

module.exports = { gekocht, poging, terugAfloop };
