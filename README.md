# Prototir for Construct 3

The official [Construct 3](https://www.construct.net) plugin for
[Prototir](https://prototir.com), where creators publish playable prototypes and testers play them
and leave feedback. Add it to a project and testers get **Feedback & tools** (Screenshot, Comment,
Console and Performance) with no events at all; add a few actions to report Ready, events and
scores, store values per player, or ask Prototir's managed AI for text.

## Install

1. Download `prototir.c3addon` from the
   [latest release](https://github.com/prototir/construct-addon/releases/latest).
2. In Construct: **Menu > View > Addon manager > Install new addon**, and pick the file.
3. In your project: **Insert new object > Platform specific > Prototir**.

Requires Construct r401 or newer. Works in worker mode (the default).

## Use

| Action | What it does |
| --- | --- |
| **Ready** | Call once the game is genuinely interactive (for example in *On start of layout* of the first playable layout), not while a loader shows. Starts the measured play session. |
| **Send event** | An analytics event, e.g. `level_complete`, with optional small JSON data such as `{"level": 2}`. Names use 1-64 lowercase letters, numbers, `_ . : -`. |
| **Report score** | The player's score. |
| **Save value** / **Load value** / **Remove value** | Per-player storage on Prototir (strings up to 64 KiB). *Load value* fires **On value loaded**; read it with `Prototir.StoredValue("key")`. |
| **Generate text** | Prototir's managed AI (turn AI on for the prototype first). Fires **On AI response** with `Prototir.AIText("tag")`, or **On AI error** with `Prototir.AIError("tag")`. |
| **Open comment** / **Take screenshot** | Open feedback from your own button or a pause menu. |

| Condition | |
| --- | --- |
| **Is on Prototir** | True inside the Prototir player. |
| **On feedback opened** / **On feedback closed**, **Is feedback open** | Pause and resume while a tester writes. |

The plugin's **Testing tools** property turns the Console and Performance tools on or off;
Screenshot and Comment follow the prototype's comment settings on Prototir.

## Feedback & tools

On Prototir the player draws the **Feedback & tools** control: Screenshot (taken from Construct's
renderer, so it works in worker mode), Comment, Console and Performance. A screenshot, log or
summary is always sent with a message.

The Console records what the page logs. In worker mode, `console.log` calls made from scripts
running in the worker are not on the page, so they do not appear; set **Project > Use worker** to
*No* if you rely on them.

## Publish

1. **Menu > Project > Export > Web (HTML5)**, with minification as you like.
2. ZIP the contents of the exported folder (not the folder itself).
3. Upload the ZIP on [prototir.com](https://prototir.com/dashboard/upload).

On Prototir the plugin loads the current Prototir SDK, so testers get new tools without you
exporting again. In Construct's preview, or an export hosted elsewhere, it uses the SDK copy built
into the addon.

## Develop

Requires Node.js 20 or newer.

```bash
npm install
npm test        # builds dist/prototir.c3addon and runs it in a browser between stand-ins
                # for Construct's runtime and the Prototir player
```

`addon/` is the source; `tools/build.mjs` checks it against Scirra's schemas (`tools/*.schema.json`,
from [Construct-Addon-SDK](https://github.com/Scirra/Construct-Addon-SDK)), checks every action,
condition and expression has its code and text, puts `vendor/prototir.js` (the Prototir Web SDK,
synced from the web-sdk repository with `npm run sync:review` there) into
`c3runtime/domSide.js`, and writes `dist/prototir.c3addon` plus an unpacked `dist/addon/` for
Construct's developer mode.

**Never change the plugin id `Prototir_SDK`**: Construct would treat it as a different plugin and
every project using it would break.

## License

[MIT](LICENSE.md)
