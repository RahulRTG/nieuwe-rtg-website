#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE ROMEPROEF -- de eerste keten die door ALLE VIER de werelden loopt.

   DE ZIN WAAR HIJ OM DRAAIT. Een lid zegt tegen Rahul:

       "Ik wil met mijn vrienden een weekend naar Rome, rekening houdend met
        ieders budget, vakantiedagen en voorkeuren."

   Dat is LivingOS (de vriendengroep, LIFE.md), WorkOS (de vrije dag bij de
   werkgever, VRIJHEID.md), TravelOS (de reis en het reisgezelschap, REIZEN.md)
   en het geld eronder (GELD.md, de pot over het eigen tegoed). De vraag is niet
   of elk van die domeinen werkt -- daar hebben ze eigen proeven voor -- maar of
   de KETEN ertussen bestaat, en of hij dat doet ZONDER dat een domein in het
   andere kijkt.

   WAAROM DE GRENZEN IN DE SCHAKELS ZITTEN EN NIET ERNAAST. Het besluit van
   11 oktober 2026 noemt drie harde grenzen, en elk ervan is hier een meting:

     1. VAKANTIEDAGEN. De vriend deelt ZELF wanneer hij kan (een antwoord op een
        voorgestelde datum). Zijn verlofsaldo en alles wat zijn werkgever over
        hem weet, gaat nooit naar de groep -- MN-02 (MENSNETWERK.md par. 4b):
        kennis uit hoedanigheid A (medewerker) wordt niet stilzwijgend gebruikt
        in hoedanigheid B (vriend). Storing 4 en 5 meten beide richtingen: het
        saldo komt niet in het groepsantwoord, en de reden van de vrije dag komt
        niet bij de werkgever.
     2. BUDGET. Rahul krijgt per deelnemer hoogstens past/past niet, nooit een
        bedrag van een ander en nooit vergelijkend (LIFE.md par. 4.4 en 4.6).
        Storing 6 zoekt het bedrag van de vriend in elk antwoord dat de
        organisator krijgt.
     3. MENSELIJKE REGIE. Uitnodiging, boeking en betaling aan of namens een
        tweede persoon worden klaargezet; een mens bevestigt (LIFE.md par. 3).
        Geld beweegt nooit vanzelf (GELD.md par. 3). Storing 1, 2 en 7.

   ER IS GEEN GEDEELDE KETENMODULE, en dat is dezelfde keuze als bij de andere
   ketens (scripts/ritproef.js, scripts/adamproef.js): een gedeelde ketenklasse
   eroverheen zou de `Asset`-fout zijn (DEVELOPERCLOUD.md par. 2). De VORM lijkt
   bewust op die proeven -- schakels met een van/naar, storingen met een
   belofte, `openBekend` met een uitgeschreven reden -- en wat de ketens
   werkelijk delen telt scripts/ketenvorm.js achteraf uit de registers.

   DEZE PROEF WIJZIGT GEEN PRODUCTCODE. Een open schakel is hier de werklijst
   van een volgende ronde: elke `openBekend` draagt een OORZAAK (wat de server
   antwoordde), een EIGENAAR (het domein en het bestand) en een OPLOSSING (wat
   er moet komen, en of dat een bouwtaak of een besluit is). Er wordt geen
   route verzonnen: een schakel die een voorziening nodig heeft die er niet is,
   meet de dichtstbijzijnde bestaande deur en zegt wat die NIET doet.

   Draaien:  npm run romeproef            (print, zakt op een open schakel zonder reden)
             npm run romeproef:vast       (schrijft ROMEPROEF.json)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
/* Het volle stempel (commit + boomVuil + instrument): zonder waartegen-is-dit-
   gemeten is een register niet na te lopen. */
const { stempel } = require('./lib/stempel');
const { registreerGratis } = require('./lib/gratisaccount');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'ROMEPROEF.json');
/* De werkgever van de vriend: de enige zaak in de zaaiset met een Nederlandse
   stad (zie scripts/adamproef.js, die hem om dezelfde reden kiest). Een zaak
   zonder entiteit kent geen dienstverband, en dan meet schakel 10 de
   opstelling in plaats van de keten. */
const WERKGEVER = 'MERIDIAAN';
const KANTOORCODE = 'RTG-OFFICE-PROEF';

/* Datums GEREKEND en niet ingetypt: een vaste datum verloopt, en dan meet deze
   keten stilletjes "een bijeenkomst in het verleden". Twee kandidaat-weekenden. */
function dag(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
const WEEKEND_1 = dag(30);
const WEEKEND_2 = dag(37);

/* Een MERKTEKEN voor het budget van de vriend: een potnaam en een bedrag die
   nergens anders in de wereld voorkomen. Storing 6 zoekt ze in alles wat de
   organisator te zien krijgt. Een bedrag als 450 zou toevallig ergens kunnen
   staan; 45 317 centen niet. */
const POT_CENTEN = 45317;

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

/* EEN OPEN SCHAKEL MET EEN UITGESCHREVEN REDEN IS EEN BEVINDING, GEEN DEFECT.

   Overgenomen uit scripts/adamproef.js (en die weer uit MET_REDEN in
   scripts/tikken.js). De reden is hier een OBJECT en geen zin, omdat de
   opdracht van deze proef is dat elke open schakel een werklijstregel is:
   `oorzaak` (gemeten), `eigenaar` (domein en bestand) en `oplossing` (wat er
   moet komen), plus `soort` -- bouwen, besluit of extern. test/romeproef.test.js
   eist alle vier en een minimumlengte, want een etiket is geen bevinding. */
function schakel(nr, wereld, van, naar, wat, bekend) {
  return { nr, wereld, van, naar, wat, bekend: bekend || null };
}

/* De ledengids (kern/gids.js) leert een lid pas kennen na zijn eerste
   geauthenticeerde verzoek. Zonder die stap is hij voor `keyVanCodenaam`
   onvindbaar en zakt een uitnodiging om de verkeerde reden -- dezelfde val die
   test/reisgezelschap-routes.test.js beschrijft. */
let volgnr = 0;
async function nieuwLid(basis, naam) {
  const u = naam.toLowerCase() + Date.now().toString().slice(-6) + (volgnr++);
  const tel = '06' + String(Date.now() + volgnr).slice(-8);
  const r = await post(basis, '/api/auth/register', { name: naam, email: u + '@voorbeeld.nl', phone: tel,
    password: 'geheim12345', geboortedatum: '1990-0' + (1 + (volgnr % 8)) + '-1' + (volgnr % 9), tier: 'rtg', pasApp: 'rtg' });
  const gebruiker = r.data && r.data.state && r.data.state.user;
  if (!r.data || !r.data.token || !gebruiker || !gebruiker.codename)
    throw new Error(naam + ' kon zich niet aanmelden (status ' + r.status + ': ' + JSON.stringify(r.data).slice(0, 160) + ')');
  await post(basis, '/api/reis/gezelschap/kring', {}, r.data.token);
  return { naam, token: r.data.token, codenaam: gebruiker.codename, login: u + '@voorbeeld.nl' };
}

/* DE WERKGEVER VAN DE VRIEND. Een ondernemer koppelt MERIDIAAN aan zijn
   entiteit, precies zoals scripts/adamproef.js dat doet (ondernemerKoppelt) --
   overgeschreven en niet gedeeld, om de reden in de kop. Dit is WERELD en geen
   uitslag: zonder entiteit is er geen dienstverband, en dan weigert Vrijheid
   elk verzoek met "er loopt geen dienstverband" -- een terechte weigering die
   niets over deze keten zegt. */
async function werkgeverKlaar(basis) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const team = ((await P('/api/supplier/roster', { code: WERKGEVER })).data || {}).staff || [];
  const mgr = team.find(x => x.role === 'manager');
  const login = mgr ? await P('/api/supplier/login', { code: WERKGEVER, staffId: mgr.id, pin: '1234' }) : null;
  const S = login && login.data && login.data.token;
  if (!S) throw new Error('geen managersessie bij ' + WERKGEVER + ' (status ' + (login ? login.status : 'geen manager') + ')');
  const tel = '06' + String(Date.now() + 77).slice(-8);
  const baas = await P('/api/auth/register', { name: 'Ondernemer Meridiaan', email: 'ondernemer.rome' + Date.now() + '@voorbeeld.nl',
    phone: tel, password: 'geheim123', geboortedatum: '1980-04-04', tier: 'business', pasApp: 'business' });
  const O = baas.data && baas.data.token;
  const inv = await P('/api/supplier/staff/invite', { name: 'Ondernemer Meridiaan', role: 'manager', func: 'Eigenaar' }, S);
  const kassacode = inv.data && inv.data.invite && inv.data.invite.kassacode;
  if (O && kassacode) await P('/api/werving/verbind', { kassacode }, O);
  const ent = O ? await P('/api/concern/entiteit/nieuw', { naam: 'Meridiaan BV', land: 'NL' }, O) : null;
  const entId = ent && ent.data && ent.data.entiteit && ent.data.entiteit.id;
  const ves = entId ? await P('/api/concern/vestiging/nieuw', { entiteit: entId, naam: 'Amsterdam', plaats: 'Amsterdam' }, O) : null;
  const vesId = ves && ves.data && ves.data.vestiging && ves.data.vestiging.id;
  const koppel = vesId ? await P('/api/concern/vestiging/zaak', { vestiging: vesId, code: WERKGEVER }, O) : null;
  if (!koppel || koppel.status !== 200) throw new Error('de ondernemer kon ' + WERKGEVER + ' niet aan zijn entiteit koppelen (status ' +
    (koppel ? koppel.status + ': ' + ((koppel.data && koppel.data.error) || '') : 'geen') + ')');
  return { S };
}

/* Alles wat de ORGANISATOR van de groep, het reisgezelschap en Rahul te zien
   krijgt, in een keer. Storing 4 en 6 zoeken daarin naar wat er NIET in hoort.
   Het zijn leesroutes: een meting verandert de toestand niet. */
async function watDeOrganisatorZiet(basis, A, groep, reis) {
  const P = (pad, lijf) => post(basis, pad, lijf, A.token);
  const delen = {
    groep: await P('/api/genootschap/mijn', {}),
    agenda: await P('/api/genootschap/agenda', { groep }),
    datum: await P('/api/genootschap/ai/datum', { groep }),
    command: await P('/api/sociaal/command', {}),
    rahul: await P('/api/sociaal/rahul', { vraag: 'Past het weekend Rome binnen ieders budget en vakantiedagen?' }),
    graaf: await P('/api/sociaal/graaf', {}),
    geldbeleid: await P('/api/geld/beleid', {}),
    geldcockpit: await P('/api/geld/cockpit', {})
  };
  if (reis) {
    delen.gezelschap = await P('/api/reis/gezelschap', { reis });
    delen.tijdlijn = await P('/api/reis/gezelschap/tijdlijn', { reis });
  }
  return delen;
}

async function loop(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const stap = async (s, doe, zien) => {
    const t0 = Date.now();
    let r, gezien = null, fout = null;
    try {
      r = await doe();
      if (!r || r.status < 200 || r.status >= 300) {
        /* Een 4xx MET een uitgeschreven reden is de meetuitslag ("hier weigert
           het huis, en het zegt waarom"); een 5xx of een 0 is stuk, ook met
           reden. Zelfde grens als scripts/adamproef.js. */
        const deur = (r && r.status >= 400 && r.status < 500) && s.bekend;
        uit.schakels.push(Object.assign({}, s, { stand: deur ? 'openBekend' : 'stuk',
          status: r ? r.status : 0, antwoord: r && r.data && (r.data.error || null), ms: Date.now() - t0 }));
        return null;
      }
      gezien = zien ? await zien(r) : null;
    } catch (e) { fout = String(e && e.message || e); }
    let stand = fout ? 'stuk' : (!zien ? 'gesloten' : (gezien && gezien.klopt ? 'gesloten' : 'open'));
    if (stand === 'open' && s.bekend) stand = 'openBekend';
    uit.schakels.push(Object.assign({}, s, { stand, status: r ? r.status : 0,
      ziet: gezien ? gezien.wat : null, fout, ms: Date.now() - t0 }));
    return r;
  };

  /* ---- DE WERELD: drie vrienden, een werkgever, het reisbureau ---- */
  const A = await nieuwLid(basis, 'Anna');   // de organisator, die het tegen Rahul zegt
  const B = await nieuwLid(basis, 'Bram');   // de vriend met een werkgever en een budget
  const C = await nieuwLid(basis, 'Cees');   // de vriend die kan op het tweede weekend
  if (new Set([A.codenaam, B.codenaam, C.codenaam]).size !== 3)
    throw new Error('twee vrienden delen een codenaam; uitnodigen wijst dan naar de verkeerde mens');
  const wg = await werkgeverKlaar(basis);
  const K = ((await P('/api/office/login', { code: KANTOORCODE })).data || {}).token;
  if (!K) throw new Error('geen kantoorsessie; draait de server met OFFICE_CODE=' + KANTOORCODE + '?');
  uit.wereld = {
    vrienden: 'drie leden langs /api/auth/register (RTG Pass), elk met een eigen codenaam',
    werkgever: WERKGEVER + ', door een ondernemer aan Meridiaan BV gekoppeld zoals in scripts/adamproef.js',
    kantoor: 'de gedeelde kantoorcode -- het reisbureau zet klaar; besluiten op naam zijn hier niet gemeten'
  };
  const ctx = { A, B, C, wg, K, groep: null, b1: null, b2: null, reis: null, reisUitnodigingB: null, aanvraag: null,
    staffB: null, verzoekB: null, potB: null };

  /* ======================= LivingOS: de vriendengroep ======================= */

  /* 1 -- Anna richt de groep op. Er is geen apart "vriendengroep"-object: het
     besloten genootschap (kern/genootschap) IS de kleine kring met een
     agenda, en een tweede groepsbegrip ernaast zou de les van
     SCHERMEIGENAAR.json herhalen. */
  await stap(
    schakel(1, 'LivingOS', 'organisator', 'organisator', 'richt een besloten vriendengroep op voor het weekend'),
    () => P('/api/genootschap/richt-op', { naam: 'Weekend Rome', soort: 'besloten', over: 'Een weekend weg met vrienden.' }, A.token),
    async r => {
      ctx.groep = r.data && r.data.groep && r.data.groep.id;
      const m = await P('/api/genootschap/mijn', {}, A.token);
      const bij = ((m.data && m.data.groepen) || []).find(g => g.id === ctx.groep);
      return { klopt: !!bij && bij.mijnRol === 'beheerder', wat: bij ? 'groep "' + bij.naam + '", rol ' + bij.mijnRol : 'groep niet terug te vinden' };
    });

  /* 2 -- Anna nodigt Bram en Cees uit. GRENS 3 zit hierin: de uitnodiging
     staat KLAAR bij de vriend, en hij is nog geen lid. Een uitnodiging die
     zichzelf aanvaardt, zou hier groen staan als we alleen de 200 lazen. */
  await stap(
    schakel(2, 'LivingOS', 'organisator', 'vriend', 'nodigt de vrienden uit; de uitnodiging staat klaar en maakt niemand vanzelf lid'),
    async () => {
      const b = await P('/api/genootschap/nodig-uit', { groep: ctx.groep, wie: B.codenaam }, A.token);
      if (b.status !== 200) return b;
      return P('/api/genootschap/nodig-uit', { groep: ctx.groep, wie: C.codenaam }, A.token);
    },
    async () => {
      const mB = await P('/api/genootschap/mijn', {}, B.token);
      const uitgenodigd = ((mB.data && mB.data.uitnodigingen) || []).some(g => g.id === ctx.groep);
      const alLid = ((mB.data && mB.data.groepen) || []).some(g => g.id === ctx.groep);
      return { klopt: uitgenodigd && !alLid, wat: 'bij de vriend: uitnodiging ' + uitgenodigd + ', al lid ' + alLid };
    });

  /* 3 -- de vrienden treden ZELF binnen. Pas nu ziet de organisator ze. */
  await stap(
    schakel(3, 'LivingOS', 'vriend', 'organisator', 'treden zelf binnen; de organisator ziet ze in de ledenlijst'),
    async () => {
      const b = await P('/api/genootschap/binnen', { groep: ctx.groep }, B.token);
      if (b.status !== 200) return b;
      return P('/api/genootschap/binnen', { groep: ctx.groep }, C.token);
    },
    async () => {
      const m = await P('/api/genootschap/mijn', {}, A.token);
      const g = ((m.data && m.data.groepen) || []).find(x => x.id === ctx.groep);
      const namen = ((g && g.ledenlijst) || []).map(l => l.codenaam);
      return { klopt: namen.includes(B.codenaam) && namen.includes(C.codenaam),
        wat: (g ? g.leden : 0) + ' leden, op codenaam' };
    });

  /* 4 -- Anna zet TWEE kandidaat-weekenden neer. De groep kent geen
     "beschikbaarheidspeiling"; wat er wel is, is een bijeenkomst per datum met
     ja/misschien/nee. Twee bijeenkomsten is de dichtstbijzijnde vorm, en
     schakel 7 meet wat die vorm NIET kan. */
  await stap(
    schakel(4, 'LivingOS', 'organisator', 'vriend', 'stelt twee kandidaat-weekenden voor; de vrienden zien ze in hun eigen agenda'),
    async () => {
      const a = await P('/api/genootschap/roep-bijeen', { groep: ctx.groep, wat: 'Weekend Rome', waar: 'Rome', datum: WEEKEND_1 }, A.token);
      if (a.status !== 200) return a;
      ctx.b1 = a.data.bijeenkomst.id;
      const b = await P('/api/genootschap/roep-bijeen', { groep: ctx.groep, wat: 'Weekend Rome', waar: 'Rome', datum: WEEKEND_2 }, A.token);
      if (b.status === 200) ctx.b2 = b.data.bijeenkomst.id;
      return b;
    },
    async () => {
      const ag = await P('/api/genootschap/mijn-agenda', {}, B.token);
      const ids = ((ag.data && ag.data.komt) || []).map(x => x.id);
      return { klopt: ids.includes(ctx.b1) && ids.includes(ctx.b2), wat: 'in de agenda van de vriend: ' + ids.length + ' bijeenkomst(en)' };
    });

  /* 5 -- RAHUL ZET KLAAR, DE VRIEND BEVESTIGT. Life Command (kern/socialecommand)
     leidt uit de openstaande bijeenkomst een voorstel af -- "laten weten of u
     komt" -- en Bram drukt zelf. Dat is precies het werkwoord van LIFE.md par. 3,
     en zijn antwoord komt in het DOMEIN terecht (de bijeenkomst), niet alleen in
     het log. */
  await stap(
    schakel(5, 'LivingOS', 'Rahul', 'vriend', 'zet bij de vriend klaar dat hij nog moet laten weten of hij komt; de vriend bevestigt zelf'),
    async () => {
      const c = await P('/api/sociaal/command', {}, B.token);
      const v = ((c.data && c.data.voorstellen) || []).find(x => String(x.id || '').includes(String(ctx.b1)) ||
        (x.gegevens || []).some(g => String(g).includes(String(ctx.b1))) || (x.titel === 'Weekend Rome' && x.wanneer === WEEKEND_1));
      if (!v) return { status: 409, data: { error: 'geen klaargezet voorstel voor de bijeenkomst van ' + WEEKEND_1 + ' (' +
        ((c.data && c.data.voorstellen) || []).length + ' voorstellen)' } };
      ctx.voorstelB = v;
      const keuze = (v.keuzes || []).map(k => (k && k.id) || k).find(k => /^ja$/i.test(String(k))) || 'ja';
      return P('/api/sociaal/voorstel/bevestig', { id: v.id, keuze }, B.token);
    },
    async () => {
      const ag = await P('/api/genootschap/agenda', { groep: ctx.groep }, A.token);
      const b = ((ag.data && ag.data.komt) || []).find(x => x.id === ctx.b1);
      return { klopt: !!b && (b.komen || []).includes(B.codenaam),
        wat: b ? 'bij de organisator: ' + b.ja + ' ja op ' + WEEKEND_1 + ', komen: ' + (b.komen || []).join(', ') : 'bijeenkomst weg' };
    });

  /* 6 -- de andere vriend antwoordt zelf, op beide datums. */
  await stap(
    schakel(6, 'LivingOS', 'vriend', 'organisator', 'antwoordt zelf per kandidaat-weekend; de organisator ziet de stand per datum'),
    async () => {
      const a = await P('/api/genootschap/antwoord', { groep: ctx.groep, id: ctx.b1, antwoord: 'nee' }, C.token);
      if (a.status !== 200) return a;
      const b = await P('/api/genootschap/antwoord', { groep: ctx.groep, id: ctx.b2, antwoord: 'ja' }, C.token);
      if (b.status !== 200) return b;
      return P('/api/genootschap/antwoord', { groep: ctx.groep, id: ctx.b2, antwoord: 'ja' }, A.token);
    },
    async () => {
      const ag = await P('/api/genootschap/agenda', { groep: ctx.groep }, A.token);
      const k = (ag.data && ag.data.komt) || [];
      const b1 = k.find(x => x.id === ctx.b1), b2 = k.find(x => x.id === ctx.b2);
      return { klopt: !!b1 && !!b2 && b1.nee === 1 && b2.ja === 2,
        wat: WEEKEND_1 + ': ' + (b1 ? b1.ja + ' ja / ' + b1.nee + ' nee' : '?') + '; ' +
          WEEKEND_2 + ': ' + (b2 ? b2.ja + ' ja / ' + b2.nee + ' nee' : '?') };
    });

  /* 7 -- "IK KAN DRIE DAGEN IN DIE WEEK". Dit is wat de opdracht vraagt, en de
     groep kent het niet: een antwoord is ja/misschien/nee op EEN datum. De
     proef stuurt het venster mee met het enige antwoord dat er is, en kijkt of
     het ergens aankomt. Er wordt geen route verzonnen. */
  await stap(
    schakel(7, 'LivingOS', 'vriend', 'organisator', 'deelt zelf een beschikbaarheidsvenster ("drie dagen in die week") in plaats van ja/nee per datum', {
      soort: 'bouwen',
      oorzaak: 'Een bijeenkomst in kern/genootschap/bijeenkomst.js draagt een vaste `datum`, en antwoord() kent alleen ja, misschien en nee (ANTWOORDEN). Een venster dat met het antwoord wordt meegestuurd, wordt zonder melding genegeerd: de organisator ziet het nergens terug.',
      eigenaar: 'LivingOS -- server/kern/genootschap/bijeenkomst.js (en datumRaad in kern/genootschap/ai.js, die alleen antwoorden telt)',
      oplossing: 'Een peiling als vorm naast de bijeenkomst: de organisator zet een venster neer, elk lid geeft ZELF zijn beschikbare dagen op (nooit afgeleid uit agenda of rooster), en datumRaad telt overlap in plaats van ja-stemmen. De grens uit LIFE.md par. 4.3 geldt: alleen wat iemand zelf opgaf, wisbaar door hem.'
    }),
    () => P('/api/genootschap/antwoord', { groep: ctx.groep, id: ctx.b2, antwoord: 'misschien',
      venster: { van: WEEKEND_2, dagen: 3 } }, B.token),
    async () => {
      const ag = await P('/api/genootschap/agenda', { groep: ctx.groep }, A.token);
      const b2 = ((ag.data && ag.data.komt) || []).find(x => x.id === ctx.b2);
      const draagt = !!b2 && /venster|beschikba|dagen/i.test(JSON.stringify(b2));
      return { klopt: draagt, wat: 'de bijeenkomst bij de organisator draagt ' + (draagt ? 'een venster' :
        'geen venster: velden ' + Object.keys(b2 || {}).join(', ')) };
    });

  /* 8 -- RAHUL REKENT DE DATUM UIT DE ANTWOORDEN. kern/genootschap/ai.js
     datumRaad: welke dag past de meesten, met de telling erbij en zonder model
     -- "een model maakt tellen niet betrouwbaarder". */
  await stap(
    schakel(8, 'LivingOS', 'Rahul', 'organisator', 'zegt welk kandidaat-weekend de meeste vrienden past, alleen uit wat ze zelf antwoordden'),
    () => P('/api/genootschap/ai/datum', { groep: ctx.groep }, A.token),
    async r => {
      const d = r.data || {};
      return { klopt: d.beste === WEEKEND_2 && d.ai === false && Array.isArray(d.meting),
        wat: 'beste: ' + d.beste + ' (bron ' + d.bron + ', model: ' + d.ai + ') -- "' + String(d.tekst || '').slice(0, 120) + '"' };
    });

  /* ======================= WorkOS: de vrije dag ======================= */

  /* 9 -- BRAM IS OOK MEDEWERKER, en dat is een andere hoedanigheid. Zijn
     werkgever nodigt hem uit; hij verbindt zijn EIGEN account. Dit is wereld,
     maar wel langs de echte deur (routes/werving.js), dus hij staat als schakel:
     zonder dienstverband bij de entiteit kan Vrijheid geen vrije dag geven. */
  await stap(
    schakel(9, 'WorkOS', 'werkgever', 'vriend', 'neemt de vriend aan; hij verbindt zijn eigen account en heeft een dienstverband'),
    async () => {
      const inv = await P('/api/supplier/staff/invite', { name: 'Bram', role: 'staff', func: 'Receptie' }, wg.S);
      const kassacode = inv.data && inv.data.invite && inv.data.invite.kassacode;
      if (!kassacode) return inv;
      const v = await P('/api/werving/verbind', { kassacode }, B.token);
      ctx.staffB = v.data && v.data.staffId;
      return v;
    },
    async r => {
      const werk = ((await P('/api/concern/mijnwerk', {}, B.token)).data || {}).werkplekken || [];
      const dv = werk.find(x => x.bedrijf === 'Meridiaan BV');
      return { klopt: !!ctx.staffB && !!dv, wat: 'personeelsnummer ' + ctx.staffB + ', ' +
        (dv ? 'dienstverband bij ' + dv.bedrijf + ' als ' + dv.rol : 'geen dienstverband (' + JSON.stringify(r.data && r.data.dienstverband) + ')') };
    });

  /* 10 -- BRAM VRAAGT ZELF EEN VRIJE DAG, met zijn eigen werkplek-login (geen
     bedrijfsaccount). Ontvanger: zijn leidinggevende. De reden "Rome" gaat
     NIET mee -- het verzoek kent geen redenveld buiten bijzonder verlof, en dat
     is MN-02 in de andere richting (storing 5). */
  await stap(
    schakel(10, 'WorkOS', 'vriend', 'werkgever', 'vraagt met zijn eigen werkplek-login een vrije dag voor het weekend; de leidinggevende ziet het verzoek', {
      soort: 'bouwen',
      oorzaak: 'RTG Vrijheid beslist het verzoek meteen zelf en stuurt het niet naar een mens: de stap RIGHTS_POLICY zegt NIET_NODIG ("U staat op die dag niet ingeroosterd; er hoeft niets vrij te worden gemaakt"), omdat het rooster maar 7 dagen vooruit kijkt (kern/personeel.js, ook gemeld in `ontbreekt`). Voor een weekend over een maand bestaat dus nog geen dienst, het verzoek eindigt als DECLINED. Of die dag beschermd is wanneer het rooster later wordt gemaakt, is hier NIET gemeten -- het verzoek zelf staat in elk geval niet meer open. Het verlofsaldo is daarnaast niet aangesloten (Mijn tijd: "Het saldo komt uit uw contract en payroll en is hier niet aangeleverd").',
      eigenaar: 'WorkOS -- server/kern/vrijheid/ (motor en teambeeld), saldo uit server/kern/payroll/; routes/vrijheid/tijd.js',
      oplossing: 'Een verzoek voor een dag buiten de roosterhorizon wordt een VOORUITGEBOEKTE vrije dag die de planner leest wanneer het rooster wordt gemaakt (zoals kern/payroll/inplanbaar.js verzuim leest), of gaat als wachtend verzoek naar de leidinggevende -- niet DECLINED. En het vakantiesaldo uit het contract aansluiten (VRIJHEID.md, lus.js BLOCKED). Het saldo blijft van de medewerker en de werkgever; het verlaat WorkOS niet (storing 4).'
    }),
    async () => {
      const w = await P('/api/supplier/mijn/login', { login: B.login, password: 'geheim12345', bedrijf: WERKGEVER });
      ctx.werkTokenB = w.data && w.data.token;
      if (!ctx.werkTokenB) return w;
      const v = await P('/api/staff/tijd/verzoek', { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', datum: WEEKEND_2 }, ctx.werkTokenB);
      ctx.verzoekB = v.data && v.data.verzoek;
      return v;
    },
    async () => {
      const o = await P('/api/supplier/tijd/overzicht', {}, wg.S);
      const wacht = ((o.data && o.data.wachtend) || []).some(x => x.id === (ctx.verzoekB && ctx.verzoekB.id));
      const mijn = await P('/api/staff/tijd', {}, ctx.werkTokenB);
      const vak = (mijn.data && mijn.data.tijd && mijn.data.tijd.vakantie) || {};
      const v = ctx.verzoekB || {};
      /* De stap die het besluit draagt is de LAATSTE die niet doorliet, en niet
         de eerste: de eerste is de geschiktheid, en die zegt hier juist dat het
         dienstverband loopt. */
      const stappen = v.stappen || [];
      const beslissend = stappen.filter(x => x.stand && x.stand !== 'PASS' && x.stand !== 'OK').pop() || stappen[stappen.length - 1] || {};
      return { klopt: wacht || v.stand === 'APPROVED',
        wat: 'verzoek ' + v.stand + ' (' + v.uitkomst + ', stap ' + beslissend.stap + ' ' + beslissend.stand + ': "' +
          String(beslissend.uitleg || '').slice(0, 140) + '"), bij de leidinggevende wachtend: ' + wacht +
          '; stappen: ' + stappen.map(x => x.stap + '=' + x.stand).join(', ') +
          '; in dienst: ' + (mijn.data && mijn.data.ikInDienst) + ', verlofsaldo: ' + (vak.recht == null ? 'niet aangesloten ("' + (vak.reden || '') + '")' : vak.recht) };
    });

  /* ======================= het geld: budget ======================= */

  /* 11 -- BRAM ZET ZELF GELD APART. Een pot over zijn eigen tegoed: er beweegt
     geen geld (kern/geldbeleid/potten.js logt het zo), en hij is van hem. */
  await stap(
    schakel(11, 'geld', 'vriend', 'vriend', 'zet zelf een pot apart voor het weekend; alleen hij ziet het bedrag'),
    () => P('/api/geld/pot/zet', { naam: 'Rome-' + B.codenaam.slice(-4), doelCenten: POT_CENTEN }, B.token),
    async r => {
      ctx.potB = r.data && r.data.pot;
      const b = await P('/api/geld/beleid', {}, B.token);
      const p = ((b.data && b.data.potten) || []).find(x => x.id === (ctx.potB && ctx.potB.id));
      return { klopt: !!p && p.doelCenten === POT_CENTEN && p.standCenten === 0,
        wat: p ? 'pot "' + p.naam + '", doel ' + p.doelCenten + ' centen, stand ' + p.standCenten : 'pot niet terug te vinden' };
    });

  /* 12 -- PAST / PAST NIET. Wat de opdracht vraagt is dat Rahul per deelnemer
     hoogstens weet of het weekend past -- en nooit het bedrag. Die projectie
     bestaat niet. De proef meet de dichtstbijzijnde stem (Rahul in Sociaal) en
     kijkt of hij iets per deelnemer zegt. */
  await stap(
    schakel(12, 'geld', 'vriend', 'Rahul', 'laat Rahul per deelnemer alleen weten of het weekend past, zonder bedrag en zonder vergelijking', {
      soort: 'besluit',
      oorzaak: 'Er is geen deling van "past / past niet": een pot (kern/geldbeleid/potten.js) is alleen van het lid zelf, en Rahul in Sociaal (routes/socialerahul.js) leest uitsluitend de sociale graaf -- zijn antwoord noemt geen deelnemer en geen budget. Rahul kan het budget dus niet meewegen, ook niet zonder bedrag.',
      eigenaar: 'het geld (GELD.md) en LivingOS (LIFE.md par. 4.6) samen -- server/kern/geldbeleid/ en server/kern/levensband/ voor de deling',
      oplossing: 'Een deling op kern/levensband/ (eigen cap, vervaldatum, intrekbaar door elke kant) die per deelnemer uitsluitend een BOOLEAN projecteert: past het opgegeven bedrag binnen zijn eigen pot. Nooit het bedrag, nooit een volgorde, en "past niet" zonder reden. Vraagt eerst een besluit van de eigenaar of deze deling mag bestaan (LIFE.md par. 4.6: toestemming reist niet mee).'
    }),
    () => P('/api/sociaal/rahul', { vraag: 'Past het weekend Rome binnen het budget van ' + B.codenaam + '?' }, A.token),
    async r => {
      const d = r.data || {};
      const perDeelnemer = /past niet|past wel|binnen (zijn|het) budget/i.test(String(d.antwoord || '')) &&
        String(d.antwoord || '').includes(B.codenaam);
      return { klopt: perDeelnemer, wat: 'Rahul antwoordt: "' + String(d.antwoord || '').slice(0, 120) + '" op gronden: ' +
        (d.gegevens || []).slice(0, 3).join(' | ') };
    });

  /* ======================= TravelOS: de reis ======================= */

  /* 13 -- het reisbureau om een Rome-reis vragen. Het advies (kern/reisbureau-
     advies.js) rangschikt de catalogus op woorden. Er ligt geen Rome in. */
  await stap(
    schakel(13, 'TravelOS', 'organisator', 'reisbureau', 'vraagt een weekend Rome; het advies wijst Rome aan of zegt eerlijk dat die er niet is', {
      soort: 'bouwen',
      oorzaak: 'De catalogus (db.data.partnerTrips, kern/reisaanbod.js) bevat Ibiza, Gstaad, Monaco en Lissabon -- geen Rome. Het advies matcht op losse woorden en wijst op "weekend" een reis naar GSTAAD aan, zonder te zeggen dat de gevraagde bestemming ontbreekt. Een advies naar een andere stad dan gevraagd is een verkeerd antwoord dat er goed uitziet.',
      eigenaar: 'TravelOS -- server/kern/reisbureau-advies.js (rangschikking), aanbod in server/kern/reisaanbod.js',
      oplossing: 'Het advies herkent een bestemming in de wens en geeft bij geen treffer GEEN andere stad maar de weg die er wel is: "geen Rome in de catalogus; het reisbureau kan hem samenstellen" (de klaarzetweg van schakel 14). Een Rome-reis in de catalogus is een inkoopbesluit (TRAVELCOMMERCE.md) en geen bouwtaak.'
    }),
    () => P('/api/reisbureau/advies', { wens: 'een weekend Rome met vrienden' }, A.token),
    async r => {
      const reis = (r.data && r.data.reis) || {};
      const eerlijk = reis.bestemming === 'Rome' || (!reis.id && /rome|niet/i.test(JSON.stringify(r.data)));
      return { klopt: eerlijk, wat: 'advies: ' + (reis.titel || '(geen reis)') + ' -- reden "' + ((r.data && r.data.reden) || '') + '"' };
    });

  /* 14 -- het reisbureau STELT DE REIS SAMEN en zet hem klaar; Anna eist hem
     zelf op. Dat is de weg "via ons" (REIZEN.md): de reis bezit geen boeking
     maar een verwijzing, en hij ontstaat pas bij het lid als zij hem opeist. */
  await stap(
    schakel(14, 'TravelOS', 'reisbureau', 'organisator', 'stelt een Rome-reis samen en zet die klaar; de organisator eist hem zelf op'),
    async () => {
      const z = await P('/api/office/reisbureau/klaarzetten', { onderdelen: [
        { soort: 'verblijf', titel: 'Hotel aan de Tiber', bestemming: 'Rome', van: WEEKEND_2, tot: dag(39), kenmerk: 'RM7731', herkomst: 'document' }
      ] }, K);
      const code = z.data && z.data.link && z.data.link.split('code=')[1];
      if (!code) return z;
      return P('/api/reis/uitnodiging/eisop', { code }, A.token);
    },
    async () => {
      const rz = await P('/api/reis/reizen', {}, A.token);
      const reis = ((rz.data && rz.data.reizen) || []).find(x => x.bestemming === 'Rome');
      ctx.reis = reis && reis.id;
      return { klopt: !!reis && reis.venster && reis.venster.van === WEEKEND_2,
        wat: reis ? 'reis ' + reis.id + ', ' + reis.venster.van + ' tot ' + reis.venster.tot : 'geen Rome-reis bij de organisator' };
    });

  /* 15 -- het REISGEZELSCHAP. Anna nodigt Bram uit als reisgenoot; de
     uitnodiging staat klaar en geeft nog niets prijs (grens 3). */
  await stap(
    schakel(15, 'TravelOS', 'organisator', 'vriend', 'nodigt de vriend uit als reisgenoot; hij ziet de uitnodiging en nog niet de reis'),
    async () => {
      const r = await P('/api/reis/gezelschap/nodig-uit', { reis: ctx.reis, codenaam: B.codenaam, rol: 'reisgenoot' }, A.token);
      ctx.reisUitnodigingB = r.data && r.data.lid && r.data.lid.id;
      return r;
    },
    async () => {
      const k = await P('/api/reis/gezelschap/kring', {}, B.token);
      const gevraagd = ((k.data && k.data.gevraagd) || []).some(x => x.id === ctx.reisUitnodigingB);
      const reis = await P('/api/reis/gezelschap/reis', { reis: ctx.reis }, B.token);
      return { klopt: gevraagd && reis.status === 404, wat: 'uitnodiging klaar: ' + gevraagd + ', reis zichtbaar voor ja: status ' + reis.status };
    });

  /* 16 -- Bram aanvaardt zelf, en ziet de reis als REISGENOOT: bestemming en
     draaiboek wel, boekingskenmerk en prijs niet (kern/reisgezelschap-poort.js). */
  await stap(
    schakel(16, 'TravelOS', 'vriend', 'organisator', 'aanvaardt zelf; ziet de reis zonder boekingskenmerk en prijs, en de organisator ziet hem meereizen'),
    () => P('/api/reis/gezelschap/antwoord', { id: ctx.reisUitnodigingB, ja: true }, B.token),
    async () => {
      const r = await P('/api/reis/gezelschap/reis', { reis: ctx.reis }, B.token);
      const g = await P('/api/reis/gezelschap', { reis: ctx.reis }, A.token);
      const mee = ((g.data && g.data.leden) || []).some(l => l.codenaam === B.codenaam && l.stand === 'aanvaard');
      const lekt = JSON.stringify(r.data || {}).includes('RM7731');
      return { klopt: r.status === 200 && !lekt && mee,
        wat: 'reisgenoot ziet de reis: ' + r.status + ', kenmerk zichtbaar: ' + lekt + ', bij de organisator aanvaard: ' + mee };
    });

  /* 17 -- FoundationOS: DE UNIVERSELE BODEM. SAMENLEVING.md par. 3: verbinden
     hoort bij wat achter geen enkele betaling verdwijnt, en "identiteit begrenst
     handelingen, niet het mens-zijn". Een vriend zonder pas -- een gratis
     account langs de echte registratie (scripts/lib/gratisaccount.js) -- hoort
     mee te kunnen: in de groep en in het reisgezelschap. De pas van de
     organisator zegt niets over wie zij mag meenemen. */
  await stap(
    schakel(17, 'FoundationOS', 'organisator', 'vriend zonder pas', 'nodigt een vriend met een gratis account uit; hij treedt zelf binnen en reist mee, de pas bepaalt niet wie meegaat'),
    async () => {
      const gratis = await registreerGratis(basis);
      if (!gratis) return { status: 409, data: { error: 'geen gratis account aan te maken langs /api/auth/register' } };
      ctx.E = gratis;
      await P('/api/reis/gezelschap/kring', {}, gratis.token);
      const u = await P('/api/genootschap/nodig-uit', { groep: ctx.groep, wie: gratis.codenaam }, A.token);
      if (u.status !== 200) return u;
      const b = await P('/api/genootschap/binnen', { groep: ctx.groep }, gratis.token);
      if (b.status !== 200) return b;
      const r = await P('/api/reis/gezelschap/nodig-uit', { reis: ctx.reis, codenaam: gratis.codenaam, rol: 'reisgenoot' }, A.token);
      if (r.status !== 200) return r;
      return P('/api/reis/gezelschap/antwoord', { id: r.data.lid.id, ja: true }, gratis.token);
    },
    async () => {
      const ag = await P('/api/genootschap/mijn-agenda', {}, ctx.E.token);
      const reis = await P('/api/reis/gezelschap/reis', { reis: ctx.reis }, ctx.E.token);
      const n = ((ag.data && ag.data.komt) || []).filter(x => x.groepId === ctx.groep).length;
      return { klopt: n === 2 && reis.status === 200,
        wat: 'gratis account: ' + n + ' kandidaat-weekenden in zijn agenda, de reis zichtbaar als reisgenoot: ' + reis.status };
    });

  /* 18 -- BOEKEN EN BETALEN PER DEELNEMER. Een aanvraag bij het reisbureau
     draagt `personen` als AANTAL. De catalogus heeft geen Rome (schakel 13),
     dus de proef boekt het mechanisme op een catalogusreis -- het gaat hier om
     de vorm van de aanvraag, niet om de stad. */
  await stap(
    schakel(18, 'TravelOS', 'organisator', 'vriend', 'vraagt de reis aan voor drie; elke medereiziger krijgt zijn eigen deel klaargezet om zelf te bevestigen en te betalen', {
      soort: 'besluit',
      oorzaak: 'Een aanvraag (kern/reisbureau.js boek) draagt `personen` als getal en `customerKey` van een lid: de medereizigers bestaan er niet in. De vriend ziet de aanvraag niet in /api/reisbureau/mijn, en betalen (kern/reisbureau-betaling.js) int de hele reissom op EEN boeking bij de aanvrager. Er is geen weg waarlangs ieder zijn eigen deel bevestigt.',
      eigenaar: 'TravelOS -- server/kern/reisbureau.js en server/kern/reisbureau-betaling.js; de verdeling raakt TRAVELCOMMERCE.md (wie betaalt wat) en GELD.md par. 3',
      oplossing: 'Deelnemers als verwijzing op de aanvraag (codenaam, en alleen na hun eigen ja in het reisgezelschap), met per deelnemer een KLAARGEZET deel dat hij zelf bevestigt en betaalt langs kern/pay. Nooit innen namens een ander. Wie het deel bepaalt en of RTG een gesplitste reissom mag innen is een besluit (TRAVELCOMMERCE.md), geen bouwtaak.'
    }),
    async () => {
      const r = await P('/api/reisbureau/boek', { tripId: 'lissabon-nieuw', personen: 3, vertrek: WEEKEND_2, notitie: 'met twee vrienden' }, A.token);
      ctx.aanvraag = r.data && r.data.aanvraag;
      return r;
    },
    async () => {
      const mB = await P('/api/reisbureau/mijn', {}, B.token);
      const ziet = ((mB.data && mB.data.aanvragen) || []).some(a => a.ref === (ctx.aanvraag && ctx.aanvraag.ref));
      return { klopt: ziet, wat: 'aanvraag ' + (ctx.aanvraag && ctx.aanvraag.ref) + ' voor ' + (ctx.aanvraag && ctx.aanvraag.personen) +
        ' personen; de medereiziger ziet hem: ' + ziet };
    });

  /* ======================= Rahul: samenstellen ======================= */

  /* 19 -- "REGEL ZATERDAG" voor een weekend. LIFE.md par. 3: Rahul mag het hele
     plan samenstellen en klaarzetten, een scherm, een bevestiging. De stukken
     staan nu los (datum, reis, gezelschap); de proef vraagt of er EEN voorstel
     is dat ze samenbrengt. */
  await stap(
    schakel(19, 'LivingOS', 'Rahul', 'organisator', 'stelt het weekend in een voorstel samen (datum uit de antwoorden, de reis, wie meegaat) en zet het klaar voor een bevestiging', {
      soort: 'bouwen',
      oorzaak: 'Life Command (kern/socialecommand/voorstellen.js) leidt voorstellen alleen af uit een openstaande zaak ("laten weten of u komt"); er is geen samenstelling over werelden. Rahul in Sociaal leest alleen de sociale graaf en weet niets van de reis, en kern/stuur/plan.js compileert stappen tegen het beleid maar heeft geen HTTP-ingang voor een lid en geen deze-groep-context.',
      eigenaar: 'LivingOS -- server/kern/socialecommand/ (voorstellen), met de datum uit kern/genootschap/ai.js en de reis als projectie uit kern/reisgezelschap.js',
      oplossing: 'Een samenstel-voorstel dat PROJECTEERT en niets bezit: datumRaad + de reis (alleen de velden van de reisgezelschap-poort) + per deelnemer past/past niet (schakel 12, zodra die deling er is). Een bevestiging zet alleen klaar wat een ander bereikt; elke uitnodiging en elk deel blijft een eigen ja van de ander. Hangt af van schakel 7, 12 en 18.'
    }),
    () => P('/api/sociaal/command', {}, A.token),
    async r => {
      const v = (r.data && r.data.voorstellen) || [];
      const samen = v.find(x => /weekend|rome/i.test(String(x.titel || '')) && /reis|samen/i.test(String(x.wat || '')));
      return { klopt: !!samen, wat: v.length + ' voorstel(len) bij de organisator: ' + v.map(x => x.wat + ' - ' + x.titel).join('; ') };
    });

  return ctx;
}

/* ======================= DE STORINGEN ======================= */

async function storingen(basis, uit, ctx) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const { A, B, C, wg } = ctx;
  const noteer = (nr, naam, grens, belofte, klopt, wat) =>
    uit.storingen.push({ nr, naam, grens, belofte, stand: klopt ? 'gehouden' : 'gebroken', wat });

  /* 1. EEN UITNODIGING BEVESTIGT ZICHZELF NIET. Een vierde lid, D, wordt
     uitgenodigd en zegt niets. Hij is geen lid, ziet de agenda niet, en de
     organisator kan hem er niet in zetten. */
  const D = await nieuwLid(basis, 'Dirk');
  await P('/api/genootschap/nodig-uit', { groep: ctx.groep, wie: D.codenaam }, A.token);
  const dAgenda = await P('/api/genootschap/agenda', { groep: ctx.groep }, D.token);
  const dMijn = await P('/api/genootschap/mijn', {}, D.token);
  const dLid = ((dMijn.data && dMijn.data.groepen) || []).some(g => g.id === ctx.groep);
  noteer(1, 'een uitgenodigde vriend die niets zegt', 'menselijke regie',
    'is geen lid en ziet de agenda en de antwoorden van de groep niet',
    !dLid && dAgenda.status >= 400, 'lid: ' + dLid + ', agenda: ' + dAgenda.status + ' "' + ((dAgenda.data && dAgenda.data.error) || '') + '"');

  /* 2. DE ORGANISATOR ANTWOORDT NIET NAMENS DE ANDER. Op het reisgezelschap:
     een tweede uitnodiging (Cees) en Anna probeert hem zelf te aanvaarden. */
  const uitC = await P('/api/reis/gezelschap/nodig-uit', { reis: ctx.reis, codenaam: C.codenaam, rol: 'reisgenoot' }, A.token);
  const idC = uitC.data && uitC.data.lid && uitC.data.lid.id;
  const namens = await P('/api/reis/gezelschap/antwoord', { id: idC, ja: true }, A.token);
  const cZiet = await P('/api/reis/gezelschap/reis', { reis: ctx.reis }, C.token);
  noteer(2, 'de organisator aanvaardt de reisuitnodiging namens een vriend', 'menselijke regie',
    'weigert; alleen de uitgenodigde zelf zet de stand om, en tot dan ziet hij de reis niet',
    !!idC && namens.status === 404 && cZiet.status === 404,
    'namens: ' + namens.status + ', de vriend ziet de reis: ' + cZiet.status);

  /* 3. RAHUL PLAATST NIETS. datumRaad schrijft hoogstens een tekst: na de
     aanroep staan er evenveel bijeenkomsten met dezelfde antwoorden. */
  const voor = await P('/api/genootschap/agenda', { groep: ctx.groep }, A.token);
  await P('/api/genootschap/ai/datum', { groep: ctx.groep }, A.token);
  await P('/api/sociaal/rahul', { vraag: 'Zet het weekend Rome vast en nodig iedereen uit.' }, A.token);
  const na = await P('/api/genootschap/agenda', { groep: ctx.groep }, A.token);
  const vorm = (a) => JSON.stringify(((a.data && a.data.komt) || []).map(b => [b.id, b.ja, b.misschien, b.nee]));
  noteer(3, 'Rahul gevraagd het weekend vast te zetten', 'menselijke regie',
    'Rahul plaatst niets en verandert geen antwoord: de agenda is na de vraag dezelfde',
    vorm(voor) === vorm(na) && voor.status === 200, 'voor ' + vorm(voor) + ', na ' + vorm(na));

  /* 4. MN-02: WAT DE WERKGEVER OVER BRAM WEET, KOMT NIET IN DE GROEP. Eerst
     wat Bram in WorkOS van zichzelf ziet; dan alles wat de organisator ziet.
     Gezocht wordt naar de werkgever, zijn personeelsnummer, het verzoek en de
     woorden waarmee een saldo of dienstverband zich aandient. */
  const zijnTijd = ctx.werkTokenB ? await P('/api/staff/tijd', {}, ctx.werkTokenB) : { status: 0, data: null };
  const ziet = await watDeOrganisatorZiet(basis, A, ctx.groep, ctx.reis);
  const tekst = JSON.stringify(ziet);
  const merktekens = [WERKGEVER, 'Meridiaan', ctx.verzoekB && ctx.verzoekB.id, 'STATUTORY_LEAVE', 'verlofsaldo', 'dienstverband',
    'Normaal verlofsaldo'].filter(Boolean);
  const personeelsnummer = ctx.staffB != null ? new RegExp('"staffId"\\s*:\\s*"?' + ctx.staffB + '\\b') : null;
  const gevonden = merktekens.filter(m => tekst.includes(String(m)));
  if (personeelsnummer && personeelsnummer.test(tekst)) gevonden.push('staffId ' + ctx.staffB);
  const sleutels = [...new Set([...tekst.matchAll(/"([A-Za-z]*(?:saldo|verlof|vakantie|rtgDag)[A-Za-z]*)"\s*:/gi)].map(m => m[1]))];
  noteer(4, 'werkgegevens van de vriend in de privecontext van de groep', 'MN-02 / vakantiedagen',
    'niets van wat zijn werkgever over hem weet (saldo, dienstverband, verzoek) staat in wat de organisator, de groep of Rahul ziet',
    zijnTijd.status === 200 && gevonden.length === 0 && sleutels.length === 0,
    'de vriend ziet in WorkOS zelf: ' + zijnTijd.status + '; in ' + Object.keys(ziet).length + ' antwoorden aan de organisator gevonden: ' +
      (gevonden.concat(sleutels).join(', ') || 'niets'));

  /* 5. EN ANDERSOM: DE WERKGEVER ZIET NIET WAAROM. Het verzoek van Bram komt
     bij de leidinggevende zonder groep, bestemming of vrienden. */
  const ov = await P('/api/supplier/tijd/overzicht', {}, wg.S);
  const ovTekst = JSON.stringify(ov.data || {});
  const lek = ['Rome', 'Weekend Rome', A.codenaam, C.codenaam].filter(m => ovTekst.includes(m));
  noteer(5, 'de reden van de vrije dag bij de werkgever', 'MN-02 / vakantiedagen',
    'de leidinggevende ziet geen groep, bestemming of vrienden: een vrije dag draagt geen reden',
    ov.status === 200 && lek.length === 0, 'overzicht ' + ov.status + ', gevonden: ' + (lek.join(', ') || 'niets'));

  /* 6. HET BUDGET VAN DE VRIEND BLIJFT VAN HEM. Zijn potnaam en zijn exacte
     bedrag worden gezocht in alles wat de organisator ziet -- inclusief haar
     EIGEN geldbeleid en cockpit, want een lek via de geldgraaf zou daar landen. */
  const potNaam = ctx.potB && ctx.potB.naam;
  const budgetLek = [potNaam, String(POT_CENTEN), String(POT_CENTEN / 100).replace('.', ',')].filter(m => m && tekst.includes(m));
  noteer(6, 'het budget van een vriend in wat de organisator ziet', 'budget',
    'zijn pot en zijn bedrag staan nergens bij de organisator, de groep of Rahul -- ook niet vergelijkend',
    !!potNaam && budgetLek.length === 0, 'gezocht naar "' + potNaam + '" en ' + POT_CENTEN + ' centen: ' + (budgetLek.join(', ') || 'niets gevonden'));

  /* 7. GELD BEWEEGT NIET VANZELF. Bram probeert de aanvraag van Anna te
     betalen (bestaat niet voor hem), Anna probeert te betalen voordat een mens
     van het reisbureau iets bevestigde, en de pot van Bram staat nog op nul. */
  const bramBetaalt = ctx.aanvraag ? await P('/api/reisbureau/betaal', { ref: ctx.aanvraag.ref }, B.token) : { status: 0 };
  const annaTeVroeg = ctx.aanvraag ? await P('/api/reisbureau/betaal', { ref: ctx.aanvraag.ref }, A.token) : { status: 0 };
  const pot = ((await P('/api/geld/beleid', {}, B.token)).data || {}).potten || [];
  const stand = (pot.find(x => x.id === (ctx.potB && ctx.potB.id)) || {}).standCenten;
  noteer(7, 'betalen voor een ander, of voordat een mens bevestigde', 'geld verlaat het huis niet vanzelf',
    'een vriend kan de reis van een ander niet betalen, een onbevestigde reis wordt niet geind, en geen pot beweegt zonder het lid',
    bramBetaalt.status === 404 && annaTeVroeg.status >= 400 && annaTeVroeg.status < 500 && stand === 0,
    'vriend betaalt: ' + bramBetaalt.status + '; organisator vooraf: ' + annaTeVroeg.status + ' "' +
      String((annaTeVroeg.data && annaTeVroeg.data.error) || '').slice(0, 80) + '"; pot van de vriend: ' + stand + ' centen');

  /* 8. EEN VERZOEK VOOR EEN ANDER. Vrijheid neemt de persoon uit de sessie:
     Bram vraagt vrij "voor" zijn leidinggevende en krijgt zijn eigen verzoek. */
  const team = ((await P('/api/supplier/roster', { code: WERKGEVER })).data || {}).staff || [];
  const mgr = team.find(x => x.role === 'manager');
  const voorAnder = ctx.werkTokenB ? await P('/api/staff/tijd/verzoek', { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE',
    datum: WEEKEND_1, persoon: mgr && mgr.id }, ctx.werkTokenB) : { status: 0, data: null };
  const persoon = voorAnder.data && voorAnder.data.verzoek && voorAnder.data.verzoek.persoon;
  noteer(8, 'een vrije dag aanvragen namens een collega', 'menselijke regie',
    'de persoon komt uit de sessie: het lichaam kan geen ander noemen',
    voorAnder.status === 200 && String(persoon) === String(ctx.staffB),
    'status ' + voorAnder.status + ', verzoek op personeelsnummer ' + persoon + ' (eigen: ' + ctx.staffB + ')');

  return uit;
}

async function meet() {
  const uit = {
    stempel: stempel(),
    uitleg: 'De Rome-keten: "ik wil met mijn vrienden een weekend naar Rome, rekening houdend met ieders budget, vakantiedagen en voorkeuren". ' +
      'Gemeten per SCHAKEL (handelt actor A, en ziet actor B dat?) en per STORING (houdt de keten zijn belofte als het misgaat?), over ' +
      'LivingOS, WorkOS, TravelOS en het geld. De drie grenzen van het besluit van 11 oktober 2026 zitten in de storingen. ' +
      'Elke openBekend-schakel draagt oorzaak, eigenaar, oplossing en soort: dat is de werklijst.',
    grens: 'Er komt geen browser en geen model aan te pas: wat Rahul in gewone taal van dit alles zou maken is niet gemeten, alleen wat de ' +
      'routes eronder doen. FoundationOS loopt hier alleen als de universele bodem (schakel 17: verbinden voor een gratis account, ' +
      'SAMENLEVING.md); het scenario vraagt geen stichting, en een schakel verzinnen om haar te raken zou een route meten die niemand ' +
      'nodig had. Het kantoor werkt op de gedeelde code, dus een besluit op naam is hier niet gemeten. ' +
      'Boeken loopt op een catalogusreis omdat er geen Rome in de catalogus staat (schakel 13); betalen is alleen als WEIGERING gemeten.',
    schakels: [], storingen: [], wereld: null
  };
  const srv = await start({ naam: 'romeproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOORCODE } });
  try {
    const ctx = await loop(srv.basis, uit);
    await storingen(srv.basis, uit, ctx);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  /* Per wereld apart, en met opzet geen percentage eroverheen: een samengesteld
     cijfer over vier werelden is precies de scorecard die LAT.md regel 11
     verbiedt. */
  uit.perWereld = {};
  for (const s of uit.schakels) {
    const w = uit.perWereld[s.wereld] = uit.perWereld[s.wereld] || { schakels: 0, gesloten: 0, openBekend: 0, open: 0, stuk: 0 };
    w.schakels++; w[s.stand]++;
  }
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 19;
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 19;
  uit.werklijst = uit.schakels.filter(s => s.stand === 'openBekend')
    .map(s => ({ schakel: s.nr, wereld: s.wereld, van: s.van, naar: s.naar, wat: s.wat,
      gemeten: s.ziet || ((s.status ? s.status + ': ' : '') + (s.antwoord || '')),
      soort: s.bekend.soort, oorzaak: s.bekend.oorzaak, eigenaar: s.bekend.eigenaar, oplossing: s.bekend.oplossing }));
  return uit;
}

function druk(u) {
  console.log('romeproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + s.wereld.padEnd(13) + (s.van + '->' + s.naar).padEnd(30) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.bekend ? '\n      OORZAAK: ' + s.bekend.oorzaak + '\n      EIGENAAR: ' + s.bekend.eigenaar +
        '\n      OPLOSSING (' + s.bekend.soort + '): ' + s.bekend.oplossing : '') +
      (s.antwoord ? '\n      antwoord: ' + s.status + ' ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + ' [' + s.grens + ']\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.telling.openBekend + ' open schakel(s) op de werklijst.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, WERKGEVER };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluitMetBevinding ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: ROMEPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de romeproef kon niet draaien: ' + (e && e.stack || e)); process.exit(1); });
}
