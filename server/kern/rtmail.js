/* Intern RTG-postsysteem. Vertrouwde systeem-, lid-, zaak- en schoolpost loopt
   gescheiden van externe post. Externe links openen niet en bijlagen bestaan
   hier niet. Een geld- of toegangsactie blijft altijd bij de bestaande poort. */
const adresLaag = require('./rtmail-adres');
const { datum: klokDatum } = require('../lib/klok');

module.exports = ({ db, save, crypto, integriteitSleutel }) => {
  const SYSTEEM = 'rtg@rtmail';
  const MAX = 20000; // ruwe bovengrens op het totaal, zodat het geheugen begrensd blijft
  // De bronnen die het vertrouwen bepalen. Alleen deze drie zijn vertrouwd;
  // alles daarbuiten valt terug op 'extern' en is dus geblokkeerd.
  const VERTROUWDE_BRONNEN = ['systeem', 'lid', 'zaak', 'school'];
  const veiligheid = require('./rtmail-veiligheid')({ crypto, sleutel:integriteitSleutel });

  const kap = (s, n) => String(s == null ? '' : s).slice(0, n);
  // adres normaliseren: kleine letters, geen rare tekens, en "@rtmail" erachter
  // als er nog geen domein staat. Zo is "SAKURA" hetzelfde als "sakura@rtmail".
  function normAdres(a) {
    let s = String(a == null ? '' : a).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    if (!s) return '';
    if (!s.includes('@')) s = s + '@rtmail';
    return s.slice(0, 80);
  }

  // Binnen RTG blijft het linkerdeel leidend, zodat een paswissel geen post breekt.
  const zelfdeBus = adresLaag.zelfdeBus;

  /* De veiligheidsscan op de tekst staat in ./rtmail-links.js: dat is
     tekstanalyse zonder database en zonder netwerk, en hoort dus niet in een
     bestand dat over bezorgen gaat. */
  const { scanLinks } = require('./rtmail-links');

  // De bron opschonen tot een van de bekende waarden; onbekend -> 'extern'.
  function schoonBron(bron, van) {
    if (van === SYSTEEM) return 'systeem';
    const b = String(bron || '').trim().toLowerCase();
    return VERTROUWDE_BRONNEN.includes(b) ? b : 'extern';
  }

  function store() {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  }

  // De geverifieerde serverroute zet `bron`; de client bepaalt dit vertrouwen niet.
  function stuur({ van, naar, onderwerp, tekst, soort, bron, antwoordOp } = {}) {
    const naarA = normAdres(naar);
    if (!naarA) return { error: 'Geen geldig ontvang-adres.' };
    const vanA = normAdres(van) || SYSTEEM;
    const b = schoonBron(bron, vanA);
    const tekstK = kap(tekst, 8000);
    const links = scanLinks(tekstK);
    const msg = {
      id: crypto.randomBytes(6).toString('hex'),
      van: vanA,
      naar: naarA,
      onderwerp: kap(onderwerp, 160) || '(geen onderwerp)',
      tekst: tekstK,
      soort: kap(soort, 24) || 'bericht',
      bron: b,
      vertrouwd: VERTROUWDE_BRONNEN.includes(b),
      links, // { externeLinks:[], aantal, gevaarlijk }
      bijlagen: [], // RTMAIL draagt nooit een te openen bijlage -- bewust altijd leeg
      at: klokDatum().toISOString(),
      gelezen: false
    };
    const s = store();
    /* De DRAAD (het gesprek). Een antwoord erft de draad van het bericht waarop
       het antwoordt; een nieuw bericht begint zijn eigen draad met zijn eigen
       id. Bewust GEEN groepering op onderwerp: "Re: vraag" van twee losse
       klanten zou dan in een gesprek belanden, en in een gedeeld postvak zie je
       zo andermans post. Liever een draad te veel dan een verkeerde. */
    if (antwoordOp) {
      const ouder = s.berichten.find(x => x.id === antwoordOp);
      if (ouder) { msg.draad = ouder.draad || ouder.id; msg.antwoordOp = ouder.id; }
    }
    if (!msg.draad) msg.draad = msg.id;
    veiligheid.zegel(msg);
    s.berichten.unshift(msg);
    if (s.berichten.length > MAX) s.berichten.length = MAX;
    save();
    /* NA DE BEZORGING. De regels van een postvak en het afwezigheidsbericht
       horen te draaien voor ELKE bezorging, niet alleen voor post die
       toevallig via de app binnenkomt -- een automatisering, de werkmail-poort
       en een antwoord komen alle drie hier langs. De haak wordt door
       opzet/diensten2.js gezet zodra kern/rtmail-regels.js bestaat; blijft hij
       leeg, dan gedraagt RTMAIL zich precies als voorheen.
       Een fout in een regel mag de BEZORGING nooit ongedaan maken: het bericht
       is dan al bezorgd, en dat is de belangrijkste helft. */
    if (naBezorging) {
      try { naBezorging(msg); } catch (e) { console.warn('[rtmail] regel mislukt na bezorging:', e && e.message); }
    }
    return msg;
  }

  let naBezorging = null;
  const zetNaBezorging = (fn) => { naBezorging = typeof fn === 'function' ? fn : null; };

  // De rail voor de automatiseringen: het platform stuurt vanuit "rtg@rtmail"
  // (bron 'systeem', altijd vertrouwd).
  function systeemStuur(naar, onderwerp, tekst, soort) {
    return stuur({ van: SYSTEEM, naar, onderwerp, tekst, soort: soort || 'systeem', bron: 'systeem' });
  }

  const pub = m => {
    const veilig = veiligheid.publiek(m), stuk = veilig.inhoudGeblokkeerd;
    return ({
    id: m.id, van: m.van, naar: m.naar,
    onderwerp:stuk ? '[Geblokkeerd: integriteitscontrole mislukt]' : m.onderwerp,
    tekst:stuk ? 'De opgeslagen inhoud wijkt af van het cryptografische RTG-zegel. Open of beantwoord dit bericht niet; meld het bij de beheerder.' : m.tekst,
    soort: m.soort,
    bron: m.bron || (m.van === SYSTEEM ? 'systeem' : 'extern'),
    vertrouwd:stuk ? false : (m.vertrouwd != null ? !!m.vertrouwd : (m.van === SYSTEEM)),
    links:stuk ? { externeLinks:[], aantal:0, gevaarlijk:true } : (m.links || scanLinks(m.tekst)),
    bijlagen: [],
    draad: m.draad || m.id, antwoordOp: m.antwoordOp || null,
    workflow: Array.isArray(m.workflow) ? m.workflow.slice(-20) : [],
    at: m.at, gelezen: !!m.gelezen, veiligheid:veilig
  }); };

  /* Alleen voor een legitieme naverwerking binnen dezelfde bezorgketen, zoals
     het toevoegen van de uitkomst van de bijlagescanner. `bewaar` staat daar
     aan, zodat inhoud en nieuw zegel atomisch in dezelfde opslagronde landen. */
  function herzegel(m, bewaar) { veiligheid.zegel(m); if (bewaar) save(); return m; }

  // Het postvak IN van een adres (nieuwste eerst).
  function postvak(adres, { limit = 60 } = {}) {
    const a = normAdres(adres);
    return store().berichten.filter(m => zelfdeBus(m.naar, a)).slice(0, Math.max(1, Math.min(200, limit))).map(pub);
  }
  // Wat een adres zelf verstuurd heeft.
  function verzonden(adres, { limit = 60 } = {}) {
    const a = normAdres(adres);
    return store().berichten.filter(m => zelfdeBus(m.van, a)).slice(0, Math.max(1, Math.min(200, limit))).map(pub);
  }
  function ongelezen(adres) {
    const a = normAdres(adres);
    return store().berichten.reduce((n, m) => n + (zelfdeBus(m.naar, a) && !m.gelezen ? 1 : 0), 0);
  }
  // Een bericht als gelezen markeren -- alleen als het echt aan dit adres is.
  function lees(adres, id) {
    const a = normAdres(adres);
    const m = store().berichten.find(x => x.id === id && zelfdeBus(x.naar, a));
    if (!m) return { error: 'Dit bericht staat niet in dit postvak.' };
    if (!m.gelezen) { m.gelezen = true; save(); }
    return pub(m);
  }

  /* Een actie uit RTMAIL blijft aan het bronbericht vastzitten. Zo kan de
     werkstroom later aantonen waar een agenda-item of project vandaan kwam,
     zonder dat RTMAIL zelf geld of toegang aanraakt. */
  function workflow(adres, id, stap) {
    const a = normAdres(adres);
    const m = store().berichten.find(x => x.id === id && zelfdeBus(x.naar, a));
    if (!m) return { error: 'Dit bericht staat niet in dit postvak.' };
    const s = stap || {};
    if (!Array.isArray(m.workflow)) m.workflow = [];
    m.workflow.push({ id: crypto.randomBytes(4).toString('hex'),
      soort: kap(s.soort, 24) || 'actie', label: kap(s.label, 120) || 'Actie uitgevoerd',
      ref: kap(s.ref, 100) || null, at: klokDatum().toISOString() });
    if (m.workflow.length > 50) m.workflow = m.workflow.slice(-50);
    m.gelezen = true;
    save();
    return Object.assign(pub(m), { workflow: m.workflow.slice(-20) });
  }

  return { SYSTEEM, VERTROUWDE_BRONNEN, normAdres, scanLinks, stuur, systeemStuur, postvak, verzonden, ongelezen, lees, workflow,
    publiek:pub, herzegel, controleerIntegriteit:veiligheid.controleer,
    zetNaBezorging,
    // de adreslaag doorgeven, zodat routes en tests er maar een bron voor hebben
    DOMEINEN: adresLaag.DOMEINEN, adresVoor: adresLaag.adresVoor, ontleed: adresLaag.ontleed,
    soortVoor: adresLaag.soortVoor, zelfdeBus };
};
