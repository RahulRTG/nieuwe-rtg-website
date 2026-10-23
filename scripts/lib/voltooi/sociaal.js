/* ============================================================================
   VOLTOOIPROEF: RTG SOCIAAL (link:sociaal, /apps/sociaal.html).

   De belofte (LIFE.md fase 5, kern/socialecommand): "Life OS stelt samen en
   zet klaar. Bevestigen doet de mens." Het scherm toont de kring van het lid
   (/api/sociaal/wereld), de momentlijn (/lijn) en Life Command (/command) met
   wat er klaarstaat; de ENIGE schrijvende route is /voorstel/bevestig. Een
   voorstel hangt aan een openstaande zaak: een bijeenkomst in een eigen
   genootschap waar het lid nog niet op antwoordde.

   De openstaande zaak wordt gemaakt zoals leden dat doen: A richt een besloten
   genootschap op en nodigt B uit, B treedt binnen, A roept een bijeenkomst
   bijeen (routes van Genootschap, niet van dit scherm -- dat is de opbouw, de
   schakels lopen over de routes van Sociaal). Daarna ziet B het voorstel,
   kiest, en A ziet het antwoord.

   HET WEEKEND. Op zaterdag en zondag zet Rahul met opzet niets klaar
   (kern/socialebeleid, "Weekend zonder voorstellen"). Draait de proef op een
   weekenddag, dan verzet de omgeving de tijdmachine (RTG_KLOK, server/lib/
   klok.js) naar de maandag erop; op een werkdag draait de klok gewoon mee.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const WERELD = '/api/sociaal/wereld';
const COMMAND = '/api/sociaal/command';
const LIJN = '/api/sociaal/lijn';
const OBJECT = '/api/sociaal/object';
const BEVESTIG = '/api/sociaal/voorstel/bevestig';

/* Dagen dat de tijdmachine vooruit staat: 0 op een werkdag, anders tot maandag.
   De data van de bijeenkomsten rekenen vanaf DIE dag, zodat ze voor de server
   net zo ver in de toekomst liggen als op een werkdag. */
const VERSCHUIF = ({ 6: 2, 0: 1 })[new Date().getDay()] || 0;
const dag = (n) => new Date(Date.now() + (n + VERSCHUIF) * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'sc' + Date.now().toString(36);
  const A = await nieuwLid(w, 'sca');
  const B = await nieuwLid(w, 'scb');
  const C = await nieuwLid(w, 'scc');
  let groep = null, voorstelId = null, codeB = null;
  const tel = (b) => b ? b.ja + '/' + b.misschien + '/' + b.nee : 'geen';

  const command = async (tok) => { const r = await w.post(COMMAND, {}, tok); return r.status === 200 ? r.data : null; };
  const voorstellenVan = async (tok, wat) => ((await command(tok)) || { voorstellen: [] }).voorstellen.filter((v) => v.titel === wat);
  const antwoordBij = async (tok, wat) => {
    const a = await w.post('/api/genootschap/agenda', { groep: groep.id }, tok);
    const b = ((a.data && a.data.komt) || []).find((x) => x.wat === wat);
    return { status: a.status, b };
  };
  const log = async (tok) => { const r = await w.post('/api/sociaal/actielog', {}, tok); return (r.data && r.data.log) || []; };
  async function bijeenkomst(wat, n) {
    const r = await w.post('/api/genootschap/roep-bijeen', { groep: groep.id, wat, waar: 'De Salon', datum: dag(n), tijd: '20:00' }, A.token);
    if (r.status !== 200) throw new Error('bijeenroepen lukte niet (' + r.status + ': ' + (r.data && r.data.error) + ')');
    return r.data.bijeenkomst;
  }

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'A en B kennen elkaar via de Salon; het scherm opent voor allebei met een kring en geen voorstel', async () => {
    await verbind(w, A, B);
    const wa = await w.post(WERELD, {}, A.token), ca = await command(A.token), cb = await command(B.token);
    return { klopt: wa.status === 200 && !!ca && !!cb && ca.voorstellen.length === 0 && cb.voorstellen.length === 0 && cb.rustig === true,
      ziet: 'wereld ' + wa.status + ', voorstellen A ' + (ca && ca.voorstellen.length) + ' / B ' + (cb && cb.voorstellen.length) + ', B rustig=' + (cb && cb.rustig) };
  });

  await stap('voltooibaar', 'A roept in een besloten genootschap een bijeenkomst bijeen; B ziet een klaargezet voorstel met de verantwoording erbij', async () => {
    const g = await w.post('/api/genootschap/richt-op', { naam: 'Leesclub ' + merk, soort: 'besloten' }, A.token);
    groep = g.data && g.data.groep;
    codeB = (await w.post('/api/member/connections', {}, B.token)).data.codename;
    const n = await w.post('/api/genootschap/nodig-uit', { groep: groep && groep.id, wie: codeB }, A.token);
    const t = await w.post('/api/genootschap/binnen', { groep: groep && groep.id }, B.token);
    await bijeenkomst('Avond ' + merk, 5);
    const v = await voorstellenVan(B.token, 'Avond ' + merk);
    voorstelId = v[0] && v[0].id;
    return { klopt: g.status === 200 && n.status === 200 && t.status === 200 && v.length === 1 &&
      v[0].keuzes.join(',') === 'ja,misschien,nee' && (v[0].gegevens || []).some((x) => /uw antwoord: nog geen/.test(x)),
      ziet: 'genootschap ' + g.status + ', uitnodiging ' + n.status + ', binnen ' + t.status + ', ' + v.length + ' voorstel: ' + (v[0] && v[0].wat) };
  });

  await stap('voltooibaar', 'een keuze buiten het voorstel wordt geweigerd met de keuzes erbij, en er gebeurt niets', async () => {
    const r = await w.post(BEVESTIG, { id: voorstelId, keuze: 'altijd' }, B.token);
    const v = await voorstellenVan(B.token, 'Avond ' + merk);
    return { klopt: r.status === 400 && /ja, misschien, nee/.test((r.data && r.data.error) || '') && v.length === 1,
      ziet: r.status + ' (' + (r.data && r.data.error) + '), voorstel staat nog: ' + v.length };
  });

  await stap('voltooibaar', 'B bevestigt "ja": A ziet het antwoord, het voorstel is weg, en het actielog zegt dat de mens bevestigde', async () => {
    const r = await w.post(BEVESTIG, { id: voorstelId, keuze: 'ja' }, B.token);
    const a = await antwoordBij(A.token, 'Avond ' + merk);
    const v = await voorstellenVan(B.token, 'Avond ' + merk);
    const l = (await log(B.token)).filter((x) => /Avond /.test(x.wat || ''));
    return { klopt: r.status === 200 && r.data.gelogd === true && !!a.b && a.b.ja === 1 && a.b.komen.includes(codeB) && v.length === 0 &&
      l.length === 1 && l[0].wie === 'lid' && /bevestigd door u/.test(l[0].waarom || ''),
      ziet: 'bevestig ' + r.status + ', A ziet ja/misschien/nee ' + tel(a.b) + ', komen ' + JSON.stringify(a.b && a.b.komen) + ', voorstel ' + v.length + ', log ' + l.length };
  });

  await stap('voltooibaar', 'de momentlijn van B draagt de bijeenkomst op zijn datum', async () => {
    const r = await w.post(LIJN, {}, B.token);
    const tekst = JSON.stringify(r.data || {});
    return { klopt: r.status === 200 && tekst.includes('Avond ' + merk) && tekst.includes(dag(5)), ziet: 'lijn ' + r.status + ', bijeenkomst ' + (tekst.includes('Avond ' + merk) ? 'erin' : 'NIET erin') };
  });

  /* Bevoegdheid. */
  await stap('bevoegd', 'bevoegd: zonder inlog geven de wereld, Life Command, de lijn en bevestigen 401', async () => {
    const r = await Promise.all([w.post(WERELD, {}), w.post(COMMAND, {}), w.post(LIJN, {}), w.post(BEVESTIG, { id: voorstelId, keuze: 'nee' })]);
    return { klopt: r.every((x) => x.status === 401), ziet: r.map((x) => x.status).join('/') };
  });

  await stap('bevoegd', 'bevoegd: een lid buiten het genootschap ziet het voorstel niet, kan het niet bevestigen en hoort niet of de groep bestaat', async () => {
    const tweede = await bijeenkomst('Lunch ' + merk, 6);
    const idB = (await voorstellenVan(B.token, 'Lunch ' + merk))[0];
    const vC = await voorstellenVan(C.token, 'Lunch ' + merk);
    const r = await w.post(BEVESTIG, { id: idB && idB.id, keuze: 'ja' }, C.token);
    const o = await w.post(OBJECT, { soort: 'groep', id: groep.id }, C.token);
    const nogB = await voorstellenVan(B.token, 'Lunch ' + merk);
    const a = await antwoordBij(A.token, 'Lunch ' + merk);
    return { klopt: !!tweede && !!idB && vC.length === 0 && r.status === 404 && o.status === 404 && o.data.error === 'Dit vinden we niet.' &&
      nogB.length === 1 && !!a.b && a.b.ja === 0,
      ziet: 'C ziet ' + vC.length + ' voorstel, bevestigt ' + r.status + ', object ' + o.status + '; B houdt ' + nogB.length + ' voorstel' };
  });

  /* Een gratis account met eigen account mag hier in (server.js, geenGast
     weert alleen een gast ZONDER account), dus een pas-eis speelt op dit scherm
     niet. Wat wel speelt: een bevestiging handelt alleen voor wie bevestigt. */
  await stap('bevoegd', 'bevoegd: de bevestiging van B handelt alleen voor B: het voorstel van gastheer A voor dezelfde avond blijft open', async () => {
    const vA = await voorstellenVan(A.token, 'Avond ' + merk);
    const a = await antwoordBij(A.token, 'Avond ' + merk);
    return { klopt: vA.length === 1 && vA[0].id === voorstelId && !!a.b && a.b.mijnAntwoord === null && a.b.ja === 1,
      ziet: 'A heeft ' + vA.length + ' open voorstel, eigen antwoord ' + (a.b && a.b.mijnAntwoord) + ', ja-stemmen ' + (a.b && a.b.ja) };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het antwoord van B er nog, en het voorstel komt niet terug', async () => {
    const a = await antwoordBij(A.token, 'Avond ' + merk);
    const v = await voorstellenVan(B.token, 'Avond ' + merk);
    return { klopt: !!a.b && a.b.ja === 1 && a.b.komen.includes(codeB) && v.length === 0, ziet: 'antwoorden ' + tel(a.b) + ', voorstel ' + v.length };
  });
  await stap('persistent', 'een nieuwe sessie van B leest hetzelfde actielog, met een regel', async () => {
    const T = await inloggen(w, B);
    const l = (await log(T)).filter((x) => /Avond /.test(x.wat || ''));
    const v = await voorstellenVan(T, 'Lunch ' + merk);
    return { klopt: l.length === 1 && v.length === 1, ziet: 'nieuwe sessie: ' + l.length + ' logregel, nog open ' + v.length };
  });
  await stap('persistent', 'het genootschap en de bijeenkomst staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const g = w.vindInOpslag('Leesclub ' + merk), b = w.vindInOpslag('Avond ' + merk);
    return { klopt: g.length >= 1 && b.length >= 1, ziet: 'genootschap in ' + g.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; bijeenkomst in ' + b.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "ja" (tegelijk): een antwoord en een logregel, geen kale fout', async () => {
    const v = (await voorstellenVan(B.token, 'Lunch ' + merk))[0];
    const [a, b] = await w.dubbel(BEVESTIG, { id: v && v.id, keuze: 'ja' }, B.token);
    const l = (await log(B.token)).filter((x) => /Lunch /.test(x.wat || ''));
    const r = await antwoordBij(A.token, 'Lunch ' + merk);
    return { klopt: [a.status, b.status].sort().join() === '200,404' && geen5xx(b) && l.length === 1 && !!r.b && r.b.ja === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + l.length + ' logregel' };
  });
  await stap('herstelbaar', 'een afgebroken bevestiging, daarna opnieuw: het antwoord staat er precies een keer', async () => {
    await bijeenkomst('Wandeling ' + merk, 7);
    const v = (await voorstellenVan(B.token, 'Wandeling ' + merk))[0];
    const half = await w.afgebroken(BEVESTIG, { id: v && v.id, keuze: 'misschien' }, B.token);
    const opnieuw = await w.post(BEVESTIG, { id: v && v.id, keuze: 'misschien' }, B.token);
    const l = (await log(B.token)).filter((x) => /Wandeling /.test(x.wat || ''));
    const r = await antwoordBij(A.token, 'Wandeling ' + merk);
    return { klopt: [200, 404].includes(opnieuw.status) && l.length === 1 && !!r.b && r.b.misschien === 1 && r.b.ja === 0 &&
      (await voorstellenVan(B.token, 'Wandeling ' + merk)).length === 0,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ' (404 = stond al), ' + l.length + ' logregel' };
  });
  await stap('herstelbaar', 'een crash direct na het bevestigen: het antwoord en de logregel overleven, het voorstel komt niet terug', async () => {
    await bijeenkomst('Diner ' + merk, 8);
    const v = (await voorstellenVan(B.token, 'Diner ' + merk))[0];
    const r = await w.post(BEVESTIG, { id: v && v.id, keuze: 'nee' }, B.token);
    await w.crash();
    const a = await antwoordBij(A.token, 'Diner ' + merk);
    const l = (await log(B.token)).filter((x) => /Diner /.test(x.wat || ''));
    const terug = await voorstellenVan(B.token, 'Diner ' + merk);
    return { klopt: r.status === 200 && !!a.b && a.b.nee === 1 && l.length === 1 && terug.length === 0,
      ziet: 'bevestig ' + r.status + ', na SIGKILL antwoorden ' + tel(a.b) + ', ' + l.length + ' logregel, voorstel ' + terug.length };
  });
}

module.exports = {
  functie: 'link:sociaal',
  ingang: '/apps/sociaal.html',
  persona: 'lid',
  omgeving: VERSCHUIF ? { RTG_KLOK: '+' + VERSCHUIF + 'd' } : {},
  belofte: 'Rahul zet klaar wat er openstaat in de kring van het lid, de mens bevestigt, de ander ziet het antwoord, en het actielog verantwoordt het -- wie buiten de groep staat ziet en bevestigt niets, en een herstart, dubbele tik, afgebroken verzoek of crash verliest of verdubbelt niets',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De openstaande zaak (genootschap, uitnodiging, bijeenkomst) wordt over de routes van Genootschap opgebouwd. De gesprekken in de kring (/api/comm/inbox) en de live stroom lopen niet mee. Op een weekenddag verzet de tijdmachine de klok naar maandag, omdat Rahul in het weekend met opzet niets klaarzet. Geen Redis of PostgreSQL in de wereld.',
  loop
};
