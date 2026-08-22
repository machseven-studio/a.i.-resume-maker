/**
 * ============================================================================
 *  AI RESUME MAKER — single-file Node.js + Express app
 *  (using Google's Gemini API — free tier, no credit card required)
 * ============================================================================
 *
 *  SETUP (run these in your terminal, in an empty folder):
 *
 *    npm init -y
 *    npm install express pdfkit @google/genai dotenv
 *
 *  Then create a file called `.env` next to this file with:
 *
 *    AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    PORT=3000
 *
 *  Get that key for free (no card needed) at https://aistudio.google.com/apikey
 *
 *  Then run:
 *
 *    node index.js
 *
 *  Open http://localhost:3000 in your browser.
 *
 *  Plain-English glossary, because apparently we don't trust ourselves:
 *  - "Express"   = the traffic cop that answers when your browser asks the
 *                  server for a page or sends it data.
 *  - "PDFKit"    = a robot that draws text/boxes/lines onto a PDF for you.
 *  - "env vars"  = secret settings (like API keys) kept OUT of the code so
 *                  you don't accidentally publish your password to GitHub.
 *  - "endpoint"  = a URL the server listens on, like a phone extension.
 * ============================================================================
 */

require('dotenv').config();

const express = require('express');
const PDFDocument = require('pdfkit');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// The AI client. It reads your secret key from the .env file — never typed
// into the code, so you don't accidentally leak it to the internet.
const genAI = new GoogleGenAI({
  apiKey: process.env.AI_API_KEY,
});

app.use(express.json({ limit: '2mb' }));

// ----------------------------------------------------------------------------
// THEME DEFINITIONS — controls colors used in the generated PDF
// ----------------------------------------------------------------------------
const THEMES = {
  'Classic Executive': {
    accent: '#1a1a1a',
    subtext: '#555555',
    divider: '#cccccc',
    headerFont: 'Times-Bold',
    bodyFont: 'Times-Roman',
  },
  'Modern Minimal': {
    accent: '#2b3a55',
    subtext: '#5a6472',
    divider: '#d8dde3',
    headerFont: 'Helvetica-Bold',
    bodyFont: 'Helvetica',
  },
  'Tech Minimalist': {
    accent: '#0f766e',
    subtext: '#475569',
    divider: '#cbd5d6',
    headerFont: 'Courier-Bold',
    bodyFont: 'Helvetica',
  },
};

function getTheme(name) {
  return THEMES[name] || THEMES['Modern Minimal'];
}

// ----------------------------------------------------------------------------
// FRONTEND — one big HTML page, Tailwind via CDN, vanilla JS for the fetch call
// ----------------------------------------------------------------------------
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Resume Maker — Executive ATS Resumes</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: 'Inter', system-ui, sans-serif; }
  ::selection { background: #334155; color: white; }
  .glow-border:focus { box-shadow: 0 0 0 2px rgba(203,213,225,0.4); }
  .spinner {
    border: 3px solid rgba(255,255,255,0.15);
    border-top-color: white;
    border-radius: 50%;
    width: 18px; height: 18px;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body class="bg-[#0b0d10] text-slate-200 min-h-screen">

  <div class="max-w-3xl mx-auto px-6 py-14">

    <!-- HERO -->
    <div class="mb-10 text-center">
      <p class="uppercase tracking-[0.3em] text-xs text-slate-500 mb-3">Executive Resume Engine</p>
      <h1 class="text-4xl md:text-5xl font-semibold text-white tracking-tight">
        Turn rough notes into a resume that gets read.
      </h1>
      <p class="text-slate-400 mt-4 max-w-xl mx-auto">
        HRs skim resumes in <span class="text-white font-medium">6 seconds</span>.
        Make yours un-ignorable — and beat the ATS filter while you're at it.
      </p>
    </div>

    <!-- FORM CARD -->
    <div class="bg-[#12151a] border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <form id="resumeForm" class="space-y-6">

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">Full Name</label>
            <input required name="fullName" type="text" placeholder="Jordan Blake"
              class="w-full bg-[#0b0d10] border border-slate-700 rounded-lg px-4 py-2.5 text-white glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">Target Role / Position Title</label>
            <input required name="targetRole" type="text" placeholder="Senior Product Manager"
              class="w-full bg-[#0b0d10] border border-slate-700 rounded-lg px-4 py-2.5 text-white glow-border outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">Email</label>
            <input required name="email" type="email" placeholder="jordan@email.com"
              class="w-full bg-[#0b0d10] border border-slate-700 rounded-lg px-4 py-2.5 text-white glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">Phone</label>
            <input name="phone" type="text" placeholder="+91 98765 43210"
              class="w-full bg-[#0b0d10] border border-slate-700 rounded-lg px-4 py-2.5 text-white glow-border outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">Location</label>
            <input name="location" type="text" placeholder="Mumbai, India"
              class="w-full bg-[#0b0d10] border border-slate-700 rounded-lg px-4 py-2.5 text-white glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-slate-400 mb-1.5">LinkedIn URL</label>
            <input name="linkedin" type="text" placeholder="linkedin.com/in/jordanblake"
              class="w-full bg-[#0b0d10] border border-slate-700 rounded-lg px-4 py-2.5 text-white glow-border outline-none" />
          </div>
        </div>

        <div>
          <label class="block text-sm text-slate-400 mb-1.5">
            Raw Work Experience, Achievements &amp; Plain Keywords
          </label>
          <textarea required name="rawExperience" rows="7" placeholder="e.g. managed a team of 5, helped launch app, good at excel, handled customer complaints, ran social media page, in charge of budget for events..."
            class="w-full bg-[#0b0d10] border border-slate-700 rounded-lg px-4 py-3 text-white glow-border outline-none"></textarea>
          <p class="text-xs text-slate-500 mt-1.5">Dump it in plain English. We'll do the fancy talk for you.</p>
        </div>

        <div>
          <label class="block text-sm text-slate-400 mb-2">Theme</label>
          <div class="grid grid-cols-3 gap-3">
            <label class="theme-option cursor-pointer">
              <input type="radio" name="theme" value="Classic Executive" class="peer hidden" checked />
              <div class="peer-checked:border-white peer-checked:bg-slate-800/60 border border-slate-700 rounded-lg py-3 text-center text-sm transition">
                Classic Executive
              </div>
            </label>
            <label class="theme-option cursor-pointer">
              <input type="radio" name="theme" value="Modern Minimal" class="peer hidden" />
              <div class="peer-checked:border-white peer-checked:bg-slate-800/60 border border-slate-700 rounded-lg py-3 text-center text-sm transition">
                Modern Minimal
              </div>
            </label>
            <label class="theme-option cursor-pointer">
              <input type="radio" name="theme" value="Tech Minimalist" class="peer hidden" />
              <div class="peer-checked:border-white peer-checked:bg-slate-800/60 border border-slate-700 rounded-lg py-3 text-center text-sm transition">
                Tech Minimalist
              </div>
            </label>
          </div>
        </div>

        <!-- PRICING / PAYMENT PANEL -->
        <div class="mt-8 rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800/40 to-transparent p-6">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-xs uppercase tracking-widest text-slate-400">Limited Offer · 80% OFF</p>
              <p class="text-3xl font-semibold text-white mt-1">
                ₹49 <span class="text-base font-normal text-slate-500 line-through ml-2">₹249</span>
              </p>
            </div>
            <div class="text-right text-xs text-slate-400 space-y-1">
              <p>✓ Executive-level action verbs</p>
              <p>✓ Beats ATS keyword filters</p>
              <p>✓ 1-click crisp PDF download</p>
            </div>
          </div>
          <button type="submit" id="submitBtn"
            class="w-full bg-white text-black font-medium rounded-lg py-3.5 hover:bg-slate-200 transition flex items-center justify-center gap-2">
            <span id="btnLabel">Unlock Full ATS Resume for ₹49</span>
          </button>
          <p class="text-center text-xs text-slate-500 mt-3">Secure checkout · Simulated payment for this demo</p>
        </div>

        <p id="errorMsg" class="text-red-400 text-sm hidden"></p>
      </form>
    </div>

    <p class="text-center text-xs text-slate-600 mt-8">
      Your data is used only to generate your resume. Nothing is stored.
    </p>
  </div>

<script>
  const form = document.getElementById('resumeForm');
  const btn = document.getElementById('submitBtn');
  const btnLabel = document.getElementById('btnLabel');
  const errorMsg = document.getElementById('errorMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');

    const formData = new FormData(form);
    const payload = {
      fullName: formData.get('fullName'),
      targetRole: formData.get('targetRole'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      linkedin: formData.get('linkedin'),
      rawExperience: formData.get('rawExperience'),
      theme: formData.get('theme'),
      // Simulated Razorpay success payload — in a real integration this
      // comes back from Razorpay's checkout widget after actual payment.
      razorpay_payment_id: 'pay_sim_' + Date.now(),
      razorpay_order_id: 'order_sim_' + Date.now(),
      razorpay_signature: 'sim_signature',
    };

    btn.disabled = true;
    btnLabel.innerHTML = '<span class="spinner"></span> Generating your resume...';

    try {
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
      a.download = (payload.fullName || 'resume').replace(/\\s+/g, '_') + '_Resume.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();

      btnLabel.textContent = 'Downloaded ✓ — Unlock Another for ₹49';
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.classList.remove('hidden');
      btnLabel.textContent = 'Unlock Full ATS Resume for ₹49';
    } finally {
      btn.disabled = false;
    }
  });
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.type('html').send(HTML_PAGE);
});

// ----------------------------------------------------------------------------
// AI PROMPT LOGIC
// ----------------------------------------------------------------------------
// We ask the model to return STRICT JSON (not prose) so the PDF renderer
// downstream can lay text out predictably without guessing where sentences
// start and stop.
const SYSTEM_PROMPT = `You are an elite executive resume writer and ATS (Applicant Tracking System) optimization specialist.

You will be given a candidate's raw, plain-English notes about their work experience, along with their target role. Transform this into a polished, ATS-friendly resume.

STRICT RULES:
1. VOCABULARY: Replace weak or generic verbs with distinct, executive-level action verbs. For example:
   - "managed" -> "orchestrated", "directed", "spearheaded" (never use the same verb twice)
   - "helped" -> "spearheaded", "championed", "enabled"
   - "good at" / "skilled at" -> "demonstrated proficiency in", "possesses deep expertise in"
   - "worked on" -> "engineered", "architected", "drove"
   - "in charge of" -> "owned", "led", "administered"
2. ZERO REPETITION: No two bullet points across the entire resume may start with, or prominently reuse, the same action verb or descriptor. Vary sentence structure too.
3. QUANTIFIABLE METRICS: Wherever the raw input implies scale, impact, or improvement but gives no number, insert a bracketed placeholder like "[X]%", "[X]+ team members", "[X]K users", or "$[X]K" so the candidate can fill in a real figure later. Do NOT invent fake numbers as if they were real data.
4. ATS FORMATTING: Use standard, ATS-parseable section names: SUMMARY, EXPERIENCE, SKILLS, EDUCATION. Keep bullet points concise (ideally under 24 words), front-loaded with the action verb.
5. TONE: Confident, executive, no fluff, no first-person pronouns, no clichés like "team player" or "hard worker" in isolation — reframe them as demonstrated outcomes.
6. Only use information present in or reasonably inferable from the candidate's raw input. Do not fabricate job titles, companies, or dates that were not provided — if a field like company name or dates is missing, omit it or use a neutral placeholder like "[Company Name]" / "[Dates]".

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown fences, no commentary, no leading/trailing text) matching exactly this shape:

{
  "name": "string",
  "targetRole": "string",
  "contact": { "email": "string", "phone": "string", "location": "string", "linkedin": "string" },
  "summary": "2-3 sentence executive summary, string",
  "experience": [
    {
      "title": "string (role title, inferred from raw input or target role if unclear)",
      "org": "string (company/organization if mentioned, else '[Company Name]')",
      "dates": "string (if mentioned, else '[Dates]')",
      "bullets": ["string", "string", "..."]
    }
  ],
  "skills": ["string", "string", "..."],
  "education": [
    { "degree": "string", "institution": "string", "dates": "string" }
  ]
}

If the raw input gives no clear structure to split into multiple jobs/roles, produce a single experience entry that best represents the candidate's described work. If education is not mentioned at all, return an empty array for "education". Every array must contain at least one meaningful, non-empty entry where data exists.`;

function buildUserPrompt(data) {
  return `Candidate raw input:

Full Name: ${data.fullName}
Target Role: ${data.targetRole}
Email: ${data.email}
Phone: ${data.phone || 'N/A'}
Location: ${data.location || 'N/A'}
LinkedIn: ${data.linkedin || 'N/A'}

Raw Work Experience, Achievements & Plain Keywords:
"""
${data.rawExperience}
"""

Transform this into the strict JSON resume format described in your instructions. Return ONLY the JSON object.`;
}

function safeJSONParse(text) {
  // The model is told to return raw JSON, but we defensively strip code
  // fences in case it wraps the output in ```json ... ``` anyway.
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
      maxOutputTokens: 2000,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('AI returned no usable content.');
  }

  return safeJSONParse(text);
}

// ----------------------------------------------------------------------------
// SIMULATED PAYMENT VALIDATION
// ----------------------------------------------------------------------------
// In a real Razorpay integration, you'd verify razorpay_signature server-side
// using crypto.createHmac('sha256', RAZORPAY_KEY_SECRET) against the order id
// + payment id, per Razorpay's docs. Here we simulate a successful check.
function verifySimulatedPayment(body) {
  const hasFields =
    body.razorpay_payment_id &&
    body.razorpay_order_id &&
    body.razorpay_signature;

  return Boolean(hasFields); // pretend-verified; always true if fields exist
}

// ----------------------------------------------------------------------------
// PDF RENDERING
// ----------------------------------------------------------------------------
const MARGIN = 36; // 0.5 inch, since PDFKit measures in points (72 per inch)
const PAGE_WIDTH = 612; // US Letter width in points
const PAGE_HEIGHT = 792; // US Letter height in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - MARGIN;

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > BOTTOM_LIMIT) {
    doc.addPage({ size: 'LETTER', margin: MARGIN });
  }
}

function drawDivider(doc, theme) {
  ensureSpace(doc, 10);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .lineWidth(0.75)
    .strokeColor(theme.divider)
    .stroke();
  doc.moveDown(0.6);
}

function drawSectionHeader(doc, theme, title) {
  ensureSpace(doc, 26);
  doc
    .font(theme.headerFont)
    .fontSize(11)
    .fillColor(theme.accent)
    .text(title.toUpperCase(), MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      characterSpacing: 1.2,
    });
  doc.moveDown(0.3);
  drawDivider(doc, theme);
}

function drawBullet(doc, theme, text) {
  const bulletChar = '—';
  const indent = 12;
  const textWidth = CONTENT_WIDTH - indent;

  doc.font(theme.bodyFont).fontSize(10);
  const estimatedHeight = doc.heightOfString(text, { width: textWidth }) + 4;
  ensureSpace(doc, estimatedHeight);

  const startY = doc.y;
  doc
    .fillColor(theme.accent)
    .text(bulletChar, MARGIN, startY, { width: indent, continued: false });
  doc
    .fillColor('#222222')
    .text(text, MARGIN + indent, startY, { width: textWidth });
  doc.moveDown(0.25);
}

function generatePdfBuffer(resume, themeName) {
  return new Promise((resolve, reject) => {
    const theme = getTheme(themeName);
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---------- HEADER ----------
    doc
      .font(theme.headerFont)
      .fontSize(22)
      .fillColor(theme.accent)
      .text(resume.name || 'Candidate Name', MARGIN, MARGIN, { width: CONTENT_WIDTH });

    doc
      .font(theme.bodyFont)
      .fontSize(12)
      .fillColor(theme.subtext)
      .text(resume.targetRole || '', { width: CONTENT_WIDTH });

    doc.moveDown(0.4);

    const contactParts = [
      resume.contact?.email,
      resume.contact?.phone,
      resume.contact?.location,
      resume.contact?.linkedin,
    ].filter(Boolean);

    doc
      .font(theme.bodyFont)
      .fontSize(9.5)
      .fillColor(theme.subtext)
      .text(contactParts.join('   ·   '), { width: CONTENT_WIDTH });

    doc.moveDown(0.6);
    drawDivider(doc, theme);

    // ---------- SUMMARY ----------
    if (resume.summary) {
      drawSectionHeader(doc, theme, 'Summary');
      doc
        .font(theme.bodyFont)
        .fontSize(10.5)
        .fillColor('#222222')
        .text(resume.summary, { width: CONTENT_WIDTH, lineGap: 2 });
      doc.moveDown(0.8);
    }

    // ---------- EXPERIENCE ----------
    if (Array.isArray(resume.experience) && resume.experience.length > 0) {
      drawSectionHeader(doc, theme, 'Experience');

      resume.experience.forEach((job, idx) => {
        ensureSpace(doc, 34);

        doc
          .font(theme.headerFont)
          .fontSize(11.5)
          .fillColor('#111111')
          .text(job.title || 'Role', MARGIN, doc.y, { continued: false, width: CONTENT_WIDTH });

        const orgLine = [job.org, job.dates].filter(Boolean).join('   ·   ');
        if (orgLine) {
          doc
            .font(theme.bodyFont)
            .fontSize(9.5)
            .fillColor(theme.subtext)
            .text(orgLine, { width: CONTENT_WIDTH });
        }

        doc.moveDown(0.3);

        (job.bullets || []).forEach((bullet) => {
          drawBullet(doc, theme, bullet);
        });

        if (idx < resume.experience.length - 1) {
          doc.moveDown(0.4);
        }
      });

      doc.moveDown(0.6);
    }

    // ---------- SKILLS ----------
    if (Array.isArray(resume.skills) && resume.skills.length > 0) {
      drawSectionHeader(doc, theme, 'Skills');
      doc
        .font(theme.bodyFont)
        .fontSize(10)
        .fillColor('#222222')
        .text(resume.skills.join('   •   '), { width: CONTENT_WIDTH, lineGap: 3 });
      doc.moveDown(0.8);
    }

    // ---------- EDUCATION ----------
    if (Array.isArray(resume.education) && resume.education.length > 0) {
      drawSectionHeader(doc, theme, 'Education');
      resume.education.forEach((edu) => {
        ensureSpace(doc, 26);
        doc
          .font(theme.headerFont)
          .fontSize(10.5)
          .fillColor('#111111')
          .text(edu.degree || '', MARGIN, doc.y, { width: CONTENT_WIDTH });

        const eduLine = [edu.institution, edu.dates].filter(Boolean).join('   ·   ');
        if (eduLine) {
          doc
            .font(theme.bodyFont)
            .fontSize(9.5)
            .fillColor(theme.subtext)
            .text(eduLine, { width: CONTENT_WIDTH });
        }
        doc.moveDown(0.4);
      });
    }

    doc.end();
  });
}

// ----------------------------------------------------------------------------
// ROUTE: /api/generate-resume
// ----------------------------------------------------------------------------
app.post('/api/generate-resume', async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.fullName || !body.targetRole || !body.email || !body.rawExperience) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const paymentOk = verifySimulatedPayment(body);
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

    const pdfBuffer = await generatePdfBuffer(resumeContent, body.theme);

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
  console.log(`AI Resume Maker running at http://localhost:${PORT}`);
});
