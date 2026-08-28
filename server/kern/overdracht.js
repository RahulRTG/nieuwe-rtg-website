/* RTG School: Transition Continuity -- wat gaat er mee naar een andere school.

   Bij een overstap gaat er geen "dossier.zip" mee. Elk gegeven draagt een
   KLASSE die zegt waarom het wel of niet overgaat:

     inschrijving  -- nodig om het kind uberhaupt in te schrijven;
     continuiteit  -- nodig om het onderwijs door te laten lopen;
     toestemming   -- gaat alleen mee als iemand daar expliciet ja op zegt;
     nooit         -- gaat niet mee, ook niet met toestemming.

   DIE LAATSTE IS GEEN INSTELLING. Zorg, incidenten en het inzagejournaal staan
   op 'nooit', en daar is geen toestemmingsvinkje voor. Niet omdat toestemming
   niets waard is, maar omdat een ouder die onder tijdsdruk een overstap regelt
   geen vrije keuze maakt over het zorgdossier van zijn kind -- en omdat zulke
   stukken bij de school horen die ze heeft opgebouwd, met hun eigen route en
   hun eigen journaal.

   HET PAKKET ZEGT ALTIJD WAT ER NIET IN ZIT. Een overdracht die alleen toont
   wat er meegaat, laat de ontvangende school denken dat ze alles heeft. Daarom
   draagt elk pakket een lijst van wat is weggelaten en waarom. Dat is de hele
   winst van deze aanpak: niet minder delen om het delen, maar weten wat je
   niet hebt.

   TOESTEMMING IS EEN HANDELING, GEEN STAND. Zonder een genoteerde toestemming
   (wie, wanneer) gaat een 'toestemming'-veld niet mee -- de afwezigheid van een
   nee is geen ja. */
const KLASSEN = ['inschrijving', 'continuiteit', 'toestemming', 'nooit'];

/* De kaart van de leerlingadministratie. Wat hier niet in staat, gaat NOOIT
   mee: onbekende velden vallen buiten het pakket in plaats van er stilletjes
   in te glijden. Dat is dezelfde regel als bij de koppelingen. */
const KAART = {
  naam: { klasse: 'inschrijving', waarom: 'Zonder naam is er geen inschrijving.' },
  geboren: { klasse: 'inschrijving', waarom: 'De geboortedatum bepaalt leerplicht en plaatsing.' },
  herkomst: { klasse: 'inschrijving', waarom: 'De vorige school hoort bij een inschrijving.' },
  opleiding: { klasse: 'continuiteit', waarom: 'Anders begint het kind zijn leerjaar opnieuw.' },
  klasCode: { klasse: 'continuiteit', waarom: 'De plaatsing zegt waar het onderwijs was gebleven.' },
  overstappen: { klasse: 'continuiteit', waarom: 'Een kind dat vaak wisselt, hoort niet steeds opnieuw te beginnen.' },
  contact: { klasse: 'toestemming', waarom: 'Adres en telefoon zijn van het gezin; die deelt het gezin zelf.' },
  documenten: { klasse: 'toestemming', waarom: 'Bewijsstukken gaan alleen mee als het gezin dat wil.' },
  zorg: { klasse: 'nooit', waarom: 'Het zorgdossier hoort bij de school die het heeft opgebouwd, met zijn eigen route.' },
  incidenten: { klasse: 'nooit', waarom: 'Een incident is een gebeurtenis van hier en geen eigenschap van een kind.' },
  journaal: { klasse: 'nooit', waarom: 'Het inzagejournaal is de verantwoording van deze school over zichzelf.' },
  signalen: { klasse: 'nooit', waarom: 'Signalen zijn een gesprek van hier; elders zijn ze een etiket zonder context.' }
};

const MEE = { inschrijving: ['inschrijving'], continuiteit: ['inschrijving', 'continuiteit'] };

/* Het pakket voor een doel. `toestemming` is een genoteerde handeling
   ({ door, at, velden }) en niet een vlag; ontbreekt hij, dan gaan de
   toestemmingsvelden niet mee -- en dat staat dan in de weggelaten-lijst. */
function pakket(leerling, doel, toestemming) {
  const soorten = MEE[doel] || MEE.inschrijving;
  const mag = new Set(toestemming && Array.isArray(toestemming.velden) && toestemming.door ? toestemming.velden : []);
  const mee = {}, weg = [];
  for (const [veld, waarde] of Object.entries(leerling || {})) {
    const regel = KAART[veld];
    if (!regel) { weg.push({ veld, klasse: 'onbekend', waarom: 'Dit gegeven staat niet op de overdrachtskaart en gaat daarom niet mee.' }); continue; }
    if (regel.klasse === 'nooit') { weg.push({ veld, klasse: 'nooit', waarom: regel.waarom }); continue; }
    if (soorten.includes(regel.klasse)) { mee[veld] = waarde; continue; }
    if (regel.klasse === 'toestemming' && mag.has(veld)) { mee[veld] = waarde; continue; }
    weg.push({ veld, klasse: regel.klasse,
      waarom: regel.klasse === 'toestemming'
        ? regel.waarom + ' Er is hiervoor geen toestemming genoteerd.'
        : regel.waarom + ' Dit doel vraagt er niet om.' });
  }
  return { ok: true, doel: MEE[doel] ? doel : 'inschrijving', velden: mee, weggelaten: weg,
    toestemmingDoor: (toestemming && toestemming.door) || null,
    uitleg: 'Wat hier niet in staat, staat in de weggelaten-lijst met de reden erbij. Een overdracht die alleen toont wat meegaat, laat de ontvangende school denken dat ze alles heeft.' };
}

module.exports = { pakket, KAART, KLASSEN, MEE };
