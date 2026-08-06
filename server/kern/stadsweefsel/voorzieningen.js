/* RTG Stadsweefsel, deel "voorzieningen": het sociaal domein, en waar het STOPT.

   Dit is de laag waar een stadsplatform het meest kan helpen en het meest kan
   beschadigen, en het verschil zit in één keuze die hier hard staat:

   ER KOMT GEEN ENKELE PERSOON IN. Geen dossier, geen signaal over een inwoner,
   geen combinatie van gegevens die tot iemand herleidt. Wat hier woont zijn
   VOORZIENINGEN (waar staan ze, wat kunnen ze aan, hoe lang is de wachttijd)
   en TELLINGEN per wijk. Daarmee kun je zien dat in Oud-West de vraag naar
   schuldhulp oploopt terwijl de capaciteit gelijk blijft -- en dat is precies
   het soort inzicht waarvoor je een stadsplatform wilt.

   Wat je er NIET mee kunt, en dat is met opzet:
     - zien wie er in de schuldhulp zit;
     - een inwoner een risicoscore geven;
     - stromen combineren tot een profiel ("veel taxi + betalingsachterstand");
     - een wachtlijst op naam sorteren.
   Die vragen zijn niet moeilijk maar VERBODEN, en niet door de techniek: ze
   vragen eerst een grondslag en een besluit dat RTG moet nemen, niet de bouwer.
   Zolang dat besluit er niet is, hoort de deur op slot en hoort dat op te
   vallen -- vandaar dat `grenzen()` ze bij naam noemt in plaats van dat ze
   stilzwijgend ontbreken.

   DE TELLINGEN ZIJN GROF EN DAT IS EEN KEUZE. Een aantal per wijk per maand is
   genoeg om beleid op te maken en te weinig om iemand mee te vinden. Een
   telling per straat per dag zou dat laatste wel kunnen, en die maken we dus
   niet -- ook al zou hij "preciezer" zijn.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

const DAG = 86400000;
/* De soorten voorzieningen. Ze worden objecten in het register: ze staan
   ergens, ze hebben een beheerder en een conditie, en ze gaan een keer dicht.
   Het SOCIALE deel (capaciteit, wachttijd, doelgroep) woont hier. */
const SOORTEN = {
  buurthuis: 'Buurthuis', consultatiebureau: 'Consultatiebureau', wijkteam: 'Wijkteam',
  schuldhulp: 'Schuldhulpverlening', voedselhulp: 'Voedselbank', dagopvang: 'Dagopvang',
  crisisopvang: 'Crisisopvang', jeugdteam: 'Jeugdteam', ouderensteunpunt: 'Ouderensteunpunt'
};
// de stromen waarop geteld wordt; bewust dezelfde namen als de voorzieningen
const STROMEN = Object.keys(SOORTEN);
const MAAND = 30 * DAG;

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo, obj } = ctx;

  const bak = () => {
    if (!d().weefselZorg || typeof d().weefselZorg !== 'object') d().weefselZorg = {};
    const z = d().weefselZorg;
    if (!z.voorzieningen || typeof z.voorzieningen !== 'object') z.voorzieningen = {};
    if (!z.tellingen || typeof z.tellingen !== 'object') z.tellingen = {};
    return z;
  };

  /* Een voorziening vastleggen. Het object komt in het gewone register (dus op
     de kaart, met een conditie en een beheerder); de capaciteit en de wachttijd
     staan hier. Twee vragen over hetzelfde gebouw, twee plekken -- net als bij
     een bedrijfspand. */
  function voorzieningMaak({ soort, naam, lat, lng, plekken, wachtDagen, doelgroep, organisatie, wie }) {
    const s = String(soort || '');
    if (!SOORTEN[s]) return { status: 400, error: 'Kies een soort: ' + Object.keys(SOORTEN).join(', ') + '.' };
    const r = obj.objectMaak({ soort: 'pand', naam: schoon(naam, 80) || SOORTEN[s], lat, lng,
      eigenaar: schoon(organisatie, 60) || 'gemeente', beheerder: schoon(organisatie, 60) || 'welzijnsorganisatie' });
    if (!r.ok) return r;
    const v = { id: 'V-' + crypto.randomBytes(3).toString('hex').toUpperCase(), objectId: r.object.id,
      soort: s, soortLabel: SOORTEN[s], naam: r.object.naam,
      organisatie: schoon(organisatie, 60) || 'onbekend',
      plekken: Number(plekken) > 0 ? Math.round(Number(plekken)) : null,
      wachtDagen: Number(wachtDagen) >= 0 ? Math.round(Number(wachtDagen)) : null,
      doelgroep: schoon(doelgroep, 80) || null, open: true, door: schoon(wie, 60) || 'kantoor', at: nu() };
    bak().voorzieningen[v.id] = v;
    save();
    return { ok: true, voorziening: publiek(v) };
  }

  function voorzieningZet({ id, plekken, wachtDagen, open, wie }) {
    const v = bak().voorzieningen[String(id || '')];
    if (!v) return { status: 404, error: 'Onbekende voorziening.' };
    if (plekken !== undefined) v.plekken = Number(plekken) >= 0 ? Math.round(Number(plekken)) : v.plekken;
    if (wachtDagen !== undefined) v.wachtDagen = Number(wachtDagen) >= 0 ? Math.round(Number(wachtDagen)) : v.wachtDagen;
    if (open !== undefined) v.open = !!open;
    v.door = schoon(wie, 60) || v.door;
    v.gewijzigdAt = nu();
    save();
    return { ok: true, voorziening: publiek(v) };
  }

  function publiek(v) {
    const o = obj.object(v.objectId);
    return { ...v, plaats: o ? geo.label(o.gebied) : null, lat: o ? o.lat : null, lng: o ? o.lng : null,
      gebied: o ? o.gebied : null, zone: o ? o.zone : null, conditie: o ? o.conditie : null };
  }

  /* EEN TELLING BIJBOEKEN. Dit is de enige ingang voor vraagcijfers, en hij
     neemt met opzet ALLEEN een aantal aan: soort stroom, wijk, maand, hoeveel.
     Er is geen veld waar een persoon in past, en dat is geen nalatigheid maar
     de vorm van de functie. Wie hier ooit een naam bij wil zetten, moet eerst
     dit bestand veranderen -- en dat is precies de drempel die er hoort te zijn. */
  function tel({ stroom, gebied, aantal, maand, wie }) {
    const s = String(stroom || '');
    if (!STROMEN.includes(s)) return { status: 400, error: 'Kies een stroom: ' + STROMEN.join(', ') + '.' };
    const g = geo.gebied(gebied) || geo.opNaam(gebied, 'wijk');
    if (!g) return { status: 404, error: 'Onbekend gebied; tel op wijkniveau.' };
    const wijk = geo.pad(g.id).find(x => x.niveau === 'wijk') || (g.niveau === 'wijk' ? g : null);
    if (!wijk) return { status: 400, error: 'Tellingen gaan per WIJK: fijner dan dat is niet nodig voor beleid en wel herleidbaar.' };
    const n = Number(aantal);
    if (!Number.isFinite(n) || n < 0 || n > 100000) return { status: 400, error: 'Geef een aantal tussen 0 en 100.000.' };
    const m = /^\d{4}-\d{2}$/.test(String(maand || '')) ? String(maand) : new Date(nu()).toISOString().slice(0, 7);
    const sleutel = s + '|' + wijk.id + '|' + m;
    bak().tellingen[sleutel] = { stroom: s, gebied: wijk.id, wijk: wijk.naam, maand: m,
      aantal: Math.round(n), door: schoon(wie, 60) || 'kantoor', at: nu() };
    save();
    return { ok: true, telling: bak().tellingen[sleutel] };
  }

  /* Het beeld: vraag tegen aanbod, per wijk. Dit is waar de laag zijn nut moet
     bewijzen -- en waar hij eerlijk moet zijn als er te weinig staat om iets
     te zeggen. */
  function beeld({ maanden } = {}) {
    geo.zorgGeografie();
    const n = Number(maanden) > 0 ? Math.min(Math.round(Number(maanden)), 36) : 6;
    const vanaf = new Date(nu() - n * MAAND).toISOString().slice(0, 7);
    const tellingen = Object.values(bak().tellingen).filter(t => t.maand >= vanaf);
    const vz = Object.values(bak().voorzieningen).map(publiek);

    const perWijk = geo.opNiveau('wijk').map(w => {
      const eigen = tellingen.filter(t => t.gebied === w.id);
      const hier = vz.filter(v => v.gebied && (v.gebied === w.id || geo.binnen(w.id, v.gebied)));
      const perStroom = {};
      for (const t of eigen) {
        const r = perStroom[t.stroom] || (perStroom[t.stroom] = { stroom: t.stroom, totaal: 0, maanden: 0, eerste: null, laatste: null });
        r.totaal += t.aantal; r.maanden++;
        if (!r.eerste || t.maand < r.eerste.maand) r.eerste = t;
        if (!r.laatste || t.maand > r.laatste.maand) r.laatste = t;
      }
      const stromen = Object.values(perStroom).map(r => ({
        stroom: r.stroom, label: SOORTEN[r.stroom], totaal: r.totaal, maanden: r.maanden,
        // richting alleen als er ECHT twee verschillende maanden zijn
        richting: r.maanden >= 2 && r.eerste.maand !== r.laatste.maand
          ? (r.laatste.aantal > r.eerste.aantal ? 'omhoog' : r.laatste.aantal < r.eerste.aantal ? 'omlaag' : 'gelijk')
          : 'te weinig maanden om een richting te zien',
        voorzieningen: hier.filter(v => v.soort === r.stroom).length,
        plekken: hier.filter(v => v.soort === r.stroom).reduce((s2, v) => s2 + (v.plekken || 0), 0),
        wachtDagen: hier.filter(v => v.soort === r.stroom && v.wachtDagen != null)
          .reduce((mx, v) => Math.max(mx, v.wachtDagen), 0) || null
      }));
      return { wijk: w.naam, gebied: w.id, voorzieningen: hier.length, stromen };
    });

    // waar loopt de vraag op terwijl er niets bij komt? Dat is de enige
    // conclusie die deze cijfers dragen, en meer moet hij ook niet trekken
    const signalen = [];
    for (const w of perWijk) for (const s of w.stromen) {
      if (s.richting === 'omhoog' && !s.voorzieningen)
        signalen.push('In ' + w.wijk + ' loopt de vraag naar ' + s.label.toLowerCase() + ' op, en er staat daar geen enkele voorziening van die soort.');
      else if (s.richting === 'omhoog' && s.wachtDagen && s.wachtDagen > 28)
        signalen.push('In ' + w.wijk + ' loopt de vraag naar ' + s.label.toLowerCase() + ' op terwijl de wachttijd al ' + s.wachtDagen + ' dagen is.');
    }
    return { status: 200, maanden: n, soorten: SOORTEN, voorzieningen: vz, perWijk, signalen,
      tellingen: tellingen.length,
      let_op: !tellingen.length
        ? 'Er zijn nog geen tellingen geboekt; alles hierboven gaat alleen over het AANBOD.'
        : 'Alles hier is geteld per wijk per maand. Er staat geen enkele persoon in, en er is geen veld waar er een in past.',
      grenzen: grenzen().vragen };
  }

  /* De grenzen -- wat deze laag met opzet NIET kan -- staan in
     ./sociaalgrenzen.js. Ze horen bij deze laag als lijst en niet als
     voetnoot, en ze zijn pure tekst: geen gedrag, wel een belofte. */
  const { grenzen } = require('./sociaalgrenzen')();

  return {
    SOORTEN, STROMEN, tel, beeld, grenzen,
    api: {
      weefselVoorzieningen: beeld,
      weefselVoorzieningMaak: voorzieningMaak,
      weefselVoorzieningZet: voorzieningZet,
      weefselTelling: tel,
      weefselSociaalGrenzen: grenzen
    }
  };
};
