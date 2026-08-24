/* DE TREASURY VAN EEN ZAAK: geld dat binnenkomt is niet hetzelfde als geld dat
   van u is.

   Een ondernemer ziet zijn saldo en denkt dat hij dat kan uitgeven. Meestal
   klopt dat niet: er zit btw in die hij straks moet afdragen, er komt een
   loonrun aan, en er staan leveranciers open. De klassieke manier waarop een
   horecazaak omvalt is niet dat er te weinig binnenkwam -- het is dat er te veel
   uitging omdat het saldo eruitzag als winst.

   Dus: drie regels die de zaak zelf stelt, en die bij ELKE ontvangst meteen
   worden toegepast.

     btwPct        het geschatte btw-deel van elke ontvangst gaat apart
     payrollPct    een deel van elke ontvangst gaat naar de loonreserve
     bufferCenten  een bodem die altijd blijft staan

   WAAROM PER ONTVANGST EN NIET EEN KEER PER DAG. Een dagelijkse taak is een
   taak die kan uitvallen, en dan is er een dag waarop het saldo weer als winst
   leest. Bij elke ontvangst een stukje apart zetten heeft dat probleem niet en
   is bovendien eerlijker: het geld is apart op het moment dat het binnenkomt,
   niet vanaf middernacht.

   HET MOET TANDEN HEBBEN, anders is het decoratie. Apart gezet geld telt niet
   mee als beschikbaar (kern/waarde/oormerk.js), en `partnerUitbetaal` betaalt
   sinds deze module BESCHIKBAAR uit en niet het hele saldo. Zonder die tweede
   helft is een btw-reservering een getal op een scherm dat de volgende
   uitbetaling gewoon meeneemt.

   WAT DIT NIET IS: een btw-aangifte. Het percentage is een schatting die de
   zaak zelf zet; kern/fiscaal rekent de werkelijke aangifte en die blijft de
   waarheid. Deze module zet geld apart, meer niet -- en zegt dat ook, want een
   apart gezet bedrag dat zich voordoet als een aanslag is gevaarlijker dan geen
   bedrag (dezelfde regel als in kern/fiscaal/index.js).

   Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  /* De tijd uit de ctx van de paylaag; 'vandaag ontvangen' hoort mee te schuiven
     met een verzette klok, anders is de dagomzet niet te beproeven. */
  const { d, save, rekPartner, saldoVan, waarde, grootboek, nu } = ctx;

  function beleidBak() {
    if (!d().payTreasury || typeof d().payTreasury !== 'object') d().payTreasury = {};
    return d().payTreasury;
  }
  const STANDAARD = { btwPct: 0, payrollPct: 0, bufferCenten: 0 };
  function beleid(supplierCode) { return Object.assign({}, STANDAARD, beleidBak()[supplierCode] || {}); }

  function treasuryZet(supplierCode, b) {
    b = b && typeof b === 'object' ? b : {};
    const huidig = beleid(supplierCode);
    const pct = (v, oud) => {
      if (v == null) return oud;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 60 ? Math.round(n * 100) / 100 : null;
    };
    const btw = pct(b.btwPct, huidig.btwPct);
    const pay = pct(b.payrollPct, huidig.payrollPct);
    if (btw == null || pay == null) return { status: 400, error: 'Een percentage ligt tussen 0 en 60.' };
    let buffer = huidig.bufferCenten;
    if (b.bufferCenten != null) {
      const n = Math.round(Number(b.bufferCenten));
      if (!Number.isFinite(n) || n < 0) return { status: 400, error: 'De buffer is een bedrag in hele centen.' };
      buffer = n;
    }
    /* Samen boven de honderd procent zou betekenen dat elke ontvangst meer
       apart zet dan er binnenkomt. Dat kan technisch (het oormerk stuit dan op
       het saldo) maar het is nooit wat iemand bedoelde, en de fout uit zich pas
       weken later als een zaak die niets meer kan uitbetalen. */
    if (btw + pay > 90) return { status: 400, error: 'Btw en loonreserve samen boven 90% van elke ontvangst kan niet.' };
    beleidBak()[supplierCode] = { btwPct: btw, payrollPct: pay, bufferCenten: buffer };
    save();
    return { ok: true, ...beleidBak()[supplierCode] };
  }

  /* Bij een ontvangst meteen apart zetten. Geeft terug wat er is weggezet;
     faalt er iets (te weinig saldo door een gelijktijdige uitbetaling), dan is
     dat GEEN reden om de ontvangst te laten mislukken -- het geld is binnen, en
     een mislukte oormerking is een gemiste reservering en geen verloren cent.
     Vandaar dat de aanroeper het resultaat mag negeren. */
  function bijOntvangst(supplierCode, centen) {
    if (!waarde) return { apart: 0 };
    const b = beleid(supplierCode);
    const c = Math.round(Number(centen) || 0);
    if (c <= 0 || (!b.btwPct && !b.payrollPct)) return { apart: 0 };
    const rek = rekPartner(supplierCode);
    let weg = 0;
    for (const [naam, pct, doel] of [['Btw-reservering', b.btwPct, 'btw'], ['Loonreserve', b.payrollPct, 'payroll']]) {
      if (!pct) continue;
      const deel = Math.round(c * pct / 100);
      if (deel <= 0) continue;
      const r = waarde.oormerkZet({ rek, naam, centen: deel, doel, saldo: saldoVan(rek) });
      if (r.ok) weg += deel;
    }
    return { apart: weg };
  }

  /* Het bord van de ondernemer. Vier getallen die niet door elkaar mogen lopen,
     en een vijfde dat het antwoord is op de enige vraag die hij echt stelt:
     hoeveel kan ik vandaag uitgeven zonder dat het straks pijn doet? */
  function treasuryStand(supplierCode) {
    const rek = rekPartner(supplierCode);
    const saldo = saldoVan(rek);
    const b = beleid(supplierCode);
    const apart = waarde ? waarde.apart(rek) : 0;
    const vast = waarde ? waarde.gereserveerd(rek) : 0;
    const beschikbaar = saldo - apart - vast;
    const vandaag = new Date(nu()).toISOString().slice(0, 10);
    let ontvangenVandaag = 0;
    for (const r of grootboek()) {
      if (r.naar !== rek) continue;
      const dag = new Date(r.at || 0).toISOString().slice(0, 10);
      if (dag !== vandaag) break;   // het grootboek is nieuwste-eerst
      ontvangenVandaag += r.centen;
    }
    return { ok: true, saldo, apartGezet: apart, gereserveerd: vast, beschikbaar,
      /* Vrije liquiditeit is beschikbaar MIN de buffer die de zaak zelf als
         bodem heeft gezet. Nooit negatief tonen: een min-bedrag leest als een
         schuld terwijl het betekent "u zit onder uw eigen bodem", en dat is een
         ander bericht. */
      vrijeLiquiditeit: Math.max(0, beschikbaar - b.bufferCenten),
      onderBuffer: beschikbaar < b.bufferCenten,
      ontvangenVandaag, beleid: b,
      oormerken: waarde ? waarde.oormerken(rek) : [],
      uitleg: 'De percentages zijn een schatting die u zelf instelt. De werkelijke btw-aangifte rekent de boekhouding; dit zet alleen geld apart.' };
  }

  function treasuryVrij(supplierCode, id) {
    if (!waarde) return { status: 501, error: 'Oormerken zijn hier niet ingeschakeld.' };
    return waarde.oormerkVrij({ rek: rekPartner(supplierCode), id });
  }
  function treasuryApart(supplierCode, { naam, centen, doel }) {
    if (!waarde) return { status: 501, error: 'Oormerken zijn hier niet ingeschakeld.' };
    const rek = rekPartner(supplierCode);
    return waarde.oormerkZet({ rek, naam, centen, doel, saldo: saldoVan(rek) });
  }

  return { treasuryBeleid: beleid, treasuryZet, treasuryStand, treasuryVrij, treasuryApart, bijOntvangst };
};
