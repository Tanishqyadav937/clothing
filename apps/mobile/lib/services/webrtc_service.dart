import 'package:flutter_webrtc/flutter_webrtc.dart';

typedef OnLocalStream = Function(MediaStream stream);
typedef OnRemoteStream = Function(MediaStream stream);
typedef OnConnectionStateChange = Function(RTCPeerConnectionState state);
typedef OnIceCandidate = Function(RTCIceCandidate candidate);

class WebRTCService {
  late RTCPeerConnection _peerConnection;
  MediaStream? _localStream;
  MediaStream? _remoteStream;

  OnLocalStream? onLocalStream;
  OnRemoteStream? onRemoteStream;
  OnConnectionStateChange? onConnectionStateChange;
  OnIceCandidate? onIceCandidate;

  MediaStream? get localStream => _localStream;
  MediaStream? get remoteStream => _remoteStream;

  Future<RTCPeerConnection> createPeerConnection() async {
    try {
      final configuration = {
        'iceServers': [
          {'urls': ['stun:stun.l.google.com:19302']},
          {'urls': ['stun:stun1.l.google.com:19302']},
        ]
      };

      _peerConnection = await createPeerConnection(configuration, {});

      _peerConnection.onConnectionStateChange = (state) {
        print('PeerConnection state: $state');
        onConnectionStateChange?.call(state);
      };

      _peerConnection.onIceCandidate = (candidate) {
        print('ICE candidate: ${candidate.candidate}');
        onIceCandidate?.call(candidate);
      };

      _peerConnection.onAddStream = (stream) {
        print('Remote stream added');
        _remoteStream = stream;
        onRemoteStream?.call(stream);
      };

      _peerConnection.onRemoveStream = (stream) {
        print('Remote stream removed');
        _remoteStream = null;
      };

      _peerConnection.onTrack = (event) {
        print('Track added: ${event.track.kind}');
        if (event.streams.isNotEmpty) {
          _remoteStream = event.streams[0];
          onRemoteStream?.call(event.streams[0]);
        }
      };

      return _peerConnection;
    } catch (e) {
      print('Error creating peer connection: $e');
      rethrow;
    }
  }

  Future<void> getUserMedia() async {
    try {
      final constraints = {
        'audio': true,
        'video': false,
      };

      _localStream = await navigator.mediaDevices.getUserMedia(constraints);
      print('Local stream obtained: ${_localStream?.id}');

      for (var track in _localStream!.getTracks()) {
        _peerConnection.addTrack(track, _localStream!);
      }

      onLocalStream?.call(_localStream!);
    } catch (e) {
      print('Error getting user media: $e');
      rethrow;
    }
  }

  Future<RTCSessionDescription> createOffer() async {
    try {
      final offer = await _peerConnection.createOffer({});
      await _peerConnection.setLocalDescription(offer);
      print('Offer created and set as local description');
      return offer;
    } catch (e) {
      print('Error creating offer: $e');
      rethrow;
    }
  }

  Future<void> setRemoteDescription(RTCSessionDescription description) async {
    try {
      await _peerConnection.setRemoteDescription(description);
      print('Remote description set');
    } catch (e) {
      print('Error setting remote description: $e');
      rethrow;
    }
  }

  Future<RTCSessionDescription> createAnswer() async {
    try {
      final answer = await _peerConnection.createAnswer({});
      await _peerConnection.setLocalDescription(answer);
      print('Answer created and set as local description');
      return answer;
    } catch (e) {
      print('Error creating answer: $e');
      rethrow;
    }
  }

  Future<void> addIceCandidate(RTCIceCandidate candidate) async {
    try {
      await _peerConnection.addCandidate(candidate);
      print('ICE candidate added');
    } catch (e) {
      print('Error adding ICE candidate: $e');
    }
  }

  void setAudioEnabled(bool enabled) {
    if (_localStream != null) {
      for (var track in _localStream!.getAudioTracks()) {
        track.enabled = enabled;
      }
    }
  }

  bool getAudioEnabled() {
    if (_localStream != null && _localStream!.getAudioTracks().isNotEmpty) {
      return _localStream!.getAudioTracks()[0].enabled;
    }
    return false;
  }

  Future<void> switchSpeakerphone(bool enable) async {
    try {
      await Helper.setSpeakerphoneOn(enable);
    } catch (e) {
      print('Error switching speakerphone: $e');
    }
  }

  Future<void> close() async {
    try {
      if (_localStream != null) {
        for (var track in _localStream!.getTracks()) {
          await track.stop();
        }
        await _localStream!.dispose();
        _localStream = null;
      }

      await _peerConnection.close();
      print('Peer connection closed');
    } catch (e) {
      print('Error closing peer connection: $e');
    }
  }

  RTCPeerConnection get peerConnection => _peerConnection;
}
