/* Clínica Dental Robles — demo.
   Todo lo dinámico de la página: estado abierto/cerrado, flujo de cita en
   3 pasos con validación en humano, y el año del footer (automático, siempre). */

(function () {
  "use strict";

  var OPEN_H = 9.5; // 9:30
  var CLOSE_H = 20; // 20:00

  function isWorkday(d) {
    var day = d.getDay();
    return day >= 1 && day <= 5;
  }

  function isOpenNow() {
    var now = new Date();
    var h = now.getHours() + now.getMinutes() / 60;
    return isWorkday(now) && h >= OPEN_H && h < CLOSE_H;
  }

  /* --- Año del footer: nunca más un pie de página congelado en 2019 --- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* --- "Hoy: 9:30–20:00 · Abierto" en la cabecera --- */
  var status = document.getElementById("today-status");
  if (status) {
    var open = isOpenNow();
    var dot = '<span class="today-dot" aria-hidden="true"></span>';
    if (open) {
      status.innerHTML = dot + "Hoy: 9:30–20:00 · <b>Abierto</b>";
    } else if (isWorkday(new Date())) {
      status.classList.add("is-closed");
      status.innerHTML = dot + "Hoy: 9:30–20:00 · Ahora cerrado";
    } else {
      status.classList.add("is-closed");
      status.innerHTML = dot + "Hoy cerrado · Pide cita online";
    }
  }

  var urgentStatus = document.getElementById("urgent-status");
  if (urgentStatus && isOpenNow()) {
    urgentStatus.innerHTML = "Ahora mismo estamos <b>abiertos</b> — de lunes a viernes, 9:30–20:00.";
  }

  /* ================= Cita online: tratamiento → hueco → datos ================= */

  var TREATMENTS = [
    "Primera visita / revisión",
    "Limpieza",
    "Urgencia — me duele",
    "Ortodoncia",
    "Implantes",
    "Blanqueamiento",
    "Niños"
  ];

  var TIMES = ["9:30", "10:30", "12:00", "13:00", "16:30", "17:30", "19:00"];

  var DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function nextWorkdays(count) {
    var days = [];
    var d = new Date();
    while (days.length < count) {
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      if (isWorkday(d)) days.push(new Date(d));
    }
    return days;
  }

  var picked = { treatment: null, day: null, time: null };

  function buildChips(container, items, labelOf, subOf, onPick) {
    if (!container) return;
    items.forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.setAttribute("role", "radio");
      chip.setAttribute("aria-checked", "false");
      chip.innerHTML = labelOf(item) + (subOf ? "<small>" + subOf(item) + "</small>" : "");
      chip.addEventListener("click", function () {
        container.querySelectorAll(".chip").forEach(function (c) {
          c.setAttribute("aria-checked", "false");
        });
        chip.setAttribute("aria-checked", "true");
        onPick(item);
      });
      container.appendChild(chip);
    });
  }

  buildChips(
    document.getElementById("bk-treatments"),
    TREATMENTS,
    function (t) { return t; },
    null,
    function (t) { picked.treatment = t; }
  );

  buildChips(
    document.getElementById("bk-days"),
    nextWorkdays(5),
    function (d) { return DAY_NAMES[d.getDay()]; },
    function (d) { return d.getDate() + " " + MONTHS[d.getMonth()]; },
    function (d) { picked.day = d; }
  );

  buildChips(
    document.getElementById("bk-times"),
    TIMES,
    function (t) { return t; },
    null,
    function (t) { picked.time = t; }
  );

  /* --- SLA honesto según la hora a la que pides la cita --- */
  var sla = document.getElementById("bk-sla");
  if (sla && !isOpenNow()) {
    sla.textContent = "Ahora estamos cerrados: te llamamos mañana a primera hora para confirmar.";
  }

  /* --- Validación inline, con mensajes en humano --- */
  var form = document.getElementById("booking-form");
  var msg = document.getElementById("bk-msg");

  function setErr(input, errEl, text) {
    if (!input || !errEl) return !text;
    errEl.textContent = text || "";
    input.setAttribute("aria-invalid", text ? "true" : "false");
    return !text;
  }

  function validName() {
    var input = document.getElementById("bk-name");
    var value = (input.value || "").trim();
    return setErr(input, document.getElementById("err-name"),
      value.length >= 2 ? "" : "Dinos tu nombre para saber a quién llamamos.");
  }

  function validPhone() {
    var input = document.getElementById("bk-phone");
    var digits = (input.value || "").replace(/[^0-9]/g, "");
    var ok = digits.length === 9 || (digits.length === 11 && digits.indexOf("34") === 0);
    var text = "";
    if (!digits.length) text = "Necesitamos un teléfono para confirmar la cita.";
    else if (!ok) text = "Revisa el teléfono — necesita 9 dígitos.";
    return setErr(input, document.getElementById("err-phone"), text);
  }

  if (form) {
    document.getElementById("bk-name").addEventListener("blur", validName);
    document.getElementById("bk-phone").addEventListener("blur", validPhone);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = "";

      if (!picked.treatment) { msg.textContent = "Elige qué necesitas en el paso 1."; return; }
      if (!picked.day || !picked.time) { msg.textContent = "Elige día y hora en el paso 2."; return; }

      var okName = validName();
      var okPhone = validPhone();
      if (!okName || !okPhone) { msg.textContent = "Revisa tus datos en el paso 3."; return; }

      var consent = document.getElementById("bk-consent");
      if (!consent.checked) {
        msg.textContent = "Marca la casilla de privacidad para que podamos llamarte.";
        return;
      }

      // Demo: aquí la web real envía la solicitud a la agenda de la clínica.
      var btn = document.getElementById("bk-submit");
      btn.disabled = true;
      btn.querySelector(".btn-label").textContent = "Enviando…";

      setTimeout(function () {
        var d = picked.day;
        var when = DAY_NAMES[d.getDay()] + " " + d.getDate() + " de " + MONTHS[d.getMonth()] + " a las " + picked.time;
        var name = document.getElementById("bk-name").value.trim().split(" ")[0];
        document.getElementById("booking-done-detail").textContent =
          name + ", hemos apuntado «" + picked.treatment + "» para el " + when + ". " +
          (isOpenNow() ? "Te llamamos hoy antes de las 20:00 para confirmarla." : "Te llamamos mañana a primera hora para confirmarla.");
        form.hidden = true;
        document.getElementById("booking-done").hidden = false;
        document.getElementById("booking-done").scrollIntoView({ block: "center" });
      }, 700);
    });
  }

  /* --- Aparición suave de tarjetas, respetando prefers-reduced-motion --- */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document
      .querySelectorAll(".treat-card, .person, .review")
      .forEach(function (el) {
        el.classList.add("reveal");
        io.observe(el);
      });
  }
})();
