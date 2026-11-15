(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var listEl = $('#list'), statusEl = $('#status'), form = $('#apply-form');
  var formStatus = $('#form-status'), submitBtn = $('#submit-btn');
  var selected = null, debounce;

  // All dynamic text is set via textContent (never innerHTML) -> prevents XSS.
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // fetch with timeout + automatic retry (GET only) with backoff
  async function api(path, opts, retries) {
    opts = opts || {}; retries = retries || 0;
    for (var attempt = 0; ; attempt++) {
      var ctrl = new AbortController(); var t = setTimeout(function () { ctrl.abort(); }, 8000);
      try {
        var res = await fetch(path, Object.assign({}, opts, { signal: ctrl.signal }));
        clearTimeout(t);
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) { var err = new Error(data.error || 'Request failed'); err.status = res.status; err.fields = data.fields; err.retryAfter = data.retryAfter; throw err; }
        return data;
      } catch (e) {
        clearTimeout(t);
        var retryable = !e.status || e.status >= 500;
        if (attempt < retries && retryable) { await new Promise(function (r) { setTimeout(r, 500 * Math.pow(2, attempt)); }); continue; }
        if (e.name === 'AbortError') e = Object.assign(new Error('Request timed out'), { status: 0 });
        throw e;
      }
    }
  }

  function showLoading() {
    listEl.replaceChildren(); statusEl.replaceChildren();
    for (var i = 0; i < 3; i++) listEl.appendChild(el('li', 'skeleton'));
    statusEl.textContent = 'Loading internships…';
  }
  function showError(e) {
    listEl.replaceChildren();
    var box = el('div', 'state error');
    var msg = e.status === 429 ? 'Too many requests. Please wait a moment.' : 'Could not load internships. ' + (e.message || '');
    box.appendChild(el('p', null, msg));
    var b = el('button', null, 'Retry'); b.type = 'button'; b.addEventListener('click', load);
    box.appendChild(b); statusEl.replaceChildren(box);
  }

  async function load() {
    showLoading();
    var p = new URLSearchParams();
    if ($('#q').value.trim()) p.set('q', $('#q').value.trim());
    if ($('#category').value) p.set('category', $('#category').value);
    try {
      var data = await api('/api/internships?' + p.toString(), {}, 2);
      listEl.replaceChildren(); statusEl.replaceChildren();
      if (!data.items.length) { statusEl.appendChild(el('div', 'state', 'No internships match your search.')); return; }
      statusEl.textContent = data.total + ' internship(s) found';
      data.items.forEach(function (it) {
        var li = el('li', 'card');
        li.appendChild(el('h3', null, it.title));
        li.appendChild(el('p', 'meta', it.company + ' · ' + it.location + ' · ' + it.type + ' · ₹' + it.stipend + '/month'));
        li.appendChild(el('p', null, it.description));
        var b = el('button', null, 'Apply'); b.type = 'button';
        b.addEventListener('click', function () { openForm(it); });
        li.appendChild(b); listEl.appendChild(li);
      });
    } catch (e) { showError(e); }
  }

  function openForm(it) {
    selected = it; form.reset(); clearErrors(); formStatus.textContent = '';
    $('#apply-title').textContent = it.title + ' @ ' + it.company;
    $('#apply-section').hidden = false; $('#apply-section').scrollIntoView({ behavior: 'smooth' });
    form.name.focus();
  }
  function clearErrors() { document.querySelectorAll('.err').forEach(function (n) { n.textContent = ''; }); }
  function showFieldErrors(errs) {
    clearErrors();
    Object.keys(errs).forEach(function (k) { var n = document.querySelector('.err[data-for="' + k + '"]'); if (n) n.textContent = errs[k]; });
  }
  function values() {
    return { name: form.name.value, email: form.email.value, phone: form.phone.value, resume_url: form.resume_url.value,
             cover_letter: form.cover_letter.value, consent: form.consent.checked };
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var v = values(), errs = window.AppValidate.validate(v);
    if (Object.keys(errs).length) { showFieldErrors(errs); formStatus.className = 'msg-error'; formStatus.textContent = 'Please fix the highlighted fields.'; return; }
    clearErrors(); submitBtn.disabled = true; formStatus.className = ''; formStatus.textContent = 'Submitting…';
    var payload = { internship_id: selected.id, name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), resume_url: v.resume_url.trim(), cover_letter: v.cover_letter.trim(), consent: true };
    try {
      await api('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      formStatus.className = 'msg-ok'; formStatus.textContent = 'Application submitted! Good luck.'; form.reset();
    } catch (e) {
      formStatus.className = 'msg-error';
      if (e.status === 422 && e.fields) { showFieldErrors(e.fields); formStatus.textContent = 'Server rejected some fields.'; }
      else if (e.status === 409) formStatus.textContent = 'You have already applied to this internship.';
      else if (e.status === 429) formStatus.textContent = 'Too many attempts. Retry in ' + (e.retryAfter || 60) + 's.';
      else formStatus.textContent = 'Could not submit (' + (e.message || 'network error') + '). Click Submit to retry.';
    } finally { submitBtn.disabled = false; }
  });

  $('#cancel-btn').addEventListener('click', function () { $('#apply-section').hidden = true; });
  $('#q').addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(load, 300); });
  $('#category').addEventListener('change', load);
  load();
})();
