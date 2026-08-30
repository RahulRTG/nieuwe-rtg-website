/* ============================================================================
   DE LIJFSLEUTEL -- een sleutel die in het LICHAAM reist, niet in de kop.

   HET PROBLEEM. scripts/lib/bewakers.js kent een soort deur die hij
   `lichaamssleutel` noemt en waaraan hij bewust GEEN rol hangt, met deze reden:
   "de sleutel staat in het lichaam en niet in de kop, dus rollen kruisen zegt
   hier niets". Dat klopt -- voor de ROLPROEF, die met een verkeerde rol
   aanklopt om scheiding te toetsen. Met een lijfsleutel bestaat "de verkeerde
   rol" niet: je hebt de sleutel of je hebt hem niet.

   Maar de IDEMPROEF kruist niets. Die herhaalt een oproep met de JUISTE sleutel
   en kijkt of de tweede keer werk oplevert. Voor dat instrument is zo'n route
   wel degelijk te beproeven, zodra er een sleutel te maken is. Eén reden, twee
   instrumenten, tegengestelde conclusies -- en zolang er maar één begrip was
   (`rol`), won de strengste en telden honderden routes als instrumenttekort.

   Vandaar dit tweede begrip NAAST rol, en met opzet niet erin: de rolproef mag
   deze deuren niet gaan kruisen, want daar zou hij groen worden op iets wat hij
   niet heeft gemeten.

   WAT EEN FAMILIE IS. Een naam, de paden waar hij over gaat, en een BOUWER die
   de wereld werkelijk aanmaakt en de velden teruggeeft die daarna in elk lijf
   meegaan. Geen verzonnen tokens: de bouwer loopt door de echte deur van het
   product, want een sleutel die niet uit de applicatie komt bewijst niets over
   de applicatie.

   EN WAT HIER NIET GEBEURT: er wordt geen omgevingsvlag omgezet om een deur
   open te krijgen. De schoolfixture (/school/school/maak) staat buiten
   NODE_ENV=test met 410 dicht, en die vlag aanzetten zou de hele server een
   andere server maken -- dan meet de proef iets wat het product niet is. Zo'n
   familie hoort langs de ECHTE weg te worden opgebouwd of eerlijk te ontbreken,
   met de reden erbij. */
'use strict';

const fs = require('fs');
const path = require('path');

/* De activatielink uit de outbox van de proefopstelling. Peilt tot de mail er
   ECHT is in plaats van een aantal milliseconden te gokken -- dezelfde les als
   wachtOpBestand() in test/helper.js, en om dezelfde reden: een slaapje is te
   kort op een trage machine en gooit tijd weg op een snelle. */
async function leesActivatie(datamap, msMax) {
  const outbox = path.join(datamap, 'outbox');
  const tot = Date.now() + (msMax || 8000);
  while (Date.now() < tot) {
    let namen = [];
    try { namen = fs.readdirSync(outbox); } catch (e) { namen = []; }
    for (const n of namen) {
      let tekst = '';
      try { tekst = fs.readFileSync(path.join(outbox, n), 'utf8'); } catch (e) { continue; }
      const m = /#activeren=([A-Z0-9]+\.[a-f0-9]{48})/i.exec(tekst);
      if (m) return m[1];
    }
    await new Promise(r => setTimeout(r, 40));
  }
  return null;
}

const FAMILIES = [
  {
    naam: 'werkruimte',
    /* Alle werkPoort-, beheerVan- en lidVan-routes van het Werk OS wonen onder
       dit voorvoegsel; gemeten met scripts/handlerwacht.js. */
    prefixen: ['/api/bedrijf/'],
    velden: ['beheerToken', 'werkruimte'],
    waarom: 'werkPoort en beheerVan lezen `beheerToken` uit het lijf; de werkruimte ' +
      'ontstaat pas bij het aanmaken en het token wordt daar EEN keer getoond',
    async bouw({ post }) {
      const r = await post('/api/bedrijf/werkruimte/maak',
        { naam: 'Proefwerkruimte', land: 'NL', valuta: 'EUR' }, null);
      const d = r && r.data;
      if (!d || !d.beheerToken) return null;
      return { beheerToken: d.beheerToken, werkruimte: d.werkruimte };
    }
  },
  {
    naam: 'school',
    /* 165 van de 175 schoolroutes wonen onder dit ene voorvoegsel; gemeten met
       scripts/handlerwacht.js over de wachten poort/schoolVan/klasVan/lesVan/
       personeelVan. */
    prefixen: ['/api/foundation/school/'],
    velden: ['schoolCode', 'beheerToken'],
    waarom: 'de schoolpoort (server/school/rollen.js) leest schoolCode plus beheerToken ' +
      'of personeelToken uit het lijf; die ontstaan pas als een registratie is goedgekeurd',
    /* DE ECHTE WEG, EN WAAROM NIET DE KORTE. Er bestaat een snelle deur
       (/api/foundation/school/school/maak) die in een keer een school met een
       beheersleutel maakt -- maar die geeft buiten NODE_ENV=test een 410, en die
       vlag aanzetten zou de hele server een andere server maken: dan meet de
       proef iets wat het product niet is (zie de kop van dit bestand).

       Dus loopt de bouwer de productieweg af, met vier echte oproepen:
         1. de registratie aanvragen (openbaar, achter een rem)
         2. de vijf toelatingscontroles aftekenen -- boardroom, want dat is wie
            het mag; elke controle vraagt een referentie van minstens 3 tekens
         3. het besluit nemen (goedkeuren kan pas als er geen enkele controle
            meer openstaat; magGoedkeuren weigert anders)
         4. activeren met het eenmalige geheim, want pas DAAR komt het
            beheerToken naar buiten.

       EN DAT GEHEIM KOMT NIET UIT HET ANTWOORD. Het besluit geeft alleen de
       schoolcode terug; de activatielink gaat naar het GECONTROLEERDE
       schooladres en nergens anders. Dat is geen omissie maar het ontwerp: wie
       een registratie goedkeurt, hoort de sleutel niet in handen te krijgen.
       De bouwer leest hem daarom uit de outbox van de wegwerpserver -- dezelfde
       weg die test/foundationregistratie.test.js al gebruikt, en dus geen
       tweede manier om aan dezelfde mail te komen (LAT.md regel 4).

       Dat is de enige stap die buiten het HTTP-vlak valt, en dat hoort hier te
       staan in plaats van weggemoffeld: deze familie leunt op de datamap van de
       proefopstelling. Zonder die map is hij niet te bouwen, en dan meldt hij
       zich als mislukt in plaats van een sleutel te verzinnen.

       Loopt een van de stappen stuk, dan komt er geen sleutel. Half doorlopen
       en dan iets invullen zou een sleutel opleveren die het product nooit
       heeft uitgegeven. */
    async bouw({ post, tokens, datamap }) {
      const brin = String(Math.floor(Math.random() * 9000) + 1000) + 'AB';
      const aanvraag = await post('/api/foundation/registratie/aanvragen', {
        type: 'school', naam: 'Proefschool', plaats: 'Proefstad', brin,
        contactNaam: 'Proef Directie', email: 'proefschool@voorbeeld.test', landCode: 'NL',
        bevoegd: true, waarheidsgetrouw: true, privacyAkkoord: true
      }, null);
      const id = aanvraag && aanvraag.data && aanvraag.data.id;
      if (!id) return null;
      if (!tokens || !tokens.boardroom) return null;   // zonder boardroom geen controle
      const eisen = ((aanvraag.data.aanvraag || {}).controles || []).map(c => c.id);
      if (!eisen.length) return null;
      for (const onderdeel of eisen) {
        await post('/api/office/foundation/registratie/controle', {
          id, onderdeel, uitkomst: 'geverifieerd',
          referentie: 'proefopstelling: gecontroleerd voor de idemproef'
        }, tokens.boardroom);
      }
      const besluit = await post('/api/office/foundation/registratie/besluit',
        { id, action: 'goedkeuren' }, tokens.boardroom);
      if (!besluit || !besluit.data || !besluit.data.ok) return null;
      if (!datamap) return null;
      const geheim = await leesActivatie(datamap);
      if (!geheim) return null;
      const act = await post('/api/foundation/school/school/activeren', { activatie: geheim }, null);
      const d = act && act.data;
      if (!d || !d.beheerToken) return null;
      return { schoolCode: d.schoolCode, beheerToken: d.beheerToken };
    }
  }
];

/* Bouwt wat er te bouwen valt. Geeft per familie terug of het gelukt is EN
   waarom niet -- een familie die stil ontbreekt, laat honderden routes stil
   ongemeten (LAT.md regel 3). */
async function bouwLijfsleutels(ctx) {
  const gebouwd = [];
  const mislukt = [];
  const velden = new Map();   // prefix -> velden
  for (const f of FAMILIES) {
    let uit = null;
    try { uit = await f.bouw(ctx); } catch (e) { uit = null; }
    if (!uit) { mislukt.push({ naam: f.naam, reden: 'de bouwer kreeg geen sleutel terug' }); continue; }
    gebouwd.push({ naam: f.naam, velden: Object.keys(uit) });
    for (const p of f.prefixen) velden.set(p, uit);
  }
  const lijfVoor = (pad) => {
    for (const [p, v] of velden) if (String(pad).startsWith(p)) return v;
    return null;
  };
  const dekt = (pad) => !!lijfVoor(pad);
  return { gebouwd, mislukt, lijfVoor, dekt, families: FAMILIES.map(f => f.naam) };
}

/* Voor wie alleen wil weten WELKE paden een familie zou dekken, zonder een
   server te starten -- scripts/onbewezen.js gebruikt dit om een route niet als
   instrumenttekort te tellen terwijl er een sleutel voor te maken is. */
function dektPad(pad) {
  return FAMILIES.some(f => f.prefixen.some(p => String(pad).startsWith(p)));
}

module.exports = { FAMILIES, bouwLijfsleutels, dektPad };
