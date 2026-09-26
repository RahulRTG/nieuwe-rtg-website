/* RTG Pay, deelbestand "verzoeken": geld sturen, de Klompjes (goudklompjes, het
   RTG-eigen betaalverzoek) en het overzicht voor het lid. De tik (vrienden betalen
   elkaar met een aanraking) staat in ./tik.js. EEN knop overal: is er te weinig saldo, dan laadt de
   wallet zelf bij (autolaad in de kern) en betaalt door. Krijgt de gedeelde ctx van
   kern/pay/index.js. */
module.exports = (ctx) => {
  const { crypto, save, schoon, nu, d, klompjes, klompjesKijk, tikcodes, grootboek, grootboekKijk, rekLid, saldoVan, walletRuimte,
    id, metIdem, boekAsync, zorgSaldo, seintje, bestaatLid, waarde,
    MIN_CENTEN, MAX_CENTEN, walletMax, KASCODE_MS } = ctx;

  async function stuur({ van, aanCodenaam, centen, oms, idem, soort }) {
    const aan = schoon(aanCodenaam, 40);
    if (!aan || aan === van) return { status: 400, error: 'Kies aan wie je het stuurt.' };
    if (!(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    // oms blijft buiten de afdruk: vrije tekst mag geen 409 veroorzaken
    const afdruk = 'stuur|' + van + '|' + aan + '|' + Math.round(Number(centen)) + '|' + (soort || 'p2p');
    return metIdem(idem ? 'stuur:' + van + ':' + idem : null, afdruk, async () => {
      const z = await zorgSaldo({ codenaam: van, centen, idem });
      if (z.error) return z;
      const b = await boekAsync({ van: rekLid(van), naar: rekLid(aan), centen, soort: soort || 'p2p', oms: oms || 'Zomaar' });
      if (b.error) return b;
      seintje(aan);
      return { ok: true, saldo: saldoVan(rekLid(van)), bijgeladen: z.bijgeladen, boeking: b.boeking.id };
    }, { geld: 'betaalt een bedrag aan een ander lid' });
  }
  /* De huisrekening van RTG staat in ./huis.js -- een eigen onderwerp (geld dat
     het stelsel verlaat of van buiten komt), en dit bestand liep over de 10 kB. */
  const { huisIn, huisUit } = require('./huis')({ schoon, metIdem, zorgSaldo, boekAsync, rekLid, seintje,
    bestaatLid, MIN_CENTEN, MAX_CENTEN });

  /* Een Klompje (goudklompje, het RTG-eigen betaalverzoek): vraag een bedrag aan een of meer vrienden. Met splitsMetMij
     deelt het totaal door de hele groep inclusief jezelf (jouw deel heb je
     immers al betaald aan de zaak); anders krijgt ieder het hele bedrag. */
  async function verzoekMaak({ van, aan, totaalCenten, perCenten, oms, splitsMetMij, idem }) {
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
    /* Twee klompjes van hetzelfde bedrag kunnen ALLEBEI door de vriend worden
       betaald -- precies het geval dat in 4.55 aan de leverancierskant is
       gerepareerd (supplier/betaalverzoek), en dit is de ledenkant ervan. De
       afdruk draagt de ontvangers en het bedrag per persoon, niet de
       omschrijving (TAKEN.md 4.57). */
    return metIdem(idem ? 'klompjemaak:' + van + ':' + idem : null,
      'klompjemaak|' + van + '|' + namen.slice().sort().join(',') + '|' + per, () => {
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
      });
  }
  function verzoekenVoor(codenaam) {
    const alle = klompjesKijk();
    return {
      aanMij: alle.filter(v => v.aan === codenaam && v.status === 'open').slice(0, 20),
      vanMij: alle.filter(v => v.van === codenaam).slice(0, 20)
    };
  }
  // EEN knop: het Klompje betalen (met autolaad als het saldo tekortschiet)
  /* WELK VERZOEK ER NU WORDT BETAALD. De stand `open` werd gecontroleerd voordat
     er op zorgSaldo() en de boeking werd gewacht, en pas daarna op `betaald`
     gezet. Twee betalingen van hetzelfde verzoek met elk een eigen sleutel (de
     idem-laag wacht alleen bij DEZELFDE sleutel) kwamen dus allebei door: een
     verzoek van 25 euro kostte er 50. Gevonden door de zoekende tegenstander
     (BEWIJSLUS.md par. 3a); toets: test/verzoekbetaal-race.test.js.

     Het slot staat in het geheugen van dit proces en niet in de database: het
     gaat over een venster van milliseconden, en een blijvend slot dat na een
     crash blijft staan zou het verzoek voor altijd dichtzetten. Wat blijvend is,
     is de stand `betaald`, en die wordt binnen het slot opnieuw gecontroleerd. */
  const inBetaling = new Set();
  async function verzoekBetaal({ codenaam, verzoekId, idem }) {
    const v = klompjesKijk().find(x => x.id === verzoekId && x.aan === codenaam);
    if (!v) return { status: 404, error: 'Dit verzoek staat niet voor jou open.' };
    if (v.status !== 'open') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
    return metIdem(idem ? 'klompje:' + codenaam + ':' + idem : null,
      'klompje|' + codenaam + '|' + v.id + '|' + v.centen, async () => {
      // opnieuw, en zonder await ertussen: dit is het moment dat telt
      if (v.status !== 'open') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
      if (inBetaling.has(v.id)) return { status: 409, error: 'Dit verzoek wordt op dit moment al betaald.' };
      inBetaling.add(v.id);
      try {
        const z = await zorgSaldo({ codenaam, centen: v.centen, idem });
        if (z.error) return z;
        const b = await boekAsync({ van: rekLid(codenaam), naar: rekLid(v.van), centen: v.centen, soort: 'klompje', oms: v.oms, ref: v.id });
        if (b.error) return b;
        v.status = 'betaald';
        v.betaaldAt = nu();
        save();
        seintje(v.van);
        return { ok: true, saldo: saldoVan(rekLid(codenaam)), bijgeladen: z.bijgeladen };
      } finally {
        inBetaling.delete(v.id);
      }
    }, { geld: 'voldoet een betaalverzoek van iemand anders' });
  }
  function verzoekIntrek({ codenaam, verzoekId }) {
    const v = klompjesKijk().find(x => x.id === verzoekId && x.van === codenaam);
    if (!v) return { status: 404, error: 'Dit verzoek is niet van jou.' };
    if (v.status !== 'open') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
    v.status = 'ingetrokken';
    save();
    return { ok: true };
  }

  /* De tik staat in ./tik.js. Dit bestand gaat over VRAGEN -- een verzoek dat
     blijft staan tot iemand betaalt -- en de tik over een moment tussen twee
     mensen die naast elkaar staan. Het betalen zelf loopt bij allebei via
     `stuur`: er is maar een plek waar geld beweegt. */
  const { tikCode, tikBetaal, tikFeed } = require('./tik')({ crypto, save, nu, tikcodes, grootboek, rekLid, KASCODE_MS, stuur });

  /* ---------- het overzicht voor het lid (alles in een scherm) ---------- */
  function overzicht(codenaam) {
    const rek = rekLid(codenaam);
    const rijen = grootboekKijk().filter(r => r.van === rek || r.naar === rek).slice(0, 30).map(r => ({
      id: r.id, at: r.at, oms: r.oms, soort: r.soort,
      centen: r.naar === rek ? r.centen : -r.centen,
      tegen: (r.naar === rek ? r.van : r.naar).replace(/^lid:/, '').replace(/^partner:/, 'zaak ').replace(/^extern:oplaad$/, 'opgeladen').replace(/^extern:uitbetaald$/, 'bank')
    }));
    const v = verzoekenVoor(codenaam);
    /* Saldo, gereserveerd en beschikbaar staan hier alle drie, en dat is geen
       uitgebreidheid maar een noodzaak: zonder het tweede getal ziet een lid
       saldo dat hij niet kan uitgeven en kan niemand hem uitleggen waarom. Een
       zaak die een borg vastzet, moet zichtbaar zijn op het scherm van degene
       bij wie hij vastzit. Zonder waardelaag zijn saldo en beschikbaar gewoon
       hetzelfde getal en staat er geen reservering. */
    const vast = waarde ? waarde.gereserveerd(rek) : 0;
    /* En het PLAFOND staat er ook bij, want een grens die je pas raakt is een
       grens die je niet kende: de wallet toont hoeveel er nog bij kan voordat
       opladen weigert. Twee getallen, geen oordeel -- dat blijft aan het scherm
       (ONTWERP.md, uitzonderingsgestuurd). */
    return { ok: true, codenaam, saldo: saldoVan(rek), plafond: walletMax(), ruimte: walletRuimte(codenaam),
      gereserveerd: vast, beschikbaar: saldoVan(rek) - vast,
      reserveringen: waarde ? waarde.reserveringen(rek).map(r => ({
        id: r.id, centen: r.centen, doel: r.doel, tot: r.tot, door: r.ref })) : [],
      geschiedenis: rijen, aanMij: v.aanMij, vanMij: v.vanMij };
  }

  return { stuur, huisIn, huisUit, verzoekMaak, verzoekenVoor, verzoekBetaal, verzoekIntrek, tikCode, tikBetaal, tikFeed, overzicht };
};
