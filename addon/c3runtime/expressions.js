const C3 = globalThis.C3;

C3.Plugins.Prototir_SDK.Exps =
{
	StoredValue(key)
	{
		return this._values.get(key) ?? "";
	},

	AIText(tag)
	{
		return this._aiTexts.get(tag) ?? "";
	},

	AIError(tag)
	{
		return this._aiErrors.get(tag) ?? "";
	}
};
