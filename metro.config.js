const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const { assetExts, sourceExts } = config.resolver;
config.transformer.babelTransformerPath = require.resolve("./metro.svg-transformer.js");
config.resolver.assetExts = assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...sourceExts, "svg"];

for (const ext of ["glb", "gltf"]) {
  if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
}

// three 0.186's "require" entry is a stub that require()s an ES module.
// Hermes then loads a namespace where LoaderUtils.extractUrlBase is missing,
// and @react-three/fiber calls it while the bundle is still starting:
// [runtime not ready]: TypeError: undefined is not a function.
const threeEsm = path.resolve(__dirname, "node_modules/three/build/three.module.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: threeEsm };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
