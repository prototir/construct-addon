"use strict";

{
	// Must match instance.js.
	const DOM_COMPONENT_ID = "Prototir_SDK";

	// The Prototir Web SDK this addon was built with, used only when the page has no other copy:
	// in Construct's preview, or in an export hosted somewhere other than Prototir. Filled in by
	// tools/build.mjs.
	function loadBuiltInSdk()
	{
		/*__PROTOTIR_WEB_SDK__*/
	}

	function loadScript(src)
	{
		return new Promise((resolve) =>
		{
			const script = document.createElement("script");
			script.src = src;
			// A missing file, or a site that answers with an HTML page, both leave no SDK behind.
			script.onload = () => resolve(Boolean(globalThis.Prototir));
			script.onerror = () => resolve(false);
			document.head.append(script);
		});
	}

	/** The prototype's slug, which the Prototir player puts in the game frame's address. */
	function hostSlug()
	{
		const read = (text) => new URLSearchParams(text).get("prototir_slug") ?? "";
		return read(location.search) || read(location.hash.replace(/^#/, ""));
	}

	function onPrototir()
	{
		return /[?&#]prototir_origin=/.test(location.search + location.hash);
	}

	const HANDLER_CLASS = class PrototirDOMHandler extends globalThis.DOMHandler
	{
		constructor(iRuntime)
		{
			super(iRuntime, DOM_COMPONENT_ID);

			this.AddRuntimeMessageHandlers([
				["init", (e) => this._init(e)],
				["ready", () => this._sdk()?.ready()],
				["event", (e) => this._sdk()?.event(e["name"], e["data"])],
				["score", (e) => this._sdk()?.score(e["value"])],
				["storage-set", (e) => this._sdk()?.storage.set(e["key"], e["value"]).catch(() => {})],
				["storage-get", (e) => this._storageGet(e["key"])],
				["storage-remove", (e) => this._sdk()?.storage.remove(e["key"]).catch(() => {})],
				["ai-generate", (e) => this._generate(e["prompt"], e["maxTokens"])],
				["comment", () => this._sdk()?.review.comment()],
				["screenshot", () => this._sdk()?.review.capture()]
			]);
		}

		_sdk()
		{
			return globalThis.Prototir;
		}

		async _init(e)
		{
			// On Prototir, /prototir.js is the current SDK, so testers get new tools without the game
			// being exported again. Anywhere else (Construct's preview, another host) it is absent, so
			// it is only asked for inside the Prototir player: elsewhere the request would just fail
			// and print errors in the creator's console. The built-in copy covers the rest.
			if (!globalThis.Prototir && !(onPrototir() && (await loadScript("/prototir.js")))) loadBuiltInSdk();
			const sdk = this._sdk();
			const slug = hostSlug();
			if (sdk && slug)
			{
				try
				{
					sdk.review.enable({
						project: slug,
						// Construct's renderer takes the frame (see instance.js).
						capture: async () =>
						{
							const image = await this.PostToRuntimeAsync("capture");
							if (!image) throw new Error("No frame to capture.");
							return image;
						},
						onOpenChange: (open) => this.PostToRuntime("feedback-visibility", { "open": open }),
						tools: e["testingTools"] ? undefined : { console: false, performance: false }
					});
				}
				catch
				{
					// Never let feedback get in the way of the game starting.
				}
			}
			return { "onPrototir": onPrototir() };
		}

		async _storageGet(key)
		{
			try { return await this._sdk()?.storage.get(key) ?? null; }
			catch { return null; }
		}

		async _generate(prompt, maxTokens)
		{
			try
			{
				const text = await this._sdk().ai.generate(maxTokens > 0 ? { prompt, maxTokens } : { prompt });
				return { "ok": true, "text": text };
			}
			catch (error)
			{
				return { "ok": false, "message": (error && error.message) || "The request failed." };
			}
		}
	};

	globalThis.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
