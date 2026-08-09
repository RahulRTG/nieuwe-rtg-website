/* ZAAK COMMAND -- dezelfde logica als RTG Command, maar dan van één zaak, en
   uitsluitend over die zaak.

   WAT DE ZAAK KRIJGT: de puls van zijn eigen bedrijf, een zoekbalk over zijn
   eigen objecten, een dossier per object met tijdlijn en samenhang, herstel dat
   alleen administratieve drift rechtzet, een uitzonderingenrij voor wat een
   mens moet beslissen, een operator die in gewone taal antwoordt, een eigen
   beleidsregister, een eigen onveranderlijk journaal en de meter die zegt
   hoeveel handwerk er nog in zit.

   WAT DE ZAAK NIET KRIJGT, en dat is de kern van deze module: niets van RTG.
   Geen platformcijfers, geen andere zaken, geen leden buiten de eigen
   bestellingen, geen RTG-beleid, geen RTG-journaal, geen RTG-runbooks. Dat is
   niet afgeschermd met filters maar met bouw: het register (./register.js) kent
   alleen de soorten van deze zaak, en elke motor krijgt DAT register mee. Er is
   geen aanroep die iets anders kan opleveren.

   DRIE DINGEN PER ZAAK EN NIET GEDEELD:
     - het journaal, met zijn eigen hashketen (anders zag zaak A de regels van B);
     - het beleidsregister, want een restaurant en een jachthaven vinden niet
       hetzelfde "te lang";
     - de uitzonderingenrij en de herstelrondes.
   Ze wonen in db.data.zaakCommand[code] en gebruiken dezelfde modules als RTG:
   één implementatie, per eigenaar één vak. */
'use strict';

/* De startregels van een zaak. Bewust een korte lijst: dit zijn de knoppen waar
   een ondernemer iets aan heeft, niet de volledige platformset. De grenzen voor
   risico staan er wel bij, want zonder die twee heeft "hand/assist/auto" hier
   geen betekenis. */
const ZAAK_BELEID = [
  { id: 'risico.autoGrens', wat: 'Onder deze risicoscore mag de assistent zelfstandig iets rechtzetten', waarde: 30, eenheid: 'score', vierOgen: false },
  { id: 'risico.mensGrens', wat: 'Boven deze risicoscore beslist altijd een mens', waarde: 70, eenheid: 'score', vierOgen: false },
  { id: 'risico.geldGrensCenten', wat: 'Boven dit bedrag krijgt elke handeling extra controle', waarde: 50000, eenheid: 'centen', vierOgen: false },
  { id: 'herstel.autoAan', wat: 'Mag de assistent administratieve drift zelf rechtzetten', waarde: true, eenheid: 'aan/uit', vierOgen: false },
  { id: 'herstel.maxPerRonde', wat: 'Hoeveel gevallen één herstelronde mag aanraken', waarde: 25, eenheid: 'stuks', vierOgen: false },
  { id: 'zaak.termijnUren', wat: 'Binnen hoeveel uur een uitzondering een eigenaar en besluit hoort te hebben', waarde: 24, eenheid: 'uur', vierOgen: false },
  { id: 'zaak.reactieMinuten', wat: 'Na hoeveel minuten een onaangeroerde bestelling of rit een signaal wordt', waarde: 10, eenheid: 'minuten', vierOgen: false },
  { id: 'zaak.boekingMinuten', wat: 'Na hoeveel minuten een onbevestigde boeking een signaal wordt', waarde: 30, eenheid: 'minuten', vierOgen: false }
];

function maakZaakCommand({ db, save, crypto, anthropic, findSupplier, commGast }) {
  /* Het vak van deze zaak. Alles wat de motoren opslaan komt hierin terecht;
     er is geen sleutel die buiten de zaak wijst. */
  function vakVan(code) {
    if (!db.data.zaakCommand) db.data.zaakCommand = {};
    if (!db.data.zaakCommand[code]) db.data.zaakCommand[code] = {};
    return db.data.zaakCommand[code];
  }

  /* Eén laag per zaak, gebouwd op aanvraag en niet bewaard: de zaak-objecten
     veranderen onder je handen, en een gecachete laag zou een verouderd
     register vasthouden. De kosten zijn een handvol closures per verzoek. */
  /* `opties.leiding` is de tweede as van de scope: van welke ZAAK, en met welke
     ROL. Hij staat standaard op false -- wie hem vergeet ziet te weinig, en dat
     is de goede kant om fout te gaan. De aanroeper haalt hem uit req.actor en
     nooit uit de aanvraag. */
  function voor(zaak, opties) {
    const code = String(zaak && zaak.code ? zaak.code : zaak || '');
    if (!code) return null;
    const leiding = !!(opties && opties.leiding);
    const zaakVan = () => (findSupplier ? findSupplier(code) : (zaak && zaak.code ? zaak : null));
    const register = require('./register').maakZaakRegister(code, zaakVan, { leiding });
    const vak = () => vakVan(code);

    const journaal = require('../command/journaal').maakJournaal({ db, save, crypto, vak });
    const beleid = require('../command/beleid').maakBeleid({ db, save, crypto, journaal, vak, start: ZAAK_BELEID });
    const risico = require('../command/risico').maakRisico({ beleid });
    const zaken = require('../command/zaken').maakZaken({ db, save, crypto, journaal, beleid, vak });
    const catalogus = require('./runbooks');
    const runbooks = require('../command/runbooks').maakRunbooks({
      db, save, crypto, journaal, risico, beleid, register, catalogus, vak });
    const operator = require('../command/operator').maakOperator({
      db, save, crypto, journaal, risico, runbooks, zaken, beleid, anthropic, register, vak });
    const werkbesparing = require('../command/werkbesparing').maakWerkbesparing({ journaal, zaken, runbooks });
    const signalen = require('./signalen').maakSignalen({ db, beleid, commGast });
    /* Dezelfde twee lagen als aan de RTG-kant, maar op het register van DEZE
       zaak. Ze erven de scope daarmee volledig: de graaf loopt juist wél door
       en zou ongescoped het gevaarlijkste stuk zijn. */
    const kwaliteit = require('../command/kwaliteit').maakKwaliteit({ db, register });
    const graaf = require('../command/graaf').maakGraaf({ db, register, kwaliteit });
    const zoeklaag = require('../command/zoek');
    const objectlaag = require('../command/object');

    function actiesVoor(k, rij) {
      const uit = [];
      for (const rb of catalogus.RUNBOOKS) {
        if (rb.type !== k.type) continue;
        const past = rb.past(rij);
        const o = risico.beoordeel(rb.actie, { aantal: 1, klantImpact: rb.klantImpact,
          onomkeerbaar: !rb.terugDraaibaar, centen: k.bedrag || 0 });
        uit.push({ soort: 'runbook', id: rb.id, naam: rb.naam, wat: rb.wat, past,
          niveau: o.niveau, score: o.score, waarom: o.waarom, vierOgen: o.vierOgen,
          waaromNiet: past ? null : 'dit object voldoet nu niet aan de voorwaarde van dit recept' });
      }
      uit.push({ soort: 'zaak', id: 'zaak-openen', naam: 'Uitzondering openen',
        wat: 'Zet dit op de lijst, met een eigenaar en een termijn.', past: true,
        niveau: 'hand', score: risico.beoordeel('zaak toewijzen', {}).score,
        waarom: 'een uitzondering openen is altijd mensenwerk' });
      return uit;
    }

    /* De puls van de zaak. Bewust NIET kern/command/puls.js: die telt domeinen
       van het platform en spreekt over agents en rechtengrafen. Een ondernemer
       wil weten of er iets op hem wacht, of er iets recht te zetten valt, en of
       zijn journaal heel is. Drie regels, niet dertig. */
    function puls() {
      const z = zaakVan();
      const sig = z ? signalen.voor(z, { leiding: leiding }) : [];
      const rbs = runbooks.lijst();
      const zt = zaken.tellingen();
      const teHerstellen = rbs.reduce((n, r) => n + r.kandidaten, 0);
      const rood = sig.filter(x => x.niveau === 'rood').length;
      const stand = rood || zt.overTermijn ? 'let op' : (sig.length || zt.open || teHerstellen) ? 'aandacht' : 'in orde';
      const perSoort = register.SOORTEN.map(so => ({ type: so.type, label: so.label,
        meervoud: so.meervoud, domein: so.domein, aantal: register.rijen(db, so).length }));
      return {
        stand, at: new Date().toISOString(),
        zaak: z ? { code: z.code, naam: z.name, soort: z.type, plaats: z.city } : { code },
        signalen: sig, rood,
        herstel: { runbooks: rbs.length, kandidaten: teHerstellen, lijst: rbs,
          autoAan: beleid.waarde('herstel.autoAan', true) !== false },
        uitzonderingen: zt,
        objecten: perSoort,
        journaal: { regels: journaal.aantal(), venster: journaal.venster(), keten: journaal.controleer() },
        /* Wat dit beeld NIET weet, en dat hoort erbij: het kent alleen de
           soorten uit het zaakregister. Wat daar niet in staat, staat hier niet
           op groen -- het staat er niet. */
        dekking: { soorten: register.SOORTEN.length }
      };
    }

    /* Een signaal wordt een uitzondering: dat is de enige weg waarlangs iets
       wat een mens moet beslissen op een lijst met eigenaar en termijn komt. */
    function signaalOppakken(signaalId, door) {
      const z = zaakVan();
      const sig = (z ? signalen.voor(z, { leiding: leiding }) : []).find(x => x.id === String(signaalId));
      if (!sig) return { error: 'Dat signaal staat er niet (meer).', status: 404 };
      const bestaat = zaken.lijst({ max: 200 }).find(x => x.status !== zaken.KLAAR && x.bewijs && x.bewijs.signaal === sig.id);
      if (bestaat) return { zaak: bestaat, bestond: true };
      return { zaak: zaken.open({ titel: sig.nl, domein: sig.type, objectType: sig.objectId ? sig.type : null,
        objectId: sig.objectId, oorzaak: sig.oorzaak, bron: 'signaal', door, niveau: 'hand',
        reden: sig.beslissing, bewijs: { signaal: sig.id, niveau: sig.niveau, vraag: sig.beslissing } }) };
    }

    const zoek = (vraag, opties) => zoeklaag.zoek(register, db, vraag, opties);
    const bereik = () => zoeklaag.bereik(register);
    const dossier = (type, id) => objectlaag.dossier(register, db, type, id, { journaal, actiesVoor });

    function start() {
      return { puls: puls(), zaken: zaken.lijst({ status: 'open', max: 12 }),
        runbooks: runbooks.lijst(), werk: werkbesparing.bord(30),
        plannen: operator.recent(5), runs: runbooks.runs(6) };
    }

    return { code, leiding, register, kwaliteit, graaf, journaal, beleid, risico, zaken, runbooks, operator,
      werkbesparing, signalen, puls, signaalOppakken, zoek, bereik, dossier, actiesVoor, start };
  }

  return { voor, ZAAK_BELEID };
}

module.exports = { maakZaakCommand, ZAAK_BELEID };
