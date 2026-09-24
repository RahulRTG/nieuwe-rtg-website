/* Magnaat Economische Motor -- wat de motor over zijn wereld laat zien.

   Het overzicht leest uitsluitend de projectie. De balanscontrole komt uit de
   lopende totalen die bij elke gebeurtenis meebewegen, niet uit een optelling
   over het hele journaal: die optelling werd per dag duurder en telde boven
   2500 posten alleen nog wat er over was. Wie het journaal zelf wil nalopen,
   gebruikt `verifieer` -- dat is controle en geen weergave. */
'use strict';
const { STAAT_VERSIE, SCHOKKEN, datumOpDag } = require('./constanten');

module.exports = (m) => {
  function publiekeBedrijf(e, b) {
    return {
      id: b.id, naam: b.naam, kas: m.kas(e, b.id), schuld: m.creditWaarde(e, b.id + '.schuld'),
      personeel: b.personeel, personeelDoel: b.personeelDoel, loonMaand: b.loonMaand,
      prijs: b.prijs, kwaliteit: b.kwaliteit, reputatie: b.reputatie,
      voorraad: b.voorraad, bestelling: b.bestelling, trainingDag: b.trainingDag,
      impactPct: b.impactBp / 100, omzetVandaag: b.omzetVandaag,
      kostenVandaag: b.kostenVandaag, winstVandaag: b.winstVandaag,
      verkopenVandaag: b.verkopenVandaag, vraagVandaag: b.vraagVandaag,
      capaciteitVandaag: b.capaciteitVandaag, productiviteit: b.productiviteit,
      benutting: b.benutting, levergraad: b.levergraad
    };
  }

  function balansControle(e) {
    const { debet, credit } = e.totalen;
    return { debet, credit, verschil: debet - credit, inBalans: debet === credit };
  }

  function overzicht(actor) {
    const e = m.state();
    const motor = m.motor;
    const motorStatus = typeof motor.status === 'function' ? motor.status() : {
      aan: !!motor.aan, modus: motor.aan ? 'motor' : 'uit', circuit: motor.aan ? 'onbekend' : 'niet-van-toepassing'
    };
    const uit = {
      versie: STAAT_VERSIE, naam: 'Magnaat Economische Motor', dag: e.dag,
      datum: datumOpDag(e.dag), omgeving: m.profiel.teksten.omgeving,
      serverAuthoritatief: true, deterministisch: true,
      rekenlaag: {
        actief: motorStatus.aan ? 'rust-native' : 'javascript-lokaal',
        circuit: motorStatus.circuit, gelijktijdig: motorStatus.actief || 0,
        grens: motorStatus.maxTegelijk || null,
        terugval: 'atomair naar dezelfde deterministische JavaScript-regels'
      },
      actieveSchok: Object.assign({}, e.actieveSchok),
      geplandeSchok: e.geforceerdeSchok || null,
      schokken: SCHOKKEN.filter(s => s.id !== 'geen').map(s => Object.assign({}, s)),
      macro: Object.assign({}, e.macro, {
        huishoudensKas: m.kas(e, 'huishoudens'), overheidsKas: m.kas(e, 'overheid'),
        rtfKas: m.kas(e, 'rtf'), bankKas: m.kas(e, 'bank')
      }),
      bedrijven: Object.values(e.bedrijven).map(b => publiekeBedrijf(e, b)),
      werkvoorraad: Object.assign({}, e.werk, { bronnen: e.werk.bronnen.slice(0, 8) }),
      grootboek: {
        boekingen: e.totalen.aantal, controle: balansControle(e),
        laatste: e.recent.slice(0, 12).map(j => Object.assign({}, j))
      },
      verklaringen: e.verklaringen.slice(0, 12),
      historie: e.historie.slice(-40),
      regels: [
        'Vraag reageert op prijs, kwaliteit, reputatie en consumentenvertrouwen.',
        'Verkoop kan nooit hoger zijn dan vraag, capaciteit of voorraad.',
        'Personeel, loon en training veranderen kosten en productiviteit.',
        'Schaarste verhoogt inflatie; inflatie en werkloosheid sturen de rente.',
        'Winst wordt pas na inkoop, lonen, training, rente, impact en belasting berekend.',
        'Iedere geldstroom is dubbel geboekt; een ongebalanceerde post wordt geweigerd.'
      ]
    };
    if (e.integriteit) uit.integriteit = Object.assign({}, e.integriteit);
    if (m.haken.verrijk) m.haken.verrijk(e, uit, actor, { publiekeBedrijf: b => publiekeBedrijf(e, b) });
    return uit;
  }

  /* CONTROLE, geen weergave: loopt het hele journaal na. Elke gebeurtenis in
     balans, volgnummers zonder gat, en de saldi van de projectie precies gelijk
     aan wat het journaal oplevert (vanaf een lege wereld, of vanaf het punt
     waar de overgenomen historie begint). */
  function verifieer() {
    const e = m.state();
    const gat = m.opslag.ontbrekend(m.wereld);
    const bevindingen = [];
    let verwacht = gat ? gat.tot + 1 : 1;
    for (const g of m.gebeurtenissen()) {
      if (g.volgnummer !== verwacht) bevindingen.push('volgnummer ' + g.volgnummer + ' waar ' + verwacht + ' verwacht werd');
      if (g.debet !== g.credit) bevindingen.push(g.id + ' is niet in balans');
      verwacht = g.volgnummer + 1;
    }
    if (verwacht - 1 !== e.laatstToegepast) bevindingen.push('het journaal eindigt bij ' + (verwacht - 1) + ', de projectie bij ' + e.laatstToegepast);
    if (!gat) {
      const saldi = m.saldiNa({}, 0);
      for (const [code, r] of Object.entries(e.rekeningen)) {
        if ((saldi[code] || 0) !== r.saldo) bevindingen.push('saldo ' + code + ': projectie ' + r.saldo + ', journaal ' + (saldi[code] || 0));
      }
    }
    return { ok: !bevindingen.length, gebeurtenissen: verwacht - 1, historieVanaf: gat ? gat.tot + 1 : 1, bevindingen };
  }

  return { overzicht, verifieer };
};
