# Admin guide
1. Create the admin: `python -m scripts.create_admin --email you@example.com` (password is prompted; never stored in code). Only works while no admin exists (`--force` adds another).
2. Sign in at `/admin`. Forgot the password? On the server run `python -m scripts.reset_admin_password --email you@example.com` (owner-only; there is no email reset flow by design).
3. **Projects:** New project → fill what you actually have (empty problem/solution sections are simply hidden). Add only **verified** results. Use *Publish/Unpublish*; drafts are invisible to visitors and the chatbot. Reorder with ↑/↓.
4. **Media:** upload the profile image, project thumbnails and CV (PDF), then pick them in the forms. Files in use can't be deleted.
5. **Website content:** hero, about, services, contact, social links, section visibility, SEO. **Design & animation:** theme default, accent colour, animation on/off + intensity, 3D scene, tilt cards, typing effect.
6. **Chatbot:** enable/disable, welcome text, suggested questions, voice languages, daily limit. It only knows what is published.
7. **Messages:** read, archive, delete, retry email. **Audit history** lists admin actions.
