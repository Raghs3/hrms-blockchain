---
POST /auth/register  body { name, email, password, role: "patient"|"doctor" }
  patient -> 201 { token, user } (approved immediately)
  doctor  -> 201 { user }, no token (status "pending")
  errors: 400 VALIDATION_ERROR, 409 EMAIL_EXISTS
POST /auth/login  body { email, password }
  200 { token, user }
  errors: 401 INVALID_CREDENTIALS, 403 DOCTOR_PENDING, 403 DOCTOR_REJECTED, 400 VALIDATION_ERROR
GET /auth/me (Bearer)  200 { user }; errors 401 INVALID_TOKEN, 401 TOKEN_EXPIRED
GET /doctors (Bearer, patient or doctor)  200 { doctors: [{ name, walletAddress }] } approved doctors only
POST /auth/demo-login = the OLD name+role login, available ONLY when DEMO_AUTH=true (default false)
user = { id, name, email, role: "patient"|"doctor"|"admin", status: "pending"|"approved"|"rejected", walletAddress }
All errors have shape { error: "<CODE>" }. Logout = the client deletes the token. JWT expiry 8h, secret from env, payload stays compatible with the existing middleware; role comes from the stored account only, never from the request.
Doctor approval: npm run approve-doctor -- <email>. Seed script creates one admin, one approved doctor, one patient. Existing record/consent endpoints unchanged.
---

