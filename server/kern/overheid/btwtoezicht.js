/* Overheid-domein "btwtoezicht": DE AANSLUITING waar het Belastingkantoor het
   voor doet.

   Het kantoor had wel een btw-beeld -- wat het factuurregister aan omzet en btw
   laat zien -- maar geen enkel besef van wat een zaak daarover heeft AANGEGEVEN.
   Dat maakte het beeld een cijfer zonder vraag erachter. De vraag van een
   inspecteur is niet "hoeveel btw zit er in het register", maar "klopt wat er is
   aangegeven met wat er is gefactureerd, en wie heeft niets ingediend".

   EEN TELLING VOOR BEIDE PARTIJEN. Het geteld-uit-het-register komt hier uit
   dezelfde routine als de aangifte van de ondernemer (kern/fiscaal/btwtelling.js,
   tot op de regelsom in regelBtwCenten). Dat is geen zuinigheid maar de kern van
   de zaak: een inspecteur die anders rekent dan de aangever vindt ALTIJD een
   verschil, en dan zegt een verschil niets meer. Zo betekent een verschil hier
   precies een ding -- er is sinds de aangifte iets veranderd aan de facturen, of
   er is niets aangegeven.

   WAT DIT NIET DOET: beslissen. Er wordt niets nagevorderd, geen boete opgelegd
   en geen aanslag gemaakt. Dit levert een lijst en een paar signalen; de
   inspecteur kijkt en beslist, zoals overal in dit kantoor.

   Krijgt de gedeelde ctx van kern/overheid/index.js. */
'use strict';

const { periodeVak, vorigeBtwPeriode: vorigVak } = require('../fiscaal/btwtelling');

module.exports = (ctx) => {
  /* telPerZaak komt uit de ctx en wordt hier NIET zelf opgebouwd: ./kantoor.js
     leest dezelfde. Twee keer maakBtwTelling({db}) aanroepen zou twee tellers
     geven die vandaag hetzelfde doen en morgen niet meer. */
  const { db, nu, seed, telPerZaak } = ctx;
  const vandaag = () => (nu ? nu() : new Date().toISOString()).slice(0, 10);
  /* Bedragen in de signalen staan in centen in de data en horen in euro's op het
     scherm -- met een KOMMA, want dit is een Nederlands belastingkantoor en
     "€ 42.00" leest daar als een tikfout. */
  const euro = (centen) => (centen / 100).toFixed(2).replace('.', ',');

  /* De aangiftes die MEETELLEN: alleen ingediende, en per zaak/periode de
     LAATSTE. Een correctie is in deze laag een volledige herziening van de
     periode en geen aanvulling erop, dus de nieuwste ingediende is wat er staat.
     Concepten tellen niet mee: een concept is niet aangegeven. */
  function ingediendPer(periode) {
    const uit = new Map();
    for (const a of (db.data.btwAangiftes || [])) {
      if (a.stand !== 'ingediend' || a.periode !== periode) continue;
      const eerder = uit.get(a.code);
      if (!eerder || String(a.ingediendOp) > String(eerder.ingediendOp)) uit.set(a.code, a);
    }
    return uit;
  }
  const conceptPer = (periode) => new Set((db.data.btwAangiftes || [])
    .filter(a => a.stand === 'concept' && a.periode === periode).map(a => a.code));

  /* De vier standen die een zaak in een periode kan hebben. Ze staan hier als
     een expliciete lijst en niet als een reeks ifs verspreid over het scherm:
     een stand die alleen in de opmaak bestaat, is een stand waar niemand op kan
     filteren of tellen. */
  const STANDEN = {
    sluit_aan: 'De aangifte sluit aan op het factuurregister.',
    wijkt_af: 'De aangifte wijkt af van wat er nu in het factuurregister staat.',
    niet_aangegeven: 'Er is omzet gefactureerd, maar over deze periode is niets ingediend.',
    alleen_concept: 'Er ligt een concept, maar het is niet ingediend.'
  };

  /* ---- de aansluiting per zaak over een periode ---- */
  function bdBtwAansluiting(periode) {
    seed();
    const vak = periodeVak(periode);
    if (!vak) return { status: 400, error: 'Geef een periode als 2026K3 (kwartaal) of 2026-07 (maand).' };
    const geteld = telPerZaak(vak);
    const aangegeven = ingediendPer(vak.periode);
    const concepten = conceptPer(vak.periode);
    const kvk = db.data.rijkKvk || [];

    /* Beide kanten op: een zaak die wel factureerde maar niets indiende hoort in
       de lijst, en een zaak die wel indiende terwijl het register leeg is
       evengoed -- dat tweede is zeldzamer en juist daarom interessant. */
    const codes = new Set([...geteld.keys(), ...aangegeven.keys()]);
    const zaken = [...codes].map(code => {
      const g = geteld.get(code) || { code, naam: code, facturen: 0, grondslagCenten: 0, btwCenten: 0, zonderRegels: 0 };
      const a = aangegeven.get(code) || null;
      const verschil = a ? a.verschuldigdCenten - g.btwCenten : 0;
      const stand = a ? (verschil === 0 ? 'sluit_aan' : 'wijkt_af')
        : concepten.has(code) ? 'alleen_concept'
        : (g.btwCenten > 0 ? 'niet_aangegeven' : 'sluit_aan');
      return { code, naam: (a && a.zaak) || g.naam,
        facturen: g.facturen, grondslagCenten: g.grondslagCenten, geteldBtwCenten: g.btwCenten,
        aangegevenBtwCenten: a ? a.verschuldigdCenten : null,
        voorbelastingCenten: a ? a.voorbelastingCenten : null,
        saldoCenten: a ? a.saldoCenten : null,
        verschilCenten: a ? verschil : null,
        soort: a ? a.soort : null, kenmerk: a ? a.kenmerk : null,
        ingediendOp: a ? a.ingediendOp : null,
        zonderRegels: g.zonderRegels, stand, uitleg: STANDEN[stand],
        ingeschreven: kvk.some(k => k.supplierCode === code) };
    }).sort((a, b) => (b.verschilCenten === null ? 0 : Math.abs(b.verschilCenten)) -
      (a.verschilCenten === null ? 0 : Math.abs(a.verschilCenten)) || b.geteldBtwCenten - a.geteldBtwCenten);

    return { ok: true, periode: vak.periode, van: vak.van, tot: vak.tot,
      /* Of de periode voorbij is, bepaalt of "niets ingediend" iets betekent:
         over een lopend kwartaal HOORT er nog niets te zijn ingediend, want de
         aangifte van de ondernemer weigert dat met zoveel woorden. */
      periodeLoopt: vak.tot >= vandaag(),
      zaken: zaken.slice(0, 200),
      geteldBtwCenten: zaken.reduce((s, z) => s + z.geteldBtwCenten, 0),
      aangegevenBtwCenten: zaken.reduce((s, z) => s + (z.aangegevenBtwCenten || 0), 0),
      aangiftes: aangegeven.size, zonderAangifte: zaken.filter(z => z.stand === 'niet_aangegeven').length };
  }

  /* ---- de signalen die hieruit volgen ----
     Alleen over een AFGESLOTEN periode: over een lopend kwartaal een zaak
     aanwijzen omdat hij nog niets heeft ingediend, is de inspecteur laten jagen
     op iets wat nog niet mocht. */
  function btwSignalen(periode) {
    const r = bdBtwAansluiting(periode);
    if (r.error || r.periodeLoopt) return [];
    const uit = [];
    for (const z of r.zaken) {
      if (z.stand === 'niet_aangegeven')
        uit.push({ soort: 'btw', ref: z.code, wie: z.naam,
          tekst: 'Over ' + r.periode + ' is € ' + euro(z.geteldBtwCenten) +
            ' aan btw gefactureerd (' + z.facturen + ' facturen), maar er is geen aangifte ingediend.' });
      else if (z.stand === 'wijkt_af')
        uit.push({ soort: 'btw', ref: z.code, wie: z.naam,
          tekst: 'De aangifte over ' + r.periode + ' (€ ' + euro(z.aangegevenBtwCenten) +
            ') wijkt € ' + euro(Math.abs(z.verschilCenten)) + ' af van het factuurregister (€ ' +
            euro(z.geteldBtwCenten) + '); de facturen zijn na het indienen veranderd.' });
      else if (z.stand === 'alleen_concept')
        uit.push({ soort: 'btw', ref: z.code, wie: z.naam,
          tekst: 'Er ligt een concept-aangifte over ' + r.periode + ', maar die is nooit ingediend.' });
    }
    return uit.slice(0, 30);
  }

  /* De periode waar het toezicht standaard naar kijkt: de LAATST AFGESLOTEN.
     De rekensom staat in ../fiscaal/btwtelling.js, want de naheffing en de
     btw-herinnering rekenen met hetzelfde kwartaal; drie kopieen lopen binnen
     een kwartaal uiteen. */
  const vorigeBtwPeriode = () => vorigVak(vandaag());

  return { bdBtwAansluiting, btwSignalen, vorigeBtwPeriode, BTW_STANDEN: STANDEN };
};
