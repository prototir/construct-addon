// Builds dist/prototir.c3addon from addon/, and checks it on the way.
//
//   node tools/build.mjs
//
// The addon's DOM-side script carries the Prototir Web SDK (vendor/prototir.js, synced from the
// web-sdk repository) as its fallback for Construct's preview and exports hosted elsewhere.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const addonDir = join(root, 'addon');
const read = (path) => readFileSync(join(addonDir, path), 'utf8');
const json = (path) => JSON.parse(read(path).replace(/^﻿/, ''));

// --- the DOM-side script, with the SDK inside -------------------------------------------------
const sdk = readFileSync(join(root, 'vendor', 'prototir.js'), 'utf8');
const template = read('c3runtime/domSide.template.js');
assert.ok(template.includes('/*__PROTOTIR_WEB_SDK__*/'), 'domSide template lost its SDK placeholder');
const domSide = template.replace('/*__PROTOTIR_WEB_SDK__*/', () => sdk);

// --- checks -------------------------------------------------------------------------------------
// Scirra's own JSON schemas (tools/*.schema.json, from github.com/Scirra/Construct-Addon-SDK).
const { default: Ajv2020 } = await import('ajv/dist/2020.js');
for (const [file, schema] of [
	['addon.json', 'plugin.addon.schema.json'],
	['aces.json', 'aces.schema.json'],
	['lang/en-US.json', 'plugin.lang.schema.json']
]) {
	// One validator per schema: two of Scirra's schemas declare the same $id.
	const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
	const validate = ajv.compile(JSON.parse(readFileSync(join(root, 'tools', schema), 'utf8').replace(/^﻿/, '')));
	const valid = validate(json(file));
	assert.ok(valid, `${file} does not match ${schema}: ${ajv.errorsText(validate.errors)}`);
}
const addon = json('addon.json');
assert.equal(addon['sdk-version'], 2, 'addon.json must use Addon SDK v2');
assert.equal(addon.id, 'Prototir_SDK', 'never change the plugin id');
const files = new Map();
for (const file of addon['file-list']) {
	files.set(file, file === 'c3runtime/domSide.js' ? domSide : readFileSync(join(addonDir, file)));
}
// Nothing in addon/ is left out of the file list (the template is the source of domSide.js).
const onDisk = [];
(function walk(dir) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full);
		else onDisk.push(relative(addonDir, full).split(sep).join('/'));
	}
})(addonDir);
for (const file of onDisk)
	if (file !== 'c3runtime/domSide.template.js') assert.ok(files.has(file), `${file} is not in addon.json's file-list`);

// Every ACE has its implementation and its English text.
const aces = json('aces.json');
const lang = json('lang/en-US.json').text.plugins.prototir_sdk;
const runtimeOf = { conditions: 'conditions.js', actions: 'actions.js', expressions: 'expressions.js' };
let count = 0;
for (const [category, groups] of Object.entries(aces)) {
	if (category.startsWith('$')) continue;
	assert.ok(lang.aceCategories[category], `no name for ACE category ${category}`);
	for (const [kind, list] of Object.entries(groups)) {
		const source = read(`c3runtime/${runtimeOf[kind]}`);
		for (const ace of list) {
			count++;
			const fn = ace.scriptName ?? ace.expressionName;
			assert.ok(source.includes(`\n\t${fn}(`), `${kind} ${ace.id}: ${fn}() is missing`);
			const text = lang[kind]?.[ace.id];
			assert.ok(text, `${kind} ${ace.id} has no English text`);
			for (const param of ace.params ?? []) assert.ok(text.params?.[param.id], `${kind} ${ace.id}: no text for param ${param.id}`);
			// Construct refuses to load an addon whose display text leaves out a parameter.
			if (kind !== 'expressions')
				(ace.params ?? []).forEach((_, i) =>
					assert.ok(text['display-text'].includes(`{${i}}`), `${kind} ${ace.id}: display-text must show parameter {${i}}`)
				);
		}
	}
}

// --- package --------------------------------------------------------------------------------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf) => {
	let c = 0xffffffff;
	for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const locals = [];
const centrals = [];
let offset = 0;
for (const [name, content] of files) {
	const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
	const packed = deflateRawSync(data);
	const nameBuf = Buffer.from(name, 'utf8');
	const crc = crc32(data);
	const local = Buffer.alloc(30);
	local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
	local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18);
	local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
	const central = Buffer.alloc(46);
	central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
	central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16);
	central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24);
	central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
	locals.push(local, nameBuf, packed);
	centrals.push(central, nameBuf);
	offset += local.length + nameBuf.length + packed.length;
}
const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'prototir.c3addon');
writeFileSync(out, Buffer.concat([...locals, ...centrals, end]));
// The unpacked addon too, for Construct's developer mode and the tests.
for (const [name, content] of files) {
	const target = join(root, 'dist', 'addon', name);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content);
}
// The SDK version, when the web-sdk repository is cloned beside this one (not in CI).
let sdkVersion = 'vendored';
try {
	sdkVersion = JSON.parse(readFileSync(join(root, '..', 'prototir-web-sdk', 'package.json'), 'utf8')).version;
} catch {
	/* not cloned here */
}
console.log(`Built dist/prototir.c3addon: ${files.size} files, ${count} actions, conditions and expressions, SDK ${sdkVersion}.`);
