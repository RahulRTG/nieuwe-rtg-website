/* Levenslijn, deelbestand "aanwijzingen": de echte bronnen, elk vertaald naar
   aanwijzingen in de vaste vorm (zie ./hulp.js, `aanwijzing`).

   GEEN GOKWERK, en dat is de hele opzet van dit bestand. Elke aanwijzing komt
   uit iets dat de mens ZELF heeft gedaan: een paspoort laten verifieren, zich
   op een schoolfase inschrijven, een personeelsrol met zijn PIN bewijzen,
   iemand in zijn Entourage zetten. Waar zo'n handeling ontbreekt, komt er hier
   niets uit, en dan is de fase 'nvt'. Nooit 'komt' -- want "dit komt nog voor
   u" is geen waarneming maar een verwachting over andermans leven, en die
   heeft dit systeem niet te hebben (LEVEN.md par. 2.2 en 2.7).

   Elke bron leest UITSLUITEND wat zijn domein exporteert; er wordt hier
   nergens in db.data van een ander domein gegrepen. Elke bron valt in zijn
   eigen try/catch en komt bij een fout met naam in stil[] (het patroon van
   kern/geldwereld.js `bron()`), want een lijn die een bron stil kwijtraakt
   leest als een leeg leven.

   De kern wordt LAAT gelezen (in de functies, nooit bij het laden), zodat de
   mountvolgorde van de kernlagen er niet toe doet -- zelfde reden als in
   kern/geldwereld.js en kern/geldgraaf/bronnen.js.

   Gemount via ./index.js. */
'use strict';

const { dagVan, jaarVan, geldigJaar, aanwijzing, bron } = require('./hulp');

/* De trappen van de onderwijsladder naar de fasen van deze lijn. 'leven' (een
   leven lang leren) staat er met opzet NIET bij: dat is geen fase op deze
   lijn maar iets dat naast de hele lijn loopt, en hem als elfde fase opvoeren
   zou hem tot een eindstation maken. */
const TRAP_FASE = { po: 'basisschool', vo: 'middelbaar', mbo: 'studie', hbo: 'studie', wo: 'studie' };

module.exports = ({ kern }) => {

  /* ---- GEBOORTE: het jaar uit het geverifieerde paspoort ----
     Alleen het JAAR, en dat komt zo uit kern/paspoort.js: die module gaat over
     paspoorten en geeft precies dit ene getal terug. Hier staat dus geen
     kennis over waar het ledendossier ligt of hoe een sleutel eruitziet --
     dezelfde afspraak als bij paspoortVervaldatumVan voor de levensgraaf.
     Geen paspoort (een demo-persona, een gast): geen aanwijzing, en dan begint
     de lijn gewoon later. Dat is eerlijker dan een geraden jaartal. */
  function geboorte(key) {
    const jaar = geldigJaar(kern.paspoortGeboortejaarVan(key));
    if (jaar === null) return [];
    return [aanwijzing({ fase: 'geboorte', staat: 'geweest', vanaf: jaar, bron: 'paspoort',
      wat: 'geboortejaar ' + jaar + ' uit uw geverifieerde paspoort' })];
  }

  /* ---- ONDERWIJS: het leerpaspoort (kern/onderwijs.js) ----
     Twee dingen komen hier vandaan: waar iemand NU staat, en elke overstap die
     hij ooit heeft gemaakt. De ladder-fasen komen uit onderwijs zelf
     (kern.onderwijs.FASEN), zodat de trap van 'vwo' hier niet nog een keer
     wordt nagetikt (LAT.md regel 4).

     `vanaf` is het vroegste jaar waarvoor er een AANWIJZING is, en niet een
     geschat beginjaar. Wie zich pas bij groep 6 inschreef, krijgt dat jaar te
     zien; de lijn doet niet alsof hij weet wanneer groep 1 begon. */
  function onderwijs(key) {
    const mod = kern.onderwijs;
    const ladder = new Map((mod.FASEN || []).map(f => [f.id, f]));
    const faseVan = (id) => {
      const l = ladder.get(String(id || ''));
      return l ? (TRAP_FASE[l.trap] || null) : null;
    };
    const naamVan = (id) => (ladder.get(String(id || '')) || {}).naam || String(id || '');

    const p = mod.mijn(key) || {};
    const uit = [];
    const huidig = p.fase && p.fase.id ? p.fase.id : null;

    for (const h of (Array.isArray(p.historie) ? p.historie : [])) {
      const jaar = jaarVan(h.op);
      const uitF = faseVan(h.van);
      if (uitF) {
        uit.push(aanwijzing({ fase: uitF, staat: 'geweest', bron: 'onderwijs',
          wat: naamVan(h.van) + ' afgerond of verlaten' + (jaar ? ' in ' + jaar : '') }));
      }
      const inF = faseVan(h.naar);
      if (inF) {
        uit.push(aanwijzing({ fase: inF, staat: h.naar === huidig ? 'nu' : 'geweest',
          vanaf: jaar, sinds: dagVan(h.op), bron: 'onderwijs',
          wat: 'overstap naar ' + naamVan(h.naar) + (jaar ? ' in ' + jaar : '') }));
      }
    }

    /* De huidige inschrijving apart, want de allereerste inschrijving laat
       geen spoor in de historie na (kern/onderwijs.js schrijft daar pas bij
       een OVERSTAP). Zonder deze regel zou een leerling die nooit is
       overgestapt nergens op de lijn staan. */
    if (huidig && faseVan(huidig)) {
      uit.push(aanwijzing({ fase: faseVan(huidig), staat: 'nu', bron: 'onderwijs',
        wat: 'u staat ingeschreven op ' + naamVan(huidig) + ', leerjaar ' + (p.jaar || 1) }));
    }
    return uit;
  }

  /* ---- WERKROLLEN: de sleutelbos (kern/eenaccount.js accRollen) ----
     Wat hier binnenkomt is geen bewering maar een gebeurtenis met een datum:
     een personeelsrol vraagt de zaak-code plus de eigen PIN, een zaak-rol de
     bedrijfsinlog. Daarom leest deze bron accRollen en niet
     metier.bewezenRollen: die laatste vertaalt dezelfde rollen al naar
     schermtekst ('Eigenaar of beheer'), en op schermtekst matchen is een
     tweede plek waar dezelfde waarheid staat (LAT.md regel 4).

     'werkruimte' telt mee als werk: dat is een RTG Werk OS-lidmaatschap met
     een echte functie erachter. 'kantoor' telt NIET mee -- dat is de afgeleide
     backoffice-sleutel van de eigenaar en zegt iets over rechten, niet over
     een baan. */
  const ROL_FASE = { personeel: 'werk', werkruimte: 'werk', zaak: 'zaak' };

  function werkrollen(key) {
    const rollen = (kern.accRollen(key) || {}).rollen || [];
    const uit = [];
    for (const r of rollen) {
      const fase = ROL_FASE[r && r.rol];
      if (!fase) continue;
      const jaar = jaarVan(r.sinds);
      const waar = r.zaakNaam || r.naam || 'een RTG-zaak';
      uit.push(aanwijzing({ fase, staat: 'nu', vanaf: jaar, sinds: dagVan(r.sinds), bron: 'werkrollen',
        wat: (fase === 'zaak' ? 'bedrijfsinlog bewezen bij ' : 'werkrol bewezen bij ') + waar
          + (jaar ? ', sinds ' + jaar : '') }));
    }
    return uit;
  }

  /* ---- METIER: wat u ZELF over uw werk heeft opgeschreven ----
     Onbevestigd, en dat staat er ook bij. Werk buiten RTG bestaat, en het zou
     raar zijn als de lijn een leven leeg liet omdat de werkgever hier geen
     RTG-account heeft.

     Een metier-rol draagt zijn eigen jaartallen (`van` en `tot`, door metier
     al op een geldig jaar gekeurd), en die worden hier gebruikt zoals ze er
     staan: een rol met een eindjaar is GEWEEST, een rol zonder eindjaar loopt
     nog. Er wordt niets bijgeteld en niets afgeleid -- een baan die tien jaar
     geleden ophield, maakt van 'werk' geen afgeronde levensfase zolang er nog
     een andere loopt; dat regelt het samenvoegen in ../index.js. */
  function metier(key) {
    const p = kern.metier.profielVan(key) || {};
    const uit = [];
    for (const r of (Array.isArray(p.rollen) ? p.rollen : [])) {
      const wat = r && String(r.wat || '').trim();
      if (!wat) continue;
      const tot = geldigJaar(r.tot);
      uit.push(aanwijzing({ fase: 'werk', staat: tot === null ? 'nu' : 'geweest',
        vanaf: r.van, bron: 'metier',
        wat: wat + (r.waar ? ' bij ' + r.waar : '') + ', door uzelf opgegeven en niet door RTG bevestigd' }));
    }
    return uit;
  }

  /* ---- ENTOURAGE: relatie en kinderen (kern/rechterhand/entourage.js) ----
     GETELD, NOOIT UITGESCHREVEN. Er komt hier geen naam voorbij, ook niet in
     `wat`. Voor 'kinderen' is dat geen beleefdheid maar LEVEN.md par. 2.1: wat
     over een minderjarige wordt vastgelegd, wordt VOOR het kind bewaard. Het
     staat al in Entourage, waar de mens het zelf heeft gezet; deze lijn hoeft
     alleen te weten DAT die fase speelt, en een tweede plek met kindernamen is
     een tweede plek die kan lekken.

     Geen datums in Entourage, dus geen jaartal. Een relatie of een kind hoort
     ook niet met een geschat beginjaar op een tijdlijn te belanden. */
  const BAND_FASE = {
    partner: { fase: 'relatie', een: 'partner', meer: 'partners' },
    kind: { fase: 'kinderen', een: 'kind', meer: 'kinderen' }
  };

  function entourage(key) {
    const e = kern.entourage(key) || {};
    const tel = new Map();
    for (const p of (Array.isArray(e.gezelschap) ? e.gezelschap : [])) {
      const b = BAND_FASE[p && p.band];
      if (b) tel.set(b, (tel.get(b) || 0) + 1);
    }
    const uit = [];
    for (const [b, n] of tel) {
      uit.push(aanwijzing({ fase: b.fase, staat: 'nu', bron: 'entourage',
        wat: n + ' ' + (n === 1 ? b.een : b.meer) + ' in uw Entourage, door uzelf ingevuld' }));
    }
    return uit;
  }

  const ALLE = [
    { naam: 'paspoort', lever: geboorte },
    { naam: 'onderwijs', lever: onderwijs },
    { naam: 'werkrollen', lever: werkrollen },
    { naam: 'metier', lever: metier },
    { naam: 'entourage', lever: entourage }
  ];

  /* 'levensgraaf' en 'rtf' staan in de bronnenlijst maar niet in ALLE: ze
     leveren geen aanwijzingen voor een fase. De levensgraaf levert de
     termijnen onder feiten(), rtf de vijf weergavegroepen. Ze horen wel in de
     lijst, zodat het scherm "deze bron is stil" voor alle bronnen op dezelfde
     manier kan tonen -- net als 'beleid' in kern/geldgraaf/bronnen.js. */
  const NAMEN = ALLE.map(b => b.naam).concat(['levensgraaf', 'rtf']);

  function verzamel(key) {
    const sporen = [], stil = [];
    for (const b of ALLE) bron(b.naam, () => b.lever(key), sporen, stil);
    return { sporen, stil, bronnen: NAMEN };
  }

  return { verzamel, NAMEN };
};
