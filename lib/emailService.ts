import Constants from 'expo-constants';

interface AddLocationData {
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

    console.log('🌐 Sending request to:', fullUrl);
    console.log('📦 Request body:', JSON.stringify({ type: 'add', formData }, null, 2));

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

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

    const data = await response.json();
    console.log('📨 Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send email');
    }

    return { success: true, data };
  } catch (error) {
    console.error('❌ Error sending add location email:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('⚠️  Network error - API route may not be accessible');
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
    console.error('Error sending change location email:', error);
    throw error;
  }
}
