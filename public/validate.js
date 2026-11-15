// Client-side validation (UX only). The server re-validates everything.
(function (root) {
  var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
  var PHONE_RE = /^[+]?[0-9 ()-]{7,20}$/;
  function validate(v) {
    var e = {};
    var name = (v.name || '').trim(), email = (v.email || '').trim(), phone = (v.phone || '').trim();
    var resume = (v.resume_url || '').trim(), cover = (v.cover_letter || '').trim();
    if (name.length < 2 || name.length > 80) e.name = 'Name must be 2-80 characters';
    if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email';
    if (phone && !PHONE_RE.test(phone)) e.phone = 'Enter a valid phone number';
    if (resume) { try { if (new URL(resume).protocol !== 'https:') throw 0; } catch (x) { e.resume_url = 'Use a valid https link'; } }
    if (cover.length < 20 || cover.length > 1000) e.cover_letter = 'Cover letter must be 20-1000 characters';
    if (v.consent !== true) e.consent = 'Please accept to continue';
    return e;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validate: validate };
  else root.AppValidate = { validate: validate };
})(typeof window !== 'undefined' ? window : globalThis);
