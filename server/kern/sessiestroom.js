/* DE SESSIESTROOM: een stroomticket voor de live-stromen en mediadeuren die een
   SESSIE dragen -- een lid, een zaak, het kantoor -- zodat die sessie nooit meer
   in een adres staat.

   WAAROM. Een EventSource, een <video> en een <img> kunnen geen kop sturen.
   Daarom reisde de volledige sessie (dertig dagen geldig) als ?token= mee naar
   /api/stream, /api/supplier/stream, /api/office/stream en /api/theater/kijk.
   Een adres staat in proxy- en serverlogs, in de browsergeschiedenis en in een
   Referer; wie dat adres later las, had de sessie zelf.

   Nu ruilt het scherm zijn sessie (in de kop) eerst voor een ticket
   (POST /api/stroom/ticket, ../opzet/stroomtoegang.js) en staat alleen dat
   ticket in het adres. Dezelfde mechaniek als de gezins- en lesstroom
   (./stroomticket.js), met wat er hier bij moest:

   - 128 bits (ST.<32 hex>, ./bearercode.js), op schijf alleen de hash, in een
     EIGEN collectie (sessieStroomTickets: soort -> tickets);
   - kort geldig en standaard EENMALIG: de claim haalt het ticket in dezelfde
     collectietransactie weg, dus een afgeluisterd adres dat later wordt
     overgespeeld opent niets meer;
   - gebonden aan de SOORT (een kantoorticket opent de ledenstroom niet: elke
     soort heeft een eigen doel en scope en een eigen rij) en aan de SESSIE
     (haar hash) en, waar dat hoort, aan een ONDERWERP (de video);
   - bij openen OPNIEUW getoetst met precies dezelfde controle als de deur
     ervoor deed (`geldig`): een sessie die na de uitgifte is afgemeld of
     ingetrokken opent ook met een seconde oud ticket niets.

   WAAROM DE SESSIE VERZEGELD MEEREIST, en niet alleen haar hash. Een ticket kan
   bij een ander proces worden geclaimd dan waar het werd uitgegeven (meerdere
   servers achter een balans, gedeelde opslag). De hercontrole moet dan dezelfde
   vraag kunnen stellen als de deur -- resolveSession, sessionFor, de
   kantoorpoort -- en die vragen nemen het token, geen hash; een tweede,
   hash-gebaseerde versie van elk van die deuren zou LAT.md regel 4 breken. Dus
   draagt het ticket de sessie VERZEGELD (AES-256-GCM met een sleutel die uit de
   accountkluis wordt afgeleid, ../accounts/kluis.js sleutelVoor, en dus NIET in
   de database staat), met soort en sessiehash als geassocieerde gegevens. Wat
   er in de opslag staat is hoogstens een minuut oud, verdwijnt bij de claim, en
   is zonder de servergeheimen niet te openen. Ontbreekt de zegelsleutel, dan
   geeft de uitgifte 503: liever geen stroom dan een sessie in leesbare vorm.

   Wat hier NIET ligt: welke sessie een stroom mag openen. Dat zegt de domein-
   module die de soort registreert (`soort(naam, { geldig })`), met de controle
   die haar deur al had. */
'use strict';

const klok = require('../lib/klok');
const { tokenHash } = require('./sessies');

const COLLECTIE = 'sessieStroomTickets';
const STANDAARD = Object.freeze({ geldigMs: 60000, maxGebruik: 1, maxOpen: 8 });
const NAAM = /^[a-z][a-z0-9-]{1,30}$/;

function maak({ db, crypto, bewerkCollectie, zegelSleutel, productie = process.env.NODE_ENV === 'production',
  nu = () => klok.datum().toISOString() }) {
  if (!crypto || typeof crypto.createCipheriv !== 'function') throw new Error('sessiestroom vereist node:crypto');
  if (typeof zegelSleutel !== 'function') throw new Error('sessiestroom vereist een zegelsleutel (accounts.sleutelVoor)');
  const bearer = require('./bearercode')({ crypto, namespace: 'rtg.sessiestroom', nu });
  const levend = t => t && !t.ingetrokken_at && Date.parse(t.expires_at) > Date.parse(nu());
  const eigen = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null;
  const soorten = new Map();
  let bezit = null;

  /* Een EIGEN collectie, om dezelfde reden als ../foundation/gezinsstroom.js:
     een transactie vervangt haar collectie door een kopie. */
  function transactie(werk) {
    const ruim = kaart => {
      for (const [k, rij] of Object.entries(kaart)) {
        const over = (Array.isArray(rij) ? rij : []).filter(levend);
        if (over.length) kaart[k] = over; else delete kaart[k];
      }
      return werk(kaart);
    };
    if (typeof bewerkCollectie === 'function') return Promise.resolve(bewerkCollectie(COLLECTIE, ruim));
    if (productie) return Promise.reject(new Error('sessiestroom: geen collectietransactie in productie'));
    if (!bezit) bezit = require('./eigencollectie')({ db, domein: 'kern/sessiestroom', bezit: { [COLLECTIE]: 'kaart' } });
    return Promise.resolve(ruim(bezit.bak(COLLECTIE)));
  }

  function sleutel() {
    const k = zegelSleutel();
    return Buffer.isBuffer(k) && k.length === 32 ? k : null;
  }
  function zegel(raw, aad) {
    const k = sleutel();
    if (!k) return null;
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', k, iv);
    c.setAAD(Buffer.from(aad, 'utf8'));
    const enc = Buffer.concat([c.update(String(raw), 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
  }
  function ontzegel(waarde, aad) {
    const k = sleutel();
    if (!k || typeof waarde !== 'string') return null;
    try {
      const b = Buffer.from(waarde, 'base64');
      if (b.length < 29) return null;
      const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12));
      d.setAAD(Buffer.from(aad, 'utf8'));
      d.setAuthTag(b.subarray(12, 28));
      return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
    } catch (e) { return null; }
  }
  const aadVan = (naam, sessie) => 'rtg.sessiestroom|' + naam + '|' + sessie;
  const geopend = (o, naam) => {
    if (!o || o.soort !== naam || !/^[a-f0-9]{64}$/.test(String(o.sessie || ''))) return null;
    const raw = ontzegel(o.zegel, aadVan(naam, o.sessie));
    return raw && tokenHash(raw) === o.sessie ? raw : null;
  };

  /* Een soort registreren: de domeinmodule zegt hoe een sessie voor HAAR deur
     wordt getoetst. `geldig(raw, bij)` is dezelfde vraag als de deur stelde;
     `bij` is het onderwerp waar een ticket aan vastzit (een video-id), of ''. */
  function soort(naam, spec) {
    if (!NAAM.test(String(naam || ''))) throw new Error('sessiestroom: ongeldige soortnaam ' + naam);
    if (soorten.has(naam)) throw new Error('sessiestroom: soort ' + naam + ' bestaat al');
    const s = Object.assign({}, STANDAARD, spec || {});
    if (typeof s.geldig !== 'function') throw new Error('sessiestroom: soort ' + naam + ' zonder geldig()');
    const st = require('./stroomticket')({ bearer, nu, transactie,
      lees: (kaart, k) => eigen(kaart, k),
      schrijf: (kaart, k, rij) => { if (rij.length) kaart[k] = rij; else delete kaart[k]; },
      prefix: 'ST', issuer: 'rtg.sessiestroom', doel: 'sessie-stroom:' + naam, scope: ['stroom.' + naam],
      geldigMs: s.geldigMs, maxGebruik: s.maxGebruik, maxOpen: s.maxOpen, bijVol: 'oudste',
      groep: o => String(o.sessie || '') + '|' + String(o.bij || '') });
    soorten.set(naam, { st, geldig: s.geldig, metBij: !!s.metBij });
  }

  /* Uitgifte: alleen voor een sessie die de deur van deze soort NU zou openen.
     Geeft { ok, ticket, geldigTot } of { status, error }. De kale waarde komt
     een keer terug. */
  async function geef(naam, raw, bij) {
    const s = soorten.get(String(naam || ''));
    if (!s) return { status: 400, error: 'Deze stroom kennen we niet.' };
    const kaal = String(raw == null ? '' : raw).trim();
    const onderwerpId = s.metBij ? String(bij == null ? '' : bij).trim().slice(0, 200) : '';
    if (s.metBij && !onderwerpId) return { status: 400, error: 'Zeg voor welk onderwerp dit ticket is.' };
    let mag = false;
    try { mag = !!(kaal && await s.geldig(kaal, onderwerpId)); } catch (e) { mag = false; }
    if (!mag) return { status: 401, error: 'Deze sessie mag deze stroom niet openen.' };
    const sessie = tokenHash(kaal);
    const z = zegel(kaal, aadVan(naam, sessie));
    if (!z) return { status: 503, error: 'De stroom kan nu niet veilig worden geopend.' };
    const m = await s.st.geef(naam, () => ({ onderwerp: { soort: naam, sessie, bij: onderwerpId, zegel: z } }));
    return { ok: true, ticket: m.code, geldigTot: m.toegang.expires_at };
  }

  /* Openen: DE claim (eenmalig, of geteld bij maxGebruik > 1), gebonden aan
     soort en onderwerp, en daarna dezelfde toets als de deur. Geeft
     { ok, token } -- de sessie, alleen in het geheugen van deze verbinding,
     voor de hercontrole per bericht -- of { status }. */
  async function open(naam, ticket, bij) {
    const s = soorten.get(String(naam || ''));
    if (!s || !s.st.vorm(ticket)) return { status: 401 };
    const onderwerpId = s.metBij ? String(bij == null ? '' : bij).trim().slice(0, 200) : '';
    let uit;
    try {
      uit = await s.st.claim(naam, ticket, { voor: () => ({ binding: { soort: naam, bij: onderwerpId } }),
        hercontrole: o => !!geopend(o, naam) });
    } catch (e) { return { status: 503 }; }
    if (!uit || !uit.ok) return { status: 401 };
    const raw = geopend(uit.onderwerp, naam);
    let mag = false;
    try { mag = !!(raw && await s.geldig(raw, onderwerpId)); } catch (e) { mag = false; }
    return mag ? { ok: true, token: raw } : { status: 401 };
  }

  actief = { soort, geef, open, soorten: () => [...soorten.keys()], COLLECTIE };
  return actief;
}

/* EEN PROCES, EEN SESSIESTROOM. Een laag die buiten de kern om gemount wordt
   (het schoolkanaal hangt aan de Foundation-router, die al bestaat voordat de
   kern er is) vraagt de dienst op het moment van een verzoek op, in plaats van
   er een tweede te maken met een eigen kijk op dezelfde collectie. */
let actief = null;
module.exports = { maak, actief: () => actief, COLLECTIE, STANDAARD };
