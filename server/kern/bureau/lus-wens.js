/* Het Privekantoor, deelbestand "lus-wens": de kant van het LID in de
   concierge-lus -- een zin wordt een case, een toelichting, de verrassing aan of
   uit, en wat het lid terugziet. Geknipt uit ./lus.js op de grens tussen wie
   iets wil en wie het regelt; zie daar en CONCIERGE.md voor de lus zelf.

   Wat het lid terugziet is met opzet klein: een eigenaar, een zin die klopt
   (lus-regels.js gastBericht) en het voorstel als dat er ligt. Niet de werkvloer
   van het kantoor, en geen mogelijkheid die hij niet hoeft te beoordelen. */
'use strict';

const R = require('./lus-regels');
const { intake } = require('./lus-intake');

module.exports = (ctx) => {
  const { save, schoon, stap, caseOpen, caseLijst, vind } = ctx;
  const nuMs = () => Date.now();

  /* ---- de wens ------------------------------------------------------- */

  function lusIntake(key, b) {
    /* Een dubbeltik op "vraag" mag geen tweede diner opleveren. De sleutel komt
       van het scherm, net als bij kern/rendezvous-concierge.js. */
    const sleutel = schoon(b.sleutel, 80);
    if (sleutel.length < 16) return { status: 400, error: 'De aanvraagsleutel ontbreekt.' };
    const eerder = (caseLijst(key) || []).find(x => x.sleutel === sleutel);
    if (eerder) return { status: 200, ok: true, herhaald: true, zaak: eerder, vragen: [] };
    const r = intake(b.zin, new Date().toISOString().slice(0, 10));
    if (r.fout) return { status: 400, error: r.fout };
    const v = r.velden;
    // wat het lid zelf aanvult, gaat voor wat wij uit de zin lazen
    for (const k of ['van', 'plaats', 'tijd', 'gelegenheid']) if (b[k]) v[k] = schoon(b[k], 60);
    if (Number.isFinite(Number(b.personen)) && Number(b.personen) > 0) v.personen = Math.min(99, Math.round(Number(b.personen)));
    if (b.verrassing === true || b.verrassing === false) v.verrassing = b.verrassing;
    const o = caseOpen(key, { titel: v.titel, wat: v.wat, domein: v.domein, van: v.van,
      bedragCenten: b.grensCenten, werkwijze: 'voorstel' });
    if (o.error) return o;
    const c = o.zaak;
    Object.assign(c, {
      gelegenheid: v.gelegenheid, plaats: v.plaats, tijd: v.tijd, personen: v.personen,
      harde: v.harde, verrassing: !!v.verrassing, sleutel,
      speelruimteMin: Math.max(0, Math.min(240, Math.round(Number(b.speelruimteMin) || 0))),
      eigenaar: { rol: 'Lead Rechterhand', naam: null },
      mogelijkheden: [], onderdelen: [], voorstel: null
    });
    save();
    return { status: 200, ok: true, zaak: c, vragen: r.vragen.filter(q => !v[q.veld]) };
  }

  function lusToelichting(key, id, tekst) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const t = schoon(tekst, 600);
    if (!t) return { status: 400, error: 'Wat wilt u ons laten weten?' };
    stap(c, c.status, t, 'lid');
    Object.assign(c.tijdlijn[c.tijdlijn.length - 1], { soort: 'toelichting', tijdensHerstel: !!c.herstel && c.status === 'in herstel' });
    save();
    return { status: 200, ok: true };
  }

  function lusVerrassing(key, id, aan) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    if (c.verrassing === !!aan) return { status: 200, ok: true }; // al zo: geen tweede regel
    c.verrassing = !!aan;
    stap(c, c.status, aan ? 'Dit is een verrassing: er gaat niets naar het gezin of een gedeeld kanaal.' : 'Het is geen verrassing meer.', 'lid');
    save();
    return { status: 200, ok: true };
  }

  function lusLid(key, id) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const a = c.voorstel ? c.mogelijkheden.find(x => x.id === c.voorstel.aanbod) : null;
    return { status: 200, id: c.id, titel: c.titel, status: c.status, eigenaar: c.eigenaar,
      bericht: R.gastBericht(c), verrassing: c.verrassing,
      voorstel: a ? { wat: a.wat, van: a.van, bedragCenten: a.bedragCenten, reden: c.voorstel.reden,
        stand: R.aanbodStand(a, nuMs()), geldigTot: a.geldigTot } : null,
      tijdlijn: R.tijdlijn(c).map(r => ({ wat: r.wat, van: r.van, tot: r.tot })) };
  }

  return { lusIntake, lusToelichting, lusVerrassing, lusLid };
};
