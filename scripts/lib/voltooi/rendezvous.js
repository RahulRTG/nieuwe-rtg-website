/* ============================================================================
   VOLTOOIPROEF: RENDEZ-VOUS (link:rendezvous, /apps/rendezvous.html).

   De belofte (ONTMOETEN.md): een besloten, gecureerde datingapp voor
   Signature-leden. Twee leden zetten hun profiel aan, zien elkaar als
   kandidaat op codenaam, en pas na een WEDERZIJDSE like staat er een match;
   wie de ander blokkeert, verdwijnt in beide richtingen.

   DE POORT WORDT DOORLOPEN, NIET OMGELOPEN. Rendez-vous eist twee dingen
   (routes/connection-policy.js en kern/ontmoetpoort.js): een Lifestyle of
   Business Pass, en een door RTG geverifieerd paspoort van iemand van 18 of
   ouder. Elk lid in deze proef krijgt beide langs de enige weg: een medewerker
   op naam keurt de identiteit goed (geverifieerdLid), en een herleidbaar mens
   van het kantoor accepteert de Lifestyle-aanvraag. Een geverifieerd RTG-lid
   zonder Signature-pas en een Lifestyle-lid zonder geverifieerd paspoort
   worden allebei geweigerd -- dat zijn de schakels van "rol zonder recht".
   ========================================================================== */
'use strict';
const { inloggen, eigenaarSessie, geverifieerdLid, lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');

const PROFIEL = '/api/member/rendezvous/profiel';
const ZET = '/api/member/rendezvous/profiel/zet';
const KANDIDATEN = '/api/member/rendezvous/kandidaten';
const LIKE = '/api/member/rendezvous/like';
const PAS = '/api/member/rendezvous/pas';
const MATCHES = '/api/member/rendezvous/matches';
const BLOKKEER = '/api/member/rendezvous/blokkeer';

/* Geverifieerd paspoort EN Lifestyle Pass, allebei door een mens van RTG. */
async function signatureLid(w, merk) {
  const lid = await geverifieerdLid(w, merk);
  const a = await w.post('/api/aanmelding/aanvraag', { pas: 'lifestyle', naam: 'Rendezvouslid ' + merk,
    contact: lid.email, viaUitnodiging: true }, lid.token);
  const id = a.data && a.data.aanmelding && a.data.aanmelding.id;
  if (a.status !== 200 || !id) throw new Error('de Lifestyle-aanvraag lukte niet (' + a.status + ')');
  const b = await w.post('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', contractEuro: 20000 }, await eigenaarSessie(w));
  if (b.status !== 200) throw new Error('het kantoor kon de Lifestyle Pass niet toekennen (' + b.status + ')');
  lid.token = await inloggen(w, lid);
  return lid;
}

async function loop(w, stap) {
  const merk = 'rv' + Date.now().toString(36);
  const A = await signatureLid(w, 'rva');
  const B = await signatureLid(w, 'rvb');
  const C = await signatureLid(w, 'rvc');
  let codeA = null, codeB = null, keyA = null, keyB = null, keyC = null;
  const kandidaten = async (tok) => { const r = await w.post(KANDIDATEN, {}, tok); return r.status === 200 ? r.data.kandidaten || [] : null; };
  const matches = async (tok) => { const r = await w.post(MATCHES, {}, tok); return r.status === 200 ? r.data.matches || [] : null; };
  const met = (lijst, code) => (lijst || []).filter((x) => x.codenaam === code);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'drie Signature-leden met een geverifieerd paspoort zetten hun profiel aan, en elk leest het terug', async () => {
    const z = [];
    for (const [L, stad] of [[A, 'Lissabon'], [B, 'Lissabon'], [C, 'Wenen']]) {
      z.push(await w.post(ZET, { aan: true, over: 'Over ' + merk + ' ' + stad, zoekt: 'een goed gesprek', locaties: [stad] }, L.token));
    }
    const pa = await w.post(PROFIEL, {}, A.token), pb = await w.post(PROFIEL, {}, B.token);
    codeA = pa.data && pa.data.codenaam; codeB = pb.data && pb.data.codenaam;
    return { klopt: z.every((r) => r.status === 200) && pa.status === 200 && pa.data.profiel.aan === true &&
      pa.data.profiel.over === 'Over ' + merk + ' Lissabon' && !!codeA && !!codeB,
      ziet: 'zet ' + z.map((r) => r.status).join('/') + ', A leest "' + (pa.data && pa.data.profiel && pa.data.profiel.over) + '" als ' + codeA };
  });

  await stap('voltooibaar', 'A ziet B als kandidaat op codenaam, met de gedeelde stad eerst; geen echte naam of e-mail in de lijst', async () => {
    const l = await kandidaten(A.token);
    const b = met(l, codeB)[0];
    keyB = b && b.id;
    const c = met(l, (await w.post(PROFIEL, {}, C.token)).data.codenaam)[0];
    keyC = c && c.id;
    const tekst = JSON.stringify(l);
    return { klopt: !!b && b.status === 'nieuw' && (b.gedeeldeLocaties || []).includes('Lissabon') && l.indexOf(b) < l.indexOf(c) &&
      !tekst.includes(B.email) && !tekst.includes('Voltooilid'),
      ziet: (l || []).length + ' kandidaten, B op plek ' + (l || []).indexOf(b) + ' met ' + JSON.stringify(b && b.gedeeldeLocaties) };
  });

  await stap('voltooibaar', 'A vindt B leuk: nog geen match, en B ziet dat A hem leuk vond', async () => {
    const r = await w.post(LIKE, { id: keyB }, A.token);
    const mA = await matches(A.token);
    const kb = met(await kandidaten(B.token), codeA)[0];
    keyA = kb && kb.id;
    return { klopt: r.status === 200 && r.data.match === false && mA.length === 0 && !!kb && kb.likteMij === true,
      ziet: 'like ' + r.status + ' match=' + (r.data && r.data.match) + ', A heeft ' + (mA || []).length + ' matches, B ziet likteMij=' + (kb && kb.likteMij) };
  });

  await stap('voltooibaar', 'B vindt A ook leuk: een match, bij allebei, met de gedeelde stad als voorstel', async () => {
    const r = await w.post(LIKE, { id: keyA }, B.token);
    const mA = met(await matches(A.token), codeB), mB = met(await matches(B.token), codeA);
    return { klopt: r.status === 200 && r.data.match === true && mA.length === 1 && mB.length === 1 && mA[0].voorstel === 'Lissabon',
      ziet: 'like ' + r.status + ' match=' + (r.data && r.data.match) + ', A ' + mA.length + ' / B ' + mB.length + ', voorstel ' + (mA[0] && mA[0].voorstel) };
  });

  await stap('voltooibaar', 'A slaat C over: C verdwijnt uit de kandidaten van A', async () => {
    const r = await w.post(PAS, { id: keyC }, A.token);
    const l = await kandidaten(A.token);
    return { klopt: r.status === 200 && !(l || []).some((x) => x.id === keyC) && met(l, codeB).length === 1,
      ziet: 'pas ' + r.status + ', ' + (l || []).length + ' kandidaat over' };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegd: zonder inlog geven het profiel, de kandidaten, de matches en een like 401', async () => {
    const r = await Promise.all([w.post(PROFIEL, {}), w.post(KANDIDATEN, {}), w.post(MATCHES, {}), w.post(LIKE, { id: keyB })]);
    return { klopt: r.every((x) => x.status === 401), ziet: r.map((x) => x.status).join('/') };
  });

  await stap('voltooibaar', 'bevoegd: een derde lid ziet de match van A en B niet, en zijn like maakt geen match uit hun likes', async () => {
    const mC = await matches(C.token);
    const l = await w.post(LIKE, { id: keyA }, C.token);
    const mA = await matches(A.token);
    return { klopt: Array.isArray(mC) && mC.length === 0 && l.status === 200 && l.data.match === false && met(mA, codeB).length === 1 && mA.length === 1,
      ziet: 'C heeft ' + (mC || []).length + ' matches, like van C match=' + (l.data && l.data.match) + ', A heeft ' + (mA || []).length + ' match' };
  });

  await stap('voltooibaar', 'bevoegd: een geverifieerd RTG-lid zonder Signature-pas en een Lifestyle-lid zonder geverifieerd paspoort komen er niet in', async () => {
    const rtg = await geverifieerdLid(w, 'rvr');
    const ongeverifieerd = await lifestyleLid(w, 'rvl');
    const a = await w.post(KANDIDATEN, {}, rtg.token), b = await w.post(KANDIDATEN, {}, ongeverifieerd.token);
    const zet = await w.post(ZET, { aan: true, over: 'Binnenglippen ' + merk }, ongeverifieerd.token);
    return { klopt: a.status === 403 && a.data.code === 'PASS_REQUIRED' && b.status === 403 && b.data.code === 'IDENTITY_REQUIRED' &&
      zet.status === 403 && !JSON.stringify(await kandidaten(A.token)).includes('Binnenglippen'),
      ziet: 'RTG-lid ' + a.status + ' ' + (a.data && a.data.code) + ', ongeverifieerd ' + b.status + ' ' + (b.data && b.data.code) + ', profiel zetten ' + zet.status };
  });

  await stap('voltooibaar', 'B blokkeert A: de match is weg bij allebei, en ze zien elkaar niet meer als kandidaat', async () => {
    const r = await w.post(BLOKKEER, { id: keyA }, B.token);
    const mA = await matches(A.token), mB = await matches(B.token);
    const kA = met(await kandidaten(A.token), codeB), kB = met(await kandidaten(B.token), codeA);
    const nog = await w.post(LIKE, { id: keyB }, A.token);
    return { klopt: r.status === 200 && mA.length === 0 && mB.length === 0 && kA.length === 0 && kB.length === 0 && nog.status === 403,
      ziet: 'blokkeer ' + r.status + ', matches ' + mA.length + '/' + mB.length + ', kandidaat ' + kA.length + '/' + kB.length + ', A liket opnieuw: ' + nog.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het profiel van A er nog, byte voor byte', async () => {
    const p = await w.post(PROFIEL, {}, A.token);
    return { klopt: p.status === 200 && p.data.profiel.over === 'Over ' + merk + ' Lissabon' && p.data.profiel.aan === true,
      ziet: p.status + ', "' + (p.data && p.data.profiel && p.data.profiel.over) + '"' };
  });
  await stap('persistent', 'na de herstart blijft de blokkade staan: geen match, geen kandidaat, in een nieuwe sessie', async () => {
    const T = await inloggen(w, A);
    const mA = await matches(T), kA = met(await kandidaten(T), codeB);
    const kB = met(await kandidaten(B.token), codeA);
    return { klopt: Array.isArray(mA) && mA.length === 0 && kA.length === 0 && kB.length === 0,
      ziet: 'nieuwe sessie: ' + (mA || []).length + ' matches, B als kandidaat ' + kA.length + ', A bij B ' + kB.length };
  });
  await stap('persistent', 'het profiel staat in de opslag zelf (gelezen buiten de server om), en de pas komt uit het besluit van het kantoor', async () => {
    const plek = w.vindInOpslag('Over ' + merk + ' Lissabon');
    const k = await w.post(KANDIDATEN, {}, (await inloggen(w, C)));
    return { klopt: plek.length >= 1 && k.status === 200,
      ziet: 'profiel in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; C na herinloggen ' + k.status };
  });

  /* ---------------- herstelbaar ---------------- */
  /* Een nieuw paar: C en een vierde lid D, zodat de blokkade hierboven niets verbergt. */
  const D = await signatureLid(w, 'rvd');
  await w.post(ZET, { aan: true, over: 'D ' + merk, locaties: ['Wenen'] }, D.token);
  const codeC = (await w.post(PROFIEL, {}, C.token)).data.codenaam;
  const codeD = (await w.post(PROFIEL, {}, D.token)).data.codenaam;
  const keyD = (met(await kandidaten(C.token), codeD)[0] || {}).id;
  keyC = (met(await kandidaten(D.token), codeC)[0] || {}).id;

  await stap('herstelbaar', 'een dubbele tik op "leuk" (tegelijk): een like, en na de like van D precies een match', async () => {
    const [a, b] = await w.dubbel(LIKE, { id: keyD }, C.token);
    const voor = met(await matches(C.token), codeD).length;
    const d = await w.post(LIKE, { id: keyC }, D.token);
    const mC = met(await matches(C.token), codeD), mD = met(await matches(D.token), codeC);
    return { klopt: a.status === 200 && b.status === 200 && voor === 0 && d.data.match === true && mC.length === 1 && mD.length === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', match van D=' + (d.data && d.data.match) + ', C ' + mC.length + ' / D ' + mD.length };
  });
  await stap('herstelbaar', 'een afgebroken profielwijziging, daarna opnieuw: het profiel draagt precies de nieuwe tekst', async () => {
    const lijf = { over: 'Half ' + merk };
    const half = await w.afgebroken(ZET, lijf, D.token);
    const opnieuw = await w.post(ZET, lijf, D.token);
    const p = await w.post(PROFIEL, {}, D.token);
    return { klopt: opnieuw.status === 200 && p.data.profiel.over === 'Half ' + merk && p.data.profiel.aan === true && met(await matches(C.token), codeD).length === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', "' + (p.data && p.data.profiel.over) + '"' };
  });
  await stap('herstelbaar', 'een crash direct na een profielwijziging: de wijziging en de match staan er na de herstart', async () => {
    const z = await w.post(ZET, { over: 'Crash ' + merk }, D.token);
    await w.crash();
    const p = await w.post(PROFIEL, {}, D.token);
    const mC = met(await matches(C.token), codeD), mD = met(await matches(D.token), codeC);
    return { klopt: z.status === 200 && p.data.profiel.over === 'Crash ' + merk && mC.length === 1 && mD.length === 1,
      ziet: 'zet ' + z.status + ', na SIGKILL "' + (p.data && p.data.profiel.over) + '", match C ' + mC.length + ' / D ' + mD.length };
  });
  await stap('herstelbaar', 'een crash direct na een blokkade: wie geblokkeerd heette, blijft weg', async () => {
    const r = await w.post(BLOKKEER, { id: keyC, meld: '' }, D.token);
    await w.crash();
    const mC = met(await matches(C.token), codeD), kD = met(await kandidaten(D.token), codeC);
    return { klopt: r.status === 200 && mC.length === 0 && kD.length === 0, ziet: 'blokkeer ' + r.status + ', na SIGKILL match ' + mC.length + ', kandidaat ' + kD.length };
  });
}

module.exports = {
  functie: 'link:rendezvous',
  ingang: '/apps/rendezvous.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'Signature-leden met een geverifieerd paspoort zien elkaar op codenaam, een match ontstaat alleen wederzijds en alleen de twee zien hem, en een blokkade werkt in beide richtingen -- zonder inlog, zonder Signature-pas of zonder geverifieerd paspoort kom je er niet in, en een herstart, dubbele tik, afgebroken verzoek of crash verliest of verdubbelt niets',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Gelopen zijn profiel, kandidaten, leuk, overslaan, matches en blokkeren; tafels, introducties, Arrange It, de concierge, circles, profielfoto\'s en berichten (/api/connection/rendezvous/*) lopen niet mee. De identiteit en de pas kent het eigenaarsaccount van de testomgeving toe; het beeld van het paspoort is een pixel. Geen Redis of PostgreSQL in de wereld.',
  loop
};
