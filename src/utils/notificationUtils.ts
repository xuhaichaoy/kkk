import type { Options as NotificationOptions } from "@tauri-apps/plugin-notification";
import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import { debugError, debugLog } from "./logger";

export const ensureNotificationPermission = async (): Promise<boolean> => {
	try {
		const granted = await isPermissionGranted();
		debugLog("Notification permission granted:", granted);
		if (granted) {
			return true;
		}

		const permission = await requestPermission();
		debugLog("Notification permission requested:", permission);
		return permission === "granted";
	} catch (error) {
		debugError("Failed to determine notification permission", error);
		return false;
	}
};

export const sendNativeNotification = async (
	options: NotificationOptions,
): Promise<void> => {
	try {
		await sendNotification(options);
		debugLog("Notification dispatched:", options.title);
	} catch (error) {
		debugError("Failed to dispatch notification", error);
		throw error;
	}
};
