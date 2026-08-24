/* Horeca (kern): DE PAS -- welke gang staat klaar om gedragen te worden, en wie
   heeft hem.

   HET PROBLEEM DAT DIT OPLOST is niet technisch maar fysiek: bij de pas staat
   een complete gang, en er lopen twee mensen tegelijk naartoe -- of geen. Dat
   is dezelfde fout die de gastverzoeken al een keer hebben opgelost, met
   dezelfde oplossing: "ik ga" en "gedaan" zijn twee verschillende knoppen, en
   wie het oppakt haalt het weg bij de rest.

   VIJF DINGEN LIGGEN HIER VAST.

   1. ALLEEN EEN COMPLETE GANG STAAT OP DE PAS. Een gang waarvan de helft nog
      loopt, kun je niet dragen -- dat is de hele belofte van gangregie: een
      gang gaat samen de deur uit. Een half bord meenemen is precies wat het
      systeem hoort te voorkomen, dus staat het er niet als taak.
   2. EEN CLAIM IS VAN ÉÉN MENS. Een tweede die claimt krijgt te horen wie hem
      heeft, en niet stilzwijgend de claim afgepakt. Twee mensen die allebei
      denken dat het van hen is, is erger dan niemand.
   3. CLAIMEN VINKT NIETS AF. De regels blijven op `klaar` staan tot een mens
      uitgeeft. Een systeem dat bij het oppakken alvast "uitgegeven" noteert,
      maakt van dat woord een lege huls (HORECA.md, grens 4).
   4. OVERNEMEN IS EEN EIGEN HANDELING, met de naam van wie het overnam én van
      wie het werd overgenomen. Er staat GEEN tijdslimiet waarna het systeem een
      claim zelf laat vallen: dat zou een verzonnen getal zijn, en het zou de
      claim juist wegnemen op het moment dat het druk is. Wat er wél staat is
      hoe lang de claim loopt -- een feit, waar een collega op mag handelen.
   5. DE MINUTEN ZIJN EEN FEIT EN GEEN BELOFTE. `gereedSinds` telt vanaf het
      moment dat de gang compleet werd. Er staat nergens hoe snel iemand er is. */
'use strict';

const { zetStand } = require('./keukenlaag');

module.exports = ({ horeca, schoon }) => {
  const { nu } = horeca;
  const gezelschap = require('./gezelschap')({ horeca, schoon });
  // dezelfde klok als de cadans die deze pas plant; niet de OS-tijd
  const klok = require('../../lib/klok');
  const minutenSinds = (at) => at ? Math.max(0, Math.round((klok.nu() - Date.parse(at)) / 60000)) : 0;

  /* De claims wonen op de rekening, per gang. Niet op de regel: de taak is de
     GANG (vier borden voor tafel 8), en een claim per bord zou precies de
     versplintering terugbrengen die dit oplost. */
  function claims(rek) {
    if (!rek.pas || typeof rek.pas !== 'object') rek.pas = {};
    return rek.pas;
  }
  const sleutel = (gang) => String(Math.max(0, Math.min(9, parseInt(gang, 10) || 0)));

  // de regels van één gang die nog niet de deur uit zijn
  const gangRegels = (rek, gang) => (rek.regels || [])
    .filter((r) => r.vrijAt && r.stand !== 'uitgegeven' && String(r.gang || 0) === sleutel(gang));

  /* Alles wat compleet klaar staat, over de hele zaak. Dit is de werklijst van
     de pas en van de bar; welk station het is, staat op de borden zelf. */
  function gereed(h) {
    const uit = [];
    for (const rek of Object.values(h.rekeningen || {})) {
      if (rek.status !== 'open' && rek.status !== 'betaald') continue;
      const perGang = new Map();
      for (const r of (rek.regels || [])) {
        if (!r.vrijAt || r.stand === 'uitgegeven') continue;
        const k = String(r.gang || 0);
        if (!perGang.has(k)) perGang.set(k, []);
        perGang.get(k).push(r);
      }
      for (const [gang, regels] of perGang) {
        // punt 1: een half klare gang is geen taak
        if (!regels.every((r) => r.stand === 'klaar')) continue;
        const c = claims(rek)[gang] || null;
        /* Compleet sinds het LAATSTE bord klaar was -- dat is het moment waarop
           er iets te dragen viel. Het eerste bord staat dan al langer, en dat
           getal staat op het regiescherm (staat-koud); hier gaat het over de
           gang als geheel. */
        const compleetAt = regels.reduce((laatste, r) =>
          !r.klaarAt ? laatste : (!laatste || r.klaarAt > laatste ? r.klaarAt : laatste), null);
        uit.push({
          rekeningId: rek.id, tafel: rek.tafel || rek.kanaal, kanaal: rek.kanaal,
          gang: Number(gang), borden: regels.length,
          serveerOm: regels.map((r) => r.serveerOm).find(Boolean) || null,
          gereedSinds: minutenSinds(compleetAt),
          stations: [...new Set(regels.map((r) => r.station || 'warm'))],
          allergieen: [...new Set(regels.map((r) => r.allergie).filter(Boolean))],
          /* Waar elk bord heen moet. De runner draagt vier borden en heeft aan
             "gastNr 3" niets; de stoel draagt hier zijn naam. */
          regels: regels.map((r) => ({ regelId: r.id, naam: r.naam, aantal: r.aantal,
            station: r.station || 'warm', allergie: r.allergie || null,
            stoel: gezelschap.handleVan(rek, r.gastNr) })),
          claim: c ? { naam: c.naam, staffId: c.staffId, minuten: minutenSinds(c.at),
            overgenomenVan: c.overgenomenVan || null } : null
        });
      }
    }
    /* Wat het langst klaar staat, bovenaan. Niet de duurste tafel en niet
       tafel 1: eten dat staat te wachten wordt koud, en dat is het enige waar
       op deze lijst tijd doorheen loopt. */
    return uit.sort((a, b) => b.gereedSinds - a.gereedSinds);
  }

  function pak(rek, gang, wie) {
    const regels = gangRegels(rek, gang);
    if (!regels.length) return { status: 404, error: 'Er staat niets meer open in gang ' + gang + ' op deze tafel.' };
    if (!regels.every((r) => r.stand === 'klaar')) {
      const nog = regels.filter((r) => r.stand !== 'klaar');
      return { status: 409, code: 'niet-compleet',
        error: 'Deze gang is nog niet compleet: ' + nog.length + ' van de ' + regels.length +
          ' borden staan nog in de keuken (' + nog.map((r) => r.naam).join(', ') + ').' };
    }
    const c = claims(rek)[sleutel(gang)];
    if (c) {
      if (String(c.staffId) === String(wie.staffId)) return { ok: true, claim: c, al: true };
      return { status: 409, code: 'al-geclaimd',
        error: c.naam + ' heeft deze gang al opgepakt, ' + minutenSinds(c.at) + ' minuten geleden.',
        claim: { naam: c.naam, minuten: minutenSinds(c.at) } };
    }
    claims(rek)[sleutel(gang)] = { staffId: wie.staffId == null ? null : String(wie.staffId),
      naam: wie.naam, at: nu(), overgenomenVan: null };
    return { ok: true, claim: claims(rek)[sleutel(gang)] };
  }

  /* Loslaten kan alleen wat van jou is -- of door een manager, want die moet
     een tafel kunnen deblokkeren als iemand naar huis is. */
  function los(rek, gang, wie) {
    const c = claims(rek)[sleutel(gang)];
    if (!c) return { status: 404, error: 'Deze gang is niet opgepakt.' };
    if (String(c.staffId) !== String(wie.staffId) && !wie.manager) return { status: 403,
      error: 'Deze gang is opgepakt door ' + c.naam + '. Neem hem over, of laat het hem zelf loslaten.' };
    delete claims(rek)[sleutel(gang)];
    return { ok: true, losgelaten: c.naam };
  }

  /* Overnemen: expliciet, en met beide namen erin. Dit is bewust GEEN stille
     herclaim -- wie een bord van een collega overneemt, hoort dat te zien en
     achteraf te kunnen navertellen. */
  function neemOver(rek, gang, wie) {
    const c = claims(rek)[sleutel(gang)];
    if (!c) return { status: 404, error: 'Deze gang is niet opgepakt; je kunt hem gewoon oppakken.' };
    if (String(c.staffId) === String(wie.staffId)) return { status: 409, error: 'Deze gang heb je zelf al.' };
    const van = c.naam;
    claims(rek)[sleutel(gang)] = { staffId: wie.staffId == null ? null : String(wie.staffId),
      naam: wie.naam, at: nu(), overgenomenVan: van };
    return { ok: true, claim: claims(rek)[sleutel(gang)], van: van };
  }

  /* De hele gang uitgeven, in één handeling. Dat is wat er bij de pas gebeurt:
     de borden gaan samen weg, dus vier keer tikken is vier kansen om er een te
     vergeten. De standwissel zelf komt uit keukenlaag.js, zodat de tijdstempels
     hier niet apart worden gezet. */
  function geefUit(rek, gang, wie) {
    const regels = gangRegels(rek, gang);
    if (!regels.length) return { status: 404, error: 'Er staat niets meer open in gang ' + gang + ' op deze tafel.' };
    const nietKlaar = regels.filter((r) => r.stand !== 'klaar');
    if (nietKlaar.length) return { status: 409, code: 'niet-compleet',
      error: 'Nog niet compleet: ' + nietKlaar.map((r) => r.naam).join(', ') + ' staat nog in de keuken.' };
    const stempel = nu();
    for (const r of regels) { zetStand(r, 'uitgegeven', stempel); r.uitDoor = wie.naam; }
    // de claim heeft zijn werk gedaan
    delete claims(rek)[sleutel(gang)];
    return { ok: true, uitgegeven: regels.length, gang: Number(sleutel(gang)) };
  }

  /* Een claim op een gang waar niets meer van openstaat, hoort er niet te
     blijven staan. Wordt aangeroepen na een losse standwissel (keuken/stand),
     want daar kan de laatste regel van een gang de deur uit gaan. */
  function ruimOp(rek) {
    const doos = claims(rek);
    for (const gang of Object.keys(doos)) if (!gangRegels(rek, gang).length) delete doos[gang];
  }

  return { gereed, pak, los, neemOver, geefUit, ruimOp };
};
