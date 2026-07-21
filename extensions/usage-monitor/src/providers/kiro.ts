/**
 * AWS Kiro usage provider
 */

import { fetchFailed, noCli, notLoggedIn } from "../errors.js";
import { BaseProvider } from "../provider.js";
import type { Dependencies, FetchResult, RateWindow } from "../types.js";
import { API_TIMEOUT_MS, CLI_TIMEOUT_MS, formatReset, stripAnsi, whichSync } from "../utils.js";

export class KiroProvider extends BaseProvider {
	readonly name = "kiro" as const;
	readonly displayName = "Kiro Plan";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(whichSync("kiro-cli", deps));
	}

	async fetchUsage(deps: Dependencies): Promise<FetchResult> {
		const kiroBinary = whichSync("kiro-cli", deps);
		if (!kiroBinary) {
			return this.result(this.emptySnapshot(noCli("kiro-cli")));
		}

		try {
			// Check if logged in
			try {
				deps.execFileSync(kiroBinary, ["whoami"], {
					encoding: "utf-8",
					timeout: API_TIMEOUT_MS,
					stdio: ["ignore", "pipe", "pipe"],
				});
			} catch (err) {
				// A timeout/kill (slow network, hung CLI) is not the same as an
				// actual "not authenticated" exit — don't tell the user to
				// re-login over a transient failure.
				const nodeErr = err as NodeJS.ErrnoException & { signal?: string | null };
				if (nodeErr?.code === "ETIMEDOUT" || nodeErr?.signal) {
					return this.result(this.emptySnapshot(fetchFailed()));
				}
				return this.result(this.emptySnapshot(notLoggedIn()));
			}

			// Get usage
			const output = deps.execFileSync(kiroBinary, ["chat", "--no-interactive", "/usage"], {
				encoding: "utf-8",
				timeout: CLI_TIMEOUT_MS,
				env: { ...deps.env, TERM: "xterm-256color" },
				stdio: ["ignore", "pipe", "pipe"],
			});

			const stripped = stripAnsi(output);
			const windows: RateWindow[] = [];

			// Parse credits percentage from "████...█ X%"
			let creditsPercent: number | undefined;
			const percentMatch = stripped.match(/█+\s*(\d+)%/);
			if (percentMatch) {
				creditsPercent = parseInt(percentMatch[1], 10);
			}

			// Parse credits used/total from "(X.XX of Y covered in plan)"
			const creditsMatch = stripped.match(/\((\d+\.?\d*)\s+of\s+(\d+)\s+covered/);
			if (creditsMatch && creditsPercent === undefined) {
				const creditsUsed = parseFloat(creditsMatch[1]);
				const creditsTotal = parseFloat(creditsMatch[2]);
				if (creditsTotal > 0) {
					creditsPercent = (creditsUsed / creditsTotal) * 100;
				}
			}

			// Neither pattern matched (e.g. a kiro-cli output format change) —
			// report failure instead of a misleading "0% used" (full quota).
			if (creditsPercent === undefined) {
				return this.result(this.emptySnapshot(fetchFailed()));
			}

			// Parse reset date from "resets on 01/01"
			let resetsAt: Date | undefined;
			const resetMatch = stripped.match(/resets on (\d{2}\/\d{2})/);
			if (resetMatch) {
				const [month, day] = resetMatch[1].split("/").map(Number);
				const now = new Date();
				const year = now.getFullYear();
				resetsAt = new Date(year, month - 1, day);
				if (resetsAt < now) resetsAt.setFullYear(year + 1);
			}

			windows.push({
				label: "Credits",
				usedPercent: creditsPercent,
				resetDescription: resetsAt ? formatReset(resetsAt) : undefined,
				resetAt: resetsAt?.toISOString(),
			});

			return this.result(this.snapshot({ windows }));
		} catch {
			return this.result(this.emptySnapshot(fetchFailed()));
		}
	}

	// Kiro doesn't have a public status page
}
