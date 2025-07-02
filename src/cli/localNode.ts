/* eslint-disable no-console */
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import kill from "tree-kill";
import { homedir, platform } from "os";
import { sleep } from "../utils/helpers";
import { existsSync } from "fs";
import { join } from "path";

export class LocalNode {
  readonly MAXIMUM_WAIT_TIME_SEC = 180; // Increased timeout
  readonly READINESS_ENDPOINT = "http://127.0.0.1:8070/";
  readonly STARTUP_CHECK_INTERVAL_MS = 2000;

  showStdout: boolean = true;
  process: ChildProcessWithoutNullStreams | null = null;
  private debugMode: boolean;

  constructor(args?: { showStdout?: boolean; debug?: boolean }) {
    this.showStdout = args?.showStdout ?? true;
    this.debugMode = args?.debug ?? false;
  }

  async stop(): Promise<void> {
    if (!this.process?.pid) return;

    try {
      await new Promise<void>((resolve, reject) => {
        kill(this.process!.pid!, (err) => {
          if (err) {
            this.debugLog(`Failed to kill process: ${err.message}`);
            reject(err);
          } else {
            this.debugLog(`Successfully stopped process ${this.process!.pid}`);
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to stop node: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.process = null;
    }
  }

  async run(): Promise<void> {
    if (await this.checkIfProcessIsUp()) {
      this.debugLog("Node is already running");
      return;
    }

    try {
      this.start();
      await this.waitUntilProcessIsUp();
    } catch (error) {
      await this.stop().catch(() => {});
      throw error;
    }
  }

  start(): void {
    const cliCommand = "npx";
    const cliArgs = [
      "cedra",
      "node",
      "run-localnet",
      "--force-restart",
      "--assume-yes",
      "--with-indexer-api",
      "--processors",
      "fungible_asset_processor",
      "--processors",
      "token_v2_processor",
    ];
    if (existsSync(join(homedir(), ".cedra/config"))) {
      cliArgs.push("--config", join(homedir(), ".cedra/config/node.yaml"));
    }
    const spawnConfig = {
      env: {
        ...process.env,
        ENABLE_KEYLESS_DEFAULT: "1",
        RUST_LOG: this.debugMode ? "debug" : "info",
      },
      shell: platform() === "win32",
    };

    this.debugLog(`Starting node: ${cliCommand} ${cliArgs.join(" ")}`);

    this.process = spawn(cliCommand, cliArgs, {
      env: {
        ...process.env,
        RUST_BACKTRACE: "full",
        RUST_LOG: "debug",
      },
    });

    this.process.stdout?.on("data", (data) => {
      const output = data.toString();
      if (this.showStdout) {
        console.log(output);
      }
      this.debugLog(output);
    });

    this.process.stderr?.on("data", (data) => {
      const error = data.toString();
      console.error(error);
      this.debugLog(`STDERR: ${error}`);
    });

    this.process.on("error", (err) => {
      console.error("Process error:", err);
      this.debugLog(`Process error: ${err.message}`);
    });

    this.process.on("exit", (code, signal) => {
      const message = `Process exited with code ${code}, signal ${signal}`;
      if (code !== 0) {
        console.error(message);
      }
      this.debugLog(message);
    });
  }

  private async waitUntilProcessIsUp(): Promise<void> {
    const startTime = Date.now();
    const timeout = this.MAXIMUM_WAIT_TIME_SEC * 1000;
    let lastStatus = false;

    while (Date.now() - startTime < timeout) {
      try {
        lastStatus = await this.checkIfProcessIsUp();
        this.debugLog(`Readiness check: ${lastStatus}`);

        if (lastStatus) {
          this.debugLog("Node is ready");
          return;
        }

        await sleep(this.STARTUP_CHECK_INTERVAL_MS);
      } catch (error) {
        this.debugLog(`Readiness check error: ${error instanceof Error ? error.message : String(error)}`);
        await sleep(this.STARTUP_CHECK_INTERVAL_MS);
      }
    }

    throw new Error(`Node failed to start within ${this.MAXIMUM_WAIT_TIME_SEC} seconds. Last status: ${lastStatus}`);
  }

  private async checkIfProcessIsUp(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(this.READINESS_ENDPOINT, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.debugLog(`Readiness check failed with status: ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      this.debugLog(`Readiness check error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private debugLog(message: string): void {
    if (this.debugMode) {
      console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`);
    }
  }
}
