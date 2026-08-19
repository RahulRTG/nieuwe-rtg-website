/* RTG School: Proof of Learning -- het bewijs onder elke beheersing.

   Een leerdoel stond in het leerpaspoort als "behaald: ja, op datum". Dat is
   een bewering zonder onderbouwing, en precies de zwarte doos die een leerling
   niet kan navragen. Hier draagt elk behaald doel zijn BEWIJS: wat er is
   gedaan, wanneer, en door wie het is gezien.

   Deze laag staat los van het paspoort zelf (onderwijs.js) omdat het een eigen
   vraag is: het paspoort weet WAT je kunt, dit weet WAAROM we dat denken.

   Drie regels die dit eerlijk houden:

   1. WAT JE ZELF MELDT, TELT MINDER. Een oefensessie en een praktijkopdracht
      meld je zelf; een toets en een observatie komen van school. Alleen met
      bewijs van buiten je eigen sessies kan een beheersing 'sterk' worden.
   2. ER KOMT GEEN GETAL UIT. De beheersing is een woord met de reden erbij
      (enkel, stevig, sterk) en nooit een percentage of een score -- anders
      staat er binnen een maand een ranglijst van kinderen.
   3. BEWIJS VERDWIJNT NIET STIL. Het paspoort bewaart de laatste twintig
      stukken per doel; wat eruit valt, valt eruit omdat het oud is en niet
      omdat het slecht uitkwam. */
const BEWIJSSOORTEN = {
  oefening: { naam: 'oefensessie', zelf: true },
  huiswerk: { naam: 'oefen-huiswerk', zelf: true },
  praktijk: { naam: 'praktijkopdracht', zelf: true },
  toets: { naam: 'toets', zelf: false },
  observatie: { naam: 'gezien door een leraar', zelf: false }
};
const MAX_BEWIJS = 20;

/* De beheersing volgt UIT het bewijs en wordt nooit opgeslagen: een
   opgeslagen oordeel raakt los van waar het op stoelde. */
function beheersingVan(rij) {
  const bewijs = (rij && rij.bewijs) || [];
  if (!bewijs.length) return { woord: 'gemeld', uitleg: 'Dit doel staat afgevinkt zonder bewijs erbij.' };
  const soorten = new Set(bewijs.map(b => b.soort));
  const vanBuiten = bewijs.filter(b => BEWIJSSOORTEN[b.soort] && !BEWIJSSOORTEN[b.soort].zelf);
  const telling = [...soorten].map(s => bewijs.filter(b => b.soort === s).length + 'x ' + (BEWIJSSOORTEN[s] || {}).naam).join(', ');
  /* Wat 'sterk' maakt is niet de HOEVEELHEID maar de ONAFHANKELIJKHEID.
     Twee bevestigingen van school (een toets en een observatie) wegen
     zwaarder dan drie eigen oefensessies achter elkaar -- die laatste
     kunnen alle drie op dezelfde goede dag vallen. Vandaar twee wegen naar
     sterk: veel bewijs met een bevestiging erbij, of twee bevestigingen. */
  if (soorten.size >= 2 && (vanBuiten.length >= 2 || (bewijs.length >= 3 && vanBuiten.length >= 1)))
    return { woord: 'sterk', uitleg: telling + ' -- waaronder ' + vanBuiten.length + ' keer bevestigd door school.' };
  if (bewijs.length >= 2 && (soorten.size >= 2 || bewijs.length >= 3))
    return { woord: 'stevig', uitleg: telling + (vanBuiten.length ? '.' : '. Bevestiging vanuit school maakt dit sterk.') };
  return { woord: 'enkel', uitleg: telling + '. Meer soorten bewijs maken dit steviger.' };
}

/* paspoort/save/nu/scho komen uit onderwijs.js: dit is dezelfde opslag, geen
   tweede administratie naast het paspoort. */
function maakBewijs({ paspoort, save, nu, scho }) {
  function doelBehaald(key, d, opties) {
    d = d || {}; opties = opties || {};
    // valideer de RAUWE invoer: rommel wordt geweigerd, niet stilletjes verbouwd
    const doel = String(d.doel == null ? '' : d.doel).trim();
    if (!/^[a-z0-9][a-z0-9.-]{1,79}$/.test(doel)) return { status: 400, error: 'Geef een geldig leerdoel-id.' };
    const soort = String((d.bewijs && d.bewijs.soort) || d.soort || '').trim();
    if (soort && !Object.prototype.hasOwnProperty.call(BEWIJSSOORTEN, soort))
      return { status: 400, error: 'Onbekend soort bewijs. Kies: ' + Object.keys(BEWIJSSOORTEN).join(', ') + '.' };
    /* Een toets of observatie mag alleen van school komen. Zou een leerling
       die zelf mogen melden, dan is "bevestigd door school" een vinkje dat
       iedereen zelf zet -- en daarmee waardeloos. */
    if (soort && !BEWIJSSOORTEN[soort].zelf && !opties.vanSchool)
      return { status: 403, error: 'Een toets of observatie legt de school vast, niet de leerling zelf.' };
    const p = paspoort(key);
    /* Zelf een doel afvinken kan pas als je op de ladder staat. Bewijs VAN
       SCHOOL mag ook binnenkomen bij een kind dat zich hier nooit heeft
       ingeschreven: de school plaatste het in een klas, en die waarneming
       verdwijnt niet omdat het kind zelf nog geen fase koos. De fase van de
       klas reist dan mee als stempel. */
    if (!p.fase && !opties.vanSchool) return { status: 400, error: 'Schrijf eerst in op een fase.' };
    if (Object.keys(p.doelen).length >= 20000 && !p.doelen[doel]) return { status: 400, error: 'Het paspoort zit vol; dat is een record -- vraag RTG om ruimte.' };
    if (!p.doelen[doel]) p.doelen[doel] = { fase: p.fase || scho(d.fase, 20) || null, op: nu(), bewijs: [] };
    const rij = p.doelen[doel];
    if (!Array.isArray(rij.bewijs)) rij.bewijs = [];
    if (soort) {
      rij.bewijs.push({ soort, at: nu(), detail: scho(d.bewijs && d.bewijs.detail, 120) || null,
        door: opties.vanSchool ? (scho(d.bewijs && d.bewijs.door, 60) || 'school') : null });
      if (rij.bewijs.length > MAX_BEWIJS) rij.bewijs.splice(0, rij.bewijs.length - MAX_BEWIJS);
      rij.laatste = nu();
    }
    p.at = nu(); save();
    return { ok: true, doel, behaald: rij, beheersing: beheersingVan(rij) };
  }

  /* "Waarom denkt RTG dat ik dit kan?" -- de vraag die een zwarte doos niet kan
     beantwoorden. Hier staat het antwoord: het bewijs zelf, op volgorde. */
  function bewijsVan(key, d) {
    const doel = String((d && d.doel) || '').trim();
    const p = paspoort(key);
    if (doel) {
      const rij = p.doelen[doel];
      if (!rij) return { status: 404, error: 'Dit leerdoel staat (nog) niet in je paspoort.' };
      return { ok: true, doel, sinds: rij.op, beheersing: beheersingVan(rij),
        bewijs: (rij.bewijs || []).slice().reverse(),
        uitleg: 'Dit is waarop de beheersing berust. Er komt geen cijfer uit en niets hiervan wordt vergeleken met een ander.' };
    }
    const alle = Object.entries(p.doelen).map(([id, rij]) => ({ doel: id, sinds: rij.op,
      laatste: rij.laatste || rij.op, stukken: (rij.bewijs || []).length, beheersing: beheersingVan(rij).woord }));
    return { ok: true, doelen: alle.slice(0, 500), aantal: alle.length,
      uitleg: 'Per leerdoel waarop de beheersing berust. Vraag een doel op voor het bewijs zelf.' };
  }

  return { doelBehaald, bewijsVan };
}

module.exports = { maakBewijs, beheersingVan, BEWIJSSOORTEN, MAX_BEWIJS };
