/* ============================================================================
   ECHT GELD BIJ CARE -- de opzet die de zorgscenario's van FoundationOS delen
   (scripts/lib/voltooi/foundationzorg.js en tabzorg.js).

   /api/care/betaal betaalt via RTG Pay (pay.betaalZaak) aan de zaak van de
   aanbieder; een tekort laadt de wallet bij via de betaalwaarheid, met de
   sleutel 'care:<ref>:autolaad' (kern/pay/opladen.js, zorgSaldo). In de wereld
   draait de simulatiebank (server/betaal/synthetisch.js, RTG_SIMULATIEBANK=1),
   en die kiest de afloop UIT DE SLEUTEL. Twee dingen volgen daaruit:

   1. De wallet wordt VOORAF gevuld met een sleutel die "betaald" geeft
      (dezelfde afleiding als ./voltooi/geven.js), zodat geen betaling op een
      willekeurige bijlading leunt.
   2. Een WEIGERING is reproduceerbaar: voor een lid met een lege wallet kiest
      de proef een boeking waarvan de bijlading volgens de bank niet doorgaat
      (geweigerd of blijft hangen), en meet dan wat het lid ziet.

   Wat er van de wallet ging, leest de proef over /api/pay/overzicht: de regels
   met soort 'zorg' (of 'Pakket ...' bij een pakket). Dat overzicht vraagt een
   gebonden toestel (voltooiwereld.gebondenToestel).
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const simulatiebank = require('../../server/betaal/synthetisch');

const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const OVERZICHT = '/api/pay/overzicht';

/* De afloop die de simulatiebank kiest voor een oplading van `codenaam` met
   herhaalsleutel `idem` (kern/pay/opladen.js: de waarheid heet
   BW-<sha256 van actor|idem>). */
function afloop(codenaam, idem) {
  const id = 'BW-' + crypto.createHash('sha256').update('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + idem).digest('hex').slice(0, 20).toUpperCase();
  return bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id });
}

function betaaldeSleutel(codenaam, voorvoegsel) {
  for (let i = 0; i < 10000; i++) {
    const idem = (voorvoegsel || 'voltooi-zorg-oplaad-') + i;
    if (afloop(codenaam, idem) === 'betaald') return idem;
  }
  throw new Error('geen herhaalsleutel gevonden die "betaald" geeft');
}

/* De afloop van de automatische bijlading bij het betalen van boeking `ref`. */
const autolaadAfloop = (codenaam, ref) => afloop(codenaam, 'care:' + ref + ':autolaad');

/* Een losse zorgbetaling; een pakket betaalt ook als 'zorg', maar met
   'Pakket <naam>' ervoor (kern/care/pakketbetaal.js). */
const losseZorg = (g) => g.soort === 'zorg' && !/^Pakket /.test(g.oms || '');
const pakketRegel = (g) => g.soort === 'zorg' && /^Pakket /.test(g.oms || '');

/* Een geldlezer voor een lid: overzicht, en de regels die bij zorg horen. */
function geldVan(w, toestelVan, tokVan) {
  const overzicht = async () => ((await w.post(OVERZICHT, {}, tokVan(), await toestelVan().bewijs('POST', OVERZICHT))).data) || {};
  const regels = async (wat) => ((await overzicht()).geschiedenis || []).filter(wat || losseZorg);
  return { overzicht, regels };
}

async function vulWallet(w, tok, toestel, codenaam, centen) {
  const r = await w.post('/api/pay/oplaad', { centen, idem: betaaldeSleutel(codenaam) }, tok, await toestel.bewijs('POST', '/api/pay/oplaad'));
  if (r.status !== 200) throw new Error('de wallet vullen lukte niet (' + r.status + ': ' + (r.data && r.data.error) + ')');
  return r;
}

module.exports = { losseZorg, pakketRegel, afloop, betaaldeSleutel, autolaadAfloop, geldVan, vulWallet, OVERZICHT };
