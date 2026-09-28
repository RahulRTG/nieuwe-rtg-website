/* ============================================================================
   HET LEERHUIS -- besluit B7: een startpakket per soort organisatie.

   Een nieuw leerhuis is leeg, en een leeg leerhuis leert niemand iets. Een
   startpakket zet een eerste set CONCEPTEN klaar: kennis, vaardigheden, een rol,
   een curriculum en een oefening. Het maakt niets officieel.

   DRIE GRENZEN, en ze staan in code en niet in deze kop:

   1. ALLES KOMT ALS CONCEPT BINNEN. Kennis staat op DRAFT en een curriculum ook;
      activeren loopt langs de gewone weg: een KNOWLEDGE_OWNER die het niet zelf
      schreef (acties-kennis.js, eisNiet op de auteur).
   2. EEN CONCEPT UIT EEN PAKKET WORDT NIET ONGEWIJZIGD OFFICIELE KENNIS. Wie het
      activeert, noemt de eigen bron van deze organisatie (acties-kennis.js,
      herkomst `startpakket`). Een tekst die RTG voor iedereen schreef, is voor
      deze organisatie pas waar als iemand hier zegt waarom.
   3. ER STAAN GEEN MENSEN IN. Trainers, assessoren en kenniseigenaren wijst de
      organisatie zelf aan; een pakket dat mensen benoemt, verzint gezag.

   De inhoud is met opzet algemeen en komt uit afspraken die in dit huis al in
   code staan (codenamen en de kluis, een melding opnemen, de VOG-eis van
   kern/rtfos/vrijwilligers.js, geld dat wordt klaargezet). Er staat geen
   juridisch feit in dat een organisatie niet zelf kan nakijken.

   HET LADEN LOOPT LANGS DE GEWONE HANDELINGEN, elk met een eigen sleutel
   (`startpakket:<id>`): opnieuw laden na een storing schrijft niets dubbel, en
   wat er al staat wordt overgeslagen en niet overschreven.
   ========================================================================== */
'use strict';

const { eisBestuur, Weigering } = require('./hulp');

const BRON = 'concept uit het startpakket van RTG Academy; de kenniseigenaar noemt bij het activeren de eigen bron';
const k = (id, domein, titel, tekst) => ['kennisSchrijf', { id, domein, titel, tekst, bron: BRON, herkomst: 'startpakket' }];

const BASIS = [
  k('pakket-kennis-codenamen', 'privacy', 'Werken met codenamen',
    'Klantgegevens staan op codenaam. De echte naam staat in de gescheiden kluis en gaat alleen open met een reden; elke inzage laat een regel in het journaal achter.'),
  k('pakket-kennis-melding', 'dienstverlening', 'Een melding opnemen',
    'Noteer wat de melder zegt in zijn eigen woorden. Zeg wat er daarna gebeurt en wanneer. Zeg niets toe wat je niet zelf kunt waarmaken.')
];

const EXTRA = {
  RTG: k('pakket-kennis-geld', 'geld', 'Geld wordt klaargezet',
    'Een betaling of terugboeking wordt klaargezet en door een mens uitgevoerd. Een terugboeking draagt altijd een reden.'),
  RTF: k('pakket-kennis-vog', 'veiligheid', 'VOG en gedragscode',
    'Voor een project waarvoor de afdeling een VOG verplicht stelt, begin je pas als je VOG geldig is en de gedragscode is ondertekend.'),
  BUSINESS: k('pakket-kennis-overdracht', 'samenwerken', 'Werk overdragen',
    'Draag werk over met wat er gedaan is, wat nog openstaat en wie de volgende stap zet.'),
  SUPPLIER: k('pakket-kennis-overdracht', 'samenwerken', 'Werk overdragen',
    'Draag werk over met wat er gedaan is, wat nog openstaat en wie de volgende stap zet.')
};

const ROLTITEL = { RTG: 'Medewerker RTG Operations', RTF: 'Vrijwilliger', BUSINESS: 'Medewerker', SUPPLIER: 'Medewerker' };

function stappen(soort) {
  const extra = EXTRA[soort];
  if (!extra) return null;
  const kennis = BASIS.concat([extra]);
  const kIds = kennis.map(s => s[1].id);
  return kennis.concat([
    ['vaardigheidZet', { id: 'pakket-vaardigheid-privacy', naam: 'Zorgvuldig met persoonsgegevens', niveau: 'FOUNDATIONAL',
      kritiek: true, bewijsEis: { sterkte: 'OBSERVED', soorten: ['KNOWLEDGE_EVIDENCE', 'OBSERVATION_EVIDENCE'] },
      kennis: ['pakket-kennis-codenamen'] }],
    ['vaardigheidZet', { id: 'pakket-vaardigheid-melding', naam: 'Een melding opnemen', niveau: 'PRACTITIONER',
      bewijsEis: { sterkte: 'OBSERVED', soorten: ['SIMULATION_EVIDENCE', 'OBSERVATION_EVIDENCE'] },
      kennis: ['pakket-kennis-melding', extra[1].id] }],
    ['rolZet', { id: 'pakket-rol-start', titel: ROLTITEL[soort], soort: 'PROFESSIONAL',
      doel: 'De eerste rol in dit leerhuis: zorgvuldig met gegevens, en een melding goed opnemen.',
      vaardigheden: ['pakket-vaardigheid-privacy', 'pakket-vaardigheid-melding'] }],
    ['curriculumZet', { id: 'pakket-curriculum-start', titel: 'De eerste weken',
      vaardigheden: ['pakket-vaardigheid-privacy', 'pakket-vaardigheid-melding'], kennis: kIds,
      fasen: [{ fase: 'UNDERSTAND', wat: 'de afspraken lezen en bespreken met de trainer' },
        { fase: 'PRACTICE', wat: 'een melding opnemen in de oefenomgeving' },
        { fase: 'SUPERVISED_WORK', wat: 'meldingen opnemen met de trainer ernaast' },
        { fase: 'PROVE', wat: 'een assessor kijkt mee bij echt werk' }] }],
    ['scenarioZet', { id: 'pakket-scenario-melding', domein: 'dienstverlening', vaardigheden: ['pakket-vaardigheid-melding'],
      begin: 'Iemand belt: er is iets misgegaan en hij wil weten wat er nu gebeurt.',
      vereist: ['luisteren', 'samenvatten', 'vervolg-noemen'], verboden: ['toezeggen-zonder-mandaat'], volgorde: true,
      veiligheid: 'oefening zonder gevolgen: er wordt niets verstuurd en niemand gebeld' }]
  ]);
}

const WAAR = { kennisSchrijf: 'kennis', vaardigheidZet: 'vaardigheden', rolZet: 'rollen', curriculumZet: 'curricula', scenarioZet: 'scenarios' };

/* `doe` en `stand` zijn die van het leerhuis zelf (index.js): geen eigen
   schrijfweg, dus geen tweede waarheid over wat een handeling mag. */
function laad({ doe, stand }, org, door) {
  const st = stand(org);
  if (!st.org) return { ok: false, status: 404, reden: 'deze organisatie heeft geen leerhuis' };
  try { eisBestuur(st, door, ['CURRICULUM_OWNER'], 'een startpakket laden'); } catch (e) {
    if (e instanceof Weigering) return { ok: false, status: e.status, reden: e.message };
    throw e;
  }
  const lijst = stappen(st.org.soort);
  if (!lijst) return { ok: false, status: 400, reden: 'voor een organisatie van soort ' + st.org.soort + ' is er geen startpakket' };
  const gezet = []; const overgeslagen = [];
  for (const [actie, invoer] of lijst) {
    if (stand(org)[WAAR[actie]][invoer.id]) { overgeslagen.push(invoer.id); continue; }
    const r = doe(org, actie, invoer, door, { sleutel: 'startpakket:' + invoer.id });
    if (r && r.ok === false) return Object.assign({}, r, { gezet, overgeslagen, bij: invoer.id });
    gezet.push(invoer.id);
  }
  return { ok: true, gezet, overgeslagen,
    volgende: 'alles staat als concept; een kenniseigenaar die het niet zelf laadde, activeert de kennis met de eigen bron' };
}

module.exports = { stappen, laad, BRON };
