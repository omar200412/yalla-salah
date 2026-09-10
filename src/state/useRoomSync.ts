import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { db } from '../config/firebase';
import { NAME_MAX_LENGTH } from '../config/constants';
import { generateCode } from '../lib/code';
import { DayDoc, Marks, PrayerKey, RoomDoc } from '../types';

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return (trimmed || 'Me').slice(0, NAME_MAX_LENGTH);
}

function roomRef(roomId: string) {
  return doc(db, 'rooms', roomId);
}

function dayRef(roomId: string, dayKey: string) {
  return doc(db, 'rooms', roomId, 'days', dayKey);
}

/**
 * Create a brand-new room with a random, unused 6-digit code.
 * The creator takes slot "a". Returns the code.
 */
export async function createRoom(uid: string, displayName: string): Promise<string> {
  const name = cleanName(displayName);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode();
    const ref = roomRef(code);
    // eslint-disable-next-line no-await-in-loop
    const existing = await getDoc(ref);
    if (existing.exists()) continue;

    // eslint-disable-next-line no-await-in-loop
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      slots: { a: uid, b: null },
      names: { [uid]: name },
    });
    return code;
  }

  throw new Error('Could not allocate a room code. Please try again.');
}

/**
 * Join an existing room by code. Claims the first free slot; if the caller is
 * already a member it just refreshes their display name.
 */
export async function joinRoom(uid: string, displayName: string, code: string): Promise<void> {
  const name = cleanName(displayName);
  const ref = roomRef(code);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error('No room found with that code.');
    }

    const data = snap.data() as RoomDoc;
    const inSlotA = data.slots.a === uid;
    const inSlotB = data.slots.b === uid;

    if (inSlotA || inSlotB) {
      tx.update(ref, { [`names.${uid}`]: name });
      return;
    }

    if (data.slots.b === null) {
      tx.update(ref, { 'slots.b': uid, [`names.${uid}`]: name });
    } else if (data.slots.a === null) {
      tx.update(ref, { 'slots.a': uid, [`names.${uid}`]: name });
    } else {
      throw new Error('This room already has two people.');
    }
  });
}

export type RoomSync = {
  room: RoomDoc | null;
  day: DayDoc | null;
  loading: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  /** uid of the other member, or null while waiting for someone to join. */
  partnerUid: string | null;
  myMarks: Marks;
  partnerMarks: Marks;
  toggle: (prayer: PrayerKey) => Promise<void>;
  rename: (name: string) => Promise<void>;
  leave: () => Promise<void>;
};

/**
 * Subscribes to the room document and to today's day document, and exposes the
 * mutations the UI needs. All writes are field-scoped so the two members never
 * overwrite each other.
 */
export function useRoomSync(
  roomId: string | null,
  uid: string | null,
  dayKey: string,
): RoomSync {
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [day, setDay] = useState<DayDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(roomId));
  const [error, setError] = useState<string | null>(null);

  // Keep the latest `day` in a ref so `toggle` can read current state without
  // being re-created on every snapshot.
  const dayRefValue = useRef<DayDoc | null>(null);
  dayRefValue.current = day;

  useEffect(() => {
    if (!roomId || !uid) {
      setRoom(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      roomRef(roomId),
      (snap) => {
        if (snap.exists()) {
          setRoom(snap.data() as RoomDoc);
          setError(null);
        } else {
          setRoom(null);
          setError('This room no longer exists. Create or join another one.');
        }
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [roomId, uid]);

  useEffect(() => {
    if (!roomId || !uid) {
      setDay(null);
      return;
    }

    const unsubscribe = onSnapshot(
      dayRef(roomId, dayKey),
      (snap) => {
        setDay(snap.exists() ? (snap.data() as DayDoc) : { marks: {} });
      },
      (e) => {
        setError(e.message);
      },
    );

    return unsubscribe;
  }, [roomId, uid, dayKey]);

  const toggle = useCallback(
    async (prayer: PrayerKey) => {
      if (!roomId || !uid) return;

      const mine = dayRefValue.current?.marks?.[uid] ?? {};
      const isDone = mine[prayer] != null;

      try {
        await setDoc(
          dayRef(roomId, dayKey),
          {
            updatedAt: serverTimestamp(),
            marks: { [uid]: { [prayer]: isDone ? null : Date.now() } },
          },
          { merge: true },
        );
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Could not save. Check your connection.';
        setError(message);
        throw e;
      }
    },
    [roomId, uid, dayKey],
  );

  const rename = useCallback(
    async (name: string) => {
      if (!roomId || !uid) return;
      await updateDoc(roomRef(roomId), { [`names.${uid}`]: cleanName(name) });
    },
    [roomId, uid],
  );

  const leave = useCallback(async () => {
    if (!roomId || !uid) return;
    try {
      await runTransaction(db, async (tx) => {
        const ref = roomRef(roomId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;

        const data = snap.data() as RoomDoc;
        const patch: Record<string, unknown> = {};
        if (data.slots.a === uid) patch['slots.a'] = null;
        if (data.slots.b === uid) patch['slots.b'] = null;
        if (Object.keys(patch).length > 0) {
          patch[`names.${uid}`] = deleteField();
          tx.update(ref, patch);
        }
      });
    } catch {
      // Best effort — the local "leave" (clearing roomId) still proceeds.
    }
  }, [roomId, uid]);

  const partnerUid = useMemo<string | null>(() => {
    if (!room || !uid) return null;
    const other = room.slots.a === uid ? room.slots.b : room.slots.a;
    return other ?? null;
  }, [room, uid]);

  const myMarks = useMemo<Marks>(() => {
    if (!uid) return {};
    return (day?.marks?.[uid] as Marks | undefined) ?? {};
  }, [day, uid]);

  const partnerMarks = useMemo<Marks>(() => {
    if (!partnerUid) return {};
    return (day?.marks?.[partnerUid] as Marks | undefined) ?? {};
  }, [day, partnerUid]);

  return {
    room,
    day,
    loading,
    error,
    setError,
    partnerUid,
    myMarks,
    partnerMarks,
    toggle,
    rename,
    leave,
  };
}
