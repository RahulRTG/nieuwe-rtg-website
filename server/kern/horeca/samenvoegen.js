/* Horeca (kern): SAMENVOEGEN -- wat een toestel zonder lijn heeft gedaan, en
   wat daarvan nog waar is.

   WAAROM DIT IETS ANDERS IS DAN EEN WACHTRIJ. De kassa en de PDA sturen een
   PAKKET opnieuw: een bon, een opgenomen bestelling. Dat werkt omdat zo'n
   pakket iets NIEUWS is -- het bestond nog niet, dus het kan niet botsen.

   De zaal en de bar doen iets anders. Daar wordt niet opgenomen maar BEWERKT:
   een gang vrijgeven, een glas op klaar zetten. En dan is opnieuw versturen
   gevaarlijk, want tussen het moment van de handeling en het moment van
   aankomen kan een collega hetzelfde bord al verder hebben gezet. Een pakket
   dat blind wordt afgespeeld, zet dat dan TERUG.

   DUS IS DE REGEL NIET "HERHAAL" MAAR "VOEG SAMEN", en er is precies één regel
   die dat veilig maakt:

     EEN STAND GAAT NOOIT ACHTERUIT.

   De standen vormen een ketting -- besteld, gestart, bereid, klaar, uitgegeven
   -- en die loopt maar één kant op. Een bord dat is uitgeserveerd kan niet weer
   "klaar" worden. Komt een offline-handeling binnen die terug zou zetten, dan
   gebeurt er niets EN dat wordt gemeld: het toestel hoort te weten dat zijn
   plaatselijke werkelijkheid het heeft verloren. Stil laten vallen zou
   betekenen dat een medewerker denkt iets te hebben gedaan wat nooit is
   gebeurd -- precies de fout waarvoor een offline-laag bestaat.

   WAT ER MET OPZET NIET IN ZIT:

   - GELD. Korting, fooi, splitsen en betalen gaan niet offline. Niet omdat het
     moeilijk is, maar omdat een tweede weg waarlangs geld beweegt een besluit
     is en geen bijvangst (LAT-regel 4, en dezelfde afweging als bij Rahul).
   - EEN REGEL VAN DE REKENING HALEN. Dat mag alleen zolang de keuken er niet
     aan begonnen is, en juist dat is wat een offline toestel NIET kan weten.
     Zijn beeld is per definitie oud.
   - HET TIJDSTIP ALS WAARHEID. Wanneer iets is gebeurd volgens het toestel
     reist mee als `offlineVanaf` en staat op de handeling, maar bepaalt niets.
     De stempels blijven van de server. */
'use strict';

const KETTING = ['besteld', 'gestart', 'bereid', 'klaar', 'uitgegeven'];
const SOORTEN = ['stand', 'gangvrij'];
const MAX = 200;

// hoe ver een stand in de ketting staat; onbekend telt als het begin
const trap = (stand) => {
  const i = KETTING.indexOf(String(stand || ''));
  return i < 0 ? 0 : i;
};

function doos(h) {
  if (!h.offlineHandelingen || typeof h.offlineHandelingen !== 'object') h.offlineHandelingen = {};
  return h.offlineHandelingen;
}

module.exports = ({ horeca, schoon }) => {
  const { nu } = horeca;
  const { zetStand } = require('./keukenlaag');

  function regelVan(h, rekeningId, regelId) {
    const rek = h.rekeningen[String(rekeningId || '')];
    if (!rek) return { fout: 'Deze rekening kennen we niet.' };
    const regel = (rek.regels || []).find((x) => x.id === String(regelId || ''));
    if (!regel) return { fout: 'Die regel staat niet op deze rekening.' };
    return { rek, regel };
  }

  /* EEN handeling samenvoegen. Geeft altijd een uitkomst terug -- gedaan,
     al-gedaan, of geweigerd MET de reden. Nooit stil niets. */
  function voegSamen(h, hand, wie) {
    const soort = String((hand || {}).soort || '');
    if (!SOORTEN.includes(soort)) {
      return { stand: 'geweigerd', reden: 'Deze handeling kan niet offline: ' + (soort || 'zonder soort') + '.' };
    }
    const nuIso = nu();

    if (soort === 'stand') {
      const naar = String(hand.naar || '');
      if (!KETTING.includes(naar)) return { stand: 'geweigerd', reden: 'Onbekende stand: ' + naar + '.' };
      const v = regelVan(h, hand.rekeningId, hand.regelId);
      if (v.fout) return { stand: 'geweigerd', reden: v.fout };
      if (!v.regel.vrijAt) {
        return { stand: 'geweigerd',
          reden: 'Deze regel is niet vrijgegeven; de keuken hoort er niet aan te beginnen.' };
      }
      const was = v.regel.stand;
      if (trap(naar) === trap(was)) return { stand: 'al-gedaan', was: was, reden: 'Stond hier al op.' };
      if (trap(naar) < trap(was)) {
        /* DE ENIGE REGEL DIE DIT VEILIG MAAKT. Een collega was sneller, of het
           bord is intussen uitgeserveerd. Het toestel hoort dat te horen. */
        return { stand: 'geweigerd', was: was,
          reden: 'Staat inmiddels op "' + was + '"; een stand gaat nooit achteruit.' };
      }
      zetStand(v.regel, naar, nuIso);
      v.regel.offlineVanaf = schoon(hand.offlineVanaf, 30) || null;
      return { stand: 'gedaan', was: was, naar: naar };
    }

    // gangvrij: idempotent, want wat al vrij is blijft vrij
    const rek = h.rekeningen[String(hand.rekeningId || '')];
    if (!rek) return { stand: 'geweigerd', reden: 'Deze rekening kennen we niet.' };
    const gang = Math.max(0, Math.min(9, parseInt(hand.gang, 10) || 0));
    const dicht = (rek.regels || []).filter((x) => x.gang === gang && !x.vrijAt);
    if (!dicht.length) return { stand: 'al-gedaan', reden: 'Er stond niets meer open in gang ' + gang + '.' };
    for (const x of dicht) {
      x.vrijAt = nuIso;
      x.serveerOm = schoon(hand.serveerOm, 5) || null;
      x.offlineVanaf = schoon(hand.offlineVanaf, 30) || null;
    }
    return { stand: 'gedaan', vrijgegeven: dicht.length };
  }

  /* Een pakket handelingen. `clientId` per handeling is de sleutel tegen
     dubbel uitvoeren -- dezelfde vorm als offline/sync voor de bonnen. De
     uitkomst van een eerder verwerkte handeling wordt TERUGGEGEVEN en niet
     opnieuw uitgevoerd: het toestel hoort te zien wat er is gebeurd. */
  function verwerk(h, lijst, wie) {
    const eerder = doos(h);
    const uit = [];
    for (const hand of (Array.isArray(lijst) ? lijst : []).slice(0, MAX)) {
      const clientId = schoon(hand && hand.clientId, 60);
      if (!clientId) { uit.push({ clientId: null, stand: 'geweigerd', reden: 'Zonder clientId.' }); continue; }
      if (Object.prototype.hasOwnProperty.call(eerder, clientId)) {
        uit.push(Object.assign({ clientId }, eerder[clientId], { herhaald: true }));
        continue;
      }
      const r = voegSamen(h, hand, wie);
      eerder[clientId] = Object.assign({ at: nu(), door: wie, soort: hand.soort }, r);
      /* De ring begrensd houden, net als bij de idem-boeken elders: de oudste
         sleutel wijkt. Zonder grens groeit dit met elke haperende avond. */
      const sleutels = Object.keys(eerder);
      if (sleutels.length > 2000) delete eerder[sleutels[0]];
      uit.push(Object.assign({ clientId }, r));
    }
    return {
      uitkomsten: uit,
      gedaan: uit.filter((x) => x.stand === 'gedaan').length,
      alGedaan: uit.filter((x) => x.stand === 'al-gedaan').length,
      geweigerd: uit.filter((x) => x.stand === 'geweigerd').length
    };
  }

  return { verwerk, voegSamen, KETTING, SOORTEN };
};
