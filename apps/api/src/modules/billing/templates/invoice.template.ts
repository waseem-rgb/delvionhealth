export interface InvoiceTemplateData {
  tenant: { name: string; phone?: string | null; email?: string | null; gstin?: string };
  patient: { fullName: string; mrn: string; phone?: string | null; email?: string | null; address?: string | null };
  invoice: {
    invoiceNumber: string;
    createdAt: Date;
    dueDate?: Date | null;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    status: string;
  };
  order: {
    orderNumber: string;
    orderItems: Array<{ testName: string; price: number; quantity: number }>;
  };
  payments: Array<{ amount: number; method: string; paidAt: Date; reference?: string | null }>;
  amountPaid: number;
  balance: number;
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function generateInvoiceHtml(data: InvoiceTemplateData): string {
  const isPaid = data.invoice.status === "PAID";
  const isOverdue =
    !isPaid &&
    data.invoice.dueDate != null &&
    new Date(data.invoice.dueDate) < new Date() &&
    data.invoice.status !== "CANCELLED";

  const paymentsHtml =
    data.payments.length > 0
      ? `<table class="pay-table">
        <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead>
        <tbody>
          ${data.payments
            .map(
              (p) => `<tr>
            <td>${fmtDate(p.paidAt)}</td>
            <td>${p.method}</td>
            <td>${p.reference ?? "—"}</td>
            <td style="text-align:right;color:#16a34a;font-weight:600">${fmt(Number(p.amount))}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>`
      : `<p style="color:#94a3b8;font-size:12px">No payments recorded yet.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1B4F8A; padding-bottom: 16px; margin-bottom: 24px; }
  .lab-name { font-size: 22px; font-weight: 800; color: #1B4F8A; letter-spacing: -0.5px; }
  .lab-contact { font-size: 11px; color: #64748b; margin-top: 4px; }
  .invoice-title { text-align: right; }
  .invoice-title h2 { font-size: 18px; font-weight: 700; color: #1B4F8A; }
  .invoice-title .inv-num { font-size: 13px; color: #64748b; margin-top: 4px; font-family: monospace; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .info-box h4 { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .info-box p { font-size: 12px; line-height: 1.6; color: #374151; }
  .info-box .name { font-weight: 700; font-size: 14px; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f8fafc; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .totals { margin-left: auto; width: 280px; margin-bottom: 24px; }
  .totals tr td { padding: 5px 10px; border: none; }
  .totals tr.total-row td { font-size: 15px; font-weight: 800; color: #1B4F8A; border-top: 2px solid #1B4F8A; padding-top: 8px; }
  .balance-section { padding: 16px; border-radius: 8px; margin-bottom: 24px; }
  .balance-section.paid { background: #f0fdf4; border: 1px solid #86efac; }
  .balance-section.due { background: #fef2f2; border: 1px solid #fca5a5; }
  .balance-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .balance-value { font-size: 22px; font-weight: 800; margin-top: 4px; }
  .balance-section.paid .balance-label { color: #166534; }
  .balance-section.paid .balance-value { color: #16a34a; }
  .balance-section.due .balance-label { color: #991b1b; }
  .balance-section.due .balance-value { color: #dc2626; }
  .pay-table th, .pay-table td { font-size: 12px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; margin-top: 20px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
  ${isPaid ? `.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(22,163,74,0.12); white-space: nowrap; z-index: 0; pointer-events: none; letter-spacing: 8px; }` : ""}
  ${isOverdue ? `.overdue-badge { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-left: 8px; }` : ""}
</style>
</head>
<body>
  ${isPaid ? '<div class="watermark">PAID</div>' : ""}

  <div class="header">
    <div>
      <div class="lab-name">${data.tenant.name}</div>
      <div class="lab-contact">
        ${data.tenant.phone ? `📞 ${data.tenant.phone}` : ""} ${data.tenant.email ? `✉ ${data.tenant.email}` : ""}
        ${data.tenant.gstin ? `<br/>GSTIN: ${data.tenant.gstin}` : ""}
      </div>
    </div>
    <div class="invoice-title">
      <h2>TAX INVOICE ${isOverdue ? '<span class="overdue-badge">OVERDUE</span>' : ""}</h2>
      <div class="inv-num">${data.invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">Issued: ${fmtDate(data.invoice.createdAt)}</div>
      ${data.invoice.dueDate ? `<div style="font-size:11px;color:${isOverdue ? "#dc2626" : "#64748b"};margin-top:2px">Due: ${fmtDate(data.invoice.dueDate)}</div>` : ""}
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Billed To</h4>
      <p class="name">${data.patient.fullName}</p>
      <p>MRN: ${data.patient.mrn}</p>
      ${data.patient.phone ? `<p>📞 ${data.patient.phone}</p>` : ""}
      ${data.patient.email ? `<p>✉ ${data.patient.email}</p>` : ""}
      ${data.patient.address ? `<p>${data.patient.address}</p>` : ""}
    </div>
    <div class="info-box">
      <h4>Order Details</h4>
      <p>Order #: <strong>${data.order.orderNumber}</strong></p>
      <p>Invoice Date: ${fmtDate(data.invoice.createdAt)}</p>
      <p>Status: <strong>${data.invoice.status}</strong></p>
    </div>
  </div>

  <div class="section-title">Test Services</div>
  <table>
    <thead>
      <tr>
        <th>Test / Service</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${data.order.orderItems
        .map(
          (item) => `<tr>
        <td>${item.testName}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${fmt(item.price)}</td>
        <td style="text-align:right;font-weight:600">${fmt(item.price * item.quantity)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td style="color:#64748b">Subtotal</td>
      <td style="text-align:right">${fmt(data.invoice.subtotal)}</td>
    </tr>
    ${data.invoice.discount > 0 ? `<tr><td style="color:#ef4444">Discount</td><td style="text-align:right;color:#ef4444">−${fmt(data.invoice.discount)}</td></tr>` : ""}
    ${data.invoice.tax > 0 ? `<tr><td style="color:#64748b">Tax / GST</td><td style="text-align:right">${fmt(data.invoice.tax)}</td></tr>` : ""}
    <tr class="total-row">
      <td>Total</td>
      <td style="text-align:right">${fmt(data.invoice.total)}</td>
    </tr>
  </table>

  ${
    data.payments.length > 0
      ? `<div class="section-title">Payment History</div>${paymentsHtml}`
      : ""
  }

  <div class="balance-section ${data.balance <= 0 ? "paid" : "due"}">
    <div class="balance-label">${data.balance <= 0 ? "✅ Fully Paid" : "Balance Due"}</div>
    <div class="balance-value">${fmt(Math.abs(data.balance))}</div>
    ${data.amountPaid > 0 ? `<div style="font-size:12px;margin-top:4px;opacity:0.8">Amount paid: ${fmt(data.amountPaid)}</div>` : ""}
  </div>

  <div class="footer">
    <div>Thank you for choosing ${data.tenant.name}. Payment due within 30 days of invoice date.</div>
    <div>Generated on ${fmtDate(new Date())}</div>
  </div>
</body>
</html>`;
}
