/* ============================================================================
   VOLTOOIPROEF: VLUCHTEN (link:vluchten, /apps/vluchten.html).

   De belofte, in de woorden van het scherm: het vertrekbord van RTG Airport,
   een vlucht boeken ("Inchecken kan zodra het open staat"), inchecken met
   koffers en een boarding pass met een eenmalige code, die pass roteren als
   hij kwijt is of intrekken, en een charter (privejet of helikopter)
   aanvragen dat operations daarna bevestigt.

   DE GEGEVENSPOORT IS DEEL VAN DE BELOFTE. Over een grens vragen de
   maatschappij en de grens paspoortgegevens (kern/gegevenspoort.js: "dat is
   hun eis, niet die van ons"). De proef laat het lid die eerst missen en dan
   een keer opgeven langs de route van de paspoortscan, zoals een lid dat doet.

   DE EENMALIGE CODE WORDT NIET OPNIEUW GETOOND. Een afgebroken incheck is dus
   precies het geval waarvoor roteren bestaat: de tweede poging hoort te zeggen
   dat er al is ingecheckt en hoe je aan een nieuwe pass komt, en roteren
   hoort die te geven.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const BORD = '/api/member/vluchten/bord';
const BOEK = '/api/member/vluchten/boek';
const MIJN = '/api/member/vluchten/mijn';
const INCHECK = '/api/member/vluchten/incheck';
const ROTEER = '/api/member/vluchten/pass/roteer';
const INTREK = '/api/member/vluchten/pass/intrek';
const CHARTER = '/api/member/vluchten/charter';
const PASPOORT = { nummer: 'NX7654321', vervaldatum: '2031-01-01', nationaliteit: 'Nederlandse', geboortedatum: '1985-05-05' };

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = Date.now().toString(36).slice(-4);
  const A = await nieuwLid(w, 'vla');
  const B = await nieuwLid(w, 'vlb');
  let T = A.token;
  const mijn = async (tok) => ((await w.post(MIJN, {}, tok || T)).data) || {};
  const boeking = async (id, tok) => ((await mijn(tok)).boekingen || []).find((b) => b.id === id) || null;
  let open = null, later = null, boekId = null, pass = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het vertrekbord toont de vluchten met gate en stand, en minstens een vlucht waarvoor het inchecken open is', async () => {
    const r = await w.post(BORD, {}, T);
    const v = (r.data.vluchten || []).filter((x) => x.soort === 'vertrek');
    open = v.find((x) => x.status === 'inchecken');
    later = v.find((x) => x.status === 'gepland');
    return { klopt: r.status === 200 && v.length >= 2 && !!open && !!open.gate && Array.isArray(r.data.gates),
      ziet: r.status + ', ' + v.length + ' vertrekken, open voor inchecken: ' + (open ? open.nummer + ' gate ' + open.gate : 'GEEN') };
  });

  await stap('voltooibaar', 'zonder paspoortgegevens boekt het lid niet, en hoort waarom -- het is de eis van de maatschappij en de grens', async () => {
    const r = await w.post(BOEK, { id: open.id }, T);
    const veld = ((r.data && r.data.ontbreekt) || []).map((x) => x.veld);
    return { klopt: r.status === 428 && veld.includes('reisdocument') && /paspoort/.test(r.data.error) && !(await mijn()).boekingen.length,
      ziet: r.status + ' (' + (r.data && r.data.error) + '), ontbreekt: ' + veld.join(', ') };
  });

  await stap('voltooibaar', 'na de paspoortscan boekt het lid de vlucht; hij staat in Mijn vluchten als geboekt', async () => {
    const p = await w.post('/api/onboarding/paspoort', PASPOORT, T);
    const r = await w.post(BOEK, { id: open.id }, T);
    boekId = r.data && r.data.boeking && r.data.boeking.id;
    const b = await boeking(boekId);
    return { klopt: p.status === 200 && r.status === 200 && !!b && b.status === 'geboekt' && b.vlucht.nummer === open.nummer,
      ziet: 'paspoort ' + p.status + ', boeken ' + r.status + ', in Mijn vluchten: ' + (b ? b.vlucht.nummer + ' ' + b.status : 'NIETS') };
  });

  await stap('voltooibaar', 'een vlucht waarvoor het inchecken nog niet open is, zegt dat met zoveel woorden', async () => {
    if (!later) return { klopt: false, ziet: 'geen geplande vlucht op het bord' };
    const r = await w.post(BOEK, { id: later.id }, T);
    const id = r.data && r.data.boeking && r.data.boeking.id;
    const c = await w.post(INCHECK, { id, koffers: 0 }, T);
    return { klopt: r.status === 200 && c.status === 409 && /nog niet open/.test(c.data.error), ziet: 'boeken ' + r.status + ', inchecken ' + c.status + ' (' + (c.data && c.data.error) + ')' };
  });

  await stap('voltooibaar', 'het lid checkt in met een koffer en krijgt een boarding pass met een eenmalige code', async () => {
    const r = await w.post(INCHECK, { id: boekId, koffers: 1 }, T);
    pass = r.data && r.data.pass;
    const b = await boeking(boekId);
    return { klopt: r.status === 200 && !!pass && !!pass.code && pass.eenmalig === true && b.status === 'ingecheckt' && !JSON.stringify(b).includes(pass.code),
      ziet: 'inchecken ' + r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', boeking ' + (b && b.status) + ', code alleen in dit antwoord: ' + (b && !JSON.stringify(b).includes(pass && pass.code)) };
  });

  await stap('bevoegd', 'een ander lid ziet de boeking niet en kan er niet mee inchecken, roteren of intrekken', async () => {
    const zicht = await boeking(boekId, B.token);
    const r = await w.post(ROTEER, { id: boekId, rotatie: 1 }, B.token);
    const x = await w.post(INTREK, { id: boekId, rotatie: 1 }, B.token);
    return { klopt: !zicht && r.status === 404 && x.status === 404, ziet: 'B ziet ' + (zicht ? 'HEM' : 'niets') + ', roteren ' + r.status + ', intrekken ' + x.status };
  });

  await stap('voltooibaar', 'het lid vraagt een helikopter aan; de aanvraag staat bij hem als aangevraagd, wachtend op operations', async () => {
    const r = await w.post(CHARTER, { soort: 'helikopter', bestemming: 'Formentera ' + merk, datum: dag(3), tijd: '10:30' }, T);
    const c = ((await mijn()).charters || []).find((x) => x.bestemming === 'Formentera ' + merk);
    return { klopt: r.status === 200 && !!c && c.status === 'aangevraagd', ziet: 'aanvraag ' + r.status + ', ' + (c ? c.code + ' ' + c.status : 'NIET in Mijn vluchten') };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await boeking(boekId));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de boeking er nog, ingecheckt, met dezelfde pass-stand', async () => {
    const na = JSON.stringify(await boeking(boekId));
    return { klopt: voor !== 'null' && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS: ' + na.slice(0, 120) };
  });

  await stap('persistent', 'een nieuwe sessie ziet dezelfde boeking en de charteraanvraag', async () => {
    T = await inloggen(w, A);
    const m = await mijn();
    const b = (m.boekingen || []).find((x) => x.id === boekId);
    return { klopt: JSON.stringify(b) === voor && (m.charters || []).some((c) => c.bestemming === 'Formentera ' + merk),
      ziet: (JSON.stringify(b) === voor ? 'boeking gelijk' : 'ANDERS') + ', ' + (m.charters || []).length + ' charter(s)' };
  });

  await stap('persistent', 'de opslag draagt de boeking en de charter, en de eenmalige code staat er niet kaal in', async () => {
    const b = w.vindInOpslag(boekId).filter((p) => p.sleutel !== 'audit');
    const c = w.vindInOpslag('Formentera ' + merk).filter((p) => p.sleutel !== 'audit');
    const rauw = w.vindInOpslag(pass.code);
    return { klopt: b.length >= 1 && c.length >= 1 && rauw.length === 0,
      ziet: 'boeking in ' + b.map((p) => p.sleutel || p.tabel).join(', ') + '; charter in ' + c.length + ' plek(ken); kale code in ' + rauw.length };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "Boek": een boeking, niet twee', async () => {
    const C = await nieuwLid(w, 'vlc');
    await w.post('/api/onboarding/paspoort', PASPOORT, C.token);
    const [a, b] = await w.dubbel(BOEK, { id: open.id }, C.token);
    const n = ((await mijn(C.token)).boekingen || []).length;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' boeking(en)' };
  });

  await stap('herstelbaar', 'een afgebroken incheck: opnieuw zegt dat er al is ingecheckt, en roteren geeft een nieuwe pass', async () => {
    const D = await nieuwLid(w, 'vld');
    await w.post('/api/onboarding/paspoort', PASPOORT, D.token);
    const id = (await w.post(BOEK, { id: open.id }, D.token)).data.boeking.id;
    const half = await w.afgebroken(INCHECK, { id, koffers: 0 }, D.token);
    const opnieuw = await w.post(INCHECK, { id, koffers: 0 }, D.token);
    const b = await boeking(id, D.token);
    const rot = await w.post(ROTEER, { id, rotatie: b && b.pass && b.pass.rotatie }, D.token);
    return { klopt: opnieuw.status === 409 && /roteer/.test(opnieuw.data.error) && rot.status === 200 && !!rot.data.pass.code,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ' (' + (opnieuw.data && opnieuw.data.error || '').slice(0, 60) + '), roteren ' + rot.status + (rot.data && rot.data.error ? ' (' + rot.data.error + ')' : '') };
  });

  await stap('herstelbaar', 'dubbeltik op "charter aanvragen": een aanvraag, niet twee', async () => {
    const lijf = { soort: 'privejet', bestemming: 'Genève ' + merk, datum: dag(5), tijd: '09:00' };
    const [a, b] = await w.dubbel(CHARTER, lijf, T);
    const n = ((await mijn()).charters || []).filter((c) => c.bestemming === 'Genève ' + merk).length;
    return { klopt: geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' aanvraag/aanvragen' };
  });

  await stap('herstelbaar', 'een crash direct na het roteren: de nieuwe pass-stand staat er, en intrekken met die stand lukt', async () => {
    const b0 = await boeking(boekId);
    const r = await w.post(ROTEER, { id: boekId, rotatie: b0.pass && b0.pass.rotatie }, T);
    await w.crash();
    const b1 = await boeking(boekId);
    const x = await w.post(INTREK, { id: boekId, rotatie: b1 && b1.pass && b1.pass.rotatie }, T);
    return { klopt: r.status === 200 && b1 && b1.pass && b1.pass.rotatie === b0.pass.rotatie + 1 && x.status === 200,
      ziet: 'roteren ' + r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', na SIGKILL rotatie ' + (b1 && b1.pass && b1.pass.rotatie) + ' (was ' + (b0.pass && b0.pass.rotatie) + '), intrekken ' + x.status };
  });
}

module.exports = {
  functie: 'link:vluchten',
  ingang: '/apps/vluchten.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid ziet het vertrekbord, boekt een vlucht na het opgeven van zijn paspoortgegevens, checkt in met koffers en krijgt een boarding pass met een eenmalige code die hij kan roteren of intrekken, en vraagt een charter aan -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. RTG Airport is de demonstratieluchthaven; er wordt niets bij een echte maatschappij geboekt. De controle bij de gate en de lounge (de luchtzijde van een zaak) en het besluit van operations over het charter zijn niet gelopen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
