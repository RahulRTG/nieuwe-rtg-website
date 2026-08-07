/* De Berichten-app: alle gesprekken van het platform op een plek, en de
   AI die er echt in zit.

   De app was een leeslijst die doorverwees naar de bron-app. Wat hier bij komt
   is wat een berichtenapp hoort te kunnen: zoeken over ALLE kanalen tegelijk,
   een gesprek vastzetten/stilzetten/archiveren, en drie dingen die je met de
   hand niet kunt -- een lang gesprek laten samenvatten, een antwoord laten
   opstellen, en de afspraken eruit laten halen.

   Drie regels die het ontwerp sturen:
   1. De AI STELT OP, hij VERSTUURT NOOIT. Een concept komt terug als tekst in
      het invoerveld; er gaat pas iets weg als de mens op versturen tikt. Dat is
      dezelfde drempel als bij geld.
   2. Alles blijft op codenaam. De zoekindex kent geen echte namen -- die staan
      in de gescheiden kluis en komen hier niet langs.
   3. Geen AI-antwoord verzinnen als de AI er niet is. Dan komt er een eerlijke
      melding terug, geen nepsamenvatting.

   De vlaggen (vast/stil/weg) staan per lid in db.data.berichtVlaggen. Gedeelde
   context vanuit server.js, volgens het vaste kern-patroon. */
/* De priveberichten staan sinds de verhuizing in de communicatiekern
   (kern/comm + kern/comm/dm) en niet meer in db.data.memberChats. Deze laag
   leest ze daar op; hij komt binnen als een functie omdat de kern later wordt
   opgebouwd dan deze module. Zonder dit vond het zoeken over "alle kanalen"
   precies de kanalen die verhuisd waren niet meer -- en dat is de stilste fout
   van allemaal: een zoekopdracht die niets vindt ziet er hetzelfde uit als een
   zoekopdracht zonder treffers. */
module.exports = ({ db, save, socialConnecties, dmSleutel, codenaamVan, rtmail, overheid, anthropic, commDm }) => {
  const DM = () => (typeof commDm === 'function' ? commDm() : null);
    const MAX_TREFFERS = 40;
  const MAX_KANALEN = 100;       // gesprekken die een zoekopdracht doorloopt
  const MAX_PER_KANAAL = 300;    // berichten per gesprek (dat is ook de bewaargrens)
  const DRAAD_MAX = 60;          // berichten die de AI van een gesprek te zien krijgt (zie ./ai)
  const SNIPPET = 140;

  function V() {
    if (!db.data.berichtVlaggen || typeof db.data.berichtVlaggen !== 'object') db.data.berichtVlaggen = {};
    return db.data.berichtVlaggen;
  }
  const vlaggenVan = mij => (V()[mij] || {});
  /* Een vlag omzetten. Drie standen, elk met een reden om te bestaan:
     vast = bovenaan houden, stil = geen meldingen, weg = uit de lijst (niet
     verwijderd: het gesprek blijft, je ziet het alleen niet meer staan). */
  function vlagZet(mij, id, vlag, aan) {
    if (!['vast', 'stil', 'weg'].includes(vlag)) throw new Error('Onbekende vlag.');
    const v = V();
    const rij = v[mij] = v[mij] || {};
    const k = String(id || '').slice(0, 120);
    if (!k) throw new Error('Welk gesprek?');
    rij[k] = rij[k] || {};
    if (aan) rij[k][vlag] = true; else delete rij[k][vlag];
    if (!Object.keys(rij[k]).length) delete rij[k];
    save();
    return rij[k] || {};
  }

  /* ---- zoeken over alles ----
     Een berichtenapp zonder zoeken is een archiefkast zonder register. Dit
     doorzoekt de prive-gesprekken, RTMAIL, de sollicitatie-chats en de
     Berichtenbox in EEN keer, en geeft per treffer terug in welk kanaal hij
     zit en met welk stukje tekst, zodat je meteen ziet waarom het een treffer is. */
  const raak = (tekstje, naald) => String(tekstje || '').toLowerCase().includes(naald);
  function snip(t, naald) {
    const s = String(t || '');
    const i = s.toLowerCase().indexOf(naald);
    if (i < 0) return s.slice(0, SNIPPET);
    const van = Math.max(0, i - 40);
    return (van ? '...' : '') + s.slice(van, van + SNIPPET);
  }
  function zoek(mij, vraag) {
    const naald = String(vraag || '').trim().toLowerCase().slice(0, 80);
    if (naald.length < 2) return { treffers: [], vraag: naald };
    const uit = [];
    /* 1. prive-gesprekken met verbonden leden. Begrensd op beide assen: een lid
       met honderden connecties mag met een zoekopdracht niet de event-loop
       vasthouden. Wie verder terug wil, gebruikt het gesprek zelf. */
    try {
      const brug = DM();
      for (const c of (socialConnecties(mij).connections || []).slice(0, MAX_KANALEN)) {
        if (!brug) break;
        const naam = c.codename || codenaamVan(c.key);
        for (const m of brug.berichten(mij, c.key, MAX_PER_KANAAL)) {
          if (!raak(m.text, naald)) continue;
          uit.push({ soort: 'dm', id: 'dm:' + c.key, titel: naam, tekst: snip(m.text, naald),
            at: m.at, vanMij: m.from === mij, link: '/apps/comm.html?met=' + encodeURIComponent(c.key) });
        }
      }
    } catch (e) {}
    // 2. RTMAIL
    try {
      const codenaam = codenaamVan(mij);
      if (rtmail && codenaam) {
        for (const b of rtmail.postvak(codenaam, { limit: 200 })) {
          if (!raak(b.onderwerp, naald) && !raak(b.tekst, naald)) continue;
          uit.push({ soort: 'rtmail', id: 'rtmail:' + b.id, titel: b.onderwerp,
            tekst: snip(b.tekst || b.onderwerp, naald), at: b.at, link: '/apps/rtmail.html' });
        }
      }
    } catch (e) {}
    // 3. sollicitatie-chats
    try {
      for (const c of Object.values(db.data.applyChats || {})) {
        if (!c.applicant || c.applicant.kind !== 'rtg' || c.applicant.key !== mij) continue;
        for (const b of (c.berichten || [])) {
          if (!raak(b.tekst, naald)) continue;
          uit.push({ soort: 'werk', id: 'werk:' + (c.id || c.vacId), titel: c.bedrijf + ' - ' + c.func,
            tekst: snip(b.tekst, naald), at: b.at, vanMij: b.van === 'sollicitant', link: '/apps/app.html' });
        }
      }
    } catch (e) {}
    // 4. de Berichtenbox van MijnOverheid
    try {
      for (const b of (overheid.berichten(mij).berichten || [])) {
        if (!raak(b.titel, naald) && !raak(b.tekst, naald)) continue;
        uit.push({ soort: 'overheid', id: 'overheid:' + b.id, titel: b.titel,
          tekst: snip(b.tekst || b.titel, naald), at: b.at, link: '/apps/overheid.html' });
      }
    } catch (e) {}
    uit.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    return { treffers: uit.slice(0, MAX_TREFFERS), vraag: naald, totaal: uit.length };
  }

  /* ---- een gesprek als leesbare tekst, voor de AI ----
     Alleen de laatste DRAAD_MAX berichten, op codenaam, zonder enige verwijzing
     naar wie iemand echt is. Dit is het enige wat de AI van een gesprek ziet. */
  function draad(mij, id) {
    const [soort, sleutel] = String(id || '').split(':');
    if (soort === 'dm') {
      const brug = DM();
      const berichten = brug ? brug.berichten(mij, sleutel, DRAAD_MAX) : [];
      if (!berichten.length) return null;
      const naam = codenaamVan(sleutel) || 'de ander';
      return { titel: naam, regels: berichten
        .map(m => (m.from === mij ? 'Ik' : naam) + ': ' + String(m.text || '(gedeelde post)')) };
    }
    if (soort === 'werk') {
      const c = Object.values(db.data.applyChats || {})
        .find(x => String(x.id || x.vacId) === sleutel && x.applicant && x.applicant.key === mij);
      if (!c) return null;
      return { titel: c.bedrijf + ' - ' + c.func, regels: (c.berichten || []).slice(-DRAAD_MAX)
        .map(b => (b.van === 'sollicitant' ? 'Ik' : c.bedrijf) + ': ' + String(b.tekst || '')) };
    }
    return null;
  }

  /* De drie AI-taken (samenvatten, een antwoord opstellen, de afspraken eruit
     halen) staan in ./ai: dat is een eigen onderwerp met eigen opdrachten aan
     het model, en het hoort niet door de zoek- en vlaggenlogica heen te lopen. */
  const ai = require('./ai')({ draad, anthropic });

  return { vlaggenVan, vlagZet, zoek, draad, samenvat: ai.samenvat, concept: ai.concept, afspraken: ai.afspraken };
};
