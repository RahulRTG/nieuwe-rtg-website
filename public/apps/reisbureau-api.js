/* De bestaande leden-API van het reisbureau, gebonden aan de sessie waarmee
   het scherm opende. Ook een uitgestelde gegevenspoort blijft aan diezelfde
   sessie gebonden; deze factory verleent geen rechten en vernieuwt geen token. */
(function (w) {
  'use strict';
  w.RTGReisbureauApi = function (beginToken) {
    let token = beginToken;
    function sessieActueel(gevraagdMet) {
      if (token !== gevraagdMet) return false;
      try { return localStorage.getItem('rtg_member_token') === gevraagdMet; } catch (e) { return false; }
    }
    function sessieGewijzigd() {
      token = null;
      return Object.assign(new Error('Uw sessie is gewijzigd. Open het reisbureau opnieuw.'), { status: 401 });
    }
    w.addEventListener('storage', e => {
      if ((e.key === 'rtg_member_token' && e.oldValue !== e.newValue) || e.key === null) {
        token = null; document.body.hidden = true; location.reload();
      }
    });
    const api = (pad, body, herkans) => {
      const gevraagdMet = token;
      if (!sessieActueel(gevraagdMet)) return Promise.reject(sessieGewijzigd());
      return fetch(pad, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + gevraagdMet },
        body: JSON.stringify(body || {})
      }).then(async r => {
        const d = await r.json().catch(() => ({}));
        if (!sessieActueel(gevraagdMet)) throw sessieGewijzigd();
        /* 428 = de gegevenspoort: dezelfde sessie wordt vóór herhalen opnieuw getoetst. */
        const p = herkans ? null : (w.RTGGegevensPoort && w.RTGGegevensPoort.vang(d, r.status,
          () => sessieActueel(gevraagdMet) ? api(pad, body, true) : Promise.reject(sessieGewijzigd()), api));
        if (p) return p;
        if (!r.ok) {
          if (r.status === 401) token = null;
          const fout = new Error(d.error || 'Er ging iets mis.'); fout.status = r.status; throw fout;
        }
        return d;
      });
    };
    return api;
  };
})(window);
