# Jules Coding & Integration Guidelines (SVEO)

Welcome! This file provides instructions, API configurations, and rules for developing, testing, and securing the SVEO repository.

## 🛠️ MCP & Third-Party Integrations

You have access to the following backend services. Use them to verify data, deploy, or maintain UI consistency:

### 1. SQLite (Database & Backend)
- **Database File:** Check `database.sqlite` for the current table schemas.
- **Client Initialization:** The app uses Node.js `sqlite3` or `better-sqlite3` to connect.
- **Rules:**
  - Always validate database queries to prevent SQL injections.
  - Implement mock database models if you are testing features in a client-only environment.

### 2. Stitch (Design System & UI/UX)
- **Design Principles:** Use Tailwind CSS (v4), Glassmorphism styling, and clean dark-theme layout.
- **Theme:** Sleek dark-mode / high-fidelity aesthetics.
- **Animations:** Use vanilla CSS transitions or lightweight JS animations for micro-animations (e.g. hover states, modal slide-outs).

### 3. Render (Staging & Deployment)
- **Service Name:** `sveo`
- **Service ID:** `srv-d9167rok1i2s7387u66g`
- **Auto-Deploy:** Enabled on commits to the `main` branch.
- **Manual Trigger:** If you need to trigger a deployment test, send a POST request:
  ```javascript
  fetch('https://api.render.com/v1/services/srv-d9167rok1i2s7387u66g/deploys', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer rnd_qj1VR0lFj97iAV8NaGVSUrOzH6D6',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  ```

## 🛡️ Security & Zero-Defects Standard

1. **Security Vulnerability Hardening:**
   - Never commit hardcoded secret keys or API tokens.
   - Always sanitize inputs against XSS and injection vulnerabilities.
   - If an error is caught in a try/catch block, log a sanitized message; never expose raw error stacks to the client.
2. **Build and Verification:**
   - Always run `npm run build` or `npm test` before submitting a Pull Request.
   - Fix all ESLint warnings and JavaScript compilation errors.
