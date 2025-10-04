export const debugLog = (...values: unknown[]) => {
	if (import.meta.env?.DEV) {
		console.log(...values);
	}
};

export const debugError = (...values: unknown[]) => {
	if (import.meta.env?.DEV) {
		console.error(...values);
	}
};
