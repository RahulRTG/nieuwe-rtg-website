'use strict';
const crypto = require('node:crypto');
const { maakMall } = require('../server/kern/mall');
const { maakExperience } = require('../server/kern/experience');
function supplier(code, extra = {}) {
  return { code, name: 'Aanbieder ' + code, type: 'retail', city: 'Haarlem', country: 'NL',
    artikelen: [{ id: 'p1', naam: 'Product ' + code, publiekePrijs: 40, varianten: [{ voorraad: 5 }] }], ...extra };
}
function fixture(suppliers = [supplier('A')]) {
  const db = { data: { suppliers, supplierTypes: { retail: { label: 'Retail', caps: ['retail'] } },
    partnerTrips: [], markt: { ads: [] } } };
  require('../server/kern/werkvormen').haakAan(db);
  let saves = 0, tail = Promise.resolve();
  const save = () => { saves++; };
  const bijeen = fn => { const run = tail.then(fn); tail = run.catch(() => {}); return run; };
  const mall = maakMall({ db, bijeen, save, crypto, isRetail: s => s.type === 'retail',
    haalThuis: () => null, haalLandVind: () => null }).mall;
  const kern = { mall, mijnReizen: () => ({ reizen: [], los: [] }),
    kantoorwereld: { werkdag: key => ({ regels: [{ soort: 'taak', titel: 'Taak van ' + key,
      kenmerk: key + '-1', link: '/apps/notities.html' }], bronnen: ['taken'], stil: [] }) } };
  const experience = maakExperience({ kern, db, save, crypto, bijeen }).experience;
  return { db, kern, experience, saves: () => saves };
}
const request = (world = 'work', intent = {}) => ({ key: 'alice', body: { world,
  intent: { goal: 'Een plan', needs: ['product'], city: 'Haarlem', country: 'NL', ...intent } } });
function choices(result) { return result.proposal.needs.flatMap(n => n.options.slice(0, 1)).map(o => ({ id: o.id, revision: o.revision })); }
module.exports = { fixture, supplier, request, choices };
