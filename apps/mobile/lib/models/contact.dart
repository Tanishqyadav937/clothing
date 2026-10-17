import 'package:cloud_firestore/cloud_firestore.dart';

enum ContactStatus { pending, accepted, blocked }

class Contact {
  final String id;
  final String ownerUid;
  final String contactUid;
  final ContactStatus status;
  final DateTime createdAt;
  final String? contactUsername;
  final String? contactDisplayName;

  Contact({
    required this.id,
    required this.ownerUid,
    required this.contactUid,
    required this.status,
    required this.createdAt,
    this.contactUsername,
    this.contactDisplayName,
  });

  factory Contact.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Contact(
      id: doc.id,
      ownerUid: data['ownerUid'] ?? '',
      contactUid: data['contactUid'] ?? '',
      status: _parseStatus(data['status']),
      createdAt: (data['createdAt'] as Timestamp).toDate(),
      contactUsername: data['contactUsername'],
      contactDisplayName: data['contactDisplayName'],
    );
  }

  static ContactStatus _parseStatus(String? status) {
    switch (status) {
      case 'pending':
        return ContactStatus.pending;
      case 'accepted':
        return ContactStatus.accepted;
      case 'blocked':
        return ContactStatus.blocked;
      default:
        return ContactStatus.pending;
    }
  }

  String get statusString {
    switch (status) {
      case ContactStatus.pending:
        return 'pending';
      case ContactStatus.accepted:
        return 'accepted';
      case ContactStatus.blocked:
        return 'blocked';
    }
  }

  Map<String, dynamic> toFirestore() {
    return {
      'ownerUid': ownerUid,
      'contactUid': contactUid,
      'status': statusString,
      'createdAt': Timestamp.fromDate(createdAt),
      'contactUsername': contactUsername,
      'contactDisplayName': contactDisplayName,
    };
  }

  Contact copyWith({
    String? id,
    String? ownerUid,
    String? contactUid,
    ContactStatus? status,
    DateTime? createdAt,
    String? contactUsername,
    String? contactDisplayName,
  }) {
    return Contact(
      id: id ?? this.id,
      ownerUid: ownerUid ?? this.ownerUid,
      contactUid: contactUid ?? this.contactUid,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      contactUsername: contactUsername ?? this.contactUsername,
      contactDisplayName: contactDisplayName ?? this.contactDisplayName,
    );
  }
}
