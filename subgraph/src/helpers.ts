import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Collection, Token, User } from "../generated/schema";

export const ZERO = BigInt.fromI32(0);
export const ZERO_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

/// Composite token id: "<collection>-<tokenId>" (collection lowercased).
export function tokenKey(collection: Address, tokenId: BigInt): string {
  return collection.toHexString() + "-" + tokenId.toString();
}

/// Event-scoped unique id: "<txHash>-<logIndex>".
export function eventId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
}

/// Load or create a User by address.
export function getOrCreateUser(address: Address): User {
  let id = address.toHexString();
  let user = User.load(id);
  if (user == null) {
    user = new User(id);
    user.address = address as Bytes;
    user.totalWithdrawn = ZERO;
    user.save();
  }
  return user;
}

/// Load or create a Collection by address.
export function getOrCreateCollection(address: Address): Collection {
  let id = address.toHexString();
  let collection = Collection.load(id);
  if (collection == null) {
    collection = new Collection(id);
    collection.address = address as Bytes;
    collection.save();
  }
  return collection;
}

/// Load or create a Token. Created lazily — Minted and Transfer may arrive in
/// either order, so both call this and fill the fields they own.
export function getOrCreateToken(
  collection: Address,
  tokenId: BigInt,
  timestamp: BigInt
): Token {
  let id = tokenKey(collection, tokenId);
  let token = Token.load(id);
  if (token == null) {
    token = new Token(id);
    token.collection = getOrCreateCollection(collection).id;
    token.tokenId = tokenId;
    token.createdAt = timestamp;
    token.save();
  }
  return token;
}
