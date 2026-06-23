/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';

export interface ExportOptions {
  filename?: string;
  format?: 'csv' | 'xlsx';
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: any[], filename: string = 'export.csv') {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename);
}

/**
 * Export data to Excel format
 */
export function exportToExcel(
  data: any[],
  filename: string = 'export.xlsx',
  sheetName: string = 'Sheet1'
) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

/**
 * Export multiple sheets to Excel
 */
export function exportToExcelMultiSheet(
  sheets: Record<string, any[]>,
  filename: string = 'export.xlsx'
) {
  const workbook = XLSX.utils.book_new();
  
  Object.entries(sheets).forEach(([sheetName, data]) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });
  
  XLSX.writeFile(workbook, filename);
}

/**
 * Generic download function
 */
function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Format user data for export
 */
export function formatUsersForExport(users: any[]) {
  return users.map(user => ({
    'Email': user.email,
    'Name': user.name || '—',
    'Role': user.role === 'admin' ? 'Administrator' : 'User',
    'Created Date': new Date(user.createdAt).toLocaleDateString(),
    'Last Sign In': user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString() : 'Never',
    'Status': 'Active',
  }));
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string = 'export', ext: string = 'xlsx'): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${prefix}_${timestamp}.${ext}`;
}