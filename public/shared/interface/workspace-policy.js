/* Centraal policy- en permissionbesluit. Modules vragen gezag; zij maken het
   niet zelf. Tenantbeleid kan hier later dezelfde beslisvorm invoegen. */
(function (w) {
  'use strict';
  w.RTGWorkspacePolicy = function (opties) {
    var o = opties || {}, actor = o.actor || { id: 'current-user', type: 'member' };
    function toestemming(permission, moduleId) {
      if (!permission) return true;
      try { return typeof o.permission !== 'function' || o.permission(permission, moduleId, actor) === true; }
      catch (e) { return false; }
    }
    function besluit(vraag) {
      var v = vraag || {}, toegestaan = toestemming(v.permission, v.owner), reden = toegestaan ? 'allowed' : 'permission-denied';
      if (toegestaan && typeof o.tenantPolicy === 'function') {
        try {
          var tenant = o.tenantPolicy(v, actor);
          if (tenant === false || tenant && tenant.allowed === false) { toegestaan = false; reden = tenant.reason || 'tenant-policy'; }
        } catch (e) { toegestaan = false; reden = 'policy-error'; }
      }
      if (toegestaan && v.offline === false && w.navigator && w.navigator.onLine === false) {
        toegestaan = false; reden = 'offline-not-supported';
      }
      return Object.freeze ? Object.freeze({ allowed: toegestaan, reason: reden, actor: actor,
        confirmationRequired: toegestaan && !!v.confirm, auditRequired: v.audit === true,
        idempotencyRequired: v.idempotent !== false }) : { allowed: toegestaan, reason: reden };
    }
    return { actor: function () { return actor; }, allowed: toestemming, decide: besluit };
  };
})(window);
