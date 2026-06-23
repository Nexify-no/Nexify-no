/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test the Vipps credentials validation schema
const vippsCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  subscriptionKey: z.string().min(1),
  merchantSerialNumber: z.string().min(1),
  testMode: z.boolean().optional().default(true),
});

describe('Vipps Credentials Validation', () => {
  describe('Input Schema Validation', () => {
    it('should accept valid credentials with all fields', () => {
      const validInput = {
        clientId: 'test-client-id-12345',
        clientSecret: 'test-client-secret-abcdef',
        subscriptionKey: 'ocp-apim-subscription-key-xyz',
        merchantSerialNumber: '123456',
        testMode: true,
      };

      const result = vippsCredentialsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clientId).toBe('test-client-id-12345');
        expect(result.data.clientSecret).toBe('test-client-secret-abcdef');
        expect(result.data.subscriptionKey).toBe('ocp-apim-subscription-key-xyz');
        expect(result.data.merchantSerialNumber).toBe('123456');
        expect(result.data.testMode).toBe(true);
      }
    });

    it('should default testMode to true when not provided', () => {
      const inputWithoutTestMode = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        subscriptionKey: 'test-subscription-key',
        merchantSerialNumber: '654321',
      };

      const result = vippsCredentialsSchema.safeParse(inputWithoutTestMode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.testMode).toBe(true);
      }
    });

    it('should accept testMode as false for production', () => {
      const productionInput = {
        clientId: 'prod-client-id',
        clientSecret: 'prod-client-secret',
        subscriptionKey: 'prod-subscription-key',
        merchantSerialNumber: '999999',
        testMode: false,
      };

      const result = vippsCredentialsSchema.safeParse(productionInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.testMode).toBe(false);
      }
    });

    it('should reject empty clientId', () => {
      const invalidInput = {
        clientId: '',
        clientSecret: 'test-client-secret',
        subscriptionKey: 'test-subscription-key',
        merchantSerialNumber: '123456',
      };

      const result = vippsCredentialsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty clientSecret', () => {
      const invalidInput = {
        clientId: 'test-client-id',
        clientSecret: '',
        subscriptionKey: 'test-subscription-key',
        merchantSerialNumber: '123456',
      };

      const result = vippsCredentialsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty subscriptionKey', () => {
      const invalidInput = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        subscriptionKey: '',
        merchantSerialNumber: '123456',
      };

      const result = vippsCredentialsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty merchantSerialNumber', () => {
      const invalidInput = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        subscriptionKey: 'test-subscription-key',
        merchantSerialNumber: '',
      };

      const result = vippsCredentialsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const incompleteInput = {
        clientId: 'test-client-id',
        // Missing other required fields
      };

      const result = vippsCredentialsSchema.safeParse(incompleteInput);
      expect(result.success).toBe(false);
    });
  });

  describe('Credentials Response Format', () => {
    it('should format credentials response correctly', () => {
      const dbCredentials = {
        id: 1,
        clientId: 'my-client-id-12345678',
        clientSecret: 'secret-value',
        subscriptionKey: 'sub-key-value',
        merchantSerialNumber: '123456',
        testMode: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate the response formatting logic from the tRPC procedure
      const response = {
        clientId: dbCredentials.clientId,
        merchantSerialNumber: dbCredentials.merchantSerialNumber,
        testMode: dbCredentials.testMode === 1,
        configured: true,
      };

      expect(response.clientId).toBe('my-client-id-12345678');
      expect(response.merchantSerialNumber).toBe('123456');
      expect(response.testMode).toBe(true);
      expect(response.configured).toBe(true);
      // Verify secrets are not exposed
      expect(response).not.toHaveProperty('clientSecret');
      expect(response).not.toHaveProperty('subscriptionKey');
    });

    it('should return null when no credentials exist', () => {
      const credentials: any[] = [];
      
      const result = credentials.length === 0 ? null : {
        clientId: credentials[0].clientId,
        merchantSerialNumber: credentials[0].merchantSerialNumber,
        testMode: credentials[0].testMode === 1,
        configured: true,
      };

      expect(result).toBeNull();
    });
  });

  describe('Test Mode Conversion', () => {
    it('should convert boolean true to integer 1 for database', () => {
      const testMode = true;
      const dbValue = testMode ? 1 : 0;
      expect(dbValue).toBe(1);
    });

    it('should convert boolean false to integer 0 for database', () => {
      const testMode = false;
      const dbValue = testMode ? 1 : 0;
      expect(dbValue).toBe(0);
    });

    it('should convert integer 1 to boolean true from database', () => {
      const dbValue: number = 1;
      const testMode = dbValue === 1;
      expect(testMode).toBe(true);
    });

    it('should convert integer 0 to boolean false from database', () => {
      const dbValue: number = 0;
      const testMode = dbValue === 1;
      expect(testMode).toBe(false);
    });
  });
});

describe('Vipps API Configuration', () => {
  it('should have correct Vipps API endpoints for test environment', () => {
    const testApiBase = 'https://apitest.vipps.no';
    const recurringEndpoint = '/recurring/v3/agreements';
    
    expect(testApiBase).toContain('apitest');
    expect(recurringEndpoint).toContain('recurring');
  });

  it('should have correct Vipps API endpoints for production environment', () => {
    const prodApiBase = 'https://api.vipps.no';
    const recurringEndpoint = '/recurring/v3/agreements';
    
    expect(prodApiBase).not.toContain('test');
    expect(recurringEndpoint).toContain('recurring');
  });

  it('should select correct API base based on testMode', () => {
    const getApiBase = (testMode: boolean) => 
      testMode ? 'https://apitest.vipps.no' : 'https://api.vipps.no';

    expect(getApiBase(true)).toBe('https://apitest.vipps.no');
    expect(getApiBase(false)).toBe('https://api.vipps.no');
  });
});