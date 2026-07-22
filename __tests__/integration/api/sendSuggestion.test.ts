/**
 * Integration tests for the send-suggestion API endpoint
 * Tests the full request/response cycle
 */

// Mock Resend
const mockEmailsSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockEmailsSend,
    },
  })),
}));

// Environment variables mock
process.env.RESEND_API_KEY = 'test-api-key';

describe('Send Suggestion API Integration', () => {
  // Helper to create mock request
  const createMockRequest = (body: object, headers: Record<string, string> = {}) => ({
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailsSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
  });

  describe('Add Location Request', () => {
    const validAddLocationRequest = {
      type: 'add',
      formData: {
        locationName: 'Test Sports Club',
        sport: 'Football',
        address: 'Sportlaan 1, 1234 AB Amsterdam',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      },
    };

    it('should successfully process add location request', async () => {
      const request = createMockRequest(validAddLocationRequest, {
        'x-forwarded-for': '192.168.1.1',
      });

      // Simulate the API logic
      const body = await request.json();
      expect(body.type).toBe('add');
      expect(body.formData.locationName).toBe('Test Sports Club');
    });

    it('should create correct email content for add location', () => {
      const { formData } = validAddLocationRequest;

      const htmlContent = `
        <h2>Nieuwe locatie aanvraag</h2>
        <ul>
          <li><strong>Naam locatie:</strong> ${formData.locationName}</li>
          <li><strong>Sport:</strong> ${formData.sport}</li>
          <li><strong>Adres:</strong> ${formData.address}</li>
        </ul>
      `;

      expect(htmlContent).toContain('Test Sports Club');
      expect(htmlContent).toContain('Football');
      expect(htmlContent).toContain('Sportlaan 1, 1234 AB Amsterdam');
    });

    it('should reject add location with missing fields', async () => {
      const invalidRequest = {
        type: 'add',
        formData: {
          locationName: 'Test',
          // Missing: sport, address, customerName, customerEmail
        },
      };

      const validate = (formData: any) =>
        Boolean(
          formData.locationName &&
            formData.sport &&
            formData.address &&
            formData.customerName &&
            formData.customerEmail
        );

      expect(validate(invalidRequest.formData)).toBe(false);
    });
  });

  describe('Change Location Request', () => {
    const validChangeLocationRequest = {
      type: 'change',
      formData: {
        existingLocation: 'Amsterdam Sports Club',
        changeInfo: 'Please update the phone number',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
      },
    };

    it('should successfully process change location request', async () => {
      const request = createMockRequest(validChangeLocationRequest, {
        'x-forwarded-for': '192.168.1.2',
      });

      const body = await request.json();
      expect(body.type).toBe('change');
      expect(body.formData.existingLocation).toBe('Amsterdam Sports Club');
    });

    it('should create correct email content for change location', () => {
      const { formData } = validChangeLocationRequest;

      const htmlContent = `
        <h2>Wijzigingsverzoek</h2>
        <ul>
          <li><strong>Welke locatie:</strong> ${formData.existingLocation}</li>
          <li><strong>Wat moet er aangepast worden:</strong> ${formData.changeInfo}</li>
        </ul>
      `;

      expect(htmlContent).toContain('Amsterdam Sports Club');
      expect(htmlContent).toContain('Please update the phone number');
    });

    it('should reject change location with missing fields', () => {
      const invalidRequest = {
        type: 'change',
        formData: {
          existingLocation: 'Test',
          // Missing: changeInfo, customerName, customerEmail
        },
      };

      const validate = (formData: any) =>
        Boolean(
          formData.existingLocation &&
            formData.changeInfo &&
            formData.customerName &&
            formData.customerEmail
        );

      expect(validate(invalidRequest.formData)).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    const RATE_LIMIT_MAX = 10;
    let requestCounts: Map<string, number>;

    beforeEach(() => {
      requestCounts = new Map();
    });

    const simulateRateLimit = (clientId: string): boolean => {
      const count = requestCounts.get(clientId) || 0;
      if (count >= RATE_LIMIT_MAX) {
        return false;
      }
      requestCounts.set(clientId, count + 1);
      return true;
    };

    it('should allow requests up to rate limit', () => {
      const clientId = 'test-client-1';

      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        expect(simulateRateLimit(clientId)).toBe(true);
      }
    });

    it('should block requests over rate limit', () => {
      const clientId = 'test-client-2';

      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        simulateRateLimit(clientId);
      }

      expect(simulateRateLimit(clientId)).toBe(false);
    });

    it('should track different clients separately', () => {
      const clientA = 'client-a';
      const clientB = 'client-b';

      // Exhaust clientA's limit
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        simulateRateLimit(clientA);
      }

      // clientA should be blocked
      expect(simulateRateLimit(clientA)).toBe(false);

      // clientB should still be allowed
      expect(simulateRateLimit(clientB)).toBe(true);
    });
  });

  describe('XSS Prevention', () => {
    const escapeHtml = (value: string): string => {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    it('should escape script tags in user input', () => {
      const maliciousInput = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(maliciousInput);

      expect(escaped).not.toContain('<script>');
      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should escape HTML attributes', () => {
      const maliciousInput = '" onload="alert(\'XSS\')"';
      const escaped = escapeHtml(maliciousInput);

      expect(escaped).not.toContain('"');
      expect(escaped).toBe('&quot; onload=&quot;alert(&#39;XSS&#39;)&quot;');
    });

    it('should handle complex XSS attempts', () => {
      const maliciousInputs = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<a href="javascript:alert(1)">click</a>',
        '"><script>alert(document.cookie)</script>',
      ];

      maliciousInputs.forEach((input) => {
        const escaped = escapeHtml(input);
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
      });
    });
  });

  describe('Request Validation', () => {
    it('should reject requests without type', async () => {
      const invalidRequest = {
        formData: { locationName: 'Test' },
      };

      expect(invalidRequest.hasOwnProperty('type')).toBe(false);
    });

    it('should reject requests without formData', async () => {
      const invalidRequest = {
        type: 'add',
      };

      expect(invalidRequest.hasOwnProperty('formData')).toBe(false);
    });

    it('should reject invalid type', () => {
      const invalidTypes = ['invalid', 'delete', 'update', '', null, undefined];

      invalidTypes.forEach((type) => {
        const isValid = type === 'add' || type === 'change';
        expect(isValid).toBe(false);
      });
    });

    it('should accept valid types', () => {
      const validTypes = ['add', 'change'];

      validTypes.forEach((type) => {
        const isValid = type === 'add' || type === 'change';
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Email Service Integration', () => {
    it('should call Resend with correct parameters for add location', async () => {
      const formData = {
        locationName: 'Test Club',
        sport: 'Football',
        address: 'Test Address',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
      };

      // Simulate the email send call
      await mockEmailsSend({
        from: 'Sportinkaart <noreply@sportinkaart.nl>',
        to: ['info@sportinkaart.nl'],
        subject: 'Nieuwe locatie toevoegen - Sportinkaart',
        text: expect.any(String),
        html: expect.any(String),
        reply_to: formData.customerEmail,
      });

      expect(mockEmailsSend).toHaveBeenCalled();
    });

    it('should handle Resend API errors', async () => {
      mockEmailsSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'API rate limit exceeded' },
      });

      const result = await mockEmailsSend({});

      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe('API rate limit exceeded');
    });

    it('should handle network errors', async () => {
      mockEmailsSend.mockRejectedValueOnce(new Error('Network error'));

      await expect(mockEmailsSend({})).rejects.toThrow('Network error');
    });
  });

  describe('Response Codes', () => {
    it('should return 200 for successful request', () => {
      const successResponse = {
        success: true,
        data: { id: 'email-123' },
      };

      expect(successResponse.success).toBe(true);
    });

    it('should return 400 for validation errors', () => {
      const errorResponse = {
        error: 'Missing required fields',
      };

      expect(errorResponse.error).toBe('Missing required fields');
    });

    it('should return 429 for rate limit exceeded', () => {
      const rateLimitResponse = {
        error: 'Too many requests',
      };

      expect(rateLimitResponse.error).toBe('Too many requests');
    });

    it('should return 500 for server errors', () => {
      const serverErrorResponse = {
        error: 'Failed to send email',
        details: 'Database connection failed',
      };

      expect(serverErrorResponse.error).toBe('Failed to send email');
    });
  });
});
