import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/contacts_provider.dart';
import '../models/contact.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  late TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _loadContacts();
  }

  void _loadContacts() {
    final authProvider = context.read<AuthProvider>();
    final contactsProvider = context.read<ContactsProvider>();
    
    if (authProvider.currentUserId != null) {
      contactsProvider.loadContacts(authProvider.currentUserId!);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CallMe'),
        elevation: 0,
      ),
      body: Consumer2<AuthProvider, ContactsProvider>(
        builder: (context, authProvider, contactsProvider, _) {
          return IndexedStack(
            index: _selectedIndex,
            children: [
              _buildContactsTab(context, authProvider, contactsProvider),
              _buildHistoryTab(context, authProvider),
              _buildSettingsTab(context, authProvider),
            ],
          );
        },
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.contacts),
            label: 'Contacts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history),
            label: 'History',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }

  Widget _buildContactsTab(
    BuildContext context,
    AuthProvider authProvider,
    ContactsProvider contactsProvider,
  ) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search contacts...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
        if (contactsProvider.pendingRequests.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pending Requests',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 8),
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: contactsProvider.pendingRequests.length,
                  itemBuilder: (context, index) {
                    final contact = contactsProvider.pendingRequests[index];
                    return ListTile(
                      leading: CircleAvatar(
                        child: Text(
                          (contact.contactUsername ?? 'U')[0].toUpperCase(),
                        ),
                      ),
                      title: Text(contact.contactDisplayName ?? contact.contactUsername ?? 'Unknown'),
                      subtitle: const Text('Pending...'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.check, color: Colors.green),
                            onPressed: () async {
                              await contactsProvider.acceptContact(contact.id);
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.red),
                            onPressed: () async {
                              await contactsProvider.blockContact(contact.id);
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        Expanded(
          child: contactsProvider.contacts.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.contacts,
                        size: 64,
                        color: Colors.grey[300],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No contacts yet',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).pushNamed('/add-contact');
                        },
                        icon: const Icon(Icons.person_add),
                        label: const Text('Add Contact'),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: contactsProvider.contacts.length,
                  itemBuilder: (context, index) {
                    final contact = contactsProvider.contacts[index];
                    return ListTile(
                      leading: CircleAvatar(
                        child: Text(
                          (contact.contactUsername ?? 'U')[0].toUpperCase(),
                        ),
                      ),
                      title: Text(contact.contactDisplayName ?? contact.contactUsername ?? 'Unknown'),
                      subtitle: const Text('Online'),
                      onTap: () {
                        Navigator.of(context).pushNamed(
                          '/outgoing-call',
                          arguments: {
                            'contactUid': contact.contactUid,
                            'contactUsername': contact.contactUsername,
                            'contactDisplayName': contact.contactDisplayName,
                          },
                        );
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildHistoryTab(BuildContext context, AuthProvider authProvider) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.history,
            size: 64,
            color: Colors.grey[300],
          ),
          const SizedBox(height: 16),
          Text(
            'Call History',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTab(BuildContext context, AuthProvider authProvider) {
    return Column(
      children: [
        ListTile(
          leading: const Icon(Icons.person),
          title: const Text('Profile'),
          subtitle: Text(authProvider.user?.username ?? 'Unknown'),
        ),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.email),
          title: const Text('Email'),
          subtitle: Text(authProvider.user?.email ?? 'Unknown'),
        ),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('Logout'),
          onTap: () async {
            await authProvider.logout();
            if (mounted) {
              Navigator.of(context).pushReplacementNamed('/login');
            }
          },
        ),
      ],
    );
  }
}
