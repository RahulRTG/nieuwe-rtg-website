/* Een automatische speler voor Magnaat FROM ZERO: geen slimme, wel een
   redelijke. Hij doet wat een mens zou doen die de Edge volgt -- praten met
   wie iets wil, een voorstel boven het eerste bod, de klant zijn tegenbod
   aannemen, werken tot het af is, leveren, factureren, herinneren, contracten
   tekenen, een extra dienst als het geld op raakt, en zijn baan opzeggen zodra
   het spel zegt dat dat kan. Gebruikt door de reis- en belastingtoetsen. */
'use strict';
const { maakLeven } = require('../server/kern/magnaat-leven');

function maakSpeler({ moeilijkheid = 'normaal', aanbod = 'websites', key = 'speler' } = {}) {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  let s = L.staat(key);
  const doe = (b) => { const r = L.actie(key, b); if (!r.error) s = r; return r; };
  if (moeilijkheid !== 'normaal') doe({ actie: 'moeilijkheid', stand: moeilijkheid });
  doe({ actie: 'kies', aanbod });
  const vind = (f) => s.netwerk.contacten.filter(d => d.fase === f);
  const vrij = () => s.vrijVandaag - (s.vrijVandaag % 30);

  function dag() {
    for (const k of vind('kans')) doe({ actie: 'gesprek', deal: k.id });
    for (const o of vind('onderhandeling')) {
      const l = o.rondes[o.rondes.length - 1];
      if (o.vervolg || (l && l.van === 'klant')) doe({ actie: 'neem', deal: o.id });
      else doe({ actie: 'voorstel', deal: o.id, bedrag: Math.round(o.uren / 60 * 70), voorschot: 25 });
    }
    for (const f of vind('gefactureerd')) if (s.dag > f.factuur.vervaldag && !f.factuur.herinnerd && !f.factuur.gefinancierd) doe({ actie: 'herinnering', deal: f.id });
    for (const d of vind('overeenkomst')) if (d.gedaan >= d.afspraak.minuten) doe({ actie: 'lever', deal: d.id });
    for (const g of vind('geleverd')) doe({ actie: 'factuur', deal: g.id });
    for (const a of s.vandaag.volgende) {
      if (a.actie === 'onderneming') doe({ actie: 'onderneming', naam: 'Speler Oudwijk' });
      if (a.actie === 'teken') doe(Object.assign({ actie: 'teken' }, a.invoer));
      if (a.actie === 'ontslag') doe({ actie: 'ontslag' });
    }
    for (const a of s.vandaag.volgende.filter(x => x.actie === 'plan' && x.invoer && x.invoer.wie)) doe(Object.assign({ actie: 'plan' }, a.invoer));
    const open = vind('overeenkomst').filter(d => d.gedaan < d.afspraak.minuten).sort((a, b) => a.afspraak.deadline - b.afspraak.deadline)[0];
    const extra = s.vandaag.volgende.find(a => a.actie === 'plan' && a.invoer && a.invoer.wat === 'extra' && a.invoer.dag === s.dag);
    if (extra && s.geld.bank < 30000) doe(Object.assign({ actie: 'plan' }, extra.invoer));
    if (vrij()) doe({ actie: 'plan', wat: open ? 'opdracht' : 'project', deal: open && open.id, dag: s.dag, minuten: vrij() });
    doe({ actie: 'slaap' });
  }

  return { dag, L, db, beeld: () => s, st: () => db.data.magnaatLeven[key], key, tijd: (ms) => { t += ms; } };
}

module.exports = { maakSpeler };
