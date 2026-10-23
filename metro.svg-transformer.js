// SVG files become React components (react-native-svg) through SVGR, and every
// other file goes through Expo's own Babel transformer.
//
// Why not require("react-native-svg-transformer") directly: its index.js picks
// the upstream transformer as soon as it loads. On SDK 58 npm keeps
// @expo/metro-config nested under expo/node_modules, and expo's package.json
// "exports" now blocks the deep path the library falls back to, so it tries the
// bare React Native transformer, which Expo projects don't install, and Metro
// fails with "Cannot find module 'metro-react-native-babel-transformer'".
// We resolve Expo's transformer from expo's own folder instead and reuse the
// library's SVGR settings.
const path = require("path");

const expoDir = path.dirname(require.resolve("expo/package.json"));
const upstream = require(
  require.resolve("@expo/metro-config/babel-transformer", { paths: [expoDir] }),
);

const libDir = path.dirname(require.resolve("react-native-svg-transformer/package.json"));
const fromLib = (name) => require(require.resolve(name, { paths: [libDir] }));
const { resolveConfig, transform: svgr } = fromLib("@svgr/core");
const resolveConfigDir = fromLib("path-dirname");

// Same defaults as react-native-svg-transformer 1.5.x.
const defaultSVGRConfig = {
  native: true,
  plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
  svgoConfig: {
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            inlineStyles: { onlyMatchedOnce: false },
            removeViewBox: false,
            removeUnknownsAndDefaults: false,
            convertColors: false,
          },
        },
      },
    ],
  },
};

module.exports.transform = async ({ src, filename, ...rest }) => {
  if (filename.endsWith(".svg")) {
    const config = await resolveConfig(resolveConfigDir(filename));
    const svgrConfig = config ? { ...defaultSVGRConfig, ...config } : defaultSVGRConfig;
    src = await svgr(src, svgrConfig, { filePath: filename });
  }
  return upstream.transform({ src, filename, ...rest });
};
