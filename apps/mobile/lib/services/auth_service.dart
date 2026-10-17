import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user.dart';

class AuthService {
  final fb.FirebaseAuth _auth = fb.FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<User?> get authStateChanges {
    return _auth.authStateChanges().asyncMap((fbUser) async {
      if (fbUser == null) return null;
      try {
        final doc = await _firestore.collection('users').doc(fbUser.uid).get();
        if (doc.exists) {
          return User.fromFirestore(doc);
        }
      } catch (e) {
        print('Error fetching user: $e');
      }
      return null;
    });
  }

  Future<User?> signup({
    required String email,
    required String password,
    required String username,
    String? displayName,
  }) async {
    try {
      final cred = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final fbUser = cred.user;
      if (fbUser == null) throw Exception('User creation failed');

      final newUser = User(
        uid: fbUser.uid,
        username: username,
        email: email,
        displayName: displayName,
        createdAt: DateTime.now(),
      );

      await _firestore.collection('users').doc(fbUser.uid).set(newUser.toFirestore());
      return newUser;
    } catch (e) {
      print('Signup error: $e');
      rethrow;
    }
  }

  Future<User?> login({
    required String email,
    required String password,
  }) async {
    try {
      final cred = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      final fbUser = cred.user;
      if (fbUser == null) return null;

      final doc = await _firestore.collection('users').doc(fbUser.uid).get();
      if (doc.exists) {
        return User.fromFirestore(doc);
      }
      return null;
    } catch (e) {
      print('Login error: $e');
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await _auth.signOut();
    } catch (e) {
      print('Logout error: $e');
      rethrow;
    }
  }

  Future<User?> getCurrentUser() async {
    final fbUser = _auth.currentUser;
    if (fbUser == null) return null;

    try {
      final doc = await _firestore.collection('users').doc(fbUser.uid).get();
      if (doc.exists) {
        return User.fromFirestore(doc);
      }
    } catch (e) {
      print('Error fetching current user: $e');
    }
    return null;
  }

  Future<String?> getIdToken() async {
    final fbUser = _auth.currentUser;
    if (fbUser == null) return null;

    try {
      return await fbUser.getIdToken();
    } catch (e) {
      print('Error getting ID token: $e');
      return null;
    }
  }

  String? get currentUserId => _auth.currentUser?.uid;

  bool get isAuthenticated => _auth.currentUser != null;
}
