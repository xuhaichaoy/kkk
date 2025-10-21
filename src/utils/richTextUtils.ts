const hasWindow = typeof window !== "undefined";

const stripScriptTags = (html: string): string =>
	html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

const removeDangerousAttributes = (html: string): string =>
	html.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");

const basicSanitize = (html: string): string => removeDangerousAttributes(stripScriptTags(html));

const containsHtmlTag = (input: string) => /<\/?[a-z][\s\S]*>/i.test(input);

const escapeHtml = (text: string): string =>
	text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

export const sanitizeRichText = (html: string): string => {
	if (!html) return "";
	const cleaned = basicSanitize(html);
	if (!hasWindow || typeof DOMParser === "undefined") {
		return cleaned;
	}

	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(cleaned, "text/html");
		doc.querySelectorAll("script, style").forEach((node) => node.remove());
		doc.body.querySelectorAll("*").forEach((element) => {
			Array.from(element.attributes).forEach((attr) => {
				if (/^on/i.test(attr.name)) {
					element.removeAttribute(attr.name);
				}
			});
			if (element.tagName.toLowerCase() === "img") {
				element.setAttribute(
					"style",
					"max-width:min(60%,320px);width:min(60%,320px);border-radius:8px;cursor:zoom-in;",
				);
			}
		});
		return doc.body.innerHTML;
	} catch (_error) {
		return cleaned;
	}
};

export const extractTextFromHtml = (html: string): string => {
	if (!html) return "";
	const cleaned = stripScriptTags(html);
	if (!hasWindow || typeof DOMParser === "undefined") {
		return cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(cleaned, "text/html");
	return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
};

export const ensureRichTextContent = (input: string): string => {
	if (!input) return "";
	const trimmed = input.trim();
	if (!containsHtmlTag(trimmed)) {
		const lines = trimmed.split(/\n/);
		const html = lines
			.map((line) => {
				if (!line) {
					return "<p><br/></p>";
				}
				return `<p>${escapeHtml(line)}</p>`;
			})
			.join("");
		return sanitizeRichText(html);
	}
	return sanitizeRichText(input);
};

export const normalizeRichTextValue = (html?: string | null): string | undefined => {
	if (!html) return undefined;
	const sanitized = ensureRichTextContent(html);
	const text = extractTextFromHtml(sanitized);
	const hasMedia = /<(img|video|audio)\b/i.test(sanitized);
	if (!text && !hasMedia) {
		return undefined;
	}
	return sanitized;
};
