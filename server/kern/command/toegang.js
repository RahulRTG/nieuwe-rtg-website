/* RECHTEN DIE VANZELF WEER WEGGAAN -- tijdelijke bevoegdheid, noodtoegang en
   het mandaat om namens iemand te handelen.

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

function maakToegang({ db, save, crypto, journaal }) {
  function rij() {
    if (!Array.isArray(db.data.commandRechten)) db.data.commandRechten = [];
    return db.data.commandRechten;
  }
  function mandaten() {
    if (!Array.isArray(db.data.commandMandaten)) db.data.commandMandaten = [];
    return db.data.commandMandaten;
  }
  const nu = () => new Date().toISOString();
  const straks = (min) => new Date(Date.now() + min * 60000).toISOString();

  /* Tijdelijk recht geven. Vier ogen: wie het geeft is niet wie het krijgt. */
  function geef(recht, aan, door, reden, minuten) {
    const r = ZWAAR[String(recht)];
    if (!r) return { error: 'Dat recht bestaat niet of hoeft niet tijdelijk gegeven te worden: ' + recht, status: 404 };
    if (!aan) return { error: 'Aan wie?', status: 400 };
    if (!door) return { error: 'Zonder herleidbare gever wordt er geen recht uitgedeeld.', status: 403 };
    if (String(aan) === String(door)) return { error: 'Een zwaar recht geef je niet aan jezelf; laat een ander het doen.', status: 403 };
    if (!reden || String(reden).trim().length < 4) return { error: 'Een tijdelijk recht vraagt een reden.', status: 400 };
    const min = Math.min(Number(minuten || r.maxMinuten), r.maxMinuten);
    const item = { id: crypto.randomUUID(), recht: String(recht), aan: String(aan), door: String(door),
      reden: String(reden), at: nu(), tot: straks(min), minuten: min, nood: false, ingetrokken: false };
    rij().push(item);
    if (save) save();
    journaal.noteer({ actor: door, actie: 'recht tijdelijk geven', objectType: 'recht', objectId: item.id,
      niveau: 'hand', reden, na: { recht: item.recht, aan: item.aan, tot: item.tot } });
    return { recht: item };
  }

  /* DE NOODDEUR. Geen tweede mens, want in een calamiteit is die er niet -- en
     precies daarom is hij kort, luid en volledig herleidbaar. */
  function breekGlas(recht, door, reden) {
    const r = ZWAAR[String(recht)];
    if (!r) return { error: 'Dat recht bestaat niet: ' + recht, status: 404 };
    if (!door) return { error: 'Zonder herleidbare medewerker gaat de nooddeur niet open.', status: 403 };
    if (!reden || String(reden).trim().length < 10) return { error: 'De nooddeur vraagt een volledige reden (minstens tien tekens); die staat straks in het journaal.', status: 400 };
    const min = Math.min(NOOD_MINUTEN, r.maxMinuten);
    const item = { id: crypto.randomUUID(), recht: String(recht), aan: String(door), door: String(door),
      reden: String(reden), at: nu(), tot: straks(min), minuten: min, nood: true, ingetrokken: false };
    rij().push(item);
    if (save) save();
    journaal.noteer({ actor: door, actie: 'noodtoegang openen', objectType: 'recht', objectId: item.id,
      niveau: 'hand', risico: 95, reden, na: { recht: item.recht, tot: item.tot, nood: true } });
    return { recht: item, waarschuwing: 'Deze noodtoegang staat in het journaal en vervalt om ' + item.tot + '.' };
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
      niveau: 'hand', reden: String(reden || 'niet meer nodig'), voor, na: { ingetrokken: true } });
    return { recht: item };
  }

  const geldig = (wie, recht) => {
    const n = nu();
    return rij().some(x => !x.ingetrokken && x.aan === String(wie) && x.recht === String(recht) && x.tot > n);
  };
  const vanWie = (wie) => { const n = nu(); return rij().filter(x => x.aan === String(wie) && !x.ingetrokken && x.tot > n); };
  const open = () => { const n = nu(); return rij().filter(x => !x.ingetrokken && x.tot > n); };

  /* MANDAAT: X mag namens Y handelen, tot een datum, voor een afgebakend
     terrein. Ook dit vervalt vanzelf. */
  function mandaat(van, aan, terrein, door, tot, reden) {
    if (!van || !aan || !terrein) return { error: 'Een mandaat vraagt van wie, aan wie en waarvoor.', status: 400 };
    if (!door) return { error: 'Zonder herleidbare actor wordt er geen mandaat vastgelegd.', status: 403 };
    if (!tot) return { error: 'Een mandaat zonder einddatum is geen mandaat maar een overdracht.', status: 400 };
    const m = { id: crypto.randomUUID(), van: String(van), aan: String(aan), terrein: String(terrein),
      door: String(door), reden: String(reden || ''), at: nu(), tot: String(tot) };
    mandaten().push(m);
    if (save) save();
    journaal.noteer({ actor: door, actie: 'mandaat vastleggen', objectType: 'mandaat', objectId: m.id,
      niveau: 'hand', reden: m.reden, na: { van: m.van, aan: m.aan, terrein: m.terrein, tot: m.tot } });
    return { mandaat: m };
  }
  const mandatenVan = (wie) => { const n = nu(); return mandaten().filter(m => (m.aan === String(wie) || m.van === String(wie)) && m.tot > n); };

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
      mandaten: mandaten().filter(m => m.tot > n),
      /* Wat een lege lijst hier betekent, staat erbij: geen actieve zware
         rechten is een goede uitslag, geen ontbrekende meting. */
      uitleg: levend.length ? null : 'Er staan op dit moment geen zware rechten open. Dat is de bedoelde rusttoestand.'
    };
  }

  return { geef, breekGlas, trekIn, geldig, vanWie, open, graaf, mandaat, mandatenVan, ZWAAR, NOOD_MINUTEN };
}

module.exports = { maakToegang, ZWAAR, NOOD_MINUTEN };
