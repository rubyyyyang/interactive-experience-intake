/***************************************
 * Arcade Intake Assistant - Apps Script Version
 * Converted from the local Express MVP.
 *
 * Script Properties required:
 * - GEMINI_API_KEY
 * - MASTER_SPREADSHEET_ID  optional if this script is bound to the spreadsheet
 ***************************************/

const MODEL_ID = 'gemini-3.5-flash';
const FALLBACK_MODEL_ID = 'gemini-flash-latest';
const GEMINI_API_KEY_PROP = 'GEMINI_API_KEY';
const MASTER_SPREADSHEET_ID_PROP = 'MASTER_SPREADSHEET_ID';
const INTAKE_SUBMISSIONS_SHEET = 'Creator_Form_Raw';

const PROMPT_VERSION = 'guide-intake-v0.6-field-confidence';

const ANALYTICS_SPREADSHEET_ID_PROP = 'ANALYTICS_SPREADSHEET_ID';
const ANALYTICS_LOG_SHEET = 'Analytics_Log';
const ANALYTICS_SUMMARY_SHEET = 'Analytics_Summary';

const STATUS_TRACKER_COLUMNS = {
  FINAL_DEMO_TITLE: 'Final Demo Title',
  SUGGESTED_DEMO_TITLE: 'Suggested Demo Title',
  STATUS: 'Status',
  STATUS_RECEIVED_TS: 'Status Received Timestamp',
  STATUS_PUBLISHED_TS: 'Status Published Timestamp',
  PRIMARY_PRODUCT: 'Primary Product',
  CONTENT_TYPE: 'Content Type',
  FINAL_CONTENT_TYPE: 'Final Content Type',
  CREATOR_NAME: 'Creator Name',
  REQUESTOR_NAME: 'Requestor Name',
  CREATOR_EMAIL: 'Creator Email',
  REQUESTOR_EMAIL: 'Requestor Email',
  CREATION_LINK: 'Creation Link',
  DRUPAL_PAGE_URL: 'Drupal Page URL',
  PUBLIC_SITE_LINK: 'Public Site Link',
  RHAC_PAGE: 'RHAC page',
  GLOBAL_ID: 'Global ID',
  NUMBER: 'Number',
  DESCRIPTION: 'Demo Description',
  PRODUCTION_LINK: 'Production Link',
  DURATION: 'Duration',
  QUARTER: 'Quarter',
  CREATOR_TEAM: 'Creator Team',
  REQUESTOR_TEAM: 'Requestor Team',
  ORIGIN_TYPE: 'Origin Type',
  LANGUAGE: 'Language',
  VERTICAL: 'Verticals',
  EVENT: 'Event',
  CTA_LINK: 'CTALink',
  TDP: 'TDP',
  SALES_TACTIC: 'Sales Tactic',
  MARKETING_PROGRAM: 'Marketing Program',
  SYNTHETIC_VOICE: 'Synthetic Voice Used?',
  TRANSLATION: 'Translation Used?',
  MOBILE_FRIENDLY: 'Mobile-friendly design considered?',
  GROUP: 'Group',
  EMPLOYEE_ADVOCACY: 'Creator Employee Advocacy Link',
  PRODUCT: 'Product',
  DESCRIPTION_FOR_SEO: 'Description for SEO',
  CREATOR_SUBMITTED_TS: 'Creator Submission Timestamp',
  CREATION_BRIEF_DOC_URL: 'Creation Brief Doc URL',
  STATUS_OPEN_TS: 'Status Open Timestamp',
  STATUS_APPROVED_TS: 'Status Approved Timestamp',
  STATUS_REVIEWED_TS: 'Status Reviewed Timestamp',
  STATUS_RETIRED_TS: 'Status Retired Timestamp',
  STATUS_CLOSED_TS: 'Status Closed Timestamp'
};

const STATUS_TRACKER_ADMINS = [];

function isAdmin_(email) {
  return STATUS_TRACKER_ADMINS.some(a => a.toLowerCase() === email.toLowerCase());
}

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
    'CY26Q1',
    'CY26Q2',
    'CY26Q3',
    'CY26Q4',
    'CY27Q1',
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
    'Summit',
    'Other'
  ],

  products: [
    'Red Hat Ansible Automation Platform',
    'Red Hat Enterprise Linux',
    'Red Hat OpenShift',
    'Red Hat OpenShift AI',
'Red Hat Enterprise Linux AI',
'Red Hat AI Inference',
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
    'AI Platform',
    'N/A'
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

const FOLLOW_UP_QUESTIONS = {
  primary_product_suggestion: 'Which Red Hat product does this demo primarily feature?',
  vertical_suggestion: 'Is this demo targeted at a specific industry vertical? If so, which one?',
  tdp_suggestion: 'What technology decision point does this demo address?',
  sales_tactic_suggestion: 'What sales tactic or motion does this demo support?',
  marketing_program_suggestion: 'What marketing program is this demo part of?',
  description_without_gid: 'Can you describe in a sentence or two what this demo shows?',
  seo_keywords: 'What keywords would someone search to find this demo?',
  demo_title: 'What would you title this demo?',
  event_or_project_suggestion: 'Is this demo for a specific event or project?',
  other_products_suggestion: 'Are there any other Red Hat products shown in this demo?'
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


const PREFERRED_ARCADE_SHARE_URL_EXAMPLE = 'https://interact.redhat.com/share/ArcadeID';

function normalizeArcadeUrlInput_(value) {
  const raw = cleanText(value);
  if (!raw) {
    throw new Error(`Please enter an interactive demo share URL. Preferred format: ${PREFERRED_ARCADE_SHARE_URL_EXAMPLE}`);
  }

  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const cleanUrl = url.split('#')[0];
  const withoutQuery = cleanUrl.split('?')[0].replace(/\/+$/, '');

  let match;

  match = withoutQuery.match(/^https?:\/\/interact\.redhat\.com\/share\/([^\/?#]+)(?:\/guide)?$/i);
  if (match) {
    const arcadeId = decodeURIComponent(match[1]);
    return buildArcadeUrlInfo_(raw, arcadeId, 'interact-share');
  }

  match = withoutQuery.match(/^https?:\/\/app\.arcade\.software\/share\/([^\/?#]+)(?:\/guide)?$/i);
  if (match) {
    const arcadeId = decodeURIComponent(match[1]);
    return buildArcadeUrlInfo_(raw, arcadeId, 'arcade-share');
  }

  match = withoutQuery.match(/^https?:\/\/app\.arcade\.software\/flows\/([^\/?#]+)(?:\/edit)?$/i);
  if (match) {
    const arcadeId = decodeURIComponent(match[1]);
    const info = buildArcadeUrlInfo_(raw, arcadeId, 'arcade-edit');
    info.warnings.push(
      'This looks like an edit URL. I will try to use the flow ID, but if extraction fails, use the share URL instead.'
    );
    return info;
  }

  throw new Error(
    `I could not identify the interactive demo URL. Please paste the share URL in this format: ${PREFERRED_ARCADE_SHARE_URL_EXAMPLE}`
  );
}

function buildArcadeUrlInfo_(originalUrl, arcadeId, urlType) {
  const encodedId = encodeURIComponent(arcadeId);
  const interactShareUrl = `https://interact.redhat.com/share/${encodedId}`;
  const arcadeShareUrl = `https://app.arcade.software/share/${encodedId}`;

  const candidates = [];

  if (urlType === 'interact-share') {
    candidates.push(`${interactShareUrl}/guide`);
    candidates.push(interactShareUrl);
    candidates.push(`${arcadeShareUrl}/guide`);
    candidates.push(arcadeShareUrl);
  } else {
    candidates.push(`${arcadeShareUrl}/guide`);
    candidates.push(arcadeShareUrl);
    candidates.push(`${interactShareUrl}/guide`);
    candidates.push(interactShareUrl);
  }

  return {
    originalUrl,
    arcadeId,
    urlType,
    shareUrl: urlType === 'interact-share' ? interactShareUrl : arcadeShareUrl,
    preferredShareUrl: interactShareUrl,
    guideCandidates: candidates,
    warnings: []
  };
}

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFormulaPrefix_(value) {
  const str = String(value || '');
  return str.replace(/^[=+\-@]+/, '');
}

function toOptionList(options) {
  return options.map((item, index) => `${index + 1}. ${item}`).join('\n');
}



function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  const baseUrl = ScriptApp.getService().getUrl() || '';

  if (page === 'status') {
    const template = HtmlService.createTemplateFromFile('StatusTracker');
    template.webAppBaseUrl = baseUrl;
    template.token = (e && e.parameter && e.parameter.token) || '';
    return template.evaluate()
      .setTitle('My Submissions — Interactive Demo Intake')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  logAnalyticsEvent_('session_start', {});
  const template = HtmlService.createTemplateFromFile('Index');
  template.webAppBaseUrl = baseUrl;
  return template.evaluate()
    .setTitle('Interactive Demo Intake Assistant')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserEmail() {
  try {
    const email = Session.getActiveUser().getEmail();
    return { success: true, email: email || '' };
  } catch (e) {
    return { success: true, email: '' };
  }
}

function getOptions() {
  return {
    success: true,
    options: FIELD_OPTIONS
  };
}

function getRequestMasterData_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(MASTER_SPREADSHEET_ID_PROP);
  if (!spreadsheetId) throw new Error('MASTER_SPREADSHEET_ID is not configured.');

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Request_Master');
  if (!sheet) throw new Error('Request_Master sheet not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { headers: [], rows: [], headerMap: {} };

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const headerMap = {};
  headers.forEach((h, i) => { if (h) headerMap[h] = i; });

  return { headers, rows, headerMap };
}

function buildSubmissionFromRow_(row, headerMap) {
  const col = STATUS_TRACKER_COLUMNS;
  const get = (name) => {
    const idx = headerMap[name];
    return idx != null ? String(row[idx] || '') : '';
  };

  return {
    title: get(col.FINAL_DEMO_TITLE) || get(col.SUGGESTED_DEMO_TITLE),
    status: get(col.STATUS),
    dateSubmitted: get(col.CREATOR_SUBMITTED_TS) || get(col.STATUS_RECEIVED_TS),
    primaryProduct: get(col.PRIMARY_PRODUCT),
    contentType: get(col.FINAL_CONTENT_TYPE) || get(col.CONTENT_TYPE),
    creatorName: get(col.CREATOR_NAME),
    requestorName: get(col.REQUESTOR_NAME),
    creationLink: get(col.CREATION_LINK),
    drupalPageUrl: get(col.DRUPAL_PAGE_URL) || get(col.PUBLIC_SITE_LINK) || get(col.RHAC_PAGE),
    publishedDate: get(col.STATUS_PUBLISHED_TS),
    globalId: get(col.GLOBAL_ID),
    requestNumber: get(col.NUMBER),
    description: get(col.DESCRIPTION),
    productionLink: get(col.PRODUCTION_LINK),
    duration: get(col.DURATION),
    quarter: get(col.QUARTER),
    creatorTeam: get(col.CREATOR_TEAM),
    requestorTeam: get(col.REQUESTOR_TEAM),
    originType: get(col.ORIGIN_TYPE),
    language: get(col.LANGUAGE),
    vertical: get(col.VERTICAL),
    event: get(col.EVENT),
    ctaLink: get(col.CTA_LINK),
    tdp: get(col.TDP),
    salesTactic: get(col.SALES_TACTIC),
    marketingProgram: get(col.MARKETING_PROGRAM),
    syntheticVoice: get(col.SYNTHETIC_VOICE),
    translation: get(col.TRANSLATION),
    mobileFriendly: get(col.MOBILE_FRIENDLY),
    group: get(col.GROUP),
    employeeAdvocacy: get(col.EMPLOYEE_ADVOCACY),
    otherProducts: get(col.PRODUCT),
    descriptionForSeo: get(col.DESCRIPTION_FOR_SEO),
    creationBriefDocUrl: get(col.CREATION_BRIEF_DOC_URL),
    statusTimestamps: {
      open: get(col.STATUS_OPEN_TS),
      approved: get(col.STATUS_APPROVED_TS),
      received: get(col.STATUS_RECEIVED_TS),
      reviewed: get(col.STATUS_REVIEWED_TS),
      published: get(col.STATUS_PUBLISHED_TS),
      retired: get(col.STATUS_RETIRED_TS),
      closed: get(col.STATUS_CLOSED_TS)
    }
  };
}

function getSubmissionStatus(globalId) {
  if (!globalId) return { success: false, error: 'No ID provided.' };

  try {
    const { rows, headerMap } = getRequestMasterData_();
    const idIdx = headerMap[STATUS_TRACKER_COLUMNS.GLOBAL_ID];
    if (idIdx == null) return { success: false, error: 'Global ID column not found.' };

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][idIdx] || '').trim() === globalId) {
        return { success: true, submission: buildSubmissionFromRow_(rows[i], headerMap) };
      }
    }

    return { success: true, submission: null, processing: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getMySubmissions(searchName) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Could not determine your email. Please make sure you are logged in.' };

    const { rows, headerMap } = getRequestMasterData_();
    const creatorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
    const requestorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.REQUESTOR_EMAIL];
    const creatorNameIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_NAME];

    const lowerEmail = email.toLowerCase();
    const admin = isAdmin_(email);
    const lowerSearch = searchName ? searchName.toLowerCase().trim() : '';
    const submissions = [];

    for (let i = 0; i < rows.length; i++) {
      const creatorEmail = creatorEmailIdx != null ? String(rows[i][creatorEmailIdx] || '').toLowerCase().trim() : '';
      const requestorEmail = requestorEmailIdx != null ? String(rows[i][requestorEmailIdx] || '').toLowerCase().trim() : '';
      const creatorName = creatorNameIdx != null ? String(rows[i][creatorNameIdx] || '').toLowerCase().trim() : '';

      if (lowerSearch) {
        if (creatorName.includes(lowerSearch)) {
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
        }
      } else if (admin) {
        submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
      } else {
        if (creatorEmail === lowerEmail || requestorEmail === lowerEmail) {
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
        }
      }
    }

    submissions.sort((a, b) => {
      const dateA = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const dateB = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return dateB - dateA;
    });

    return { success: true, submissions, isAdmin: admin };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getAllSubmissions() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Could not determine your email. Please make sure you are logged in.' };

    const { rows, headerMap } = getRequestMasterData_();
    const creatorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
    const requestorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.REQUESTOR_EMAIL];
    const lowerEmail = email.toLowerCase();
    const submissions = [];
    const seenGlobalIds = new Set();

    for (let i = 0; i < rows.length; i++) {
      const ce = creatorEmailIdx != null ? String(rows[i][creatorEmailIdx] || '').toLowerCase().trim() : '';
      const re = requestorEmailIdx != null ? String(rows[i][requestorEmailIdx] || '').toLowerCase().trim() : '';
      const sub = buildSubmissionFromRow_(rows[i], headerMap);
      if (!sub.status) continue;
      sub.isMine = (ce === lowerEmail || re === lowerEmail);
      if (sub.globalId) seenGlobalIds.add(sub.globalId);
      submissions.push(sub);
    }

    const pending = getPendingIntakeSubmissions_(seenGlobalIds, lowerEmail);
    for (let i = 0; i < pending.length; i++) {
      submissions.push(pending[i]);
    }

    submissions.sort((a, b) => {
      const da = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const db = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return db - da;
    });

    return { success: true, submissions, userEmail: lowerEmail, isAdmin: isAdmin_(email) };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getPendingIntakeSubmissions_(seenGlobalIds, userEmail) {
  try {
    const ss = getTargetSpreadsheet_();
    const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || '').trim());

    const col = (name) => headers.indexOf(name);

    const globalIdIdx = col('Global ID');
    const titleIdx = col('Final Demo Title');
    const emailIdx = col('Email Address');
    const creatorIdx = col('Creator Name(s)');
    const creatorTeamIdx = col('Creator Team(s)');
    const timestampIdx = col('Creator Submission Timestamp');
    const contentTypeIdx = col('Content Type');
    const productIdx = col('Primary product featured?');
    const durationIdx = col('Duration');
    const languageIdx = col('Language');
    const quarterIdx = col('What quarter was this content created in?');
    const creationLinkIdx = col('Creation Link');
    const descIdx = col('Description (50-150 words)');
    const tdpIdx = col('Related Technology Decision Point?');

    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    const results = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const gid = globalIdIdx >= 0 ? String(row[globalIdIdx] || '').trim() : '';
      if (!gid || seenGlobalIds.has(gid)) continue;

      const rowEmail = emailIdx >= 0 ? String(row[emailIdx] || '').toLowerCase().trim() : '';
      const get = (idx) => idx >= 0 ? String(row[idx] || '').trim() : '';

      results.push({
        title: get(titleIdx),
        status: 'Processing',
        dateSubmitted: get(timestampIdx),
        primaryProduct: get(productIdx),
        contentType: get(contentTypeIdx),
        creatorName: get(creatorIdx),
        creatorTeam: get(creatorTeamIdx),
        requestorName: '',
        requestorTeam: '',
        creationLink: get(creationLinkIdx),
        drupalPageUrl: '',
        publishedDate: '',
        globalId: gid,
        description: get(descIdx),
        duration: get(durationIdx),
        quarter: get(quarterIdx),
        language: get(languageIdx),
        tdp: get(tdpIdx),
        originType: '',
        productionLink: '',
        vertical: '',
        event: '',
        ctaLink: '',
        requestNumber: '',
        isMine: rowEmail === userEmail,
        statusTimestamps: {}
      });
    }

    return results;
  } catch (e) {
    return [];
  }
}

function extractGuideContent(payload) {
  const arcadeUrl = typeof payload === 'string'
    ? payload
    : payload && (payload.arcadeUrl || payload.arcadeId || payload.url);
  const sessionId = (typeof payload === 'object' && payload) ? payload.sessionId : '';

  if (!arcadeUrl) {
    throw new Error('Please enter an interactive demo share URL. Preferred format: ' + PREFERRED_ARCADE_SHARE_URL_EXAMPLE);
  }

  logAnalyticsEvent_('guide_extraction_start', {
    sessionId: sessionId,
    arcadeId: arcadeUrl,
    metadata: { submittedUrl: arcadeUrl }
  });

  const startTime = Date.now();

  let extractedGuide;
  try {
    extractedGuide = fetchGuideContent_(arcadeUrl);
  } catch (e) {
    const errorDurationMs = Date.now() - startTime;
    logAnalyticsEvent_('guide_extraction_error', {
      sessionId: sessionId,
      arcadeId: arcadeUrl,
      durationMs: errorDurationMs,
      status: 'error',
      metadata: { errorMessage: e.message, durationMs: errorDurationMs }
    });
    throw e;
  }

  const durationMs = Date.now() - startTime;

  const imageCount = (extractedGuide.imageUrls || []).length;
  const stepCount = (extractedGuide.steps || []).length
    || (extractedGuide.stepTexts || []).length;

  logAnalyticsEvent_('guide_extraction_complete', {
    sessionId: sessionId,
    arcadeId: extractedGuide.arcadeId || arcadeUrl,
    durationMs: durationMs,
    metadata: { durationMs: durationMs, imageCount: imageCount, stepCount: stepCount }
  });

  return {
    success: true,
    extractedGuide: extractedGuide
  };
}

function generateDraftFromGuide(payload) {
  const extractedGuide = payload && payload.extractedGuide;
  const sessionId = payload && payload.sessionId || '';
  if (!extractedGuide) throw new Error('Missing extractedGuide');

  logAnalyticsEvent_('ai_generation_start', {
    sessionId: sessionId,
    arcadeId: extractedGuide.arcadeId || '',
    metadata: { model: MODEL_ID, promptVersion: PROMPT_VERSION }
  });

  const startTime = Date.now();

  const steps = extractedGuide.steps || [];
  const stepImageUrls = steps.map(function(s) { return s.imageUrl; });
  let imagesUsed = 0;

  const interleavedParts = [];
  if (stepImageUrls.length > 0) {
    const imageResult = fetchImagesAsBase64_(stepImageUrls);
    if (imageResult.errors.length > 0) {
      console.warn('Some images failed to fetch: ' + imageResult.errors.join(', '));
    }
    for (let i = 0; i < steps.length; i++) {
      const stepLabel = 'Step ' + (i + 1) + ': ' + (steps[i].text || '(no description)');
      interleavedParts.push({ text: stepLabel });
      if (imageResult.images[i]) {
        interleavedParts.push({
          inlineData: {
            mimeType: imageResult.images[i].mimeType,
            data: imageResult.images[i].base64
          }
        });
        imagesUsed++;
      }
    }
  } else if (extractedGuide.imageUrls && extractedGuide.imageUrls.length > 0) {
    const fallbackResult = fetchImagesAsBase64_(extractedGuide.imageUrls);
    fallbackResult.images.forEach(function(img) {
      interleavedParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    });
    imagesUsed = fallbackResult.images.length;
  }

  try {
    const prompt = buildMetadataPrompt(extractedGuide);
    const content = callGemini_(prompt, interleavedParts);
    const draft = normalizeDraft(parseModelJson(content));
    const durationMs = Date.now() - startTime;

    logAnalyticsEvent_('ai_generation_complete', {
      sessionId: sessionId,
      arcadeId: extractedGuide.arcadeId || '',
      durationMs: durationMs,
      metadata: { durationMs: durationMs, fieldConfidences: draft.field_confidence || {} }
    });

    return {
      success: true,
      draft: draft,
      modelUsed: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      imagesUsed: imagesUsed
    };
  } catch (e) {
    const errorDurationMs = Date.now() - startTime;

    logAnalyticsEvent_('ai_generation_error', {
      sessionId: sessionId,
      arcadeId: extractedGuide.arcadeId || '',
      durationMs: errorDurationMs,
      status: 'error',
      metadata: { errorMessage: e.message, durationMs: errorDurationMs }
    });

    throw e;
  }
}

function buildRefinementPrompt_(originalDraft, creatorAnswers) {
  const answersText = Object.keys(creatorAnswers).map(function(field) {
    return '- ' + field + ': ' + creatorAnswers[field];
  }).join('\n');

  return 'You previously generated this intake draft:\n' +
    JSON.stringify(originalDraft, null, 2) +
    '\n\nThe creator has provided these additional details:\n' + answersText +
    '\n\nUpdate the draft based on the creator\'s answers. Adjust all related fields — for example, if the creator specified the product, also update the TDP, sales tactic, description, and SEO keywords accordingly.' +
    '\n\nReturn the complete updated JSON in the exact same format. Include updated field_confidence values (answers from the creator should raise confidence to "high" for answered fields and may improve related fields).';
}

function refineDraftWithAnswers(payload) {
  const originalDraft = payload.originalDraft;
  const creatorAnswers = payload.creatorAnswers;
  const sessionId = payload.sessionId || '';

  logAnalyticsEvent_('refinement_requested', {
    sessionId: sessionId,
    metadata: { fieldsRefined: Object.keys(creatorAnswers || {}) }
  });

  const prompt = buildRefinementPrompt_(originalDraft, creatorAnswers);
  const content = callGemini_(prompt, []);
  const draft = normalizeDraft(parseModelJson(content));
  return {
    success: true,
    draft: draft,
    modelUsed: MODEL_ID,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    refined: true
  };
}

function submitIntakeForReview(payload) {
  const form = payload && payload.form;
  const extractedGuide = payload && payload.extractedGuide;
  const aiMeta = payload && payload.aiMeta;

  if (!form) throw new Error('Missing form data');

  const submittedAt = new Date().toISOString();
  const globalId = Utilities.getUuid();

  const creatorTeamFinal = form.creatorTeams === 'Other'
    ? `Other: ${form.creatorTeamOther || ''}`
    : form.creatorTeams || '';

  const contentTypeFinal = form.contentType === 'Other'
    ? `Other: ${form.contentTypeOther || ''}`
    : form.contentType || '';

  const quarterFinal = form.quarter === 'Other'
    ? `Other: ${form.quarterOther || ''}`
    : form.quarter || '';

  const eventFinal = form.event === 'Other'
    ? `Other: ${form.eventOther || ''}`
    : form.event || '';

  const languageFinal = [
    ...(Array.isArray(form.language) ? form.language.filter(item => item !== 'Other') : []),
    form.languageOther ? `Other: ${form.languageOther}` : ''
  ].filter(Boolean).join(', ');

  const primaryProductFinal = form.primaryProduct === 'Other'
    ? `Other: ${form.primaryProductOther || ''}`
    : form.primaryProduct || '';

  const otherProductsFinal = [
    ...(Array.isArray(form.otherProducts) ? form.otherProducts.filter(item => item !== 'Other') : []),
    form.otherProductsOther ? `Other: ${form.otherProductsOther}` : ''
  ].filter(Boolean).join(', ');

  const ctaLinksFinal = Array.isArray(form.ctaLinks)
    ? form.ctaLinks.join('\n')
    : form.ctaLink || '';

  const submission = {
    'Timestamp': submittedAt,
    'Email Address': form.email || '',
    'Creator Name(s)': stripFormulaPrefix_(form.creatorName),
    'Creator Team(s)': stripFormulaPrefix_(creatorTeamFinal),
    'Final Demo Title': stripFormulaPrefix_(form.demoTitle),
    'Creation Link': form.creationLink || '',
    'Submitted Arcade URL': form.arcadeUrl || '',
    'Normalized Share URL': extractedGuide && extractedGuide.shareUrl || form.creationLink || '',
    'Content Type': stripFormulaPrefix_(contentTypeFinal),
    'What quarter was this content created in?': stripFormulaPrefix_(quarterFinal),
    'Interactive Experience Description (50-150 words)': stripFormulaPrefix_(form.descriptionWithoutGid),
    'Description (50-150 words)': stripFormulaPrefix_(form.descriptionWithGid || form.descriptionWithoutGid),
    'Description for SEO': stripFormulaPrefix_(form.descriptionForSeo),
    'Language': stripFormulaPrefix_(languageFinal),
    'Links for next step call to action': ctaLinksFinal,
    'Keywords for SEO': stripFormulaPrefix_(form.seoKeywords),
    'Vertical': stripFormulaPrefix_(form.vertical),
    'Is this for a specific event or project?': stripFormulaPrefix_(eventFinal),
    'Primary product featured?': stripFormulaPrefix_(primaryProductFinal),
    'Optional: Other related products?': stripFormulaPrefix_(otherProductsFinal),
    'Related Technology Decision Point?': stripFormulaPrefix_(form.tdp),
    'Related Sales Tactic?': stripFormulaPrefix_(form.salesTactic),
    'Related Marketing Program?': stripFormulaPrefix_(form.marketingProgram),
    'Synthetic Voice Used?': form.syntheticVoice || '',
    'Translation Used?': form.translation || '',
    'Mobile-friendly design considered?': form.mobileFriendly || '',
    'Duration': form.duration || '',
    'Optional: Should this IE be grouped with another or part of a larger collection? If yes, add the name of the IE it belongs with.': stripFormulaPrefix_(form.group),
    'Optional: Have an Employee Advocacy link? Add it here.': form.employeeAdvocacy || '',
    'Requirements confirmed': form.requirementsConfirmed ? 'Yes' : 'No',
    'Arcade ID': form.arcadeId || '',
    'Guide URL': extractedGuide && extractedGuide.guideUrl || form.creationLink || '',
    'AI Model Used': aiMeta && aiMeta.modelUsed || '',
    'AI Prompt Version': aiMeta && aiMeta.promptVersion || '',
    'AI Generated At': aiMeta && aiMeta.generatedAt || '',
    'AI Suggestion Notes': form.aiConfidenceNotes || '',
    'Fields Creator Should Double-check': form.aiFieldsNeedingConfirmation || '',
    'Submission Status': 'Submitted for review',
    'Source': 'apps-script-pilot',
    'Raw Extracted Title': extractedGuide && extractedGuide.title || '',
    'Raw Extracted Text': extractedGuide && extractedGuide.bodyText || '',
    'Global ID': globalId,
    'Creator Submission Timestamp': submittedAt
  };

  try {
    if (extractedGuide) {
      submission['Guide Extraction JSON'] = JSON.stringify(buildGuideExtractionJson_(extractedGuide));
    }
  } catch (e) {
    Logger.log('Guide extraction JSON storage failed: ' + e.message);
  }

 const saveResult = saveSubmissionToSheet_(submission);

  logAnalyticsEvent_('form_submitted', {
    sessionId: (payload && payload.sessionId) || '',
    arcadeId: form.arcadeId || '',
    metadata: {
      fieldsEditedCount: (payload.editedFields || []).length,
      editedFieldNames: payload.editedFields || [],
      sessionDurationMs: payload.sessionDurationMs || '',
      team: creatorTeamFinal,
      product: primaryProductFinal,
      contentType: contentTypeFinal
    }
  });

return {
  success: true,
  message: 'Submission received. Your intake has been saved and the review workflow will start shortly.',
  submission,
  rowIndex: saveResult.rowIndex,
  workflowQueued: true,
  globalId: globalId
};

}

function installWorkflowQueueTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'processPendingWorkflowRows')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('processPendingWorkflowRows')
    .timeBased()
    .everyMinutes(1)
    .create();
}

function testGeminiFromAppsScript() {
  const output = callGemini_('Return only valid JSON: {"status":"ok","message":"Gemini API is working"}');
  Logger.log(output);
  return output;
}

function extractDuration_(html) {
  const source = String(html || '');

  const metaDuration = extractMetaContent_(source, 'property', 'og:video:duration')
    || extractMetaContent_(source, 'name', 'duration');
  if (metaDuration) {
    const secs = parseInt(metaDuration, 10);
    if (secs > 0) {
      const mins = Math.ceil(secs / 60);
      return mins + ' min';
    }
  }

  const durationAttrMatch = source.match(/\bduration["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)\s*(min|sec|s|m)/i);
  if (durationAttrMatch) {
    let val = parseFloat(durationAttrMatch[1]);
    const unit = durationAttrMatch[2].toLowerCase();
    if (unit === 'sec' || unit === 's') val = Math.ceil(val / 60);
    if (val > 0) return Math.ceil(val) + ' min';
  }

  const textMatch = source.match(/(\d+(?:\.\d+)?)\s*(?:min(?:ute)?s?)\b/i);
  if (textMatch) {
    const m = Math.ceil(parseFloat(textMatch[1]));
    if (m > 0 && m < 120) return m + ' min';
  }

  return '';
}

function fetchGuideContent_(arcadeUrlOrId) {
  const parsed = normalizeArcadeUrlInput_(arcadeUrlOrId);
  const fetchResult = fetchFirstWorkingGuidePage_(parsed);

  const html = fetchResult.html;

  const links = extractLinks_(html).slice(0, 12);
  const imageTexts = extractImageAltTexts_(html).slice(0, 15);
  const imageUrls = extractImageUrls_(html, fetchResult.guideUrl);
  const steps = extractStepsWithImages_(html);
  const possibleStepTexts = extractPossibleStepTexts_(html).slice(0, 20);
  const bodyText = cleanText(stripHtml_(html));
  const duration = extractDuration_(html);

  const title = cleanText(
    extractBestGuideTitle_(html) ||
    possibleStepTexts[0] ||
    ''
  );

  return {
    arcadeId: parsed.arcadeId,
    sourceUrl: parsed.originalUrl,
    shareUrl: parsed.shareUrl,
    preferredShareUrl: parsed.preferredShareUrl,
    urlType: parsed.urlType,
    guideUrl: fetchResult.guideUrl,
    title,
    bodyText: bodyText.slice(0, 3000),
    stepTexts: possibleStepTexts,
    imageTexts,
    imageUrls,
    steps,
    links,
    duration,
    warnings: parsed.warnings || []
  };
}


function fetchFirstWorkingGuidePage_(parsed) {
  const errors = [];

  for (let i = 0; i < parsed.guideCandidates.length; i++) {
    const guideUrl = parsed.guideCandidates[i];

    try {
      const response = UrlFetchApp.fetch(guideUrl, {
        method: 'get',
        followRedirects: true,
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Interactive Demo Intake Assistant'
        }
      });

      const status = response.getResponseCode();
      const html = response.getContentText();

      if (status >= 200 && status < 300 && html && html.length > 200) {
        return { guideUrl, html, status };
      }

      errors.push(`${guideUrl} returned ${status}`);
    } catch (error) {
      errors.push(`${guideUrl}: ${error.message || error}`);
    }
  }

  const editUrlNote = parsed.urlType === 'arcade-edit'
    ? ' The URL you entered looks like an edit URL, which may not be accessible for guide extraction.'
    : '';

  throw new Error(
    `I recognized the interactive demo ID (${parsed.arcadeId}), but could not fetch the guide content.${editUrlNote} ` +
    `Please use the share URL in this format: ${PREFERRED_ARCADE_SHARE_URL_EXAMPLE}`
  );
}

function callGemini_(prompt, interleavedParts) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_PROP);
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in Script Properties.');

  const result = callGeminiWithModel_(MODEL_ID, apiKey, prompt, interleavedParts);
  if (result.deprecatedModel) {
    const fallbackResult = callGeminiWithModel_(FALLBACK_MODEL_ID, apiKey, prompt, interleavedParts);
    notifyModelDeprecation_(MODEL_ID, FALLBACK_MODEL_ID);
    return fallbackResult.content;
  }
  return result.content;
}

function callGeminiWithModel_(modelId, apiKey, prompt, interleavedParts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  if (interleavedParts && interleavedParts.length > 0) {
    interleavedParts.forEach(function(part) {
      parts.push(part);
    });
  }

  const requestPayload = {
    contents: [
      {
        role: 'user',
        parts: parts
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status === 404) {
      return { deprecatedModel: true };
    }

    if (status === 429 || status === 503) {
      lastError = new Error('Gemini API error ' + status + ' (attempt ' + (attempt + 1) + '/3)');
      Utilities.sleep(1000 * Math.pow(2, attempt));
      continue;
    }

    if (status !== 200) {
      throw new Error('Gemini API error ' + status + ': ' + body);
    }

    let result;
    try {
      result = JSON.parse(body);
    } catch (e) {
      throw new Error('Gemini returned invalid JSON response');
    }

    if (result.promptFeedback && result.promptFeedback.blockReason) {
      throw new Error('Gemini blocked prompt: ' + result.promptFeedback.blockReason);
    }

    const content = result.candidates && result.candidates[0] &&
      result.candidates[0].content && result.candidates[0].content.parts &&
      result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text;

    if (!content) throw new Error('Gemini returned empty content.');
    return { content: content };
  }
  throw lastError;
}

function notifyModelDeprecation_(oldModel, fallbackModel) {
  const props = PropertiesService.getScriptProperties();
  const notifiedKey = 'MODEL_DEPRECATION_NOTIFIED_' + oldModel;
  if (props.getProperty(notifiedKey)) return;

  try {
    const ownerEmail = props.getProperty('ADMIN_NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
      to: ownerEmail,
      subject: '[Arcade Intake] Gemini model "' + oldModel + '" has been deprecated',
      body: 'The Gemini model "' + oldModel + '" returned a 404 (not found) error.\n\n' +
        'The app automatically fell back to "' + fallbackModel + '" so creators are not affected, ' +
        'but you should update MODEL_ID in Code.js to a specific stable model.\n\n' +
        'Current fallback: ' + fallbackModel + '\n' +
        'Time: ' + new Date().toISOString()
    });
  } catch (e) {
    Logger.log('Failed to send deprecation notification: ' + e.message);
  }

  props.setProperty(notifiedKey, new Date().toISOString());
}
function saveSubmissionToSheet_(submission) {
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);

  if (!sheet) {
    throw new Error(
      'Could not find sheet "' + INTAKE_SUBMISSIONS_SHEET + '". Please check the sheet tab name.'
    );
  }

  ensureWorkflowTrackingColumns_(sheet);

  const lastColumn = sheet.getLastColumn();
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(header => String(header || '').trim());

  const queuedSubmission = {
    ...submission,
    'AI Workflow Status': 'Pending',
    'AI Workflow Queued At': new Date().toISOString(),
    'AI Workflow Started At': '',
    'AI Workflow Completed At': '',
    'AI Workflow Error': '',
    'AI Workflow Result': ''
  };

  const row = headers.map(header => {
    return queuedSubmission[header] == null ? '' : queuedSubmission[header];
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet.appendRow(row);
    var appendedRow = sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }

  return {
    rowIndex: appendedRow,
    workflowQueued: true
  };
}

function triggerOldCreatorWorkflow_(rowIndex) {
  const webhookUrl = PropertiesService
    .getScriptProperties()
    .getProperty('WORKFLOW_WEBHOOK_URL');

  const secret = PropertiesService
    .getScriptProperties()
    .getProperty('AI_WORKFLOW_SECRET');

  if (!webhookUrl || !secret) {
    console.log('Workflow webhook is not configured. Skipping old workflow trigger.');
    return null;
  }

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      secret: secret,
      sheetName: 'Creator_Form_Raw',
      rowIndex: rowIndex
    }),
    muteHttpExceptions: true
  });

  const text = response.getContentText();
  const status = response.getResponseCode();

  if (status < 200 || status >= 300) {
    throw new Error('Workflow webhook failed ' + status + ': ' + text);
  }

  const result = JSON.parse(text);

  if (!result.success) {
    throw new Error('Workflow webhook error: ' + (result.error || text));
  }

  return result;
}
function getTargetSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(MASTER_SPREADSHEET_ID_PROP);
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Missing MASTER_SPREADSHEET_ID Script Property.');
  return active;
}

function getAnalyticsSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty(ANALYTICS_SPREADSHEET_ID_PROP);

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      Logger.log('Stored analytics spreadsheet not accessible (' + ssId + '): ' + e.message);
    }
  }

  const ss = SpreadsheetApp.create('Arcade Intake Analytics');
  props.setProperty(ANALYTICS_SPREADSHEET_ID_PROP, ss.getId());
  Logger.log('Analytics spreadsheet created: ' + ss.getUrl());
  return ss;
}

function ensureAnalyticsLogSheet_(ss) {
  let sheet = ss.getSheetByName(ANALYTICS_LOG_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(ANALYTICS_LOG_SHEET);
  sheet.appendRow([
    'Timestamp', 'Session ID', 'Event Type', 'User Email',
    'Arcade ID', 'Duration (ms)', 'Status', 'Metadata'
  ]);
  sheet.setFrozenRows(1);
  return sheet;
}

function logAnalyticsEvent_(eventType, data) {
  try {
    const ss = getAnalyticsSpreadsheet_();
    const sheet = ensureAnalyticsLogSheet_(ss);
    const d = data || {};

    let userEmail = '';
    try { userEmail = Session.getActiveUser().getEmail(); } catch (e) {}

    sheet.appendRow([
      new Date().toISOString(),
      d.sessionId || '',
      eventType,
      userEmail,
      d.arcadeId || '',
      d.durationMs || '',
      d.status || 'success',
      d.metadata ? JSON.stringify(d.metadata) : ''
    ]);
  } catch (e) {
    Logger.log('Analytics logging failed: ' + e.message);
  }
}

function logAnalyticsEventFromClient(eventType, data) {
  logAnalyticsEvent_(eventType, data);
  return { success: true };
}

function computeAnalyticsSummary() {
  const ss = getAnalyticsSpreadsheet_();
  const logSheet = ss.getSheetByName(ANALYTICS_LOG_SHEET);
  if (!logSheet || logSheet.getLastRow() <= 1) {
    return { message: 'No analytics data yet.' };
  }

  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const events = data.map(function(row) {
    let meta = {};
    try { meta = row[7] ? JSON.parse(row[7]) : {}; } catch (e) {}
    return {
      timestamp: new Date(row[0]),
      sessionId: row[1],
      eventType: row[2],
      userEmail: row[3],
      arcadeId: row[4],
      durationMs: row[5],
      status: row[6],
      metadata: meta
    };
  });

  const submissions = events.filter(function(e) { return e.eventType === 'form_submitted'; });
  const submissions7d = submissions.filter(function(e) { return e.timestamp >= sevenDaysAgo; });
  const submissions30d = submissions.filter(function(e) { return e.timestamp >= thirtyDaysAgo; });

  const allUsers = {};
  const users30d = {};
  submissions.forEach(function(e) { allUsers[e.userEmail] = true; });
  submissions30d.forEach(function(e) { users30d[e.userEmail] = true; });

  const teamCounts = {};
  const productCounts = {};
  const contentTypeCounts = {};
  submissions.forEach(function(e) {
    const team = (e.metadata.team || 'Unknown');
    const product = (e.metadata.product || 'Unknown');
    const ct = (e.metadata.contentType || 'Unknown');
    teamCounts[team] = (teamCounts[team] || 0) + 1;
    productCounts[product] = (productCounts[product] || 0) + 1;
    contentTypeCounts[ct] = (contentTypeCounts[ct] || 0) + 1;
  });

  const sessionDurations = submissions
    .map(function(e) { return e.metadata.sessionDurationMs; })
    .filter(function(d) { return d && d > 0; });
  const avgSessionDuration = sessionDurations.length
    ? Math.round(sessionDurations.reduce(function(a, b) { return a + b; }, 0) / sessionDurations.length)
    : 0;

  const sessionsWithStart = {};
  const sessionsWithSubmit = {};
  events.forEach(function(e) {
    if (e.eventType === 'session_start') sessionsWithStart[e.sessionId || e.timestamp] = true;
    if (e.eventType === 'form_submitted') sessionsWithSubmit[e.sessionId] = true;
  });
  const totalSessions = Object.keys(sessionsWithStart).length || 1;
  const abandonedSessions = totalSessions - Object.keys(sessionsWithSubmit).length;
  const abandonmentRate = Math.round((abandonedSessions / totalSessions) * 100);

  const genComplete = events.filter(function(e) { return e.eventType === 'ai_generation_complete'; });
  const genError = events.filter(function(e) { return e.eventType === 'ai_generation_error'; });
  const genStart = events.filter(function(e) { return e.eventType === 'ai_generation_start'; });
  const genSuccessRate = genStart.length
    ? Math.round((genComplete.length / genStart.length) * 100)
    : 0;
  const genLatencies = genComplete
    .map(function(e) { return e.durationMs || (e.metadata && e.metadata.durationMs); })
    .filter(function(d) { return d && d > 0; });
  const avgGenLatency = genLatencies.length
    ? Math.round(genLatencies.reduce(function(a, b) { return a + b; }, 0) / genLatencies.length)
    : 0;

  const fieldEditCounts = {};
  submissions.forEach(function(e) {
    (e.metadata.editedFieldNames || []).forEach(function(f) {
      fieldEditCounts[f] = (fieldEditCounts[f] || 0) + 1;
    });
  });
  const sortedEdits = Object.keys(fieldEditCounts).sort(function(a, b) {
    return fieldEditCounts[b] - fieldEditCounts[a];
  });

  const confidenceTotals = {};
  const confidenceCounts = {};
  genComplete.forEach(function(e) {
    const fc = e.metadata.fieldConfidences || {};
    Object.keys(fc).forEach(function(field) {
      const val = fc[field] === 'high' ? 3 : fc[field] === 'medium' ? 2 : 1;
      confidenceTotals[field] = (confidenceTotals[field] || 0) + val;
      confidenceCounts[field] = (confidenceCounts[field] || 0) + 1;
    });
  });
  const avgConfidence = {};
  Object.keys(confidenceTotals).forEach(function(field) {
    const avg = confidenceTotals[field] / confidenceCounts[field];
    avgConfidence[field] = avg >= 2.5 ? 'high' : avg >= 1.5 ? 'medium' : 'low';
  });

  const refinements = events.filter(function(e) { return e.eventType === 'refinement_requested'; });
  const refinementRate = submissions.length
    ? Math.round((refinements.length / submissions.length) * 100)
    : 0;

  const extractComplete = events.filter(function(e) { return e.eventType === 'guide_extraction_complete'; });
  const extractLatencies = extractComplete
    .map(function(e) { return e.durationMs || (e.metadata && e.metadata.durationMs); })
    .filter(function(d) { return d && d > 0; });
  const avgExtractLatency = extractLatencies.length
    ? Math.round(extractLatencies.reduce(function(a, b) { return a + b; }, 0) / extractLatencies.length)
    : 0;

  const allErrors = events.filter(function(e) { return e.status === 'error'; });
  const allApiCalls = events.filter(function(e) {
    return ['guide_extraction_start', 'ai_generation_start'].indexOf(e.eventType) !== -1;
  });
  const errorRate = allApiCalls.length
    ? Math.round((allErrors.length / allApiCalls.length) * 100)
    : 0;

  const errorsByType = {};
  allErrors.forEach(function(e) {
    errorsByType[e.eventType] = (errorsByType[e.eventType] || 0) + 1;
  });

  const dailySubmissions = {};
  submissions30d.forEach(function(e) {
    const day = e.timestamp.toISOString().split('T')[0];
    dailySubmissions[day] = (dailySubmissions[day] || 0) + 1;
  });

  const summary = {
    generatedAt: now.toISOString(),
    usage: {
      totalSubmissions: submissions.length,
      submissions7d: submissions7d.length,
      submissions30d: submissions30d.length,
      uniqueUsersAllTime: Object.keys(allUsers).length,
      uniqueUsers30d: Object.keys(users30d).length,
      byTeam: teamCounts,
      byProduct: productCounts,
      byContentType: contentTypeCounts,
      avgSessionDurationMs: avgSessionDuration,
      abandonmentRate: abandonmentRate + '%'
    },
    aiQuality: {
      avgConfidenceByField: avgConfidence,
      mostEditedFields: sortedEdits.slice(0, 10),
      leastEditedFields: sortedEdits.slice(-5).reverse(),
      generationSuccessRate: genSuccessRate + '%',
      avgGenerationLatencyMs: avgGenLatency,
      refinementRate: refinementRate + '%'
    },
    operations: {
      errorRate: errorRate + '%',
      errorsByType: errorsByType,
      avgExtractionTimeMs: avgExtractLatency,
      avgGenerationTimeMs: avgGenLatency,
      dailySubmissions30d: dailySubmissions
    }
  };

  writeAnalyticsSummarySheet_(ss, summary);
  return summary;
}

function writeAnalyticsSummarySheet_(ss, summary) {
  let sheet = ss.getSheetByName(ANALYTICS_SUMMARY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ANALYTICS_SUMMARY_SHEET);
  }
  sheet.clear();

  const rows = [];

  rows.push(['Analytics Summary', 'Generated: ' + summary.generatedAt]);
  rows.push(['', '']);

  rows.push(['USAGE METRICS', '']);
  rows.push(['Total Submissions (All Time)', summary.usage.totalSubmissions]);
  rows.push(['Submissions (Last 7 Days)', summary.usage.submissions7d]);
  rows.push(['Submissions (Last 30 Days)', summary.usage.submissions30d]);
  rows.push(['Unique Users (All Time)', summary.usage.uniqueUsersAllTime]);
  rows.push(['Unique Users (Last 30 Days)', summary.usage.uniqueUsers30d]);
  rows.push(['Avg Session Duration (ms)', summary.usage.avgSessionDurationMs]);
  rows.push(['Abandonment Rate', summary.usage.abandonmentRate]);
  rows.push(['', '']);

  rows.push(['--- Submissions by Team ---', '']);
  Object.keys(summary.usage.byTeam).forEach(function(team) {
    rows.push([team, summary.usage.byTeam[team]]);
  });
  rows.push(['', '']);

  rows.push(['--- Submissions by Product ---', '']);
  Object.keys(summary.usage.byProduct).forEach(function(product) {
    rows.push([product, summary.usage.byProduct[product]]);
  });
  rows.push(['', '']);

  rows.push(['--- Submissions by Content Type ---', '']);
  Object.keys(summary.usage.byContentType).forEach(function(ct) {
    rows.push([ct, summary.usage.byContentType[ct]]);
  });
  rows.push(['', '']);

  rows.push(['AI QUALITY METRICS', '']);
  rows.push(['Generation Success Rate', summary.aiQuality.generationSuccessRate]);
  rows.push(['Avg Generation Latency (ms)', summary.aiQuality.avgGenerationLatencyMs]);
  rows.push(['Refinement Request Rate', summary.aiQuality.refinementRate]);
  rows.push(['', '']);

  rows.push(['--- Most Edited Fields (AI Weakest) ---', '']);
  summary.aiQuality.mostEditedFields.forEach(function(field, i) {
    rows.push([(i + 1) + '. ' + field, '']);
  });
  rows.push(['', '']);

  rows.push(['--- Avg Confidence by Field ---', '']);
  Object.keys(summary.aiQuality.avgConfidenceByField).forEach(function(field) {
    rows.push([field, summary.aiQuality.avgConfidenceByField[field]]);
  });
  rows.push(['', '']);

  rows.push(['OPERATIONAL METRICS', '']);
  rows.push(['Error Rate', summary.operations.errorRate]);
  rows.push(['Avg Extraction Time (ms)', summary.operations.avgExtractionTimeMs]);
  rows.push(['Avg Generation Time (ms)', summary.operations.avgGenerationTimeMs]);
  rows.push(['', '']);

  rows.push(['--- Errors by Type ---', '']);
  Object.keys(summary.operations.errorsByType).forEach(function(type) {
    rows.push([type, summary.operations.errorsByType[type]]);
  });
  rows.push(['', '']);

  rows.push(['--- Daily Submissions (Last 30 Days) ---', '']);
  const days = Object.keys(summary.operations.dailySubmissions30d).sort();
  days.forEach(function(day) {
    rows.push([day, summary.operations.dailySubmissions30d[day]]);
  });

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  sheet.setColumnWidth(1, 320);
  sheet.setColumnWidth(2, 200);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
}

function getAnalyticsSummary() {
  return computeAnalyticsSummary();
}

function installAnalyticsSummaryTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) { return trigger.getHandlerFunction() === 'computeAnalyticsSummary'; })
    .forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });

  ScriptApp.newTrigger('computeAnalyticsSummary')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('Analytics summary trigger installed (hourly).');
}


function extractFirstTagText_(html, tagName) {
  const safeTag = String(tagName || '').replace(/[^\w-]/g, '');
  if (!safeTag) return '';

  const re = new RegExp(
    '<' + safeTag + '\\b[^>]*>([\\s\\S]*?)<\\/' + safeTag + '>',
    'i'
  );

  const match = String(html || '').match(re);
  return match ? cleanText(stripHtml_(match[1])) : '';
}

function extractTitle_(html) {
  return extractFirstTagText_(html, 'title')
    .replace(/\s*\|\s*Arcade\s*$/i, '')
    .replace(/\s*-\s*Arcade\s*$/i, '')
    .trim();
}
function extractBestGuideTitle_(html) {
  const candidates = [
    extractFirstTagText_(html, 'h1'),
    extractMetaContent_(html, 'property', 'og:title'),
    extractMetaContent_(html, 'name', 'twitter:title'),
    extractMetaContent_(html, 'name', 'title'),
    extractTitle_(html)
  ];

  for (let i = 0; i < candidates.length; i++) {
    const title = cleanText(candidates[i]);

    if (
      title &&
      title.length > 2 &&
      !/^arcade$/i.test(title) &&
      !/^interactive guide$/i.test(title)
    ) {
      return title;
    }
  }

  return '';
}

function extractMetaContent_(html, attrName, attrValue) {
  const source = String(html || '');
  const attr = String(attrName || '').replace(/[^\w-]/g, '');
  const value = String(attrValue || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (!attr || !value) return '';

  const re = new RegExp(
    '<meta\\b[^>]*\\b' + attr + '=["\\\']' + value + '["\\\'][^>]*>',
    'i'
  );

  const match = source.match(re);
  if (!match) return '';

  const tag = match[0];
  const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);

  return contentMatch ? decodeHtml_(contentMatch[1]) : '';
}
function extractLinks_(html) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const href = cleanText(decodeHtml_(match[1]));
    const label = cleanText(stripHtml_(match[2]));
    if (href) out.push({ label, href });
  }
  return out;
}

function extractImageAltTexts_(html) {
  const out = [];
  const re = /<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const alt = cleanText(decodeHtml_(match[1]));
    if (alt && !out.includes(alt)) out.push(alt);
  }
  return out;
}

function extractImageUrls_(html, baseUrl) {
  const re = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const seenKeys = {};
  const out = [];
  let match;

  while ((match = re.exec(String(html || ''))) !== null) {
    let src = decodeHtml_(match[1]);

    if (src.indexOf('watermark-logos/') !== -1) continue;

    const innerIdx = src.indexOf('/https://');
    if (innerIdx !== -1) {
      src = src.slice(innerIdx + 1);
    }

    src = src.replace(/&hotspot=[^&]*/g, '');

    let dedupKey = src;
    try {
      const qIdx = src.indexOf('image=');
      if (qIdx !== -1) {
        const imageParam = decodeURIComponent(src.slice(qIdx + 6).split('&')[0]);
        const pathEnd = imageParam.indexOf('?');
        dedupKey = pathEnd !== -1 ? imageParam.slice(0, pathEnd) : imageParam;
      }
    } catch (e) {}

    if (!seenKeys[dedupKey]) {
      seenKeys[dedupKey] = true;
      out.push(src);
    }
  }

  return out;
}

function extractStepsWithImages_(html) {
  const re = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?\balt=["']([^"']*)["'][^>]*>|<img\b[^>]*?\balt=["']([^"']*)["'][^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
  const seenKeys = {};
  const steps = [];
  let match;

  while ((match = re.exec(String(html || ''))) !== null) {
    let src = decodeHtml_(match[1] || match[4]);
    const alt = decodeHtml_(match[2] != null ? match[2] : (match[3] || ''));

    if (src.indexOf('watermark-logos/') !== -1) continue;

    const innerIdx = src.indexOf('/https://');
    if (innerIdx !== -1) src = src.slice(innerIdx + 1);
    src = src.replace(/&hotspot=[^&]*/g, '');

    let dedupKey = src;
    try {
      const qIdx = src.indexOf('image=');
      if (qIdx !== -1) {
        const imageParam = decodeURIComponent(src.slice(qIdx + 6).split('&')[0]);
        const pathEnd = imageParam.indexOf('?');
        dedupKey = pathEnd !== -1 ? imageParam.slice(0, pathEnd) : imageParam;
      }
    } catch (e) {}

    if (!seenKeys[dedupKey]) {
      seenKeys[dedupKey] = true;
      steps.push({ text: alt, imageUrl: src });
    }
  }

  return steps;
}

function fetchImagesAsBase64_(imageUrls) {
  const images = [];
  const errors = [];

  if (!imageUrls || !imageUrls.length) return { images: images, errors: errors };

  const requests = imageUrls.map(function(url) {
    return {
      url: url,
      method: 'get',
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Interactive Demo Intake Assistant' }
    };
  });

  const responses = UrlFetchApp.fetchAll(requests);

  for (let i = 0; i < responses.length; i++) {
    try {
      const resp = responses[i];
      const status = resp.getResponseCode();
      if (status < 200 || status >= 300) {
        errors.push('HTTP ' + status + ' for image ' + (i + 1));
        images.push(null);
        continue;
      }

      const contentType = resp.getHeaders()['Content-Type'] || '';
      if (contentType.indexOf('image/') !== 0) {
        errors.push('Not an image: ' + contentType);
        images.push(null);
        continue;
      }

      const blob = resp.getBlob();
      const bytes = blob.getBytes();

      if (bytes.length > 1024 * 1024) {
        errors.push('Image too large: ' + bytes.length + ' bytes');
        images.push(null);
        continue;
      }

      const base64 = Utilities.base64Encode(bytes);
      const mime = contentType.split(';')[0].trim() || 'image/png';

      images.push({
        base64: base64,
        mimeType: mime,
        sizeBytes: bytes.length
      });
    } catch (e) {
      errors.push('Image ' + (i + 1) + ': ' + (e.message || String(e)));
      images.push(null);
    }
  }

  return { images: images, errors: errors };
}

function extractPossibleStepTexts_(html) {
  const out = [];
  const tags = 'h1|h2|h3|p|li|figcaption|button|span|div';
  const re = new RegExp(`<(${tags})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const text = cleanText(stripHtml_(match[2]));
    if (text && text.length > 12 && text.length < 500 && !out.includes(text)) {
      out.push(text);
    }
    if (out.length >= 80) break;
  }
  return out;
}

function stripHtml_(html) {
  return decodeHtml_(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\\n')
    .replace(/<\/(p|li|h1|h2|h3|div|figcaption|button|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '));
}

function decodeHtml_(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
function buildMetadataPrompt(extractedGuide) {
  return `
You are helping prepare an intake submission for a Red Hat interactive demo.

Use only the guide content provided below. Do not invent product features, metrics, customer names, claims, or unsupported benefits.

The guide's step-by-step screenshots are attached in sequence. Treat them as if you are watching the full demo video from start to finish. Each image is labeled with its step number and text description. Go through every step in order and build a complete mental picture of:
- What product or solution is being demonstrated
- What the user does at each stage (install, configure, connect, create, deploy, etc.)
- What UI screens, dialogs, and navigation elements appear
- What the end result or outcome of the demo is
Use this full understanding of the demo flow to inform every field in your response — especially the description, product suggestions, and SEO keywords.

Return ONLY valid JSON that can be parsed by JSON.parse().
Do not include markdown fences.
Do not include comments.
Do not include explanation.
Do not include text before or after the JSON.
Use double quotes for all JSON keys and string values.
Do not use trailing commas.
Escape any quotes or special characters so the JSON remains valid.

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
  "other_products_other_text": "",
  "tdp_suggestion": "",
  "sales_tactic_suggestion": "",
  "marketing_program_suggestion": "",
  "group_suggestion": "",
  "tour_highlights": [],
  "field_confidence": {},
  "confidence_notes": [],
  "fields_needing_creator_confirmation": []
}

Description + tour highlights (these two fields are displayed together as one combined block — write them as a pair):

description_without_gid — the opening paragraph (high-level “what and why”):
- EXACTLY 2 sentences, 30-50 words. No third sentence allowed.
- Sentence 1: Focus on WHY this matters — what the user gains or what problem it solves. E.g., “This interactive demo helps [audience] [benefit/value] with [product].” or “See how [product] [solves problem / enables outcome] for [audience].”
- Sentence 2: Briefly state the scope at a high level WITHOUT naming steps. E.g., “It walks through the full [setup / onboarding / workflow] experience from start to finish.”
- BANNED patterns — if ANY appear, rewrite before returning:
  * Action verbs from the demo (installing, configuring, connecting, enabling, activating, generating, deploying, creating, setting up, signing in, reviewing, accepting, providing, migrating, building)
  * “It covers” followed by anything
  * “from [action] to [action]” (e.g., “from installing to generating”)
  * Listing actions with “and” (e.g., “installing X and connecting Y”)

tour_highlights — the bullet list (specific “how”):
- 3 to 6 bullets listing every key step, tool, and action the demo shows.
- Each bullet: sentence fragment starting with a verb or “How to...” phrasing.
- Be specific: name UI elements, dashboard panels, commands, config values, metrics, and tools visible in the screenshots.
- Order bullets to follow the demo flow from start to finish.
- Bad: “Shows the product dashboard” — too vague.
- Good: “Tracking per-pod cache hit rates, token throughput, and latency in Grafana” — specific.

The rule that connects them: description says the “what and why” with ZERO specifics. tour_highlights say ALL the specifics. There must be ZERO overlap. If the description names an action, the tour highlight for that action becomes redundant — so the description must never name actions.

CORRECT example (write them as a pair like this):
  description_without_gid: “See how Ansible Lightspeed brings AI-assisted automation to your Ansible workflows in Visual Studio Code. This interactive demo walks through the full setup and first-use experience from start to finish.”
  tour_highlights: [“Installing the Red Hat Ansible extension from the VS Code Extensions Marketplace”, “Enabling Ansible Lightspeed and inline suggestions in the extension settings”, “Connecting to Ansible Lightspeed using a Red Hat customer portal account”, “Activating the 90-day trial by accepting terms and conditions”, “Generating an Ansible playbook using natural language prompts”]

WRONG example (DO NOT do this):
  description_without_gid: “This guide walks developers through activating a 90-day trial of Ansible Lightspeed within Visual Studio Code. It covers the full setup from installing the extension and connecting a Red Hat account to generating AI-powered Ansible playbooks.”
  — WRONG: 3 banned verbs (installing, connecting, generating), uses “It covers”, uses “from X to Y” pattern. The tour_highlights would just repeat everything the description already said.

SEO rules:
- description_for_seo: 25-45 words, one concise search-focused summary of what the page helps users do.
- Identify one primary SEO keyword phrase. Use it naturally in description_for_seo.
- Include 5-8 SEO keyword phrases specific to the product, use case, and user intent.
- Always include the primary product name and its common variations as keywords.
- Avoid keyword stuffing, vague standalone keywords (“cloud”, “AI”), and unsupported claims.
- Do not include competitor names unless the guide content clearly mentions them.

Important field rules:
- Do not decide content_type_suggestion. Return an empty string for content_type_suggestion. The creator must choose Content Type.
- Do not decide vertical_suggestion. Return an empty string for vertical_suggestion. The creator must choose the Vertical.
- Do not decide event_or_project_suggestion. Return an empty string for event_or_project_suggestion. The creator must choose the Event or Project.
- Do not make a group_suggestion. Return an empty string for group_suggestion. The creator must decide grouping manually.
- Do not include Group, Vertical, or Event/Project in fields_needing_creator_confirmation.
- For language_suggestions, choose one or more values only from the allowed Language options.
- For primary_product_suggestion, choose only from the allowed Product options.
- For other_products_suggestion, choose zero or more values only from the allowed Product options.
- If the guide references a product not in the allowed list, include "Other" in other_products_suggestion AND set other_products_other_text to the actual product name(s) (e.g., "Veeam Kasten, Portworx"). If "Other" is selected but you cannot identify the product name, set other_products_other_text to "" and include "other_products_suggestion" in fields_needing_creator_confirmation.
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

field_confidence rules:
- Return a "field_confidence" object where each key is a field name and the value is "high", "medium", or "low".
- Include confidence for: demo_title, description_without_gid, description_for_seo, language_suggestions, seo_keywords, primary_product_suggestion, other_products_suggestion, tdp_suggestion, sales_tactic_suggestion, marketing_program_suggestion, cta_link_suggestions, tour_highlights.
- "high" = strong direct evidence from guide text and screenshots.
- "medium" = reasonable inference but some assumptions were made.
- "low" = weak or no evidence, best guess or taxonomy fallback used.
- Do not include confidence for content_type_suggestion, group_suggestion, vertical_suggestion, or event_or_project_suggestion.
- If a field uses a fallback value like "N/A" or "No", its confidence should be "low" unless the guide clearly supports that answer.

AI generation details rules:
* confidence_notes will be shown in the “How this draft was generated” section.
* Include 4 to 6 short notes.
* The FIRST note must be a brief demo flow summary: describe the full journey the demo takes the user through, from beginning to end, in one sentence. For example: “Demo walks through installing the Ansible VS Code extension, enabling Lightspeed, connecting a Red Hat account, activating a 90-day trial, and generating a playbook.”
* The SECOND note should mention what was visually identified from the screenshots that text alone would not reveal (e.g., product branding, UI layout, specific dialog screens, navigation paths).
* Remaining notes: focus on how the guide content was interpreted.
* Mention the main content signal, such as setup flow, migration flow, backup workflow, trial activation, or product overview.
* Mention any important assumptions made from the guide title, step text, or repeated product terms.
* Mention weak or missing evidence only if it affects review.
* Do not comment on every field.
* Do not mention fields left blank by instruction, such as Content Type or Group.
* Do not say “as per instructions.”
* Do not use generic notes like “Generated from guide content” or “Please review all fields.”
* Good notes explain what the model saw in the pulled content and how that shaped the draft.

Taxonomy fallback rules:
- If a field has "N/A" as an allowed option and the guide does not provide enough evidence, use "N/A".
- If a product is clearly mentioned but not available in the allowed Product options, use "Other" and add "Primary Product" or "Other Products" to fields_needing_creator_confirmation.
- Do not guess a Sales Tactic or Marketing Program only from the product name. Use the guide's use case, task, and audience as evidence.

CTA fallback rules:
- Always return exactly 3 CTA links.
- If there is not enough guide-specific evidence for 3 product-specific links, fill the remaining slots with approved general links from the catalog.
- Prefer this fallback order when relevant:
  1. Product trial or product learning hub
  2. Red Hat interactive labs
  3. Product documentation
  4. Product page
  5. All Red Hat products
- Never return fewer than 3 CTA links.
- Never use duplicate CTA URLs.

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

function normalizeCtaSuggestions_(draft) {
  const rawCtas = Array.isArray(draft.cta_link_suggestions)
    ? draft.cta_link_suggestions
    : [];

  const allowedUrlSet = new Set(CTA_LINK_CATALOG.map(item => item.url));
  const usedUrls = new Set();

  const normalized = [];

  rawCtas.forEach(item => {
    if (!item || !item.url) return;
    if (!allowedUrlSet.has(item.url)) return;
    if (usedUrls.has(item.url)) return;

    const catalogItem = CTA_LINK_CATALOG.find(c => c.url === item.url);

    normalized.push({
      label: item.label || catalogItem.label,
      url: item.url,
      reason: item.reason || 'Recommended next step'
    });

    usedUrls.add(item.url);
  });

  const primaryProduct = String(draft.primary_product_suggestion || '').trim();

  const productFallbacks = CTA_LINK_CATALOG.filter(item => {
    return item.products.includes(primaryProduct);
  });

  const generalFallbacks = CTA_LINK_CATALOG.filter(item => {
    return item.products.includes('general');
  });

  const fallbackCandidates = [
    ...productFallbacks,
    ...generalFallbacks
  ];

  fallbackCandidates.forEach(item => {
    if (normalized.length >= 3) return;
    if (usedUrls.has(item.url)) return;

    normalized.push({
      label: item.label,
      url: item.url,
      reason: 'Added as a fallback CTA'
    });

    usedUrls.add(item.url);
  });

  return normalized.slice(0, 3);
}

function normalizeDraft(draft) {
  return {
    demo_title: draft.demo_title || '',
    content_type_suggestion: '',
    description_without_gid: draft.description_without_gid || draft.description_with_gid || '',
    description_for_seo: draft.description_for_seo || '',
    language_suggestions: normalizeStringArray(draft.language_suggestions || draft.language_suggestion),
cta_link_suggestions: normalizeCtaSuggestions_(draft),
    seo_keywords: normalizeStringArray(draft.seo_keywords),
    vertical_suggestion: draft.vertical_suggestion || '',
    event_or_project_suggestion: draft.event_or_project_suggestion || '',
    primary_product_suggestion: draft.primary_product_suggestion || '',
    other_products_suggestion: normalizeStringArray(draft.other_products_suggestion),
    other_products_other_text: draft.other_products_other_text || '',
    tdp_suggestion: draft.tdp_suggestion || '',
    sales_tactic_suggestion: draft.sales_tactic_suggestion || '',
    marketing_program_suggestion: draft.marketing_program_suggestion || '',
    group_suggestion: '',
    tour_highlights: normalizeStringArray(draft.tour_highlights),
    field_confidence: draft.field_confidence && typeof draft.field_confidence === 'object'
      ? draft.field_confidence
      : {},
    confidence_notes: normalizeStringArray(draft.confidence_notes),
    fields_needing_creator_confirmation: normalizeStringArray(draft.fields_needing_creator_confirmation)
      .filter(field => String(field).toLowerCase() !== 'group')
  };
}
function testWorkflowWebhookHealth() {
  const webhookUrl = PropertiesService
    .getScriptProperties()
    .getProperty('WORKFLOW_WEBHOOK_URL');

  const secret = PropertiesService
    .getScriptProperties()
    .getProperty('AI_WORKFLOW_SECRET');

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      action: 'health',
      secret: secret
    }),
    muteHttpExceptions: true
  });

  Logger.log(response.getResponseCode());
  Logger.log(response.getContentText());
}
function debugWorkflowWebhookUrl() {
  const url = PropertiesService
    .getScriptProperties()
    .getProperty('WORKFLOW_WEBHOOK_URL');

  Logger.log(url);
}


function ensureWorkflowTrackingColumns_(sheet) {
  const neededHeaders = [
    'Global ID',
    'Duration',
    'Description for SEO',
    'AI Workflow Status',
    'AI Workflow Queued At',
    'AI Workflow Started At',
    'AI Workflow Completed At',
    'AI Workflow Error',
    'AI Workflow Result',
    'AI Workflow Attempts'
  ];

  let headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(header => String(header || '').trim());

  neededHeaders.forEach(header => {
    if (!headers.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers.push(header);
    }
  });
}

function getWorkflowColumnMap_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(header => String(header || '').trim());

  const map = {};
  headers.forEach((header, index) => {
    if (header) map[header] = index + 1;
  });

  return map;
}

function processPendingWorkflowRows() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    console.log('Workflow processor already running.');
    return;
  }

  try {
    const ss = getTargetSpreadsheet_();
    const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);

    if (!sheet) {
      throw new Error('Could not find sheet: ' + INTAKE_SUBMISSIONS_SHEET);
    }

    ensureWorkflowTrackingColumns_(sheet);

    const columnMap = getWorkflowColumnMap_(sheet);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) return;

    const values = sheet
      .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
      .getValues();

    let processed = 0;
    const maxPerRun = 3;

    for (let i = 0; i < values.length; i++) {
      if (processed >= maxPerRun) break;

      const rowIndex = i + 2;
      const status = String(values[i][columnMap['AI Workflow Status'] - 1] || '').trim();

      if (status !== 'Pending') continue;

      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Processing');
      sheet.getRange(rowIndex, columnMap['AI Workflow Started At']).setValue(new Date().toISOString());
      sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue('');

      try {
        const result = triggerOldCreatorWorkflow_(rowIndex);

        sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Completed');
        sheet.getRange(rowIndex, columnMap['AI Workflow Completed At']).setValue(new Date().toISOString());
        sheet.getRange(rowIndex, columnMap['AI Workflow Result']).setValue(formatWorkflowResult_(result));
      } catch (error) {
        const attempts = (Number(values[i][columnMap['AI Workflow Attempts'] - 1]) || 0) + 1;
        sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).setValue(attempts);
        sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue(error.message || String(error));
        if (attempts < 3) {
          sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Pending');
        } else {
          sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Failed');
        }
      }

      processed++;
    }
  } finally {
    lock.releaseLock();
  }
}

function resetFailedWorkflowRows() {
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);
  const columnMap = getWorkflowColumnMap_(sheet);
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const status = String(values[i][columnMap['AI Workflow Status'] - 1] || '').trim();
    if (status === 'Failed') {
      const rowIndex = i + 2;
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Pending');
      sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).setValue(0);
      sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue('');
      sheet.getRange(rowIndex, columnMap['AI Workflow Started At']).setValue('');
      count++;
    }
  }
  Logger.log('Reset ' + count + ' failed rows to Pending.');
  return count;
}

function formatWorkflowResult_(result) {
  const payload = result && result.result ? result.result : {};
  const parts = [];

  if (payload.number) parts.push('Request #' + payload.number);
  if (payload.action) parts.push(payload.action);

  return parts.length ? parts.join(' | ') : JSON.stringify(result).slice(0, 500);
}

function backfillSubmittedDates() {
  const SHEET_NAME = 'Request_Master';
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) { Logger.log('No data rows.'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  const receivedTsCol = headers.indexOf('Status Received Timestamp') + 1;
  const publishedTsCol = headers.indexOf('Status Published Timestamp') + 1;
  const openTsCol = headers.indexOf('Status Open Timestamp') + 1;
  const quarterCol = headers.indexOf('Quarter') + 1;

  if (!receivedTsCol) throw new Error('Column "Status Received Timestamp" not found.');

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  let filled = 0;

  for (let i = 0; i < data.length; i++) {
    const existing = String(data[i][receivedTsCol - 1] || '').trim();
    if (existing) continue;

    let fallback = '';
    if (publishedTsCol) fallback = String(data[i][publishedTsCol - 1] || '').trim();
    if (!fallback && openTsCol) fallback = String(data[i][openTsCol - 1] || '').trim();

    if (!fallback && quarterCol) {
      const q = String(data[i][quarterCol - 1] || '').trim();
      const m = q.match(/CY(\d{2})Q([1-4])/i);
      if (m) {
        const year = 2000 + parseInt(m[1], 10);
        const month = (parseInt(m[2], 10) - 1) * 3;
        fallback = new Date(year, month, 1).toISOString();
      }
    }

    if (fallback) {
      sheet.getRange(i + 2, receivedTsCol).setValue(fallback);
      filled++;
      Logger.log('Row ' + (i + 2) + ': set to ' + fallback);
    }
  }

  Logger.log('Backfill complete. Filled ' + filled + ' rows.');
}

function backfillDescriptions() {
  const SHEET_NAME = 'Request_Master';
  const ELIGIBLE_STATUSES = ['IE Published', 'IE Reviewed'];

  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('No data rows found.');
    return;
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  const statusCol = headers.indexOf('Status') + 1;
  const primaryUrlCol = headers.indexOf('Production Link') + 1;
  const fallbackUrlCol = headers.indexOf('Creation Link') + 1;
  const descCol = headers.indexOf('Demo Description') + 1;
  let durationCol = headers.indexOf('Duration') + 1;
  let seoDescCol = headers.indexOf('Description for SEO') + 1;
  if (!seoDescCol) seoDescCol = headers.indexOf('SEODescription') + 1;

  if (!statusCol || !primaryUrlCol || !descCol) {
    throw new Error('Required columns (Status, Production Link, Demo Description) not found in ' + SHEET_NAME);
  }

  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  const primaryUrls = sheet.getRange(2, primaryUrlCol, lastRow - 1, 1).getValues();
  const fallbackUrls = fallbackUrlCol ? sheet.getRange(2, fallbackUrlCol, lastRow - 1, 1).getValues() : [];
  const descriptions = sheet.getRange(2, descCol, lastRow - 1, 1).getValues();

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < primaryUrls.length; i++) {
    const status = String(statuses[i][0] || '').trim();
    const fallbackVal = fallbackUrls.length ? String(fallbackUrls[i][0] || '').trim() : '';
    const rawUrl = String(primaryUrls[i][0] || '').trim() || fallbackVal;
    const arcadeUrl = rawUrl.split(/[\n\r]/)[0].trim();
    const existingDesc = String(descriptions[i][0] || '').trim();
    const rowIndex = i + 2;

    if (!ELIGIBLE_STATUSES.includes(status) || !arcadeUrl || existingDesc) {
      skipped++;
      continue;
    }

    try {
      Logger.log('Row ' + rowIndex + ': Processing ' + arcadeUrl);

      const extractedGuide = fetchGuideContent_(arcadeUrl);

      let draft = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = generateDraftFromGuide({ extractedGuide: extractedGuide });
          draft = result.draft;
          break;
        } catch (parseErr) {
          if (attempt < 2) {
            Logger.log('Row ' + rowIndex + ': Retry (attempt ' + attempt + ' failed: ' + parseErr.message + ')');
          } else {
            throw parseErr;
          }
        }
      }

      const highlights = (draft.tour_highlights || [])
        .map(function(h) { return '• ' + h; })
        .join('\n');

      const combined = draft.description_without_gid +
        (highlights ? '\n\n' + highlights : '');

      sheet.getRange(rowIndex, descCol).setValue(combined);

      if (seoDescCol && draft.description_for_seo) {
        sheet.getRange(rowIndex, seoDescCol).setValue(draft.description_for_seo);
      }

      if (durationCol && extractedGuide.duration) {
        sheet.getRange(rowIndex, durationCol).setValue(extractedGuide.duration);
      }

      processed++;

      Logger.log('Row ' + rowIndex + ': Done');
    } catch (e) {
      errors++;
      Logger.log('Row ' + rowIndex + ': ERROR - ' + e.message);
    }
  }

  Logger.log('Backfill complete. Processed: ' + processed + ', Skipped: ' + skipped + ', Errors: ' + errors);
}

function buildGuideExtractionJson_(extractedGuide) {
  const stepTexts = extractedGuide.stepTexts || [];
  const stepsWithImages = extractedGuide.steps || [];
  const maxLen = Math.max(stepTexts.length, stepsWithImages.length);

  const steps = [];
  for (let i = 0; i < maxLen; i++) {
    const imgStep = stepsWithImages[i] || {};
    steps.push({
      stepNumber: i + 1,
      text: stepTexts[i] || imgStep.text || '',
      imageUrl: imgStep.imageUrl || '',
      imageAlt: imgStep.text || ''
    });
  }

  return {
    arcadeId: extractedGuide.arcadeId || '',
    title: extractedGuide.title || '',
    guideUrl: extractedGuide.guideUrl || '',
    shareUrl: extractedGuide.shareUrl || '',
    duration: extractedGuide.duration || '',
    steps: steps,
    links: extractedGuide.links || [],
    bodyText: extractedGuide.bodyText || '',
    extractedAt: new Date().toISOString()
  };
}
