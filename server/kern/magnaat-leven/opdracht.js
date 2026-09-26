/* Magnaat FROM ZERO: VAN AFSPRAAK TOT GELD, EN WAAROM DAT NIET HETZELFDE IS.

   Je levert, je factureert, en dan heb je een VORDERING: het resultaat van de
   opdracht staat in je boeken, maar het geld nog niet op je rekening. Pas als de
   klant betaalt, wordt de vordering kas. De eerste klant betaalt te laat.

   Wat je dan kunt doen, en elk heeft een prijs:
     - een herinnering sturen (na de vervaldag; hij betaalt binnen drie dagen)
     - korting bieden voor directe betaling (geld nu, minder geld)
     - de factuur laten voorfinancieren (90% nu, de rest is kosten; alleen als
       onderneming)
   Extra werken, een nieuwe opdracht, uitstellen en lenen staan elders. */
'use strict';
const R = require('./regels');
const { meld, ontgrendel, klantVan, deal: vindDeal, euro } = require('./staat');
const { boekVan } = require('./boek');
const { mijlpaal } = require('./gids');

const fout = (error) => ({ status: 400, error });

function lever(st, z) {
  const d = vindDeal(st, z.deal);
  if (!d || d.fase !== 'overeenkomst') return fout('Je levert een opdracht op die je hebt afgesproken.');
  if (d.gedaan < d.afspraak.minuten) return fout('Het werk is nog niet af: plan nog ' + Math.ceil((d.afspraak.minuten - d.gedaan) / 60) + ' uur in je agenda.');
  d.fase = 'geleverd';
  d.geleverdOp = st.dag;
  d.laatGeleverd = st.dag > d.afspraak.deadline;
  meld(st, d.laatGeleverd
    ? 'Opgeleverd aan ' + d.klant + ', ' + (st.dag - d.afspraak.deadline) + ' dagen na de deadline. Hij is er niet blij mee.'
    : 'Opgeleverd aan ' + d.klant + ', op tijd. Nu de factuur.', d.laatGeleverd ? 'slecht' : 'goed');
  return { ok: true };
}

/* DE FACTUUR is omzet en een vordering. Een voorschot dat al binnen is, was een
   schuld aan de klant en wordt nu omzet; de rest is wat hij je nog moet. */
function factuur(st, z) {
  const d = vindDeal(st, z.deal);
  if (!d || d.fase !== 'geleverd') return fout('Je factureert werk dat je hebt opgeleverd.');
  const k = klantVan(st, d.klantId), a = d.afspraak;
  const vooraf = d.voorschotOntvangen ? a.voorschotBedrag : 0, rest = a.bedrag - vooraf;
  const nummer = (st.onderneming ? 'F' : 'P') + String(++st.factuurTeller).padStart(3, '0');
  boekVan(st).boek(st, { soort: 'FACTUUR', omschrijving: 'Factuur ' + nummer + ' aan ' + d.klant, sleutel: 'factuur:' + d.id,
    regels: [['debet', ['vooruit', d.klantId], vooraf], ['debet', ['vordering', d.klantId], rest], ['credit', ['omzet'], a.bedrag]] });
  const vervaldag = st.dag + R.BETAALTERMIJN;
  const laat = d.vervolg ? 0 : Math.round(k.laat * R.niveauVan(st).laat / 100) + (d.laatGeleverd ? 7 : 0);
  d.factuur = { nummer, dag: st.dag, totaal: a.bedrag, rest, vervaldag, betaalDag: rest ? vervaldag + laat : st.dag, herinnerd: false };
  d.fase = 'gefactureerd';
  if (!rest) betaal(st, d);
  else meld(st, 'Factuur ' + nummer + ' is verstuurd: ' + euro(a.bedrag) + (vooraf ? ', waarvan ' + euro(vooraf) + ' al vooraf binnen was' : '') +
    '. Je resultaat telt het al; je rekening nog niet. ' + d.klant + ' moet nog ' + euro(rest) + ' betalen, uiterlijk ' + R.dagNaam(vervaldag) + ' (dag ' + vervaldag + ').');
  ontgrendel(st, 'facturen');
  return { ok: true };
}

function betaal(st, d) {
  const f = d.factuur;
  if (f.gefinancierd) {
    meld(st, d.klant + ' heeft factuur ' + f.nummer + ' aan de financier betaald. Jij had dat geld al.');
  } else if (f.rest) {
    const korting = f.korting || 0;
    boekVan(st).boek(st, { soort: 'BETALING_KLANT', omschrijving: 'Betaling factuur ' + f.nummer + ' door ' + d.klant, sleutel: 'betaling:' + d.id,
      regels: [['debet', ['kas'], f.rest - korting], ['debet', ['kosten', 'korting'], korting], ['credit', ['vordering', d.klantId], f.rest]] });
    const teLaat = st.dag - f.vervaldag;
    meld(st, d.klant + ' heeft ' + euro(f.rest - korting) + ' betaald' + (teLaat > 0 ? ', ' + teLaat + ' dagen te laat.' : '.'), 'goed');
  }
  d.fase = 'betaald';
  d.betaaldOp = st.dag;
  mijlpaal(st, 'geld', 'Je eerste geld van een klant: ' + d.klant + ' betaalde factuur ' + f.nummer + '.');
  st.betaald += d.vervolg ? 0 : 1;
}

/* Wat de klanten vandaag doen: een voorschot overmaken, een factuur betalen, of
   de vervaldag laten verstrijken. */
function klantDag(st) {
  for (const d of st.deals) {
    if (d.fase === 'overeenkomst' && d.voorschotDag === st.dag && !d.voorschotOntvangen) {
      d.voorschotOntvangen = true;
      boekVan(st).boekOver(st, { soort: 'VOORSCHOT', van: ['vooruit', d.klantId], naar: ['kas'], bedrag: d.afspraak.voorschotBedrag,
        omschrijving: 'Voorschot van ' + d.klant, sleutel: 'voorschot:' + d.id });
      meld(st, d.klant + ' heeft het voorschot betaald: ' + euro(d.afspraak.voorschotBedrag) + '. Dat is nog geen omzet: je moet er werk voor leveren.', 'goed');
    }
    if (d.fase === 'overeenkomst' && d.afspraak.deadline - 2 === st.dag && d.gedaan < d.afspraak.minuten) {
      meld(st, 'Over twee dagen moet het werk voor ' + d.klant + ' af zijn, en er staat nog ' + Math.ceil((d.afspraak.minuten - d.gedaan) / 60) + ' uur open.', 'nood');
    }
    if (d.fase !== 'gefactureerd') continue;
    const f = d.factuur;
    if (st.dag >= f.betaalDag) { betaal(st, d); continue; }
    if (st.dag === f.vervaldag + 1) {
      meld(st, d.klant + ' heeft factuur ' + f.nummer + ' niet op tijd betaald. Er staat nog ' + euro(f.rest) + ' open.', 'nood');
      ontgrendel(st, 'herinneringen');
    }
  }
}

function herinnering(st, z) {
  const d = vindDeal(st, z.deal);
  if (!d || d.fase !== 'gefactureerd' || d.factuur.gefinancierd) return fout('Je herinnert een klant aan een factuur die nog bij jou openstaat.');
  const f = d.factuur;
  if (st.dag <= f.vervaldag) return fout('De betaaltermijn loopt tot ' + R.dagNaam(f.vervaldag) + '. Een herinnering daarvoor is onbeleefd.');
  if (f.herinnerd) return fout('Je hebt al een herinnering gestuurd. ' + d.klant + ' heeft betaling beloofd.');
  f.herinnerd = true;
  f.betaalDag = Math.min(f.betaalDag, st.dag + R.HERINNERING_DAGEN);
  meld(st, 'Herinnering verstuurd. ' + d.klant + ' belooft binnen ' + R.HERINNERING_DAGEN + ' dagen te betalen.');
  return { ok: true };
}

function korting(st, z) {
  const d = vindDeal(st, z.deal), pct = Number(z.procent);
  if (!d || d.fase !== 'gefactureerd' || d.factuur.gefinancierd) return fout('Korting bied je op een factuur die nog bij jou openstaat.');
  if (!Number.isInteger(pct) || pct < 1 || pct > 20) return fout('Bied een korting van 1 tot 20 procent.');
  const k = klantVan(st, d.klantId), f = d.factuur;
  if (d.vervolg || k.korting == null || pct < k.korting) {
    meld(st, d.klant + ' gaat niet in op ' + pct + '% korting voor directe betaling.', 'slecht');
    return { ok: true };
  }
  f.korting = Math.round(f.rest * pct / 100);
  f.betaalDag = st.dag + 1;
  meld(st, d.klant + ' betaalt morgen, met ' + pct + '% korting: je krijgt ' + euro(f.rest - f.korting) + ' in plaats van ' + euro(f.rest) + '.');
  return { ok: true };
}

function voorfinancier(st, z) {
  const d = vindDeal(st, z.deal);
  if (!d || d.fase !== 'gefactureerd' || d.factuur.gefinancierd) return fout('Je laat een factuur voorfinancieren die nog bij jou openstaat.');
  if (!st.onderneming) return fout('Een financier koopt facturen van ondernemingen, niet van particulieren.');
  const f = d.factuur, krijg = Math.floor(f.rest * R.VOORFINANCIERING.deel / 100);
  boekVan(st).boek(st, { soort: 'VOORFINANCIERING', omschrijving: 'Factuur ' + f.nummer + ' voorgefinancierd', sleutel: 'financiering:' + d.id,
    regels: [['debet', ['kas'], krijg], ['debet', ['kosten', 'financiering'], f.rest - krijg], ['credit', ['vordering', d.klantId], f.rest]] });
  f.gefinancierd = true;
  meld(st, 'De financier maakt ' + euro(krijg) + ' over. De ' + euro(f.rest - krijg) + ' die overblijft zijn je kosten; ' + d.klant + ' betaalt voortaan aan hem.');
  return { ok: true };
}

module.exports = { lever, factuur, klantDag, herinnering, korting, voorfinancier };
