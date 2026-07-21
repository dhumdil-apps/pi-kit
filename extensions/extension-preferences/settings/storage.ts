/**
 * Read/write extension settings to JSON files.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const SETTINGS_FILE_NAME = "settings-extensions.json";

type SettingsFile = Record<string, Record<string, string>>;

/**
 * Get the global settings file path.
 */
function getGlobalSettingsPath(): string {
	return join(getAgentDir(), SETTINGS_FILE_NAME);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSettingsFileShape(value: unknown): value is SettingsFile {
	if (!isPlainObject(value)) return false;
	return Object.values(value).every(
		(ext) => isPlainObject(ext) && Object.values(ext).every((v) => typeof v === "string"),
	);
}

/**
 * Preserve an unreadable/malformed settings file instead of silently
 * discarding it, so a hand-edit or partial write doesn't destroy every
 * extension's stored preferences with no trace.
 */
function backUpUnreadableFile(path: string, content: string): void {
	try {
		writeFileSync(`${path}.bak-${Date.now()}`, content);
	} catch {
		// Best-effort backup only.
	}
}

/**
 * Load the settings file. Returns empty object if the file doesn't exist;
 * if it exists but is unreadable, unparseable, or the wrong shape, backs it
 * up (so no data is silently lost) and returns empty object.
 */
function loadSettingsFile(path: string): SettingsFile {
	if (!existsSync(path)) {
		return {};
	}
	let content: string;
	try {
		content = readFileSync(path, "utf-8");
	} catch (err) {
		console.error(`[extension-preferences] failed to read ${path}:`, err);
		return {};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch (err) {
		console.error(`[extension-preferences] ${path} is not valid JSON; backing it up and starting fresh:`, err);
		backUpUnreadableFile(path, content);
		return {};
	}
	if (!isSettingsFileShape(parsed)) {
		console.error(`[extension-preferences] ${path} has an unexpected shape; backing it up and starting fresh.`);
		backUpUnreadableFile(path, content);
		return {};
	}
	return parsed;
}

/**
 * Save settings to the global file, via a temp file + rename so a crash or
 * full disk mid-write can't leave a truncated/corrupt settings file behind.
 */
function saveSettingsFile(path: string, settings: SettingsFile): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	const tmpPath = `${path}.tmp-${process.pid}`;
	writeFileSync(tmpPath, JSON.stringify(settings, null, "\t"));
	renameSync(tmpPath, path);
}

/**
 * Get a setting value for an extension.
 * Returns the stored value, or the provided default, or undefined.
 *
 * @param extensionName - Extension name
 * @param settingId - Setting ID within the extension
 * @param defaultValue - Default value if setting is not found
 * @returns The setting value
 */
export function getSetting(extensionName: string, settingId: string, defaultValue?: string): string | undefined {
	const globalPath = getGlobalSettingsPath();
	const settings = loadSettingsFile(globalPath);

	// Check if value exists in file
	const extSettings = settings[extensionName];
	if (extSettings && settingId in extSettings) {
		return extSettings[settingId];
	}

	return defaultValue;
}

/**
 * Set a setting value for an extension.
 * Always writes to the global settings file.
 *
 * @param extensionName - Extension name
 * @param settingId - Setting ID within the extension
 * @param value - Value to set
 */
export function setSetting(extensionName: string, settingId: string, value: string): void {
	const globalPath = getGlobalSettingsPath();
	const settings = loadSettingsFile(globalPath);

	if (!settings[extensionName]) {
		settings[extensionName] = {};
	}
	settings[extensionName][settingId] = value;

	saveSettingsFile(globalPath, settings);
}
