/* ==================== RTG COMMUNICATION CORE ====================

   EEN GESPREK IS EEN GESPREK, WAAR HET OOK VANDAAN KOMT.

   Wat hier veranderde. Dit huis had zes berichtenvoorraden naast elkaar --
   db.data.memberChats (vrienden), applyChats (sollicitaties), guestChats
   (gast en zaak), collegaChats (werkvloer), podiumChat en rijkBerichten
   (overheid) -- en elke module die er een gesprek bij wilde, bouwde de
   zevende. Elk met een eigen berichtvorm, een eigen verstuurroute, een eigen
   leesstand, en geen van alle met zoiets gewoons als een reactie, een
   antwoord-op of een correctie. De Berichten-app was daarbovenop een LEESLIJST
   die naar de bron-app doorverwees: hij kon tonen dat er iets was, en verder
   niets.

   Dat is de fout die je maar een keer moet maken. Een chatfunctie per module
   betekent dat "verwijderen voor iedereen", "gelezen op dit apparaat" of
   "zoeken over alles" zes keer gebouwd en zes keer net anders wordt -- en dat
   de zevende module weer bij nul begint.

   Dus: communicatie is hier INFRASTRUCTUUR, geen functie. Er is een
   gesprekmodel, een berichtmodel en een standenmodel, en elke module vraagt
   het aan deze kern:

       comm.gesprekMaak({ soort: 'ride', deelnemers: [chauffeur, reiziger],
                          titel: 'Rit RT-1941', meta: { sleutel: 'rit:RT-1941' } })

   Taxi bouwt dus geen berichtenbackend. Horeca ook niet. School ook niet.

   HET SOORT IS DE CONTEXT, en dat is meer dan een etiket: het bepaalt in welke
   la van de inbox het gesprek valt en welke regels erop staan. De twaalf staan
   in SOORTEN hieronder en zijn bewust een gesloten lijst -- een vrij tekstveld
   was binnen een maand een verzameling spelfouten geweest.

   DRIE REGELS DIE HET ONTWERP STUREN, en die verderop worden afgedwongen en
   niet alleen beschreven:

   1. ALLES OP CODENAAM. Deze kern kent sleutels en codenamen, nooit echte
      namen; die staan in de gescheiden kluis (accounts.js) en komen hier niet
      langs. Ook niet in een titel, ook niet in een zoekindex.
   2. WIE ER NIET IN ZIT, LEEST NIET MEE. Elke leesweg loopt langs magErin().
      Een gesprek-id raden mag nooit genoeg zijn.
   3. DE AI STELT OP, DE MENS VERSTUURT. Deze kern heeft geen enkele weg waarop
      een model zelf een bericht plaatst; @Rahul levert tekst terug (zie ./ai)
      en die belandt in het invoerveld. Dezelfde drempel als bij geld.

   WAT HIER (NOG) NIET IN ZIT, zodat niemand het hier gaat zoeken: end-to-end
   encryptie, tenants/RBAC, retentiebeleid, legal hold, eDiscovery en de
   publieke API voor externe ontwikkelaars. Die horen in dit model thuis -- het
   is er ook op gebouwd, zie meta en het feit dat elk bericht een gesprek met
   een soort heeft -- maar ze staan er niet. Een half aangezette
   compliance-laag is gevaarlijker dan een afwezige.
   ================================================================ */
'use strict';

/* De twaalf contexten. Een gesprek hoort bij precies een van deze, en de
   inbox groepeert erop. `personal` en `group` zijn de gewone menselijke
   gesprekken; de rest komt uit een module en draagt in meta.bron mee waar
   vandaan. */
const SOORTEN = ['personal', 'group', 'business', 'order', 'ride', 'school',
  'project', 'support', 'marketplace', 'government', 'event', 'ai'];

/* De laden van de inbox: welke soorten onder welke kop vallen. Dit is de
   "Universal Inbox" uit een gebruikersoogpunt -- Chats > Mobiliteit > Rit
   #RT-1941 -- terwijl het technisch allemaal gesprekken blijven. */
const LADEN = [
  { id: 'mensen', naam: 'Mensen', soorten: ['personal', 'group'] },
  { id: 'zaken', naam: 'Zaken', soorten: ['business', 'project', 'marketplace'] },
  { id: 'onderweg', naam: 'Onderweg', soorten: ['ride', 'order', 'event'] },
  { id: 'officieel', naam: 'Officieel', soorten: ['government', 'school', 'support'] },
  { id: 'rahul', naam: 'Rahul', soorten: ['ai'] }
];

const VLAGGEN = ['vast', 'stil', 'weg'];
const MAX_TEKST = 4000;         // een bericht is een bericht, geen document
const MAX_PER_GESPREK = 500;    // wat we per gesprek bewaren
const MAX_GESPREKKEN = 400;     // per lid, in de inbox
const MAX_DEELNEMERS = 256;
const WIJZIG_MS = 15 * 60000;   // een correctie mag een kwartier lang
const TYPT_MS = 6000;           // "typt..." vervalt vanzelf
const AANWEZIG_MS = 45000;      // zo lang geldt een teken van leven als online

function maakComm({ db, save, crypto, codenaamVan, sseToCustomer }) {
  const nu = () => new Date().toISOString();
  const id = (p) => p + '_' + crypto.randomBytes(8).toString('hex');

  /* ---------------------------------------------------------- opslag */
  function G() {
    if (!Array.isArray(db.data.commGesprekken)) db.data.commGesprekken = [];
    return db.data.commGesprekken;
  }
  function B() {
    if (!db.data.commBerichten || typeof db.data.commBerichten !== 'object') db.data.commBerichten = {};
    return db.data.commBerichten;
  }
  function S() {
    if (!db.data.commStand || typeof db.data.commStand !== 'object') db.data.commStand = {};
    return db.data.commStand;
  }
  const standVan = (key, gid) => ((S()[key] || {})[gid] || {});
  function standZet(key, gid, veld, waarde) {
    const s = S();
    const rij = s[key] = s[key] || {};
    const st = rij[gid] = rij[gid] || {};
    if (waarde === null || waarde === false || waarde === '') delete st[veld];
    else st[veld] = waarde;
    if (!Object.keys(st).length) delete rij[gid];
    return st;
  }

  /* Aanwezigheid en "typt..." staan MET OPZET NIET in de database. Ze zijn
     seconden geldig en zouden bij elke toetsaanslag een schrijfronde kosten;
     na een herstart is "wie is er online" bovendien per definitie onbekend.
     Een Map in het geheugen is hier de eerlijke opslag. */
  const aanwezig = new Map();   // key -> ms
  const typt = new Map();       // gesprekId -> Map(key -> ms)

  /* -------------------------------------------------------- toegang */
  const gesprekVan = (gid) => G().find((g) => g.id === gid) || null;
  const magErin = (g, key) => !!(g && Array.isArray(g.deelnemers) && g.deelnemers.includes(key));
  /* Elke leesweg loopt hierlangs. Geen enkele functie hieronder haalt een
     gesprek op zonder deze poort -- een id raden mag nooit genoeg zijn. */
  function eis(gid, key) {
    const g = gesprekVan(gid);
    if (!g) throw new Error('Dit gesprek bestaat niet.');
    if (!magErin(g, key)) throw new Error('Dit gesprek is niet van jou.');
    return g;
  }

  /* --------------------------------------------------- een gesprek maken */
  /* DE ENIGE MANIER waarop er een gesprek bij komt, en dus de plek waar elke
     module langskomt. Idempotent op meta.sleutel: een rit, een bestelling of
     een ticket vraagt bij elke stap opnieuw om "zijn" gesprek en hoort er dan
     niet elke keer een nieuw te krijgen. Zonder dat zou de taxi-module zelf
     moeten onthouden welk gesprek bij welke rit hoort -- en dan zit de
     koppeling weer in de module in plaats van hier. */
  function gesprekMaak(opties) {
    const o = opties || {};
    const soort = SOORTEN.includes(o.soort) ? o.soort : 'personal';
    const deelnemers = [...new Set((o.deelnemers || []).filter(Boolean).map(String))].slice(0, MAX_DEELNEMERS);
    if (deelnemers.length < 1) throw new Error('Een gesprek heeft deelnemers nodig.');
    const sleutel = o.meta && o.meta.sleutel ? String(o.meta.sleutel).slice(0, 120) : null;
    if (sleutel) {
      const bestaat = G().find((g) => g.meta && g.meta.sleutel === sleutel);
      if (bestaat) {
        /* Wie er later bij komt (een tweede chauffeur, een collega die de zaak
           overneemt) schuift gewoon aan. Wie eruit moet, gaat er niet vanzelf
           uit: dat is een handeling met gevolgen en hoort een eigen weg te
           hebben, niet een neveneffect van "maak dit gesprek nog eens". */
        for (const d of deelnemers) if (!bestaat.deelnemers.includes(d)) bestaat.deelnemers.push(d);
        save();
        return bestaat;
      }
    }
    const g = {
      id: id('gsp'), soort,
      titel: String(o.titel || '').slice(0, 120) || null,
      deelnemers, door: o.door || deelnemers[0],
      op: nu(), laatst: nu(),
      meta: Object.assign({}, o.meta || {})
    };
    G().push(g);
    B()[g.id] = [];
    save();
    return g;
  }

  /* Het een-op-een gesprek tussen twee leden is er precies een, welke kant je
     het ook opent. De sleutel is daarom de twee sleutels op alfabet -- zonder
     dat krijg je twee gesprekken die elkaars berichten niet zien, en dat is
     het soort fout dat pas opvalt als iemand zegt "ik heb je wel geantwoord". */
  function tussen(a, b, opties) {
    const paar = [String(a), String(b)].sort();
    return gesprekMaak(Object.assign({ soort: 'personal', deelnemers: paar,
      meta: { sleutel: 'paar:' + paar.join('|') } }, opties || {}));
  }

  /* ------------------------------------------------------ een bericht */
  function bericht(opties) {
    const o = opties || {};
    const g = eis(o.gesprekId, o.van);
    const tekst = String(o.tekst == null ? '' : o.tekst).slice(0, MAX_TEKST).trim();
    const bijlage = o.bijlage && typeof o.bijlage === 'object' ? o.bijlage : null;
    if (!tekst && !bijlage) throw new Error('Een leeg bericht versturen doet niets.');
    if (o.antwoordOp) {
      // antwoorden op een bericht uit een ander gesprek zou een citaat maken
      // van iets waar de lezer geen toegang toe heeft
      const bron = (B()[g.id] || []).find((m) => m.id === o.antwoordOp);
      if (!bron) throw new Error('Dat bericht staat niet in dit gesprek.');
    }
    const m = {
      id: id('brc'), van: o.van, at: nu(),
      tekst: tekst || null,
      soort: o.soort || (bijlage ? bijlage.soort || 'bijlage' : 'tekst'),
      antwoordOp: o.antwoordOp || null,
      bijlage: bijlage,
      /* De brontaal reist mee met het bericht en niet met de lezer. Dat lijkt
         een detail tot iemand van taal wisselt: dan moet een oud bericht nog
         steeds vertaald kunnen worden vanaf de taal waarin het GESCHREVEN is,
         en niet vanaf de taal die de schrijver vandaag toevallig heeft staan. */
      lang: o.lang || null,
      reacties: {}
    };
    const lijst = B()[g.id] = B()[g.id] || [];
    lijst.push(m);
    if (lijst.length > MAX_PER_GESPREK) lijst.splice(0, lijst.length - MAX_PER_GESPREK);
    g.laatst = m.at;
    // de afzender heeft zijn eigen bericht per definitie gelezen
    standZet(o.van, g.id, 'gelezen', m.at);
    standZet(o.van, g.id, 'concept', null);
    save();
    seinNaarDeRest(g, o.van, 'bericht', { gesprekId: g.id, bericht: toonBericht(m, o.van) });
    return m;
  }

  /* Iedereen behalve de afzender krijgt het sein. Wie het gesprek stil heeft
     gezet krijgt het OOK -- stil gaat over meldingen, niet over of het scherm
     bijwerkt; een gesprek dat pas na een verversing verandert voelt kapot. */
  function seinNaarDeRest(g, behalve, event, data) {
    if (!sseToCustomer) return;
    for (const d of g.deelnemers) {
      if (d === behalve) continue;
      try { sseToCustomer(d, 'comm', Object.assign({ soort: event }, data)); } catch (e) {}
    }
  }

  /* ------------------------------------------- wijzigen, wissen, reageren */
  /* Een correctie binnen een kwartier, en daarna niet meer. De oorspronkelijke
     tekst blijft in `was` staan: "bewerkt" zonder te kunnen zien wat er stond
     is een uitnodiging om een gesprek achteraf te herschrijven. */
  function wijzig(key, gesprekId, berichtId, tekst) {
    const g = eis(gesprekId, key);
    const m = (B()[g.id] || []).find((x) => x.id === berichtId);
    if (!m) throw new Error('Dat bericht bestaat niet.');
    if (m.van !== key) throw new Error('Je kunt alleen je eigen bericht wijzigen.');
    if (m.weg) throw new Error('Dit bericht is ingetrokken.');
    if (Date.now() - Date.parse(m.at) > WIJZIG_MS) throw new Error('Dit bericht is te oud om nog te wijzigen.');
    const nieuw = String(tekst || '').slice(0, MAX_TEKST).trim();
    if (!nieuw) throw new Error('Een bericht leegmaken is intrekken, niet wijzigen.');
    m.was = m.was || m.tekst;
    m.tekst = nieuw;
    m.gewijzigd = nu();
    save();
    seinNaarDeRest(g, key, 'wijzig', { gesprekId: g.id, berichtId: m.id });
    return m;
  }

  /* Intrekken laat een spoor achter, en dat is met opzet: de andere kant heeft
     het gelezen, en doen alsof er nooit iets stond is liegen tegen wie erbij
     was. Wat weg is, is de inhoud. */
  function wis(key, gesprekId, berichtId) {
    const g = eis(gesprekId, key);
    const m = (B()[g.id] || []).find((x) => x.id === berichtId);
    if (!m) throw new Error('Dat bericht bestaat niet.');
    if (m.van !== key) throw new Error('Je kunt alleen je eigen bericht intrekken.');
    m.weg = nu(); m.tekst = null; m.bijlage = null; m.was = null; m.reacties = {};
    save();
    seinNaarDeRest(g, key, 'wis', { gesprekId: g.id, berichtId: m.id });
    return m;
  }

  function reactie(key, gesprekId, berichtId, teken) {
    const g = eis(gesprekId, key);
    const m = (B()[g.id] || []).find((x) => x.id === berichtId);
    if (!m) throw new Error('Dat bericht bestaat niet.');
    if (m.weg) throw new Error('Dit bericht is ingetrokken.');
    // een reactie is een teken, geen zin: langer dan dat is een bericht
    const t = String(teken || '').slice(0, 8);
    if (!t) throw new Error('Welke reactie?');
    m.reacties = m.reacties || {};
    const wie = m.reacties[t] = m.reacties[t] || [];
    const i = wie.indexOf(key);
    if (i >= 0) wie.splice(i, 1); else wie.push(key);   // nog een tik haalt hem weg
    if (!wie.length) delete m.reacties[t];
    save();
    seinNaarDeRest(g, key, 'reactie', { gesprekId: g.id, berichtId: m.id });
    return m.reacties;
  }

  /* ------------------------------------------------------ standen */
  function lees(key, gesprekId) {
    const g = eis(gesprekId, key);
    standZet(key, g.id, 'gelezen', nu());
    save();
    seinNaarDeRest(g, key, 'gelezen', { gesprekId: g.id, wie: codenaamVan ? codenaamVan(key) : null });
    return standVan(key, g.id);
  }
  function vlag(key, gesprekId, welke, aan) {
    if (!VLAGGEN.includes(welke)) throw new Error('Onbekende vlag.');
    eis(gesprekId, key);
    const st = standZet(key, gesprekId, welke, !!aan || null);
    save();
    return st;
  }
  /* Het concept reist mee tussen apparaten. Een half getypt bericht dat weg is
     omdat je van telefoon naar laptop wisselde, is precies het soort verlies
     dat je niet aan de app vergeeft. */
  function concept(key, gesprekId, tekst) {
    eis(gesprekId, key);
    const st = standZet(key, gesprekId, 'concept', String(tekst || '').slice(0, MAX_TEKST) || null);
    save();
    return st;
  }

  /* -------------------------------------------- aanwezigheid en typen */
  function levensteken(key) { aanwezig.set(key, Date.now()); }
  const isAanwezig = (key) => (Date.now() - (aanwezig.get(key) || 0)) < AANWEZIG_MS;
  function typtNu(key, gesprekId) {
    const g = eis(gesprekId, key);
    levensteken(key);
    const m = typt.get(g.id) || new Map();
    m.set(key, Date.now());
    typt.set(g.id, m);
    seinNaarDeRest(g, key, 'typt', { gesprekId: g.id, wie: codenaamVan ? codenaamVan(key) : null });
    return true;
  }
  function wieTypt(gesprekId, behalve) {
    const m = typt.get(gesprekId);
    if (!m) return [];
    const uit = [];
    for (const [key, t] of m) {
      if (Date.now() - t > TYPT_MS) { m.delete(key); continue; }
      if (key === behalve) continue;
      uit.push(codenaamVan ? codenaamVan(key) : key);
    }
    return uit.filter(Boolean);
  }

  /* ------------------------------------------------------------- nudge */
  /* De buzz van MSN, en de reden dat hij hier mag staan is dat hij iets kan wat
     een bericht niet kan: door "stil" heen komen. Precies daarom is hij ook
     begrensd -- een aandachtsknop zonder rem is een pestknop. Een per minuut
     per gesprek, en alleen in een gesprek waar de ander je al kent. */
  const nudges = new Map();     // key|gesprekId -> ms
  const NUDGE_MS = 60000;
  function nudge(key, gesprekId) {
    const g = eis(gesprekId, key);
    const s = key + '|' + gesprekId;
    const laatst = nudges.get(s) || 0;
    if (Date.now() - laatst < NUDGE_MS) {
      throw new Error('Even wachten -- een por mag een keer per minuut.');
    }
    nudges.set(s, Date.now());
    seinNaarDeRest(g, key, 'nudge', { gesprekId: g.id, wie: codenaamVan ? codenaamVan(key) : null });
    return true;
  }

  /* --------------------------------------------------------- tonen */
  const naam = (key) => (codenaamVan ? codenaamVan(key) : null) || 'Onbekend';

  function toonBericht(m, mij) {
    return {
      id: m.id, at: m.at, vanMij: m.van === mij, van: naam(m.van),
      tekst: m.weg ? null : m.tekst, soort: m.soort,
      bijlage: m.weg ? null : (m.bijlage || null),
      antwoordOp: m.antwoordOp || null,
      reacties: Object.entries(m.reacties || {}).map(([teken, wie]) => ({
        teken, aantal: wie.length, vanMij: wie.includes(mij)
      })),
      gewijzigd: m.gewijzigd || null, was: m.gewijzigd ? m.was : null,
      lang: m.lang || null,
      weg: m.weg || null
    };
  }

  /* De titel van een een-op-een gesprek is de codenaam van de ANDER, en die
     hangt dus af van wie er kijkt. Vandaar hier en niet in het gesprek zelf:
     een opgeslagen titel zou voor een van beiden altijd de verkeerde zijn. */
  function toonGesprek(g, mij) {
    const lijst = B()[g.id] || [];
    const st = standVan(mij, g.id);
    const laatste = [...lijst].reverse().find((m) => !m.weg) || lijst[lijst.length - 1] || null;
    const gelezen = st.gelezen || '';
    const ongelezen = lijst.filter((m) => m.van !== mij && !m.weg && m.at > gelezen).length;
    const anderen = g.deelnemers.filter((d) => d !== mij);
    return {
      id: g.id, soort: g.soort, lade: ladeVan(g.soort),
      titel: g.titel || (anderen.length === 1 ? naam(anderen[0]) : anderen.map(naam).join(', ')) || 'Gesprek',
      deelnemers: anderen.map(naam), aantal: g.deelnemers.length,
      laatste: laatste ? (laatste.weg ? 'Bericht ingetrokken' : (laatste.tekst || '(bijlage)')).slice(0, 140) : null,
      laatsteVanMij: laatste ? laatste.van === mij : false,
      at: g.laatst, ongelezen,
      vast: !!st.vast, stil: !!st.stil, weg: !!st.weg, concept: st.concept || null,
      online: anderen.length === 1 ? isAanwezig(anderen[0]) : anderen.some(isAanwezig),
      bron: (g.meta && g.meta.bron) || null, link: (g.meta && g.meta.link) || null
    };
  }
  const ladeVan = (soort) => (LADEN.find((l) => l.soorten.includes(soort)) || LADEN[0]).id;

  /* ------------------------------------------------------------ lezen */
  function inbox(mij, opties) {
    const o = opties || {};
    let mijne = G().filter((g) => magErin(g, mij));
    if (o.lade) {
      const lade = LADEN.find((l) => l.id === o.lade);
      if (lade) mijne = mijne.filter((g) => lade.soorten.includes(g.soort));
    }
    const uit = mijne.map((g) => toonGesprek(g, mij))
      .filter((g) => o.archief ? g.weg : !g.weg)
      .sort((a, b) => (b.vast ? 1 : 0) - (a.vast ? 1 : 0) ||
        String(b.at || '').localeCompare(String(a.at || '')));
    return { gesprekken: uit.slice(0, MAX_GESPREKKEN), laden: LADEN };
  }

  function gesprek(mij, gesprekId, opties) {
    const g = eis(gesprekId, mij);
    const o = opties || {};
    const lijst = B()[g.id] || [];
    const vanaf = Math.max(0, lijst.length - (Number(o.aantal) || 120));
    return Object.assign(toonGesprek(g, mij), {
      berichten: lijst.slice(vanaf).map((m) => toonBericht(m, mij)),
      meer: vanaf > 0,
      typt: wieTypt(g.id, mij)
    });
  }

  /* Zoeken over ALLES wat van jou is, in een keer. Dit is wat een berichtenapp
     onderscheidt van een archiefkast: niet weten in welke module iets stond en
     het toch vinden. */
  function zoek(mij, vraag) {
    const naald = String(vraag || '').trim().toLowerCase().slice(0, 80);
    if (naald.length < 2) return { treffers: [], vraag: naald };
    const uit = [];
    for (const g of G()) {
      if (!magErin(g, mij)) continue;
      for (const m of (B()[g.id] || [])) {
        if (m.weg || !m.tekst) continue;
        if (!m.tekst.toLowerCase().includes(naald)) continue;
        uit.push({ gesprekId: g.id, berichtId: m.id, soort: g.soort, lade: ladeVan(g.soort),
          titel: toonGesprek(g, mij).titel, tekst: m.tekst.slice(0, 160),
          at: m.at, vanMij: m.van === mij });
      }
    }
    uit.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    return { treffers: uit.slice(0, 60), vraag: naald, totaal: uit.length };
  }

  /* De draad als leesbare regels, voor de AI-laag (./ai). Alleen codenamen,
     alleen dit gesprek, alleen wat er nu staat. Dit is het ENIGE wat een model
     van een gesprek te zien krijgt. */
  function draad(mij, gesprekId, hoeveel) {
    const g = eis(gesprekId, mij);
    const lijst = (B()[g.id] || []).filter((m) => !m.weg && m.tekst);
    return {
      titel: toonGesprek(g, mij).titel,
      regels: lijst.slice(-(hoeveel || 60)).map((m) => (m.van === mij ? 'Ik' : naam(m.van)) + ': ' + m.tekst)
    };
  }

  /* Twee deuren voor de verhuizing van een oude voorraad (./dm.js), en
     bewust smal: de geschiedenis moet MET zijn eigen tijdstempels naar binnen
     kunnen, en de leesstand moet meeverhuizen. Via bericht() zou alles op NU
     komen te staan -- een gesprek van twee jaar dat er ineens uitziet alsof
     het vanmiddag gebeurde. Wie niets te verhuizen heeft, gebruikt bericht(). */
  const berichtenVan = (gesprekId) => (B()[gesprekId] = B()[gesprekId] || []);
  function leesZet(key, gesprekId, at) {
    if (!key || !at) return;
    const nuStand = standVan(key, gesprekId).gelezen || '';
    if (at > nuStand) standZet(key, gesprekId, 'gelezen', at);
  }

  return {
    SOORTEN, LADEN,
    // voor andere modules: dit is de hele koppelvlakte
    gesprekMaak, tussen, bericht, gesprekVan, magErin,
    berichtenVan, leesZet,
    // voor de app
    inbox, gesprek, zoek, draad,
    lees, vlag, concept, wijzig, wis, reactie,
    levensteken, isAanwezig, typtNu, wieTypt, nudge
  };
}

module.exports = { SOORTEN, LADEN, maakComm };
