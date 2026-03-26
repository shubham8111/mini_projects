const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, error: e.message });
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
    }
}

async function asyncTest(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, error: e.message });
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
    }
}

function createDOM(opts = {}) {
    const localStore = opts.presetStorage ? { ...opts.presetStorage } : {};

    const dom = new JSDOM(html, {
        url: opts.url || 'https://localhost/',
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        beforeParse(window) {
            // Mock localStorage using Object.defineProperty to ensure it sticks
            const mockStorage = {
                getItem: (key) => localStore[key] !== undefined ? localStore[key] : null,
                setItem: (key, val) => { localStore[key] = String(val); },
                removeItem: (key) => { delete localStore[key]; },
                clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); },
                get length() { return Object.keys(localStore).length; },
                key: (i) => Object.keys(localStore)[i] || null,
            };
            Object.defineProperty(window, 'localStorage', {
                value: mockStorage,
                writable: true,
                configurable: true,
            });

            // Mock requestAnimationFrame / cancelAnimationFrame
            let rafId = 0;
            window.requestAnimationFrame = (cb) => { return ++rafId; };
            window.cancelAnimationFrame = (id) => {};

            // Mock AudioContext
            class MockAnalyserNode {
                constructor() {
                    this.fftSize = 2048;
                    this._mockData = null;
                }
                getFloatTimeDomainData(arr) {
                    if (this._mockData) {
                        for (let i = 0; i < arr.length; i++) {
                            arr[i] = i < this._mockData.length ? this._mockData[i] : 0;
                        }
                    } else {
                        for (let i = 0; i < arr.length; i++) arr[i] = 0;
                    }
                }
            }

            class MockAudioContext {
                constructor() {
                    this.state = 'running';
                    this._analyser = new MockAnalyserNode();
                }
                resume() { this.state = 'running'; return Promise.resolve(); }
                close() { this.state = 'closed'; return Promise.resolve(); }
                createAnalyser() { return this._analyser; }
                createMediaStreamSource() {
                    return { connect: () => {} };
                }
            }

            window.AudioContext = MockAudioContext;
            window.webkitAudioContext = MockAudioContext;

            // Mock navigator.mediaDevices
            if (opts.noMediaDevices) {
                Object.defineProperty(window.navigator, 'mediaDevices', {
                    value: undefined,
                    writable: true,
                    configurable: true,
                });
            } else if (opts.denyPermission) {
                Object.defineProperty(window.navigator, 'mediaDevices', {
                    value: {
                        getUserMedia: () => Promise.reject(
                            Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
                        ),
                    },
                    writable: true,
                    configurable: true,
                });
            } else if (opts.noMicrophone) {
                Object.defineProperty(window.navigator, 'mediaDevices', {
                    value: {
                        getUserMedia: () => Promise.reject(
                            Object.assign(new Error('No mic'), { name: 'NotFoundError' })
                        ),
                    },
                    writable: true,
                    configurable: true,
                });
            } else {
                Object.defineProperty(window.navigator, 'mediaDevices', {
                    value: {
                        getUserMedia: () => Promise.resolve({
                            getTracks: () => [{
                                stop: () => {},
                                kind: 'audio',
                            }],
                        }),
                    },
                    writable: true,
                    configurable: true,
                });
            }
        },
    });

    dom._localStore = localStore;
    return dom;
}

// Helper: parse calibration display text to get the offset value
function getCalibrationValue(doc) {
    const text = doc.getElementById('cal-value').textContent;
    return parseFloat(text.replace(' dB', ''));
}

async function runAllTests() {

    // ==========================================
    // TEST SUITE 1: Pure Logic Functions
    // ==========================================
    console.log('\n--- Pure Logic Functions ---');

    {
        const dom = createDOM();
        const win = dom.window;

        test('computeRMS: silence (all zeros) returns 0', () => {
            const buf = new Float32Array(1024);
            assert.strictEqual(win.computeRMS(buf), 0);
        });

        test('computeRMS: constant signal returns correct RMS', () => {
            const buf = new Float32Array(1024).fill(0.5);
            const rms = win.computeRMS(buf);
            assert(Math.abs(rms - 0.5) < 1e-6, `Expected 0.5, got ${rms}`);
        });

        test('computeRMS: known sine-like signal', () => {
            const buf = new Float32Array(4);
            buf[0] = 1; buf[1] = -1; buf[2] = 1; buf[3] = -1;
            const rms = win.computeRMS(buf);
            assert(Math.abs(rms - 1.0) < 1e-6, `Expected 1.0, got ${rms}`);
        });

        test('computeRMS: single sample', () => {
            const buf = new Float32Array([0.7]);
            const rms = win.computeRMS(buf);
            assert(Math.abs(rms - 0.7) < 1e-6, `Expected 0.7, got ${rms}`);
        });

        test('rmsToDb: silence returns DB_MIN (-90)', () => {
            assert.strictEqual(win.rmsToDb(0), -90);
        });

        test('rmsToDb: very small value returns DB_MIN', () => {
            assert.strictEqual(win.rmsToDb(1e-11), -90);
        });

        test('rmsToDb: exactly 1e-10 returns DB_MIN', () => {
            assert.strictEqual(win.rmsToDb(1e-10), -90);
        });

        test('rmsToDb: RMS of 1.0 returns 0 dB', () => {
            assert.strictEqual(win.rmsToDb(1.0), 0);
        });

        test('rmsToDb: RMS of 0.1 returns -20 dB', () => {
            const db = win.rmsToDb(0.1);
            assert(Math.abs(db - (-20)) < 0.01, `Expected -20, got ${db}`);
        });

        test('rmsToDb: RMS of 0.01 returns -40 dB', () => {
            const db = win.rmsToDb(0.01);
            assert(Math.abs(db - (-40)) < 0.01, `Expected -40, got ${db}`);
        });

        test('rmsToDb: clamps to DB_MIN for extremely small values', () => {
            assert.strictEqual(win.rmsToDb(1e-6), -90);
        });

        test('rmsToDb: clamps to DB_MAX for values > 1', () => {
            assert.strictEqual(win.rmsToDb(10), 0);
        });

        test('rmsToDb: just above threshold returns valid dB', () => {
            const db = win.rmsToDb(1e-4);
            assert(db > -90 && db < 0, `Expected between -90 and 0, got ${db}`);
        });

        test('dbToPercent: DB_MIN (0) returns 0%', () => {
            assert.strictEqual(win.dbToPercent(0), 0);
        });

        test('dbToPercent: DB_MAX (120) returns 100%', () => {
            assert.strictEqual(win.dbToPercent(120), 100);
        });

        test('dbToPercent: 60 dB returns 50%', () => {
            const pct = win.dbToPercent(60);
            assert(Math.abs(pct - 50) < 0.01, `Expected 50, got ${pct}`);
        });

        test('dbToPercent: value below DB_MIN gives negative percent', () => {
            const pct = win.dbToPercent(-10);
            assert(pct < 0, `Expected negative, got ${pct}`);
        });

        test('dbToPercent: value above DB_MAX gives > 100%', () => {
            const pct = win.dbToPercent(130);
            assert(pct > 100, `Expected > 100, got ${pct}`);
        });

        test('getBarColor: low percent returns green', () => {
            assert.strictEqual(win.getBarColor(30), '#4CAF50');
        });

        test('getBarColor: mid percent returns yellow', () => {
            assert.strictEqual(win.getBarColor(60), '#FFC107');
        });

        test('getBarColor: high percent returns red', () => {
            assert.strictEqual(win.getBarColor(80), '#f44336');
        });

        test('getBarColor: boundary at 55 is yellow', () => {
            assert.strictEqual(win.getBarColor(55), '#FFC107');
        });

        test('getBarColor: boundary at 54.9 is green', () => {
            assert.strictEqual(win.getBarColor(54.9), '#4CAF50');
        });

        test('getBarColor: boundary at 78 is red', () => {
            assert.strictEqual(win.getBarColor(78), '#f44336');
        });

        test('getBarColor: boundary at 77.9 is yellow', () => {
            assert.strictEqual(win.getBarColor(77.9), '#FFC107');
        });

        test('getBarGradient: low level returns green-only gradient', () => {
            const g = win.getBarGradient(30);
            assert(g.includes('#2E7D32') && g.includes('#4CAF50'), `Unexpected: ${g}`);
            assert(!g.includes('#FFC107'), 'Should not contain yellow');
        });

        test('getBarGradient: mid level includes yellow', () => {
            const g = win.getBarGradient(60);
            assert(g.includes('#FFC107'), `Should contain yellow: ${g}`);
            assert(!g.includes('#f44336'), 'Should not contain red');
        });

        test('getBarGradient: high level includes red', () => {
            const g = win.getBarGradient(85);
            assert(g.includes('#f44336'), `Should contain red: ${g}`);
        });

        dom.window.close();
    }

    // ==========================================
    // TEST SUITE 2: Calibration
    // ==========================================
    console.log('\n--- Calibration ---');

    {
        const dom = createDOM();
        const win = dom.window;
        const doc = win.document;

        test('initial calibration offset is 90', () => {
            assert.strictEqual(win.calibrationOffset, 90);
        });

        test('initial calibration display is +0 dB', () => {
            assert.strictEqual(doc.getElementById('cal-value').textContent, '+0 dB');
        });

        test('adjustCalibration(+1) increments offset to 91', () => {
            win.adjustCalibration(1);
            assert.strictEqual(win.calibrationOffset, 91);
            assert.strictEqual(doc.getElementById('cal-value').textContent, '+1 dB');
        });

        test('adjustCalibration(-1) decrements offset', () => {
            win.resetCalibration();
            win.adjustCalibration(-1);
            assert.strictEqual(win.calibrationOffset, 89);
            assert.strictEqual(doc.getElementById('cal-value').textContent, '-1 dB');
        });

        test('calibration clamps at +200 (+110 displayed)', () => {
            win.resetCalibration();
            for (let i = 0; i < 150; i++) win.adjustCalibration(1);
            assert.strictEqual(win.calibrationOffset, 200);
            assert.strictEqual(doc.getElementById('cal-value').textContent, '+110 dB');
        });

        test('calibration clamps at 0 (-90 displayed)', () => {
            win.resetCalibration();
            for (let i = 0; i < 150; i++) win.adjustCalibration(-1);
            assert.strictEqual(win.calibrationOffset, 0);
            assert.strictEqual(doc.getElementById('cal-value').textContent, '-90 dB');
        });

        test('resetCalibration sets offset to 90', () => {
            win.adjustCalibration(10);
            win.resetCalibration();
            assert.strictEqual(win.calibrationOffset, 90);
        });

        test('calibration persists to localStorage using SPL key', () => {
            win.resetCalibration();
            win.adjustCalibration(7);
            assert.strictEqual(dom._localStore['db-meter-calibration-spl'], '97');
        });

        dom.window.close();
    }

    // Test calibration loading from localStorage (separate DOM instances)
    {
        test('calibration loads +95 (displays +5) from localStorage on init', () => {
            const dom = createDOM({ presetStorage: { 'db-meter-calibration-spl': '95' } });
            assert.strictEqual(dom.window.calibrationOffset, 95);
            assert.strictEqual(dom.window.document.getElementById('cal-value').textContent, '+5 dB');
            dom.window.close();
        });

        test('calibration migrates legacy key on init', () => {
            const dom = createDOM({ presetStorage: { 'db-meter-calibration': '5.0' } });
            assert.strictEqual(dom.window.calibrationOffset, 95.0);
            assert.strictEqual(dom.window.document.getElementById('cal-value').textContent, '+5 dB');
            dom.window.close();
        });
    }

    // ==========================================
    // TEST SUITE 3: UI State Transitions
    // ==========================================
    console.log('\n--- UI State Transitions ---');

    {
        const dom = createDOM();
        const win = dom.window;
        const doc = win.document;

        test('start screen is visible initially', () => {
            assert.notStrictEqual(doc.getElementById('start-screen').style.display, 'none');
        });

        test('meter screen is hidden initially', () => {
            const meterScreen = doc.getElementById('meter-screen');
            const computed = win.getComputedStyle(meterScreen);
            assert(computed.display === 'none' || meterScreen.style.display === 'none');
        });

        test('error message is hidden initially', () => {
            const errorMsg = doc.getElementById('error-msg');
            const computed = win.getComputedStyle(errorMsg);
            assert(computed.display === 'none' || errorMsg.style.display === 'none');
        });

        test('showError displays error message', () => {
            win.showError('Test error');
            const errorMsg = doc.getElementById('error-msg');
            assert.strictEqual(errorMsg.textContent, 'Test error');
            assert.strictEqual(errorMsg.style.display, 'block');
        });

        test('dB readout shows placeholder initially', () => {
            assert.strictEqual(doc.getElementById('db-value').textContent, '--.-');
        });

        await asyncTest('requestMicrophone switches to meter screen', async () => {
            await win.requestMicrophone();
            assert.strictEqual(doc.getElementById('start-screen').style.display, 'none');
            assert.strictEqual(doc.getElementById('meter-screen').style.display, 'flex');
        });

        test('stopMeter switches back to start screen', () => {
            win.stopMeter();
            assert.strictEqual(doc.getElementById('start-screen').style.display, 'flex');
            assert.strictEqual(doc.getElementById('meter-screen').style.display, 'none');
        });

        test('stopMeter clears error message', () => {
            win.showError('Some error');
            win.stopMeter();
            assert.strictEqual(doc.getElementById('error-msg').style.display, 'none');
        });

        await asyncTest('stopMeter nullifies audioContext and mediaStream', async () => {
            await win.requestMicrophone();
            win.stopMeter();
            assert.strictEqual(win.audioContext, null);
            assert.strictEqual(win.mediaStream, null);
        });

        await asyncTest('multiple start/stop cycles work', async () => {
            for (let i = 0; i < 3; i++) {
                await win.requestMicrophone();
                assert.strictEqual(doc.getElementById('meter-screen').style.display, 'flex');
                win.stopMeter();
                assert.strictEqual(doc.getElementById('start-screen').style.display, 'flex');
            }
        });

        dom.window.close();
    }

    // ==========================================
    // TEST SUITE 4: Error Handling
    // ==========================================
    console.log('\n--- Error Handling ---');

    await asyncTest('shows error when mediaDevices not supported', async () => {
        const dom = createDOM({ noMediaDevices: true });
        await dom.window.requestMicrophone();
        const errorMsg = dom.window.document.getElementById('error-msg');
        assert(errorMsg.textContent.includes('does not support'));
        assert.strictEqual(errorMsg.style.display, 'block');
        dom.window.close();
    });

    await asyncTest('shows error when permission denied', async () => {
        const dom = createDOM({ denyPermission: true });
        await dom.window.requestMicrophone();
        await new Promise(r => setTimeout(r, 50));
        const errorMsg = dom.window.document.getElementById('error-msg');
        assert(errorMsg.textContent.includes('denied'), `Got: ${errorMsg.textContent}`);
        dom.window.close();
    });

    await asyncTest('shows error when no microphone found', async () => {
        const dom = createDOM({ noMicrophone: true });
        await dom.window.requestMicrophone();
        await new Promise(r => setTimeout(r, 50));
        const errorMsg = dom.window.document.getElementById('error-msg');
        assert(errorMsg.textContent.includes('No microphone'), `Got: ${errorMsg.textContent}`);
        dom.window.close();
    });

    await asyncTest('stays on start screen when permission denied', async () => {
        const dom = createDOM({ denyPermission: true });
        await dom.window.requestMicrophone();
        await new Promise(r => setTimeout(r, 50));
        assert.notStrictEqual(dom.window.document.getElementById('meter-screen').style.display, 'flex');
        dom.window.close();
    });

    // ==========================================
    // TEST SUITE 5: Display Update Logic
    // ==========================================
    console.log('\n--- Display Update Logic ---');

    {
        const dom = createDOM();
        const win = dom.window;
        const doc = win.document;

        test('updateDisplay: numerical readout follows peak indicator (clampedDB)', () => {
            win.calibrationOffset = 100;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(-45.3); // -45.3 + 100 = 54.7. peakDB = 54.7
            assert.strictEqual(doc.getElementById('db-value').textContent, '54.7');
        });

        test('updateDisplay: numerical readout stays at peak on quiet signal', () => {
            win.calibrationOffset = 100;
            win.peakDB = 80; // High initial peak
            win.peakDecayTimer = 60;
            win.updateDisplay(-60); // 40 dB SPL (lower than 80)
            assert.strictEqual(doc.getElementById('db-value').textContent, '80.0');
        });

        test('updateDisplay: numerical readout follows peak decay', () => {
            win.calibrationOffset = 100;
            win.peakDB = 80;
            win.peakDecayTimer = 0; // Trigger decay
            win.updateDisplay(-90); // 10 dB SPL (much lower than 80)
            // 80 - 0.5 = 79.5
            assert.strictEqual(doc.getElementById('db-value').textContent, '79.5');
        });

        test('updateDisplay: numerical readout applies calibration offset to peak', () => {
            win.calibrationOffset = 110;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(-45.0); // -45.0 + 110 = 65.0. peakDB = 65.0
            assert.strictEqual(doc.getElementById('db-value').textContent, '65.0');
        });

        test('updateDisplay: 60 dB SPL shows 50% bar height', () => {
            win.calibrationOffset = 100;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(-40); // -40 + 100 = 60. (60-0)/(120-0) = 50%
            assert.strictEqual(doc.getElementById('meter-fill').style.height, '50%');
        });

        test('updateDisplay: 0 dB SPL shows 0% bar', () => {
            win.calibrationOffset = 90;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(-90); // -90 + 90 = 0. (0-0)/120 = 0%
            assert.strictEqual(doc.getElementById('meter-fill').style.height, '0%');
        });

        test('updateDisplay: 120 dB SPL shows 100% bar', () => {
            win.calibrationOffset = 120;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(0); // 0 + 120 = 120. (120-30)/90 = 100%
            assert.strictEqual(doc.getElementById('meter-fill').style.height, '100%');
        });

        test('meter bar gradient green for low level', () => {
            win.calibrationOffset = 100;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(-60); // 40 dB SPL
            const bg = doc.getElementById('meter-fill').style.background;
            assert(bg.includes('4CAF50') || bg.includes('76, 175, 80') ||
                   bg.includes('2E7D32') || bg.includes('46, 125, 50'),
                `Expected green, got: ${bg}`);
        });

        test('meter bar gradient includes yellow at mid level', () => {
            win.calibrationOffset = 100;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(-20); // 80 dB SPL (yellow threshold)
            const bg = doc.getElementById('meter-fill').style.background;
            assert(bg.includes('FFC107') || bg.includes('255, 193, 7'),
                `Expected yellow, got: ${bg}`);
        });

        test('meter bar gradient includes red at high level', () => {
            win.calibrationOffset = 110;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            win.updateDisplay(0); // 110 dB SPL (well into red)
            const bg = doc.getElementById('meter-fill').style.background;
            assert(bg.includes('f44336') || bg.includes('244, 67, 54'),
                `Expected red, got: ${bg}`);
        });

        test('peak indicator moves up on loud signal', () => {
            win.calibrationOffset = 100;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            // Feed silence to reset
            for (let i = 0; i < 200; i++) win.updateDisplay(-90);
            // Now loud signal
            win.updateDisplay(-10); // 90 dB SPL
            const peakBottom = parseFloat(doc.getElementById('meter-peak').style.bottom);
            assert(peakBottom > 50, `Peak should be high, got ${peakBottom}%`);
        });

        test('peak holds for 60 frames then decays', () => {
            win.calibrationOffset = 100;
            win.peakDB = 30;
            win.peakDecayTimer = 0;
            // Set peak with loud signal
            win.updateDisplay(-10); // 90 dB SPL
            const peakAfterLoud = parseFloat(doc.getElementById('meter-peak').style.bottom);

            // Feed silence - peak should hold then decay
            for (let i = 0; i < 70; i++) win.updateDisplay(-90);
            const peakAfterDecay = parseFloat(doc.getElementById('meter-peak').style.bottom);

            assert(peakAfterDecay < peakAfterLoud,
                `Peak should decay: was ${peakAfterLoud}%, now ${peakAfterDecay}%`);
            assert(peakAfterDecay > 0, `Peak shouldn't be at zero yet: ${peakAfterDecay}%`);
        });

        test('peak indicator hidden when fully decayed', () => {
            win.calibrationOffset = 0;
            win.peakDB = -90;
            win.peakDecayTimer = 0;
            for (let i = 0; i < 500; i++) win.updateDisplay(-90);
            const peakBottom = parseFloat(doc.getElementById('meter-peak').style.bottom);
            assert(peakBottom <= 0.5, `Peak should be near 0, got ${peakBottom}%`);
        });

        dom.window.close();
    }

    // ==========================================
    // TEST SUITE 6: Audio Pipeline (mocked)
    // ==========================================
    console.log('\n--- Audio Pipeline ---');

    {
        const dom = createDOM();
        const win = dom.window;

        await asyncTest('audio context and analyser created after start', async () => {
            await win.requestMicrophone();
            assert.notStrictEqual(win.audioContext, null);
            assert.notStrictEqual(win.analyser, null);
        });

        test('analyser fftSize is 2048', () => {
            assert.strictEqual(win.analyser.fftSize, 2048);
        });

        test('dataArray has correct length (2048)', () => {
            assert.notStrictEqual(win.dataArray, null);
            assert.strictEqual(win.dataArray.length, 2048);
        });

        test('updateMeter reads audio data and updates smoothedDB', () => {
            win.analyser._mockData = new Float32Array(2048).fill(0.1);
            win.smoothedDB = -90;
            win.updateMeter();
            assert(win.smoothedDB > -90, `smoothedDB should increase, got ${win.smoothedDB}`);
        });

        test('smoothing converges towards actual value over frames', () => {
            win.analyser._mockData = new Float32Array(2048).fill(0.1);
            win.smoothedDB = -90;
            for (let i = 0; i < 100; i++) {
                win.analyser.getFloatTimeDomainData(win.dataArray);
                const rms = win.computeRMS(win.dataArray);
                const db = win.rmsToDb(rms);
                win.smoothedDB = 0.3 * db + 0.7 * win.smoothedDB;
            }
            assert(Math.abs(win.smoothedDB - (-20)) < 0.5,
                `Should converge to -20 dB, got ${win.smoothedDB}`);
        });

        test('stopMeter sets audioContext to null', () => {
            win.stopMeter();
            assert.strictEqual(win.audioContext, null);
        });

        test('stopMeter sets mediaStream to null', () => {
            assert.strictEqual(win.mediaStream, null);
        });

        test('animationId is null after stop', () => {
            assert.strictEqual(win.animationId, null);
        });

        dom.window.close();
    }

    // ==========================================
    // TEST SUITE 7: HTML Structure
    // ==========================================
    console.log('\n--- HTML Structure ---');

    {
        const dom = createDOM();
        const doc = dom.window.document;

        test('page title is "Decibel Meter"', () => {
            assert.strictEqual(doc.title, 'Decibel Meter');
        });

        test('viewport meta tag is correct', () => {
            const meta = doc.querySelector('meta[name="viewport"]');
            assert(meta, 'Viewport meta tag should exist');
            assert(meta.content.includes('width=device-width'));
            assert(meta.content.includes('user-scalable=no'));
            assert(meta.content.includes('viewport-fit=cover'));
        });

        test('charset is UTF-8', () => {
            const meta = doc.querySelector('meta[charset]');
            assert(meta);
            assert.strictEqual(meta.getAttribute('charset'), 'UTF-8');
        });

        test('start button exists', () => {
            const btn = doc.getElementById('start-btn');
            assert(btn && btn.tagName === 'BUTTON');
        });

        test('stop button exists', () => {
            const btn = doc.getElementById('stop-btn');
            assert(btn && btn.tagName === 'BUTTON');
        });

        test('two calibration buttons (+/-) exist', () => {
            assert.strictEqual(doc.querySelectorAll('.cal-btn').length, 2);
        });

        test('reset button exists', () => {
            assert(doc.getElementById('reset-btn'));
        });

        test('meter bar elements exist', () => {
            assert(doc.getElementById('meter-fill'));
            assert(doc.getElementById('meter-peak'));
            assert(doc.querySelector('.meter-bar-container'));
        });

        test('mascot and right signals containers exist', () => {
            assert(doc.querySelector('.mascot-container'));
            assert(doc.querySelector('.right-signals'));
        });

        test('meter ticks show correct SPL labels', () => {
            const labels = Array.from(doc.querySelectorAll('.meter-ticks span')).map(t => t.textContent);
            assert.deepStrictEqual(labels, ['120', '90', '60', '30', '0']);
        });

        test('dB unit label shows "dB"', () => {
            assert.strictEqual(doc.getElementById('db-unit').textContent, 'dB');
        });

        dom.window.close();
    }

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '='.repeat(40));
    console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.error}`));
    }
    console.log('='.repeat(40));
    process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});
