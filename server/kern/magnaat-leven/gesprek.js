/* Magnaat FROM ZERO: VAN KANS TOT AFSPRAAK.

   Een kans ontstaat uit wat je doet (./klanten.js, `komt`). Dan praat je met de
   klant (een half uur van vandaag) en weet je wat hij wil, hoeveel werk het is
   en wanneer hij het nodig heeft. Daarna onderhandel je over het bedrag EN over
   de voorwaarden: een voorschot is geld nu in plaats van later.

     Jouw voorstel: € 900        Klant: € 650
     Jij: € 800 + 25% vooraf     Klant: akkoord.

   Drie dingen, en niet meer: de PRIJS, de DEADLINE (meer dagen is minder
   tijdsdruk, en een klant wacht niet eindeloos) en de BETAALSTRUCTUUR (hoeveel
   vooraf). Geen contractsimulator.

   Wat daaruit komt is een AFSPRAAK met een bedrag, een voorschot, de uren en een
   deadline -- geen missie met punten. Na drie voorstellen zonder akkoord haakt
   een klant af, en een kans waar je een week niets mee doet, gaat naar iemand
   anders. */
'use strict';
const R = require('./regels');
const { AANBOD, klantenVan, VERVOLG } = require('./klanten');
const { meld, ontgrendel, post, klantVan, deal: vindDeal, euro, tijd } = require('./staat');
const { rest } = require('./tijd');
const { betaalWatVervalt } = require('./geld');

const fout = (error) => ({ status: 400, error });
const heleEuro = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 && n <= 100000 ? n * 100 : null; };
const opKwartje = (c) => Math.round(c / 2500) * 2500;
const sneller = (st) => Math.min(R.LEREN.max, Math.floor(st.geleerd / R.LEREN.perStap) * R.LEREN.korting);

/* Nieuwe kansen, hooguit een per dag, in de volgorde van de klantenlijst. */
function kansen(st) {
  if (!st.aanbod) return;
  const k = klantenVan(st.aanbod).find(x => !st.deals.some(d => d.klantId === x.id && !d.vervolg) && (
    x.komt.soort === 'project' ? st.portfolio >= x.komt.minuten
      : x.komt.soort === 'aanbeveling' ? st.betaald >= x.komt.na : !!st.onderneming));
  if (k) {
    const via = k.komt.soort === 'project' ? 'heeft ' + AANBOD[st.aanbod].project + ' gezien'
      : k.komt.soort === 'aanbeveling' ? 'kreeg je naam van een tevreden klant' : 'vond je onderneming';
    st.deals.push({ id: 'd' + (++st.dealTeller), klantId: k.id, klant: k.naam, fase: 'kans', sinds: st.dag, rondes: [], gedaan: 0 });
    meld(st, k.contact + ' van ' + k.naam + ' ' + via + ' en vraagt of je iets voor hem kunt maken.', 'kans');
    ontgrendel(st, 'berichten');
  }
  for (const d of st.deals) {
    /* Wie een contract heeft of aangeboden kreeg, komt niet ook nog los terug (V2). */
    const vast = (st.contracten || []).some(c => c.klantId === d.klantId && ['aanbod', 'actief'].includes(c.stand));
    if (d.fase === 'betaald' && !d.laatGeleverd && !d.contract && !vast && d.betaaldOp + VERVOLG.naDagen === st.dag) {
      const uurtarief = Math.round(d.afspraak.bedrag * 60 / d.afspraak.minuten);
      const bedrag = opKwartje(uurtarief * VERVOLG.uren / 60);
      st.deals.push({ id: 'd' + (++st.dealTeller), klantId: d.klantId, klant: d.klant, fase: 'onderhandeling', sinds: st.dag,
        vervolg: true, uren: VERVOLG.uren, termijn: VERVOLG.termijn, gedaan: 0,
        rondes: [{ van: 'klant', bedrag, voorschot: 0, dagen: VERVOLG.termijn }] });
      meld(st, d.klant + ' komt terug voor onderhoud: ' + tijd(VERVOLG.uren) + ' werk tegen je oude uurtarief, ' + euro(bedrag) + '.', 'kans');
    }
    if (['kans', 'onderhandeling'].includes(d.fase) && d.sinds + 7 <= st.dag) {
      d.fase = 'afgehaakt';
      meld(st, d.klant + ' hoorde een week niets en zocht iemand anders.', 'slecht');
    }
  }
}

function gesprek(st, z) {
  const d = vindDeal(st, z.deal);
  if (!d || d.fase !== 'kans') return fout('Een gesprek voer je met iemand die een kans voor je heeft.');
  if (st.betaald >= R.ONDERNEMING.opdrachten && !st.onderneming) {
    return fout('Je werkt structureel voor klanten. ' + R.JURISDICTIE.inschrijven + ' Een nieuwe klant neem je dus pas aan als je ingeschreven bent: schrijf je eerst in.');
  }
  if (rest(st, st.dag) < 30) return fout('Een gesprek kost een half uur, en je hebt vandaag geen tijd meer. Morgen kan het.');
  (st.agenda[st.dag] = st.agenda[st.dag] || []).push({ wat: 'gesprek', minuten: 30, deal: d.id });
  const k = klantVan(st, d.klantId);
  d.uren = Math.round(k.uren * (100 - sneller(st)) / 100 / 30) * 30;
  d.termijn = k.termijn;
  d.fase = 'onderhandeling';
  d.sinds = st.dag;
  meld(st, k.contact + ' wil ' + k.behoefte + '. Jij schat ' + tijd(d.uren) + ' werk, en hij heeft het over ' + k.termijn +
    ' dagen nodig.' + (k.offerte ? ' Hij heeft ook een offerte van ' + k.offerte.van + ': ' + euro(k.offerte.bedrag) + '.' : '') + ' Wat vraag je?', 'vraag');
  return { ok: true };
}

function akkoord(st, d, bedrag, voorschot, dagen) {
  const vb = Math.round(bedrag * voorschot / 100);
  d.afspraak = { bedrag, voorschot, voorschotBedrag: vb, minuten: d.uren, deadline: st.dag + (dagen || d.termijn), dag: st.dag };
  d.fase = 'overeenkomst';
  if (vb) d.voorschotDag = st.dag + 2;
  meld(st, 'Afspraak met ' + d.klant + ': ' + euro(bedrag) + (vb ? ', waarvan ' + euro(vb) + ' vooraf' : '') + ', af op ' +
    R.dagNaam(d.afspraak.deadline) + ' (dag ' + d.afspraak.deadline + ').', 'goed');
  if (!st.software) {
    const a = AANBOD[st.aanbod];
    st.software = { sinds: st.dag, gepauzeerd: false };
    post(st, { soort: 'software', naam: a.software, bedrag: R.SOFTWARE.bedrag, dag: st.dag });
    meld(st, 'Voor klantwerk heb je ' + a.software + ' nodig: ' + euro(R.SOFTWARE.bedrag) + ' per vier weken, vanaf vandaag.', 'vraag');
    betaalWatVervalt(st);
  }
  return { ok: true };
}

function voorstel(st, z) {
  const d = vindDeal(st, z.deal);
  if (!d || d.fase !== 'onderhandeling') return fout('Er loopt geen gesprek waarin je een voorstel kunt doen.');
  if (d.vervolg) return fout(d.klant + ' kent je prijs al. Neem zijn aanbod aan of zeg nee.');
  const bedrag = heleEuro(z.bedrag), voorschot = Number(z.voorschot || 0);
  const dagen = z.dagen == null || z.dagen === '' ? d.termijn : Number(z.dagen);
  if (!bedrag) return fout('Noem een bedrag in hele euro\'s.');
  if (![0, 25, 50].includes(voorschot)) return fout('Vraag geen, 25% of 50% vooraf.');
  if (!Number.isInteger(dagen) || dagen < 1 || dagen > 60) return fout('Zeg binnen hoeveel dagen het af is: 1 tot 60.');
  const k = klantVan(st, d.klantId), langst = k.termijn + k.speling;
  d.rondes.push({ van: 'jij', bedrag, voorschot, dagen });
  ontgrendel(st, 'offertes');
  if (bedrag <= k.max && voorschot <= k.voorschot && dagen <= langst) return akkoord(st, d, bedrag, voorschot, dagen);
  const mijn = d.rondes.filter(r => r.van === 'jij').length;
  if (mijn >= 3) {
    d.fase = 'afgehaakt';
    meld(st, k.contact + ' laat het erbij. Drie voorstellen was genoeg.', 'slecht');
    return { ok: true };
  }
  const vorige = d.rondes.filter(r => r.van === 'klant').pop();
  const prijs = bedrag <= k.max ? bedrag : vorige ? Math.min(k.max, opKwartje(vorige.bedrag + (bedrag - vorige.bedrag) / 2)) : k.bod;
  const tegen = { bedrag: prijs, voorschot: Math.min(voorschot, k.voorschot), dagen: Math.min(dagen, langst) };
  d.rondes.push(Object.assign({ van: 'klant' }, tegen));
  const bezwaren = [];
  if (bedrag > k.max) bezwaren.push('ik zat eerder aan ' + euro(tegen.bedrag));
  if (voorschot > k.voorschot) bezwaren.push(k.voorschot ? 'meer dan ' + k.voorschot + '% vooraf doe ik niet' : 'vooraf betaal ik niets');
  if (dagen > langst) bezwaren.push('langer dan ' + langst + ' dagen kan ik niet wachten');
  const zin = bezwaren.join(', en ');
  meld(st, k.contact + ': "' + zin.charAt(0).toUpperCase() + zin.slice(1) + '. Dus: ' + euro(tegen.bedrag) +
    (tegen.voorschot ? ', ' + tegen.voorschot + '% vooraf' : '') + ', af binnen ' + tegen.dagen + ' dagen?"', 'vraag');
  return { ok: true };
}

function neemAan(st, z) {
  const d = vindDeal(st, z.deal);
  const laatste = d && d.fase === 'onderhandeling' ? d.rondes[d.rondes.length - 1] : null;
  if (!laatste || laatste.van !== 'klant') return fout('Er ligt geen bod van de klant om aan te nemen.');
  return akkoord(st, d, laatste.bedrag, laatste.voorschot, laatste.dagen);
}

function weiger(st, z) {
  const d = vindDeal(st, z.deal);
  if (!d || !['kans', 'onderhandeling'].includes(d.fase)) return fout('Er is hier niets om nee tegen te zeggen.');
  d.fase = 'afgehaakt';
  meld(st, 'Je zei nee tegen ' + d.klant + '.');
  return { ok: true };
}

module.exports = { kansen, gesprek, voorstel, neemAan, weiger, sneller };
