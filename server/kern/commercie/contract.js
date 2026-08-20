/* HET CONTRACT: wat is afgesproken, en tot wanneer staat dat vast.

   HET GAT DAT DIT SLUIT. kern/aanmeldingen/betaalschema.js zette bij een akkoord
   twaalf termijnen klaar en hield daarna op. Er was geen maand 13: geen
   verlenging, geen opzegging, geen opzegtermijn. Een lidmaatschap liep dus
   administratief af zonder dat iemand het besloot -- en niemand kon zien of dat
   het einde was of een vergeten regel.

   En er was een tweede, stillere: `test/pasprijs.test.js` toets 6 bewaakt dat
   een prijswijziging in de boardroom OVERAL doorkomt, ook op de factuur van een
   lid met een jaarcontract. Die toets bewaakt iets echts -- drie uiteengelopen
   kopieen van de pasprijs -- maar hij bewaakte tegelijk gedrag dat bij een
   twaalfmaands verbintenis niet hoort.

   DE OPLOSSING IS NIET "GENEREER MEER TERMIJNEN". Dat verplaatst het probleem
   naar maand 25. De billing engine stelt per periode een vraag:

       Is er op deze datum een geldige betalingsverplichting?

   en maakt dan pas een termijn. Maand 13 bestaat vanzelf als het contract
   verlengd is, en bestaat NIET als het is opgezegd. Dat is het verschil tussen
   een lijst die iemand ooit heeft aangemaakt en een afspraak die geldt.

   DE ACHT STANDEN (Engelse namen erbij; de code van dit huis is Nederlands):

     CONCEPT       draft          wordt opgesteld
     AANGEBODEN    offered        ligt bij de klant
     GEACCEPTEERD  accepted       getekend, nog niet begonnen
     ACTIEF        active         loopt
     VERLENGBAAR   renewal_due    de minimumtermijn loopt af; er moet iets gebeuren
     VERLENGD      renewed        verlengd -> gaat terug naar ACTIEF met een nieuwe termijn
     OPZEGGEND     terminating    opgezegd, loopt uit tot de einddatum
     GEEINDIGD     ended          klaar; geen verplichtingen meer

   DE PRIJS IS EEN MOMENTOPNAME. `afgesprokenCenten` wordt bij het tekenen
   vastgelegd en daarna nooit meer uit de prijslijst gehaald. Dat is de regel
   waar dit hele bestand om draait: voor een bestaand contract wordt de actuele
   catalogusprijs NOOIT opnieuw opgehaald. Zou dat wel gebeuren, dan verandert
   met een boardroom-klik het bedrag op de factuur van iemand die iets anders
   heeft getekend.

   `prijsVastTot` is de datum waarop die momentopname mag worden herzien: het
   einde van de minimumtermijn. Besluit van 20 augustus 2026 (COMMERCIE.md 3b):
   een prijswijziging raakt nooit een lopend contract.

   WAT DIT NIET IS: een tweede administratie van wat er betaald is. Dit bestand
   zegt wat er VERSCHULDIGD is en wanneer; of het geld er is, weet het grootboek.
   Dezelfde scheiding als bij ./fee.js. */
'use strict';

/* Tijd komt uit de tijdmachine en niet van het besturingssysteem: alleen zo is
   "wat gebeurt er op 29 februari" een vraag die je kunt stellen (server/lib/klok.js).
   De injecteerbare `nu` blijft bestaan -- toetsen zetten hem -- maar de TERUGVAL
   is de klok en niet Date.now(). */
const klok = require('../../lib/klok');

const STATUS = {
  CONCEPT: 'CONCEPT', AANGEBODEN: 'AANGEBODEN', GEACCEPTEERD: 'GEACCEPTEERD',
  ACTIEF: 'ACTIEF', VERLENGBAAR: 'VERLENGBAAR', VERLENGD: 'VERLENGD',
  OPZEGGEND: 'OPZEGGEND', GEEINDIGD: 'GEEINDIGD'
};

/* Een overgang die hier niet staat is een programmeerfout en wordt geweigerd.
   VERLENGD is met opzet een doorgangsstand en geen eindstand: verlengen zet het
   contract terug op ACTIEF met een nieuwe periode, en dat blijft zichtbaar in
   het verloop. */
const OVERGANG = {
  [STATUS.CONCEPT]: [STATUS.AANGEBODEN, STATUS.GEEINDIGD],
  [STATUS.AANGEBODEN]: [STATUS.GEACCEPTEERD, STATUS.GEEINDIGD],
  [STATUS.GEACCEPTEERD]: [STATUS.ACTIEF, STATUS.GEEINDIGD],
  [STATUS.ACTIEF]: [STATUS.VERLENGBAAR, STATUS.OPZEGGEND, STATUS.GEEINDIGD],
  [STATUS.VERLENGBAAR]: [STATUS.VERLENGD, STATUS.OPZEGGEND, STATUS.GEEINDIGD],
  [STATUS.VERLENGD]: [STATUS.ACTIEF],
  [STATUS.OPZEGGEND]: [STATUS.GEEINDIGD],
  [STATUS.GEEINDIGD]: []
};

// standen waarin een contract verplichtingen kan voortbrengen
const LOPEND = new Set([STATUS.ACTIEF, STATUS.VERLENGBAAR, STATUS.OPZEGGEND]);

const VERLENGING = { STILZWIJGEND: 'stilzwijgend', OPZEGBAAR: 'opzegbaar', GEEN: 'geen' };

function magOvergaan(van, naar) {
  return Array.isArray(OVERGANG[van]) && OVERGANG[van].includes(naar);
}

/* Datumrekenen op maandbasis. Bewust met Date en niet met "30 dagen": een
   maandbijdrage die op de 31e begint, hoort in februari niet op de 3e maart te
   vallen. `plusMaanden` klemt op de laatste dag van de doelmaand. */
function plusMaanden(iso, n) {
  const d = new Date(iso);
  const dag = d.getUTCDate();
  const doel = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate();
  doel.setUTCDate(Math.min(dag, laatste));
  doel.setUTCHours(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return doel.toISOString();
}
const perMaand = f => (f === 'jaar' ? 12 : f === 'kwartaal' ? 3 : 1);

/* Het contract zelf. `afgesprokenCenten` mag null zijn zolang er nog niets is
   getekend (CONCEPT), maar niet meer zodra het ACTIEF wordt -- dat wordt
   hieronder afgedwongen. */
/* GEEN NAAM IN EEN CONTRACT. Hier stond `naam`, overgenomen uit de aanmelding, en
   dat brak het recht op vergetelheid: verwijderde een lid zijn gegevens, dan
   bleef zijn naam in de contractentabel staan (test/vergeten-gezelschap.test.js
   vond het). Operationele data van dit huis draait op codenamen -- de echte naam
   staat in de identiteitskluis, en een tweede kopie ergens anders maakt die
   scheiding waardeloos.

   Een contract heeft die naam ook niet nodig: `aanmeldingId` wijst naar het
   dossier waar hij hoort, en die laag kent de vergeetregels al. Wie een naam op
   een scherm wil, haalt hem daar op -- en krijgt hem dus niet meer als het lid
   is vergeten. Dat is precies de bedoeling. */
function maakContract({ id, pas, aanmeldingId, startAt, afgesprokenCenten,
  minimumMaanden = 12, frequentie = 'maand', verlenging = VERLENGING.OPZEGBAAR,
  opzegMaanden = 1, btwProfiel = 'nl-21', serviceNiveau = null, door = null, nu }) {
  const at = nu ? nu() : klok.nu();
  const start = startAt || new Date(at).toISOString();
  return {
    id, pas, aanmeldingId: aanmeldingId || null,
    status: STATUS.CONCEPT,
    startAt: start,
    minimumMaanden: Math.max(1, Math.round(minimumMaanden)),
    frequentie,
    verlenging,
    opzegMaanden: Math.max(0, Math.round(opzegMaanden)),
    /* DE MOMENTOPNAME. Nooit opnieuw uit de catalogus halen. */
    afgesprokenCenten: Number.isFinite(afgesprokenCenten) ? Math.round(afgesprokenCenten) : null,
    prijsVastTot: plusMaanden(start, Math.max(1, Math.round(minimumMaanden))),
    indexatie: null,
    btwProfiel,
    serviceNiveau,
    eindigtOp: null,
    periode: 1,
    door,
    at,
    verloop: [{ naar: STATUS.CONCEPT, at }]
  };
}

function maakContracten({ db, save, nu }) {
  const tijd = nu || klok.nu;
  function rij() {
    if (!db.data) db.data = {};
    if (!Array.isArray(db.data.contracten)) db.data.contracten = [];
    return db.data.contracten;
  }
  const vind = id => rij().find(c => c.id === String(id || '')) || null;

  function zet(c, naar, velden) {
    if (!magOvergaan(c.status, naar))
      return { error: 'Een contract kan niet van ' + c.status + ' naar ' + naar + '.' };
    c.status = naar;
    Object.assign(c, velden || {});
    (c.verloop = c.verloop || []).push({ naar, at: tijd() });
    save();
    return { ok: true, contract: c };
  }

  function open(gegevens) {
    const id = 'ctr_' + Math.random().toString(36).slice(2, 10) + '_' + rij().length;
    const c = maakContract({ ...gegevens, id, nu: tijd });
    rij().unshift(c);
    save();
    return c;
  }

  function bied(c) { return c ? zet(c, STATUS.AANGEBODEN) : { error: 'geen contract' }; }
  function accepteer(c, centen) {
    if (!c) return { error: 'geen contract' };
    const bedrag = Number.isFinite(centen) ? Math.round(centen) : c.afgesprokenCenten;
    if (!Number.isFinite(bedrag))
      return { error: 'Een contract zonder afgesproken bedrag kan niet worden geaccepteerd.' };
    return zet(c, STATUS.GEACCEPTEERD, { afgesprokenCenten: bedrag });
  }

  /* ACTIEF worden vraagt een bedrag. Dat is de grendel die voorkomt dat er ooit
     nog een lidmaatschap loopt waarvan niemand weet wat het kost -- het gat dat
     bij Business en Lifestyle bestond voordat de ladder er was. */
  function activeer(c) {
    if (!c) return { error: 'geen contract' };
    if (!Number.isFinite(c.afgesprokenCenten))
      return { error: 'Een contract zonder afgesproken bedrag kan niet actief worden.' };
    return zet(c, STATUS.ACTIEF);
  }

  // de minimumtermijn loopt af: er moet iets gebeuren (verlengen of opzeggen)
  function verlengbaar(c) { return c ? zet(c, STATUS.VERLENGBAAR) : { error: 'geen contract' }; }

  /* Verlengen. De nieuwe prijs mag hier gezet worden -- dit is het ENIGE moment
     waarop de afgesproken prijs mag veranderen, en daarom schuift `prijsVastTot`
     mee. Geen bedrag meegeven betekent: ongewijzigd voortzetten. */
  function verleng(c, nieuwCenten) {
    if (!c) return { error: 'geen contract' };
    if (c.verlenging === VERLENGING.GEEN)
      return { error: 'Dit contract verlengt niet; het eindigt op de afgesproken datum.' };
    /* Vroeg verlengen mag. Een contract dat nog ACTIEF is, gaat dan eerst langs
       VERLENGBAAR -- niet omdat dat administratief moet, maar omdat het verloop
       anders een sprong bevat die de statusmachine verbiedt. Zo blijft
       ACTIEF -> VERLENGBAAR -> VERLENGD -> ACTIEF de enige route, of de
       verlenging nu op tijd komt of eerder. */
    if (c.status === STATUS.ACTIEF) {
      const r0 = zet(c, STATUS.VERLENGBAAR);
      if (r0.error) return r0;
    }
    const r = zet(c, STATUS.VERLENGD, {
      afgesprokenCenten: Number.isFinite(nieuwCenten) ? Math.round(nieuwCenten) : c.afgesprokenCenten,
      periode: (c.periode || 1) + 1,
      prijsVastTot: plusMaanden(c.prijsVastTot, c.minimumMaanden)
    });
    if (r.error) return r;
    return zet(c, STATUS.ACTIEF);
  }

  /* Opzeggen. De einddatum wordt UITGEREKEND en niet ingevoerd: opzegtermijn
     vanaf nu, maar nooit voor het einde van de minimumtermijn -- anders zou
     opzeggen in maand twee de verbintenis van twaalf maanden opheffen. */
  function zegOp(c, opDatum) {
    if (!c) return { error: 'geen contract' };
    const vanaf = opDatum || new Date(tijd()).toISOString();
    const naOpzeg = plusMaanden(vanaf, c.opzegMaanden);
    const minEind = plusMaanden(c.startAt, c.minimumMaanden);
    const eind = new Date(naOpzeg) > new Date(minEind) ? naOpzeg : minEind;
    return zet(c, STATUS.OPZEGGEND, { eindigtOp: eind });
  }

  function beeindig(c) { return c ? zet(c, STATUS.GEEINDIGD, { eindigtOp: c.eindigtOp || new Date(tijd()).toISOString() }) : { error: 'geen contract' }; }

  /* ---------- de billing engine ----------
     De vraag die per periode gesteld wordt. Geeft de verplichting terug, of null
     met de reden erbij -- "er is niets" en "we weten het niet" zijn niet
     hetzelfde. */
  function verplichtingOp(c, datumIso) {
    if (!c) return { verschuldigd: false, reden: 'geen contract' };
    if (!LOPEND.has(c.status)) return { verschuldigd: false, reden: 'contract staat op ' + c.status };
    if (!Number.isFinite(c.afgesprokenCenten)) return { verschuldigd: false, reden: 'geen afgesproken bedrag' };
    const d = new Date(datumIso);
    if (d < new Date(c.startAt)) return { verschuldigd: false, reden: 'voor de startdatum' };
    if (c.eindigtOp && d >= new Date(c.eindigtOp)) return { verschuldigd: false, reden: 'na de einddatum' };

    /* DE GRENS VAN DE VERBINTENIS. Zonder deze regel zegt de billing engine ook
       ja tegen maand 13 van een contract dat nooit is verlengd -- en dan is dit
       bestand alsnog "genereer oneindig veel termijnen", alleen met meer stappen
       ertussen. Precies het probleem dat het moest oplossen.

       Bij STILZWIJGENDE verlenging loopt het door zonder dat iemand iets doet;
       dat is de betekenis van stilzwijgend. Bij OPZEGBAAR moet er een besluit
       zijn (verleng()), en dat besluit verhoogt `periode`, waardoor
       eindeVerbintenis vanzelf opschuift. */
    if (c.verlenging !== VERLENGING.STILZWIJGEND && d >= new Date(eindeVerbintenis(c)))
      return { verschuldigd: false, reden: 'na het einde van de verbintenis; nog niet verlengd' };

    // valt deze datum op een termijngrens?
    const stap = perMaand(c.frequentie);
    let n = 0, wanneer = c.startAt;
    while (new Date(wanneer) < d) { n += stap; wanneer = plusMaanden(c.startAt, n); }
    if (new Date(wanneer).getTime() !== d.getTime())
      return { verschuldigd: false, reden: 'geen termijndatum' };

    return { verschuldigd: true, centen: c.afgesprokenCenten * stap,
      maandCenten: c.afgesprokenCenten, termijn: n / stap + 1, vervalt: wanneer };
  }

  /* De termijnen tussen twee datums. Dit is wat het betaalschema gebruikt in
     plaats van "maak er twaalf". Loopt het contract door, dan komen er vanzelf
     meer; is het opgezegd, dan houdt het op de einddatum op. */
  function termijnenTussen(c, vanIso, totIso) {
    const uit = [];
    if (!c || !Number.isFinite(c.afgesprokenCenten)) return uit;
    const stap = perMaand(c.frequentie);
    const grens = new Date(totIso);
    for (let n = 0, i = 1; i <= 600; n += stap, i++) {
      const wanneer = plusMaanden(c.startAt, n);
      const d = new Date(wanneer);
      /* `>=` en niet `>`: de einddatum van een verbintenis is de eerste dag NA
         de termijn (start + 12 maanden is het begin van maand 13). Met `>` komt
         die dag er als dertiende termijn bij -- en dan telt een jaarcontract
         dertien maanden. */
      if (d >= grens) break;
      if (vanIso && d < new Date(vanIso)) continue;
      if (c.eindigtOp && d >= new Date(c.eindigtOp)) break;
      uit.push({ termijn: i, vervalt: wanneer, centen: c.afgesprokenCenten * stap, periode: c.periode });
    }
    return uit;
  }

  /* Het einde van de huidige verbintenis: startdatum plus minimumtermijn maal
     het aantal doorlopen periodes. */
  function eindeVerbintenis(c) {
    return c ? plusMaanden(c.startAt, c.minimumMaanden * (c.periode || 1)) : null;
  }

  /* Loopt de minimumtermijn af binnen `dagen`? Dit is wat een ronde zou vragen
     om VERLENGBAAR te zetten. De ronde zelf bestaat nog niet; de vraag wel. */
  function verlooptBinnen(dagen, nuIso) {
    const nuT = new Date(nuIso || new Date(tijd()).toISOString()).getTime();
    const grens = nuT + Math.max(0, dagen) * 86400000;
    return rij().filter(c => c.status === STATUS.ACTIEF)
      .filter(c => { const e = new Date(eindeVerbintenis(c)).getTime(); return e >= nuT && e <= grens; });
  }

  function publiek(c) {
    if (!c) return null;
    return { id: c.id, pas: c.pas, aanmeldingId: c.aanmeldingId, status: c.status, periode: c.periode,
      startAt: c.startAt, minimumMaanden: c.minimumMaanden, frequentie: c.frequentie,
      verlenging: c.verlenging, opzegMaanden: c.opzegMaanden,
      maandCenten: c.afgesprokenCenten, prijsVastTot: c.prijsVastTot,
      eindeVerbintenis: eindeVerbintenis(c), eindigtOp: c.eindigtOp, btwProfiel: c.btwProfiel };
  }

  function lijst(filter) {
    filter = filter || {};
    return rij().filter(c => (!filter.pas || c.pas === filter.pas) &&
      (!filter.status || c.status === filter.status) &&
      (!filter.aanmeldingId || c.aanmeldingId === filter.aanmeldingId)).slice(0, 200).map(publiek);
  }

  return { STATUS, VERLENGING, LOPEND, open, vind, bied, accepteer, activeer, verlengbaar,
    verleng, zegOp, beeindig, verplichtingOp, termijnenTussen, eindeVerbintenis,
    verlooptBinnen, publiek, lijst, rij };
}

module.exports = { maakContracten, maakContract, STATUS, VERLENGING, OVERGANG, LOPEND, magOvergaan, plusMaanden };
