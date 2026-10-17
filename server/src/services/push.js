import admin from 'firebase-admin';

const messaging = admin.messaging();

/**
 * Send incoming call push notification via FCM
 * @param {string} fcmToken - Device FCM token
 * @param {string} callerName - Caller display name
 * @param {string} callId - Call ID
 * @returns {Promise<string>} - Message ID
 */
export async function sendIncomingCallPush(fcmToken, callerName, callId) {
  try {
    const message = {
      notification: {
        title: 'Incoming Call',
        body: `${callerName} is calling...`,
      },
      data: {
        callId,
        callerName,
        type: 'incoming_call',
      },
      token: fcmToken,
      apns: {
        headers: {
          'apns-priority': '10', // High priority for VoIP
        },
        payload: {
          aps: {
            alert: {
              title: 'Incoming Call',
              body: `${callerName} is calling...`,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.send(message);
    return response;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    throw error;
  }
}

/**
 * Send call rejection push notification
 * @param {string} fcmToken - Device FCM token
 * @param {string} message - Rejection message
 * @returns {Promise<string>} - Message ID
 */
export async function sendCallRejectionPush(fcmToken, message) {
  try {
    const msg = {
      notification: {
        title: 'Call Ended',
        body: message,
      },
      token: fcmToken,
    };

    return await messaging.send(msg);
  } catch (error) {
    console.error('Failed to send rejection push:', error);
    throw error;
  }
}

// APNs integration scaffold - requires Apple Developer account
// TODO: Implement VoIP push certificate setup when Apple Developer account is available
// For production, configure:
// 1. VoIP push certificate from Apple Developer Portal
// 2. Add to Firebase Console under Project Settings > iOS
// 3. Use CallKit framework in iOS app for native call UI
