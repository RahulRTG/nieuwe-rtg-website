/* ============================================================================
   DEMOCRATIEOS, FASE B -- de minimale burgerlus (POLITIEK.md par. 18.1).

     kwestie -> behandeling -> eindstand met reden -> terugkoppeling -> NIEMAND KWIJT

   Met opzet NIETS meer: geen partij, geen voorstel van een partij, geen
   toezegging, geen AI. Fase B kent geen partij, en er is ook geen abstractie
   voor alvast klaargezet.

   HET ACCEPTATIECRITERIUM, in een zin: iedere geaccepteerde kwestie is terug te
   vinden, heeft een verklaarbare toestand en kan niet ongemerkt verdwijnen.
   Daarom geeft elke schrijvende handeling pas antwoord als de opslag hem heeft
   bevestigd (server/lib/duurzaam.js); lukt dat niet, dan is het een 503 en is
   de kwestie NIET geaccepteerd -- de inbrenger weet dat, en kan het opnieuw doen.

   DE TERUGKOPPELING HEEFT TWEE HELFTEN, en alleen de eerste is het bewijs. Zodra
   een eindstand vastligt, is hij voor de inbrenger te LEZEN via zijn eigen lijst
   (`mijn`) -- in dezelfde vastlegging, dus nooit het een zonder het ander. De
   melding in zijn berichten is een WEK daarbovenop; valt de server tussen het
   vastleggen en de wek weg, dan staat de terugkoppeling op `klaargezet` en haalt
   `herbezorg` de wek in. Dat is een verklaarde stand en geen breuk.

   Wat deze laag uit RTG gebruikt, staat in ./afhankelijkheden.js. */
'use strict';

const { schoon } = require('../util');
const { nu } = require('../../lib/klok');
const { maakKwestieSchrijver } = require('./kwestie');
const { maakBeeld } = require('./beeld');
const { maakLid } = require('./lid');
const { maakKoppeling } = require('./koppeling');
const { meet } = require('./meter');
const { EINDSTANDEN } = require('./eindstanden');
const AFHANKELIJK = require('./afhankelijkheden');
const { BEWIJSSTAND } = require('./bewijsstand');

function maakDemocratie({ db, save, bijeen, inBundel, crypto, meldLid, codenaamVan }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/democratie',
    bezit: { democratieKwesties: 'kaart', democratieJournaal: 'lijst', democratieInbrengers: 'kaart' } });
  const vastleggen = require('../../lib/duurzaam')({ bijeen, save, inBundel, bron: 'democratie' });
  const kaart = () => eigen.bak('democratieKwesties');
  const kijk = () => eigen.kijk('democratieKwesties') || {};
  const schrijver = maakKwestieSchrijver({ nu, journaal: () => eigen.bak('democratieJournaal') });
  const koppeling = maakKoppeling({ crypto, nu,
    kaart: () => eigen.bak('democratieInbrengers'), kijk: () => eigen.kijk('democratieInbrengers') });

  /* Wie beslist, staat er op zijn CODENAAM (DO-09). `codenaamVan` geeft de
     sleutel zelf terug als er geen codenaam is -- na een verwijderd account,
     of met een koude gids -- en dan zou er een ruwe RTG-sleutel in de
     eindstand belanden. Zonder codenaam beslist er dus niemand. */
  const wie = (sleutel) => {
    const c = codenaamVan && codenaamVan(sleutel);
    return (c && c !== sleutel && !/^user-/.test(String(c))) ? c : null;
  };
  const zonderNaam = { status: 403, error: 'Wie over een kwestie beslist, doet dat onder een codenaam, en voor deze sessie is er geen. Log opnieuw in met een bestaand account.' };
  const zoek = (id) => kijk()[String(id || '').toUpperCase()] || null;
  const publiek = maakBeeld();

  const ontvangersVan = (k) => [k.inbrenger].concat(k.volgers || []);

  /* De wek na een vastgelegde eindstand. Mislukt hij, dan blijft de trede
     `klaargezet` staan: verklaard, en herbezorgbaar. */
  async function wek(k) {
    const r = schrijver.huidige(k);
    if (r.stand !== 'afgesloten') return 0;
    let n = 0;
    for (const ref of ontvangersVan(k)) {
      const t = r.terugkoppeling && r.terugkoppeling[ref];
      const sleutel = koppeling.sleutelVan(ref);
      if (!t || t.stand !== 'klaargezet' || !sleutel) continue;
      let gewekt = null;
      try {
        /* De wek zegt NIET welke kwestie en niet welke uitkomst: een bericht op
           de sleutel van het lid met het kwestienummer erin is een koppeling
           tussen mens en kwestie buiten ./koppeling.js om. */
        gewekt = meldLid(sleutel, { icon: 'kwestie', scope: 'democratie', title: 'Er is nieuws in je kwesties',
          body: 'Open je kwesties om te lezen wat er is besloten en waarom.' });
      } catch (e) { console.warn('[democratie] wek mislukt voor ' + k.id + ': ' + e.message); }
      if (!gewekt) continue;
      const mis = await vastleggen(() => { schrijver.trede(k, ref, 'gewekt'); });
      if (!mis) n++;
    }
    return n;
  }

  function lijst() {
    const alle = Object.values(kijk()).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return { ok: true, kwesties: alle.map(k => publiek(k, null)), eindstanden: EINDSTANDEN };
  }

  async function behandel(doorSleutel, b) {
    const k = zoek(b.id);
    if (!k) return { status: 404, error: 'Onbekende kwestie.' };
    const naar = String(b.stand || 'in-behandeling');
    /* Eerst weigeren, dan pas de opslag aanraken: een geweigerd verzoek laat
       geen spoor in de opslag na. */
    const door = wie(doorSleutel);
    if (!door) return zonderNaam;
    if (!schrijver.loopt(k)) return { status: 409, error: 'Deze ronde is al afgesloten. Heropen de kwestie als er iets nieuws is.' };
    if (!['in-behandeling', 'wacht-op-bevoegde'].includes(naar)) return { status: 400, error: 'Kies in-behandeling of wacht-op-bevoegde.' };
    if (schrijver.huidige(k).stand === naar) return { ok: true, herhaling: true, kwestie: publiek(k, null) };
    const mis = await vastleggen(() => { schrijver.behandel(k, door, naar, schoon(b.notitie, 300) || null); });
    return mis || { ok: true, kwestie: publiek(k, null) };
  }

  async function sluit(doorSleutel, b) {
    const k = zoek(b.id);
    if (!k) return { status: 404, error: 'Onbekende kwestie.' };
    const g = { stand: String(b.stand || ''), toelichting: schoon(b.toelichting, 1000),
      bevoegdheid: schoon(b.bevoegdheid, 120), naar: schoon(b.naar, 120), in: String(b.in || '').toUpperCase() || null };
    const door = wie(doorSleutel);
    if (!door) return zonderNaam;
    const fout = schrijver.toetsEindstand(k, g, false);
    if (fout) return fout;
    const doel = g.stand === 'samengevoegd' ? zoek(g.in) : null;
    if (g.stand === 'samengevoegd' && (!doel || doel.id === k.id || !schrijver.loopt(doel))) {
      return { status: 400, error: 'Samenvoegen kan alleen in een andere kwestie die nog loopt.' };
    }
    const mis = await vastleggen(() => {
      if (doel) schrijver.volg(doel, ontvangersVan(k));
      schrijver.sluit(k, door, g, ontvangersVan(k));
    });
    if (mis) return mis;
    await wek(k);
    return { ok: true, kwestie: publiek(k, null) };
  }

  async function heropen(doorSleutel, b) {
    const k = zoek(b.id);
    if (!k) return { status: 404, error: 'Onbekende kwestie.' };
    const reden = schoon(b.reden, 600);
    const door = wie(doorSleutel);
    if (!door) return zonderNaam;
    if (schrijver.loopt(k)) return { status: 409, error: 'Deze kwestie loopt nog; er is niets te heropenen.' };
    if (reden.length < 15) return { status: 400, error: 'Zeg in minstens vijftien tekens welk nieuw feit een nieuwe ronde rechtvaardigt.' };
    const mis = await vastleggen(() => { schrijver.heropen(k, door, reden); });
    return mis || { ok: true, kwestie: publiek(k, null) };
  }

  /* Haalt elke wek in die niet uitging. Raakt geen eindstand aan. */
  async function herbezorg() {
    let gewekt = 0;
    for (const k of Object.values(kijk())) gewekt += await wek(k);
    return { ok: true, gewekt };
  }

  /* De meter zegt er ook bij waar deze laag van RTG afhangt (proef P3): een
     verhuizing begint met weten wat er mee moet. */
  const meter = () => Object.assign(meet({ kwesties: kijk(), journaal: eigen.kijk('democratieJournaal'), koppeling }),
    { afhankelijkVanRtg: { modules: Object.keys(AFHANKELIJK.MODULES), geinjecteerd: Object.keys(AFHANKELIJK.GEINJECTEERD),
      routes: Object.keys(AFHANKELIJK.ROUTES) },
      bewijsstand: BEWIJSSTAND.map(b => ({ code: b.code, stand: b.stand, wat: b.wat, sluit: b.sluit || null })) });

  /* Voor het recht op vergetelheid (kern/vergeten.js): synchroon, binnen de
     vastlegging van wie roept. De kwesties blijven; de weg naar de mens niet. */
  const vergeet = (sleutel) => (eigen.kijk('democratieInbrengers') ? koppeling.vergeet(sleutel) : 0);

  const lid = maakLid({ kaart, kijk, zoek, schrijver, koppeling, vastleggen, publiek, wek, ontvangersVan, crypto });

  return { ...lid, lijst, behandel, sluit, heropen, herbezorg, meter, vergeet };
}

module.exports = { maakDemocratie };
