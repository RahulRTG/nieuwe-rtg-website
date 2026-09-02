/* EENMALIGE VERHUIZING: isolatiestanden die aan een SESSIE hingen toen die
   sleutel nog de identiteitsleutel was.

   Afgesplitst uit ./deel1-basis.js toen dat door de 10 KB van keuringsregel 13
   ging. De naad is echt: dat bestand zet standaarden en seed-data neer, dit is
   een migratie met een eigen reden en een eigen levensduur.

   WAT ER MIS WAS. De drager `sessie` viel stil terug op `req.session.key`, dus
   een rij db.data.isolatie.sessie['user-7'] raakte ELKE sessie van dat lid --
   twee lagen die in werkelijkheid dezelfde stand zetten. Sinds de sleutel de
   sha256 van het bearer-token is (kern/isolatie/sessiedragers.js), past die rij
   op geen enkele sessie meer.

   WAAROM DIT NIET MAG WORDEN OVERGESLAGEN. Zonder deze verhuizing staat een lid
   dat zichzelf had dichtgezet na een versiewissel zonder ceremonie weer op
   normaal. Dat is precies wat SEC-LOCK-001 verbiedt, en test/seclock.test.js
   vangt het NIET: die toetst de route en de bron, niet de opslag over een
   versiegrens heen.

   DE STAND VERHUIST NAAR DE IDENTITEIT, en niet zomaar: hij wordt samengevoegd
   met wat daar al stond volgens de join uit ./ordening.js -- de STRENGSTE van de
   twee wint. De andere kant op zou een verzwakking zijn, en een verzwakking is
   nooit een migratiedetail.

   EEN SLEUTEL DIE GEEN 64-HEX IS, WORDT BEHANDELD ALS EEN IDENTITEITSLEUTEL --
   en dat is een behandeling met een reden, geen vaststelling. De cockpit
   (routes/techniek/isolatie.js) laat het kantoor een VRIJ getypte sleutel op de
   drager `sessie` zetten; zo'n rij is geen identiteitsleutel en verhuist hier
   toch mee. Dat is aanvaard omdat de verhuizing fail-safe is: de join kan de
   stand alleen gelijk houden of VERSTRENGEN, nooit verzwakken. Een rij die op de
   verkeerde plek belandt kost dus hooguit een te strenge stand voor een sleutel
   die toch nergens meer op paste -- en die is met de gewone ceremonie te
   ontsluiten. Andersom (laten staan) zou de stand stil verdwijnen. */
'use strict';

const ordening = require('../isolatie/ordening');

/* De naam van de strengste van twee standen. `strengste()` geeft een PAAR terug
   (trede plus de eigenschap `beschermd`) en geen naam, want dat paar is de
   waarheid -- maar de opslag bewaart een naam. Deze vertaling hoort dus hier en
   niet in de ordening: die mag niet gaan raden welke naam bij een paar hoort. */
function strengsteNaam(a, b) {
  const stap = ordening.verlaagt(a, b);
  /* `verlaagt(a, b)` zegt of de overgang van a naar b een VERLAGING is. Is dat
     zo, dan is a de strengste. Is de overgang niet te ordenen, dan telt hij ook
     als verlaging (ordening.js), en dan houden we a aan -- de kant waarvan we
     zeker weten dat hij niet zwakker is dan wat er stond. */
  return stap.verlaagt ? String(a) : String(b);
}

module.exports = function migreerIsolatieSleutels({ db, save }) {
  const isoTak = db.data.isolatie;
  if (isoTak && isoTak.sessie && typeof isoTak.sessie === 'object') {
    let verhuisd = 0;
    for (const [sleutel, rij] of Object.entries(isoTak.sessie)) {
      if (/^[a-f0-9]{64}$/.test(sleutel)) continue;      // al een echte sessiesleutel
      if (!isoTak.identiteit || typeof isoTak.identiteit !== 'object') isoTak.identiteit = {};
      const staand = isoTak.identiteit[sleutel];
      const samen = strengsteNaam((rij && rij.stand) || 'normaal',
        (staand && staand.stand) || 'normaal');
      isoTak.identiteit[sleutel] = {
        stand: samen,
        sinds: (rij && rij.sinds) || new Date().toISOString(),
        door: (rij && rij.door) || 'migratie',
        reden: 'verplaatst van de drager `sessie`: deze sleutel is geen sessiesleutel (geen 64-hex) ' +
          'en wordt daarom behandeld als de identiteitsleutel die hij tot deze versie was. Kwam hij ' +
          'met de hand uit de cockpit, dan is dit een te strenge plaatsing en geen verlies -- de ' +
          'join verstrengt alleen'
      };
      delete isoTak.sessie[sleutel];
      verhuisd++;
    }
    if (verhuisd) {
      if (!Array.isArray(isoTak.spoor)) isoTak.spoor = [];
      isoTak.spoor.unshift({ at: new Date().toISOString(), richting: 'verplaatst',
        drager: 'sessie', aantal: verhuisd, door: 'migratie',
        reden: 'de sessiesleutel is een echte sessiesleutel geworden; de oude standen zijn naar ' +
          'de identiteit verhuisd met de STRENGSTE van de twee standen' });
      save();
    }
  }
};
