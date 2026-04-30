const nodemailer = require('nodemailer');
const db = require('../database');

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

function createTransporter() {
  const s = getSettings();
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) return null;

  return nodemailer.createTransport({
    host: s.smtp_host,
    port: parseInt(s.smtp_port || '587'),
    secure: s.smtp_secure === 'true',
    auth: { user: s.smtp_user, pass: s.smtp_pass },
  });
}

async function sendMail({ to, subject, html, attachments }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[Email] SMTP nicht konfiguriert – E-Mail nicht gesendet:', subject);
    return false;
  }
  const s = getSettings();
  const from = s.smtp_from || s.smtp_user;
  await transporter.sendMail({ from, to, subject, html, attachments });
  return true;
}

async function sendBlockNotification(project) {
  if (!project.client_email) return;
  const s = getSettings();
  const company = s.company_name || 'Control Dashboard';
  await sendMail({
    to: project.client_email,
    subject: `[${company}] Ihr Zugang wurde gesperrt – ${project.name}`,
    html: `
      <h2>Zugang gesperrt</h2>
      <p>Sehr geehrte/r ${project.client_name},</p>
      <p>der Zugang zu <strong>${project.name}</strong>${project.url ? ` (<a href="${project.url}">${project.url}</a>)` : ''} wurde aufgrund einer ausstehenden Zahlung <strong>gesperrt</strong>.</p>
      <p>Bitte begleichen Sie Ihre offene Rechnung, um den Zugang wiederherzustellen.</p>
      <p>Bei Fragen wenden Sie sich bitte an uns.</p>
      <p>Mit freundlichen Grüssen<br/>${company}</p>
    `,
  });
}

async function sendUnblockNotification(project) {
  if (!project.client_email) return;
  const s = getSettings();
  const company = s.company_name || 'Control Dashboard';
  await sendMail({
    to: project.client_email,
    subject: `[${company}] Ihr Zugang wurde wiederhergestellt – ${project.name}`,
    html: `
      <h2>Zugang wiederhergestellt</h2>
      <p>Sehr geehrte/r ${project.client_name},</p>
      <p>Vielen Dank für Ihre Zahlung. Der Zugang zu <strong>${project.name}</strong>${project.url ? ` (<a href="${project.url}">${project.url}</a>)` : ''} wurde wieder <strong>freigegeben</strong>.</p>
      <p>Mit freundlichen Grüssen<br/>${company}</p>
    `,
  });
}

async function sendInvoiceMail(project, invoice, pdfBuffer) {
  if (!project.client_email) return false;
  const s = getSettings();
  const company = s.company_name || 'Control Dashboard';
  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return sendMail({
    to: project.client_email,
    subject: `Rechnung ${invoice.invoice_number} – ${monthNames[invoice.period_month - 1]} ${invoice.period_year}`,
    html: `
      <h2>Rechnung ${invoice.invoice_number}</h2>
      <p>Sehr geehrte/r ${project.client_name},</p>
      <p>anbei erhalten Sie Ihre Rechnung für <strong>${project.name}</strong> (${monthNames[invoice.period_month - 1]} ${invoice.period_year}).</p>
      <p><strong>Betrag:</strong> CHF ${invoice.amount.toFixed(2)}</p>
      <p><strong>Fällig bis:</strong> ${invoice.due_date || '–'}</p>
      <p>Bitte überweisen Sie den Betrag mit dem Verwendungszweck / Referenz: <strong>${invoice.invoice_number}</strong></p>
      <p>Mit freundlichen Grüssen<br/>${company}</p>
    `,
    attachments: pdfBuffer ? [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer }] : [],
  });
}

module.exports = { sendMail, sendBlockNotification, sendUnblockNotification, sendInvoiceMail };
