/* Magnaat V5: DE BEWAKING -- wat na elke handeling waar moet zijn, en wat er
   gebeurt als het niet waar is.

   GELDINVARIANTEN. Het saldo op je rekening is een projectie van het grootboek
   en nooit een tweede waarheid; je rekening kan niet rood staan; het grootboek
   klopt met zijn eigen journaal; elk saldo is een heel aantal centen; voorraad
   op de plank is precies het aantal stuks tegen inkoopprijs; en elke betaling
   heeft een eigen sleutel. Een fuzz-speler (test/magnaathardening.test.js)
   houdt deze lijst tegen duizenden willekeurige en kwaadaardige handelingen.

   ROLLBACK EN BEVRIEZEN. Gaat een handeling halverwege stuk, dan zijn er twee
   gevallen, en die zijn met opzet verschillend:
     - er is nog niets geboekt: het leven gaat terug naar hoe het was, en de
       speler hoort dat er niets veranderd is;
     - er is al geboekt: het journaal groeit alleen en kan niet terug, dus een
       stille rollback zou de projectie los van het journaal zetten. Dan
       BEVRIEST het leven, met de reden erbij. Je kunt kijken en opnieuw
       beginnen, maar niets meer doen dat op een kapot boek zou bouwen.
   Hetzelfde geldt als de invarianten na een handeling niet meer kloppen. */
'use strict';
const B = require('./regels-bedrijf');
const { teamMax } = require('./bereik');

function controleer(st, boek) {
  const uit = [];
  const kas = boek.saldo(st, ['kas']);
  if (kas !== st.kas) uit.push('je saldo (' + st.kas + ') wijkt af van je rekening in het grootboek (' + kas + ')');
  if (st.kas < 0) uit.push('je rekening staat rood: ' + st.kas);
  const v = boek.verifieer(st);
  if (!v.ok) uit.push('het grootboek klopt niet met zijn journaal');
  for (const [code, x] of Object.entries(st.boek.rekeningen)) {
    if (!Number.isSafeInteger(x.saldo)) uit.push('rekening ' + code + ' is geen heel aantal centen');
  }
  const ids = st.posten.map(p => p.id);
  if (new Set(ids).size !== ids.length) uit.push('twee betalingen delen een sleutel');
  if (!Number.isSafeInteger(st.dag) || st.dag < 1) uit.push('de dag is geen geldige dag');
  const w = st.aanbod && B.HANDELSWAAR[st.aanbod];
  if (st.handel && w) {
    if (st.handel.voorraad < 0) uit.push('er ligt minder dan niets op de plank');
    const plank = boek.saldo(st, ['voorraad']);
    if (plank !== st.handel.voorraad * w.inkoop) uit.push('de voorraad in de boeken (' + plank + ') is niet het aantal stuks tegen inkoopprijs');
  }
  if ((st.team || []).filter(m => !m.weg).length > teamMax(st)) uit.push('meer mensen in je team dan er mogen');
  return uit;
}

function bevries(st, reden, meld) {
  if (st.bevroren) return;
  st.bevroren = { dag: st.dag, reden };
  meld(st, 'Dit leven is bevroren: ' + reden + '. Je kunt kijken en opnieuw beginnen, maar niets doen dat op een kapot boek bouwt.', 'nood');
}

/* Het vangnet zelf, gebouwd op de boeken van een leven. */
function maakVangnet({ boek, save, meld, koppel }) {
  /* Het vangnet om alles wat een leven verandert. Nog niets geboekt: terug naar
     hoe het was. Wel geboekt: bevriezen, want het journaal gaat niet terug.
     En kloppen de invarianten na afloop niet, dan ook bevriezen. */
  return function beschermd(st, doe) {
    /* De opslagstaat is contractueel JSON. SQLite bewaakt hem met een Proxy,
       die structuredClone niet accepteert. Deze ronde maakt dezelfde losse
       rollbackkopie langs de duurzame JSON-grens, zonder de Proxy of een ruwe
       opslagreferentie naar het domein te lekken. */
    const voor = JSON.parse(JSON.stringify(st)), volgorde = st.boek.boekVolgorde;
    try {
      const r = doe();
      const schending = r && r.nieuw ? [] : controleer(st, boek);
      if (!schending.length) return r;
      bevries(st, schending[0], meld);
      save();
      return { status: 409, error: 'Dit leven is bevroren: ' + schending[0] + '.' };
    } catch (e) {
      if (st.boek.boekVolgorde === volgorde) {
        for (const k of Object.keys(st)) delete st[k];
        Object.assign(st, voor);
        koppel(st, boek);
        return { status: 500, error: 'Er ging iets mis bij deze handeling. Er is niets veranderd.' };
      }
      bevries(st, 'een handeling brak af nadat er al geboekt was', meld);
      save();
      return { status: 500, error: 'Er ging iets mis na een boeking. Dit leven is bevroren om je boeken te beschermen; begin opnieuw.' };
    }
  };
}

module.exports = { controleer, bevries, maakVangnet };
