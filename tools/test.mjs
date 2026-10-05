// Runs the built addon (dist/addon) in a browser, between a stand-in for Construct's runtime and a
// stand-in for the Prototir player, and checks every action reaches Prototir and every trigger fires.
//
//   node tools/build.mjs && node tools/test.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

/** `servePrototir`: whether /prototir.js exists, as on Prototir. Marked so the test can tell the copies apart. */
function server(servePrototir) {
	return createServer((req, res) => {
		const path = new URL(req.url, 'http://x').pathname;
		if (path === '/prototir.js') {
			if (!servePrototir) {
				res.writeHead(404).end();
				return;
			}
			res.writeHead(200, { 'content-type': 'text/javascript' });
			res.end(readFileSync(join(root, 'vendor', 'prototir.js'), 'utf8') + '\nwindow.__servedSdk = window.Prototir;');
			return;
		}
		const file = path.startsWith('/addon/') ? join(root, 'dist', path) : join(root, 'tools', 'harness', path);
		if (!existsSync(file)) {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
		res.end(readFileSync(file));
	});
}

async function listen(srv) {
	await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
	return `http://127.0.0.1:${srv.address().port}`;
}

const browser = await chromium.launch();
let checks = 0;
const check = (condition, message) => {
	checks++;
	assert.ok(condition, message);
};

// --- On Prototir -------------------------------------------------------------------------------
{
	const srv = server(true);
	const base = await listen(srv);
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto(`${base}/host.html`);
	const game = await (await page.waitForSelector('iframe')).contentFrame();
	await game.waitForFunction(() => window.__addon, null, { timeout: 15000 });

	check(await game.evaluate(() => window.Prototir === window.__servedSdk), 'uses the SDK Prototir serves, not the built-in copy');
	check(await game.evaluate(() => __addon.cnds.IsOnPrototir.call(__addon.inst)), 'Is on Prototir is true in the player');

	await game.evaluate(() => {
		const { acts, inst } = __addon;
		acts.Ready.call(inst);
		acts.SendEvent.call(inst, 'level_complete', '{"level": 2}');
		acts.SendEvent.call(inst, 'bad_data', 'not json');
		acts.ReportScore.call(inst, 1200);
		acts.SaveValue.call(inst, 'best', '42');
		acts.LoadValue.call(inst, 'best');
		acts.GenerateText.call(inst, 'quest', 'dragons', 0);
		acts.GenerateText.call(inst, 'broken', 'fail', 0);
	});
	await game.waitForFunction(
		() => ['OnValueLoaded', 'OnAIResponse', 'OnAIError'].every((t) => window.__triggers.includes(t)),
		null,
		{ timeout: 10000 }
	);
	const sent = await page.evaluate(() => window.__received.filter((m) => m.type !== 'review'));
	check(sent.some((m) => m.type === 'ready'), 'Ready reaches the player');
	check(sent.some((m) => m.type === 'event' && m.name === 'level_complete' && m.data?.level === 2), 'Send event carries its JSON data');
	check(sent.some((m) => m.type === 'event' && m.name === 'bad_data' && m.data === undefined), 'Send event drops data that is not a JSON object');
	check(sent.some((m) => m.type === 'score' && m.value === 1200), 'Report score reaches the player');
	check(sent.some((m) => m.type === 'storage' && m.op === 'set' && m.key === 'best' && m.value === '42'), 'Save value reaches the player');

	const results = await game.evaluate(() => {
		const { cnds, exps, inst } = __addon;
		return {
			stored: exps.StoredValue.call(inst, 'best'),
			loadedKey: cnds.OnValueLoaded.call(inst, 'best'),
			text: exps.AIText.call(inst, 'quest'),
			error: exps.AIError.call(inst, 'broken')
		};
	});
	check(results.stored === '42' && results.loadedKey, 'Load value fires On value loaded and StoredValue returns it');
	check(results.text === 'A quest about dragons', 'Generate text fires On AI response and AIText returns it');
	check(results.error === 'AI is off for this prototype.', 'a refused request fires On AI error with the reason');

	// Feedback: a screenshot comes from Construct's renderer and reaches the player's composer.
	await game.evaluate(() => __addon.acts.TakeScreenshot.call(__addon.inst));
	await page.waitForFunction(() => window.__received.some((m) => m.op === 'compose' && m.image), null, { timeout: 10000 });
	check(
		await page.evaluate(() => window.__received.find((m) => m.op === 'compose').image === 'data:image/jpeg;base64,'),
		'Take screenshot sends a JPEG from the renderer'
	);
	await game.evaluate(() => window.__runtimeHandlers['feedback-visibility']({ open: true }));
	check(
		await game.evaluate(() => window.__triggers.includes('OnFeedbackOpened') && __addon.cnds.IsFeedbackOpen.call(__addon.inst)),
		'feedback opening fires On feedback opened'
	);
	await game.evaluate(() => window.__runtimeHandlers['feedback-visibility']({ open: false }));
	check(
		await game.evaluate(() => window.__triggers.includes('OnFeedbackClosed') && !__addon.cnds.IsFeedbackOpen.call(__addon.inst)),
		'feedback closing fires On feedback closed'
	);

	check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
	await page.close();
	srv.close();
}

// --- Construct preview, or an export hosted elsewhere ------------------------------------------
{
	const srv = server(false);
	const base = await listen(srv);
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto(`${base}/game.html`);
	await page.waitForFunction(() => window.__addon, null, { timeout: 15000 });
	check(await page.evaluate(() => Boolean(window.Prototir) && !window.__servedSdk), 'without /prototir.js the built-in SDK runs');
	check(!(await page.evaluate(() => __addon.cnds.IsOnPrototir.call(__addon.inst))), 'Is on Prototir is false outside the player');
	await page.evaluate(() => {
		__addon.acts.Ready.call(__addon.inst);
		__addon.acts.SendEvent.call(__addon.inst, 'started', '');
	});
	check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
	await page.close();
	srv.close();
}

await browser.close();
console.log(`${checks} Construct addon checks passed.`);
