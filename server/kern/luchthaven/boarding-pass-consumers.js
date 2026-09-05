/* Consumers van een boarding-passcredential. De validatie en de claim zitten
   bewust in dezelfde luchthaven-collectietransactie: een tweede server kan
   tussen controleren en gebruiken niets veranderen. */
'use strict';

module.exports = ({ t, metLuchthaven, nu, vluchtReden, passPubliek }) => {
  const ongeldigeCode = () => ({ ok: true, geldig: false,
    reden: 'Geen geldige boarding pass.' });

  function controleerEnClaim({ code, partnerCode, actor }) {
    const partij = String(partnerCode || '').trim().toUpperCase().slice(0, 40);
    if (!partij) return { status: 403,
      error: 'Boarding-passcontrole vereist een expliciete luchthavenzaak.' };
    return metLuchthaven(l => {
      const gevonden = t.vindOpCode(l, code);
      const rij = gevonden && gevonden.huidig;
      if (!rij) return ongeldigeCode();
      const b = rij.b, v = t.vindVlucht(l, b.vluchtId);
      const reden = t.bearer.reden(rij.toegang,
        { doel: t.DOEL, scope: 'airport.partner.verify' });
      if (reden || !t.onderwerpKlopt(b, v, rij.toegang) ||
          b.status !== 'ingecheckt' || vluchtReden(v)) return ongeldigeCode();
      if (!Array.isArray(b.pass_claims)) b.pass_claims = [];
      const eerder = b.pass_claims.find(c => c.soort === 'partner-check' &&
        c.partij === partij && c.pass_rotatie === rij.toegang.rotatie);
      if (!eerder) {
        t.bearer.gebruik(rij.toegang);
        b.pass_claims.push({ id: t.nieuwId('pc'), soort: 'partner-check', partij,
          actor: String(actor || 'partner').slice(0, 100),
          pass_rotatie: rij.toegang.rotatie, at: nu() });
      }
      return { ok: true, geldig: true, herhaald: !!eerder,
        pass: passPubliek(b, v) };
    });
  }

  function loungeIn({ actor, loungeId, code, lounges }) {
    return metLuchthaven(l => {
      const lounge = lounges[String(loungeId || '')];
      if (!lounge) return { status: 400, error: 'Kies een lounge (salon of royal).' };
      const gevonden = t.vindOpCode(l, code), rij = gevonden && gevonden.huidig;
      if (!rij) return { status: 409, error: 'Geen geldige boarding pass.' };
      const b = rij.b, v = t.vindVlucht(l, b.vluchtId);
      const reden = t.bearer.reden(rij.toegang,
        { doel: t.DOEL, scope: 'airport.lounge.entry' });
      if (reden || !t.onderwerpKlopt(b, v, rij.toegang) ||
          b.status !== 'ingecheckt' || vluchtReden(v))
        return { status: 409, error: 'Geen geldige boarding pass.' };
      if (String(loungeId) === 'royal' && !l.vips.some(x => x.vluchtId === v.id))
        return { status: 403, error: 'De Koninklijke Vleugel is uitsluitend voor gasten op een vlucht met een vip-protocol.' };
      if (l.lounge.some(g => g.boekingId === b.id && !g.uit))
        return { status: 409, error: 'Deze gast is al binnen.' };
      const binnen = l.lounge.filter(g => g.lounge === loungeId && !g.uit).length;
      if (binnen >= lounge.capaciteit)
        return { status: 409, error: lounge.naam + ' zit vol (' + lounge.capaciteit + ' plaatsen).' };
      t.bearer.gebruik(rij.toegang);
      const g = { id: t.nieuwId('lg'), lounge: String(loungeId),
        boekingId: b.id, passId: b.pass_id, passRotatie: rij.toegang.rotatie,
        codenaam: b.codenaam, vlucht: v.nummer, tijd: v.tijd,
        door: String(actor || 'lounge').slice(0, 100), in: nu(), uit: null };
      l.lounge.unshift(g);
      if (l.lounge.length > 20000) l.lounge.length = 20000;
      return { status: 200, ok: true, gast: g, lounge: lounge.naam };
    });
  }

  return { controleerEnClaim, loungeIn };
};
