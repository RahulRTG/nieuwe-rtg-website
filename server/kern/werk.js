/* De werk-laag: vacatures, de sollicitatiechat tussen werkgever en sollicitant,
   en de automatische berichtvertaling van chats. VAC_SOORTEN is pure data; de
   rekenende functies dragen db + i18n + de leverancier-/realtime-helpers en
   komen uit maakWerk(state).

   Privacy: wie via de RTFoundation solliciteert, is voor de werkgever niet als
   zodanig herkenbaar (werkgeverSollicitatie verwijdert de interne velden). */

/* Wat een werkgever van een sollicitatie ziet: zie werkgeverSollicitatie. */
const WERKGEVER_VELDEN = Object.freeze(['id', 'name', 'func', 'contact', 'note', 'status', 'at', 'vacatureId', 'cv']);

const VAC_SOORTEN = ['bijbaan', 'fulltime', 'parttime', 'stage', 'vrijwilliger', 'vakantiewerk'];

function maakWerk({ db, save, i18n, mail, LANDEN, findSupplier, sseToSupplier, sseToCustomer, notifySupplier, notify, commWerk, rtf, meldLidVan }) {
  /* Chatvertaling: iedereen schrijft in de eigen taal, de ontvanger leest het in
     de zijne. Vertalingen worden per bericht gecachet. */
  async function trChat(messages, to) {
    const out = [];
    for (const m of messages) {
      const from = m.lang || 'nl';
      if (from === to || !m.text) { out.push({ ...m, orig: null }); continue; }
      m.tr = m.tr || {};
      if (!m.tr[to]) {
        try {
          const r = await i18n.translate(m.text, to, from);
          m.tr[to] = (r && typeof r === 'object') ? (r.text || m.text) : String(r || m.text);
          save();
        } catch (e) { m.tr[to] = m.text; }
      }
      out.push({ ...m, text: m.tr[to], orig: m.text, tr: undefined });
    }
    return out;
  }

  function chatApplicant(a) {
    if (a.viaRTF && a.rtf) return { kind: 'rtf', gezinCode: a.rtf.code, profielId: a.rtf.profielId, naam: a.name };
    if (a.key) return { kind: 'rtg', key: a.key, naam: a.name };
    return null; // anoniem: geen in-app chat
  }
  function ensureApplyChat(supplierCode, a) {
    if (db.data.applyChats[a.id]) return db.data.applyChats[a.id];
    const applicant = chatApplicant(a);
    if (!applicant) return null;
    const s = findSupplier(supplierCode);
    const chat = { id: a.id, supplierCode, func: a.func, bedrijf: s ? s.name : supplierCode, applicant, berichten: [], at: new Date().toISOString() };
    db.data.applyChats[a.id] = chat;
    return chat;
  }
  /* DE BERICHTEN KOMEN SINDS DE VERHUIZING UIT DE COMMUNICATIEKERN
     (kern/comm/werk.js), niet meer uit chat.berichten. De VORM blijft dezelfde
     ({ van, wie, tekst, at }) zodat de schermen van de sollicitant, de
     werkgever en de RTF-app niets merken -- een verhuizing van de opslag hoort
     niet zichtbaar te zijn in een scherm.

     commWerk komt binnen als FUNCTIE en niet als verwijzing: deze laag wordt
     opgebouwd voor de kern bestaat, dus wordt hij op het moment van aanroepen
     opgehaald (zelfde constructie als convOf in kern/comm/bronnen.js). */
  const kernBerichten = (chat) => {
    const w = commWerk && commWerk();
    return w ? w.berichten(chat.id) : (chat.berichten || []);
  };
  function applyChatPubliek(chat) {
    return { id: chat.id, func: chat.func, bedrijf: chat.bedrijf, metWie: chat.applicant.naam,
      berichten: kernBerichten(chat).map(m => ({ van: m.van, wie: m.wie, tekst: m.tekst, at: m.at })) };
  }
  /* Als applyChatPubliek, maar elk bericht vertaald naar de taal van de kijker
     (zelfde per-bericht-cache als trChat). Zo chatten werkgever en sollicitant
     ieder in de eigen taal en leest de ander alles in de zijne. */
  async function applyChatVertaald(chat, to) {
    const pub = applyChatPubliek(chat);
    const bron = kernBerichten(chat);
    pub.berichten = [];
    for (const m of bron) {
      const from = m.lang || 'nl';
      if (from === to || !m.tekst) { pub.berichten.push({ van: m.van, wie: m.wie, tekst: m.tekst, at: m.at, orig: null }); continue; }
      m.tr = m.tr || {};
      if (!m.tr[to]) {
        try {
          const r = await i18n.translate(m.tekst, to, from);
          m.tr[to] = (r && typeof r === 'object') ? (r.text || m.tekst) : String(r || m.tekst);
          save();
        } catch (e) { m.tr[to] = m.tekst; }
      }
      pub.berichten.push({ van: m.van, wie: m.wie, tekst: m.tr[to], orig: m.tekst, at: m.at });
    }
    return pub;
  }
  // stuur een chatbericht; 'van' is 'werkgever' of 'sollicitant'; lang = de
  // taal waarin de schrijver typt (voor de vertaling naar de andere kant)
  /* Versturen gaat naar de kern; de seintjes en de controles eromheen blijven
     hier staan, want die gaan over werk en niet over berichten. */
  function chatStuur(chat, van, wie, tekst, lang) {
    const w = commWerk && commWerk();
    if (!w) return null;
    const bericht = w.stuur(chat.id, van, wie, tekst, lang || 'nl');
    if (!bericht) return null;
    // live seintje naar de andere kant
    sseToSupplier(chat.supplierCode, 'sync', { scope: 'team' });
    if (chat.applicant.kind === 'rtg' && chat.applicant.key) sseToCustomer(chat.applicant.key, 'sync', { scope: 'apply' });
    return bericht;
  }
  // een bericht van de sollicitant laat de werkgever meteen iets weten
  function meldWerkgever(chat, tekst) {
    notifySupplier(chat.supplierCode, { icon: 'berichten', title: 'Bericht van ' + chat.applicant.naam, body: String(tekst).slice(0, 80) });
  }

  /* Openbare lijst met alle openstaande vacatures over alle partners heen. De
     RTF-app filtert op de leeftijdsgroep van het profiel (vanaf 16 jaar). */
  function openVacatures(minLeeftijd, land) {
    const uit = [];
    for (const [code, list] of Object.entries(db.data.vacatures || {})) {
      const s = findSupplier(code);
      if (!s) continue;
      const t = Object.assign({}, db.data.supplierTypes[s.type] || {}, { caps: db.capsVan(s) });
      const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
      if (land && landCode !== land) continue;
      for (const v of list) {
        if (!v.open) continue;
        if (minLeeftijd != null && v.minLeeftijd > minLeeftijd) continue;
        uit.push({
          id: v.id, supplierCode: code, bedrijf: s.name, soort: v.soort,
          type: s.type || null, typeLabel: t.label || null, icon: t.icon || 'gebouw',
          func: v.func, omschrijving: v.omschrijving, plaats: v.plaats, uren: v.uren,
          salarisMin: v.salarisMin || null, salarisMax: v.salarisMax || null,
          valuta: v.valuta || 'EUR', werkvorm: v.werkvorm || null,
          vaardigheden: Array.isArray(v.vaardigheden) ? v.vaardigheden.slice(0, 12) : [],
          voordelen: Array.isArray(v.voordelen) ? v.voordelen.slice(0, 10) : [],
          minLeeftijd: v.minLeeftijd, at: v.at,
          // land van het bedrijf: RTG is internationaal, dus je solliciteert ook
          // gerust in het buitenland
          land: landCode, landNaam: LANDEN[landCode].naam,
          // locatie van het bedrijf, zodat de app de afstand kan tonen
          loc: s.loc ? { lat: s.loc.lat, lng: s.loc.lng, label: s.loc.label } : null,
          stad: s.city || null
        });
      }
    }
    uit.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return uit;
  }

  /* Wat de werkgever van een sollicitatie te zien krijgt. Wie via de RTFoundation
     solliciteert, verschijnt bij het bedrijf precies als een gewoon RTG-lid; de
     herkomst (viaRTF), de sessiesleutel en de gezinsverwijzing blijven intern. */
  /* EEN POSITIEVE LIJST EN GEEN WEGLAATLIJST. Hier stond `{ viaRTF, key, rtf,
     ...rest }`, en dat lekte via wat er ONTBRAK: een ledenrij hield `codename` en
     `vacatureId`, een RTF-rij had ze allebei niet, dus een werkgever las de
     Foundation-herkomst af aan twee lege velden (ARBEID.md par. 4 punt 1). Bij
     een weglaatlijst passeert elk nieuw veld de grens vanzelf; hier blijft elk
     nieuw veld buiten tot iemand het er bewust bij zet (dezelfde richting als
     AI-CONTEXT-01). `codename` gaat met opzet naar NIEMAND: de werkgeverschermen
     lezen hem niet, en een codenaam naast een echte naam is precies de koppeling
     die het codenaamontwerp voorkomt. `viaRTG` en `cv` zijn wat een lid en een
     gezinslid gemeen hebben; een anonieme sollicitant zonder app heeft ze niet,
     en dat verschil is echt en geen herkomst. */
  function werkgeverSollicitatie(a) {
    if (!a) return a;
    const uit = {};
    for (const veld of WERKGEVER_VELDEN) if (a[veld] !== undefined) uit[veld] = a[veld];
    if (a.viaRTG || a.viaRTF) uit.viaRTG = true; // RTF-sollicitant lijkt op een gewoon RTG-lid
    return uit;
  }

  /* De bezorging van een besluit bij de sollicitant staat in een DEELMODULE.
     Niet om de omvangband te halen maar omdat het een eigen onderwerp is: dit
     bestand gaat over vacatures en de sollicitatiechat, en ./werk-bezorging.js
     over de vraag langs welke weg je een mens bereikt die misschien geen lid
     is. Dezelfde naad als foundation/leeftijdsgroepen.js. */
  const { notifyApplicant } = require('./werk-bezorging')({
    rtf, mail, meldLidVan, sseToCustomer });

  return { trChat, chatApplicant, ensureApplyChat, applyChatPubliek, applyChatVertaald, chatStuur, meldWerkgever, openVacatures, werkgeverSollicitatie, notifyApplicant };
}

module.exports = { VAC_SOORTEN, WERKGEVER_VELDEN, maakWerk };
