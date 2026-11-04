(() => {
  const values = [202400, 210100, 207900, 216600, 229800, 232200, 243100, 248600];
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const freedoms = ["overview", "financial", "location", "time", "health"];
  let noteOpener = null;
  let focusBladeAfterNavigation = false;

  function chart(id, recent = false, compact = false) {
    const start = recent ? 4 : 0;
    const selected = values.slice(start);
    const labels = months.slice(start);
    const points = selected.map(
      (value, i) =>
        `${58 + (i * 532) / (selected.length - 1)},${174 - ((value - 200000) / 50000) * 132}`,
    );
    const axis = [42, 108, 174]
      .map(
        (y, i) =>
          `<line class="chart-grid" x1="58" x2="590" y1="${y}" y2="${y}"/><text class="chart-label" x="0" y="${y + 4}">${["$250k", "$225k", "$200k"][i]}</text>`,
      )
      .join("");
    return `<svg class="worth-chart ${compact ? "compact-chart" : ""}" viewBox="0 0 620 220" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">Illustrative net worth, ${labels[0]} to October</title><desc id="${id}-desc">${selected.map((value) => "$" + value.toLocaleString("en-US")).join(", ")}. Axis ranges from $200,000 to $250,000.</desc>${axis}<polyline points="${points.join(" ")}"/><circle cx="590" cy="45.696" r="4"/>${labels.map((label, i) => `<text class="chart-label" text-anchor="middle" x="${58 + (i * 532) / (labels.length - 1)}" y="208">${label}</text>`).join("")}</svg>`;
  }

  function screenHead(key, eyebrow, title, description) {
    return `<header class="screen-head"><div><p class="eyebrow">${eyebrow}</p><h1 id="title-${key}" tabindex="-1">${title}</h1><p class="screen-description">${description}</p></div><button class="quiet-button" data-note><span aria-hidden="true">✳</span> A quick check-in</button></header>`;
  }

  function tileTop(label, tag = "") {
    return `<div class="tile-top"><span class="tile-label">${label}</span>${tag ? `<span class="small-tag">${tag}</span>` : '<span class="open-arrow" aria-hidden="true">↗</span>'}</div>`;
  }

  function bars(data, labels, maximum, unit = "h") {
    return `<div class="soft-bars">${data.map((value, i) => `<div><span class="bar-value">${value}${unit}</span><div class="bar-track"><span style="height:${(value / maximum) * 100}%"></span></div><span class="bar-day">${labels[i]}</span></div>`).join("")}</div>`;
  }

  function metrics(items) {
    return `<dl class="summary-strip">${items.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
  }

  const home = `${screenHead("overview", "Your Thursday, in perspective", "A little more room.", "Four freedoms. One place to come back to.")}
    <div class="home-grid">
      <a href="#financial" class="tile home-money selectable">${tileTop("Financial")}<div class="balance-line"><div><p class="soft-label">Your net worth</p><h2>$248,600</h2></div><span class="growth-tag">↗ $5,500 this month</span></div>${chart("home-worth", false, true)}<div class="tile-bottom"><span>More options, less obligation.</span><span>38% saved <span aria-hidden="true">→</span></span></div></a>
      <a href="#location" class="tile home-place selectable">${tileTop("Location")}<div class="place-orbit" aria-hidden="true"><i></i><i></i><span></span></div><div class="place-copy"><p class="soft-label">A place to return to</p><h2>Boston.</h2><p>21 of your last 30 nights.</p></div><div class="next-place"><span class="route-symbol" aria-hidden="true">↗</span><div><small>A change of scenery</small><strong>Lisbon <span>Nov 6–12</span></strong></div></div></a>
      <a href="#time" class="tile home-time selectable">${tileTop("Time")}<div class="small-feature-number">14<span>h</span></div><p class="feature-caption">of deep work this week</p><div class="focus-marks" role="img" aria-label="Five days of deep work: 3.5, 2, 4, 1.5, and 3 hours">${[3.5, 2, 4, 1.5, 3].map((value) => `<span style="height:${(value / 4) * 100}%"></span>`).join("")}</div><p class="tile-note">Make space. Keep a little.</p></a>
      <a href="#health" class="tile home-health selectable">${tileTop("Health")}<div class="small-feature-number">7<span>h</span> 42<span>m</span></div><p class="feature-caption">average sleep</p><div class="rest-line"><span class="rest-symbol" aria-hidden="true">◒</span><span>4 movement sessions<br>7 nights of perspective</span></div><p class="tile-note">Rest is part of the picture.</p></a>
      <article class="tile moment-tile">${tileTop("A moment for you", "No rush")}<h2>Not everything<br>needs optimizing.</h2><p>Notice what’s working.<br>Leave room for the rest.</p><button class="moment-button" data-note>Take a moment <span aria-hidden="true">↗</span></button></article>
    </div>`;

  const accountRows = [
    ["Brokerage", "Investments", "$94,300", "Reviewed"],
    ["Retirement", "Investments", "$82,500", "Reviewed"],
    ["Cash reserve", "Savings", "$45,000", "Reviewed"],
    ["Everyday account", "Checking", "$9,800", "Reviewed"],
    ["Home equity", "Property", "$20,200", "Estimate"],
    ["Credit card", "Debt", "−$3,200", "Reviewed"],
  ];
  const financial = `${screenHead("financial", "Financial freedom", "Options, not obligations.", "A calm view of what you own and the room you’re creating.")}
    ${metrics([
      ["Net worth", "$248,600"],
      ["Invested", "$176,800"],
      ["Cash", "$54,800"],
      ["Saved this month", "$4,864"],
    ])}
    <div class="financial-grid"><section class="tile finance-chart" aria-labelledby="finance-chart-title"><div class="tile-top"><div><p class="soft-label">The long view</p><h2 id="finance-chart-title">Growing room.</h2></div><div class="period-control" role="group" aria-label="Chart period"><button data-range="all" aria-pressed="true">8 months</button><button data-range="recent" aria-pressed="false">4 months</button></div></div><div id="finance-graph">${chart("finance-worth")}</div><p class="chart-foot" id="chart-foot" aria-live="polite">March–October · illustrative net worth history</p></section><aside class="tile spending-panel">${tileTop("This month", "Sample")}<h2>The space<br>between.</h2><dl class="flow-list">${[
      ["Income", "$12,800", 100],
      ["Spending", "$7,936", 62],
      ["Saved", "$4,864", 38],
    ]
      .map(
        ([label, value, percent]) =>
          `<div><dt>${label}</dt><dd>${value}</dd><span class="flow-track" aria-hidden="true"><span style="width:${percent}%"></span></span></div>`,
      )
      .join(
        "",
      )}</dl><div class="savings-stamp"><strong>38%</strong><span>of take-home income<br>kept for what comes next</span></div></aside></div>
    <section class="tile accounts-tile" aria-labelledby="accounts-title"><div class="tile-top"><h2 id="accounts-title">A home for every account.</h2><span class="small-tag">6 sample accounts</span></div><div class="table-scroll" role="region" aria-label="Sample account balances, scroll horizontally if needed" tabindex="0"><table><thead><tr><th scope="col">Account</th><th scope="col" class="numeric">Balance</th><th scope="col">Type</th><th scope="col">Basis</th></tr></thead><tbody>${accountRows.map(([name, type, amount, basis]) => `<tr><th scope="row">${name}</th><td class="numeric">${amount}</td><td>${type}</td><td><span class="record-basis">${basis}</span></td></tr>`).join("")}</tbody><tfoot><tr><th scope="row">Net worth</th><td class="numeric">$248,600</td><td colspan="2">USD</td></tr></tfoot></table></div><p class="table-hint">Swipe or scroll for account type and basis →</p></section>`;

  const location = `${screenHead("location", "Location freedom", "Somewhere that feels like you.", "The places you spend time. The people who make them matter.")}
    <div class="location-grid"><article class="tile homebase-panel">${tileTop("Home base", "Past 30 nights")}<div class="location-motif" aria-hidden="true"><span></span><span></span><span></span></div><p class="soft-label">A familiar landing</p><h2>Boston.</h2><p>Massachusetts, United States</p><div class="homebase-bottom"><strong>21<span>/30</span></strong><span>nights at home.<br>A place to come back to.</span></div></article><section class="tile itinerary-panel" aria-labelledby="trips-title"><div class="tile-top"><div><p class="soft-label">On the horizon</p><h2 id="trips-title">A change of scenery.</h2></div><span class="small-tag">November</span></div><article class="trip-row"><span class="trip-code">LIS</span><div><h3>Lisbon, Portugal</h3><p>Nov 6–12 · a change of pace</p></div><span class="trip-length">6 nights</span></article><article class="trip-row"><span class="trip-code">NYC</span><div><h3>New York, NY</h3><p>Nov 19–21 · people and work</p></div><span class="trip-length">2 nights</span></article><div class="trip-reflection"><span aria-hidden="true">↗</span><p>Go somewhere new.<br>Keep somewhere familiar.</p></div></section><section class="tile nights-panel" aria-labelledby="nights-title"><div><p class="soft-label">The past 30 nights</p><h2 id="nights-title">Where your days became a life.</h2></div><div class="night-distribution"><div class="night-track" role="img" aria-label="21 nights Boston, 6 nights New York, 3 nights elsewhere"><span style="flex:21"></span><span style="flex:6"></span><span style="flex:3"></span></div><dl><div><dt>Boston</dt><dd>21 nights</dd></div><div><dt>New York</dt><dd>6 nights</dd></div><div><dt>Elsewhere</dt><dd>3 nights</dd></div></dl></div></section></div>`;

  const time = `${screenHead("time", "Time freedom", "A week with breathing room.", "For focused work, good company, and a little unplanned life.")}
    ${metrics([
      ["Tracked this week", "38h"],
      ["Deep work", "14h"],
      ["Meetings", "14h"],
      ["Personal", "10h"],
    ])}
    <section class="tile calendar-panel" aria-labelledby="calendar-title"><div class="tile-top"><h2 id="calendar-title">Protect a little space.</h2><span class="small-tag">October 12–16</span></div><div class="week-columns">${[
      ["Mon", "12", 3.5],
      ["Tue", "13", 2],
      ["Wed", "14", 4],
      ["Thu", "15", 1.5],
      ["Fri", "16", 3],
    ]
      .map(
        ([day, date, hours]) =>
          `<article class="week-day ${day === "Thu" ? "today" : ""}"><div class="day-heading"><span>${day}</span><strong>${date}</strong>${day === "Thu" ? "<small>Today</small>" : ""}</div><div class="focus-block"><span class="focus-dot" aria-hidden="true"></span><p>Deep work</p><strong>${hours}<small>h</small></strong></div><div class="people-block"><p>Connect</p><span>Meetings & people</span></div><div class="open-block"><span aria-hidden="true">+</span><p>A little open space</p></div></article>`,
      )
      .join(
        "",
      )}</div><p class="chart-foot">An illustrative rhythm, not a time-scaled calendar.</p></section>
    <div class="time-bottom"><section class="tile attention-panel" aria-labelledby="attention-title"><div><p class="soft-label">38 tracked hours</p><h2 id="attention-title">Three ways<br>to spend a week.</h2></div><div class="attention-figures"><div class="attention-track" role="img" aria-label="14 hours deep work, 14 hours meetings, 10 hours personal time"><span style="flex:14"></span><span style="flex:14"></span><span style="flex:10"></span></div><dl><div><dt>Deep work</dt><dd>14h</dd></div><div><dt>Meetings</dt><dd>14h</dd></div><div><dt>Personal</dt><dd>10h</dd></div></dl></div></section><a href="#health" class="tile rest-tile selectable"><span class="rest-symbol" aria-hidden="true">◒</span><h2>Rest belongs<br>on the calendar, too.</h2><span class="text-action">Find your rhythm ↗</span></a></div>`;

  const health = `${screenHead("health", "Health freedom", "Come back to your rhythm.", "Rest, movement, and a little attention to how you feel.")}
    ${metrics([
      ["Average sleep", "7h 42m"],
      ["Movement", "4 sessions"],
      ["Resting heart rate", "58 bpm"],
      ["Nights logged", "7 of 7"],
    ])}
    <div class="health-grid"><section class="tile sleep-panel" aria-labelledby="sleep-title"><div class="tile-top"><div><p class="soft-label">Rest, over seven nights</p><h2 id="sleep-title">A steadier rhythm.</h2></div><span class="small-tag">Hours of sleep</span></div>${bars([7, 8, 7.5, 8, 7.75, 7.25, 8.4], ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], 9)}<p class="chart-foot">Zero-based bars · sample observations, not medical guidance.</p></section><article class="tile feeling-panel">${tileTop("The part numbers miss")}<span class="feeling-mark" aria-hidden="true">◒</span><h2>And how<br>do you feel?</h2><p>The numbers are a starting point.<br>You get to fill in the rest.</p><button class="warm-button" data-note>Make a little note <span aria-hidden="true">↗</span></button></article><section class="tile movement-panel" aria-labelledby="movement-title"><div class="tile-top"><h2 id="movement-title">Movement, without the noise.</h2><span class="small-tag">4 sessions</span></div><ul>${[
      ["Mon", "Strength training", "45 min"],
      ["Wed", "A long walk", "40 min"],
      ["Fri", "Strength training", "45 min"],
      ["Sun", "Easy time outside", "60 min"],
    ]
      .map(
        ([day, name, duration]) =>
          `<li><span class="movement-day">${day}</span><h3>${name}</h3><span class="movement-duration">${duration}</span><span class="movement-check" aria-label="Logged">✓</span></li>`,
      )
      .join("")}</ul></section></div>`;

  document.getElementById("screens").innerHTML = [home, financial, location, time, health]
    .map(
      (markup, i) =>
        `<section class="screen" id="screen-${freedoms[i]}" aria-labelledby="title-${freedoms[i]}" ${i ? "hidden" : ""}>${markup}</section>`,
    )
    .join("");

  function showScreen(moveFocus = false) {
    const candidate = window.location.hash.slice(1);
    const current = freedoms.includes(candidate) ? candidate : "overview";
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.hidden = screen.id !== `screen-${current}`;
    });
    document.querySelectorAll(".blade").forEach((blade) => {
      if (blade.dataset.view === current) blade.setAttribute("aria-current", "page");
      else blade.removeAttribute("aria-current");
    });
    document.body.dataset.view = current;
    document.title = `Daybreak / ${current === "overview" ? "Home" : current} / freedom-four`;
    if (moveFocus) {
      const focusTarget = focusBladeAfterNavigation
        ? document.querySelector(`.blade[data-view="${current}"]`)
        : document.getElementById(`title-${current}`);
      focusTarget.focus({ preventScroll: true });
      focusBladeAfterNavigation = false;
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  window.addEventListener("hashchange", () => showScreen(true));
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("workspace").focus();
  });
  document.querySelector(".blades").addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
      ? 1
      : ["ArrowLeft", "ArrowUp"].includes(event.key)
        ? -1
        : 0;
    if (!direction) return;
    event.preventDefault();
    const active = freedoms.indexOf(document.body.dataset.view);
    const next = freedoms[(active + direction + freedoms.length) % freedoms.length];
    focusBladeAfterNavigation = true;
    window.location.hash = next;
  });

  const glassButton = document.getElementById("glass-toggle");
  function setSolidGlass(solid) {
    document.body.classList.toggle("solid-glass", solid);
    glassButton.setAttribute("aria-pressed", String(solid));
    glassButton.lastElementChild.textContent = solid ? "Restore glass" : "Reduce glass";
  }
  glassButton.addEventListener("click", () =>
    setSolidGlass(!document.body.classList.contains("solid-glass")),
  );
  setSolidGlass(window.matchMedia("(prefers-reduced-transparency: reduce)").matches);

  const dialog = document.getElementById("note-dialog");
  const toast = document.getElementById("toast");
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const noteButton = event.target.closest("[data-note]");
    if (noteButton) {
      noteOpener = noteButton;
      dialog.showModal();
    }
    const rangeButton = event.target.closest("[data-range]");
    if (rangeButton) {
      const recent = rangeButton.dataset.range === "recent";
      document.getElementById("finance-graph").innerHTML = chart("finance-worth", recent);
      document
        .querySelectorAll("[data-range]")
        .forEach((button) => button.setAttribute("aria-pressed", String(button === rangeButton)));
      document.getElementById("chart-foot").textContent =
        `${recent ? "July" : "March"}–October · illustrative net worth history`;
    }
  });
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    document.getElementById("note-form").reset();
    if (noteOpener?.isConnected) noteOpener.focus({ preventScroll: true });
  });
  document.getElementById("note-form").addEventListener("submit", (event) => {
    event.preventDefault();
    dialog.close();
    toast.hidden = false;
  });
  toast.querySelector("button").addEventListener("click", () => {
    toast.hidden = true;
    if (noteOpener?.isConnected) noteOpener.focus({ preventScroll: true });
  });
  showScreen();
})();
