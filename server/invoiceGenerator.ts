/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  customerName: string;
  customerEmail: string;
  planName: string;
  planDescription: string;
  amount: number;
  currency: string;
  taxRate: number;
  subscriptionPeriod: {
    start: Date;
    end: Date;
  };
  companyName: string;
  companyEmail: string;
  companyAddress: string;
}

/**
 * Generate a PDF invoice as a Buffer
 * This function creates a professional invoice PDF using pdfkit
 */
export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    const buffer: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffer.push(chunk));
    doc.on('end', () => {
      resolve(Buffer.concat(buffer));
    });
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('FAKTURA', { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(invoiceData.companyName, { align: 'left' });
    doc.text(invoiceData.companyAddress);
    doc.text(invoiceData.companyEmail);
    // Norwegian invoice requirement: seller's org number with the "MVA" suffix
    // (indicates VAT registration). Set MVA_ORG_NUMBER in the environment.
    const orgNr = process.env.MVA_ORG_NUMBER;
    if (orgNr) doc.text(`Org.nr: ${orgNr} MVA`);

    // Invoice details (right aligned)
    doc.fontSize(10).fillColor('#000').font('Helvetica');
    const rightX = 400;
    doc.text(`Fakturanummer: ${invoiceData.invoiceNumber}`, rightX, 60, { align: 'right' });
    doc.text(`Fakturadato: ${format(invoiceData.invoiceDate, 'd. MMMM yyyy', { locale: nb })}`, rightX, 80, { align: 'right' });
    doc.text(`Forfallsdato: ${format(invoiceData.dueDate, 'd. MMMM yyyy', { locale: nb })}`, rightX, 100, { align: 'right' });

    // Bill to section
    doc.moveDown(2);
    doc.fontSize(11).font('Helvetica-Bold').text('Faktureres til:');
    doc.fontSize(10).font('Helvetica').text(invoiceData.customerName);
    doc.text(invoiceData.customerEmail);

    // Items table
    doc.moveDown(1);
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 300;
    const col3 = 450;

    // Table header
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#F3F4F6');
    doc.rect(40, tableTop, 515, 25).fill('#F3F4F6');
    doc.fillColor('#000');
    doc.text('Beskrivelse', col1, tableTop + 8);
    doc.text('Periode', col2, tableTop + 8);
    doc.text('Beløp', col3, tableTop + 8, { align: 'right' });

    // Table row
    doc.fontSize(10).font('Helvetica').fillColor('#000');
    doc.text(invoiceData.planName, col1, tableTop + 35);
    doc.text(
      `${format(invoiceData.subscriptionPeriod.start, 'd. MMM yyyy', { locale: nb })} - ${format(invoiceData.subscriptionPeriod.end, 'd. MMM yyyy', { locale: nb })}`,
      col2,
      tableTop + 35
    );
    doc.text(`${invoiceData.amount.toFixed(2)} ${invoiceData.currency}`, col3, tableTop + 35, { align: 'right' });

    // Summary section
    doc.moveDown(3);
    const summaryTop = doc.y;
    const summaryCol1 = 350;
    const summaryCol2 = 480;

    doc.fontSize(10).font('Helvetica');
    doc.text('Delsum:', summaryCol1, summaryTop);
    const subtotal = invoiceData.amount / (1 + invoiceData.taxRate);
    doc.text(`${subtotal.toFixed(2)} ${invoiceData.currency}`, summaryCol2, summaryTop, { align: 'right' });

    doc.moveDown();
    const taxAmount = invoiceData.amount - subtotal;
    doc.text(`MVA (${(invoiceData.taxRate * 100).toFixed(0)}%):`, summaryCol1, doc.y);
    doc.text(`${taxAmount.toFixed(2)} ${invoiceData.currency}`, summaryCol2, doc.y, { align: 'right' });

    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Totalt:', summaryCol1, doc.y);
    doc.fillColor('#3B82F6');
    doc.text(`${invoiceData.amount.toFixed(2)} ${invoiceData.currency}`, summaryCol2, doc.y, { align: 'right' });

    // Footer
    doc.moveDown(3);
    doc.fontSize(9).fillColor('#999').text('Takk for at du bruker Nexify AI!', { align: 'center' });
    doc.text('Denne fakturaen ble generert automatisk.', { align: 'center' });

    doc.end();
  });
}

/**
 * Format invoice filename
 */
export function formatInvoiceFilename(invoiceNumber: string, customerName: string): string {
  const sanitizedName = customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return `faktura_${invoiceNumber}_${sanitizedName}.pdf`;
}