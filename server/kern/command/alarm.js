/* HET ALARM -- want een SLO zonder alarm is een rapportcijfer achteraf.

   SLO.md noemt dit sinds de eerste versie als punt 2 van zijn eigen gaten: de
   cijfers worden gemeten en het foutbudget wordt bijgehouden, maar er gaat
   niemand piepen. Dit is die piep.

   HIJ MEET NIETS ZELF, en dat is de kern. Elke controle hieronder leest een
   laag die er al is: de servicedoelen, de sonde, de canary, de gegevens-
   kwaliteit en de hashketen van het journaal. Een alarm met een eigen meting
   gaat op een dag iets anders zeggen dan het scherm waar het over gaat, en dan
   gelooft niemand meer welk van de twee.

   DE DREMPELS STAAN IN SLO.json EN DE CONTROLES HIER. Dat is een bewuste knip:
   getallen horen in gegevens, maar een regeltaal in een configuratiebestand is
   een tweede implementatie die je niet kunt toetsen. Wie een controle wil
   toevoegen, schrijft code met een toets erbij.

   EN HET BELANGRIJKSTE: HIJ PIEPT OP VERANDERING, NIET ELKE RONDE. Een alarm
   dat elke dertig seconden hetzelfde meldt, leert mensen om het weg te klikken
   -- en dan is de volgende, echte melding ook weg. Er gaat dus een regel in het
   journaal en een sein naar het kantoorbord bij het ONTSTAAN en bij het
   OPLOSSEN, en daartussen niet meer.

   WAT HIER NIET GEBEURT: er gaat geen mail en geen telefoonmelding uit. Dat is
   een kanaalbesluit met een piket eraan vast (punt 4 van datzelfde lijstje in
   SLO.md), en het hoort niet stilzwijgend hier ingebouwd te worden. De
   uitgangen die er zijn, staan in de uitslag. */
'use strict';

const ERNST = { hoog: 3, midden: 2, laag: 1 };

function maakAlarm({ opslag, save, journaal, slo, sonde, canary, kwaliteit, norm, sein, foutmelder }) {
  const D = () => {
    const n = (typeof norm === 'function' ? norm() : norm) || {};
    return Object.assign({ budgetRestDeel: 0.25, defectenDrempel: 25, buitenStilUren: 24, stilteMaxUren: 72 },
      n.alarmen || {});
  };

  function vak() {
    return opslag.bak('commandAlarmen');
  }

  /* De controles. Elk geeft null (niets aan de hand) of een bevinding. Ze
     vangen hun eigen storing af: een alarm dat zelf omvalt omdat de laag
     eronder een fout gooit, is stil op precies het verkeerde moment. */
  function controles() {
    const d = D();
    const uit = [];
    const probeer = (id, naam, ernst, doe) => {
      try { const r = doe(); if (r) uit.push({ id, naam, ernst, wat: r }); }
      catch (e) { uit.push({ id, naam, ernst: 'midden', wat: 'deze controle kon niet draaien: ' + e.message }); }
    };

    probeer('doel-gezakt', 'Een servicedoel is niet gehaald', 'hoog', () => {
      const st = slo.stand();
      const g = st.doelen.filter(x => x.genoeg && x.oordeel === 'niet gehaald');
      return g.length ? g.map(x => x.naam).join(', ') + ' staat over de streefwaarde' : null;
    });

    probeer('budget-bijna-op', 'Het foutbudget raakt op', 'midden', () => {
      const st = slo.stand();
      const g = st.doelen.filter(x => x.genoeg && x.budget && !x.budget.op && x.budget.restDeel < d.budgetRestDeel);
      return g.length ? g.map(x => x.naam + ' (' + Math.round(x.budget.restDeel * 100) + '% over)').join(', ') : null;
    });

    probeer('niets-van-buiten', 'Er wordt niet van buitenaf gemeten', 'laag', () => {
      const b = sonde.buitenkort();
      return b.gemeten ? null : 'de sonde heeft in dertig dagen niets van buitenaf gemeld. Alles wat ' +
        'de servicedoelen tonen, komt dan van de app over zichzelf -- en die telt niets als hij plat ligt.';
    });

    probeer('sonde-storing', 'De sonde ziet storingen van buitenaf', 'hoog', () => {
      const st = sonde.stand(d.buitenStilUren);
      if (!st.buiten.pogingen || !st.buiten.mislukt) return null;
      return st.buiten.mislukt + ' van ' + st.buiten.pogingen + ' externe metingen mislukten in ' +
        d.buitenStilUren + ' uur';
    });

    probeer('canary-teruggerold', 'Een uitrol is automatisch teruggerold', 'midden', () => {
      if (!canary) return null;
      const g = canary.lopende().filter(x => x.stand === 'teruggerold' && x.automatisch);
      return g.length ? g.map(x => x.naam).join(', ') + ' ging over de terugroldrempel' : null;
    });

    probeer('journaal-gebroken', 'De hashketen van het journaal klopt niet', 'hoog', () => {
      const k = journaal.controleer();
      return k && k.heel === false ? (k.waarom || 'de keten is gebroken') + ' (bij ' + k.bij + ')' : null;
    });

    probeer('gegevens-kapot', 'Er staan defecten in de gegevens', 'laag', () => {
      if (!kwaliteit) return null;
      const t = kwaliteit.meet().tel;
      return t.defecten > d.defectenDrempel
        ? t.defecten + ' defecten over ' + t.soorten + ' bevinding(en); de drempel staat op ' + d.defectenDrempel
        : null;
    });

    return uit;
  }

  const nu = () => new Date().toISOString();

  /* Wegen: wat is er nieuw, wat is er opgelost, en wat loopt er door. Alleen
     het eerste en het tweede gaan de deur uit. */
  function weeg() {
    const staat = vak();
    const gevonden = controles();
    const gezien = new Set(gevonden.map(x => x.id));
    const nieuw = [], opgelost = [];

    for (const g of gevonden) {
      const oud = staat[g.id];
      if (oud && oud.actief) {
        oud.wat = g.wat; oud.laatst = nu();
        continue;
      }
      staat[g.id] = { id: g.id, naam: g.naam, ernst: g.ernst, wat: g.wat, sinds: nu(), laatst: nu(),
        actief: true, stilTot: oud && oud.stilTot ? oud.stilTot : null };
      nieuw.push(staat[g.id]);
    }
    for (const id of Object.keys(staat)) {
      if (gezien.has(id) || !staat[id].actief) continue;
      staat[id].actief = false;
      staat[id].opgelostAt = nu();
      opgelost.push(staat[id]);
    }

    for (const a of nieuw) meld(a, 'aan');
    for (const a of opgelost) meld(a, 'af');
    if (nieuw.length || opgelost.length) save();
    return { nieuw, opgelost, actief: gevonden.length };
  }

  /* De uitgang. DRIE kanalen nu, en het derde is er bijgekomen om een reden die
     in de oude versie van dit blok zelf stond: de eerste twee eindigen allebei
     BINNEN het huis. Een regel in het journaal staat in het spoor, een sein gaat
     naar het kantoorbord -- en om drie uur 's nachts kijkt daar niemand naar. Een
     alarm dat alleen op een scherm eindigt dat niemand openheeft, is een
     rapportcijfer achteraf (TAKEN.md 7.12).

     Het derde kanaal is de bestaande foutmelder (server/foutmelder.js): een dunne
     webhook-POST met SSRF-keuring, die er al was en op nul aanroepers stond voor
     alarmen. Hij gaat alleen af op de OVERGANG -- aan en af -- en nooit op elke
     ronde; weeg() roept meld() ook alleen daarvoor aan.

     Stilgezet? Dan wel noteren en niet seinen -- stilte hoort in het spoor te
     staan, en dat geldt voor alle drie de kanalen. Wie een alarm stilzet, wil ook
     geen telefoon om drie uur. */
  function meld(a, richting) {
    const stil = a.stilTot && Date.parse(a.stilTot) > Date.now();
    try {
      journaal.noteer({ actie: richting === 'aan' ? 'alarm aan' : 'alarm af', actor: 'automaat',
        niveau: 'auto', objectType: 'alarm', objectId: a.id,
        reden: a.naam + (richting === 'aan' ? ': ' + a.wat : ' is opgelost') + (stil ? ' (stilgezet)' : '') });
    } catch (e) { /* een journaalstoring mag het alarm niet dempen */ }
    if (stil) return;
    if (typeof sein === 'function') {
      try { sein('sync', { scope: 'alarm', id: a.id, richting, ernst: a.ernst, naam: a.naam }); } catch (e) {}
    }
    naarBuiten(a, richting);
  }

  /* De melder wordt LAAT opgehaald: hij hangt aan de kern en die is nog niet
     compleet op het moment dat deze laag wordt gebouwd. Zonder melder gebeurt er
     niets -- en dat is geen stilte maar een stand die stand() hieronder gewoon
     uitspreekt. */
  const melderNu = () => { try { return typeof foutmelder === 'function' ? foutmelder() : foutmelder; } catch (e) { return null; } };
  function naarBuiten(a, richting) {
    const m = melderNu();
    if (!m || !m.actief || typeof m.melden !== 'function') return;
    try {
      const kop = richting === 'aan'
        ? 'ALARM ' + String(a.ernst || '').toUpperCase() + ': ' + a.naam
        : 'Alarm opgelost: ' + a.naam;
      /* Een Error en geen los object, want dat is wat melden() verwacht -- maar
         de context zegt er expliciet bij dat dit een ALARM is en geen crash. Wie
         de webhook leest, hoort die twee uit elkaar te kunnen houden. */
      const e = new Error(kop + (richting === 'aan' ? ' -- ' + a.wat : ''));
      e.name = 'RTGAlarm';
      m.melden(e, { soort: 'alarm', id: a.id, ernst: a.ernst, richting, sinds: a.sinds || null });
    } catch (e) { /* bezorging faalt liever dan het alarm te dempen */ }
  }

  /* Stilzetten, met een einde eraan. Een alarm dat voor onbepaalde tijd stil
     kan, is een alarm dat je uitzet en vergeet; daarom een maximum uit de norm
     en een reden die in het journaal komt. */
  function stilzetten(id, uren, door, reden) {
    const d = D();
    const a = vak()[String(id)];
    if (!a) return { error: 'Dat alarm staat er niet.', status: 404 };
    const u = Math.max(1, Math.min(Number(uren || 8), d.stilteMaxUren));
    a.stilTot = new Date(Date.now() + u * 3600000).toISOString();
    save();
    journaal.noteer({ actie: 'alarm stilgezet', actor: door, niveau: 'hand', objectType: 'alarm',
      objectId: a.id, reden: u + ' uur: ' + String(reden || 'geen reden opgegeven') });
    return { alarm: a, tot: a.stilTot, max: d.stilteMaxUren };
  }

  /* Is er een weg naar buiten, en zo nee: waarom niet. Dit is met opzet een
     UITSPRAAK en geen stilte -- een alarmweg die niet bestaat, hoort op het bord
     te staan naast de alarmen zelf. */
  function buitenStand() {
    const m = melderNu();
    if (!m) return { actief: false, reden: 'er is geen foutmelder aangesloten op deze laag; alarmen blijven binnen het huis' };
    if (!m.actief) return { actief: false, reden: 'ERR_WEBHOOK_URL is niet gezet of werd geweigerd; er gaat niets naar buiten' };
    return { actief: true, reden: null };
  }

  function stand() {
    const r = weeg();
    const staat = vak();
    const lijst = Object.keys(staat).map(id => staat[id])
      .sort((a, b) => (ERNST[b.ernst] || 0) - (ERNST[a.ernst] || 0));
    const actief = lijst.filter(a => a.actief);
    return {
      alarmen: lijst, zojuist: { nieuw: r.nieuw.map(a => a.id), opgelost: r.opgelost.map(a => a.id) },
      tel: { actief: actief.length, hoog: actief.filter(a => a.ernst === 'hoog').length,
        stil: actief.filter(a => a.stilTot && Date.parse(a.stilTot) > Date.now()).length },
      drempels: D(),
      /* De uitgangen worden GETELD en niet beloofd. Stond ERR_WEBHOOK_URL leeg,
         dan hoort daar niet stilzwijgend een kanaal in de lijst te staan dat er
         niet is -- een lege url leest anders als bezorging. */
      uitgangen: ['het journaal (elke aan- en afmelding)', 'het kantoorbord via de office-SSE']
        .concat(buitenStand().actief ? ['de externe webhook (ERR_WEBHOOK_URL), alleen op de overgang'] : []),
      geenUitgang: buitenStand().actief ? null : buitenStand().reden,
      let: 'er gaat geen mail en geen telefoonmelding uit. Dat is een kanaalbesluit met een piket ' +
        'eraan vast (SLO.md, punt 4) en hoort niet stilzwijgend hier ingebouwd te worden. En het alarm ' +
        'piept op verandering en niet elke ronde: een melding die elke dertig seconden terugkomt, leert ' +
        'mensen om hem weg te klikken.'
    };
  }

  function tikker() {
    /* Niet in een meetserver: zie ./tikkerstand.js voor waarom een klok die
       binnen het meetvenster afgaat, zijn schrijfactie aan een willekeurige
       route toegerekend krijgt. Alleen de LUS gaat uit; een weeg() die een
       route zelf aanroept blijft gewoon schrijven. */
    if (require('./tikkerstand').tikkersUit()) return null;
    const t = setInterval(() => { try { weeg(); } catch (e) { /* nooit de lus breken */ } }, 60000);
    if (t.unref) t.unref();
    return t;
  }

  return { weeg, stand, stilzetten, controles, tikker, buitenStand };
}

module.exports = { maakAlarm, ERNST };
