/**
 * Tests for API helper functions extracted from send-suggestion+api.ts
 * These test the utility functions used in the API endpoint
 */

describe('API Helper Functions', () => {
  describe('escapeHtml', () => {
    // This function is inline in the API file, so we recreate it for testing
    const escapeHtml = (value: string): string => {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    it('should escape ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than symbol', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('should escape greater than symbol', () => {
      expect(escapeHtml('100 > 50')).toBe('100 &gt; 50');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('Say "Hello"')).toBe('Say &quot;Hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("It's working")).toBe('It&#39;s working');
    });

    it('should escape all special characters in a complex string', () => {
      const input = '<script>alert("XSS & danger")</script>';
      const expected =
        '&lt;script&gt;alert(&quot;XSS &amp; danger&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should not modify strings without special characters', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });

    it('should handle multiple occurrences of the same character', () => {
      expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
    });
  });

  describe('getClientId', () => {
    // Mock request object creator
    const createMockRequest = (headers: Record<string, string | null>) => ({
      headers: {
        get: (name: string) => headers[name.toLowerCase()] || null,
      },
    });

    const getClientId = (request: { headers: { get: (name: string) => string | null } }): string => {
      const forwardedFor = request.headers.get('x-forwarded-for');
      if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
      }
      return (
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-real-ip') ||
        'unknown'
      );
    };

    it('should extract IP from x-forwarded-for header', () => {
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      });
      expect(getClientId(request)).toBe('192.168.1.1');
    });

    it('should handle single IP in x-forwarded-for', () => {
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.1',
      });
      expect(getClientId(request)).toBe('192.168.1.1');
    });

    it('should trim whitespace from IP', () => {
      const request = createMockRequest({
        'x-forwarded-for': '  192.168.1.1  , 10.0.0.1',
      });
      expect(getClientId(request)).toBe('192.168.1.1');
    });

    it('should fallback to cf-connecting-ip', () => {
      const request = createMockRequest({
        'cf-connecting-ip': '172.16.0.1',
      });
      expect(getClientId(request)).toBe('172.16.0.1');
    });

    it('should fallback to x-real-ip', () => {
      const request = createMockRequest({
        'x-real-ip': '10.0.0.1',
      });
      expect(getClientId(request)).toBe('10.0.0.1');
    });

    it('should return "unknown" when no headers present', () => {
      const request = createMockRequest({});
      expect(getClientId(request)).toBe('unknown');
    });

    it('should prefer x-forwarded-for over other headers', () => {
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.1',
        'cf-connecting-ip': '172.16.0.1',
        'x-real-ip': '10.0.0.1',
      });
      expect(getClientId(request)).toBe('192.168.1.1');
    });
  });

  describe('checkRateLimit', () => {
    const RATE_LIMIT_WINDOW_MS = 60_000;
    const RATE_LIMIT_MAX = 10;
    let rateLimitMap: Map<string, { count: number; resetAt: number }>;

    const checkRateLimit = (clientId: string): boolean => {
      const now = Date.now();
      const entry = rateLimitMap.get(clientId);

      if (!entry || now > entry.resetAt) {
        rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
      }

      if (entry.count >= RATE_LIMIT_MAX) {
        return false;
      }

      entry.count += 1;
      return true;
    };

    beforeEach(() => {
      rateLimitMap = new Map();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow first request', () => {
      expect(checkRateLimit('client1')).toBe(true);
    });

    it('should allow requests up to limit', () => {
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        expect(checkRateLimit('client2')).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        checkRateLimit('client3');
      }
      expect(checkRateLimit('client3')).toBe(false);
    });

    it('should reset limit after window expires', () => {
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        checkRateLimit('client4');
      }
      expect(checkRateLimit('client4')).toBe(false);

      // Advance time past the window
      jest.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1);

      expect(checkRateLimit('client4')).toBe(true);
    });

    it('should track different clients separately', () => {
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        checkRateLimit('client5');
      }

      // client5 is blocked
      expect(checkRateLimit('client5')).toBe(false);

      // client6 should still be allowed
      expect(checkRateLimit('client6')).toBe(true);
    });

    it('should increment count correctly', () => {
      checkRateLimit('client7');
      expect(rateLimitMap.get('client7')?.count).toBe(1);

      checkRateLimit('client7');
      expect(rateLimitMap.get('client7')?.count).toBe(2);

      checkRateLimit('client7');
      expect(rateLimitMap.get('client7')?.count).toBe(3);
    });
  });

  describe('Email validation patterns', () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.com')).toBe(true);
      expect(isValidEmail('user+tag@domain.com')).toBe(true);
      expect(isValidEmail('user@subdomain.domain.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('user @domain.com')).toBe(false);
    });
  });
});

describe('Form validation', () => {
  describe('Add Location form validation', () => {
    const validateAddLocationForm = (formData: {
      locationName?: string;
      sport?: string;
      address?: string;
      customerName?: string;
      customerEmail?: string;
    }): { valid: boolean; error?: string } => {
      if (
        !formData.locationName ||
        !formData.sport ||
        !formData.address ||
        !formData.customerName ||
        !formData.customerEmail
      ) {
        return { valid: false, error: 'Missing required form fields' };
      }
      return { valid: true };
    };

    it('should validate complete form data', () => {
      const result = validateAddLocationForm({
        locationName: 'Test Club',
        sport: 'Football',
        address: 'Test Address',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject form with missing locationName', () => {
      const result = validateAddLocationForm({
        sport: 'Football',
        address: 'Test Address',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required form fields');
    });

    it('should reject form with missing email', () => {
      const result = validateAddLocationForm({
        locationName: 'Test Club',
        sport: 'Football',
        address: 'Test Address',
        customerName: 'John Doe',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Change Location form validation', () => {
    const validateChangeLocationForm = (formData: {
      existingLocation?: string;
      changeInfo?: string;
      customerName?: string;
      customerEmail?: string;
    }): { valid: boolean; error?: string } => {
      if (
        !formData.existingLocation ||
        !formData.changeInfo ||
        !formData.customerName ||
        !formData.customerEmail
      ) {
        return { valid: false, error: 'Missing required form fields' };
      }
      return { valid: true };
    };

    it('should validate complete form data', () => {
      const result = validateChangeLocationForm({
        existingLocation: 'Existing Club',
        changeInfo: 'New phone number',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject form with missing changeInfo', () => {
      const result = validateChangeLocationForm({
        existingLocation: 'Existing Club',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
      });
      expect(result.valid).toBe(false);
    });
  });
});
