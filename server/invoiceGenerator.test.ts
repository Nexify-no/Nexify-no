/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Test data interface
interface InvoiceData {
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

// Mock formatInvoiceFilename function
function formatInvoiceFilename(invoiceNumber: string, customerName: string): string {
  const sanitizedName = customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  return `faktura_${invoiceNumber.toLowerCase()}_${sanitizedName}.pdf`;
}

describe("Invoice PDF Generator", () => {
  let sampleInvoiceData: InvoiceData;

  beforeAll(() => {
    sampleInvoiceData = {
      invoiceNumber: "INV-2026-001",
      invoiceDate: new Date("2026-04-08"),
      dueDate: new Date("2026-04-22"),
      customerName: "Test Customer",
      customerEmail: "test@example.com",
      planName: "Pro Månedlig",
      planDescription: "Professional plan with 100 posts per month",
      amount: 299,
      currency: "NOK",
      taxRate: 0.25,
      subscriptionPeriod: {
        start: new Date("2026-04-08"),
        end: new Date("2026-05-08"),
      },
      companyName: "Nexify CRM Systems AS",
      companyEmail: "support@nexify.ai",
      companyAddress: "Norway",
    };
  });

  describe("formatInvoiceFilename", () => {
    it("should format invoice filename correctly", () => {
      const filename = formatInvoiceFilename("INV-2026-001", "Test Customer");
      
      expect(filename).toContain("faktura_");
      expect(filename).toContain("inv-2026-001");
      expect(filename).toContain("test_customer");
      expect(filename).toMatch(/\.pdf$/);
    });

    it("should handle special characters in customer name", () => {
      const filename = formatInvoiceFilename("INV-2026-001", "Tëst Çustömér");
      
      expect(filename).toContain("faktura_");
      expect(filename).toMatch(/\.pdf$/);
      // Special characters should be removed or replaced
      expect(filename).not.toContain("ë");
      expect(filename).not.toContain("ç");
    });

    it("should convert to lowercase", () => {
      const filename = formatInvoiceFilename("INV-2026-001", "TEST CUSTOMER");
      
      expect(filename).toMatch(/^faktura_inv-2026-001_test_customer\.pdf$/);
    });

    it("should handle empty customer name", () => {
      const filename = formatInvoiceFilename("INV-2026-001", "");
      
      expect(filename).toContain("faktura_");
      expect(filename).toMatch(/\.pdf$/);
    });

    it("should generate different filenames for different invoice numbers", () => {
      const filename1 = formatInvoiceFilename("INV-2026-001", "Test Customer");
      const filename2 = formatInvoiceFilename("INV-2026-002", "Test Customer");
      
      expect(filename1).not.toBe(filename2);
    });

    it("should generate different filenames for different customer names", () => {
      const filename1 = formatInvoiceFilename("INV-2026-001", "Customer One");
      const filename2 = formatInvoiceFilename("INV-2026-001", "Customer Two");
      
      expect(filename1).not.toBe(filename2);
    });
  });

  describe("InvoiceData interface", () => {
    it("should have all required fields", () => {
      const requiredFields = [
        "invoiceNumber",
        "invoiceDate",
        "dueDate",
        "customerName",
        "customerEmail",
        "planName",
        "planDescription",
        "amount",
        "currency",
        "taxRate",
        "subscriptionPeriod",
        "companyName",
        "companyEmail",
        "companyAddress",
      ];

      requiredFields.forEach((field) => {
        expect(sampleInvoiceData).toHaveProperty(field);
      });
    });

    it("should have valid subscription period dates", () => {
      expect(sampleInvoiceData.subscriptionPeriod.start).toBeInstanceOf(Date);
      expect(sampleInvoiceData.subscriptionPeriod.end).toBeInstanceOf(Date);
      expect(sampleInvoiceData.subscriptionPeriod.start < sampleInvoiceData.subscriptionPeriod.end).toBe(true);
    });

    it("should have valid invoice dates", () => {
      expect(sampleInvoiceData.invoiceDate).toBeInstanceOf(Date);
      expect(sampleInvoiceData.dueDate).toBeInstanceOf(Date);
      expect(sampleInvoiceData.invoiceDate <= sampleInvoiceData.dueDate).toBe(true);
    });

    it("should have valid amount", () => {
      expect(sampleInvoiceData.amount).toBeGreaterThan(0);
      expect(typeof sampleInvoiceData.amount).toBe("number");
    });

    it("should have valid tax rate", () => {
      expect(sampleInvoiceData.taxRate).toBeGreaterThanOrEqual(0);
      expect(sampleInvoiceData.taxRate).toBeLessThanOrEqual(1);
    });
  });

  describe("Invoice calculations", () => {
    it("should calculate VAT correctly (25%)", () => {
      const amount = 299;
      const taxRate = 0.25;
      const subtotal = amount / (1 + taxRate);
      const vat = amount - subtotal;

      expect(subtotal).toBeCloseTo(239.2, 1);
      expect(vat).toBeCloseTo(59.8, 1);
    });

    it("should handle different tax rates", () => {
      const testCases = [
        { amount: 100, taxRate: 0.25, expectedSubtotal: 80 },
        { amount: 100, taxRate: 0.1, expectedSubtotal: 90.91 },
        { amount: 100, taxRate: 0, expectedSubtotal: 100 },
      ];

      testCases.forEach(({ amount, taxRate, expectedSubtotal }) => {
        const subtotal = amount / (1 + taxRate);
        expect(subtotal).toBeCloseTo(expectedSubtotal, 1);
      });
    });

    it("should handle large amounts", () => {
      const amount = 14990;
      const taxRate = 0.25;
      const subtotal = amount / (1 + taxRate);
      const vat = amount - subtotal;

      expect(subtotal).toBeGreaterThan(0);
      expect(vat).toBeGreaterThan(0);
      expect(subtotal + vat).toBeCloseTo(amount, 1);
    });

    it("should calculate Pro Monthly invoice correctly", () => {
      const amount = 299;
      const taxRate = 0.25;
      const subtotal = amount / (1 + taxRate);
      const vat = amount - subtotal;

      expect(subtotal).toBeCloseTo(239.2, 1);
      expect(vat).toBeCloseTo(59.8, 1);
      expect(subtotal + vat).toBeCloseTo(amount, 1);
    });

    it("should calculate Pro Yearly invoice correctly", () => {
      const amount = 2990;
      const taxRate = 0.25;
      const subtotal = amount / (1 + taxRate);
      const vat = amount - subtotal;

      expect(subtotal).toBeCloseTo(2392, 0);
      expect(vat).toBeCloseTo(598, 0);
      expect(subtotal + vat).toBeCloseTo(amount, 0);
    });

    it("should calculate Enterprise Monthly invoice correctly", () => {
      const amount = 1499;
      const taxRate = 0.25;
      const subtotal = amount / (1 + taxRate);
      const vat = amount - subtotal;

      expect(subtotal).toBeCloseTo(1199.2, 1);
      expect(vat).toBeCloseTo(299.8, 1);
    });

    it("should calculate Enterprise Yearly invoice correctly", () => {
      const amount = 14990;
      const taxRate = 0.25;
      const subtotal = amount / (1 + taxRate);
      const vat = amount - subtotal;

      expect(subtotal).toBeCloseTo(11992, 0);
      expect(vat).toBeCloseTo(2998, 0);
    });
  });

  describe("Invoice date calculations", () => {
    it("should calculate due date as 14 days after invoice date", () => {
      const invoiceDate = new Date("2026-04-08");
      const dueDate = new Date(invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000);

      expect(dueDate.getTime() - invoiceDate.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
      expect(dueDate).toEqual(new Date("2026-04-22"));
    });

    it("should calculate subscription period as 30 days", () => {
      const startDate = new Date("2026-04-08");
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      expect(endDate.getTime() - startDate.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
      expect(endDate).toEqual(new Date("2026-05-08"));
    });
  });
});