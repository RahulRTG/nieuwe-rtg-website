/* De zorgtak van de verzekeraar (Segur Advies): een zorgverzekeringspas
   op codenaam, de werkplek van de verzekeraar en de declaratieketen.
   De vaste regels: inschrijven doet altijd een mens (nooit de AI, nooit
   automatisch), de pas draagt de codenaam en nooit de echte naam, en de
   pas-controle geeft niet meer terug dan actief/pakket/codenaam.
   Declaraties beslist een mens: goedkeuren kan met een tik, afwijzen kan
   alleen met een reden. De pas verschijnt automatisch in de RTG Wallet
   van het lid en verdwijnt daar weer bij stopzetting.
   Opslag per verzekeraar in db.data.zorgpolis[code]. */

const PAKKETTEN = { basis: 129, plus: 159, top: 189 };
const MAX_LIJST = 300;

function maakZorgpolis({ db, save, crypto, schoon, keyVanCodenaam, walletVoeg, walletWegBron }) {
  const nu = () => new Date().toISOString();
  const id = p => p + crypto.randomBytes(3).toString('hex');
  const cap = (l, m) => { if (l.length > m) l.length = m; };

  function Z(code) {
    if (!db.data.zorgpolis) db.data.zorgpolis = {};
    if (!db.data.zorgpolis[code]) db.data.zorgpolis[code] = { verzekerden: [], declaraties: [] };
    return db.data.zorgpolis[code];
  }

  function overzicht(code) {
    const z = Z(code);
    return { status: 200, pakketten: PAKKETTEN,
      verzekerden: z.verzekerden.map(v => ({ id: v.id, pas: v.pas, codenaam: v.codenaam, pakket: v.pakket, sinds: v.sinds, status: v.status })).slice(0, 60),
      declaraties: z.declaraties.slice(0, 60),
      kpi: {
        actief: z.verzekerden.filter(v => v.status === 'actief').length,
        open: z.declaraties.filter(d => d.status === 'ingediend').length,
        goedgekeurd: z.declaraties.filter(d => d.status === 'goedgekeurd').length
      } };
  }

  /* ---- inschrijven: een mens schrijft in, op codenaam ---- */
  async function schrijfIn(code, b, wie) {
    const z = Z(code);
    const codenaam = schoon(b.codenaam, 60);
    const pakket = PAKKETTEN[b.pakket] != null ? b.pakket : null;
    if (!codenaam) return { status: 400, error: 'Op welke codenaam schrijft u in?' };
    if (!pakket) return { status: 400, error: 'Kies basis, plus of top.' };
    let memberKey = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(codenaam) : null; memberKey = t && t.key; } catch (e) {}
    if (!memberKey) return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
    if (z.verzekerden.find(v => v.memberKey === memberKey && v.status === 'actief'))
      return { status: 409, error: 'Dit lid heeft al een actieve zorgpolis.' };
    const pas = 'ZP-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const v = { id: id('v'), pas, codenaam, memberKey, pakket, sinds: nu().slice(0, 10),
      status: 'actief', door: schoon(wie, 60) || 'verzekeraar' };
    z.verzekerden.unshift(v); cap(z.verzekerden, MAX_LIJST);
    // de pas ligt direct in de wallet van het lid, geldig tot het einde van het jaar
    try { walletVoeg(memberKey, { soort: 'pas', titel: 'Zorgpas Segur (' + pakket + ')', code: pas,
      bron: 'zorgpolis', geldigTot: nu().slice(0, 4) + '-12-31' }); } catch (e) {}
    save();
    return { status: 200, ok: true, verzekerde: { id: v.id, pas, codenaam, pakket, sinds: v.sinds }, maandpremie: PAKKETTEN[pakket] };
  }
  function stopZet(code, vId) {
    const z = Z(code);
    const v = z.verzekerden.find(x => x.id === String(vId || ''));
    if (!v) return { status: 404, error: 'Verzekerde niet gevonden.' };
    if (v.status !== 'actief') return { status: 409, error: 'Deze polis is al gestopt.' };
    v.status = 'gestopt';
    try { walletWegBron(v.memberKey, 'zorgpolis', v.pas); } catch (e) {}
    save();
    return { status: 200, ok: true };
  }

  /* ---- declaraties: indienen op de pas, en een mens beslist ---- */
  function declaratieIn(code, b) {
    const z = Z(code);
    const pas = schoon(b.pas, 20).toUpperCase();
    const v = z.verzekerden.find(x => x.pas === pas);
    if (!v || v.status !== 'actief') return { status: 409, error: 'Geen actieve zorgpas met dit nummer.' };
    const omschrijving = schoon(b.omschrijving, 160);
    const bedrag = Math.round(Number(b.bedrag) * 100) / 100;
    if (!omschrijving) return { status: 400, error: 'Waar gaat de declaratie over?' };
    if (!(bedrag > 0 && bedrag <= 25000)) return { status: 400, error: 'Een bedrag tussen 0 en 25.000.' };
    const d = { id: id('d'), pas, codenaam: v.codenaam, omschrijving, bedrag, status: 'ingediend', reden: '', door: '', om: nu() };
    z.declaraties.unshift(d); cap(z.declaraties, MAX_LIJST); save();
    return { status: 200, ok: true, declaratie: d };
  }
  function declaratieBeslis(code, b, wie) {
    const z = Z(code);
    const d = z.declaraties.find(x => x.id === String(b.id || ''));
    if (!d) return { status: 404, error: 'Declaratie niet gevonden.' };
    if (d.status !== 'ingediend') return { status: 409, error: 'Hierover is al beslist.' };
    if (b.besluit === 'goedgekeurd') { d.status = 'goedgekeurd'; }
    else if (b.besluit === 'afgewezen') {
      const reden = schoon(b.reden, 160);
      if (!reden) return { status: 400, error: 'Afwijzen kan alleen met een reden; die krijgt het lid te zien.' };
      d.status = 'afgewezen'; d.reden = reden;
    } else return { status: 400, error: 'Kies goedgekeurd of afgewezen.' };
    d.door = schoon(wie, 60) || 'verzekeraar'; d.om = nu();
    save();
    return { status: 200, ok: true, declaratie: d };
  }

  /* ---- de pas-controle: niet meer dan actief, pakket en codenaam ---- */
  function pasCheck(code, pasnr) {
    const z = Z(code);
    const v = z.verzekerden.find(x => x.pas === schoon(pasnr, 20).toUpperCase());
    if (!v) return { status: 404, error: 'Onbekend pasnummer.' };
    return { status: 200, actief: v.status === 'actief', pakket: v.pakket, codenaam: v.codenaam };
  }

  return { zorgpolis: { overzicht, schrijfIn, stopZet, declaratieIn, declaratieBeslis, pasCheck } };
}

module.exports = { maakZorgpolis };
