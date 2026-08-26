/* DE WAARDEGRAAF: waar ging deze euro heen?

   Een transactielijst beantwoordt de vraag "wat is er gebeurd". Dat is iets
   anders dan "waar ging mijn geld heen", en die tweede vraag is degene die
   mensen werkelijk stellen. Een ondernemer die veertig euro binnenkrijgt, wil
   niet vier regels zien; hij wil zien dat er drie euro btw in zat, vier euro
   loonreserve, veertig cent kosten, en dat de rest van hem is.

   AFGELEID, NOOIT APART GETELD. Elk getal hier komt uit het pay-grootboek of
   uit de oormerken; deze module houdt niets bij en schrijft niets. Dat is de
   regel uit GELD.md par. 1, en hij is hier extra scherp: een graaf die zijn
   eigen sommen bewaart, toont vroeg of laat een ander bedrag dan de wallet, en
   een geldscherm dat een ander getal toont dan de wallet is erger dan geen
   geldscherm (LAT.md regel 4).

   WAT ER GESCHAT IS, ZEGT DAT OOK. De kosten van de betaaldienst zijn een echte
   grootboekregel: die staan er, met dezelfde `ref` als de ontvangst waar ze bij
   horen, dus ze zijn na te trekken. Het btw- en loondeel zijn dat NIET -- dat
   zijn oormerken (kern/waarde/oormerk.js), en een oormerk is een voornemen over
   het geheel en niet een deel van één betaling. Wat deze module daarvoor toont
   is het percentage uit het huidige beleid, toegepast op die ene ontvangst, en
   het draagt `afgeleid: true`. Een geschat bedrag dat zich voordoet als een
   feit, is gevaarlijker dan geen bedrag.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  /* De tijd uit de ctx van de paylaag: een periode van dertig dagen die aan het
     besturingssysteem wordt gevraagd, schuift niet mee met RTG_KLOK. */
  const { grootboek, rekLid, rekPartner, saldoVan, waarde, treasuryBeleid, nu } = ctx;

  const MAX_RIJEN = 4000;   // een graaf over een half jaar kassabonnen hoeft niet dieper
  const dagenTerug = n => nu() - Math.min(370, Math.max(1, Math.round(Number(n) || 30))) * 86400000;

  function rijen(vanaf) {
    const uit = [];
    for (const r of grootboek()) {
      if ((r.at || 0) < vanaf) break;          // het grootboek is nieuwste-eerst
      uit.push(r);
      if (uit.length >= MAX_RIJEN) break;
    }
    return uit;
  }
  const naam = rek => String(rek || '')
    .replace(/^lid:/, '').replace(/^partner:/, 'zaak ')
    .replace(/^waarde:/, 'tegoed ').replace(/^extern:oplaad$/, 'opgeladen')
    .replace(/^extern:uitbetaald$/, 'bank').replace(/^extern:bank$/, 'RTG Bank')
    .replace(/^rtg:betaaldienst$/, 'betaaldienst');

  /* ---------- de graaf van een LID ----------
     Waar kwam het vandaan, en waar ging het heen. Verplaatsingen tussen de eigen
     posities tellen aan geen van beide kanten mee: geld van je wallet naar je
     eigen budget schuiven is geen inkomst en geen uitgave, en het zou allebei de
     kanten met hetzelfde bedrag opblazen. */
  function graafVanLid(codenaam, { dagen } = {}) {
    const vanaf = dagenTerug(dagen);
    const eigen = new Set(waarde ? waarde.positiesVan(codenaam) : [rekLid(codenaam)]);
    const bronnen = new Map(), bestemmingen = new Map();
    let inTotaal = 0, uitTotaal = 0;
    for (const r of rijen(vanaf)) {
      const vanEigen = eigen.has(r.van), naarEigen = eigen.has(r.naar);
      if (vanEigen === naarEigen) continue;    // intern of niet van dit lid
      const sleutel = naam(vanEigen ? r.naar : r.van);
      const bak = vanEigen ? bestemmingen : bronnen;
      const p = bak.get(sleutel) || { naar: sleutel, centen: 0, aantal: 0 };
      p.centen += r.centen; p.aantal++;
      bak.set(sleutel, p);
      if (vanEigen) uitTotaal += r.centen; else inTotaal += r.centen;
    }
    const sorteer = m => [...m.values()].sort((a, b) => b.centen - a.centen).slice(0, 20);
    const posities = (waarde ? waarde.positiesVan(codenaam) : [rekLid(codenaam)])
      .map(rek => ({ rek, naam: naam(rek), saldo: saldoVan(rek) }));
    return { ok: true, codenaam, sindsDagen: Math.round((nu() - vanaf) / 86400000),
      binnengekomen: inTotaal, uitgegeven: uitTotaal,
      bronnen: sorteer(bronnen), bestemmingen: sorteer(bestemmingen),
      posities, staatNu: posities.reduce((s, p) => s + p.saldo, 0) };
  }

  /* ---------- de graaf van een ZAAK ----------
     Van klantbetaling naar wat er werkelijk van u is. De kosten komen uit het
     grootboek (echte regels), het btw- en loondeel uit het beleid (schatting). */
  function graafVanZaak(supplierCode, { dagen } = {}) {
    const rek = rekPartner(supplierCode);
    const vanaf = dagenTerug(dagen);
    let ontvangen = 0, kosten = 0, uitbetaald = 0, aantal = 0;
    for (const r of rijen(vanaf)) {
      if (r.naar === rek && r.soort !== 'terug') { ontvangen += r.centen; aantal++; }
      else if (r.van === rek) {
        if (r.soort === 'betaaldienstkosten') kosten += r.centen;
        else if (r.soort === 'uitbetaling') uitbetaald += r.centen;
      }
    }
    const b = treasuryBeleid ? treasuryBeleid(supplierCode) : { btwPct: 0, payrollPct: 0 };
    const netto = Math.max(0, ontvangen - kosten);
    const btw = Math.round(netto * (b.btwPct || 0) / 100);
    const loon = Math.round(netto * (b.payrollPct || 0) / 100);
    return { ok: true, supplierCode, sindsDagen: Math.round((nu() - vanaf) / 86400000),
      ontvangen, aantal, uitbetaald,
      /* De opsplitsing draagt per regel of hij uit het grootboek komt of uit een
         percentage. Wie dat verschil niet ziet, leest een schatting als een
         afdracht -- en gaat er dan naar handelen. */
      opsplitsing: [
        { wat: 'Kosten betaaldienst', centen: kosten, afgeleid: false, uitleg: 'Eigen regels in het grootboek, direct verrekend per betaling.' },
        { wat: 'Btw-reservering', centen: btw, afgeleid: true, uitleg: b.btwPct ? b.btwPct + '% van de netto-ontvangst volgens uw eigen instelling; de aangifte rekent de boekhouding.' : 'Niet ingesteld.' },
        { wat: 'Loonreserve', centen: loon, afgeleid: true, uitleg: b.payrollPct ? b.payrollPct + '% van de netto-ontvangst volgens uw eigen instelling.' : 'Niet ingesteld.' },
        { wat: 'Blijft over', centen: Math.max(0, netto - btw - loon), afgeleid: true, uitleg: 'Wat er na het bovenstaande van deze omzet overblijft.' }
      ],
      saldoNu: saldoVan(rek),
      beschikbaarNu: waarde ? waarde.beschikbaar(rek, saldoVan(rek)) : saldoVan(rek) };
  }

  /* ---------- één betaling uitgeplozen ----------
     De kosten hangen aan dezelfde `ref` als de ontvangst; dat is de enige echte
     koppeling die er is en dus de enige die hier gebruikt wordt. */
  function graafVanBoeking(boekingId) {
    const alle = grootboek();
    const b = alle.find(r => r.id === String(boekingId || ''));
    if (!b) return { status: 404, error: 'Deze boeking kennen we niet.' };
    const zusjes = b.ref ? alle.filter(r => r.ref === b.ref && r.id !== b.id).slice(0, 10) : [];
    return { ok: true,
      boeking: { id: b.id, at: b.at, centen: b.centen, soort: b.soort, oms: b.oms,
        van: naam(b.van), naar: naam(b.naar) },
      samenhangend: zusjes.map(r => ({ id: r.id, centen: r.centen, soort: r.soort,
        van: naam(r.van), naar: naam(r.naar), oms: r.oms })) };
  }

  return { graafVanLid, graafVanZaak, graafVanBoeking };
};
