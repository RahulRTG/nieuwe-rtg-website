/* ============================================================================
   HET PERIODIEKE ANKER -- de kop van het auditspoor verlaat het huis uit
   zichzelf (audit A-P1-05).

   WAAROM. De ankerpost bracht het blok alleen weg als een kantoormens op de knop
   drukte. Een kopafknipping van het spoor is dus pas zichtbaar als iemand
   eraan dacht te ankeren, en dat is niet een bewijs maar een gewoonte. Deze
   timer roept dezelfde `ankerpost.post()` periodiek aan: het blok gaat naar de
   tweede machine buiten de primaire opslag (zie ankerpost.js punt 1-5 voor wat
   dat wel en niet bewijst).

   WAT HIJ NIET DOET. Hij start niet zonder geldige bestemming (geen
   RTG_ANKERPOST_URL = niet in bedrijf, en dat blijft zo klinken), hij blokkeert
   het opstarten nooit, en een mislukte ronde is een STAND (`laatste.ok=false`
   met reden) en nooit stilte. `stand()` zegt ook hoe oud de laatste geslaagde
   ronde is, zodat "ooit eens gelukt" niet voor "vers" doorgaat.
   Interval: RTG_ANKERPOST_MINUTEN (standaard 15, minimaal 1).
   ========================================================================== */
'use strict';

const klok = require('./klok');

const staat = { laatste: null, laatsteGeslaagd: null, rondes: 0, minuten: null, actief: false };

async function eenRonde(ankerpost, log) {
  staat.rondes++;
  let uit;
  try { uit = await ankerpost.post(); }
  catch (e) { uit = { ok: false, reden: 'de ankerpost gooide: ' + (e && e.message || e) }; }
  const at = new Date(klok.nu()).toISOString();
  staat.laatste = { at, ok: !!uit.ok, inBedrijf: uit.inBedrijf !== false, reden: uit.ok ? null : (uit.reden || 'onbekend') };
  if (uit.ok) staat.laatsteGeslaagd = at;
  else if (log && log.warn) log.warn('[anker] periodieke post mislukt: ' + staat.laatste.reden);
  return staat.laatste;
}

function start({ ankerpost, log, omgeving, zet } = {}) {
  const env = omgeving || process.env;
  if (!env.RTG_ANKERPOST_URL) return { gestart: false, reden: 'geen RTG_ANKERPOST_URL; niet in bedrijf' };
  const minuten = Math.max(1, Number(env.RTG_ANKERPOST_MINUTEN || 15) || 15);
  staat.minuten = minuten; staat.actief = true;
  const t = (zet || setInterval)(() => { eenRonde(ankerpost, log); }, minuten * 60 * 1000);
  if (t && t.unref) t.unref();
  return { gestart: true, minuten };
}

function stand() {
  const oud = staat.laatsteGeslaagd ? Math.round((klok.nu() - new Date(staat.laatsteGeslaagd).getTime()) / 60000) : null;
  return Object.assign({}, staat, { minutenSindsGeslaagd: oud,
    verouderd: staat.actief && staat.minuten ? (oud === null || oud > staat.minuten * 3) : null });
}

module.exports = { start, eenRonde, stand };
