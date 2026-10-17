import admin from 'firebase-admin';

let db = null;

/**
 * Initialize Firestore database (lazy initialization)
 */
function getDb() {
  if (!db) {
    db = admin.firestore();
  }
  return db;
}

/**
 * Users Collection CRUD
 */

export async function createUser(uid, displayName) {
  const userRef = getDb().collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    await userRef.set({
      uid,
      displayName,
      username: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return userRef;
}

export async function getUser(uid) {
  const userDoc = await getDb().collection('users').doc(uid).get();
  return userDoc.exists ? userDoc.data() : null;
}

export async function getUserByUsername(username) {
  const querySnapshot = await getDb()
    .collection('users')
    .where('username', '==', username)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;
  return querySnapshot.docs[0].data();
}

export async function setUsername(uid, username) {
  const userRef = getDb().collection('users').doc(uid);
  await userRef.update({ username });
  return userRef;
}

/**
 * Contacts Collection CRUD
 */

export async function requestContact(requesterUid, targetUsername) {
  // Find target user by username
  const targetUser = await getUserByUsername(targetUsername);
  if (!targetUser) {
    throw new Error('User not found');
  }

  const targetUid = targetUser.uid;

  // Check if already connected or pending
  const existingContact = await getDb()
    .collection('users')
    .doc(requesterUid)
    .collection('contacts')
    .doc(targetUid)
    .get();

  if (existingContact.exists) {
    throw new Error('Contact request or relationship already exists');
  }

  // Create pending contact request
  await getDb()
    .collection('users')
    .doc(requesterUid)
    .collection('contacts')
    .doc(targetUid)
    .set({
      uid: targetUid,
      username: targetUsername,
      displayName: targetUser.displayName,
      status: 'pending', // pending, accepted, blocked
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return targetUid;
}

export async function getContacts(uid) {
  const snapshot = await getDb()
    .collection('users')
    .doc(uid)
    .collection('contacts')
    .get();

  return snapshot.docs.map(doc => doc.data());
}

export async function respondToContact(uid, targetUid, action) {
  const contactRef = getDb()
    .collection('users')
    .doc(uid)
    .collection('contacts')
    .doc(targetUid);

  if (action === 'accept') {
    await contactRef.update({ status: 'accepted' });

    // Also create reverse contact if accepted
    const currentUser = await getUser(uid);
    if (currentUser) {
      await getDb()
        .collection('users')
        .doc(targetUid)
        .collection('contacts')
        .doc(uid)
        .set({
          uid,
          username: currentUser.username,
          displayName: currentUser.displayName,
          status: 'accepted',
          respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  } else if (action === 'decline') {
    await contactRef.delete();
  }
}

export async function blockContact(uid, targetUid) {
  await getDb()
    .collection('users')
    .doc(uid)
    .collection('contacts')
    .doc(targetUid)
    .set({ status: 'blocked' }, { merge: true });
}

/**
 * Calls Collection CRUD
 */

export async function createCall(callId, callerUid, calleeUid) {
  const callRef = getDb().collection('calls').doc(callId);
  await callRef.set({
    callId,
    callerUid,
    calleeUid,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    answeredAt: null,
    endedAt: null,
    status: 'initiated', // initiated, ringing, answered, completed, rejected, missed
  });
  return callRef;
}

export async function updateCall(callId, updates) {
  const callRef = getDb().collection('calls').doc(callId);
  await callRef.update(updates);
}

export async function getCallHistory(uid, limit = 20, offset = 0) {
  const snapshot = await getDb()
    .collection('calls')
    .where('callerUid', '==', uid)
    .orderBy('startedAt', 'desc')
    .limit(limit + offset)
    .get();

  return snapshot.docs.slice(offset).map(doc => ({
    ...doc.data(),
    durationSec: doc.data().endedAt
      ? Math.floor(
          (doc.data().endedAt.toDate() - doc.data().startedAt.toDate()) / 1000
        )
      : 0,
  }));
}
