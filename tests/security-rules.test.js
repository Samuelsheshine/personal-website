const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const firestoreRules = fs.readFileSync(path.join(rootDir, "firestore.rules"), "utf8");
const storageRules = fs.readFileSync(path.join(rootDir, "storage.rules"), "utf8");

test("rules never grant unconditional public access", () => {
  assert.doesNotMatch(firestoreRules, /allow\s+(read|write|read,\s*write)[^;]*:\s*if\s+true\s*;/);
  assert.doesNotMatch(storageRules, /allow\s+(read|write|read,\s*write)[^;]*:\s*if\s+true\s*;/);
});

test("Firestore rules gate public post reads by published status", () => {
  assert.match(firestoreRules, /resource\.data\.status == "published"/);
  assert.match(firestoreRules, /match \/posts\/\{postId\}/);
  assert.match(firestoreRules, /slugPointsToPost/);
});

test("Storage rules require admin writes and enforce image limits", () => {
  assert.match(storageRules, /allow create, update: if isAdmin\(\) && isValidImageUpload\(\)/);
  assert.match(storageRules, /request\.resource\.size <= 5 \* 1024 \* 1024/);
  assert.match(storageRules, /request\.resource\.contentType\.matches\("image\/\.\*"\)/);
  assert.match(storageRules, /firestore\.get\([^\n;]+posts\/\$\(postId\)\)/);
});

test("both rulesets expose the same configurable admin marker", () => {
  const uidPattern = /request\.auth\.uid == "([^"]+)"; \/\/ ADMIN_UID/;
  assert.equal(firestoreRules.match(uidPattern)?.[1], storageRules.match(uidPattern)?.[1]);
});
