import 'package:flutter/foundation.dart';
import '../models/contact.dart';
import '../models/user.dart';
import '../services/firestore_service.dart';

class ContactsProvider extends ChangeNotifier {
  final FirestoreService _firestoreService = FirestoreService();
  List<Contact> _contacts = [];
  List<Contact> _pendingRequests = [];
  bool _isLoading = false;
  String? _error;

  List<Contact> get contacts => _contacts;
  List<Contact> get pendingRequests => _pendingRequests;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadContacts(String ownerUid) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      _firestoreService.listContacts(ownerUid).listen((contacts) {
        _contacts = contacts.where((c) => c.status == ContactStatus.accepted).toList();
        notifyListeners();
      });

      _firestoreService.listPendingContacts(ownerUid).listen((requests) {
        _pendingRequests = requests;
        notifyListeners();
      });

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> sendContactRequest({
    required String ownerUid,
    required String contactUid,
    required String contactUsername,
    String? contactDisplayName,
  }) async {
    try {
      _error = null;

      // Check if contact already exists
      final exists = await _firestoreService.contactExists(ownerUid, contactUid);
      if (exists) {
        _error = 'Contact already added';
        notifyListeners();
        return false;
      }

      final contact = Contact(
        id: '$ownerUid-$contactUid',
        ownerUid: ownerUid,
        contactUid: contactUid,
        status: ContactStatus.pending,
        createdAt: DateTime.now(),
        contactUsername: contactUsername,
        contactDisplayName: contactDisplayName,
      );

      await _firestoreService.addContact(contact);
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> acceptContact(String contactId) async {
    try {
      _error = null;
      await _firestoreService.respondContact(contactId, ContactStatus.accepted);
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> blockContact(String contactId) async {
    try {
      _error = null;
      await _firestoreService.respondContact(contactId, ContactStatus.blocked);
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> removeContact(String contactId) async {
    try {
      _error = null;
      // For MVP, we'll just update to blocked status
      await _firestoreService.respondContact(contactId, ContactStatus.blocked);
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
