enum CallStateEnum { idle, calling, ringing, connected, reconnecting, ended }

class CallState {
  final CallStateEnum state;
  final String? callId;
  final String? remoteName;
  final String? remoteUid;
  final DateTime? startTime;
  final String? error;

  CallState({
    this.state = CallStateEnum.idle,
    this.callId,
    this.remoteName,
    this.remoteUid,
    this.startTime,
    this.error,
  });

  CallState copyWith({
    CallStateEnum? state,
    String? callId,
    String? remoteName,
    String? remoteUid,
    DateTime? startTime,
    String? error,
  }) {
    return CallState(
      state: state ?? this.state,
      callId: callId ?? this.callId,
      remoteName: remoteName ?? this.remoteName,
      remoteUid: remoteUid ?? this.remoteUid,
      startTime: startTime ?? this.startTime,
      error: error ?? this.error,
    );
  }

  CallState clearError() {
    return copyWith(error: null);
  }
}
