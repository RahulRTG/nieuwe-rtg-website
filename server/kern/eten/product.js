/* Productconfiguratie en prijssnapshot. Keuzes komen nooit als vrije prijs uit
   de browser: alleen keuze-id's worden geaccepteerd en op de actuele kaart van
   de zaak geprijsd. */
'use strict';
const klok = require('../../lib/klok');

function configuratie(item, invoer) {
  const gekozen = new Set(Array.isArray(invoer) ? invoer.map(String) : []);
  const uit = [], allergenen = [];
  let meerprijsCenten = 0;
  for (const groep of (item.opties || [])) {
    const keuzes = (groep.keuzes || []).filter(k => gekozen.has(String(k.id)));
    const min = groep.verplicht ? Math.max(1, Number(groep.min) || 1) : Math.max(0, Number(groep.min) || 0);
    const max = Math.max(min || 1, Number(groep.max) || 1);
    if (keuzes.length < min) return { status:400, code:'optie-verplicht', error:'Kies ' + (groep.naam || 'een optie') + '.' };
    if (keuzes.length > max) return { status:400, code:'optie-te-veel', error:'Kies bij ' + (groep.naam || 'deze opties') + ' maximaal ' + max + '.' };
    for (const k of keuzes) {
      const centen = Math.max(0, Math.round(Number(k.prijsCenten) || 0));
      meerprijsCenten += centen;
      for (const a of (k.allergenen || [])) if (!allergenen.includes(a)) allergenen.push(a);
      uit.push({ groepId:String(groep.id), groep:groep.naam || 'Optie', id:String(k.id), naam:k.naam, prijsCenten:centen });
    }
  }
  return { ok:true, keuzes:uit, meerprijsCenten, allergenen };
}

function prijsversie(items) {
  const bron = items.map(x => [x.itemId, x.centen, x.aantal, (x.opties || []).map(o => o.id).join(',')].join(':')).join('|');
  let h = 2166136261;
  for (let i = 0; i < bron.length; i++) { h ^= bron.charCodeAt(i); h = Math.imul(h, 16777619); }
  return { id:'pv-' + (h >>> 0).toString(16), gecontroleerdAt:klok.datum().toISOString() };
}

module.exports = { configuratie, prijsversie };
