(() => {
  const views = ["overview", "financial", "location", "time", "health"];
  let opener = null;

  function showView(moveFocus = false) {
    const hash = window.location.hash.slice(1);
    const current = views.includes(hash) ? hash : "overview";
    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = view.id !== current;
    });
    document.querySelectorAll(".main-nav a").forEach((link) => {
      if (link.dataset.view === current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.body.dataset.view = current;
    document.title = `${current.toUpperCase()} / SWISS / FREEDOM-FOUR`;
    if (moveFocus) {
      document.getElementById(`${current}-title`).focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  window.addEventListener("hashchange", () => showView(true));
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("main").focus();
  });

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      opener = button;
      document.getElementById(button.dataset.open).showModal();
    });
  });
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      dialog.querySelector("form").reset();
      if (opener) opener.focus({ preventScroll: true });
    });
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      dialog.close();
      document.getElementById("preview-status").hidden = false;
    });
  });
  document.querySelector("#preview-status button").addEventListener("click", () => {
    document.getElementById("preview-status").hidden = true;
    if (opener) opener.focus({ preventScroll: true });
  });

  const values = [202400, 210100, 207900, 216600, 229800, 232200, 243100, 248600];
  const months = ["MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT"];
  function setRange(range) {
    const start = range === "recent" ? 4 : 0;
    const selected = values.slice(start);
    const names = months.slice(start);
    const points = selected.map(
      (value, index) =>
        `${70 + (index * 525) / (selected.length - 1)},${205 - ((value - 200000) / 50000) * 160}`,
    );
    document.getElementById("worth-line").setAttribute("points", points.join(" "));
    const labels = document.getElementById("worth-labels");
    labels.replaceChildren();
    names.forEach((month, index) => {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(70 + (index * 525) / (selected.length - 1)));
      text.setAttribute("y", "240");
      text.setAttribute("text-anchor", "middle");
      text.textContent = month;
      labels.append(text);
    });
    document
      .querySelectorAll("[data-range]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.range === range)),
      );
    document.getElementById("chart-period").textContent = `${names[0]}–OCT / SAMPLE HISTORY`;
    document.getElementById("worth-chart-description").textContent =
      `Illustrative net worth, ${names[0]} through October: ${selected.map((value) => "$" + value.toLocaleString("en-US")).join(", ")}. Axis ranges from $200,000 to $250,000.`;
  }
  document
    .querySelectorAll("[data-range]")
    .forEach((button) => button.addEventListener("click", () => setRange(button.dataset.range)));
  setRange("all");
  showView();
})();
