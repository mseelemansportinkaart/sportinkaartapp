import { sendAddLocationEmail, sendChangeLocationEmail } from '@/lib/emailService';

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://test-api.com',
    },
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('emailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendAddLocationEmail', () => {
    const validFormData = {
      locationName: 'Test Sports Club',
      sport: 'Football',
      address: 'Test Street 123, 1234 AB Amsterdam',
      city: 'Amsterdam',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
    };

    it('should send add location email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { id: 'email-123' } }),
      });

      const result = await sendAddLocationEmail(validFormData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/api/send-suggestion',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'add',
            formData: validFormData,
          }),
        }
      );

      expect(result).toEqual({
        success: true,
        data: { success: true, data: { id: 'email-123' } },
      });
    });

    it('should throw error when API returns error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Missing required fields' }),
      });

      await expect(sendAddLocationEmail(validFormData)).rejects.toThrow(
        'Missing required fields'
      );
    });

    it('should throw error with default message when no error provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(sendAddLocationEmail(validFormData)).rejects.toThrow(
        'Failed to send email'
      );
    });

    it('should handle network errors', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(sendAddLocationEmail(validFormData)).rejects.toThrow(networkError);
    });

    it('should use localhost when apiUrl is not configured', async () => {
      // Reset the mock to test fallback
      jest.resetModules();
      jest.doMock('expo-constants', () => ({
        expoConfig: {
          extra: {},
        },
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Re-import after mock change
      const { sendAddLocationEmail: sendEmail } = require('@/lib/emailService');
      await sendEmail(validFormData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/send-suggestion'),
        expect.any(Object)
      );
    });
  });

  describe('sendChangeLocationEmail', () => {
    const validFormData = {
      existingLocation: 'Test Club Amsterdam',
      changeInfo: 'Please update the phone number to +31 6 98765432',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
    };

    it('should send change location email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { id: 'email-456' } }),
      });

      const result = await sendChangeLocationEmail(validFormData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/api/send-suggestion',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'change',
            formData: validFormData,
          }),
        }
      );

      expect(result).toEqual({
        success: true,
        data: { success: true, data: { id: 'email-456' } },
      });
    });

    it('should throw error when API returns error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      });

      await expect(sendChangeLocationEmail(validFormData)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should throw error with default message when no error provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(sendChangeLocationEmail(validFormData)).rejects.toThrow(
        'Failed to send email'
      );
    });

    it('should handle network errors', async () => {
      const networkError = new TypeError('Network request failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(sendChangeLocationEmail(validFormData)).rejects.toThrow(
        networkError
      );
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle JSON parse errors in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(
        sendAddLocationEmail({
          locationName: 'Test',
          sport: 'Football',
          address: 'Address',
          city: 'Amsterdam',
          customerName: 'Name',
          customerEmail: 'email@test.com',
        })
      ).rejects.toThrow('Invalid JSON');
    });

    it('should handle 429 rate limit response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Too many requests' }),
      });

      await expect(
        sendAddLocationEmail({
          locationName: 'Test',
          sport: 'Football',
          address: 'Address',
          city: 'Amsterdam',
          customerName: 'Name',
          customerEmail: 'email@test.com',
        })
      ).rejects.toThrow('Too many requests');
    });

    it('should handle 500 server error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ error: 'Internal server error', details: 'DB connection failed' }),
      });

      await expect(
        sendChangeLocationEmail({
          existingLocation: 'Test',
          changeInfo: 'Change',
          customerName: 'Name',
          customerEmail: 'email@test.com',
        })
      ).rejects.toThrow('Internal server error');
    });
  });

  describe('Request payload validation', () => {
    it('should include all form data fields in add location request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const formData = {
        locationName: 'Sports Center XYZ',
        sport: 'Swimming, Tennis',
        address: 'Pool Street 1, 5678 CD Rotterdam',
        city: 'Rotterdam',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
      };

      await sendAddLocationEmail(formData);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.type).toBe('add');
      expect(body.formData.locationName).toBe('Sports Center XYZ');
      expect(body.formData.sport).toBe('Swimming, Tennis');
      expect(body.formData.address).toBe('Pool Street 1, 5678 CD Rotterdam');
      expect(body.formData.customerName).toBe('Test User');
      expect(body.formData.customerEmail).toBe('test@example.com');
    });

    it('should include all form data fields in change location request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const formData = {
        existingLocation: 'Old Club Name',
        changeInfo: 'New opening hours: 9:00 - 21:00',
        customerName: 'Another User',
        customerEmail: 'another@example.com',
      };

      await sendChangeLocationEmail(formData);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.type).toBe('change');
      expect(body.formData.existingLocation).toBe('Old Club Name');
      expect(body.formData.changeInfo).toBe('New opening hours: 9:00 - 21:00');
      expect(body.formData.customerName).toBe('Another User');
      expect(body.formData.customerEmail).toBe('another@example.com');
    });
  });
});
