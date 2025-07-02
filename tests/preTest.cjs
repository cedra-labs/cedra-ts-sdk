const { LocalNode } = require("../src/cli");

module.exports = async function setup() {
  // if preTest is falling just run cedra localnet itself
  // cedra node run-localnet --force-restart --assume-yes --with-indexer-api
  const node = new LocalNode({ debug: true });
  globalThis.__LOCAL_NODE__ = node;
  try {
  await node.run();
  console.log("Node started successfully");
} catch (error) {
  console.error("Failed to start node:", error);
}
};
