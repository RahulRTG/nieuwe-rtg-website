/* DE API-POORT -- sleutels, scopes, quota en contractregels voor koppelingen.

   WAT ER ACHTER DEZE POORT STAAT, IS EEN BESLUIT EN GEEN OMISSIE. De lijst met
   paden die een machinesleutel ooit mag raken (de toelating) begint LEEG. Een
   koppeling zet daar een pad in en krijgt dan sleutels, scopes, quota, een
   intrekknop en een spoor -- in plaats van een eigen deur die niemand meer
   terugvindt. Een poort die bij oplevering al half het platform ontsluit is
   geen poort maar een gat met een naam.

   VIER DINGEN DIE DEZE LAAG ECHT DOET:

   1. HET GEHEIM WORDT NOOIT BEWAARD. Bij het maken zie je het één keer; hier
      staat alleen een hash met zout. Een sleutellijst die de sleutels zelf
      bevat, is een sleutelbos aan de buitendeur.

   2. EEN SCOPE IS EEN PADPREFIX PLUS METHODEN, en hij moet binnen de toelating
      vallen. Vraagt iemand een scope die daarbuiten ligt, dan wordt de sleutel
      niet gemaakt -- niet stilzwijgend ingeperkt. Stil inperken levert een
      koppeling op die denkt dat hij ergens bij mag en pas in productie merkt
      van niet.

   3. HET QUOTUM OVERLEEFT EEN HERSTART. De teller staat in de opslag en niet in
      het geheugen. Een quotum dat bij elke herstart op nul begint, is geen
      quotum maar een suggestie -- en juist een koppeling die te hard loopt,
      veroorzaakt de herstart.

   4. UITFASERING WORDT AANGEKONDIGD EN NIET STIL DOORGEVOERD. Een pad in de
      toelating kan een einddatum dragen; tot die datum werkt hij en zegt hij
      erbij dat hij verdwijnt. Daarna weigert hij met dezelfde reden. */
'use strict';

const { veiligGelijk } = require('../util');
const { nu: klokNu, datum: klokDatum } = require('../../lib/klok');

const UUR = 3600000;
const MAX_SLEUTELS = 50;

function maakApiPoort({ db, save, crypto, journaal }) {
  function vak() {
    if (!db.data.apiPoort || typeof db.data.apiPoort !== 'object') db.data.apiPoort = {};
    const v = db.data.apiPoort;
    if (!v.sleutels || typeof v.sleutels !== 'object') v.sleutels = {};
    if (!Array.isArray(v.toelating)) v.toelating = [];
    return v;
  }
  const nu = () => klokDatum().toISOString();
  const hash = (geheim, zout) => crypto.createHash('sha256').update(zout + ':' + geheim).digest('hex');

  /* ---------- de toelating: wat mag hier ooit achter ---------- */

  function laatToe(pad, opties, door) {
    const p = String(pad || '').trim();
    if (!p.startsWith('/api/')) return { error: 'Een toelating is een pad dat met /api/ begint.', status: 400 };
    const v = vak();
    if (v.toelating.some(t => t.pad === p)) return { error: 'Dat pad staat er al in.', status: 409 };
    const o = opties || {};
    v.toelating.push({ pad: p, versie: String(o.versie || 'v1'),
      uitfasering: o.uitfasering ? String(o.uitfasering) : null,
      waarvoor: String(o.waarvoor || '').slice(0, 200), door: String(door || ''), at: nu() });
    save();
    if (journaal) journaal.noteer({ actie: 'api-toelating erbij', actor: door, niveau: 'hand', reden: p });
    return { toelating: v.toelating };
  }

  function haalWeg(pad, door) {
    const v = vak();
    const i = v.toelating.findIndex(t => t.pad === String(pad));
    if (i < 0) return { error: 'Dat pad staat er niet in.', status: 404 };
    v.toelating.splice(i, 1);
    save();
    if (journaal) journaal.noteer({ actie: 'api-toelating eraf', actor: door, niveau: 'hand', reden: String(pad) });
    return { toelating: v.toelating };
  }

  const binnenToelating = (pad) => vak().toelating.find(t => pad === t.pad || pad.startsWith(t.pad + '/')) || null;

  /* ---------- de sleutels ---------- */

  /* De publieke vorm van een sleutel: alles behalve het geheim zelf. */
  const kort = (s) => ({ id: s.id, naam: s.naam, eigenaar: s.eigenaar || null, scopes: s.scopes,
    quotaPerUur: s.quotaPerUur, gemaakt: s.gemaakt, door: s.door, vervalt: s.vervalt,
    ingetrokken: s.ingetrokken, laatst: s.laatst, geweigerd: s.geweigerd,
    gebruiktDitUur: s.teller && s.teller.uur === Math.floor(klokNu() / UUR) ? s.teller.n : 0 });

  function maak(naam, scopes, opties) {
    const v = vak();
    if (Object.keys(v.sleutels).length >= MAX_SLEUTELS) {
      return { error: 'Er zijn al ' + MAX_SLEUTELS + ' sleutels. Trek er een in; een sleutellijst die ' +
        'niemand meer overziet, is geen toegangsbeheer.', status: 409 };
    }
    const gevraagd = Array.isArray(scopes) ? scopes : [];
    if (!gevraagd.length) return { error: 'Een sleutel zonder scope mag niets en heeft geen zin.', status: 400 };
    const buiten = gevraagd.filter(sc => !binnenToelating(String(sc && sc.pad || '')));
    if (buiten.length) {
      return { error: 'Deze scopes vallen buiten de toelating: ' + buiten.map(x => x.pad).join(', ') +
        '. Zet het pad eerst in de toelating; stil inperken zou een koppeling opleveren die pas in ' +
        'productie merkt dat hij er niet bij mag.', status: 403 };
    }
    const o = opties || {};
    const id = crypto.randomUUID().slice(0, 8);
    const geheim = crypto.randomBytes(24).toString('base64url');
    const zout = crypto.randomBytes(8).toString('hex');
    v.sleutels[id] = {
      id, naam: String(naam || 'sleutel ' + id).slice(0, 80),
      eigenaar: String(o.eigenaar || '').slice(0, 120),
      zout, hash: hash(geheim, zout),
      scopes: gevraagd.map(sc => ({ pad: String(sc.pad),
        methoden: Array.isArray(sc.methoden) && sc.methoden.length
          ? sc.methoden.map(m => String(m).toUpperCase()) : ['GET', 'POST'] })),
      quotaPerUur: Math.max(1, Math.min(Number(o.quotaPerUur || 1000), 1000000)),
      gemaakt: nu(), door: String(o.door || ''),
      vervalt: o.dagen ? new Date(klokNu() + Number(o.dagen) * 86400000).toISOString() : null,
      ingetrokken: null, teller: { uur: 0, n: 0 }, laatst: null, geweigerd: 0
    };
    save();
    if (journaal) journaal.noteer({ actie: 'api-sleutel gemaakt', actor: o.door, niveau: 'hand',
      objectType: 'apisleutel', objectId: id, reden: String(naam || '') });
    /* Het geheim gaat één keer mee terug en wordt nergens bewaard. */
    return { sleutel: kort(v.sleutels[id]), geheim: 'RTG-' + id + '.' + geheim,
      let: 'dit geheim is nu één keer te zien. Het staat nergens opgeslagen; raakt het kwijt, dan maak ' +
        'je een nieuwe sleutel en trek je deze in.' };
  }

  function trekIn(id, door, reden) {
    const s = vak().sleutels[String(id)];
    if (!s) return { error: 'Die sleutel bestaat niet.', status: 404 };
    if (s.ingetrokken) return { error: 'Die sleutel is al ingetrokken.', status: 409 };
    s.ingetrokken = { at: nu(), door: String(door || ''), reden: String(reden || '') };
    save();
    if (journaal) journaal.noteer({ actie: 'api-sleutel ingetrokken', actor: door, niveau: 'hand',
      objectType: 'apisleutel', objectId: s.id, reden: String(reden || '') });
    return { sleutel: kort(s) };
  }

  /* De controle bij elk verzoek staat in ./apipoort-controle.js. Dit bestand
     gaat over beheer (wat mag er ooit achter, wie krijgt een sleutel); die
     laag staat in het pad van elk binnenkomend verzoek en heeft daardoor
     andere eisen -- niets lekken, en elke nee met een reden. */
  const { apiSleutelOk } = require('./apipoort-controle')({ vak, save, hash, veiligGelijk, binnenToelating, kort, UUR });

  function stand() {
    const v = vak();
    const sleutels = Object.keys(v.sleutels).map(id => kort(v.sleutels[id]));
    return {
      sleutels, toelating: v.toelating, max: MAX_SLEUTELS,
      tel: { sleutels: sleutels.length, actief: sleutels.filter(s => !s.ingetrokken).length,
        paden: v.toelating.length },
      let: v.toelating.length ? null
        : 'de toelating is leeg, dus er staat niets achter deze poort. Dat is een besluit en geen ' +
          'omissie: een poort die bij oplevering al half het platform ontsluit, is een gat met een naam. ' +
          'Zet hier het pad van een koppeling in, dan krijgt die sleutels, scopes, quota en een intrekknop.'
    };
  }

  return { laatToe, haalWeg, maak, trekIn, apiSleutelOk, stand, binnenToelating };
}

module.exports = { maakApiPoort, MAX_SLEUTELS };
