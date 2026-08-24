require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const Razorpay = require('razorpay');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google Gen AI
const genAI = new GoogleGenAI({
  apiKey: process.env.AI_API_KEY,
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
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
// FRONTEND WITH REAL RAZORPAY CHECKOUT SCRIPT
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
</style>
</head>
<body class="min-h-screen">

  <div class="max-w-3xl mx-auto px-6 py-14">
    <div class="mb-14 text-center">
      <p class="uppercase tracking-[0.3em] text-xs text-gold mb-4">AI Résumé Maker</p>
      <h1 class="headline-cream text-2xl md:text-4xl font-semibold tracking-tight leading-tight max-w-2xl mx-auto">
        Executive ATS Résumé Builder
      </h1>
      <p class="font-display italic text-gold text-base md:text-lg mt-4">
        Transform raw notes into immaculate Oxford-level executive English.
      </p>
    </div>

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
            Raw Work Experience &amp; Keywords
          </label>
          <textarea required name="rawExperience" rows="6" placeholder="Managed team of 5, launched app..."
            class="w-full bg-wine border border-hairline rounded-lg px-4 py-3 text-parchment glow-border outline-none"></textarea>
        </div>

        <div class="mt-8 rounded-2xl border border-hairline bg-wine/60 p-6">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div>
              <p class="text-xs uppercase tracking-widest text-gold">Limited Offer</p>
              <p class="text-3xl font-display font-semibold text-parchment mt-1">
                ₹49 <span class="text-base font-normal text-parchment/40 line-through ml-2">₹249</span>
              </p>
            </div>
          </div>
          <button type="submit" id="submitBtn"
            class="w-full bg-gold text-wine font-medium rounded-lg py-3.5 hover:bg-parchment transition flex items-center justify-center gap-2">
            <span id="btnLabel">Unlock Full ATS Résumé for ₹49</span>
          </button>
        </div>

        <p id="errorMsg" class="text-red-300 text-sm hidden"></p>
      </form>
    </div>
  </div>

<script>
  const form = document.getElementById('resumeForm');
  const btn = document.getElementById('submitBtn');
  const btnLabel = document.getElementById('btnLabel');
  const errorMsg = document.getElementById('errorMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');
    btn.disabled = true;
    btnLabel.innerHTML = '<span class="spinner"></span> Preparing Checkout...';

    const formData = new FormData(form);
    const formValues = {
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

    try {
      // 1. Create Razorpay order via backend
      const orderRes = await fetch('/api/create-order', { method: 'POST' });
      if (!orderRes.ok) throw new Error('Could not initiate payment order.');
      const order = await orderRes.json();

      // 2. Open Razorpay Modal
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "AI Résumé Maker",
        description: "Executive ATS Résumé",
        order_id: order.id,
        prefill: {
          name: formValues.fullName,
          email: formValues.email,
          contact: formValues.phone
        },
        handler: async function (response) {
          btnLabel.innerHTML = '<span class="spinner"></span> Generating PDF...';
          
          // 3. Send payload + signature proof to generator
          const payload = {
            ...formValues,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          };

          const pdfRes = await fetch('/api/generate-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!pdfRes.ok) {
            const err = await pdfRes.json().catch(() => ({ error: 'Generation failed.' }));
            throw new Error(err.error || 'Generation failed.');
          }

          const blob = await pdfRes.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');

          const a = document.createElement('a');
          a.href = url;
          a.download = (formValues.fullName || 'resume').replace(/\\s+/g, '_') + '_Resume.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();

          btnLabel.textContent = 'Downloaded ✓ — Unlock Another for ₹49';
          btn.disabled = false;
        },
        modal: {
          ondismiss: function() {
            btnLabel.textContent = 'Unlock Full ATS Résumé for ₹49';
            btn.disabled = false;
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
// AI PROMPT LOGIC
// ----------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an elite executive résumé writer, trained in Oxford-level formal English, and an ATS optimization specialist.

Transform the provided details into a polished, ATS-friendly résumé in JSON format.

OUTPUT FORMAT:
Return ONLY valid JSON matching exactly this shape:
{
  "name": "string",
  "targetRole": "string",
  "contact": { "email": "string", "phone": "string", "location": "string", "linkedin": "string" },
  "summary": "2-3 sentence executive summary in formal register, string",
  "experience": [
    {
      "title": "string",
      "org": "string",
      "dates": "string",
      "bullets": ["string", "string"]
    }
  ],
  "skills": ["string", "string"],
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
Company Name: ${data.companyName || ''}
Employment Dates: ${data.employmentDates || ''}

Raw Work Experience:
"""
${data.rawExperience}
"""`;
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
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(formData) }] }],
    config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 4000 },
  });

  if (!response.text) throw new Error('AI returned no usable content.');
  return safeJSONParse(response.text);
}

// ----------------------------------------------------------------------------
// SERVER-SIDE RAZORPAY HMAC-SHA256 VERIFICATION
// ----------------------------------------------------------------------------
function verifyRazorpayPayment(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(orderId + '|' + paymentId);
  const generatedSignature = hmac.digest('hex');
  return generatedSignature === signature;
}

// ----------------------------------------------------------------------------
// PDF RENDERING
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
  doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).lineWidth(fullWidth ? 0.75 : 1.5).strokeColor(theme.divider).stroke();
  doc.moveDown(0.6);
}

function drawSectionHeader(doc, theme, title) {
  ensureSpace(doc, theme, 26);
  doc.font(theme.headerFont).fontSize(11).fillColor(theme.accent).text(title.toUpperCase(), MARGIN, doc.y, { width: CONTENT_WIDTH, characterSpacing: 1.5 });
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
  doc.fillColor(theme.accent).text(bulletChar, MARGIN, startY, { width: indent, continued: false });
  doc.fillColor(theme.body).text(text, MARGIN + indent, startY, { width: textWidth });
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

    doc.font(theme.headerFont).fontSize(22).fillColor(theme.heading).text(resume.name || 'Candidate Name', MARGIN, MARGIN, { width: CONTENT_WIDTH, align: 'center' });
    doc.font(theme.bodyFont).fontSize(11.5).fillColor(theme.subtext).text(resume.targetRole || '', { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(0.35);

    const contactParts = [resume.contact?.email, resume.contact?.phone, resume.contact?.location, resume.contact?.linkedin].filter(Boolean);
    doc.font(theme.bodyFont).fontSize(9).fillColor(theme.subtext).text(contactParts.join('   |   '), { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(0.5);
    drawDivider(doc, theme, false);

    if (resume.summary) {
      drawSectionHeader(doc, theme, 'Summary');
      doc.font(theme.bodyFont).fontSize(10.5).fillColor(theme.body).text(resume.summary, { width: CONTENT_WIDTH, lineGap: 2 });
      doc.moveDown(0.8);
    }

    if (Array.isArray(resume.experience) && resume.experience.length > 0) {
      drawSectionHeader(doc, theme, 'Experience');
      resume.experience.forEach((job, idx) => {
        ensureSpace(doc, theme, 34);
        doc.font(theme.headerFont).fontSize(11.5).fillColor(theme.heading).text(job.title || 'Role', MARGIN, doc.y, { width: CONTENT_WIDTH });
        const orgLine = [job.org, job.dates].filter(Boolean).join('   |   ');
        if (orgLine) doc.font(theme.bodyFont).fontSize(9.5).fillColor(theme.subtext).text(orgLine, { width: CONTENT_WIDTH });
        doc.moveDown(0.3);
        (job.bullets || []).forEach((bullet) => drawBullet(doc, theme, bullet));
        if (idx < resume.experience.length - 1) doc.moveDown(0.4);
      });
      doc.moveDown(0.6);
    }

    if (Array.isArray(resume.skills) && resume.skills.length > 0) {
      drawSectionHeader(doc, theme, 'Skills');
      doc.font(theme.bodyFont).fontSize(10).fillColor(theme.body).text(resume.skills.join('   •   '), { width: CONTENT_WIDTH, lineGap: 3 });
      doc.moveDown(0.8);
    }

    if (Array.isArray(resume.education) && resume.education.length > 0) {
      drawSectionHeader(doc, theme, 'Education');
      resume.education.forEach((edu) => {
        ensureSpace(doc, theme, 26);
        doc.font(theme.headerFont).fontSize(10.5).fillColor(theme.heading).text(edu.degree || '', MARGIN, doc.y, { width: CONTENT_WIDTH });
        const eduLine = [edu.institution, edu.dates].filter(Boolean).join('   |   ');
        if (eduLine) doc.font(theme.bodyFont).fontSize(9.5).fillColor(theme.subtext).text(eduLine, { width: CONTENT_WIDTH });
        doc.moveDown(0.4);
      });
    }

    doc.end();
  });
}

// ----------------------------------------------------------------------------
// ROUTE: /api/create-order
// ----------------------------------------------------------------------------
app.post('/api/create-order', async (req, res) => {
  try {
    const options = {
      amount: 4900, // ₹49 in paise
      currency: 'INR',
      receipt: 'receipt_' + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    return res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    return res.status(500).json({ error: 'Failed to initiate order.' });
  }
});

// ----------------------------------------------------------------------------
// ROUTE: /api/generate-resume
// ----------------------------------------------------------------------------
app.post('/api/generate-resume', async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.fullName || !body.targetRole || !body.email || !body.rawExperience) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Verify HMAC payment signature
    const paymentValid = verifyRazorpayPayment(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature
    );

    if (!paymentValid) {
      return res.status(402).json({ error: 'Payment verification failed.' });
    }

    if (!process.env.AI_API_KEY) {
      return res.status(500).json({ error: 'Server misconfiguration: AI_API_KEY is missing.' });
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
    return res.status(500).json({ error: 'Failed to generate resume.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Résumé Maker running on port ${PORT}`);
});