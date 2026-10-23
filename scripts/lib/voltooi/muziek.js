/* ============================================================================
   VOLTOOIPROEF: RTG SOUND (link:muziek, /apps/muziek.html).

   De belofte, in de woorden van het scherm: "Hier verschijnt de muziek die
   mensen zelf delen." Een lid publiceert zijn eigen nummer (rauw bestand, met
   de verklaring dat het eigen werk is), een ander lid vindt het in de feed,
   speelt het af via een korte luisterkaart en vindt het mooi; alleen de maker
   haalt het weg. Daarnaast: samen luisteren, waarbij de gastheer een kamer
   opent, de deelcode deelt en de luisteraar het station ziet dat speelt.

   De upload is een rauw lijf met kopregels, zoals muziek-feed.js hem stuurt;
   w.post kent alleen JSON, dus die ene route gaat met fetch op w.basis. De
   luisterkaart is een GET (/api/muziek/luister/:ticket), ook rechtstreeks.
   Het bestand is een minimale WAV: de server herkent audio aan de bytes, niet
   aan de opgegeven soort.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const PUBLICEER = '/api/muziek/bestand';
const FEED = '/api/muziek/feed';
const TICKET = '/api/muziek/bestand-ticket';
const MOOI = '/api/muziek/mooi';
const WEG = '/api/muziek/bestand-weg';
const MAAK = '/api/samen/maak';
const MEE = '/api/samen/mee';
const ZET = '/api/samen/muziek';
const STAAT = '/api/samen/staat';

/* 44 bytes kop en een halve seconde stilte, 8 kHz mono 8 bit. */
function wav(merk) {
  const data = Buffer.alloc(4000, 128);
  const kop = Buffer.alloc(44);
  kop.write('RIFF', 0, 'latin1'); kop.writeUInt32LE(36 + data.length, 4); kop.write('WAVE', 8, 'latin1');
  kop.write('fmt ', 12, 'latin1'); kop.writeUInt32LE(16, 16); kop.writeUInt16LE(1, 20); kop.writeUInt16LE(1, 22);
  kop.writeUInt32LE(8000, 24); kop.writeUInt32LE(8000, 28); kop.writeUInt16LE(1, 32); kop.writeUInt16LE(8, 34);
  kop.write('data', 36, 'latin1'); kop.writeUInt32LE(data.length, 40);
  return Buffer.concat([kop, data, Buffer.from(merk, 'latin1')]);
}

async function loop(w, stap) {
  const merk = 'mz' + Date.now().toString(36);
  const A = await nieuwLid(w, 'mza');
  const B = await nieuwLid(w, 'mzb');
  const gast = await nieuwLid(w, 'mzg', 'guest');
  let nummer = null;

  /* De publicatie zoals muziek-feed.js hem stuurt: rauw, met de titel in een kop. */
  async function publiceer(tok, titel, idem, opties) {
    const o = opties || {};
    const koppen = { 'Content-Type': 'audio/wav', 'Idempotency-Key': idem,
      'X-RTG-Bestandsnaam': encodeURIComponent(titel + '.wav'), 'X-RTG-Titel': encodeURIComponent(titel),
      'X-RTG-Beschrijving': encodeURIComponent('Opgenomen voor de proef'), 'X-RTG-Eigenwerk': o.eigen === false ? 'nee' : 'ja' };
    if (tok) koppen.Authorization = 'Bearer ' + tok;
    const ac = new AbortController();
    const belofte = fetch(w.basis + PUBLICEER, { method: 'POST', headers: koppen, body: wav(titel), signal: ac.signal })
      .then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }),
        (e) => ({ status: 0, afgebroken: /abort/i.test(String(e && e.name || e)) }));
    if (o.afbreken) { setTimeout(() => ac.abort(), 2); const uit = await belofte; await new Promise((r) => setTimeout(r, 300)); return uit; }
    return belofte;
  }
  const feed = async (tok) => { const r = await w.post(FEED, {}, tok); return r.status === 200 ? r.data.nummers || [] : null; };
  const metNaam = (lijst, naam) => (lijst || []).filter((n) => n.naam === naam);
  async function luister(tok, id) {
    const t = await w.post(TICKET, { id }, tok);
    if (t.status !== 200) return { status: t.status, bytes: 0 };
    const r = await fetch(w.basis + t.data.src);
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, bytes: buf.length, merk: buf.toString('latin1').endsWith(t.data.nummer.naam) };
  }

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid deelt een eigen nummer; zonder de verklaring "eigen werk" wordt het geweigerd met de reden', async () => {
    const nee = await publiceer(A.token, 'Avondlicht ' + merk, 'voltooi-muziek-nee-' + merk, { eigen: false });
    const r = await publiceer(A.token, 'Avondlicht ' + merk, 'voltooi-muziek-een-' + merk);
    nummer = r.data && r.data.nummer;
    return { klopt: nee.status === 400 && /eigen muziek/.test((nee.data && nee.data.error) || '') &&
      r.status === 200 && !!nummer && nummer.vanMij === true,
      ziet: 'zonder verklaring ' + nee.status + ', met ' + r.status + ' (' + (nummer && nummer.naam) + ')' };
  });

  await stap('voltooibaar', 'een ander lid vindt het nummer in de feed, onder de codenaam van de maker en niet als het zijne', async () => {
    const l = metNaam(await feed(B.token), 'Avondlicht ' + merk);
    return { klopt: l.length === 1 && l[0].vanMij === false && !!l[0].maker && l[0].maker !== 'Een maker',
      ziet: l.length + ' in de feed van B, maker ' + (l[0] && l[0].maker) + ', vanMij=' + (l[0] && l[0].vanMij) };
  });

  await stap('voltooibaar', 'het andere lid speelt het af via een luisterkaart en krijgt precies de gedeelde bytes', async () => {
    const r = await luister(B.token, nummer.id);
    return { klopt: r.status === 200 && r.bytes === wav('Avondlicht ' + merk).length && r.merk,
      ziet: 'luisteren ' + r.status + ', ' + r.bytes + ' bytes' };
  });

  await stap('voltooibaar', 'het andere lid vindt het mooi; de maker ziet de waardering', async () => {
    const m = await w.post(MOOI, { id: nummer.id, aan: true }, B.token);
    const l = metNaam(await feed(A.token), 'Avondlicht ' + merk)[0] || {};
    return { klopt: m.status === 200 && m.data.mooi === 1 && l.mooi === 1 && l.mooiVanMij === false,
      ziet: 'mooi ' + m.status + ', de maker ziet ' + l.mooi + ' waardering' };
  });

  await stap('voltooibaar', 'samen luisteren: de gastheer opent een kamer, de luisteraar komt binnen met de deelcode en ziet het station', async () => {
    const k = await w.post(MAAK, { idem: 'voltooi-samen-' + merk }, A.token);
    const id = k.data && k.data.kamer && k.data.kamer.id;
    const mee = await w.post(MEE, { code: k.data && k.data.code }, B.token);
    const z = await w.post(ZET, { id, media: { stationId: 'nacht', seed: 42, startOffsetMs: 1000, speelt: true } }, A.token);
    const s = await w.post(STAAT, { id }, B.token);
    const media = s.data && s.data.kamer && s.data.kamer.muziek;
    return { klopt: k.status === 200 && mee.status === 200 && z.status === 200 && s.status === 200 && !!media && media.stationId === 'nacht' && media.seed === 42 && s.data.kamer.benGastheer === false,
      ziet: 'kamer ' + k.status + ', mee ' + mee.status + ', zet ' + z.status + ', staat ' + s.status + ' met ' + JSON.stringify(media) };
  });

  /* Bevoegdheid: wie niet ingelogd is, wie het niet maakte, wie geen lid is. */
  await stap('bevoegd', 'bevoegd: zonder inlog geeft de feed, het publiceren en de luisterkaart 401', async () => {
    const f = await w.post(FEED, {});
    const p = await publiceer(null, 'Anoniem ' + merk, 'voltooi-muziek-anoniem-' + merk);
    const t = await w.post(TICKET, { id: nummer.id });
    return { klopt: f.status === 401 && p.status === 401 && t.status === 401, ziet: 'feed ' + f.status + ', publiceren ' + p.status + ', kaart ' + t.status };
  });

  await stap('bevoegd', 'bevoegd: het andere lid kan het nummer niet weghalen; het staat er daarna nog', async () => {
    const x = await w.post(WEG, { id: nummer.id }, B.token);
    const l = metNaam(await feed(A.token), 'Avondlicht ' + merk);
    return { klopt: x.status === 404 && l.length === 1, ziet: 'weghalen door B ' + x.status + ', nog ' + l.length + ' in de feed' };
  });

  await stap('bevoegd', 'bevoegd: een gratis account zonder pas mag RTG Studio niet in, en hoort waarom', async () => {
    const f = await w.post(FEED, {}, gast.token);
    const p = await publiceer(gast.token, 'Gast ' + merk, 'voltooi-muziek-gast-' + merk);
    return { klopt: f.status === 403 && p.status === 403 && /voor leden/.test((f.data && f.data.error) || '') && metNaam(await feed(A.token), 'Gast ' + merk).length === 0,
      ziet: 'feed ' + f.status + ' (' + (f.data && f.data.error) + '), publiceren ' + p.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het nummer in de feed, met zijn waardering', async () => {
    const l = metNaam(await feed(B.token), 'Avondlicht ' + merk);
    return { klopt: l.length === 1 && l[0].mooi === 1 && l[0].mooiVanMij === true, ziet: l.length + ' nummer, mooi ' + (l[0] && l[0].mooi) };
  });
  await stap('persistent', 'na de herstart klinkt het nummer nog: de bytes staan in de opslag, niet in het geheugen', async () => {
    const r = await luister(B.token, nummer.id);
    return { klopt: r.status === 200 && r.bytes === wav('Avondlicht ' + merk).length && r.merk, ziet: 'luisteren ' + r.status + ', ' + r.bytes + ' bytes' };
  });
  await stap('persistent', 'een nieuwe sessie van de maker ziet het als het zijne, en de titel staat in de opslag zelf', async () => {
    const T = await inloggen(w, A);
    const l = metNaam(await feed(T), 'Avondlicht ' + merk);
    const plek = w.vindInOpslag('Avondlicht ' + merk);
    return { klopt: l.length === 1 && l[0].vanMij === true && plek.length >= 1,
      ziet: 'nieuwe sessie: vanMij=' + (l[0] && l[0].vanMij) + '; opslag: ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "publiceren" (dezelfde sleutel, tegelijk) geeft een nummer, niet twee', async () => {
    const idem = 'voltooi-muziek-dubbel-' + merk;
    const [a, b] = await Promise.all([publiceer(A.token, 'Dubbel ' + merk, idem), publiceer(A.token, 'Dubbel ' + merk, idem)]);
    const n = metNaam(await feed(B.token), 'Dubbel ' + merk).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' in de feed' };
  });
  await stap('herstelbaar', 'een afgebroken publicatie, daarna opnieuw met dezelfde sleutel: precies een nummer', async () => {
    const idem = 'voltooi-muziek-half-' + merk;
    const half = await publiceer(A.token, 'Half ' + merk, idem, { afbreken: true });
    const opnieuw = await publiceer(A.token, 'Half ' + merk, idem);
    const n = metNaam(await feed(B.token), 'Half ' + merk).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' in de feed' };
  });
  await stap('herstelbaar', 'een crash direct na het publiceren, daarna dezelfde tik: niet verloren en niet verdubbeld', async () => {
    const idem = 'voltooi-muziek-crash-' + merk;
    const r = await publiceer(A.token, 'Crash ' + merk, idem);
    await w.crash();
    const opnieuw = await publiceer(A.token, 'Crash ' + merk, idem);
    const l = metNaam(await feed(B.token), 'Crash ' + merk);
    const klinkt = l[0] ? await luister(B.token, l[0].id) : { status: 0 };
    return { klopt: r.status === 200 && opnieuw.status === 200 && l.length === 1 && klinkt.status === 200,
      ziet: 'gepubliceerd ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', ' + l.length + ' in de feed, luisteren ' + klinkt.status };
  });
  await stap('herstelbaar', 'een crash direct na het weghalen: wat weg heette, blijft weg', async () => {
    const x = await w.post(WEG, { id: nummer.id }, A.token);
    await w.crash();
    const l = metNaam(await feed(B.token), 'Avondlicht ' + merk);
    const t = await w.post(TICKET, { id: nummer.id }, B.token);
    return { klopt: x.status === 200 && l.length === 0 && t.status === 404, ziet: 'weg ' + x.status + ', na SIGKILL ' + l.length + ' in de feed, kaart ' + t.status };
  });
}

module.exports = {
  functie: 'link:muziek',
  ingang: '/apps/muziek.html',
  persona: 'lid',
  belofte: 'een lid deelt zijn eigen muziek, een ander lid vindt, hoort en waardeert haar, en alleen de maker haalt haar weg; samen luisteren brengt de luisteraar in de kamer van de gastheer -- zonder inlog, als ander lid of zonder pas kom je er niet aan, en een herstart, dubbele tik, afgebroken verzoek of crash verliest of verdubbelt niets',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf: de generatieve stations klinken in de browser en worden hier niet gehoord. Het bestand is een korte WAV; grote bestanden en de byte-ranges van de speler lopen niet mee. Samen luisteren wordt tot het station in de kamer gelopen, niet tot de klok van de luisteraar. Geen Redis of PostgreSQL in de wereld.',
  loop
};
