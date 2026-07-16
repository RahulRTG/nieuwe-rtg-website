/* RTG Pay: de interne betaallaag van het hele huis. Een wallet per lid, een
   grootboek dat elke cent dubbel boekt, en alles frictieloos: EEN knop.

   De regels van het grootboek (dit is de kern van elk betaalbedrijf):
   - Elke beweging is een boeking VAN een rekening NAAR een rekening. Geld
     ontstaat nooit uit het niets: opladen komt van 'extern:oplaad' (daar
     staat de echte kaartbetaling via de betaal-naad tegenover), uitbetalen
     gaat naar 'extern:uitbetaald' (daar staat een echte payout tegenover).
   - De som van ALLE saldi is altijd exact nul (dubbel boekhouden). De
     sluitcontrole bewaakt dat, en /api/pay/gezond meldt het aan de bewaking.
   - Leden- en partnerrekeningen kunnen nooit onder nul; alleen de
     extern-rekeningen mogen negatief staan (dat IS de belofte van de bank).

   Frictieloos, EEN knop:
   - Betalen met te weinig saldo? De wallet laadt zelf bij (in stappen van
     tien euro) via de betaal-naad (Apple Pay/kaart) en betaalt door. Het lid
     tikt een keer, klaar.
   - Een Klompje betalen is een knop: bedrag, autolaad, boeken, melding terug.
   - De kassacode is vooraf-akkoord tot een maximum (zoals contactloos): het
     lid toont de code, de zaak int, niemand wacht.

   Identiteit: de wallet hangt aan de codenaam (dezelfde sociale identiteit
   als de vriendenlaag en de chats, over RTG en RTF heen). In productie hangt
   hij aan het account-id en is de codenaam alleen het adres.

   In productie wordt het saldo aangehouden bij de betaalpartner (Stripe
   Connect / Adyen for Platforms): zij houden het geld, dit grootboek blijft
   de waarheid over wie wat heeft. De naad (server/betaal.js) is er al. */

module.exports = ({ db, save, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon }) => {
  const nu = () => Date.now();
  const d = () => db.data;

  const MIN_CENTEN = 1;              // vanaf 1 cent (een rondje delen mag klein zijn)
  const MAX_CENTEN = 500000;         // tot 5000 euro per boeking
  const OPLAAD_MIN = 100;            // opladen vanaf 1 euro
  const AUTOLAAD_STAP = 1000;        // zelf bijladen in stappen van 10 euro
  const KASCODE_MS = 5 * 60 * 1000;  // een kassacode leeft vijf minuten
  const KASCODE_MAX = 50000;         // standaardplafond kassacode: 500 euro

  function saldi() { if (!d().paySaldi || typeof d().paySaldi !== 'object') d().paySaldi = {}; return d().paySaldi; }
  function grootboek() { if (!Array.isArray(d().payBoekingen)) d().payBoekingen = []; return d().payBoekingen; }
  function klompjes() { if (!Array.isArray(d().payVerzoeken)) d().payVerzoeken = []; return d().payVerzoeken; }
  function kascodes() { if (!Array.isArray(d().payCodes)) d().payCodes = []; return d().payCodes; }

  const rekLid = c => 'lid:' + c;
  const rekPartner = c => 'partner:' + c;
  const saldoVan = rek => Math.round(saldi()[rek] || 0);
  const id = p => (p || 'P') + crypto.randomBytes(5).toString('hex').toUpperCase();

  /* Idempotentie die een herstart overleeft: dezelfde knop twee keer indrukken
     (dubbeltik, haperend netwerk, retry) geeft exact hetzelfde antwoord en
     boekt nooit dubbel. */
  function idemStore() {
    if (!d().payIdem || typeof d().payIdem !== 'object') d().payIdem = { _keys: [] };
    if (!Array.isArray(d().payIdem._keys)) d().payIdem._keys = [];
    return d().payIdem;
  }
  async function metIdem(sleutel, werk) {
    if (!sleutel) return werk();
    const s = idemStore();
    if (sleutel in s && sleutel !== '_keys') return Object.assign({}, s[sleutel], { herhaald: true });
    const r = await werk();
    if (r && r.ok) {
      s._keys.push(sleutel);
      if (s._keys.length > 20000) for (const weg of s._keys.splice(0, s._keys.length - 20000)) delete s[weg];
      s[sleutel] = r;
      save();
    }
    return r;
  }

  /* ---------- het grootboek zelf ---------- */
  function boek({ van, naar, centen, soort, oms, ref }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!van.startsWith('extern:') && saldoVan(van) < c) return { status: 402, error: 'Onvoldoende saldo.' };
    saldi()[van] = saldoVan(van) - c;
    saldi()[naar] = saldoVan(naar) + c;
    const rij = { id: id('PB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 120), ref: ref || null, at: nu() };
    grootboek().unshift(rij);
    if (grootboek().length > 50000) grootboek().pop(); // weergavecap; de saldi blijven de waarheid
    save();
    return { ok: true, boeking: rij };
  }
  // de sluitcontrole: som van alle saldi is nul, en niemand staat rood
  function sluitcontrole() {
    let som = 0;
    const rood = [];
    for (const [rek, c] of Object.entries(saldi())) {
      som += c;
      if (!rek.startsWith('extern:') && c < 0) rood.push(rek);
    }
    return { klopt: som === 0 && !rood.length, som, rood };
  }

  // een zachte melding naar het lid (best effort; de app pollt sowieso)
  function seintje(codenaam) {
    try {
      Promise.resolve(keyVanCodenaam(codenaam))
        .then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'pay' }); })
        .catch(() => {});
    } catch (e) {}
  }

  /* ---------- opladen (Apple Pay / kaart via de betaal-naad) ---------- */
  async function laadOp({ codenaam, centen, idem, oms }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < OPLAAD_MIN || c > MAX_CENTEN) return { status: 400, error: 'Opladen kan van 1 tot 5000 euro.' };
    return metIdem(idem ? 'oplaad:' + codenaam + ':' + idem : null, async () => {
      let betaling;
      try {
        betaling = await betaal.maakBetaling({
          bedrag: c, referentie: 'pay-oplaad-' + codenaam + '-' + nu(),
          idempotentieSleutel: idem ? 'pay-oplaad:' + codenaam + ':' + idem : undefined,
          omschrijving: oms || 'RTG Pay opladen'
        });
      } catch (e) { return { status: 502, error: 'De betaling lukte niet: ' + e.message }; }
      if (betaling.status !== 'betaald' && betaling.status !== 'succeeded') {
        // bij een echte aanbieder rondt de klant het af (Apple Pay-sheet); de
        // webhook crediteert daarna. In de demo is hij altijd meteen betaald.
        return { status: 402, error: 'De betaling wacht op bevestiging.', betaalStatus: betaling.status };
      }
      const b = boek({ van: 'extern:oplaad', naar: rekLid(codenaam), centen: c, soort: 'oplaad', oms: oms || 'Opladen', ref: betaling.id });
      if (b.error) return b;
      return { ok: true, saldo: saldoVan(rekLid(codenaam)), geladen: c };
    });
  }
  /* Het hart van "EEN knop": is er te weinig saldo, dan laadt de wallet zelf
     bij (afgerond op tientjes) en betaalt door. Het lid merkt er niets van
     behalve een regel "10 euro bijgeladen" in het overzicht. */
  async function zorgSaldo({ codenaam, centen, idem }) {
    const tekort = Math.round(centen) - saldoVan(rekLid(codenaam));
    if (tekort <= 0) return { ok: true, bijgeladen: 0 };
    const stap = Math.ceil(tekort / AUTOLAAD_STAP) * AUTOLAAD_STAP;
    const r = await laadOp({ codenaam, centen: stap, idem: idem ? idem + ':autolaad' : null, oms: 'Automatisch bijgeladen' });
    if (r.error) return r;
    return { ok: true, bijgeladen: stap };
  }

  /* ---------- geld sturen en Klompjes ---------- */
  async function bestaatLid(codenaam) {
    try { return !!(await keyVanCodenaam(codenaam)); } catch (e) { return false; }
  }
  async function stuur({ van, aanCodenaam, centen, oms, idem }) {
    const aan = schoon(aanCodenaam, 40);
    if (!aan || aan === van) return { status: 400, error: 'Kies aan wie je het stuurt.' };
    if (!(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    return metIdem(idem ? 'stuur:' + van + ':' + idem : null, async () => {
      const z = await zorgSaldo({ codenaam: van, centen, idem });
      if (z.error) return z;
      const b = boek({ van: rekLid(van), naar: rekLid(aan), centen, soort: 'p2p', oms: oms || 'Zomaar' });
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
  function tikcodes() { if (!Array.isArray(d().payTikCodes)) d().payTikCodes = []; return d().payTikCodes; }
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
    const r = await stuur({ van, aanCodenaam: k.codenaam, centen, oms: oms || 'Tik', idem: idem ? 'tik:' + idem : undefined });
    return r.error ? r : Object.assign({ aan: k.codenaam }, r);
  }

  /* ---------- de kassacode: contactloos bij de partner ---------- */
  function kasCode({ codenaam, maxCenten }) {
    const max = Math.min(KASCODE_MAX, Math.max(100, Math.round(Number(maxCenten) || 15000)));
    // oude codes van dit lid vervallen: er is altijd maar een code actief
    for (const k of kascodes()) if (k.codenaam === codenaam && !k.gebruikt) k.gebruikt = true;
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    kascodes().unshift({ code, codenaam, maxCenten: max, geldigTot: nu() + KASCODE_MS, gebruikt: false, at: nu() });
    if (kascodes().length > 1000) kascodes().length = 1000;
    save();
    return { ok: true, code, maxCenten: max, geldigTot: nu() + KASCODE_MS };
  }
  async function kasInt({ supplierCode, code, centen, oms, idem }) {
    const k = kascodes().find(x => x.code === String(code || '').toUpperCase().trim());
    if (!k || k.gebruikt || k.geldigTot < nu()) return { status: 404, error: 'Deze betaalcode is niet (meer) geldig.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN) return { status: 400, error: 'Vul het bedrag in.' };
    if (c > k.maxCenten) return { status: 402, error: 'Boven het maximum van deze code (' + (k.maxCenten / 100).toFixed(2) + ' euro).' };
    return metIdem(idem ? 'kas:' + supplierCode + ':' + idem : null, async () => {
      const z = await zorgSaldo({ codenaam: k.codenaam, centen: c, idem });
      if (z.error) return z;
      const b = boek({ van: rekLid(k.codenaam), naar: rekPartner(supplierCode), centen: c, soort: 'kassa', oms: oms || 'Kassa', ref: k.code });
      if (b.error) return b;
      k.gebruikt = true;
      save();
      seintje(k.codenaam);
      return { ok: true, centen: c, van: k.codenaam };
    });
  }

  /* ---------- de partnerkant: saldo en uitbetalen ---------- */
  function partnerOverzicht(supplierCode) {
    const rek = rekPartner(supplierCode);
    return {
      ok: true, saldo: saldoVan(rek),
      boekingen: grootboek().filter(r => r.van === rek || r.naar === rek).slice(0, 30)
    };
  }
  async function partnerUitbetaal({ supplierCode, idem }) {
    const rek = rekPartner(supplierCode);
    const c = saldoVan(rek);
    if (c <= 0) return { status: 400, error: 'Er staat niets om uit te betalen.' };
    return metIdem(idem ? 'uit:' + supplierCode + ':' + idem : null, async () => {
      try {
        await betaal.maakUitbetaling({
          bedrag: c, referentie: 'pay-uit-' + supplierCode + '-' + nu(),
          idempotentieSleutel: idem ? 'pay-uit:' + supplierCode + ':' + idem : undefined,
          begunstigde: supplierCode, omschrijving: 'RTG Pay uitbetaling'
        });
      } catch (e) { return { status: 502, error: 'De uitbetaling lukte niet: ' + e.message }; }
      const b = boek({ van: rek, naar: 'extern:uitbetaald', centen: c, soort: 'uitbetaling', oms: 'Uitbetaald naar de bank' });
      if (b.error) return b;
      return { ok: true, uitbetaald: c };
    });
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

  return { pay: {
    MIN_CENTEN, MAX_CENTEN, boek, sluitcontrole, laadOp, stuur,
    verzoekMaak, verzoekenVoor, verzoekBetaal, verzoekIntrek,
    tikCode, tikBetaal,
    kasCode, kasInt, partnerOverzicht, partnerUitbetaal, overzicht, saldoVan
  } };
};
