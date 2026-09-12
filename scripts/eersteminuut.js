#!/usr/bin/env node
/* ============================================================================
   DE EERSTE MINUUT -- WAT KRIJGT EEN MENS DIE RTG NIET KENT?

   WAAROM DIT SCRIPT ER IS

   Dit huis meet zijn navigatie al op twee manieren, en allebei gaan ze over
   iemand die de weg AL kent:

     scripts/tikken.js    ligt elk scherm binnen vijf tikken? -- dat is de
                          KORTSTE weg voor wie weet waar hij heen wil.
     scripts/vindbaar.js  leidt het woord dat op een scherm staat er ook
                          naartoe? -- dat is zoeken voor wie het woord al kent.

   Allebei stonden ze groen terwijl een vers lid na het tekenen van de
   overeenkomst op een LEEG vlak uitkwam met de tekst "Kies een wereld om te
   beginnen", geen enkele wereld in beeld, en een menu waarvan de eerste vier
   regels `01Universe`, `02Intent`, `03Worlds` en `Vrije plek 1` heetten.

   Geen van beide meters kon dat zien, en niet omdat ze stuk waren. Ze stellen
   de vraag van een expert. Deze meter stelt de vraag van een mens:

       WEET IK, ZONDER IETS TE WETEN, WAT IK NU KAN DOEN?

   WAT HIER GEMETEN WORDT

   Een vers account, een echte registratie langs de echte route, een echte
   browser op telefoonformaat, Nederlands. Daarna: hoeveel schermen staan er
   tussen de registratie en het eerste scherm waar iets NUTTIGS te doen is, en
   wat staat daar dan.

   WAT EEN POORT MAG TEGENHOUDEN, EN WAT NIET

   Niet elke vraag vooraf is fout. De lidmaatschapsovereenkomst MOET er staan:
   zonder handtekening is er geen lidmaatschap, dus die is NU NODIG en telt
   hier niet mee als blokkade. Een vraag die gesteld wordt omdat het antwoord
   OOIT handig is -- een bezorgadres voordat er iets besteld is, een bedrijf
   voordat er een factuur bestaat -- is dat niet. Die twee worden hier apart
   geteld, want ze samenvoegen maakt van een juridische eis en een
   nieuwsgierige vraag hetzelfde ding.

   WAT DEZE METER NIET KAN, en dat staat er even groot bij:

     - hij meet WOORDEN en geen begrip. Of een mens snapt wat "Mijn dingen"
       betekent, weet dit script niet. Dat blijft mensenwerk (punt 56).
     - hij meet de EERSTE minuut en niet de tiende. Een app kan hier slagen en
       daarna alsnog onbruikbaar zijn.
     - hij kent alleen jargon dat iemand heeft opgeschreven. De lijst hieronder
       is een ONDERgrens en groeit met wat er gevonden wordt.

   Daarom draagt elke uitslag zijn graad, en is `nietMeetbaar` een eersteklas
   uitkomst naast `gehaald` en `gezakt` -- nooit stilzwijgend een vinkje.

   DRAAIEN

     node scripts/eersteminuut.js              (meet, schrijft EERSTEMINUUT.json)
     node scripts/eersteminuut.js --controle   (zakt als een toets ZAKT)
     node scripts/eersteminuut.js --stil       (alleen de eindregel)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'EERSTEMINUUT.json');
const controle = process.argv.includes('--controle');
const stil = process.argv.includes('--stil');
const BASIS = process.env.RTG_BASIS || 'http://localhost:3000';

/* ---------------------------------------------------------------------------
   INTERNE TERMEN DIE EEN LID NOOIT HOORT TE ZIEN.

   Dit is geen stijllijst en geen anglicismejacht. Het is een lijst van woorden
   die BINNEN dit huis een technische betekenis dragen en die daarbuiten niets
   zeggen. Elk woord hieronder is ergens echt op het scherm van een lid
   aangetroffen of komt uit een register dat nooit consumententaal was.

   `waarom` is verplicht: een verbod zonder reden wordt bij de eerste
   tegenstand weggeargumenteerd. */
const INTERNE_TERMEN = [
  { woord: 'Universe',   waarom: 'view-naam uit shared/rtg-edge-worlds.js; stond als `01Universe` bovenaan het ledenmenu' },
  { woord: 'Intent',     waarom: 'interne naam van de intentielaag (kern/stuur/); voor een lid een leeg woord' },
  { woord: 'Worlds',     waarom: 'Engelse dubbel van "werelden", naast de Nederlandse variant in hetzelfde menu' },
  { woord: 'Decisions',  waarom: 'view-naam uit rtg-edge-worlds.js, nooit vertaald' },
  { woord: 'Replay',     waarom: 'view-naam uit rtg-edge-worlds.js, nooit vertaald' },
  { woord: 'Capability', waarom: 'platformvermogen uit OS.md -- architectuurwoord, geen mensenwoord' },
  { woord: 'Journey',    waarom: 'interne naam voor een samengestelde stroom' },
  { woord: 'Endpoint',   waarom: 'techniek' },
  { woord: 'Payload',    waarom: 'techniek' },
  { woord: 'Tenant',     waarom: 'klantbegrip uit TENANT.md, nooit consumententaal' },
  { woord: 'Idempotent', waarom: 'techniek uit MUTATIECONTRACT.md' },
  { woord: 'Fixture',    waarom: 'toetsbegrip' },
  { woord: 'Seed',       waarom: 'toetsbegrip' }
];

/* Vrije plekken en onafgemaakte tekst. Een lid hoort geen bouwsteiger te zien. */
const PLACEHOUDERS = [
  { woord: 'Vrije plek',  waarom: 'lege slot-tekst; stond drie keer op het scherm van een vers lid' },
  { woord: 'Lorem',       waarom: 'vultekst' },
  { woord: 'TODO',        waarom: 'onafgemaakt' },
  { woord: 'Placeholder', waarom: 'onafgemaakt' },
  { woord: 'Binnenkort',  waarom: 'een belofte is geen functie; hoort met een reden of niet te staan' },
  { woord: 'Nog niet beschikbaar', waarom: 'zegt niet wat een mens dan wel kan' }
];

/* ---------------------------------------------------------------------------
   EEN ECHTE SESSIE, LANGS DE ECHTE ROUTE.

   Geen nagebouwde inlog: een vers lid registreert zich zoals elk ander lid.
   Lukt dat niet, dan wordt er NIET gemeten en zakt de controle -- een kapotte
   registratie mag er nooit uitzien als een schone eerste minuut. */
async function versLid() {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await fetch(BASIS + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Eerste Minuut', email: 'em' + u + '@voorbeeld.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg'
    })
  }).then((x) => x.json()).catch(() => null);
  return r && r.token ? r.token : null;
}

/* ---------------------------------------------------------------------------
   ALLES WAT EEN MENS OP DIT MOMENT WERKELIJK ZIET STAAN.

   LET OP DE TWEE GRENZEN HIERONDER, want zonder allebei meet dit ding de DOM
   in plaats van het scherm. Dat is hier echt misgegaan: de eerste versie gaf
   `inhoud-zonder-menu` de uitslag GEHAALD op negen dingen -- "Hier",
   "Heel RTG", "01Universe", "Recent bezocht" -- die alle negen IN HET GESLOTEN
   MENU zaten. Ze stonden in de DOM, ze hadden afmetingen, en het lid zag er
   geen een. Een meter die een leeg scherm als een vol scherm telt, is erger
   dan geen meter, want hij geeft rust.

     1. BINNEN HET VENSTER. Niet "heeft afmetingen" maar: staat het in het
        stuk scherm dat de mens nu voor zich heeft (0 tot innerHeight). Een
        lade die dichtgeschoven onder de vouw ligt, valt daarmee af.
     2. BOVENOP. `document.elementFromPoint` op het midden van het element moet
        het element zelf opleveren (of iets erbinnen). Ligt er een scrim, een
        modale laag of een ander paneel overheen, dan ziet de mens het niet --
        ook al staat het keurig binnen het venster.

   Wat deze twee NIET vangen: iets dat met `transform` buiten beeld is
   geschoven maar toch getroffen wordt, en iets dat pas na een animatie op zijn
   plek staat. Daarom wordt er voor het meten gewacht. */
const ZICHTBAAR = () => {
  const inVenster = (r) => r.bottom > 0 && r.top < window.innerHeight &&
                           r.right > 0 && r.left < window.innerWidth;
  const bovenop = (el, r) => {
    const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    const raak = document.elementFromPoint(x, y);
    return !!raak && (raak === el || el.contains(raak) || raak.contains(el));
  };
  /* DERDE GRENS, en die was nodig: `getComputedStyle(el).opacity` is de opacity
     VAN DIT ELEMENT, niet die van zijn ouders. Een knop met opacity 1 in een
     paneel met opacity 0 komt er dus gewoon doorheen. Zo telde deze meter
     "LivingOS, WorkOS, TravelOS, FoundationOS, Vraag Rahul" als vijf dingen om
     te doen, op een scherm waarvan de schermafdruk alleen "Kies een wereld om
     te beginnen" laat zien -- ze stonden in een weggedraaide laag.

     `checkVisibility` doet dit wel goed: hij loopt de voorouders af voor
     display, visibility, content-visibility en opacity. Hij bestaat in
     Chromium, en dit script draait in Chromium; ontbreekt hij toch, dan valt
     het terug op de oude, ruimere toets -- dan meet deze meter te MILD, en dat
     staat in de uitslag in plaats van dat het stil gebeurt. */
  const echtZichtbaar = (el) => (typeof el.checkVisibility === 'function')
    ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })
    : true;
  const zicht = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (!(r.width > 4 && r.height > 4)) return false;
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) <= 0.05) return false;
    if (!echtZichtbaar(el)) return false;
    if (!inVenster(r)) return false;
    return bovenop(el, r);
  };
  const bedienbaar = [...document.querySelectorAll(
    'a[href],button,[role=button],[data-url],[role=tab],[role=menuitem],input,textarea,select'
  )].filter(zicht);
  /* SCHIL OF INHOUD, OP STRUCTUUR EN NIET OP WOORDEN.

     Eerst stond hier een lijst woorden ("menu", "home", "nl", ...). Die gaf
     twee keer een vals GEHAALD: de eerste keer op de tekst van het logo
     ("RTGRahul Travel GroupExperience the elite"), de tweede op het
     wereldlabel "LIVING OS" in de kopbalk. Allebei merk, geen handeling -- en
     allebei onmogelijk te voorzien in een woordenlijst. Een lijst woorden
     beschrijft de schil van vandaag; de ANKERS beschrijven wat een schil IS.

     Alles wat in de kopbalk, de randbalk, de sprong of een landmark van de
     schil woont, is de doos. De rest is wat erin zit. */
  const SCHILANKERS = '.topbar,[class^=rtg-edge],[class*=" rtg-edge"],[class^=rtgsprong],' +
                      '[class*=" rtgsprong"],header,footer,[role=banner],[role=contentinfo]';
  /* NOOIT OP BODY OF HTML AANSLAAN. De body draagt hier zelf een class met
     `rtg-edge` erin (`body.rtg-stijl.os-vast ... rtg-edge-*`), en `closest()`
     klimt door tot en met de body. Zonder deze uitsluiting is ELK element
     schil, telt het beginscherm nul inhoud, en ziet een kapotte meter eruit
     als een kaal scherm -- de uitkomst die je verwachtte, en daarom de
     gevaarlijkste. Gevonden met een mutatieproef op het springboard: zeven
     knoppen die aantoonbaar inhoud zijn, kwamen alle zeven als schil binnen. */
  const isSchil = (el) => {
    const c = el.closest(SCHILANKERS);
    return !!c && c !== document.body && c !== document.documentElement;
  };
  const tekstUit = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ');
  /* De zichtbare tekst van de pagina: alleen bladeren, zodat de tekst van een
     ouder niet nog eens wordt meegeteld via al zijn kinderen. */
  const bladeren = [...document.querySelectorAll('body *')].filter((el) =>
    zicht(el) && ![...el.children].some((k) => (k.textContent || '').trim().length > 0));
  return {
    tekst: bladeren.map(tekstUit).filter(Boolean),
    bedienbaar: bedienbaar.map((el) => ({
      tekst: tekstUit(el).slice(0, 40),
      /* De NAAM is wat een mens (of een schermlezer) heeft om dit ding bij te
         noemen: het opschrift, anders het aria-label, anders de titel. Een
         zichtbare knop zonder naam is geen handeling die iemand kan kiezen --
         hij is een vlek. Zonder dit onderscheid telde het beginscherm vijf
         "dingen om te doen" die alle vijf naamloos waren. */
      naam: (tekstUit(el) || el.getAttribute('aria-label') || el.getAttribute('title') ||
             (el.getAttribute('alt') || '')).trim().slice(0, 40),
      /* OPSCHRIFT is iets anders dan NAAM, en dat verschil is hier de hele
         vondst. De vier werelden staan in de onderbalk als knoppen van 44x48
         met een keurig `aria-label` -- en zonder tekst en zonder zichtbare
         glyf. Een schermlezer noemt ze; een ziend mens ziet maroon. Wie die
         twee optelt, meet een leeg beginscherm als een gevuld beginscherm. */
      opschrift: tekstUit(el).trim().slice(0, 40),
      doel: el.getAttribute('href') || el.getAttribute('data-url') || '',
      soort: el.tagName.toLowerCase(),
      schil: isSchil(el),
      /* De vindplaats hoort bij de vondst: een meter die zegt DAT er iets is
         zonder te zeggen WAAR, is niet na te lopen -- en dan gaat de discussie
         over de meter in plaats van over de app. */
      waar: (() => {
        const d = []; let c = el;
        while (c && c !== document.body && d.length < 4) {
          d.push(c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') +
                 (typeof c.className === 'string' && c.className
                   ? '.' + c.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
          c = c.parentElement;
        }
        return d.join(' < ');
      })()
    })),
    velden: bedienbaar.filter((el) => /input|textarea|select/.test(el.tagName.toLowerCase())).length,
    strengeZichtbaarheid: typeof document.body.checkVisibility === 'function'
  };
};

/* Een scherm dat de mens iets VRAAGT voordat hij iets krijgt. */
function isVraagscherm(beeld) {
  const t = beeld.tekst.join(' ');
  const heeftVraag = /\?/.test(t);
  const heeftUitweg = beeld.bedienbaar.some((b) =>
    /liever later|sla dit over|overslaan|niet nu|later/i.test(b.tekst));
  return heeftVraag && (heeftUitweg || beeld.velden > 0);
}

function vind(lijst, tekst) {
  const gevonden = [];
  for (const r of lijst) {
    const re = new RegExp('(^|[^a-z])' + r.woord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'i');
    const raak = tekst.filter((s) => re.test(s));
    if (raak.length) gevonden.push({ woord: r.woord, waarom: r.waarom, voorbeeld: raak[0].slice(0, 60), keer: raak.length });
  }
  return gevonden;
}

(async () => {
  const { laadBrowser } = require('../test/browser');
  const pw = laadBrowser();
  if (!pw) { console.error('Geen browser beschikbaar; dit script meet in een echte browser.'); process.exit(2); }

  const token = await versLid();
  if (!token) {
    const uit = { stempel: stempel(), gemeten: false,
      reden: 'registratie langs /api/auth/register mislukte; er is NIET gemeten' };
    fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');
    console.error('NIET GEMETEN: registratie mislukte. Draait de server op ' + BASIS + '?');
    process.exit(controle ? 1 : 2);
  }

  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const poorten = [];
  let beeld = null;
  let beeldMenu = null;
  let menuReden = null;
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: 'nl-NL', extraHTTPHeaders: { 'Accept-Language': 'nl-NL,nl;q=0.9' }
    });
    const p = await ctx.newPage();
    await p.goto(BASIS + '/apps/app.html');
    await p.evaluate((t) => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_lang', 'nl');
    }, token);
    await p.goto(BASIS + '/apps/app.html');
    await p.waitForTimeout(3200);

    /* STAP 1 -- de overeenkomst. NU NODIG: zonder handtekening geen lidmaatschap. */
    const naamveld = await p.$('input[placeholder*="naam" i], input[placeholder*="name" i]');
    if (naamveld) {
      const b = await p.evaluate(ZICHTBAAR);
      poorten.push({ soort: 'overeenkomst', nodig: true,
        grond: 'zonder handtekening bestaat het lidmaatschap niet -- NU NODIG (punt 7)',
        kop: (b.tekst.find((s) => s.length > 25) || '').slice(0, 90) });
      await naamveld.fill('Eerste Minuut');
      await p.keyboard.press('Enter');
      await p.waitForTimeout(2800);
    }

    /* STAP 2 -- alles wat daarna nog VRAAGT voordat er iets te doen is. */
    for (let i = 0; i < 15; i++) {
      const b = await p.evaluate(ZICHTBAAR);
      if (!isVraagscherm(b)) break;
      const uitweg = b.bedienbaar.find((x) => /liever later|sla dit over|overslaan|niet nu/i.test(x.tekst));
      poorten.push({ soort: 'vraag', nodig: false,
        grond: 'gesteld voordat de mens iets heeft gedaan waarvoor het antwoord nodig is',
        kop: (b.tekst.find((s) => s.length > 25) || '').slice(0, 90),
        uitweg: uitweg ? uitweg.tekst : null });
      if (!uitweg) break;
      const el = await p.$(`text="${uitweg.tekst}"`);
      if (!el || !(await el.isVisible())) break;
      await el.click();
      await p.waitForTimeout(1900);
    }

    /* STAP 3 -- TWEE STATIONS, en met opzet niet een.

       Punt 50 vraagt twee dingen die niet op dezelfde plek te meten zijn:
       "eerste nuttige inhoud zichtbaar ZONDER menu" gaat over het scherm zoals
       het landt, en "nul interne termen" gaat over alles wat de mens in zijn
       eerste minuut onder ogen krijgt. Op een leeg beginscherm is het openen
       van het menu de enige handeling die er is, dus dat hoort bij de eerste
       minuut. Wie alleen station 1 meet, verklaart een leeg scherm schoon
       omdat het jargon net buiten beeld ligt. */
    await p.waitForTimeout(1200);
    beeld = await p.evaluate(ZICHTBAAR);
    await p.screenshot({ path: path.join(WORTEL, 'server', 'data', 'eersteminuut.png') }).catch(() => {});

    const knop = await p.evaluate(() => {
      const e = document.querySelector('.rtg-edge-menu');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (knop) {
      await p.mouse.click(knop.x, knop.y);
      await p.waitForTimeout(2400);
      beeldMenu = await p.evaluate(ZICHTBAAR);
    } else {
      menuReden = 'geen menuknop (.rtg-edge-menu) gevonden; station 2 is NIET gemeten';
    }
  } finally {
    await browser.close();
  }

  /* -------------------------------------------------------------------------
     DE TOETSEN. Elke toets draagt wat hij MEET en wat hij NIET meet. */
  const tekst = beeld.tekst;
  const bedienbaar = beeld.bedienbaar;
  /* Bediening van de schil (kopbalk, randbalk, sprong) is GEEN inhoud: dat is
     de doos waarin de inhoud hoort te zitten. Wie die meetelt, meet een lege
     app als een volle -- en dat gebeurde hier twee keer, zie ZICHTBAAR. */
  const inhoud = bedienbaar.filter((b) => !b.schil && b.opschrift);
  const alleenIcoon = bedienbaar.filter((b) => !b.schil && !b.opschrift && b.naam);
  const naamloos = bedienbaar.filter((b) => !b.schil && !b.naam);

  /* Het jargon wordt over BEIDE stations gemeten: wat de mens in zijn eerste
     minuut ziet, is het beginscherm plus de enige handeling die daar bestaat. */
  const tekstBeide = tekst.concat(beeldMenu ? beeldMenu.tekst : []);
  const internGevonden = vind(INTERNE_TERMEN, tekstBeide);
  const plaatsGevonden = vind(PLACEHOUDERS, tekstBeide);
  const onnodig = poorten.filter((p) => !p.nodig);
  const statuscodes = tekstBeide.filter((s) => /\b[A-Z][A-Z0-9]{3,}(_[A-Z0-9]+)+\b/.test(s));

  const toetsen = [
    { naam: 'inhoud-zonder-menu', station: 'beginscherm', vraag: 'Staat er iets te doen zonder dat de mens eerst MENU opent?',
      uitslag: inhoud.length > 0 ? 'gehaald' : 'gezakt',
      gemeten: inhoud.length + ' dingen met een LEESBAAR opschrift' +
               (alleenIcoon.length ? '; ' + alleenIcoon.length + ' alleen als pictogram met aria-label (' +
                 alleenIcoon.map((b) => b.naam).join(', ') + ') -- een schermlezer noemt die, een ziend mens ziet ze niet' : '') +
               (naamloos.length ? '; ' + naamloos.length + ' zonder enige naam' : ''),
      bewijs: inhoud.slice(0, 10).map((b) => ({ naam: b.naam, soort: b.soort, doel: b.doel, waar: b.waar })) },
    { naam: 'geen-interne-termen', station: 'beginscherm + menu', vraag: 'Staat er een woord dat alleen binnen dit huis iets betekent?',
      uitslag: internGevonden.length ? 'gezakt' : 'gehaald',
      gemeten: internGevonden.length + ' interne termen zichtbaar', bewijs: internGevonden },
    { naam: 'geen-vrije-plekken', station: 'beginscherm + menu', vraag: 'Staat er bouwsteiger op het scherm?',
      uitslag: plaatsGevonden.length ? 'gezakt' : 'gehaald',
      gemeten: plaatsGevonden.length + ' placeholders zichtbaar', bewijs: plaatsGevonden },
    { naam: 'geen-technische-status', station: 'beginscherm + menu', vraag: 'Staat er een technische statuscode in consumententaal?',
      uitslag: statuscodes.length ? 'gezakt' : 'gehaald',
      gemeten: statuscodes.length + ' codes van de vorm IETS_IN_HOOFDLETTERS', bewijs: statuscodes.slice(0, 5) },
    { naam: 'geen-onnodige-vragen', station: 'weg naar het beginscherm', vraag: 'Hoeveel vragen komen er vóór de eerste waarde die niet NU NODIG zijn?',
      uitslag: onnodig.length ? 'gezakt' : 'gehaald',
      gemeten: onnodig.length + ' onnodige poorten, ' + poorten.filter((p) => p.nodig).length + ' terecht',
      bewijs: onnodig.map((p) => p.kop) },
    /* Een zoekKNOP telt hier mee, en een zoekVELD is beter. Het onderscheid
       staat in de uitslag en wordt niet weggepoetst: "zeggen wat je wilt"
       vraagt een veld, "zoeken waar het zit" volstaat met een knop. */
    { naam: 'zoeken-of-intentie', station: 'beginscherm',
      vraag: 'Kan de mens zeggen wat hij wil, in plaats van zoeken waar het zit?',
      uitslag: (beeld.velden > 0 || bedienbaar.some((b) => /zoek|⌕/i.test(b.tekst + b.doel))) ? 'gehaald' : 'gezakt',
      gemeten: beeld.velden > 0
        ? beeld.velden + ' invoerveld(en) direct op het beginscherm'
        : 'geen invoerveld; alleen een zoekKNOP -- de mens moet eerst tikken voordat hij iets kan zeggen',
      bewijs: [] },
    { naam: 'terugweg', station: 'beginscherm', vraag: 'Is er een zichtbare weg terug of naar huis?',
      uitslag: bedienbaar.some((b) => /home|terug|sluit|×|✕/i.test(b.tekst)) ? 'gehaald' : 'gezakt',
      gemeten: 'gezocht op home/terug/sluiten', bewijs: [] },
    { naam: 'taal-consistent', vraag: 'Is alles wat er staat Nederlands, bij een Nederlandse sessie?',
      uitslag: 'nietMeetbaar',
      reden: 'een woordenlijst die Engels van Nederlands scheidt bestaat hier nog niet, en raden ' +
             'zou merknamen (RTG, Salon, Pass) als fout aanmerken. De interne termen hierboven ' +
             'vangen vandaag het deel dat aantoonbaar fout is; de rest wacht op punt 57 ' +
             '(CONSUMENTENTAAL.json).', bewijs: [] },
    { naam: 'begrijpt-de-mens-het', vraag: 'Snapt een mens die RTG niet kent wat hij hier kan?',
      uitslag: 'nietMeetbaar',
      reden: 'geen enkele browsermeting kan dit vaststellen. Dit blijft punt 56: echte mensen, ' +
             'zonder instructie, met een opdracht. Het staat hier zodat de afwezigheid ervan ' +
             'zichtbaar blijft in plaats van stil.', bewijs: [] }
  ];

  const gezakt = toetsen.filter((t) => t.uitslag === 'gezakt');
  const uit = {
    stempel: stempel(),
    uitleg: 'Wat een mens die RTG niet kent in zijn eerste minuut krijgt. Een verse registratie ' +
            'langs de echte route, een echte browser op 390x844, Nederlands. Gemeten wordt de weg ' +
            'van registratie tot het eerste scherm waar iets te doen is, en wat daar staat.',
    hoe: 'node scripts/eersteminuut.js  (--controle zakt zodra een toets ZAKT)',
    grens: 'Een toets die ZAKT blokkeert. `nietMeetbaar` blokkeert niet, maar telt ook nooit als ' +
           'gehaald -- een bewijs dat je weglaat leest als een bewijs dat je haalt ' +
           '(BETROUWBAARHEID.md). Wat hier niet gemeten kan worden, draagt zijn reden.',
    blindeVlek: 'DEZE METER TOETST AANTIKBAARHEID, NIET VERF. Zichtbaarheid wordt bepaald met ' +
           'checkVisibility() en elementFromPoint. Een element dat door een andere laag wordt ' +
           'OVERSCHILDERD terwijl die laag op dat punt geen muisdoel is (pointer-events), komt er ' +
           'dus doorheen: elementFromPoint geeft het element terug, en de meter noemt het zichtbaar ' +
           'terwijl een mens het niet ziet. Dat is hier echt het geval -- de vier werelden in ' +
           '.cmd-balk worden overschilderd door .rtg-edge-bottom op dezelfde 48px rand ' +
           '(MENS.md par. 3a). Ze zijn wel aan te tikken. Wie deze meter groen ziet op ' +
           'inhoud-zonder-menu, heeft daarmee nog geen bewijs dat het scherm ook gevuld OOGT; ' +
           'daarvoor is een schermafdruk nodig en die beoordeelt geen script.',
    standen: { gehaald: 'gemeten en in orde', gezakt: 'gemeten en niet in orde',
               nietMeetbaar: 'kan hier niet worden vastgesteld, met de reden erbij' },
    poorten: { totaal: poorten.length, nodig: poorten.filter((p) => p.nodig).length,
               onnodig: onnodig.length, rijen: poorten },
    zichtbaarheid: beeld.strengeZichtbaarheid
      ? 'checkVisibility: voorouders meegewogen (display, visibility, opacity)'
      : 'GEEN checkVisibility in deze browser -- er is MILDER gemeten dan bedoeld; ' +
        'elementen in een weggedraaide laag kunnen als zichtbaar zijn geteld',
    stations: { beginscherm: 'zoals het landt, zonder enige tik',
                menu: menuReden ? null : 'beginscherm met het menu open (een tik)',
                nietGemeten: menuReden },
    eersteScherm: { bedienbaarTotaal: bedienbaar.length,
                    waarvanSchil: bedienbaar.filter((b) => b.schil).length,
                    waarvanInhoud: inhoud.length,
                    waarvanAlleenIcoon: alleenIcoon.length,
                    alleenIcoon: alleenIcoon.map((b) => ({ naam: b.naam, waar: b.waar })),
                    waarvanNaamloos: naamloos.length,
                    invoervelden: beeld.velden, tekstregels: tekst.length,
                    tekst: tekst.slice(0, 12) },
    telling: { gehaald: toetsen.filter((t) => t.uitslag === 'gehaald').length,
               gezakt: gezakt.length,
               nietMeetbaar: toetsen.filter((t) => t.uitslag === 'nietMeetbaar').length },
    toetsen
  };
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');

  if (!stil) {
    console.log('EERSTEMINUUT.json -- ' + uit.telling.gehaald + ' gehaald, ' + uit.telling.gezakt +
                ' gezakt, ' + uit.telling.nietMeetbaar + ' niet meetbaar.');
    console.log('Poorten voor de eerste waarde: ' + poorten.length + ' (' +
                poorten.filter((p) => p.nodig).length + ' terecht, ' + onnodig.length + ' onnodig).');
    console.log('Eerste scherm: ' + inhoud.length + ' bedienbare dingen die inhoud zijn, ' +
                (bedienbaar.length - inhoud.length) + ' schilbediening.');
    for (const t of toetsen) {
      const merk = t.uitslag === 'gehaald' ? '  ok  ' : t.uitslag === 'gezakt' ? ' ZAKT ' : '  --  ';
      console.log(merk + t.naam + ' -- ' + (t.gemeten || t.reden || '').slice(0, 110));
    }
  }
  console.log(gezakt.length ? 'EERSTE_MINUUT: BLOCKED (' + gezakt.map((t) => t.naam).join(', ') + ')'
                            : 'EERSTE_MINUUT: OK');
  if (controle && gezakt.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(2); });
