// The Supporter Shop played in a real browser with a pretend Solana wallet (it follows the Wallet Standard like Phantom and MetaMask) and a pretend
// blockchain server: connect, buy with the confirmation screen, wear the crown, restore after losing the device's memory, and the unhappy paths.
// Nothing real is ever paid. node tools/e2e-pay.mjs [chromium] [webkit]      SITE=https://… tests a deployed copy
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MERCHANT, USDC_MINT } from '../js/data/store.js';
import { usdcAccountOf } from '../js/pay/solana.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.env.SITE ? null : await startServer(path.join(ROOT, 'dist'));
const url = process.env.SITE || local.url, server = local ? local.server : { close() {} }; // (SITE=https://… tests the deployed copy)
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
const engines = process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'webkit'];
const BUYER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', BLOCKHASH = 'FnfXymbDhHCYFLWRqJ5k88956ULSFKei1srbNPzYNDW', MERCHANT_ATA = await usdcAccountOf(MERCHANT);

for (const name of engines) {
  const eng = name === 'webkit' ? webkit : chromium;
  for (const [label, touch] of [['mouse', false], ['touch', true]]) {
    console.log(`\n== ${name} · ${label}`);
    const browser = await eng.launch();
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
    const state = { sent: false, usdc: 20_000_000, sol: 1_000_000_000, merchantOpen: true, calls: [] };
    await ctx.route(/publicnode\.com|api\.mainnet-beta\.solana\.com|onfinality\.io/, async (route) => {
      const req = JSON.parse(route.request().postData() || '{}'), m = req.method, p = req.params || [];
      state.calls.push(m);
      const res = (result) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) });
      if (m === 'getSignaturesForAddress') return res(state.sent ? [{ signature: 'MOCKSIGNATURE', err: null }] : []);
      if (m === 'getTransaction') return res({ meta: { err: null }, transaction: { message: { instructions: [{ program: 'spl-token', parsed: { type: 'transferChecked', info: { authority: BUYER, destination: MERCHANT_ATA, mint: USDC_MINT, source: 'x', tokenAmount: { amount: '10000000', decimals: 6 } } } }] } } });
      if (m === 'getBalance') return res({ value: state.sol });
      if (m === 'getLatestBlockhash') return res({ value: { blockhash: BLOCKHASH } });
      if (m === 'getAccountInfo') return p[0] === MERCHANT_ATA ? res({ value: state.merchantOpen ? { data: ['', 'base64'] } : null }) : res({ value: { data: { parsed: { info: { tokenAmount: { amount: String(state.usdc) } } } } } });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'not mocked' } }) });
    });
    await ctx.exposeFunction('markSent', () => { state.sent = true; });
    await ctx.addInitScript((buyer) => {
      const account = { address: buyer, publicKey: new Uint8Array(32), chains: ['solana:mainnet'], features: [] };
      const wallet = { version: '1.0.0', name: 'Mock Phantom', icon: '', chains: ['solana:mainnet'], accounts: [], features: {
        'standard:connect': { version: '1.0.0', connect: async () => { wallet.accounts = [account]; return { accounts: [account] }; } },
        'solana:signAndSendTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy'], signAndSendTransaction: async (...inputs) => {
          if (window.__reject) { const e = new Error('User rejected the request.'); e.code = 4001; throw e; }
          window.__paid = (window.__paid || []).concat(inputs.map((i) => ({ chain: i.chain, bytes: i.transaction.length })));
          await window.markSent();
          return inputs.map(() => ({ signature: new Uint8Array(64).fill(9) }));
        } },
      } };
      const reg = (api) => api.register(wallet);
      window.addEventListener('wallet-standard:app-ready', (e) => reg(e.detail));
      const ev = new Event('wallet-standard:register-wallet'); Object.defineProperty(ev, 'detail', { value: reg }); window.dispatchEvent(ev);
    }, BUYER);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => { if (!/WebSocket port 1 blocked/.test(e.message)) errs.push(e.message); });
    page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|ERR_|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    const boot = async () => { await page.goto(url + '?quick=classic&seed=pay' + name, { waitUntil: 'load' }); await page.waitForFunction(() => window.__snug && window.__snug.game, null, { timeout: 20000 }); await page.waitForTimeout(700); };
    const tapEl = async (loc) => { const b = await loc.boundingBox(); if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(250); };
    const openShop = async () => { await tapEl(page.locator('.hbtn', { hasText: 'Menu' })); await tapEl(page.locator('.btn', { hasText: 'Supporter shop' })); await page.waitForSelector('.supp', { timeout: 4000 }); };
    const status = () => page.evaluate(() => (document.querySelector('.supp [role=status]') || {}).textContent || '');
    await boot();

    // ------------------------------------------------------------ open the shop, connect
    await openShop();
    const intro = await page.evaluate(() => document.querySelector('.supp').textContent);
    ok(/whole game is free/.test(intro) && /USDC on Solana/.test(intro), 'the shop says the game is free and that this is optional, paid in USDC on Solana');
    const cards = await page.locator('.supp .crcard').count();
    ok(cards === 5, `five things on the shelves (${cards})`);
    ok(await page.locator('.supp .btn', { hasText: 'Connect a wallet to buy' }).count() === 1, 'buying needs a wallet first');
    await tapEl(page.locator('.supp .btn', { hasText: 'Mock Phantom' }));
    ok(/Mock Phantom · 9WzD…AWWM/.test(await page.evaluate(() => document.querySelector('.suppwallet').textContent)), 'connected: the wallet and its short address are shown');

    // ------------------------------------------------------------ buy the crown: the confirmation shows exactly what will be paid and to whom
    await tapEl(page.locator('.supp .crcard[title="Royal Crown"]'));
    await tapEl(page.locator('.supp .btn', { hasText: 'Buy · $3.00 USDC' }));
    const conf = await page.evaluate(() => document.querySelector('.suppdetail').textContent);
    ok(/\$3\.00 in USDC/.test(conf) && conf.includes(MERCHANT) && /cannot be undone/.test(conf), 'the confirmation names the price, the network and the full receiving address');
    ok((await page.locator('.supp .btn', { hasText: 'Pay $3.00' }).count()) === 1, 'there is a Pay button, and a Not now');
    await tapEl(page.locator('.supp .btn', { hasText: 'Pay $3.00' }));
    await page.waitForFunction(() => /It is yours|Thank you/.test((document.querySelector('.supp [role=status]') || {}).textContent || ''), null, { timeout: 15000 });
    const paid = await page.evaluate(() => window.__paid);
    ok(paid && paid.length === 1 && paid[0].chain === 'solana:mainnet' && paid[0].bytes > 200, `the wallet was asked once to pay on Solana (${JSON.stringify(paid)})`);
    ok(await page.locator('.supp .crcard[title="Royal Crown"] .shopprice', { hasText: 'Owned' }).count() === 1, 'the crown now shows Owned');
    const cos = await page.evaluate(() => ({ me: __snug.game.me.cos, owned: JSON.parse(localStorage.getItem('snug.owned') || '{}') }));
    ok(cos.me === 8 && cos.owned.crown && cos.owned.crown.buyer === BUYER, `the player wears the crown (cos ${cos.me}) and the receipt is remembered`);
    ok(!state.calls.includes('getTokenAccountBalance') && !state.calls.includes('getTokenAccountsByOwner') && !state.calls.includes('getTokenLargestAccounts'), 'only the calls the free servers allow were used');

    // wear / hide
    await tapEl(page.locator('.supp .btn', { hasText: 'Wearing: Crown' }));
    ok((await page.evaluate(() => __snug.game.me.cos)) === 0, 'hiding the crown takes it off');
    await tapEl(page.locator('.supp .btn', { hasText: 'Hidden: Crown' }));
    ok((await page.evaluate(() => __snug.game.me.cos)) === 8, 'and puts it back');
    await page.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}-pay-${name}-${label}.png` : undefined });
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);

    // ------------------------------------------------------------ it is still there next time (nothing is paid twice)
    await boot();
    ok((await page.evaluate(() => __snug.game.me.cos)) === 8, 'after a reload the crown is worn straight away');
    await page.evaluate(() => { localStorage.removeItem('snug.owned'); });
    await boot();
    ok((await page.evaluate(() => __snug.game.me.cos)) === 0, 'a device that lost its memory is plain again...');
    await openShop();
    ok(await page.locator('.supp .btn', { hasText: 'Restore my purchases' }).count() === 0, '...and Restore needs the wallet connected');
    await tapEl(page.locator('.supp .btn', { hasText: 'Mock Phantom' }));
    await tapEl(page.locator('.supp .btn', { hasText: 'Restore my purchases' }));
    await page.waitForFunction(() => /Found \d+ purchase/.test((document.querySelector('.supp [role=status]') || {}).textContent || ''), null, { timeout: 15000 });
    ok((await page.evaluate(() => __snug.game.me.cos)) > 0, `Restore found the purchases on the blockchain (${await status()})`);
    // buying what you already own (restored) charges nothing
    await page.evaluate(() => { localStorage.removeItem('snug.owned'); });
    const before = (await page.evaluate(() => window.__paid || [])).length;
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await boot(); await openShop();
    await tapEl(page.locator('.supp .btn', { hasText: 'Mock Phantom' }));
    await tapEl(page.locator('.supp .crcard[title="Supporter Badge"]'));
    await tapEl(page.locator('.supp .btn', { hasText: 'Buy · $1.00 USDC' }));
    await tapEl(page.locator('.supp .btn', { hasText: 'Pay $1.00' }));
    await page.waitForFunction(() => /already owned/.test((document.querySelector('.supp [role=status]') || {}).textContent || ''), null, { timeout: 15000 });
    ok((await page.evaluate(() => (window.__paid || []).length)) === before, 'something already paid for is restored, never charged again');

    // ------------------------------------------------------------ unhappy paths: cancelling in the wallet, no USDC, no SOL
    state.sent = false; await page.evaluate(() => { localStorage.removeItem('snug.owned'); });
    await boot(); await openShop();
    await page.evaluate(() => { window.__reject = true; }); // (the page was reloaded, so this has to come after)
    await tapEl(page.locator('.supp .btn', { hasText: 'Mock Phantom' }));
    await tapEl(page.locator('.supp .crcard[title="Golden Name"]'));
    await tapEl(page.locator('.supp .btn', { hasText: 'Buy · $2.00 USDC' })); await tapEl(page.locator('.supp .btn', { hasText: 'Pay $2.00' }));
    await page.waitForFunction(() => /cancelled/.test((document.querySelector('.supp [role=status]') || {}).textContent || ''), null, { timeout: 8000 });
    ok(true, 'cancelling in the wallet says "Nothing was paid"');
    await page.evaluate(() => { window.__reject = false; });
    state.usdc = 500_000;
    await tapEl(page.locator('.supp .btn', { hasText: 'Buy · $2.00 USDC' })); await tapEl(page.locator('.supp .btn', { hasText: 'Pay $2.00' }));
    await page.waitForFunction(() => /0\.50 USDC/.test((document.querySelector('.supp [role=status]') || {}).textContent || ''), null, { timeout: 8000 });
    ok(!(await page.evaluate(() => window.__paid)) || (await page.evaluate(() => window.__paid.length)) === 1, 'with too little USDC it says how much the wallet has and sends nothing');
    state.usdc = 20_000_000; state.sol = 100;
    await tapEl(page.locator('.supp .btn', { hasText: 'Buy · $2.00 USDC' })); await tapEl(page.locator('.supp .btn', { hasText: 'Pay $2.00' }));
    await page.waitForFunction(() => /bit of SOL/.test((document.querySelector('.supp [role=status]') || {}).textContent || ''), null, { timeout: 8000 });
    ok(true, 'with no SOL for the tiny fee it says so');
    ok(errs.length === 0, 'no errors in the page' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await browser.close();
  }
}
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nall good');
process.exit(failed ? 1 : 0);
