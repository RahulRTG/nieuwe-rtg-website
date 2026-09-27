/* RTG Festival (deelmodule): DE PAS DRAAGT RECHTEN, GEEN TYPE.

   Dit is de grootste hefboom in deze wereld (FESTIVAL.md par. 3.3), en het
   loont om op te schrijven waarom.

   Een kaartje heeft vandaag een TYPE (routes/supplier/tickets.js). Elk nieuw
   product is dan code: een weekendticket is een nieuw type, met camping weer
   een, met shuttle weer een -- dezelfde N-kwadraat-val die dit huis al drie
   keer heeft betaald.

   Hier draagt een pas RECHTEN. Een recht is vier dingen en niet meer:

     soort      waar het over gaat            camping.premium
     bereik     welke dagen, welke plek       dag 1-3, plek camping-noord
     venster    tussen welke tijden           13:00-19:00, of de hele dag
     eis        wat er eerst waar moet zijn   veiligheidsinstructie

   Een PRODUCT is een verzameling rechten met een prijs eromheen. Dus data en
   geen code: een nieuw pakket verzinnen is een regel in een tabel, geen release.

   En de crewkant komt er gratis bij: een technicus draagt dezelfde vorm pas met
   andere rechten, dus er is EEN poort en EEN weigeringszin voor bezoekers,
   crew, artiesten en leveranciers. */
'use strict';

/* Een rechtsoort is punt-gescheiden en klein-geschreven. Bewust GEEN gesloten
   lijst: de hele winst hierboven is dat een nieuw product geen code vraagt. Wel
   een vorm, want `Camping Premium!!` en `camping.premium` naast elkaar zijn twee
   waarheden over hetzelfde recht (LAT-regel 4). */
const SOORT_RE = /^[a-z][a-z0-9]*(\.[a-z0-9]+){1,3}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const PAS_SOORTEN = ['gast', 'crew', 'artiest', 'leverancier', 'pers'];

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind, dagVind, offset, plekVind } = ctx;

  /* De CODE van een pas woont in ./pas-toegang.js: 128 bits, hash-only,
     eenmalig getoond, en geclaimd in een collectietransactie. */
  const pt = require('./pas-toegang')(ctx);

  /* ---------- een recht nakijken ----------
     Geeft een schoongemaakt recht terug, of { error }. */
  function keurRecht(e, r) {
    const soort = String((r || {}).soort || '');
    if (!SOORT_RE.test(soort)) return { error: 'Ongeldige rechtsoort: ' + (soort || '(leeg)') + '.' };

    let dagen = null;
    if (Array.isArray(r.dagen) && r.dagen.length) {
      dagen = [];
      for (const did of r.dagen.slice(0, 30)) {
        if (!dagVind(e, did)) return { error: 'Dit recht wijst naar een dag die niet bestaat.' };
        if (!dagen.includes(String(did))) dagen.push(String(did));
      }
    }
    const plek = r.plek ? String(r.plek) : null;
    if (plek && !plekVind(e, plek)) return { error: 'Dit recht wijst naar een plek die niet bestaat.' };

    const van = r.van ? String(r.van) : null;
    const tot = r.tot ? String(r.tot) : null;
    if ((van && !HHMM.test(van)) || (tot && !HHMM.test(tot))) return { error: 'Geef het venster als uu:mm.' };
    if ((van && !tot) || (tot && !van)) return { error: 'Een venster heeft een begin en een eind.' };

    /* EEN VENSTER DAT OP GEEN ENKELE DAG BINNEN DE OPENINGSTIJDEN VALT, IS EEN
       BELOFTE ZONDER CODE (LAT-regel 6). Zo'n recht gaat nooit open en niemand
       merkt het, tot er iemand voor een dichte deur staat. Dat het op SOMMIGE
       dagen buiten de tijden valt is wel goed -- een middagrecht op een
       avonddag hoort gewoon niet te openen. */
    if (van) {
      const kandidaten = (dagen || (e.dagen || []).map(d => d.id)).map(did => dagVind(e, did)).filter(Boolean);
      if (kandidaten.length && !kandidaten.some(d => offset(d, van) !== null))
        return { error: 'Het venster ' + van + '-' + tot + ' valt buiten de openingstijden van elke dag waarop dit recht geldt.' };
    }
    const eis = r.eis ? schoon(r.eis, 40) : null;
    return { recht: { soort, dagen, plek, van, tot, eis } };
  }

  /* ---------- een pas uitgeven ----------
     Uit een product, of met losse rechten (crew, artiest, leverancier). De
     rechten worden GEKOPIEERD op de pas en niet als verwijzing bewaard: wie
     morgen het product wijzigt, hoort niet met terugwerkende kracht te bepalen
     wat er gisteren verkocht is. */
  function pasUitgeven(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const soort = PAS_SOORTEN.includes(String(d.soort)) ? String(d.soort) : 'gast';
    const drager = schoon(d.drager, 60);
    if (!drager) return { status: 400, error: 'Op wiens codenaam staat deze pas?' };

    let rechten = [];
    if (d.productId) {
      const prod = e.producten[String(d.productId)];
      if (!prod) return { status: 404, error: 'Dit product bestaat niet.' };
      rechten = prod.rechten.map(r => ({ ...r }));
    } else if (Array.isArray(d.rechten) && d.rechten.length) {
      for (const r of d.rechten.slice(0, 50)) {
        const k = keurRecht(e, r);
        if (k.error) return { status: 400, error: k.error };
        rechten.push(k.recht);
      }
    } else {
      return { status: 400, error: 'Geef een product of losse rechten mee.' };
    }
    /* De handmatige uitgifte staat buiten elke antwoordcache (de code staat
       erin). Een herhaling met dezelfde sleutel, of dezelfde pas binnen vijf
       seconden (dubbeltik), maakt dus geen tweede pas: 409 zonder code. */
    const tik = d.dubbeltik ? pt.afdruk(JSON.stringify([eid, drager, soort, rechten, d.productId || null, d.idem || ''])) : null;
    const eerder = tik && Object.values(e.passen || {}).find(p => p.uitgifte && p.uitgifte.tik === tik &&
      (d.idem || Date.now() - Date.parse(p.at) < 5000));
    if (eerder) return { status: 409, herhaald: true, pas: pt.beeld(eerder),
      error: 'Deze pas is al uitgegeven en de code wordt niet opnieuw getoond. Trek hem in en geef een nieuwe uit als hij niet is aangekomen.' };
    const pas = { id: 'pas' + crypto.randomBytes(5).toString('hex'), drager, soort, uitgifte: tik ? { tik } : undefined,
      product: d.productId ? String(d.productId) : (d.product ? schoon(d.product, 60) : null),
      rechten, ingetrokken: false, toegang: null, scans: [], at: new Date().toISOString() };
    const code = pt.geef(e, pas, d.issuer === 'verkoop' ? 'rtg.festival.verkoop' : 'rtg.festival.organisator');
    e.passen[pas.id] = pas;
    save();
    // de kale code staat alleen in dit antwoord; op de pas staat de hash
    return { ok: true, eenmalig: true, pas: Object.assign(pt.beeld(pas), { code }) };
  }

  const pasOpCode = pt.opCode;

  /* Intrekken op pas-id (de organisator heeft de code niet meer) of op de
     code die hij voor zich ziet; in de collectietransactie, dus nooit half
     tegen een scan in. */
  function pasIntrekken(fid, eid, idOfCode, reden) {
    return pt.transactie(bron => {
      const e = pt.editieIn(bron, fid, eid);
      if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
      const x = String(idOfCode || '').trim();
      const p = (e.passen || {})[x] || pasOpCode(e, x);
      if (!p) return { status: 404, error: 'Deze pas hoort niet bij deze editie.' };
      p.ingetrokken = true;
      p.redenIntrekking = schoon(reden, 120) || null;
      pt.trekIn(p, 'organisator', p.redenIntrekking || 'ingetrokken');
      return { ok: true, pas: pt.beeld(p) };
    });
  }

  /* De drager toont zijn eigen pas: dat IS roteren. `wie` komt uit de sessie. */
  function pasToon(fid, eid, wie, id) {
    const drager = schoon(wie, 60);
    return pt.transactie(bron => {
      const e = pt.editieIn(bron, fid, eid);
      const p = e && (e.passen || {})[String(id || '')];
      if (!p || !drager || p.drager !== drager) return { status: 404, error: 'Deze pas kennen wij niet.' };
      if (p.ingetrokken) return { status: 409, error: 'Deze pas is ingetrokken.' };
      const code = pt.geef(e, p, 'rtg.lid.festivalpas');
      return { ok: true, eenmalig: true, code, pas: pt.beeld(p) };
    });
  }

  return { pasUitgeven, pasIntrekken, pasToon, pasOpCode, pasReden: pt.reden, pasTelBinnen: pt.telBinnen,
    pasBeeld: pt.beeld, pasTransactie: pt.transactie, pasEditieIn: pt.editieIn, keurRecht, PAS_SOORTEN };
};

module.exports.PAS_SOORTEN = PAS_SOORTEN;
