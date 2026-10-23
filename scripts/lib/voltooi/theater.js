/* ============================================================================
   VOLTOOIPROEF: RTG THEATER (link:theater, /apps/theater.html) -- films en
   series van leden, op bioscoopniveau.

   De belofte van het scherm: een lid meldt een kanaal aan, een mens van het
   kantoor keurt het goed, en daarna zet het lid een video in de zaal -- byte
   voor byte het origineel. Een ander lid ziet hem chronologisch in de zaal,
   kijkt met een kort kijkticket (nooit de sessie in het adres), spoelt
   (Range), reageert, abonneert zich, en meldt wat niet deugt. Over de routes
   die theater.html zelf aanroept: /api/theater/zaal, /kanaal/aanmeld,
   /video/maak, /upload/:id, /kijk/:id met /api/stroom/ticket, /reactie,
   /reacties, /abonneer en /meld.

   De bytes zijn een minimale webm-kop met vulling: de server controleert alleen
   de magische bytes en bewaart exact wat binnenkomt, en dat is wat deze proef
   meet (gelijk terug, ook na een crash). Of een browser het afspeelt, is
   bewijs 2.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const ZAAL = '/api/theater/zaal';
const KANAAL = '/api/theater/kanaal/aanmeld';
const MAAK = '/api/theater/video/maak';
const UPLOAD = '/api/theater/upload/';
const KIJK = '/api/theater/kijk/';
const TICKET = '/api/stroom/ticket';
const REACTIE = '/api/theater/reactie';
const REACTIES = '/api/theater/reacties';
const ABONNEER = '/api/theater/abonneer';
const MELD = '/api/theater/meld';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
/* Een webm-kop (EBML) en daarna vulling met een merkteken, zodat de bytes
   uniek en na te rekenen zijn. */
const webm = (merk) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from(('RTG-theater-' + merk + '-').repeat(40))]);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

async function loop(w, stap) {
  const merk = 'th' + Date.now().toString(36);
  const M = await nieuwLid(w, 'thm');
  const K = await nieuwLid(w, 'thk');
  let kanaal = null, vid = null, bytes = webm(merk);

  /* De twee routes die geen JSON dragen: de bytes rauw erin, en kijken met
     een ticket in het adres, precies zoals de browser dat doet. */
  const upload = async (id, buf, tok) => {
    const r = await fetch(w.basis + UPLOAD + id, { method: 'POST', body: buf,
      headers: Object.assign({ 'Content-Type': 'video/webm' }, tok ? { Authorization: 'Bearer ' + tok } : {}) });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const kijk = async (id, tok, range) => {
    const t = await w.post(TICKET, { stroom: 'theater-kijk', id }, tok);
    if (t.status !== 200) return { status: t.status, ticket: false };
    const r = await fetch(w.basis + KIJK + id + '?ticket=' + encodeURIComponent(t.data.ticket), { headers: range ? { Range: range } : {} });
    return { status: r.status, buf: Buffer.from(await r.arrayBuffer()) };
  };
  const zaal = async (tok) => ((await w.post(ZAAL, {}, tok)).data) || {};
  const inZaal = (z, titel) => [...(z.nieuw || []), ...(z.abonnementen || [])].filter((v) => v.titel === titel);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid meldt een kanaal aan; tot het kantoor beslist kan er geen video in', async () => {
    const a = await w.post(KANAAL, { naam: 'Kanaal ' + merk, genre: 'film', bio: 'Korte films.' }, M.token);
    kanaal = a.data && a.data.kanaal;
    const v = await w.post(MAAK, { titel: 'Te vroeg ' + merk }, M.token);
    return { klopt: a.status === 200 && !!kanaal && kanaal.status === 'wacht' && v.status === 403 && /goedkeuring/.test((v.data && v.data.error) || ''),
      ziet: 'aanmelden ' + a.status + ' (' + (kanaal && kanaal.status) + '), video maken ' + v.status + ' -- ' + (v.data && v.data.error) };
  });

  await stap('voltooibaar', 'het kantoor keurt het kanaal goed; de maker zet een video in de zaal, byte voor byte', async () => {
    const office = ((await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE })).data || {}).token;
    const b = await w.post('/api/office/theater/beslis', { id: kanaal.id, besluit: 'goedgekeurd' }, office);
    const v = await w.post(MAAK, { titel: 'Film ' + merk, duurS: 95, omschrijving: 'Een korte film.' }, M.token);
    vid = v.data && v.data.id;
    const u = await upload(vid, bytes, M.token);
    return { klopt: b.status === 200 && v.status === 200 && !!vid && u.status === 200 && u.data.ok === true,
      ziet: 'besluit ' + b.status + ', video ' + v.status + ', upload ' + u.status + ' (' + (u.data && (u.data.mb + ' MB' || u.data.error)) + ')' };
  });

  await stap('voltooibaar', 'een ander lid ziet de film in de zaal en kijkt met een kijkticket: exact het origineel, en spoelen geeft precies dat stuk', async () => {
    const z = await zaal(K.token);
    const v = inZaal(z, 'Film ' + merk)[0];
    const heel = await kijk(vid, K.token);
    const stuk = await kijk(vid, K.token, 'bytes=4-23');
    return { klopt: !!v && v.kanaal === 'Kanaal ' + merk && heel.status === 200 && sha(heel.buf) === sha(bytes) &&
      stuk.status === 206 && stuk.buf.equals(bytes.slice(4, 24)),
      ziet: 'in de zaal: ' + !!v + ', kijken ' + heel.status + ' (' + (heel.buf && heel.buf.length) + ' bytes, ' + (heel.buf && sha(heel.buf) === sha(bytes) ? 'gelijk' : 'ANDERS') + '), spoelen ' + stuk.status };
  });

  await stap('voltooibaar', 'de kijker reageert en abonneert zich; de reactie staat bij de film en de film staat bovenaan bij zijn abonnementen', async () => {
    const r = await w.post(REACTIE, { id: vid, tekst: 'Prachtig ' + merk }, K.token);
    const a = await w.post(ABONNEER, { kanaalId: kanaal.id }, K.token);
    const rs = ((await w.post(REACTIES, { id: vid }, M.token)).data || {}).reacties || [];
    const z = await zaal(K.token);
    return { klopt: r.status === 200 && a.status === 200 && rs.filter((x) => x.tekst === 'Prachtig ' + merk).length === 1 &&
      (z.abonnementen || []).some((v) => v.id === vid),
      ziet: 'reactie ' + r.status + ', abonneer ' + a.status + ', maker ziet ' + rs.length + ' reactie(s), abonnementen ' + (z.abonnementen || []).length };
  });

  await stap('voltooibaar', 'de kijker meldt de film; de melding ligt bij het kantoor', async () => {
    const m = await w.post(MELD, { id: vid, reden: 'Proefmelding ' + merk }, K.token);
    const office = ((await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE })).data || {}).token;
    const l = (await w.post('/api/office/theater', {}, office)).data || {};
    return { klopt: m.status === 200 && JSON.stringify(l).includes('Proefmelding ' + merk),
      ziet: 'meld ' + m.status + ', bij kantoor: ' + JSON.stringify(l).includes('Proefmelding ' + merk) };
  });

  await stap('bevoegd', 'bevoegdheid: zonder sessie geen zaal, geen kijkticket en geen upload; een sessie in het adres krijgt 401', async () => {
    const z = await w.post(ZAAL, {});
    const t = await w.post(TICKET, { stroom: 'theater-kijk', id: vid });
    const u = await upload(vid, webm('anoniem'));
    const adres = await fetch(w.basis + KIJK + vid + '?token=' + encodeURIComponent(K.token));
    return { klopt: z.status === 401 && t.status === 401 && u.status === 401 && adres.status === 401,
      ziet: 'zaal ' + z.status + ', ticket ' + t.status + ', upload ' + u.status + ', ?token= ' + adres.status };
  });

  await stap('bevoegd', 'bevoegdheid: een ander lid overschrijft de film van de maker niet, verwijdert hem niet en schrijft zijn ondertitels niet', async () => {
    const u = await upload(vid, webm('kaping'), K.token);
    const x = await w.post('/api/theater/verwijder', { id: vid }, K.token);
    const o = await w.post('/api/theater/ondertitels', { id: vid, regels: [{ van: 0, tot: 2, tekst: 'gekaapt' }] }, K.token);
    const heel = await kijk(vid, K.token);
    return { klopt: u.status === 404 && x.status === 403 && o.status === 404 && heel.status === 200 && sha(heel.buf) === sha(bytes),
      ziet: 'upload ' + u.status + ', verwijder ' + x.status + ', ondertitels ' + o.status + ', film nog ' + (sha(heel.buf) === sha(bytes) ? 'gelijk' : 'ANDERS') };
  });

  await stap('bevoegd', 'bevoegdheid: een gratis account heeft geen Theater, en een kijkticket van het ene lid opent niet voor een andere video', async () => {
    const g = await nieuwLid(w, 'thg', 'guest');
    const z = await w.post(ZAAL, {}, g.token);
    const t = await w.post(TICKET, { stroom: 'theater-kijk', id: vid }, K.token);
    const ander = await fetch(w.basis + KIJK + 'bestaat-niet-' + merk + '?ticket=' + encodeURIComponent((t.data && t.data.ticket) || ''));
    return { klopt: z.status === 403 && t.status === 200 && ander.status >= 400 && ander.status < 500,
      ziet: 'gast zaal ' + z.status + ' (' + (z.data && z.data.error) + '), ticket voor een andere video ' + ander.status };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (z) => JSON.stringify(inZaal(z, 'Film ' + merk).map((v) => [v.id, v.titel, v.mb, v.reacties, v.kanaal]));
  const voor = vorm(await zaal(K.token));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de film in de zaal, met zijn reactie, en de bytes zijn exact gelijk', async () => {
    const na = vorm(await zaal(K.token));
    const heel = await kijk(vid, K.token);
    return { klopt: voor.length > 4 && na === voor && heel.status === 200 && sha(heel.buf) === sha(bytes),
      ziet: (na === voor ? 'zaal gelijk' : 'ANDERS: ' + na) + ', bytes ' + (heel.buf && sha(heel.buf) === sha(bytes) ? 'gelijk' : 'ANDERS') };
  });

  await stap('persistent', 'de maker logt opnieuw in (een ander toestel) en ziet zijn goedgekeurde kanaal en de reactie', async () => {
    const tok = await inloggen(w, M);
    const z = await zaal(tok);
    const rs = ((await w.post(REACTIES, { id: vid }, tok)).data || {}).reacties || [];
    return { klopt: !!z.mijn && z.mijn.status === 'goedgekeurd' && rs.some((x) => x.tekst === 'Prachtig ' + merk),
      ziet: 'kanaal ' + (z.mijn && z.mijn.status) + ', ' + rs.length + ' reactie(s)' };
  });

  await stap('persistent', 'de film, de reactie en het abonnement staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const f = w.vindInOpslag('Film ' + merk);
    const r = w.vindInOpslag('Prachtig ' + merk);
    return { klopt: f.length >= 1 && r.length >= 1, ziet: 'film in ' + f.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; reactie in ' + r.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  /* Het scherm stuurt per geschreven reactie en per opname een herhaalsleutel
     (`idem`), en dezelfde bij een nieuwe poging. */
  const telR = async (tekst) => (((await w.post(REACTIES, { id: vid }, M.token)).data || {}).reacties || []).filter((x) => x.tekst === tekst).length;
  await stap('herstelbaar', 'een dubbele tik op "reageer": een reactie, niet twee; een bewust tweede reactie komt wel', async () => {
    const [a, b] = await w.dubbel(REACTIE, { id: vid, tekst: 'Dubbel ' + merk, idem: 'theater-reactie-dubbel-' + merk }, K.token);
    const n = await telR('Dubbel ' + merk);
    const bewust = await w.post(REACTIE, { id: vid, tekst: 'Dubbel ' + merk, idem: 'theater-reactie-bewust-' + merk }, K.token);
    const n2 = await telR('Dubbel ' + merk);
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && n === 1 && bewust.status === 200 && n2 === 2,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' reactie(s); bewust nog een: ' + n2 };
  });

  await stap('herstelbaar', 'een dubbele tik op "video toevoegen": een video in de zaal, en de bytes een keer erin', async () => {
    const [a, b] = await w.dubbel(MAAK, { titel: 'Tweede ' + merk, duurS: 30, idem: 'theater-video-tweede-' + merk }, M.token);
    const id = (a.data && a.data.id) || (b.data && b.data.id);
    const buf = webm('tweede-' + merk);
    const [u1, u2] = await Promise.all([upload(id, buf, M.token), upload(id, buf, M.token)]);
    const n = inZaal(await zaal(K.token), 'Tweede ' + merk).length;
    const mijnKaarten = (((await zaal(M.token)).mijn || {}).videos || []).filter((v) => v.titel === 'Tweede ' + merk).length;
    return { klopt: geen5xx(a) && geen5xx(b) && [u1.status, u2.status].sort().join() === '200,409' && n === 1 && mijnKaarten === 1,
      ziet: 'maak ' + a.status + '/' + b.status + ', upload ' + u1.status + '/' + u2.status  + ', ' + n + ' in de zaal, ' + mijnKaarten + ' kaart(en) bij de maker' };
  });

  await stap('herstelbaar', 'een afgebroken reactie, daarna opnieuw: een reactie', async () => {
    const lijf = { id: vid, tekst: 'Half ' + merk, idem: 'theater-reactie-half-' + merk };
    const half = await w.afgebroken(REACTIE, lijf, K.token);
    const opnieuw = await w.post(REACTIE, lijf, K.token);
    const n = (((await w.post(REACTIES, { id: vid }, M.token)).data || {}).reacties || []).filter((x) => x.tekst === 'Half ' + merk).length;
    return { klopt: opnieuw.status === 200 && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' reactie(s)' };
  });

  await stap('herstelbaar', 'een crash direct na een upload, en het toestel probeert opnieuw: een film, exact het origineel', async () => {
    const lijf = { titel: 'Stroom ' + merk, duurS: 12, idem: 'theater-video-stroom-' + merk };
    const v = await w.post(MAAK, lijf, M.token);
    const buf = webm('stroom-' + merk);
    const u = await upload(v.data && v.data.id, buf, M.token);
    await w.crash();
    const v2 = await w.post(MAAK, lijf, M.token);
    const u2 = await upload(v2.data && v2.data.id, buf, M.token);
    const heel = await kijk(v.data && v.data.id, K.token);
    const n = inZaal(await zaal(K.token), 'Stroom ' + merk).length;
    return { klopt: u.status === 200 && v2.data && v2.data.id === v.data.id && u2.status === 409 && heel.status === 200 && sha(heel.buf) === sha(buf) && n === 1,
      ziet: 'upload ' + u.status + ', na SIGKILL opnieuw ' + (v2.data && v2.data.id === v.data.id ? 'dezelfde kaart' : 'EEN NIEUWE KAART') + ', upload ' + u2.status + ', kijken ' + heel.status + ' (' + (heel.buf && sha(heel.buf) === sha(buf) ? 'gelijk' : 'ANDERS') + '), ' + n + ' in de zaal' };
  });
}

module.exports = {
  functie: 'link:theater',
  ingang: '/apps/theater.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid met een door het kantoor goedgekeurd kanaal zet een film in de zaal, byte voor byte; een ander lid kijkt met een kijkticket, spoelt, reageert, abonneert en meldt -- en niets gaat verloren of dubbel bij een herstart, een dubbeltik of een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm; of een browser de film afspeelt, is bewijs 2. De bytes zijn een webm-kop met vulling. Het Thuisarchief (WebRTC van maker naar kijker), ondertitels, de interne bibliotheek van een zaak en de kijkplicht worden niet gelopen. Het kanaal keurt de kantoorcode goed. Geen Redis of PostgreSQL.',
  loop
};
