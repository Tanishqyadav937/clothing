import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  late FirebaseMessaging _firebaseMessaging;

  factory NotificationService() {
    return _instance;
  }

  NotificationService._internal();

  Future<void> initialize() async {
    // Initialize Firebase Messaging
    _firebaseMessaging = FirebaseMessaging.instance;

    // Request permissions
    final settings = await _firebaseMessaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    print('FCM Permission: ${settings.authorizationStatus}');

    // Initialize local notifications
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(initSettings);

    // Handle background messages
    FirebaseMessaging.onBackgroundMessage(_handleBackgroundMessage);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((message) {
      print('Foreground message: ${message.notification?.title}');
      _handleForegroundMessage(message);
    });

    // Handle notification tap when app is in background or terminated
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      print('Notification tapped: ${message.notification?.title}');
      _handleNotificationTap(message);
    });
  }

  Future<String?> getFCMToken() async {
    try {
      return await _firebaseMessaging.getToken();
    } catch (e) {
      print('Error getting FCM token: $e');
      return null;
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final data = message.data;
    if (data['type'] == 'incoming_call') {
      _showIncomingCallNotification(
        callId: data['callId'],
        callerName: data['callerName'],
      );
    }
  }

  static Future<void> _handleBackgroundMessage(RemoteMessage message) async {
    print('Background message: ${message.notification?.title}');
    final data = message.data;
    if (data['type'] == 'incoming_call') {
      // TODO: Route to incoming call screen
      // This is a scaffold - requires CallKit integration on iOS
    }
  }

  void _handleNotificationTap(RemoteMessage message) {
    final data = message.data;
    if (data['type'] == 'incoming_call') {
      // TODO: Navigate to incoming call screen
      // This requires a global navigation context or callback
    }
  }

  Future<void> _showIncomingCallNotification({
    required String callId,
    required String callerName,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'incoming_call_channel',
      'Incoming Calls',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      ongoing: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      callId.hashCode,
      'Incoming Call',
      'From $callerName',
      details,
      payload: 'incoming_call:$callId',
    );
  }

  Future<void> dismissNotification(String callId) async {
    await _localNotifications.cancel(callId.hashCode);
  }

  // APNs handler scaffold - requires Apple Developer account and CallKit integration
  // TODO: Implement CallKit integration for iOS
  // This would involve:
  // 1. Creating a CallKit provider and controller
  // 2. Handling call invites via CallKit
  // 3. Managing call UUID and provider delegate callbacks
}
