/* ============================================================================
   DE KETEN VAN EEN BESCHERMZAAK -- de grendels, bij elkaar.

   Vier stuks, en ze zijn geen van vieren een volgorde-advies:

   1. DE VEILIGHEIDSVRAAG GAAT VOOR ALLES. Een zaak staat op 'veiligheid' en
      komt daar alleen weg als er twee dingen zijn beantwoord: is deze mens NU
      veilig, en kan iemand meekijken. Niet omdat wij dat willen weten, maar
      omdat elk volgend antwoord ervan afhangt -- een terugbelverzoek naar een
      telefoon waar de dader op meekijkt, is de gevaarlijkste hulp die er is.

   2 en 3 GAAN OVER WIE DIT MAG HOREN en staan in ./toestemming.js: een
      overdracht noemt een ontvanger en de toestemming noemt dezelfde, en
      intrekken werkt meteen en achteruit. Ze zijn daarheen verhuisd op de
      10 KB van keuringsregel 13, en niet omdat ze minder wegen.

   4. SLUITEN VRAAGT EEN ZELFGEKOZEN BEWAARTERMIJN, MET EEN REDEN. Er is hier
      geen standaardtermijn zoals de 730 dagen van een casus. Dat is de grens
      uit HDI.md par. 5.2: wie een geweldszaak automatisch twee jaar bewaart,
      heeft twee jaar lang iets dat gevonden kan worden. De termijn is dus een
      besluit van een mens, tussen een dag en een jaar, met de reden erbij.

   EN WAT ER NIET IS: een verwijderfunctie. Net als bij het incidentenregister
   en de meldcode. Een dossier dat de organisatie kan laten verdwijnen,
   beschermt de organisatie en niet de mens.
   ========================================================================== */
'use strict';

const { KETEN, keurInvoer, beeld } = require('./klasse');

const MAX_BEWAARDAGEN = 365;

module.exports = (ctx, eigen) => {
  const { nu, schoon, audit, wie, poort, save } = ctx;
  const { vind, zaken } = eigen;

  /* De poort van dit domein. Bewust hetzelfde recht als de casus
     ('casus.beheren'): wie hulpvragen mag behandelen, mag dit ook -- er komt
     geen tweede rechtenmodel bij (LAT.md regel 4). De VLAG is wel een andere,
     zodat een stad die deze zaken niet aankan hem uit kan laten staan. */
  const deur = (req, stadId) => poort(wie(req), stadId, 'casus.beheren', 'individual_cases');

  function schuif(z, naar) {
    const mag = KETEN[z.stand] || [];
    if (!mag.includes(naar)) {
      return { status: 400, error: 'Van "' + z.stand + '" kan een beschermzaak niet naar "' + naar +
        '". Wat wel kan: ' + (mag.length ? mag.join(', ') : 'niets meer, deze zaak is gesloten') + '.' };
    }
    return null;
  }

  /* ---------- stap 1: de veiligheidsvraag ---------- */
  function veiligheid(req, id, b) {
    b = b || {};
    const stuk = keurInvoer(b); if (stuk) return stuk;
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const g = deur(req, z.stad); if (!g.ok) return g;
    if (z.gesloten) return { status: 400, error: 'Deze zaak is gesloten.' };
    if (typeof b.nuVeilig !== 'boolean') {
      return { status: 400, error: 'Is deze mens op dit moment veilig? Ja of nee -- "weet niet" is hier nee.' };
    }
    if (typeof b.kanMeekijken !== 'boolean') {
      return { status: 400, error: 'Kan er iemand meekijken op het toestel of meeluisteren? Ja of nee. Hier hangt af hoe wij contact opnemen.' };
    }
    z.veiligheid = { nuVeilig: b.nuVeilig, kanMeekijken: b.kanMeekijken,
      hoeContact: schoon(b.hoeContact, 120) || null, door: wie(req).key, at: nu() };
    z.bijgewerkt = nu();
    audit(wie(req).key, 'beschermzaak.veiligheid', z.codenaam,
      (b.nuVeilig ? 'nu veilig' : 'NIET veilig') + (b.kanMeekijken ? ', er kan meegekeken worden' : ''));
    save();
    return { ok: true, zaak: beeld(z),
      melding: b.nuVeilig ? 'Genoteerd. De zaak kan nu naar "minimaal": alleen wat nodig is om iets te doen.'
        : 'Genoteerd dat deze mens NIET veilig is. Regel eerst de veiligheid; de rest kan wachten.' };
  }

  /* ---------- de stand verzetten ---------- */
  function stand(req, id, naar, b) {
    b = b || {};
    const stuk = keurInvoer(b); if (stuk) return stuk;
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const g = deur(req, z.stad); if (!g.ok) return g;
    if (z.gesloten) return { status: 400, error: 'Deze zaak is gesloten. Een nieuwe zorg is een nieuwe zaak.' };
    const fout = schuif(z, String(naar || '')); if (fout) return fout;

    /* GRENDEL 1: weg van 'veiligheid' kan alleen als de vraag beantwoord is. */
    if (z.stand === 'veiligheid' && !z.veiligheid) {
      return { status: 400, error: 'Beantwoord eerst de veiligheidsvraag: is deze mens nu veilig, en kan iemand meekijken?' };
    }
    /* GRENDEL 3, de andere helft: zonder staande toestemming geen stabilisatie
       of overdracht. Hij wordt bij ELKE stap opnieuw gelezen en niet een keer
       bij de intake afgevinkt -- dat is het verschil tussen een toestemming die
       je kunt intrekken en een vinkje dat er ooit stond. */
    if ((naar === 'stabilisatie' || naar === 'overdracht') && !(z.toestemming && !z.ingetrokken)) {
      return { status: 400, error: 'Hiervoor moet de toestemming staan, en op dit moment staat hij niet.' };
    }
    z.stand = String(naar);
    z.bijgewerkt = nu();
    (z.stappen = z.stappen || []).push({ stand: z.stand, tekst: schoon(b.tekst, 300) || null, door: wie(req).key, at: nu() });
    audit(wie(req).key, 'beschermzaak.stand', z.codenaam, z.stand);
    save();
    return { ok: true, zaak: beeld(z) };
  }

  /* ---------- sluiten, met een zelfgekozen termijn ---------- */
  function sluit(req, id, b) {
    b = b || {};
    const stuk = keurInvoer(b); if (stuk) return stuk;
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const g = deur(req, z.stad); if (!g.ok) return g;
    if (z.gesloten) return { status: 400, error: 'Deze zaak is al gesloten.' };
    const uitkomst = schoon(b.uitkomst, 300);
    if (uitkomst.length < 5) return { status: 400, error: 'Hoe is het afgelopen? Een zaak die sluit zonder uitkomst, is administratief dicht en feitelijk open.' };
    const dagen = Math.round(Number(b.bewaarDagen));
    if (!Number.isFinite(dagen) || dagen < 1 || dagen > MAX_BEWAARDAGEN) {
      return { status: 400, error: 'Kies zelf een bewaartermijn tussen 1 en ' + MAX_BEWAARDAGEN +
        ' dagen. Er is hier met opzet geen standaardtermijn: bij deze zaken is elke dag bewaren een besluit.' };
    }
    const waarom = schoon(b.bewaarWaarom, 200);
    if (waarom.length < 5) return { status: 400, error: 'Waarom deze termijn? Een termijn zonder reden is een gewoonte.' };
    z.stand = 'gesloten';
    z.gesloten = { uitkomst, door: wie(req).key, at: nu() };
    z.bewaarTot = new Date(Date.now() + dagen * 86400000).toISOString();
    z.bewaarWaarom = waarom;
    z.bijgewerkt = nu();
    audit(wie(req).key, 'beschermzaak.gesloten', z.codenaam, uitkomst.slice(0, 60) + ' | ' + dagen + ' dagen');
    save();
    return { ok: true, zaak: beeld(z) };
  }

  /* Toestemming, intrekken en de overdracht staan in ./toestemming.js. Ze horen
     bij elkaar (grendel 2 en 3 zijn twee kanten van dezelfde vraag: wie mag dit
     horen) en dit bestand liep over de 10 KB van keuringsregel 13. */
  const t = require('./toestemming')(ctx, { vind, deur });

  return { veiligheid, stand, sluit, toestemming: t.toestemming, trekIn: t.trekIn,
    draagOver: t.draagOver, MAX_BEWAARDAGEN };
};
module.exports.MAX_BEWAARDAGEN = MAX_BEWAARDAGEN;
