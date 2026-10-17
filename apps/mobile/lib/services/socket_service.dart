import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'dart:typed_data';

typedef OnCallIncoming = Function(String callId, String fromUsername, String type);
typedef OnCallAccepted = Function(String callId);
typedef OnCallRejected = Function(String callId);
typedef OnCallEnded = Function(String callId, String? reason);
typedef OnWebRTCOffer = Function(String callId, Map<String, dynamic> sdp);
typedef OnWebRTCAnswer = Function(String callId, Map<String, dynamic> sdp);
typedef OnWebRTCIce = Function(String callId, Map<String, dynamic> candidate);
typedef OnPresenceUpdate = Function(String uid, bool online);
typedef OnCallUnavailable = Function(String reason);

class SocketService {
  late IO.Socket _socket;
  bool _isConnected = false;

  OnCallIncoming? onCallIncoming;
  OnCallAccepted? onCallAccepted;
  OnCallRejected? onCallRejected;
  OnCallEnded? onCallEnded;
  OnWebRTCOffer? onWebRTCOffer;
  OnWebRTCAnswer? onWebRTCAnswer;
  OnWebRTCIce? onWebRTCIce;
  OnPresenceUpdate? onPresenceUpdate;
  OnCallUnavailable? onCallUnavailable;

  bool get isConnected => _isConnected;

  Future<void> connect(String serverUrl, String token) async {
    try {
      _socket = IO.io(
        serverUrl,
        IO.OptionBuilder()
            .setTransports(['websocket'])
            .disableAutoConnect()
            .setAuth({'token': token})
            .build(),
      );

      _socket.on('auth:ok', (data) {
        _isConnected = true;
        print('Socket authenticated: ${data['uid']}');
      });

      _socket.on('auth:error', (data) {
        print('Socket auth error: ${data['reason']}');
        _isConnected = false;
      });

      _socket.on('call:incoming', (data) {
        print('Incoming call: ${data['callId']}');
        onCallIncoming?.call(data['callId'], data['fromUsername'], data['type'] ?? 'audio');
      });

      _socket.on('call:accepted', (data) {
        onCallAccepted?.call(data['callId']);
      });

      _socket.on('call:rejected', (data) {
        onCallRejected?.call(data['callId']);
      });

      _socket.on('call:ended', (data) {
        onCallEnded?.call(data['callId'], data['reason']);
      });

      _socket.on('call:unavailable', (data) {
        onCallUnavailable?.call(data['reason'] ?? 'User unavailable');
      });

      _socket.on('webrtc:offer', (data) {
        onWebRTCOffer?.call(data['callId'], data['sdp']);
      });

      _socket.on('webrtc:answer', (data) {
        onWebRTCAnswer?.call(data['callId'], data['sdp']);
      });

      _socket.on('webrtc:ice', (data) {
        onWebRTCIce?.call(data['callId'], data['candidate']);
      });

      _socket.on('presence:update', (data) {
        onPresenceUpdate?.call(data['uid'], data['online'] ?? false);
      });

      _socket.connect();
      await Future.delayed(const Duration(milliseconds: 500));
    } catch (e) {
      print('Socket connection error: $e');
      rethrow;
    }
  }

  Future<void> disconnect() async {
    _isConnected = false;
    _socket.disconnect();
    _socket.close();
  }

  void emit(String event, [dynamic data]) {
    if (_isConnected) {
      _socket.emit(event, data);
    } else {
      print('Socket not connected, cannot emit $event');
    }
  }

  void callRequest({required String toUsername, required String type}) {
    emit('call:request', {'toUsername': toUsername, 'type': type});
  }

  void callAccept({required String callId}) {
    emit('call:accept', {'callId': callId});
  }

  void callReject({required String callId}) {
    emit('call:reject', {'callId': callId});
  }

  void callEnd({required String callId}) {
    emit('call:end', {'callId': callId});
  }

  void webrtcOffer({required String callId, required Map<String, dynamic> sdp}) {
    emit('webrtc:offer', {'callId': callId, 'sdp': sdp});
  }

  void webrtcAnswer({required String callId, required Map<String, dynamic> sdp}) {
    emit('webrtc:answer', {'callId': callId, 'sdp': sdp});
  }

  void webrtcIce({required String callId, required Map<String, dynamic> candidate}) {
    emit('webrtc:ice', {'callId': callId, 'candidate': candidate});
  }

  IO.Socket get socket => _socket;
}
