const SDK = globalThis.SDK;

// The plugin ID is how Construct identifies the plugin in saved projects. NEVER CHANGE IT: a new ID
// makes Construct treat it as a different plugin, and every project using this one would break.
const PLUGIN_ID = "Prototir_SDK";

const PLUGIN_CLASS = SDK.Plugins.Prototir_SDK = class PrototirPlugin extends SDK.IPluginBase
{
	constructor()
	{
		super(PLUGIN_ID);

		SDK.Lang.PushContext("plugins." + PLUGIN_ID.toLowerCase());

		this._info.SetName(globalThis.lang(".name"));
		this._info.SetDescription(globalThis.lang(".description"));
		this._info.SetCategory("platform-specific");
		this._info.SetAuthor("Prototir");
		this._info.SetHelpUrl(globalThis.lang(".help-url"));
		// One Prototir per project, available everywhere without placing an object.
		this._info.SetIsSingleGlobal(true);
		this._info.SetRuntimeModuleMainScript("c3runtime/main.js");
		// The Prototir SDK needs the page (window, the player's frame), which the runtime cannot
		// reach in worker mode; domSide.js runs on the page and the runtime talks to it.
		this._info.SetDOMSideScripts(["c3runtime/domSide.js"]);

		SDK.Lang.PushContext(".properties");
		this._info.SetProperties([
			new SDK.PluginProperty("check", "feedback-tools", true)
		]);
		SDK.Lang.PopContext();

		SDK.Lang.PopContext();
	}
};

PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS);
