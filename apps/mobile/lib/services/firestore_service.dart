import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user.dart';
import '../models/contact.dart';
import '../models/call.dart';

class FirestoreService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // User operations
  Future<void> createUser(User user) async {
    await _firestore.collection('users').doc(user.uid).set(user.toFirestore());
  }

  Future<User?> getUser(String uid) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    if (doc.exists) {
      return User.fromFirestore(doc);
    }
    return null;
  }

  Future<User?> searchUser(String username) async {
    try {
      final query = await _firestore
          .collection('users')
          .where('username', isEqualTo: username.toLowerCase())
          .limit(1)
          .get();

      if (query.docs.isNotEmpty) {
        return User.fromFirestore(query.docs.first);
      }
      return null;
    } catch (e) {
      print('Search user error: $e');
      return null;
    }
  }

  Future<void> updateUser(User user) async {
    await _firestore.collection('users').doc(user.uid).update(user.toFirestore());
  }

  // Contact operations
  Stream<List<Contact>> listContacts(String ownerUid) {
    return _firestore
        .collection('contacts')
        .where('ownerUid', isEqualTo: ownerUid)
        .snapshots()
        .map((query) => query.docs.map((doc) => Contact.fromFirestore(doc)).toList());
  }

  Stream<List<Contact>> listPendingContacts(String ownerUid) {
    return _firestore
        .collection('contacts')
        .where('ownerUid', isEqualTo: ownerUid)
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map((query) => query.docs.map((doc) => Contact.fromFirestore(doc)).toList());
  }

  Future<void> addContact(Contact contact) async {
    await _firestore.collection('contacts').doc(contact.id).set(contact.toFirestore());
  }

  Future<void> respondContact(String contactId, ContactStatus status) async {
    await _firestore.collection('contacts').doc(contactId).update({
      'status': status == ContactStatus.accepted ? 'accepted' : 'blocked',
    });
  }

  Future<Contact?> getContact(String contactId) async {
    final doc = await _firestore.collection('contacts').doc(contactId).get();
    if (doc.exists) {
      return Contact.fromFirestore(doc);
    }
    return null;
  }

  Future<bool> contactExists(String ownerUid, String contactUid) async {
    final query = await _firestore
        .collection('contacts')
        .where('ownerUid', isEqualTo: ownerUid)
        .where('contactUid', isEqualTo: contactUid)
        .limit(1)
        .get();
    return query.docs.isNotEmpty;
  }

  // Call operations
  Future<void> createCall(Call call) async {
    await _firestore.collection('calls').doc(call.callId).set(call.toFirestore());
  }

  Future<void> updateCall(Call call) async {
    await _firestore.collection('calls').doc(call.callId).update(call.toFirestore());
  }

  Stream<List<Call>> getCallHistory(String userUid, {int limit = 50}) {
    return _firestore
        .collection('calls')
        .where('callerUid', isEqualTo: userUid)
        .orderBy('startedAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((query) => query.docs.map((doc) => Call.fromFirestore(doc)).toList());
  }

  Future<List<Call>> getCallHistoryForBoth(String userUid, {int limit = 50}) async {
    try {
      final callsAsCallerQuery = await _firestore
          .collection('calls')
          .where('callerUid', isEqualTo: userUid)
          .orderBy('startedAt', descending: true)
          .limit(limit)
          .get();

      final callsAsCalleeQuery = await _firestore
          .collection('calls')
          .where('calleeUid', isEqualTo: userUid)
          .orderBy('startedAt', descending: true)
          .limit(limit)
          .get();

      final allCalls = [
        ...callsAsCallerQuery.docs.map((doc) => Call.fromFirestore(doc)),
        ...callsAsCalleeQuery.docs.map((doc) => Call.fromFirestore(doc)),
      ];

      allCalls.sort((a, b) => b.startedAt.compareTo(a.startedAt));
      return allCalls.take(limit).toList();
    } catch (e) {
      print('Error fetching call history: $e');
      return [];
    }
  }

  Future<Call?> getCall(String callId) async {
    final doc = await _firestore.collection('calls').doc(callId).get();
    if (doc.exists) {
      return Call.fromFirestore(doc);
    }
    return null;
  }
}
