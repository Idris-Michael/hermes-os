# Implementation Plan: Refactoring Severus UI Components

This plan details the systematic migration of legacy hardcoded panel styles and interactive surfaces in `App.tsx` to the newly established "No Slop" design system tokens (`.os-card`, `.cc-glass`, and `.cc-press`). 

By standardizing on these utilities, we ensure that deep blurred overlays, 1px inner translucent borders, and physical tactile feedback are consistently applied across all command center panels.

## 1. Context & Design Tokens
The global stylesheet (`index.css`) contains the authorized class definitions:
- **`os-card`**: Deep glass panel with `backdrop-filter: blur(12px)` and translucent `rgba(255,255,255,0.10)` 1px border. Uses `!important` to enforce consistency.
- **`cc-glass`**: Flexible deep blur overlay.
- **`cc-press`**: Physical tactile response scale down `scale(0.98)` bound to the velocity spring-physics curve: `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Accent Glows**: `.cc-glow-emerald`, `.cc-glow-gold`, `.cc-glow-violet`.

> [!IMPORTANT]
> Because `.os-card` uses `!important` for its default borders, any hover border styles specified at the class level must include the Tailwind exclamation prefix (e.g., `hover:!border-blue-500/50`) to override the base token cleanly.

---

## 2. Refactoring Target Areas

### Phase A: The "Selected Index" Grid (Lines 309–467)
Systematically refactor each project card in the Grid from `bg-[#15151A] p-6 border border-white/10 hover-target transition-all hover:border-[accent]/50 group` to `os-card p-6 hover-target transition-all hover:!border-[accent]/50 group`.

- **001 (Vanguard Estates)**: `hover:border-blue-500/50` $\to$ `hover:!border-blue-500/50`
- **002 (Nano-Stream AI)**: `hover:border-blue-500/50` $\to$ `hover:!border-blue-500/50`
- **003 (Google Analytics UGC Intake)**: `hover:border-emerald-500/50` $\to$ `hover:!border-emerald-500/50`
- **004 (Obsidian Agent Vault)**: `hover:border-purple-500/50` $\to$ `hover:!border-purple-500/50`
- **005 (Automated UGC Sub-Agents)**: `hover:border-rose-500/50` $\to$ `hover:!border-rose-500/50`
- **006 (Autonomous GA4 Audits)**: `hover:border-orange-500/50` $\to$ `hover:!border-orange-500/50`
- **007 (London Coffee Shop Discovery)**: `hover:border-amber-500/50` $\to$ `hover:!border-amber-500/50`
- **008 (AI Brand Asset Swarms)**: `hover:border-pink-500/50` $\to$ `hover:!border-pink-500/50`
- **009 (Agency Portfolio Slideshow)**: `hover:border-teal-500/50` $\to$ `hover:!border-teal-500/50`
- **010 (Severus Command Center)**: `hover:border-violet-500/50` $\to$ `hover:!border-violet-500/50`

---

### Phase B: "Design System Architect" & Accompanying Subsections (Lines 507–1380)
Ensure all larger portfolio showcase blocks leverage `.os-card` for unified container hierarchy.

1. **Design System Architect Block**:
   - Card 1 Container (line 507): `bg-[#15151A] border border-white/10 p-8` $\to$ `os-card p-8`
   - Card 2 Container (line 566): `bg-[#15151A] border border-white/10 p-8` $\to$ `os-card p-8`
2. **AI Solution Architect Block**:
   - Card 1 Container (line 659): `bg-[#15151A] border border-white/10 p-8 hover:border-violet-500/40` $\to$ `os-card p-8 hover:!border-violet-500/40`
   - Card 2 Container (line 704): `bg-[#15151A] border border-white/10 p-8 hover:border-violet-500/40` $\to$ `os-card p-8 hover:!border-violet-500/40`
3. **Agentic Dev Block**:
   - Card 1 Container (line 771): `bg-[#15151A] border border-white/10 p-8 hover:border-rose-500/40` $\to$ `os-card p-8 hover:!border-rose-500/40`
   - Card 2 Container (line 800): `bg-[#15151A] border border-white/10 p-8 hover:border-emerald-500/40` $\to$ `os-card p-8 hover:!border-emerald-500/40`
   - Inner Tech Stats:
     - Line 844: `bg-[#15151A] border border-white/10 p-4` $\to$ `os-card p-4`
     - Line 855: `bg-[#15151A] border border-white/10 p-6` $\to$ `os-card p-6`
     - Line 873: `bg-[#15151A] border border-white/10 p-6` $\to$ `os-card p-6`
4. **AI Brand Kit Generator Block**:
   - Container 1 (line 917): `bg-[#15151A] border border-white/10 p-8 md:p-12 hover:border-amber-500/40` $\to$ `os-card p-8 md:p-12 hover:!border-amber-500/40`
   - Container 2 (line 1026): `bg-[#15151A] border border-white/10 p-8 md:p-12 hover:border-yellow-500/40` $\to$ `os-card p-8 md:p-12 hover:!border-yellow-500/40`
5. **Additional Micro-cards**:
   - Card 3 Container (line 1187): `bg-[#15151A] border border-white/10` $\to$ `os-card`
   - Card 4 Container (line 1221): `bg-[#15151A] border border-white/10 p-8 md:p-10 hover:border-emerald-500/30` $\to$ `os-card p-8 md:p-10 hover:!border-emerald-500/30`
   - Card 5 Container (line 1293): `bg-[#15151A] border border-white/10 p-6 hover:border-blue-500/30` $\to$ `os-card p-6 hover:!border-blue-500/30`
   - Card 6 Container (line 1320): `bg-[#15151A] border border-white/10 p-6 hover:border-violet-500/30` $\to$ `os-card p-6 hover:!border-violet-500/30`
   - Card 7 Container (line 1343): `bg-[#15151A] border border-white/10 p-6 hover:border-violet-500/30` $\to$ `os-card p-6 hover:!border-violet-500/30`
   - Card 8 Container (line 1373): `bg-[#15151A] border border-white/10 p-6 hover:border-amber-500/30` $\to$ `os-card p-6 hover:!border-amber-500/30`

---

### Phase C: "Automation" & "London Coffee" Subsections (Lines 1445–1785)
1. **Automation System Blocks**:
   - Container 1 (line 1445): `bg-[#15151A] border border-white/10 p-8 md:p-12 hover:border-sky-500/40` $\to$ `os-card p-8 md:p-12 hover:!border-sky-500/40`
   - Container 2 (line 1550): `bg-[#15151A] border border-white/10 p-8 md:p-12 hover:border-teal-500/40` $\to$ `os-card p-8 md:p-12 hover:!border-teal-500/40`
2. **London Coffee Grid Blocks**:
   - Systematically refactor all 8 coffee cards (lines 1615, 1628, 1641, 1654, 1667, 1680, 1693, 1706) from `bg-[#15151A] p-8 border border-white/10 hover-target transition-all hover:border-[#F97316]/50` to `os-card p-8 hover-target transition-all hover:!border-[#F97316]/50`.
3. **Interactive Demo Grid (Line 1771)**:
   - Refactor grid elements: `bg-[#15151A] border border-white/10 hover:border-${demo.accent}-500/40` $\to$ `os-card hover:!border-${demo.accent}-500/40`.

---

### Phase D: Interactive Touch Target Tactile Mapping (`.cc-press`)
Integrate physical feedback curve into every CTA and link structure:
- All Launch/Demo buttons within "Selected Index" cards (lines 322, 339, 356, etc.).
- "Get the Guide" / "Landing Page ↗" buttons in Brand Kit (lines 1152, 1159).
- Gumroad purchase CTA in Brand Kit (line 1007).
- Live Map CTA (line 1600).
- "Book a Call" button in Agency Banner (line 1422).
- Main "Contact Me" and Gumroad CTAs in the Footer/Contact Section (lines 1801, 1804).

---

## 3. Verification & Quality Gates

To ensure no regression or build-time compilation issues:
1. **Compilation Check**: Execute `npm run build` locally within the `severus` workspace to confirm full TypeScript compliance.
2. **Aesthetic Audit**: Verify that no visual regressions occur in the layout and that the cards successfully acquire their sleek dark glass blur backdrop and inner borders.
