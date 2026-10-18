/* ============================================================================
   VOLTOOIPROEF: RTMAIL (link:rtmail, /apps/rtmail.html).

   De belofte, in de woorden van kern/rtmail.js en kern/rtmail-schrijf.js: een
   postvak op codenaam, binnen RTG. Het adres volgt het lidmaatschap en
   niemand kiest zijn eigen domein; een lid schrijft een concept, verstuurt
   het naar een ander lid, en dat lid ziet het ongelezen in zijn postvak,
   leest het, en het telt niet meer als ongelezen. Een bericht zonder
   ontvanger gaat niet weg, en een bericht dat niet aan jou is, is niet te
   lezen.

   DE ONTVANGER is een tweede lid met een eigen postvak.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const ADRES = '/api/member/rtmail/adres';
const INBOX = '/api/member/rtmail/inbox';
const LEES = '/api/member/rtmail/lees';
const CONCEPTEN = '/api/member/rtmail/concepten';
const BEWAAR = '/api/member/rtmail/concept/bewaar';
const VERSTUUR = '/api/member/rtmail/concept/verstuur';
const CONCEPT_WEG = '/api/member/rtmail/concept/weg';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'rm' + Date.now().toString(36);
  const A = await nieuwLid(w, 'rma');
  const B = await nieuwLid(w, 'rmb');
  const inbox = async (tok) => ((await w.post(INBOX, {}, tok)).data) || {};
  const concepten = async (tok) => ((((await w.post(CONCEPTEN, {}, tok)).data) || {}).concepten || []);
  let adresA = null, adresB = null, bericht = null;

  await stap('voltooibaar', 'beide leden hebben een adres op hun codenaam en het domein van hun pas, niet op hun naam', async () => {
    const a = ((await w.post(ADRES, {}, A.token)).data) || {};
    const b = ((await w.post(ADRES, {}, B.token)).data) || {};
    adresA = a.adres; adresB = b.adres;
    return { klopt: !!adresA && !!adresB && adresA !== adresB && /@/.test(adresA) && !/voltooilid/i.test(adresA),
      ziet: 'A ' + adresA + ' (' + a.soort + '), B ' + adresB };
  });

  await stap('voltooibaar', 'A bewaart een concept en verstuurt het naar B; een concept zonder ontvanger gaat niet weg', async () => {
    const zonder = await w.post(BEWAAR, { onderwerp: 'Zonder ' + merk, tekst: 'niemand' }, A.token);
    const nietWeg = zonder.data && zonder.data.concept ? await w.post(VERSTUUR, { id: zonder.data.concept.id }, A.token) : { status: 0 };
    const c = await w.post(BEWAAR, { naar: adresB, onderwerp: 'Etentje ' + merk, tekst: 'Zaterdag om acht?' }, A.token);
    const id = c.data && c.data.concept && c.data.concept.id;
    const v = id ? await w.post(VERSTUUR, { id }, A.token) : { status: 0 };
    bericht = v.data && v.data.bericht;
    const over = await concepten(A.token);
    return { klopt: zonder.status === 200 && nietWeg.status === 400 && /wie/i.test(nietWeg.data.error) && c.status === 200 && v.status === 200 && !!bericht && !over.some((x) => x.id === id),
      ziet: 'zonder ontvanger: ' + nietWeg.status + ' (' + (nietWeg.data && nietWeg.data.error) + '); versturen ' + v.status + ', concept daarna ' + (over.some((x) => x.id === id) ? 'STAAT ER NOG' : 'weg') };
  });

  await stap('voltooibaar', 'B ziet het ongelezen in zijn postvak, van het adres van A; A ziet het niet in zijn eigen postvak', async () => {
    const b = await inbox(B.token);
    const mijn = (b.berichten || []).find((m) => m.id === bericht.id);
    const a = await inbox(A.token);
    return { klopt: !!mijn && mijn.gelezen === false && mijn.van === adresA && b.ongelezen >= 1 && !(a.berichten || []).some((m) => m.id === bericht.id),
      ziet: mijn ? 'B: van ' + mijn.van + ', gelezen ' + mijn.gelezen + ', ongelezen ' + b.ongelezen : 'B ZIET NIETS' };
  });

  await stap('voltooibaar', 'A kan het bericht aan B niet lezen; B leest het, en het telt niet meer als ongelezen', async () => {
    const vreemd = await w.post(LEES, { id: bericht.id }, A.token);
    const voor = (await inbox(B.token)).ongelezen;
    const l = await w.post(LEES, { id: bericht.id }, B.token);
    const na = await inbox(B.token);
    const m = (na.berichten || []).find((x) => x.id === bericht.id);
    return { klopt: vreemd.status === 404 && l.status === 200 && l.data.bericht.gelezen === true && na.ongelezen === voor - 1 && m && m.gelezen === true,
      ziet: 'A leest: ' + vreemd.status + ' (' + (vreemd.data && vreemd.data.error) + '); B leest ' + l.status + ', ongelezen ' + voor + ' -> ' + na.ongelezen };
  });

  /* ---------------- persistent ---------------- */
  const voorB = JSON.stringify((await inbox(B.token)).berichten.find((m) => m.id === bericht.id));
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het bericht gelezen in het postvak van B, gelijk', async () => {
    const na = JSON.stringify((await inbox(B.token)).berichten.find((m) => m.id === bericht.id));
    return { klopt: voorB.length > 2 && na === voorB, ziet: na === voorB ? 'gelijk' : 'ANDERS: ' + String(na).slice(0, 80) };
  });
  await stap('persistent', 'een nieuwe sessie van B (een ander toestel) leest hetzelfde postvak', async () => {
    const C = await inloggen(w, B);
    const b = await inbox(C);
    const m = (b.berichten || []).find((x) => x.id === bericht.id);
    return { klopt: b.adres === adresB && !!m && m.gelezen === true, ziet: 'adres ' + b.adres + ', bericht ' + (m ? 'gelezen ' + m.gelezen : 'WEG') };
  });
  await stap('persistent', 'het bericht staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('Etentje ' + merk);
    return { klopt: plek.length >= 1, ziet: 'in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "versturen": een bericht bij B, niet twee', async () => {
    const c = await w.post(BEWAAR, { naar: adresB, onderwerp: 'Dubbel ' + merk, tekst: 'een keer' }, A.token);
    const [a, b] = await w.dubbel(VERSTUUR, { id: c.data.concept.id }, A.token);
    const n = (await inbox(B.token)).berichten.filter((m) => m.onderwerp === 'Dubbel ' + merk).length;
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' bericht(en) bij B' };
  });
  await stap('herstelbaar', 'dubbeltik op "concept bewaren": een concept, niet twee', async () => {
    const lijf = { naar: adresB, onderwerp: 'Concept ' + merk, tekst: 'nog niet af' };
    const [a, b] = await w.dubbel(BEWAAR, lijf, A.token);
    const n = (await concepten(A.token)).filter((c) => c.onderwerp === lijf.onderwerp).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' concept(en)' };
  });
  await stap('herstelbaar', 'een crash direct na het versturen: het bericht staat na de herstart bij B', async () => {
    const c = await w.post(BEWAAR, { naar: adresB, onderwerp: 'Crash ' + merk, tekst: 'stroom weg' }, A.token);
    const v = await w.post(VERSTUUR, { id: c.data.concept.id }, A.token);
    await w.crash();
    const n = (await inbox(B.token)).berichten.filter((m) => m.onderwerp === 'Crash ' + merk).length;
    return { klopt: v.status === 200 && n === 1, ziet: 'versturen ' + v.status + ', na SIGKILL ' + n + ' bericht(en) bij B' };
  });
  await stap('herstelbaar', 'een crash direct na het lezen en na het weggooien van een concept: gelezen blijft gelezen, weg blijft weg', async () => {
    const m = (await inbox(B.token)).berichten.find((x) => x.onderwerp === 'Crash ' + merk);
    const l = await w.post(LEES, { id: m.id }, B.token);
    const c = (await concepten(A.token)).find((x) => x.onderwerp === 'Concept ' + merk);
    const weg = c ? await w.post(CONCEPT_WEG, { id: c.id }, A.token) : { status: 0 };
    await w.crash();
    const na = (await inbox(B.token)).berichten.find((x) => x.id === m.id);
    const over = (await concepten(A.token)).some((x) => x.onderwerp === 'Concept ' + merk);
    return { klopt: l.status === 200 && weg.status === 200 && !!na && na.gelezen === true && !over && w.vindInOpslag('Concept ' + merk).length === 0,
      ziet: 'lezen ' + l.status + ', weggooien ' + weg.status + '; na SIGKILL gelezen ' + (na && na.gelezen) + ', concept ' + (over ? 'STAAT ER NOG' : 'weg') };
  });
}

module.exports = {
  functie: 'link:rtmail',
  ingang: '/apps/rtmail.html',
  persona: 'lid',
  belofte: 'een lid schrijft een concept en verstuurt het binnen RTG naar een ander lid, dat het ongelezen in zijn postvak op codenaam ziet en leest; zonder ontvanger gaat niets weg, en andermans post is niet te lezen',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Teams, aliassen, gepland versturen, de workflow-acties en de samenvatting door Rahul zijn niet gelopen; publieke mail naar buiten bestaat hier niet (de postvanger vangt alles). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
