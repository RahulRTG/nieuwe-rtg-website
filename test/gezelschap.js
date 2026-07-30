/* HET GEZELSCHAP: een volledig bezet proefpubliek voor de tests.

   Waarom dit bestaat. De bezem in test/vergeten.test.js veegt door de hele
   database, maar hij ziet alleen wat het proeflid aanraakt -- en dat proeflid was
   er een. Eentje, met een RTG Pass, van middelbare leeftijd, zonder gezin. Alles
   wat alleen bestaat voor een Lifestyle-lid, voor een kind van zeven of voor de
   hotelkant van het aanbod, lag dus buiten beeld van elke controle die op dit
   publiek leunt. Niet omdat er iets kapot was: er keek gewoon niemand.

   Hier staat het hele publiek in een keer:

   - ELKE PAS. Gast, RTG, Lifestyle en Business. Let op HOE die ontstaan: zelf
     registreren geeft altijd hooguit een RTG Pass, dus Lifestyle en Business
     lopen hier langs de echte weg -- een aanvraag die door een MENS in de
     backoffice wordt geaccepteerd. Dat is een merkregel, en een proefpubliek dat
     die regel omzeilt zou precies de weg wegtoetsen die we willen bewaken.

   - ELKE RTF-LEEFTIJD. Een gezin met een profiel per laag: mini (0-5), kind
     (6-11), tiener (12+), jong en volwassen. De eerste drie zijn BESCHERMD
     (foundation/gezinshulp.js: isBeschermd), en dat is geen instelling maar een
     grens: hun besloten laag is voor niemand te openen, ook niet voor de
     eigenaar.

   - ELK GENRE. Voor elk soort partner dat de server kent een lid dat daar iets
     doet. Welke genres er zijn, vraagt dit bestand aan de server zelf in plaats
     van ze hier te herhalen; zo groeit het publiek mee als er een genre bijkomt,
     en meldt bouw() eerlijk welke genres nog leeg zijn.

   Gebruik:
     const { bouwGezelschap } = require('./gezelschap');
     const g = await bouwGezelschap(base, officeToken);
*/
const assert = require('node:assert/strict');

/* De genres zoals de aanmeldingen-kern ze kent. Deze lijst is hier alleen om te
   kunnen MELDEN wat er nog niet bezet is; het publiek zelf wordt gebouwd op wat
   de server werkelijk aan partners heeft. */
const ALLE_GENRES = require('../server/kern/aanmeldingen/bedrijf').GENRES;

function maakPost(base) {
  return function post(pad, body, token) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
      .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  };
}

let teller = 0;
const uniek = () => (Date.now().toString(36) + (teller++).toString(36)).slice(-9);

async function bouwGezelschap(base, officeToken) {
  const post = maakPost(base);

  /* Een gewoon lid. Krijgt ALTIJD een RTG Pass, wat je ook meestuurt; dat is de
     pas-poort en die toetsen we elders. */
  async function lid(naam, geboortedatum) {
    const u = uniek();
    const email = naam.toLowerCase().replace(/[^a-z]/g, '') + u + '@gezelschap.test';
    const wachtwoord = 'gezelschap' + u;
    const r = await post('/api/auth/register', {
      name: naam, email, password: wachtwoord, geboortedatum,
      phone: '06' + String(u).replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
      tier: 'rtg', pasApp: 'rtg'
    });
    assert.equal(r.status, 200, 'lid aanmaken lukt (' + naam + '): ' + JSON.stringify(r.body));
    const staat = await post('/api/state', {}, r.body.token);
    const s = staat.body.state || staat.body;
    return { naam, email, wachtwoord, token: r.body.token,
      key: 'user-' + (s.user && s.user.id), codenaam: s.user && s.user.codename, pas: 'rtg' };
  }

  /* Optillen naar Lifestyle of Business: aanvragen met je eigen token en dan
     een MENS in de backoffice die ja zegt. Er is met opzet geen kortere weg. */
  async function tilOp(l, pas) {
    const aanvraag = await post('/api/aanmelding/aanvraag',
      { pas, naam: l.naam, contact: l.email }, l.token);
    assert.equal(aanvraag.status, 200, 'aanvraag lukt: ' + JSON.stringify(aanvraag.body));
    assert.equal(aanvraag.body.aanmelding.gekoppeld, true, 'de aanvraag hangt aan het account');
    const besluit = await post('/api/aanmelding/beslis',
      { id: aanvraag.body.aanmelding.id, besluit: 'geaccepteerd', notitie: 'proefpubliek' }, officeToken);
    assert.equal(besluit.status, 200, 'het menselijke besluit lukt: ' + JSON.stringify(besluit.body));
    l.pas = pas;
    return l;
  }

  // ---- 1. de passen ----
  const gast = await post('/api/login', { tier: 'guest' });
  assert.equal(gast.status, 200, 'de gast-persona kan binnen');

  const passen = {
    gast: { naam: 'Gast', token: gast.body.token, pas: 'guest', codenaam: 'GAST', key: 'guest' },
    rtg: await lid('Rita RTG', '1994-09-14'),
    lifestyle: await tilOp(await lid('Lies Lifestyle', '1957-02-20'), 'lifestyle'),
    business: await tilOp(await lid('Bas Business', '1992-11-30'), 'business')
  };

  // ---- 2. de RTF-leeftijden ----
  const rtf = (pad, body) => post('/api/foundation' + pad, body);
  const gm = await rtf('/gezin/maak', { gezinsnaam: 'Het Gezelschap', naam: 'Gerda Gezin', pin: '2468' });
  assert.equal(gm.status, 200, 'het gezin komt er: ' + JSON.stringify(gm.body));
  const gezin = { code: gm.body.code, token: gm.body.token, beheerder: gm.body.profiel, leden: {} };

  /* Alle lagen uit foundation/gezinshulp.js. mini, kind en tiener zijn
     BESCHERMD; jong en volw niet. Beide soorten zitten er bewust in, want de
     grens is alleen te toetsen als je hem van twee kanten benadert. */
  for (const [groep, naam, rol] of [
    ['mini', 'Mees (4)', 'kind'],
    ['kind', 'Kaya (8)', 'kind'],
    ['tiener', 'Tim (14)', 'kind'],
    ['jong', 'Jonas (19)', 'gezinslid'],
    ['volw', 'Vera (41)', 'ouder']
  ]) {
    const p = await rtf('/gezin/profiel/maak',
      { code: gezin.code, token: gezin.token, naam, rol, groep, pin: '1111' });
    assert.equal(p.status, 200, 'profiel ' + groep + ' lukt: ' + JSON.stringify(p.body));
    gezin.leden[groep] = { ...p.body.profiel, groep, rol };
  }

  // ---- 3. een lid per genre ----
  const lijst = await post('/api/suppliers', {}, passen.rtg.token);
  const partners = lijst.body.suppliers || [];
  const aanwezig = [...new Set(partners.map(p => p.type).filter(Boolean))].sort();

  const perGenre = {};
  for (const genre of aanwezig) {
    const l = await lid('Genre ' + genre, '1990-01-01');
    l.genre = genre;
    l.partner = partners.find(p => p.type === genre);
    perGenre[genre] = l;
  }

  const leeg = ALLE_GENRES.filter(g => !aanwezig.includes(g));

  return {
    post, passen, gezin, perGenre,
    genres: aanwezig,
    genresZonderPartner: leeg,
    /* iedereen die als LID kan praten: de passen plus de genre-leden. De
       gezinsprofielen zitten hier niet in; die praten via de RTF-laag en
       daarvan zijn er drie beschermd. */
    allen: [passen.rtg, passen.lifestyle, passen.business, ...Object.values(perGenre)]
  };
}

module.exports = { bouwGezelschap, ALLE_GENRES };
