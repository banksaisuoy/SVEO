# Jules Coding & Integration Guidelines — SVEO

> **สำคัญ**: ไฟล์นี้ถูก generate โดย orchestrator v2.1 อัตโนมัติ — อย่าแก้ไข manual
> ห้ามใส่ API keys, tokens, หรือ secrets ใด ๆ ในไฟล์นี้

## 🤖 MCP Servers (ใช้ผ่าน orchestrator เท่านั้น)

ระบบ orchestrator เชื่อม MCP servers เหล่านี้ให้แล้ว — Jules session จะได้ context จาก MCP โดยอัตโนมัติ:

### 1. Jules MCP
- **วัตถุประสงค์**: query/create Jules sessions
- **Auth**: `JULES_API_KEY` env var (orchestrator ใช้เท่านั้น — ห้ามใส่ใน code)
- **เมื่อใช้**: orchestrator เรียกก่อน/หลังสร้าง session

### 2. Render MCP
- **วัตถุประสงค์**: trigger deploys, check service status, tail logs
- **Auth**: `RENDER_API_KEY` env var (orchestrator ใช้เท่านั้น)
- **เมื่อใช้**: orchestrator เรียกหลัง Jules session COMPLETED → trigger deploy
- **Service ของ repo นี้**: ดูได้ที่ `mcp_bridge.py render-status`

### 3. Supabase MCP
- **วัตถุประสงค์**: query sessions table, vulnerabilities, daily metrics
- **Auth**: `SUPABASE_SERVICE_KEY` env var (orchestrator ใช้เท่านั้น)
- **เมื่อใช้**: orchestrator log ทุก session ลง Supabase

### 4. GitHub MCP
- **วัตถุประสงค์**: list branches, create PRs, manage cleanup
- **Auth**: `GITHUB_TOKEN` env var (orchestrator ใช้เท่านั้น)
- **เมื่อใช้**: orchestrator ดู existing jules branches ก่อนสร้าง session

### 5. Stitch MCP (optional)
- **วัตถุประสงค์**: generate UI designs from text
- **Auth**: `STITCH_API_KEY` env var
- **เมื่อใช้**: เมื่อ Jules ต้องการ design reference สำหรับ feature ใหม่

---

## 📋 Repo Profile: production-app

Production apps (SVEO, omniflow, Magsevo) — เน้นเสถียรภาพ ปลอดภัย

### Rotation (สัดส่วนประเภทงานต่อวัน)
| Type | % | Max/Day |
|---|---|---|
| Feature | 20% | 1 |
| Bugfix | 40% | 2 |
| Security | 30% | 1 |
| Test | 5% | 1 |
| Polish | 5% | 1 |

### Cooldown
- แต่ละ session ห่างกันอย่างน้อย **6 ชั่วโมง**
- สูงสุด **6 sessions/วัน** สำหรับ repo นี้

---

## 🔒 Security Rules (บังคับ)

### ห้ามทำเด็ดขาด:
- ❌ ใส่ API keys, tokens, secrets ใน source code
- ❌ ใส่ `Authorization: Bearer xxx` ใน code — ใช้ `process.env.XXX` เสมอ
- ❌ commit `.env` ไฟล์
- ❌ ใส่ database URLs พร้อม credentials ใน config

### ต้องทำ:
- ✅ ใช้ `process.env.VAR_NAME` สำหรับทุก secret
- ✅ เพิ่ม env var ใน `.env.example` (เฉพาะชื่อ ไม่มีค่า)
- ✅ validate inputs ก่อนใช้
- ✅ sanitize user input ก่อน display (ป้องกัน XSS)
- ✅ use parameterized queries (ป้องกัน SQL injection)

---

## 🛠️ Coding Standards

### ฟีเจอร์ใหม่ (feature session)
- 100-500 lines changed
- ใช้ libraries ที่มีอยู่แล้วใน `package.json`
- ไม่เพิ่ม dependencies ใหม่ (ยกเว้นจำเป็นจริง ๆ)
- mobile-responsive
- ไม่มี `console.log` ใน production code

### Bug fix (bugfix session)
- smallest possible change (1-50 lines)
- อธิบาย root cause ใน commit message
- เพิ่ม regression test ถ้ามี test infra

### Security fix (security session)
- ระบุ severity (critical/high/medium/low)
- ระบุ category (xss/sqli/auth/secrets/deps/other)
- ระบุ file:line ของ vulnerability
- ใช้ OWASP best practices

### Tests (test session)
- ใช้ framework ที่มีอยู่ (Jest/Vitest/Playwright — เช็ค `package.json`)
- 3-7 tests per session
- deterministic (no flaky)
- cover happy path + edge cases

### Polish (polish session)
- 1-3 files max
- ใช้ existing UI library
- ไม่เพิ่ม dependencies
- ไม่ทำ layout shift

---

## 📦 Render Deploy

Render service สำหรับ repo นี้ (ถ้ามี):
- Service จะถูก trigger อัตโนมัติหลัง Jules session COMPLETED
- ดู deploy status: `python3 mcp_bridge.py render-status`
- ดู logs: https://dashboard.render.com/

หาก deploy fail:
- ดู build logs ใน Render dashboard
- แก้ไข + push fix
- Render auto-redeploy บน push ใหม่

---

## 🔄 Workflow

```
orchestrator.py (ทุก 30 นาที)
    ↓
mcp_bridge.py pre-session
    ↓ (gather context: Render, GitHub, Supabase)
Jules session create
    ↓ (prompt + MCP context)
Jules runs autonomous
    ↓
Jules COMPLETED
    ↓
mcp_bridge.py post-session
    ↓ (trigger Render deploy)
Supabase log update
    ↓
dashboard.html auto-refresh (60s)
```

---

## ❓ คำถามที่พบบ่อย

**Q: Jules จะรู้ได้ไงว่า repo นี้ใช้ profile ไหน?**
A: ดูใน `repo_profiles.json` — orchestrator อ่านไฟล์นี้ก่อนสร้าง session

**Q: ถ้าอยากเปลี่ยน profile?**
A: แก้ `repo_profiles.json` ใน repo controller แล้ว push — orchestrator จะใช้ profile ใหม่ใน batch ถัดไป

**Q: Jules ใช้ MCP ได้เองไหม?**
A: ใน v2.1 — orchestrator เรียก MCP ให้ แล้ว inject context เข้า prompt ของ Jules
   (Jules alpha ยังไม่รองรับ MCP แบบ native ในตัวเอง)

**Q: ถ้า Render deploy fail?**
A: ดูใน dashboard.html — column "Deploy" จะแสดง `build_failed`
   ดู logs ใน Render dashboard แล้วสั่ง bugfix session ผ่าน orchestrator
