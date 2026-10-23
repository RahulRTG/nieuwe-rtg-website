/* ============================================================================
   VOLTOOIPROEF: COMMERCE (link:commerce, /apps/commerce.html).

   De belofte, in de woorden van routes/commerce.js en COMMERCE.md: de
   verkooplaag boven de domeinen. Een lid ziet wat er te koop staat, legt het
   in een mand, en krijgt PER VERKOPER een afrekening met de btw en wat de
   bevestiging blokkeert -- "met de uitdrukkelijke mededeling dat RTG niets
   namens hen bevestigt". Daarna gaat de keuze als briefje naar de deur van het
   domein dat wel bevestigt (de overdracht); alleen het lid zelf kan dat briefje
   lezen. "Er wordt niets besteld en niets betaald" op deze laag.

   DE ONTVANGER is het domeinscherm dat het briefje leest (shared/overdracht.js)
   met de sessie van het lid, en een ANDER lid dat het briefje-id in handen
   krijgt en er niets mee kan.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const AANBOD = '/api/commerce/aanbod';
const MAND = '/api/commerce/mand';
const ZET = '/api/commerce/mand/zet';
const LEEG = '/api/commerce/mand/leeg';
const OVERDRACHT = '/api/commerce/overdracht/maak';
const LEES = '/api/commerce/overdracht/lees';
const MIJN = '/api/commerce/overdracht/mijn';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'cmc');
  const ander = await nieuwLid(w, 'cmx');
  const T = lid.token;
  let artikel = null, reis = null, briefje = null;
  const mand = async (tok) => ((await w.post(MAND, {}, tok || T)).data) || {};
  const afrekening = (m, code) => (m.afrekeningen || []).find((a) => a.aanbiederCode === code);

  await stap('voltooibaar', 'het lid ziet wat er te koop staat, met verkoper en prijs', async () => {
    const o = await w.post(AANBOD, { alleenKoopbaar: true }, T);
    const k = (o.data && o.data.koopbaren) || [];
    artikel = k.find((x) => String(x.id).startsWith('artikel:') && x.aanbieder && x.aanbieder.code);
    reis = k.find((x) => x.prijsvraag);
    return { klopt: o.status === 200 && k.length > 0 && !!artikel && !!artikel.prijs, ziet: k.length + ' koopbare dingen; ' + (artikel ? artikel.titel + ' bij ' + artikel.aanbieder.naam + ', ' + artikel.prijs.bedrag + ' ' + artikel.prijs.valuta : 'geen artikel') };
  });

  await stap('voltooibaar', 'twee stuks in de mand: een afrekening voor die verkoper, met de btw eruit gerekend en de deur die bevestigt', async () => {
    const r = await w.post(ZET, { koopbaarId: artikel.id, aantal: 2 }, T);
    const a = afrekening(r.data || {}, artikel.aanbieder.code);
    const stuk = Math.round(artikel.prijs.bedrag * 100);
    const btw = a && a.btw ? a.btw.btwCenten + a.btw.nettoCenten : -1;
    return { klopt: r.status === 200 && !!a && a.totaalCenten === 2 * stuk && btw === a.totaalCenten && (a.bevestigBij || []).length >= 1 && r.data.samenBevestigen === false,
      ziet: a ? 'totaal ' + a.totaalCenten + ' ct, btw ' + a.btw.btwCenten + ' ct (' + a.btw.tariefProcent + '%), bevestigen bij ' + a.bevestigBij.join(',') : 'geen afrekening' };
  });

  await stap('voltooibaar', 'iets met een prijsvraag zonder antwoord gaat de mand niet in, en het antwoord zegt welke vraag nog open staat', async () => {
    if (!reis) return { klopt: false, ziet: 'geen koopbaar ding met een prijsvraag in het aanbod' };
    const r = await w.post(ZET, { koopbaarId: reis.id, aantal: 1 }, T);
    const g = ((r.data && r.data.geweigerd) || []).find((x) => x.koopbaarId === reis.id);
    return { klopt: r.status === 200 && !!g && !!g.prijsvraag && !afrekening(r.data, reis.aanbieder && reis.aanbieder.code), ziet: g ? 'geweigerd: "' + g.reden + '", met de vraag erbij' : 'NIET GEWEIGERD' };
  });

  await stap('voltooibaar', 'het aantal op een zetten en dan op nul: de regel verdwijnt en het totaal klopt elke keer', async () => {
    const a = await w.post(ZET, { koopbaarId: artikel.id, aantal: 1, vervang: true }, T);
    const een = afrekening(a.data, artikel.aanbieder.code);
    const b = await w.post(ZET, { koopbaarId: artikel.id, aantal: 0, vervang: true }, T);
    const weg = afrekening(b.data, artikel.aanbieder.code);
    await w.post(ZET, { koopbaarId: artikel.id, aantal: 2, vervang: true }, T);
    return { klopt: a.status === 200 && een && een.regels[0].aantal === 1 && b.status === 200 && !weg, ziet: 'op 1: ' + (een && een.totaalCenten) + ' ct; op 0: ' + (weg ? 'NOG IN DE MAND' : 'weg') };
  });

  await stap('voltooibaar', 'de overdracht: een briefje naar de deur van de verkoper, en dat domeinscherm leest precies de mand', async () => {
    const o = await w.post(OVERDRACHT, { verkoper: artikel.aanbieder.code }, T);
    briefje = o.data && (o.data.id || (o.data.overdracht && o.data.overdracht.id));
    const l = briefje ? await w.post(LEES, { id: briefje }, T) : { status: 0, data: null };
    const tekst = JSON.stringify(l.data || {});
    return { klopt: o.status === 200 && !!briefje && l.status === 200 && tekst.includes(artikel.id) && tekst.includes('"aantal":2'),
      ziet: 'overdracht ' + o.status + ', briefje ' + (briefje ? 'gemaakt' : 'GEEN') + ', lezen op het domeinscherm ' + l.status };
  });

  await stap('bevoegd', 'een ander lid met het briefje-id kan het niet lezen', async () => {
    const l = await w.post(LEES, { id: briefje }, ander.token);
    return { klopt: l.status >= 400 && l.status < 500 && !JSON.stringify(l.data || {}).includes(artikel.id), ziet: 'ander lid: ' + l.status + ' (' + (l.data && l.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const mandVoor = JSON.stringify(afrekening(await mand(), artikel.aanbieder.code));
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de mand er nog, met dezelfde afrekening', async () => {
    const na = JSON.stringify(afrekening(await mand(), artikel.aanbieder.code));
    return { klopt: mandVoor !== undefined && na === mandVoor, ziet: na === mandVoor ? 'gelijk' : 'ANDERS: ' + String(na).slice(0, 80) };
  });
  await stap('persistent', 'het briefje staat bij het lid en is na de herstart nog te lezen', async () => {
    const m = ((((await w.post(MIJN, {}, T)).data) || {}).overdrachten || []);
    const l = await w.post(LEES, { id: briefje }, T);
    return { klopt: m.some((x) => (x.id || x) === briefje || JSON.stringify(x).includes(briefje)) && l.status === 200, ziet: m.length + ' overdracht(en), lezen ' + l.status };
  });
  await stap('persistent', 'het briefje staat in de opslag zelf', async () => {
    const plek = w.vindInOpslag(briefje);
    return { klopt: plek.length >= 1, ziet: 'briefje in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "aantal zetten": het aantal staat goed, niet dubbel', async () => {
    const [a, b] = await w.dubbel(ZET, { koopbaarId: artikel.id, aantal: 3, vervang: true }, T);
    const af = afrekening(await mand(), artikel.aanbieder.code);
    return { klopt: a.status === 200 && geen5xx(b) && af && af.regels[0].aantal === 3, ziet: 'antwoorden ' + a.status + '/' + b.status + ', aantal ' + (af && af.regels[0].aantal) };
  });
  await stap('herstelbaar', 'dubbeltik op de overdracht: een briefje erbij, niet twee', async () => {
    const voor = ((((await w.post(MIJN, {}, T)).data) || {}).overdrachten || []).length;
    const [a, b] = await w.dubbel(OVERDRACHT, { verkoper: artikel.aanbieder.code }, T);
    const na = ((((await w.post(MIJN, {}, T)).data) || {}).overdrachten || []).length;
    return { klopt: a.status === 200 && geen5xx(b) && na === voor + 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', overdrachten ' + voor + ' -> ' + na };
  });
  await stap('herstelbaar', 'een crash direct na het legen van de mand: leeg blijft leeg', async () => {
    const r = await w.post(LEEG, {}, T);
    await w.crash();
    const m = await mand(await inloggen(w, lid));
    return { klopt: r.status === 200 && (m.afrekeningen || []).length === 0, ziet: 'legen ' + r.status + ', na SIGKILL ' + (m.afrekeningen || []).length + ' afrekening(en)' };
  });
  await stap('herstelbaar', 'een crash direct na het toevoegen: het artikel ligt na de herstart in de mand', async () => {
    const r = await w.post(ZET, { koopbaarId: artikel.id, aantal: 1, vervang: true }, T);
    await w.crash();
    const af = afrekening(await mand(), artikel.aanbieder.code);
    return { klopt: r.status === 200 && !!af && af.regels[0].aantal === 1, ziet: 'toevoegen ' + r.status + ', na SIGKILL ' + (af ? af.regels[0].aantal + ' stuk' : 'LEEG') };
  });
}

module.exports = {
  functie: 'link:commerce',
  ingang: '/apps/commerce.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid legt koopbare dingen in een mand, ziet per verkoper een afrekening met btw en wat bevestigen blokkeert, en geeft zijn keuze als briefje door aan de deur die wel bevestigt -- zonder dat hier iets besteld of betaald wordt',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Bevestigen en betalen gebeuren in het domein (de deur van de verkoper) en zijn hier niet gelopen; de weg terug (retour) vraagt een bestelling en is niet gelopen. Een "In mand"-tik telt met opzet op (server/lib/idemsleutels-commerce.js); de dubbeltik is daarom beproefd op het zetten van een aantal. De verkopers zijn synthetisch uit de seed van de testomgeving. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
