import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

export interface AppServerOptions {
  /** Checkout to run `server.node.ts` from. */
  dir: string;
  port: number;
  storefrontPort: number;
  /** Storefront credentials. Replays accept any non-empty token. */
  storefrontId?: string;
  storefrontToken?: string;
}

export interface AppServer {
  pid: number;
  origin: string;
  stop(): Promise<void>;
}

/**
 * Starts a checkout's production Node server the way the Dockerfile does,
 * pointed at a local Storefront server. The environment is built from scratch
 * so values from `.env` or the shell cannot leak into a run.
 */
export async function startAppServer({
  dir,
  port,
  storefrontPort,
  storefrontId = "1000000000",
  storefrontToken = "bench-token",
}: AppServerOptions): Promise<AppServer> {
  let child = spawn(
    process.execPath,
    ["--import", "remix/node-tsx", "server.node.ts"],
    {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "production",
        ASSET_BUILD_ID: "bench",
        PORT: String(port),
        PUBLIC_STORE_DOMAIN: `http://127.0.0.1:${storefrontPort}`,
        PUBLIC_STOREFRONT_ID: storefrontId,
        PRIVATE_STOREFRONT_API_TOKEN: storefrontToken,
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  let origin = `http://127.0.0.1:${port}`;
  try {
    await waitForHealth(origin, child);
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(`App server in ${dir} failed to start.\n${stderr}`, {
      cause: error,
    });
  }

  return {
    pid: child.pid ?? 0,
    origin,
    stop: () => stopChild(child),
  };
}

async function waitForHealth(origin: string, child: ChildProcess) {
  let deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Exited with code ${child.exitCode}.`);
    }
    try {
      let response = await fetch(`${origin}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for /health.");
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null) return;
  let exited = once(child, "exit");
  child.kill("SIGTERM");
  let timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
  await exited;
  clearTimeout(timeout);
}
