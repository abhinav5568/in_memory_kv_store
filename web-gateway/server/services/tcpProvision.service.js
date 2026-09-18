const net = require("net");

const HOST = process.env.TCP_ENGINE_HOST || "127.0.0.1";
const PORT = Number(process.env.TCP_ENGINE_PORT) || 6379;

/*
 * NOTE ON PROTOCOL ASSUMPTION:
 * Your KVClient interface shows response framing like:
 *   "SUCCESS: User authorized."   (AUTH success)
 *   "ERR: Invalid user id"        (AUTH failure)
 *   "CACHE_ID|<id>"               (CREATE success)
 *   "VALUE|<value>"               (GET success)
 *
 * INIT wasn't shown in the client you shared, so this assumes the engine
 * replies to `INIT\n` with a line matching one of:
 *   "UUID|<uuid>"
 *   "USER_ID|<uuid>"
 *   "SUCCESS|<uuid>"
 * and errors as "ERR: <reason>", consistent with the rest of the protocol.
 * Adjust SUCCESS_PREFIXES below if your server's actual INIT reply differs.
 */
const SUCCESS_PREFIXES = ["UUID|", "USER_ID|", "SUCCESS|"];

/**
 * Opens a short-lived TCP connection to the engine, sends INIT, and
 * resolves with the freshly issued uuid. Connection is closed immediately
 * after — this is provisioning only, not a persistent client.
 *
 * @returns {Promise<string>} the new uuid
 */
function provisionNewUuid() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    let buffer = "";
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      socket.end();
      socket.destroy();
      fn(arg);
    };

    const timeout = setTimeout(() => {
      finish(reject, new Error("TCP engine did not respond to INIT in time."));
    }, 5000);

    socket.on("connect", () => {
      socket.write("INIT\n");
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) return;

      const frame = buffer.substring(0, newlineIndex).trim();
      clearTimeout(timeout);

      if (frame.startsWith("ERR")) {
        finish(reject, new Error(`Engine rejected INIT: ${frame}`));
        return;
      }

      const matchedPrefix = SUCCESS_PREFIXES.find((p) => frame.startsWith(p));
      if (matchedPrefix) {
        const uuid = frame.substring(matchedPrefix.length).trim();
        socket.write(`AUTH|${uuid}\n`);
        finish(resolve, uuid);
        return;
      }

      finish(
        reject,
        new Error(`Unrecognized INIT response from engine: "${frame}"`)
      );
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      finish(reject, err);
    });
  });
}

module.exports = { provisionNewUuid };
