import "server-only";

import {
  blockIds, blockStatus, describeBlocks, discardDraft, editorValues, emptyBlockState, isBlockId,
  normalizeState, publishDraft, publishedValues, resolveValues, restoreRevision, saveDraft, SiteContentError,
  type BlockId, type BlockState, type BlockStatus, type ContentValues, type Revision,
} from "../site-content";
import { storeDb } from "./firebase-admin";
import { HttpError } from "./http";

const collection = () => storeDb().collection("siteContent");
const blockRef = (id: BlockId) => collection().doc(id);
const revisionsRef = (id: BlockId) => blockRef(id).collection("revisions");
const revisionIdPattern = /^v[0-9]{1,9}$/;

export interface BlockSummary {
  id: BlockId;
  status: BlockStatus;
  version: number;
  values: ContentValues;
  published: ContentValues;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
}

export interface BlockDetail extends BlockSummary {
  revisions: { id: string; version: number; publishedAt: string; publishedBy: string; values: ContentValues }[];
}

export function requireBlockId(value: string): BlockId {
  if (!isBlockId(value)) throw new HttpError(404, "Content section not found");
  return value;
}

function asHttpError(error: unknown): unknown {
  if (!(error instanceof SiteContentError)) return error;
  const status = { invalid: 400, conflict: 409, not_found: 404, nothing_to_publish: 409 }[error.kind];
  return new HttpError(status, error.message);
}

function summarize(id: BlockId, state: BlockState): BlockSummary {
  return {
    id, status: blockStatus(id, state), version: state.version,
    values: editorValues(id, state), published: publishedValues(id, state),
    draftUpdatedAt: state.draftUpdatedAt, publishedAt: state.publishedAt,
  };
}

async function readState(id: BlockId): Promise<BlockState> {
  const snap = await blockRef(id).get();
  return snap.exists ? normalizeState(snap.data()) : { ...emptyBlockState };
}

export async function listAdminBlocks() {
  const snaps = await storeDb().getAll(...blockIds.map(blockRef));
  const states = new Map(snaps.map((snap, index) => [blockIds[index], snap.exists ? normalizeState(snap.data()) : { ...emptyBlockState }]));
  return describeBlocks().map((spec) => ({ ...spec, ...summarize(spec.id, states.get(spec.id)!) }));
}

export async function getBlockDetail(id: BlockId): Promise<BlockDetail> {
  const [state, revisions] = await Promise.all([
    readState(id),
    revisionsRef(id).orderBy("publishedAt", "desc").limit(20).get(),
  ]);
  return {
    ...summarize(id, state),
    revisions: revisions.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, version: Number(data.version), publishedAt: String(data.publishedAt),
        publishedBy: String(data.publishedBy), values: resolveValues(id, data.values) };
    }),
  };
}

async function mutate(id: BlockId, change: (state: BlockState, tx: FirebaseFirestore.Transaction) => BlockState): Promise<BlockDetail> {
  try {
    await storeDb().runTransaction(async (tx) => {
      const snap = await tx.get(blockRef(id));
      const state = snap.exists ? normalizeState(snap.data()) : { ...emptyBlockState };
      tx.set(blockRef(id), { ...change(state, tx), id });
    });
  } catch (error) {
    throw asHttpError(error);
  }
  return getBlockDetail(id);
}

export function saveBlockDraft(id: BlockId, values: unknown, expectedVersion: unknown, actorUid: string) {
  return mutate(id, (state) => saveDraft(id, state, values, expectedVersion, actorUid, new Date().toISOString()));
}

export function discardBlockDraft(id: BlockId, expectedVersion: unknown) {
  return mutate(id, (state) => discardDraft(state, expectedVersion));
}

export function publishBlock(id: BlockId, expectedVersion: unknown, actorUid: string) {
  return mutate(id, (state, tx) => {
    const result = publishDraft(id, state, expectedVersion, actorUid, new Date().toISOString());
    tx.create(revisionsRef(id).doc(`v${result.revision.version}`), result.revision);
    return result.state;
  });
}

export async function restoreBlockRevision(id: BlockId, revisionId: string, expectedVersion: unknown, actorUid: string) {
  if (!revisionIdPattern.test(revisionId)) throw new HttpError(404, "That version no longer exists");
  try {
    await storeDb().runTransaction(async (tx) => {
      const [snap, revisionSnap] = await Promise.all([tx.get(blockRef(id)), tx.get(revisionsRef(id).doc(revisionId))]);
      const state = snap.exists ? normalizeState(snap.data()) : { ...emptyBlockState };
      const revision = revisionSnap.exists ? revisionSnap.data() as Revision : null;
      tx.set(blockRef(id), { ...restoreRevision(id, state, revision, expectedVersion, actorUid, new Date().toISOString()), id });
    });
  } catch (error) {
    throw asHttpError(error);
  }
  return getBlockDetail(id);
}

/** The live copy of a block for the storefront. Never throws on bad stored data. */
export async function getPublishedBlock(id: BlockId): Promise<ContentValues> {
  return publishedValues(id, await readState(id));
}
