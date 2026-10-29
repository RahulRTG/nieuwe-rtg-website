/* ============================================================================
   VOLTOOIPROEF: ATTENTIES (link:attenties, /apps/attenties.html).

   De belofte, in de woorden van kern/rechterhand/attenties.js: relatiebeheer.
   Per relatie de band, de belangrijke data (verjaardag, jubileum) en de
   voorkeuren; daarnaast de giftgeschiedenis, "zodat u nooit twee keer hetzelfde
   geeft". Het overzicht toont wie er de komende dertig dagen een attentie
   verdient.
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');
const tijdzone = require('../../../server/kern/tijdzone');

const OVERZICHT = '/api/member/rechterhand/attenties';
const RELATIE = '/api/member/rechterhand/attenties/relatie';
const RELATIE_WEG = '/api/member/rechterhand/attenties/relatie/weg';
const GIFT = '/api/member/rechterhand/attenties/gift';
const GIFT_WEG = '/api/member/rechterhand/attenties/gift/weg';

/* 'MM-DD' over n dagen, en het bijbehorende jaar-loze getal. */
const dag = (n) => tijdzone.plusDagen(tijdzone.huis().datum, n);
const mmdd = (n) => dag(n).slice(5, 10);

async function loop(w, stap) {
  const merk = 'at' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'att');
  const T = lid.token;
  const over = async (tok) => { const r = await w.post(OVERZICHT, {}, tok || T); return r.status === 200 ? r.data : null; };
  const rel = async (naam) => ((await over()) || { relaties: [] }).relaties.find((r) => r.naam === naam);

  await stap('voltooibaar', 'een relatie die over tien dagen jarig is, verschijnt bij wie een attentie verdient', async () => {
    const r = await w.post(RELATIE, { naam: 'Tante ' + merk, band: 'familie', verjaardag: mmdd(10), voorkeuren: 'orchideeen' }, T);
    const o = await over();
    const a = o.aankomend.find((x) => x.naam === 'Tante ' + merk);
    return { klopt: r.status === 200 && !!a && a.soort === 'verjaardag' && a.dagenTot === 10, ziet: a ? a.naam.split(' ')[0] + ': ' + a.soort + ' over ' + a.dagenTot + ' dagen' : 'niet aankomend' };
  });

  await stap('voltooibaar', 'een relatie wier jubileum pas over twee maanden is, staat er niet tussen', async () => {
    const r = await w.post(RELATIE, { naam: 'Partner ' + merk, band: 'zakelijk', jubileum: mmdd(60) }, T);
    const o = await over();
    const p = o.relaties.find((x) => x.naam === 'Partner ' + merk);
    return { klopt: r.status === 200 && !o.aankomend.some((x) => x.naam === 'Partner ' + merk) && p && p.dagenTot === 60 && p.volgendeSoort === 'jubileum',
      ziet: 'partner over ' + (p && p.dagenTot) + ' dagen (' + (p && p.volgendeSoort) + '), aankomend: ' + o.aankomend.length };
  });

  await stap('voltooibaar', 'een gift aan de tante staat in haar geschiedenis, zodat het lid niet twee keer hetzelfde geeft', async () => {
    const t = await rel('Tante ' + merk);
    const g = await w.post(GIFT, { relatieId: t.id, wat: 'Orchidee ' + merk, gelegenheid: 'verjaardag', datum: dag(-365), bedrag: 60 }, T);
    const na = await rel('Tante ' + merk);
    return { klopt: g.status === 200 && na.giften.length === 1 && na.giften[0].wat === 'Orchidee ' + merk, ziet: na.giften.length + ' gift: ' + (na.giften[0] && na.giften[0].wat) };
  });

  await stap('voltooibaar', 'een gift zonder relatie wordt geweigerd met de reden', async () => {
    const r = await w.post(GIFT, { relatieId: 'bestaatniet', wat: 'Boek' }, T);
    return { klopt: r.status === 404 && /Kies eerst een relatie/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'de gift weghalen en daarna de relatie: er blijft geen wees-gift achter', async () => {
    const t = await rel('Tante ' + merk);
    const x = await w.post(GIFT_WEG, { id: t.giften[0].id }, T);
    await w.post(GIFT, { relatieId: t.id, wat: 'Wijn ' + merk }, T);
    const y = await w.post(RELATIE_WEG, { id: t.id }, T);
    const o = await over();
    return { klopt: x.status === 200 && y.status === 200 && !o.relaties.some((r) => r.naam === 'Tante ' + merk) && !o.giften.some((g) => String(g.wat).includes(merk)),
      ziet: o.relaties.length + ' relatie(s), giften met dit merk: ' + o.giften.filter((g) => String(g.wat).includes(merk)).length };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'relatie',
    alle: async (tok) => { const o = await over(tok); return o ? o.relaties : null; },
    naamVan: (r) => r.naam,
    maak: (naam) => ({ pad: RELATIE, lijf: { naam, band: 'vriend', verjaardag: mmdd(100) } }),
    weg: (r) => ({ pad: RELATIE_WEG, lijf: { id: r.id } })
  });
}

module.exports = {
  functie: 'link:attenties',
  ingang: '/apps/attenties.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid onderhoudt zijn relaties: wie er binnen dertig dagen een attentie verdient, met de giftgeschiedenis zodat hij nooit twee keer hetzelfde geeft',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er wordt niets besteld of verstuurd: een gift is een aantekening van het lid. De relaties zijn geen accounts en krijgen niets te zien. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
