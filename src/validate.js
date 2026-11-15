'use strict';
// Server-side validation for application payloads. Never trust the client.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PHONE_RE = /^[+]?[0-9 ()-]{7,20}$/;
const ALLOWED = ['internship_id', 'name', 'email', 'phone', 'resume_url', 'cover_letter', 'consent'];

function validateApplication(body) {
  const errors = {};
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: { _form: 'Body must be a JSON object' } };
  }
  for (const k of Object.keys(body)) {
    if (!ALLOWED.includes(k)) errors[k] = 'Unknown field';
  }
  const str = (v) => (typeof v === 'string' ? v.trim() : v);

  const internship_id = body.internship_id;
  if (!Number.isInteger(internship_id) || internship_id < 1) errors.internship_id = 'Valid internship_id required';

  const name = str(body.name);
  if (typeof name !== 'string' || name.length < 2 || name.length > 80) errors.name = 'Name must be 2-80 characters';

  const email = str(body.email);
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Valid email required';

  let phone = str(body.phone);
  if (phone === undefined || phone === '') phone = null;
  else if (typeof phone !== 'string' || !PHONE_RE.test(phone)) errors.phone = 'Invalid phone number';

  let resume_url = str(body.resume_url);
  if (resume_url === undefined || resume_url === '') resume_url = null;
  else {
    try {
      const u = new URL(resume_url);
      if (u.protocol !== 'https:' || resume_url.length > 300) throw new Error();
    } catch { errors.resume_url = 'Resume link must be a valid https URL'; }
  }

  const cover_letter = str(body.cover_letter);
  if (typeof cover_letter !== 'string' || cover_letter.length < 20 || cover_letter.length > 1000)
    errors.cover_letter = 'Cover letter must be 20-1000 characters';

  if (body.consent !== true) errors.consent = 'Consent is required';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { internship_id, name, email: email.toLowerCase(), phone, resume_url, cover_letter } };
}

module.exports = { validateApplication };
