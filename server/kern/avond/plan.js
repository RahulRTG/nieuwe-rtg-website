/* RTG EVENING OS: de avond als plan, niet als product.

   WAT DIT WEL EN NIET IS. Een avond bestaat hier uit stappen -- eten, vervoer,
   uitgaan, thuis -- en elke stap WIJST NAAR een boeking die in zijn eigen
   domein leeft: een reservering in db.data.reserveringen, een rit in de
   mobiliteitskern, een rsvp bij een event. Er komt geen avond-administratie
   naast met eigen kopieën van die dingen. Wat een avond bezit is de VOLGORDE,
   het budget en de belofte dat het klopt; de dingen zelf blijven van hun eigen
   laag (LAT-regel 4). Zelfde trucje als het mandjeId van de foodcourt: een
   veld dat zegt "deze horen bij elkaar", en verder niets.

   DE DRIE BELOFTEN DIE EEN AVOND MOET WAARMAKEN, en die hier als som staan en
   niet als tekst:

   1. DE KLOK KLOPT. Elke stap begint na de vorige is afgelopen, met de reistijd
      ertussen, en de laatste stap eindigt vóór het tijdstip waarop je thuis
      wilt zijn. Een plan dat dat niet haalt wordt niet "krap" genoemd maar
      geweigerd, met wat er niet past.
   2. HET BUDGET KLOPT. De som van de stappen past binnen wat je hebt gezegd,
      inclusief vervoer en fooi-ruimte. Een budget dat pas aan het eind blijkt
      te zijn overschreden, is geen budget.
   3. NIETS IS GEBOEKT TOT HET GEBOEKT IS. Elke stap draagt zijn eigen staat:
      `voorstel`, `aangevraagd` (de zaak beslist nog), `bevestigd` of `mislukt`.
      Een plan is dus nooit "geregeld" -- het is precies zo zeker als zijn
      minst zekere stap, en dat staat er ook. Een tafel BELOOFT deze laag
      nooit: het lid vraagt aan en de zaak beslist, en dat was al zo voordat er
      een avondplanner bestond.

   WAT DIT NIET DOET, en dat is een besluit: er wordt geen urgentie gemaakt
   ("nog 2 tafels!"), er wordt niets voorgeselecteerd wat geld kost, en een
   plan verloopt niet. CLAUDE.md verbiedt verslavende patronen, en een
   avondplanner is precies de plek waar die er ongemerkt in sluipen. */
'use strict';

const SOORTEN = ['eten', 'vervoer', 'uitgaan', 'verblijf', 'thuis'];
const STATEN = ['voorstel', 'aangevraagd', 'bevestigd', 'mislukt'];

module.exports = ({ db, save, crypto, schoon }) => {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/avond/plan', bezit: { avonden: 'kaart' } });
  const nu = () => new Date().toISOString();
  const lijst = () => eigen.bak('avonden');

  /* De klok (de 04:00-knip en de tijdlijn) staat in ./klok.js: het enige stuk
     van deze laag dat met tijd rekent, en dit bestand ging over de 10 kB. */
  const { min, klok, tijdlijn } = require('./klok');

  function maakStap(inv) {
    const soort = SOORTEN.includes(String(inv.soort)) ? String(inv.soort) : 'eten';
    return {
      id: crypto.randomBytes(3).toString('hex'),
      soort,
      titel: schoon(inv.titel, 80) || soort,
      zaak: schoon(inv.zaak, 30) || null,
      van: schoon(inv.van, 5) || null,
      duurMin: Math.max(0, Math.min(600, parseInt(inv.duurMin, 10) || 0)),
      reisMin: Math.max(0, Math.min(180, parseInt(inv.reisMin, 10) || 0)),
      /* NULL IS IETS ANDERS DAN NUL. Van een club zonder kaart weten we niet
         wat een avond kost; dat als 0 opslaan maakt van "onbekend" stilletjes
         "gratis", en dan klopt het budget onder de balk niet meer. Onbekend
         blijft onbekend en telt niet mee -- de budgetregel zegt erbij hoeveel
         stappen er niet in zitten. */
      centenPP: inv.centenPP == null ? null
        : Math.max(0, Math.min(100000, parseInt(inv.centenPP, 10) || 0)),
      /* De verwijzing naar de ECHTE boeking. `domein` zegt wie hem bezit, `id`
         is zijn eigen id daar. Deze laag opent hem niet en verandert hem niet;
         wie de rit wil annuleren, doet dat bij de mobiliteitskern. */
      boeking: null,
      staat: 'voorstel',
      reden: null,
      at: nu()
    };
  }

  /* ---------- de klok ----------
     Geeft per stap de begin- en eindtijd terug, of vertelt waar het misgaat. */
  /* ---------- het budget ----------
     Per persoon, want zo denkt een gezelschap erover. De fooi zit er als RUIMTE
     in en niet als bedrag: fooi wordt nooit voorgevuld (dezelfde regel als in
     de horeca-kern), maar een budget dat er geen plek voor laat, klopt niet. */
  function budget(stappen, { plafondPP, personen }) {
    const som = stappen.reduce((t, s) => t + (s.centenPP || 0), 0);
    const onbekend = stappen.filter(s => s.centenPP == null).length;
    const p = Math.max(1, Math.min(40, parseInt(personen, 10) || 1));
    const plafond = Math.max(0, parseInt(plafondPP, 10) || 0);
    return {
      perPersoon: som, totaal: som * p, personen: p, onbekend,
      /* Van hoeveel stappen we de prijs NIET weten. Zonder dit getal leest een
         bedrag onder een plan als "dit is wat het kost", terwijl er een club in
         zit waarvan we geen kaart hebben. */
      let: onbekend ? 'Van ' + onbekend + ' stap(pen) weten we de prijs niet; die zitten hier niet in.' : null,
      plafondPP: plafond || null,
      past: !plafond || som <= plafond,
      overPP: plafond && som > plafond ? som - plafond : 0,
      ruimtePP: plafond ? Math.max(0, plafond - som) : null
    };
  }

  /* ---------- de avond ---------- */
  function maak(key, invoer) {
    const b = invoer || {};
    const stappen = (Array.isArray(b.stappen) ? b.stappen : []).slice(0, 8).map(maakStap);
    if (!stappen.length) return { status: 400, error: 'Een avond zonder stappen is geen avond.' };
    const t = tijdlijn(stappen, { start: b.start, thuisOm: b.thuisOm });
    if (t.fout) return { status: 409, error: t.fout, code: 'klok', teLaatMin: t.teLaatMin || null };
    const g = budget(stappen, { plafondPP: b.plafondPP, personen: b.personen });
    if (!g.past) return { status: 409, code: 'budget',
      error: 'Dit plan kost € ' + (g.perPersoon / 100).toFixed(2) + ' per persoon en je zei maximaal € ' +
        (g.plafondPP / 100).toFixed(2) + '.' };

    const a = {
      id: 'av' + crypto.randomBytes(5).toString('hex'), key,
      titel: schoon(b.titel, 80) || 'Een avond',
      datum: schoon(b.datum, 10) || nu().slice(0, 10),
      start: schoon(b.start, 5), thuisOm: schoon(b.thuisOm, 5) || null,
      personen: g.personen, plafondPP: g.plafondPP,
      gezelschap: (Array.isArray(b.gezelschap) ? b.gezelschap : []).slice(0, 20).map(x => schoon(x, 40)).filter(Boolean),
      stappen, staat: 'voorstel', at: nu()
    };
    lijst()[a.id] = a;
    save();
    return { ok: true, avond: beeld(a) };
  }

  const vanId = (key, id) => {
    const a = lijst()[String(id || '')];
    return a && a.key === key ? a : null;
  };

  /* De staat van de AVOND volgt uit zijn stappen en wordt niet apart gezet.
     Zo kan er nooit "geregeld" staan boven een plan waarvan de helft nog moet
     worden bevestigd -- de optelsom is de waarheid. */
  function staatVan(a) {
    const s = a.stappen.map(x => x.staat);
    if (s.some(x => x === 'mislukt')) return 'deels';
    if (s.every(x => x === 'bevestigd')) return 'rond';
    if (s.some(x => x === 'aangevraagd' || x === 'bevestigd')) return 'loopt';
    return 'voorstel';
  }

  function beeld(a) {
    const t = tijdlijn(a.stappen, { start: a.start, thuisOm: a.thuisOm });
    const g = budget(a.stappen, { plafondPP: a.plafondPP, personen: a.personen });
    const staat = staatVan(a);
    return Object.assign({}, a, {
      staat, tijdlijn: t.rijen || [], eindigt: t.eindigt || null, ruimteMin: t.ruimteMin,
      budget: g,
      /* De zin die boven het plan hoort te staan. Een avond is zo zeker als
         zijn minst zekere stap, en dat verzwijgen is de makkelijkste manier om
         iemand voor een dichte deur te laten staan. */
      zekerheid: staat === 'rond' ? 'Alles is bevestigd.'
        : staat === 'deels' ? 'Er is een stap misgegaan; die staat hieronder met de reden.'
          : staat === 'loopt' ? 'Nog niet alles is bevestigd. Een tafel is aangevraagd; de zaak beslist.'
            : 'Dit is een voorstel. Er is nog niets aangevraagd.'
    });
  }

  /* Een stap koppelen aan een echte boeking. De aanroeper heeft die boeking
     net in zijn eigen domein gemaakt en geeft hier alleen door WAAR hij staat. */
  function koppel(key, avondId, stapId, { domein, id, staat, reden, centenPP }) {
    const a = vanId(key, avondId);
    if (!a) return { status: 404, error: 'Deze avond kennen we niet.' };
    const s = a.stappen.find(x => x.id === String(stapId || ''));
    if (!s) return { status: 404, error: 'Die stap staat niet in dit plan.' };
    if (!STATEN.includes(String(staat))) return { status: 400, error: 'Onbekende staat.' };
    s.boeking = id ? { domein: schoon(domein, 30), id: schoon(id, 60) } : null;
    s.staat = String(staat);
    s.reden = schoon(reden, 160) || null;
    /* DE ECHTE PRIJS VERVANGT DE SCHATTING. Dit ontbrak, en een mutatie op de
       budgetcontrole van de rit liet geen enkele toets zakken -- omdat de
       geboekte prijs nooit op de stap terechtkwam. Het budget klopte dus wel
       op de raming en niet op wat er werkelijk werd uitgegeven, en dat is
       precies het gat waar een budget doorheen lekt. */
    if (centenPP != null) {
      s.geraamdCentenPP = s.geraamdCentenPP == null ? s.centenPP : s.geraamdCentenPP;
      s.centenPP = Math.max(0, Math.min(100000, parseInt(centenPP, 10) || 0));
    }
    save();
    return { ok: true, avond: beeld(a) };
  }

  const mijne = (key, { limiet = 20 } = {}) => Object.values(lijst())
    .filter(a => a.key === key)
    .sort((x, y) => String(y.at).localeCompare(String(x.at)))
    .slice(0, limiet).map(beeld);

  return { SOORTEN, STATEN, min, klok, maakStap, tijdlijn, budget, maak, vanId, beeld, koppel, mijne };
};
