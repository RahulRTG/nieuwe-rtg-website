/* ============================================================================
   VOLTOOIPROEF: RTG NIEUWS (link:nieuws, /apps/nieuws.html).

   De belofte van het scherm: een lid leest het gepubliceerde werk van RTG
   Redactie per rubriek, opent een artikel, en laat Rahul het samenvatten of
   een vraag beantwoorden -- op basis van ALLEEN de artikeltekst. Een concept
   staat er niet; wat de redactie terugtrekt, verdwijnt.

   De lezer muteert zelf niets. De handeling waar zijn belofte op rust, is de
   publicatie door een mens van de redactie (/api/office/redactie/*); die loopt
   hier als opzet, met het eigenaarsaccount van de testwereld, en de lezer
   meet wat hij daarna ziet. Herstelbaar is daarom: een dubbele tik op
   "Vraag" verandert niets, een afgebroken lezing laat het artikel heel, en
   een crash direct na publiceren of terugtrekken laat de lezer de juiste
   stand zien.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const LIJST = '/api/member/nieuws';
const ARTIKEL = '/api/member/nieuws/artikel';
const AI = '/api/member/nieuws/ai';
const MAAK = '/api/office/redactie/artikel/maak';
const STATUS = '/api/office/redactie/artikel/status';

async function loop(w, stap) {
  const merk = 'nw' + Date.now().toString(36);
  const A = await nieuwLid(w, 'nwa');
  const B = await nieuwLid(w, 'nwb');
  let K = await eigenaarSessie(w);
  const TEKST = 'De nachttrein naar Wenen rijdt vanaf het voorjaar dagelijks. Hij vertrekt om 19.30 uur uit Amsterdam. ' +
    'Er komen slaaprijtuigen met eigen douche. Kenmerk ' + merk + '.';
  let art = null, concept = null;

  const lijst = async (tok, rubriek) => { const r = await w.post(LIJST, { rubriek: rubriek || '' }, tok); return r.status === 200 ? r.data.artikelen || [] : null; };
  const metKop = (l, kop) => (l || []).filter((a) => a.kop === kop);
  async function publiceer(kop, rubriek, tekst) {
    const m = await w.post(MAAK, { kop, rubriek, intro: 'Intro ' + merk, tekst, auteur: 'Redactie' }, K);
    const id = m.data && m.data.artikel && m.data.artikel.id;
    const s = id ? await w.post(STATUS, { id, status: 'gepubliceerd' }, K) : m;
    return { id, status: s.status };
  }

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de redactie publiceert een reisartikel en laat een concept liggen; het lid ziet alleen het gepubliceerde', async () => {
    art = await publiceer('Nachttrein ' + merk, 'reizen', TEKST);
    const c = await w.post(MAAK, { kop: 'Concept ' + merk, rubriek: 'reizen', tekst: 'Nog niet af.' }, K);
    concept = c.data && c.data.artikel && c.data.artikel.id;
    const l = await lijst(A.token);
    return { klopt: art.status === 200 && !!concept && metKop(l, 'Nachttrein ' + merk).length === 1 && metKop(l, 'Concept ' + merk).length === 0,
      ziet: 'publiceren ' + art.status + ', in de lijst: ' + metKop(l, 'Nachttrein ' + merk).length + ' artikel, ' + metKop(l, 'Concept ' + merk).length + ' concept' };
  });

  await stap('voltooibaar', 'de rubriek filtert: onder reizen staat het artikel, onder sport niet', async () => {
    const reizen = metKop(await lijst(A.token, 'reizen'), 'Nachttrein ' + merk).length;
    const sport = metKop(await lijst(A.token, 'sport'), 'Nachttrein ' + merk).length;
    return { klopt: reizen === 1 && sport === 0, ziet: 'reizen ' + reizen + ', sport ' + sport };
  });

  await stap('voltooibaar', 'het lid opent het artikel en leest de hele tekst; het concept openen zegt eerlijk dat het er niet is', async () => {
    const r = await w.post(ARTIKEL, { id: art.id }, A.token);
    const c = await w.post(ARTIKEL, { id: concept }, A.token);
    return { klopt: r.status === 200 && r.data.artikel.tekst === TEKST && c.status === 404 && /niet/.test((c.data && c.data.error) || ''),
      ziet: 'artikel ' + r.status + ', concept ' + c.status + ' (' + (c.data && c.data.error) + ')' };
  });

  await stap('voltooibaar', 'Rahul vat samen en beantwoordt een vraag uit ALLEEN de artikeltekst; staat het er niet in, dan zegt hij dat', async () => {
    const s = await w.post(AI, { id: art.id, vraag: '' }, A.token);
    const v = await w.post(AI, { id: art.id, vraag: 'Wanneer vertrekt hij uit Amsterdam?' }, A.token);
    const n = await w.post(AI, { id: art.id, vraag: 'Wat kost een kaartje naar Wenen?' }, A.token);
    const zin = (v.data && v.data.antwoord) || '';
    const kern = (s.data && s.data.antwoord) || '';
    const geen = (n.data && n.data.antwoord) || '';
    return { klopt: s.status === 200 && /nachttrein naar Wenen/.test(kern) && v.status === 200 && /19\.30/.test(zin) &&
      n.status === 200 && /geen voldoende duidelijke bronzin/.test(geen) && !/euro|\u20ac/i.test(geen),
      ziet: 'samenvatting "' + kern.slice(0, 50) + '...", antwoord "' + zin.slice(0, 60) + '", buiten de tekst "' + geen.slice(0, 50) + '..."' };
  });

  await stap('voltooibaar', 'de redactie trekt het artikel terug; het lid ziet het niet meer en kan het niet meer openen', async () => {
    const t = await publiceer('Vergissing ' + merk, 'nieuws', 'Dit had niet mogen verschijnen.');
    const voor = metKop(await lijst(A.token), 'Vergissing ' + merk).length;
    const x = await w.post(STATUS, { id: t.id, status: 'concept' }, K);
    const na = metKop(await lijst(A.token), 'Vergissing ' + merk).length;
    const o = await w.post(ARTIKEL, { id: t.id }, A.token);
    return { klopt: voor === 1 && x.status === 200 && na === 0 && o.status === 404, ziet: 'voor ' + voor + ', terugtrekken ' + x.status + ', na ' + na + ', openen ' + o.status };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegd: zonder inlog geven de lijst, het artikel en de nieuwslezer 401', async () => {
    const a = await w.post(LIJST, {}); const b = await w.post(ARTIKEL, { id: art.id }); const c = await w.post(AI, { id: art.id });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: a.status + '/' + b.status + '/' + c.status };
  });

  await stap('voltooibaar', 'bevoegd: een lid kan zelf niets publiceren of terugtrekken -- dat beslist een mens van de redactie', async () => {
    const m = await w.post(MAAK, { kop: 'Lid ' + merk, tekst: 'x' }, A.token);
    const s = await w.post(STATUS, { id: art.id, status: 'concept' }, A.token);
    const nog = metKop(await lijst(B.token), 'Nachttrein ' + merk).length;
    const nietMaak = metKop(await lijst(B.token), 'Lid ' + merk).length;
    return { klopt: [401, 403].includes(m.status) && [401, 403].includes(s.status) && nog === 1 && nietMaak === 0,
      ziet: 'maken ' + m.status + ', terugtrekken ' + s.status + ', artikel nog ' + nog + ' bij een ander lid' };
  });

  await stap('voltooibaar', 'bevoegd: een concept-id raden levert een ander lid niets op, ook niet via de nieuwslezer', async () => {
    const a = await w.post(ARTIKEL, { id: concept }, B.token);
    const b = await w.post(AI, { id: concept, vraag: 'Wat staat erin?' }, B.token);
    return { klopt: a.status === 404 && b.status === 404 && !JSON.stringify(b.data || {}).includes('Nog niet af'), ziet: 'artikel ' + a.status + ', nieuwslezer ' + b.status };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify((await w.post(ARTIKEL, { id: art.id }, A.token)).data);
  await w.herstart();
  /* Een kantoorsessie overleeft geen herstart (die van het lid wel); de redactie logt opnieuw in. */
  K = await eigenaarSessie(w);
  await stap('persistent', 'na een nette herstart staat het artikel er nog, byte voor byte', async () => {
    const na = JSON.stringify((await w.post(ARTIKEL, { id: art.id }, A.token)).data);
    return { klopt: voor.length > 20 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie ziet het artikel, het concept niet en het teruggetrokken stuk niet', async () => {
    const T = await inloggen(w, A);
    const l = await lijst(T);
    return { klopt: metKop(l, 'Nachttrein ' + merk).length === 1 && metKop(l, 'Concept ' + merk).length === 0 && metKop(l, 'Vergissing ' + merk).length === 0,
      ziet: metKop(l, 'Nachttrein ' + merk).length + ' artikel in de nieuwe sessie' };
  });
  await stap('persistent', 'het artikel staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('Nachttrein ' + merk);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Vraag" geeft twee keer hetzelfde antwoord en verandert niets aan het artikel', async () => {
    const [a, b] = await w.dubbel(AI, { id: art.id, vraag: 'Hoe laat vertrekt de trein?' }, A.token);
    const na = JSON.stringify((await w.post(ARTIKEL, { id: art.id }, A.token)).data);
    return { klopt: a.status === 200 && b.status === 200 && a.data.antwoord === b.data.antwoord && na === voor,
      ziet: 'tikken ' + a.status + '/' + b.status + ', antwoorden gelijk: ' + (a.data && b.data && a.data.antwoord === b.data.antwoord) };
  });
  await stap('herstelbaar', 'een afgebroken lezing, daarna opnieuw: het artikel staat er heel', async () => {
    const half = await w.afgebroken(ARTIKEL, { id: art.id }, A.token);
    const opnieuw = await w.post(ARTIKEL, { id: art.id }, A.token);
    return { klopt: opnieuw.status === 200 && JSON.stringify(opnieuw.data) === voor,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status };
  });
  await stap('herstelbaar', 'een crash direct na publiceren: het lid leest het nieuwe artikel na de herstart', async () => {
    const p = await publiceer('Ochtendkrant ' + merk, 'cultuur', 'Het museum gaat op maandag open. Kenmerk ' + merk + '.');
    await w.crash();
    K = await eigenaarSessie(w);
    const l = metKop(await lijst(A.token, 'cultuur'), 'Ochtendkrant ' + merk);
    const o = l[0] ? await w.post(ARTIKEL, { id: l[0].id }, A.token) : { status: 0 };
    return { klopt: p.status === 200 && l.length === 1 && o.status === 200, ziet: 'publiceren ' + p.status + ', na SIGKILL ' + l.length + ' artikel, openen ' + o.status };
  });
  await stap('herstelbaar', 'een crash direct na terugtrekken: wat teruggetrokken is, komt niet terug', async () => {
    const l0 = metKop(await lijst(A.token), 'Ochtendkrant ' + merk)[0];
    const x = await w.post(STATUS, { id: l0 && l0.id, status: 'concept' }, K);
    await w.crash();
    K = await eigenaarSessie(w);
    const l = metKop(await lijst(A.token), 'Ochtendkrant ' + merk);
    return { klopt: x.status === 200 && l.length === 0, ziet: 'terugtrekken ' + x.status + ', na SIGKILL ' + l.length + ' artikel' };
  });
}

module.exports = {
  functie: 'link:nieuws',
  ingang: '/apps/nieuws.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid leest het gepubliceerde werk van RTG Redactie per rubriek, opent een artikel en laat Rahul het samenvatten of een vraag beantwoorden uit alleen de artikeltekst; een concept of teruggetrokken stuk ziet het niet, ook niet na een herstart of een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De publicatie is opzet door het eigenaarsaccount van de testwereld over /api/office/redactie/*; de schrijftafel zelf (dubbeltik op "nieuw artikel", eindredactie) is de belofte van het kantoor en wordt hier niet gelopen. Rahul draait zonder model: lokale samenvatting en letterlijke bronzin; een antwoord van een extern model wordt niet beproefd. Geen Redis of PostgreSQL.',
  loop
};
