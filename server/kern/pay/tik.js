/* RTG Pay, deelbestand "de tik": vrienden betalen elkaar met een aanraking.

   De ontvanger zet zijn toestel op ontvangen (tikcode); de betaler houdt zijn
   telefoon ertegen en betaalt met een knop.

   DE CODE WIJST ALLEEN DE ONTVANGER AAN, en daarom mag een tik binnen zijn vijf
   minuten door een hele tafel gebruikt worden: wie hem afkijkt, kan de eigenaar
   hooguit betalen. Maar het blijft een code in een geldpad, en sinds 27
   september 2026 volgt hij het releasebeleid (CODECREDENTIALS.json, deur
   pay.tikcode): 128 bits, hash-only in `payTikToegang` (./kasbak.js), een keer
   getoond, vijf minuten geldig, door de eigenaar in te trekken, en een
   gebruiksteller met een plafond (TAFEL). Elk gebruik wordt geclaimd in de
   collectietransactie; een herhaling van dezelfde betaler met dezelfde
   idem-sleutel telt niet nog eens. Een geweigerde betaling geeft zijn gebruik
   terug. Een nieuwe tik trekt de vorige van dezelfde codenaam in.

   Het betalen zelf loopt via dezelfde `stuur` als elk ander bedrag tussen
   leden -- er is maar een plek waar geld beweegt. */
'use strict';

const TAFEL = 25;

module.exports = ({ crypto, save, nu, d, bewerkCollectie, grootboek, rekLid, KASCODE_MS, stuur }) => {
  const bak = require('./kasbak')({ d, save, crypto, nu, bewerkCollectie, COL: 'payTikToegang', oud: 'payTikCodes',
    namespace: 'pay.tikcode', prefix: 'TK', issuer: 'rtg.lid.tik', doel: 'pay-tik',
    scope: ['p2p.ontvangen'], geldigMs: KASCODE_MS, maxGebruik: TAFEL });
  const NIET = { status: 404, error: 'Deze tik is niet (meer) geldig; laat je vriend opnieuw op ontvangen zetten.' };

  const tikCode = ({ codenaam, idem }) => bak.uitgeven({ codenaam, idem });
  const tikIntrek = ({ codenaam }) => bak.intrekken({ codenaam });

  async function tikBetaal({ van, code, centen, oms, idem }) {
    if (!idem) return { status: 400, code: 'IDEMPOTENTIESLEUTEL_VERPLICHT',
      error: 'Deze opdracht verplaatst geld en vraagt een idempotentiesleutel. Stuur een `idem` mee en gebruik bij een herhaling dezelfde waarde.',
      waarom: 'betaalt een bedrag aan een ander lid' };
    const spoor = bak.afdruk('tik-gebruik|' + van + '|' + idem);
    const s = await bak.transactie(bron => {
      const r = bak.zoek(bron, code);
      if (!r) return { fout: NIET };
      if (r.codenaam === van) return { fout: { status: 400, error: 'Dit is je eigen tik.' } };
      r.gebruiken = Array.isArray(r.gebruiken) ? r.gebruiken : [];
      const reden = bak.reden(r);
      if (r.gebruiken.includes(spoor) && reden !== 'ingetrokken') return { aan: r.codenaam, id: r.id };
      if (reden === 'opgebruikt') return { fout: { status: 409, error: 'Deze tik is vol; laat je vriend een nieuwe maken.' } };
      if (reden || r.stand !== 'open') return { fout: NIET };
      bak.bearer.gebruik(r.toegang);
      r.gebruiken.push(spoor);
      r.bijgewerkt_at = bak.iso();
      return { aan: r.codenaam, id: r.id, nieuw: true };
    });
    if (s.fout) return s.fout;
    const u = await stuur({ van, aanCodenaam: s.aan, centen, oms: oms || 'Tik', idem: 'tik:' + idem, soort: 'tik' });
    if (u && u.error && s.nieuw && u.status >= 400 && u.status < 500) {
      await bak.transactie(bron => {
        const r = bron[s.id];
        const i = r && Array.isArray(r.gebruiken) ? r.gebruiken.indexOf(spoor) : -1;
        if (i >= 0) { r.gebruiken.splice(i, 1); r.toegang.gebruik = Math.max(0, r.toegang.gebruik - 1); }
      });
    }
    return u.error ? u : Object.assign({ aan: s.aan }, u);
  }
  // de tikgeschiedenis: wie tikte wie, als klein sociaal logboek in de app
  function tikFeed(codenaam) {
    const rek = rekLid(codenaam);
    const rijen = grootboek().filter(r => r.soort === 'tik' && (r.van === rek || r.naar === rek)).slice(0, 20).map(r => ({
      id: r.id, at: r.at, oms: r.oms, centen: r.centen,
      richting: r.van === rek ? 'uit' : 'in',
      met: (r.van === rek ? r.naar : r.van).replace(/^lid:/, '')
    }));
    return { ok: true, tiks: rijen };
  }

  return { tikCode, tikIntrek, tikBetaal, tikFeed };
};

module.exports.TAFEL = TAFEL;
