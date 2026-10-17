import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/call_provider.dart';
import '../providers/socket_provider.dart';
import '../models/call_state.dart';

class OutgoingCallScreen extends StatefulWidget {
  final String contactUid;
  final String contactUsername;
  final String? contactDisplayName;

  const OutgoingCallScreen({
    Key? key,
    required this.contactUid,
    required this.contactUsername,
    this.contactDisplayName,
  }) : super(key: key);

  @override
  State<OutgoingCallScreen> createState() => _OutgoingCallScreenState();
}

class _OutgoingCallScreenState extends State<OutgoingCallScreen> {
  late DateTime _callStartTime;
  bool _callAnswered = false;

  @override
  void initState() {
    super.initState();
    _callStartTime = DateTime.now();
    _initializeCall();
  }

  void _initializeCall() {
    final socketProvider = context.read<SocketProvider>();
    final callProvider = context.read<CallProvider>();

    callProvider.setCallState(
      CallStateEnum.calling,
      remoteName: widget.contactDisplayName ?? widget.contactUsername,
      remoteUid: widget.contactUid,
    );

    // Set up socket event listeners
    socketProvider.socketService.onCallAccepted = (callId) {
      _onCallAccepted(callId);
    };

    socketProvider.socketService.onCallRejected = (callId) {
      _onCallRejected();
    };

    socketProvider.socketService.onCallEnded = (callId, reason) {
      _onCallEnded();
    };

    socketProvider.socketService.onCallUnavailable = (reason) {
      _onCallUnavailable(reason);
    };

    // Send call request via socket
    socketProvider.socketService.callRequest(
      toUsername: widget.contactUsername,
      type: 'audio',
    );

    // Set 30 second timeout
    Future.delayed(const Duration(seconds: 30), () {
      if (!_callAnswered && mounted) {
        _onCallEnded();
      }
    });
  }

  void _onCallAccepted(String callId) {
    _callAnswered = true;
    if (mounted) {
      final callProvider = context.read<CallProvider>();
      callProvider.setCallState(
        CallStateEnum.connected,
        callId: callId,
        remoteName: widget.contactDisplayName ?? widget.contactUsername,
        remoteUid: widget.contactUid,
        startTime: _callStartTime,
      );

      Navigator.of(context).pushReplacementNamed(
        '/in-call',
        arguments: {
          'callId': callId,
          'remoteName': widget.contactDisplayName ?? widget.contactUsername,
          'remoteUid': widget.contactUid,
          'callStartTime': _callStartTime,
        },
      );
    }
  }

  void _onCallRejected() {
    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Call was rejected')),
      );
    }
  }

  void _onCallEnded() {
    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Call ended')),
      );
    }
  }

  void _onCallUnavailable(String reason) {
    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Call unavailable: $reason')),
      );
    }
  }

  void _endCall() {
    final socketProvider = context.read<SocketProvider>();
    final callState = context.read<CallProvider>().callState;
    
    if (callState.callId != null) {
      socketProvider.socketService.callEnd(callId: callState.callId!);
    }

    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Theme.of(context).primaryColor,
              Theme.of(context).primaryColor.withOpacity(0.7),
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 64),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    child: Text(
                      (widget.contactUsername[0]).toUpperCase(),
                      style: const TextStyle(fontSize: 32, color: Colors.white),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    widget.contactDisplayName ?? widget.contactUsername,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Calling...',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 64),
              child: GestureDetector(
                onTap: _endCall,
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.red,
                  ),
                  child: Icon(
                    Icons.call_end,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
