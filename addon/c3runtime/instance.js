const C3 = globalThis.C3;

// Must match domSide.js.
const DOM_COMPONENT_ID = "Prototir_SDK";

function blobToDataUrl(blob)
{
	return new Promise((resolve, reject) =>
	{
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

/**
 * The game side of the Prototir plugin. It can run in a Web Worker, where the page and the Prototir
 * player are out of reach, so everything goes through domSide.js by message; this side keeps the
 * results (loaded values, AI replies) for the event sheet's expressions and fires the triggers.
 */
C3.Plugins.Prototir_SDK.Instance = class PrototirInstance extends globalThis.ISDKInstanceBase
{
	constructor()
	{
		super({ domComponentId: DOM_COMPONENT_ID });

		const properties = this._getInitProperties();
		this._testingTools = properties ? Boolean(properties[0]) : true;

		this._onPrototir = false;
		this._feedbackOpen = false;
		this._values = new Map();
		this._aiTexts = new Map();
		this._aiErrors = new Map();
		this._lastKey = "";
		this._lastTag = "";

		// Screenshots come from Construct's renderer: in worker mode the page's <canvas> has been
		// handed to the worker and cannot be read by the SDK's own capture.
		this._addDOMMessageHandler("capture", () => this._capture());
		this._addDOMMessageHandler("feedback-visibility", (e) => this._onFeedbackVisibility(Boolean(e["open"])));

		// The game starts once the SDK is loaded, so a Ready or an event in "On start of layout"
		// is never lost.
		this.runtime.sdk.addLoadPromise(
			this._postToDOMAsync("init", { "testingTools": this._testingTools })
				.then((state) => { this._onPrototir = Boolean(state && state["onPrototir"]); })
				.catch(() => { this._onPrototir = false; })
		);
	}

	async _capture()
	{
		if (typeof this.runtime.saveCanvasImage !== "function") return null;
		const blob = await this.runtime.saveCanvasImage("image/jpeg", 0.9);
		return blob ? await blobToDataUrl(blob) : null;
	}

	_onFeedbackVisibility(open)
	{
		this._feedbackOpen = open;
		this._trigger(open ? C3.Plugins.Prototir_SDK.Cnds.OnFeedbackOpened : C3.Plugins.Prototir_SDK.Cnds.OnFeedbackClosed);
	}

	async _loadValue(key)
	{
		let value = null;
		try { value = await this._postToDOMAsync("storage-get", { "key": key }); }
		catch { value = null; }
		this._values.set(key, value ?? "");
		this._lastKey = key;
		this._trigger(C3.Plugins.Prototir_SDK.Cnds.OnValueLoaded);
	}

	async _generateText(tag, prompt, maxTokens)
	{
		const reply = await this._postToDOMAsync("ai-generate", { "prompt": prompt, "maxTokens": maxTokens });
		this._lastTag = tag;
		if (reply && reply["ok"])
		{
			this._aiTexts.set(tag, reply["text"] ?? "");
			this._aiErrors.delete(tag);
			this._trigger(C3.Plugins.Prototir_SDK.Cnds.OnAIResponse);
		}
		else
		{
			this._aiErrors.set(tag, (reply && reply["message"]) || "The request failed.");
			this._trigger(C3.Plugins.Prototir_SDK.Cnds.OnAIError);
		}
	}

	_saveToJson()
	{
		return { "values": [...this._values] };
	}

	_loadFromJson(o)
	{
		this._values = new Map(o && o["values"] ? o["values"] : []);
	}
};
