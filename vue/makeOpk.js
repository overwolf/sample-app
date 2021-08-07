require("semver");
const path = require("path"),
  fs = require("fs"),
  zip = require("zip-a-folder");

function readFile(filePath) {
  return new Promise(resolve => {
    fs.readFile(filePath, (err, response) => {
      try {
        if (err) resolve(null);
        else resolve(JSON.parse(response));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function deleteFile(filePath) { return new Promise(resolve => {
  fs.unlink(filePath, resolve);
})}

async function makeOPK(suffix = "") {
  const packagePath = path.resolve(__dirname, "./package.json"),
    manifestPath = path.resolve(__dirname, "./public/manifest.json"),
    dist = path.join(__dirname, "dist/");

  const [pkg, manifest] = await Promise.all([
    readFile(packagePath),
    readFile(manifestPath)
  ]);

  if (!pkg) throw "could not read package.json";

  if (!manifest) throw "could not read manifest.json";

  const version = pkg.version,
    name = manifest.meta.name,
    opkPath = path.join(
      __dirname,
      `releases/${name}-${version}${suffix ? `.${suffix}` : ""}.opk`
    );

  await deleteFile(opkPath);
  await zip.zip(dist, opkPath);
}

makeOPK();
