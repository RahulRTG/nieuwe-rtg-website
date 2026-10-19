/* ============================================================================
   VOLTOOIPROEF: SNAPS (os:snaps, in de ledenapp /apps/app.html).

   HOE DE PROEF DE APP BEREIKT. Snaps heeft geen eigen adres: in de ledenapp
   opent de os-tegel Snaps een kiezer met de contacten uit De Salon
   (apps/app-main.js, openOsApp('snaps')); een tik op een vriend kiest een foto
   en stuurt hem met /api/member/snap/send (app-main-07.js). De ontvanger ziet
   hem in de strip bovenaan zijn contacten (/api/member/snaps, app-main-08b.js)
   en opent hem een keer (/api/member/snap/view). Dit scenario loopt die stap:
   twee leden die elkaar langs De Salon kennen, en een derde erbuiten.

   De belofte, in de woorden van het scherm: "Snap verstuurd. Hij verdwijnt na
   bekijken." Een snap gaat alleen naar een vriend, de vriend ziet hem een keer,
   en daarna staat de foto nergens meer -- ook niet in de opslag.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const STUUR = '/api/member/snap/send';
const LIJST = '/api/member/snaps';
const OPEN = '/api/member/snap/view';

/* Een echte PNG van 2x2 met een eigen merkteken in een tEXt-blok, zodat de
   proef de foto in de opslag kan terugvinden en daarna kan zien dat hij weg is. */
function png(merk) {
  const zlib = require('zlib');
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const blok = (soort, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const sd = Buffer.concat([Buffer.from(soort, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(sd)); return Buffer.concat([l, sd, c]); };
  const ihdr = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
  const rauw = Buffer.from([0, 200, 30, 60, 200, 30, 60, 0, 200, 30, 60, 200, 30, 60]);
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), blok('IHDR', ihdr),
    blok('tEXt', Buffer.from('Comment\0' + merk, 'latin1')), blok('IDAT', zlib.deflateSync(rauw)), blok('IEND', Buffer.alloc(0))]).toString('base64');
}

async function loop(w, stap) {
  const merk = 'sn' + Date.now().toString(36);
  const A = await nieuwLid(w, 'sna');
  const B = await nieuwLid(w, 'snb');
  const C = await nieuwLid(w, 'snc');
  const band = await verbind(w, A, B);
  await verbind(w, C, A); // C kent A, niet B
  const cKey = ((await w.post('/api/member/connections', {}, C.token)).data || {}).me;
  const inbox = async (T, tekst) => (((await w.post(LIJST, {}, T)).data || {}).snaps || []).filter((s) => !tekst || s.tekst === tekst);
  let snap = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid kiest Snaps, tikt een vriend aan en stuurt een foto met een tekst', async () => {
    const r = await w.post(STUUR, { toKey: band.b.key, foto: png('een-' + merk), tekst: 'Uitzicht ' + merk, idem: 'voltooi-snap-een-' + merk }, A.token);
    return { klopt: r.status === 200 && r.data.ok === true, ziet: 'sturen ' + r.status };
  });

  await stap('voltooibaar', 'de vriend ziet de snap in zijn strip, van de codenaam van het lid, nog zonder foto', async () => {
    const l = await inbox(B.token, 'Uitzicht ' + merk);
    snap = l[0] || null;
    return { klopt: l.length === 1 && snap.van === band.a.codenaam && !snap.foto, ziet: l.length + ' snap van ' + (snap && snap.van) };
  });

  await stap('voltooibaar', 'de vriend opent hem een keer en krijgt de foto; een tweede keer is hij er niet meer', async () => {
    const o = await w.post(OPEN, { id: snap.id }, B.token);
    const nog = await w.post(OPEN, { id: snap.id }, B.token);
    const l = await inbox(B.token, 'Uitzicht ' + merk);
    return { klopt: o.status === 200 && o.data.foto === png('een-' + merk) && o.data.van === band.a.codenaam && nog.status === 404 && l.length === 0,
      ziet: 'openen ' + o.status + ' (' + (o.data && o.data.foto ? o.data.foto.length + ' tekens foto' : 'geen foto') + '), tweede keer ' + nog.status };
  });

  await stap('voltooibaar', 'na het bekijken staat de foto nergens meer in de opslag', async () => {
    const plek = w.vindInOpslag('Uitzicht ' + merk);
    return { klopt: plek.filter((p) => p.sleutel !== 'audit').length === 0, ziet: JSON.stringify(plek) };
  });

  await stap('voltooibaar', 'bevoegd: zonder inlog geven sturen, de strip en openen 401', async () => {
    const s = await w.post(STUUR, { toKey: band.b.key, foto: png('anoniem'), tekst: 'anoniem' });
    const l = await w.post(LIJST, {});
    const o = await w.post(OPEN, { id: 'x' });
    return { klopt: s.status === 401 && l.status === 401 && o.status === 401, ziet: 'sturen ' + s.status + ', strip ' + l.status + ', openen ' + o.status };
  });

  await stap('voltooibaar', 'bevoegd: een ander lid ziet of opent de snap van een ander niet, en snapt niet naar een vreemde', async () => {
    const r = await w.post(STUUR, { toKey: band.b.key, foto: png('privé-' + merk), tekst: 'Prive ' + merk, idem: 'voltooi-snap-prive-' + merk }, A.token);
    const id = ((await inbox(B.token, 'Prive ' + merk))[0] || {}).id;
    const cZiet = await inbox(C.token, 'Prive ' + merk);
    const cOpen = await w.post(OPEN, { id }, C.token);
    const vreemd = await w.post(STUUR, { toKey: band.b.key, foto: png('vreemd'), tekst: 'Vreemd ' + merk }, C.token);
    const nogBijB = await inbox(B.token, 'Prive ' + merk);
    return { klopt: r.status === 200 && !!id && cZiet.length === 0 && cOpen.status === 404 && vreemd.status === 403 && nogBijB.length === 1 && !!cKey,
      ziet: 'C ziet ' + cZiet.length + ', opent ' + cOpen.status + ', snapt naar B (geen vriend) ' + vreemd.status + '; B heeft hem nog: ' + nogBijB.length };
  });

  /* Een gratis account mag snappen naar een vriend (routes/social: "ook de
     gratis laag, met paspoort"); de rol zonder recht is hier wie geblokkeerd is. */
  await stap('voltooibaar', 'bevoegd: wie door de ontvanger geblokkeerd is, snapt niet meer, ook al waren ze bevriend', async () => {
    const b = await w.post('/api/member/block', { key: cKey }, A.token);
    const s = await w.post(STUUR, { toKey: band.a.key, foto: png('geblokt'), tekst: 'Geblokt ' + merk }, C.token);
    const l = await inbox(A.token, 'Geblokt ' + merk);
    return { klopt: b.status === 200 && s.status === 403 && l.length === 0 && /niet beschikbaar/.test((s.data && s.data.error) || ''),
      ziet: 'blokkeren ' + b.status + ', sturen ' + s.status + ' (' + (s.data && s.data.error) + '), A ziet ' + l.length };
  });

  /* ---------------- persistent ---------------- */
  await w.post(STUUR, { toKey: band.b.key, foto: png('blijf-' + merk), tekst: 'Blijft ' + merk, idem: 'voltooi-snap-blijf-' + merk }, A.token);
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat een ongeopende snap nog in de strip van de vriend', async () => {
    const l = await inbox(B.token, 'Blijft ' + merk);
    return { klopt: l.length === 1 && l[0].van === band.a.codenaam, ziet: l.length + ' snap' };
  });
  await stap('persistent', 'een nieuwe sessie van de vriend opent hem en krijgt de foto uit de opslag', async () => {
    const T = await inloggen(w, B);
    const id = ((await inbox(T, 'Blijft ' + merk))[0] || {}).id;
    const o = await w.post(OPEN, { id }, T);
    return { klopt: o.status === 200 && o.data.foto === png('blijf-' + merk), ziet: 'openen ' + o.status };
  });
  await stap('persistent', 'en die bekeken snap is na een tweede herstart nog steeds weg', async () => {
    await w.herstart();
    const l = await inbox(B.token, 'Blijft ' + merk);
    return { klopt: l.length === 0 && w.vindInOpslag('Blijft ' + merk).filter((p) => p.sleutel !== 'audit').length === 0, ziet: l.length + ' snap' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op een vriend (dezelfde sleutel, tegelijk) stuurt een snap, niet twee', async () => {
    const lijf = { toKey: band.b.key, foto: png('dubbel-' + merk), tekst: 'Dubbel ' + merk, idem: 'voltooi-snap-dubbel-' + merk };
    const [a, b] = await w.dubbel(STUUR, lijf, A.token);
    const n = (await inbox(B.token, 'Dubbel ' + merk)).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' snap(s)' };
  });
  await stap('herstelbaar', 'een afgebroken verzending, daarna opnieuw met dezelfde sleutel: precies een snap', async () => {
    const lijf = { toKey: band.b.key, foto: png('half-' + merk), tekst: 'Half ' + merk, idem: 'voltooi-snap-half-' + merk };
    const half = await w.afgebroken(STUUR, lijf, A.token);
    const opnieuw = await w.post(STUUR, lijf, A.token);
    const n = (await inbox(B.token, 'Half ' + merk)).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' snap(s)' };
  });
  await stap('herstelbaar', 'een crash direct na het sturen, daarna dezelfde tik: niet verloren en niet verdubbeld', async () => {
    const lijf = { toKey: band.b.key, foto: png('crash-' + merk), tekst: 'Crash ' + merk, idem: 'voltooi-snap-crash-' + merk };
    const r = await w.post(STUUR, lijf, A.token);
    await w.crash();
    const opnieuw = await w.post(STUUR, lijf, A.token);
    const n = (await inbox(B.token, 'Crash ' + merk)).length;
    return { klopt: r.status === 200 && opnieuw.status === 200 && n === 1, ziet: 'sturen ' + r.status + ', na SIGKILL ' + opnieuw.status + ', ' + n + ' snap(s)' };
  });
  await stap('herstelbaar', 'een crash direct na het openen: wat bekeken is, komt niet terug', async () => {
    const id = ((await inbox(B.token, 'Crash ' + merk))[0] || {}).id;
    const o = await w.post(OPEN, { id }, B.token);
    await w.crash();
    const l = await inbox(B.token, 'Crash ' + merk);
    const nog = await w.post(OPEN, { id }, B.token);
    return { klopt: o.status === 200 && l.length === 0 && nog.status === 404, ziet: 'openen ' + o.status + ', na SIGKILL ' + l.length + ' in de strip, nog eens ' + nog.status };
  });
}

module.exports = {
  functie: 'os:snaps',
  ingang: '/apps/app.html',
  via: 'de os-tegel Snaps in de ledenapp, die de kiezer met Salon-contacten opent',
  persona: 'lid',
  belofte: 'een lid stuurt een vriend een snap, de vriend ziet hem een keer en daarna is de foto weg, ook uit de opslag -- zonder inlog, als vreemde of na een blokkade stuurt of opent niemand er een, en een herstart, dubbele tik, afgebroken verzoek of crash verliest, verdubbelt of herstelt niets',
  grens: 'De proef loopt de routes die de kiezer en de snapstrip van de ledenapp aanroepen, niet het scherm zelf; het verkleinen van de foto in de browser loopt niet mee. Verhalen (24 uur) en de dag-opdracht lopen hier niet. De vriendschap ontstaat langs De Salon. Geen Redis of PostgreSQL in de wereld.',
  loop
};
