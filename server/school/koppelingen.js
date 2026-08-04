/* School (deelmodule): koppelingen en webhooks -- de kant die naar buiten
   wijst (Microsoft 365, Google Workspace, Teams, Zoom, boekhouding, salaris,
   overheidsdiensten, bibliotheek, digitale leermiddelen, identiteitsproviders,
   betaalproviders, vervoer, kantine en toegangspoorten).

   Twee dingen die dit anders maken dan een lijst met vinkjes:

   1. EEN KOPPELING NOEMT WAT HIJ DEELT. Bij het aanzetten kies je de VELDEN
      die naar buiten gaan, uit een vaste lijst. Wat er niet bij staat, gaat er
      niet doorheen -- ook niet "voor het gemak". Zonder die velden is een
      koppeling niet aan te zetten, en het overzicht laat per koppeling zien
      wat er van uw kinderen bij welke partij ligt. Dat is precies de vraag die
      een ouder stelt en die de meeste schoolsystemen niet kunnen beantwoorden.
   2. GEVOELIGE VELDEN GAAN NOOIT MEE. Zorg, incidenten en het inzagejournaal
      staan niet in de lijst en zijn er ook niet aan toe te voegen. Een
      boekhoudpakket heeft geen zorgdossier nodig, en een leermiddelenleverancier
      al helemaal niet.

   De webhook-URL gaat langs de bestaande SSRF-afweer (kern/ssrf.js): een
   webhook naar een intern adres is een aanvaller die onze server laat bellen.

   EERLIJK OVER WAT ER (NOG) NIET IS: dit bestand REGISTREERT webhooks, het
   bezorgt ze niet. Er gaat vandaag dus geen enkel bericht de deur uit. Dat
   staat ook in het antwoord van /school/webhook/zet en als openstaand punt in
   de README, want een lijst met abonnementen die niemand aflevert is precies
   het soort belofte waar LAT-regel 6 over gaat. */
const { veiligeWebhookUrl } = require('../kern/ssrf');

const SOORTEN = {
  microsoft365: 'Microsoft 365', google: 'Google Workspace', teams: 'Microsoft Teams', zoom: 'Zoom',
  boekhouding: 'Boekhoudsoftware', salaris: 'Salarissoftware', overheid: 'Overheidsdienst (DUO/leerplicht)',
  bibliotheek: 'Bibliotheeksysteem', leermiddelen: 'Digitale leermiddelen', identiteit: 'Identiteitsprovider (SSO)',
  betaal: 'Betaalprovider', vervoer: 'Schoolvervoer', kantine: 'Kantine', toegang: 'Toegangspoorten'
};
// de enige velden die een koppeling mag ontvangen. Zorg, incidenten en het
// journaal staan hier bewust niet in en horen hier ook nooit bij te komen.
const VELDEN = {
  naam: 'naam van de leerling', klas: 'klas', opleiding: 'opleiding', vestiging: 'vestiging',
  email: 'e-mailadres', geboortedatum: 'geboortedatum', leerlingnummer: 'leerlingnummer',
  aanwezigheid: 'aanwezigheid (aantallen)', cijfers: 'cijfers', factuurregels: 'factuurregels',
  personeelsnaam: 'naam van een personeelslid', urenregistratie: 'urenregistratie'
};
const GEBEURTENISSEN = ['leerling.ingeschreven', 'leerling.uitgeschreven', 'leerling.overstap',
  'factuur.gemaakt', 'factuur.betaald', 'aanwezigheid.gezet', 'rapport.vastgesteld', 'calamiteit'];

module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, poort, log, leerlingLijst } = sctx;
  const KOP = (sch) => { if (!sch.koppelingen) sch.koppelingen = {}; return sch.koppelingen; };
  const WH = (sch) => { if (!sch.webhooks) sch.webhooks = []; return sch.webhooks; };

  router.post('/school/koppeling/zet', (req, res) => {
    const g = poort(req, res, 'koppeling'); if (!g) return;
    const soort = String(req.body.soort || '');
    if (!Object.prototype.hasOwnProperty.call(SOORTEN, soort))
      return res.status(400).json({ error: 'Onbekende koppeling. Beschikbaar: ' + Object.keys(SOORTEN).join(', ') + '.' });
    const velden = [...new Set((Array.isArray(req.body.velden) ? req.body.velden : []).map(String))];
    const onbekend = velden.filter(v => !Object.prototype.hasOwnProperty.call(VELDEN, v));
    if (onbekend.length) return res.status(400).json({ error: 'Deze velden gaan hier niet doorheen: ' + onbekend.join(', ')
      + '. Zorg, incidenten en het journaal verlaten RTG School niet.' });
    if (!velden.length) return res.status(400).json({ error: 'Kies welke velden deze koppeling mag ontvangen; zonder dat gaat hij niet aan.' });
    const id = soort;
    KOP(g.sch)[id] = { id, soort, naam: schoon(req.body.naam, 60) || SOORTEN[soort],
      status: req.body.aan === false ? 'uit' : 'aan', velden, beheerder: schoon(req.body.beheerder, 60) || null,
      verwerker: schoon(req.body.verwerker, 80) || null, at: nu(), door: g.p.naam };
    log(g.sch, g.p, 'koppeling-gezet', id, velden.join(','));
    save();
    res.json({ ok: true, koppeling: KOP(g.sch)[id] });
  });

  router.post('/school/koppelingen', (req, res) => {
    const g = poort(req, res); if (!g) return;
    res.json({ ok: true,
      koppelingen: Object.values(KOP(g.sch)).map(k => Object.assign({}, k, { deelt: k.velden.map(v => VELDEN[v]) })),
      beschikbaar: Object.entries(SOORTEN).map(([id, naam]) => ({ id, naam })),
      velden: Object.entries(VELDEN).map(([id, uitleg]) => ({ id, uitleg })),
      nooit: ['zorgdossier', 'incidenten', 'inzagejournaal', 'hulplijn'],
      uitleg: 'Wat een koppeling deelt, staat hier per veld. Zorg, incidenten, de hulplijn en het journaal verlaten RTG School nooit.' });
  });

  /* ---------- webhooks ---------- */
  router.post('/school/webhook/zet', (req, res) => {
    const g = poort(req, res, 'koppeling'); if (!g) return;
    const url = String(req.body.url || '').trim();
    const keuring = veiligeWebhookUrl(url);
    if (!keuring.ok) return res.status(400).json({ error: 'Deze webhook-URL kan niet: ' + keuring.reden + '.' });
    const gebeurtenissen = [...new Set((Array.isArray(req.body.gebeurtenissen) ? req.body.gebeurtenissen : []).map(String))]
      .filter(e => GEBEURTENISSEN.includes(e));
    if (!gebeurtenissen.length) return res.status(400).json({ error: 'Kies minstens een gebeurtenis: ' + GEBEURTENISSEN.join(', ') + '.' });
    const w = { id: rid(5), url, gebeurtenissen, geheim: rid(16), status: 'geregistreerd', at: nu(), door: g.p.naam };
    WH(g.sch).unshift(w); g.sch.webhooks = WH(g.sch).slice(0, 50);
    log(g.sch, g.p, 'webhook-gezet', w.id, gebeurtenissen.join(','));
    save();
    res.json({ ok: true, webhook: w, bezorgtNu: false,
      uitleg: 'Geregistreerd. Let op: RTG School bezorgt deze gebeurtenissen nog niet -- de aflevering is nog niet gebouwd. Het geheim wordt nu een keer getoond en is straks de handtekening op elke levering.' });
  });

  router.post('/school/webhook/lijst', (req, res) => {
    const g = poort(req, res, 'koppeling'); if (!g) return;
    res.json({ ok: true, gebeurtenissen: GEBEURTENISSEN,
      bezorgtNu: false,
      webhooks: WH(g.sch).map(w => ({ id: w.id, url: w.url, gebeurtenissen: w.gebeurtenissen, status: w.status, at: w.at })) });
  });

  router.post('/school/webhook/weg', (req, res) => {
    const g = poort(req, res, 'koppeling'); if (!g) return;
    const voor = WH(g.sch).length;
    g.sch.webhooks = WH(g.sch).filter(w => w.id !== String(req.body.webhookId || ''));
    if (g.sch.webhooks.length === voor) return res.status(404).json({ error: 'Die webhook kennen we niet.' });
    save();
    res.json({ ok: true });
  });

  /* ---------- de gegevensexport ----------
     Exporteerbaarheid is een enterprise-eis en tegelijk een AVG-recht. Dit is
     de schoolbrede variant: alles wat de school van zichzelf heeft, plat en
     leesbaar. Het zorgdeel gaat alleen mee als iemand met het recht 'zorg' er
     expliciet om vraagt -- en dan met een regel in het journaal. */
  router.post('/school/export', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'De schoolbrede export doet de directie.' });
    const metZorg = req.body.metZorg === true;
    const leerlingen = Object.values(leerlingLijst(g.sch)).map(l => {
      const rij = { id: l.id, naam: l.naam, status: l.status, klasCode: l.klasCode, opleiding: l.opleiding,
        vestiging: l.vestiging, geboren: l.geboren, contact: l.contact, documenten: l.documenten, overstappen: l.overstappen };
      if (metZorg) rij.zorg = l.zorg || null;
      return rij;
    });
    log(g.sch, g.p, 'export', g.sch.code, metZorg ? 'volledige export INCLUSIEF zorgdeel' : 'export zonder zorgdeel');
    res.json({ ok: true, school: { code: g.sch.code, naam: g.sch.naam, plaats: g.sch.plaats },
      leerlingen, vestigingen: Object.values(g.sch.vestigingen || {}), opleidingen: Object.values(g.sch.opleidingen || {}),
      facturen: (g.sch.facturen || []).map(f => ({ nummer: f.nummer, leerlingId: f.leerlingId, soort: f.soort, centen: f.centen, betaald: f.betaald || 0, at: f.at })),
      personeel: Object.values(g.sch.personeel || {}).map(p => ({ id: p.id, naam: p.naam, rol: p.rol, status: p.status })),
      zorgMee: metZorg,
      uitleg: metZorg ? 'Het zorgdeel zit erbij; dat staat als zodanig in het journaal.' : 'Het zorgdeel zit hier niet in. Vraag er expliciet om als het nodig is.' });
  });

  return { SOORTEN, VELDEN, GEBEURTENISSEN };
};
