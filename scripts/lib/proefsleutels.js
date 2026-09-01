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
const { maakZaakinlog } = require('./zaakinlog');

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

  /* DE PAS IS EEN TWEEDE SLOT, EN HIJ ZAT DE METING IN DE WEG.

     `member` hierboven is een RTG Pass. Honderden routes weigeren die met een
     403 die niets met de rol te maken heeft: "Deze app is onderdeel van de
     Lifestyle Pass", "Het Privekantoor is onderdeel van de Lifestyle Pass".
     Gemeten in de ronde van 29 augustus 2026: 154 routes strandden daarop, en
     ze kwamen allemaal terug als ONGEMETEN -- terwijl er niets mis is met de
     route en niets mis met de proef. Er lag alleen de verkeerde pas op tafel.

     Ze staan er alle drie, want de ladder is geen ladder: Lifestyle is een
     deelverzameling van Business OP DRIE DINGEN NA (De Rechterhand, RTG
     Zakelijk, het Privekantoor -- zie GROEPEN.md). Een Business-token opent die
     drie dus NIET, en "gewoon de hoogste pas nemen" zou 67 Privekantoor-routes
     stil ongemeten laten. Vandaar drie sleutels en niet een. */
  ['lid-lifestyle', 'dezelfde leden-deur met een Lifestyle Pass: opent De Rechterhand, RTG Zakelijk en het Privekantoor',
    async (post) => tok(await post('/api/login', { tier: 'lifestyle' }))],
  ['lid-business', 'dezelfde leden-deur met een Business Pass: opent de WorkOS-kant',
    async (post) => tok(await post('/api/login', { tier: 'business' }))],

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

  /* KANTOOR OP NAAM, en dat is iets anders dan `office` hierboven.

     `office` is de GEDEELDE backofficecode: een sessie zonder lidKey, dus zonder
     mens erachter. Een groeiend aantal routes weigert juist die -- een Lifestyle
     Pass toekennen, een identiteit goedkeuren, alles wat in het inzagejournaal
     belandt -- omdat daar een herleidbaar persoon bij hoort en geen code die
     iedereen kent (kern/kantoor/kluispoort.js zegt dat met zoveel woorden).

     Zonder sleutel voor deze rol werden die routes stil als ONGEMETEN
     overgeslagen, en ongemeten leest in een uitslag als geslaagd. Dat is precies
     het gat dat test/proefsleutels.test.js bewaakt.

     De sessie is dezelfde als die van de boardroom: de eigenaar logt in als lid
     en opent daarmee de kantoordeur (kern/eenaccount/starten.js), en DIE sessie
     draagt een lidKey. Hij staat hier als eigen rol en niet als alias, omdat de
     bewakerskaart hem als eigen rol kent en de verdeling op die naam gebeurt. */
  ['kantoor-op-naam', 'dezelfde office-sessie MET lidKey als de boardroom: een kantoorsessie met een mens erachter, wat de gedeelde code niet is',
    async (post, bos) => bos.boardroom || null],

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

  /* DE DRIE LEGE SLEUTELS, en ze staan hier omdat ze GEMUNT moeten worden.

     Ze stonden al in ROLLEN met de reden erbij, maar zonder munter bleef
     `tokens.openbaar` leeg -- en dan meldt een proef "rol openbaar, maar dit
     instrument heeft daar geen token voor" en telt de route als ONGEMETEN.
     Gemeten op 1 september 2026: 107 routes, en er was niets mis mee.

     Hun sleutel is de LEGE STRING: geen Authorization-kop meesturen is voor een
     openbare route niet een tekort maar de JUISTE invoer. Zie de kop van
     LEGE_SLEUTELS hieronder voor waarom het er drie zijn en geen een. */
  ['openbaar', 'geen inlog maar het ONTBREKEN ervan: zonder kop aankloppen is precies wat een openbare route hoort te krijgen',
    async () => ''],
  ['omgeving', 'hangt aan een omgevingsvariabele en niet aan een sessie; ook hier is geen kop de juiste invoer',
    async () => ''],
  ['eigen-poort', 'een inlogdeur die zelf oordeelt (scripts/lib/bewakers.js); hij MAAKT de sessie en kan er dus geen eisen',
    async () => ''],
];

/* Rollen die geen DEUR zijn en dus niet in de rollenlijst horen. `eigenaar` is
   een opstapje naar de eigenrollen; de twee passen zijn hetzelfde slot als
   `member` met een ander abonnement erachter -- geen enkele route draagt ze als
   bewaker, en ze in de verdeling opnemen zou routes toewijzen aan een rol die
   niet bestaat. Ze zijn er om te KUNNEN uitwijken, niet om op te verdelen. */
const GEEN_BEWAKER = new Set(['eigenaar', 'lid-lifestyle', 'lid-business']);

/* De passen in de volgorde waarin een 403 wordt herprobeerd. */
const PASLADDER = ['member', 'lid-lifestyle', 'lid-business'];

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
    /* `t != null` en niet `if (t)`: de lege string IS een geldige sleutel voor de
       drie lege-sleutelrollen hierboven, en een waarheidstoets gooit hem weg.
       Dat is precies hoe 107 openbare routes als ongemeten konden tellen. */
    if (t != null && t !== false) tokens[rol] = t; else ontbreekt.push({ rol, waarom });
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
  /* HET ZAAKBUREAU -- een plek voor elke zaakinlog, met EEN teller.

     ./zaakinlog.js houdt een rem op het aantal roosteropvragingen en een cache
     over de zaken die het al kent. De wereldopstellingen van de
     idempotentieproef (de genrewereld voorop) hebben er een nodig, en ze horen
     DEZELFDE te krijgen: twee bureaus zijn twee tellers, en dan meet de proef
     zijn eigen verbruik verkeerd -- precies wat test/eindpoort.test.js
     ("de proef blijft onder de roster-rem, gemeten") bewaakt.

     Hij staat hier en niet in de proef, omdat de sleutelbos de enige plek is
     waar dit huis inlogt. `inlog` geeft de losse munters terug voor wie een
     rol opnieuw wil zetten zonder de hele bos te hermunten. */
  const zaakbureau = maakZaakinlog({ post });
  const inlog = Object.fromEntries(MUNTERS.map(([rol, , munt]) => [rol, () => munt(post, tokens)]));

  return { tokens, rollen, ontbreekt, waaroms, hernieuw, zaakbureau, inlog,
    tokenVoor: (rol) => tokens[rol] };
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

/* DE DRIE LEGE SLEUTELS -- rollen waarvan de sleutel de LEGE STRING is.

   Ze horen in deze lijst juist omdat er niets te munten valt. `openbaar` is geen
   inlog maar het ontbreken ervan; `omgeving` hangt aan een omgevingsvariabele en
   niet aan een sessie; `eigen-poort` is een inlogdeur die zelf oordeelt
   (scripts/lib/bewakers.js). Voor alle drie is "geen Authorization-kop" niet een
   tekort maar de JUISTE invoer.

   Waarom ze dan toch meetellen: een rol die niet in ROLLEN staat, valt bij het
   verdelen uit de beproefbare verzameling, en dan tellen routes die met een
   reden openbaar zijn als instrumenttekort terwijl er niets ontbreekt. Drie
   verschillende woorden dus, en ze mogen niet tot een samenvallen -- daar zakt
   test/eigenpoort.test.js op. */
const LEGE_SLEUTELS = ['openbaar', 'omgeving', 'eigen-poort'];

/* ROLLEN wordt AFGELEID en niet nog eens naast de munters getypt: twee lijsten
   van dezelfde rollen lopen uiteen zodra er een munter bij komt, en dan noemt de
   ene lijst een rol die de andere niet kent. Dat is exact de fout die deze
   sleutelbos zelf moest oplossen (zie de kop). */
const ROLLEN = [...new Set([...MUNTERS.map(m => m[0]), ...LEGE_SLEUTELS])];

module.exports = { haalSleutels, meldSleutels, BASISROLLEN, ROLLEN, LEGE_SLEUTELS,
  PASLADDER, OFFICE_CODE, DEMO_PASS, MUNTERS };
