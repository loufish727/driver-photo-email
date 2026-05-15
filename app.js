const EMAIL_RECIPIENTS = ['louie.fisher@taylormetal.com', 'inbox@taylormetal.com'];
const EMAIL_CC = ['salemtrucking@taylormetal.com'];
const PENDING_EMAIL_KEY = 'driver-photo-email-pending';

const form = document.querySelector('#emailForm');
const result = document.querySelector('#result');
const submitButton = document.querySelector('#submitButton');
const defaultEmailButton = document.querySelector('#defaultEmailButton');
const sentPanel = document.querySelector('#sentPanel');
const sentMessage = document.querySelector('#sentMessage');
const startAnotherButton = document.querySelector('#startAnotherButton');
const reopenEmailButton = document.querySelector('#reopenEmailButton');

let lastOpenUrl = '';

showPendingEmailIfNeeded();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  stageEmail('gmail');
});

defaultEmailButton.addEventListener('click', () => {
  stageEmail('default');
});

function stageEmail(openMode) {
  result.className = 'result';
  result.textContent = '';

  const formData = new FormData(form);
  const workOrder = String(formData.get('workOrder') || '').trim();
  const driverName = String(formData.get('driverName') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  if (!workOrder) {
    result.classList.add('error');
    result.textContent = 'Work order number is required.';
    return;
  }

  const now = new Date();
  const erpOrders = extractErpOrders(workOrder);
  const erpTags = erpOrders.map((order) => `SO[${order}]`);
  const subject = `Work Order: ${workOrder} Photos`;
  const body = [
    `Work order: ${workOrder}`,
    driverName ? `Driver: ${driverName}` : '',
    `Date/time: ${now.toLocaleString()}`,
    notes ? `Notes: ${notes}` : '',
    '',
    'Photos attached from phone.',
    '',
    '',
    '',
    '',
    '',
    ...erpTags
  ].filter(Boolean).join('\n');

  const mailtoUrl = buildMailto({
    recipients: EMAIL_RECIPIENTS,
    cc: EMAIL_CC,
    subject,
    body
  });
  const gmailUrl = buildGmailUrl({
    recipients: EMAIL_RECIPIENTS,
    cc: EMAIL_CC,
    subject,
    body
  });
  const openUrl = openMode === 'gmail' ? gmailUrl : mailtoUrl;
  const pendingEmail = {
    workOrder,
    erpOrders,
    driverName,
    notes,
    createdAt: now.toISOString(),
    mailtoUrl,
    gmailUrl,
    openUrl,
    openMode
  };

  localStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify(pendingEmail));
  showPendingEmail(pendingEmail);
  window.location.href = openUrl;
}

startAnotherButton.addEventListener('click', () => {
  localStorage.removeItem(PENDING_EMAIL_KEY);
  lastOpenUrl = '';
  result.className = 'result';
  result.textContent = '';
  sentPanel.hidden = true;
  form.hidden = false;
  form.reset();
  document.querySelector('#workOrder').focus();
});

reopenEmailButton.addEventListener('click', () => {
  if (lastOpenUrl) {
    window.location.href = lastOpenUrl;
  }
});

function buildMailto({ recipients, cc = [], subject, body }) {
  const params = new URLSearchParams({
    subject,
    body
  });

  if (cc.length > 0) {
    params.set('cc', cc.join(','));
  }

  return `mailto:${recipients.map(encodeURIComponent).join(',')}?${params.toString()}`;
}

function buildGmailUrl({ recipients, cc = [], subject, body }) {
  const gmailParams = new URLSearchParams({
    to: recipients.join(','),
    su: subject,
    body
  });
  const appParams = new URLSearchParams({
    to: recipients.join(','),
    subject,
    body
  });

  if (cc.length > 0) {
    gmailParams.set('cc', cc.join(','));
    appParams.set('cc', cc.join(','));
  }

  const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&${gmailParams.toString()}`;

  if (/Android/i.test(navigator.userAgent)) {
    return `intent://co?${appParams.toString()}#Intent;scheme=mailto;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent(webGmailUrl)};end`;
  }

  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `googlegmail://co?${appParams.toString()}`;
  }

  return webGmailUrl;
}

function extractErpOrders(value) {
  const text = String(value || '').toUpperCase();
  const orders = new Set();
  const patterns = [
    /\b(?:S|PR|CF)-?\d+\b/g,
    /(?<![A-Z-])\b\d{5,}\b/g
  ];

  patterns.forEach((pattern) => {
    let match = pattern.exec(text);
    while (match) {
      orders.add(match[0].replace(/[^A-Z0-9-]/g, ''));
      match = pattern.exec(text);
    }
  });

  if (orders.size === 0) {
    const fallback = text.replace(/[^A-Z0-9._-]/g, '');
    if (fallback) orders.add(fallback);
  }

  return [...orders];
}

function showPendingEmailIfNeeded() {
  try {
    const pendingEmail = JSON.parse(localStorage.getItem(PENDING_EMAIL_KEY));
    if (pendingEmail?.workOrder && (pendingEmail?.openUrl || pendingEmail?.mailtoUrl)) {
      showPendingEmail(pendingEmail);
    }
  } catch {
    localStorage.removeItem(PENDING_EMAIL_KEY);
  }
}

function showPendingEmail(pendingEmail) {
  lastOpenUrl = pendingEmail.openUrl || pendingEmail.gmailUrl || pendingEmail.mailtoUrl;
  form.hidden = true;
  sentPanel.hidden = false;
  result.className = 'result success';
  result.innerHTML = `
    <strong>${pendingEmail.openMode === 'gmail' ? 'Gmail opened.' : 'Email app opened.'}</strong>
    <span>Attach/take photos in the email app, send it, then return here only when you need another work order.</span>
  `;

  sentMessage.textContent = `Work order ${pendingEmail.workOrder} is staged. After you send it, do not press Reopen unless the email did not open or you need to retry.`;
}
