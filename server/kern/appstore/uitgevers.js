/* ============================================================================
   DE UITGEVERS -- wie mag hier publiceren, en wie heeft dat besloten.

   Afgesplitst van ./index.js toen die over de 10 KB-keuringsgrens ging, en langs
   een echte naad: "wie mag hier publiceren" is een andere vraag dan "welke versie
   draait er". De eerste gaat over een PARTIJ en wordt door een mens van RTG
   beantwoord; de tweede gaat over BYTES en wordt per inzending opnieuw gesteld.

   De twee regels die dit bestand dragen:

   1. AANVRAGEN DOET DE PARTIJ, TOELATEN DOET EEN MENS VAN RTG. Dat is geen
      formaliteit maar het moment waarop er een aanspreekbare rechtspersoon
      achter een app komt te staan. Een besluit zonder naam wordt geweigerd:
      een besluit dat niemand heeft genomen, is geen besluit.

   2. EEN GESCHORSTE UITGEVER VERLIEST ZIJN ETALAGE ONMIDDELLIJK. Zou dat pas bij
      de volgende publicatie gebeuren, dan blijft een app van een partij waar we
      net afscheid van namen gewoon draaien bij de leden. Dat is grens 5.
   ========================================================================== */
'use strict';

const STATUS_UITGEVER = ['aangevraagd', 'toegelaten', 'geweigerd', 'geschorst'];

module.exports = function maakUitgevers({ S, save, nu, boek, eigen, norm }) {
  /* ---------------------------------------------------------------- uitgevers */

  function uitgever(org) { return eigen(S().uitgevers, norm(org)); }
  const magInzenden = (org) => { const u = uitgever(org); return !!u && u.status === 'toegelaten'; };

  /* Aanvragen doet de partij zelf; TOELATEN doet een mens van RTG. Dat is geen
     formaliteit: dit is het moment waarop er een aanspreekbare rechtspersoon
     achter een app komt te staan. Een aanvraag die al bestaat, wordt bijgewerkt
     zolang er nog niet over besloten is -- twee aanvragen van dezelfde org zou
     betekenen dat "de uitgever" op twee plekken staat (LAT-regel 4). */
  function uitgeverAanvragen({ org, naam, contact, leverancier }) {
    const o = norm(org);
    if (!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(o)) return { status: 400, error: 'Een organisatiecode bestaat uit hoofdletters, cijfers en streepjes.' };
    const nm = String(naam || '').trim().slice(0, 120);
    const ct = String(contact || '').trim().slice(0, 160);
    if (nm.length < 2) return { status: 400, error: 'Vul de naam in waaronder je publiceert; die staat straks bij elke app.' };
    if (ct.length < 5) return { status: 400, error: 'Vul een contactadres in waarop RTG je kan bereiken over een inzending.' };
    const bestaand = uitgever(o);
    if (bestaand && bestaand.status === 'toegelaten') return { status: 200, ok: true, uitgever: publiekU(bestaand), al: true };
    if (bestaand && bestaand.status === 'geschorst') return { status: 403, error: 'Deze uitgever is geschorst. Reden: ' + (bestaand.reden || 'niet vastgelegd') + '.' };
    const u = bestaand && bestaand.status === 'aangevraagd'
      ? Object.assign(bestaand, { naam: nm, contact: ct, leverancier: leverancier || bestaand.leverancier || null, at: nu() })
      : { org: o, naam: nm, contact: ct, leverancier: leverancier || null, status: 'aangevraagd', reden: null, at: nu(), besloten: null };
    S().uitgevers[o] = u;
    boek('uitgever-aangevraagd', o, leverancier || null, { naam: nm });
    save();
    return { status: 200, ok: true, uitgever: publiekU(u) };
  }

  /* De mens van RTG beslist. `door` is wie er tekent en gaat mee het journaal in;
     een besluit zonder naam is een besluit dat niemand heeft genomen. */
  function uitgeverBesluit({ org, besluit, reden, door }) {
    const u = uitgever(org);
    if (!u) return { status: 404, error: 'Deze uitgever bestaat niet.' };
    if (!STATUS_UITGEVER.includes(besluit) || besluit === 'aangevraagd') return { status: 400, error: 'Een besluit is toegelaten, geweigerd of geschorst.' };
    const wie = String(door || '').trim().slice(0, 80);
    if (!wie) return { status: 400, error: 'Zet je naam erbij: een besluit over een uitgever hoort een mens te hebben genomen.' };
    if (besluit !== 'toegelaten' && String(reden || '').trim().length < 5) return { status: 400, error: 'Een weigering of schorsing draagt een reden; die krijgt de uitgever te lezen.' };
    u.status = besluit;
    u.reden = besluit === 'toegelaten' ? null : String(reden || '').trim().slice(0, 400);
    u.besloten = { door: wie, at: nu() };
    /* Een geschorste uitgever verliest zijn etalage onmiddellijk. Zou dat pas bij
       de volgende publicatie gebeuren, dan blijft een app van een partij waar we
       net afscheid van namen gewoon draaien bij de leden. */
    let gevallen = 0;
    if (besluit !== 'toegelaten') {
      for (const a of Object.values(S().apps)) {
        if (a.org !== u.org || !a.live) continue;
        const v = eigen(S().versies, a.live);
        if (v) v.status = 'ingetrokken';
        a.live = null; a.ingetrokken = { at: nu(), door: wie, reden: 'de uitgever is ' + besluit };
        gevallen++;
      }
    }
    boek('uitgever-' + besluit, u.org, wie, { reden: u.reden, appsGevallen: gevallen });
    save();
    return { status: 200, ok: true, uitgever: publiekU(u), appsGevallen: gevallen };
  }

  const publiekU = (u) => ({ org: u.org, naam: u.naam, contact: u.contact, status: u.status, reden: u.reden || null, at: u.at, besloten: u.besloten || null });
  const uitgevers = () => Object.values(S().uitgevers).map(publiekU);

  return { uitgever, magInzenden, uitgeverAanvragen, uitgeverBesluit, publiekU, uitgevers, STATUS_UITGEVER };
};
