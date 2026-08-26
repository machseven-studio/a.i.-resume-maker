/**
 * ============================================================================
 *  AI RESUME MAKER — single-file Node.js + Express app
 *  (using Google's Gemini API — free tier, no credit card required)
 * ============================================================================
 *
 *  SETUP (run these in your terminal, in an empty folder):
 *
 *    npm init -y
 *    npm install express puppeteer @google/genai dotenv razorpay
 *
 *  Then create a file called `.env` next to this file with:
 *
 *    AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
 *    RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
 *    PORT=3000
 *
 *  Get the Gemini key for free (no card needed) at https://aistudio.google.com/apikey
 *  Get your Razorpay keys from Dashboard > Settings > API Keys (must be an
 *  activated account for Live keys; Test keys work for a dry run first).
 *
 *  Then run:
 *
 *    node index.js
 *
 *  Open http://localhost:3000 in your browser.
 *
 *  NOTE ON RENDER DEPLOYMENT: this version uses Puppeteer (a real headless
 *  Chrome browser) to turn an HTML template into the PDF, instead of the old
 *  PDFKit "draw text by hand" approach. This is what makes the two-column,
 *  full-page-bleed layout possible. On Render, add this as a Build Command
 *  so Chrome actually gets installed on their servers:
 *
 *    npm install && npx puppeteer browsers install chrome
 *
 *  (Render's free/standard Linux containers can run Puppeteer fine, but the
 *  Chrome binary has to be installed during the build step above — it won't
 *  appear automatically just from `npm install`.)
 * ============================================================================
 */

require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const puppeteer = require('puppeteer');
const { GoogleGenAI } = require('@google/genai');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;

const genAI = new GoogleGenAI({
  apiKey: process.env.AI_API_KEY,
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.use(express.json({ limit: '2mb' }));

// ----------------------------------------------------------------------------
// PRICING — single source of truth. Change this one number and everything
// (Razorpay order, UI text, button labels) follows automatically.
// ----------------------------------------------------------------------------
const PRICE_RUPEES = 79;
const PRICE_PAISE = PRICE_RUPEES * 100; // 7900 paise for Razorpay

// A shared Puppeteer browser instance so we're not launching a fresh Chrome
// process on every single PDF request (slow + wasteful on Render's free tier).
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

// ----------------------------------------------------------------------------
// COMPREHENSIVE DEGREE LIST — used to populate the searchable qualifications
// dropdown (Indian + International degrees).
// ----------------------------------------------------------------------------
const DEGREE_LIST = [
  'B.Tech (Bachelor of Technology)', 'M.Tech (Master of Technology)',
  'B.E. (Bachelor of Engineering)', 'M.E. (Master of Engineering)',
  'B.Sc (Bachelor of Science)', 'M.Sc (Master of Science)',
  'B.Com (Bachelor of Commerce)', 'M.Com (Master of Commerce)',
  'BA (Bachelor of Arts)', 'MA (Master of Arts)',
  'BBA (Bachelor of Business Administration)', 'MBA (Master of Business Administration)',
  'BCA (Bachelor of Computer Applications)', 'MCA (Master of Computer Applications)',
  'MBBS (Bachelor of Medicine, Bachelor of Surgery)', 'MD (Doctor of Medicine)',
  'MS (Master of Surgery)', 'BDS (Bachelor of Dental Surgery)', 'MDS (Master of Dental Surgery)',
  'LLB (Bachelor of Laws)', 'LLM (Master of Laws)',
  'B.Arch (Bachelor of Architecture)', 'M.Arch (Master of Architecture)',
  'B.Pharm (Bachelor of Pharmacy)', 'M.Pharm (Master of Pharmacy)',
  'B.Ed (Bachelor of Education)', 'M.Ed (Master of Education)',
  'BHM (Bachelor of Hotel Management)', 'BFA (Bachelor of Fine Arts)', 'MFA (Master of Fine Arts)',
  'B.Des (Bachelor of Design)', 'M.Des (Master of Design)',
  'CA (Chartered Accountant)', 'CS (Company Secretary)', 'CFA (Chartered Financial Analyst)',
  'ICWA / CMA (Cost and Management Accountant)',
  'Diploma (Polytechnic)', 'Higher Secondary (10+2)', 'Secondary School (10th)',
  'Ph.D. (Doctor of Philosophy)', 'Post-Doctoral Fellowship',
  'BS (Bachelor of Science, International)', 'MS (Master of Science, International)',
  'BA (Hons)', 'MA (Hons)',
  'B.Voc (Bachelor of Vocation)', 'PGDM (Post Graduate Diploma in Management)',
  'Executive MBA', 'PGCE (Postgraduate Certificate in Education)',
  'Associate Degree', "Bachelor's Degree (General)", "Master's Degree (General)",
  'JD (Juris Doctor, US Law)', 'EdD (Doctor of Education)', 'PsyD (Doctor of Psychology)',
  'DVM (Doctor of Veterinary Medicine)', 'DNB (Diplomate of National Board, Medical)',
];

// ----------------------------------------------------------------------------
// FRONTEND — one big HTML page, Tailwind via CDN, vanilla JS for the fetch call
// ----------------------------------------------------------------------------
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Résumé Maker — Executive ATS Résumés</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  tailwind = tailwind || {};
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          wine: '#4A1620',
          wineLight: '#6B2430',
          gold: '#C9A876',
          parchment: '#F5EBE0',
          hairline: '#7A3540',
        },
        fontFamily: {
          display: ['Cormorant', 'serif'],
          sans: ['Libre Franklin', 'sans-serif'],
          silly: ['Kalam', 'cursive'],
        },
      },
    },
  };
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,500;0,600;1,500;1,600&family=Libre+Franklin:wght@400;500;700&family=Kalam:wght@400;700&display=swap" rel="stylesheet">
<style>
  body {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    background-color: #4A1620;
    color: #F5EBE0;
    background-image:
      repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 3px),
      linear-gradient(125deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 18%, rgba(201,168,118,0.06) 30%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0) 58%, rgba(107,36,48,0.5) 68%, rgba(255,255,255,0.07) 80%, rgba(255,255,255,0) 100%),
      radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 50%),
      radial-gradient(ellipse at 80% 70%, rgba(201,168,118,0.07) 0%, rgba(255,255,255,0) 55%);
    background-attachment: fixed;
  }
  h1, h2, h3 { font-family: 'Cormorant', serif; letter-spacing: 1px; }

  .headline-cream {
    background-image: linear-gradient(135deg, #FDF8EF 0%, #EDE0C8 40%, #F5EBDB 60%, #E8D9BC 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }

  ::selection { background: #6B2430; color: #F5EBE0; }
  .glow-border:focus { box-shadow: 0 0 0 2px rgba(201,168,118,0.4); }
  .spinner {
    border: 3px solid rgba(245,235,224,0.15);
    border-top-color: #F5EBE0;
    border-radius: 50%;
    width: 18px; height: 18px;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes heroFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes drawLine {
    from { width: 0; }
    to { width: 64px; }
  }
  @keyframes punchIn {
    0% { opacity: 0; transform: scale(0.85) translateY(8px); }
    60% { opacity: 1; transform: scale(1.04) translateY(0); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  .hero-heading {
    opacity: 0;
    animation: heroFadeUp 0.9s ease-out forwards;
  }
  .hero-rule {
    width: 0;
    height: 2px;
    background-color: #C9A876;
    margin: 18px auto;
    animation: drawLine 0.6s ease-out forwards;
    animation-delay: 0.9s;
  }
  .hero-subheading {
    opacity: 0;
    animation: punchIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: 3s;
  }

  /* Mandatory field star */
  .req-star { color: #C9A876; margin-left: 3px; font-weight: 700; }

  /* Dynamic company card */
  .company-card { position: relative; }
  .remove-company-btn {
    position: absolute; top: 10px; right: 10px;
    background: rgba(122,53,64,0.6); color: #F5EBE0;
    border: 1px solid #7A3540; border-radius: 6px;
    width: 26px; height: 26px; line-height: 1;
    font-size: 14px; cursor: pointer;
  }
  .remove-company-btn:hover { background: #7A3540; }

  .field-error { border-color: #f87171 !important; }

  /* Product Hunt badge */
  .ph-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: #F5EBE0; color: #4A1620;
    border-radius: 999px; padding: 6px 14px;
    font-size: 12px; font-weight: 600;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
  }
</style>
</head>
<body class="min-h-screen">

  <div class="max-w-3xl mx-auto px-6 py-14">

    <!-- HERO / TAGLINE SECTION -->
    <div class="mb-14 text-center relative">

      <!-- Requirement 4: Product Hunt badge, visible corner of hero -->
      <div class="flex justify-center md:justify-end mb-4">
        <span class="ph-badge">🏆 Featured on Product Hunt</span>
      </div>

      <p class="uppercase tracking-[0.3em] text-xs text-gold mb-4">AI Résumé Maker</p>
      <h1 class="hero-heading headline-cream text-2xl md:text-4xl font-semibold tracking-tight leading-tight max-w-2xl mx-auto">
        No matter how &quot;<span class="font-silly font-normal">diverse</span>&quot; your experience is, if your resume looks like everyone else's homework, recruiters will <span class="font-bold" style="letter-spacing: 2px; font-size: 1.1em;">REJECT</span> it.
      </h1>
      <div class="hero-rule"></div>
      <p class="hero-subheading font-display italic text-gold text-base md:text-lg mb-10">
        (and honestly, basic résumés get basic salaries, you know?)
      </p>

      <div class="text-left max-w-xl mx-auto mb-10 space-y-4">
        <div class="flex gap-3">
          <span class="text-gold font-medium text-sm" style="font-family: Georgia, serif;">1.</span>
          <p class="text-parchment text-sm leading-relaxed" style="font-family: Georgia, serif;">Our advanced A.I. software will modify your basic keywords and convert them into Oxford-level immaculate English sentences which are impossible to overlook.</p>
        </div>
        <div class="flex gap-3">
          <span class="text-gold font-medium text-sm" style="font-family: Georgia, serif;">2.</span>
          <p class="text-parchment text-sm leading-relaxed" style="font-family: Georgia, serif;">Your resume will look like a <em>modern art masterpiece</em> instead of some confusing income-tax form.</p>
        </div>
        <div class="flex gap-3">
          <span class="text-gold font-medium text-sm" style="font-family: Georgia, serif;">3.</span>
          <p class="text-parchment text-sm leading-relaxed" style="font-family: Georgia, serif;">Your resume will be customised with <span class="text-gold font-semibold">executive-grade</span> raised lettering, <span class="text-gold font-semibold">premium golden edges</span> for the highlights, and a <span class="text-gold font-semibold">neat layout</span> <em>(which is cleaner than your excuses for being unemployed.)</em></p>
        </div>
        <div class="flex gap-3">
          <span class="text-gold font-medium text-sm" style="font-family: Georgia, serif;">4.</span>
          <p class="text-parchment text-sm leading-relaxed" style="font-family: Georgia, serif;">Your resume will be laden with slick margins <span class="uppercase">so precise</span>, even the pickiest recruiter won't find a flaw.</p>
        </div>
      </div>

      <h2 class="font-display text-2xl md:text-4xl font-semibold text-parchment leading-snug max-w-2xl mx-auto">
        Give us 120 seconds. We'll craft a resume the recruiters can't ignore.
      </h2>
      <p class="italic text-parchment/70 text-base mt-3"><em>(as for the processing fee? well, it's cheaper than an energy drink.)</em></p>
    </div>

    <!-- FORM CARD -->
    <div class="bg-wineLight/40 border border-hairline rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
      <form id="resumeForm" class="space-y-6" novalidate>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Full Name<span class="req-star">★</span></label>
            <input required name="fullName" type="text" placeholder="Jordan Blake"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Target Role / Position Title<span class="req-star">★</span></label>
            <input required name="targetRole" type="text" placeholder="Senior Product Manager"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Email<span class="req-star">★</span></label>
            <input required name="email" type="email" placeholder="jordan@email.com"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Phone</label>
            <input name="phone" type="text" placeholder="+91 98765 43210"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Location</label>
            <input name="location" type="text" placeholder="Mumbai, India"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">LinkedIn URL</label>
            <input name="linkedin" type="text" placeholder="linkedin.com/in/jordanblake"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
        </div>

        <!-- Requirement 2: Mandatory searchable qualifications dropdown -->
        <div>
          <label class="block text-sm text-parchment/70 mb-1.5">Highest Qualification / Degree<span class="req-star">★</span></label>
          <input required name="degree" list="degreeOptions" autocomplete="off" placeholder="Start typing... e.g. B.Tech"
            class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          <datalist id="degreeOptions">
            ${DEGREE_LIST.map((d) => `<option value="${d.replace(/"/g, '&quot;')}"></option>`).join('\n            ')}
          </datalist>
          <p class="text-xs text-parchment/50 mt-1.5">Start typing to search — Indian &amp; international degrees supported.</p>
        </div>

        <!-- Requirement 2: Dynamic Work Experience (optional overall) -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm text-parchment/70">Work Experience <span class="text-parchment/40">(optional)</span></label>
            <button type="button" id="addCompanyBtn"
              class="text-xs bg-gold text-wine font-semibold rounded-lg px-3 py-1.5 hover:bg-parchment transition">
              + Add Another Company
            </button>
          </div>
          <div id="companiesContainer" class="space-y-4"></div>
          <p class="text-xs text-parchment/50 mt-2">Leave this section empty if you have no work experience yet — totally fine. But if you add a company, fill in all three of its fields.</p>
        </div>

        <div>
          <label class="block text-sm text-parchment/70 mb-1.5">
            Raw Work Experience, Achievements &amp; Plain Keywords<span class="req-star">★</span>
          </label>
          <textarea required name="rawExperience" rows="7" placeholder="e.g. managed a team of 5, helped launch app, good at excel, handled customer complaints, ran social media page, in charge of budget for events..."
            class="w-full bg-wine border border-hairline rounded-lg px-4 py-3 text-parchment glow-border outline-none"></textarea>
          <p class="text-xs text-parchment/50 mt-1.5">Dump it in plain English. We'll do the fancy talk for you.</p>
        </div>

        <!-- Requirement 2: Extracurricular Achievements (optional) -->
        <div>
          <label class="block text-sm text-parchment/70 mb-1.5">
            Extracurricular Achievements &amp; Honors <span class="text-parchment/40">(optional)</span>
          </label>
          <textarea name="extracurricular" rows="3" placeholder="e.g. state-level chess champion, college fest coordinator, published a research paper, volunteer work..."
            class="w-full bg-wine border border-hairline rounded-lg px-4 py-3 text-parchment glow-border outline-none"></textarea>
        </div>

        <!-- PRE-PAYMENT TAGLINE -->
        <div class="text-center font-display text-parchment leading-relaxed pt-2">
          <p class="text-lg mb-1">You're not paying for a &quot;PDF&quot;. You're paying to <em>stop getting filtered out</em>.</p>
          <p class="text-lg mb-1">Most people skip this step, and wonder why they're still <strong>UNEMPLOYED</strong>.</p>
        </div>

        <!-- PRICING TAGLINE -->
        <p class="text-center font-display italic text-parchment text-base mt-2">
          This is criminally underpriced. Act before we fix that.
        </p>

        <!-- PRICING / PAYMENT PANEL -->
        <div class="mt-4 rounded-2xl border border-hairline bg-wine/60 p-6">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div>
              <p class="text-xs uppercase tracking-widest text-gold">Limited Offer · 80% OFF</p>
              <p class="text-3xl font-display font-semibold text-parchment mt-1">
                ₹79 <span class="text-base font-normal text-parchment/40 line-through ml-2">₹249</span>
              </p>
            </div>
            <div class="text-right text-xs text-parchment/70 space-y-1">
              <p>✓ Executive-level action verbs</p>
              <p>✓ Beats ATS keyword filters</p>
              <p>✓ 1-click crisp PDF download</p>
              <p>✓ Impressive enough to get you a job</p>
            </div>
          </div>
          <button type="submit" id="submitBtn"
            class="w-full bg-gold text-wine font-medium rounded-lg py-3.5 hover:bg-parchment transition flex items-center justify-center gap-2">
            <span id="btnLabel">Unlock for ₹79</span>
          </button>
          <p class="text-center italic text-gold text-sm mt-3">
            Who would've thought ₹79 could get you hired?
          </p>
          <p class="text-center text-xs text-parchment/50 mt-3">Secure checkout · Powered by Razorpay</p>
        </div>

        <p id="errorMsg" class="text-red-300 text-sm hidden"></p>
      </form>
    </div>

    <p class="text-center text-xs text-parchment/40 mt-8">
      Your data is used only to generate your résumé. Nothing is stored.
    </p>

    <div class="text-center border-t border-hairline pt-6 mt-8">
      <p class="text-xs text-parchment/60 leading-relaxed max-w-md mx-auto mb-3">
        Got questions? Facing any problems? Wanna shower us with genuine gratitude? Want someone to yell at?
      </p>
      <div class="flex justify-center items-center gap-2.5 flex-wrap mb-2.5">
        <a href="mailto:samdave2131@gmail.com" class="text-parchment text-sm font-medium border-b border-gold pb-0.5 hover:text-gold transition">samdave2131@gmail.com</a>
        <span class="text-gold text-xs">•</span>
        <a href="mailto:machseven.studio@gmail.com" class="text-parchment text-sm font-medium border-b border-gold pb-0.5 hover:text-gold transition">machseven.studio@gmail.com</a>
      </div>
      <p class="text-xs italic text-gold/80">
        We actually respond, unlike the last three recruiters who ghosted you.
      </p>
    </div>

    <div class="text-center mt-6">
      <p class="font-display text-sm text-parchment/60 mb-1">
        Feel free to share our website with your fellow unemployed friends!
      </p>
      <p class="font-display text-sm text-parchment/60">
        Have a nice day ahead :)
      </p>
    </div>
  </div>

<script>
  const form = document.getElementById('resumeForm');
  const btn = document.getElementById('submitBtn');
  const btnLabel = document.getElementById('btnLabel');
  const errorMsg = document.getElementById('errorMsg');
  const companiesContainer = document.getElementById('companiesContainer');
  const addCompanyBtn = document.getElementById('addCompanyBtn');

  const PRICE_RUPEES = 79;

  let companyCount = 0;

  function addCompanyCard() {
    companyCount += 1;
    const idx = companyCount;
    const card = document.createElement('div');
    card.className = 'company-card bg-wine/50 border border-hairline rounded-xl p-4';
    card.dataset.companyId = idx;
    card.innerHTML =
      '<button type="button" class="remove-company-btn" title="Remove this company">×</button>' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">' +
        '<div>' +
          '<label class="block text-xs text-parchment/60 mb-1">Company Name</label>' +
          '<input type="text" data-field="companyName" placeholder="Northlane Studio" ' +
            'class="w-full bg-wine border border-hairline rounded-lg px-3 py-2 text-sm text-parchment glow-border outline-none" />' +
        '</div>' +
        '<div>' +
          '<label class="block text-xs text-parchment/60 mb-1">Job Title</label>' +
          '<input type="text" data-field="jobTitle" placeholder="Product Manager" ' +
            'class="w-full bg-wine border border-hairline rounded-lg px-3 py-2 text-sm text-parchment glow-border outline-none" />' +
        '</div>' +
        '<div>' +
          '<label class="block text-xs text-parchment/60 mb-1">Date Window</label>' +
          '<input type="text" data-field="dateWindow" placeholder="2022 - 2025 or 03/2022 - Present" ' +
            'class="w-full bg-wine border border-hairline rounded-lg px-3 py-2 text-sm text-parchment glow-border outline-none" />' +
        '</div>' +
      '</div>';

    card.querySelector('.remove-company-btn').addEventListener('click', () => {
      card.remove();
    });

    companiesContainer.appendChild(card);
  }

  addCompanyBtn.addEventListener('click', addCompanyCard);

  function clearFieldErrors() {
    form.querySelectorAll('.field-error').forEach((el) => el.classList.remove('field-error'));
  }

  function markFieldError(el) {
    el.classList.add('field-error');
  }

  // Returns { valid: boolean, companies: [...] } and paints red borders on
  // whatever is missing so the user actually knows what to fix.
  function validateForm() {
    clearFieldErrors();
    let valid = true;

    // Standard required inputs (fullName, targetRole, email, degree, rawExperience)
    form.querySelectorAll('[required]').forEach((el) => {
      if (!el.value || !el.value.trim()) {
        valid = false;
        markFieldError(el);
      }
    });

    // Dynamic company cards: optional as a whole, but if a card exists,
    // ALL THREE of its fields must be filled in.
    const companies = [];
    companiesContainer.querySelectorAll('.company-card').forEach((card) => {
      const companyName = card.querySelector('[data-field="companyName"]');
      const jobTitle = card.querySelector('[data-field="jobTitle"]');
      const dateWindow = card.querySelector('[data-field="dateWindow"]');

      const vals = {
        companyName: companyName.value.trim(),
        jobTitle: jobTitle.value.trim(),
        dateWindow: dateWindow.value.trim(),
      };

      const anyFilled = vals.companyName || vals.jobTitle || vals.dateWindow;
      const allFilled = vals.companyName && vals.jobTitle && vals.dateWindow;

      if (anyFilled && !allFilled) {
        valid = false;
        if (!vals.companyName) markFieldError(companyName);
        if (!vals.jobTitle) markFieldError(jobTitle);
        if (!vals.dateWindow) markFieldError(dateWindow);
      }

      if (allFilled) {
        companies.push(vals);
      }
    });

    return { valid, companies };
  }

  function resetButton() {
    btn.disabled = false;
    btnLabel.textContent = 'Unlock for ₹' + PRICE_RUPEES;
  }

  async function downloadResume(fields, razorpayResponse) {
    btnLabel.innerHTML = '<span class="spinner"></span> Generating your résumé...';

    const payload = {
      ...fields,
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_signature: razorpayResponse.razorpay_signature,
    };

    const res = await fetch('/api/generate-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Something went wrong.' }));
      throw new Error(err.error || 'Something went wrong.');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    const a = document.createElement('a');
    a.href = url;
    a.download = (fields.fullName || 'resume').replace(/\\s+/g, '_') + '_Resume.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();

    btnLabel.textContent = 'Downloaded ✓ — Unlock Another for ₹' + PRICE_RUPEES;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');

    const { valid, companies } = validateForm();
    if (!valid) {
      errorMsg.textContent = 'Please fill in all required (★) fields — and make sure any company you add has all three of its fields filled in.';
      errorMsg.classList.remove('hidden');
      return;
    }

    const formData = new FormData(form);
    const fields = {
      fullName: formData.get('fullName'),
      targetRole: formData.get('targetRole'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      linkedin: formData.get('linkedin'),
      degree: formData.get('degree'),
      companies: companies,
      rawExperience: formData.get('rawExperience'),
      extracurricular: formData.get('extracurricular'),
    };

    btn.disabled = true;
    btnLabel.textContent = 'Preparing payment...';

    try {
      const orderRes = await fetch('/api/create-order', { method: 'POST' });
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({ error: 'Could not start payment.' }));
        throw new Error(err.error || 'Could not start payment.');
      }
      const order = await orderRes.json();

      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'AI Résumé Maker',
        description: 'Executive résumé PDF',
        theme: { color: '#C9A876' },
        handler: async function (response) {
          try {
            await downloadResume(fields, response);
          } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
          } finally {
            resetButton();
          }
        },
        modal: {
          ondismiss: function () {
            resetButton();
          },
        },
      });

      rzp.on('payment.failed', function (response) {
        errorMsg.textContent =
          'Payment failed: ' + ((response.error && response.error.description) || 'Please try again.');
        errorMsg.classList.remove('hidden');
        resetButton();
      });

      btnLabel.textContent = 'Unlock for ₹' + PRICE_RUPEES;
      btn.disabled = false;
      rzp.open();
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.classList.remove('hidden');
      resetButton();
    }
  });
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.type('html').send(HTML_PAGE);
});

// ----------------------------------------------------------------------------
// ROUTE: /api/create-order — creates a real Razorpay order before checkout opens
// ----------------------------------------------------------------------------
app.post('/api/create-order', async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Server misconfiguration: Razorpay keys are not set.' });
    }

    const order = await razorpay.orders.create({
      amount: PRICE_PAISE, // ₹79 in paise
      currency: 'INR',
      receipt: 'receipt_' + Date.now(),
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    return res.status(500).json({ error: 'Failed to create payment order. Please try again.' });
  }
});

// ----------------------------------------------------------------------------
// AI PROMPT LOGIC
// ----------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an elite executive résumé writer, trained in Oxford-level formal English, and an ATS (Applicant Tracking System) optimization specialist.

You will be given a candidate's raw, plain-English notes about their work experience, along with their target role. Transform this into a polished, ATS-friendly résumé written in sophisticated, formal register — the kind of prose a top-tier executive search consultancy would produce.

STRICT RULES:
1. VOCABULARY: Use precise, elevated, distinct action verbs and descriptors throughout — the register of formal British/Oxford English, not casual American business jargon. For example:
   - "managed" -> "orchestrated", "superintended", "administered" (vary constantly; never reuse)
   - "helped" -> "facilitated", "championed", "enabled"
   - "good at" / "skilled at" -> "possesses marked proficiency in", "demonstrates considerable acumen in"
   - "worked on" -> "engineered", "architected", "undertook"
   - "in charge of" -> "presided over", "was entrusted with", "administered"
2. ZERO REPETITION: No word of substance (verb, adjective, or noun descriptor) may be reused anywhere else in the document. Every bullet point must begin with a different verb and employ different sentence architecture from every other bullet. Treat repetition as a failure.
3. MAXIMISE THE GIVEN MATERIAL: The candidate's raw notes may be sparse. Extract every plausible implication from what is provided and render it in its most impressive, precise, and fully realised form — without inventing facts that were not stated or reasonably implied.
4. NO INVENTED METRICS, NO PLACEHOLDER BRACKETS: Never insert bracketed placeholders such as "[X]%", "[X]+ team members", "[X]K users", or "$[X]K", and never invent a number as though it were factual. If the raw input does not supply a real figure, describe the achievement qualitatively instead (e.g. "materially improved", "substantially reduced") rather than gesturing at a missing statistic.
5. ATS FORMATTING: Use standard, machine-parseable section names: SUMMARY, EXPERIENCE, SKILLS, EDUCATION, ACHIEVEMENTS. Keep bullet points concise (generally under 24 words), front-loaded with the governing verb, despite the elevated vocabulary.
6. TONE: Formal, commanding, wholly free of cliché ("team player", "hard worker", "go-getter" are forbidden even when reframed) and free of first-person pronouns. Every sentence should read as though drafted for a board-level dossier.
7. NEVER USE PLACEHOLDER TEXT: Do not fabricate job titles, companies, or dates that were not provided. If a field such as company name or dates is genuinely missing from the input, return it as an EMPTY STRING ("") rather than a bracketed placeholder like "[Company Name]" or "[Dates]" — an empty string will simply be left off the finished résumé, which is the desired behaviour. The candidate's raw input below may include a list of actual companies with job titles and date windows, supplied directly by the user — use those verbatim (do not alter names/dates/titles) as the basis for the "experience" array, using rawExperience to help write the bullets under each.
8. EXTRACURRICULAR / ACHIEVEMENTS: If extracurricular activities or honors are supplied, produce a short "achievements" array of polished bullet points in the same elevated register. If none are supplied, return an empty array.

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown fences, no commentary, no leading/trailing text) matching exactly this shape:

{
  "name": "string",
  "targetRole": "string",
  "contact": { "email": "string", "phone": "string", "location": "string", "linkedin": "string" },
  "summary": "2-3 sentence executive summary in formal register, string",
  "experience": [
    {
      "title": "string (role title, from the supplied company list if present, else inferred from raw input or target role)",
      "org": "string (company/organization if provided, else an empty string \\"\\")",
      "dates": "string (employment date window if provided, else an empty string \\"\\")",
      "bullets": ["string", "string", "..."]
    }
  ],
  "skills": ["string", "string", "..."],
  "education": [
    { "degree": "string", "institution": "string", "dates": "string" }
  ],
  "achievements": ["string", "string", "..."]
}

If the raw input gives no clear structure to split into multiple jobs/roles, and no company list was supplied, produce a single experience entry that best represents the candidate's described work. If no companies were supplied at all, "experience" may contain a single entry with empty "org"/"dates" built purely from rawExperience. If education is not mentioned at all, return an empty array for "education". Every array must contain at least one meaningful, non-empty entry where data exists.`;

function buildUserPrompt(data) {
  const companiesBlock = Array.isArray(data.companies) && data.companies.length > 0
    ? data.companies
        .map((c, i) => `  ${i + 1}. Company: ${c.companyName} | Title: ${c.jobTitle} | Dates: ${c.dateWindow}`)
        .join('\n')
    : '  (none supplied)';

  return `Candidate raw input:

Full Name: ${data.fullName}
Target Role: ${data.targetRole}
Email: ${data.email}
Phone: ${data.phone || 'N/A'}
Location: ${data.location || 'N/A'}
LinkedIn: ${data.linkedin || 'N/A'}
Highest Qualification / Degree: ${data.degree || 'Not provided'}

Companies (structured, use verbatim for org/title/dates):
${companiesBlock}

Raw Work Experience, Achievements & Plain Keywords:
"""
${data.rawExperience}
"""

Extracurricular Achievements & Honors (raw, optional):
"""
${data.extracurricular || 'Not provided'}
"""

Transform this into the strict JSON résumé format described in your instructions. Return ONLY the JSON object.`;
}

function safeJSONParse(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonSlice = firstBrace !== -1 && lastBrace !== -1
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned;

  return JSON.parse(jsonSlice);
}

async function generateResumeContent(formData) {
  const response = await genAI.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [
      { role: 'user', parts: [{ text: buildUserPrompt(formData) }] },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 4000,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('AI returned no usable content.');
  }

  return safeJSONParse(text);
}

// ----------------------------------------------------------------------------
// REAL PAYMENT VALIDATION — verifies the signature Razorpay sends back after
// a successful checkout, using HMAC-SHA256 with your Key Secret.
// ----------------------------------------------------------------------------
function verifyRazorpaySignature(body) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return expectedSignature === razorpay_signature;
}

// ----------------------------------------------------------------------------
// PDF RENDERING — Requirement 3: full-bleed A4, two-column executive layout,
// cream background, via Puppeteer (renders real HTML/CSS, then prints to PDF).
// ----------------------------------------------------------------------------

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildResumeHtml(resume) {
  const contactLines = [
    resume.contact?.email,
    resume.contact?.phone,
    resume.contact?.location,
    resume.contact?.linkedin,
  ].filter(Boolean);

  const skillsHtml = (resume.skills || [])
    .map((s) => `<span class="skill-chip">${escapeHtml(s)}</span>`)
    .join('');

  const educationHtml = (resume.education || [])
    .map(
      (edu) => `
      <div class="edu-item">
        <div class="edu-degree">${escapeHtml(edu.degree)}</div>
        <div class="edu-meta">${[edu.institution, edu.dates].filter(Boolean).map(escapeHtml).join(' &middot; ')}</div>
      </div>`
    )
    .join('');

  const experienceHtml = (resume.experience || [])
    .map((job) => {
      const orgLine = [job.org, job.dates].filter(Boolean).map(escapeHtml).join('   |   ');
      const bullets = (job.bullets || [])
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('');
      return `
      <div class="exp-item">
        <div class="exp-title">${escapeHtml(job.title || 'Role')}</div>
        ${orgLine ? `<div class="exp-org">${orgLine}</div>` : ''}
        <ul class="exp-bullets">${bullets}</ul>
      </div>`;
    })
    .join('');

  const achievementsHtml = (resume.achievements || []).length
    ? `
      <div class="section">
        <div class="section-title">Achievements</div>
        <ul class="achievement-bullets">
          ${(resume.achievements || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
        </ul>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page { size: 210mm 297mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    width: 210mm; height: 297mm;
    font-family: 'Georgia', 'Times New Roman', serif;
    background: #FDFBF7;
    background-image:
      radial-gradient(circle at 15% 20%, rgba(165,130,79,0.05) 0%, transparent 45%),
      radial-gradient(circle at 85% 80%, rgba(165,130,79,0.05) 0%, transparent 45%);
  }
  .page {
    width: 210mm;
    height: 297mm;
    display: flex;
  }
  .sidebar {
    width: 34%;
    height: 297mm;
    background: #F1E7D6;
    border-right: 1px solid #D9C6A3;
    padding: 16mm 8mm 12mm 10mm;
    display: flex;
    flex-direction: column;
  }
  .main {
    width: 66%;
    height: 297mm;
    padding: 16mm 12mm 12mm 10mm;
    display: flex;
    flex-direction: column;
  }
  .name {
    font-size: 22pt;
    font-weight: bold;
    color: #2A2018;
    line-height: 1.15;
    margin-bottom: 3mm;
  }
  .target-role {
    font-size: 11.5pt;
    color: #A5824F;
    font-style: italic;
    margin-bottom: 8mm;
  }
  .sidebar .block { margin-bottom: 8mm; }
  .sidebar .block-title {
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #A5824F;
    border-bottom: 1px solid #C9A876;
    padding-bottom: 2mm;
    margin-bottom: 3mm;
    font-weight: bold;
  }
  .contact-line {
    font-size: 8.8pt;
    color: #4A4030;
    margin-bottom: 1.6mm;
    word-break: break-word;
  }
  .edu-item { margin-bottom: 3.5mm; }
  .edu-degree { font-size: 9.5pt; font-weight: bold; color: #2A2018; }
  .edu-meta { font-size: 8.3pt; color: #6B5F4F; }
  .skill-chip {
    display: inline-block;
    font-size: 8.3pt;
    background: #E8D9BC;
    color: #3A3226;
    border-radius: 3mm;
    padding: 1.2mm 3mm;
    margin: 0 1.5mm 1.5mm 0;
  }
  .section { margin-bottom: 7mm; }
  .section-title {
    font-size: 11.5pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #A5824F;
    border-bottom: 1.2px solid #C9A876;
    padding-bottom: 2mm;
    margin-bottom: 3.5mm;
    font-weight: bold;
  }
  .summary-text {
    font-size: 10pt;
    line-height: 1.5;
    color: #3A3226;
  }
  .exp-item { margin-bottom: 5.5mm; }
  .exp-title { font-size: 10.8pt; font-weight: bold; color: #2A2018; }
  .exp-org { font-size: 9pt; color: #6B5F4F; margin-bottom: 1.5mm; }
  .exp-bullets, .achievement-bullets {
    margin: 0; padding-left: 4mm;
    font-size: 9.6pt; color: #3A3226; line-height: 1.45;
  }
  .exp-bullets li, .achievement-bullets li { margin-bottom: 1.3mm; }
</style>
</head>
<body>
  <div class="page">
    <div class="sidebar">
      <div class="name">${escapeHtml(resume.name)}</div>
      <div class="target-role">${escapeHtml(resume.targetRole)}</div>

      <div class="block">
        <div class="block-title">Contact</div>
        ${contactLines.map((c) => `<div class="contact-line">${escapeHtml(c)}</div>`).join('')}
      </div>

      ${
        educationHtml
          ? `<div class="block"><div class="block-title">Education</div>${educationHtml}</div>`
          : ''
      }

      ${
        skillsHtml
          ? `<div class="block"><div class="block-title">Skills</div><div>${skillsHtml}</div></div>`
          : ''
      }
    </div>

    <div class="main">
      ${
        resume.summary
          ? `<div class="section"><div class="section-title">Summary</div><div class="summary-text">${escapeHtml(resume.summary)}</div></div>`
          : ''
      }

      ${
        experienceHtml
          ? `<div class="section"><div class="section-title">Experience</div>${experienceHtml}</div>`
          : ''
      }

      ${achievementsHtml}
    </div>
  </div>
</body>
</html>`;
}

async function generatePdfBuffer(resume) {
  const html = buildResumeHtml(resume);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      width: '210mm',
      height: '297mm',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

// ----------------------------------------------------------------------------
// ROUTE: /api/generate-resume
// ----------------------------------------------------------------------------
app.post('/api/generate-resume', async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.fullName || !body.targetRole || !body.email || !body.rawExperience || !body.degree) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Server-side validation of dynamic company entries: if any company
    // object is present, all three of its sub-fields must be non-empty.
    if (Array.isArray(body.companies)) {
      for (const c of body.companies) {
        if (!c || !c.companyName || !c.jobTitle || !c.dateWindow) {
          return res.status(400).json({ error: 'Each company entry must include a company name, job title, and date window.' });
        }
      }
    }

    const paymentOk = verifyRazorpaySignature(body);
    if (!paymentOk) {
      return res.status(402).json({ error: 'Payment verification failed.' });
    }

    if (!process.env.AI_API_KEY) {
      return res.status(500).json({ error: 'Server misconfiguration: AI_API_KEY is not set.' });
    }

    const resumeContent = await generateResumeContent(body);

    resumeContent.name = resumeContent.name || body.fullName;
    resumeContent.targetRole = resumeContent.targetRole || body.targetRole;
    resumeContent.contact = resumeContent.contact || {};
    resumeContent.contact.email = resumeContent.contact.email || body.email;
    resumeContent.contact.phone = resumeContent.contact.phone || body.phone;
    resumeContent.contact.location = resumeContent.contact.location || body.location;
    resumeContent.contact.linkedin = resumeContent.contact.linkedin || body.linkedin;

    const pdfBuffer = await generatePdfBuffer(resumeContent);

    const safeFileName = (body.fullName || 'resume').replace(/[^a-z0-9]+/gi, '_');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeFileName}_Resume.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating resume:', err);
    return res.status(500).json({ error: 'Failed to generate resume. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Résumé Maker running at http://localhost:${PORT}`);
});
