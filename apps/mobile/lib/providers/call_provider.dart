import 'package:flutter/foundation.dart';
import '../models/call_state.dart';
import '../models/call.dart';
import '../services/firestore_service.dart';

class CallProvider extends ChangeNotifier {
  final FirestoreService _firestoreService = FirestoreService();
  CallState _callState = CallState();
  List<Call> _callHistory = [];
  bool _isLoading = false;
  String? _error;

  CallState get callState => _callState;
  List<Call> get callHistory => _callHistory;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadCallHistory(String userUid) async {
    try {
      _isLoading = true;
      notifyListeners();

      _callHistory = await _firestoreService.getCallHistoryForBoth(userUid);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  void updateCallState(CallState state) {
    _callState = state;
    _error = null;
    notifyListeners();
  }

  void setCallState(CallStateEnum state, {
    String? callId,
    String? remoteName,
    String? remoteUid,
    DateTime? startTime,
    String? error,
  }) {
    _callState = CallState(
      state: state,
      callId: callId ?? _callState.callId,
      remoteName: remoteName ?? _callState.remoteName,
      remoteUid: remoteUid ?? _callState.remoteUid,
      startTime: startTime ?? _callState.startTime,
      error: error,
    );
    _error = error;
    notifyListeners();
  }

  void resetCallState() {
    _callState = CallState();
    _error = null;
    notifyListeners();
  }

  Future<void> saveCall(Call call) async {
    try {
      await _firestoreService.createCall(call);
      // Reload call history
      if (_callState.remoteUid != null) {
        await loadCallHistory(_callState.remoteUid!);
      }
    } catch (e) {
      print('Error saving call: $e');
    }
  }

  void clearError() {
    _error = null;
    _callState = _callState.clearError();
    notifyListeners();
  }
}
