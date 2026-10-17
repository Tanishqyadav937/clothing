import 'package:flutter/foundation.dart';
import '../services/socket_service.dart';

class SocketProvider extends ChangeNotifier {
  final SocketService _socketService = SocketService();
  bool _isConnected = false;
  String? _error;

  bool get isConnected => _isConnected;
  String? get error => _error;
  SocketService get socketService => _socketService;

  Future<void> connect(String serverUrl, String token) async {
    try {
      _error = null;
      notifyListeners();

      await _socketService.connect(serverUrl, token);
      _isConnected = true;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isConnected = false;
      notifyListeners();
    }
  }

  Future<void> disconnect() async {
    try {
      await _socketService.disconnect();
      _isConnected = false;
      _error = null;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
