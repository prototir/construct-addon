const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Prototir_SDK;

PLUGIN_CLASS.Instance = class PrototirInstance extends SDK.IInstanceBase
{
	constructor(sdkType, inst)
	{
		super(sdkType, inst);
	}

	Release()
	{
	}

	OnCreate()
	{
	}

	OnPropertyChanged(id, value)
	{
	}
};
