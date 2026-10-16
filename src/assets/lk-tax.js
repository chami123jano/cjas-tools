/* Sri Lankan payroll figures, kept in one place.
   Two tools need these - the PAYE calculator and the payslip builder - and
   a second copy is how a tax tool ends up quietly disagreeing with itself
   after a budget. Change a rate here and both tools follow.

   Current as of the tax tables effective 1 April 2025, under the Inland
   Revenue (Amendment) Act No. 2 of 2025. The IRD has published nothing for
   2026/2027, so these still stand. */

var LK_TAX = {
  /* The date these figures came into force, shown to the user so they know
     how old the tool's assumptions are. */
  effectiveFrom: '1 April 2025',

  /* Tax-free personal relief, per year. */
  relief: 1800000,

  /* Each band is the width of the slab above the relief, and its rate. */
  bands: [
    { width: 1000000, rate: 0.06 },
    { width: 500000, rate: 0.18 },
    { width: 500000, rate: 0.24 },
    { width: 500000, rate: 0.30 },
    { width: Infinity, rate: 0.36 }
  ],

  epfEmployee: 0.08,
  epfEmployer: 0.12,
  etfEmployer: 0.03,

  /* Annual tax on an annual income, plus the band-by-band working so a
     tool can show how it got there. Bands above the income are returned
     with zero tax rather than omitted, so the whole table can be shown. */
  annualTax: function (annual) {
    var taxable = Math.max(0, annual - this.relief);
    var rows = [];
    var lower = this.relief;
    var total = 0;

    for (var i = 0; i < this.bands.length; i++) {
      var b = this.bands[i];
      var inBand = Math.min(taxable, b.width);
      var tax = inBand * b.rate;
      total += tax;
      rows.push({
        from: lower,
        to: b.width === Infinity ? Infinity : lower + b.width,
        rate: b.rate,
        amount: inBand,
        tax: tax
      });
      lower = b.width === Infinity ? lower : lower + b.width;
      taxable -= inBand;

      if (taxable <= 0) {
        for (var j = i + 1; j < this.bands.length; j++) {
          var nb = this.bands[j];
          rows.push({
            from: lower,
            to: nb.width === Infinity ? Infinity : lower + nb.width,
            rate: nb.rate, amount: 0, tax: 0
          });
          lower = nb.width === Infinity ? lower : lower + nb.width;
        }
        break;
      }
    }
    return { total: total, rows: rows };
  },

  /* Monthly APIT on a monthly figure. Worked yearly then divided, which
     avoids the rounding drift of the printed monthly table. */
  monthlyTax: function (monthlyGross) {
    return this.annualTax(monthlyGross * 12).total / 12;
  }
};

if (typeof window !== 'undefined') window.LK_TAX = LK_TAX;
