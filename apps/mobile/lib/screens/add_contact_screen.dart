import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/contacts_provider.dart';
import '../services/firestore_service.dart';

class AddContactScreen extends StatefulWidget {
  const AddContactScreen({Key? key}) : super(key: key);

  @override
  State<AddContactScreen> createState() => _AddContactScreenState();
}

class _AddContactScreenState extends State<AddContactScreen> {
  late TextEditingController _searchController;
  final FirestoreService _firestoreService = FirestoreService();
  bool _isSearching = false;
  bool _userFound = false;
  String? _foundUsername;
  String? _foundDisplayName;
  String? _foundUid;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _searchUser(String username) async {
    if (username.isEmpty) {
      setState(() {
        _userFound = false;
        _isSearching = false;
      });
      return;
    }

    setState(() => _isSearching = true);

    try {
      final user = await _firestoreService.searchUser(username);
      
      if (user != null) {
        setState(() {
          _foundUsername = user.username;
          _foundDisplayName = user.displayName;
          _foundUid = user.uid;
          _userFound = true;
          _isSearching = false;
        });
      } else {
        setState(() {
          _userFound = false;
          _isSearching = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('User not found')),
          );
        }
      }
    } catch (e) {
      setState(() => _isSearching = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _sendContactRequest() async {
    final authProvider = context.read<AuthProvider>();
    final contactsProvider = context.read<ContactsProvider>();

    if (_foundUid == null || _foundUsername == null) return;
    if (authProvider.currentUserId == null) return;

    try {
      final success = await contactsProvider.sendContactRequest(
        ownerUid: authProvider.currentUserId!,
        contactUid: _foundUid!,
        contactUsername: _foundUsername!,
        contactDisplayName: _foundDisplayName,
      );

      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Contact request sent')),
          );
          Navigator.of(context).pop();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(contactsProvider.error ?? 'Failed to send request')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Contact'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _searchController,
              decoration: InputDecoration(
                labelText: 'Search by username',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onChanged: (value) {
                setState(() {
                  if (value.isEmpty) {
                    _userFound = false;
                  }
                });
              },
              onSubmitted: _searchUser,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isSearching ? null : () => _searchUser(_searchController.text),
              child: _isSearching
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text('Search'),
            ),
            const SizedBox(height: 32),
            if (_userFound)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          CircleAvatar(
                            radius: 40,
                            child: Text(
                              (_foundUsername ?? 'U')[0].toUpperCase(),
                              style: const TextStyle(fontSize: 32),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _foundDisplayName ?? _foundUsername ?? 'Unknown',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '@$_foundUsername',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _sendContactRequest,
                    child: const Text('Send Contact Request'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
