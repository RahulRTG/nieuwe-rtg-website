/* ============================================================================
   VOLTOOIPROEF: IDENTITEIT AANTONEN (link:verificatie, /apps/verificatie.html).

   De belofte, in de woorden van het scherm: een lid stuurt een foto van zijn
   identiteitsbewijs en een selfie in, de stukken liggen bij een medewerker, en
   na het besluit van een MENS staat het lid op niveau A3 -- of het bewijs wordt
   bij een afwijzing direct gewist. "De gezichtscontrole is een oordeel van een
   mens, geen bewijs."

   TWEE ACTOREN EN EEN DERDE DIE HET MERKT. Het lid stuurt in; een medewerker op
   naam (kluisAuth: de gedeelde kantoorcode komt er niet door, want het besluit
   gaat het inzagejournaal in) keurt; het lid ziet de stand en krijgt bericht
   (de postvanger vangt de mail). En de geboortedatum van het document wordt
   bij de goedkeuring overgenomen -- de reden dat CLAUDE.md `leeftijdBron`
   noemt.

   De beelden zijn een PNG van een pixel. Dat is geen paspoort en de proef doet
   niet alsof: wat hier gemeten wordt is de stroom en de opslag, niet of een
   mens een echt document herkent.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { nieuwLid, inloggen, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const UPLOAD = '/api/verify/upload';
const SELFIE = '/api/verify/selfie';
const STAND = '/api/verify/status';
const WACHTRIJ = '/api/office/verifications';
const BESLUIT = '/api/office/verify';

/* Een geldige PNG van 1x1 pixel. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'ver');
  const T = lid.token;
  let K = null, userId = null;
  const stand = async (tok) => ((await w.post(STAND, {}, tok || T)).data || {}).status;
  const uploads = () => { const map = path.join(w.datamap, 'uploads'); try { return fs.readdirSync(map); } catch (e) { return []; } };
  const wachtrij = async () => ((await w.post(WACHTRIJ, {}, K)).data || {}).pending || [];

  await stap('voltooibaar', 'een vers lid is nog niet geverifieerd', async () => {
    const s = await stand();
    return { klopt: s !== 'verified' && s !== 'n/a', ziet: 'stand: ' + s };
  });

  await stap('voltooibaar', 'het lid stuurt zijn identiteitsbewijs en een selfie in; de stand wordt "in behandeling"', async () => {
    const a = await w.post(UPLOAD, { image: PIXEL }, T);
    const b = await w.post(SELFIE, { image: PIXEL }, T);
    const s = await stand();
    return { klopt: a.status === 200 && b.status === 200 && s === 'pending', ziet: 'upload ' + a.status + ', selfie ' + b.status + ', stand ' + s + ', ' + uploads().length + ' bestanden in de kluis' };
  });

  await stap('voltooibaar', 'een foto in een verkeerd formaat wordt geweigerd met de reden, en de stand blijft staan', async () => {
    const r = await w.post(UPLOAD, { image: 'data:application/pdf;base64,JVBERi0=' }, T);
    return { klopt: r.status === 400 && /Upload een foto/.test(r.data.error) && (await stand()) === 'pending', ziet: r.status + ' (' + (r.data && r.data.error || '').slice(0, 60) + ')' };
  });

  await stap('voltooibaar', 'de gedeelde kantoorcode ziet de wachtrij niet: dit besluit hoort bij een mens op naam', async () => {
    const o = await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE });
    const r = await w.post(WACHTRIJ, {}, o.data && o.data.token);
    return { klopt: o.status === 200 && r.status === 403 && /op naam/.test((r.data && r.data.error) || ''), ziet: 'wachtrij met de gedeelde code: ' + r.status };
  });

  await stap('voltooibaar', 'een medewerker op naam ziet het lid in de wachtrij', async () => {
    K = await eigenaarSessie(w);
    const rij = await wachtrij();
    const mijn = rij.find((x) => x.email === lid.email);
    userId = mijn && (mijn.userId || mijn.id);
    return { klopt: !!mijn && !!userId && mijn.tier === 'rtg', ziet: rij.length + ' in de wachtrij, het lid erin met ' + (mijn ? Object.keys(mijn).join('/') : '-') };
  });

  await stap('voltooibaar', 'de medewerker keurt goed en neemt de geboortedatum van het document over; het lid ziet "geverifieerd" en krijgt bericht', async () => {
    const r = await w.post(BESLUIT, { userId, decision: 'approve', faceMatch: true, geboortedatum: '1985-05-06', nationaliteit: 'NL' }, K);
    const s = await stand(await inloggen(w, lid));
    const post = w.berichten().filter((b) => /identiteit is geverifieerd/i.test(b.onderwerp || ''));
    return { klopt: r.status === 200 && r.data.status === 'verified' && s === 'verified' && post.length === 1,
      ziet: 'besluit ' + r.status + ', stand ' + s + ', ' + post.length + ' bericht in de postvanger' };
  });

  await stap('voltooibaar', 'een geboortedatum die niet kan kloppen wordt geweigerd met de reden', async () => {
    const r = await w.post(BESLUIT, { userId, decision: 'approve', geboortedatum: '1600-01-01' }, K);
    return { klopt: r.status === 400 && /geboortedatum/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const bestandenVoor = uploads().sort().join(',');
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het lid nog op geverifieerd', async () => {
    const s = await stand(await inloggen(w, lid));
    return { klopt: s === 'verified', ziet: 'stand ' + s };
  });
  await stap('persistent', 'de verificatie staat in de opslag zelf (de accounttabel, gelezen buiten de server om)', async () => {
    const rij = w.opslag('rtg.db', 'SELECT verified, id_doc FROM users WHERE id = ?', Number(userId))[0];
    return { klopt: !!rij && rij.verified === 'verified' && !!rij.id_doc, ziet: rij ? 'verified=' + rij.verified + ', bewijs ' + (rij.id_doc ? 'aanwezig' : 'weg') : 'geen rij' };
  });
  await stap('persistent', 'het bewijs en de selfie liggen na de herstart nog in de kluismap: precies twee bestanden van dit lid', async () => {
    const na = uploads().sort().join(',');
    const eigen = uploads().filter((f) => f.startsWith(userId + '-'));
    return { klopt: na === bestandenVoor && eigen.length === 2, ziet: eigen.length + ' bestanden van dit lid, ' + (na === bestandenVoor ? 'ongewijzigd' : 'ANDERS') };
  });

  /* ---------------- herstelbaar ---------------- */
  /* Het eigenaarsaccount van de testomgeving wordt bij elke opstart opnieuw
     gezaaid (server.js, demostand), en daarmee vervalt zijn token. Na een
     herstart of crash logt de medewerker dus opnieuw in -- dat is de
     testomgeving, niet de stroom die gemeten wordt. */
  K = await eigenaarSessie(w);
  const vanLid = async (email) => {
    const rij = ((await w.post(WACHTRIJ, {}, K)).data || {}).pending || [];
    const x = rij.find((r) => r.email === email);
    return x ? (x.userId || x.id) : null;
  };
  const tweede = await nieuwLid(w, 'vr2');
  await stap('herstelbaar', 'dubbeltik op insturen: een bewijs in de kluis, niet twee', async () => {
    const [a, b] = await w.dubbel(UPLOAD, { image: PIXEL }, tweede.token);
    await new Promise((r) => setTimeout(r, 200));
    const uid = await vanLid(tweede.email);
    const bestanden = uploads().filter((f) => f.startsWith(uid + '-') && !f.includes('selfie'));
    return { klopt: a.status === 200 && geen5xx(b) && bestanden.length === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + bestanden.length + ' bewijs van dit lid' };
  });
  await stap('herstelbaar', 'een afwijzing wist het bewijs direct, ook na een crash, en het lid kan opnieuw insturen', async () => {
    const uid = await vanLid(tweede.email);
    const r = uid ? await w.post(BESLUIT, { userId: uid, decision: 'reject' }, K) : { status: 0 };
    await w.crash();
    K = await eigenaarSessie(w);
    const na = uploads().filter((f) => f.startsWith(uid + '-'));
    const s = await stand(await inloggen(w, tweede));
    const opnieuw = await w.post(UPLOAD, { image: PIXEL }, await inloggen(w, tweede));
    return { klopt: r.status === 200 && na.length === 0 && s === 'rejected' && opnieuw.status === 200,
      ziet: 'afwijzen ' + r.status + ', na SIGKILL ' + na.length + ' bestanden, stand ' + s + ', opnieuw insturen ' + opnieuw.status };
  });
  await stap('herstelbaar', 'een crash direct na een goedkeuring: wat geverifieerd heette, blijft geverifieerd', async () => {
    const derde = await nieuwLid(w, 'vr3');
    await w.post(UPLOAD, { image: PIXEL }, derde.token);
    const uid = await vanLid(derde.email);
    const r = uid ? await w.post(BESLUIT, { userId: uid, decision: 'approve', geboortedatum: '1990-01-01' }, K) : { status: 0 };
    await w.crash();
    K = await eigenaarSessie(w);
    const s = await stand(await inloggen(w, derde));
    return { klopt: r.status === 200 && s === 'verified', ziet: 'goedkeuren ' + r.status + ', na SIGKILL ' + s };
  });
  await stap('herstelbaar', 'een tweede besluit over hetzelfde lid zet de stand niet terug zonder dat het lid iets instuurde', async () => {
    const r = await w.post(BESLUIT, { userId, decision: 'approve', geboortedatum: '1985-05-06' }, K);
    const s = await stand(await inloggen(w, lid));
    return { klopt: geen5xx(r) && s === 'verified', ziet: 'tweede besluit ' + r.status + ', stand ' + s };
  });
}

module.exports = {
  functie: 'link:verificatie',
  ingang: '/apps/verificatie.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid stuurt zijn identiteitsbewijs en een selfie in, een medewerker op naam beslist, het lid ziet de uitkomst en krijgt bericht -- en een afwijzing wist het bewijs direct',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De beelden zijn een pixel: of een mens een echt document herkent, meet deze proef niet. De medewerker is het eigenaarsaccount van de testomgeving; de gedeelde kantoorcode wordt geweigerd en dat is een schakel. De postvanger bewijst dat het bericht klaarlag, niet dat het aankwam. Zonder RTG_ENC_KEY staan de beelden niet versleuteld op schijf; dat is niet beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
