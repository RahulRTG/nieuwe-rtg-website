const klok = require('../lib/klok');
/* Accounts, deel "intreklijst": welke uitgegeven tokens niet meer gelden.

   Afgesplitst uit ./tokens.js. De naad is echt en niet cosmetisch: al het
   andere in dat bestand is pure cryptografie (een HMAC zetten en nakijken,
   zonder staat), terwijl dit deel als enige naar de DATABASE schrijft en leest
   -- de tabel ingetrokken_tokens. Twee soorten werk met twee heel verschillende
   faalwijzen: een rekenfout hier is een verkeerde handtekening, een fout daar is
   een uitgelogd token dat toch nog werkt.

   De strikte tokenvorm komt uit ./tokens.js mee, zodat er maar EEN opvatting
   bestaat van wat een token is -- dat was nou juist de fout die de intreklijst
   ooit omzeilbaar maakte (zie de uitleg daar bij TOKENVORM). */
const S = require('./state');
const kluis = require('./kluis');

module.exports = function maakIntreklijst(strikt) {
  /* DE INTREKLIJST -- waarom een staatloos token er toch een nodig heeft.

     Een sessietoken is hier staatloos: alles staat erin, ondertekend met HMAC.
     Dat is snel en het schaalt, maar het heeft één gevolg dat lang onopgemerkt
     bleef: er is server-side niets om weg te gooien, dus UITLOGGEN KON NIETS
     INTREKKEN. /api/logout antwoordde { ok: true } en het token bleef daarna
     gewoon werken -- tot de vervaldatum, dertig dagen later. Op een geleende
     of gedeelde computer is dat precies het moment waarop iemand denkt veilig
     te zijn. Gevonden in aanvalsronde 2 (scripts/aanval.js, punt 14).

     De lijst blijft klein en heeft geen opruimtaak nodig: een ingetrokken
     token hoeft maar te worden onthouden tot het moment waarop het toch al zou
     verlopen. Daarna mag het weg -- verifyToken wijst het dan af op de datum.
     We ruimen luk-raak op tijdens het intrekken zelf, zodat er geen timer bij
     hoeft. */
  function trekIn(token) {
    token = strikt(token);
    if (!token) return false;
    let exp = 0;
    try {
      const body = Buffer.from(String(token).split('.')[0], 'base64url').toString();
      exp = Number(body.split('.')[1]) || 0;
    } catch (e) { return false; }
    if (!exp || exp < klok.nu()) return true; // al verlopen: niets te onthouden
    try {
      // meteen opruimen wat toch al verlopen was: geen aparte taak nodig
      S.zin('DELETE FROM ingetrokken_tokens WHERE verloopt < ?').run(klok.nu());
      S.zin('INSERT OR REPLACE INTO ingetrokken_tokens (hash, verloopt) VALUES (?, ?)')
        .run(kluis.sign(String(token)), exp);
      return true;
    } catch (e) { return false; }
  }
  /* Een DOELGEBONDEN token intrekken (e-mailbevestiging, SSO-overdracht).

     trekIn() hierboven werkt niet voor deze vorm: een sessietoken heeft de body
     `id.exp`, een actie-token `id.doel.exp`. trekIn leest daardoor het DOEL waar
     hij de vervaldatum verwacht, krijgt NaN, en concludeert "al verlopen, niets
     te onthouden" -- hij geeft netjes true terug en doet niets. Stil falen, en
     precies bij het soort token dat je eenmalig wilt kunnen maken.

     Nodig geworden bij de SSO-overdracht: die geeft de bezoeker een bewijs van
     zestig seconden mee dat hij bij ons inruilt voor een echt sessietoken.
     Zonder intrekken zou dat bewijs die hele minuut opnieuw te gebruiken zijn --
     en het staat in een URL, dus het staat ook in de browsergeschiedenis. */
  function trekInActie(token, doel) {
    token = strikt(token);
    if (!token) return false;
    let exp = 0;
    try {
      const body = Buffer.from(String(token).split('.')[0], 'base64url').toString();
      const delen = body.split('.');
      if (doel !== undefined && delen[1] !== String(doel)) return false; // ander doel: niet aan zitten
      exp = Number(delen[2]) || 0;
    } catch (e) { return false; }
    if (!exp || exp < klok.nu()) return true; // al verlopen: niets te onthouden
    try {
      S.zin('DELETE FROM ingetrokken_tokens WHERE verloopt < ?').run(klok.nu());
      S.zin('INSERT OR REPLACE INTO ingetrokken_tokens (hash, verloopt) VALUES (?, ?)')
        .run(kluis.sign(String(token)), exp);
      return true;
    } catch (e) { return false; }
  }
  function isIngetrokken(token) {
    token = strikt(token);
    if (!token) return true; // geen geldige vorm: behandel als ongeldig
    try {
      const r = S.zin('SELECT verloopt FROM ingetrokken_tokens WHERE hash = ?')
        .get(kluis.sign(String(token)));
      return !!r && Number(r.verloopt) >= klok.nu();
    } catch (e) { return false; }
  }


  return { trekIn, trekInActie, isIngetrokken };
};
