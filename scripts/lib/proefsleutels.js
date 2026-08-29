/* ============================================================================
   DE SLEUTELBOS VAN DE PROEVEN -- een plek, zeven rollen.

   WAAROM DIT BESTAND ER IS. Vier proeven (rol, invoer, idem, staat, audit) en
   de inhoudskaart hadden elk hun eigen kopie van dezelfde drie inlogs:

     member   : POST /api/login {tier:'rtg'}
     office   : POST /api/office/login {code}
     supplier : POST /api/supplier/login {...}

   Zes kopieen van dezelfde afleiding (LAT.md regel 4). Erger dan lelijk: toen
   de bewakerskaart EIGENROLLEN kreeg (boardroom, techniek, werkplekbaas, scim)
   moest elke kopie apart worden bijgewerkt, en dus gebeurde het nergens. Het
   gevolg stond gewoon in IDEMPROEF.json: 111 routes met de reden 'rol "X", maar
   dit instrument heeft daar geen token voor'. Niet stuk, maar wel ONGEMETEN --
   en ongemeten is geen uitslag.

   DE REGEL DIE HIER GELDT. Een rol waarvoor geen sleutel gemunt kon worden,
   komt NIET in `tokens` te staan. Dat is met opzet streng: verdeelOpRol() in
   ./routes.js gebruikt de sleutelbos om te bepalen welke routes beproefbaar
   zijn, en een route zonder geldige sleutel aankloppen levert een 401 op die
   eruitziet als "geweigerd, er bleef niets staan" -- groen dat niets bewijst.
   Liever een eerlijke 'ongemeten' dan een verzonnen 'beproefd'.

   Elke munter zegt daarom ook WAAROM zijn weg de juiste is; dat is precies het
   deel dat bij een kopie het eerst verdwijnt.
   ========================================================================== */
'use strict';

/* De kantoorcode van de wegwerpserver. Staat hier omdat de proeven hem in hun
   env meegeven en het anders op twee plekken een string is. */
const OFFICE_CODE = 'RTG-OFFICE-PROEF';

/* Het demo-wachtwoord van de gezaaide accounts (server/server.js:
   zetEigenaarsAccountEens). Alleen bruikbaar in de testomgeving; op een echte
   server bestaat deze stand niet -- zie server/testomgeving.js. */
const DEMO_PASS = process.env.DEMO_PASS || 'Imran';

/* De eigenaar. Hij is de sleutel tot drie van de vier eigenrollen, want zowel
   boardroomBaas() (server/kern/kantoor/index.js) als magInzien()
   (server/routes/techniek.js) hangen aan isEigenaar() -- en dat hangt aan het
   e-mailadres uit de identiteitskluis, niet aan een veld in het verzoek. */
const EIGENAAR_LOGIN = process.env.RTG_OWNER_LOGIN || 'Rahul';

const tok = (r) => (r && r.data && r.data.token) || null;

/* ---------------------------------------------------------------------------
   DE MUNTERS. Volgorde telt: boardroom en werkplekbaas leunen op de
   eigenaarssessie die `eigenaar` hierboven muntte, dus die staat eerder in de
   lijst. Elke munter krijgt (post, bos) en geeft een token of null.
   ------------------------------------------------------------------------- */
const MUNTERS = [
  ['member', 'de gewone leden-deur; auth() accepteert deze sessie',
    async (post) => tok(await post('/api/login', { tier: 'rtg' }))],

  ['office', 'de backoffice-code; officeAuth() accepteert deze sessie, de boardroom NIET (zie hieronder)',
    async (post) => tok(await post('/api/office/login', { code: OFFICE_CODE }))],

  ['supplier', 'de zaak-inlog van de gezaaide demo-leverancier',
    async (post) => tok(await post('/api/supplier/login', { username: 'rahul', password: DEMO_PASS }))],

  /* De eigenaar is zelf geen bewakersrol -- geen enkele route draagt hem als
     deur. Hij staat hier omdat de drie eigenrollen eronder hem nodig hebben, en
     omdat een halve sleutelbos zwijgend halve metingen geeft. */
  ['eigenaar', 'het ECHTE eigenaarsaccount (geen demo-persona): de bron van boardroom, techniek en werkplekbaas',
    async (post) => tok(await post('/api/auth/login', { login: EIGENAAR_LOGIN, password: DEMO_PASS }))],

  /* techAuth() doet accounts.verifyToken() op het bearer-token en toetst dan
     magInzien(user). Een demo-persona uit /api/login is GEEN account en strandt
     al op de eerste stap; het eigenaarstoken haalt beide. */
  ['techniek', 'het eigenaarstoken zelf: techAuth() verifieert het als echt account en magInzien() laat de eigenaar door',
    async (post, bos) => bos.eigenaar || null],

  /* DE VAL DIE HIER ZAT. Je zou denken dat de kantoorcode genoeg is voor de
     boardroom, want boardroomAuth() begint met officeAuth(). Dat is hij niet:
     /api/office/toegang.js zet `rememberSession(token, {role:'office'})` ZONDER
     lidKey, en boardroomWie() geeft dan null terug. Er is dus geen enkele
     kantoorcode die de boardroom opent -- en dat hoort zo, want de boardroom is
     van de eigenaar en niet van wie de code kent.

     De echte weg loopt via het ene account: de eigenaar logt in als lid en
     opent daarmee de kantoordeur (kern/eenaccount/starten.js), en DIE sessie
     draagt wel een lidKey. */
  ['boardroom', 'eigenaar -> /api/account/start {rol:kantoor}: een office-sessie MET lidKey, het enige wat boardroomAuth() doorlaat',
    async (post, bos) => (bos.eigenaar ? tok(await post('/api/account/start', { rol: 'kantoor' }, bos.eigenaar)) : null)],

  /* baasAuth() in server/routes/werkplek.js is `wie(req).baas`, en `wie` is
     boardroomWie/boardroomBaas. Dezelfde sessie dus, met dezelfde reden. */
  ['werkplekbaas', 'dezelfde boardroom-sessie: baasAuth() vraagt boardroomBaas() en dat is de eigenaar',
    async (post, bos) => bos.boardroom || null],

  /* scimAuth() kent geen van de gebruikerstokens: het is een eigen geheim per
     organisatie, en het wordt EEN KEER getoond bij het draaien. Er moet eerst
     een SSO-koppeling zijn, want een SCIM-sleutel hoort bij een organisatie. */
  ['scim', 'eigen bearer-geheim: eerst een SSO-koppeling zetten, dan de sleutel draaien (hij is daarna nooit meer op te vragen)',
    async (post, bos) => {
      if (!bos.techniek) return null;
      const org = 'proefkoppeling';
      const gezet = await post('/api/techniek/sso', {
        org, naam: 'Proefkoppeling', issuer: 'https://idp.proef.invalid',
        clientId: 'proef', clientSecret: 'proef-geheim', domeinen: ['proef.invalid'], actief: true
      }, bos.techniek);
      if (!gezet || gezet.status !== 200) return null;
      const s = await post('/api/techniek/sso/scimsleutel', { org }, bos.techniek);
      return (s && s.data && s.data.sleutel) || null;
    }],
];

/* De rollen die een BEWAKER zijn (en dus in verdeelOpRol horen). `eigenaar` is
   een opstapje en geen deur; hij hoort niet in die lijst, anders zou een proef
   routes gaan verdelen op een rol die geen enkele route draagt. */
const GEEN_BEWAKER = new Set(['eigenaar']);

/* Munt alles wat te munten valt.

   Geeft terug:
     tokens    -- {rol: token} van wat WERKELIJK gelukt is
     rollen    -- de bewakersrollen daaruit, voor verdeelOpRol()
     ontbreekt -- [{rol, waarom}] van wat niet lukte, met de reden waarom die
                  weg zou moeten werken; zo is een storing te onderscheiden van
                  een rol die deze opstelling nooit kan hebben
     hernieuw  -- (rol) => opnieuw munten (tokens verlopen onderweg)  */
async function haalSleutels({ post }) {
  const tokens = {};
  const waaroms = {};
  const ontbreekt = [];
  for (const [rol, waarom, munt] of MUNTERS) {
    waaroms[rol] = waarom;
    let t = null;
    try { t = await munt(post, tokens); } catch (e) { t = null; }
    if (t) tokens[rol] = t; else ontbreekt.push({ rol, waarom });
  }
  const hernieuw = async (rol) => {
    const rij = MUNTERS.find(m => m[0] === rol);
    if (!rij) return false;
    try {
      /* Een eigenrol hangt aan een verse eigenaarssessie: is die verlopen, dan
         is het kind ook dood. Munt de keten dus opnieuw vanaf de bron. */
      if (rol !== 'eigenaar' && rij[2].length > 1) {
        const bron = MUNTERS.find(m => m[0] === 'eigenaar');
        const e = await bron[2](post, tokens);
        if (e) tokens.eigenaar = e;
      }
      const t = await rij[2](post, tokens);
      if (t) { tokens[rol] = t; return true; }
    } catch (e) { /* onder */ }
    return false;
  };
  const rollen = Object.keys(tokens).filter(r => !GEEN_BEWAKER.has(r));
  return { tokens, rollen, ontbreekt, waaroms, hernieuw, tokenVoor: (rol) => tokens[rol] };
}

/* Wat een proef op het scherm zet over zijn sleutelbos. Een plek, zodat zes
   instrumenten het niet zes keer anders formuleren -- en zodat een ontbrekende
   sleutel ALTIJD zichtbaar is en niet alleen in het uitslagbestand. */
function meldSleutels(bos, log) {
  const zeg = log || console.log;
  zeg('  sleutels gemunt                      : ' + bos.rollen.join(', '));
  for (const { rol, waarom } of bos.ontbreekt) {
    zeg('  GEEN SLEUTEL voor "' + rol + '" -- routes met die rol blijven ONGEMETEN');
    zeg('     (verwachte weg: ' + waarom + ')');
  }
}

/* De drie zonder welke een proef niets meet. Ontbreekt er hier een, dan is er
   iets stuk aan de opstelling zelf en moet het instrument stoppen in plaats van
   een uitslag te schrijven. De eigenrollen zijn NIET verplicht: die kunnen in
   een uitgeklede omgeving ontbreken, en dan is 'ongemeten' het eerlijke woord. */
const BASISROLLEN = ['member', 'office', 'supplier'];

module.exports = { haalSleutels, meldSleutels, BASISROLLEN, OFFICE_CODE, DEMO_PASS, MUNTERS };
