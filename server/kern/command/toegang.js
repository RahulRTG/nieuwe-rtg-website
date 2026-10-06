/* RECHTEN DIE VANZELF WEER WEGGAAN -- tijdelijke bevoegdheid en noodtoegang.
   (Het mandaat om namens iemand te handelen is opgeheven; zie verderop.)

   DE KERN VAN DEZE MODULE IS DE VERVALDATUM. Een zwaar recht dat je krijgt en
   houdt, is over een jaar een recht waarvan niemand meer weet waarom het er is
   -- en dat is precies het recht waarmee het misgaat. Alles hier heeft een
   `tot`, en na dat moment doet het niets meer. Er is geen "intrekken" nodig,
   want er is niets dat blijft staan: het verlopen is de standaardtoestand en
   het geldig zijn de uitzondering.

   DE NOODDEUR MAG BESTAAN, MAAR NIET STIL. Break-glass zonder reden bestaat
   hier niet: hij vraagt een reden, hij duurt hooguit een uur, hij komt in het
   journaal en hij is achteraf terug te lezen met wat er in dat uur is gedaan.
   Een nooddeur waar niemand iets van merkt, is een achterdeur.

   WAT DIT NIET IS. Dit vervangt de inlog niet. Wie hier binnenkomt is al door
   officeAuth heen; deze laag gaat over wat je daarbovenop tijdelijk mag. De
   rechtenboom van het platform zelf blijft waar hij is. */
'use strict';

const { NIVEAUS } = require('../frictie');
const klok = require('../../lib/klok');

/* De zware bevoegdheden. Alleen deze zijn tijdelijk uit te delen -- de rest
   hangt gewoon aan de kantoorinlog. Een lijst, want "alles kan tijdelijk" is
   hetzelfde als geen grens. */
const ZWAAR = {
  'kluis-inzage': { wat: 'De echte naam achter een codenaam opvragen', maxMinuten: 60 },
  'massamutatie': { wat: 'Een wijziging op meer dan honderd objecten tegelijk', maxMinuten: 30 },
  'beleid-spoed': { wat: 'Een beleidsregel zetten zonder tweede paar ogen', maxMinuten: 30 },
  'agent-ontgrendelen': { wat: 'Een gestopte agent hervatten', maxMinuten: 120 },
  'herstel-forceren': { wat: 'Een runbook draaien dat op menselijk besluit staat', maxMinuten: 60 }
};

const NOOD_MINUTEN = 60;

/* EEN ZWAAR RECHT IS PERSOONLIJK. De gedeelde kantoorcode geeft en krijgt er
   geen: een spoor dat eindigt bij een gedeelde code is een alibi (KANTOOR.md).
   Waar de vijf rechten gelezen worden: test/command-zware-rechten.test.js. */
const gedeeld = (w) => /gedeelde code/i.test(String(w || ''));

function maakToegang({ opslag, save, crypto, journaal }) {
  function rij() {
    return opslag.bak('commandRechten');
  }
  const nu = () => klok.datum().toISOString();
  const straks = (min) => new Date(klok.nu() + min * 60000).toISOString();

  /* Tijdelijk recht geven. Vier ogen: wie het geeft is niet wie het krijgt. */
  function geef(recht, aan, door, reden, minuten) {
    const r = ZWAAR[String(recht)];
    if (!r) return { error: 'Dat recht bestaat niet of hoeft niet tijdelijk gegeven te worden: ' + recht, status: 404 };
    if (!aan) return { error: 'Aan wie?', status: 400 };
    if (!door || gedeeld(door) || gedeeld(aan)) return { error: 'Een zwaar recht geeft en krijgt alleen een mens op naam, niet de gedeelde code.', status: 403 };
    if (String(aan) === String(door)) return { error: 'Een zwaar recht geef je niet aan jezelf; laat een ander het doen.', status: 403 };
    if (!reden || String(reden).trim().length < 4) return { error: 'Een tijdelijk recht vraagt een reden.', status: 400 };
    const min = Math.min(Number(minuten || r.maxMinuten), r.maxMinuten);
    const item = { id: crypto.randomUUID(), recht: String(recht), aan: String(aan), door: String(door),
      reden: String(reden), at: nu(), tot: straks(min), minuten: min, nood: false, ingetrokken: false };
    rij().push(item);
    if (save) save();
    journaal.noteer({ actor: door, actie: 'recht tijdelijk geven', objectType: 'recht', objectId: item.id,
      niveau: NIVEAUS.hand, reden, na: { recht: item.recht, aan: item.aan, tot: item.tot } });
    return { recht: item };
  }

  /* DE NOODDEUR. Geen tweede mens, want in een calamiteit is die er niet -- en
     precies daarom is hij kort, luid en volledig herleidbaar. */
  function breekGlas(recht, door, reden) {
    const r = ZWAAR[String(recht)];
    if (!r) return { error: 'Dat recht bestaat niet: ' + recht, status: 404 };
    if (!door || gedeeld(door)) return { error: 'De nooddeur gaat alleen open voor een mens op naam, niet voor de gedeelde code.', status: 403 };
    if (!reden || String(reden).trim().length < 10) return { error: 'De nooddeur vraagt een volledige reden (minstens tien tekens); die staat straks in het journaal.', status: 400 };
    const min = Math.min(NOOD_MINUTEN, r.maxMinuten);
    const item = { id: crypto.randomUUID(), recht: String(recht), aan: String(door), door: String(door),
      reden: String(reden), at: nu(), tot: straks(min), minuten: min, nood: true, ingetrokken: false };
    rij().push(item);
    if (save) save();
    journaal.noteer({ actor: door, actie: 'noodtoegang openen', objectType: 'recht', objectId: item.id,
      niveau: NIVEAUS.hand, risico: 95, reden, na: { recht: item.recht, tot: item.tot, nood: true } });
    return { recht: item,
      waarschuwing: 'Deze noodtoegang staat in het journaal en vervalt om ' + item.tot + '.' };
  }

  function trekIn(id, door, reden) {
    const item = rij().find(x => x.id === String(id));
    if (!item) return { error: 'Dat recht bestaat niet.', status: 404 };
    if (!door) return { error: 'Zonder herleidbare actor wordt er niets ingetrokken.', status: 403 };
    if (item.ingetrokken) return { error: 'Dat recht was al ingetrokken.', status: 409 };
    const voor = { tot: item.tot, ingetrokken: false };
    item.ingetrokken = true; item.tot = nu(); item.introkDoor = String(door);
    if (save) save();
    journaal.noteer({ actor: door, actie: 'noodtoegang sluiten', objectType: 'recht', objectId: item.id,
      niveau: NIVEAUS.hand, reden: String(reden || 'niet meer nodig'), voor, na: { ingetrokken: true } });
    return { recht: item };
  }

  const geldig = (wie, recht) => {
    const n = nu();
    return rij().some(x => !x.ingetrokken && x.aan === String(wie) && x.recht === String(recht) && x.tot > n);
  };
  /* De poort voor de vijf handelingen: null als het recht openstaat, anders
     een weigering die zegt welk recht en hoe je het krijgt. */
  const vereist = (wie, recht) => (!gedeeld(wie) && geldig(wie, recht)) ? null : { status: 403, recht,
    error: 'Dit vraagt het tijdelijke recht "' + recht + '" (' + ZWAAR[recht].wat + '). Een collega op naam ' +
      'geeft het via /api/command/recht/geef, of open de nooddeur met een reden.' };
  const vanWie = (wie) => { const n = nu(); return rij().filter(x => x.aan === String(wie) && !x.ingetrokken && x.tot > n); };
  const open = () => { const n = nu(); return rij().filter(x => !x.ingetrokken && x.tot > n); };

  /* Hier stond `mandaat()`: X mag namens Y handelen, tot een datum. Opgeheven op
     4 oktober 2026. `tot` was vrije tekst die als TEKST werd vergeleken ("morgen"
     verliep nooit, een datum in het verleden werd aanvaard), er was geen maximum
     en geen intrekken, en geen enkele route of scherm las de mandaten. Een
     machtiging zonder geldigheidscontract en zonder lezer is geen bevoegdheid
     maar een regel die eruitziet als een. Wie namens iemand handelt, gaat langs
     kern/vertegenwoordiging/ (mens-namens-mens) of kern/stuur/mandaat.js (de AI).
     De collectie `commandMandaten` blijft geregistreerd zodat bestaande rijen
     niet verdwijnen; niets schrijft of leest haar nog. */

  /* DE RECHTENGRAAF: wie heeft nu wat, waarom, van wie en tot wanneer. Dit is
     de vraag die bij een audit als eerste komt en die zonder deze laag alleen
     met handwerk te beantwoorden is. */
  function graaf() {
    const n = nu();
    const levend = rij().filter(x => !x.ingetrokken && x.tot > n);
    const verlopen = rij().filter(x => x.ingetrokken || x.tot <= n);
    return {
      soorten: Object.entries(ZWAAR).map(([id, r]) => ({ id, wat: r.wat, maxMinuten: r.maxMinuten,
        nuActief: levend.filter(x => x.recht === id).length })),
      actief: levend.map(x => ({ id: x.id, recht: x.recht, aan: x.aan, door: x.door, reden: x.reden,
        at: x.at, tot: x.tot, nood: x.nood })),
      nood: levend.filter(x => x.nood).length,
      verlopen: verlopen.length,
      /* Wat een lege lijst hier betekent, staat erbij: geen actieve zware
         rechten is een goede uitslag, geen ontbrekende meting. */
      uitleg: levend.length ? null : 'Er staan op dit moment geen zware rechten open. Dat is de bedoelde rusttoestand.'
    };
  }

  return { geef, breekGlas, trekIn, geldig, vereist, vanWie, open, graaf, ZWAAR, NOOD_MINUTEN };
}

module.exports = { maakToegang, ZWAAR, NOOD_MINUTEN };
