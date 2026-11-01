/* Saving to this device, in one place.

   localStorage throws rather than returning null in a private window, and
   it throws again when the quota is full. Several tools had already grown
   their own try/catch around it, each slightly different - and a tool that
   silently fails to save someone's notes is worse than one that says so.

   Every read returns the fallback on any failure. Every write reports
   whether it worked, so a tool can tell the user instead of pretending. */

var CJA_STORE = (function () {
  var available = null;

  function check() {
    if (available !== null) return available;
    try {
      var probe = '__cja_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      available = true;
    } catch (e) {
      available = false;
    }
    return available;
  }

  return {
    /* True when this browser will actually keep what we write. */
    available: check,

    /* Reads and parses JSON. Anything unexpected - missing, corrupt, or the
       wrong shape - gives back the fallback rather than throwing into the
       middle of a tool's startup. */
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        var parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (e) {
        return fallback;
      }
    },

    /* Returns true when the write stuck. Callers are expected to use this -
       that is the whole point of it not being a plain setter. */
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        available = false;
        return false;
      }
    },

    remove: function (key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    },

    /* A small status line a tool can show verbatim, so the wording about
       saving is consistent across every tool that keeps data. */
    note: function () {
      return check()
        ? 'Saved on this device only. It does not sync anywhere, and clearing ' +
          'your browser data will erase it.'
        : 'Saving is not available in this browser, so nothing here will be ' +
          'kept once you close the page. A private window usually causes this.';
    }
  };
})();

if (typeof window !== 'undefined') window.CJA_STORE = CJA_STORE;
