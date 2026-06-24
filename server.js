const express = require('express');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();

app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MODEL_API = process.env.MODEL_API;
const MODEL_ID = process.env.MODEL_ID || 'gemini-2.5-flash';
const USER_KEY = process.env.USER_KEY;
const PORT = process.env.PORT || 3000;

const PROMPT_VERSION = 'guide-intake-v0.5-cta-catalog';

const FIELD_OPTIONS = {
  contentTypes: [
    'Business Intro',
    'Technical Walkthrough',
    'Other'
  ],

  creatorTeams: [
    'CFE',
    'Portfolio Technical Marketing and Platforms',
    'App Services',
    'Ansible BU',
    'AI BU',
    'HCE',
    'HPBU',
    'RHEL BU',
    'Other'
  ],

  quarters: [
    'CY25Q3',
    'CY25Q4',
    'CY26Q1',
    'CY26Q2',
    'CY26Q3',
    'Other'
  ],

  languages: [
    'English',
    'Spanish',
    'Portuguese',
    'German',
    'French',
    'Korean',
    'Chinese',
    'Other'
  ],

  verticals: [
    'No, it is applicable to multiple verticals',
    'Financial Service',
    'Healthcare',
    'Manufacturing',
    'Retail',
    'Telco & Media',
    'Utility'
  ],

  events: [
    'No',
    'Red Hat One',
    'KubeCon',
    'Summit'
  ],

  products: [
    'Red Hat Ansible Automation Platform',
    'Red Hat Enterprise Linux',
    'Red Hat OpenShift',
    'Red Hat Insights',
    'Red Hat OpenShift Virtualization',
    'Red Hat OpenStack',
    'Red Hat Satellite',
    'Other'
  ],

  tdps: [
    'Server/Cloud Operating System',
    'Virtualization',
    'Container Management',
    'Application Platform',
    'Mission Critical IT Automation',
    'AI Platform'
  ],

  salesTactics: [
    'Server/Cloud Operating System - Seamlessly adopt a standardized operating environment',
    'Server/Cloud Operating System - Optimize and secure my operating system',
    'Server/Cloud Operating System - Innovate fast across the hybrid cloud with RHEL',
    'Server/Cloud Operating System - Maximize portability in the Cloud',
    'Virtualization - VM Migration - Targets VMware/ Broadcom customers (on-prem & cloud).',
    'Virtualization - VM Modernization - Targets customers who want a more modern way to virtualize next to legacy virtualization solutions',
    'Container Management - Kubernetes for non-AI 3rd party workloads (e.g. Confluent, SQL Server, SAP, CloudPaks, etc)',
    'Container Management - Kubernetes for AI 3rd party workloads (e.g. H2O.ai, Cloudera, Run.ai, C3 AI, etc)',
    'Container Management - Multicluster management and security at scale for Kubernetes.',
    'Application Platform - Modernize legacy apps & develop net-new cloud-native apps',
    'Application Platform - Streamline application connectivity for the hybrid cloud',
    'Application Platform - Secure the software supply chain and platform operation',
    'Application Platform - Increase developer productivity for kubernetes and hybrid cloud',
    'Mission Critical Automation - Enterprise-wide automation (expanding AAP in the enterprise)',
    'Mission Critical Automation - Standardize on AAP (converting free to enterprise)',
    'Mission Critical Automation - Maximize technology investments (AAP + AI/RHEL/Virt/ISV)',
    'Mission Critical Automation - Network automation',
    'AI Platform - Private AI',
    'AI Platform - Operationalize AI',
    'AI Platform - Multi-architecture AI Deployment',
    'N/A'
  ],

  marketingPrograms: [
    'RHEL Campaign - Build & Deploy on RHEL',
    'RHEL Campaign - Standardize on RHEL',
    'Virtualization Campaign - VM Migration',
    'App Platform Campaign - App Modernization',
    'App Platform Campaign - Platform Engineering',
    'Automation Campaign - Automation Acceleration',
    'Automation Campaign - Getting Started with AAP',
    'Adopt & Scale AI Campaign - Operationalize AI with RHOAI',
    'Adopt & Scale AI Campaign - Getting Started with Gen AI with RHEL AI',
    'N/A'
  ],

  yesNo: [
    'Yes',
    'No'
  ]
};

const CTA_LINK_CATALOG = [
  {
    label: 'All Red Hat product trials',
    url: 'https://www.redhat.com/en/products/trials',
    category: 'trial',
    products: ['general'],
    bestFor: ['trial', 'hands-on evaluation', 'product exploration']
  },
  {
    label: 'Red Hat interactive labs',
    url: 'https://www.redhat.com/en/interactive-labs',
    category: 'labs',
    products: ['general'],
    bestFor: ['hands-on lab', 'technical walkthrough', 'learning']
  },
  {
    label: 'Red Hat Documentation',
    url: 'https://docs.redhat.com/',
    category: 'documentation',
    products: ['general'],
    bestFor: ['documentation', 'configuration', 'implementation guidance']
  },
  {
    label: 'All Red Hat product documentation',
    url: 'https://docs.redhat.com/en/products',
    category: 'documentation',
    products: ['general'],
    bestFor: ['documentation', 'product docs', 'technical reference']
  },
  {
    label: 'Red Hat Developer',
    url: 'https://developers.redhat.com/',
    category: 'developer',
    products: ['general'],
    bestFor: ['developer learning', 'tutorials', 'sandbox', 'getting started']
  },
  {
    label: 'Red Hat Ecosystem Catalog',
    url: 'https://catalog.redhat.com/',
    category: 'ecosystem catalog',
    products: ['general'],
    bestFor: ['certified software', 'certified hardware', 'partner solutions']
  },
  {
    label: 'All Red Hat products',
    url: 'https://www.redhat.com/en/products',
    category: 'product index',
    products: ['general'],
    bestFor: ['product discovery', 'general next step']
  },
  {
    label: 'Red Hat Hybrid Cloud Console',
    url: 'https://www.redhat.com/en/hybrid-cloud-console',
    category: 'console',
    products: ['general', 'Red Hat Insights', 'Red Hat Enterprise Linux', 'Red Hat OpenShift'],
    bestFor: ['management', 'console', 'operations', 'hybrid cloud']
  },

  {
    label: 'Red Hat OpenShift',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift',
    category: 'product page',
    products: ['Red Hat OpenShift'],
    bestFor: ['OpenShift overview', 'application platform', 'containers']
  },
  {
    label: 'Try Red Hat OpenShift',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift/try-it',
    category: 'trial',
    products: ['Red Hat OpenShift', 'Red Hat OpenShift Virtualization'],
    bestFor: ['trial', 'hands-on evaluation', 'OpenShift']
  },
  {
    label: 'Red Hat OpenShift Container Platform trial',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift/ocp-self-managed-trial',
    category: 'trial',
    products: ['Red Hat OpenShift'],
    bestFor: ['self-managed OpenShift trial', 'OpenShift Container Platform']
  },
  {
    label: 'Red Hat Developer Sandbox',
    url: 'https://developers.redhat.com/developer-sandbox',
    category: 'developer sandbox',
    products: ['Red Hat OpenShift'],
    bestFor: ['developer sandbox', 'hands-on OpenShift', 'no setup']
  },
  {
    label: 'Getting started with Red Hat OpenShift',
    url: 'https://developers.redhat.com/products/openshift/getting-started',
    category: 'getting started',
    products: ['Red Hat OpenShift'],
    bestFor: ['developer learning', 'OpenShift tutorials', 'hands-on labs']
  },
  {
    label: 'Red Hat OpenShift documentation',
    url: 'https://docs.redhat.com/en/documentation/openshift_container_platform',
    category: 'documentation',
    products: ['Red Hat OpenShift'],
    bestFor: ['OpenShift docs', 'implementation', 'configuration']
  },
  {
    label: 'Red Hat OpenShift Platform Plus',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift/platform-plus',
    category: 'product page',
    products: ['Red Hat OpenShift'],
    bestFor: ['platform plus', 'security', 'multicluster management']
  },

  {
    label: 'Red Hat OpenShift Virtualization',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift/virtualization',
    category: 'product page',
    products: ['Red Hat OpenShift Virtualization', 'Red Hat OpenShift'],
    bestFor: ['virtualization', 'VM migration', 'VM modernization']
  },
  {
    label: 'Red Hat OpenShift Virtualization learning hub',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift/virtualization/learn',
    category: 'learning hub',
    products: ['Red Hat OpenShift Virtualization', 'Red Hat OpenShift'],
    bestFor: ['OpenShift Virtualization learning', 'VM migration', 'hands-on learning']
  },
  {
    label: 'Red Hat OpenShift Virtualization Engine trial',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift/virtualization-engine/trial',
    category: 'trial',
    products: ['Red Hat OpenShift Virtualization'],
    bestFor: ['virtualization trial', 'VM migration evaluation']
  },

  {
    label: 'Red Hat Ansible Automation Platform',
    url: 'https://www.redhat.com/en/technologies/management/ansible',
    category: 'product page',
    products: ['Red Hat Ansible Automation Platform'],
    bestFor: ['automation', 'Ansible overview', 'enterprise automation']
  },
  {
    label: 'Red Hat Ansible Automation Platform learning hub',
    url: 'https://www.redhat.com/en/technologies/management/ansible/learn',
    category: 'learning hub',
    products: ['Red Hat Ansible Automation Platform'],
    bestFor: ['automation learning', 'labs', 'Ansible getting started']
  },
  {
    label: 'Red Hat Ansible Automation Platform interactive labs',
    url: 'https://www.redhat.com/en/interactive-labs/ansible',
    category: 'labs',
    products: ['Red Hat Ansible Automation Platform'],
    bestFor: ['hands-on automation', 'Ansible labs', 'technical walkthrough']
  },
  {
    label: 'Getting started with Red Hat Ansible Automation Platform',
    url: 'https://developers.redhat.com/products/ansible/getting-started',
    category: 'getting started',
    products: ['Red Hat Ansible Automation Platform'],
    bestFor: ['developer learning', 'Ansible getting started', 'hands-on lab']
  },
  {
    label: 'Ansible on OpenShift',
    url: 'https://www.redhat.com/en/technologies/cloud-computing/openshift/ansible-on-openshift',
    category: 'solution page',
    products: ['Red Hat Ansible Automation Platform', 'Red Hat OpenShift'],
    bestFor: ['OpenShift automation', 'Ansible and OpenShift', 'hybrid cloud automation']
  },

  {
    label: 'Red Hat Enterprise Linux',
    url: 'https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux',
    category: 'product page',
    products: ['Red Hat Enterprise Linux'],
    bestFor: ['RHEL overview', 'Linux platform', 'operating system']
  },
  {
    label: 'Red Hat Enterprise Linux trial',
    url: 'https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux/server/trial',
    category: 'trial',
    products: ['Red Hat Enterprise Linux'],
    bestFor: ['RHEL trial', 'Linux evaluation', 'hands-on RHEL']
  },
  {
    label: 'Red Hat Enterprise Linux learning hub',
    url: 'https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux/learn',
    category: 'learning hub',
    products: ['Red Hat Enterprise Linux'],
    bestFor: ['RHEL learning', 'Linux labs', 'getting started']
  },
  {
    label: 'Red Hat Enterprise Linux for developers',
    url: 'https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux/red-hat-enterprise-linux-for-developers',
    category: 'developer',
    products: ['Red Hat Enterprise Linux'],
    bestFor: ['developer learning', 'Linux development', 'RHEL for developers']
  },

  {
    label: 'Red Hat AI',
    url: 'https://www.redhat.com/en/products/ai',
    category: 'product family',
    products: ['Red Hat OpenShift AI', 'Red Hat Enterprise Linux AI', 'Red Hat AI Inference'],
    bestFor: ['AI platform', 'gen AI', 'hybrid cloud AI']
  },
  {
    label: 'Red Hat OpenShift AI',
    url: 'https://www.redhat.com/en/products/ai/openshift-ai',
    category: 'product page',
    products: ['Red Hat OpenShift AI', 'Red Hat OpenShift'],
    bestFor: ['MLOps', 'model deployment', 'AI platform']
  },
  {
    label: 'Red Hat Enterprise Linux AI',
    url: 'https://www.redhat.com/en/products/ai/enterprise-linux-ai',
    category: 'product page',
    products: ['Red Hat Enterprise Linux AI', 'Red Hat Enterprise Linux'],
    bestFor: ['AI on Linux', 'model tuning', 'enterprise AI']
  },
  {
    label: 'Red Hat AI Enterprise trial',
    url: 'https://www.redhat.com/en/products/ai/enterprise/trial',
    category: 'trial',
    products: ['Red Hat OpenShift AI', 'Red Hat Enterprise Linux AI', 'Red Hat AI'],
    bestFor: ['AI trial', 'MLOps evaluation', 'gen AI platform']
  },
  {
    label: 'Red Hat AI Inference',
    url: 'https://www.redhat.com/en/products/ai/inference',
    category: 'product page',
    products: ['Red Hat AI Inference'],
    bestFor: ['AI inference', 'model serving', 'vLLM']
  },

  {
    label: 'Red Hat OpenStack Services on OpenShift documentation',
    url: 'https://docs.redhat.com/en/documentation/red_hat_openstack_services_on_openshift',
    category: 'documentation',
    products: ['Red Hat OpenStack', 'Red Hat OpenShift'],
    bestFor: ['OpenStack documentation', 'private cloud', 'infrastructure']
  },
  {
    label: 'Red Hat Satellite',
    url: 'https://www.redhat.com/en/technologies/management/satellite',
    category: 'product page',
    products: ['Red Hat Satellite', 'Red Hat Enterprise Linux'],
    bestFor: ['RHEL management', 'patching', 'provisioning', 'compliance']
  },
  {
    label: 'Red Hat Lightspeed',
    url: 'https://www.redhat.com/en/lightspeed',
    category: 'product page',
    products: ['Red Hat Insights', 'Red Hat Enterprise Linux'],
    bestFor: ['predictive analytics', 'remediation', 'operations']
  },
  {
    label: 'Red Hat Customer Portal product resources',
    url: 'https://access.redhat.com/products/',
    category: 'support and documentation',
    products: ['general'],
    bestFor: ['downloads', 'support', 'knowledgebase', 'documentation']
  }
];

function toCtaCatalogText(items) {
  return items
    .map((item, index) => {
      return `${index + 1}. ${item.label} | ${item.url} | category: ${item.category} | products: ${item.products.join(', ')} | best for: ${item.bestFor.join(', ')}`;
    })
    .join('\n');
}

function buildGuideUrl(arcadeId) {
  return `https://interact.redhat.com/share/${encodeURIComponent(arcadeId)}/guide`;
}

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toOptionList(options) {
  return options.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

async function fetchImagesAsBase64(imageUrls, options = {}) {
  const {
    maxImages = 5,
    maxBytesPerImage = 512 * 1024,
    timeoutMs = 8000
  } = options;

  const urlsToFetch = imageUrls.slice(0, maxImages);

  const results = await Promise.allSettled(
    urlsToFetch.map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Arcade Intake Assistant MVP' }
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          throw new Error(`Not an image: ${contentType}`);
        }

        const buffer = Buffer.from(await resp.arrayBuffer());

        if (buffer.length > maxBytesPerImage) {
          throw new Error(`Image too large: ${buffer.length} bytes`);
        }

        const mime = contentType.split(';')[0].trim() || 'image/png';
        const base64 = buffer.toString('base64');

        return {
          url,
          dataUri: `data:${mime};base64,${base64}`,
          sizeBytes: buffer.length
        };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const images = [];
  const errors = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      images.push(result.value);
    } else {
      errors.push(result.reason?.message || 'Unknown error');
    }
  }

  return { images, errors };
}

async function fetchGuideContent(arcadeId) {
  const guideUrl = buildGuideUrl(arcadeId);

  const response = await fetch(guideUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Arcade Intake Assistant MVP'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch guide page. Status: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title =
    cleanText($('h1').first().text()) ||
    cleanText($('title').first().text());

  const links = [];
  $('a').each((_, el) => {
    const label = cleanText($(el).text());
    const href = $(el).attr('href');

    if (href) {
      links.push({ label, href });
    }
  });

  const imageTexts = [];
  const imageUrls = [];
  $('img').each((_, el) => {
    const alt = cleanText($(el).attr('alt'));
    if (alt) imageTexts.push(alt);

    const src = $(el).attr('src');
    if (src) {
      try {
        imageUrls.push(new URL(src, guideUrl).href);
      } catch {}
    }
  });

  const possibleStepTexts = [];

  $('h1, h2, h3, p, li, figcaption, button, span, div').each((_, el) => {
    const text = cleanText($(el).text());

    if (
      text &&
      text.length > 12 &&
      text.length < 500 &&
      !possibleStepTexts.includes(text)
    ) {
      possibleStepTexts.push(text);
    }
  });

  const bodyText = cleanText($('body').text());

  return {
    arcadeId,
    guideUrl,
    title,
    bodyText: bodyText.slice(0, 3000),
    stepTexts: possibleStepTexts.slice(0, 20),
    imageTexts: imageTexts.slice(0, 15),
    imageUrls: imageUrls.slice(0, 10),
    links: links.slice(0, 12)
  };
}

function buildMetadataPrompt(extractedGuide) {
  return `
You are helping prepare an intake submission for a Red Hat interactive demo / interactive guide.

Use only the guide content provided below. Do not invent product features, metrics, customer names, claims, or unsupported benefits.

If images from the guide are attached, use them to better understand the product UI, workflow, and visual context. Look for product names, logos, navigation elements, and workflow steps visible in screenshots.

Return ONLY valid JSON that can be parsed by JSON.parse().
Do not include markdown fences.
Do not include comments.
Do not include explanation.
Do not include text before or after the JSON.
Use double quotes for all JSON keys and string values.
Do not use trailing commas.

Keep all values concise.
Each confidence note must be under 20 words.
Each field needing confirmation must be only the field name, not a sentence.
Do not include long explanations.

The response must be a single JSON object with exactly these fields:
{
  "demo_title": "",
  "content_type_suggestion": "",
  "description_without_gid": "",
  "description_for_seo": "",
  "language_suggestions": [],
  "cta_link_suggestions": [],
  "seo_keywords": [],
  "vertical_suggestion": "",
  "event_or_project_suggestion": "",
  "primary_product_suggestion": "",
  "other_products_suggestion": [],
  "tdp_suggestion": "",
  "sales_tactic_suggestion": "",
  "marketing_program_suggestion": "",
  "group_suggestion": "",
  "confidence_notes": [],
  "fields_needing_creator_confirmation": []
}


SEO rules:
- Identify one primary SEO keyword phrase from the guide title, product, problem solved, and user task.
- The primary keyword should be specific, not generic. Prefer phrases like "OpenShift Virtualization VM migration" over "virtualization".
- Use the primary keyword naturally once in description_for_seo.
- Include 5 to 8 SEO keyword phrases.
- Keyword phrases should be specific to the product, use case, and user intent.
- Avoid keyword stuffing.
- Avoid unsupported claims.
- Avoid vague standalone keywords such as "cloud", "AI", "automation", "containers", or "security" unless paired with a specific Red Hat product or use case.
- Keywords should reflect search intent: product evaluation, technical learning, migration, modernization, deployment, troubleshooting, automation, or getting started.
- Do not include competitor names unless the guide content clearly mentions them.
- description_for_seo should summarize what the page helps users do, not just list products.

Description rules:
- description_without_gid: 50 to 150 words.
- description_for_seo: 25 to 45 words. Make it search-oriented and concise.
- Use clear, professional Red Hat style.
- Focus on what the guide helps the user learn or do.
- Do not mention "Arcade" unless necessary.
- Do not overstate claims.
- If the guide content is too thin, say so in confidence_notes.

Important field rules:
- Do not decide content_type_suggestion. Return an empty string for content_type_suggestion. The creator must choose Content Type.
- Do not make a group_suggestion. Return an empty string for group_suggestion. The creator must decide grouping manually.
- Do not include Group in fields_needing_creator_confirmation.
- For language_suggestions, choose one or more values only from the allowed Language options.
- For vertical_suggestion, choose only from the allowed Vertical options.
- For event_or_project_suggestion, choose only from the allowed Event options.
- For primary_product_suggestion, choose only from the allowed Product options.
- For other_products_suggestion, choose zero or more values only from the allowed Product options.
- Use "Other" only when the guide clearly references a product that is not in the allowed product list.
- For tdp_suggestion, choose only from the allowed Technology Decision Point options.
- For sales_tactic_suggestion, choose only from the allowed Sales Tactic options.
- For marketing_program_suggestion, choose only from the allowed Marketing Program options.
- If there is not enough evidence, choose "N/A" where available and add the field name to fields_needing_creator_confirmation.
- Do not create new taxonomy values.
- Do not use CTA links found in the guide page.
- For cta_link_suggestions, choose exactly 3 links from the approved CTA link catalog below.
- Each CTA link must be an object with "label", "url", and "reason".
- Only use URLs exactly as provided in the approved CTA link catalog.
- Prefer links that match the guide's primary product, TDP, and use case.
- Prefer this order when relevant: trial, interactive lab, learning hub, documentation, product page.
- Do not invent URLs.

Approved CTA link catalog:
${toCtaCatalogText(CTA_LINK_CATALOG)}

Allowed Content Type options:
${toOptionList(FIELD_OPTIONS.contentTypes)}

Allowed Language options:
${toOptionList(FIELD_OPTIONS.languages)}

Allowed Vertical options:
${toOptionList(FIELD_OPTIONS.verticals)}

Allowed Event options:
${toOptionList(FIELD_OPTIONS.events)}

Allowed Product options:
${toOptionList(FIELD_OPTIONS.products)}

Allowed Technology Decision Point options:
${toOptionList(FIELD_OPTIONS.tdps)}

Allowed Sales Tactic options:
${toOptionList(FIELD_OPTIONS.salesTactics)}

Allowed Marketing Program options:
${toOptionList(FIELD_OPTIONS.marketingPrograms)}

Guide URL:
${extractedGuide.guideUrl}

Guide title:
${extractedGuide.title}

Extracted step text:
${(extractedGuide.stepTexts || []).map((text, index) => `${index + 1}. ${text}`).join('\n')}

Image alt/caption text:
${(extractedGuide.imageTexts || []).map((text, index) => `${index + 1}. ${text}`).join('\n')}

Links:
${(extractedGuide.links || []).map((link, index) => `${index + 1}. ${link.label}: ${link.href}`).join('\n')}

Full body text excerpt:
${extractedGuide.bodyText || ''}
`;
}

function parseModelJson(content) {
  if (!content) {
    throw new Error('Empty model content');
  }

  let cleaned = String(content)
    .replace(/^\uFEFF/, '')
    .trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = cleaned.indexOf('{');

  if (start === -1) {
    throw new Error('No opening JSON brace found');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') depth++;
      if (char === '}') depth--;

      if (depth === 0) {
        const jsonText = cleaned.slice(start, i + 1);
        const repaired = jsonText.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      }
    }
  }

  throw new Error('No complete JSON object found');
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function normalizeDraft(draft) {
  return {
    demo_title: draft.demo_title || '',
    content_type_suggestion: '',
    description_without_gid: draft.description_without_gid || draft.description_with_gid || '',
    description_for_seo: draft.description_for_seo || '',
    language_suggestions: normalizeStringArray(draft.language_suggestions || draft.language_suggestion),
    cta_link_suggestions: Array.isArray(draft.cta_link_suggestions)
      ? draft.cta_link_suggestions
      : [],
    seo_keywords: normalizeStringArray(draft.seo_keywords),
    vertical_suggestion: draft.vertical_suggestion || '',
    event_or_project_suggestion: draft.event_or_project_suggestion || '',
    primary_product_suggestion: draft.primary_product_suggestion || '',
    other_products_suggestion: normalizeStringArray(draft.other_products_suggestion),
    tdp_suggestion: draft.tdp_suggestion || '',
    sales_tactic_suggestion: draft.sales_tactic_suggestion || '',
    marketing_program_suggestion: draft.marketing_program_suggestion || '',
    group_suggestion: '',
    confidence_notes: normalizeStringArray(draft.confidence_notes),
    fields_needing_creator_confirmation: normalizeStringArray(draft.fields_needing_creator_confirmation)
      .filter(field => String(field).toLowerCase() !== 'group')
  };
}

function saveSubmission(submission) {
  const filePath = path.join(__dirname, 'submissions.local.json');

  let existing = [];

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    existing = raw ? JSON.parse(raw) : [];
  }

  existing.push(submission);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

app.get('/api/options', (req, res) => {
  res.json({
    success: true,
    options: FIELD_OPTIONS
  });
});

app.post('/api/extract-guide', async (req, res) => {
  try {
    const { arcadeId } = req.body;

    if (!arcadeId) {
      return res.status(400).json({ error: 'Missing arcadeId' });
    }

    const extractedGuide = await fetchGuideContent(arcadeId);

    res.json({
      success: true,
      extractedGuide
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { extractedGuide } = req.body;

    if (!extractedGuide) {
      return res.status(400).json({ error: 'Missing extractedGuide' });
    }

    if (!MODEL_API || !USER_KEY) {
      return res.status(500).json({
        error: 'Missing MODEL_API or USER_KEY in .env'
      });
    }

    let fetchedImages = [];
    if (extractedGuide.imageUrls && extractedGuide.imageUrls.length > 0) {
      const imageResult = await fetchImagesAsBase64(extractedGuide.imageUrls);
      fetchedImages = imageResult.images;
      if (imageResult.errors.length > 0) {
        console.warn('Some images failed to fetch:', imageResult.errors);
      }
    }

    const contentParts = [
      { type: 'text', text: buildMetadataPrompt(extractedGuide) }
    ];
    for (const img of fetchedImages) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: img.dataUri }
      });
    }

    const payload = {
      model: MODEL_ID,
      messages: [
        {
          role: 'user',
          content: contentParts
        }
      ],
      temperature: 0.1,
      max_tokens: 4096
    };

    const response = await fetch(`${MODEL_API}/v1beta/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${USER_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Model API error',
        status: response.status,
        details: responseText
      });
    }

    const result = JSON.parse(responseText);
    const content = result.choices?.[0]?.message?.content;

    let draft;

    try {
      draft = normalizeDraft(parseModelJson(content));
    } catch (err) {
      console.error('\n--- Raw model content start ---\n');
      console.error(content);
      console.error('\n--- Raw model content end ---\n');
      console.error('Parse error:', err.message);

      fs.writeFileSync(
        path.join(__dirname, 'raw-model-output.local.txt'),
        String(content || ''),
        'utf8'
      );

      return res.status(500).json({
        error: 'Model returned non-JSON content',
        parseError: err.message,
        rawContent: content
      });
    }

    res.json({
      success: true,
      draft,
      modelUsed: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      imagesUsed: fetchedImages.length
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post('/api/submit', (req, res) => {
  try {
    const {
      form,
      extractedGuide,
      aiMeta
    } = req.body;

    if (!form) {
      return res.status(400).json({ error: 'Missing form data' });
    }

    const submittedAt = new Date().toISOString();

    const creatorTeamFinal = form.creatorTeams === 'Other'
      ? `Other: ${form.creatorTeamOther || ''}`
      : form.creatorTeams || '';

    const contentTypeFinal = form.contentType === 'Other'
      ? `Other: ${form.contentTypeOther || ''}`
      : form.contentType || '';

    const quarterFinal = form.quarter === 'Other'
      ? `Other: ${form.quarterOther || ''}`
      : form.quarter || '';

    const languageFinal = [
      ...(Array.isArray(form.language)
        ? form.language.filter(item => item !== 'Other')
        : []),
      form.languageOther ? `Other: ${form.languageOther}` : ''
    ].filter(Boolean).join(', ');

    const primaryProductFinal = form.primaryProduct === 'Other'
      ? `Other: ${form.primaryProductOther || ''}`
      : form.primaryProduct || '';

    const otherProductsFinal = [
      ...(Array.isArray(form.otherProducts)
        ? form.otherProducts.filter(item => item !== 'Other')
        : []),
      form.otherProductsOther ? `Other: ${form.otherProductsOther}` : ''
    ].filter(Boolean).join(', ');

    const ctaLinksFinal = Array.isArray(form.ctaLinks)
      ? form.ctaLinks.join('\n')
      : form.ctaLink || '';

    const submission = {
      'Timestamp': submittedAt,
      'Email Address': form.email || '',
      'Creator Name(s)': form.creatorName || '',
      'Creator Team(s)': creatorTeamFinal,
      'Final Demo Title': form.demoTitle || '',
      'Creation Link': form.creationLink || '',
      'Content Type': contentTypeFinal,
      'What quarter was this content created in?': quarterFinal,
      'Interactive Experience Description (50-150 words)': form.descriptionWithoutGid || '',
      'Description (50-150 words)': form.descriptionWithGid || form.descriptionWithoutGid || '',
      'Description for SEO': form.descriptionForSeo || '',
      'Language': languageFinal,
      'Links for next step call to action': ctaLinksFinal,
      'Keywords for SEO': form.seoKeywords || '',
      'Vertical': form.vertical || '',
      'Is this for a specific event or project?': form.event || '',
      'Primary product featured?': primaryProductFinal,
      'Optional: Other related products?': otherProductsFinal,
      'Related Technology Decision Point?': form.tdp || '',
      'Related Sales Tactic?': form.salesTactic || '',
      'Related Marketing Program?': form.marketingProgram || '',
      'Synthetic Voice Used?': form.syntheticVoice || '',
      'Translation Used?': form.translation || '',
      'Mobile-friendly design considered?': form.mobileFriendly || '',
      'Optional: Should this IE be grouped with another or part of a larger collection? If yes, add the name of the IE it belongs with.': form.group || '',
      'Optional: Have an Employee Advocacy link? Add it here.': form.employeeAdvocacy || '',
      'Requirements confirmed': form.requirementsConfirmed ? 'Yes' : 'No',

      'Arcade ID': form.arcadeId || '',
      'Guide URL': extractedGuide?.guideUrl || form.creationLink || '',
      'AI Model Used': aiMeta?.modelUsed || '',
      'AI Prompt Version': aiMeta?.promptVersion || '',
      'AI Generated At': aiMeta?.generatedAt || '',
      'AI Suggestion Notes': form.aiConfidenceNotes || '',
      'Fields Creator Should Double-check': form.aiFieldsNeedingConfirmation || '',
      'Submission Status': 'Submitted for review',
      'Source': 'local-mvp',
      'Raw Extracted Title': extractedGuide?.title || '',
      'Raw Extracted Text': extractedGuide?.bodyText || ''
    };

    saveSubmission(submission);

    res.json({
      success: true,
      message: 'Submission saved locally.',
      submission
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Arcade intake MVP running at http://localhost:${PORT}`);
});