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

test("Firestore rules expose editable site content with admin-only writes", () => {
  assert.match(firestoreRules, /match \/siteContent\/\{locale\}/);
  assert.match(firestoreRules, /hasValidSiteContentShape\(locale, request\.resource\.data\)/);
  assert.match(firestoreRules, /hasValidAboutParagraphs\(data\.aboutParagraphs\)/);
  assert.match(firestoreRules, /paragraphs\.size\(\) < 1 \|\|/);
  assert.match(firestoreRules, /paragraphs\[9\] is string/);
  assert.doesNotMatch(firestoreRules, /data\.heroKicker\.size\(\) > 0/);
  assert.doesNotMatch(firestoreRules, /data\.contactEmail\.size\(\) > 3/);
  assert.match(firestoreRules, /allow create, update: if isAdmin\(\)/);
});

test("Firestore rules expose only published projects to the public", () => {
  assert.match(firestoreRules, /match \/projects\/\{projectId\}/);
  assert.match(firestoreRules, /resource\.data\.published == true/);
  assert.match(firestoreRules, /projectId == data\.locale \+ "--" \+ data\.slug/);
  assert.match(firestoreRules, /hasValidProjectShape\(projectId, request\.resource\.data\)/);
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
