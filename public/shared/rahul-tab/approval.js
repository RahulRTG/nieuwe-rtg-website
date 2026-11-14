(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.RTGRahulApproval = api;
})(typeof globalThis === 'undefined' ? null : globalThis, function () {
  'use strict';
  function create(opts) {
    var page = opts.page, win = opts.win, open = [], auth = '', path = '', boundOwner = '', boundContext = null, generatie = 0;
    var label = page.querySelector('[data-approval]'), button = page.querySelector('[data-approve]');
    function clear() { generatie++; open = []; auth = ''; path = ''; boundOwner = ''; boundContext = null; label.textContent = 'Geen open voorstel'; button.hidden = true; }
    function pastBij(c) {
      try { return !!c && !!win.RTGLiveTwin && typeof win.RTGLiveTwin.pastBij === 'function' && win.RTGLiveTwin.pastBij(c) === true; }
      catch (e) { return false; }
    }
    function show(data, token, isMember, owner, bronContext) {
      var snapshot;
      try { snapshot = JSON.parse(JSON.stringify(bronContext)); } catch (e) { clear(); return; }
      if (!pastBij(snapshot) || !data || data.error || data.ok === false) { clear(); return; }
      generatie++;
      boundContext = snapshot;
      open = Array.isArray(data.goedkeuringen) ? data.goedkeuringen.slice() : []; auth = token; boundOwner = owner;
      var world = isMember ? 'member' : data && data.goedkeuringWereld === 'staff' ? 'staff' : 'supplier';
      path = '/api/' + world + '/doe/bevestig'; var proposal = open[0];
      if (!proposal) { clear(); return; }
      label.textContent = proposal.samenvatting || proposal.pad || 'Voorstel klaar'; button.hidden = false;
    }
    async function confirm() {
      await opts.sync(); var proposal = open[0], owner = opts.owner(), ronde = generatie, context = boundContext;
      if (!proposal || !auth || boundOwner !== owner || !pastBij(context)) { clear(); return false; }
      if (!win.confirm('Controleer deze exacte actie:\n\n' + (proposal.samenvatting || proposal.pad) + '\n\nWilt u dit eenmalige voorstel uitvoeren?')) return false;
      if (generatie !== ronde) return false;
      if (!pastBij(context) || opts.owner() !== owner) { clear(); return false; }
      button.disabled = true;
      try {
        var response = await win.fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth }, body: JSON.stringify({ goedkeuringId: proposal.id, akkoord: true }) });
        var data = await response.json(); await opts.sync();
        if (generatie !== ronde) return false;
        if (opts.owner() !== owner || !pastBij(context)) { clear(); return false; }
        if (!response.ok || data.error) throw new Error(data.error || 'Bevestiging mislukt.');
        if (win.RTGLiveTwin) win.RTGLiveTwin.bevestigd(data);
        opts.add('rahul', 'U heeft het exacte voorstel bevestigd en de server heeft het ' + (data.ok === true ? 'uitgevoerd.' : 'geweigerd.'));
        open.shift(); var world = path.indexOf('/staff/') >= 0 ? 'staff' : path.indexOf('/member/') >= 0 ? 'member' : 'supplier';
        show({ goedkeuringen: open, goedkeuringWereld: world }, auth, world === 'member', owner, context); return true;
      } catch (error) {
        await opts.sync();
        if (generatie !== ronde) return false;
        if (opts.owner() !== owner || !pastBij(context)) { clear(); return false; }
        opts.add('rahul', error.message || 'Het voorstel is niet uitgevoerd.'); return false;
      } finally { button.disabled = false; }
    }
    return Object.freeze({ clear: clear, show: show, confirm: confirm });
  }
  return Object.freeze({ create: create });
});
