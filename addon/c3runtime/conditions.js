const C3 = globalThis.C3;

C3.Plugins.Prototir_SDK.Cnds =
{
	IsOnPrototir()
	{
		return this._onPrototir;
	},

	IsFeedbackOpen()
	{
		return this._feedbackOpen;
	},

	OnValueLoaded(key)
	{
		return key === this._lastKey;
	},

	OnAIResponse(tag)
	{
		return tag === this._lastTag;
	},

	OnAIError(tag)
	{
		return tag === this._lastTag;
	},

	OnFeedbackOpened()
	{
		return true;
	},

	OnFeedbackClosed()
	{
		return true;
	}
};
