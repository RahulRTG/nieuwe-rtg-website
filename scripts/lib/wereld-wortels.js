/* ============================================================================
   DE KLEINE WORTELS -- negen dingen die elk hun eigen domein openen.

   HET PROBLEEM IS DE STAART. De grote hefbomen zijn op: de resterende
   onbewezen mutaties liggen in ruim duizend deelgebieden waarvan de mediaan
   een of twee routes telt. Maar bovenaan die staart staan negen oorzaken die
   elk tien tot twintig routes dragen, en ze hebben allemaal dezelfde vorm --
   een wortelobject dat nergens ontstaat:

     genootschap  21  "Dit genootschap bestaat niet."
     site         18  "Website niet gevonden."
     architect    16  "Concept niet gevonden."         (kantoor)
     agenda       15  "Afspraak niet gevonden."
     labproject   14  "Dit project bestaat niet."      (kantoor)
     comm         13  "Dit gesprek bestaat niet."
     salon        10  "Deze post bestaat niet."
     bestanden    10  "Dat bestand staat niet in uw kluis."
     clips         9  "Clip niet gevonden."

   WAAROM ZE IN EEN MODULE STAAN en niet elk in een eigen wereld: het zijn
   geen ketens. Er is per stuk EEN oproep, en wat eruit komt is EEN id. Negen
   bestanden met elk vijftien regels zou de vorm verbergen in plaats van hem
   te tonen.

   DE VELDNAMEN ZIJN GELEZEN, NIET GERADEN, en dat was bij drie van de negen
   het verschil tussen 200 en 400:

     comm      `met` (een lijst codenamen), niet `aan`
     clips     `duurS` in seconden, niet `duur`
     lab       `titel`, niet `naam`

   De overige zes namen kwamen wel meteen goed, en dat is precies waarom je
   het moet nakijken: zes van de negen bevestigen een gewoonte die bij de
   andere drie fout is.

   WAT DIT NIET DOET. Elke oproep hieronder is een gewone maakhandeling van
   het product zelf. Er wordt niets in de database gezet en geen poort
   omzeild; een wortel die niet ontstaat komt MET REDEN terug en het domein
   erachter blijft dan gewoon onbewezen. */
'use strict';

/* Per wortel: welk domein hij opent, wie hem maakt, met welk lijf, en waar in
   het antwoord het id staat. `velden` is het lijf; `haal` leest het id.
   `waarom` zegt wat er zonder deze wortel dicht blijft. */
const WORTELS = [
  { naam: 'genootschap', pad: '/api/genootschap/richt-op', rol: 'member',
    prefix: '/api/genootschap', gemeten: 21,
    lijf: { naam: 'Proefgenootschap', soort: 'club', over: 'een genootschap om te kunnen meten' },
    haal: (d) => d.groep && d.groep.id,
    waarom: 'zonder genootschap staat het hele domein op "Dit genootschap bestaat niet"' },

  { naam: 'site', pad: '/api/site/bewaar', rol: 'member',
    prefix: '/api/site', gemeten: 18,
    lijf: { naam: 'Proefsite', titel: 'Proef' },
    haal: (d) => d.design && d.design.id,
    waarom: 'de websitebouwer hangt aan een ontwerp; zonder ontwerp geen enkele route' },

  { naam: 'architect', pad: '/api/office/architect/maak', rol: 'kantoor-op-naam',
    prefix: '/api/office/architect', gemeten: 16,
    lijf: { naam: 'Proefconcept', discipline: 'villa' },
    haal: (d) => d.ontwerp && d.ontwerp.id,
    waarom: 'het architectenbureau werkt op een concept; zonder concept staan zestien routes stil' },

  { naam: 'agenda', pad: '/api/agenda/toevoegen', rol: 'member',
    prefix: '/api/agenda', gemeten: 15,
    lijf: { titel: 'Proefafspraak', datum: '2026-09-01', van: '09:00', tot: '10:00' },
    haal: (d) => Array.isArray(d.items) && d.items[0] && d.items[0].id,
    waarom: 'de agenda geeft zijn lijst terug en niet het nieuwe item; het eerste is de zojuist gemaakte' },

  { naam: 'labproject', pad: '/api/lab/project/maak', rol: 'kantoor-op-naam',
    prefix: '/api/lab', gemeten: 14,
    /* `titel` en niet `naam` -- kern/onderzoekslab.js weigert onder de drie
       tekens met "Geef het project een duidelijke titel". */
    /* `veld` komt uit een gesloten lijst (VELDEN in kern/onderzoekslab.js) en
       weigert met "Kies een onderzoeksveld" -- dus niet verzinnen. */
    lijf: { titel: 'Proefproject', doel: 'een project om te kunnen meten', veld: 'software' },
    haal: (d) => (d.project && d.project.id) || d.id,
    waarom: 'het onderzoekslab hangt aan een project; zonder project geen bevinding en geen fase' },


  { naam: 'salon', pad: '/api/salon/plaats', rol: 'member',
    prefix: '/api/salon', gemeten: 10,
    lijf: { tekst: 'Een post om te kunnen meten.' },
    haal: (d) => d.post && d.post.id,
    waarom: 'De Salon hangt aan een post; zonder post staat het domein op "Deze post bestaat niet"' },

  { naam: 'bestanden', pad: '/api/bestanden/upstart', rol: 'member',
    prefix: '/api/bestanden', gemeten: 10,
    lijf: { naam: 'proef.txt', grootte: 10 },
    /* Dit levert een UPLOAD-id en nog geen bestand in de kluis: het echte
       bestand ontstaat pas als de stukken zijn verstuurd. Twee routes hebben
       er meteen iets aan, de rest blijft eerlijk staan op "Dat bestand staat
       niet in uw kluis" -- en dat is beter dan een verzonnen bestand-id. */
    haal: (d) => d.uploadId,
    veldnaam: 'uploadId',
    waarom: 'de kluis kent een upload in stukken; het bestand zelf ontstaat pas na het laatste stuk' },

  /* ---- de tweede ronde: elf wortels met dezelfde vorm ---- */

  { naam: 'mallaanvraag', pad: '/api/mall/aanvraag', rol: 'member',
    prefix: '/api/mall/aanvraag', gemeten: 17,
    /* `verdieping` komt uit een gesloten lijst (kern/mall/aanbodvorm.js) en de
       route legt uit waarom hij verplicht is: zonder verdieping krijgt elke
       zaak alles te zien. */
    lijf: { titel: 'Proefaanvraag', wat: 'een vraag om te kunnen meten',
            verdieping: 'diensten', plek: 'Ibiza', budget: 100 },
    haal: (d) => (d.aanvraag && d.aanvraag.id) || d.id,
    waarom: 'de vindlaag van de Mall hangt aan een aanvraag van een lid' },

  { naam: 'lerenproject', pad: '/api/member/leren/project-maak', rol: 'member',
    prefix: '/api/member/leren', gemeten: 12,
    lijf: { titel: 'Proefproject', wat: 'een project om te kunnen meten' },
    haal: (d) => d.id || (d.project && d.project.id),
    waarom: 'de leerkant hangt aan een project; zonder project geen notitie en geen taak' },

  { naam: 'kantoorpakket', pad: '/api/kantoorpakket/maak', rol: 'member',
    prefix: '/api/kantoorpakket', gemeten: 10,
    /* `soort: formulier` is geen smaak: tien routes weigeren met "Dit document
       is geen formulier", dus een gewoon document opent ze niet. */
    lijf: { naam: 'Proefformulier', soort: 'formulier' },
    haal: (d) => d.id || (d.document && d.document.id),
    waarom: 'RTG Office hangt aan een document, en tien routes willen er een van het soort formulier' },

  { naam: 'loonrun', pad: '/api/office/payroll/loonrun', rol: 'kantoor-op-naam',
    prefix: '/api/office/payroll', gemeten: 10,
    /* `periode` als jjjj-mm; de route zegt het formaat er zelf bij. */
    /* En een `zaak`: een loonrun loopt per bedrijf, niet per kantoor. */
    lijf: { periode: '2026-07', maand: '2026-07', zaak: 'KIKUNOI', code: 'KIKUNOI' },
    haal: (d) => (d.run && d.run.id) || (d.loonrun && d.loonrun.id) || d.id,
    waarom: 'de loonrun is de wortel van de payroll-uitgang: aangifte, betaalbestand, correctie' },

  /* DE NAHEFFING STAAT HIER NIET, en dat is een besluit en geen vergetelheid.

     Het rijk weigert met "Deze zaak heeft over 2026K2 niets gefactureerd en
     niets aangegeven" (kern/overheid/naheffing.js, teHeffen). Dat is geen
     ontbrekend veld maar een echte voorwaarde: je kunt niet naheffen op niets.
     Om die tien routes te openen zou er eerst een btw-geschiedenis moeten
     staan -- facturen, een aangifte, een aansluiting -- en dat is een keten
     van een heel ander formaat dan de wortels hier.

     Zolang die er niet is, blijven die tien eerlijk onbewezen. Dat is beter
     dan een verzonnen naheffing, want dan zou de proef meten op een aanslag
     die in het echt niet had mogen bestaan. */

  { naam: 'clips', pad: '/api/clips/maak', rol: 'member',
    prefix: '/api/clips', gemeten: 9,
    /* `duurS` in seconden. Met `duur` weigert hij met "Een clip duurt 1 tot 60
       seconden" -- een zin die naar de WAARDE wijst terwijl de NAAM fout is. */
    lijf: { titel: 'Proefclip', duurS: 10, mbGeschat: 1 },
    haal: (d) => (d.clip && d.clip.id) || d.id,
    waarom: 'Clips hangt aan een clip; zonder clip staat het domein op "Clip niet gevonden"' }
];

/* ---------------------------------------------------------------------------
   EN DE PROCESSTARTS -- geen ding maar een TOESTAND.

   Achtentwintig routes weigeren niet omdat er iets ontbreekt maar omdat er
   iets nog niet LOOPT: "Er loopt geen puzzel. Begin er een", "Er is nog geen
   codewoord ingesteld", "Maak eerst je zakelijke profiel aan". Dat is een
   andere soort voorwaarde dan een wortel, en toch dezelfde reparatie: een
   oproep die de toestand aanzet.

   Ze staan apart omdat ze GEEN id opleveren en dus ook niets meegeven aan het
   lijf; ze veranderen alleen wat de server van deze sessie weet. Een wortel
   die niets teruggeeft zou anders als mislukt tellen.

   Elke waarde hieronder komt uit een gesloten lijst of een geciteerde regel --
   `VRAAG_MIJ` uit kern/commercie/tegoed/inhoud.js, "minstens 3 woorden" uit de
   weigering zelf. Er wordt niets verzonnen. */
const PROCESSTARTS = [
  { naam: 'sudoku', pad: '/api/member/spel/sudoku-nieuw', rol: 'member',
    lijf: { niveau: 'makkelijk' }, gemeten: 2,
    waarom: 'twee routes zeggen "Er loopt geen puzzel. Begin er een"' },

  /* HET CODEWOORD VRAAGT TWEE DINGEN, en het tweede is het aardige: eerst een
     KRING. "Een codewoord waarschuwt je kring, dus zet daar eerst iemand in --
     anders gaat er straks niets af en merk je dat niet." De code zegt er zelf
     bij dat ook een PROEF hierop hoort te falen (kern/veiligheid/alarm.js),
     en dat is precies goed: een alarm dat niemand bereikt is geen alarm.

     De kring krijgt de tweede ledensessie, die door de gespreksketen hierboven
     al een echte vriend is. Geen verzonnen contact dus. */
  { naam: 'kring', pad: '/api/veiligheid/kring/toevoegen', rol: 'member',
    lijfUit: (ctx) => (ctx.tweeKey ? { handle: ctx.tweeKey, locatie: true } : null),
    gemeten: 0,
    waarom: 'een codewoord en een wacht waarschuwen de kring; zonder kring waken ze over niemand' },

  { naam: 'codewoord', pad: '/api/veiligheid/codewoord/zet', rol: 'member',
    /* "Kies een zin van minstens 3 woorden. Een los woord valt te makkelijk
       per ongeluk" -- de reden staat in de weigering, dus geen los woord. */
    lijf: { woord: 'de proef meet mee', zin: 'de proef meet mee' }, gemeten: 2,
    waarom: 'twee routes vragen een ingesteld codewoord' },

  { naam: 'aibeleid', pad: '/api/member/ai/beleid', rol: 'member',
    /* De vier standen staan in kern/commercie/tegoed/inhoud.js; VRAAG_MIJ is
       de terughoudende, en dat is de juiste keuze voor een proef die geen geld
       hoort uit te geven. */
    lijf: { beleid: 'VRAAG_MIJ' }, gemeten: 1,
    waarom: 'het tegoedbeleid moet gekozen zijn voor de AI-routes iets doen' },

  { naam: 'zakelijkprofiel', pad: '/api/zakelijk/profiel/zet', rol: 'member-lifestyle',
    lijf: { naam: 'Proef Zakelijk', kop: 'Oprichter', over: 'een profiel om te kunnen meten' },
    gemeten: 3,
    waarom: 'drie routes zeggen "Maak eerst je zakelijke profiel aan"' },

  { naam: 'rendezvousprofiel', pad: '/api/member/rendezvous/profiel/zet', rol: 'member-signature',
    lijf: { aan: true, over: 'een profiel om te kunnen meten', zoekt: 'iedereen' },
    gemeten: 1,
    waarom: 'Rendez-vous vraagt een eigen profiel voordat er gekozen kan worden' }
];

async function zetWortelsKlaar({ post, tokenVoor }) {
  const stappen = [];
  const per = {};

  /* Het gesprek eerst: het levert de sleutel van de tweede persoon, en de
     kring hieronder heeft die nodig. */
  const gesprek = await zetGesprekKlaar({ post, tokenVoor, stappen });
  if (gesprek) per['/api/comm'] = gesprek;
  const ctx = { tweeKey: gesprek && gesprek.tweeKey };

  /* Dan de toestanden: een wortel kan ervan afhangen. */
  for (const ps of PROCESSTARTS) {
    const tok = tokenVoor ? tokenVoor(ps.rol) : null;
    if (!tok) {
      stappen.push({ naam: ps.naam, pad: ps.pad, status: 0, ok: false,
        waarom: 'geen sessie voor rol `' + ps.rol + '`' });
      continue;
    }
    /* Een start die van een eerdere stap afhangt, bouwt zijn lijf uit de
       context. Levert die niets, dan wordt er niets geprobeerd -- en dat staat
       met reden in de stappen in plaats van als een verzonnen waarde. */
    const lijf = ps.lijfUit ? ps.lijfUit(ctx) : ps.lijf;
    if (!lijf) {
      stappen.push({ naam: ps.naam, pad: ps.pad, status: 0, ok: false,
        waarom: 'de voorwaarde uit een eerdere stap ontbreekt' });
      continue;
    }
    let a = null;
    try { a = await post(ps.pad, lijf, tok); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam: ps.naam, pad: ps.pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
  }

  /* HET GESPREK (hierboven al gedaan) STAAT APART, want het is als enige geen enkele oproep.
     /api/comm/begin vraagt `met`: een lijst codenamen van mensen met wie je
     VERBONDEN bent ("Je bent nog niet verbonden met deze codenaam"). Dat is
     geen hobbel maar de regel -- een gesprek beginnen met een vreemde hoort
     niet te kunnen.

     De proef heeft twee ledensessies die echt verschillende mensen zijn
     (`member` en `member-account`, zie ./accountroutes.js), dus de vriendschap
     is te leggen langs de gewone weg: de een vraagt aan, de ander antwoordt.
     Precies zoals bij het spelpotje. */

  for (const w of WORTELS) {
    const tok = tokenVoor ? tokenVoor(w.rol) : null;
    if (!tok) {
      stappen.push({ naam: w.naam, pad: w.pad, status: 0, ok: false,
        waarom: 'geen sessie voor rol `' + w.rol + '`' });
      continue;
    }
    let a = null;
    try { a = await post(w.pad, w.lijf, tok); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    const id = ok ? w.haal(a.data || {}) : null;
    stappen.push({ naam: w.naam, pad: w.pad, status: a ? a.status : 0, ok: !!id,
      waarom: id ? null : ((a && a.data && a.data.error) || 'geen herkenbaar id in het antwoord') });
    if (id) {
      const bak = { id };
      /* Een enkele wortel draagt zijn id onder een eigen naam (de kluis heet
         hem `uploadId`); dan gaat hij onder BEIDE mee, want de zusterroutes
         van dat domein lezen soms het een en soms het ander. */
      if (w.veldnaam) bak[w.veldnaam] = id;
      per[w.prefix] = bak;
    }
  }

  const gelukt = Object.keys(per).length;
  return { klaar: gelukt > 0, per, stappen, telt: WORTELS.length + 1,
    processtarts: PROCESSTARTS.length,
    reden: gelukt ? null : 'geen enkele wortel kwam er; zie stappen' };
}

/* Twee leden bevriend maken en dan een gesprek beginnen. Geeft { id } of null;
   elke stap staat met reden in `stappen`. */
async function zetGesprekKlaar({ post, tokenVoor, stappen }) {
  const een = tokenVoor('member'), twee = tokenVoor('member-account');
  if (!een || !twee) {
    stappen.push({ naam: 'comm', pad: '/api/comm/begin', status: 0, ok: false,
      waarom: 'er zijn twee ledensessies nodig; een gesprek begin je met iemand anders' });
    return null;
  }
  const doe = async (naam, pad, lijf, tok) => {
    let a = null;
    try { a = await post(pad, lijf, tok); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  /* Wie is de ander? /api/member/connections geeft de EIGEN codenaam terug
     (routes/social/leden.js). /api/ik doet dat niet -- die gaat over de fase
     van je leven, niet over je naam, en dat kostte deze keten een ronde. */
  const ik = await doe('comm: wie is de tweede', '/api/member/connections', {}, twee);
  const codenaam = ik && ik.codename;   // ENGELS in het antwoord, zie leden.js
  const tweeKey = ik && ik.me;
  if (!codenaam || !tweeKey) return null;

  /* /api/member/connect neemt een `key` en GEEN codenaam -- socialVerbind
     leest req.body.key (routes/social/leden.js). Met een codenaam geeft hij
     "Deze codenaam kennen we niet", en dat leest als een onbekend lid terwijl
     het veld fout is. Twee velden met bijna dezelfde naam en een andere
     betekenis: `codename` identificeert voor een MENS, `key` voor de server. */
  await doe('comm: verbinding aanvragen', '/api/member/connect', { key: tweeKey }, een);

  /* De ander antwoordt met de SLEUTEL van de aanvrager en een `action`. Die
     sleutel staat in zijn eigen verzoeken. */
  const mijn = await doe('comm: de openstaande verzoeken', '/api/member/connections', {}, twee);
  const verzoek = mijn && Array.isArray(mijn.requests) && mijn.requests[0];
  if (verzoek && (verzoek.key || verzoek.van)) {
    await doe('comm: de ander aanvaardt', '/api/member/connect/respond',
      { key: verzoek.key || verzoek.van, action: 'accept' }, twee);
  } else {
    stappen.push({ naam: 'comm: de ander aanvaardt', pad: '/api/member/connect/respond',
      status: 0, ok: false, waarom: 'er stond geen verzoek klaar bij de tweede' });
  }

  const g = await doe('comm: het gesprek beginnen', '/api/comm/begin',
    { met: [tweeKey], tekst: 'Een gesprek om te kunnen meten.' }, een);
  const id = g && ((g.gesprek && g.gesprek.id) || g.id);
  return id ? { id, gesprek: id, gesprekId: id, tweeKey } : null;
}

/* Wat er voor dit pad meegaat. Het langste voorvoegsel wint, zodat
   /api/office/architect niet onder een korter /api/office valt. */
function lijfVoor(per, pad) {
  if (!per) return {};
  let beste = null;
  for (const pre of Object.keys(per)) {
    if (!(pad === pre || String(pad || '').startsWith(pre + '/'))) continue;
    if (!beste || pre.length > beste.length) beste = pre;
  }
  return beste ? per[beste] : {};
}

module.exports = { WORTELS, PROCESSTARTS, zetWortelsKlaar, lijfVoor };
