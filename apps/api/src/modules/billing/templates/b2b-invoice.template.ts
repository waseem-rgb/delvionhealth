export interface B2BInvoiceTemplateData {
  tenant: {
    name: string;
    phone?: string | null;
    email?: string | null;
    gstin?: string;
    address?: string;
    bankName?: string;
    bankAccount?: string;
    bankIfsc?: string;
  };
  organization: {
    name: string;
    code: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    gstNumber?: string | null;
  };
  invoice: {
    invoiceNumber: string;
    generatedAt: Date;
    dueDate: Date;
    periodStart: Date;
    periodEnd: Date;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    status: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountPct: number;
    totalPrice: number;
  }>;
  payments: Array<{
    amount: number;
    paymentMode: string;
    paymentDate: Date;
    referenceNo?: string | null;
  }>;
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function generateB2BInvoiceHtml(data: B2BInvoiceTemplateData): string {
  const isPaid = data.invoice.status === "B2B_PAID";
  const balance = data.invoice.totalAmount - data.invoice.paidAmount;

  const lineItemsHtml = data.lineItems
    .map(
      (li, idx) => `
      <tr>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; max-width:300px; word-break:break-word;">${li.description}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${li.quantity}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:right;">${fmt(li.unitPrice)}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${li.discountPct > 0 ? li.discountPct + "%" : "-"}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:500;">${fmt(li.totalPrice)}</td>
      </tr>`,
    )
    .join("");

  const paymentsHtml =
    data.payments.length > 0
      ? `
      <div style="margin-top:24px;">
        <h3 style="font-size:14px; color:#374151; margin:0 0 8px;">Payments Received</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px; text-align:left; border-bottom:2px solid #e5e7eb;">Date</th>
              <th style="padding:8px 12px; text-align:left; border-bottom:2px solid #e5e7eb;">Mode</th>
              <th style="padding:8px 12px; text-align:left; border-bottom:2px solid #e5e7eb;">Reference</th>
              <th style="padding:8px 12px; text-align:right; border-bottom:2px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.payments
              .map(
                (p) => `
              <tr>
                <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;">${fmtDate(p.paymentDate)}</td>
                <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;">${p.paymentMode}</td>
                <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;">${p.referenceNo ?? "-"}</td>
                <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:right;">${fmt(p.amount)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
      : "";

  const bankDetailsHtml =
    data.tenant.bankName
      ? `
      <div style="margin-top:24px; padding:16px; background:#f9fafb; border-radius:8px;">
        <h3 style="font-size:14px; color:#374151; margin:0 0 8px;">Bank Details</h3>
        <table style="font-size:13px; color:#6b7280;">
          <tr><td style="padding:2px 12px 2px 0; font-weight:500;">Bank Name:</td><td>${data.tenant.bankName}</td></tr>
          ${data.tenant.bankAccount ? `<tr><td style="padding:2px 12px 2px 0; font-weight:500;">Account No:</td><td>${data.tenant.bankAccount}</td></tr>` : ""}
          ${data.tenant.bankIfsc ? `<tr><td style="padding:2px 12px 2px 0; font-weight:500;">IFSC Code:</td><td>${data.tenant.bankIfsc}</td></tr>` : ""}
        </table>
      </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 0; font-size: 14px; }
    ${isPaid ? `.watermark { position:fixed; top:40%; left:30%; font-size:80px; color:rgba(22,163,74,0.08); transform:rotate(-30deg); font-weight:800; z-index:0; }` : ""}
  </style>
</head>
<body>
  ${isPaid ? '<div class="watermark">PAID</div>' : ""}

  <!-- Header -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
    <div>
      <h1 style="margin:0; font-size:22px; color:#0F1923;">${data.tenant.name}</h1>
      ${data.tenant.address ? `<p style="margin:4px 0 0; color:#6b7280; font-size:13px;">${data.tenant.address}</p>` : ""}
      ${data.tenant.phone ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">Phone: ${data.tenant.phone}</p>` : ""}
      ${data.tenant.email ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">Email: ${data.tenant.email}</p>` : ""}
      ${data.tenant.gstin ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">GSTIN: ${data.tenant.gstin}</p>` : ""}
    </div>
    <div style="text-align:right;">
      <h2 style="margin:0; font-size:28px; color:#1d4ed8; font-weight:700;">TAX INVOICE</h2>
      <p style="margin:8px 0 2px; font-size:13px; color:#6b7280;">Invoice #: <strong style="color:#111827;">${data.invoice.invoiceNumber}</strong></p>
      <p style="margin:2px 0; font-size:13px; color:#6b7280;">Date: <strong>${fmtDate(data.invoice.generatedAt)}</strong></p>
      <p style="margin:2px 0; font-size:13px; color:#6b7280;">Due Date: <strong>${fmtDate(data.invoice.dueDate)}</strong></p>
      <p style="margin:2px 0; font-size:13px; color:#6b7280;">Period: ${fmtDate(data.invoice.periodStart)} - ${fmtDate(data.invoice.periodEnd)}</p>
    </div>
  </div>

  <!-- Bill To -->
  <div style="padding:16px; background:#f0f9ff; border-radius:8px; margin-bottom:24px;">
    <h3 style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; margin:0 0 8px;">Bill To</h3>
    <p style="margin:0; font-weight:600; font-size:16px;">${data.organization.name} (${data.organization.code})</p>
    ${data.organization.contactPerson ? `<p style="margin:4px 0 0; color:#374151;">Attn: ${data.organization.contactPerson}</p>` : ""}
    ${data.organization.address ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">${data.organization.address}</p>` : ""}
    ${data.organization.phone ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">Phone: ${data.organization.phone}</p>` : ""}
    ${data.organization.email ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">Email: ${data.organization.email}</p>` : ""}
    ${data.organization.gstNumber ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">GSTIN: ${data.organization.gstNumber}</p>` : ""}
  </div>

  <!-- Line Items -->
  <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:16px;">
    <thead>
      <tr style="background:#1e3a5f; color:white;">
        <th style="padding:10px 12px; text-align:left; width:40px;">#</th>
        <th style="padding:10px 12px; text-align:left;">Description</th>
        <th style="padding:10px 12px; text-align:center; width:50px;">Qty</th>
        <th style="padding:10px 12px; text-align:right; width:100px;">Unit Price</th>
        <th style="padding:10px 12px; text-align:center; width:70px;">Disc.</th>
        <th style="padding:10px 12px; text-align:right; width:110px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex; justify-content:flex-end;">
    <table style="font-size:14px; min-width:280px;">
      <tr>
        <td style="padding:6px 16px 6px 0; color:#6b7280;">Subtotal:</td>
        <td style="padding:6px 0; text-align:right;">${fmt(data.invoice.subtotal)}</td>
      </tr>
      ${data.invoice.discountAmount > 0 ? `
      <tr>
        <td style="padding:6px 16px 6px 0; color:#16a34a;">Discount:</td>
        <td style="padding:6px 0; text-align:right; color:#16a34a;">-${fmt(data.invoice.discountAmount)}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:6px 16px 6px 0; color:#6b7280;">GST (18%):</td>
        <td style="padding:6px 0; text-align:right;">${fmt(data.invoice.taxAmount)}</td>
      </tr>
      <tr style="border-top:2px solid #111827;">
        <td style="padding:10px 16px 10px 0; font-weight:700; font-size:16px;">Total:</td>
        <td style="padding:10px 0; text-align:right; font-weight:700; font-size:16px;">${fmt(data.invoice.totalAmount)}</td>
      </tr>
      ${data.invoice.paidAmount > 0 ? `
      <tr>
        <td style="padding:6px 16px 6px 0; color:#16a34a;">Paid:</td>
        <td style="padding:6px 0; text-align:right; color:#16a34a;">-${fmt(data.invoice.paidAmount)}</td>
      </tr>
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:8px 16px 8px 0; font-weight:600; color:${balance > 0 ? "#dc2626" : "#16a34a"};">Balance Due:</td>
        <td style="padding:8px 0; text-align:right; font-weight:600; color:${balance > 0 ? "#dc2626" : "#16a34a"};">${fmt(balance)}</td>
      </tr>` : ""}
    </table>
  </div>

  ${paymentsHtml}
  ${bankDetailsHtml}

  <!-- Footer -->
  <div style="margin-top:40px; padding-top:16px; border-top:1px solid #e5e7eb; text-align:center; color:#9ca3af; font-size:12px;">
    <p>This is a computer-generated invoice. No signature required.</p>
    <p>${data.tenant.name} | Generated on ${fmtDate(new Date())}</p>
  </div>
</body>
</html>`;
}
