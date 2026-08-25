const fs = require("node:fs");
const path = require("node:path");
const { getFirebaseClientConfig, loadLocalEnvironment } = require("./env");

const rootDir = path.resolve(__dirname, "..");
const ruleFiles = ["firestore.rules", "storage.rules"];

loadLocalEnvironment(rootDir);

const { adminUid } = getFirebaseClientConfig();

if (!/^[A-Za-z0-9_-]{6,128}$/.test(adminUid)) {
  console.error("請先在 .env.local 設定有效的 FIREBASE_ADMIN_UID，再重新執行此指令。");
  process.exitCode = 1;
} else {
  ruleFiles.forEach((fileName) => {
    const filePath = path.join(rootDir, fileName);
    const source = fs.readFileSync(filePath, "utf8");
    const updated = source.replace(
      /request\.auth\.uid == "[^"]+"; \/\/ ADMIN_UID/g,
      `request.auth.uid == "${adminUid}"; // ADMIN_UID`,
    );

    if (updated === source && !source.includes(`request.auth.uid == "${adminUid}"; // ADMIN_UID`)) {
      throw new Error(`${fileName} 找不到 ADMIN_UID 標記，未修改檔案。`);
    }

    fs.writeFileSync(filePath, updated);
  });

  console.log(`已將管理員 UID 同步到 ${ruleFiles.join("、")}。`);
}
