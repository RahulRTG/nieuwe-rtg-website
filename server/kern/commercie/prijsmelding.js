/* DE LEDENPRIJSGARANTIE: het plafond bestond, de rechtzetting niet.

   HET GAT (PRIJZEN.md 4.11). De garantie is voor de helft echt gebouwd: de
   ledenprijs wordt server-side afgekapt op de publieke prijs van de zaak, zowel
   bij het opslaan van de menukaart als bij het plaatsen van een bestelling
   (kern/util.js, routes/supplier/menukaart.js, lidacties/bestellen.js). Dat
   werkt en er staat een toets op.

   Maar de voorwaarden beloven meer:

       "Ziet u het bij de zaak zelf toch goedkoper, meld het via de app: de
        partner past de prijs aan en het verschil wordt voor u rechtgezet."

   Er was geen meldknop en geen terugbetaalstroom. Het plafond vangt alleen wat
   RTG KAN ZIEN -- de prijs in de app tegenover de publieke prijs zoals die in de
   app staat. Wat het niet ziet: dat de zaak op haar eigen website of op het bord
   aan de deur iets anders vraagt. Precies daarvoor is de melding bedoeld, en
   precies dat ontbrak.

   DRIE DINGEN DIE HIER NIET GEBEUREN, en ze zijn alle drie een besluit:

   1. RTG BEOORDEELT NIET AUTOMATISCH. Een melding is een bewering van een lid
      over een prijs die RTG niet kan waarnemen. Automatisch terugbetalen op zo'n
      bewering zou van elke melding een knop maken; automatisch afwijzen zou de
      garantie waardeloos maken. Dus: de ZAAK reageert, en een mens van RTG kan
      erbij als het vastloopt.
   2. ER WORDT NIETS OVERGEMAAKT VANUIT DEZE LAAG. Het bedrag dat rechtgezet
      wordt, is een verplichting met een status -- dezelfde scheiding als bij
      ./fee.js en ./allocatie.js. Wat er echt beweegt, weet het grootboek.
   3. HET IS GEEN GESCHILLENSYSTEEM. Een melding gaat over EEN prijs op EEN
      moment. Bewijs, hoor en wederhoor, een beroepsronde -- dat is een ander
      ding, en dat verzinnen we hier niet.

   DE STANDEN:

     GEMELD        het lid heeft het gemeld; de zaak is aan zet
     ERKEND        de zaak erkent: prijs aangepast, verschil wordt rechtgezet
     BETWIST       de zaak zegt dat de prijs klopt; RTG kan erbij
     RECHTGEZET    het verschil is verrekend
     AFGEWEZEN     na beoordeling: geen recht op rechtzetting
*/
'use strict';

const STATUS = {
  GEMELD: 'GEMELD', ERKEND: 'ERKEND', BETWIST: 'BETWIST',
  RECHTGEZET: 'RECHTGEZET', AFGEWEZEN: 'AFGEWEZEN'
};

const OVERGANG = {
  [STATUS.GEMELD]: [STATUS.ERKEND, STATUS.BETWIST, STATUS.AFGEWEZEN],
  [STATUS.ERKEND]: [STATUS.RECHTGEZET],
  /* BETWIST -> ERKEND mag: een mens van RTG kijkt ernaar en de zaak komt terug
     op haar standpunt, of RTG stelt het lid in het gelijk. BETWIST ->
     RECHTGEZET mag NIET rechtstreeks: er hoort altijd een moment te zijn waarop
     iemand zegt "dit klopt", en dat moment heet ERKEND. */
  [STATUS.BETWIST]: [STATUS.ERKEND, STATUS.AFGEWEZEN],
  [STATUS.RECHTGEZET]: [],
  [STATUS.AFGEWEZEN]: []
};

const OPEN = new Set([STATUS.GEMELD, STATUS.ERKEND, STATUS.BETWIST]);

function magOvergaan(van, naar) {
  return Array.isArray(OVERGANG[van]) && OVERGANG[van].includes(naar);
}

function maakPrijsmeldingen({ db, save, nu }) {
  const tijd = nu || (() => Date.now());
  function rij() {
    if (!db.data) db.data = {};
    if (!Array.isArray(db.data.prijsmeldingen)) db.data.prijsmeldingen = [];
    return db.data.prijsmeldingen;
  }
  const vind = id => rij().find(m => m.id === String(id || '')) || null;

  function zet(m, naar, velden) {
    if (!magOvergaan(m.status, naar))
      return { status: 409, error: 'Een prijsmelding kan niet van ' + m.status + ' naar ' + naar + '.' };
    m.status = naar;
    Object.assign(m, velden || {});
    (m.verloop = m.verloop || []).push({ naar, at: tijd() });
    save();
    return { status: 200, ok: true, melding: publiek(m) };
  }

  /* Het lid meldt. `betaaldCenten` is wat het lid via de app betaalde,
     `gezienCenten` wat het bij de zaak zelf zag. Het verschil is wat er
     rechtgezet zou worden -- maar dat staat pas vast als iemand het erkent. */
  function meld({ codenaam, supplierCode, omschrijving, betaaldCenten, gezienCenten, ref, bewijs }) {
    const betaald = Math.round(Number(betaaldCenten) || 0);
    const gezien = Math.round(Number(gezienCenten) || 0);
    if (!codenaam) return { status: 400, error: 'Een melding hoort bij een lid.' };
    if (!supplierCode) return { status: 400, error: 'Bij welke zaak was dit?' };
    if (!(betaald > 0) || !(gezien >= 0))
      return { status: 400, error: 'Vul in wat u betaalde en wat u bij de zaak zelf zag.' };
    if (gezien >= betaald)
      return { status: 400, error: 'De prijs die u zag is niet lager dan wat u betaalde; er valt niets recht te zetten.' };

    const m = {
      id: 'prm_' + Math.random().toString(36).slice(2, 10) + '_' + rij().length,
      codenaam, supplierCode: String(supplierCode).toUpperCase(),
      omschrijving: String(omschrijving || '').slice(0, 200),
      betaaldCenten: betaald, gezienCenten: gezien, verschilCenten: betaald - gezien,
      ref: ref || null,
      bewijs: String(bewijs || '').slice(0, 500) || null,
      status: STATUS.GEMELD,
      at: tijd(), verloop: [{ naar: STATUS.GEMELD, at: tijd() }]
    };
    rij().unshift(m);
    if (rij().length > 5000) rij().length = 5000;
    save();
    return { status: 200, ok: true, melding: publiek(m) };
  }

  // de zaak erkent: prijs aangepast, verschil wordt rechtgezet
  function erken(id, door, nieuwePrijsCenten) {
    const m = vind(id);
    if (!m) return { status: 404, error: 'Deze melding bestaat niet.' };
    return zet(m, STATUS.ERKEND, { door: String(door || '').slice(0, 60) || null,
      nieuwePrijsCenten: Number.isFinite(nieuwePrijsCenten) ? Math.round(nieuwePrijsCenten) : null,
      erkendOp: tijd() });
  }

  function betwist(id, door, reden) {
    const m = vind(id);
    if (!m) return { status: 404, error: 'Deze melding bestaat niet.' };
    if (!reden) return { status: 400, error: 'Een betwisting hoort een reden te hebben; anders kan niemand er iets mee.' };
    return zet(m, STATUS.BETWIST, { door: String(door || '').slice(0, 60) || null,
      reden: String(reden).slice(0, 300) });
  }

  /* Rechtzetten. Het bedrag komt uit de MELDING en niet van de aanroeper: wie
     hier een bedrag mag meegeven, kan een verschil van 2 euro voor 200 euro
     rechtzetten. Dat het bedrag vastligt op het moment van melden, is de hele
     bescherming. */
  function zetRecht(id, ref) {
    const m = vind(id);
    if (!m) return { status: 404, error: 'Deze melding bestaat niet.' };
    return zet(m, STATUS.RECHTGEZET, { rechtgezetOp: tijd(),
      rechtgezetCenten: m.verschilCenten, verrekenRef: ref || null });
  }

  function wijsAf(id, door, reden) {
    const m = vind(id);
    if (!m) return { status: 404, error: 'Deze melding bestaat niet.' };
    if (!reden) return { status: 400, error: 'Een afwijzing hoort een reden te hebben; het lid krijgt hem te lezen.' };
    return zet(m, STATUS.AFGEWEZEN, { door: String(door || '').slice(0, 60) || null,
      reden: String(reden).slice(0, 300) });
  }

  function publiek(m) {
    return { id: m.id, codenaam: m.codenaam, supplierCode: m.supplierCode,
      omschrijving: m.omschrijving, betaald: m.betaaldCenten / 100, gezien: m.gezienCenten / 100,
      verschil: m.verschilCenten / 100, status: m.status, reden: m.reden || null,
      rechtgezet: m.rechtgezetCenten == null ? null : m.rechtgezetCenten / 100, at: m.at };
  }

  function lijst(filter) {
    filter = filter || {};
    return rij().filter(m => (!filter.codenaam || m.codenaam === filter.codenaam) &&
      (!filter.supplierCode || m.supplierCode === String(filter.supplierCode).toUpperCase()) &&
      (!filter.status || m.status === filter.status) &&
      (!filter.open || OPEN.has(m.status))).slice(0, 200).map(publiek);
  }

  function stand(supplierCode) {
    const alle = rij().filter(m => !supplierCode || m.supplierCode === String(supplierCode).toUpperCase());
    const open = alle.filter(m => OPEN.has(m.status));
    return { aantal: alle.length, open: open.length,
      openCenten: open.reduce((s, m) => s + m.verschilCenten, 0),
      rechtgezetCenten: alle.filter(m => m.status === STATUS.RECHTGEZET)
        .reduce((s, m) => s + (m.rechtgezetCenten || 0), 0) };
  }

  return { STATUS, meld, erken, betwist, zetRecht, wijsAf, lijst, stand, vind, publiek, magOvergaan };
}

module.exports = { maakPrijsmeldingen, STATUS, OVERGANG, OPEN, magOvergaan };
