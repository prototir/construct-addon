const C3 = globalThis.C3;

C3.Plugins.Prototir_SDK.Acts =
{
	Ready()
	{
		this._postToDOM("ready");
	},

	SendEvent(name, data)
	{
		let payload = undefined;
		if (data)
		{
			// Optional JSON object. Anything else is left out rather than stopping the game.
			try
			{
				const parsed = JSON.parse(data);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
			}
			catch { payload = undefined; }
		}
		this._postToDOM("event", { "name": name, "data": payload });
	},

	ReportScore(value)
	{
		this._postToDOM("score", { "value": value });
	},

	SaveValue(key, value)
	{
		this._values.set(key, value);
		this._postToDOM("storage-set", { "key": key, "value": value });
	},

	LoadValue(key)
	{
		this._loadValue(key);
	},

	RemoveValue(key)
	{
		this._values.delete(key);
		this._postToDOM("storage-remove", { "key": key });
	},

	GenerateText(tag, prompt, maxTokens)
	{
		this._generateText(tag, prompt, maxTokens);
	},

	OpenComment()
	{
		this._postToDOM("comment");
	},

	TakeScreenshot()
	{
		this._postToDOM("screenshot");
	}
};
