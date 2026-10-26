/* DE SESSIES DIE EEN BROWSERPROEF NODIG HEEFT, op een plek.

   Een lid, een zaak, het personeel op de PDA, het kantoor en een gezin -- elk langs de ECHTE route over
   de server, nooit een nagebouwd token. Dat laatste is de reden dat dit bestand
   bestaat en niet ergens inline staat: een nagebouwde sessie meet je eigen
   aanname en niet de deur.

   EERLIJK OVER WAT DIT (NOG) NIET IS. Acht scripts hebben vandaag hun eigen
   kopie van deze inlog: a11y, tikken, beproeving, zaakwig, ladder, auditproef,
   tot-crash en de vier proef-routes. Die zijn hier NIET naartoe gehaald -- dat
   is een aparte ingreep met een eigen risico, en een halve migratie is erger
   dan geen. Wat hier staat is het adres waar nieuwe proeven hun sessie horen te
   halen, zodat de negende kopie niet ontstaat. Wie de acht verhuist, haalt ze
   hier op en laat deze kop krimpen.

   OVERSLAAN IS NOOIT STIL. Lukt een inlog niet, dan komt die rol terug in
   `overgeslagen` met de reden erbij. Een proef die een kapotte inlog als "niets
   gevonden" telt, laat een stuk huis er gezond uitzien. */
'use strict';
const { zetSignatureKlaar } = require('./wereld-signature');

/* De sleutel in localStorage per rol, plus hoe je aan zo'n sessie komt. De
   sleutelnaam hoort hierbij: wie een token haalt maar op de verkeerde sleutel
   zet, meet een uitgelogde browser. */
const ROLLEN = {
  lid: {
    sleutel: 'rtg_member_token',
    uitleg: 'een gewoon lid met een RTG Pass',
    start: '/apps/app.html',
    async haal(basis) {
      const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
      const r = await post(basis + '/api/auth/register', { name: 'Proeflid',
        email: 'pf' + u + '@voorbeeld.nl', phone: '06' + u.slice(0, 8),
        password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
      return r && r.token ? r.token : null;
    }
  },
  zaak: {
    sleutel: 'rtg_sup_token',
    uitleg: 'de manager van een zaak in de leverancier-app',
    start: '/apps/leverancier.html',
    async haal(basis) {
      const rooster = await post(basis + '/api/supplier/roster', { code: 'KIKUNOI' });
      const man = (rooster && rooster.staff || []).find((x) => x.role === 'manager');
      if (!man) return null;
      const r = await post(basis + '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
      return r && r.token ? r.token : null;
    }
  },
  /* Het personeel op de PDA (rtg_pda_token): de manager van de vervoerder
     TRANSIT, langs dezelfde rooster- en pin-inlog als `zaak`. OV-routes
     (/apps/ovroutes.html) draait op die sessie en op geen andere. De naam is
     die van de werkrol in de sleutelbos (/api/account/rollen), zodat een
     ingang met `werkrol: 'personeel'` deze persona krijgt (appwerkt.js). */
  personeel: {
    sleutel: 'rtg_pda_token',
    uitleg: 'de manager van een vervoerder op de personeels-PDA',
    start: '/apps/personeel.html',
    async haal(basis) {
      const rooster = await post(basis + '/api/supplier/roster', { code: 'TRANSIT' });
      const man = (rooster && rooster.staff || []).find((x) => x.role === 'manager');
      if (!man) return null;
      const r = await post(basis + '/api/supplier/login', { code: 'TRANSIT', staffId: man.id, pin: '1234' });
      return r && r.token ? r.token : null;
    }
  },
  kantoor: {
    sleutel: 'rtg_office_token',
    uitleg: 'een medewerker van RTG met een kantoortoken',
    start: '/apps/backoffice.html',
    async haal(basis) {
      const r = await post(basis + '/api/office/login', { code: 'RTG-OFFICE' });
      return r && r.token ? r.token : null;
    }
  },
  /* Het gezin is de vierde deur van dit huis en werd door browserproeven
     stelselmatig overgeslagen: 79 schermen onder apps/foundation/ gooiden
     "geen sessie" en dat zag eruit als 79 kapotte schermen. Het is een DEUR.
     De sessie is bovendien geen kale string maar een object -- vandaar `vorm`,
     zodat de aanroeper hem goed in localStorage zet. */
  gezin: {
    sleutel: 'rtf_sessie',
    vorm: 'object',
    uitleg: 'de beheerder van een gezin in de RTFoundation',
    start: '/apps/foundation/index.html',
    async haal(basis) {
      const g = await post(basis + '/api/foundation/gezin/maak', { gezinsnaam: 'Proefgezin',
        naam: 'Papa', pin: '1234', bevoegdGezin: true, privacyAkkoord: true });
      if (!g || !g.token) return null;
      return { code: g.code, token: g.token, profiel: { naam: 'Papa', beheerder: true } };
    }
  }
};

async function post(url, lijf) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lijf) });
  return r.json().catch(() => null);
}

async function postAls(url, lijf, token) {
  const r = await fetch(url, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token
  }, body: JSON.stringify(lijf) });
  return { status: r.status, data: await r.json().catch(() => null) };
}

/* Een Lifestyle-lid ontstaat hier niet door een tier in een testsessie te
   stoppen. Dit hulpje loopt de bestaande menselijke productroute af: gratis
   account, aanvraag, besluit door een kantoormens op naam, opnieuw inloggen en
   identiteitscontrole. APPWERKT kan zo de premium-apps meten zonder de
   toegangspoort die het juist moet bewijzen te omzeilen. */
async function haalLifestyleLid(basis, kantoorToken) {
  if (!kantoorToken) return { ok: false,
    reden: 'geen kantoorsessie op naam; Lifestyle mag niet via de gedeelde kantoorcode worden toegekend' };
  let uit;
  try {
    uit = await zetSignatureKlaar({
      post: (pad, lijf, token) => postAls(basis + pad, lijf, token),
      tokens: { 'kantoor-op-naam': kantoorToken }
    });
  } catch (e) {
    return { ok: false, reden: String(e && e.message || e), stappen: [] };
  }
  if (!uit || !uit.klaar || !uit.token) return { ok: false,
    reden: uit && uit.reden || 'de menselijke Lifestyle-goedkeuring leverde geen sessie op',
    stappen: uit && uit.stappen || [] };
  return { ok: true, token: uit.token, userId: uit.userId, tier: uit.tier, stappen: uit.stappen || [] };
}

/* Bellen en Snaps zijn geen lege dialoog: hun eigen bediening bestaat uit de
   mensen met wie het lid verbonden is. Browserkwalificaties krijgen daarom
   op verzoek TWEE aparte echte proefleden met EEN echte verbinding, langs
   dezelfde vind-, verzoek- en aanvaardroutes als De Salon. De gewone
   ledensessie blijft bewust onaangeraakt: een sociale fixture mag de meting
   van Bestellen of een andere app niet van extra objecten voorzien. */
async function verbindProeflid(basis) {
  const eerste = await ROLLEN.lid.haal(basis);
  if (!eerste) return { ok: false, reden: 'eerste proeflid kon niet worden gemaakt' };
  const tweede = await ROLLEN.lid.haal(basis);
  if (!tweede) return { ok: false, reden: 'tweede proeflid kon niet worden gemaakt' };
  const [a, b] = await Promise.all([
    postAls(basis + '/api/member/connections', {}, eerste),
    postAls(basis + '/api/member/connections', {}, tweede)
  ]);
  const codenaam = b.data && (b.data.codename || (b.data.me && b.data.me.codename));
  const sleutelA = a.data && (typeof a.data.me === 'string' ? a.data.me : a.data.me && a.data.me.key);
  if (!codenaam || !sleutelA) return { ok: false, reden: 'proefleden kregen geen sociale identiteit' };
  const vondst = await postAls(basis + '/api/member/find', { q: codenaam }, eerste);
  const doel = ((vondst.data && vondst.data.results) || []).find((x) => x.codename === codenaam);
  if (!doel || !doel.key) return { ok: false, reden: 'tweede proeflid was niet vindbaar' };
  const verzoek = await postAls(basis + '/api/member/connect', { key: doel.key }, eerste);
  if (verzoek.status >= 400) return { ok: false, reden: 'verbindingsverzoek gaf HTTP ' + verzoek.status };
  const antwoord = await postAls(basis + '/api/member/connect/respond', { key: sleutelA, action: 'accept' }, tweede);
  if (antwoord.status >= 400 || !antwoord.data || antwoord.data.status !== 'verbonden') {
    return { ok: false, reden: 'verbinding aanvaarden gaf HTTP ' + antwoord.status };
  }
  return { ok: true, codenaam, token: eerste, contactToken: tweede };
}

/* Haalt de gevraagde rollen op (standaard allemaal) tegen een draaiende
   server. Geeft { sessies, overgeslagen }: sessies is wat er in localStorage
   moet, overgeslagen zegt per mislukte rol waarom. */
async function haalSessies(basis, welke) {
  const namen = welke && welke.length ? welke : Object.keys(ROLLEN);
  const sessies = {}, overgeslagen = [];
  for (const naam of namen) {
    const rol = ROLLEN[naam];
    if (!rol) { overgeslagen.push({ rol: naam, reden: 'onbekende rol' }); continue; }
    let waarde = null, fout = null;
    try { waarde = await rol.haal(basis); } catch (e) { fout = String(e && e.message || e); }
    if (!waarde) { overgeslagen.push({ rol: naam, reden: fout || ('inloggen als ' + naam + ' leverde geen sessie op') }); continue; }
    sessies[naam] = { sleutel: rol.sleutel, waarde, start: rol.start, uitleg: rol.uitleg };
  }
  return { sessies, overgeslagen };
}

/* Wat een browsercontext in localStorage moet zetten VOORDAT de pagina laadt --
   sessie.js van de RTFoundation beslist al bij het inlezen over zijn deur, dus
   achteraf zetten is te laat. */
function opslagVoor(sessies) {
  const uit = { rtg_cookieinfo_v1: '1' };
  for (const s of Object.values(sessies)) {
    uit[s.sleutel] = typeof s.waarde === 'string' ? s.waarde : JSON.stringify(s.waarde);
  }
  return uit;
}

module.exports = { ROLLEN, haalSessies, haalLifestyleLid, opslagVoor, verbindProeflid };
