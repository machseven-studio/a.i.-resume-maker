/**
 * ============================================================================
 *  AI RESUME MAKER — single-file Node.js + Express app
 *  (Google Gemini API + Live Razorpay Payment Verification)
 * ============================================================================
 */

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const Razorpay = require('razorpay');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google Gemini SDK
const genAI = new GoogleGenAI({
  apiKey: process.env.AI_API_KEY,
});

// Initialize Razorpay SDK
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.use(express.json({ limit: '2mb' }));

// ----------------------------------------------------------------------------
// PDF THEME
// ----------------------------------------------------------------------------
const ELEGANT_GOLD_THEME = {
  pageBg: '#F7F1E6',
  accent: '#A5824F',
  divider: '#C9A876',
  heading: '#2A2018',
  subtext: '#6B5F4F',
  body: '#3A3226',
  headerFont: 'Times-Bold',
  bodyFont: 'Times-Roman',
};

function getTheme() {
  return ELEGANT_GOLD_THEME;
}

// ----------------------------------------------------------------------------
// FRONTEND — Standard HTML Page with Razorpay Checkout Modal
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
</style>
</head>
<body class="min-h-screen">

  <div class="max-w-3xl mx-auto px-6 py-14">

    <!-- HERO SECTION -->
    <div class="mb-14 text-center">
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
          <p class="text-parchment text-sm leading-relaxed" style="font-family: Georgia, serif;">Your resume will be customised with <span class="text-gold font-semibold">executive-grade</span> raised lettering, <span class="text-gold font-semibold">premium golden edges</span> for the highlights, and a <span class="text-gold font-semibold">neat layout</span> cleaner than your excuses for being unemployed.</p>
        </div>
        <div class="flex gap-3">
          <span class="text-gold font-medium text-sm" style="font-family: Georgia, serif;">4.</span>
          <p class="text-parchment text-sm leading-relaxed" style="font-family: Georgia, serif;">Your resume will be laden with slick margins <span class="uppercase">so precise</span>, even the pickiest recruiter won't find a flaw.</p>
        </div>
      </div>

      <h2 class="font-display text-2xl md:text-4xl font-semibold text-parchment leading-snug max-w-2xl mx-auto">
        Give us <em>3 minutes</em> of your time, and we will give you a <em class="text-gold font-semibold">polished</em> resume which is <strong>BOUND</strong> to impress the job recruiters.
      </h2>
    </div>

    <!-- FORM CARD -->
    <div class="bg-wineLight/40 border border-hairline rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
      <form id="resumeForm" class="space-y-6">

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Full Name</label>
            <input required name="fullName" type="text" placeholder="Jordan Blake"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Target Role / Position Title</label>
            <input required name="targetRole" type="text" placeholder="Senior Product Manager"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Email</label>
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

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Company Name</label>
            <input name="companyName" type="text" placeholder="Northlane Studio"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
          <div>
            <label class="block text-sm text-parchment/70 mb-1.5">Employment Dates</label>
            <input name="employmentDates" type="text" placeholder="2022 – Present"
              class="w-full bg-wine border border-hairline rounded-lg px-4 py-2.5 text-parchment glow-border outline-none" />
          </div>
        </div>

        <div>
          <label class="block text-sm text-parchment/70 mb-1.5">
            Raw Work Experience, Achievements &amp; Plain Keywords
          </label>
          <textarea required name="rawExperience" rows="7" placeholder="e.g. managed a team of 5, helped launch app, good at excel, handled customer complaints, ran social media page, in charge of budget for events..."
            class="w-full bg-wine border border-hairline rounded-lg px-4 py-3 text-parchment glow-border outline-none"></textarea>
          <p class="text-xs text-parchment/50 mt-1.5">Dump it in plain English. We'll do the fancy talk for you.</p>
        </div>

        <div class="text-center font-display text-parchment leading-relaxed pt-2">
          <p class="text-lg mb-1">You're not paying for a &quot;PDF&quot;. You're paying to <em>stop getting filtered out</em>.</p>
          <p class="text-lg mb-1">Most people skip this step, and wonder why they're still <strong>UNEMPLOYED</strong>.</p>
          <p class="text-lg">Fortunately, you and I, we both know that you're smart enough to not commit that mistake :P.</p>
          <p class="italic text-gold text-base mt-4">It's a win-win scenario, my friend. Go ace that job interview like a person who has already been qualified 😎</p>
        </div>

        <div class="mt-8 rounded-2xl border border-hairline bg-wine/60 p-6">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div>
              <p class="text-xs uppercase tracking-widest text-gold">Limited Offer · 80% OFF</p>
              <p class="text-3xl font-display font-semibold text-parchment mt-1">
                ₹49 <span class="text-base font-normal text-parchment/40 line-through ml-2">₹249</span>
              </p>
            </div>
            <div class="text-right text-xs text-parchment/70 space-y-1">
              <p>✓ Executive-level action verbs</p>
              <p>✓ Beats ATS keyword filters</p>
              <p>✓ 1-click crisp PDF download</p>
            </div>
          </div>
          <button type="submit" id="submitBtn"
            class="w-full bg-gold text-wine font-medium rounded-lg py-3.5 hover:bg-parchment transition flex items-center justify-center gap-2">
            <span id="btnLabel">Unlock Full ATS Résumé for ₹49</span>
          </button>
          <p class="text-center text-xs text-parchment/50 mt-3">256-bit encrypted secure checkout via Razorpay</p>
        </div>

        <p id="errorMsg" class="text-red-300 text-sm hidden"></p>
      </form>
    </div>

    <p class="text-center text-xs text-parchment/40 mt-8">
      Your data is used only to generate your résumé. Nothing is stored.
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
    const formFields = {
      fullName: formData.get('fullName'),
      targetRole: formData.get('targetRole'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      linkedin: formData.get('linkedin'),
      companyName: formData.get('companyName'),
      employmentDates: formData.get('employmentDates'),
      rawExperience: formData.get('rawExperience'),
    };

    btn.disabled = true;
    btnLabel.innerHTML = '<span class="spinner"></span> Initiating checkout...';

    try {
      // Step 1: Create live order on backend
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!orderRes.ok) throw new Error('Could not initialize payment order.');
      const orderData = await orderRes.json();

      // Step 2: Configure Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AI Résumé Maker",
        description: "ATS Résumé Generation",
        order_id: orderData.orderId,
        prefill: {
          name: formFields.fullName,
          email: formFields.email,
          contact: formFields.phone,
        },
        theme: {
          color: "#4A1620"
        },
        handler: async function (response) {
          btnLabel.innerHTML = '<span class="spinner"></span> Verifying payment & generating PDF...';

          try {
            // Step 3: Trigger PDF generation with verified payment signature
            const pdfRes = await fetch('/api/generate-resume', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...formFields,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!pdfRes.ok) {
              const err = await pdfRes.json().catch(() => ({ error: 'Payment verification failed.' }));
              throw new Error(err.error || 'Failed to generate résumé.');
            }

            const blob = await pdfRes.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');

            const a = document.createElement('a');
            a.href = url;
            a.download = (formFields.fullName || 'resume').replace(/\\s+/g, '_') + '_Resume.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();

            btnLabel.textContent = 'Downloaded ✓ — Unlock Another for ₹49';
          } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
            btnLabel.textContent = 'Unlock Full ATS Résumé for ₹49';
          } finally {
            btn.disabled = false;
          }
        },
        modal: {
          ondismiss: function() {
            btn.disabled = false;
            btnLabel.textContent = 'Unlock Full ATS Résumé for ₹49';
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.classList.remove('hidden');
      btnLabel.textContent = 'Unlock Full ATS Résumé for ₹49';
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
// ROUTE: /api/create-order (Creates Live Razorpay Order)
// ----------------------------------------------------------------------------
app.post('/api/create-order', async (req, res) => {
  try {
    const options = {
      amount: 4900, // ₹49 in paise
      currency: "INR",
      receipt: "rcpt_" + Date.now().toString().slice(-8),
    };

    const order = await razorpay.orders.create(options);
    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    return res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

// ----------------------------------------------------------------------------
// AI PROMPT & PARSING LOGIC
// ----------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an elite executive résumé writer, trained in Oxford-level formal English, and an ATS (Applicant Tracking System) optimization specialist.

You will be given a candidate's raw, plain-English notes about their work experience, along with their target role. Transform this into a polished, ATS-friendly résumé written in sophisticated, formal register — the kind of prose a top-tier executive search consultancy would produce.

STRICT RULES:
1. VOCABULARY: Use precise, elevated, distinct action verbs and descriptors throughout — the register of formal British/Oxford English, not casual American business jargon.
2. ZERO REPETITION: No word of substance (verb, adjective, or noun descriptor) may be reused anywhere else in the document.
3. MAXIMISE THE GIVEN MATERIAL: Extract every plausible implication from what is provided.
4. NO INVENTED METRICS, NO PLACEHOLDER BRACKETS: Never insert bracketed placeholders such as "[X]%".
5. ATS FORMATTING: Use standard, machine-parseable section names: SUMMARY, EXPERIENCE, SKILLS, EDUCATION.
6. TONE: Formal, commanding, wholly free of cliché and first-person pronouns.
7. NEVER USE PLACEHOLDER TEXT: If a field is missing, return an EMPTY STRING ("").

OUTPUT FORMAT:
Return ONLY valid JSON matching exactly this shape:

{
  "name": "string",
  "targetRole": "string",
  "contact": { "email": "string", "phone": "string", "location": "string", "linkedin": "string" },
  "summary": "string",
  "experience": [
    {
      "title": "string",
      "org": "string",
      "dates": "string",
      "bullets": ["string"]
    }
  ],
  "skills": ["string"],
  "education": [
    { "degree": "string", "institution": "string", "dates": "string" }
  ]
}`;

function buildUserPrompt(data) {
  return `Candidate raw input:

Full Name: ${data.fullName}
Target Role: ${data.targetRole}
Email: ${data.email}
Phone: ${data.phone || 'N/A'}
Location: ${data.location || 'N/A'}
LinkedIn: ${data.linkedin || 'N/A'}
Company Name: ${data.companyName || 'Not provided'}
Employment Dates: ${data.employmentDates || 'Not provided'}

Raw Work Experience, Achievements & Plain Keywords:
"""
${data.rawExperience}
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
    model: 'gemini-2.5-flash',
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
// LIVE RAZORPAY SIGNATURE VERIFICATION
// ----------------------------------------------------------------------------
function verifyRazorpayPayment(body) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return generatedSignature === razorpay_signature;
}

// ----------------------------------------------------------------------------
// PDF GENERATION LOGIC
// ----------------------------------------------------------------------------
const MARGIN = 36;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - MARGIN;

function paintPageBackground(doc, theme) {
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(theme.pageBg);
  doc.restore();
}

function ensureSpace(doc, theme, neededHeight) {
  if (doc.y + neededHeight > BOTTOM_LIMIT) {
    doc.addPage({ size: 'LETTER', margin: MARGIN });
    paintPageBackground(doc, theme);
  }
}

function drawDivider(doc, theme, fullWidth = true) {
  ensureSpace(doc, theme, 10);
  const width = fullWidth ? CONTENT_WIDTH : 60;
  const startX = fullWidth ? MARGIN : (PAGE_WIDTH - width) / 2;
  doc
    .moveTo(startX, doc.y)
    .lineTo(startX + width, doc.y)
    .lineWidth(fullWidth ? 0.75 : 1.5)
    .strokeColor(theme.divider)
    .stroke();
  doc.moveDown(0.6);
}

function drawSectionHeader(doc, theme, title) {
  ensureSpace(doc, theme, 26);
  doc
    .font(theme.headerFont)
    .fontSize(11)
    .fillColor(theme.accent)
    .text(title.toUpperCase(), MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      characterSpacing: 1.5,
    });
  doc.moveDown(0.3);
  drawDivider(doc, theme, true);
}

function drawBullet(doc, theme, text) {
  const bulletChar = '—';
  const indent = 12;
  const textWidth = CONTENT_WIDTH - indent;

  doc.font(theme.bodyFont).fontSize(10);
  const estimatedHeight = doc.heightOfString(text, { width: textWidth }) + 4;
  ensureSpace(doc, theme, estimatedHeight);

  const startY = doc.y;
  doc
    .fillColor(theme.accent)
    .text(bulletChar, MARGIN, startY, { width: indent, continued: false });
  doc
    .fillColor(theme.body)
    .text(text, MARGIN + indent, startY, { width: textWidth });
  doc.moveDown(0.25);
}

function generatePdfBuffer(resume) {
  return new Promise((resolve, reject) => {
    const theme = getTheme();
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    paintPageBackground(doc, theme);

    // HEADER
    doc
      .font(theme.headerFont)
      .fontSize(22)
      .fillColor(theme.heading)
      .text(resume.name || 'Candidate Name', MARGIN, MARGIN, {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    doc
      .font(theme.bodyFont)
      .fontSize(11.5)
      .fillColor(theme.subtext)
      .text(resume.targetRole || '', {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    doc.moveDown(0.35);

    const contactParts = [
      resume.contact?.email,
      resume.contact?.phone,
      resume.contact?.location,
      resume.contact?.linkedin,
    ].filter(Boolean);

    doc
      .font(theme.bodyFont)
      .fontSize(9)
      .fillColor(theme.subtext)
      .text(contactParts.join('   |   '), {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    doc.moveDown(0.5);
    drawDivider(doc, theme, false);

    // SUMMARY
    if (resume.summary) {
      drawSectionHeader(doc, theme, 'Summary');
      doc
        .font(theme.bodyFont)
        .fontSize(10.5)
        .fillColor(theme.body)
        .text(resume.summary, { width: CONTENT_WIDTH, lineGap: 2 });
      doc.moveDown(0.8);
    }

    // EXPERIENCE
    if (Array.isArray(resume.experience) && resume.experience.length > 0) {
      drawSectionHeader(doc, theme, 'Experience');

      resume.experience.forEach((job, idx) => {
        ensureSpace(doc, theme, 34);

        doc
          .font(theme.headerFont)
          .fontSize(11.5)
          .fillColor(theme.heading)
          .text(job.title || 'Role', MARGIN, doc.y, { continued: false, width: CONTENT_WIDTH });

        const orgLine = [job.org, job.dates].filter(Boolean).join('   |   ');
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

    // SKILLS
    if (Array.isArray(resume.skills) && resume.skills.length > 0) {
      drawSectionHeader(doc, theme, 'Skills');
      doc
        .font(theme.bodyFont)
        .fontSize(10)
        .fillColor(theme.body)
        .text(resume.skills.join('   •   '), { width: CONTENT_WIDTH, lineGap: 3 });
      doc.moveDown(0.8);
    }

    // EDUCATION
    if (Array.isArray(resume.education) && resume.education.length > 0) {
      drawSectionHeader(doc, theme, 'Education');
      resume.education.forEach((edu) => {
        ensureSpace(doc, theme, 26);
        doc
          .font(theme.headerFont)
          .fontSize(10.5)
          .fillColor(theme.heading)
          .text(edu.degree || '', MARGIN, doc.y, { width: CONTENT_WIDTH });

        const eduLine = [edu.institution, edu.dates].filter(Boolean).join('   |   ');
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
// ROUTE: /api/generate-resume (Verifies HMAC & Streams PDF)
// ----------------------------------------------------------------------------
app.post('/api/generate-resume', async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.fullName || !body.targetRole || !body.email || !body.rawExperience) {
      return res.status(400).json({ error: 'Missing required input fields.' });
    }

    // Live Razorpay HMAC Verification
    const isPaymentValid = verifyRazorpayPayment(body);
    if (!isPaymentValid) {
      return res.status(402).json({ error: 'Payment verification failed. Invalid Razorpay signature.' });
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
    console.error('Error processing resume:', err);
    return res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Résumé Maker running on port ${PORT}`);
});