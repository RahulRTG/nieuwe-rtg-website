/* RTG Move (deelmodule): HET GEVOLG -- wat een verschuiving doet met de rest.

   De vlucht landt 65 minuten later. Een navigatie-app rekent dan een nieuwe
   route naar het hotel. De vraag die telt is een andere: welke afspraken verder
   in de reis houden dit niet, en wat valt daaraan te doen.

   HOE HET GEMETEN WORDT: met een IJKLIJN. De naden worden twee keer gerekend --
   een keer op de reis zoals hij gepland staat, een keer met de verschuiving
   erin -- en pas het VERSCHIL is het gevolg. Zonder die vergelijking is "deze
   overstap is krap" niet te onderscheiden van "deze overstap was altijd al
   krap", en dan meldt de laag een probleem dat er los van de vertraging ook
   was. Dezelfde vorm als `schoon` naast `met` in scripts/lib/ketenproef.js.

   WAT ER NIET MEE SCHUIFT, en dat is de kern van de rekensom: een restaurant
   dat om 19:00 gereserveerd staat, schuift niet mee met een vertraagde vlucht.
   Alleen het VERSTOORDE onderdeel verschuift; alle afspraken erna staan waar ze
   staan. Wie alles mee laat schuiven, krijgt een reis die altijd klopt en nooit
   waarschuwt.

   EN HET ZWAARSTE: DEZE MODULE VOERT NIETS UIT. Elk voorstel komt terug met
   `uitgevoerd: false` en het DOMEIN dat het moet doen -- dezelfde vorm als het
   teruggaveRECHT in kern/horeca/correctie.js en als kern/reisoplosser.js
   ("uitvoeren blijft bij het domein, bevestigen bij de mens", REIZEN.md par.
   4.5). Een transfer verzetten raakt een chauffeur, een reservering verzetten
   raakt een restaurant: beide bereiken een TWEEDE PERSOON, en dat wordt in dit
   huis nooit automatisch (LIFE.md par. 4). Move zegt wat er moet gebeuren en
   door wie; drukken doet een mens. */
'use strict';

const { haalbaar } = require('./haalbaar');
const { UITKOMST } = require('./naad');

/* Wat een naad-uitkomst betekent voor de reiziger, in EEN woord per stand. Een
   onbekende uitkomst krijgt met opzet geen woord: raden is hier het ergste. */
const ERGER_DAN = { [UITKOMST.RUIM]: 0, [UITKOMST.GEEN_BEWEGING]: 0, [UITKOMST.KRAP]: 1, [UITKOMST.ONHAALBAAR]: 2 };

/* Per soort onderdeel: wie het moet oplossen als de naad ervoor breekt. Staat
   een soort hier niet in, dan is er geen voorstel -- en dat is eerlijker dan
   een taak die bij niemand aankomt (de doodspoorregel uit DOODSPOOR.json). */
const WIE = {
  transfer: { domein: 'mobiliteit', wat: 'de opdracht opnieuw inplannen', app: '/apps/vervoer.html' },
  taxi: { domein: 'mobiliteit', wat: 'de opdracht opnieuw inplannen', app: '/apps/vervoer.html' },
  horeca: { domein: 'horeca', wat: 'de reservering verzetten', app: '/apps/reserveren.html' },
  verblijf: { domein: 'partner', wat: 'late aankomst doorgeven', app: '/apps/reizen.html' },
  /* `afspraak` en `activiteit` zijn de twee soorten die een ECHTE boeking bij
     een zaak oplevert (kern/reiswereld-bronnen.js), en `afspraak` ontbrak hier
     -- waarmee juist het meest voorkomende geval geen voorstel kreeg. Gevonden
     op een volle ronde met twee betaalde boekingen, niet op papier. */
  afspraak: { domein: 'partner', wat: 'de afspraak verzetten', app: '/apps/portaal.html' },
  activiteit: { domein: 'partner', wat: 'de tijd laten aanpassen', app: '/apps/reizen.html' }
};

/* Een verschuiving op EEN onderdeel, aangewezen op zijn kenmerk. De minuten
   komen van buiten (een vervoerder die het meldt, een lid dat het invult) en
   worden hier nooit geraden -- zelfde grens als kern/mobiliteit/storing.js:
   "de vertraging komt van de vervoerder, niet van ons". */
function gevolg({ onderdelen, kenmerk, minuten, reisTijd, afstandM }) {
  const rij = Array.isArray(onderdelen) ? onderdelen : [];
  const min = Number(minuten);
  if (!kenmerk || !Number.isFinite(min) || min === 0) {
    return { status: 400, error: 'Een verschuiving vraagt een onderdeel en een aantal minuten.' };
  }
  const idx = rij.findIndex(o => o && o.kenmerk === kenmerk);
  if (idx < 0) return { status: 404, error: 'Dat onderdeel staat niet in deze reis.' };

  const ms = min * 60000;
  /* Alleen het verstoorde onderdeel schuift. `klaarAt` is het moment waarop je
     er weg kunt; dat is wat later wordt. */
  const verschoven = rij.map((o, i) => i !== idx ? o
    : Object.assign({}, o, {
      klaarAt: o.klaarAt ? o.klaarAt + ms : null,
      nodigAt: o.nodigAt ? o.nodigAt + ms : null
    }));

  const voor = haalbaar({ onderdelen: rij, reisTijd, afstandM });
  const na = haalbaar({ onderdelen: verschoven, reisTijd, afstandM });

  /* PER ONDERDEEL EEN UITSPRAAK, ook als er niets verandert. Een lijst die
     alleen de problemen toont, laat de reiziger raden of de rest wel goed ging
     -- en "niet genoemd" leest als "vergeten". */
  const regels = [];
  for (let i = 0; i < na.naden.length; i++) {
    const a = voor.naden[i], b = na.naden[i];
    /* HET ONDERDEEL KOMT UIT DE NAAD ZELF en niet uit `rij[i + 1]`. Dat stond er
       eerst, en het was fout zodra ./haalbaar ging sorteren: de naden lopen dan
       langs de CHRONOLOGISCHE rij en de index langs de rij zoals hij binnenkwam.
       Gevolg was een gevolgregel met de naam van een ander onderdeel eronder --
       een verkeerd geadresseerd voorstel dat er volkomen geloofwaardig uitziet. */
    const onderdeel = b.naar || {};
    const onbekend = b.uitkomst === UITKOMST.NIET_TE_BEPALEN;
    const ergerNu = (ERGER_DAN[b.uitkomst] ?? -1) > (ERGER_DAN[a.uitkomst] ?? -1);
    const wie = WIE[String(onderdeel.soort || '').toLowerCase()] || null;
    regels.push({
      nr: b.nr, titel: onderdeel.titel || '', soort: onderdeel.soort || '',
      voor: a.uitkomst, na: b.uitkomst,
      geraakt: ergerNu,
      /* Onbekend blijft onbekend en wordt geen "geen gevolg". */
      uitleg: onbekend ? 'Niet te bepalen: ' + (b.mist || []).join(', ')
        : ergerNu ? 'Wordt door de vertraging krapper of onmogelijk.'
          : 'Geen gevolg van deze vertraging.',
      margeMin: b.margeMin ?? null,
      /* HET VOORSTEL, NOOIT DE UITVOERING. */
      voorstel: (ergerNu && wie) ? {
        domein: wie.domein, wat: wie.wat, app: wie.app, uitgevoerd: false,
        bevestigt: 'een mens'
      } : null,
      /* En als er wel iets breekt maar niemand het kan oplossen, staat dat er
         hardop -- geen stille rij. */
      zonderWeg: (ergerNu && !wie)
        ? 'Er is voor dit soort onderdeel geen domein dat RTG kan aanwijzen.' : null
    });
  }

  return {
    status: 200,
    verschuiving: { kenmerk, minuten: min, bron: 'opgegeven' },
    oordeelVoor: voor.oordeel, oordeelNa: na.oordeel,
    dekking: na.dekking,
    geraakt: regels.filter(r => r.geraakt).length,
    regels,
    /* Wat deze uitspraak NIET dekt. Een gevolgenlijst zonder deze regel leest
       als een volledige impactanalyse. */
    nietGewogen: ['onderdelen zonder bekende plek of tijd', 'gevolgen buiten deze reis',
      'of het domein de wijziging werkelijk kan doorvoeren']
  };
}

module.exports = { gevolg, WIE };
