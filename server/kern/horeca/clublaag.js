/* Horeca (kern): de gastenlijst van een club, en wie erop mag.

   WAAROM DIT UIT DE ROUTE KWAM. De lijst stond in routes/supplier/horeca/
   club.js en werd daar geschreven door de club zelf. Toen de avondplanner een
   stap "uitgaan" echt moest kunnen aanvragen, kwam er een TWEEDE schrijver bij,
   en twee schrijvers op één lijst horen dezelfde regels te gebruiken -- anders
   is "op de lijst staan" bij de deur iets anders dan in de app (LAT-regel 4).

   DE REGEL DIE DIT BESTAND BEWAAKT: een lid dat zich aanmeldt STAAT NIET op de
   lijst. Het zet er een aanvraag op, en de club beslist. Dat is dezelfde grens
   als bij een tafel, en hij is hier scherper dan daar: een club heeft een
   capaciteit en een deur, en software die iemand vertelt dat hij binnenkomt
   terwijl de portier daar niets van weet, zet die persoon om half twee 's
   nachts voor een dichte deur. Vandaar:

   - een regel die de CLUB zelf aanmaakt staat op `ok` (zij zet hem er immers
     op) -- en oude regels zonder stand tellen ook als `ok`, want die zijn
     allemaal door de club gezet;
   - een regel die een LID aanvraagt staat op `aangevraagd`;
   - de deur laat alleen een `ok`-regel op de lijst afvinken. Een aanvraag die
     nog niet beoordeeld is, is geen toegang.

   Er staat hier een codenaam en geen echte naam: de identiteitskluis blijft
   waar hij is (CLAUDE.md, privacy by design). */
'use strict';

const STANDEN = ['aangevraagd', 'ok', 'geweigerd'];

module.exports = ({ save, schoon, horeca }) => {
  const { H, nu, id } = horeca;
  const vandaag = () => nu().slice(0, 10);

  function C(zaakcode) {
    const h = H(zaakcode);
    if (!h.club) h.club = { banden: {}, gastenlijst: [], deur: {}, tafels: {} };
    if (!Array.isArray(h.club.gastenlijst)) h.club.gastenlijst = [];
    return h.club;
  }

  // een regel zonder stand komt van de club zelf en telt dus als goedgekeurd
  const standVan = (g) => (g && g.stand) || 'ok';
  const magNaarBinnen = (g) => standVan(g) === 'ok';

  /* De club zet er namen op. Ongewijzigd gedrag ten opzichte van de route waar
     dit vandaan komt, op de expliciete stand na. */
  function zetDoorZaak(zaakcode, { namen, datum, promoter, personen, korting }) {
    const c = C(zaakcode);
    const dag = schoon(datum, 10) || vandaag();
    const prom = schoon(promoter, 40) || null;
    let n = 0;
    for (const naam of (Array.isArray(namen) ? namen : []).slice(0, 500)) {
      const nm = schoon(naam, 60);
      if (!nm) continue;
      c.gastenlijst.push({ id: id(3), naam: nm, datum: dag, promoter: prom,
        personen: Math.max(1, Math.min(20, parseInt(personen, 10) || 1)),
        korting: schoon(korting, 40) || null, stand: 'ok', binnen: false, at: nu() });
      n++;
    }
    c.gastenlijst = c.gastenlijst.slice(-5000);
    if (n) save();
    return n;
  }

  /* Een lid vraagt een plek aan. Geeft de regel terug met `stand:
     'aangevraagd'` -- en de aanroeper mag daar niets anders van maken. */
  function vraagAan(zaakcode, { codenaam, datum, personen, notitie, lidKey }) {
    const c = C(zaakcode);
    const dag = schoon(datum, 10) || vandaag();
    if (dag < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    const wie = schoon(codenaam, 60);
    if (!wie) return { status: 400, error: 'Er is geen naam om op de lijst te zetten.' };
    const al = c.gastenlijst.find(g => g.lidKey && g.lidKey === lidKey && g.datum === dag
      && standVan(g) !== 'geweigerd');
    if (al) return { status: 409, error: 'Je staat voor deze avond al op de lijst van deze club.', regel: publiek(al) };
    const regel = { id: id(3), naam: wie, datum: dag, promoter: null,
      personen: Math.max(1, Math.min(20, parseInt(personen, 10) || 2)),
      korting: null, stand: 'aangevraagd', binnen: false,
      notitie: schoon(notitie, 140) || null, lidKey: lidKey || null, at: nu() };
    c.gastenlijst.push(regel);
    c.gastenlijst = c.gastenlijst.slice(-5000);
    save();
    return { ok: true, regel: publiek(regel) };
  }

  // de club beslist over een aanvraag; alleen een aanvraag is te beslissen
  function beslis(zaakcode, regelId, stand) {
    const c = C(zaakcode);
    const g = c.gastenlijst.find(x => x.id === String(regelId || ''));
    if (!g) return { status: 404, error: 'Deze regel staat niet op de lijst.' };
    if (!STANDEN.includes(stand)) return { status: 400, error: 'Kies: ' + STANDEN.join(', ') + '.' };
    if (standVan(g) !== 'aangevraagd') return { status: 409, error: 'Over deze regel is al beslist (' + standVan(g) + ').' };
    g.stand = stand;
    g.beslistAt = nu();
    save();
    return { ok: true, regel: publiek(g) };
  }

  /* Wat een lid van zijn eigen regel te zien krijgt. Geen promoter, geen
     ledensleutel: dat gaat het lid niets aan en hoort niet over de lijn. */
  const publiek = (g) => ({ id: g.id, datum: g.datum, personen: g.personen,
    stand: standVan(g), binnen: !!g.binnen, korting: g.korting || null });

  const vanDatum = (zaakcode, datum) => C(zaakcode).gastenlijst
    .filter(g => g.datum === (schoon(datum, 10) || vandaag()));

  const vanLid = (zaakcode, lidKey) => C(zaakcode).gastenlijst
    .filter(g => g.lidKey && g.lidKey === lidKey).map(publiek);

  return { STANDEN, C, standVan, magNaarBinnen, zetDoorZaak, vraagAan, beslis, publiek, vanDatum, vanLid };
};
