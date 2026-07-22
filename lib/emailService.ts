import Constants from 'expo-constants';

interface AddLocationData {
  city: string;
  locationName: string;
  sport: string;
  address: string;
  customerName: string;
  customerEmail: string;
}

interface ChangeLocationData {
  existingLocation: string;
  changeInfo: string;
  customerName: string;
  customerEmail: string;
}

export async function sendAddLocationEmail(formData: AddLocationData) {
  try {
    // Get the API URL - for development and production
    const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8081';
    const fullUrl = `${apiUrl}/api/send-suggestion`;

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'add',
        formData,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send email');
    }

    return { success: true, data };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      if (__DEV__) {
        console.error('⚠️  Network error - API route may not be accessible');
      }
    }
    throw error;
  }
}

export async function sendChangeLocationEmail(formData: ChangeLocationData) {
  try {
    // Get the API URL - for development and production
    const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8081';

    const response = await fetch(`${apiUrl}/api/send-suggestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'change',
        formData,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send email');
    }

    return { success: true, data };
  } catch (error) {
    if (__DEV__) {
      console.error('Error sending change location email:', error);
    }
    throw error;
  }
}
