/* ============================================================================
   VOLTOOIPROEF: RTG CLIPS (link:clips, /apps/clips.html).

   De belofte van het scherm: een lid deelt een korte clip -- het beeld blijft
   op zijn eigen toestel (OPFS), bij RTG landen alleen titel, duur en affiche --
   en andere leden zien hem in een EINDIGE dagselectie met een expliciet einde,
   met gevolgde makers eerst. Kijkers reageren op codenaam en melden bij het
   kantoor; de maker knipt, ondertitelt en haalt weg.

   Wat de proef NIET kan: het beeld zelf reist P2P tussen twee browsers
   (shared/clipdeler.js, WebRTC). Dat vraagt test-identiteiten voor WebRTC in
   een headless browser (BETROUWBAARHEID.md par. 4, zelfde blokkade als
   videobellen) en loopt hier niet. Wat wel loopt is alles wat de server van
   een clip weet, en dat de server het beeld nooit ziet.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const FEED = '/api/clips/feed';
const MAAK = '/api/clips/maak';
const WEG = '/api/clips/weg';
const VOLG = '/api/clips/volg';
const REACTIE = '/api/clips/reactie';
const REACTIES = '/api/clips/reacties';
const MELD = '/api/clips/meld';
const KNIP = '/api/clips/knip';
const ONDERTITELS = '/api/clips/ondertitels';
const KANTOOR = '/api/office/clips';

async function loop(w, stap) {
  const merk = 'cl' + Date.now().toString(36);
  const A = await nieuwLid(w, 'cla');
  const B = await nieuwLid(w, 'clb');
  const D = await nieuwLid(w, 'cld');
  const gast = await nieuwLid(w, 'clg', 'guest');
  let K = await eigenaarSessie(w);
  let clip = null;

  const feed = async (tok, o) => { const r = await w.post(FEED, o || {}, tok); return r.status === 200 ? r.data : null; };
  const inFeed = (f, titel) => ((f && f.clips) || []).filter((c) => c.titel === titel);
  const inMijn = (f, titel) => ((f && f.mijn) || []).filter((c) => c.titel === titel);
  const maak = (tok, titel, idem, duurS) => w.post(MAAK, { titel, duurS: duurS || 20, mbGeschat: 3, idem }, tok);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid deelt een clip; een clip van meer dan zestig seconden wordt geweigerd met de reden', async () => {
    const te = await maak(A.token, 'Te lang ' + merk, 'voltooi-clips-te-' + merk, 90);
    const r = await maak(A.token, 'Kade ' + merk, 'voltooi-clips-een-' + merk);
    clip = r.data && r.data.id;
    const m = inMijn(await feed(A.token), 'Kade ' + merk);
    return { klopt: te.status === 400 && /60 seconden/.test((te.data && te.data.error) || '') && r.status === 200 && !!clip && m.length === 1 && m[0].mijn === true,
      ziet: 'te lang ' + te.status + ', delen ' + r.status + ', in het eigen archief ' + m.length };
  });

  await stap('voltooibaar', 'een ander lid ziet de clip onder de codenaam van de maker, in een eindige selectie met een einde', async () => {
    const f = await feed(B.token);
    const c = inFeed(f, 'Kade ' + merk);
    return { klopt: c.length === 1 && c[0].mijn === false && !!c[0].codenaam && f.clips.length <= 25 && /Dat was het/.test(f.einde),
      ziet: c.length + ' clip, maker ' + (c[0] && c[0].codenaam) + ', ' + f.clips.length + ' in de selectie, einde "' + f.einde + '"' };
  });

  await stap('voltooibaar', 'wie een maker volgt, ziet diens clips eerst; ontvolgen zet de chronologie terug', async () => {
    await maak(D.token, 'Later ' + merk, 'voltooi-clips-d-' + merk);
    const voor = (await feed(B.token)).clips.map((c) => c.titel);
    const v = await w.post(VOLG, { id: clip, aan: true }, B.token);
    const na = (await feed(B.token)).clips;
    const uit = await w.post(VOLG, { id: clip, aan: false }, B.token);
    const terug = (await feed(B.token)).clips.map((c) => c.titel);
    return { klopt: voor[0] === 'Later ' + merk && v.status === 200 && na[0].titel === 'Kade ' + merk && na[0].volgIk === true &&
      uit.status === 200 && terug[0] === 'Later ' + merk,
      ziet: 'eerst ' + voor[0] + ', na volgen ' + na[0].titel + ', na ontvolgen ' + terug[0] };
  });

  await stap('voltooibaar', 'een kijker reageert; de maker leest de reactie onder de codenaam van de kijker', async () => {
    const r = await w.post(REACTIE, { id: clip, tekst: 'Prachtig licht ' + merk }, B.token);
    const l = await w.post(REACTIES, { id: clip }, A.token);
    const mijn = ((l.data && l.data.reacties) || []).filter((x) => x.tekst === 'Prachtig licht ' + merk);
    return { klopt: r.status === 200 && mijn.length === 1 && !!mijn[0].codenaam && inMijn(await feed(A.token), 'Kade ' + merk)[0].reacties === 1,
      ziet: 'reactie ' + r.status + ', de maker leest ' + mijn.length + ' van ' + (mijn[0] && mijn[0].codenaam) };
  });

  await stap('voltooibaar', 'de maker knipt en ondertitelt; de kijker ziet de nieuwe speelduur en het merk "ondertiteld"', async () => {
    const k = await w.post(KNIP, { id: clip, van: 2, tot: 14 }, A.token);
    const o = await w.post(ONDERTITELS, { id: clip, regels: [{ van: 1, tot: 4, tekst: 'Het is bijna donker.' }] }, A.token);
    const c = inFeed(await feed(B.token, { alleenOndertiteld: true }), 'Kade ' + merk)[0] || {};
    return { klopt: k.status === 200 && o.status === 200 && c.speelduurS === 12 && c.ondertiteld === true,
      ziet: 'knip ' + k.status + ', ondertitels ' + o.status + ', kijker ziet ' + c.speelduurS + 's, ondertiteld=' + c.ondertiteld };
  });

  await stap('voltooibaar', 'een kijker meldt de clip; het kantoor ziet de melding met titel en codenamen', async () => {
    const m = await w.post(MELD, { id: clip, reden: 'Proefmelding ' + merk }, B.token);
    const l = await w.post(KANTOOR, {}, K);
    const rij = ((l.data && l.data.meldingen) || []).filter((x) => x.reden === 'Proefmelding ' + merk);
    return { klopt: m.status === 200 && l.status === 200 && rij.length === 1 && rij[0].titel === 'Kade ' + merk,
      ziet: 'melden ' + m.status + ', kantoor ' + l.status + ' ziet ' + rij.length + ' melding' };
  });

  /* Bevoegdheid. */
  await stap('bevoegd', 'bevoegd: zonder inlog geven de feed, delen en reageren 401', async () => {
    const a = await w.post(FEED, {}); const b = await w.post(MAAK, { titel: 'x', duurS: 3 }); const c = await w.post(REACTIE, { id: clip, tekst: 'x' });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: a.status + '/' + b.status + '/' + c.status };
  });
  await stap('bevoegd', 'bevoegd: een ander lid kan de clip niet weghalen, knippen of ondertitelen; hij blijft zoals de maker hem liet', async () => {
    const x = await w.post(WEG, { id: clip }, B.token);
    const k = await w.post(KNIP, { id: clip, weg: true }, B.token);
    const o = await w.post(ONDERTITELS, { id: clip, regels: [] }, B.token);
    const c = inMijn(await feed(A.token), 'Kade ' + merk)[0] || {};
    return { klopt: x.status === 404 && k.status === 403 && o.status === 403 && c.speelduurS === 12 && c.ondertiteld === true,
      ziet: 'weg ' + x.status + ', knip ' + k.status + ', ondertitels ' + o.status + ', clip nog ' + c.speelduurS + 's ondertiteld' };
  });
  await stap('bevoegd', 'bevoegd: een gratis account komt RTG Clips niet in, en een lid niet in de kantoorlijst', async () => {
    const g = await w.post(FEED, {}, gast.token);
    const l = await w.post(KANTOOR, {}, B.token);
    return { klopt: g.status === 403 && /voor leden/.test((g.data && g.data.error) || '') && [401, 403].includes(l.status),
      ziet: 'gratis account ' + g.status + ' (' + (g.data && g.data.error) + '), kantoorlijst als lid ' + l.status };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(inFeed(await feed(B.token), 'Kade ' + merk).map((c) => Object.assign({}, c, { online: null })));
  await w.herstart();
  K = await eigenaarSessie(w);
  await stap('persistent', 'na een nette herstart staat de clip er nog met knip, ondertitels en reactie', async () => {
    const na = JSON.stringify(inFeed(await feed(B.token), 'Kade ' + merk).map((c) => Object.assign({}, c, { online: null })));
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS: ' + na.slice(0, 120) };
  });
  await stap('persistent', 'een nieuwe sessie van de maker ziet de clip als de zijne, en het kantoor de melding', async () => {
    const T = await inloggen(w, A);
    const m = inMijn(await feed(T), 'Kade ' + merk);
    const l = ((await w.post(KANTOOR, {}, K)).data || {}).meldingen || [];
    return { klopt: m.length === 1 && m[0].reacties === 1 && l.some((x) => x.reden === 'Proefmelding ' + merk),
      ziet: m.length + ' eigen clip, ' + (m[0] && m[0].reacties) + ' reactie, melding bij kantoor: ' + l.some((x) => x.reden === 'Proefmelding ' + merk) };
  });
  await stap('persistent', 'de kaart staat in de opslag zelf, en het beeld niet: RTG bewaart alleen titel, duur en affiche', async () => {
    const plek = w.vindInOpslag('Kade ' + merk);
    const reactie = w.vindInOpslag('Prachtig licht ' + merk);
    const c = inMijn(await feed(A.token), 'Kade ' + merk)[0] || {};
    return { klopt: plek.length >= 1 && reactie.length >= 1 && !('src' in c) && !('bytes' in c),
      ziet: 'kaart in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + ', reactie in ' + reactie.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  const tel = async (titel) => inMijn(await feed(A.token), titel).length;
  await stap('herstelbaar', 'een dubbele tik op "Deel" (dezelfde sleutel, tegelijk) geeft een kaart, niet twee', async () => {
    const [a, b] = await w.dubbel(MAAK, { titel: 'Dubbel ' + merk, duurS: 9, idem: 'voltooi-clips-dubbel-' + merk }, A.token);
    const n = await tel('Dubbel ' + merk);
    return { klopt: a.status === 200 && b.status === 200 && a.data.id === b.data.id && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' kaart' };
  });
  await stap('herstelbaar', 'een afgebroken deling, daarna opnieuw met dezelfde sleutel: precies een kaart', async () => {
    const lijf = { titel: 'Half ' + merk, duurS: 9, idem: 'voltooi-clips-half-' + merk };
    const half = await w.afgebroken(MAAK, lijf, A.token);
    const opnieuw = await w.post(MAAK, lijf, A.token);
    const n = await tel('Half ' + merk);
    return { klopt: opnieuw.status === 200 && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' kaart' };
  });
  await stap('herstelbaar', 'een crash direct na het delen, daarna dezelfde tik: niet verloren en niet verdubbeld', async () => {
    const lijf = { titel: 'Crash ' + merk, duurS: 9, idem: 'voltooi-clips-crash-' + merk };
    const r = await w.post(MAAK, lijf, A.token);
    await w.crash();
    const opnieuw = await w.post(MAAK, lijf, A.token);
    const n = await tel('Crash ' + merk);
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.id === r.data.id && n === 1,
      ziet: 'gedeeld ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', ' + n + ' kaart' };
  });
  await stap('herstelbaar', 'een crash direct na het weghalen: wat weg heette, blijft weg, met de reacties', async () => {
    const x = await w.post(WEG, { id: clip }, A.token);
    await w.crash();
    const b = inFeed(await feed(B.token), 'Kade ' + merk).length;
    const r = ((await w.post(REACTIES, { id: clip }, B.token)).data || {}).reacties || [];
    return { klopt: x.status === 200 && b === 0 && r.length === 0, ziet: 'weg ' + x.status + ', na SIGKILL ' + b + ' clip bij de kijker, ' + r.length + ' reacties' };
  });
}

module.exports = {
  functie: 'link:clips',
  ingang: '/apps/clips.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid deelt een korte clip waarvan het beeld op zijn eigen toestel blijft; andere leden zien hem in een eindige dagselectie met gevolgde makers eerst, reageren op codenaam en melden bij het kantoor, en alleen de maker knipt, ondertitelt en haalt weg -- ook na een herstart, een dubbele tik, een afgebroken verzoek of een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Het beeld reist P2P tussen twee browsers (shared/clipdeler.js, WebRTC, /api/clips/aanwezig en /signaal) en loopt hier NIET: dat vraagt test-identiteiten voor WebRTC in een headless browser (BETROUWBAARHEID.md par. 4). Het kantoor is het eigenaarsaccount van de testwereld. Geen Redis of PostgreSQL.',
  loop
};
