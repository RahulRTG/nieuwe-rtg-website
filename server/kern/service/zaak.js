/* ============================================================================
   DE SERVICEZAAK -- de gemeenschappelijke envelop.

   Een ticket zegt: persoon -> vraag -> medewerker -> antwoord. Dat is te klein
   voor dit huis. Hier kan het zijn: lid -> betaling -> zaak -> incident -> AI ->
   medewerker -> techniek -> bewijs -> herstel. Daarom is het fundamentele object
   geen ticket maar een ZAAK, en draagt hij een tijdlijn in plaats van een status.

   WAT EEN ZAAK WEL EN NIET BEZIT.

   WEL: wie meldde, waarover het gaat (als VERWIJZING), wie eraan werkt, welke
   stand hij heeft, wat er is gebeurd, en waar hij aan vastzit (een klacht, een
   incident, een conciergeopdracht).

   NIET: de gegevens zelf. `betrokken` is een soort plus een code -- PAY-829192,
   ORD-11 -- en nooit een bedrag, een adres of een naam. Dat een zaak over een
   betaling gaat mag de wachtrij weten; wat er in die betaling staat is een
   aparte vraag met een eigen reden en een eigen spoor (./machtiging.js). Deze
   module dwingt dat af in plaats van het te vragen: `verwijzing()` gooit alles
   weg wat geen soort of code is.

   DE TIJDLIJN IS DE WAARHEID EN GROEIT ALLEEN AAN. Stand, prioriteit, eigenaar
   en de vier klokken zijn er allemaal uit AF TE LEIDEN. Ze staan ook los op de
   zaak, maar als kopie voor de snelheid -- nooit als tweede bron. Wie iets wil
   veranderen, schrijft een regel in de tijdlijn; ./loop.js is de enige plek waar
   dat gebeurt.

   HET NUMMER IS ZICHTBAAR EN ZEGT NIETS. SUP-4F2A81 is te noemen aan de
   telefoon, komt in een mail te staan en verraadt niets over hoeveel zaken er
   zijn of over wie de melder is. Het loopt daarom niet op.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const { SOORTEN, DOELGROEPEN, KANALEN, STANDEN, geldig } = require('./klassen');
const prioriteit = require('./prioriteit');
const router = require('./router');

const MAX = 20000;

module.exports = function maakZaken({ db, save, crypto }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/service', bezit: { serviceZaken: 'lijst' } });
  const Z = () => eigen.bak('serviceZaken');
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const inhoud = (s) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').length;
  const nummer = () => 'SUP-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  /* EEN VERWIJZING EN NOOIT GEGEVENS. Twee velden, allebei kort, allebei
     geschoond. Wie hier een derde veld bij wil, moet zich afvragen of hij niet
     eigenlijk de gegevens zelf in de wachtrij aan het leggen is -- en dat is
     precies waar deze laag omheen is gebouwd. */
  function verwijzing(v) {
    if (!v || typeof v !== 'object') return null;
    const soort = schoon(v.soort, 30).toLowerCase();
    const code = schoon(v.code, 60);
    if (!soort || !code) return null;
    return { soort, code };
  }

  const vind = (id) => Z().find(z => z.id === String(id || '').toUpperCase()) || null;

  /* Openen. `termen` gaan naar ./prioriteit.js en worden NIET bewaard als
     losse velden: de opbouw van de prioriteit draagt ze al, en een tweede
     kopie zou uit de pas gaan lopen zodra iemand de weging aanpast. */
  function open(o) {
    const g = o || {};
    const soort = geldig(SOORTEN, g.soort) ? String(g.soort) : 'ondersteuning';
    const doelgroep = geldig(DOELGROEPEN, g.doelgroep) ? String(g.doelgroep) : 'lid';
    const kanaal = geldig(KANALEN, g.kanaal) ? String(g.kanaal) : 'app';
    const titel = schoon(g.titel, 120);
    if (inhoud(titel) < 3) return { status: 400, error: 'Schrijf in een zin waar het over gaat.' };
    if (!g.melder) return { status: 400, error: 'Een zaak zonder melder kan niemand beantwoorden.' };

    const p = prioriteit.bereken(g.termen || {});
    const route = router.routeer({ doelgroep, onderwerp: g.onderwerp, soort, prioriteit: p.prioriteit });
    const at = nu();
    const z = {
      id: nummer(),
      soort, doelgroep, kanaal,
      /* De melder is een SLEUTEL of een codenaam, nooit een naam. Deze laag
         kent geen mensen -- zie de kop van kern/ledenbalie.js, dezelfde regel. */
      melder: schoon(g.melder, 120),
      onderwerp: schoon(g.onderwerp, 30) || 'anders',
      titel,
      betrokken: verwijzing(g.betrokken),
      stand: 'nieuw',
      prioriteit: p,
      team: route.team, routeWaarom: route.waarom, routeVia: route.via,
      eigenaar: null,
      /* Waar deze zaak aan vastzit in de lagen die de BETEKENIS bezitten. Leeg
         bij een zaak die alleen zichzelf is. */
      koppelingen: [],
      mensVerzoeken: 0,
      at, bron: schoon(g.bron, 60) || 'lid',
      tijdlijn: [{ wat: 'geopend', at, door: 'melder', tekst: titel }]
    };
    const tekst = schoon(g.tekst, 4000);
    if (tekst) z.tijdlijn.push({ wat: 'bericht', at, van: 'melder', tekst });
    z.tijdlijn.push({ wat: 'stand', at, naar: 'nieuw', door: 'systeem',
      notitie: 'Zaak aangemaakt en toegewezen aan ' + route.naam + '. ' + route.waarom });

    Z().unshift(z);
    if (Z().length > MAX) Z().pop();
    save();
    return { ok: true, zaak: kort(z) };
  }

  /* De korte vorm: wat een lijst nodig heeft. Veld voor veld opgebouwd en nooit
     een spread van de zaak -- dat is het verschil tussen "wij tonen deze twaalf
     dingen" en "wij tonen alles wat er morgen bij komt". */
  function kort(z) {
    return { id: z.id, soort: z.soort, doelgroep: z.doelgroep, kanaal: z.kanaal,
      titel: z.titel, onderwerp: z.onderwerp, betrokken: z.betrokken,
      stand: z.stand, standNaam: (STANDEN[z.stand] || {}).naam || z.stand,
      prioriteit: z.prioriteit.prioriteit, prioriteitNaam: z.prioriteit.naam,
      team: z.team, eigenaar: z.eigenaar, at: z.at,
      laatst: (z.tijdlijn[z.tijdlijn.length - 1] || {}).at || z.at,
      mensGevraagd: z.mensVerzoeken > 0, koppelingen: z.koppelingen.length };
  }

  /* Het dossier. `voorMelder` laat de interne kant weg -- niet omdat het geheim
     is, maar omdat de routeringsuitleg en de prioriteitsopbouw voor de melder
     ruis zijn die op een verontschuldiging gaat lijken. */
  function dossier(id, { voorMelder = false } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    const klokken = require('./klok').klokken(z);
    const basis = Object.assign(kort(z), {
      tijdlijn: z.tijdlijn.map(r => Object.assign({}, r)),
      klokken
    });
    if (voorMelder) return { ok: true, zaak: basis };
    return { ok: true, zaak: Object.assign(basis, {
      melder: z.melder, bron: z.bron, routeWaarom: z.routeWaarom, routeVia: z.routeVia,
      prioriteitOpbouw: z.prioriteit, mensVerzoeken: z.mensVerzoeken,
      koppelingenLijst: z.koppelingen.slice() }) };
  }

  function lijst(f) {
    const o = f || {};
    let a = Z();
    if (o.melder) a = a.filter(z => z.melder === String(o.melder));
    if (o.team) a = a.filter(z => z.team === String(o.team));
    if (o.soort) a = a.filter(z => z.soort === String(o.soort));
    if (o.alleenOpen) a = a.filter(z => !(STANDEN[z.stand] || {}).eind);
    if (o.mensGevraagd) a = a.filter(z => z.mensVerzoeken > 0);
    return a.slice(0, Number(o.max || 100)).map(kort);
  }

  /* De wachtrij per team, met wat een cockpit nodig heeft om te weten waar het
     schuurt. `zonderEigenaar` staat er apart bij: een zaak met een prioriteit
     en zonder mens is de enige soort die vanzelf blijft liggen. */
  function tel() {
    const a = Z().filter(z => !(STANDEN[z.stand] || {}).eind);
    const perTeam = {};
    for (const z of a) perTeam[z.team] = (perTeam[z.team] || 0) + 1;
    return { open: a.length, perTeam,
      zonderEigenaar: a.filter(z => !z.eigenaar).length,
      wachtOpMens: a.filter(z => z.mensVerzoeken > 0 && z.stand === 'wachtOpMens').length,
      wachtOpMelder: a.filter(z => z.stand === 'wachtOpMelder').length };
  }

  return { open, lijst, dossier, tel, vind, kort, verwijzing, bak: Z, nu, schoon, inhoud };
};
