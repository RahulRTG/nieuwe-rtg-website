/* RTG Pay, deelbestand "verzoeken": geld sturen, de Klompjes (goudklompjes, het
   RTG-eigen betaalverzoek), de tik (vrienden betalen elkaar met een aanraking) en
   het overzicht voor het lid. EEN knop overal: is er te weinig saldo, dan laadt de
   wallet zelf bij (autolaad in de kern) en betaalt door. Krijgt de gedeelde ctx van
   kern/pay/index.js. */
module.exports = (ctx) => {
  const { crypto, save, schoon, nu, d, klompjes, tikcodes, grootboek, rekLid, saldoVan,
    id, metIdem, boek, zorgSaldo, seintje, bestaatLid, MIN_CENTEN, MAX_CENTEN, KASCODE_MS } = ctx;

  /* ---------- geld sturen en Klompjes ---------- */
  async function stuur({ van, aanCodenaam, centen, oms, idem, soort }) {
    const aan = schoon(aanCodenaam, 40);
    if (!aan || aan === van) return { status: 400, error: 'Kies aan wie je het stuurt.' };
    if (!(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    return metIdem(idem ? 'stuur:' + van + ':' + idem : null, async () => {
      const z = await zorgSaldo({ codenaam: van, centen, idem });
      if (z.error) return z;
      const b = boek({ van: rekLid(van), naar: rekLid(aan), centen, soort: soort || 'p2p', oms: oms || 'Zomaar' });
      if (b.error) return b;
      seintje(aan);
      return { ok: true, saldo: saldoVan(rekLid(van)), bijgeladen: z.bijgeladen, boeking: b.boeking.id };
    });
  }
  /* Een Klompje (goudklompje, het RTG-eigen betaalverzoek): vraag een bedrag aan een of meer vrienden. Met splitsMetMij
     deelt het totaal door de hele groep inclusief jezelf (jouw deel heb je
     immers al betaald aan de zaak); anders krijgt ieder het hele bedrag. */
  async function verzoekMaak({ van, aan, totaalCenten, perCenten, oms, splitsMetMij }) {
    const namen = [...new Set((Array.isArray(aan) ? aan : [aan]).map(x => schoon(x, 40)).filter(x => x && x !== van))].slice(0, 10);
    if (!namen.length) return { status: 400, error: 'Kies minstens een vriend.' };
    for (const n of namen) if (!(await bestaatLid(n))) return { status: 404, error: 'Codenaam ' + n + ' kennen we niet.' };
    let per = Math.round(Number(perCenten));
    if (!Number.isFinite(per) || per <= 0) {
      const totaal = Math.round(Number(totaalCenten));
      if (!Number.isFinite(totaal) || totaal <= 0) return { status: 400, error: 'Vul een bedrag in.' };
      per = Math.floor(totaal / (namen.length + (splitsMetMij ? 1 : 0)));
    }
    if (per < MIN_CENTEN || per > MAX_CENTEN) return { status: 400, error: 'Dat bedrag per persoon kan niet.' };
    const groep = id('TG');
    const uit = namen.map(n => ({
      id: id('TK'), groep, van, aan: n, centen: per,
      oms: schoon(oms, 80) || 'Klompje', status: 'open', at: nu()
    }));
    klompjes().unshift(...uit);
    if (klompjes().length > 5000) klompjes().length = 5000;
    save();
    for (const n of namen) seintje(n);
    return { ok: true, verzoeken: uit, perPersoon: per };
  }
  function verzoekenVoor(codenaam) {
    const alle = klompjes();
    return {
      aanMij: alle.filter(v => v.aan === codenaam && v.status === 'open').slice(0, 20),
      vanMij: alle.filter(v => v.van === codenaam).slice(0, 20)
    };
  }
  // EEN knop: het Klompje betalen (met autolaad als het saldo tekortschiet)
  async function verzoekBetaal({ codenaam, verzoekId, idem }) {
    const v = klompjes().find(x => x.id === verzoekId && x.aan === codenaam);
    if (!v) return { status: 404, error: 'Dit verzoek staat niet voor jou open.' };
    if (v.status !== 'open') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
    return metIdem(idem ? 'klompje:' + codenaam + ':' + idem : null, async () => {
      const z = await zorgSaldo({ codenaam, centen: v.centen, idem });
      if (z.error) return z;
      const b = boek({ van: rekLid(codenaam), naar: rekLid(v.van), centen: v.centen, soort: 'klompje', oms: v.oms, ref: v.id });
      if (b.error) return b;
      v.status = 'betaald';
      v.betaaldAt = nu();
      save();
      seintje(v.van);
      return { ok: true, saldo: saldoVan(rekLid(codenaam)), bijgeladen: z.bijgeladen };
    });
  }
  function verzoekIntrek({ codenaam, verzoekId }) {
    const v = klompjes().find(x => x.id === verzoekId && x.van === codenaam);
    if (!v) return { status: 404, error: 'Dit verzoek is niet van jou.' };
    if (v.status !== 'open') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
    v.status = 'ingetrokken';
    save();
    return { ok: true };
  }

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

  /* ---------- het overzicht voor het lid (alles in een scherm) ---------- */
  function overzicht(codenaam) {
    const rek = rekLid(codenaam);
    const rijen = grootboek().filter(r => r.van === rek || r.naar === rek).slice(0, 30).map(r => ({
      id: r.id, at: r.at, oms: r.oms, soort: r.soort,
      centen: r.naar === rek ? r.centen : -r.centen,
      tegen: (r.naar === rek ? r.van : r.naar).replace(/^lid:/, '').replace(/^partner:/, 'zaak ').replace(/^extern:oplaad$/, 'opgeladen').replace(/^extern:uitbetaald$/, 'bank')
    }));
    const v = verzoekenVoor(codenaam);
    return { ok: true, codenaam, saldo: saldoVan(rek), geschiedenis: rijen, aanMij: v.aanMij, vanMij: v.vanMij };
  }

  return { stuur, verzoekMaak, verzoekenVoor, verzoekBetaal, verzoekIntrek, tikCode, tikBetaal, tikFeed, overzicht };
};
