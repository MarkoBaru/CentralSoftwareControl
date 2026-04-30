const express = require('express');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { SwissQRBill } = require('swissqrbill/pdf');
const db = require('../database');
const authMiddleware = require('../middleware/auth');
const { sendInvoiceMail } = require('../services/emailService');
const { generateQRReference, generateSCORReference, isQRIban } = require('../services/qrReference');

const router = express.Router();

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

function nextInvoiceNumber() {
  const s = getSettings();
  const prefix = s.invoice_prefix || 'RE';
  const year = new Date().getFullYear();
  const last = db.prepare(
    "SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY created_at DESC LIMIT 1"
  ).get(`${prefix}-${year}-%`);

  let seq = 1;
  if (last) {
    const parts = last.invoice_number.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Erzeugt einen QR-Bill-Datensatz aus Settings + Projekt + Rechnung.
 * - QR-IBAN: nutzt 27-stellige QR-Referenz (Mod-10)
 * - Standard-IBAN: nutzt SCOR (ISO 11649)
 */
function buildQRBillData(project, invoice, settings) {
  const iban = (settings.company_iban || '').replace(/\s/g, '');
  if (!iban) return null;

  const useQR = isQRIban(iban);
  const reference = useQR
    ? generateQRReference(invoice.invoice_number)
    : generateSCORReference(invoice.invoice_number);

  // Speichere Referenz auf der Rechnung (für Bank-Sync-Matching)
  if (!invoice.qr_reference) {
    db.prepare('UPDATE invoices SET qr_reference = ? WHERE id = ?').run(reference, invoice.id);
    invoice.qr_reference = reference;
  }

  // Auch in payment_settings.reference_number speichern, damit Bank-Sync diese Rechnung dem Projekt zuordnet
  db.prepare(`
    INSERT INTO payment_settings (project_id, reference_number, monthly_amount, billing_cycle)
    VALUES (?, ?, ?, 'monthly')
    ON CONFLICT(project_id) DO UPDATE SET reference_number = excluded.reference_number
  `).run(project.id, reference, invoice.amount);

  return {
    currency: 'CHF',
    amount: parseFloat(invoice.amount),
    reference,
    creditor: {
      name: settings.company_name || 'Firma',
      address: settings.company_address || '–',
      zip: settings.company_zip || '0000',
      city: settings.company_city || '–',
      account: iban,
      country: (settings.company_country || 'CH').substring(0, 2).toUpperCase(),
    },
    debtor: project.client_name ? {
      name: project.client_name,
      address: project.client_address || '–',
      zip: project.client_zip || '0000',
      city: project.client_city || '–',
      country: 'CH',
    } : undefined,
    message: `Rechnung ${invoice.invoice_number}`,
  };
}

// Generiert PDF-Buffer für eine Rechnung mit Schweizer QR-Bill-Zahlteil
function generatePDF(project, invoice, settings) {
  return new Promise((resolve, reject) => {
    // autoFirstPage: false – swissqrbill fügt eigene Seite ein wenn nötig
    const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.addPage();

    const company = settings.company_name || 'Control Dashboard';
    const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

    // Header: Firmenname
    doc.fontSize(20).font('Helvetica-Bold').text(company, { align: 'right' });
    if (settings.company_address) doc.fontSize(10).font('Helvetica').text(settings.company_address, { align: 'right' });
    if (settings.company_zip && settings.company_city) doc.fontSize(10).text(`${settings.company_zip} ${settings.company_city}`, { align: 'right' });
    if (settings.company_email) doc.fontSize(10).text(settings.company_email, { align: 'right' });

    doc.moveDown(2);

    // Empfänger
    doc.fontSize(11).font('Helvetica-Bold').text(project.client_name);
    if (project.client_email) doc.fontSize(10).font('Helvetica').text(project.client_email);

    doc.moveDown(2);

    // Rechnungstitel + Info
    doc.fontSize(16).font('Helvetica-Bold').text(`Rechnung ${invoice.invoice_number}`);
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica')
      .text(`Datum: ${new Date(invoice.created_at).toLocaleDateString('de-CH')}`)
      .text(`Fällig bis: ${invoice.due_date || '–'}`)
      .text(`Zeitraum: ${monthNames[invoice.period_month - 1]} ${invoice.period_year}`);

    doc.moveDown(1.5);

    // Tabelle
    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 25).fill('#f3f4f6');
    doc.fill('#374151').fontSize(10).font('Helvetica-Bold')
      .text('Beschreibung', 60, tableTop + 8)
      .text('Betrag', 480, tableTop + 8, { width: 60, align: 'right' });

    const rowTop = tableTop + 30;
    doc.fill('#111827').font('Helvetica').fontSize(10)
      .text(`${project.name} – ${monthNames[invoice.period_month - 1]} ${invoice.period_year}`, 60, rowTop)
      .text(`CHF ${parseFloat(invoice.amount).toFixed(2)}`, 480, rowTop, { width: 60, align: 'right' });

    doc.moveDown(3);

    // Summe
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold')
      .text('Total CHF', 400, doc.y)
      .text(parseFloat(invoice.amount).toFixed(2), 480, doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });

    doc.moveDown(1);

    if (settings.invoice_footer) {
      doc.moveDown(1);
      doc.fontSize(9).fill('#6b7280').text(settings.invoice_footer, { align: 'center' });
    }
    if (settings.company_uid) {
      doc.fontSize(9).fill('#6b7280').text(`UID: ${settings.company_uid}`, { align: 'center' });
    }

    // Schweizer QR-Rechnung als Zahlteil unten anhängen
    try {
      const qrData = buildQRBillData(project, invoice, settings);
      if (qrData) {
        const qrBill = new SwissQRBill(qrData);
        qrBill.attachTo(doc);
      }
    } catch (err) {
      console.error('[Invoices] SwissQRBill-Fehler:', err.message);
      // Fallback: einfache Zahlungsinfo
      doc.moveDown(1);
      doc.fontSize(10).fill('#111827').font('Helvetica')
        .text(`IBAN: ${settings.company_iban || '–'}`)
        .text(`Bank: ${settings.company_bank || '–'}`)
        .text(`Referenz: ${invoice.invoice_number}`);
    }

    doc.end();
  });
}

// GET /api/invoices - Alle Rechnungen
router.get('/', authMiddleware, (req, res) => {
  const invoices = db.prepare(`
    SELECT i.*, p.name as project_name, p.client_name, p.client_email
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
    ORDER BY i.created_at DESC
  `).all();
  res.json(invoices);
});

// GET /api/invoices/stats - Statistiken
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
  const totalAmount = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM invoices WHERE status != 'cancelled'").get().s;
  const paid = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM invoices WHERE status = 'paid'").get().s;
  const outstanding = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM invoices WHERE status IN ('sent', 'overdue')").get().s;
  res.json({ total, totalAmount, paid, outstanding });
});

// GET /api/invoices/:id/pdf - PDF herunterladen
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(invoice.project_id);
  const settings = getSettings();
  try {
    const pdfBuffer = await generatePDF(project, invoice, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices - Rechnung erstellen
router.post('/', authMiddleware, async (req, res) => {
  const { project_id, amount, period_month, period_year, due_date, notes, send_email } = req.body;
  if (!project_id || !amount || !period_month || !period_year) {
    return res.status(400).json({ error: 'project_id, amount, period_month, period_year erforderlich' });
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });

  const id = uuidv4();
  const invoice_number = nextInvoiceNumber();
  const settings = getSettings();
  const dueDays = parseInt(settings.invoice_due_days || '30');
  const computedDueDate = due_date || (() => {
    const d = new Date(); d.setDate(d.getDate() + dueDays); return d.toISOString().split('T')[0];
  })();

  db.prepare(`
    INSERT INTO invoices (id, invoice_number, project_id, amount, period_month, period_year, due_date, notes, status, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, invoice_number, project_id, parseFloat(amount), parseInt(period_month), parseInt(period_year), computedDueDate, notes || null, 'sent');

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), project_id, 'invoice_created', `Rechnung ${invoice_number} erstellt`, req.user.name
  );

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);

  if (send_email && project.client_email) {
    try {
      const pdfBuffer = await generatePDF(project, invoice, settings);
      await sendInvoiceMail(project, invoice, pdfBuffer);
      db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
        uuidv4(), project_id, 'invoice_sent', `Rechnung ${invoice_number} per E-Mail gesendet`, req.user.name
      );
    } catch (err) {
      console.error('[Invoices] E-Mail-Fehler:', err.message);
    }
  }

  res.status(201).json(invoice);
});

// PATCH /api/invoices/:id/status - Status aktualisieren
router.patch('/:id/status', authMiddleware, (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Rechnung nicht gefunden' });

  const { status } = req.body;
  const validStatus = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
  if (!validStatus.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });

  const paidAt = status === 'paid' ? "datetime('now')" : 'NULL';
  db.prepare(`UPDATE invoices SET status = ?, paid_at = ${paidAt} WHERE id = ?`).run(status, req.params.id);

  if (status === 'paid') {
    // Zahlung automatisch als bezahlt markieren
    const { checkAndUpdateBlockStatus } = require('../services/cronService');
    const existing = db.prepare(
      "SELECT id FROM payments WHERE project_id = ? AND period_month = ? AND period_year = ? AND status = 'confirmed'"
    ).get(invoice.project_id, invoice.period_month, invoice.period_year);
    if (!existing) {
      db.prepare(`INSERT INTO payments (id, project_id, amount, reference_number, payment_date, period_month, period_year, status)
        VALUES (?, ?, ?, ?, date('now'), ?, ?, 'confirmed')`
      ).run(uuidv4(), invoice.project_id, invoice.amount, invoice.invoice_number, invoice.period_month, invoice.period_year);
    }
    checkAndUpdateBlockStatus(invoice.project_id);
  }

  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
});

// POST /api/invoices/:id/send - Rechnung per E-Mail erneut senden
router.post('/:id/send', authMiddleware, async (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(invoice.project_id);
  const settings = getSettings();
  try {
    const pdfBuffer = await generatePDF(project, invoice, settings);
    const ok = await sendInvoiceMail(project, invoice, pdfBuffer);
    if (!ok) return res.status(400).json({ error: 'SMTP nicht konfiguriert' });
    db.prepare("UPDATE invoices SET sent_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(), invoice.project_id, 'invoice_sent', `Rechnung ${invoice.invoice_number} erneut gesendet`, req.user.name
    );
    res.json({ message: 'Rechnung gesendet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Rechnung gelöscht' });
});

/**
 * Wird vom Cron-Job aufgerufen: erstellt eine wiederkehrende Rechnung
 * inkl. PDF-Versand wenn client_email gesetzt ist und SMTP konfiguriert ist.
 */
async function createRecurringInvoice(project_id, amount, period_month, period_year) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project) return null;

  const settings = getSettings();
  const dueDays = parseInt(settings.invoice_due_days || '30');
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const id = uuidv4();
  const invoice_number = nextInvoiceNumber();

  db.prepare(`
    INSERT INTO invoices (id, invoice_number, project_id, amount, period_month, period_year, due_date, status, sent_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', datetime('now'), ?)
  `).run(id, invoice_number, project_id, parseFloat(amount), period_month, period_year, dueDate.toISOString().split('T')[0], 'Automatisch generiert');

  db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), project_id, 'invoice_auto_created', `Rechnung ${invoice_number} automatisch erstellt`, 'System (Cron)'
  );

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);

  if (project.client_email) {
    try {
      const pdfBuffer = await generatePDF(project, invoice, settings);
      const ok = await sendInvoiceMail(project, invoice, pdfBuffer);
      if (ok) {
        db.prepare('INSERT INTO activity_log (id, project_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)').run(
          uuidv4(), project_id, 'invoice_sent', `Rechnung ${invoice_number} per E-Mail gesendet`, 'System (Cron)'
        );
      }
    } catch (err) {
      console.error('[Invoices] Auto-Versand-Fehler:', err.message);
    }
  }

  return invoice;
}

module.exports = router;
module.exports.createRecurringInvoice = createRecurringInvoice;
