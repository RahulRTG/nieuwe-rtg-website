/* Mobility OS (deelmodule): de bedrijfspendel. Een werkgever zegt wat hij wil
   -- "elke werkdag tussen station Haarlem en ons kantoor, van 06:00 tot 10:00
   en van 16:00 tot 20:00, elk half uur" -- en het systeem maakt daar een
   vervoersdienst van.

   DIT KAN DE STERKSTE ONDERSCHEIDENDE FUNCTIE ZIJN, en de reden is saai:
   bedrijven leveren voorspelbare, terugkerende vraag. Een consument bestelt een
   rit als hij eraan denkt; een werkgever met tweehonderd medewerkers levert elke
   werkdag om zes uur 's ochtends dezelfde bus vol.

   Hier staat de DIENST: opzetten, wijzigen, weghalen, en hoe hij eruitziet. Wat
   eruit volgt -- de dienstregeling, de zitplaatsen en de stap naar een echte
   rit -- staat in ./pendel-rooster. */

const DAGNAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const VENSTERS_MAX = 6;

module.exports = (ctx) => {
  const { db, save, id, schoon, nu, modAan, plekBepaal } = ctx;

  function ensurePendel() {
    if (!Array.isArray(db.data.mobPendels)) db.data.mobPendels = [];
  }
  const pendelsVan = code => { ensurePendel(); return db.data.mobPendels.filter(p => p.werkgever === code); };
  const pendelMet = pid => { ensurePendel(); return db.data.mobPendels.find(p => p.id === pid) || null; };

  const tijd = t => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || '')) ? String(t) : null);
  const minutenVan = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  /* De dienst opzetten of bijwerken. Een venster zonder geldige tijden of een
     interval van nul zou een dienstregeling opleveren die of leeg is of
     oneindig -- allebei stil, dus allebei geweigerd. */
  function pendelZet(werkgever, body = {}) {
    ensurePendel();
    const m = modAan('corporate_shuttles', { org: werkgever, stad: schoon(body.stad, 40) || null });
    if (!m.aan) return { status: 409, error: 'Bedrijfspendels staan hier uit: ' + m.reden };

    const bestaand = body.id ? pendelMet(schoon(body.id, 40)) : null;
    if (body.id && (!bestaand || bestaand.werkgever !== werkgever)) return { status: 404, error: 'Pendeldienst niet gevonden.' };
    if (bestaand && body.weg) {
      db.data.mobPendels = db.data.mobPendels.filter(p => p.id !== bestaand.id);
      save();
      return { ok: true, weg: bestaand.id };
    }

    const van = plekBepaal(body.van, null), naar = plekBepaal(body.naar, null);
    if (van.error) return { status: 400, error: 'Vertrekpunt: ' + van.error };
    if (naar.error) return { status: 400, error: 'Bestemming: ' + naar.error };

    const vensters = [];
    for (const v of (Array.isArray(body.vensters) ? body.vensters : []).slice(0, VENSTERS_MAX)) {
      const a = tijd(v.van), b = tijd(v.tot);
      const elke = Math.round(Number(v.elkeMin));
      if (!a || !b) return { status: 400, error: 'Een venster heeft een begin- en eindtijd als uu:mm.' };
      if (minutenVan(b) <= minutenVan(a)) return { status: 400, error: 'Het venster ' + a + '-' + b + ' eindigt niet na zijn begin.' };
      if (!Number.isFinite(elke) || elke < 5 || elke > 240) return { status: 400, error: 'Laat de bus elke 5 tot 240 minuten rijden.' };
      vensters.push({ van: a, tot: b, elkeMin: elke });
    }
    if (!vensters.length) return { status: 400, error: 'Geef minstens een tijdvenster op.' };

    const dagen = (Array.isArray(body.dagen) ? body.dagen : [1, 2, 3, 4, 5])
      .map(d => Math.round(Number(d))).filter(d => d >= 0 && d <= 6);
    if (!dagen.length) return { status: 400, error: 'Geef minstens een rijdag op.' };

    const p = bestaand || { id: id('pd'), werkgever, gemaakt: nu(), reserveringen: [] };
    Object.assign(p, {
      naam: schoon(body.naam, 60) || 'Pendeldienst',
      van, naar, dagen: [...new Set(dagen)].sort(),
      vensters,
      capaciteit: Math.min(120, Math.max(1, Math.round(Number(body.capaciteit) || 16))),
      categorie: schoon(body.categorie, 20) || 'shuttlebus',
      vervoerder: schoon(body.vervoerder, 20) || null,
      uitzonderingen: (Array.isArray(body.uitzonderingen) ? body.uitzonderingen : [])
        .map(d => schoon(d, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 60),
      stad: schoon(body.stad, 40) || null,
      gewijzigd: nu()
    });
    if (!bestaand) db.data.mobPendels.push(p);
    save();
    return { ok: true, pendel: pendelBeeld(p) };
  }

  function pendelBeeld(p) {
    return { id: p.id, werkgever: p.werkgever, naam: p.naam, van: p.van, naar: p.naar,
      dagen: p.dagen, dagnamen: p.dagen.map(d => DAGNAMEN[d]), vensters: p.vensters,
      capaciteit: p.capaciteit, categorie: p.categorie, vervoerder: p.vervoerder,
      uitzonderingen: p.uitzonderingen || [], stad: p.stad || null,
      reserveringen: (p.reserveringen || []).length };
  }

  const pendelLijst = werkgever => ({ ok: true, pendels: pendelsVan(werkgever).map(pendelBeeld) });

  return { ensurePendel, pendelZet, pendelLijst, pendelMet, pendelsVan, pendelBeeld, DAGNAMEN, minutenVan };
};
