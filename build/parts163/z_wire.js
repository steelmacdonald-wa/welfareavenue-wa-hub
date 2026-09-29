
  /* ---------- test hook ---------- */
  window.w163 = { state: function () { return G; }, ready: function () { return G.ready; }, settle: settle,
    phone: { state: function () { return PH; }, open: openSheet, close: closeSheet, bar: paintBar, key: barKey, team: myTeamId, items: hubItems } };
})();
