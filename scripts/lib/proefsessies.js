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

async function post(url, lijf, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(url, { method: 'POST', headers,
    body: JSON.stringify(lijf) });
  return r.json().catch(() => null);
}

/* Twee schermen hebben naast de Foundation-sessie een tijdelijke lessleutel in
   sessionStorage nodig. Die sleutel nabouwen zou de deur zelf niet meten. Maak
   daarom langs precies dezelfde routes als Leren & Groei een les en een echte
   leerlingdeelname. De docentensleutel hoort bij het bord; de leerlingensleutel
   en het gekozen kinderprofiel horen bij het schrift. */
async function haalSchoolsessies(basis, sessies) {
  const lid = sessies && sessies.lid && sessies.lid.waarde;
  const ouder = sessies && sessies.gezin && sessies.gezin.waarde;
  if (typeof lid !== 'string' || !ouder || !ouder.code || !ouder.token) return null;

  const profiel = await post(basis + '/api/foundation/gezin/profiel/maak', {
    code: ouder.code, token: ouder.token, naam: 'Leerling proef', rol: 'kind',
    geboortedatum: '2016-04-12', pin: '5678'
  });
  const profielId = profiel && profiel.profiel && profiel.profiel.id;
  if (!profielId) return null;
  const gekozen = await post(basis + '/api/foundation/gezin/profiel/kies', {
    code: ouder.code, token: ouder.token, profielId, pin: '5678'
  });
  if (!gekozen || !gekozen.token) return null;
  const kind = { code: ouder.code, token: gekozen.token, profiel: gekozen.profiel };

  const les = await post(basis + '/api/foundation/les/maak', {
    vak: 'Waarheidsproef', naam: 'Begeleider proef', idem: 'liegronde-les-' + Date.now().toString(36)
  }, lid);
  if (!les || !les.lesId || !les.token || !les.lescode) return null;
  const deelname = await post(basis + '/api/foundation/les/join', {
    lescode: les.lescode, naam: 'Leerling proef', gezinCode: kind.code, gezinToken: kind.token
  });
  if (!deelname || !deelname.token || !deelname.lesId) return null;

  return {
    bord: {
      lokaal: opslagVoor({ gezin: sessies.gezin }),
      tijdelijk: { rtf_docent: { code: les.lesId, token: les.token, lescode: les.lescode } }
    },
    schrift: {
      lokaal: opslagVoor({ gezin: { ...sessies.gezin, waarde: kind } }),
      tijdelijk: { rtf_leerling: { code: deelname.lesId, token: deelname.token, naam: 'Leerling proef' } }
    }
  };
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

module.exports = { ROLLEN, haalSessies, haalSchoolsessies, opslagVoor };
