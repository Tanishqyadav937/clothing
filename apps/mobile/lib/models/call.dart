import 'package:cloud_firestore/cloud_firestore.dart';

enum CallType { audio, video }
enum CallStatus { missed, rejected, completed, failed }

class Call {
  final String callId;
  final String callerUid;
  final String calleeUid;
  final CallType type;
  final CallStatus status;
  final DateTime startedAt;
  final DateTime? answeredAt;
  final DateTime? endedAt;
  final int durationSec;
  final String? callerUsername;
  final String? calleeUsername;

  Call({
    required this.callId,
    required this.callerUid,
    required this.calleeUid,
    required this.type,
    required this.status,
    required this.startedAt,
    this.answeredAt,
    this.endedAt,
    this.durationSec = 0,
    this.callerUsername,
    this.calleeUsername,
  });

  factory Call.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Call(
      callId: data['callId'] ?? '',
      callerUid: data['callerUid'] ?? '',
      calleeUid: data['calleeUid'] ?? '',
      type: data['type'] == 'video' ? CallType.video : CallType.audio,
      status: _parseStatus(data['status']),
      startedAt: (data['startedAt'] as Timestamp).toDate(),
      answeredAt: data['answeredAt'] != null ? (data['answeredAt'] as Timestamp).toDate() : null,
      endedAt: data['endedAt'] != null ? (data['endedAt'] as Timestamp).toDate() : null,
      durationSec: data['durationSec'] ?? 0,
      callerUsername: data['callerUsername'],
      calleeUsername: data['calleeUsername'],
    );
  }

  static CallStatus _parseStatus(String? status) {
    switch (status) {
      case 'missed':
        return CallStatus.missed;
      case 'rejected':
        return CallStatus.rejected;
      case 'completed':
        return CallStatus.completed;
      case 'failed':
        return CallStatus.failed;
      default:
        return CallStatus.failed;
    }
  }

  String get typeString => type == CallType.audio ? 'audio' : 'video';
  
  String get statusString {
    switch (status) {
      case CallStatus.missed:
        return 'missed';
      case CallStatus.rejected:
        return 'rejected';
      case CallStatus.completed:
        return 'completed';
      case CallStatus.failed:
        return 'failed';
    }
  }

  Map<String, dynamic> toFirestore() {
    return {
      'callId': callId,
      'callerUid': callerUid,
      'calleeUid': calleeUid,
      'type': typeString,
      'status': statusString,
      'startedAt': Timestamp.fromDate(startedAt),
      'answeredAt': answeredAt != null ? Timestamp.fromDate(answeredAt!) : null,
      'endedAt': endedAt != null ? Timestamp.fromDate(endedAt!) : null,
      'durationSec': durationSec,
      'callerUsername': callerUsername,
      'calleeUsername': calleeUsername,
    };
  }

  Call copyWith({
    String? callId,
    String? callerUid,
    String? calleeUid,
    CallType? type,
    CallStatus? status,
    DateTime? startedAt,
    DateTime? answeredAt,
    DateTime? endedAt,
    int? durationSec,
    String? callerUsername,
    String? calleeUsername,
  }) {
    return Call(
      callId: callId ?? this.callId,
      callerUid: callerUid ?? this.callerUid,
      calleeUid: calleeUid ?? this.calleeUid,
      type: type ?? this.type,
      status: status ?? this.status,
      startedAt: startedAt ?? this.startedAt,
      answeredAt: answeredAt ?? this.answeredAt,
      endedAt: endedAt ?? this.endedAt,
      durationSec: durationSec ?? this.durationSec,
      callerUsername: callerUsername ?? this.callerUsername,
      calleeUsername: calleeUsername ?? this.calleeUsername,
    );
  }
}
