/* RTG Pay, deelbestand "de tik": vrienden betalen elkaar met een aanraking.

   De ontvanger zet zijn toestel op ontvangen (tikcode); de betaler houdt zijn
   telefoon ertegen en betaalt met een knop.

   DE CODE WIJST ALLEEN DE ONTVANGER AAN, en dat is de reden dat dit veilig kan.
   Er kan enkel geld NAAR de eigenaar toe -- nooit ervandaan. Daarom mag een tik
   binnen zijn vijf minuten door een hele tafel gebruikt worden: wie hem
   afkijkt, kan de eigenaar hooguit betalen. Een code die ook geld kon ophalen
   zou per persoon en per bedrag moeten, en dan is het geen tik meer.

   Een nieuwe tik zet de vorige van dezelfde codenaam meteen op verlopen: twee
   geldige codes voor een mens is een code te veel.

   Apart van ./verzoeken.js omdat dat over VRAGEN gaat (een verzoek dat blijft
   staan tot iemand betaalt) en dit over een moment tussen twee mensen die naast
   elkaar staan. Het betalen zelf loopt via dezelfde `stuur` -- er is maar een
   plek waar geld beweegt. */
'use strict';

module.exports = ({ crypto, save, nu, tikcodes, grootboek, rekLid, KASCODE_MS, stuur }) => {

  /* ---------- de tik: vrienden betalen elkaar met een aanraking ----------
     De ontvanger zet zijn toestel op ontvangen (tikcode); de betaler houdt
     zijn telefoon ertegen en betaalt met een knop. De code wijst alleen de
     ONTVANGER aan; er kan dus enkel geld naar de eigenaar toe, en daarom mag
     hij binnen zijn vijf minuten door een hele tafel gebruikt worden. */
  function tikCode({ codenaam }) {
    for (const k of tikcodes()) if (k.codenaam === codenaam) k.geldigTot = 0;
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    tikcodes().unshift({ code, codenaam, geldigTot: nu() + KASCODE_MS, at: nu() });
    if (tikcodes().length > 2000) tikcodes().length = 2000;
    save();
    return { ok: true, code, geldigTot: nu() + KASCODE_MS };
  }
  async function tikBetaal({ van, code, centen, oms, idem }) {
    const k = tikcodes().find(x => x.code === String(code || '').toUpperCase().trim());
    if (!k || k.geldigTot < nu()) return { status: 404, error: 'Deze tik is niet (meer) geldig; laat je vriend opnieuw op ontvangen zetten.' };
    if (k.codenaam === van) return { status: 400, error: 'Dit is je eigen tik.' };
    const r = await stuur({ van, aanCodenaam: k.codenaam, centen, oms: oms || 'Tik', idem: idem ? 'tik:' + idem : undefined, soort: 'tik' });
    return r.error ? r : Object.assign({ aan: k.codenaam }, r);
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

  return { tikCode, tikBetaal, tikFeed };
};
