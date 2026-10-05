const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Prototir_SDK;

PLUGIN_CLASS.Type = class PrototirType extends SDK.ITypeBase
{
	constructor(sdkPlugin, iObjectType)
	{
		super(sdkPlugin, iObjectType);
	}
};
