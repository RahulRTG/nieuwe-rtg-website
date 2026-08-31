/* RTG BIJSTAND -- support die binnenkomt zonder de sleutel te krijgen.

   HET PROBLEEM. Een leverancier die zijn klanten wil helpen, geeft zijn
   supportafdeling meestal een beheerdersaccount op alles. Dat werkt, en het is
   de reden dat "onze engineer heeft even in uw omgeving gekeken" een zin is die
   niemand kan controleren: er was geen begin, geen einde, geen onderwerp en
   geen spoor.

   HIER IS TOEGANG EEN UITNODIGING EN GEEN RECHT. Er is geen permanent
   `admin = true` voor RTG-personeel, ook niet voor ons eigen kantoor. Een
   sessie heeft één organisatie, één onderwerp, één niveau, een looptijd en een
   spoor -- en alleen ./bijstand-klant.js kent een functie die er een aanmaakt.
   Dat is geen instelling maar de vorm: wie het wil veranderen, moet aan de
   klantkant bijbouwen, en dat valt op.

   DIT BESTAND IS DE VORM: de opslag, de toestand (en dus het verlopen), het
   spoor, het journaal en het teruglezen. De twee kanten staan ernaast:

     ./bijstand-klant.js   uitnodigen, goedkeuren, intrekken
     ./bijstand-rtg.js     betreden, kijken, voorstellen, uitvoeren, afsluiten
     ./bijstand-niveaus.js wat elk niveau werkelijk mag
     ./bijstand-diagnose.js wat een sessie te ZIEN geeft, en wat dicht blijft
     ./bijstand-melden.js  het bericht aan de klant, in zijn eigen journaal

   VERLOPEN IS EEN TOESTAND EN GEEN OPRUIMACTIE. `stand()` rekent hem bij elke
   lezing opnieuw uit de klok. Een sessie die pas dichtgaat als er een
   schoonmaker langskomt, staat tussendoor open -- en dan is "de sessie verloopt
   vanzelf" een belofte die van een cron afhangt. Dezelfde regel als in
   ./toegang.js: het verlopen is de standaardtoestand en het geldig zijn de
   uitzondering. */
'use strict';

const klok = require('../../lib/klok');

const niveaus = require('./bijstand-niveaus');
const { NIVEAUS } = require('../frictie');
const melden = require('./bijstand-melden');

function maakBijstand({ opslag, save, crypto, journaal, tenant, diagnose }) {
  const nu = () => klok.datum().toISOString();
  /* De tenantlaag komt LUI binnen. Zij wordt in server/opzet/routes-dwars.js
     opgehangen en dat gebeurt vóór de aanbouw -- maar een laag die van die
     volgorde afhangt, breekt zodra iemand hem verzet. Zelfde haak als bij het
     weefsel in ./stadstart.js. */
  const tenantNu = () => (typeof tenant === 'function' ? tenant() : tenant) || null;

  function rij() {
    return opslag.bak('bijstand');
  }
  const vind = (id) => rij().find(s => s.id === String(id)) || null;

  function stand(s) {
    if (s.status === 'gesloten' || s.status === 'ingetrokken') return s.status;
    return Date.parse(s.tot) <= klok.nu() ? 'verlopen' : s.status;
  }
  const levend = (s) => stand(s) === 'open' || stand(s) === 'bezig';

  function spoor(s, wat) {
    s.spoor.push({ at: nu(), wat: String(wat).slice(0, 300) });
    if (s.spoor.length > 200) s.spoor.splice(0, s.spoor.length - 200);
  }
  function noteer(s, actor, actie, reden) {
    journaal.noteer({ actor, actie, objectType: 'bijstand', objectId: s.id, niveau: NIVEAUS.hand,
      reden: String(reden || ''), na: { org: s.org, niveau: s.niveau } });
  }

  /* HET BERICHT AAN DE KLANT. Het journaal hierboven is van RTG; dit schrijft in
     het journaal van de KLANT, dat hij zelf al leest. Zie ./bijstand-melden.js
     voor waarom dat kanaal en geen ander. */
  const meld = (s, wat, reden) => melden.meld({ opslag, save }, s, wat, reden);

  function kort(s) {
    return { id: s.id, org: s.org, orgNaam: s.orgNaam, onderwerp: s.onderwerp, niveau: s.niveau,
      status: stand(s), at: s.at, tot: s.tot, minuten: s.minuten,
      medewerker: s.medewerker, voorafAkkoord: !!s.voorafAkkoord,
      inhoudOpen: !!s.inhoud.open,
      inhoudGevraagd: !!(s.inhoud.verzoek && !s.inhoud.besluitAt),
      handelingen: s.handelingen.length,
      wachtOpAkkoord: s.handelingen.filter(h => h.status === 'voorgesteld').length };
  }

  function dossier(id, o) {
    const s = vind(id);
    if (!s) return { error: 'Die sessie bestaat niet.', status: 404 };
    return Object.assign(kort(s), {
      gevraagdDoor: s.gevraagdDoor, werkruimte: s.werkruimte, voorafReden: s.voorafReden,
      betredenAt: s.betredenAt || null,
      niveauUitleg: niveaus.keuzelijst().find(x => x.id === s.niveau) || null,
      handelingenLijst: s.handelingen.map((h, i) => Object.assign({ index: i }, h)),
      inhoud: { open: !!s.inhoud.open, verzoek: s.inhoud.verzoek || null,
        besluitDoor: s.inhoud.besluitDoor || null, besluitAt: s.inhoud.besluitAt || null,
        let: 'Zonder een apart besluit ziet RTG structuur en toestanden, en geen gegevens van deze organisatie.' },
      /* Nieuwste bovenaan: het spoor wordt tijdens een sessie gelezen en niet
         achteraf, en dan wil je zien wat er NET gebeurde. */
      spoor: s.spoor.slice().reverse(), verslag: s.verslag,
      let: (o && o.voorKlant)
        ? 'U ziet hier live wat er gebeurt. Intrekken kan op elk moment en zonder reden; de sessie stopt hoe ' +
          'dan ook vanzelf om ' + String(s.tot).slice(11, 16) + ' UTC.'
        : 'De organisatie ziet dit spoor live meelopen.'
    });
  }

  function lijst(f) {
    const o = f || {};
    let alle = rij().slice().reverse();
    if (o.org) alle = alle.filter(s => s.org === String(o.org));
    if (o.alleenLevend) alle = alle.filter(levend);
    return alle.slice(0, Number(o.max || 50)).map(kort);
  }

  function tel() {
    const alle = rij();
    const l = alle.filter(levend);
    return { totaal: alle.length, levend: l.length,
      wachtOpRtg: l.filter(s => !s.medewerker).length,
      wachtOpKlant: l.reduce((n, s) => n + s.handelingen.filter(h => h.status === 'voorgesteld').length, 0),
      inhoudOpen: l.filter(s => s.inhoud.open).length,
      /* Wat RTG op dit moment zonder uitnodiging bij een klant mag: niets. Dat
         getal staat er omdat een nul die je kunt aflezen meer waard is dan een
         belofte die je moet geloven -- en omdat hij niet nul kan worden zonder
         dat iemand deze laag verbouwt. */
      permanenteToegang: 0 };
  }

  const C = { rij, vind, stand, levend, kort, dossier, spoor, noteer, meld, nu, save, crypto, tenantNu, diagnose };
  const klant = require('./bijstand-klant').maakKlantkant(C);
  const rtg = require('./bijstand-rtg').maakRtgkant(C);

  /* FAIL-FAST OP EEN NAAM DIE AAN BEIDE KANTEN STAAT. Een gewone Object.assign
     laat de laatste winnen, en dat is hier de RTG-kant -- dus een functie die
     daar `vraag` gaat heten, zou stilzwijgend de klantkant vervangen. Dan is de
     belofte "alleen de klant maakt een sessie" nog waar in het ene bestand en
     niet meer in de praktijk. Dit weigert bij het opstarten, met de naam erbij. */
  const dubbel = Object.keys(rtg).filter(k => Object.prototype.hasOwnProperty.call(klant, k));
  if (dubbel.length) {
    throw new Error('bijstand: "' + dubbel.join(', ') + '" staat aan beide kanten. De RTG-kant zou de ' +
      'klantkant overschrijven; kies een andere naam of zet hem op één plek.');
  }

  return Object.assign({ lijst, dossier, tel, stand, NIVEAUS: niveaus.keuzelijst() }, klant, rtg);
}

module.exports = { maakBijstand };
