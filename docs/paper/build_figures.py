"""Generates the research-paper figures as SVG, wrapped in HTML for rendering.

Stdlib only (no matplotlib). Charts read real numbers from
data/measurements.json (produced by contracts/scripts/measure-gas.js).
Render to PNG with render_figures.ps1 (headless Edge).

Palette mirrors the reference paper: navy/blue = off-chain process step,
green = on-chain (smart-contract) step, orange = decision/loop, red = denial.
"""
import json, os, html

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
os.makedirs(OUT, exist_ok=True)
M = json.load(open(os.path.join(HERE, "data", "measurements.json")))

NAVY, BLUE, GREEN, ORANGE, RED = "#1F4E79", "#2E75B6", "#17A589", "#E67E22", "#C0392B"
LBLUE, LGREEN, LORANGE, LRED, GRAY = "#D6E4F0", "#D5F5E3", "#FEF5E7", "#FDEDEC", "#7F8C8D"
BG = "#FFFFFF"
FONT = "'Times New Roman', Georgia, serif"


class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.p = w, h, []

    def add(self, s):
        self.p.append(s)

    def rect(self, x, y, w, h, fill, stroke=None, rx=12, sw=2, dash=None):
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{st}{d}/>')

    def text(self, x, y, s, size=18, fill="#fff", weight="normal", anchor="middle", style="normal", rot=None):
        tr = f' transform="rotate({rot} {x} {y})"' if rot else ""
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" '
                 f'text-anchor="{anchor}" font-style="{style}"{tr}>{html.escape(s)}</text>')

    def lines(self, x, y, ls, size=18, fill="#fff", weight="normal", gap=1.35, anchor="middle"):
        for i, l in enumerate(ls):
            self.text(x, y + i * size * gap, l, size, fill, weight, anchor)

    def arrow(self, pts, color=NAVY, dash=None, sw=3, head=True):
        d = "M " + " L ".join(f"{x} {y}" for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ""
        mk = f' marker-end="url(#m{color[1:]})"' if head else ""
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{da}{mk}/>')

    def line(self, x1, y1, x2, y2, color="#999", sw=1, dash=None):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"{da}/>')

    def write(self, name):
        marks = "".join(
            f'<marker id="m{c[1:]}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" '
            f'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{c}"/></marker>'
            for c in (NAVY, ORANGE, RED, GRAY, GREEN, BLUE))
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
               f'viewBox="0 0 {self.w} {self.h}" font-family="{FONT}"><defs>{marks}</defs>'
               f'<rect width="{self.w}" height="{self.h}" fill="{BG}"/>' + "".join(self.p) + "</svg>")
        open(os.path.join(OUT, name + ".svg"), "w", encoding="utf-8").write(svg)
        open(os.path.join(OUT, name + ".html"), "w", encoding="utf-8").write(
            f'<!doctype html><meta charset="utf-8"><body style="margin:0">{svg}</body>')
        print("wrote", name, self.w, self.h)


def pill(s, x, y, w, h, fill, title, sub=None, size=22):
    s.rect(x, y, w, h, fill, rx=h // 2)
    if sub:
        s.text(x + w / 2, y + h / 2 - 6, title, size, weight="bold")
        s.text(x + w / 2, y + h / 2 + 24, sub, size - 2)
    else:
        s.text(x + w / 2, y + h / 2 + 8, title, size, weight="bold")


def step(s, x, y, w, h, fill, title, sub_lines):
    s.rect(x, y, w, h, fill)
    s.text(x + w / 2, y + 36, title, 22, weight="bold")
    s.lines(x + w / 2, y + 66, sub_lines, 19)


def group(s, x, y, w, h, fill, edge, title, tcolor, boxes, boxfill):
    s.rect(x, y, w, h, fill, edge, sw=3)
    s.text(x + w / 2, y + 36, title, 22, tcolor, "bold")
    n = len(boxes)
    bw = (w - 24 - (n - 1) * 16) / n
    for i, lns in enumerate(boxes):
        bx = x + 12 + i * (bw + 16)
        s.rect(bx, y + 58, bw, h - 74, boxfill, rx=8)
        s.lines(bx + bw / 2, y + 58 + (h - 74) / 2 - (len(lns) - 1) * 12 + 5, lns, 17)


# ---------------------------------------------------------------- Fig 1
def fig1():
    s = Svg(1040, 1960)
    cx = 520
    pill(s, 120, 24, 800, 72, NAVY, "Proposed System — Consent-Controlled Record Flow", size=26)
    pill(s, 280, 130, 480, 88, NAVY, "STEP 1", "Patient / Doctor Login (wallet-mapped)")
    s.arrow([(cx, 218), (cx, 266)]); s.text(cx + 14, 248, "JWT Token", 16, GRAY, anchor="start", style="italic")
    step(s, 240, 266, 560, 88, BLUE, "STEP 2 — Patient Uploads Record", ["POST /records/upload (medical file)"])
    s.arrow([(cx, 354), (cx, 402)]); s.text(cx + 14, 384, "Plaintext file", 16, GRAY, anchor="start", style="italic")
    group(s, 200, 402, 640, 150, LBLUE, BLUE, "STEP 3 — Off-chain Protection (Backend)", NAVY,
          [["AES-256-GCM", "encrypt file"], ["SHA-256", "file hash"], ["Pin to IPFS", "(Pinata) → CID"]], BLUE)
    s.arrow([(cx, 552), (cx, 600)]); s.text(cx + 14, 582, "CID + hash only", 16, GRAY, anchor="start", style="italic")
    step(s, 240, 600, 560, 88, GREEN, "STEP 4 — On-chain Registration", ["RecordRegistry.addRecord(cid, hash)"])
    s.arrow([(cx, 688), (cx, 736)]); s.text(cx + 14, 718, "RecordAdded event", 16, GRAY, anchor="start", style="italic")
    step(s, 240, 736, 560, 88, GREEN, "STEP 5 — Patient Grants Consent", ["grantAccess(recordId, doctor) → AccessGranted"])
    s.arrow([(cx, 824), (cx, 872)])
    step(s, 240, 872, 560, 88, BLUE, "STEP 6 — Doctor Requests Record", ["GET /records/:id/view (doctor's JWT)"])
    s.arrow([(cx, 960), (cx, 1008)]); s.text(cx + 14, 990, "Doctor's own wallet", 16, GRAY, anchor="start", style="italic")
    # diamond
    dy = 1008
    s.add(f'<polygon points="{cx},{dy} {cx+230},{dy+80} {cx},{dy+160} {cx-230},{dy+80}" fill="{LORANGE}" stroke="{ORANGE}" stroke-width="3"/>')
    s.lines(cx, dy + 68, ["On-chain check:", "getRecord() authorized?"], 20, ORANGE, "bold")
    # Yes branch
    s.arrow([(cx, dy + 160), (cx, 1216)]); s.text(cx + 14, 1196, "Yes", 18, GRAY, anchor="start", style="italic")
    group(s, 200, 1216, 640, 190, LGREEN, GREEN, "STEP 7 — Retrieve & Verify (Backend)", "#0E6655",
          [["Fetch encrypted", "blob from IPFS"], ["Decrypt", "(AES-256-GCM)"], ["Verify SHA-256", "== on-chain hash"]], GREEN)
    # No branch
    s.arrow([(cx + 230, dy + 80), (900, dy + 80), (900, 1130)], RED)
    s.text(cx + 250, dy + 66, "No", 18, GRAY, anchor="start", style="italic")
    s.rect(780, 1130, 240, 80, LRED, RED, sw=2)
    s.lines(900, 1160, ["403 ACCESS_DENIED", "(revert on-chain)"], 17, RED, "bold")
    # revoke loop
    s.arrow([(200, 1311), (70, 1311), (70, 916), (240, 916)], ORANGE)
    s.text(40, 1100, "Patient revokes (AccessRevoked) → next request denied", 17, ORANGE, rot=-90)
    s.arrow([(cx, 1406), (cx, 1454)])
    pill(s, 220, 1454, 600, 100, NAVY, "Record delivered to authorized doctor", "Audit trail: RecordAdded · AccessGranted · AccessRevoked", size=22)
    # legend
    s.rect(40, 1630, 960, 200, "#F0F3F7", "#A9BCD0", sw=2, rx=14)
    s.text(cx, 1672, "Legend", 20, NAVY, "bold")
    items = [(80, NAVY, "Start / End", "c"), (300, BLUE, "Off-chain step", "r"), (560, GREEN, "On-chain (smart contract)", "r"),
             (860, ORANGE, "Decision", "d")]
    for x, c, lab, k in items:
        if k == "c": s.add(f'<circle cx="{x+16}" cy="1720" r="16" fill="{c}"/>')
        elif k == "r": s.rect(x, 1704, 34, 32, c, rx=5)
        else: s.rect(x, 1704, 34, 32, LORANGE, c, rx=5)
        s.text(x + 46, 1727, lab, 18, "#333", anchor="start")
    s.arrow([(80, 1780), (140, 1780)], RED, head=False, dash="8 6"); s.text(152, 1786, "Denied path", 18, "#333", anchor="start")
    s.arrow([(360, 1780), (420, 1780)], ORANGE, head=False); s.text(432, 1786, "Revocation loop", 18, "#333", anchor="start")
    s.text(cx, 1890, "Fig. 1 — Proposed System Process Flow", 20, "#444", style="italic")
    s.h = 1930
    s.write("fig1_process_flow")


# ---------------------------------------------------------------- Fig 2
def fig2():
    s = Svg(1100, 1120)
    pill(s, 150, 20, 800, 70, NAVY, "Proposed System — Layered Architecture", size=26)
    # Presentation
    s.rect(60, 130, 980, 190, LBLUE, BLUE, sw=3)
    s.text(550, 168, "Presentation Layer — React (Vite) Single-Page App", 22, NAVY, "bold")
    for i, (t, ls) in enumerate([("Patient Dashboard", ["Upload record", "My records", "Grant / revoke access"]),
                                  ("Doctor Dashboard", ["Access check", "View authorized", "records"]),
                                  ("Auth Context", ["JWT session", "Role-based routing"])]):
        x = 80 + i * 318
        s.rect(x, 190, 300, 112, BLUE, rx=8); s.text(x + 150, 218, t, 19, weight="bold"); s.lines(x + 150, 246, ls, 16, gap=1.3)
    s.arrow([(550, 320), (550, 400)], NAVY); s.arrow([(550, 400), (550, 320)], NAVY)
    s.text(570, 366, "REST / JSON  +  JWT", 17, GRAY, anchor="start", style="italic")
    # Application
    s.rect(60, 400, 980, 250, LBLUE, BLUE, sw=3)
    s.text(550, 438, "Application Layer — Node.js / Express API (port 4000)", 22, NAVY, "bold")
    mods = [("auth.js", "JWT issue / verify"), ("routes.js", "7 REST endpoints"), ("crypto.js", "AES-256-GCM · SHA-256"),
            ("ipfs.js", "Pinata upload / fetch"), ("chain.js", "ethers.js · wallets"), ("store.js", "labels (off-chain)")]
    for i, (a, b) in enumerate(mods):
        x = 80 + (i % 3) * 318; y = 462 + (i // 3) * 92
        s.rect(x, y, 300, 78, BLUE, rx=8); s.text(x + 150, y + 33, a, 19, weight="bold"); s.text(x + 150, y + 59, b, 16)
    # down arrows
    s.arrow([(280, 650), (280, 770)], GREEN); s.text(296, 706, "ethers.js · JSON-RPC", 17, GRAY, anchor="start", style="italic")
    s.text(296, 728, "(signed by user's wallet)", 15, GRAY, anchor="start", style="italic")
    s.arrow([(830, 650), (830, 770)], BLUE); s.arrow([(830, 770), (830, 650)], BLUE)
    s.text(846, 706, "HTTPS · encrypted blob", 17, GRAY, anchor="start", style="italic")
    s.text(846, 728, "in / CID out", 15, GRAY, anchor="start", style="italic")
    # Blockchain
    s.rect(60, 770, 560, 270, LGREEN, GREEN, sw=3)
    s.text(340, 808, "Blockchain Layer — Ethereum (Hardhat local net)", 21, "#0E6655", "bold")
    s.rect(80, 830, 250, 190, GREEN, rx=8); s.text(205, 860, "UserRegistry", 19, weight="bold")
    s.lines(205, 888, ["OpenZeppelin AccessControl", "PATIENT_ROLE", "DOCTOR_ROLE", "HOSPITAL_ADMIN_ROLE"], 15, gap=1.4)
    s.rect(350, 830, 250, 190, GREEN, rx=8); s.text(475, 860, "RecordRegistry", 19, weight="bold")
    s.lines(475, 888, ["cid · SHA-256 · owner", "authorizedAccess map", "grant / revoke / check", "Events = audit trail"], 15, gap=1.4)
    s.arrow([(350, 925), (330, 925)], NAVY, head=True)
    # Off-chain
    s.rect(660, 770, 380, 270, LORANGE, ORANGE, sw=3)
    s.text(850, 808, "Off-chain Storage", 21, "#A04000", "bold")
    s.rect(680, 830, 340, 90, ORANGE, rx=8); s.text(850, 862, "IPFS via Pinata", 19, weight="bold"); s.lines(850, 888, ["AES-encrypted records only"], 16)
    s.rect(680, 932, 340, 88, "#F5CBA7", rx=8); s.text(850, 964, "backend/data/store.json", 18, "#5D4037", "bold"); s.lines(850, 990, ["labels, display names (no PHI)"], 15, "#5D4037")
    # trust boundary note
    s.rect(60, 1062, 980, 36, "#F0F3F7", "#A9BCD0", sw=1, rx=8)
    s.text(550, 1087, "Trust boundary: the contract — not the backend — decides who may read a record; the chain stores only CID + hash + consent state.", 17, NAVY, style="italic")
    s.text(550, 1124, "Fig. 2 — Layered System Architecture", 20, "#444", style="italic")
    s.h = 1140
    s.write("fig2_architecture")


# ---------------------------------------------------------------- Fig 3
def fig3():
    P = [("Patient", 90), ("Backend API", 330), ("IPFS (Pinata)", 570), ("RecordRegistry", 810), ("Doctor", 1020)]
    X = dict(P)
    s = Svg(1120, 1290)
    top, bot = 110, 1180
    for n, x in P:
        s.rect(x - 80, 20, 160, 50, NAVY, rx=10); s.text(x, 52, n, 19, weight="bold")
        s.line(x, 70, x, bot, "#9AA", 2, "6 5")
    y = top
    phases = []

    def band(title, color, y0, y1):
        s.rect(10, y0 - 22, 1100, y1 - y0 + 12, color, rx=6)
        s.text(24, y0 - 4, title, 15, "#555", "bold", "start")

    def msg(a, b, label, y, color=NAVY, dash=None, ret=False):
        x1, x2 = X[a], X[b]
        s.arrow([(x1, y), (x2, y)], color, dash)
        mid = (x1 + x2) / 2
        s.text(mid, y - 7, label, 15, color if color != NAVY else "#222", anchor="middle")

    def selfmsg(a, label, y):
        x = X[a]
        s.arrow([(x, y), (x + 55, y), (x + 55, y + 22), (x, y + 22)], ORANGE)
        s.text(x + 65, y + 16, label, 15, "#A04000", anchor="start")

    rows = []
    y = 122
    # Phase A
    a0 = y; y += 24
    msg("Patient", "Backend API", "POST /records/upload (file)", y + 12)
    selfmsg("Backend API", "AES-256-GCM encrypt · SHA-256 hash", y + 40)
    msg("Backend API", "IPFS (Pinata)", "pin encrypted blob", y + 90)
    msg("IPFS (Pinata)", "Backend API", "CID", y + 126, dash="6 4")
    msg("Backend API", "RecordRegistry", "addRecord(cid, hash)", y + 162, GREEN)
    msg("RecordRegistry", "Backend API", "RecordAdded(id)", y + 198, GREEN, "6 4")
    msg("Backend API", "Patient", "recordId", y + 234, dash="6 4")
    band("A  Upload & registration", "#EAF2FA33", a0, y + 250)
    y += 290
    b0 = y; y += 24
    msg("Patient", "Backend API", "POST /records/:id/grant", y + 12)
    msg("Backend API", "RecordRegistry", "grantAccess(id, doctor)", y + 48, GREEN)
    msg("RecordRegistry", "Backend API", "AccessGranted", y + 84, GREEN, "6 4")
    band("B  Patient grants consent", "#EAF7F033", b0, y + 100)
    y += 140
    c0 = y; y += 24
    msg("Doctor", "Backend API", "GET /records/:id/view", y + 12)
    msg("Backend API", "RecordRegistry", "getRecord(id) as doctor", y + 48, GREEN)
    msg("RecordRegistry", "Backend API", "cid, hash (authorized)", y + 84, GREEN, "6 4")
    msg("Backend API", "IPFS (Pinata)", "fetch CID", y + 120)
    msg("IPFS (Pinata)", "Backend API", "ciphertext", y + 156, dash="6 4")
    selfmsg("Backend API", "decrypt · verify SHA-256", y + 184)
    msg("Backend API", "Doctor", "plaintext record", y + 232, dash="6 4")
    band("C  Authorized retrieval", "#FEF5E733", c0, y + 248)
    y += 288
    d0 = y; y += 24
    msg("Patient", "Backend API", "POST /records/:id/revoke", y + 12)
    msg("Backend API", "RecordRegistry", "revokeAccess(id, doctor)", y + 48, GREEN)
    msg("RecordRegistry", "Backend API", "AccessRevoked", y + 84, GREEN, "6 4")
    msg("Doctor", "Backend API", "GET /records/:id/view", y + 126)
    msg("Backend API", "RecordRegistry", "getRecord(id) as doctor", y + 162, GREEN)
    msg("RecordRegistry", "Backend API", "revert: not authorized", y + 198, RED, "6 4")
    msg("Backend API", "Doctor", "403 ACCESS_DENIED", y + 234, RED, "6 4")
    band("D  Revocation & denial", "#FDEDEC55", d0, y + 250)
    s.text(560, y + 300, "Fig. 3 — Sequence Diagram of the Upload → Grant → View → Revoke → Deny Flow", 20, "#444", style="italic")
    s.h = y + 330
    s.write("fig3_sequence")


# ---------------------------------------------------------------- Fig 4
def fig4():
    s = Svg(1100, 820)
    pill(s, 150, 20, 800, 64, NAVY, "Smart-Contract Structure", size=26)
    # UserRegistry
    s.rect(40, 130, 470, 400, "#fff", GREEN, sw=3)
    s.rect(40, 130, 470, 56, GREEN, rx=12); s.text(275, 166, "UserRegistry  «AccessControl»", 21, weight="bold")
    s.text(60, 216, "Roles (bytes32 constants)", 17, GREEN, "bold", "start")
    s.lines(60, 242, ["PATIENT_ROLE", "DOCTOR_ROLE", "HOSPITAL_ADMIN_ROLE"], 17, "#333", anchor="start", gap=1.4)
    s.line(40, 330, 510, 330, GREEN, 2)
    s.text(60, 358, "Functions", 17, GREEN, "bold", "start")
    s.lines(60, 384, ["registerAsPatient()          — anyone", "registerDoctor(addr)         — admin only",
                      "registerHospitalAdmin(addr)  — default admin", "isPatient / isDoctor / isHospitalAdmin"], 16, "#333", anchor="start", gap=1.45)
    s.text(60, 515, "Events: PatientRegistered · DoctorRegistered", 15, GRAY, anchor="start", style="italic")
    # RecordRegistry
    s.rect(590, 130, 470, 625, "#fff", GREEN, sw=3)
    s.rect(590, 130, 470, 56, GREEN, rx=12); s.text(825, 166, "RecordRegistry", 21, weight="bold")
    s.text(610, 216, "struct Record", 17, GREEN, "bold", "start")
    s.lines(610, 242, ["address owner", "string cid          // IPFS CID", "bytes32 fileHash    // SHA-256", "uint256 timestamp", "bool exists"], 16, "#333", anchor="start", gap=1.4)
    s.line(590, 350, 1060, 350, GREEN, 2)
    s.text(610, 378, "State", 17, GREEN, "bold", "start")
    s.lines(610, 404, ["mapping(id ⇒ Record) records", "mapping(id ⇒ mapping(addr ⇒ bool))", "     authorizedAccess", "mapping(addr ⇒ uint[]) recordsByOwner"], 15, "#333", anchor="start", gap=1.4)
    s.line(590, 480, 1060, 480, GREEN, 2)
    s.text(610, 508, "Functions", 17, GREEN, "bold", "start")
    s.lines(610, 534, ["addRecord(cid, hash)        — patient", "grantAccess(id, doctor)    — owner", "revokeAccess(id, doctor)   — owner",
                       "checkAccess(addr, id)      — view", "getRecord(id)                    — owner/granted", "getRecordsByOwner(addr)  — view"], 15, "#333", anchor="start", gap=1.45)
    s.line(590, 664, 1060, 664, GREEN, 2)
    s.text(610, 692, "Events (audit trail)", 17, GREEN, "bold", "start")
    s.lines(610, 716, ["RecordAdded · AccessGranted · AccessRevoked"], 15, "#333", anchor="start")
    # relation
    s.arrow([(590, 300), (510, 300)], NAVY)
    s.text(550, 286, "isPatient()", 15, "#222"); s.text(550, 322, "isDoctor()", 15, "#222")
    # roles table
    s.rect(40, 560, 470, 170, LBLUE, BLUE, sw=2, rx=10)
    s.text(275, 592, "Custom errors (gas-cheap reverts)", 17, NAVY, "bold")
    s.lines(275, 620, ["NotAPatient(account)", "NotADoctor(account)", "RecordDoesNotExist(id)", "NotRecordOwner(id, caller)"], 16, "#222", gap=1.4)
    s.text(550, 776, "Fig. 4 — Smart-Contract Structure and Dependencies", 20, "#444", style="italic")
    s.h = 800
    s.write("fig4_contracts")


# ---------------------------------------------------------------- Fig 5
def fig5():
    s = Svg(1100, 560)
    pill(s, 150, 20, 800, 64, NAVY, "Consent State Machine for One (record, doctor) Pair", size=24)
    def state(x, y, w, label, sub, fill, edge):
        s.rect(x, y, w, 110, fill, edge, sw=3, rx=55)
        s.text(x + w / 2, y + 50, label, 22, edge, "bold"); s.text(x + w / 2, y + 80, sub, 17, "#333")
    state(60, 200, 240, "No Access", "checkAccess = false", LBLUE, BLUE)
    state(430, 200, 240, "Granted", "checkAccess = true", LGREEN, GREEN)
    state(800, 200, 240, "Revoked", "checkAccess = false", LRED, RED)
    s.arrow([(300, 235), (430, 235)], GREEN); s.text(365, 220, "grantAccess()", 15, "#222")
    s.text(365, 262, "emit AccessGranted", 13, GRAY, style="italic")
    s.arrow([(670, 235), (800, 235)], RED); s.text(735, 220, "revokeAccess()", 15, "#222")
    s.text(735, 262, "emit AccessRevoked", 13, GRAY, style="italic")
    s.arrow([(800, 285), (670, 285)], GREEN); s.text(735, 308, "grantAccess() (re-grant)", 14, "#222")
    # initial
    s.add(f'<circle cx="40" cy="255" r="9" fill="{NAVY}"/>'); s.arrow([(49, 255), (60, 255)], NAVY)
    # Owner box
    s.rect(60, 400, 980, 90, LORANGE, ORANGE, sw=2, rx=12)
    s.lines(550, 432, ["Record owner (patient) always passes checkAccess — no grant needed.",
                       "Re-granting after a revoke is allowed; every transition is an immutable on-chain event."], 18, "#A04000", gap=1.5)
    s.text(550, 365, "Revocation is immediate: no grace period, no cached permission — the next getRecord() by the doctor reverts.", 18, NAVY, style="italic")
    s.text(550, 540, "Fig. 5 — Consent State Machine", 20, "#444", style="italic")
    s.h = 560
    s.write("fig5_consent_states")


# ---------------------------------------------------------------- Charts
def chart_frame(s, x0, y0, w, h, ymax, ystep, ylabel, fmt=lambda v: f"{int(v):,}"):
    s.line(x0, y0, x0, y0 + h, "#333", 2); s.line(x0, y0 + h, x0 + w, y0 + h, "#333", 2)
    v = 0
    while v <= ymax + 1e-9:
        y = y0 + h - v / ymax * h
        s.line(x0, y, x0 + w, y, "#E0E0E0", 1)
        s.text(x0 - 10, y + 5, fmt(v), 15, "#333", anchor="end")
        v += ystep
    s.text(x0 - 80, y0 + h / 2, ylabel, 17, "#333", rot=-90)


def fig6():
    t = M["tx"]
    data = [("addRecord", t["addRecord"], BLUE), ("grantAccess", t["grantAccess_first"], GREEN),
            ("registerDoctor", t["registerDoctor"], GREEN), ("registerAsPatient", t["registerAsPatient"], GREEN),
            ("revokeAccess", t["revokeAccess"], RED)]
    s = Svg(1000, 560)
    x0, y0, w, h = 130, 60, 820, 380
    chart_frame(s, x0, y0, w, h, 250000, 50000, "Gas used")
    bw = w / len(data)
    for i, (n, v, c) in enumerate(data):
        bh = v / 250000 * h; bx = x0 + i * bw + bw * 0.18
        s.rect(bx, y0 + h - bh, bw * 0.64, bh, c, rx=4)
        s.text(bx + bw * 0.32, y0 + h - bh - 10, f"{v:,}", 17, "#222", "bold")
        s.text(bx + bw * 0.32, y0 + h + 28, n, 17, "#222")
    s.text(500, 30, "Gas cost per smart-contract transaction", 22, NAVY, "bold")
    s.text(500, 500, "Measured on Hardhat (solc 0.8.24, optimizer 200 runs); first call per function shown.", 15, GRAY, style="italic")
    s.text(500, 535, "Fig. 6 — Gas Consumption per Contract Operation", 20, "#444", style="italic")
    s.write("fig6_gas_cost")


def fig7():
    s = Svg(1000, 560)
    x0, y0, w, h = 130, 60, 820, 380
    chart_frame(s, x0, y0, w, h, 300000, 50000, "Gas used")
    sc = M["scaling"]; rg = M["recordGrowth"]
    # grant series: x = authorized doctors 2..10
    def plot(series, xs, color, label, ly):
        xmin, xmax = min(xs), max(xs)
        pts = [(x0 + 40 + (x - xmin) / (xmax - xmin) * (w - 80), y0 + h - v / 300000 * h) for x, v in zip(xs, series)]
        s.arrow(pts, color, head=False, sw=4)
        for px, py in pts: s.add(f'<circle cx="{px}" cy="{py}" r="6" fill="{color}"/>')
        s.rect(x0 + 40, ly, 22, 22, color, rx=3); s.text(x0 + 72, ly + 18, label, 17, "#222", anchor="start")
        return xmin, xmax
    plot([r["addRecordGas"] for r in rg], [r["recordsOwned"] for r in rg], BLUE, "addRecord — x: records already owned by patient (2–20)", 70)
    plot([r["grantGas"] for r in sc], [r["authorizedDoctors"] for r in sc], GREEN, "grantAccess — x: doctors already authorized on the record (2–10)", 100)
    s.text(x0 + w / 2, y0 + h + 36, "Number of items already stored (x-axis normalised per series)", 17, "#333")
    s.text(500, 30, "Per-operation gas stays constant as state grows", 22, NAVY, "bold")
    s.text(500, 500, "Both operations are O(1): mapping writes, no loops over existing doctors or records.", 15, GRAY, style="italic")
    s.text(500, 535, "Fig. 7 — Gas Scalability of addRecord and grantAccess", 20, "#444", style="italic")
    s.write("fig7_scaling")


def fig8():
    L = M["readLatencyMs"]
    data = [("checkAccess", L["checkAccess"], GREEN), ("getRecord\n(authorized)", L["getRecord_authorized"], GREEN),
            ("getRecord\n(denied)", L["getRecord_denied"], RED), ("getRecordsByOwner", L["getRecordsByOwner"], BLUE)]
    s = Svg(1000, 560)
    x0, y0, w, h = 130, 60, 820, 380
    ymax = 1.0
    chart_frame(s, x0, y0, w, h, ymax, 0.2, "Median latency (ms)", lambda v: f"{v:.1f}")
    bw = w / len(data)
    for i, (n, v, c) in enumerate(data):
        bh = v / ymax * h; bx = x0 + i * bw + bw * 0.2
        s.rect(bx, y0 + h - bh, bw * 0.6, bh, c, rx=4)
        s.text(bx + bw * 0.3, y0 + h - bh - 10, f"{v:.3f}", 17, "#222", "bold")
        for j, part in enumerate(n.split("\n")): s.text(bx + bw * 0.3, y0 + h + 28 + j * 20, part, 17, "#222")
    s.text(500, 30, "On-chain read latency (consent check path)", 22, NAVY, "bold")
    s.text(500, 500, "Median of 200 view calls on the in-process Hardhat network; excludes network RTT and IPFS fetch.", 15, GRAY, style="italic")
    s.text(500, 535, "Fig. 8 — Read-path Latency of Contract Calls", 20, "#444", style="italic")
    s.write("fig8_latency")


if __name__ == "__main__":
    for f in (fig1, fig2, fig3, fig4, fig5, fig6, fig7, fig8):
        f()
